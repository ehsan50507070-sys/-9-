// Step 3-C — Step 3: Optional Multi-Table Join by Normalized National ID & Missing-Cell Policy Matrix
import React, { useRef } from 'react';
import {
  Link2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { getFieldsForTarget } from '../../services/smartImport/columnMatcher';
import type {
  JoinExecutionSummary,
  MappingTargetSelection,
  MissingCellPolicyConfig,
  MissingCellPolicyMap,
  MissingCellPolicyMode,
  SecondaryJoinConfig,
  SmartImportFieldKey,
  SmartImportTargetType,
} from '../../services/smartImport/types';

interface Step3JoinAndPoliciesProps {
  targetType: SmartImportTargetType;
  joinConfig: SecondaryJoinConfig;
  joinSummary: JoinExecutionSummary;
  onUploadSecondaryRaw: (rawText: string, fileName: string) => void;
  onLoadSampleSecondary: () => void;
  onClearSecondary: () => void;
  onUpdateJoinConfig: (updater: (prev: SecondaryJoinConfig) => SecondaryJoinConfig) => void;
  policies: MissingCellPolicyMap;
  onUpdatePolicy: (fieldKey: SmartImportFieldKey, next: MissingCellPolicyConfig) => void;
}

export const Step3JoinAndPolicies: React.FC<Step3JoinAndPoliciesProps> = ({
  targetType,
  joinConfig,
  joinSummary,
  onUploadSecondaryRaw,
  onLoadSampleSecondary,
  onClearSecondary,
  onUpdateJoinConfig,
  policies,
  onUpdatePolicy,
}) => {
  const secFileRef = useRef<HTMLInputElement | null>(null);
  const targetFields = getFieldsForTarget(targetType);

  const handleSecondaryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onUploadSecondaryRaw(text, file.name);
    if (secFileRef.current) secFileRef.current.value = '';
  };

  const secHeaders = joinConfig.parsedTable
    ? joinConfig.parsedTable.rows[joinConfig.headerRowIndex] ?? []
    : [];

  return (
    <div className="space-y-6">
      {/* Section A: Optional Multi-Table Join by National ID */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Link2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۱. پیوند هوشمند با فایل دوم بر اساس کد ملی (اختیاری)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
                اگر شماره تماس اولیا، یادداشت‌ها یا نمرات سیدا در فایل جداگانه‌ای است، فایل دوم را اینجا بارگذاری کنید تا سامانه دو جدول را روی کد ملی نرمال‌سازی‌شده به هم پیوند بزند.
              </p>
            </div>
          </div>

          {targetType !== 'classes' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={secFileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xls,.html,.htm"
                onChange={(e) => void handleSecondaryFileChange(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => secFileRef.current?.click()}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                بارگذاری فایل دوم
              </button>
              <button
                type="button"
                data-testid="load-sample-secondary-btn"
                onClick={onLoadSampleSecondary}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/70 px-3 text-xs font-bold text-amber-900 dark:text-amber-200 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                بارگذاری فایل مکمل نمونه
              </button>
              {joinConfig.enabled && joinConfig.parsedTable && (
                <button
                  type="button"
                  onClick={onClearSecondary}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف پیوند
                </button>
              )}
            </div>
          )}
        </div>

        {targetType === 'classes' ? (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
            پیوند کد ملی برای مقصدهای دارای کد ملی (دانش‌آموزان، معلمان، نمرات سیدا) فعال است. برای کلاس‌بندی می‌توانید مستقیماً سیاست خانه‌های خالی زیر را تنظیم کنید.
          </div>
        ) : joinConfig.enabled && joinConfig.parsedTable ? (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Live Join Telemetry Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  رکوردهای پیوندخورده موفق
                </div>
                <div className="mt-1 text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
                  {toPersianDigits(joinSummary.joinedCount)} ردیف
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  بدون همتا در فایل اصلی
                </div>
                <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {toPersianDigits(joinSummary.unmatchedPrimaryCount)} ردیف
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  بدون همتا در فایل دوم ({joinConfig.fileName})
                </div>
                <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {toPersianDigits(joinSummary.unmatchedSecondaryCount)} ردیف
                </div>
              </div>
            </div>

            {/* Key Column Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  ستون کلید «کد ملی» در فایل دوم:
                </label>
                <select
                  value={joinConfig.nationalIdColIndex}
                  onChange={(e) =>
                    onUpdateJoinConfig((prev) => ({
                      ...prev,
                      nationalIdColIndex: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {secHeaders.map((h, idx) => (
                    <option key={idx} value={idx}>
                      ستون {toPersianDigits(idx + 1)}: {h || '(بدون عنوان)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secondary Columns to Append */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                انتخاب و نگاشت ستون‌های الحاقی از فایل دوم:
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 font-bold w-16">الحاق</th>
                      <th className="px-3 py-2 font-bold">ستون فایل دوم</th>
                      <th className="px-3 py-2 font-bold">مقصد در سامانه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {secHeaders.map((header, idx) => {
                      if (idx === joinConfig.nationalIdColIndex) return null;
                      const checked = joinConfig.selectedAppendColIndices.includes(idx);
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextChecked = e.target.checked;
                                onUpdateJoinConfig((prev) => ({
                                  ...prev,
                                  selectedAppendColIndices: nextChecked
                                    ? [...prev.selectedAppendColIndices, idx]
                                    : prev.selectedAppendColIndices.filter((c) => c !== idx),
                                }));
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-sky-600"
                            />
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                            {header || `ستون ${toPersianDigits(idx + 1)}`}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              disabled={!checked}
                              value={joinConfig.appendColumnMappings[idx] ?? '__ignore__'}
                              onChange={(e) =>
                                onUpdateJoinConfig((prev) => ({
                                  ...prev,
                                  appendColumnMappings: {
                                    ...prev.appendColumnMappings,
                                    [idx]: e.target.value as MappingTargetSelection,
                                  },
                                }))
                              }
                              className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-50"
                            >
                              <option value="__ignore__">— انتخاب فیلد مقصد —</option>
                              {targetFields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.labelFa}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
            هیچ فایل دومی انتخاب نشده است. این مرحله اختیاری است؛ در صورت نیاز فایل مکمل را بارگذاری کنید یا مستقیماً به تنظیم سیاست خانه‌های خالی و مرحله بعد بروید.
          </div>
        )}
      </section>

      {/* Section B: Missing-Cell Policy Matrix */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              ۲. سیاست تکمیل خانه‌های خالی (Missing-Cell Policy)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
              تعیین کنید اگر سلول مربوط به هر فیلد مهم در فایل ورودی خالی بود، سامانه چه تصمیمی بگیرد.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">فیلد سامانه</th>
                <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">سیاست هنگام خالی بودن سلول</th>
                <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">مقدار پیش‌فرض / توضیح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {targetFields
                .filter((f) => f.key !== 'firstName' && f.key !== 'lastName')
                .map((field) => {
                  const currentPolicy: MissingCellPolicyConfig = policies[field.key] ?? {
                    mode: field.required ? 'quarantine' : 'keep_existing',
                    defaultValue: '',
                  };

                  return (
                    <tr key={field.key}>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {field.labelFa}
                        {field.required && (
                          <span className="text-rose-600 dark:text-rose-400 mr-1">*</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 min-w-[230px]">
                        <select
                          aria-label={`سیاست خانه خالی برای ${field.labelFa}`}
                          value={currentPolicy.mode}
                          onChange={(e) =>
                            onUpdatePolicy(field.key, {
                              ...currentPolicy,
                              mode: e.target.value as MissingCellPolicyMode,
                            })
                          }
                          className="w-full min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100"
                        >
                          <option value="keep_existing">
                            ۱. حفظ مقدار موجود در سامانه (در به‌روزرسانی)
                          </option>
                          {field.supportsDefault && (
                            <option value="use_default">
                              ۲. جایگزینی با مقدار پیش‌فرض مشخص‌شده
                            </option>
                          )}
                          {field.supportsAutoGenerate && (
                            <option value="auto_generate">
                              ۳. تولید خودکار هوشمند
                            </option>
                          )}
                          <option value="quarantine">
                            ۴. ارسال ردیف به قرنطینه (الزامی)
                          </option>
                        </select>
                      </td>
                      <td className="px-3.5 py-2.5 min-w-[220px]">
                        {currentPolicy.mode === 'use_default' ? (
                          <input
                            type="text"
                            value={currentPolicy.defaultValue}
                            onChange={(e) =>
                              onUpdatePolicy(field.key, {
                                ...currentPolicy,
                                defaultValue: e.target.value,
                              })
                            }
                            placeholder={field.defaultPlaceholderFa ?? 'مقدار پیش‌فرض را وارد کنید...'}
                            className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        ) : currentPolicy.mode === 'auto_generate' ? (
                          <span className="text-[11px] text-sky-700 dark:text-sky-300 font-semibold">
                            {field.autoGenerateHintFa ?? 'تولید خودکار هوشمند توسط سامانه'}
                          </span>
                        ) : currentPolicy.mode === 'quarantine' ? (
                          <span className="text-[11px] text-rose-700 dark:text-rose-300">
                            ردیف دارای خانه خالی به تب قرنطینه منتقل می‌شود
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            در رکوردهای موجود، مقدار فعلی سامانه حفظ می‌شود
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
