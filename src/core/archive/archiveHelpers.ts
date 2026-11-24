// Step 3: Smart Content & Video Archive Helpers (Categorized Filtering, Auto-Capture & Printable Catalog)
import { toPersianDigits } from '../../lib/digits';
import type {
  SmartArchiveContentType,
  SmartContentArchiveItem,
} from '../../types/domain';
import { escapeHtml } from '../security/sanitize';
import { normalizeFaSearch } from '../subjects/subjectHelpers';

export interface ArchiveFilterCriteria {
  query: string;
  academicYearId: string; // 'all' or specific year
  gradeLevel: string; // 'all' or numeric string
  subject: string; // 'all' or subject
  teacherName: string; // 'all' or teacher name
  contentType: 'all' | SmartArchiveContentType;
  tag: string; // 'all' or tag
}

export const CONTENT_TYPE_META: Record<
  SmartArchiveContentType,
  { labelFa: string; badgeClass: string }
> = {
  video: {
    labelFa: 'ویدیوی آموزشی',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  },
  handout: {
    labelFa: 'جزوه و محتوا',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  question: {
    labelFa: 'سوال و نمونه آزمون',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
};

export function filterSmartArchiveItems(
  items: SmartContentArchiveItem[],
  criteria: ArchiveFilterCriteria
): SmartContentArchiveItem[] {
  const normQ = normalizeFaSearch(criteria.query);
  return items
    .filter((item) => {
      if (criteria.academicYearId !== 'all' && item.academicYearId !== criteria.academicYearId) {
        return false;
      }
      if (criteria.gradeLevel !== 'all' && String(item.gradeLevel) !== criteria.gradeLevel) {
        return false;
      }
      if (criteria.subject !== 'all' && item.subject !== criteria.subject) {
        return false;
      }
      if (criteria.teacherName !== 'all' && item.teacherName !== criteria.teacherName) {
        return false;
      }
      if (criteria.contentType !== 'all' && item.contentType !== criteria.contentType) {
        return false;
      }
      if (criteria.tag !== 'all' && !item.tags.includes(criteria.tag)) {
        return false;
      }
      if (!normQ) return true;
      return (
        normalizeFaSearch(item.title).includes(normQ) ||
        normalizeFaSearch(item.description).includes(normQ) ||
        normalizeFaSearch(item.subject).includes(normQ) ||
        normalizeFaSearch(item.teacherName).includes(normQ) ||
        item.tags.some((t) => normalizeFaSearch(t).includes(normQ))
      );
    })
    .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
}

export function buildArchiveCatalogPrintHtml(params: {
  schoolName: string;
  jalaliDate: string;
  items: SmartContentArchiveItem[];
}): string {
  const rows = params.items
    .map(
      (item, idx) => `
      <tr>
        <td style="text-align:center;">${toPersianDigits(idx + 1)}</td>
        <td><strong>${escapeHtml(item.title)}</strong><br/><span style="color:#64748b;font-size:10px;">${escapeHtml(item.description.slice(0, 100))}</span></td>
        <td style="text-align:center;">${CONTENT_TYPE_META[item.contentType].labelFa}</td>
        <td style="text-align:center;">${escapeHtml(item.subject)}</td>
        <td style="text-align:center;">${escapeHtml(toPersianDigits(item.gradeLabel))}</td>
        <td>${escapeHtml(item.teacherName)}</td>
        <td style="text-align:center;">${escapeHtml(toPersianDigits(item.academicYearId))}</td>
        <td style="text-align:center;">${toPersianDigits(item.reuseCount)} بار</td>
      </tr>
    `
    )
    .join('');

  return `
    <div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;">
      <h2 style="margin:0 0 6px;font-size:16px;">فهرست آرشیو هوشمند محتوا و ویدیوهای آموزشی — ${escapeHtml(params.schoolName)}</h2>
      <p style="margin:0 0 12px;font-size:12px;color:#475569;">
        تاریخ چاپ: ${escapeHtml(toPersianDigits(params.jalaliDate))} | تعداد اقلام: ${toPersianDigits(params.items.length)} مورد
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:6px;">ردیف</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">عنوان محتوا</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">نوع</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">درس</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">پایه</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">معلم / ثبت‌کننده</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">سال تحصیلی</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">بازاستفاده</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
