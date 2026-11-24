// Tab 2: Smart Bulk Import from Excel Paste / CSV with Interactive Column Mapper («ورود گروهی هوشمند»)
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Columns,
  Copy,
  Download,
  RotateCcw,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { copyTextToClipboard } from '../../lib/messenger';
import type { Student } from '../../types/domain';
import {
  autoDetectSidaColumnMapping,
  buildSidaSampleCsv,
  buildStudentAndProfileFromSidaRow,
  parseSidaCsvRaw,
  SIDA_COLUMN_META,
  validateSidaImportRows,
  type SidaColumnKey,
  type SidaColumnMapping,
} from './sidaBridgeHelpers';

interface SidaBulkImportTabProps {
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const SidaBulkImportTab: React.FC<SidaBulkImportTabProps> = ({
  onSuccessToast,
  onErrorToast,
}) => {
  const { activeSchool, session, classes, students, importSidaStudentsBatch } = useSchoolData();

  const [rawInput, setRawInput] = useState('');
  const [columnMapping, setColumnMapping] = useState<SidaColumnMapping | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update'>('skip');
  const [importing, setImporting] = useState(false);
  const [importedStudents, setImportedStudents] = useState<
    Array<{
      student: Student;
      initialStudentPassword?: string;
      initialParentPassword?: string;
    }>
  >([]);

  const parsedRaw = useMemo(() => parseSidaCsvRaw(rawInput), [rawInput]);

  // Auto-detect column mapping whenever raw headers signature changes
  const headersSignature = parsedRaw.headers.join('|');
  useEffect(() => {
    if (parsedRaw.headers.length === 0) {
      setColumnMapping(null);
      return;
    }
    setColumnMapping(autoDetectSidaColumnMapping(parsedRaw.headers));
  }, [headersSignature]);

  const effectiveMapping = useMemo(
    () => columnMapping ?? autoDetectSidaColumnMapping(parsedRaw.headers),
    [columnMapping, parsedRaw.headers]
  );

  const previewRows = useMemo(() => {
    if (!rawInput.trim()) return [];
    return validateSidaImportRows({
      rawText: rawInput,
      existingStudents: students,
      classes,
      columnMapping: effectiveMapping,
    });
  }, [rawInput, students, classes, effectiveMapping]);

  const importStats = useMemo(() => {
    const valid = previewRows.filter((r) => r.status === 'valid').length;
    const duplicate = previewRows.filter((r) => r.status === 'duplicate').length;
    const invalid = previewRows.filter((r) => r.status === 'invalid').length;
    return { valid, duplicate, invalid, total: previewRows.length };
  }, [previewRows]);

  const readyToCommitRows = useMemo(
    () =>
      previewRows.filter(
        (r) => r.status === 'valid' || (r.status === 'duplicate' && duplicatePolicy === 'update')
      ),
    [previewRows, duplicatePolicy]
  );

  const delimiterLabel =
    parsedRaw.delimiter === '\t'
      ? 'جدول اکسل (جداکننده Tab)'
      : parsedRaw.delimiter === ';'
        ? 'CSV با جداکننده نقطه‌ویرگول (;)'
        : 'CSV استاندارد با جداکننده ویرگول (,)';

  const handleDownloadSampleCsv = () => {
    const csv = buildSidaSampleCsv();
    downloadTextFile('sida-students-sample.csv', csv, 'text/csv;charset=utf-8');
    onSuccessToast('فایل نمونه استاندارد سیدا (UTF-8 BOM) دانلود شد.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setRawInput(text);
      setImportedStudents([]);
      onSuccessToast(`فایل «${file.name}» بارگذاری شد؛ ستون‌ها به‌صورت خودکار تطبیق داده شدند.`);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleMappingChange = (key: SidaColumnKey, colIndex: number) => {
    setColumnMapping({
      ...effectiveMapping,
      [key]: colIndex,
    });
  };

  const handleCommitImport = async () => {
    if (readyToCommitRows.length === 0) return;
    setImporting(true);
    try {
      const existingById = new Map(students.map((s) => [s.id, s]));
      const items = readyToCommitRows.map((row, idx) =>
        buildStudentAndProfileFromSidaRow({
          row,
          schoolId: activeSchool.id,
          existingStudent: row.existingStudentId ? existingById.get(row.existingStudentId) : undefined,
          sequenceNumber: idx + 1,
          actorName: session?.displayName ?? activeSchool.principalName,
        })
      );
      const res = await importSidaStudentsBatch(items);
      if (!res.ok) {
        onErrorToast(res.errorFa ?? 'ثبت گروهی دانش‌آموزان ناموفق بود.');
        return;
      }
      setImportedStudents(
        items.map((i) => ({
          student: i.student,
          initialStudentPassword: i.initialStudentPassword,
          initialParentPassword: i.initialParentPassword,
        }))
      );
      setRawInput('');
      onSuccessToast(
        `${toPersianDigits(items.length)} دانش‌آموز با موفقیت ثبت و حساب کاربری مجزای دانش‌آموز و ولی + پرونده الکترونیک آن‌ها ایجاد شد.`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleCopyImportedCredentials = async () => {
    if (importedStudents.length === 0) return;
    const lines = [
      `🔐 اطلاعات ورود دانش‌آموزان جدید (نمایش یک‌باره — ثبت از پل سیدا)`,
      `🏫 ${activeSchool.name}`,
      `────────────────────`,
    ];
    for (const item of importedStudents) {
      const st = item.student;
      lines.push(
        `👤 ${st.fullName} (کد ملی: ${toPersianDigits(st.nationalId)})`,
        `   🎓 حساب دانش‌آموز: نام کاربری ${st.studentUsername ?? '-'} | رمز اولیه: ${item.initialStudentPassword ?? 'بدون تغییر (محرمانه)'}`,
        `   👨‍👩‍👧 حساب ولی: نام کاربری ${st.parentUsername ?? '-'} | رمز اولیه: ${item.initialParentPassword ?? 'بدون تغییر (محرمانه)'}`
      );
    }
    await copyTextToClipboard(lines.join('\n'));
    onSuccessToast('اطلاعات ورود مجزای دانش‌آموزان و اولیا کپی شد.');
  };

  return (
    <div className="no-print space-y-4" data-testid="sida-bulk-import-tab">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              ورود گروهی هوشمند از اکسل / CSV یا کپی مستقیم جدول
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              پشتیبانی از بارگذاری CSV و پیست مستقیم از اکسل (جداکننده Tab، ویرگول و نقطه‌ویرگول) با تطبیق خودکار و دستی ستون‌ها
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>دانلود نمونه CSV سیدا</span>
            </button>
            <label className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold brand-btn cursor-pointer whitespace-nowrap">
              <Upload className="w-4 h-4 shrink-0" />
              <span>بارگذاری فایل CSV</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Direct Excel Paste Textarea */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="sida-csv-textarea"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              کپی و پیست مستقیم جدول از اکسل یا متن CSV:
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="sida-insert-excel-sample"
                onClick={() => {
                  // Tab-separated Excel paste sample with shuffled column order to test Column Mapper
                  const existingNid = students[0]?.nationalId ?? '0012345678';
                  const sampleTsv = [
                    'نام\tنام خانوادگی\tکد ملی\tنام پدر\tکلاس\tپایه\tتلفن ولی',
                    'آرمان\tپاکدل\t0024819204\tمهدی\tپایه دوم - کلاس الف\tدوم\t09123456781',
                    `تکراری\tموجود\t${existingNid}\tعلی\tپایه دوم - کلاس الف\tدوم\t09123456789`,
                    'کاربر\tنامعتبر\t1111111111\tحسن\tپایه سوم - کلاس الف\tسوم\t09120000001',
                  ].join('\n');
                  setRawInput(sampleTsv);
                  setImportedStudents([]);
                }}
                className="text-xs font-bold brand-text hover:underline"
              >
                درج نمونه پیست مستقیم اکسل (با ترتیب ستون متفاوت)
              </button>
            </div>
          </div>
          <textarea
            id="sida-csv-textarea"
            data-testid="sida-csv-textarea"
            rows={5}
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setImportedStudents([]);
            }}
            placeholder="ردیف‌های جدول را از اکسل کپی کرده و اینجا پیست کنید (پشتیبانی کامل از Tab، ویرگول و نقطه‌ویرگول)..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100"
            dir="rtl"
          />
        </div>

        {/* Interactive Column Mapper */}
        {parsedRaw.headers.length > 0 && (
          <div
            data-testid="sida-column-mapper"
            className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Columns className="w-4 h-4 brand-text shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  تطبیق خودکار و دستی ستون‌ها ({toPersianDigits(parsedRaw.headers.length)} ستون شناسایی شد)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  قالب تشخیص‌داده‌شده: {delimiterLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setColumnMapping(autoDetectSidaColumnMapping(parsedRaw.headers))}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>تطبیق خودکار</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SIDA_COLUMN_META.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`col-map-${field.key}`}
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    {field.labelFa}
                    {field.required && <span className="text-rose-500 mr-0.5">*</span>}
                  </label>
                  <select
                    id={`col-map-${field.key}`}
                    value={effectiveMapping[field.key]}
                    onChange={(e) => handleMappingChange(field.key, Number(e.target.value))}
                    className="w-full min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 text-xs font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value={-1}>— بدون نگاشت —</option>
                    {parsedRaw.headers.map((headerText, idx) => (
                      <option key={`${idx}-${headerText}`} value={idx}>
                        ستون {toPersianDigits(idx + 1)}: {headerText}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pre-Import Validation Preview */}
        {previewRows.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  معتبر و آماده ثبت: {toPersianDigits(importStats.valid)}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  تکراری در مدرسه: {toPersianDigits(importStats.duplicate)}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <XCircle className="w-3.5 h-3.5" />
                  نامعتبر / ناقص: {toPersianDigits(importStats.invalid)}
                </span>
              </div>

              {importStats.duplicate > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>رفتار با ردیف‌های تکراری:</span>
                  <select
                    aria-label="رفتار با ردیف‌های تکراری"
                    value={duplicatePolicy}
                    onChange={(e) => setDuplicatePolicy(e.target.value as 'skip' | 'update')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="skip">رد کردن تکراری‌ها</option>
                    <option value="update">به‌روزرسانی اطلاعات تکراری‌ها</option>
                  </select>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2.5 font-bold">ردیف</th>
                    <th className="px-3 py-2.5 font-bold">وضعیت کنترل سیدا</th>
                    <th className="px-3 py-2.5 font-bold">کد ملی</th>
                    <th className="px-3 py-2.5 font-bold">نام و نام خانوادگی</th>
                    <th className="px-3 py-2.5 font-bold">نام پدر</th>
                    <th className="px-3 py-2.5 font-bold">کلاس متناظر</th>
                    <th className="px-3 py-2.5 font-bold">تلفن ولی</th>
                    <th className="px-3 py-2.5 font-bold">توضیح اعتبارسنجی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={
                        row.status === 'valid'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          : row.status === 'duplicate'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20'
                            : 'bg-rose-50/50 dark:bg-rose-950/20'
                      }
                    >
                      <td className="px-3 py-2 font-bold tabular-nums">
                        {toPersianDigits(row.rowIndex)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.status === 'valid' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                            معتبر و آماده ثبت
                          </span>
                        )}
                        {row.status === 'duplicate' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                            تکراری در مدرسه
                          </span>
                        )}
                        {row.status === 'invalid' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                            نامعتبر / ناقص
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold tabular-nums">
                        {toPersianDigits(row.nationalId || '—')}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                        {row.fullName || '—'}
                      </td>
                      <td className="px-3 py-2">{row.fatherName || '—'}</td>
                      <td className="px-3 py-2">{row.matchedClassName}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {toPersianDigits(row.parentMobile || '—')}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {row.reasonsFa.length > 0
                          ? row.reasonsFa.join(' · ')
                          : 'کد ملی معتبر (کنترل رقم ۱۱ تایید شد)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                data-testid="sida-bulk-commit-btn"
                disabled={importing || readyToCommitRows.length === 0}
                onClick={() => void handleCommitImport()}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>
                  ثبت نهایی ردیف‌های معتبر ({toPersianDigits(readyToCommitRows.length)} دانش‌آموز)
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Newly Imported Credentials Summary */}
      {importedStudents.length > 0 && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200">
              حساب‌های کاربری مجزای دانش‌آموز و ولی + پرونده الکترونیک ایجاد شد ({toPersianDigits(importedStudents.length)} نفر)
            </div>
            <button
              type="button"
              onClick={() => void handleCopyImportedCredentials()}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>کپی تک‌ستونی اطلاعات ورود (ایتا/بله/شاد)</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {importedStudents.map((item) => {
              const st = item.student;
              return (
                <div
                  key={st.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 p-3 text-xs space-y-1"
                >
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {st.fullName} — کد ملی: {toPersianDigits(st.nationalId)}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    حساب دانش‌آموز: <span className="font-mono font-bold">{st.studentUsername}</span> / رمز اولیه:{' '}
                    <span className="font-mono font-bold">
                      {item.initialStudentPassword ?? 'محرمانه (بدون تغییر)'}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    حساب ولی: <span className="font-mono font-bold">{st.parentUsername}</span> / رمز اولیه:{' '}
                    <span className="font-mono font-bold">
                      {item.initialParentPassword ?? 'محرمانه (بدون تغییر)'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
