// Step 3-C — Step 4: Iranian Validation Review, Live Inline Quick-Fix Table & Quarantine CSV Export
import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Link2,
  Search,
} from 'lucide-react';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { buildQuarantineCsv } from '../../services/smartImport/importPipeline';
import type {
  DuplicateHandlingStrategy,
  ImportRowBucket,
  SmartImportFieldKey,
  SmartImportTargetType,
  ValidatedImportRow,
} from '../../services/smartImport/types';

interface Step4ReviewAndQuarantineProps {
  targetType: SmartImportTargetType;
  schoolId: string;
  validatedRows: ValidatedImportRow[];
  duplicateStrategy: DuplicateHandlingStrategy;
  onChangeDuplicateStrategy: (next: DuplicateHandlingStrategy) => void;
  onEditRowField: (rowId: string, fieldKey: SmartImportFieldKey, nextValue: string) => void;
}

function getDisplayColumnsForTarget(
  targetType: SmartImportTargetType
): Array<{ key: SmartImportFieldKey; labelFa: string; dirLtr?: boolean }> {
  if (targetType === 'students') {
    return [
      { key: 'nationalId', labelFa: 'کد ملی', dirLtr: true },
      { key: 'fullName', labelFa: 'نام و نام خانوادگی' },
      { key: 'parentName', labelFa: 'نام ولی' },
      { key: 'parentMobile', labelFa: 'موبایل ولی', dirLtr: true },
      { key: 'className', labelFa: 'کلاس' },
      { key: 'birthDateJalali', labelFa: 'تاریخ تولد', dirLtr: true },
    ];
  }
  if (targetType === 'teachers') {
    return [
      { key: 'nationalId', labelFa: 'کد ملی', dirLtr: true },
      { key: 'fullName', labelFa: 'نام همکار' },
      { key: 'mobile', labelFa: 'موبایل', dirLtr: true },
      { key: 'specialty', labelFa: 'تخصص / درس' },
      { key: 'personnelCode', labelFa: 'کد پرسنلی', dirLtr: true },
      { key: 'weeklyQuotaPeriods', labelFa: 'موظفی', dirLtr: true },
    ];
  }
  if (targetType === 'classes') {
    return [
      { key: 'className', labelFa: 'عنوان کلاس' },
      { key: 'gradeLabel', labelFa: 'پایه' },
      { key: 'section', labelFa: 'شعبه' },
      { key: 'roomCode', labelFa: 'کد اتاق', dirLtr: true },
      { key: 'capacity', labelFa: 'ظرفیت', dirLtr: true },
    ];
  }
  return [
    { key: 'nationalId', labelFa: 'کد ملی', dirLtr: true },
    { key: 'fullName', labelFa: 'نام دانش‌آموز' },
    { key: 'className', labelFa: 'کلاس' },
    { key: 'subject', labelFa: 'درس' },
    { key: 'continuousScore', labelFa: 'مستمر', dirLtr: true },
    { key: 'finalScore', labelFa: 'پایانی', dirLtr: true },
  ];
}

export const Step4ReviewAndQuarantine: React.FC<Step4ReviewAndQuarantineProps> = ({
  targetType,
  schoolId,
  validatedRows,
  duplicateStrategy,
  onChangeDuplicateStrategy,
  onEditRowField,
}) => {
  const [activeTab, setActiveTab] = useState<ImportRowBucket>('valid');
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineEditingQuarantineIds, setInlineEditingQuarantineIds] = useState<Record<string, boolean>>({});

  const displayCols = useMemo(() => getDisplayColumnsForTarget(targetType), [targetType]);

  const validRows = useMemo(
    () => validatedRows.filter((r) => r.bucket === 'valid'),
    [validatedRows]
  );
  const needsFixRows = useMemo(
    () => validatedRows.filter((r) => r.bucket === 'needs_fix'),
    [validatedRows]
  );
  const quarantineRows = useMemo(
    () => validatedRows.filter((r) => r.bucket === 'quarantine'),
    [validatedRows]
  );

  const createCount = validRows.filter((r) => r.operation === 'create').length;
  const updateCount = validRows.filter((r) => r.operation === 'update').length;
  const skipCount = validRows.filter((r) => r.operation === 'skip').length;

  const activeRows = useMemo(() => {
    const base =
      activeTab === 'valid'
        ? validRows
        : activeTab === 'needs_fix'
          ? needsFixRows
          : quarantineRows;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((row) => {
      const hay = [
        ...Object.values(row.normalizedValues),
        ...Object.values(row.rawValues),
        ...row.errors,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeTab, validRows, needsFixRows, quarantineRows, searchQuery]);

  const handleDownloadQuarantineCsv = () => {
    const rowsToExport = [...quarantineRows, ...needsFixRows];
    if (rowsToExport.length === 0) return;
    const csv = buildQuarantineCsv(rowsToExport, targetType);
    const today = getTodayJalali().replace(/\//g, '-');
    downloadTextFile(
      `quarantine-errors-${schoolId}-${today}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Duplicate Strategy + Live Search */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
            سیاست برخورد با رکوردهای تکراری موجود در مدرسه:
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(
              [
                { id: 'smart_merge', label: 'به‌روزرسانی هوشمند' },
                { id: 'fill_empty_only', label: 'فقط تکمیل فیلدهای خالی' },
                { id: 'skip_duplicates', label: 'نادیده گرفتن تکراری‌ها' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeDuplicateStrategy(opt.id)}
                className={`min-h-[34px] rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                  duplicateStrategy === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام، کد ملی یا خطا..."
            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Non-blocking guarantee banner */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/60 dark:bg-emerald-950/30 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
        <span>
          ردیف‌های خطادار و قرنطینه هرگز مانع ثبت ردیف‌های سالم نمی‌شوند. هر ردیفی را که در تب «نیازمند اصلاح سریع» ویرایش کنید، با اعتبارسنجی زنده بلافاصله به تب سالم منتقل می‌شود.
        </span>
        {(quarantineRows.length > 0 || needsFixRows.length > 0) && (
          <button
            type="button"
            data-testid="download-quarantine-csv-btn"
            onClick={handleDownloadQuarantineCsv}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-3 text-xs font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            دانلود فایل CSV ردیف‌های قرنطینه ({toPersianDigits(quarantineRows.length + needsFixRows.length)})
          </button>
        )}
      </div>

      {/* 3 Transparent Status Tabs with Persian Counters */}
      <div
        role="tablist"
        aria-label="دسته‌بندی اعتبارسنجی ردیف‌ها"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      >
        <button
          type="button"
          role="tab"
          data-testid="review-tab-valid"
          aria-selected={activeTab === 'valid'}
          onClick={() => setActiveTab('valid')}
          className={`text-right rounded-xl border p-3.5 transition-colors ${
            activeTab === 'valid'
              ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              سالم و آماده ثبت
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
              {toPersianDigits(validRows.length)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            جدید: {toPersianDigits(createCount)} · به‌روزرسانی: {toPersianDigits(updateCount)}
            {skipCount > 0 ? ` · صرف‌نظر: ${toPersianDigits(skipCount)}` : ''}
          </div>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="review-tab-needs-fix"
          aria-selected={activeTab === 'needs_fix'}
          onClick={() => setActiveTab('needs_fix')}
          className={`text-right rounded-xl border p-3.5 transition-colors ${
            activeTab === 'needs_fix'
              ? 'border-amber-600 bg-amber-50/70 dark:border-amber-500 dark:bg-amber-950/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              نیازمند اصلاح سریع
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
              {toPersianDigits(needsFixRows.length)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            قابل ویرایش مستقیم در جدول با انتقال زنده به تب سالم
          </div>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="review-tab-quarantine"
          aria-selected={activeTab === 'quarantine'}
          onClick={() => setActiveTab('quarantine')}
          className={`text-right rounded-xl border p-3.5 transition-colors ${
            activeTab === 'quarantine'
              ? 'border-rose-600 bg-rose-50/70 dark:border-rose-500 dark:bg-rose-950/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 dark:text-rose-400">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              قرنطینه خطادار
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
              {toPersianDigits(quarantineRows.length)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            ردیف‌های دارای خطای ساختاری، کد ملی غلط یا تکراری در فایل
          </div>
        </button>
      </div>

      {/* Rows Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {activeRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'valid'
              ? 'هیچ ردیف سالمی با فیلتر فعلی یافت نشد.'
              : activeTab === 'needs_fix'
                ? 'تمامی ردیف‌های نیازمند اصلاح سریع بررسی یا برطرف شده‌اند.'
                : 'هیچ ردیف خطاداری در قرنطینه وجود ندارد.'}
          </div>
        ) : (
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2.5 font-bold whitespace-nowrap">ردیف</th>
                <th className="px-3 py-2.5 font-bold whitespace-nowrap">وضعیت</th>
                {displayCols.map((col) => (
                  <th key={col.key} className="px-3 py-2.5 font-bold whitespace-nowrap">
                    {col.labelFa}
                  </th>
                ))}
                <th className="px-3 py-2.5 font-bold whitespace-nowrap">
                  {activeTab === 'valid' ? 'یادداشت‌های نرمال‌سازی' : 'علت خطا / اقدام'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeRows.map((row) => {
                const isInlineEditable =
                  activeTab === 'needs_fix' ||
                  (activeTab === 'quarantine' && Boolean(inlineEditingQuarantineIds[row.rowId]));

                return (
                  <tr
                    key={row.rowId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 align-top"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                      {toPersianDigits(row.sourceRowNumber)}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {activeTab === 'valid' ? (
                        <div className="space-y-0.5">
                          <div
                            className={`font-bold ${
                              row.operation === 'create'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : row.operation === 'update'
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {row.operation === 'create'
                              ? 'ثبت جدید'
                              : row.operation === 'update'
                                ? 'به‌روزرسانی'
                                : 'صرف‌نظر (تکراری)'}
                          </div>
                          {row.joinedFromSecondary && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                              <Link2 className="w-3 h-3" />
                              پیوندخورده
                            </div>
                          )}
                        </div>
                      ) : activeTab === 'needs_fix' ? (
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          اصلاح سریع
                        </span>
                      ) : (
                        <span className="font-bold text-rose-700 dark:text-rose-400">
                          قرنطینه
                        </span>
                      )}
                    </td>

                    {displayCols.map((col) => {
                      const val =
                        row.normalizedValues[col.key] ?? row.rawValues[col.key] ?? '';
                      const isFieldProblematic = row.fixableFields.includes(col.key);

                      if (isInlineEditable) {
                        return (
                          <td key={col.key} className="px-2.5 py-2 min-w-[130px]">
                            <input
                              type="text"
                              dir={col.dirLtr ? 'ltr' : 'rtl'}
                              value={val}
                              onChange={(e) =>
                                onEditRowField(row.rowId, col.key, e.target.value)
                              }
                              aria-label={`${col.labelFa} ردیف ${row.sourceRowNumber}`}
                              className={`w-full min-h-[34px] rounded-lg border px-2 text-xs font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                isFieldProblematic
                                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-slate-900 dark:text-white'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100'
                              }`}
                            />
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.key}
                          className="px-3 py-2.5 max-w-[180px] truncate tabular-nums text-slate-800 dark:text-slate-200"
                          title={val}
                        >
                          {val ? toPersianDigits(val) : '—'}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2.5 min-w-[220px]">
                      {activeTab === 'valid' ? (
                        <div className="space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {row.warnings.length > 0 ? (
                            row.warnings.map((w, idx) => <div key={idx}>• {w}</div>)
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              کاملاً معتبر
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="space-y-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                            {row.errors.map((err, idx) => (
                              <div key={idx}>• {err}</div>
                            ))}
                          </div>
                          {activeTab === 'quarantine' && (
                            <button
                              type="button"
                              onClick={() =>
                                setInlineEditingQuarantineIds((prev) => ({
                                  ...prev,
                                  [row.rowId]: !prev[row.rowId],
                                }))
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-400 hover:underline"
                            >
                              <Edit3 className="w-3 h-3" />
                              {inlineEditingQuarantineIds[row.rowId]
                                ? 'بستن ویرایش زنده'
                                : 'ویرایش زنده در جدول'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
