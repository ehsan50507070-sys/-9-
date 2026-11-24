// Pure TypeScript Governance, Dynamic Multi-Complex/School, Granular Permissions, Global Label & Login Studio Helpers
import { getTodayJalali } from '../../lib/jalali';
import { toAsciiDigits } from '../../lib/digits';
import type {
  AccentTheme,
  AuthSession,
  EducationalComplex,
  GlobalSystemConfig,
  LoginBackgroundConfig,
  LoginBgPresetId,
  ManageableRoleId,
  ManagedAdminAccount,
  ModulePermissionSet,
  PermissionAction,
  RoleGovernanceConfig,
  RoleId,
  School,
  SchoolGradeLevel,
  SchoolPluginState,
  SuperAdminAuditCategory,
  SuperAdminAuditEntry,
  TeacherDevSchoolSettings,
} from '../../types/domain';
import { MANAGEABLE_ROLES, ROLE_DEFINITIONS } from '../auth/rbac';
import {
  OFFICIAL_COMPLEX_NAME_FA,
  OFFICIAL_SYSTEM_NAME_FA,
  OFFICIAL_SYSTEM_SHORT_NAME_FA,
} from '../branding/BrandLogo';
import type { PluginManifest } from '../plugins/types';
import { hashPasswordSync } from '../security/cryptoService';

export const GLOBAL_TENANT_ID = '__global__';
export const DEFAULT_COMPLEX_ID = 'complex-1';

export const GRADE_LEVEL_LABELS: Record<SchoolGradeLevel, string> = {
  elementary: 'ابتدایی',
  middle: 'متوسطه اول',
  high: 'متوسطه دوم',
};

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'مشاهده',
  create: 'ثبت و ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  export: 'چاپ و خروجی',
};

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export'];

export type GlobalLabelCategory = 'identity' | 'menus' | 'terminology';

export interface GlobalLabelCatalogItem {
  key: string;
  category: GlobalLabelCategory;
  labelFa: string;
  defaultValue: string;
  hintFa?: string;
}

export const GLOBAL_LABEL_CATEGORY_LABELS: Record<GlobalLabelCategory, string> = {
  identity: 'هویت و متون اصلی سامانه',
  menus: 'عناوین منوها و بسته‌های الحاقی',
  terminology: 'واژگان کلیدی سامانه',
};

export const IDENTITY_LABEL_ITEMS: GlobalLabelCatalogItem[] = [
  {
    key: 'site.name',
    category: 'identity',
    labelFa: 'نام اصلی سامانه',
    defaultValue: OFFICIAL_SYSTEM_NAME_FA,
    hintFa: 'نمایش در سربرگ صفحه ورود، عنوان مرورگر و هدر',
  },
  {
    key: 'site.short_name',
    category: 'identity',
    labelFa: 'نام کوتاه نوار کناری',
    defaultValue: OFFICIAL_SYSTEM_SHORT_NAME_FA,
    hintFa: 'نمایش در بالای منوی کناری',
  },
  {
    key: 'site.subtitle',
    category: 'identity',
    labelFa: 'زیرعنوان سامانه',
    defaultValue: 'پلتفرم یکپارچه مدیریت آموزشی و پرورشی مجموعه مدارس گلستان راه روشن',
    hintFa: 'نمایش زیر نام سامانه در صفحه ورود',
  },
  {
    key: 'login.welcome_title',
    category: 'identity',
    labelFa: 'عنوان خوش‌آمدگویی صفحه ورود',
    defaultValue: 'ورود رسمی به سامانه',
  },
  {
    key: 'login.welcome_subtitle',
    category: 'identity',
    labelFa: 'متن راهنمای خوش‌آمدگویی صفحه ورود',
    defaultValue: 'نقش کاربری خود را انتخاب کرده و نام کاربری و رمز عبور خود را وارد نمایید.',
  },
  {
    key: 'site.footer',
    category: 'identity',
    labelFa: 'متن پاورقی صفحه ورود و گزارش‌ها',
    defaultValue: 'سامانه هوشمند مدارس گلستان راه روشن — تمامی حقوق و داده‌ها با ایزوله‌سازی کامل مدارس محفوظ است.',
  },
];

export const TERMINOLOGY_LABEL_ITEMS: GlobalLabelCatalogItem[] = [
  { key: 'term.school', category: 'terminology', labelFa: 'واژه «مدرسه»', defaultValue: 'مدرسه' },
  { key: 'term.complex', category: 'terminology', labelFa: 'واژه «مجموعه آموزشی»', defaultValue: 'مجموعه آموزشی' },
  { key: 'term.complex_admin', category: 'terminology', labelFa: 'واژه «مدیر کل»', defaultValue: 'مدیر کل' },
  { key: 'term.principal', category: 'terminology', labelFa: 'واژه «مدیر مدرسه»', defaultValue: 'مدیر مدرسه' },
  { key: 'term.deputy', category: 'terminology', labelFa: 'واژه «معاون»', defaultValue: 'معاون' },
  { key: 'term.counselor', category: 'terminology', labelFa: 'واژه «مشاور مدرسه»', defaultValue: 'مشاور مدرسه' },
  { key: 'term.teacher', category: 'terminology', labelFa: 'واژه «معلم»', defaultValue: 'معلم' },
  { key: 'term.student', category: 'terminology', labelFa: 'واژه «دانش‌آموز»', defaultValue: 'دانش‌آموز' },
  { key: 'term.parent', category: 'terminology', labelFa: 'واژه «ولی»', defaultValue: 'ولی' },
  { key: 'term.class', category: 'terminology', labelFa: 'واژه «کلاس»', defaultValue: 'کلاس' },
  { key: 'term.subject', category: 'terminology', labelFa: 'واژه «درس»', defaultValue: 'درس' },
  { key: 'term.period', category: 'terminology', labelFa: 'واژه «زنگ»', defaultValue: 'زنگ' },
  { key: 'term.homework', category: 'terminology', labelFa: 'واژه «تکلیف»', defaultValue: 'تکلیف' },
  { key: 'term.exam', category: 'terminology', labelFa: 'واژه «آزمون»', defaultValue: 'آزمون' },
  { key: 'term.report_card', category: 'terminology', labelFa: 'واژه «کارنامه»', defaultValue: 'کارنامه' },
];

export function buildMenuLabelItems(manifests: PluginManifest[]): GlobalLabelCatalogItem[] {
  return manifests
    .filter((m) => m.implemented && m.id !== 'super-admin')
    .map((m) => ({
      key: `menu.${m.id}`,
      category: 'menus' as const,
      labelFa: `منوی «${m.nameFa}»`,
      defaultValue: m.shortNameFa,
      hintFa: `فاز ${m.phase} · مسیر ${m.route}`,
    }));
}

export function buildFullLabelCatalog(manifests: PluginManifest[]): GlobalLabelCatalogItem[] {
  return [...IDENTITY_LABEL_ITEMS, ...buildMenuLabelItems(manifests), ...TERMINOLOGY_LABEL_ITEMS];
}

export function resolveGlobalLabel(
  globalLabels: Record<string, string> | undefined | null,
  schoolSectionLabels: Record<string, string> | undefined | null,
  key: string,
  defaultText: string
): string {
  const directGlobal = globalLabels?.[key];
  if (typeof directGlobal === 'string' && directGlobal.trim().length > 0) {
    return directGlobal.trim();
  }
  if (key.startsWith('menu.')) {
    const sectionId = key.slice('menu.'.length);
    const schoolCustom = schoolSectionLabels?.[sectionId];
    if (typeof schoolCustom === 'string' && schoolCustom.trim().length > 0) {
      return schoolCustom.trim();
    }
  } else {
    const menuGlobal = globalLabels?.[`menu.${key}`];
    if (typeof menuGlobal === 'string' && menuGlobal.trim().length > 0) {
      return menuGlobal.trim();
    }
    const schoolCustom = schoolSectionLabels?.[key];
    if (typeof schoolCustom === 'string' && schoolCustom.trim().length > 0) {
      return schoolCustom.trim();
    }
  }
  return defaultText;
}

// --- 5 Curated Offline Educational Login Background Presets (Pure SVG Data URIs / CSS Gradients) ---

export interface LoginBgPresetDefinition {
  id: LoginBgPresetId;
  titleFa: string;
  descriptionFa: string;
  cssBackground: string;
  previewSwatch: string;
  defaultOverlayTone: 'dark' | 'light';
}

function encodeSvgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`;
}

export const LOGIN_BG_PRESETS: LoginBgPresetDefinition[] = [
  {
    id: 'classic_clean',
    titleFa: 'ساده و اداری (پیشفرض)',
    descriptionFa: 'پس‌زمینه تمیز و آرام با خطوط هندسی بسیار ملایم',
    cssBackground: `radial-gradient(circle at 15% 15%, rgba(2, 132, 199, 0.10), transparent 45%), radial-gradient(circle at 85% 85%, rgba(79, 70, 229, 0.08), transparent 45%), linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)`,
    previewSwatch: 'linear-gradient(135deg, #e0f2fe 0%, #f1f5f9 100%)',
    defaultOverlayTone: 'light',
  },
  {
    id: 'aurora_edu',
    titleFa: 'شفق آبی آموزشی',
    descriptionFa: 'ترکیب سرمه‌ای عمیق و آبی آسمانی با بافت هندسی نرم',
    cssBackground: `${encodeSvgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='rgba(255,255,255,0.08)' stroke-width='1'><circle cx='60' cy='60' r='48'/><path d='M0 60h120M60 0v120'/></g></svg>`
    )}, linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #0284c7 100%)`,
    previewSwatch: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0284c7 100%)',
    defaultOverlayTone: 'dark',
  },
  {
    id: 'geometric_arch',
    titleFa: 'طاق هندسی ایرانی',
    descriptionFa: 'الگوی اسلیمی و هندسی الهام‌گرفته از معماری مدارس ایرانی',
    cssBackground: `${encodeSvgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><g fill='none' stroke='rgba(255,255,255,0.12)' stroke-width='1.2'><polygon points='48,6 90,48 48,90 6,48'/><polygon points='48,20 76,48 48,76 20,48'/><circle cx='48' cy='48' r='8'/></g></svg>`
    )}, linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #0369a1 100%)`,
    previewSwatch: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #0369a1 100%)',
    defaultOverlayTone: 'dark',
  },
  {
    id: 'emerald_campus',
    titleFa: 'پردیس زمردی روشن',
    descriptionFa: 'طیف سبز ملایم و آرامش‌بخش مناسب فضاهای فرهنگی و آموزشی',
    cssBackground: `${encodeSvgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='rgba(6,95,70,0.09)' stroke-width='1'><path d='M0 40 Q20 20 40 40 T80 40'/><path d='M0 80 Q20 60 40 80 T80 80'/></g></svg>`
    )}, linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #e0f2fe 100%)`,
    previewSwatch: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 55%, #bae6fd 100%)',
    defaultOverlayTone: 'light',
  },
  {
    id: 'midnight_slate',
    titleFa: 'سنگ‌تخته‌ای شبانه',
    descriptionFa: 'پس‌زمینه تیره باوقار با خطوط شبکه‌ای مهندسی',
    cssBackground: `${encodeSvgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><path d='M64 0H0v64' fill='none' stroke='rgba(148,163,184,0.12)' stroke-width='1'/></svg>`
    )}, linear-gradient(135deg, #020617 0%, #0f172a 55%, #1e293b 100%)`,
    previewSwatch: 'linear-gradient(135deg, #020617 0%, #1e293b 100%)',
    defaultOverlayTone: 'dark',
  },
];

export function createDefaultLoginBackgroundConfig(): LoginBackgroundConfig {
  return {
    mode: 'preset',
    presetId: 'classic_clean',
    blurPx: 0,
    overlayOpacity: 15,
    overlayTone: 'light',
  };
}

export function clampLoginBackgroundConfig(
  cfg: Partial<LoginBackgroundConfig>,
  base: LoginBackgroundConfig = createDefaultLoginBackgroundConfig()
): LoginBackgroundConfig {
  const blur = typeof cfg.blurPx === 'number' && Number.isFinite(cfg.blurPx) ? cfg.blurPx : base.blurPx;
  const opacity =
    typeof cfg.overlayOpacity === 'number' && Number.isFinite(cfg.overlayOpacity)
      ? cfg.overlayOpacity
      : base.overlayOpacity;
  return {
    ...base,
    ...cfg,
    blurPx: Math.max(0, Math.min(20, Math.round(blur))),
    overlayOpacity: Math.max(0, Math.min(80, Math.round(opacity))),
    overlayTone: cfg.overlayTone === 'dark' || cfg.overlayTone === 'light' ? cfg.overlayTone : base.overlayTone,
  };
}

export function getLoginBgPreset(presetId: LoginBgPresetId): LoginBgPresetDefinition {
  return LOGIN_BG_PRESETS.find((p) => p.id === presetId) ?? LOGIN_BG_PRESETS[0];
}

// --- Granular Role Governance & Permission Matrix ---

export function buildDefaultPermissionsForRole(
  roleId: ManageableRoleId,
  manifests: PluginManifest[]
): Record<string, ModulePermissionSet> {
  const map: Record<string, ModulePermissionSet> = {};

  for (const manifest of manifests) {
    if (!manifest.implemented || manifest.id === 'super-admin' || manifest.id === 'data-vault') continue;
    // Plugin/Add-ons management is strictly exclusive to super_admin
    if (manifest.id === 'addons') {
      map[manifest.id] = { view: false, create: false, edit: false, delete: false, export: false };
      continue;
    }
    const allowed = manifest.allowedRoles.includes(roleId);

    if (!allowed) {
      map[manifest.id] = { view: false, create: false, edit: false, delete: false, export: false };
      continue;
    }

    if (roleId === 'complex_admin' || roleId === 'principal') {
      map[manifest.id] = { view: true, create: true, edit: true, delete: true, export: true };
    } else if (roleId === 'deputy') {
      const readOnlyForDeputy =
        manifest.id === 'teacher-development' || manifest.id === 'settings' || manifest.id === 'addons';
      map[manifest.id] = {
        view: true,
        create: !readOnlyForDeputy,
        edit: !readOnlyForDeputy,
        delete: false,
        export: true,
      };
    } else if (roleId === 'counselor') {
      const canManageCounseling = manifest.id === 'counseling' || manifest.id === 'leave-exit';
      map[manifest.id] = {
        view: true,
        create: canManageCounseling || manifest.id === 'parent-staff-chat',
        edit: manifest.id === 'counseling',
        delete: manifest.id === 'counseling',
        export: true,
      };
    } else if (roleId === 'teacher') {
      const canWrite =
        manifest.id !== 'dashboard' &&
        manifest.id !== 'timetable' &&
        manifest.id !== 'in-person-exams';
      map[manifest.id] = {
        view: true,
        create: canWrite,
        edit: canWrite,
        delete: false,
        export: true,
      };
    } else if (roleId === 'parent') {
      const interactiveParent =
        manifest.id === 'parent-staff-chat' ||
        manifest.id === 'class-chat' ||
        manifest.id === 'appointments' ||
        manifest.id === 'electronic-forms' ||
        manifest.id === 'finance' ||
        manifest.id === 'anonymous-surveys' ||
        manifest.id === 'discipline' ||
        manifest.id === 'leave-exit' ||
        manifest.id === 'counseling';
      map[manifest.id] = {
        view: true,
        create: interactiveParent,
        edit: false,
        delete: false,
        export:
          manifest.id === 'gradebook' ||
          manifest.id === 'finance' ||
          manifest.id === 'parent-portal' ||
          manifest.id === 'discipline' ||
          manifest.id === 'leave-exit',
      };
    } else {
      // student
      const interactiveStudent =
        manifest.id === 'homework' ||
        manifest.id === 'flipped-video' ||
        manifest.id === 'online-classroom' ||
        manifest.id === 'online-exams' ||
        manifest.id === 'class-chat' ||
        manifest.id === 'anonymous-surveys' ||
        manifest.id === 'counseling' ||
        manifest.id === 'virtual-classes';
      map[manifest.id] = {
        view: true,
        create: interactiveStudent,
        edit: false,
        delete: false,
        export: false,
      };
    }
  }

  return map;
}

export function buildDefaultRoleGovernanceConfigs(
  manifests: PluginManifest[]
): RoleGovernanceConfig[] {
  const nowIso = new Date().toISOString();
  return MANAGEABLE_ROLES.map((def) => {
    const roleId = def.id as ManageableRoleId;
    return {
      id: `role-gov:${roleId}`,
      schoolId: GLOBAL_TENANT_ID,
      roleId,
      displayTitleFa: def.labelFa,
      shortTitleFa: def.shortLabelFa,
      descriptionFa: def.descriptionFa,
      modulePermissions: buildDefaultPermissionsForRole(roleId, manifests),
      updatedAt: nowIso,
    };
  });
}

/**
 * Single source of truth for evaluating dynamic granular permissions across sidebar, routes, and UI actions.
 */
export function evaluateModulePermission(params: {
  role: RoleId;
  moduleId: string;
  action: PermissionAction;
  configs: RoleGovernanceConfig[];
  manifests: PluginManifest[];
}): boolean {
  const { role, moduleId, action, configs, manifests } = params;

  if (role === 'super_admin') return true;
  if (moduleId === 'super-admin' || moduleId === 'addons' || moduleId === 'data-vault') return false;

  const cfg = configs.find((c) => c.roleId === role);
  const perms = cfg?.modulePermissions?.[moduleId];
  if (perms) {
    if (action === 'view') return Boolean(perms.view);
    // Any write/export action requires view access as well
    return Boolean(perms.view && perms[action]);
  }

  // Fallback to static manifest allowedRoles when no governance override exists
  const manifest = manifests.find((m) => m.id === moduleId);
  if (!manifest) return false;
  const fallbackMap = buildDefaultPermissionsForRole(role as ManageableRoleId, [manifest]);
  const fallback = fallbackMap[moduleId];
  if (!fallback) return false;
  return action === 'view' ? fallback.view : Boolean(fallback.view && fallback[action]);
}

export function resolveRoleDisplayMeta(
  roleId: RoleId,
  configs: RoleGovernanceConfig[]
): { labelFa: string; shortLabelFa: string; descriptionFa: string } {
  const def = ROLE_DEFINITIONS[roleId];
  if (roleId === 'super_admin') {
    return {
      labelFa: def.labelFa,
      shortLabelFa: def.shortLabelFa,
      descriptionFa: def.descriptionFa,
    };
  }
  const custom = configs.find((c) => c.roleId === roleId);
  if (!custom) {
    return {
      labelFa: def.labelFa,
      shortLabelFa: def.shortLabelFa,
      descriptionFa: def.descriptionFa,
    };
  }
  return {
    labelFa: custom.displayTitleFa.trim() || def.labelFa,
    shortLabelFa: custom.shortTitleFa.trim() || def.shortLabelFa,
    descriptionFa: custom.descriptionFa.trim() || def.descriptionFa,
  };
}

// --- Multi-Complex & Multi-School Scoping Helpers ---

export function getSchoolComplexId(school: Pick<School, 'complexId'>): string {
  return school.complexId?.trim() || DEFAULT_COMPLEX_ID;
}

/**
 * Strictly computes the schools visible/switchable for the active session:
 * - super_admin: ALL active schools across ALL complexes
 * - complex_admin: ONLY schools belonging to their assigned complexId
 * - school-level roles: ONLY their assigned schoolId
 */
export function getVisibleSchoolsForSession(
  session: AuthSession | null,
  allSchools: School[]
): School[] {
  if (!session) return allSchools;
  if (session.role === 'super_admin') {
    return allSchools;
  }
  if (session.role === 'complex_admin') {
    const targetComplex = session.complexId?.trim() || DEFAULT_COMPLEX_ID;
    const scoped = allSchools.filter((s) => getSchoolComplexId(s) === targetComplex);
    return scoped.length > 0 ? scoped : allSchools.filter((s) => s.id === session.schoolId);
  }
  const own = allSchools.filter((s) => s.id === session.schoolId);
  return own.length > 0 ? own : allSchools.slice(0, 1);
}

// --- Dynamic School & Complex Creation Builders ---

export interface CreateSchoolInput {
  complexId: string;
  name: string;
  gradeLevel: SchoolGradeLevel;
  phone?: string;
  address?: string;
  logoDataUrl?: string;
  printHeaderSubtitle?: string;
  principalFullName?: string;
  principalUsername?: string;
  principalPassword?: string;
  createPrincipalAccount?: boolean;
  existingSchoolIds: string[];
  activePluginIds: string[];
}

export interface CreatedSchoolBundle {
  school: School;
  principalAccount?: ManagedAdminAccount;
  pluginStates: SchoolPluginState[];
  tdSettings: TeacherDevSchoolSettings;
}

export function createNewSchoolBundle(input: CreateSchoolInput): CreatedSchoolBundle {
  const nowIso = new Date().toISOString();
  const todayJalali = getTodayJalali();
  let nextIdx = input.existingSchoolIds.length + 1;
  while (input.existingSchoolIds.includes(`school-${nextIdx}`)) {
    nextIdx += 1;
  }
  const schoolId = `school-${nextIdx}`;
  const gradeLabel = GRADE_LEVEL_LABELS[input.gradeLevel];
  const accents: AccentTheme[] = ['indigo', 'emerald', 'violet'];
  const accent = accents[(nextIdx - 1) % accents.length];

  const principalUserId =
    input.createPrincipalAccount && input.principalUsername?.trim()
      ? `user-principal-${schoolId}`
      : undefined;

  const principalName = input.principalFullName?.trim() || `مدیر ${input.name.trim()}`;

  const school: School = {
    id: schoolId,
    schoolId,
    complexId: input.complexId,
    name: input.name.trim(),
    subtitle: `دوره ${gradeLabel}`,
    gradeLevel: input.gradeLevel,
    accent,
    principalName,
    principalUserId,
    phone: input.phone?.trim() || '۰۲۱-۰۰۰۰۰۰۰۰',
    address: input.address?.trim() || 'نشانی در تنظیمات مدرسه تکمیل شود',
    logoDataUrl: input.logoDataUrl,
    isActive: true,
    academicYear: '۱۴۰۵-۱۴۰۶',
    activeWorkdays: [0, 1, 2, 3, 4],
    holidays: [],
    letterheadTitle: input.name.trim(),
    letterheadSubtitle:
      input.printHeaderSubtitle?.trim() || `واحد آموزشی ${gradeLabel} · ${OFFICIAL_SYSTEM_NAME_FA}`,
    signatureFooter: `مهر و امضای مدیریت ${input.name.trim()}`,
    periodDurationMinutes: 75,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  let principalAccount: ManagedAdminAccount | undefined;
  if (input.createPrincipalAccount && input.principalUsername?.trim() && input.principalPassword?.trim()) {
    const hashed = hashPasswordSync(toAsciiDigits(input.principalPassword).trim());
    principalAccount = {
      id: principalUserId!,
      schoolId,
      complexId: input.complexId,
      role: 'principal',
      fullName: principalName,
      username: toAsciiDigits(input.principalUsername).trim().toLowerCase(),
      passwordHash: hashed.passwordHash,
      passwordSalt: hashed.passwordSalt,
      mustChangePassword: true,
      isActive: true,
      createdAtJalali: todayJalali,
      updatedAt: nowIso,
    };
  }

  const pluginStates: SchoolPluginState[] = input.activePluginIds.map((pluginId) => ({
    id: `${schoolId}:${pluginId}`,
    schoolId,
    pluginId,
    installed: true,
    enabled: true,
    updatedAt: nowIso,
    updatedBy: 'راهبر ارشد سامانه',
  }));

  const tdSettings: TeacherDevSchoolSettings = {
    id: `${schoolId}:tdsettings`,
    schoolId,
    rankingPrivacyMode: 'private',
    updatedByName: 'راهبر ارشد سامانه',
    updatedAt: nowIso,
  };

  return { school, principalAccount, pluginStates, tdSettings };
}

export interface CreateComplexInput {
  name: string;
  description?: string;
  logoDataUrl?: string;
  adminFullName: string;
  adminUsername: string;
  adminPassword: string;
  initialSchools: Array<{
    name: string;
    gradeLevel: SchoolGradeLevel;
    phone?: string;
    address?: string;
    principalFullName?: string;
    createPrincipalAccount?: boolean;
    principalUsername?: string;
    principalPassword?: string;
  }>;
  existingComplexIds: string[];
  existingSchoolIds: string[];
  activePluginIds: string[];
}

export interface CreatedComplexBundle {
  complex: EducationalComplex;
  adminAccount: ManagedAdminAccount;
  accounts: ManagedAdminAccount[];
  schools: School[];
  pluginStates: SchoolPluginState[];
  tdSettings: TeacherDevSchoolSettings[];
}

export function createNewComplexBundle(input: CreateComplexInput): CreatedComplexBundle {
  const nowIso = new Date().toISOString();
  const todayJalali = getTodayJalali();
  let nextIdx = input.existingComplexIds.length + 1;
  while (input.existingComplexIds.includes(`complex-${nextIdx}`)) {
    nextIdx += 1;
  }
  const complexId = `complex-${nextIdx}`;
  const adminUserId = `user-complex-admin-${complexId}`;

  const complex: EducationalComplex = {
    id: complexId,
    schoolId: GLOBAL_TENANT_ID,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    logoDataUrl: input.logoDataUrl,
    adminUserId,
    createdAtJalali: todayJalali,
    isActive: true,
    updatedAt: nowIso,
  };

  const adminHashed = hashPasswordSync(toAsciiDigits(input.adminPassword).trim());
  const adminAccount: ManagedAdminAccount = {
    id: adminUserId,
    schoolId: GLOBAL_TENANT_ID,
    complexId,
    role: 'complex_admin',
    fullName: input.adminFullName.trim(),
    username: toAsciiDigits(input.adminUsername).trim().toLowerCase(),
    passwordHash: adminHashed.passwordHash,
    passwordSalt: adminHashed.passwordSalt,
    mustChangePassword: true,
    isActive: true,
    createdAtJalali: todayJalali,
    updatedAt: nowIso,
  };

  const takenSchoolIds = [...input.existingSchoolIds];
  const schools: School[] = [];
  const pluginStates: SchoolPluginState[] = [];
  const tdSettings: TeacherDevSchoolSettings[] = [];
  const accounts: ManagedAdminAccount[] = [adminAccount];

  const seeds =
    input.initialSchools.length > 0
      ? input.initialSchools
      : [{ name: `${input.name.trim()} - واحد ۱`, gradeLevel: 'elementary' as SchoolGradeLevel }];

  for (const s of seeds) {
    const bundle = createNewSchoolBundle({
      complexId,
      name: s.name,
      gradeLevel: s.gradeLevel,
      phone: s.phone,
      address: s.address,
      principalFullName: s.principalFullName,
      createPrincipalAccount: s.createPrincipalAccount,
      principalUsername: s.principalUsername,
      principalPassword: s.principalPassword,
      existingSchoolIds: takenSchoolIds,
      activePluginIds: input.activePluginIds,
    });
    takenSchoolIds.push(bundle.school.id);
    schools.push(bundle.school);
    pluginStates.push(...bundle.pluginStates);
    tdSettings.push(bundle.tdSettings);
    if (bundle.principalAccount) {
      accounts.push(bundle.principalAccount);
    }
  }

  return { complex, adminAccount, accounts, schools, pluginStates, tdSettings };
}

// --- Seed Builder for Phase 8A Collections (Zero Data Loss for school-1/2/3) ---

export interface Phase8ASeedBundle {
  educational_complexes: EducationalComplex[];
  managed_admin_accounts: ManagedAdminAccount[];
  role_governance_configs: RoleGovernanceConfig[];
  global_system_configs: GlobalSystemConfig[];
  super_admin_audit_logs: SuperAdminAuditEntry[];
}

export function generatePhase8ASeedData(params: {
  schools: School[];
  manifests?: PluginManifest[];
}): Phase8ASeedBundle {
  const nowIso = new Date().toISOString();
  const todayJalali = getTodayJalali();

  const defaultComplex: EducationalComplex = {
    id: DEFAULT_COMPLEX_ID,
    schoolId: GLOBAL_TENANT_ID,
    name: OFFICIAL_COMPLEX_NAME_FA,
    adminUserId: 'user-complex-admin',
    createdAtJalali: todayJalali,
    isActive: true,
    updatedAt: nowIso,
  };

  // Bootstrap Super Admin (09120000001 / Admin@1404 with mandatory password change on first login)
  const superAdminCred = hashPasswordSync('Admin@1404');
  const complexAdminCred = hashPasswordSync('Complex@1404');

  const accounts: ManagedAdminAccount[] = [
    {
      id: 'user-super-admin',
      schoolId: GLOBAL_TENANT_ID,
      role: 'super_admin',
      fullName: 'راهبر ارشد سامانه گلستان راه روشن',
      username: '09120000001',
      passwordHash: superAdminCred.passwordHash,
      passwordSalt: superAdminCred.passwordSalt,
      mustChangePassword: true,
      isActive: true,
      createdAtJalali: todayJalali,
      updatedAt: nowIso,
    },
    {
      id: 'user-complex-admin',
      schoolId: GLOBAL_TENANT_ID,
      complexId: DEFAULT_COMPLEX_ID,
      role: 'complex_admin',
      fullName: 'دکتر امیرحسین راد',
      username: '09120000002',
      passwordHash: complexAdminCred.passwordHash,
      passwordSalt: complexAdminCred.passwordSalt,
      mustChangePassword: false,
      isActive: true,
      createdAtJalali: todayJalali,
      updatedAt: nowIso,
    },
  ];

  const deputyDefaults: Record<string, { fullName: string; username: string }> = {
    'school-1': { fullName: 'مهندس رضا شریفی (معاون اجرایی)', username: '09120000102' },
    'school-2': { fullName: 'خانم سمیه جلالی (معاون آموزشی)', username: '09120000202' },
    'school-3': { fullName: 'آقای مجید رحیمی (معاون اجرایی)', username: '09120000302' },
  };

  params.schools.forEach((school, idx) => {
    const num = idx + 1;
    const complexId = getSchoolComplexId(school);
    const principalCred = hashPasswordSync(`Modir@${1404 + num}`);
    accounts.push({
      id: `user-principal-${school.id}`,
      schoolId: school.id,
      complexId,
      role: 'principal',
      fullName: school.principalName,
      username: `09120000${num}01`,
      passwordHash: principalCred.passwordHash,
      passwordSalt: principalCred.passwordSalt,
      mustChangePassword: false,
      isActive: true,
      createdAtJalali: todayJalali,
      updatedAt: nowIso,
    });

    const dep = deputyDefaults[school.id] ?? {
      fullName: `معاون اجرایی ${school.name}`,
      username: `09120000${num}02`,
    };
    const deputyCred = hashPasswordSync(`Moaven@${1404 + num}`);
    accounts.push({
      id: `user-deputy-${school.id}`,
      schoolId: school.id,
      complexId,
      role: 'deputy',
      fullName: dep.fullName,
      username: dep.username,
      passwordHash: deputyCred.passwordHash,
      passwordSalt: deputyCred.passwordSalt,
      mustChangePassword: false,
      isActive: true,
      createdAtJalali: todayJalali,
      updatedAt: nowIso,
    });

    const counselorDefaults: Record<string, { fullName: string; username: string }> = {
      'school-1': { fullName: 'دکتر مریم کاظمی (مشاور مدرسه)', username: '09120000103' },
      'school-2': { fullName: 'خانم سارا نادری (مشاور مدرسه)', username: '09120000203' },
      'school-3': { fullName: 'دکتر محمدرضا حسینی (مشاور مدرسه)', username: '09120000303' },
    };
    const cns = counselorDefaults[school.id] ?? {
      fullName: `مشاور مدرسه ${school.name}`,
      username: `09120000${num}03`,
    };
    const counselorCred = hashPasswordSync(`Moshaver@${1404 + num}`);
    accounts.push({
      id: `user-counselor-${school.id}`,
      schoolId: school.id,
      complexId,
      role: 'counselor',
      fullName: cns.fullName,
      username: cns.username,
      passwordHash: counselorCred.passwordHash,
      passwordSalt: counselorCred.passwordSalt,
      mustChangePassword: false,
      isActive: true,
      createdAtJalali: todayJalali,
      updatedAt: nowIso,
    });
  });

  const roleConfigs = params.manifests ? buildDefaultRoleGovernanceConfigs(params.manifests) : [];

  const globalConfig: GlobalSystemConfig = {
    id: 'global-system-config',
    schoolId: GLOBAL_TENANT_ID,
    labels: {},
    loginBackground: createDefaultLoginBackgroundConfig(),
    updatedAt: nowIso,
  };

  const initialAudit: SuperAdminAuditEntry = {
    id: 'audit-init-phase8a',
    schoolId: GLOBAL_TENANT_ID,
    category: 'complex_school',
    actorName: 'سیستم راهبری کلان',
    summaryFa: `راه‌اندازی ${OFFICIAL_SYSTEM_NAME_FA} و اتصال ایمن ۳ واحد آموزشی به «${OFFICIAL_COMPLEX_NAME_FA}».`,
    timestampJalali: todayJalali,
    timestampIso: nowIso,
  };

  return {
    educational_complexes: [defaultComplex],
    managed_admin_accounts: accounts,
    role_governance_configs: roleConfigs,
    global_system_configs: [globalConfig],
    super_admin_audit_logs: [initialAudit],
  };
}

let auditSeqCounter = 0;

export function createAuditEntry(params: {
  category: SuperAdminAuditCategory;
  actorName: string;
  summaryFa: string;
  detailsFa?: string;
}): SuperAdminAuditEntry {
  auditSeqCounter += 1;
  const nowIso = new Date().toISOString();
  return {
    id: `audit-${Date.now()}-${auditSeqCounter}-${Math.random().toString(36).slice(2, 7)}`,
    schoolId: GLOBAL_TENANT_ID,
    category: params.category,
    actorName: params.actorName,
    summaryFa: params.summaryFa,
    detailsFa: params.detailsFa,
    timestampJalali: getTodayJalali(),
    timestampIso: nowIso,
  };
}

/**
 * Client-side HTML5 Canvas image compressor & resizer (maxWidth=1440px, JPEG quality ~0.72)
 * so uploaded login backgrounds and logos stay lightweight (~150-300KB) and never freeze storage.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options?: { maxWidth?: number; quality?: number; outputMime?: 'image/jpeg' | 'image/webp' | 'image/png' }
): Promise<{ ok: boolean; dataUrl?: string; sizeKb?: number; errorFa?: string }> {
  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();
  if (lowerType.includes('svg') || lowerName.endsWith('.svg') || lowerType.includes('html')) {
    return {
      ok: false,
      errorFa: 'فایل SVG به دلایل امنیتی مجاز نیست. لطفاً تصویر JPG، PNG یا WebP انتخاب کنید.',
    };
  }
  if (!lowerType.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(lowerName)) {
    return {
      ok: false,
      errorFa: 'فرمت تصویر معتبر نیست. لطفاً فایل JPG، PNG یا WebP انتخاب کنید.',
    };
  }

  const maxWidth = options?.maxWidth ?? 1440;
  const quality = options?.quality ?? 0.72;
  const outputMime = options?.outputMime ?? 'image/jpeg';

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, errorFa: 'خواندن فایل تصویر ناموفق بود.' });
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        resolve({ ok: false, errorFa: 'محتوای فایل تصویر خالی است.' });
        return;
      }
      const img = new Image();
      img.onerror = () => resolve({ ok: false, errorFa: 'پردازش تصویر انتخاب‌شده ناموفق بود.' });
      img.onload = () => {
        try {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const targetW = Math.max(1, Math.round(img.width * scale));
          const targetH = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ ok: false, errorFa: 'مرورگر امکان فشرده‌سازی تصویر را ندارد.' });
            return;
          }
          if (outputMime === 'image/jpeg') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, targetW, targetH);
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL(outputMime, quality);
          const sizeKb = Math.max(1, Math.round((dataUrl.length * 3) / 4 / 1024));
          resolve({ ok: true, dataUrl, sizeKb });
        } catch {
          resolve({ ok: false, errorFa: 'خطا در فشرده‌سازی تصویر.' });
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
