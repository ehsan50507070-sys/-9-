// Global Appearance & Dynamic Section Label Context (Core Layer — preserved even if site-user-settings plugin is disabled)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  SchoolBrandingConfig,
  ThemeModeId,
  UserAppearancePreference,
} from '../../types/domain';
import {
  OFFICIAL_SYSTEM_NAME_FA,
  syncBrowserFaviconAndTitle,
} from '../branding/BrandLogo';
import { useSchoolData, type MutationResult } from '../data/DataContext';
import { getMediaBlob } from '../data/mediaBlobStore';
import {
  computeBrandPaletteVars,
  createDefaultAppearancePreference,
  getPersianFontConfig,
  getSectionTitle,
  loadCachedAppearance,
  resolveSchoolDisplayName,
  saveCachedAppearance,
} from './appearanceHelpers';

interface AppearanceContextValue {
  appearance: UserAppearancePreference;
  branding: SchoolBrandingConfig | null;
  activeAppTitle: string;
  activeSchoolDisplayName: string;
  activePrintSubtitle: string;
  schoolLogoUrl: string | null;
  sectionLabels: Record<string, string>;
  getTitle: (sectionId: string, defaultTitle: string) => string;
  updateAppearance: (patch: Partial<UserAppearancePreference>) => MutationResult;
  resetAppearance: () => MutationResult;
  toggleQuickThemeMode: () => void;
  refreshSchoolLogo: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const loadedFontLinkIds = new Set<string>();

function ensureOptionalFontLoaded(fontId: string, url?: string): void {
  if (!url || typeof document === 'undefined') return;
  const linkId = `smart-school-font-${fontId}`;
  if (loadedFontLinkIds.has(linkId) || document.getElementById(linkId)) {
    loadedFontLinkIds.add(linkId);
    return;
  }
  try {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    loadedFontLinkIds.add(linkId);
  } catch {
    // Offline-safe fallback
  }
}

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    session,
    activeSchool,
    activeSchoolId,
    darkMode,
    setDarkModeDirect,
    userAppearancePref,
    schoolBrandingConfig,
    globalSystemConfig,
    saveUserAppearancePreference,
  } = useSchoolData();

  const userId = session?.userId ?? 'guest';
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoRefreshNonce, setLogoRefreshNonce] = useState(0);

  // Resolve effective preference: IndexedDB store -> instant localStorage cache -> default
  const appearance = useMemo<UserAppearancePreference>(() => {
    if (userAppearancePref) return userAppearancePref;
    const cached = loadCachedAppearance(userId, activeSchoolId);
    if (cached) return cached;
    const def = createDefaultAppearancePreference(userId, activeSchoolId);
    return {
      ...def,
      themeMode: darkMode ? 'dark' : 'light',
    };
  }, [userAppearancePref, userId, activeSchoolId, darkMode]);

  // Apply calm, eye-friendly slate-navy theme, standard readable Vazirmatn font, and Light/Dark mode on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const palette = computeBrandPaletteVars('#2b5b84');
    const fontConfig = getPersianFontConfig('vazirmatn');

    ensureOptionalFontLoaded(fontConfig.id, fontConfig.googleFontUrl);

    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
    root.style.setProperty('--app-font-body', fontConfig.bodyStack);
    root.style.setProperty('--app-font-heading', fontConfig.headingStack);
    root.style.fontSize = '100%';

    const normalizedMode: ThemeModeId = appearance.themeMode === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme-mode', normalizedMode);
    root.setAttribute('data-surface-tint', 'classic_white');
    root.setAttribute('data-corners', 'balanced');
    root.setAttribute('data-sidebar-density', 'standard');

    const shouldBeDark = normalizedMode === 'dark';
    root.classList.toggle('dark', shouldBeDark);
    if (darkMode !== shouldBeDark) {
      setDarkModeDirect(shouldBeDark);
    }

    if (session) {
      saveCachedAppearance({ ...appearance, themeMode: normalizedMode });
    }
  }, [appearance, darkMode, setDarkModeDirect, session]);

  // Load active school custom logo: direct compressed dataUrl in SchoolBrandingConfig -> legacy mediaBlob -> school.logoDataUrl
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const directDataUrl = schoolBrandingConfig?.logoDataUrl;
    const mediaId = schoolBrandingConfig?.logoMediaId;

    if (directDataUrl) {
      setLogoUrl(directDataUrl);
      return;
    }

    if (!mediaId) {
      setLogoUrl(activeSchool?.logoDataUrl ?? null);
      return;
    }

    void getMediaBlob(mediaId, activeSchoolId).then((rec) => {
      if (!active) return;
      if (rec?.blob) {
        objectUrl = URL.createObjectURL(rec.blob);
        setLogoUrl(objectUrl);
      } else {
        setLogoUrl(activeSchool?.logoDataUrl ?? null);
      }
    });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    schoolBrandingConfig?.logoDataUrl,
    schoolBrandingConfig?.logoMediaId,
    activeSchool?.logoDataUrl,
    activeSchoolId,
    logoRefreshNonce,
  ]);

  const updateAppearance = useCallback(
    (patch: Partial<UserAppearancePreference>): MutationResult => {
      const next: UserAppearancePreference = {
        ...appearance,
        ...patch,
        id: `${activeSchoolId}:uap:${userId}`,
        schoolId: activeSchoolId,
        userId,
        updatedAt: new Date().toISOString(),
      };
      saveCachedAppearance(next);
      setDarkModeDirect(next.themeMode === 'dark');
      if (!session) {
        return { ok: true };
      }
      return saveUserAppearancePreference(next);
    },
    [appearance, activeSchoolId, userId, session, saveUserAppearancePreference, setDarkModeDirect]
  );

  const resetAppearance = useCallback((): MutationResult => {
    const def = createDefaultAppearancePreference(userId, activeSchoolId);
    saveCachedAppearance(def);
    setDarkModeDirect(false);
    if (!session) return { ok: true };
    return saveUserAppearancePreference(def);
  }, [userId, activeSchoolId, session, saveUserAppearancePreference, setDarkModeDirect]);

  const toggleQuickThemeMode = useCallback(() => {
    const nextMode: ThemeModeId = appearance.themeMode === 'dark' ? 'light' : 'dark';
    updateAppearance({ themeMode: nextMode });
  }, [appearance.themeMode, updateAppearance]);

  const refreshSchoolLogo = useCallback(() => {
    setLogoRefreshNonce((n) => n + 1);
  }, []);

  const sectionLabels = useMemo(
    () => schoolBrandingConfig?.sectionLabels ?? {},
    [schoolBrandingConfig]
  );

  const globalLabels = useMemo(
    () => globalSystemConfig?.labels ?? {},
    [globalSystemConfig]
  );

  const getTitle = useCallback(
    (sectionId: string, defaultTitle: string) => {
      const globalOverride = globalLabels[`menu.${sectionId}`];
      if (typeof globalOverride === 'string' && globalOverride.trim().length > 0) {
        return globalOverride.trim();
      }
      return getSectionTitle(sectionLabels, sectionId, defaultTitle);
    },
    [globalLabels, sectionLabels]
  );

  const activeAppTitle = useMemo(() => {
    const globalTitle = globalLabels['identity.app_title']?.trim();
    if (globalTitle) return globalTitle;
    const custom = schoolBrandingConfig?.appTitle?.trim();
    return custom && custom.length > 0 ? custom : OFFICIAL_SYSTEM_NAME_FA;
  }, [globalLabels, schoolBrandingConfig?.appTitle]);

  // Dynamically sync browser Favicon (<link rel="icon">) and <title> with global system logo/name
  useEffect(() => {
    syncBrowserFaviconAndTitle(globalSystemConfig?.systemLogoDataUrl, activeAppTitle);
  }, [globalSystemConfig?.systemLogoDataUrl, activeAppTitle]);

  const activeSchoolDisplayName = useMemo(
    () => resolveSchoolDisplayName(schoolBrandingConfig, activeSchool?.name ?? 'دبستان گلستان راه روشن'),
    [schoolBrandingConfig, activeSchool?.name]
  );

  const activePrintSubtitle = useMemo(() => {
    const custom = schoolBrandingConfig?.printSubtitle?.trim();
    return custom && custom.length > 0
      ? custom
      : (activeSchool?.letterheadSubtitle ?? 'مجموعه مدارس گلستان راه روشن');
  }, [schoolBrandingConfig?.printSubtitle, activeSchool?.letterheadSubtitle]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      appearance,
      branding: schoolBrandingConfig,
      activeAppTitle,
      activeSchoolDisplayName,
      activePrintSubtitle,
      schoolLogoUrl: logoUrl,
      sectionLabels,
      getTitle,
      updateAppearance,
      resetAppearance,
      toggleQuickThemeMode,
      refreshSchoolLogo,
    }),
    [
      appearance,
      schoolBrandingConfig,
      activeAppTitle,
      activeSchoolDisplayName,
      activePrintSubtitle,
      logoUrl,
      sectionLabels,
      getTitle,
      updateAppearance,
      resetAppearance,
      toggleQuickThemeMode,
      refreshSchoolLogo,
    ]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return ctx;
}

/**
 * Convenience hook for resolving dynamic school-level section/menu names anywhere in the app.
 */
export function useSectionLabel() {
  const { getTitle, sectionLabels } = useAppearance();
  return { getSectionTitle: getTitle, sectionLabels };
}
