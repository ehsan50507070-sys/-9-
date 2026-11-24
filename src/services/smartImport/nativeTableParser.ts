// Step 3-C: 100% Native TypeScript Table Parser (CSV, TSV, SIDA HTML-Table .xls/.html, Excel Paste)
// Zero external dependencies (no xlsx / no papaparse). Safe DOMParser extraction without DOM injection.
import { toAsciiDigits } from '../../lib/digits';
import {
  normalizeIranianMobile,
  normalizeIranianNationalId,
  normalizeJalaliDateInput,
  normalizePersianText,
  toNormalizedHeaderKey,
} from './iranianValidators';
import type {
  HeaderRowCandidate,
  ParsedSourceFormat,
  ParsedTableResult,
  SmartImportTargetType,
} from './types';

const KNOWN_HEADER_KEYWORDS: readonly string[] = [
  'کدملی',
  'شمارهملی',
  'شنا سهملی',
  'شناسه',
  'کددانشاموز',
  'کدسیدا',
  'نامونامخانوادگی',
  'نامکامل',
  'نامخانوادگی',
  'نام',
  'شهرت',
  'نامپدر',
  'نامولی',
  'ولی',
  'موبایل',
  'تلفنهمراه',
  'شمارهتماس',
  'شمارهموبایل',
  'پایه',
  'مقطع',
  'کلاس',
  'شعبه',
  'تاریختولد',
  'تولد',
  'نمره',
  'نمرهمستمر',
  'نمرهپایانی',
  'مستمر',
  'پایانی',
  'درس',
  'عنواندرس',
  'نوبت',
  'ماه',
  'کدپرسنلی',
  'پرسنلی',
  'تخصص',
  'رشته',
  'ساعاتموظف',
  'ظرفیت',
  'اتاق',
  'کداتاق',
  'ردیف',
  'وضعیت',
  'nationalid',
  'fullname',
  'firstname',
  'lastname',
  'mobile',
  'phone',
  'class',
  'grade',
  'score',
].map(toNormalizedHeaderKey);

export function stripUtf8Bom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

/**
 * Detects whether content is an HTML-Table export (standard SIDA `.xls` / `.html` output).
 */
export function isHtmlTableContent(rawText: string, fileName = ''): boolean {
  const sample = rawText.slice(0, 4096).toLowerCase();
  const hasHtmlTags =
    sample.includes('<table') ||
    sample.includes('<tr') ||
    sample.includes('<!doctype html') ||
    sample.includes('<html') ||
    (sample.includes('<td') && sample.includes('</td>'));
  if (hasHtmlTags) return true;
  const lowerName = fileName.toLowerCase();
  return (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) && sample.includes('<');
}

/**
 * Auto-detects delimiter (comma, semicolon, or tab) across the first 15 non-empty lines outside quotes.
 */
export function detectDelimiter(rawText: string): ',' | ';' | '\t' {
  const clean = stripUtf8Bom(rawText);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 15);

  if (lines.length === 0) return ',';

  const delimiters: Array<',' | ';' | '\t'> = ['\t', ';', ','];
  let bestDelim: ',' | ';' | '\t' = ',';
  let bestScore = -1;

  for (const delim of delimiters) {
    const counts: number[] = [];
    for (const line of lines) {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delim && !inQuotes) {
          count++;
        }
      }
      counts.push(count);
    }

    const nonZeroCounts = counts.filter((c) => c > 0);
    if (nonZeroCounts.length === 0) continue;

    // Reward high frequency of multi-column rows and consistent column counts
    const modeMap = new Map<number, number>();
    for (const c of nonZeroCounts) {
      modeMap.set(c, (modeMap.get(c) ?? 0) + 1);
    }
    let maxFreq = 0;
    let modeVal = 0;
    for (const [val, freq] of modeMap.entries()) {
      if (freq > maxFreq || (freq === maxFreq && val > modeVal)) {
        maxFreq = freq;
        modeVal = val;
      }
    }

    // Tabs from Excel paste get slight priority if consistent
    const bonus = delim === '\t' ? 1.15 : 1;
    const score = (maxFreq * 10 + Math.min(modeVal, 20) * 2 + nonZeroCounts.length) * bonus;
    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/**
 * RFC-4180 compliant native CSV/TSV parser supporting quoted fields, escaped quotes, embedded newlines & UTF-8 BOM.
 */
export function parseDelimitedText(
  rawText: string,
  forcedDelimiter?: ',' | ';' | '\t'
): { rows: string[][]; delimiter: ',' | ';' | '\t' } {
  const clean = stripUtf8Bom(rawText);
  const delimiter = forcedDelimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(normalizePersianText(currentCell));
      currentCell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && clean[i + 1] === '\n') {
        i++;
      }
      currentRow.push(normalizePersianText(currentCell));
      currentCell = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(normalizePersianText(currentCell));
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { rows: normalizeRectangularMatrix(rows), delimiter };
}

/**
 * Extracts `<table><tr><th>/<td>` from SIDA `.xls`/`.html` exports safely via native browser DOMParser.
 * Never injects HTML into live document DOM. Includes a safe pure-TS fallback for Node test runtimes.
 */
export function parseSidaHtmlTable(rawHtml: string): string[][] {
  const clean = stripUtf8Bom(rawHtml);

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));

    // Pick the table with the richest cell count (SIDA sometimes wraps layout tables around the data table)
    let bestRows: string[][] = [];
    let bestWeight = -1;

    const extractFromTable = (tableEl: Element): string[][] => {
      const extracted: string[][] = [];
      const trs = Array.from(tableEl.querySelectorAll('tr'));
      for (const tr of trs) {
        // Skip rows belonging to nested child tables so we don't duplicate
        if (tr.closest('table') !== tableEl) continue;
        const cells = Array.from(tr.children).filter(
          (el) => el.tagName === 'TD' || el.tagName === 'TH'
        );
        const rowVals: string[] = [];
        for (const cell of cells) {
          const text = normalizePersianText((cell.textContent ?? '').replace(/\s+/g, ' '));
          rowVals.push(text);
          const colSpan = Number(cell.getAttribute('colspan') ?? '1');
          if (Number.isFinite(colSpan) && colSpan > 1 && colSpan <= 20) {
            for (let k = 1; k < colSpan; k++) {
              rowVals.push('');
            }
          }
        }
        if (rowVals.some((v) => v.length > 0)) {
          extracted.push(rowVals);
        }
      }
      return extracted;
    };

    if (tables.length > 0) {
      for (const table of tables) {
        const rows = extractFromTable(table);
        const totalNonEmpty = rows.reduce(
          (acc, r) => acc + r.filter((c) => c.length > 0).length,
          0
        );
        if (totalNonEmpty > bestWeight) {
          bestWeight = totalNonEmpty;
          bestRows = rows;
        }
      }
    } else {
      // Fragment with bare <tr><td>
      const trs = Array.from(doc.querySelectorAll('tr'));
      bestRows = trs
        .map((tr) =>
          Array.from(tr.querySelectorAll('th,td')).map((c) =>
            normalizePersianText((c.textContent ?? '').replace(/\s+/g, ' '))
          )
        )
        .filter((r) => r.some((v) => v.length > 0));
    }

    return normalizeRectangularMatrix(bestRows);
  }

  // Fallback for Node unit test environment (DOMParser unavailable)
  const rows: string[][] = [];
  const trMatches = clean.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trMatches) {
    const cellMatches = tr.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
    const rowVals = cellMatches.map((cellHtml) => {
      const stripped = cellHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"');
      return normalizePersianText(stripped);
    });
    if (rowVals.some((v) => v.length > 0)) {
      rows.push(rowVals);
    }
  }
  return normalizeRectangularMatrix(rows);
}

function normalizeRectangularMatrix(rows: string[][]): string[][] {
  if (rows.length === 0) return [];
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return rows.map((r) => {
    if (r.length === maxCols) return r;
    return [...r, ...Array<string>(maxCols - r.length).fill('')];
  });
}

function cellLooksLikeDataValue(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (normalizeIranianNationalId(trimmed).valid) return true;
  if (normalizeIranianMobile(trimmed).valid) return true;
  if (normalizeJalaliDateInput(trimmed).valid) return true;
  const ascii = toAsciiDigits(trimmed);
  // Purely numeric values (e.g. row index, score, student code)
  if (/^\d+([.,]\d+)?$/.test(ascii)) return true;
  return false;
}

/**
 * Header Row Auto-Detector:
 * Scans the first 10 rows and scores each candidate row using:
 * 1. Count & ratio of non-empty textual cells (filters out 1-cell SIDA Ministry/School title banners)
 * 2. Dictionary keyword hits against Persian/SIDA header vocabulary
 * 3. Penalty if cells look like concrete data (National IDs, mobile phones, Jalali dates, numeric scores)
 * 4. Bonus if the row immediately below has concrete data cells
 */
export function detectHeaderRowIndex(
  rows: string[][],
  _targetType?: SmartImportTargetType
): { detectedHeaderRowIndex: number; candidates: HeaderRowCandidate[] } {
  const scanLimit = Math.min(rows.length, 10);
  if (scanLimit === 0) {
    return { detectedHeaderRowIndex: 0, candidates: [] };
  }

  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  const candidates: HeaderRowCandidate[] = [];

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    const nonEmptyCells = row.filter((c) => c.trim().length > 0);
    const nonEmptyCount = nonEmptyCells.length;

    let dictionaryHits = 0;
    let dataLikeCount = 0;
    let shortTextLabelCount = 0;

    for (const cell of nonEmptyCells) {
      const normKey = toNormalizedHeaderKey(cell);
      if (cellLooksLikeDataValue(cell)) {
        dataLikeCount++;
        continue;
      }

      const matchedDict = KNOWN_HEADER_KEYWORDS.some(
        (kw) => kw.length >= 2 && (normKey === kw || normKey.includes(kw))
      );
      if (matchedDict) {
        dictionaryHits++;
      }
      if (cell.length <= 36) {
        shortTextLabelCount++;
      }
    }

    // Check whether the next row looks like data
    let nextRowDataBonus = 0;
    if (i + 1 < rows.length) {
      const nextCells = rows[i + 1].filter((c) => c.trim().length > 0);
      const nextDataHits = nextCells.filter(cellLooksLikeDataValue).length;
      if (nextCells.length >= 2 && nextDataHits >= 1) {
        nextRowDataBonus = 8;
      }
    }

    // Single-cell banner rows (e.g. «وزارت آموزش و پرورش...» or «گزارش ثبت نام سیدا») get heavily penalized
    const singleCellPenalty = nonEmptyCount <= 1 && maxCols >= 3 ? -35 : 0;
    // Two-cell metadata rows like «تاریخ گزارش: | ۱۴۰۴/۰۷/۰۱» get penalized
    const sparseBannerPenalty =
      nonEmptyCount <= 2 && maxCols >= 4 && dictionaryHits <= 1 ? -18 : 0;

    const looksLikeData = nonEmptyCount > 0 && dataLikeCount / nonEmptyCount >= 0.45;
    const dataPenalty = looksLikeData ? -30 : -(dataLikeCount * 8);

    const densityScore = Math.min(nonEmptyCount, 12) * 3;
    const dictScore = dictionaryHits * 16;
    const labelScore = shortTextLabelCount * 2;
    const score =
      densityScore +
      dictScore +
      labelScore +
      nextRowDataBonus +
      singleCellPenalty +
      sparseBannerPenalty +
      dataPenalty;

    const previewText = nonEmptyCells.slice(0, 4).join(' | ');

    candidates.push({
      rowIndex: i,
      score,
      nonEmptyCount,
      dictionaryHits,
      looksLikeData,
      previewText: previewText || '(ردیف خالی)',
    });
  }

  let bestIdx = 0;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (c.score > bestScore) {
      bestScore = c.score;
      bestIdx = c.rowIndex;
    }
  }

  return { detectedHeaderRowIndex: bestIdx, candidates };
}

/**
 * Main unified parser entry point for uploaded files or pasted Excel text.
 */
export function parseSmartImportSource(
  rawText: string,
  fileName: string,
  targetType: SmartImportTargetType,
  sourceHint: 'file' | 'paste' = 'file'
): ParsedTableResult {
  let rows: string[][] = [];
  let sourceFormat: ParsedSourceFormat = 'csv';
  let delimiter: ',' | ';' | '\t' | 'html' = ',';

  if (isHtmlTableContent(rawText, fileName)) {
    rows = parseSidaHtmlTable(rawText);
    sourceFormat = 'html_sida';
    delimiter = 'html';
  } else {
    const parsed = parseDelimitedText(rawText);
    rows = parsed.rows;
    delimiter = parsed.delimiter;
    sourceFormat =
      sourceHint === 'paste' ? 'paste' : delimiter === '\t' ? 'tsv' : 'csv';
  }

  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const { detectedHeaderRowIndex, candidates } = detectHeaderRowIndex(rows, targetType);

  return {
    rows,
    sourceFormat,
    delimiter,
    fileName,
    totalRows: rows.length,
    columnCount,
    detectedHeaderRowIndex,
    headerCandidates: candidates,
  };
}

/**
 * Generates an authentic, messy SIDA export sample (3 extra banner header rows,
 * unconventional Persian column names, valid + 8/9-digit leading-zero + invalid checksum
 * + identical-digit National IDs, mobile numbers without leading 0 and with +98, Persian digits)
 * plus a companion secondary file so users can test all 5 steps immediately.
 */
export function generateSampleIrregularSidaSource(targetType: SmartImportTargetType): {
  fileName: string;
  content: string;
  secondaryFileName: string;
  secondaryContent: string;
} {
  if (targetType === 'teachers') {
    const content = [
      'وزارت آموزش و پرورش - اداره کل آموزش و پرورش استان',
      'گزارش فهرست کادر آموزشی و دبیران - خروجی سامانه سیدا',
      'تاریخ تهیه گزارش: ۱۴۰۴/۰۸/۱۲ ; سال تحصیلی: ۱۴۰۴-۱۴۰۵',
      'ردیف;شماره ملی همکار;نام و نام‌خانوادگی کامل;کد پرسنلی;تلفن همراه;رشته تدریسی;ساعات موظف',
      '۱;0013520849;فاطمه زهرا محمدی;482101;9123456781;ریاضی و حسابان;۲۴',
      '۲;13520849;امیر علی رضایی پور;482102;+989124455667;علوم تجربی;۲۰',
      '۳;0078912340;سارا احمدی;482103;09128887766;ادبیات فارسی;۱۸',
      '۴;1111111111;مهدی کریمی;482104;09121112233;ورزش;۱۶',
      '۵;0054321987;نرگس موسوی;482105;0912999;قرآن و معارف;۱۲',
    ].join('\n');

    const secondaryContent = [
      'کد ملی;تلفن همراه اصلاحی;تخصص تکمیلی',
      '0013520849;09123456781;ریاضی پیشرفته و المپیاد',
      '0013520849;09123456781;ریاضی',
      '0054321987;09129998877;قرآن و هدیه‌های آسمان',
    ].join('\n');

    return {
      fileName: 'sida-irregular-teachers-sample.csv',
      content,
      secondaryFileName: 'sida-teachers-contact-supplement.csv',
      secondaryContent,
    };
  }

  if (targetType === 'classes') {
    const content = [
      'سامانه یکپارچه دانش‌آموزی (سیدا)',
      'گزارش کلاس‌بندی و سازماندهی کلاس‌ها',
      'واحد آموزشی گلستان راه روشن - ۱۴۰۴/۰۸/۱۲',
      'ردیف,عنوان کلاس,پایه تحصیلی,شعبه,کد اتاق,ظرفیت کلاس',
      '۱,پایه سوم - کلاس ج,سوم,ج,303,۲۸',
      '۲,پایه پنجم - کلاس ب,پنجم,ب,502,۳۰',
      '۳,پایه ششم - کلاس ج,ششم,ج,603,۲۶',
      '۴,,چهارم,د,404,۷۵',
    ].join('\n');

    return {
      fileName: 'sida-irregular-classes-sample.csv',
      content,
      secondaryFileName: 'sida-classes-supplement.csv',
      secondaryContent: 'کد ملی,کلاس\n0013520849,پایه سوم - کلاس ج',
    };
  }

  if (targetType === 'sida_grades') {
    const content = [
      '<table>',
      '<tr><td colspan="7">وزارت آموزش و پرورش — خروجی ریزنمرات سامانه سیدا</td></tr>',
      '<tr><td colspan="7">مجتمع آموزشی گلستان راه روشن — نوبت اول</td></tr>',
      '<tr><td colspan="7">تاریخ گزارش: ۱۴۰۴/۱۰/۲۲</td></tr>',
      '<tr><th>ردیف</th><th>شناسه ملی دانش‌آموز</th><th>نام و نام خانوادگی</th><th>کلاس</th><th>عنوان درس</th><th>نمره مستمر</th><th>نمره پایانی</th></tr>',
      '<tr><td>۱</td><td>۰۰۱۳۵۲۰۸۴۹</td><td>محمدطاها رستگار</td><td>پایه چهارم - کلاس الف</td><td>ریاضی</td><td>۱۸.۵</td><td>۱۹.۲۵</td></tr>',
      '<tr><td>۲</td><td>13520849</td><td>امیر علی حسینی</td><td>پایه چهارم - کلاس الف</td><td>علوم تجربی</td><td>۱۷</td><td>۱۸.۵</td></tr>',
      '<tr><td>۳</td><td>0067891234</td><td>پارسیا نجفی</td><td>پایه پنجم - کلاس الف</td><td>فارسی</td><td>۲۲</td><td>۱۶</td></tr>',
      '<tr><td>۴</td><td>1111111111</td><td>آرمین جلالی</td><td>پایه پنجم - کلاس الف</td><td>ریاضی</td><td>۱۵</td><td>۱۴</td></tr>',
      '</table>',
    ].join('\n');

    const secondaryContent = [
      'کد ملی;نمره پایانی;ماه',
      '0013520849;19.5;دی',
    ].join('\n');

    return {
      fileName: 'sida-irregular-grades-export.xls',
      content,
      secondaryFileName: 'sida-grades-extra.csv',
      secondaryContent,
    };
  }

  // Default: students (HTML-Table SIDA export with 3 banner rows + irregular columns + mixed valid/fixable/quarantine rows)
  // Valid check-digit Iranian National IDs generated deterministically:
  // 0013520849 -> check: 0*10+0*9+1*8+3*7+5*6+2*5+0*4+8*3+4*2 = 0+0+8+21+30+10+0+24+8 = 101 -> 101%11=2 -> 11-2=9 (VALID!)
  // 0024681351 -> 0+0+16+28+36+40+4+9+10 = 143 -> 143%11=0 -> check 0 -> let's compute exact valid ones:
  // 008456123 -> 0+0+64+28+30+30+4+6+6=168 -> 168%11=3 -> check=8 => 0084561238 (VALID!)
  // 045123456 -> 0+36+40+7+12+15+16+15+12=153 -> 153%11=10 -> check=1 => 0451234561 (VALID!)
  // 006123456 -> 0+0+48+7+12+15+16+15+12=125 -> 125%11=4 -> check=7 => 0061234567 (VALID!)
  // 127089451 -> 10+18+56+0+48+45+16+15+2=210 -> 210%11=1 -> check=1 => 1270894511 (VALID!)
  // 001234567 -> 0+0+8+14+18+20+20+18+14=112 -> 112%11=2 -> check=9 => 0012345679 (VALID! Without leading 00: 12345679 -> 8 digits, auto-pads to 0012345679!)
  const content = [
    '<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"></head><body>',
    '<table>',
    '  <tr><td colspan="8">وزارت آموزش و پرورش — سامانه یکپارچه دانش‌آموزی (سیدا)</td></tr>',
    '  <tr><td colspan="8">گزارش جامع ثبت‌نام دانش‌آموزان — مدرسه گلستان راه روشن</td></tr>',
    '  <tr><td colspan="8">تاریخ استخراج: ۱۴۰۴/۰۷/۱۸ — سال تحصیلی ۱۴۰۴-۱۴۰۵</td></tr>',
    '  <tr>',
    '    <th>ردیف</th>',
    '    <th>شماره ملی دانش‌آموز</th>',
    '    <th>نام و نام‌خانوادگی کامل</th>',
    '    <th>نام پدر / ولی</th>',
    '    <th>موبایل پدر</th>',
    '    <th>شعبه کلاس</th>',
    '    <th>تاریخ تولد</th>',
    '    <th>کد سیدا</th>',
    '  </tr>',
    '  <tr><td>۱</td><td>۰۰۱۳۵۲۰۸۴۹</td><td>محمدطاها رستگار</td><td>علی رستگار</td><td>9123456789</td><td>پایه چهارم - کلاس الف</td><td>۱۳۹۵/۰۴/۱۸</td><td>SIDA-4041</td></tr>',
    '  <tr><td>۲</td><td>12345679</td><td>امیر علی رضایی پور</td><td>حسین رضایی پور</td><td>+989127654321</td><td>پایه سوم - کلاس ب</td><td>1396/02/09</td><td>SIDA-4042</td></tr>',
    '  <tr><td>۳</td><td>۰۰۸۴۵۶۱۲۳۸</td><td>سیده زهرا موسوی</td><td>رضا موسوی</td><td>۰۹۳۵۱۲۳۴۵۶۷</td><td>پایه پنجم - کلاس ج</td><td>۱۳۹۴/۱۱/۲۵</td><td>SIDA-4043</td></tr>',
    '  <tr><td>۴</td><td>0451234561</td><td>کیان فرهادی</td><td>فرهاد فرهادی</td><td>0912888</td><td>پایه ششم - کلاس الف</td><td>۱۳۹۳/۰۸/۱۰</td><td>SIDA-4044</td></tr>',
    '  <tr><td>۵</td><td>0061234567</td><td>آرش کامرانی</td><td></td><td>00989191112233</td><td>پایه دوم - کلاس الف</td><td>۱۳۹۷/۰۶/۰۱</td><td>SIDA-4045</td></tr>',
    '  <tr><td>۶</td><td>1111111111</td><td>رضا خطادار (ارقام یکسان)</td><td>محمود خطادار</td><td>09121112233</td><td>پایه چهارم - کلاس الف</td><td>۱۳۹۵/۰۱/۱۰</td><td>SIDA-4046</td></tr>',
    '  <tr><td>۷</td><td>1270894519</td><td>پویا شریفی (رقم کنترل غلط)</td><td>ناصر شریفی</td><td>09125554433</td><td>پایه پنجم - کلاس الف</td><td>۱۳۹۴/۰۳/۱۵</td><td>SIDA-4047</td></tr>',
    '  <tr><td>۸</td><td>۰۰۱۳۵۲۰۸۴۹</td><td>محمدطاها رستگار (تکراری در فایل)</td><td>علی رستگار</td><td>09123456789</td><td>پایه چهارم - کلاس الف</td><td>۱۳۹۵/۰۴/۱۸</td><td>SIDA-4048</td></tr>',
    '</table></body></html>',
  ].join('\n');

  const secondaryContent = [
    'کد ملی,نام ولی تکمیلی,موبایل ولی اصلاحی,یادداشت اضطراری',
    '0061234567,کامران کامرانی,09191112233,آلرژی فصلی خفیف',
    '0451234561,فرهاد فرهادی,09128887766,سرویس مدرسه مسیر غرب',
    '0013520849,علی رستگار,09123456789,عضو تیم رباتیک مدرسه',
  ].join('\n');

  return {
    fileName: 'sida-irregular-students-export.xls',
    content,
    secondaryFileName: 'parent-contacts-join-sample.csv',
    secondaryContent,
  };
}
