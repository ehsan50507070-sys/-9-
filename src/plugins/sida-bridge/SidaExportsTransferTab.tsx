// Tab 5: Standard SIDA CSV Exports (Student Roster + Grades) & Safe Class Transfer / Year-End Promotion Utility
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import {
  buildSidaGradeExportCsv,
  buildSidaGradeExportRows,
  buildSidaStudentListCsv,
  type SidaExportTerm,
} from './sidaBridgeHelpers';

interface SidaExportsTransferTabProps {
  availableSubjects: string[];
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

const TERM_OPTIONS: SidaExportTerm[] = ['نوبت اول', 'نوبت دوم', 'مستمر', 'توصیفی'];

export const SidaExportsTransferTab: React.FC<SidaExportsTransferTabProps> = ({
  availableSubjects,
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    activeSchool,
    roleDef,
    classes,
    students,
    studentProfiles,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    transferStudentsToClass,
  } = useSchoolData();

  const canTransfer = roleDef.canImportSidaStudents;

  // Grade Export Filters
  const [gradeLevelFilter, setGradeLevelFilter] = useState<number | 'all'>('all');
  const [classIdFilter, setClassIdFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>(() => availableSubjects[0] || 'ریاضی');
  const [exportTerm, setExportTerm] = useState<SidaExportTerm>('نوبت اول');

  // Safe Class Transfer / Year-End Promotion State
  const [sourceClassId, setSourceClassId] = useState<string>(() => classes[0]?.id ?? '');
  const [targetClassId, setTargetClassId] = useState<string>(
    () => classes[1]?.id ?? classes[0]?.id ?? ''
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [transferring, setTransferring] = useState(false);

  const exportRows = useMemo(
    () =>
      buildSidaGradeExportRows({
        students,
        classes,
        gradebookEntries,
        onlineExams,
        onlineExamSubmissions,
        gradeLevelFilter,
        classIdFilter,
        subjectFilter,
        term: exportTerm,
      }),
    [
      students,
      classes,
      gradebookEntries,
      onlineExams,
      onlineExamSubmissions,
      gradeLevelFilter,
      classIdFilter,
      subjectFilter,
      exportTerm,
    ]
  );

  const incompleteExportCount = useMemo(
    () => exportRows.filter((r) => r.warningsFa.length > 0).length,
    [exportRows]
  );

  const sourceStudents = useMemo(
    () =>
      students
        .filter((s) => s.active && s.classId === sourceClassId)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa')),
    [students, sourceClassId]
  );

  const handleExportSidaGradesCsv = () => {
    if (exportRows.length === 0) {
      onErrorToast('دانش‌آموزی با فیلتر انتخاب‌شده برای خروجی یافت نشد.');
      return;
    }
    const csv = buildSidaGradeExportCsv(exportRows);
    downloadTextFile(
      `sida-grades-${subjectFilter}-${exportTerm}-${getTodayJalali().replace(/\//g, '-')}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    onSuccessToast(
      `فایل خروجی نمرات استاندارد سیدا (${toPersianDigits(exportRows.length)} دانش‌آموز) دانلود شد.`
    );
  };

  const handleExportStudentListCsv = () => {
    const csv = buildSidaStudentListCsv({
      students,
      classes,
      studentProfiles,
      classIdFilter,
    });
    downloadTextFile(
      `sida-students-roster-${getTodayJalali().replace(/\//g, '-')}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    onSuccessToast('فایل فهرست دانش‌آموزان با فرمت استاندارد سیدا (UTF-8 BOM) دانلود شد.');
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllSource = () => {
    if (selectedStudentIds.length === sourceStudents.length && sourceStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(sourceStudents.map((s) => s.id));
    }
  };

  const handleSafeTransfer = async () => {
    if (!canTransfer) return;
    if (selectedStudentIds.length === 0) {
      onErrorToast('لطفاً حداقل یک دانش‌آموز را برای انتقال انتخاب کنید.');
      return;
    }
    if (!targetClassId || targetClassId === sourceClassId) {
      onErrorToast('کلاس مقصد باید متفاوت از کلاس مبدأ باشد.');
      return;
    }

    setTransferring(true);
    try {
      const res = await transferStudentsToClass(selectedStudentIds, targetClassId);
      if (!res.ok) {
        onErrorToast(res.errorFa ?? 'انتقال دانش‌آموزان ناموفق بود.');
        return;
      }
      const targetName = classes.find((c) => c.id === targetClassId)?.name ?? 'کلاس مقصد';
      setSelectedStudentIds([]);
      onSuccessToast(
        `${toPersianDigits(res.movedCount ?? selectedStudentIds.length)} دانش‌آموز با حفظ ۱۰۰٪ سوابق نمرات، حضور و پرونده الکترونیک به «${targetName}» منتقل شدند.`
      );
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="sida-exports-transfer-tab">
      {/* Section 1: Standard SIDA CSV Exports & A4/A5 Print */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 brand-text shrink-0" />
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                خروجی فایل‌های استاندارد سیدا (UTF-8 BOM) و چاپ رسمی A4 / A5
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                دانلود مستقیم فهرست دانش‌آموزان یا ریزنمرات کلاس‌ها برای بارگذاری و بایگانی در سیدا
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportStudentListCsv}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>خروجی CSV فهرست دانش‌آموزان (فرمت سیدا)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              پایه تحصیلی
            </label>
            <select
              aria-label="فیلتر پایه تحصیلی"
              value={gradeLevelFilter}
              onChange={(e) => {
                const val = e.target.value;
                setGradeLevelFilter(val === 'all' ? 'all' : Number(val));
                setClassIdFilter('all');
              }}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              <option value="all">همه پایه‌ها</option>
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>
                  پایه {toPersianDigits(g)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              کلاس
            </label>
            <select
              aria-label="فیلتر کلاس"
              value={classIdFilter}
              onChange={(e) => setClassIdFilter(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              <option value="all">همه کلاس‌های مجاز</option>
              {classes
                .filter((c) => gradeLevelFilter === 'all' || c.gradeLevel === gradeLevelFilter)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              نام درس
            </label>
            <select
              aria-label="انتخاب درس خروجی سیدا"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              نوبت ارزشیابی
            </label>
            <select
              aria-label="انتخاب نوبت ارزشیابی"
              value={exportTerm}
              onChange={(e) => setExportTerm(e.target.value as SidaExportTerm)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 tabular-nums">
              تعداد دانش‌آموزان: {toPersianDigits(exportRows.length)} نفر
            </span>
            {incompleteExportCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                {toPersianDigits(incompleteExportCount)} ردیف دارای نقص کد ملی یا نمره ثبت‌نشده است
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تمام ردیف‌ها کامل و آماده بارگذاری در سیدا هستند
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportSidaGradesCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>دانلود اکسل نمرات سیدا (CSV UTF-8 BOM)</span>
            </button>
            <PrintButtons documentLabel="لیست رسمی نمرات جهت بایگانی و ورود در سیدا" />
          </div>
        </div>
      </div>

      {/* Printable Official Grades Roster */}
      <PrintShell
        school={activeSchool}
        documentTitle={`لیست رسمی نمرات استاندارد سیدا — درس ${subjectFilter} (${exportTerm})`}
        subtitle={`تعداد: ${toPersianDigits(exportRows.length)} دانش‌آموز · تاریخ تهیه: ${toPersianDigits(getTodayJalali())}`}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden print:border-0 print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2.5 font-bold">ردیف</th>
                  <th className="px-3 py-2.5 font-bold">کد ملی</th>
                  <th className="px-3 py-2.5 font-bold">نام و نام خانوادگی</th>
                  <th className="px-3 py-2.5 font-bold">پایه / کلاس</th>
                  <th className="px-3 py-2.5 font-bold">نمره مستمر</th>
                  <th className="px-3 py-2.5 font-bold">نمره پایانی</th>
                  <th className="px-3 py-2.5 font-bold">وضعیت توصیفی</th>
                  <th className="px-3 py-2.5 font-bold">توضیحات / هشدار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {exportRows.map((row, idx) => (
                  <tr
                    key={row.studentId}
                    className={
                      row.warningsFa.length > 0
                        ? 'bg-amber-50/70 dark:bg-amber-950/25'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="px-3 py-2 font-bold tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="px-3 py-2 font-mono font-bold tabular-nums">
                      {toPersianDigits(row.nationalId || '—')}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                      {row.fullName}
                    </td>
                    <td className="px-3 py-2">
                      {row.gradeLabel} · {row.className}
                    </td>
                    <td className="px-3 py-2 font-bold tabular-nums">
                      {row.continuousScore !== undefined ? toPersianDigits(row.continuousScore) : '—'}
                    </td>
                    <td className="px-3 py-2 font-extrabold tabular-nums">
                      {row.finalScore !== undefined ? toPersianDigits(row.finalScore) : '—'}
                    </td>
                    <td className="px-3 py-2 font-bold">{row.descriptiveLevel ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.warningsFa.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold ml-1.5">
                          {row.warningsFa.join('، ')}
                        </span>
                      )}
                      <span className="text-slate-600 dark:text-slate-300">{row.notes}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PrintShell>

      {/* Section 2: Safe Class Transfer / Year-End Promotion Utility */}
      {canTransfer && classes.length >= 2 && (
        <section
          data-testid="sida-safe-transfer-section"
          className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ArrowLeftRight className="w-5 h-5 brand-text shrink-0" />
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  ابزار انتقال ایمن کلاس و ارتقای پایان سال (بدون حذف سوابق)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  دانش‌آموزان انتخاب‌شده به کلاس یا پایه مقصد منتقل می‌شوند و ۱۰۰٪ سوابق نمرات، حضور و غیاب و پرونده الکترونیک محفوظ می‌ماند.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>تضمین حفظ ۱۰۰٪ تاریخچه تحصیلی</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                کلاس مبدأ
              </label>
              <select
                aria-label="کلاس مبدأ برای انتقال"
                value={sourceClassId}
                onChange={(e) => {
                  setSourceClassId(e.target.value);
                  setSelectedStudentIds([]);
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                کلاس / پایه مقصد
              </label>
              <select
                aria-label="کلاس مقصد برای انتقال"
                data-testid="sida-transfer-target-select"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    sourceStudents.length > 0 && selectedStudentIds.length === sourceStudents.length
                  }
                  onChange={toggleSelectAllSource}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <span>
                  انتخاب همه دانش‌آموزان کلاس مبدأ ({toPersianDigits(sourceStudents.length)} نفر)
                </span>
              </label>
              <span className="font-bold brand-text tabular-nums">
                انتخاب‌شده: {toPersianDigits(selectedStudentIds.length)} نفر
              </span>
            </div>

            {sourceStudents.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-center text-xs text-slate-500">
                دانش‌آموز فعالی در کلاس مبدأ وجود ندارد.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto pl-1">
                {sourceStudents.map((st) => {
                  const checked = selectedStudentIds.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className={`rounded-xl border p-2.5 flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                        checked
                          ? 'border-[var(--brand-primary)] bg-slate-50 dark:bg-slate-800'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudentSelection(st.id)}
                        className="w-4 h-4 accent-indigo-600 rounded shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {st.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {toPersianDigits(st.nationalId)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              data-testid="sida-transfer-submit-btn"
              disabled={transferring || selectedStudentIds.length === 0 || sourceClassId === targetClassId}
              onClick={() => void handleSafeTransfer()}
              className="min-h-[44px] px-5 rounded-xl brand-btn text-xs sm:text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>
                انتقال ایمن {toPersianDigits(selectedStudentIds.length)} دانش‌آموز به کلاس مقصد
              </span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
