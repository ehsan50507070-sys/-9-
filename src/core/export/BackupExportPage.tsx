// Core Backup, Restore & Persian CSV (UTF-8 BOM) Export/Import Center
import React, { useRef, useState } from 'react';
import {
  Database,
  Download,
  FileSpreadsheet,
  Globe,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { buildUtf8BomCsv, downloadTextFile, parseCsvText } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type { Student } from '../../types/domain';
import { ensureStudentDualCredentials } from '../auth/authService';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import { useToast } from '../ui/ToastContext';
import { validateBackupPayload, validateStudentCsvRow } from '../validation/validators';

export const BackupExportPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    classes,
    students,
    teachers,
    collectionCounts,
    pluginStatuses,
    exportSingleSchoolBackup,
    exportComplexBackup,
    restoreBackup,
    importStudentsBatch,
    resetAllData,
  } = useSchoolData();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const canOpenSmartImportWizard = activeRole === 'super_admin' || activeRole === 'principal';

  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [statusErrors, setStatusErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const disabledPluginPreservedTotal = pluginStatuses
    .filter((p) => p.manifest.implemented && (!p.installed || !p.enabled))
    .reduce((acc, p) => acc + p.preservedRecordCount, 0);

  const totalSchoolRecords = Object.values(collectionCounts).reduce((a, b) => a + (b ?? 0), 0);

  const handleDownloadSchoolJson = async () => {
    const payload = await exportSingleSchoolBackup();
    const today = getTodayJalali().replace(/\//g, '-');
    downloadTextFile(
      `backup-${activeSchoolId}-${today}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
    showToast(
      `فایل پشتیبان کامل «${activeSchool.name}» (شامل تمام رکوردهای بسته‌های غیرفعال) ذخیره شد.`
    );
  };

  const handleDownloadComplexJson = async () => {
    if (!roleDef.canBackupComplexWide) return;
    const payload = await exportComplexBackup();
    const today = getTodayJalali().replace(/\//g, '-');
    downloadTextFile(
      `backup-complex-all-schools-${today}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
    showToast('پشتیبان یکپارچه هر ۳ مدرسه مجموعه دریافت شد.');
  };

  const handleRestoreJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusErrors([]);
    setImportSummary(null);

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validation = validateBackupPayload(parsed);
      if (!validation.valid || !validation.data) {
        setStatusErrors(validation.errors);
        return;
      }

      if (validation.data.scope === 'complex_wide' && !roleDef.canBackupComplexWide) {
        setStatusErrors(['بازیابی پشتیبان کل مجموعه فقط توسط «مدیر کل مجموعه» مجاز است.']);
        return;
      }

      if (
        validation.data.scope === 'single_school' &&
        validation.data.schoolId !== activeSchoolId &&
        !roleDef.canBackupComplexWide
      ) {
        setStatusErrors([
          'این فایل پشتیبان متعلق به مدرسه دیگری است و نمی‌تواند در واحد فعال بازیابی شود.',
        ]);
        return;
      }

      await restoreBackup(validation.data);
      setImportSummary(
        validation.data.scope === 'complex_wide'
          ? 'پشتیبان کل مجموعه با موفقیت اعتبارسنجی و بازیابی شد.'
          : `پشتیبان تک‌مدرسه (${validation.data.data.schools[0]?.name ?? ''}) با موفقیت بازیابی شد.`
      );
      showToast('بازیابی فایل پشتیبان با موفقیت انجام شد.');
    } catch {
      setStatusErrors(['فایل انتخاب‌شده ساختار JSON معتبر ندارد.']);
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  const handleExportStudentsCsv = () => {
    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const headers = [
      'کد دانش‌آموز',
      'نام و نام خانوادگی',
      'کد ملی',
      'کلاس',
      'نام ولی',
      'موبایل ولی',
      'نام کاربری دانش‌آموز',
      'وضعیت رمز دانش‌آموز',
      'نام کاربری ولی',
      'وضعیت رمز ولی',
    ];
    const rows = students.map((raw) => {
      const s = ensureStudentDualCredentials(raw);
      return [
        s.studentCode,
        s.fullName,
        s.nationalId,
        classMap.get(s.classId) ?? s.classId,
        s.parentName,
        s.parentMobile,
        s.studentUsername ?? '',
        'رمزگذاری‌شده (محرمانه)',
        s.parentUsername ?? '',
        'رمزگذاری‌شده (محرمانه)',
      ];
    });
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(`students-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فهرست دانش‌آموزان و نام‌های کاربری (اکسل فارسی UTF-8 BOM) دریافت شد.');
  };

  const handleExportTeachersCsv = () => {
    const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'کد ملی', 'تخصص', 'موبایل', 'سقف زنگ هفتگی'];
    const rows = teachers.map((t) => [
      t.personnelCode,
      t.fullName,
      t.nationalId,
      t.specialty,
      t.mobile,
      t.weeklyQuotaPeriods,
    ]);
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(`teachers-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فهرست کادر و معلمان (اکسل فارسی UTF-8 BOM) دریافت شد.');
  };

  const handleDownloadSampleImportCsv = () => {
    const defaultClass = classes[0]?.id ?? `${activeSchoolId}-c-1`;
    const headers = ['fullName', 'nationalId', 'classId', 'parentName', 'parentMobile'];
    const rows = [
      ['محمدطاها رستگار', '0013520849', defaultClass, 'علی رستگار', '09123456789'],
    ];
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(`sample-students-import-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فایل نمونه ورود دانش‌آموزان (CSV) دریافت شد.');
  };

  const handleImportStudentsCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusErrors([]);
    setImportSummary(null);

    try {
      const text = await file.text();
      const { headers, rows } = parseCsvText(text);
      if (headers.length < 5 || rows.length === 0) {
        setStatusErrors([
          'فایل CSV باید دارای ستون‌های fullName, nationalId, classId, parentName, parentMobile و حداقل یک ردیف باشد.',
        ]);
        return;
      }

      const validStudents: Student[] = [];
      const rowErrors: string[] = [];
      const defaultClassId = classes[0]?.id ?? `${activeSchoolId}-c-1`;

      rows.forEach((cols, index) => {
        const res = validateStudentCsvRow(
          {
            fullName: cols[0] ?? '',
            nationalId: cols[1] ?? '',
            classId: classes.some((c) => c.id === cols[2]) ? cols[2] : defaultClassId,
            parentName: cols[3] ?? '',
            parentMobile: cols[4] ?? '',
          },
          index + 2
        );
        if (!res.valid || !res.data) {
          rowErrors.push(...res.errors);
        } else {
          validStudents.push({
            id: `${activeSchoolId}-s-imp-${Date.now()}-${index}`,
            schoolId: activeSchoolId,
            classId: res.data.classId,
            fullName: res.data.fullName,
            nationalId: res.data.nationalId,
            studentCode: String(50000 + Math.floor(Math.random() * 40000)),
            parentName: res.data.parentName,
            parentMobile: res.data.parentMobile,
            active: true,
          });
        }
      });

      if (rowErrors.length > 0) {
        setStatusErrors(rowErrors.slice(0, 8));
        return;
      }

      await importStudentsBatch(validStudents);
      setImportSummary(
        `${toPersianDigits(validStudents.length)} دانش‌آموز به «${activeSchool.name}» اضافه شدند و برای هر نفر دو حساب مجزای «دانش‌آموز» و «ولی» به‌صورت خودکار ایجاد شد.`
      );
      showToast(
        `${toPersianDigits(validStudents.length)} دانش‌آموز همراه با حساب‌های مجزای دانش‌آموز و ولی وارد سامانه شد.`
      );
    } catch {
      setStatusErrors(['خطا در خواندن فایل CSV.']);
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            پشتیبان‌گیری، بازیابی و تبادل اکسل فارسی
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            پشتیبان‌گیری جامع تک‌مدرسه و کل مجموعه با حفظ ۱۰۰٪ داده‌های بسته‌های الحاقی غیرفعال و
            خروجی CSV استاندارد اکسل فارسی (UTF-8 BOM).
          </p>
        </div>
        {canOpenSmartImportWizard && (
          <button
            type="button"
            onClick={() => navigate('/smart-import-wizard')}
            data-testid="open-smart-import-from-backup"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl brand-btn px-4 text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>ویزارد نگاشت هوشمند جدول‌ها</span>
          </button>
        )}
      </div>

      {/* Integrity Banner */}
      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/70 p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-sm leading-6 text-emerald-950 dark:text-emerald-200 tabular-nums">
          در حال حاضر <strong>{toPersianDigits(totalSchoolRecords)} رکورد</strong> در{' '}
          <strong>{activeSchool.name}</strong> ذخیره است (شامل{' '}
          <strong>{toPersianDigits(disabledPluginPreservedTotal)} رکورد محفوظ</strong> از بسته‌های
          غیرفعال یا حذف‌شده از پنل). همه این رکوردها به‌صورت خودکار در فایل پشتیبان JSON گنجانده
          می‌شوند.
        </div>
      </div>

      {statusErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 text-sm text-rose-800 dark:text-rose-200 space-y-1"
        >
          {statusErrors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      )}

      {importSummary && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-800 dark:text-emerald-200"
        >
          {importSummary}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* JSON Backup & Restore Card */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              پشتیبان‌گیری و بازیابی JSON
            </h2>
          </div>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            پشتیبان تک‌مدرسه تنها داده‌های ایزوله‌شده <strong>{activeSchool.name}</strong> را ذخیره
            می‌کند. پیش از بازیابی، ساختار فایل و تطابق <code>schoolId</code> بررسی می‌شود.
          </p>

          <div className="space-y-2.5">
            {roleDef.canBackupSingleSchool && (
              <button
                type="button"
                onClick={() => void handleDownloadSchoolJson()}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 transition-colors"
              >
                <Download className="w-4 h-4" />
                دریافت پشتیبان کامل {activeSchool.name} (JSON)
              </button>
            )}

            {roleDef.canBackupComplexWide && (
              <button
                type="button"
                onClick={() => void handleDownloadComplexJson()}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 text-sm font-semibold px-4 transition-opacity"
              >
                <Globe className="w-4 h-4" />
                دریافت پشتیبان کل مجموعه — هر ۳ مدرسه (JSON)
              </button>
            )}

            {roleDef.canBackupSingleSchool && (
              <>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void handleRestoreJsonFile(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  بازیابی از فایل پشتیبان JSON (با اعتبارسنجی)
                </button>
              </>
            )}
          </div>
        </section>

        {/* Persian CSV Export & Validated Import Card */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              خروجی و ورود اکسل فارسی (CSV با UTF-8 BOM)
            </h2>
          </div>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            تمامی فایل‌های خروجی با نشانگر UTF-8 BOM (<code>\uFEFF</code>) ساخته می‌شوند تا در
            Microsoft Excel بدون به‌هم‌ریختگی حروف فارسی باز شوند. ورود گروهی دانش‌آموزان با بررسی
            کد ملی ۱۰ رقمی و شماره موبایل انجام می‌شود.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportStudentsCsv}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium px-4 transition-colors"
            >
              <Download className="w-4 h-4" />
              خروجی دانش‌آموزان ({toPersianDigits(students.length)})
            </button>
            <button
              type="button"
              onClick={handleExportTeachersCsv}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium px-4 transition-colors"
            >
              <Download className="w-4 h-4" />
              خروجی کادر و معلمان ({toPersianDigits(teachers.length)})
            </button>
          </div>

          {roleDef.canEditSchoolSettings && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleImportStudentsCsv(e)}
                className="hidden"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  ورود گروهی دانش‌آموزان از CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSampleImportCsv}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium px-3.5 transition-colors whitespace-nowrap"
                >
                  دریافت الگوی نمونه
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Recovery / Reset section for complex_admin */}
      {roleDef.canBackupComplexWide && (
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              بازنشانی داده‌های آزمایشی هر ۳ مدرسه
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              در صورت نیاز به شروع مجدد تست، داده‌های نمونه اولیه هر ۳ مدرسه بازسازی می‌شوند.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void resetAllData().then(() =>
                showToast('داده‌های نمونه اولیه هر ۳ مدرسه بازنشانی شد.', 'info')
              );
            }}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold px-4 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            بازنشانی داده‌های اولیه
          </button>
        </section>
      )}
    </div>
  );
};
