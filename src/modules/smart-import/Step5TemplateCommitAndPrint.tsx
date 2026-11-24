// Step 3-C — Step 5: Save Mapping Template, Dry-Run Preview, Final Commit & Official A4 Print Report
import React, { useState } from 'react';
import {
  AlertOctagon,
  BookmarkPlus,
  CheckCircle2,
  Database,
  Download,
  Globe,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { SMART_IMPORT_TARGET_LABELS_FA } from '../../services/smartImport/columnMatcher';
import { buildQuarantineCsv } from '../../services/smartImport/importPipeline';
import type {
  SmartImportCommitReceipt,
  SmartImportDryRunSummary,
  SmartImportTargetType,
  ValidatedImportRow,
} from '../../services/smartImport/types';

interface Step5TemplateCommitAndPrintProps {
  targetType: SmartImportTargetType;
  targetSchoolId: string;
  targetSchoolName: string;
  academicYearLabel: string;
  sourceFileName: string;
  secondaryFileName?: string;
  isSuperAdmin: boolean;
  isPanicLocked: boolean;
  dryRun: SmartImportDryRunSummary;
  quarantinedRows: ValidatedImportRow[];
  committing: boolean;
  commitReceipt: SmartImportCommitReceipt | null;
  onSaveTemplate: (nameFa: string, isComplexWide: boolean) => Promise<void>;
  onCommitImport: () => Promise<void>;
  onStartFreshWizard: () => void;
}

export const Step5TemplateCommitAndPrint: React.FC<Step5TemplateCommitAndPrintProps> = ({
  targetType,
  targetSchoolId,
  targetSchoolName,
  academicYearLabel,
  sourceFileName,
  secondaryFileName,
  isSuperAdmin,
  isPanicLocked,
  dryRun,
  quarantinedRows,
  committing,
  commitReceipt,
  onSaveTemplate,
  onCommitImport,
  onStartFreshWizard,
}) => {
  const [templateName, setTemplateName] = useState(
    `الگوی ${SMART_IMPORT_TARGET_LABELS_FA[targetType]} – ${targetSchoolName}`
  );
  const [isComplexWide, setIsComplexWide] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState<string | null>(null);

  const handleSaveTpl = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setTemplateSavedMsg(null);
    await onSaveTemplate(templateName.trim(), isSuperAdmin ? isComplexWide : false);
    setSavingTemplate(false);
    setTemplateSavedMsg('الگوی نگاشت با موفقیت ذخیره شد و در مراجعات بعدی در مرحله ۲ قابل انتخاب است.');
  };

  const handleDownloadQuarantineCsv = () => {
    if (quarantinedRows.length === 0) return;
    const csv = buildQuarantineCsv(quarantinedRows, targetType);
    const today = getTodayJalali().replace(/\//g, '-');
    downloadTextFile(
      `quarantine-report-${targetSchoolId}-${today}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Save Mapping Template Card */}
      <section className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <BookmarkPlus className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              ۱. ذخیره این چیدمان به‌عنوان الگوی نگاشت (Mapping Template)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              با ذخیره این چیدمان، در فایل‌های بعدی سیدا یا اکسل، نگاشت ستون‌ها و سیاست خانه‌های خالی با یک کلیک اعمال می‌شود.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="نام الگو (مثلاً: خروجی سیدا – مدرسه ۱)"
            className="flex-1 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            disabled={savingTemplate || !templateName.trim() || isPanicLocked}
            onClick={() => void handleSaveTpl()}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 px-4 text-xs font-bold disabled:opacity-50 whitespace-nowrap transition-opacity"
          >
            <BookmarkPlus className="w-4 h-4" />
            {savingTemplate ? 'در حال ذخیره...' : 'ذخیره این چیدمان به‌عنوان الگو'}
          </button>
        </div>

        {isSuperAdmin && (
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none">
            <input
              type="checkbox"
              checked={isComplexWide}
              onChange={(e) => setIsComplexWide(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>قابل استفاده برای تمام مدارس مجموعه (اشتراک‌گذاری سراسری راهبر ارشد)</span>
          </label>
        )}

        {templateSavedMsg && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200"
          >
            {templateSavedMsg}
          </div>
        )}
      </section>

      {/* 2. Dry-Run Preview OR Official Committed Report (Printable via PrintPreviewPortal) */}
      <section
        id="smart-import-official-report"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {commitReceipt
                ? 'گزارش رسمی عملیات ورود هوشمند و لیست قرنطینه'
                : 'پیش‌نمایش نهایی پیش از ثبت (Dry-Run Summary)'}
            </div>
            <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
              {SMART_IMPORT_TARGET_LABELS_FA[targetType]} — {targetSchoolName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>سال تحصیلی: {toPersianDigits(academicYearLabel)}</span>
              <span aria-hidden="true">·</span>
              <span>فایل اصلی: {sourceFileName}</span>
              {secondaryFileName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>فایل پیوند: {secondaryFileName}</span>
                </>
              )}
              {commitReceipt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    زمان ثبت: {toPersianDigits(commitReceipt.executedAtJalali)} ساعت{' '}
                    {toPersianDigits(commitReceipt.executedAtTimeHm)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            {quarantinedRows.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadQuarantineCsv}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                دانلود CSV قرنطینه
              </button>
            )}
            <PrintIconButton
              documentLabel={`گزارش رسمی ورود هوشمند (${SMART_IMPORT_TARGET_LABELS_FA[targetType]}) — ${targetSchoolName}`}
              targetSelector="#smart-import-official-report"
            />
          </div>
        </div>

        {/* Numeric Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              ثبت جدید
            </div>
            <div className="mt-1 text-xl font-extrabold text-emerald-900 dark:text-emerald-100">
              {toPersianDigits(commitReceipt ? commitReceipt.createdCount : dryRun.createCount)}
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30 p-3">
            <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
              به‌روزرسانی
            </div>
            <div className="mt-1 text-xl font-extrabold text-sky-900 dark:text-sky-100">
              {toPersianDigits(commitReceipt ? commitReceipt.updatedCount : dryRun.updateCount)}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 p-3">
            <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              پیوندخورده (۲ جدول)
            </div>
            <div className="mt-1 text-xl font-extrabold text-indigo-900 dark:text-indigo-100">
              {toPersianDigits(commitReceipt ? commitReceipt.joinedCount : dryRun.joinedCount)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              کلاس جدید ساخته‌شده
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
              {toPersianDigits(
                commitReceipt
                  ? commitReceipt.newClassesCreatedCount
                  : dryRun.newClassesToCreate.length
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              حساب کاربری اولیه
            </div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
              {toPersianDigits(
                commitReceipt
                  ? commitReceipt.newAccountsCreatedCount
                  : dryRun.newAccountsToCreateCount
              )}
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 p-3">
            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              قرنطینه (ثبت‌نشده)
            </div>
            <div className="mt-1 text-xl font-extrabold text-rose-900 dark:text-rose-100">
              {toPersianDigits(
                commitReceipt
                  ? commitReceipt.quarantinedCount
                  : dryRun.quarantineCount + dryRun.needsFixCount
              )}
            </div>
          </div>
        </div>

        {/* Auto-created classes preview */}
        {!commitReceipt && dryRun.newClassesToCreate.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 text-xs text-slate-700 dark:text-slate-300">
            <strong>کلاس‌های جدیدی که به‌صورت خودکار ایجاد می‌شوند:</strong>{' '}
            {dryRun.newClassesToCreate.join('، ')}
          </div>
        )}

        {/* Post-Commit Success & SHA-256 Chain Seal Banner */}
        {commitReceipt ? (
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>عملیات ورود هوشمند با موفقیت در پایگاه داده ثبت و مهروموم شد.</span>
            </div>
            <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-6 tabular-nums">
              مجری: <strong>{commitReceipt.actorName}</strong> ({commitReceipt.actorRoleFa}) · شناسه
              دسته: <span dir="ltr" className="font-mono">{commitReceipt.batchId.slice(0, 12)}</span>
              {commitReceipt.auditLogEntryHash && (
                <>
                  {' '}
                  · امضای زنجیره ممیزی SHA-256:{' '}
                  <span dir="ltr" className="font-mono font-bold">
                    {commitReceipt.auditLogEntryHash.slice(0, 16)}…
                  </span>
                </>
              )}
            </div>
            {commitReceipt.newAccountsCreatedCount > 0 && (
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  برای {toPersianDigits(commitReceipt.newAccountsCreatedCount)} عضو جدید، رمز عبور امن
                  هش‌شده همراه با الزام تغییر رمز در اولین ورود ایجاد شد.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-5">
              {isPanicLocked ? (
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  این مدرسه در وضعیت قفل اضطراری (فقط‌خواندنی) قرار دارد و امکان ثبت وجود ندارد.
                </span>
              ) : dryRun.validCount === 0 ? (
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  هیچ ردیف سالمی برای ثبت وجود ندارد؛ لطفاً به مرحله ۴ بازگشته و ردیف‌ها را اصلاح کنید.
                </span>
              ) : (
                <span>
                  با تأیید نهایی، صرفاً <strong>{toPersianDigits(dryRun.createCount + dryRun.updateCount)}</strong> ردیف سالم و معتبر در پایگاه داده ذخیره شده و یک گزارش خلاصه در زنجیره امنیتی SHA-256 ثبت می‌شود.
                </span>
              )}
            </div>

            <button
              type="button"
              data-testid="confirm-smart-import-commit-btn"
              disabled={
                committing ||
                isPanicLocked ||
                dryRun.createCount + dryRun.updateCount === 0
              }
              onClick={() => void onCommitImport()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-xs sm:text-sm font-extrabold disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Database className="w-4 h-4" />
              {committing ? 'در حال ثبت و مهروموم SHA-256...' : 'تأیید نهایی و ثبت در سامانه'}
            </button>
          </div>
        )}

        {/* Official Quarantine Table (Included in A4 Print Report) */}
        {quarantinedRows.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-rose-800 dark:text-rose-300">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>
                فهرست ردیف‌های قرنطینه و ثبت‌نشده ({toPersianDigits(quarantinedRows.length)} ردیف)
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">ردیف فایل</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">شناسه / کد ملی</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">نام / عنوان</th>
                    <th className="px-3 py-2 font-bold">دلایل خطا و قرنطینه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quarantinedRows.map((row) => (
                    <tr key={row.rowId}>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums font-bold">
                        {toPersianDigits(row.sourceRowNumber)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {toPersianDigits(
                          row.rawValues.nationalId ||
                            row.normalizedValues.nationalId ||
                            row.rawValues.className ||
                            '—'
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">
                        {row.rawValues.fullName ||
                          row.normalizedValues.fullName ||
                          row.rawValues.className ||
                          'بدون نام'}
                      </td>
                      <td className="px-3 py-2 text-rose-700 dark:text-rose-300">
                        {row.errors.join(' • ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {commitReceipt && (
        <div className="no-print flex justify-end">
          <button
            type="button"
            onClick={onStartFreshWizard}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            شروع یک عملیات ورود هوشمند جدید
          </button>
        </div>
      )}
    </div>
  );
};
