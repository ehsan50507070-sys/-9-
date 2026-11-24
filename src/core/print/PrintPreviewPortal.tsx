// Global Print Preview Portal, Hidden Iframe Print Engine & Paper Size Chooser Provider
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  FileText,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  Plus,
  Printer,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  SlidersHorizontal,
  Unlock,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useAppearance } from '../appearance/AppearanceContext';
import {
  DEFAULT_BRAND_LOGO_DATA_URL,
  OFFICIAL_SYSTEM_NAME_FA,
} from '../branding/BrandLogo';
import { useSchoolData } from '../data/DataContext';
import { useLabelContext } from '../super-admin/LabelContext';
import {
  MAX_PRINT_MARGIN_MM,
  MIN_PRINT_MARGIN_MM,
  buildInjectedSchoolFooterHtml,
  buildInjectedSchoolHeaderHtml,
  buildStandalonePrintDocumentHtml,
  capturePrintableDom,
  clampMarginMm,
  collectParentStylesheetTags,
  executeWindowPrintFallback,
  getDefaultMargins,
  normalizeMargins,
  registerPrintPreviewHandler,
  triggerPrint,
  type PrintMarginsMm,
  type PrintOrientation,
  type PrintPaperSize,
  type PrintSchoolMeta,
  type TriggerPrintOptions,
} from './printService';

export interface PrintChooserRequest {
  documentLabel?: string;
  landscape?: boolean;
  html?: string;
  targetSelector?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  onPrint?: (size: PrintPaperSize) => void;
  onBeforePrint?: (size: PrintPaperSize) => void;
  onAfterPrint?: () => void;
}

export interface PrintJobState {
  id: number;
  title: string;
  size: PrintPaperSize;
  orientation: PrintOrientation;
  margins: PrintMarginsMm;
  isCustomMargins: boolean;
  bodyHtml: string;
  hasEmbeddedHeader: boolean;
  hasEmbeddedFooter: boolean;
  includeHeader: boolean;
  includeFooter: boolean;
  stylesheetTags: string;
  onAfterPrint?: () => void;
}

interface PrintEngineContextValue {
  openSizeChooser: (request: PrintChooserRequest) => void;
  openPreview: (options: TriggerPrintOptions) => void;
  closeAllPrintModals: () => void;
}

const PrintEngineContext = createContext<PrintEngineContextValue | null>(null);

export function usePrintEngine(): PrintEngineContextValue {
  const ctx = useContext(PrintEngineContext);
  if (!ctx) {
    return {
      openSizeChooser: (req) => {
        if (req.onPrint) {
          req.onPrint('a4');
        } else {
          triggerPrint({
            size: 'a4',
            orientation: req.landscape ? 'landscape' : 'portrait',
            documentLabel: req.documentLabel,
            html: req.html,
            targetSelector: req.targetSelector,
            onBeforePrint: req.onBeforePrint ? () => req.onBeforePrint?.('a4') : undefined,
            onAfterPrint: req.onAfterPrint,
          });
        }
      },
      openPreview: (opts) => triggerPrint(opts),
      closeAllPrintModals: () => {},
    };
  }
  return ctx;
}

async function waitForIframeAssets(iframeDoc: Document, timeoutMs = 2500): Promise<void> {
  const waitFonts =
    'fonts' in iframeDoc && iframeDoc.fonts?.ready
      ? iframeDoc.fonts.ready.catch(() => {})
      : Promise.resolve();

  const imgs = Array.from(iframeDoc.querySelectorAll('img'));
  const waitImgs = Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    })
  );

  await Promise.race([
    Promise.all([waitFonts, waitImgs]),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function getPaperDimensions(
  size: PrintPaperSize,
  orientation: PrintOrientation
): { widthPx: number; minHeightPx: number; labelFa: string } {
  // 96 DPI visual sheet approximations (A4: 210x297mm, A5: 148x210mm)
  if (size === 'a5') {
    return orientation === 'landscape'
      ? { widthPx: 794, minHeightPx: 559, labelFa: 'A5 افقی · ۲۱۰×۱۴۸ میلی‌متر' }
      : { widthPx: 559, minHeightPx: 794, labelFa: 'A5 عمودی · ۱۴۸×۲۱۰ میلی‌متر' };
  }
  return orientation === 'landscape'
    ? { widthPx: 1123, minHeightPx: 794, labelFa: 'A4 افقی · ۲۹۷×۲۱۰ میلی‌متر' }
    : { widthPx: 794, minHeightPx: 1123, labelFa: 'A4 عمودی · ۲۱۰×۲۹۷ میلی‌متر' };
}

export interface PrintPreviewPortalProps {
  job: PrintJobState;
  school: PrintSchoolMeta;
  onChangeSize: (size: PrintPaperSize) => void;
  onChangeOrientation: (orientation: PrintOrientation) => void;
  onChangeMargins: (margins: PrintMarginsMm, isCustom: boolean) => void;
  onToggleHeader: () => void;
  onToggleFooter: () => void;
  onClose: () => void;
}

type MarginSide = keyof PrintMarginsMm;

const MARGIN_SIDES: Array<{ key: MarginSide; labelFa: string }> = [
  { key: 'top', labelFa: 'بالا' },
  { key: 'right', labelFa: 'راست' },
  { key: 'bottom', labelFa: 'پایین' },
  { key: 'left', labelFa: 'چپ' },
];

function formatMarginSummaryFa(m: PrintMarginsMm): string {
  if (m.top === m.right && m.right === m.bottom && m.bottom === m.left) {
    return `حاشیه ${toPersianDigits(m.top)} میلی‌متر`;
  }
  return `حاشیه: بالا ${toPersianDigits(m.top)} · راست ${toPersianDigits(m.right)} · پایین ${toPersianDigits(m.bottom)} · چپ ${toPersianDigits(m.left)} mm`;
}

/**
 * Dedicated PrintPreviewPortal rendering:
 * 1) A crisp visual «پیشنمایش چاپ» modal showing the exact scaled A4 or A5 pure-white sheet
 *    with live A4/A5 switching, orientation switching, manual paper margin settings, and header/footer toggles.
 * 2) An isolated hidden <iframe> holding the exact self-contained RTL Vazirmatn document
 *    with forced pure-white styling and @page rules for 100% reliable printing + window.print() fallback.
 */
export const PrintPreviewPortal: React.FC<PrintPreviewPortalProps> = ({
  job,
  school,
  onChangeSize,
  onChangeOrientation,
  onChangeMargins,
  onToggleHeader,
  onToggleFooter,
  onClose,
}) => {
  const hiddenIframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const viewportBoxRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const [isPrinting, setIsPrinting] = useState(false);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [previewFrameHeight, setPreviewFrameHeight] = useState<number>(1123);
  const [availableWidth, setAvailableWidth] = useState<number>(840);
  const [showMarginSettings, setShowMarginSettings] = useState(false);
  const [lockUniformMargins, setLockUniformMargins] = useState(false);

  const compiledHtml = useMemo(
    () =>
      buildStandalonePrintDocumentHtml({
        size: job.size,
        orientation: job.orientation,
        margins: job.margins,
        bodyHtml: job.bodyHtml,
        documentTitle: job.title,
        school,
        includeHeader: job.includeHeader,
        includeFooter: job.includeFooter,
        hasEmbeddedHeader: job.hasEmbeddedHeader,
        hasEmbeddedFooter: job.hasEmbeddedFooter,
        stylesheetTags: job.stylesheetTags,
      }),
    [job, school]
  );

  const handleMarginValueChange = useCallback(
    (side: MarginSide, rawValue: number) => {
      const clamped = clampMarginMm(rawValue);
      const next: PrintMarginsMm = lockUniformMargins
        ? { top: clamped, right: clamped, bottom: clamped, left: clamped }
        : { ...job.margins, [side]: clamped };
      onChangeMargins(next, true);
    },
    [job.margins, lockUniformMargins, onChangeMargins]
  );

  const handleApplyMarginPreset = useCallback(
    (preset: PrintMarginsMm, isDefault = false) => {
      onChangeMargins(normalizeMargins(preset), !isDefault);
    },
    [onChangeMargins]
  );

  const defaultMarginsForCurrentPaper = useMemo(
    () => getDefaultMargins(job.size, job.orientation),
    [job.size, job.orientation]
  );

  const dims = getPaperDimensions(job.size, job.orientation);

  // Measure preview viewport to compute responsive zoom scale so paper never overflows horizontally
  useEffect(() => {
    const updateWidth = () => {
      if (viewportBoxRef.current) {
        const w = viewportBoxRef.current.clientWidth - 32;
        setAvailableWidth(Math.max(300, w));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Write compiled HTML into the isolated hidden print iframe whenever job settings change
  useEffect(() => {
    const iframe = hiddenIframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(compiledHtml);
        doc.close();
      }
    } catch {
      // Sandboxed iframe write error will cleanly fall back on print click
    }
  }, [compiledHtml]);

  const handlePreviewIframeLoad = useCallback(() => {
    const iframe = previewIframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      const scrollH = doc?.documentElement?.scrollHeight ?? dims.minHeightPx;
      setPreviewFrameHeight(Math.max(dims.minHeightPx, scrollH + 8));
      doc?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          onClose();
        }
      });
    } catch {
      setPreviewFrameHeight(dims.minHeightPx);
    }
  }, [dims.minHeightPx, onClose]);

  const runFallbackWindowPrint = useCallback(() => {
    const injectedHeader =
      job.includeHeader && !job.hasEmbeddedHeader
        ? buildInjectedSchoolHeaderHtml(school, job.title)
        : '';
    const injectedFooter =
      job.includeFooter && !job.hasEmbeddedFooter
        ? buildInjectedSchoolFooterHtml(school)
        : '';
    const combinedInner = `${injectedHeader}<div class="gpe-content-body">${job.bodyHtml}</div>${injectedFooter}`;
    executeWindowPrintFallback({
      bodyInnerHtml: combinedInner,
      size: job.size,
      orientation: job.orientation,
      margins: job.margins,
      onAfterPrint: () => setIsPrinting(false),
    });
  }, [job, school]);

  const handleFinalPrint = useCallback(async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintNotice(null);

    const iframe = hiddenIframeRef.current;
    try {
      const win = iframe?.contentWindow;
      const doc = iframe?.contentDocument ?? win?.document;
      if (!win || !doc || typeof win.print !== 'function') {
        throw new Error('Hidden print iframe unavailable');
      }

      // Ensure latest HTML is present and wait for Vazirmatn fonts + images (logos/signatures)
      if (!doc.getElementById('gpe-isolated-print-css')) {
        doc.open();
        doc.write(compiledHtml);
        doc.close();
      }

      await waitForIframeAssets(doc, 2500);

      win.focus();
      win.print();

      // Restore keyboard focus to parent modal so Escape and controls remain immediately responsive
      setTimeout(() => {
        try {
          window.focus();
          closeBtnRef.current?.focus();
        } catch {
          // ignore
        }
        setIsPrinting(false);
      }, 200);
    } catch {
      setPrintNotice('چاپ از طریق حالت سازگار مرورگر اجرا شد.');
      runFallbackWindowPrint();
    }
  }, [compiledHtml, isPrinting, runFallbackWindowPrint]);

  const scale = Math.min(1, availableWidth / dims.widthPx);
  const scaledHeight = Math.round(previewFrameHeight * scale);
  const scaledWidth = Math.round(dims.widthPx * scale);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-preview-portal-title"
      data-print-portal="true"
      data-testid="print-preview-portal"
      className="no-print fixed inset-0 z-[100] flex flex-col bg-slate-950/75 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Studio Control Bar */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Title & Paper Specs */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="brand-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <Printer className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="print-preview-portal-title"
                className="truncate text-sm font-extrabold text-slate-900 dark:text-white"
              >
                پیشنمایش چاپ
                {job.title ? ` — ${job.title}` : ''}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                <span>{toPersianDigits(dims.labelFa)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatMarginSummaryFa(job.margins)}</span>
                <span aria-hidden="true">·</span>
                <span>زمینه سفید استاندارد چاپ</span>
                {printNotice && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">
                      {printNotice}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live A4 / A5 Switcher */}
            <div
              role="group"
              aria-label="تغییر اندازه کاغذ"
              className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <button
                type="button"
                data-preview-paper="a4"
                aria-pressed={job.size === 'a4'}
                onClick={() => onChangeSize('a4')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  job.size === 'a4'
                    ? 'brand-btn'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                کاغذ A4
              </button>
              <button
                type="button"
                data-preview-paper="a5"
                aria-pressed={job.size === 'a5'}
                onClick={() => onChangeSize('a5')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  job.size === 'a5'
                    ? 'brand-btn'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                کاغذ A5
              </button>
            </div>

            {/* Orientation Toggle */}
            <div
              role="group"
              aria-label="جهت چاپ"
              className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <button
                type="button"
                aria-pressed={job.orientation === 'portrait'}
                onClick={() => onChangeOrientation('portrait')}
                title="چاپ عمودی"
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  job.orientation === 'portrait'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <RectangleVertical className="h-3.5 w-3.5" />
                <span>عمودی</span>
              </button>
              <button
                type="button"
                aria-pressed={job.orientation === 'landscape'}
                onClick={() => onChangeOrientation('landscape')}
                title="چاپ افقی"
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  job.orientation === 'landscape'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <RectangleHorizontal className="h-3.5 w-3.5" />
                <span>افقی</span>
              </button>
            </div>

            {/* Header / Footer Switches */}
            <button
              type="button"
              aria-pressed={job.includeHeader}
              onClick={onToggleHeader}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                job.includeHeader
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                  : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                  job.includeHeader
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {job.includeHeader && <Check className="h-2.5 w-2.5" />}
              </span>
              <span>سربرگ مدرسه</span>
            </button>

            <button
              type="button"
              aria-pressed={job.includeFooter}
              onClick={onToggleFooter}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                job.includeFooter
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                  : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                  job.includeFooter
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {job.includeFooter && <Check className="h-2.5 w-2.5" />}
              </span>
              <span>امضا</span>
            </button>

            {/* Manual Margin Settings Drawer Toggle */}
            <button
              type="button"
              data-testid="toggle-margin-settings-btn"
              aria-expanded={showMarginSettings}
              onClick={() => setShowMarginSettings((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                showMarginSettings || job.isCustomMargins
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>تنظیم حاشیه</span>
            </button>

            {/* Primary Final Print CTA */}
            <button
              type="button"
              data-testid="final-print-btn"
              disabled={isPrinting}
              onClick={handleFinalPrint}
              className="brand-btn inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors disabled:opacity-60"
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>{isPrinting ? 'در حال آماده‌سازی...' : 'چاپ نهایی'}</span>
            </button>

            {/* Close */}
            <button
              ref={closeBtnRef}
              type="button"
              data-testid="close-print-preview-btn"
              onClick={onClose}
              className="inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
              <span>بستن</span>
            </button>
          </div>
        </div>

        {/* Collapsible Manual Paper Margin Settings Bar */}
        {showMarginSettings && (
          <div
            data-testid="margin-settings-panel"
            className="mx-auto mt-3 max-w-7xl border-t border-slate-200 pt-3 dark:border-slate-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  الگوی آماده حاشیه:
                </span>
                <button
                  type="button"
                  data-margin-preset="default"
                  onClick={() => handleApplyMarginPreset(defaultMarginsForCurrentPaper, true)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600"
                >
                  استاندارد ({toPersianDigits(defaultMarginsForCurrentPaper.top)} mm)
                </button>
                <button
                  type="button"
                  data-margin-preset="narrow"
                  onClick={() => handleApplyMarginPreset({ top: 5, right: 5, bottom: 5, left: 5 })}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600"
                >
                  باریک (۵ mm)
                </button>
                <button
                  type="button"
                  data-margin-preset="letterhead"
                  onClick={() =>
                    handleApplyMarginPreset({ top: 25, right: 10, bottom: 10, left: 10 })
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600"
                >
                  کاغذ سربرگ‌دار (بالا ۲۵ mm)
                </button>
                <button
                  type="button"
                  data-margin-preset="binding"
                  onClick={() =>
                    handleApplyMarginPreset({ top: 10, right: 20, bottom: 10, left: 10 })
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600"
                >
                  صحافی / پانچ راست (۲۰ mm)
                </button>
                <button
                  type="button"
                  data-margin-preset="none"
                  onClick={() => handleApplyMarginPreset({ top: 0, right: 0, bottom: 0, left: 0 })}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600"
                >
                  بدون حاشیه (۰ mm)
                </button>
              </div>

              {/* Uniform Lock & Reset */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="margin-uniform-lock-btn"
                  aria-pressed={lockUniformMargins}
                  onClick={() => setLockUniformMargins((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    lockUniformMargins
                      ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {lockUniformMargins ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                  <span>{lockUniformMargins ? 'قفل همسان ۴ طرف' : 'تنظیم مجزا (۴ طرف)'}</span>
                </button>

                {job.isCustomMargins && (
                  <button
                    type="button"
                    data-testid="reset-margins-btn"
                    onClick={() => handleApplyMarginPreset(defaultMarginsForCurrentPaper, true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>بازگردانی پیش‌فرض</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4-Side Precision Numeric & Slider Controls */}
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {MARGIN_SIDES.map(({ key, labelFa }) => {
                const value = job.margins[key];
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`print-margin-${key}`}
                        className="text-xs font-bold text-slate-700 dark:text-slate-200"
                      >
                        حاشیه {labelFa}
                      </label>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`کاهش حاشیه ${labelFa}`}
                          onClick={() => handleMarginValueChange(key, value - 1)}
                          disabled={value <= MIN_PRINT_MARGIN_MM}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          id={`print-margin-${key}`}
                          data-margin-input={key}
                          type="number"
                          min={MIN_PRINT_MARGIN_MM}
                          max={MAX_PRINT_MARGIN_MM}
                          step={1}
                          value={value}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            if (!Number.isNaN(parsed)) {
                              handleMarginValueChange(key, parsed);
                            }
                          }}
                          dir="ltr"
                          className="w-12 rounded-md border border-slate-200 bg-white py-0.5 text-center text-xs font-extrabold tabular-nums text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                        <span className="text-[10px] font-semibold text-slate-400">mm</span>
                        <button
                          type="button"
                          aria-label={`افزایش حاشیه ${labelFa}`}
                          onClick={() => handleMarginValueChange(key, value + 1)}
                          disabled={value >= MAX_PRINT_MARGIN_MM}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      aria-label={`اسلایدر حاشیه ${labelFa}`}
                      min={MIN_PRINT_MARGIN_MM}
                      max={MAX_PRINT_MARGIN_MM}
                      step={1}
                      value={value}
                      onChange={(e) => handleMarginValueChange(key, Number(e.target.value))}
                      className="mt-2 h-1.5 w-full cursor-pointer accent-sky-600"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scaled Pure-White Paper Desk Canvas */}
      <div
        ref={viewportBoxRef}
        className="flex-1 overflow-auto bg-slate-200/90 p-4 sm:p-6 dark:bg-slate-950"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="mx-auto flex flex-col items-center">
          {job.bodyHtml.trim().length === 0 ? (
            <div className="my-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <FileText className="mx-auto h-9 w-9 text-slate-400" />
              <p className="mt-2 text-sm font-extrabold text-slate-800 dark:text-white">
                محتوای قابل چاپی در این بخش یافت نشد
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ابتدا رکورد یا گزارش مورد نظر را باز کرده و دوباره روی آیکون چاپ کلیک کنید.
              </p>
            </div>
          ) : (
            <div
              className="relative overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl"
              style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
              }}
            >
              <iframe
                ref={previewIframeRef}
                title="پیشنمایش برگه چاپ"
                data-testid="print-preview-iframe"
                srcDoc={compiledHtml}
                onLoad={handlePreviewIframeLoad}
                className="block origin-top-right border-0 bg-white"
                style={{
                  width: `${dims.widthPx}px`,
                  height: `${previewFrameHeight}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top right',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                }}
              />
            </div>
          )}

          {/* Subtle keyboard & zoom metadata */}
          <div className="mt-3 flex items-center gap-2 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            <Maximize2 className="h-3 w-3" />
            <span>بزرگ‌نمایی پیش‌نمایش: {toPersianDigits(Math.round(scale * 100))}٪</span>
            <span aria-hidden="true">·</span>
            <span>برای بستن کلید Esc را فشار دهید</span>
          </div>
        </div>
      </div>

      {/* Dedicated Isolated Hidden Print Iframe */}
      <iframe
        ref={hiddenIframeRef}
        title="موتور ایزوله چاپ"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="hidden-print-iframe"
        style={{
          position: 'fixed',
          top: '-10000px',
          left: '-10000px',
          width: '210mm',
          height: '297mm',
          border: 'none',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>,
    document.body
  );
};

interface PaperSizeChooserModalProps {
  request: PrintChooserRequest;
  onSelectSize: (size: PrintPaperSize) => void;
  onClose: () => void;
}

const PaperSizeChooserModal: React.FC<PaperSizeChooserModalProps> = ({
  request,
  onSelectSize,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paper-size-chooser-title"
      data-print-portal="true"
      data-testid="paper-size-chooser-modal"
      className="no-print fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="brand-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="paper-size-chooser-title"
                className="text-sm font-extrabold text-slate-900 dark:text-white sm:text-base"
              >
                انتخاب اندازه کاغذ برای چاپ
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {request.documentLabel
                  ? `سند انتخابی: «${request.documentLabel}»`
                  : 'ابتدا اندازه برگه را انتخاب کنید تا پیش‌نمایش استاندارد سفید باز شود.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Two Visual Paper Size Cards */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            data-choose-paper="a4"
            onClick={() => onSelectSize('a4')}
            className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-right transition-colors hover:border-sky-400 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-sky-500 dark:hover:bg-sky-950/30"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex h-12 w-9 items-center justify-center rounded-md border-2 border-slate-400 bg-white text-[11px] font-extrabold text-slate-800 transition-colors group-hover:border-sky-600 group-hover:text-sky-700 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100">
                A4
              </div>
              <span className="text-[11px] font-bold tabular-nums text-slate-400 dark:text-slate-500">
                ۲۱۰×۲۹۷ mm
              </span>
            </div>
            <div className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white">
              کاغذ A4
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              ابعاد استاندارد کامل — مناسب گزارش‌ها، جدول‌ها و کارنامه‌های جامع
            </p>
          </button>

          <button
            type="button"
            data-choose-paper="a5"
            onClick={() => onSelectSize('a5')}
            className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-right transition-colors hover:border-sky-400 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-sky-500 dark:hover:bg-sky-950/30"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex h-9 w-7 items-center justify-center rounded-md border-2 border-slate-400 bg-white text-[10px] font-extrabold text-slate-800 transition-colors group-hover:border-sky-600 group-hover:text-sky-700 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100">
                A5
              </div>
              <span className="text-[11px] font-bold tabular-nums text-slate-400 dark:text-slate-500">
                ۱۴۸×۲۱۰ mm
              </span>
            </div>
            <div className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white">
              کاغذ A5
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              نیم‌برگ جمع‌وجور — مناسب رسید، لوح تقدیر و کارت ورود به جلسه
            </p>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>در پیش‌نمایش نیز امکان تغییر لحظه‌ای بین A4 و A5 وجود دارد.</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const PrintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeSchool, globalSystemConfig } = useSchoolData();
  const { schoolLogoUrl, activeSchoolDisplayName, activePrintSubtitle, branding } = useAppearance();
  const { getLabel } = useLabelContext();

  const [chooserRequest, setChooserRequest] = useState<PrintChooserRequest | null>(null);
  const [activeJob, setActiveJob] = useState<PrintJobState | null>(null);
  const jobSeqRef = useRef(0);

  const schoolMeta = useMemo<PrintSchoolMeta>(() => {
    const siteName = getLabel('site.name', OFFICIAL_SYSTEM_NAME_FA);
    const customFooter = getLabel('site.footer', activeSchool.signatureFooter);
    const letterheadTitle =
      branding?.schoolDisplayName?.trim() || activeSchool.letterheadTitle || activeSchool.name;

    return {
      schoolName: activeSchoolDisplayName || activeSchool.name,
      letterheadTitle,
      subtitle: activePrintSubtitle || activeSchool.letterheadSubtitle || siteName,
      address: activeSchool.address,
      phone: activeSchool.phone,
      academicYear: activeSchool.academicYear,
      principalName: activeSchool.principalName,
      signatureFooter: activeSchool.signatureFooter || customFooter,
      logoUrl:
        schoolLogoUrl ||
        activeSchool.logoDataUrl ||
        globalSystemConfig?.systemLogoDataUrl ||
        DEFAULT_BRAND_LOGO_DATA_URL,
      siteName,
    };
  }, [
    activeSchool,
    activeSchoolDisplayName,
    activePrintSubtitle,
    branding,
    schoolLogoUrl,
    globalSystemConfig?.systemLogoDataUrl,
    getLabel,
  ]);

  const openPreview = useCallback((options: TriggerPrintOptions) => {
    const captured = capturePrintableDom({
      html: options.html,
      targetSelector: options.targetSelector,
    });
    const stylesheetTags = collectParentStylesheetTags();
    jobSeqRef.current += 1;

    const orientation: PrintOrientation = options.orientation ?? 'portrait';
    setChooserRequest(null);
    setActiveJob({
      id: jobSeqRef.current,
      title: options.documentLabel?.trim() || 'گزارش رسمی مدرسه',
      size: options.size,
      orientation,
      margins: getDefaultMargins(options.size, orientation),
      isCustomMargins: false,
      bodyHtml: captured.bodyHtml,
      hasEmbeddedHeader: captured.hasEmbeddedHeader,
      hasEmbeddedFooter: captured.hasEmbeddedFooter,
      includeHeader: options.includeHeader ?? true,
      includeFooter: options.includeFooter ?? true,
      stylesheetTags,
      onAfterPrint: options.onAfterPrint,
    });
  }, []);

  // Register global triggerPrint() handler so ALL Phase 1–8 modules automatically open PrintPreviewPortal
  useEffect(() => {
    registerPrintPreviewHandler((opts) => {
      openPreview(opts);
    });
    return () => {
      registerPrintPreviewHandler(null);
    };
  }, [openPreview]);

  const openSizeChooser = useCallback((request: PrintChooserRequest) => {
    setChooserRequest(request);
  }, []);

  const handleSizeChosen = useCallback(
    (size: PrintPaperSize) => {
      if (!chooserRequest) return;
      const req = chooserRequest;
      setChooserRequest(null);

      if (req.onPrint) {
        req.onPrint(size);
        return;
      }

      triggerPrint({
        size,
        orientation: req.landscape ? 'landscape' : 'portrait',
        documentLabel: req.documentLabel,
        html: req.html,
        targetSelector: req.targetSelector,
        includeHeader: req.includeHeader,
        includeFooter: req.includeFooter,
        onBeforePrint: req.onBeforePrint ? () => req.onBeforePrint?.(size) : undefined,
        onAfterPrint: req.onAfterPrint,
      });
    },
    [chooserRequest]
  );

  const closePreview = useCallback(() => {
    setActiveJob((prev) => {
      prev?.onAfterPrint?.();
      return null;
    });
  }, []);

  const closeAllPrintModals = useCallback(() => {
    setChooserRequest(null);
    closePreview();
  }, [closePreview]);

  const ctxValue = useMemo<PrintEngineContextValue>(
    () => ({
      openSizeChooser,
      openPreview,
      closeAllPrintModals,
    }),
    [openSizeChooser, openPreview, closeAllPrintModals]
  );

  return (
    <PrintEngineContext.Provider value={ctxValue}>
      {children}

      {chooserRequest && (
        <PaperSizeChooserModal
          request={chooserRequest}
          onSelectSize={handleSizeChosen}
          onClose={() => setChooserRequest(null)}
        />
      )}

      {activeJob && (
        <PrintPreviewPortal
          job={activeJob}
          school={schoolMeta}
          onChangeSize={(size) =>
            setActiveJob((prev) =>
              prev
                ? {
                    ...prev,
                    size,
                    margins: prev.isCustomMargins
                      ? prev.margins
                      : getDefaultMargins(size, prev.orientation),
                  }
                : null
            )
          }
          onChangeOrientation={(orientation) =>
            setActiveJob((prev) =>
              prev
                ? {
                    ...prev,
                    orientation,
                    margins: prev.isCustomMargins
                      ? prev.margins
                      : getDefaultMargins(prev.size, orientation),
                  }
                : null
            )
          }
          onChangeMargins={(margins, isCustom) =>
            setActiveJob((prev) =>
              prev
                ? {
                    ...prev,
                    margins: normalizeMargins(margins),
                    isCustomMargins: isCustom,
                  }
                : null
            )
          }
          onToggleHeader={() =>
            setActiveJob((prev) => (prev ? { ...prev, includeHeader: !prev.includeHeader } : null))
          }
          onToggleFooter={() =>
            setActiveJob((prev) => (prev ? { ...prev, includeFooter: !prev.includeFooter } : null))
          }
          onClose={closePreview}
        />
      )}
    </PrintEngineContext.Provider>
  );
};
