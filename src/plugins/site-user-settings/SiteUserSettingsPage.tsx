// Phase 5.5 Plugin: Site User & Appearance Settings («کاربر سایت و تنظیمات ظاهری»)
// Tab 1: User Profile & Local Password/PIN Change (All 6 Roles)
// Tab 2: Appearance, Theme Mode (Light/Dark/Warm Reading), Brand Accent + Custom Color, Persian Fonts, Scale, Corners & Density (All 6 Roles)
// Tab 3: Dynamic Section/Menu Renamer & School Identity/Logo (principal & complex_admin ONLY)
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Eye,
  Globe,
  ImagePlus,
  KeyRound,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Type,
  UserCircle2,
} from 'lucide-react';
import { useAppearance, useSectionLabel } from '../../core/appearance/AppearanceContext';
import {
  ACCENT_PRESETS,
  CORNER_STYLE_OPTIONS,
  FONT_SCALE_OPTIONS,
  PERSIAN_FONT_OPTIONS,
  SIDEBAR_DENSITY_OPTIONS,
  THEME_MODE_OPTIONS,
  validateSchoolLogoFile,
} from '../../core/appearance/appearanceHelpers';
import { useSchoolData } from '../../core/data/DataContext';
import { deleteMediaBlob, saveMediaBlob } from '../../core/data/mediaBlobStore';
import { PluginIcon } from '../../core/ui/IconResolver';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import type {
  AccentPresetId,
  CornerStyleId,
  FontScalePercent,
  PersianFontId,
  SchoolBrandingConfig,
  SidebarDensityId,
  ThemeModeId,
} from '../../types/domain';

type SettingsTabId = 'profile' | 'appearance' | 'branding';

export const SiteUserSettingsPage: React.FC = () => {
  const {
    session,
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    schools,
    allManifests,
    changeOwnLocalPassword,
    saveSchoolBrandingConfig,
  } = useSchoolData();

  const {
    appearance,
    branding,
    activeAppTitle,
    activeSchoolDisplayName,
    schoolLogoUrl,
    updateAppearance,
    resetAppearance,
    refreshSchoolLogo,
  } = useAppearance();
  const { getSectionTitle } = useSectionLabel();
  const { showToast } = useToast();

  const canEditBranding = roleDef.canEditSchoolSettings; // principal & complex_admin ONLY
  const isComplexAdmin = activeRole === 'complex_admin';

  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');

  // Tab 1: Password change form state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Tab 3: School Branding & Section Renamer Draft State
  const [appTitleDraft, setAppTitleDraft] = useState('');
  const [schoolDisplayNameDraft, setSchoolDisplayNameDraft] = useState('');
  const [printSubtitleDraft, setPrintSubtitleDraft] = useState('');
  const [logoMediaIdDraft, setLogoMediaIdDraft] = useState<string | undefined>(undefined);
  const [sectionLabelsDraft, setSectionLabelsDraft] = useState<Record<string, string>>({});
  const [brandingSearch, setBrandingSearch] = useState('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);

  // Hydrate Tab 3 drafts whenever activeSchoolId or persisted branding changes
  useEffect(() => {
    setAppTitleDraft(branding?.appTitle ?? '');
    setSchoolDisplayNameDraft(branding?.schoolDisplayName ?? '');
    setPrintSubtitleDraft(branding?.printSubtitle ?? '');
    setLogoMediaIdDraft(branding?.logoMediaId);
    setSectionLabelsDraft({ ...(branding?.sectionLabels ?? {}) });
    setLogoError(null);
  }, [branding, activeSchoolId]);

  // If user switches to a role without branding rights while on Tab 3, bounce safely to Tab 1
  useEffect(() => {
    if (!canEditBranding && activeTab === 'branding') {
      setActiveTab('profile');
    }
  }, [canEditBranding, activeTab]);

  // All implemented core + addon sections available for renaming
  const renamableSections = useMemo(() => {
    const query = brandingSearch.trim();
    return allManifests
      .filter((m) => m.implemented)
      .filter((m) => {
        if (!query) return true;
        const custom = sectionLabelsDraft[m.id] ?? '';
        return (
          m.nameFa.includes(query) ||
          m.shortNameFa.includes(query) ||
          custom.includes(query) ||
          m.categoryLabelFa.includes(query)
        );
      });
  }, [allManifests, brandingSearch, sectionLabelsDraft]);

  const renamedCount = useMemo(
    () =>
      Object.values(sectionLabelsDraft).filter((v) => typeof v === 'string' && v.trim().length > 0)
        .length,
    [sectionLabelsDraft]
  );

  const loginTimeFormatted = useMemo(() => {
    if (!session?.loggedInAt) return '—';
    try {
      const dt = new Date(session.loggedInAt);
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      return toPersianDigits(`${hh}:${mm}`);
    } catch {
      return '—';
    }
  }, [session?.loggedInAt]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!currentPw.trim()) {
      setPwError('لطفاً رمز عبور فعلی را وارد کنید.');
      return;
    }
    if (newPw.trim().length < 8) {
      setPwError('رمز عبور جدید باید حداقل ۸ کاراکتر و شامل حروف و اعداد باشد.');
      return;
    }
    if (newPw.trim() !== confirmPw.trim()) {
      setPwError('رمز عبور جدید و تکرار آن مطابقت ندارند.');
      return;
    }

    const res = await changeOwnLocalPassword(currentPw, newPw);
    if (!res.ok) {
      setPwError(res.errorFa ?? 'تغییر رمز عبور ناموفق بود.');
      return;
    }

    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwSuccess('رمز عبور حساب شما با موفقیت و به‌صورت رمزگذاری‌شده تغییر یافت.');
    showToast('رمز عبور با موفقیت به‌روزرسانی شد.');
  };

  const handleThemeChange = (mode: ThemeModeId) => {
    updateAppearance({ themeMode: mode });
  };

  const handleAccentPreset = (preset: AccentPresetId, hex?: string) => {
    if (preset === 'custom' && hex) {
      updateAppearance({ accentPreset: 'custom', customAccentHex: hex });
    } else {
      const found = ACCENT_PRESETS.find((p) => p.id === preset);
      updateAppearance({
        accentPreset: preset,
        customAccentHex: found?.hex ?? appearance.customAccentHex,
      });
    }
  };

  const handleFontChange = (fontId: PersianFontId) => {
    updateAppearance({ fontFamily: fontId });
  };

  const handleScaleChange = (scale: FontScalePercent) => {
    updateAppearance({ fontScale: scale });
  };

  const handleCornerChange = (cornerStyle: CornerStyleId) => {
    updateAppearance({ cornerStyle });
  };

  const handleDensityChange = (sidebarDensity: SidebarDensityId) => {
    updateAppearance({ sidebarDensity });
  };

  const handleResetAppearance = () => {
    resetAppearance();
    showToast('تمامی تنظیمات ظاهری، فونت و رنگ به حالت پیشفرض بازگردانده شد.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEditBranding) return;
    setLogoError(null);

    const check = validateSchoolLogoFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!check.ok) {
      setLogoError(check.errorFa ?? 'فایل لوگو معتبر نیست.');
      return;
    }

    const mediaId = `${activeSchoolId}:school-logo:${Date.now()}`;
    await saveMediaBlob({
      mediaId,
      schoolId: activeSchoolId,
      fileName: file.name,
      mimeType: file.type || 'image/png',
      sizeBytes: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    });

    if (logoMediaIdDraft && logoMediaIdDraft !== mediaId) {
      await deleteMediaBlob(logoMediaIdDraft);
    }

    setLogoMediaIdDraft(mediaId);
    // Persist immediately so sidebar & print headers show the uploaded logo right away
    const config: SchoolBrandingConfig = {
      id: `${activeSchoolId}:branding`,
      schoolId: activeSchoolId,
      appTitle: appTitleDraft.trim() || undefined,
      schoolDisplayName: schoolDisplayNameDraft.trim() || undefined,
      printSubtitle: printSubtitleDraft.trim() || undefined,
      logoMediaId: mediaId,
      sectionLabels: cleanSectionLabelsMap(sectionLabelsDraft),
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };
    const res = await saveSchoolBrandingConfig(config, false);
    if (res.ok) {
      refreshSchoolLogo();
      showToast('لوگوی اختصاصی مدرسه ذخیره شد و در نوار بالا و سربرگ چاپ فعال گردید.');
    }
  };

  const handleRemoveLogo = async () => {
    if (!canEditBranding) return;
    if (logoMediaIdDraft) {
      await deleteMediaBlob(logoMediaIdDraft);
    }
    setLogoMediaIdDraft(undefined);
    const config: SchoolBrandingConfig = {
      id: `${activeSchoolId}:branding`,
      schoolId: activeSchoolId,
      appTitle: appTitleDraft.trim() || undefined,
      schoolDisplayName: schoolDisplayNameDraft.trim() || undefined,
      printSubtitle: printSubtitleDraft.trim() || undefined,
      logoMediaId: undefined,
      sectionLabels: cleanSectionLabelsMap(sectionLabelsDraft),
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };
    await saveSchoolBrandingConfig(config, false);
    refreshSchoolLogo();
    showToast('لوگوی اختصاصی حذف شد و نشان پیشفرض نمایش داده می‌شود.', 'info');
  };

  const cleanSectionLabelsMap = (raw: Record<string, string>): Record<string, string> => {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const trimmed = v.trim();
      if (trimmed.length > 0) {
        cleaned[k] = trimmed;
      }
    }
    return cleaned;
  };

  const handleSaveBranding = async (applyToAllSchools: boolean) => {
    if (!canEditBranding) return;
    setSavingBranding(true);
    try {
      const config: SchoolBrandingConfig = {
        id: `${activeSchoolId}:branding`,
        schoolId: activeSchoolId,
        appTitle: appTitleDraft.trim() || undefined,
        schoolDisplayName: schoolDisplayNameDraft.trim() || undefined,
        printSubtitle: printSubtitleDraft.trim() || undefined,
        logoMediaId: logoMediaIdDraft,
        sectionLabels: cleanSectionLabelsMap(sectionLabelsDraft),
        updatedByName: session?.displayName ?? activeSchool.principalName,
        updatedAt: new Date().toISOString(),
      };
      const res = await saveSchoolBrandingConfig(config, applyToAllSchools);
      if (!res.ok) {
        showToast(res.errorFa ?? 'ذخیره تنظیمات ناموفق بود.', 'error');
        return;
      }
      showToast(
        applyToAllSchools && isComplexAdmin
          ? `هویت سامانه و نام بخش‌ها برای هر ${toPersianDigits(schools.length)} مدرسه مجموعه ذخیره شد.`
          : `تنظیمات هویت و نام بخش‌ها برای «${activeSchoolDisplayName}» ذخیره و اعمال شد.`
      );
    } finally {
      setSavingBranding(false);
    }
  };

  const handleResetSingleLabel = (sectionId: string) => {
    setSectionLabelsDraft((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  };

  const handleResetAllLabels = async () => {
    if (!canEditBranding) return;
    setSectionLabelsDraft({});
    const config: SchoolBrandingConfig = {
      id: `${activeSchoolId}:branding`,
      schoolId: activeSchoolId,
      appTitle: appTitleDraft.trim() || undefined,
      schoolDisplayName: schoolDisplayNameDraft.trim() || undefined,
      printSubtitle: printSubtitleDraft.trim() || undefined,
      logoMediaId: logoMediaIdDraft,
      sectionLabels: {},
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };
    await saveSchoolBrandingConfig(config, false);
    showToast('تمام نام‌های بخش‌ها به عناوین پیشفرض سامانه بازگردانده شد.', 'info');
  };

  const pageTitle = getSectionTitle('site-user-settings', 'کاربر سایت و تنظیمات ظاهری');

  return (
    <div className="space-y-6" data-testid="site-user-settings-page">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl brand-bg flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {pageTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                شخصی‌سازی حساب کاربری، حالت نمایش، رنگ و فونت فارسی{canEditBranding ? ' و تغییر نام بخش‌های سامانه' : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>تنظیمات چاپ A4/A5 همواره سفید و مشکی استاندارد باقی می‌ماند</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="تب‌های کاربر سایت و تنظیمات ظاهری"
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'brand-btn shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
          }`}
        >
          <UserCircle2 className="w-4 h-4 shrink-0" />
          <span>پروفایل کاربر سایت</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'appearance'}
          onClick={() => setActiveTab('appearance')}
          className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'appearance'
              ? 'brand-btn shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
          }`}
        >
          <Palette className="w-4 h-4 shrink-0" />
          <span>تنظیمات ظاهری، فونت و رنگ</span>
        </button>

        {canEditBranding && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'branding'}
            onClick={() => setActiveTab('branding')}
            className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'branding'
                ? 'brand-btn shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span>تغییر نام بخش‌های مختلف و هویت مدرسه</span>
          </button>
        )}
      </div>

      {/* ==================== TAB 1: USER PROFILE & PASSWORD ==================== */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Identity Summary Card */}
          <section className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl brand-bg flex items-center justify-center text-lg font-extrabold shrink-0">
                {(session?.displayName ?? 'ک').trim().charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {session?.displayName ?? 'کاربر سامانه'}
                </h2>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-bold brand-soft-badge">
                  <span>{roleDef.labelFa}</span>
                </div>
              </div>
            </div>

            <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-3 flex items-center justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">نام کاربری</dt>
                <dd className="font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                  {session?.username ?? '—'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">واحد آموزشی فعال</dt>
                <dd className="font-bold text-slate-900 dark:text-slate-100 text-left">
                  {activeSchoolDisplayName}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">سال تحصیلی</dt>
                <dd className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {toPersianDigits(activeSchool.academicYear)}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">زمان ورود به نشست فعلی</dt>
                <dd className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  ساعت {loginTimeFormatted}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">سطح دسترسی</dt>
                <dd className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-left">
                  {canEditBranding
                    ? 'مدیریت کامل مدرسه و شخصی‌سازی نام بخش‌ها'
                    : 'شخصی‌سازی ظاهری و حساب کاربری فردی'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Local Password / PIN Update Card */}
          <section className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 brand-text shrink-0" />
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  تغییر رمز عبور / پین ورود محلی
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  رمز جدید روی همین مرورگر ذخیره می‌شود و از ورود بعدی جایگزین رمز قبلی خواهد شد.
                </p>
              </div>
            </div>

            {pwError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 text-xs font-bold text-rose-800 dark:text-rose-200">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                {pwSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="pw-current"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  رمز عبور فعلی
                </label>
                <input
                  id="pw-current"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="رمز عبور فعلی خود را وارد کنید"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pw-new"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    رمز عبور یا پین جدید (حداقل ۴ کاراکتر)
                  </label>
                  <input
                    id="pw-new"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="رمز جدید..."
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pw-confirm"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    تکرار رمز عبور جدید
                  </label>
                  <input
                    id="pw-confirm"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="تکرار رمز جدید..."
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl brand-btn text-sm font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره رمز عبور جدید</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ==================== TAB 2: APPEARANCE, FONT & COLOR ==================== */}
      {activeTab === 'appearance' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="xl:col-span-8 space-y-5">
            {/* 1. Theme Mode */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  ۱. حالت نمایش صفحه
                </h2>
                <button
                  type="button"
                  onClick={handleResetAppearance}
                  className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازگردانی به پیشفرض</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {THEME_MODE_OPTIONS.map((opt) => {
                  const selected = appearance.themeMode === opt.id;
                  const swatchClass =
                    opt.id === 'dark'
                      ? 'bg-slate-900 border-slate-700'
                      : opt.id === 'reading'
                        ? 'bg-[#f5efe2] border-[#d8c9ae]'
                        : 'bg-white border-slate-300';
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`theme-mode-${opt.id}`}
                      onClick={() => handleThemeChange(opt.id)}
                      className={`text-right rounded-xl border-2 p-3.5 transition-all space-y-2 ${
                        selected
                          ? 'border-[var(--brand-primary)] bg-slate-50/70 dark:bg-slate-800/60'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-7 h-7 rounded-lg border ${swatchClass} shrink-0`} />
                        {selected && <Check className="w-4 h-4 brand-text shrink-0" />}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {opt.labelFa}
                      </div>
                      <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                        {opt.descriptionFa}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Brand Accent Color Presets + Custom Picker */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  ۲. رنگ سازمانی و تاکید رابط کاربری
                </h2>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <span>انتخاب رنگ دلخواه:</span>
                  <input
                    type="color"
                    aria-label="انتخاب رنگ سفارشی"
                    value={appearance.customAccentHex}
                    onChange={(e) => handleAccentPreset('custom', e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ACCENT_PRESETS.map((preset) => {
                  const selected = appearance.accentPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`accent-preset-${preset.id}`}
                      onClick={() => handleAccentPreset(preset.id)}
                      className={`min-h-[52px] rounded-xl border-2 px-3 py-2.5 text-right flex items-center gap-2.5 transition-all ${
                        selected
                          ? 'border-[var(--brand-primary)] bg-slate-50 dark:bg-slate-800/70'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-white"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {selected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {preset.labelFa}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400" dir="ltr">
                          {preset.hex}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Persian Fonts */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 brand-text" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  ۳. فونت فارسی سامانه
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PERSIAN_FONT_OPTIONS.map((font) => {
                  const selected = appearance.fontFamily === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      data-testid={`font-option-${font.id}`}
                      onClick={() => handleFontChange(font.id)}
                      className={`text-right rounded-xl border-2 p-3.5 transition-all space-y-1 ${
                        selected
                          ? 'border-[var(--brand-primary)] bg-slate-50 dark:bg-slate-800/70'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {font.labelFa}
                        </span>
                        {selected && <Check className="w-4 h-4 brand-text shrink-0" />}
                      </div>
                      <div
                        className="text-sm text-slate-600 dark:text-slate-300 pt-1"
                        style={{ fontFamily: font.headingStack }}
                      >
                        {font.sampleFa}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4. Font Scale, Corner Style & Sidebar Density */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۴. اندازه متن، گوشه‌ها و تراکم منوی کناری
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    بزرگ‌نمایی فونت صفحه
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FONT_SCALE_OPTIONS.map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        data-testid={`font-scale-${scale}`}
                        onClick={() => handleScaleChange(scale)}
                        className={`min-h-[40px] rounded-xl border text-xs font-bold tabular-nums transition-colors ${
                          appearance.fontScale === scale
                            ? 'brand-btn border-transparent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {toPersianDigits(scale)}٪
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    انحنای گوشه کارت‌ها و دکمه‌ها
                  </div>
                  <div className="space-y-1.5">
                    {CORNER_STYLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleCornerChange(opt.id)}
                        className={`w-full min-h-[38px] px-3 rounded-xl border text-xs font-bold text-right transition-colors ${
                          appearance.cornerStyle === opt.id
                            ? 'brand-btn border-transparent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.labelFa}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    تراکم منوی کناری (Sidebar)
                  </div>
                  <div className="space-y-1.5">
                    {SIDEBAR_DENSITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleDensityChange(opt.id)}
                        className={`w-full min-h-[40px] px-3 rounded-xl border text-xs font-bold text-right transition-colors ${
                          appearance.sidebarDensity === opt.id
                            ? 'brand-btn border-transparent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.labelFa}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Live Interactive Preview Column */}
          <aside className="xl:col-span-4 space-y-4">
            <div className="sticky top-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 brand-text" />
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    پیش‌نمایش زنده رابط کاربری
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  ذخیره خودکار فعال
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {activeAppTitle}
                  </div>
                  <span className="px-2 py-0.5 rounded-lg border text-[11px] font-bold brand-soft-badge">
                    {activeSchoolDisplayName}
                  </span>
                </div>
                <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                  نمونه نمایش متن فارسی، اعداد تراز جدول و دکمه‌های اصلی با رنگ، فونت و مقیاس
                  انتخابی شما.
                </p>

                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 font-bold flex items-center justify-between">
                    <span>آرمان پاکدل</span>
                    <span className="tabular-nums brand-text">۱۹٫۵ از ۲۰</span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>نرخ حضور کلاس سوم</span>
                    <span className="tabular-nums font-bold">۹۷٪</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="flex-1 min-h-[40px] rounded-xl brand-btn text-xs font-bold inline-flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    دکمه اصلی برند
                  </span>
                  <span className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center">
                    دکمه فرعی
                  </span>
                </div>
              </div>

              <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                تمامی تنظیمات این صفحه اختصاصاً برای حساب کاربری شما در مدرسه فعال ذخیره می‌شود و بر
                چاپ رسمی A4 / A5 تاثیر منفی نمی‌گذارد.
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ==================== TAB 3: DYNAMIC SECTION RENAMER & SCHOOL IDENTITY (PRINCIPAL & COMPLEX_ADMIN ONLY) ==================== */}
      {activeTab === 'branding' && canEditBranding && (
        <div className="space-y-6">
          {/* School Identity & Logo Card */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 brand-text shrink-0" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    هویت بصری، عنوان سامانه و لوگوی اختصاصی مدرسه
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تغییرات بلافاصله در منوی کناری، نوار بالای سامانه و سربرگ‌های رسمی چاپ A4 و A5 اعمال می‌شود.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="branding-app-title"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  عنوان اصلی سامانه (در نوار بالا)
                </label>
                <input
                  id="branding-app-title"
                  type="text"
                  value={appTitleDraft}
                  onChange={(e) => setAppTitleDraft(e.target.value)}
                  placeholder="پیشفرض: مدارس هوشمند"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="branding-school-name"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  نام نمایشی مدرسه فعال
                </label>
                <input
                  id="branding-school-name"
                  type="text"
                  value={schoolDisplayNameDraft}
                  onChange={(e) => setSchoolDisplayNameDraft(e.target.value)}
                  placeholder={activeSchool.name}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="branding-print-sub"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  زیرعنوان یا شعار سربرگ چاپ A4 و A5
                </label>
                <input
                  id="branding-print-sub"
                  type="text"
                  value={printSubtitleDraft}
                  onChange={(e) => setPrintSubtitleDraft(e.target.value)}
                  placeholder={activeSchool.letterheadSubtitle}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* School Logo Upload */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {schoolLogoUrl ? (
                  <img
                    src={schoolLogoUrl}
                    alt="لوگوی مدرسه"
                    className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl brand-bg flex items-center justify-center shrink-0">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    لوگوی رسمی مدرسه (نمایش در منو و سربرگ چاپ)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    فرمت مجاز: PNG، JPG یا WebP — حداکثر حجم ۲ مگابایت (ذخیره ایمن در IndexedDB)
                  </div>
                  {logoError && (
                    <div className="mt-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                      {logoError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="min-h-[42px] px-4 rounded-xl brand-btn text-xs font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
                  <ImagePlus className="w-4 h-4" />
                  <span>بارگذاری لوگوی مدرسه</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleLogoUpload(e)}
                    className="hidden"
                  />
                </label>
                {schoolLogoUrl && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveLogo()}
                    className="min-h-[42px] px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف لوگو</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Dynamic Section & Menu Renamer */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  تغییر نام بخش‌ها و منوهای سامانه ({toPersianDigits(renamedCount)} بخش تغییر نام‌یافته)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  نام دلخواه فارسی هر بخش را وارد کنید؛ در منوی کناری، موبایل، مدیریت بسته‌ها و عنوان صفحات به‌صورت زنده نمایش داده می‌شود.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  aria-label="جستجوی بخش برای تغییر نام"
                  value={brandingSearch}
                  onChange={(e) => setBrandingSearch(e.target.value)}
                  placeholder="جستجوی نام بخش..."
                  className="min-h-[40px] w-48 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void handleResetAllLabels()}
                  className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازگردانی تمام نام‌ها به حالت پیشفرض</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs">
                  <tr>
                    <th className="px-3.5 py-2.5 font-bold">نام پیشفرض سامانه</th>
                    <th className="px-3.5 py-2.5 font-bold hidden sm:table-cell">دسته‌بندی</th>
                    <th className="px-3.5 py-2.5 font-bold">نام سفارشی فارسی برای این مدرسه</th>
                    <th className="px-3.5 py-2.5 font-bold text-center w-24">بازگردانی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {renamableSections.map((manifest) => {
                    const currentCustom = sectionLabelsDraft[manifest.id] ?? '';
                    const isModified = currentCustom.trim().length > 0;
                    return (
                      <tr key={manifest.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <PluginIcon
                              name={manifest.iconName}
                              className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {manifest.shortNameFa}
                              </div>
                              <div className="text-[11px] text-slate-400 hidden md:block">
                                {manifest.nameFa}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                          {manifest.categoryLabelFa}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <input
                            type="text"
                            data-testid={`rename-input-${manifest.id}`}
                            aria-label={`نام سفارشی برای ${manifest.shortNameFa}`}
                            value={currentCustom}
                            onChange={(e) =>
                              setSectionLabelsDraft((prev) => ({
                                ...prev,
                                [manifest.id]: e.target.value,
                              }))
                            }
                            placeholder={`پیشفرض: ${manifest.shortNameFa}`}
                            className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={!isModified}
                            onClick={() => handleResetSingleLabel(manifest.id)}
                            aria-label={`بازگردانی نام ${manifest.shortNameFa}`}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save Bar */}
            <div className="flex flex-wrap items-center justify-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {isComplexAdmin && (
                <button
                  type="button"
                  disabled={savingBranding}
                  onClick={() => void handleSaveBranding(true)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Globe className="w-4 h-4 brand-text" />
                  <span>اعمال این تنظیمات برای هر ۳ مدرسه</span>
                </button>
              )}
              <button
                type="button"
                data-testid="save-branding-btn"
                disabled={savingBranding}
                onClick={() => void handleSaveBranding(false)}
                className="min-h-[44px] px-5 rounded-xl brand-btn text-xs sm:text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>ذخیره هویت و نام بخش‌ها</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
