// Pure TypeScript Helpers for Core Appearance, Theme Palette, Fonts, Dynamic Section Labels & Logo Validation
import type {
  AccentPresetId,
  CornerStyleId,
  FontScalePercent,
  PersianFontId,
  SchoolBrandingConfig,
  SidebarDensityId,
  SurfaceTintId,
  ThemeModeId,
  UserAppearancePreference,
} from '../../types/domain';

export interface AccentPresetOption {
  id: Exclude<AccentPresetId, 'custom'>;
  labelFa: string;
  hex: string;
  descriptionFa: string;
}

export const ACCENT_PRESETS: AccentPresetOption[] = [
  {
    id: 'navy',
    labelFa: 'سرمه‌ای ملایم (پیشفرض)',
    hex: '#2b5b84',
    descriptionFa: 'آرام، رسمی و مناسب کار طولانی روزانه',
  },
  {
    id: 'sky',
    labelFa: 'آبی آرام',
    hex: '#2b5b84',
    descriptionFa: 'شفاف و مناسب محیط‌های آموزشی',
  },
  {
    id: 'emerald',
    labelFa: 'سبز زمردی',
    hex: '#059669',
    descriptionFa: 'آرامش‌بخش و متعادل برای کار طولانی',
  },
  {
    id: 'royal',
    labelFa: 'بنفش شاهانه',
    hex: '#7c3aed',
    descriptionFa: 'متمایز و مدرن برای پنل‌های هوشمند',
  },
  {
    id: 'orange',
    labelFa: 'نارنجی پرانرژی',
    hex: '#ea580c',
    descriptionFa: 'پویا و شاخص برای تاکید روی دکمه‌ها',
  },
  {
    id: 'crimson',
    labelFa: 'زرشکی اصیل',
    hex: '#be123c',
    descriptionFa: 'کلاسیک و باوقار با کنتراست بالا',
  },
];

export interface SurfaceTintOption {
  id: SurfaceTintId;
  labelFa: string;
  swatchHex: string;
  borderHex: string;
}

export const SURFACE_TINT_OPTIONS: SurfaceTintOption[] = [
  { id: 'classic_white', labelFa: 'سفید کلاسیک', swatchHex: '#f8fafc', borderHex: '#cbd5e1' },
  { id: 'soft_gray', labelFa: 'خاکستری ملایم', swatchHex: '#e9edf2', borderHex: '#cbd5e1' },
  { id: 'pale_blue', labelFa: 'آبی خیلی کمرنگ', swatchHex: '#eaf3fc', borderHex: '#bfdbfe' },
  { id: 'calm_cream', labelFa: 'کرم آرامش‌بخش', swatchHex: '#f6f1e6', borderHex: '#e7dcc8' },
];

export interface PersianFontOption {
  id: PersianFontId;
  labelFa: string;
  shortLabelFa: string;
  sampleFa: string;
  bodyStack: string;
  headingStack: string;
  googleFontUrl?: string;
  quickSelectable?: boolean;
}

export const PERSIAN_FONT_OPTIONS: PersianFontOption[] = [
  {
    id: 'vazirmatn',
    labelFa: 'وزیرمتن (پیشفرض فارسی)',
    shortLabelFa: 'وزیرمتن',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif",
    headingStack: "'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif",
    quickSelectable: true,
  },
  {
    id: 'sahel',
    labelFa: 'ساحل / تاهوما (اداری و خوانا)',
    shortLabelFa: 'ساحل / تاهوما',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "'Sahel', Tahoma, 'Vazirmatn', sans-serif",
    headingStack: "'Sahel', Tahoma, 'Vazirmatn', sans-serif",
    quickSelectable: true,
  },
  {
    id: 'iransans',
    labelFa: 'هندسی مدرن (سبک ایران‌سنس)',
    shortLabelFa: 'هندسی مدرن',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "'Rubik', 'Vazirmatn', Tahoma, sans-serif",
    headingStack: "'Rubik', 'Vazirmatn', Tahoma, sans-serif",
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap',
    quickSelectable: true,
  },
  {
    id: 'vazirmatn_rounded',
    labelFa: 'نرم و سیستمی (آفلاین سریع)',
    shortLabelFa: 'سیستمی نرم',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Vazirmatn', Tahoma, sans-serif",
    headingStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Vazirmatn', Tahoma, sans-serif",
    quickSelectable: true,
  },
  {
    id: 'rubik',
    labelFa: 'روبیک فارسی (نرم و خوانا)',
    shortLabelFa: 'روبیک',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "'Rubik', 'Vazirmatn', Tahoma, sans-serif",
    headingStack: "'Rubik', 'Vazirmatn', Tahoma, sans-serif",
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap',
  },
  {
    id: 'lalezar',
    labelFa: 'لاله‌زار + وزیرمتن (عناوین برجسته)',
    shortLabelFa: 'لاله‌زار',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "'Vazirmatn', Tahoma, sans-serif",
    headingStack: "'Lalezar', 'Vazirmatn', Tahoma, sans-serif",
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap',
  },
  {
    id: 'tahoma',
    labelFa: 'تاهوما کلاسیک (سبک اداری و سیدا)',
    shortLabelFa: 'تاهوما',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "Tahoma, 'Vazirmatn', sans-serif",
    headingStack: "Tahoma, 'Vazirmatn', sans-serif",
  },
  {
    id: 'system',
    labelFa: 'فونت سیستمی (سریع و کاملاً آفلاین)',
    shortLabelFa: 'سیستمی',
    sampleFa: 'سامانه هوشمند مدارس گلستان راه روشن — ۱۴۰۵',
    bodyStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif",
    headingStack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif",
  },
];

export const QUICK_FONT_OPTIONS: PersianFontOption[] = PERSIAN_FONT_OPTIONS.filter(
  (f) => f.quickSelectable
);

export const THEME_MODE_OPTIONS: Array<{
  id: ThemeModeId;
  labelFa: string;
  shortLabelFa: string;
  descriptionFa: string;
}> = [
  {
    id: 'light',
    labelFa: 'حالت روشن',
    shortLabelFa: 'روشن',
    descriptionFa: 'پس‌زمینه سفید تمیز با کنتراست استاندارد روز',
  },
  {
    id: 'dark',
    labelFa: 'حالت شب (تاریک)',
    shortLabelFa: 'شب',
    descriptionFa: 'مناسب کار شبانه و کاهش خستگی چشم',
  },
];

export const FONT_SCALE_OPTIONS: FontScalePercent[] = [90, 100, 110, 120];

export const QUICK_FONT_SIZE_OPTIONS: Array<{ value: FontScalePercent; labelFa: string }> = [
  { value: 90, labelFa: 'کوچک' },
  { value: 100, labelFa: 'استاندارد' },
  { value: 110, labelFa: 'بزرگ' },
];

export const CORNER_STYLE_OPTIONS: Array<{ id: CornerStyleId; labelFa: string }> = [
  { id: 'sharp', labelFa: 'تیز و رسمی' },
  { id: 'balanced', labelFa: 'متعادل (پیشفرض)' },
  { id: 'rounded', labelFa: 'گرد و نرم' },
];

export const SIDEBAR_DENSITY_OPTIONS: Array<{ id: SidebarDensityId; labelFa: string }> = [
  { id: 'standard', labelFa: 'استاندارد (راحت)' },
  { id: 'compact', labelFa: 'فشرده (نمایش آیتم بیشتر)' },
];

export const MAX_SCHOOL_LOGO_BYTES = 2 * 1024 * 1024; // 2MB hard guard

export function createDefaultAppearancePreference(
  userId: string,
  schoolId: string
): UserAppearancePreference {
  return {
    id: `${schoolId}:uap:${userId}`,
    schoolId,
    userId,
    themeMode: 'light',
    surfaceTint: 'classic_white',
    accentPreset: 'navy',
    customAccentHex: '#2b5b84',
    fontFamily: 'vazirmatn',
    fontScale: 100,
    cornerStyle: 'balanced',
    sidebarDensity: 'standard',
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeHexColor(raw: string, fallback = '#1e3a8a'): string {
  const cleaned = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(cleaned)) return cleaned;
  if (/^#[0-9a-f]{3}$/.test(cleaned)) {
    return `#${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}${cleaned[3]}${cleaned[3]}`;
  }
  return fallback;
}

export function resolveActiveAccentHex(pref: Pick<UserAppearancePreference, 'accentPreset' | 'customAccentHex'>): string {
  if (pref.accentPreset === 'custom') {
    return normalizeHexColor(pref.customAccentHex, '#1e3a8a');
  }
  const found = ACCENT_PRESETS.find((p) => p.id === pref.accentPreset);
  return found ? found.hex : '#1e3a8a';
}

export interface BrandPaletteCssVars {
  '--brand-primary': string;
  '--brand-primary-hover': string;
  '--brand-primary-soft': string;
  '--brand-primary-soft-dark': string;
  '--brand-ring': string;
  '--brand-contrast-text': string;
}

/**
 * Computes consistent accessible CSS custom properties from any hex brand color.
 */
export function computeBrandPaletteVars(hexInput: string): BrandPaletteCssVars {
  const hex = normalizeHexColor(hexInput, '#1e3a8a');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Darken ~15% for hover states
  const dr = Math.max(0, Math.round(r * 0.85));
  const dg = Math.max(0, Math.round(g * 0.85));
  const db = Math.max(0, Math.round(b * 0.85));
  const hoverHex = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;

  // Relative luminance for automatic accessible button text contrast
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const contrastText = luminance > 0.68 ? '#0f172a' : '#ffffff';

  return {
    '--brand-primary': hex,
    '--brand-primary-hover': hoverHex,
    '--brand-primary-soft': `rgba(${r}, ${g}, ${b}, 0.11)`,
    '--brand-primary-soft-dark': `rgba(${r}, ${g}, ${b}, 0.24)`,
    '--brand-ring': `rgba(${r}, ${g}, ${b}, 0.35)`,
    '--brand-contrast-text': contrastText,
  };
}

export function getPersianFontConfig(fontId: PersianFontId): PersianFontOption {
  return PERSIAN_FONT_OPTIONS.find((f) => f.id === fontId) ?? PERSIAN_FONT_OPTIONS[0];
}

/**
 * Resolves a custom Persian section/menu title for the active school, falling back cleanly
 * to the default title when unset or blank.
 */
export function getSectionTitle(
  sectionLabels: Record<string, string> | undefined | null,
  sectionId: string,
  defaultTitle: string
): string {
  const custom = sectionLabels?.[sectionId];
  if (typeof custom === 'string' && custom.trim().length > 0) {
    return custom.trim();
  }
  return defaultTitle;
}

/**
 * Resolves the active school display name taking custom school branding into account.
 */
export function resolveSchoolDisplayName(
  branding: SchoolBrandingConfig | null | undefined,
  defaultSchoolName: string
): string {
  const custom = branding?.schoolDisplayName?.trim();
  return custom && custom.length > 0 ? custom : defaultSchoolName;
}

/**
 * Strict validator for school logo uploads (max 2MB, PNG/JPG/WebP only — blocks SVG/HTML/scripts).
 */
export function validateSchoolLogoFile(meta: {
  name: string;
  type: string;
  size: number;
}): { ok: boolean; errorFa?: string } {
  const lowerName = meta.name.trim().toLowerCase();
  const lowerType = meta.type.trim().toLowerCase();

  if (
    lowerType.includes('svg') ||
    lowerType.includes('html') ||
    lowerType.includes('javascript') ||
    lowerName.endsWith('.svg') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.js')
  ) {
    return {
      ok: false,
      errorFa: 'فرمت SVG یا فایل‌های اجرایی به دلایل امنیتی مجاز نیستند. لطفاً تصویر PNG، JPG یا WebP انتخاب کنید.',
    };
  }

  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  const allowedExt = /\.(png|jpe?g|webp)$/i.test(lowerName);
  if (!allowedTypes.has(lowerType) && !allowedExt) {
    return {
      ok: false,
      errorFa: 'فقط تصاویر با فرمت PNG، JPG یا WebP برای لوگوی مدرسه پشتیبانی می‌شوند.',
    };
  }

  if (meta.size <= 0) {
    return { ok: false, errorFa: 'فایل انتخاب‌شده خالی است.' };
  }

  if (meta.size > MAX_SCHOOL_LOGO_BYTES) {
    return {
      ok: false,
      errorFa: 'حجم فایل لوگو نباید بیشتر از ۲ مگابایت باشد.',
    };
  }

  return { ok: true };
}

// Safe localStorage instant-load cache keyed per (userId, schoolId)
const APPEARANCE_CACHE_PREFIX = 'smart_school_appearance_v1:';

export function loadCachedAppearance(
  userId: string,
  schoolId: string
): UserAppearancePreference | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${APPEARANCE_CACHE_PREFIX}${schoolId}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserAppearancePreference>;
    if (!parsed || typeof parsed !== 'object') return null;
    const def = createDefaultAppearancePreference(userId, schoolId);
    return {
      ...def,
      ...parsed,
      id: `${schoolId}:uap:${userId}`,
      schoolId,
      userId,
    };
  } catch {
    return null;
  }
}

export function saveCachedAppearance(pref: UserAppearancePreference): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      `${APPEARANCE_CACHE_PREFIX}${pref.schoolId}:${pref.userId}`,
      JSON.stringify(pref)
    );
  } catch {
    // ignore storage quota errors
  }
}
