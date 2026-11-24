// Global Reliable A4 / A5 Print Engine (Hidden Iframe + Interactive Preview Portal + Sandbox Fallback)
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';

export type PrintPaperSize = 'a4' | 'a5';
export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MIN_PRINT_MARGIN_MM = 0;
export const MAX_PRINT_MARGIN_MM = 40;

export function clampMarginMm(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(MIN_PRINT_MARGIN_MM, Math.min(MAX_PRINT_MARGIN_MM, Math.round(value)));
}

export function getDefaultMargins(
  size: PrintPaperSize,
  orientation: PrintOrientation = 'portrait'
): PrintMarginsMm {
  const base =
    size === 'a5'
      ? orientation === 'landscape'
        ? 6
        : 8
      : orientation === 'landscape'
        ? 8
        : 10;
  return { top: base, right: base, bottom: base, left: base };
}

export function normalizeMargins(margins: PrintMarginsMm): PrintMarginsMm {
  return {
    top: clampMarginMm(margins.top),
    right: clampMarginMm(margins.right),
    bottom: clampMarginMm(margins.bottom),
    left: clampMarginMm(margins.left),
  };
}

export function formatCssMarginShorthand(margins: PrintMarginsMm): string {
  const m = normalizeMargins(margins);
  if (m.top === m.right && m.right === m.bottom && m.bottom === m.left) {
    return `${m.top}mm`;
  }
  return `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
}

export interface PrintSchoolMeta {
  schoolName: string;
  letterheadTitle: string;
  subtitle: string;
  address?: string;
  phone?: string;
  academicYear?: string;
  principalName?: string;
  signatureFooter?: string;
  logoUrl?: string;
  siteName?: string;
}

export interface TriggerPrintOptions {
  size: PrintPaperSize;
  orientation?: PrintOrientation;
  /** Optional Persian document title shown in preview & injected letterhead. */
  documentLabel?: string;
  /** Optional explicit HTML body to print instead of capturing the active DOM. */
  html?: string;
  /** Optional CSS selector targeting a specific printable container. */
  targetSelector?: string;
  /** Override whether the automatic school letterhead should be enabled when no embedded header exists. */
  includeHeader?: boolean;
  /** Override whether the signature footer should be enabled when no embedded footer exists. */
  includeFooter?: boolean;
  /** Optional callback executed immediately before capturing printable content. */
  onBeforePrint?: () => void;
  /** Optional callback executed when printing finishes or preview closes. */
  onAfterPrint?: () => void;
}

export interface CapturedPrintContent {
  bodyHtml: string;
  hasEmbeddedHeader: boolean;
  hasEmbeddedFooter: boolean;
}

export const DYNAMIC_PRINT_STYLE_ID = 'dynamic-print-page';
export const GLOBAL_PRINT_SHEET_ID = 'global-print-sheet';

type PrintPreviewHandler = (options: TriggerPrintOptions) => void;

let registeredPreviewHandler: PrintPreviewHandler | null = null;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

export function registerPrintPreviewHandler(handler: PrintPreviewHandler | null): void {
  registeredPreviewHandler = handler;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pure helper generating exact @page CSS rules:
 * - A4 portrait default: 10mm margin (landscape: 8mm)
 * - A5 portrait default: 8mm margin (landscape: 6mm)
 * - Supports manual 4-side margins (0..40mm) when specified.
 */
export function buildDynamicPageCss(
  size: PrintPaperSize,
  orientation: PrintOrientation = 'portrait',
  margins?: PrintMarginsMm
): string {
  const pageKeyword = size === 'a5' ? 'A5' : 'A4';
  const effectiveMargins = margins ? normalizeMargins(margins) : getDefaultMargins(size, orientation);
  const marginCss = formatCssMarginShorthand(effectiveMargins);

  return [
    `@page { size: ${pageKeyword} ${orientation}; margin: ${marginCss}; }`,
    `@page a4-landscape { size: ${pageKeyword} ${orientation}; margin: ${marginCss}; }`,
    `@page a5-portrait { size: A5 portrait; margin: ${margins ? marginCss : '8mm'}; }`,
    `@page a4-2up { size: A4 portrait; margin: ${margins ? marginCss : '8mm'}; }`,
  ].join('\n');
}

/**
 * Collects parent document stylesheets (Tailwind + Vazirmatn font links) so cloned markup
 * preserves flex/grid/spacing layouts inside the isolated print iframe.
 */
export function collectParentStylesheetTags(): string {
  if (typeof document === 'undefined') return '';
  const tags: string[] = [];

  const nodes = document.head.querySelectorAll('link[rel="stylesheet"], style');
  nodes.forEach((node) => {
    if (node.id === DYNAMIC_PRINT_STYLE_ID) return;
    if (node.tagName === 'LINK') {
      const href = (node as HTMLLinkElement).href;
      if (href) {
        tags.push(`<link rel="stylesheet" href="${escapeHtml(href)}" />`);
      }
    } else if (node.tagName === 'STYLE') {
      const cssText = node.textContent ?? '';
      if (cssText.trim().length > 0) {
        tags.push(`<style>${cssText}</style>`);
      }
    }
  });

  // Always guarantee Vazirmatn link is present even if parent loaded styles differently
  const hasVazirmatn = tags.some((t) => t.includes('Vazirmatn'));
  if (!hasVazirmatn) {
    tags.unshift(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap" />'
    );
  }

  return tags.join('\n');
}

export function buildInjectedSchoolHeaderHtml(
  school: PrintSchoolMeta,
  documentTitle?: string
): string {
  const todayDisplay = formatJalaliDisplay(getTodayJalali(), true);
  const titleText = escapeHtml(school.letterheadTitle || school.schoolName);
  const subtitleText = escapeHtml(school.subtitle || school.siteName || 'سامانه مدیریت هوشمند مدارس');
  const addressLine = [
    school.address ? `نشانی: ${escapeHtml(school.address)}` : '',
    school.phone ? `تلفن: ${escapeHtml(toPersianDigits(school.phone))}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const logoHtml = school.logoUrl
    ? `<img src="${escapeHtml(school.logoUrl)}" alt="${escapeHtml(school.schoolName)}" class="gpe-logo" />`
    : '';

  const docTitleBlock = documentTitle
    ? `<div class="gpe-doc-bar"><h2>${escapeHtml(documentTitle)}</h2><span>تاریخ چاپ: ${escapeHtml(todayDisplay)}</span></div>`
    : '';

  return `
    <header class="gpe-auto-header">
      <div class="gpe-header-top">
        <div class="gpe-brand">
          ${logoHtml}
          <div>
            <h1 class="gpe-school-title">${titleText}</h1>
            <p class="gpe-school-sub">${subtitleText}</p>
            ${addressLine ? `<p class="gpe-school-sub">${addressLine}</p>` : ''}
          </div>
        </div>
        <div class="gpe-meta">
          ${school.academicYear ? `<div>سال تحصیلی: ${escapeHtml(toPersianDigits(school.academicYear))}</div>` : ''}
          <div>تاریخ چاپ: ${escapeHtml(todayDisplay)}</div>
          ${school.principalName ? `<div>مدیر واحد: ${escapeHtml(school.principalName)}</div>` : ''}
        </div>
      </div>
      ${docTitleBlock}
    </header>
  `;
}

export function buildInjectedSchoolFooterHtml(school: PrintSchoolMeta): string {
  const principal = escapeHtml(school.principalName || 'مدیریت مدرسه');
  const footerNote = escapeHtml(
    school.signatureFooter || `مهر و امضای مدیریت ${school.schoolName}`
  );
  return `
    <footer class="gpe-auto-footer">
      <div class="gpe-sig-grid">
        <div>
          <div class="gpe-sig-title">تأیید تنظیم‌کننده / معلم</div>
          <div class="gpe-sig-line">نام و امضا</div>
        </div>
        <div>
          <div class="gpe-sig-title">تأیید معاون آموزشی / اجرایی</div>
          <div class="gpe-sig-line">نام و امضا</div>
        </div>
        <div>
          <div class="gpe-sig-title">مهر و امضای مدیر مدرسه</div>
          <div class="gpe-sig-sub">${principal}</div>
          <div class="gpe-sig-line">امضا و مهر رسمی واحد</div>
        </div>
      </div>
      <div class="gpe-footer-note">${footerNote}</div>
    </footer>
  `;
}

/**
 * Pure builder producing a 100% self-contained RTL pure-white HTML document for the
 * hidden print iframe and scaled preview sheet — completely immune to Dark / Reading Mode.
 */
export function buildStandalonePrintDocumentHtml(params: {
  size: PrintPaperSize;
  orientation: PrintOrientation;
  margins?: PrintMarginsMm;
  bodyHtml: string;
  documentTitle?: string;
  school: PrintSchoolMeta;
  includeHeader: boolean;
  includeFooter: boolean;
  hasEmbeddedHeader: boolean;
  hasEmbeddedFooter: boolean;
  stylesheetTags?: string;
}): string {
  const {
    size,
    orientation,
    margins,
    bodyHtml,
    documentTitle,
    school,
    includeHeader,
    includeFooter,
    hasEmbeddedHeader,
    hasEmbeddedFooter,
    stylesheetTags = '',
  } = params;

  const resolvedMargins = margins ? normalizeMargins(margins) : getDefaultMargins(size, orientation);
  const pageCss = buildDynamicPageCss(size, orientation, resolvedMargins);
  const isA5 = size === 'a5';
  const baseFontPt = isA5 ? '9pt' : '10.5pt';
  const baseLineHeight = isA5 ? '1.42' : '1.58';
  const pagePadCss = formatCssMarginShorthand(resolvedMargins);

  const headerHtml =
    includeHeader && !hasEmbeddedHeader
      ? buildInjectedSchoolHeaderHtml(school, documentTitle)
      : '';
  const footerHtml =
    includeFooter && !hasEmbeddedFooter ? buildInjectedSchoolFooterHtml(school) : '';

  const hideEmbeddedHeaderCss = !includeHeader
    ? '.print-letterhead, .gpe-auto-header { display: none !important; }'
    : '';
  const hideEmbeddedFooterCss = !includeFooter
    ? '.print-footer, .print-signature-grid, .gpe-auto-footer { display: none !important; }'
    : '';

  const titleTag = escapeHtml(
    documentTitle ? `${documentTitle} — ${school.schoolName}` : school.schoolName
  );

  return `<!doctype html>
<html lang="fa" dir="rtl" data-print-size="${size}" data-print-orientation="${orientation}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titleTag}</title>
    ${stylesheetTags}
    <style id="gpe-isolated-print-css">
      ${pageCss}

      *, *::before, *::after {
        box-sizing: border-box;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #111827 !important;
        color-scheme: light !important;
        direction: rtl !important;
        font-family: 'Vazirmatn', system-ui, -apple-system, Tahoma, sans-serif !important;
        font-size: ${baseFontPt} !important;
        line-height: ${baseLineHeight} !important;
        font-feature-settings: "ss01";
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .gpe-page-root {
        width: 100%;
        min-height: 100%;
        padding: ${pagePadCss};
        background: #ffffff !important;
        color: #111827 !important;
      }

      @media print {
        .gpe-page-root {
          padding: 0 !important;
        }
      }

      /* Always unhide print-only nodes and strip screen-only controls */
      .no-print {
        display: none !important;
      }

      .print-only {
        display: block !important;
      }

      /* Neutralize dark theme / card shadows / overflow clipping inside cloned content */
      .gpe-content-body,
      .gpe-content-body .bg-white,
      .gpe-content-body .bg-slate-50,
      .gpe-content-body .bg-slate-100,
      .gpe-content-body .bg-slate-900,
      .gpe-content-body .bg-slate-950,
      .gpe-content-body .print-container {
        background-color: #ffffff !important;
        box-shadow: none !important;
      }

      .gpe-content-body,
      .gpe-content-body p,
      .gpe-content-body span,
      .gpe-content-body div,
      .gpe-content-body li,
      .gpe-content-body h1,
      .gpe-content-body h2,
      .gpe-content-body h3,
      .gpe-content-body h4 {
        color: #111827 !important;
      }

      .gpe-content-body .text-slate-500,
      .gpe-content-body .text-slate-600,
      .gpe-content-body .text-slate-700 {
        color: #334155 !important;
      }

      .gpe-content-body .overflow-x-auto,
      .gpe-content-body .overflow-auto,
      .gpe-content-body .overflow-y-auto {
        overflow: visible !important;
        max-height: none !important;
      }

      /* Crisp tables & page-break protection */
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: auto;
        font-size: ${isA5 ? '8pt' : '9.5pt'} !important;
      }

      thead {
        display: table-header-group !important;
      }

      tfoot {
        display: table-footer-group !important;
      }

      tr,
      .print-card,
      .admission-card-box,
      .certificate-print-sheet,
      .print-signature-grid,
      .gpe-auto-footer {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      th, td {
        border: 1px solid #334155 !important;
        padding: ${isA5 ? '3px 5px' : '5px 7px'} !important;
        color: #111827 !important;
        word-break: break-word;
      }

      th {
        background-color: #f1f5f9 !important;
        font-weight: 700 !important;
      }

      svg {
        max-width: 100% !important;
        height: auto;
      }

      img {
        max-width: 100%;
      }

      /* Injected Official School Letterhead */
      .gpe-auto-header {
        margin-bottom: ${isA5 ? '10px' : '16px'};
        padding-bottom: ${isA5 ? '8px' : '12px'};
        border-bottom: 2px solid #0f172a;
      }

      .gpe-header-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .gpe-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .gpe-logo {
        width: ${isA5 ? '36px' : '46px'};
        height: ${isA5 ? '36px' : '46px'};
        object-fit: contain;
        flex-shrink: 0;
      }

      .gpe-school-title {
        margin: 0;
        font-size: ${isA5 ? '11pt' : '13.5pt'};
        font-weight: 800;
        color: #0f172a !important;
      }

      .gpe-school-sub {
        margin: 2px 0 0;
        font-size: ${isA5 ? '7.5pt' : '8.5pt'};
        color: #475569 !important;
      }

      .gpe-meta {
        text-align: left;
        font-size: ${isA5 ? '7.5pt' : '8.5pt'};
        color: #334155 !important;
        line-height: 1.5;
        flex-shrink: 0;
      }

      .gpe-doc-bar {
        margin-top: ${isA5 ? '6px' : '10px'};
        padding-top: ${isA5 ? '5px' : '8px'};
        border-top: 1px solid #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .gpe-doc-bar h2 {
        margin: 0;
        font-size: ${isA5 ? '9.5pt' : '11pt'};
        font-weight: 800;
        color: #0f172a !important;
      }

      .gpe-doc-bar span {
        font-size: ${isA5 ? '7.5pt' : '8.5pt'};
        color: #475569 !important;
      }

      /* Injected Official Signature Footer */
      .gpe-auto-footer {
        margin-top: ${isA5 ? '14px' : '22px'};
        padding-top: ${isA5 ? '8px' : '12px'};
        border-top: 1.5px solid #0f172a;
      }

      .gpe-sig-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: ${isA5 ? '8px' : '16px'};
        text-align: center;
        font-size: ${isA5 ? '7.5pt' : '9pt'};
      }

      .gpe-sig-title {
        font-weight: 700;
        color: #0f172a !important;
      }

      .gpe-sig-sub {
        margin-top: 2px;
        font-size: ${isA5 ? '7pt' : '8pt'};
        color: #334155 !important;
      }

      .gpe-sig-line {
        margin-top: ${isA5 ? '18px' : '28px'};
        color: #64748b !important;
        font-size: ${isA5 ? '7pt' : '8pt'};
      }

      .gpe-footer-note {
        margin-top: ${isA5 ? '8px' : '12px'};
        text-align: center;
        font-size: ${isA5 ? '7pt' : '8pt'};
        color: #475569 !important;
      }

      /* Ensure embedded PrintShell 3-column signature footer renders horizontally in both preview and print */
      .print-signature-grid {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: ${isA5 ? '8px' : '16px'} !important;
        margin-top: ${isA5 ? '12px' : '20px'} !important;
        padding-top: ${isA5 ? '8px' : '12px'} !important;
        border-top: 1.5px solid #0f172a !important;
        text-align: center !important;
      }

      .print-sig-space {
        margin-top: ${isA5 ? '16px' : '26px'} !important;
      }

      ${isA5 ? `
      .print-letterhead { margin-bottom: 8px !important; padding-bottom: 6px !important; }
      .print-letterhead-title { font-size: 10.5pt !important; }
      .print-letterhead-sub, .print-letterhead-meta { font-size: 7.5pt !important; }
      .print-signature-grid { font-size: 8pt !important; }
      ` : ''}

      ${hideEmbeddedHeaderCss}
      ${hideEmbeddedFooterCss}
    </style>
  </head>
  <body>
    <div class="gpe-page-root">
      ${headerHtml}
      <div class="gpe-content-body">
        ${bodyHtml}
      </div>
      ${footerHtml}
    </div>
  </body>
</html>`;
}

/**
 * Captures the active printable DOM subtree (open non-portal modal or <main>),
 * serializes <canvas> elements to PNG <img>, strips .no-print nodes, and detects
 * embedded official headers/footers.
 */
export function capturePrintableDom(options?: {
  html?: string;
  targetSelector?: string;
}): CapturedPrintContent {
  if (options?.html && options.html.trim().length > 0) {
    const html = options.html;
    return {
      bodyHtml: html,
      hasEmbeddedHeader:
        html.includes('print-letterhead') ||
        html.includes('certificate-print-sheet') ||
        html.includes('admission-card-box'),
      hasEmbeddedFooter:
        html.includes('print-footer') || html.includes('print-signature-grid'),
    };
  }

  if (typeof document === 'undefined') {
    return { bodyHtml: '', hasEmbeddedHeader: false, hasEmbeddedFooter: false };
  }

  let sourceEl: HTMLElement | null = null;
  let capturedFromModal = false;

  if (options?.targetSelector) {
    sourceEl = document.querySelector<HTMLElement>(options.targetSelector);
  }

  if (!sourceEl) {
    // Priority 1: Visible printable modal (e.g., Certificate preview, Exam Question sheet, Admission cards)
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]:not([data-print-portal])')
    ).filter((d) => !d.classList.contains('no-print'));
    if (dialogs.length > 0) {
      sourceEl = dialogs[dialogs.length - 1];
      capturedFromModal = true;
    }
  }

  if (!sourceEl) {
    // Priority 2: Active application <main> workspace
    sourceEl = document.querySelector<HTMLElement>('main') ?? document.body;
  }

  const clone = sourceEl.cloneNode(true) as HTMLElement;

  // Serialize live <canvas> elements (e.g. digital parent signatures) into crisp images
  const origCanvases = sourceEl.querySelectorAll('canvas');
  const clonedCanvases = clone.querySelectorAll('canvas');
  origCanvases.forEach((canvas, idx) => {
    const target = clonedCanvases[idx];
    if (!target) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'امضای دیجیتال';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      target.replaceWith(img);
    } catch {
      // Ignore tainted canvas
    }
  });

  // Remove screen-only elements & nested print portals
  clone.querySelectorAll('.no-print, [data-print-portal]').forEach((el) => el.remove());

  // Remove interactive scripts/iframes inside captured markup for safety
  clone.querySelectorAll('script, iframe').forEach((el) => el.remove());

  // Strip fixed/overlay backdrop classes if captured from a modal wrapper
  if (capturedFromModal) {
    clone.className = 'print-container';
    clone.removeAttribute('style');
  }

  const hasEmbeddedHeader = Boolean(
    clone.querySelector(
      '.print-letterhead, .certificate-print-sheet, .certificate-print-2up, .admission-card-box'
    )
  );
  const hasEmbeddedFooter = Boolean(
    clone.querySelector('.print-footer, .print-signature-grid, .certificate-print-sheet')
  );

  return {
    bodyHtml: clone.innerHTML,
    hasEmbeddedHeader,
    hasEmbeddedFooter,
  };
}

export function cleanupDynamicPrintState(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(DYNAMIC_PRINT_STYLE_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  const sheet = document.getElementById(GLOBAL_PRINT_SHEET_ID);
  if (sheet && sheet.parentNode) {
    sheet.parentNode.removeChild(sheet);
  }
  delete document.documentElement.dataset.printSize;
  delete document.documentElement.dataset.printOrientation;
  delete document.documentElement.dataset.globalPrintFallback;
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
}

export function applyDynamicPrintState(
  size: PrintPaperSize,
  orientation: PrintOrientation = 'portrait',
  margins?: PrintMarginsMm
): void {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById(DYNAMIC_PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = DYNAMIC_PRINT_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildDynamicPageCss(size, orientation, margins);
  document.documentElement.dataset.printSize = size;
  document.documentElement.dataset.printOrientation = orientation;
}

/**
 * Safe automatic fallback using an isolated #global-print-sheet root + @media print rules
 * + window.print() when a sandboxed iframe blocks iframe.contentWindow.print().
 */
export function executeWindowPrintFallback(params: {
  bodyInnerHtml: string;
  size: PrintPaperSize;
  orientation: PrintOrientation;
  margins?: PrintMarginsMm;
  onAfterPrint?: () => void;
}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    params.onAfterPrint?.();
    return;
  }

  cleanupDynamicPrintState();
  applyDynamicPrintState(params.size, params.orientation, params.margins);

  const sheet = document.createElement('div');
  sheet.id = GLOBAL_PRINT_SHEET_ID;
  sheet.setAttribute('dir', 'rtl');
  sheet.setAttribute('lang', 'fa');
  sheet.innerHTML = params.bodyInnerHtml;
  document.body.appendChild(sheet);
  document.documentElement.dataset.globalPrintFallback = 'true';

  let cleaned = false;
  const finish = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupDynamicPrintState();
    params.onAfterPrint?.();
  };

  window.addEventListener('afterprint', finish, { once: true });
  cleanupTimer = setTimeout(() => {
    window.removeEventListener('afterprint', finish);
    finish();
  }, 15000);

  setTimeout(() => {
    try {
      window.print();
    } catch {
      finish();
    }
  }, 50);
}

/**
 * Primary print entry point used by all modules (Phases 1–8).
 * Routes cleanly into the registered PrintPreviewPortal; falls back to direct
 * isolated window.print() only if called outside a mounted PrintProvider.
 */
export function triggerPrint(options: TriggerPrintOptions): void {
  const { size, orientation = 'portrait', onBeforePrint, onAfterPrint } = options;

  if (onBeforePrint) {
    onBeforePrint();
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    onAfterPrint?.();
    return;
  }

  const dispatch = () => {
    if (registeredPreviewHandler) {
      registeredPreviewHandler({ ...options, onBeforePrint: undefined });
      return;
    }

    // Legacy safety fallback if no PrintProvider is mounted
    applyDynamicPrintState(size, orientation);
    let cleaned = false;
    const handleAfterPrint = () => {
      if (cleaned) return;
      cleaned = true;
      cleanupDynamicPrintState();
      onAfterPrint?.();
    };
    window.addEventListener('afterprint', handleAfterPrint, { once: true });
    cleanupTimer = setTimeout(() => {
      window.removeEventListener('afterprint', handleAfterPrint);
      handleAfterPrint();
    }, 15000);
    window.print();
  };

  if (onBeforePrint) {
    setTimeout(dispatch, 60);
  } else {
    dispatch();
  }
}
