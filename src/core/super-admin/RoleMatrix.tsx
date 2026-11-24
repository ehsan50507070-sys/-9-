// Visual Interactive Role Permission Matrix for Super Admin (Direct Persistence to roleGovernanceConfigs)
import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Columns3,
  Eye,
  FilePlus2,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type {
  ManageableRoleId,
  ModulePermissionSet,
  PermissionAction,
  RoleGovernanceConfig,
} from '../../types/domain';
import { MANAGEABLE_ROLES } from '../auth/rbac';
import { useSchoolData } from '../data/DataContext';
import type { PluginManifest } from '../plugins/types';
import {
  GLOBAL_TENANT_ID,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  buildDefaultPermissionsForRole,
} from './superAdminHelpers';

type MatrixViewMode = 'cross_role' | 'single_role';

const ACTION_SHORT_LABELS: Record<PermissionAction, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  export: 'چاپ',
};

const SUB_ACTIONS: Exclude<PermissionAction, 'view'>[] = ['create', 'edit', 'delete', 'export'];

const ACTION_ICONS: Record<PermissionAction, React.ComponentType<{ className?: string }>> = {
  view: Eye,
  create: FilePlus2,
  edit: Pencil,
  delete: Trash2,
  export: Printer,
};

const PHASE_TITLES: Record<number, string> = {
  1: 'فاز ۱ · هسته و ساختار آموزشی',
  2: 'فاز ۲ · آموزش و کلاس‌های درس',
  3: 'فاز ۳ · ارزیابی و سنجش',
  4: 'فاز ۴ · ارتباطات و اولیا',
  5: 'فاز ۵ · ابزارهای تکمیلی و پرورشی',
  6: 'فاز ۶ · مالی، نظرسنجی و تحلیل',
  7: 'فاز ۷ · توسعه حرفه‌ای معلمان',
};

const EMPTY_PERMS: ModulePermissionSet = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
};

const FULL_PERMS: ModulePermissionSet = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  export: true,
};

function countActiveActions(perms: ModulePermissionSet): number {
  let count = 0;
  for (const act of PERMISSION_ACTIONS) {
    if (perms[act]) count += 1;
  }
  return count;
}

function getNormalizedRoleConfig(
  roleId: ManageableRoleId,
  configs: RoleGovernanceConfig[],
  manifests: PluginManifest[]
): RoleGovernanceConfig {
  const existing = configs.find((c) => c.roleId === roleId);
  const def = MANAGEABLE_ROLES.find((r) => r.id === roleId);
  if (existing) {
    return existing;
  }
  return {
    id: `role-gov:${roleId}`,
    schoolId: GLOBAL_TENANT_ID,
    roleId,
    displayTitleFa: def?.labelFa ?? roleId,
    shortTitleFa: def?.shortLabelFa ?? roleId,
    descriptionFa: def?.descriptionFa ?? '',
    modulePermissions: buildDefaultPermissionsForRole(roleId, manifests),
    updatedAt: new Date().toISOString(),
  };
}

function applyActionToggle(
  current: ModulePermissionSet,
  action: PermissionAction
): ModulePermissionSet {
  const nextValue = !current[action];
  if (action === 'view' && !nextValue) {
    return { ...EMPTY_PERMS };
  }
  if (action !== 'view' && nextValue) {
    return { ...current, view: true, [action]: true };
  }
  return { ...current, [action]: nextValue };
}

export const RoleMatrix: React.FC = () => {
  const {
    realSession,
    allManifests,
    roleGovernanceConfigs,
    saveRoleGovernanceConfig,
    resetAllRoleGovernanceConfigs,
  } = useSchoolData();

  const [viewMode, setViewMode] = useState<MatrixViewMode>('cross_role');
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [visibleRoles, setVisibleRoles] = useState<ManageableRoleId[]>(() =>
    MANAGEABLE_ROLES.map((r) => r.id as ManageableRoleId)
  );
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Single-role focused mode state (for role identity editing & single-role deep view)
  const [focusedRoleId, setFocusedRoleId] = useState<ManageableRoleId>('principal');
  const [roleTitleDrafts, setRoleTitleDrafts] = useState<
    Partial<Record<ManageableRoleId, { displayTitleFa: string; shortTitleFa: string; descriptionFa: string }>>
  >({});

  // Live feedback indicator for direct saves
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    timestamp: number;
  } | null>(null);

  const implementedModules = useMemo(
    () =>
      allManifests
        .filter((m) => m.implemented && m.id !== 'super-admin' && m.id !== 'data-vault')
        .sort((a, b) => a.phase - b.phase || a.nameFa.localeCompare(b.nameFa, 'fa')),
    [allManifests]
  );

  const availablePhases = useMemo(() => {
    const set = new Set<number>();
    for (const m of implementedModules) set.add(m.phase);
    return Array.from(set).sort((a, b) => a - b);
  }, [implementedModules]);

  const roleConfigMap = useMemo(() => {
    const map = {} as Record<ManageableRoleId, RoleGovernanceConfig>;
    for (const r of MANAGEABLE_ROLES) {
      const roleId = r.id as ManageableRoleId;
      map[roleId] = getNormalizedRoleConfig(roleId, roleGovernanceConfigs, allManifests);
    }
    return map;
  }, [roleGovernanceConfigs, allManifests]);

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return implementedModules.filter((m) => {
      if (phaseFilter !== 'all' && String(m.phase) !== phaseFilter) return false;
      if (!q) return true;
      return (
        m.nameFa.toLowerCase().includes(q) ||
        m.shortNameFa.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    });
  }, [implementedModules, searchQuery, phaseFilter]);

  const groupedByPhase = useMemo(() => {
    const groups = new Map<number, PluginManifest[]>();
    for (const mod of filteredModules) {
      const existing = groups.get(mod.phase);
      if (existing) existing.push(mod);
      else groups.set(mod.phase, [mod]);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredModules]);

  const displayedRoles = useMemo(
    () =>
      MANAGEABLE_ROLES.filter((r) => visibleRoles.includes(r.id as ManageableRoleId)).map(
        (r) => r.id as ManageableRoleId
      ),
    [visibleRoles]
  );

  // Access guard strictly for super_admin
  if (!realSession || realSession.role !== 'super_admin') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900/50 dark:bg-slate-900">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">
          دسترسی محدود به راهبر ارشد سامانه
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          مشاهده و ویرایش ماتریس دسترسی نقش‌ها صرفاً برای نقش «راهبر ارشد سامانه» مجاز است.
        </p>
      </div>
    );
  }

  const notify = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text, timestamp: Date.now() });
  };

  const getModulePerms = (roleId: ManageableRoleId, moduleId: string): ModulePermissionSet => {
    return roleConfigMap[roleId]?.modulePermissions?.[moduleId] ?? EMPTY_PERMS;
  };

  /**
   * Direct persistence helper — writes updated role permissions immediately into roleGovernanceConfigs.
   */
  const persistRolePermissions = (
    roleId: ManageableRoleId,
    nextModulePermissions: Record<string, ModulePermissionSet>,
    summaryText: string
  ) => {
    const baseCfg = roleConfigMap[roleId];
    const nextCfg: RoleGovernanceConfig = {
      ...baseCfg,
      id: `role-gov:${roleId}`,
      schoolId: GLOBAL_TENANT_ID,
      roleId,
      modulePermissions: nextModulePermissions,
      updatedAt: new Date().toISOString(),
    };
    const res = saveRoleGovernanceConfig(nextCfg);
    if (!res.ok) {
      notify('error', res.errorFa ?? 'خطا در ذخیره‌سازی تغییرات در ماتریس دسترسی‌ها.');
      return;
    }
    notify('success', summaryText);
  };

  const handleToggleAction = (
    roleId: ManageableRoleId,
    mod: PluginManifest,
    action: PermissionAction
  ) => {
    const baseCfg = roleConfigMap[roleId];
    const current = baseCfg.modulePermissions[mod.id] ?? EMPTY_PERMS;
    const nextPerms = applyActionToggle(current, action);
    const nextMap: Record<string, ModulePermissionSet> = {
      ...baseCfg.modulePermissions,
      [mod.id]: nextPerms,
    };
    const roleLabel = baseCfg.shortTitleFa || baseCfg.displayTitleFa;
    const actionLabel = ACTION_SHORT_LABELS[action];
    const stateLabel = nextPerms[action] ? 'فعال' : 'غیرفعال';
    persistRolePermissions(
      roleId,
      nextMap,
      `دسترسی «${actionLabel}» برای نقش «${roleLabel}» در ماژول «${mod.shortNameFa}» ${stateLabel} و ذخیره شد.`
    );
  };

  const handleToggleCellAll = (roleId: ManageableRoleId, mod: PluginManifest) => {
    const baseCfg = roleConfigMap[roleId];
    const current = baseCfg.modulePermissions[mod.id] ?? EMPTY_PERMS;
    const isAllOn = countActiveActions(current) === PERMISSION_ACTIONS.length;
    const nextPerms: ModulePermissionSet = isAllOn ? { ...EMPTY_PERMS } : { ...FULL_PERMS };
    const nextMap: Record<string, ModulePermissionSet> = {
      ...baseCfg.modulePermissions,
      [mod.id]: nextPerms,
    };
    const roleLabel = baseCfg.shortTitleFa || baseCfg.displayTitleFa;
    persistRolePermissions(
      roleId,
      nextMap,
      isAllOn
        ? `تمامی دسترسی‌های نقش «${roleLabel}» در «${mod.shortNameFa}» بسته و ذخیره شد.`
        : `دسترسی کامل نقش «${roleLabel}» در «${mod.shortNameFa}» فعال و ذخیره شد.`
    );
  };

  const handleResetSingleRole = (roleId: ManageableRoleId) => {
    const baseCfg = roleConfigMap[roleId];
    const def = MANAGEABLE_ROLES.find((r) => r.id === roleId);
    const defaults = buildDefaultPermissionsForRole(roleId, allManifests);
    const nextCfg: RoleGovernanceConfig = {
      ...baseCfg,
      id: `role-gov:${roleId}`,
      schoolId: GLOBAL_TENANT_ID,
      roleId,
      displayTitleFa: def?.labelFa ?? baseCfg.displayTitleFa,
      shortTitleFa: def?.shortLabelFa ?? baseCfg.shortTitleFa,
      descriptionFa: def?.descriptionFa ?? baseCfg.descriptionFa,
      modulePermissions: defaults,
      updatedAt: new Date().toISOString(),
    };
    const res = saveRoleGovernanceConfig(nextCfg);
    if (!res.ok) {
      notify('error', res.errorFa ?? 'خطا در بازگردانی پیشفرض نقش.');
      return;
    }
    setRoleTitleDrafts((prev) => {
      const next = { ...prev };
      delete next[roleId];
      return next;
    });
    notify('success', `دسترسی‌های نقش «${nextCfg.displayTitleFa}» به حالت پیشفرض بازگردانی شد.`);
  };

  const handleBulkColumnGrant = (roleId: ManageableRoleId, mode: 'view_only' | 'full' | 'none') => {
    const baseCfg = roleConfigMap[roleId];
    const nextMap: Record<string, ModulePermissionSet> = { ...baseCfg.modulePermissions };
    for (const mod of filteredModules) {
      if (mode === 'full') {
        nextMap[mod.id] = { ...FULL_PERMS };
      } else if (mode === 'view_only') {
        nextMap[mod.id] = { view: true, create: false, edit: false, delete: false, export: false };
      } else {
        nextMap[mod.id] = { ...EMPTY_PERMS };
      }
    }
    const roleLabel = baseCfg.shortTitleFa || baseCfg.displayTitleFa;
    const modeLabel =
      mode === 'full' ? 'دسترسی کامل' : mode === 'view_only' ? 'فقط مشاهده' : 'مسدودسازی';
    persistRolePermissions(
      roleId,
      nextMap,
      `عملیات گروهی «${modeLabel}» برای ${toPersianDigits(filteredModules.length)} ماژول فیلترشده نقش «${roleLabel}» ذخیره شد.`
    );
  };

  const handleConfirmResetAll = () => {
    const res = resetAllRoleGovernanceConfigs();
    setConfirmResetAll(false);
    if (!res.ok) {
      notify('error', res.errorFa ?? 'خطا در بازگردانی تنظیمات پیشفرض.');
      return;
    }
    setRoleTitleDrafts({});
    notify('success', 'ماتریس دسترسی تمامی ۶ نقش به تنظیمات پیشفرض سامانه بازگردانی شد.');
  };

  const toggleRoleVisibility = (roleId: ManageableRoleId) => {
    setVisibleRoles((prev) => {
      if (prev.includes(roleId)) {
        if (prev.length === 1) return prev; // Keep at least one role visible
        return prev.filter((id) => id !== roleId);
      }
      return [...prev, roleId];
    });
  };

  const togglePhaseCollapsed = (phase: number) => {
    setCollapsedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  // Single-role title editor helpers
  const focusedCfg = roleConfigMap[focusedRoleId];
  const focusedDraft = roleTitleDrafts[focusedRoleId] ?? {
    displayTitleFa: focusedCfg.displayTitleFa,
    shortTitleFa: focusedCfg.shortTitleFa,
    descriptionFa: focusedCfg.descriptionFa,
  };

  const updateFocusedDraft = (
    field: 'displayTitleFa' | 'shortTitleFa' | 'descriptionFa',
    value: string
  ) => {
    setRoleTitleDrafts((prev) => ({
      ...prev,
      [focusedRoleId]: {
        displayTitleFa: prev[focusedRoleId]?.displayTitleFa ?? focusedCfg.displayTitleFa,
        shortTitleFa: prev[focusedRoleId]?.shortTitleFa ?? focusedCfg.shortTitleFa,
        descriptionFa: prev[focusedRoleId]?.descriptionFa ?? focusedCfg.descriptionFa,
        [field]: value,
      },
    }));
  };

  const handleSaveRoleIdentity = () => {
    const cleanTitle = focusedDraft.displayTitleFa.trim();
    if (!cleanTitle) {
      notify('error', 'عنوان نمایشی نقش نمی‌تواند خالی باشد.');
      return;
    }
    const nextCfg: RoleGovernanceConfig = {
      ...focusedCfg,
      id: `role-gov:${focusedRoleId}`,
      schoolId: GLOBAL_TENANT_ID,
      roleId: focusedRoleId,
      displayTitleFa: cleanTitle,
      shortTitleFa: focusedDraft.shortTitleFa.trim() || cleanTitle,
      descriptionFa: focusedDraft.descriptionFa.trim(),
      updatedAt: new Date().toISOString(),
    };
    const res = saveRoleGovernanceConfig(nextCfg);
    if (!res.ok) {
      notify('error', res.errorFa ?? 'ذخیره عنوان نقش ناموفق بود.');
      return;
    }
    setRoleTitleDrafts((prev) => {
      const next = { ...prev };
      delete next[focusedRoleId];
      return next;
    });
    notify('success', `مشخصات نمایشی نقش «${nextCfg.displayTitleFa}» مستقیماً ذخیره شد.`);
  };

  const hasUnsavedTitleDraft =
    roleTitleDrafts[focusedRoleId] !== undefined &&
    (focusedDraft.displayTitleFa !== focusedCfg.displayTitleFa ||
      focusedDraft.shortTitleFa !== focusedCfg.shortTitleFa ||
      focusedDraft.descriptionFa !== focusedCfg.descriptionFa);

  return (
    <div className="space-y-4" data-testid="role-matrix-root">
      {/* Control Header & Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Shield className="brand-text h-5 w-5 shrink-0" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white sm:text-base">
                ماتریس بصری دسترسی نقش‌ها
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              سطح دسترسی هر نقش را برای {toPersianDigits(implementedModules.length)} ماژول سامانه در ۵ سطح (مشاهده، ایجاد، ویرایش، حذف، چاپ) با چک‌باکس‌های گروه‌بندی‌شده تنظیم کنید. هر تغییر بلافاصله در پیکربندی نقش‌ها ذخیره و اعمال می‌شود.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Segmented Switch */}
            <div
              role="group"
              aria-label="نحوه نمایش ماتریس دسترسی"
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
            >
              <button
                type="button"
                data-matrix-mode="cross_role"
                onClick={() => setViewMode('cross_role')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === 'cross_role'
                    ? 'brand-btn'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span>ماتریس جامع همه نقش‌ها</span>
              </button>
              <button
                type="button"
                data-matrix-mode="single_role"
                onClick={() => setViewMode('single_role')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === 'single_role'
                    ? 'brand-btn'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>نمای تفکیکی و عنوان نقش</span>
              </button>
            </div>

            {/* Reset All with Inline Confirmation */}
            {!confirmResetAll ? (
              <button
                type="button"
                onClick={() => setConfirmResetAll(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>بازگردانی پیشفرض</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 dark:border-rose-900/60 dark:bg-rose-950/40">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  بازگردانی همه ۶ نقش؟
                </span>
                <button
                  type="button"
                  onClick={handleConfirmResetAll}
                  className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                >
                  تأیید
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter & Role Column Selector Strip */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی ماژول یا شناسه..."
                aria-label="جستجوی ماژول"
                className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-8 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="پاک کردن جستجو"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              aria-label="فیلتر بر اساس فاز"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">
                همه فازها ({toPersianDigits(implementedModules.length)} ماژول)
              </option>
              {availablePhases.map((p) => (
                <option key={p} value={String(p)}>
                  فاز {toPersianDigits(p)}
                </option>
              ))}
            </select>
          </div>

          {/* Role Column Filter (Cross-role mode) */}
          {viewMode === 'cross_role' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                ستون نقش‌ها:
              </span>
              {MANAGEABLE_ROLES.map((r) => {
                const roleId = r.id as ManageableRoleId;
                const active = visibleRoles.includes(roleId);
                const cfg = roleConfigMap[roleId];
                return (
                  <button
                    key={roleId}
                    type="button"
                    data-role-filter={roleId}
                    aria-pressed={active}
                    onClick={() => toggleRoleVisibility(roleId)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                      active
                        ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700/70 dark:bg-sky-950/50 dark:text-sky-200'
                        : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:text-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        active
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {active && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span>{cfg.shortTitleFa}</span>
                  </button>
                );
              })}
              {visibleRoles.length < MANAGEABLE_ROLES.length && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleRoles(MANAGEABLE_ROLES.map((r) => r.id as ManageableRoleId))
                  }
                  className="text-[11px] font-bold text-sky-600 hover:underline dark:text-sky-400"
                >
                  نمایش همه
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Save Feedback & Legend Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-300">راهنمای سطوح:</span>
            {PERMISSION_ACTIONS.map((act) => {
              const Icon = ACTION_ICONS[act];
              return (
                <span key={act} className="inline-flex items-center gap-1">
                  <Icon className="h-3 w-3 text-slate-400" />
                  <span>{PERMISSION_ACTION_LABELS[act]}</span>
                </span>
              );
            })}
            <span className="text-slate-400">·</span>
            <span>بستن «مشاهده» سایر دسترسی‌های آن سلول را نیز می‌بندد.</span>
          </div>

          {feedback && (
            <div
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 font-bold ${
                feedback.type === 'success'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: Interactive Cross-Role Permission Matrix Table */}
      {viewMode === 'cross_role' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {filteredModules.length === 0 ? (
            <div className="p-10 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                ماژولی با این فیلتر پیدا نشد
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                عبارت جستجو یا فیلتر فاز را تغییر دهید تا ماژول‌ها نمایش داده شوند.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPhaseFilter('all');
                }}
                className="brand-btn mt-3 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
              >
                پاک کردن فیلترها
              </button>
            </div>
          ) : (
            <div className="max-h-[72vh] overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-right">
                <thead>
                  <tr>
                    {/* Top-right sticky corner header */}
                    <th className="sticky right-0 top-0 z-30 min-w-[170px] max-w-[192px] border-b border-l border-slate-200 bg-slate-50 px-3 py-2.5 text-right align-bottom dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                        ماژول / بخش سامانه
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                        {toPersianDigits(filteredModules.length)} ماژول فعال ·{' '}
                        {toPersianDigits(displayedRoles.length)} نقش
                      </div>
                    </th>

                    {/* Role column headers with live coverage bars & quick column actions */}
                    {displayedRoles.map((roleId) => {
                      const cfg = roleConfigMap[roleId];
                      const viewableCount = implementedModules.filter(
                        (m) => getModulePerms(roleId, m.id).view
                      ).length;
                      const pct =
                        implementedModules.length > 0
                          ? Math.round((viewableCount / implementedModules.length) * 100)
                          : 0;

                      return (
                        <th
                          key={roleId}
                          data-matrix-role-col={roleId}
                          className="sticky top-0 z-20 min-w-[144px] border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-right align-top last:border-l-0 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                                {cfg.displayTitleFa}
                              </div>
                              <div className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                {toPersianDigits(viewableCount)} از{' '}
                                {toPersianDigits(implementedModules.length)} ماژول (
                                {toPersianDigits(pct)}٪)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleResetSingleRole(roleId)}
                              title={`بازگردانی دسترسی‌های ${cfg.shortTitleFa} به پیشفرض`}
                              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Crisp 3px hairline coverage meter */}
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="brand-bg h-full transition-all duration-200"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {/* Quick column-wide bulk presets */}
                          <div className="mt-2 flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleBulkColumnGrant(roleId, 'full')}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-emerald-400"
                            >
                              همه
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkColumnGrant(roleId, 'view_only')}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-bold text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-sky-400"
                            >
                              فقط مشاهده
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkColumnGrant(roleId, 'none')}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-bold text-slate-600 hover:border-rose-300 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-rose-400"
                            >
                              هیچ
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {groupedByPhase.map(([phase, modules]) => {
                    const isCollapsed = Boolean(collapsedPhases[phase]);
                    return (
                      <React.Fragment key={phase}>
                        {/* Collapsible Phase Group Separator Row */}
                        <tr>
                          <td
                            colSpan={displayedRoles.length + 1}
                            className="border-b border-slate-200 bg-slate-100/80 px-3.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/70"
                          >
                            <button
                              type="button"
                              onClick={() => togglePhaseCollapsed(phase)}
                              className="flex w-full items-center justify-between text-right text-xs font-extrabold text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {isCollapsed ? (
                                  <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                )}
                                <span>
                                  {PHASE_TITLES[phase] ?? `فاز ${toPersianDigits(phase)}`}
                                </span>
                              </span>
                              <span className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                {toPersianDigits(modules.length)} ماژول
                              </span>
                            </button>
                          </td>
                        </tr>

                        {/* Module Matrix Rows */}
                        {!isCollapsed &&
                          modules.map((mod) => (
                            <tr
                              key={mod.id}
                              data-matrix-module-row={mod.id}
                              className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                            >
                              {/* Sticky Right Module Info Cell */}
                              <td className="sticky right-0 z-10 min-w-[170px] max-w-[192px] border-b border-l border-slate-200 bg-white px-3 py-2 align-top group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800/60">
                                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {mod.nameFa}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                                  <span className="font-mono" dir="ltr">
                                    {mod.id}
                                  </span>
                                  <span>·</span>
                                  <span className="tabular-nums">
                                    فاز {toPersianDigits(mod.phase)}
                                  </span>
                                </div>
                              </td>

                              {/* Grouped Checkboxes Cell per Role */}
                              {displayedRoles.map((roleId) => {
                                const perms = getModulePerms(roleId, mod.id);
                                const activeCount = countActiveActions(perms);
                                const isFull = activeCount === PERMISSION_ACTIONS.length;
                                const isBlocked = activeCount === 0;
                                const roleLabel = roleConfigMap[roleId].shortTitleFa;

                                const cellTone = isBlocked
                                  ? 'bg-slate-50/60 dark:bg-slate-950/30'
                                  : isFull
                                    ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                                    : 'bg-white dark:bg-slate-900';

                                return (
                                  <td
                                    key={`${mod.id}:${roleId}`}
                                    className={`border-b border-l border-slate-200 p-1.5 align-top last:border-l-0 dark:border-slate-800 ${cellTone}`}
                                  >
                                    <div
                                      role="group"
                                      aria-label={`دسترسی‌های ${roleLabel} برای ${mod.shortNameFa}`}
                                      className="space-y-1.5"
                                    >
                                      {/* Primary Master Checkbox Row (مشاهده) + Quick All/None */}
                                      <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1.5 dark:border-slate-800/80">
                                        <label
                                          className={`inline-flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-bold transition-colors ${
                                            perms.view
                                              ? 'text-slate-900 dark:text-white'
                                              : 'text-slate-400 dark:text-slate-500'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            data-perm-toggle={`${roleId}:${mod.id}:view`}
                                            checked={perms.view}
                                            onChange={() => handleToggleAction(roleId, mod, 'view')}
                                            className="peer sr-only"
                                          />
                                          <span
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 ${
                                              perms.view
                                                ? 'border-sky-600 bg-sky-600 text-white'
                                                : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                            }`}
                                          >
                                            {perms.view && <Check className="h-3 w-3 stroke-[2.5]" />}
                                          </span>
                                          <span>مشاهده</span>
                                        </label>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleCellAll(roleId, mod)}
                                          title={
                                            isFull
                                              ? `بستن همه دسترسی‌های ${roleLabel} در ${mod.shortNameFa}`
                                              : `اعطای همه ۵ دسترسی به ${roleLabel} در ${mod.shortNameFa}`
                                          }
                                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                                            isFull
                                              ? 'text-emerald-700 hover:bg-emerald-100/70 dark:text-emerald-400 dark:hover:bg-emerald-950/60'
                                              : activeCount > 0
                                                ? 'text-sky-700 hover:bg-sky-100/70 dark:text-sky-400 dark:hover:bg-sky-950/60'
                                                : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800'
                                          }`}
                                        >
                                          <CheckCheck className="h-3 w-3" />
                                          <span>
                                            {toPersianDigits(activeCount)}/
                                            {toPersianDigits(PERMISSION_ACTIONS.length)}
                                          </span>
                                        </button>
                                      </div>

                                      {/* Grouped Operational Sub-Checkboxes (2x2 Grid: ایجاد، ویرایش، حذف، چاپ) */}
                                      <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
                                        {SUB_ACTIONS.map((act) => {
                                          const checked = perms[act];
                                          const isDangerAction = act === 'delete';
                                          return (
                                            <label
                                              key={act}
                                              title={`${PERMISSION_ACTION_LABELS[act]} — ${mod.shortNameFa} (${roleLabel})`}
                                              className={`inline-flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 ${
                                                checked
                                                  ? isDangerAction
                                                    ? 'text-rose-700 dark:text-rose-300'
                                                    : 'text-slate-800 dark:text-slate-100'
                                                  : 'text-slate-400 dark:text-slate-500'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                data-perm-toggle={`${roleId}:${mod.id}:${act}`}
                                                checked={checked}
                                                onChange={() =>
                                                  handleToggleAction(roleId, mod, act)
                                                }
                                                className="peer sr-only"
                                              />
                                              <span
                                                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 ${
                                                  checked
                                                    ? isDangerAction
                                                      ? 'border-rose-600 bg-rose-600 text-white'
                                                      : 'border-emerald-600 bg-emerald-600 text-white'
                                                    : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                                }`}
                                              >
                                                {checked && (
                                                  <Check className="h-2.5 w-2.5 stroke-[2.75]" />
                                                )}
                                              </span>
                                              <span className="truncate">
                                                {ACTION_SHORT_LABELS[act]}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Focused Single-Role Editor + Role Display Identity Customization */}
      {viewMode === 'single_role' && (
        <div className="space-y-4">
          {/* Role Selector Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {MANAGEABLE_ROLES.map((r) => {
              const roleId = r.id as ManageableRoleId;
              const cfg = roleConfigMap[roleId];
              const isSelected = focusedRoleId === roleId;
              const viewCount = implementedModules.filter(
                (m) => getModulePerms(roleId, m.id).view
              ).length;
              return (
                <button
                  key={roleId}
                  type="button"
                  data-gov-role={roleId}
                  onClick={() => setFocusedRoleId(roleId)}
                  className={`rounded-xl border p-3 text-right transition-colors ${
                    isSelected
                      ? 'brand-border brand-soft-bg'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                    {cfg.displayTitleFa}
                  </div>
                  <div className="mt-1 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {toPersianDigits(viewCount)} / {toPersianDigits(implementedModules.length)} ماژول
                  </div>
                </button>
              );
            })}
          </div>

          {/* Role Display Name & Description Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  هویت نمایشی نقش «{focusedCfg.displayTitleFa}»
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تغییر عنوان این نقش در هدر، فرم ورود، فهرست کاربران و نوار پیش‌نمایش سامانه منعکس می‌شود.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResetSingleRole(focusedRoleId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>پیشفرض این نقش</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoleIdentity}
                  disabled={!hasUnsavedTitleDraft}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    hasUnsavedTitleDraft
                      ? 'brand-btn'
                      : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>ذخیره عنوان نقش</span>
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                  عنوان کامل نمایشی نقش
                </label>
                <input
                  type="text"
                  value={focusedDraft.displayTitleFa}
                  onChange={(e) => updateFocusedDraft('displayTitleFa', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                  عنوان کوتاه (هدر و جدول)
                </label>
                <input
                  type="text"
                  value={focusedDraft.shortTitleFa}
                  onChange={(e) => updateFocusedDraft('shortTitleFa', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                  شرح کوتاه نقش
                </label>
                <input
                  type="text"
                  value={focusedDraft.descriptionFa}
                  onChange={(e) => updateFocusedDraft('descriptionFa', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Focused Role 5-Column Detailed Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                جدول دسترسی‌های تفکیکی نقش «{focusedCfg.displayTitleFa}»
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleBulkColumnGrant(focusedRoleId, 'full')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  اعطای همه به موارد فیلترشده
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkColumnGrant(focusedRoleId, 'view_only')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  فقط مشاهده
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkColumnGrant(focusedRoleId, 'none')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-600 hover:border-rose-300 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  مسدودسازی همه
                </button>
              </div>
            </div>

            <div className="max-h-[62vh] overflow-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 font-extrabold">ماژول / بخش</th>
                    {PERMISSION_ACTIONS.map((act) => (
                      <th key={act} className="px-3 py-2.5 text-center font-extrabold">
                        {PERMISSION_ACTION_LABELS[act]}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-extrabold">همه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredModules.map((mod) => {
                    const perms = getModulePerms(focusedRoleId, mod.id);
                    const allChecked = countActiveActions(perms) === PERMISSION_ACTIONS.length;
                    return (
                      <tr
                        key={mod.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {mod.nameFa}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            فاز {toPersianDigits(mod.phase)} ·{' '}
                            <span className="font-mono" dir="ltr">
                              {mod.id}
                            </span>
                          </div>
                        </td>
                        {PERMISSION_ACTIONS.map((act) => {
                          const checked = perms[act];
                          return (
                            <td key={act} className="px-3 py-2.5 text-center">
                              <label className="inline-flex cursor-pointer items-center justify-center">
                                <input
                                  type="checkbox"
                                  data-perm-toggle={`${focusedRoleId}:${mod.id}:${act}`}
                                  checked={checked}
                                  onChange={() => handleToggleAction(focusedRoleId, mod, act)}
                                  className="peer sr-only"
                                />
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 ${
                                    checked
                                      ? act === 'delete'
                                        ? 'border-rose-600 bg-rose-600 text-white'
                                        : act === 'view'
                                          ? 'border-sky-600 bg-sky-600 text-white'
                                          : 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                  }`}
                                >
                                  {checked && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                                </span>
                              </label>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCellAll(focusedRoleId, mod)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                              allChecked
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {allChecked ? 'بستن همه' : 'همه'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleMatrix;
