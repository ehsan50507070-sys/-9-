// Reusable School Logo & Print Letterhead Branding Manager
// Supports:
// 1. mode="single_school" -> Principal panel (strictly locked to own session.schoolId; zero visibility into other schools)
// 2. mode="multi_school_admin" -> Super Admin panel (100% dynamic across ALL complexes & schools with fast search & filter)
// Enforces complexId/schoolId isolation, Panic Mode & Archive Year read-only guards, and tamper-evident Audit Log recording.
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Building,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  ImagePlus,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { dateToJalaliString, formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import type { School } from '../../types/domain';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import { useAppearance } from '../appearance/AppearanceContext';
import { validateSchoolLogoFile } from '../appearance/appearanceHelpers';
import { ROLE_DEFINITIONS } from '../auth/rbac';
import { useSchoolData } from '../data/DataContext';
import { PrintIconButton } from '../print/PrintIconButton';
import { isSchoolUnderPanicLock } from '../security/DataIntegrityGuard';
import {
  compressImageFileToDataUrl,
  DEFAULT_COMPLEX_ID,
  GRADE_LEVEL_LABELS,
} from '../super-admin/superAdminHelpers';
import { useToast } from '../ui/ToastContext';
import { DEFAULT_BRAND_LOGO_DATA_URL, SystemBrandLogo } from './BrandLogo';

export interface SchoolPrintBrandingManagerProps {
  mode: 'single_school' | 'multi_school_admin';
  compact?: boolean;
}

function escapeHtmlBasic(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const SchoolPrintBrandingManager: React.FC<SchoolPrintBrandingManagerProps> = ({
  mode,
  compact = false,
}) => {
  const {
    session,
    activeRole,
    activeSchool,
    activeSchoolId,
    schools,
    allSchools,
    educationalComplexes,
    schoolBrandingConfig,
    schoolBrandingConfigs,
    globalSystemConfig,
    panicModeState,
    saveSchoolPrintBranding,
  } = useSchoolData();
  const { activeAppTitle, schoolLogoUrl, refreshSchoolLogo } = useAppearance();
  const { isViewingArchivedYear } = useAcademicYear();
  const { showToast } = useToast();

  // Defense-in-depth: even if multi_school_admin is passed, strictly restrict non-super_admin roles to single_school
  const effectiveMode: 'single_school' | 'multi_school_admin' =
    mode === 'multi_school_admin' && activeRole === 'super_admin'
      ? 'multi_school_admin'
      : 'single_school';

  // Super Admin dynamic school selector & search state
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(activeSchoolId);
  const [schoolSearch, setSchoolSearch] = useState<string>('');
  const [complexFilterId, setComplexFilterId] = useState<string>('all');

  // Keep selectedSchoolId valid if schools list changes dynamically (e.g. new school added)
  useEffect(() => {
    if (effectiveMode !== 'multi_school_admin') return;
    if (!allSchools.some((s) => s.id === selectedSchoolId)) {
      setSelectedSchoolId(allSchools[0]?.id ?? activeSchoolId);
    }
  }, [allSchools, activeSchoolId, effectiveMode, selectedSchoolId]);

  const complexNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of educationalComplexes) {
      map.set(c.id, c.name);
    }
    return map;
  }, [educationalComplexes]);

  const brandingBySchoolId = useMemo(() => {
    const map = new Map<string, (typeof schoolBrandingConfigs)[number]>();
    for (const cfg of schoolBrandingConfigs) {
      map.set(cfg.schoolId, cfg);
    }
    return map;
  }, [schoolBrandingConfigs]);

  // Dynamic filtered school list for Super Admin (supports any number of complexes & schools)
  const filteredAdminSchools = useMemo<School[]>(() => {
    if (effectiveMode !== 'multi_school_admin') return [];
    const q = schoolSearch.trim().toLowerCase();
    return allSchools.filter((school) => {
      const cId = school.complexId ?? DEFAULT_COMPLEX_ID;
      if (complexFilterId !== 'all' && cId !== complexFilterId) return false;
      if (!q) return true;
      const cName = (complexNameById.get(cId) ?? '').toLowerCase();
      const customName = (brandingBySchoolId.get(school.id)?.schoolDisplayName ?? '').toLowerCase();
      return (
        school.name.toLowerCase().includes(q) ||
        customName.includes(q) ||
        cName.includes(q) ||
        school.principalName.toLowerCase().includes(q) ||
        school.id.toLowerCase().includes(q)
      );
    });
  }, [
    allSchools,
    brandingBySchoolId,
    complexFilterId,
    complexNameById,
    effectiveMode,
    schoolSearch,
  ]);

  // Resolve target school with strict tenant isolation
  const targetSchool = useMemo<School | null>(() => {
    if (effectiveMode === 'multi_school_admin') {
      return allSchools.find((s) => s.id === selectedSchoolId) ?? allSchools[0] ?? activeSchool ?? null;
    }
    if (activeRole === 'principal' && session?.schoolId) {
      return schools.find((s) => s.id === session.schoolId) ?? activeSchool ?? null;
    }
    return activeSchool ?? null;
  }, [activeRole, activeSchool, allSchools, effectiveMode, schools, selectedSchoolId, session?.schoolId]);

  const targetBranding = useMemo(() => {
    if (!targetSchool) return null;
    if (effectiveMode === 'single_school' && targetSchool.id === activeSchoolId) {
      return schoolBrandingConfig;
    }
    return brandingBySchoolId.get(targetSchool.id) ?? null;
  }, [activeSchoolId, brandingBySchoolId, effectiveMode, schoolBrandingConfig, targetSchool]);

  const persistedLogoUrl = useMemo<string | null>(() => {
    if (!targetSchool) return null;
    if (targetBranding?.logoDataUrl) return targetBranding.logoDataUrl;
    if (targetSchool.id === activeSchoolId && schoolLogoUrl) return schoolLogoUrl;
    return targetSchool.logoDataUrl ?? null;
  }, [activeSchoolId, schoolLogoUrl, targetBranding?.logoDataUrl, targetSchool]);

  // Draft form state scoped cleanly to targetSchool
  const [displayNameDraft, setDisplayNameDraft] = useState<string>('');
  const [printSubtitleDraft, setPrintSubtitleDraft] = useState<string>('');
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [logoSizeKb, setLogoSizeKb] = useState<number | null>(null);
  const [logoChanged, setLogoChanged] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!targetSchool) return;
    setDisplayNameDraft(targetBranding?.schoolDisplayName ?? targetSchool.name ?? '');
    setPrintSubtitleDraft(
      targetBranding?.printSubtitle ?? targetSchool.letterheadSubtitle ?? ''
    );
    setLogoDraft(persistedLogoUrl);
    setLogoSizeKb(null);
    setLogoChanged(false);
    setStatusFeedback(null);
  }, [targetSchool?.id, targetBranding?.id, targetBranding?.updatedAt, persistedLogoUrl, targetSchool]);

  if (!targetSchool) {
    return null;
  }

  const targetComplexName =
    complexNameById.get(targetSchool.complexId ?? DEFAULT_COMPLEX_ID) ?? 'مجموعه مدارس';

  const isPanicLocked = isSchoolUnderPanicLock(panicModeState, targetSchool.id);
  const isArchivedLocked = isViewingArchivedYear;
  const canEditByRole =
    activeRole === 'super_admin' || activeRole === 'principal' || activeRole === 'complex_admin';
  const readOnly = !canEditByRole || isPanicLocked || isArchivedLocked;

  const previewDisplayName = displayNameDraft.trim() || targetSchool.name;
  const previewPrintSubtitle =
    printSubtitleDraft.trim() || targetSchool.letterheadSubtitle || targetComplexName;
  const previewLogoEffective =
    logoDraft || globalSystemConfig?.systemLogoDataUrl || DEFAULT_BRAND_LOGO_DATA_URL;
  const todayJalaliDisplay = formatJalaliDisplay(getTodayJalali(), true);

  const hasUnsavedChanges =
    logoChanged ||
    displayNameDraft.trim() !==
      (targetBranding?.schoolDisplayName ?? targetSchool.name ?? '').trim() ||
    printSubtitleDraft.trim() !==
      (targetBranding?.printSubtitle ?? targetSchool.letterheadSubtitle ?? '').trim();

  const handleLogoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || readOnly) return;

    const validation = validateSchoolLogoFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!validation.ok) {
      const msg = validation.errorFa ?? 'فایل لوگوی انتخاب‌شده معتبر نیست.';
      setStatusFeedback({ ok: false, text: msg });
      showToast(msg, 'warning');
      return;
    }

    try {
      const compressed = await compressImageFileToDataUrl(file, {
        maxWidth: 512,
        quality: 0.85,
        outputMime: file.type === 'image/png' ? 'image/png' : 'image/webp',
      });
      if (!compressed.ok || !compressed.dataUrl) {
        const msg = compressed.errorFa ?? 'خطا در فشرده‌سازی تصویر لوگوی مدرسه.';
        setStatusFeedback({ ok: false, text: msg });
        showToast(msg, 'warning');
        return;
      }
      setLogoDraft(compressed.dataUrl);
      setLogoSizeKb(compressed.sizeKb ?? 1);
      setLogoChanged(true);
      setStatusFeedback({
        ok: true,
        text: `لوگوی جدید (${toPersianDigits(compressed.sizeKb ?? 1)} کیلوبایت) آماده است — برای اعمال سراسری دکمه «ذخیره لوگو و سربرگ مدرسه» را بزنید.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در پردازش فایل تصویر.';
      setStatusFeedback({ ok: false, text: msg });
      showToast(msg, 'error');
    }
  };

  const handleRemoveLogo = () => {
    if (readOnly) return;
    setLogoDraft(null);
    setLogoSizeKb(null);
    setLogoChanged(true);
    setStatusFeedback({
      ok: true,
      text: 'لوگوی اختصاصی برای حذف علامت‌گذاری شد — جهت ثبت نهایی دکمه «ذخیره لوگو و سربرگ مدرسه» را بزنید.',
    });
  };

  const handleResetDraftToSchoolDefaults = () => {
    if (readOnly) return;
    setDisplayNameDraft(targetSchool.name);
    setPrintSubtitleDraft(targetSchool.letterheadSubtitle || targetComplexName);
    setStatusFeedback({
      ok: true,
      text: 'مقادیر پیش‌نویس به نام رسمی مدرسه بازگردانده شد — برای ثبت نهایی ذخیره کنید.',
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (readOnly || saving) return;

    setSaving(true);
    setStatusFeedback(null);
    try {
      const res = await saveSchoolPrintBranding({
        schoolId: targetSchool.id,
        schoolDisplayName: displayNameDraft.trim(),
        printSubtitle: printSubtitleDraft.trim(),
        logoDataUrl: logoChanged ? logoDraft : undefined,
        isArchivedYear: isArchivedLocked,
      });

      if (!res.ok) {
        const errMsg = res.errorFa ?? 'خطا در ذخیره لوگو و سربرگ مدرسه.';
        setStatusFeedback({ ok: false, text: errMsg });
        showToast(errMsg, 'error');
        return;
      }

      setLogoChanged(false);
      if (targetSchool.id === activeSchoolId) {
        refreshSchoolLogo();
      }
      const successMsg = `لوگو و سربرگ چاپی «${previewDisplayName}» با موفقیت ذخیره شد و در گزارش امنیتی ثبت گردید.`;
      setStatusFeedback({ ok: true, text: successMsg });
      showToast(successMsg);
    } finally {
      setSaving(false);
    }
  };

  // Sample printable document body so principals / super_admins can immediately test A4 & A5 PrintPreviewPortal
  const sampleLetterheadTestHtml = useMemo(() => {
    const safeTitle = escapeHtmlBasic(previewDisplayName);
    const safeSub = escapeHtmlBasic(previewPrintSubtitle);
    const safeAddr = escapeHtmlBasic(targetSchool.address || '—');
    const safePhone = escapeHtmlBasic(toPersianDigits(targetSchool.phone || '—'));
    const safePrincipal = escapeHtmlBasic(targetSchool.principalName || 'مدیریت مدرسه');
    const safeYear = escapeHtmlBasic(toPersianDigits(targetSchool.academicYear || '۱۴۰۵-۱۴۰۶'));
    const safeLogo = escapeHtmlBasic(previewLogoEffective);
    return `
      <header class="print-letterhead" style="margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #0f172a;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${safeLogo}" alt="${safeTitle}" style="width:46px;height:46px;object-fit:contain;flex-shrink:0;" />
            <div>
              <h1 class="print-letterhead-title" style="margin:0;font-size:13.5pt;font-weight:800;">${safeTitle}</h1>
              <p class="print-letterhead-sub" style="margin:2px 0 0;font-size:8.5pt;color:#475569;">${safeSub}</p>
              <p class="print-letterhead-sub" style="margin:2px 0 0;font-size:8pt;color:#475569;">نشانی: ${safeAddr} · تلفن: ${safePhone}</p>
            </div>
          </div>
          <div style="text-align:left;font-size:8.5pt;color:#334155;line-height:1.5;flex-shrink:0;">
            <div>سال تحصیلی: ${safeYear}</div>
            <div>تاریخ چاپ: ${escapeHtmlBasic(todayJalaliDisplay)}</div>
            <div>مدیر واحد: ${safePrincipal}</div>
          </div>
        </div>
      </header>
      <div style="padding:12px 4px;line-height:1.9;font-size:10pt;">
        <h2 style="margin:0 0 8px;font-size:11pt;font-weight:800;">برگه آزمایشی پیش‌نمایش سربرگ رسمی مدرسه</h2>
        <p style="margin:0;">این سند نمونه جهت بررسی دقیق لوگو، نام نمایشی و زیرعنوان رسمی مدرسه «${safeTitle}» در قالب چاپ کاغذ A4 و A5 تولید شده است.</p>
      </div>
    `;
  }, [
    previewDisplayName,
    previewLogoEffective,
    previewPrintSubtitle,
    targetSchool.academicYear,
    targetSchool.address,
    targetSchool.phone,
    targetSchool.principalName,
    todayJalaliDisplay,
  ]);

  const lastUpdatedMeta = useMemo(() => {
    if (!targetBranding?.updatedByName) return null;
    const rawIso = targetBranding.updatedAtIso || targetBranding.updatedAt;
    let dateJalali = '';
    if (rawIso) {
      const parsed = new Date(rawIso);
      if (!Number.isNaN(parsed.getTime())) {
        dateJalali = formatJalaliDisplay(dateToJalaliString(parsed), true);
      }
    }
    const roleFa = targetBranding.updatedByRole
      ? ROLE_DEFINITIONS[targetBranding.updatedByRole]?.labelFa
      : undefined;
    return {
      byName: targetBranding.updatedByName,
      roleFa,
      dateJalali,
    };
  }, [targetBranding]);

  return (
    <section
      data-testid="school-print-branding-manager"
      data-branding-mode={effectiveMode}
      data-target-school-id={targetSchool.id}
      className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      } space-y-5`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="brand-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white sm:text-base">
                لوگو و سربرگ چاپی مدرسه
              </h2>
              {effectiveMode === 'multi_school_admin' ? (
                <span className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                  مدیریت پویا · {toPersianDigits(allSchools.length)} مدرسه فعال
                </span>
              ) : (
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  اختصاصی {targetSchool.name}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {effectiveMode === 'multi_school_admin'
                ? 'انتخاب پویا از فهرست تمام مجموعه‌ها و مدارس ثبت‌شده؛ تغییرات هر مدرسه صرفاً روی هدر و چاپ A4 / A5 همان واحد اعمال می‌شود.'
                : 'بارگذاری لوگوی مدرسه، نام نمایشی در هدر منوی کناری و زیرعنوان رسمی برگه‌های چاپی A4 و A5 صرفاً برای همین مدرسه.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PrintIconButton
            compact
            documentLabel={`پیش‌نمایش سربرگ ${previewDisplayName}`}
            html={sampleLetterheadTestHtml}
            includeHeader={false}
            includeFooter={true}
          />
          {!readOnly && (
            <button
              type="button"
              data-testid="save-school-branding-btn"
              disabled={saving}
              onClick={() => void handleSave()}
              className="brand-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors disabled:opacity-60"
            >
              <Save className="h-4 w-4 shrink-0" />
              <span>{saving ? 'در حال ذخیره...' : 'ذخیره لوگو و سربرگ مدرسه'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Super Admin Dynamic Multi-School Picker (Rendered STRICTLY in multi_school_admin mode) */}
      {effectiveMode === 'multi_school_admin' && (
        <div
          data-testid="super-admin-dynamic-school-picker"
          className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <Building className="h-4 w-4 brand-text" />
              <span>انتخاب مدرسه از کل سامانه ({toPersianDigits(allSchools.length)} واحد)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {educationalComplexes.length > 1 && (
                <select
                  aria-label="فیلتر بر اساس مجموعه آموزشی"
                  value={complexFilterId}
                  onChange={(e) => setComplexFilterId(e.target.value)}
                  className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">
                    همه مجموعه‌ها ({toPersianDigits(educationalComplexes.length)})
                  </option>
                  {educationalComplexes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  data-testid="branding-school-search-input"
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  placeholder="جستجوی سریع مدرسه یا مجموعه..."
                  className="min-h-[38px] w-56 max-w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-xs text-slate-900 focus:border-[var(--brand-primary)] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Accessible grouped dropdown for instant jumping even with 50+ schools */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
            <label
              htmlFor="super-admin-branding-school-select"
              className="text-xs font-bold text-slate-600 dark:text-slate-300 sm:col-span-3"
            >
              واحد آموزشی انتخابی:
            </label>
            <select
              id="super-admin-branding-school-select"
              data-testid="super-admin-branding-school-select"
              value={targetSchool.id}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-[var(--brand-primary)] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:col-span-9"
            >
              {educationalComplexes.map((complex) => {
                const group = filteredAdminSchools.filter(
                  (s) => (s.complexId ?? DEFAULT_COMPLEX_ID) === complex.id
                );
                if (group.length === 0) return null;
                return (
                  <optgroup key={complex.id} label={complex.name}>
                    {group.map((school) => {
                      const cfg = brandingBySchoolId.get(school.id);
                      const customLbl = cfg?.schoolDisplayName?.trim();
                      return (
                        <option key={school.id} value={school.id}>
                          {complex.name} — {school.name}
                          {customLbl && customLbl !== school.name ? ` (${customLbl})` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                );
              })}
              {/* Fallback for any school whose complexId isn't listed */}
              {filteredAdminSchools
                .filter(
                  (s) =>
                    !educationalComplexes.some(
                      (c) => c.id === (s.complexId ?? DEFAULT_COMPLEX_ID)
                    )
                )
                .map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Interactive Dynamic School Strip */}
          {filteredAdminSchools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              مدرسه‌ای مطابق عبارت «{schoolSearch}» یافت نشد.
            </div>
          ) : (
            <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {filteredAdminSchools.map((school) => {
                const isSelected = school.id === targetSchool.id;
                const cfg = brandingBySchoolId.get(school.id);
                const thumbLogo = cfg?.logoDataUrl || school.logoDataUrl || null;
                const cName =
                  complexNameById.get(school.complexId ?? DEFAULT_COMPLEX_ID) ?? 'مجموعه مدارس';
                const schoolLocked = isSchoolUnderPanicLock(panicModeState, school.id);
                const hasCustom = Boolean(
                  cfg?.logoDataUrl ||
                    school.logoDataUrl ||
                    (cfg?.schoolDisplayName && cfg.schoolDisplayName !== school.name) ||
                    cfg?.printSubtitle
                );
                return (
                  <button
                    key={school.id}
                    type="button"
                    data-branding-school-card={school.id}
                    onClick={() => setSelectedSchoolId(school.id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-right transition-colors ${
                      isSelected
                        ? 'border-[var(--brand-primary)] bg-white ring-2 ring-[var(--brand-ring)] dark:bg-slate-900'
                        : 'border-slate-200 bg-white/80 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-slate-600'
                    }`}
                  >
                    <SystemBrandLogo
                      logoDataUrl={thumbLogo}
                      size="xs"
                      alt={school.name}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                          {cfg?.schoolDisplayName?.trim() || school.name}
                        </span>
                        {schoolLocked && (
                          <AlertOctagon
                            className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400"
                            aria-label="قفل اضطراری فعال"
                          />
                        )}
                      </div>
                      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {cName} · {GRADE_LEVEL_LABELS[school.gradeLevel ?? 'elementary']}
                      </div>
                    </div>
                    {hasCustom && (
                      <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        سفارشی
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Read-Only Guard Banners (Panic Mode & Archived Academic Year) */}
      {isPanicLocked && (
        <div
          role="alert"
          data-testid="branding-panic-lock-banner"
          className="flex items-center gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
        >
          <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>
            قفل اضطراری سامانه برای «{targetSchool.name}» فعال است — بارگذاری لوگو و ویرایش سربرگ چاپی تا رفع قفل توسط راهبر ارشد غیرفعال می‌باشد.
          </span>
        </div>
      )}

      {!isPanicLocked && isArchivedLocked && (
        <div
          role="alert"
          data-testid="branding-archive-lock-banner"
          className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            در حالت مشاهده سال تحصیلی آرشیو، تنظیمات لوگو و سربرگ چاپی مدرسه فقط‌خواندنی است.
          </span>
        </div>
      )}

      {/* Feedback Banner */}
      {statusFeedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
            statusFeedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {statusFeedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          )}
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* Main Editor Grid */}
      <form onSubmit={(e) => void handleSave(e)} className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Right Column (RTL Start): Logo Upload + Display Name + Print Subtitle */}
        <div className="space-y-4 lg:col-span-7">
          {/* Logo Upload Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900">
                  {logoDraft ? (
                    <img
                      src={logoDraft}
                      alt={previewDisplayName}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <SystemBrandLogo
                      logoDataUrl={globalSystemConfig?.systemLogoDataUrl}
                      size="lg"
                      alt={previewDisplayName}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    لوگوی اختصاصی {targetSchool.name}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                    فرمت مجاز: PNG، JPG یا WebP (حداکثر ۲ مگابایت، فشرده‌سازی خودکار).
                    {logoSizeKb !== null && (
                      <span className="mr-1 font-bold text-emerald-700 dark:text-emerald-400">
                        حجم فشرده: {toPersianDigits(logoSizeKb)} کیلوبایت
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                    readOnly
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                      : 'cursor-pointer border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ImagePlus className="h-4 w-4 shrink-0 brand-text" />
                  <span>بارگذاری لوگوی مدرسه</span>
                  <input
                    type="file"
                    data-testid="school-logo-file-input"
                    disabled={readOnly}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileSelected}
                    className="hidden"
                  />
                </label>

                {logoDraft && !readOnly && (
                  <button
                    type="button"
                    data-testid="remove-school-logo-btn"
                    onClick={handleRemoveLogo}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف لوگو</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name & Official Print Subtitle */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`branding-display-name-${targetSchool.id}`}
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                نام نمایشی مدرسه در سربرگ
              </label>
              <input
                id={`branding-display-name-${targetSchool.id}`}
                data-testid="branding-display-name-input"
                type="text"
                maxLength={140}
                disabled={readOnly}
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                placeholder={targetSchool.name}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:border-[var(--brand-primary)] focus:bg-white focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor={`branding-print-subtitle-${targetSchool.id}`}
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                زیرعنوان رسمی برگه‌های چاپی
              </label>
              <input
                id={`branding-print-subtitle-${targetSchool.id}`}
                data-testid="branding-print-subtitle-input"
                type="text"
                maxLength={200}
                disabled={readOnly}
                value={printSubtitleDraft}
                onChange={(e) => setPrintSubtitleDraft(e.target.value)}
                placeholder={targetSchool.letterheadSubtitle || targetComplexName}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:border-[var(--brand-primary)] focus:bg-white focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>مجموعه: {targetComplexName}</span>
              <span aria-hidden="true">·</span>
              <span>
                شناسه واحد:{' '}
                <span className="font-mono" dir="ltr">
                  {targetSchool.id}
                </span>
              </span>
              {hasUnsavedChanges && !readOnly && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    تغییرات ذخیره‌نشده
                  </span>
                </>
              )}
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={handleResetDraftToSchoolDefaults}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>بازگردانی نام پیش‌فرض</span>
              </button>
            )}
          </div>
        </div>

        {/* Left Column (RTL End): Live Sidebar & A4/A5 Print Letterhead Preview */}
        <div className="space-y-3 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                <Eye className="h-4 w-4 brand-text" />
                <span>پیش‌نمایش زنده هدر و چاپ A4 / A5</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                اعمال فوری پس از ذخیره
              </span>
            </div>

            {/* Live Sidebar Header Mini-Preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-1.5 text-[10px] font-bold text-slate-400">
                نمای هدر منوی کناری
              </div>
              <div className="flex items-center gap-2.5">
                <SystemBrandLogo
                  logoDataUrl={logoDraft || globalSystemConfig?.systemLogoDataUrl}
                  size="sm"
                  alt={previewDisplayName}
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                    {previewDisplayName}
                  </div>
                  <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {activeAppTitle}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Pure-White A4/A5 Print Letterhead Preview */}
            <div className="rounded-xl border border-slate-300 bg-white p-3 text-slate-900 shadow-xs">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  نمای سربرگ رسمی چاپ (زمینه سفید استاندارد)
                </span>
                <span>A4 / A5</span>
              </div>
              <div className="flex items-start justify-between gap-2 border-b-2 border-slate-900 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={previewLogoEffective}
                    alt={previewDisplayName}
                    className="h-9 w-9 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-slate-950">
                      {previewDisplayName}
                    </div>
                    <div className="truncate text-[10px] text-slate-600">
                      {previewPrintSubtitle}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-left text-[9px] leading-4 text-slate-600 tabular-nums">
                  <div>سال {toPersianDigits(targetSchool.academicYear)}</div>
                  <div>{todayJalaliDisplay}</div>
                </div>
              </div>
            </div>
          </div>

          {lastUpdatedMeta && (
            <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              آخرین تغییر ثبت‌شده در گزارش امنیتی: توسط{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {lastUpdatedMeta.byName}
              </strong>
              {lastUpdatedMeta.roleFa ? ` (${lastUpdatedMeta.roleFa})` : ''}
              {lastUpdatedMeta.dateJalali ? ` در تاریخ ${lastUpdatedMeta.dateJalali}` : ''}
            </div>
          )}
        </div>
      </form>
    </section>
  );
};
