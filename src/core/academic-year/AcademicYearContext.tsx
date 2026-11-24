// Multi-Academic-Year Context & Provider (Phase 9A + 9B — Per-School Selection Persistence)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AcademicYear } from '../../types/domain';
import { useSchoolData, type MutationResult } from '../data/DataContext';
import { DEFAULT_COMPLEX_ID } from '../super-admin/superAdminHelpers';
import {
  createAcademicYearRecord,
  DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
  normalizeAcademicYear,
  resolveDefaultAcademicYear,
  setActiveAcademicYearInList,
  toggleAcademicYearArchiveInList,
  type CreateAcademicYearInput,
} from './academicYearHelpers';

const ACADEMIC_YEAR_PREF_PREFIX = 'smart_school_active_academic_year_v2:';
const LEGACY_PREF_KEY = 'smart_school_active_academic_year_v1';

function readSavedYearForSchool(schoolId: string): string | null {
  try {
    const perSchool = window.localStorage.getItem(`${ACADEMIC_YEAR_PREF_PREFIX}${schoolId}`);
    if (perSchool) return perSchool;
    return window.localStorage.getItem(LEGACY_PREF_KEY);
  } catch {
    return null;
  }
}

function writeSavedYearForSchool(schoolId: string, yearId: string): void {
  try {
    window.localStorage.setItem(`${ACADEMIC_YEAR_PREF_PREFIX}${schoolId}`, yearId);
    window.localStorage.setItem(LEGACY_PREF_KEY, yearId);
  } catch {
    // ignore storage quota failure
  }
}

export interface AcademicYearContextValue {
  // Primary Phase 9B API
  academicYears: AcademicYear[];
  currentYear: AcademicYear | undefined;
  academicYearId: string;
  activeYear: AcademicYear | undefined;
  isArchivedView: boolean;
  switchAcademicYear: (yearId: string) => void;
  resetToActiveYear: () => void;
  createAcademicYear: (
    input: Omit<CreateAcademicYearInput, 'createdByUserId'>
  ) => Promise<MutationResult & { year?: AcademicYear }>;
  setActiveAcademicYear: (yearId: string) => Promise<MutationResult>;
  archiveAcademicYear: (yearId: string, archive?: boolean) => Promise<MutationResult>;

  // Backward-compatible Phase 9A aliases
  selectedAcademicYearId: string;
  selectedAcademicYear: AcademicYear | undefined;
  defaultActiveYear: AcademicYear | undefined;
  isViewingArchivedYear: boolean;
  canManageAcademicYears: boolean;
  setSelectedAcademicYearId: (id: string) => void;
  activateAcademicYear: (yearId: string) => Promise<MutationResult>;
  toggleArchiveAcademicYear: (yearId: string, archive: boolean) => Promise<MutationResult>;
}

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null);

export const AcademicYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    academicYears: rawAcademicYears,
    activeSchoolId,
    activeSchool,
    session,
    activeRole,
    saveAcademicYearsList,
  } = useSchoolData();

  const academicYears = useMemo(
    () => rawAcademicYears.map((y) => normalizeAcademicYear(y)),
    [rawAcademicYears]
  );

  const activeYear = useMemo(
    () => resolveDefaultAcademicYear(academicYears),
    [academicYears]
  );

  const [selectedId, setSelectedId] = useState<string>(() => {
    const saved = readSavedYearForSchool(activeSchoolId);
    return saved || activeYear?.id || DEFAULT_ACTIVE_ACADEMIC_YEAR_ID;
  });

  // Restore last selected academic year whenever the active school switches
  useEffect(() => {
    const saved = readSavedYearForSchool(activeSchoolId);
    if (saved && academicYears.some((y) => y.id === saved || y.academicYearId === saved)) {
      setSelectedId(saved);
    } else if (activeYear) {
      setSelectedId(activeYear.id);
    }
  }, [activeSchoolId, activeYear, academicYears]);

  // Ensure currentYear always resolves to an existing AcademicYear
  const currentYear = useMemo(() => {
    return (
      academicYears.find((y) => y.id === selectedId || y.academicYearId === selectedId) ??
      activeYear
    );
  }, [academicYears, selectedId, activeYear]);

  const academicYearId = currentYear?.academicYearId ?? currentYear?.id ?? DEFAULT_ACTIVE_ACADEMIC_YEAR_ID;

  useEffect(() => {
    writeSavedYearForSchool(activeSchoolId, academicYearId);
  }, [activeSchoolId, academicYearId]);

  const switchAcademicYear = useCallback((yearId: string) => {
    setSelectedId(yearId);
  }, []);

  const resetToActiveYear = useCallback(() => {
    if (activeYear) {
      setSelectedId(activeYear.academicYearId || activeYear.id);
    }
  }, [activeYear]);

  const isArchivedView = Boolean(
    currentYear && (currentYear.status === 'archived' || currentYear.isArchived)
  );

  // Per Phase 9B spec: super_admin, complex_admin, and principal can manage academic years
  const canManageAcademicYears =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal';

  const createAcademicYear = useCallback(
    async (
      input: Omit<CreateAcademicYearInput, 'createdByUserId'>
    ): Promise<MutationResult & { year?: AcademicYear }> => {
      if (!canManageAcademicYears || !session) {
        return {
          ok: false,
          errorFa: 'ایجاد سال تحصیلی جدید صرفاً در اختیار راهبر ارشد، مدیر کل مجموعه و مدیر مدرسه است.',
        };
      }
      const res = createAcademicYearRecord(academicYears, {
        ...input,
        complexId: input.complexId ?? activeSchool.complexId ?? session.complexId ?? DEFAULT_COMPLEX_ID,
        schoolId: input.schoolId ?? activeSchoolId,
        createdByUserId: session.userId,
      });
      if (!res.ok || !res.updatedList || !res.createdYear) {
        return { ok: false, errorFa: res.errorFa };
      }
      const saved = await saveAcademicYearsList(res.updatedList);
      if (!saved.ok) return saved;
      if (input.setAsActive || input.status === 'active') {
        setSelectedId(res.createdYear.academicYearId);
      }
      return { ok: true, year: res.createdYear };
    },
    [academicYears, canManageAcademicYears, session, activeSchool.complexId, activeSchoolId, saveAcademicYearsList]
  );

  const setActiveAcademicYear = useCallback(
    async (yearId: string): Promise<MutationResult> => {
      if (!canManageAcademicYears) {
        return {
          ok: false,
          errorFa: 'تغییر سال تحصیلی فعال پیش‌فرض صرفاً در اختیار راهبر ارشد، مدیر کل و مدیر مدرسه است.',
        };
      }
      const updated = setActiveAcademicYearInList(academicYears, yearId);
      const saved = await saveAcademicYearsList(updated);
      if (saved.ok) {
        setSelectedId(yearId);
      }
      return saved;
    },
    [academicYears, canManageAcademicYears, saveAcademicYearsList]
  );

  const archiveAcademicYear = useCallback(
    async (yearId: string, archive = true): Promise<MutationResult> => {
      if (!canManageAcademicYears) {
        return {
          ok: false,
          errorFa: 'آرشیو یا بازگردانی سال تحصیلی صرفاً در اختیار راهبر ارشد، مدیر کل و مدیر مدرسه است.',
        };
      }
      const res = toggleAcademicYearArchiveInList(academicYears, yearId, archive);
      if (!res.ok || !res.updatedList) {
        return { ok: false, errorFa: res.errorFa };
      }
      return saveAcademicYearsList(res.updatedList);
    },
    [academicYears, canManageAcademicYears, saveAcademicYearsList]
  );

  const value = useMemo<AcademicYearContextValue>(
    () => ({
      academicYears,
      currentYear,
      academicYearId,
      activeYear,
      isArchivedView,
      switchAcademicYear,
      resetToActiveYear,
      createAcademicYear,
      setActiveAcademicYear,
      archiveAcademicYear,

      // Backward-compatible aliases
      selectedAcademicYearId: academicYearId,
      selectedAcademicYear: currentYear,
      defaultActiveYear: activeYear,
      isViewingArchivedYear: isArchivedView,
      canManageAcademicYears,
      setSelectedAcademicYearId: switchAcademicYear,
      activateAcademicYear: setActiveAcademicYear,
      toggleArchiveAcademicYear: archiveAcademicYear,
    }),
    [
      academicYears,
      currentYear,
      academicYearId,
      activeYear,
      isArchivedView,
      switchAcademicYear,
      resetToActiveYear,
      createAcademicYear,
      setActiveAcademicYear,
      archiveAcademicYear,
      canManageAcademicYears,
    ]
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
};

export function useAcademicYear(): AcademicYearContextValue {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) {
    throw new Error('useAcademicYear must be used inside AcademicYearProvider');
  }
  return ctx;
}
