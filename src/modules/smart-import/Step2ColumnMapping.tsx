// Step 3-C — Step 2: Two-Layer Auto Column Matching, Confidence Indicators, FullName Split & Saved Templates
import React from 'react';
import {
  BookmarkCheck,
  CheckCircle2,
  HelpCircle,
  MinusCircle,
  RefreshCw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { getFieldsForTarget } from '../../services/smartImport/columnMatcher';
import type {
  ColumnMappingItem,
  MappingTargetSelection,
  SmartImportTargetType,
} from '../../services/smartImport/types';
import type { ImportMappingTemplate } from '../../types/domain';

interface Step2ColumnMappingProps {
  targetType: SmartImportTargetType;
  columnMappings: ColumnMappingItem[];
  onChangeColumnTarget: (colIndex: number, nextTarget: MappingTargetSelection) => void;
  onResetAutoMatch: () => void;
  splitFullName: boolean;
  onToggleSplitFullName: (value: boolean) => void;
  visibleTemplates: ImportMappingTemplate[];
  selectedTemplateId: string;
  onApplyTemplate: (template: ImportMappingTemplate) => void;
  onDeleteTemplate: (template: ImportMappingTemplate) => void;
  canDeleteTemplate: (template: ImportMappingTemplate) => boolean;
}

export const Step2ColumnMapping: React.FC<Step2ColumnMappingProps> = ({
  targetType,
  columnMappings,
  onChangeColumnTarget,
  onResetAutoMatch,
  splitFullName,
  onToggleSplitFullName,
  visibleTemplates,
  selectedTemplateId,
  onApplyTemplate,
  onDeleteTemplate,
  canDeleteTemplate,
}) => {
  const allowedFields = getFieldsForTarget(targetType);

  const exactCount = columnMappings.filter((c) => c.confidence === 'exact').length;
  const smartCount = columnMappings.filter((c) => c.confidence === 'smart').length;
  const unmatchedCount = columnMappings.filter((c) => c.targetField === '__ignore__').length;

  const hasFullNameMapped = columnMappings.some((c) => c.targetField === 'fullName');
  const hasSeparateNameMapped = columnMappings.some(
    (c) => c.targetField === 'firstName' || c.targetField === 'lastName'
  );

  const missingRequiredFields = allowedFields.filter(
    (f) =>
      f.required &&
      !columnMappings.some((m) => m.targetField === f.key) &&
      !(
        f.key === 'fullName' &&
        columnMappings.some((m) => m.targetField === 'firstName') &&
        columnMappings.some((m) => m.targetField === 'lastName')
      )
  );

  return (
    <div className="space-y-5">
      {/* Saved Templates Quick-Load Bar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <BookmarkCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
              بارگذاری الگوی نگاشت ذخیره‌شده
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {visibleTemplates.length > 0
                ? `${toPersianDigits(visibleTemplates.length)} الگوی آماده برای این مقصد داده در دسترس است.`
                : 'هنوز الگویی برای این مقصد ذخیره نشده است؛ در مرحله ۵ می‌توانید این چیدمان را ذخیره کنید.'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleTemplates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="انتخاب الگوی نگاشت ذخیره‌شده"
                value={selectedTemplateId}
                onChange={(e) => {
                  const found = visibleTemplates.find((t) => t.id === e.target.value);
                  if (found) onApplyTemplate(found);
                }}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="">انتخاب یک الگو...</option>
                {visibleTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nameFa} {tpl.isComplexWide ? '(سراسری مجموعه)' : '(اختصاصی مدرسه)'}
                  </option>
                ))}
              </select>

              {selectedTemplateId &&
                (() => {
                  const activeTpl = visibleTemplates.find((t) => t.id === selectedTemplateId);
                  if (!activeTpl || !canDeleteTemplate(activeTpl)) return null;
                  return (
                    <button
                      type="button"
                      title="انتقال الگو به سطل بازیابی امن (حذف نرم)"
                      onClick={() => onDeleteTemplate(activeTpl)}
                      className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  );
                })()}
            </div>
          )}

          <button
            type="button"
            onClick={onResetAutoMatch}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تطبیق خودکار مجدد
          </button>
        </div>
      </section>

      {/* Auto-Match Summary & FullName Split Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            تطابق قطعی: {toPersianDigits(exactCount)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
            <HelpCircle className="w-4 h-4 shrink-0" />
            پیشنهاد هوشمند: {toPersianDigits(smartCount)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-400">
            <MinusCircle className="w-4 h-4 shrink-0" />
            تطبیق‌نشده / نادیده: {toPersianDigits(unmatchedCount)}
          </span>
        </div>

        {hasFullNameMapped && !hasSeparateNameMapped && (targetType === 'students' || targetType === 'teachers') && (
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-100 select-none">
            <input
              type="checkbox"
              checked={splitFullName}
              onChange={(e) => onToggleSplitFullName(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <Scissors className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>تفکیک خودکار ستون ترکیبی «نام و نام خانوادگی» به دو فیلد نام و نام خانوادگی</span>
          </label>
        )}
      </div>

      {missingRequiredFields.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <strong>توجه:</strong> فیلدهای کلیدی زیر هنوز به ستونی متصل نشده‌اند (در مرحله ۳ می‌توانید از فایل دوم پیوند بزنید یا مقدار پیش‌فرض تعیین کنید):{' '}
          <span className="font-bold">
            {missingRequiredFields.map((f) => f.labelFa).join('، ')}
          </span>
        </div>
      )}

      {/* Column Mapping Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-right text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">ستون در فایل</th>
              <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">نمونه داده‌ها (از ۱۰ ردیف اول)</th>
              <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">میزان اطمینان تشخیص</th>
              <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">فیلد مقصد در سامانه</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {columnMappings.map((item) => {
              const confMeta =
                item.targetField === '__ignore__'
                  ? {
                      textClass: 'text-slate-500 dark:text-slate-400',
                      label: 'تطبیق‌نشده (نادیده)',
                      Icon: MinusCircle,
                    }
                  : item.confidence === 'exact'
                    ? {
                        textClass: 'text-emerald-700 dark:text-emerald-400',
                        label: 'تطابق قطعی',
                        Icon: CheckCircle2,
                      }
                    : {
                        textClass: 'text-amber-700 dark:text-amber-400',
                        label: 'پیشنهاد هوشمند',
                        Icon: HelpCircle,
                      };

              const ConfIcon = confMeta.Icon;

              return (
                <tr
                  key={item.colIndex}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-3.5 py-3 align-top">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {item.headerLabel}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                      ستون {toPersianDigits(item.colIndex + 1)}
                    </div>
                  </td>

                  <td className="px-3.5 py-3 align-top">
                    <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums max-w-[240px]">
                      {item.samples.length > 0 ? (
                        item.samples.slice(0, 2).map((s, idx) => (
                          <div key={idx} className="truncate" title={s}>
                            {toPersianDigits(s)}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400">(خالی)</span>
                      )}
                    </div>
                  </td>

                  <td className="px-3.5 py-3 align-top">
                    <div className={`inline-flex items-center gap-1.5 font-bold ${confMeta.textClass}`}>
                      <ConfIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{confMeta.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.matchReasonFa}
                    </div>
                  </td>

                  <td className="px-3.5 py-3 align-top min-w-[220px]">
                    <select
                      aria-label={`انتخاب فیلد مقصد برای ستون ${item.headerLabel}`}
                      value={item.targetField}
                      onChange={(e) =>
                        onChangeColumnTarget(
                          item.colIndex,
                          e.target.value as MappingTargetSelection
                        )
                      }
                      className="w-full min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="__ignore__">— نادیده گرفتن این ستون —</option>
                      {allowedFields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.labelFa} {field.required ? '(الزامی)' : ''}
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
  );
};
