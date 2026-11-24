// Unit Tests for Global Print Engine (A4/A5 @page rules, Pure-White RTL HTML Builder & Header Injection)
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDynamicPageCss,
  buildStandalonePrintDocumentHtml,
  type PrintSchoolMeta,
} from './printService';

const SAMPLE_SCHOOL: PrintSchoolMeta = {
  schoolName: 'دبستان هوشمند شماره ۱',
  letterheadTitle: 'دبستان هوشمند شماره ۱ — واحد الف',
  subtitle: 'سامانه مدیریت هوشمند مدارس',
  address: 'تهران، خیابان آزادی',
  phone: '021-88001122',
  academicYear: '1405-1406',
  principalName: 'دکتر محمدرضا کریمی',
  signatureFooter: 'مهر و امضای مدیریت دبستان هوشمند شماره ۱',
  logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
};

test('buildDynamicPageCss emits exact A4 (10mm) and A5 (8mm) portrait rules', () => {
  const a4Css = buildDynamicPageCss('a4', 'portrait');
  assert.match(a4Css, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*10mm;\s*\}/);

  const a5Css = buildDynamicPageCss('a5', 'portrait');
  assert.match(a5Css, /@page\s*\{\s*size:\s*A5 portrait;\s*margin:\s*8mm;\s*\}/);

  const a4Landscape = buildDynamicPageCss('a4', 'landscape');
  assert.match(a4Landscape, /@page\s*\{\s*size:\s*A4 landscape;\s*margin:\s*8mm;\s*\}/);
});

test('buildStandalonePrintDocumentHtml enforces RTL, Vazirmatn, pure-white paper, and injects school header/footer cleanly', () => {
  const html = buildStandalonePrintDocumentHtml({
    size: 'a4',
    orientation: 'portrait',
    bodyHtml: '<table><tr><td>ردیف ۱</td></tr></table>',
    documentTitle: 'گزارش حضور و غیاب',
    school: SAMPLE_SCHOOL,
    includeHeader: true,
    includeFooter: true,
    hasEmbeddedHeader: false,
    hasEmbeddedFooter: false,
  });

  assert.match(html, /<html lang="fa" dir="rtl" data-print-size="a4"/);
  assert.ok(html.includes('Vazirmatn'));
  assert.ok(html.includes('background: #ffffff !important'));
  assert.ok(html.includes('color: #111827 !important'));
  assert.ok(html.includes('page-break-inside: avoid !important'));
  assert.ok(html.includes('gpe-auto-header'));
  assert.ok(html.includes('gpe-auto-footer'));
  assert.ok(html.includes(SAMPLE_SCHOOL.letterheadTitle));
  assert.ok(html.includes('گزارش حضور و غیاب'));
  assert.ok(html.includes('data:image/png;base64,iVBORw0KGgo='));
});

test('buildStandalonePrintDocumentHtml avoids duplicating embedded headers and respects header/footer toggles', () => {
  const withEmbedded = buildStandalonePrintDocumentHtml({
    size: 'a5',
    orientation: 'portrait',
    bodyHtml: '<header class="print-letterhead">سربرگ داخلی</header><p>محتوا</p>',
    documentTitle: 'رسید شهریه',
    school: SAMPLE_SCHOOL,
    includeHeader: true,
    includeFooter: false,
    hasEmbeddedHeader: true,
    hasEmbeddedFooter: false,
  });

  assert.ok(!withEmbedded.includes('<header class="gpe-auto-header">'));
  assert.ok(!withEmbedded.includes('<footer class="gpe-auto-footer">'));
  assert.match(withEmbedded, /@page\s*\{\s*size:\s*A5 portrait;\s*margin:\s*8mm;\s*\}/);
  assert.ok(withEmbedded.includes('.print-footer, .print-signature-grid, .gpe-auto-footer { display: none !important; }'));
});

test('custom 4-side manual margins clamp safely (0..40mm) and propagate to @page and preview sheet padding', () => {
  const customCss = buildDynamicPageCss('a4', 'portrait', {
    top: 25,
    right: 20,
    bottom: -5,
    left: 60,
  });
  assert.match(customCss, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*25mm 20mm 0mm 40mm;\s*\}/);

  const html = buildStandalonePrintDocumentHtml({
    size: 'a4',
    orientation: 'portrait',
    margins: { top: 25, right: 10, bottom: 12, left: 10 },
    bodyHtml: '<p>محتوای سربرگ‌دار</p>',
    documentTitle: 'نامه رسمی',
    school: SAMPLE_SCHOOL,
    includeHeader: true,
    includeFooter: true,
    hasEmbeddedHeader: false,
    hasEmbeddedFooter: false,
  });

  assert.ok(html.includes('@page { size: A4 portrait; margin: 25mm 10mm 12mm 10mm; }'));
  assert.ok(html.includes('padding: 25mm 10mm 12mm 10mm;'));
});
