// Step 3-C — Step 1: File Upload / Excel Paste / Irregular SIDA Sample & Header Row Auto-Detector
import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Sparkles,
  Upload,
  Users,
  BookOpenCheck,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { SMART_IMPORT_TARGET_LABELS_FA } from '../../services/smartImport/columnMatcher';
import type {
  ParsedTableResult,
  SmartImportTargetType,
} from '../../services/smartImport/types';

interface Step1SourceAndHeaderProps {
  targetType: SmartImportTargetType;
  onChangeTargetType: (next: SmartImportTargetType) => void;
  parsedTable: ParsedTableResult | null;
  headerRowIndex: number;
  onSelectHeaderRowIndex: (index: number) => void;
  onParseRawInput: (rawText: string, fileName: string, sourceHint: 'file' | 'paste') => void;
  onLoadSampleIrregularSida: () => void;
  parseErrorFa: string | null;
}

const TARGET_CARDS: Array<{
  id: SmartImportTargetType;
  titleFa: string;
  descFa: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'students',
    titleFa: SMART_IMPORT_TARGET_LABELS_FA.students,
    descFa: 'ثبت یا به‌روزرسانی دانش‌آموزان، اطلاعات ولی، موبایل و کلاس‌بندی',
    Icon: GraduationCap,
  },
  {
    id: 'teachers',
    titleFa: SMART_IMPORT_TARGET_LABELS_FA.teachers,
    descFa: 'ورود معلمان، کد پرسنلی، موبایل، تخصص و ساعات موظف هفتگی',
    Icon: Users,
  },
  {
    id: 'classes',
    titleFa: SMART_IMPORT_TARGET_LABELS_FA.classes,
    descFa: 'تعریف یا به‌روزرسانی کلاس‌ها، پایه، شعبه، کد اتاق و ظرفیت',
    Icon: Layers,
  },
  {
    id: 'sida_grades',
    titleFa: SMART_IMPORT_TARGET_LABELS_FA.sida_grades,
    descFa: 'ورود ریزنمرات مستمر و پایانی سیدا و اتصال به دفتر نمره و تحلیل سیدا',
    Icon: BookOpenCheck,
  },
];

export const Step1SourceAndHeader: React.FC<Step1SourceAndHeaderProps> = ({
  targetType,
  onChangeTargetType,
  parsedTable,
  headerRowIndex,
  onSelectHeaderRowIndex,
  onParseRawInput,
  onLoadSampleIrregularSida,
  parseErrorFa,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileObject = async (file: File) => {
    const text = await file.text();
    onParseRawInput(text, file.name, 'file');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleFileObject(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileObject(file);
    }
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    onParseRawInput(pasteText, 'متن کپی‌شده از اکسل', 'paste');
  };

  const previewRows = parsedTable ? parsedTable.rows.slice(0, 10) : [];
  const previewMaxCols = parsedTable ? Math.min(parsedTable.columnCount, 10) : 0;

  return (
    <div className="space-y-6">
      {/* Destination Entity Picker */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              ۱. انتخاب نوع مقصد داده در سامانه
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مشخص کنید جدول ورودی مربوط به کدام بخش مدرسه است تا فرهنگ‌لغت تطبیق خودکار دقیقاً متناسب با آن تنظیم شود.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TARGET_CARDS.map(({ id, titleFa, descFa, Icon }) => {
            const active = targetType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTargetType(id)}
                className={`text-right rounded-xl border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  active
                    ? 'border-sky-600 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      active
                        ? 'brand-bg'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {active && (
                    <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  )}
                </div>
                <div className="mt-2.5 text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {titleFa}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  {descFa}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Source Input Mode + Quick Sample SIDA Button */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                inputMode === 'file'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              بارگذاری فایل (CSV / TSV / سیدا XLS-HTML)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                inputMode === 'paste'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
              چسباندن مستقیم از اکسل
            </button>
          </div>

          <button
            type="button"
            data-testid="load-sample-sida-btn"
            onClick={onLoadSampleIrregularSida}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/70 px-3.5 text-xs font-bold text-amber-900 dark:text-amber-200 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            بارگذاری نمونه فایل نامنظم سیدا (برای تست سریع)
          </button>
        </div>

        {inputMode === 'file' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragActive
                ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/30'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.xls,.html,.htm"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet className="w-9 h-9 mx-auto text-slate-400 dark:text-slate-500" />
            <div className="mt-2.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              فایل خروجی سیدا یا اکسل را اینجا رها کنید یا انتخاب نمایید
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              پشتیبانی بومی از CSV (کاما، سمی‌کالن، تب و UTF-8 BOM فارسی)، TSV و جدول HTML خروجی سیدا (.xls / .html)
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-5 text-xs font-bold transition-colors"
            >
              <Upload className="w-4 h-4" />
              انتخاب فایل از رایانه
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="smart-import-paste-area"
              className="block text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              سلول‌های جدول را در اکسل یا گوگل‌شیت انتخاب و کپی (Ctrl+C) کرده و در کادر زیر بچسبانید (Ctrl+V):
            </label>
            <textarea
              id="smart-import-paste-area"
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="مثال: کد ملی [Tab] نام و نام خانوادگی [Tab] موبایل ولی [Tab] کلاس"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={handleParsePaste}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-4 text-xs font-bold disabled:opacity-50 transition-colors"
              >
                <ClipboardPaste className="w-4 h-4" />
                پردازش جدول کپی‌شده
              </button>
            </div>
          </div>
        )}

        {parseErrorFa && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-bold text-rose-800 dark:text-rose-200"
          >
            {parseErrorFa}
          </div>
        )}
      </section>

      {/* Auto-Detected Header Row Preview (First 10 Rows — Clickable Manual Override) */}
      {parsedTable && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۲. تشخیص خودکار ردیف شروع جدول (پیشنمایش ۱۰ ردیف اول)
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>فایل: {parsedTable.fileName}</span>
                <span aria-hidden="true">·</span>
                <span>
                  قالب:{' '}
                  {parsedTable.sourceFormat === 'html_sida'
                    ? 'جدول HTML سیدا'
                    : parsedTable.sourceFormat === 'paste'
                      ? 'متن کپی‌شده اکسل'
                      : parsedTable.sourceFormat === 'tsv'
                        ? 'TSV (جداکننده تب)'
                        : `CSV (جداکننده ${parsedTable.delimiter === ';' ? 'سمی‌کالن' : 'کاما'})`}
                </span>
                <span aria-hidden="true">·</span>
                <span>کل ردیف‌ها: {toPersianDigits(parsedTable.totalRows)}</span>
                <span aria-hidden="true">·</span>
                <span>ستون‌ها: {toPersianDigits(parsedTable.columnCount)}</span>
              </div>
            </div>

            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              ردیف سرستون فعال: ردیف {toPersianDigits(headerRowIndex + 1)}
              {headerRowIndex > 0 && (
                <span className="text-slate-500 dark:text-slate-400 font-normal">
                  {' '}
                  ({toPersianDigits(headerRowIndex)} ردیف تیتر اضافی بالا رد شد)
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            سامانه به‌صورت خودکار ردیف‌های تیتر اضافی بالا (مانند نام وزارتخانه و تاریخ گزارش سیدا) را شناسایی و رد کرد. در صورت نیاز می‌توانید با <strong>کلیک روی هر ردیف</strong>، آن را به‌عنوان ردیف سرستون انتخاب کنید.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 font-bold whitespace-nowrap w-28">شماره ردیف</th>
                  <th className="px-3 py-2 font-bold whitespace-nowrap w-36">نقش ردیف</th>
                  {Array.from({ length: previewMaxCols }, (_, cIdx) => (
                    <th key={cIdx} className="px-3 py-2 font-bold whitespace-nowrap tabular-nums">
                      ستون {toPersianDigits(cIdx + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewRows.map((row, rIdx) => {
                  const isHeader = rIdx === headerRowIndex;
                  const isSkippedBanner = rIdx < headerRowIndex;
                  return (
                    <tr
                      key={rIdx}
                      onClick={() => onSelectHeaderRowIndex(rIdx)}
                      className={`cursor-pointer transition-colors ${
                        isHeader
                          ? 'bg-sky-50 dark:bg-sky-950/50 font-bold text-sky-950 dark:text-sky-100'
                          : isSkippedBanner
                            ? 'bg-slate-50/80 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums font-semibold">
                        ردیف {toPersianDigits(rIdx + 1)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                        {isHeader ? (
                          <span className="font-extrabold text-sky-700 dark:text-sky-300">
                            ✓ سرستون جدول
                          </span>
                        ) : isSkippedBanner ? (
                          <span>تیتر اضافی (رد می‌شود)</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">ردیف داده</span>
                        )}
                      </td>
                      {Array.from({ length: previewMaxCols }, (_, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-2 max-w-[180px] truncate tabular-nums"
                          title={row[cIdx] ?? ''}
                        >
                          {row[cIdx] ? toPersianDigits(row[cIdx]) : '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {parsedTable.columnCount > previewMaxCols && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              نمایش {toPersianDigits(previewMaxCols)} ستون اول از مجموع{' '}
              {toPersianDigits(parsedTable.columnCount)} ستون فایل در پیش‌نمایش؛ تمام ستون‌ها در مرحله ۲ نگاشت می‌شوند.
            </div>
          )}
        </section>
      )}
    </div>
  );
};
