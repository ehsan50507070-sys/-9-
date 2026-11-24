// Single-column mobile-safe Persian message formatter for Eitaa («ایتا»), Bale («بله») & Shad («شاد»)
import { toPersianDigits } from './digits';

export interface SingleColumnSection {
  heading?: string;
  lines: string[];
}

/**
 * Formats structured Persian reports into strictly single-column mobile-safe plain text
 * (no ASCII tables, no multi-column tabs) optimized for Eitaa, Bale, and Shad.
 */
export function formatSingleColumnMessengerReport(params: {
  schoolName: string;
  reportTitle: string;
  jalaliDateDisplay: string;
  sections: SingleColumnSection[];
  footerNote?: string;
}): string {
  const out: string[] = [];
  out.push(`📌 ${params.schoolName}`);
  out.push(`📝 ${params.reportTitle}`);
  out.push(`📅 تاریخ: ${toPersianDigits(params.jalaliDateDisplay)}`);
  out.push('────────────────');

  for (const section of params.sections) {
    if (section.heading) {
      out.push(`▪️ ${toPersianDigits(section.heading)}`);
    }
    for (const line of section.lines) {
      out.push(toPersianDigits(line));
    }
    out.push('');
  }

  if (params.footerNote) {
    out.push('────────────────');
    out.push(toPersianDigits(params.footerNote));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
