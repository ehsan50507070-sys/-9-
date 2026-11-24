// Pure Multi-Academic-Year Lifecycle Engine (Phase 9A + 9B — Normalized Relational DTOs)
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type { AcademicYear, AcademicYearStatus } from '../../types/domain';
import { DEFAULT_COMPLEX_ID, GLOBAL_TENANT_ID } from '../super-admin/superAdminHelpers';

export const ARCHIVED_ACADEMIC_YEAR_ID = 'ay-1403-1404';
export const DEFAULT_ACTIVE_ACADEMIC_YEAR_ID = 'ay-1404-1405';

export function buildAcademicYearTitle(code: string): string {
  return `سال تحصیلی ${toPersianDigits(code)}`;
}

/**
 * Normalizes any legacy Phase 9A AcademicYear record so all Phase 9B fields
 * (`code`, `title`, `startDateJalali`, `endDateJalali`, `status`, `isDefault`) are always populated.
 */
export function normalizeAcademicYear(yr: Partial<AcademicYear> & { id: string }): AcademicYear {
  const code = toAsciiDigits(yr.code ?? yr.label ?? '1404-1405');
  const startDateJalali = toAsciiDigits(
    yr.startDateJalali ?? yr.startJalali ?? `${code.split('-')[0] || '1404'}/07/01`
  );
  const endDateJalali = toAsciiDigits(
    yr.endDateJalali ?? yr.endJalali ?? `${code.split('-')[1] || '1405'}/06/31`
  );
  const isActive = Boolean(yr.isActive ?? yr.status === 'active');
  const isArchived = Boolean(yr.isArchived ?? yr.status === 'archived');
  const status: AcademicYearStatus =
    yr.status ?? (isActive ? 'active' : isArchived ? 'archived' : 'upcoming');
  const nowIso = yr.updatedAtIso ?? yr.createdAtIso ?? '2025-09-23T08:00:00.000Z';

  return {
    id: yr.id,
    complexId: yr.complexId ?? DEFAULT_COMPLEX_ID,
    schoolId: yr.schoolId ?? GLOBAL_TENANT_ID,
    academicYearId: yr.academicYearId ?? yr.id,
    code,
    title: yr.title?.trim() || buildAcademicYearTitle(code),
    label: code,
    startDateJalali,
    endDateJalali,
    startJalali: startDateJalali,
    endJalali: endDateJalali,
    status,
    isDefault: yr.isDefault ?? isActive,
    isActive: status === 'active',
    isArchived: status === 'archived',
    createdByUserId: yr.createdByUserId ?? 'user-super-admin',
    createdAtIso: yr.createdAtIso ?? nowIso,
    updatedAtIso: nowIso,
  };
}

/**
 * Automatically seeds 2 baseline academic years for a school (or global default):
 * - 1403-1404 (1403/07/01 to 1404/06/31) -> status: 'archived'
 * - 1404-1405 (1404/07/01 to 1405/06/31) -> status: 'active', isDefault: true
 */
export function generateSeedAcademicYears(
  nowIso = '2025-09-23T08:00:00.000Z',
  schoolId = GLOBAL_TENANT_ID,
  complexId = DEFAULT_COMPLEX_ID
): AcademicYear[] {
  return [
    {
      id: schoolId === GLOBAL_TENANT_ID ? ARCHIVED_ACADEMIC_YEAR_ID : `${schoolId}:${ARCHIVED_ACADEMIC_YEAR_ID}`,
      complexId,
      schoolId,
      academicYearId: ARCHIVED_ACADEMIC_YEAR_ID,
      code: '1403-1404',
      title: 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
      label: '1403-1404',
      startDateJalali: '1403/07/01',
      endDateJalali: '1404/06/31',
      startJalali: '1403/07/01',
      endJalali: '1404/06/31',
      status: 'archived',
      isDefault: false,
      isActive: false,
      isArchived: true,
      createdByUserId: 'user-super-admin',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: schoolId === GLOBAL_TENANT_ID ? DEFAULT_ACTIVE_ACADEMIC_YEAR_ID : `${schoolId}:${DEFAULT_ACTIVE_ACADEMIC_YEAR_ID}`,
      complexId,
      schoolId,
      academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
      code: '1404-1405',
      title: 'سال تحصیلی ۱۴۰۴-۱۴۰۵',
      label: '1404-1405',
      startDateJalali: '1404/07/01',
      endDateJalali: '1405/06/31',
      startJalali: '1404/07/01',
      endJalali: '1405/06/31',
      status: 'active',
      isDefault: true,
      isActive: true,
      isArchived: false,
      createdByUserId: 'user-super-admin',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
  ];
}

export interface CreateAcademicYearInput {
  code?: string;
  label?: string;
  title?: string;
  startDateJalali?: string;
  endDateJalali?: string;
  startJalali?: string;
  endJalali?: string;
  status?: AcademicYearStatus;
  setAsActive?: boolean;
  complexId?: string;
  schoolId?: string;
  createdByUserId: string;
}

export interface CreateAcademicYearResult {
  ok: boolean;
  errorFa?: string;
  updatedList?: AcademicYear[];
  createdYear?: AcademicYear;
}

const YEAR_LABEL_REGEX = /^(13|14)\d{2}-(13|14)\d{2}$/;

/**
 * Validates and creates a new normalized AcademicYear entity (e.g. '1405-1406').
 */
export function createAcademicYearRecord(
  existing: AcademicYear[],
  input: CreateAcademicYearInput,
  nowIso = new Date().toISOString()
): CreateAcademicYearResult {
  const rawCode = input.code ?? input.label ?? '';
  const normalizedCode = toAsciiDigits(rawCode).replace(/\s+/g, '').replace(/[–—]/g, '-');
  if (!YEAR_LABEL_REGEX.test(normalizedCode)) {
    return {
      ok: false,
      errorFa: 'فرمت سال تحصیلی نامعتبر است. نمونه صحیح: ۱۴۰۵-۱۴۰۶',
    };
  }

  const [startYearStr, endYearStr] = normalizedCode.split('-');
  const startYear = Number(startYearStr);
  const endYear = Number(endYearStr);
  if (endYear !== startYear + 1) {
    return {
      ok: false,
      errorFa: 'سال پایان باید دقیقاً یک سال پس از سال شروع باشد (مثلاً ۱۴۰۵-۱۴۰۶).',
    };
  }

  if (existing.some((y) => toAsciiDigits(y.code || y.label) === normalizedCode)) {
    return {
      ok: false,
      errorFa: `سال تحصیلی ${toPersianDigits(normalizedCode)} قبلاً در سامانه ثبت شده است.`,
    };
  }

  const canonicalId = `ay-${normalizedCode}`;
  const startDateJalali = toAsciiDigits(
    (input.startDateJalali ?? input.startJalali)?.trim() || `${startYear}/07/01`
  );
  const endDateJalali = toAsciiDigits(
    (input.endDateJalali ?? input.endJalali)?.trim() || `${endYear}/06/31`
  );
  const effectiveStatus: AcademicYearStatus = input.setAsActive
    ? 'active'
    : (input.status ?? 'upcoming');
  const isActive = effectiveStatus === 'active';
  const isArchived = effectiveStatus === 'archived';

  const createdYear: AcademicYear = {
    id: canonicalId,
    complexId: input.complexId ?? DEFAULT_COMPLEX_ID,
    schoolId: input.schoolId ?? GLOBAL_TENANT_ID,
    academicYearId: canonicalId,
    code: normalizedCode,
    title: input.title?.trim() || buildAcademicYearTitle(normalizedCode),
    label: normalizedCode,
    startDateJalali,
    endDateJalali,
    startJalali: startDateJalali,
    endJalali: endDateJalali,
    status: effectiveStatus,
    isDefault: isActive,
    isActive,
    isArchived,
    createdByUserId: input.createdByUserId,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  const baseList = isActive
    ? existing.map((y) => ({
        ...y,
        isActive: false,
        isDefault: false,
        status: y.status === 'active' ? ('archived' as AcademicYearStatus) : y.status,
        isArchived: y.status === 'active' ? true : y.isArchived,
        updatedAtIso: nowIso,
      }))
    : [...existing];

  const updatedList = [...baseList, createdYear].sort((a, b) => a.code.localeCompare(b.code));

  return {
    ok: true,
    createdYear,
    updatedList,
  };
}

/**
 * Sets one academic year as the active default year (automatically activates it and switches previously active year to non-active).
 */
export function setActiveAcademicYearInList(
  existing: AcademicYear[],
  targetId: string,
  nowIso = new Date().toISOString()
): AcademicYear[] {
  if (!existing.some((y) => y.id === targetId || y.academicYearId === targetId)) return existing;
  return existing.map((y) => {
    const isTarget = y.id === targetId || y.academicYearId === targetId;
    if (isTarget) {
      return {
        ...y,
        status: 'active',
        isDefault: true,
        isActive: true,
        isArchived: false,
        updatedAtIso: nowIso,
      };
    }
    const nextStatus: AcademicYearStatus = y.status === 'active' ? 'upcoming' : y.status;
    return {
      ...y,
      status: nextStatus,
      isDefault: false,
      isActive: false,
      isArchived: nextStatus === 'archived',
      updatedAtIso: nowIso,
    };
  });
}

/**
 * Archives or unarchives an academic year without deleting any historical data.
 * Prevents archiving the currently active default year directly.
 */
export function toggleAcademicYearArchiveInList(
  existing: AcademicYear[],
  targetId: string,
  archive: boolean,
  nowIso = new Date().toISOString()
): { ok: boolean; errorFa?: string; updatedList?: AcademicYear[] } {
  const target = existing.find((y) => y.id === targetId || y.academicYearId === targetId);
  if (!target) {
    return { ok: false, errorFa: 'سال تحصیلی انتخاب‌شده یافت نشد.' };
  }
  if (archive && (target.isActive || target.status === 'active')) {
    return {
      ok: false,
      errorFa: 'امکان آرشیو کردن سال تحصیلی فعال پیش‌فرض وجود ندارد. ابتدا سال دیگری را فعال کنید.',
    };
  }
  return {
    ok: true,
    updatedList: existing.map((y) => {
      if (y.id !== target.id) return y;
      const nextStatus: AcademicYearStatus = archive ? 'archived' : 'upcoming';
      return {
        ...y,
        status: nextStatus,
        isArchived: archive,
        isActive: false,
        isDefault: false,
        updatedAtIso: nowIso,
      };
    }),
  };
}

export function resolveDefaultAcademicYear(years: AcademicYear[]): AcademicYear | undefined {
  return (
    years.find((y) => y.isActive || y.status === 'active') ??
    years.find((y) => y.isDefault) ??
    years.find((y) => !y.isArchived && y.status !== 'archived') ??
    years[years.length - 1]
  );
}

export function formatAcademicYearLabelFa(label: string): string {
  return toPersianDigits(label);
}

export function getAcademicYearStatusMeta(status: AcademicYearStatus): {
  labelFa: string;
  shortLabelFa: string;
  badgeClass: string;
} {
  switch (status) {
    case 'active':
      return {
        labelFa: 'فعال',
        shortLabelFa: 'فعال',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'archived':
      return {
        labelFa: 'آرشیو فقط خواندنی',
        shortLabelFa: 'آرشیو',
        badgeClass:
          'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      };
    case 'upcoming':
      return {
        labelFa: 'آینده',
        shortLabelFa: 'آینده',
        badgeClass:
          'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
      };
  }
}
