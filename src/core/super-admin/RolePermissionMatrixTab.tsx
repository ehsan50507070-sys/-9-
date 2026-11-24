// Tab 1: Role & Granular Permission Matrix Manager (Phase 8A Super Admin Governance)
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Save, Search, Shield, Users } from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type {
  ManageableRoleId,
  ModulePermissionSet,
  PermissionAction,
  RoleGovernanceConfig,
} from '../../types/domain';
import { MANAGEABLE_ROLES, ROLE_DEFINITIONS } from '../auth/rbac';
import { useSchoolData } from '../data/DataContext';
import {
  buildDefaultPermissionsForRole,
  PERMISSION_ACTION_LABELS,
} from './superAdminHelpers';

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export'];

export const RolePermissionMatrixTab: React.FC = () => {
  const {
    allManifests,
    roleGovernanceConfigs,
    saveRoleGovernanceConfig,
    resetAllRoleGovernanceConfigs,
  } = useSchoolData();

  const [selectedRole, setSelectedRole] = useState<ManageableRoleId>('principal');
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentSavedConfig = useMemo<RoleGovernanceConfig>(() => {
    const found = roleGovernanceConfigs.find((r) => r.roleId === selectedRole);
    if (found) return found;
    const def = ROLE_DEFINITIONS[selectedRole];
    return {
      id: `role-gov:${selectedRole}`,
      schoolId: '__global__',
      roleId: selectedRole,
      displayTitleFa: def.labelFa,
      shortTitleFa: def.shortLabelFa,
      descriptionFa: def.descriptionFa,
      modulePermissions: buildDefaultPermissionsForRole(selectedRole, allManifests),
      updatedAt: new Date().toISOString(),
    };
  }, [roleGovernanceConfigs, selectedRole, allManifests]);

  const [draft, setDraft] = useState<RoleGovernanceConfig>(currentSavedConfig);

  useEffect(() => {
    setDraft(currentSavedConfig);
  }, [currentSavedConfig]);

  const modules = useMemo(() => {
    return allManifests
      .filter((m) => m.implemented && m.id !== 'super-admin' && m.id !== 'data-vault')
      .filter((m) => (phaseFilter === 'all' ? true : String(m.phase) === phaseFilter))
      .filter((m) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          m.nameFa.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.descriptionFa.toLowerCase().includes(q)
        );
      });
  }, [allManifests, phaseFilter, searchQuery]);

  const togglePermission = (moduleId: string, action: PermissionAction) => {
    setDraft((prev) => {
      const currentSet: ModulePermissionSet = prev.modulePermissions[moduleId] ?? {
        view: false,
        create: false,
        edit: false,
        delete: false,
        export: false,
      };
      const nextVal = !currentSet[action];
      const updatedSet: ModulePermissionSet = {
        ...currentSet,
        [action]: nextVal,
      };
      // If view is turned off, disable child actions too; if a child action is enabled, ensure view is enabled
      if (action === 'view' && !nextVal) {
        updatedSet.create = false;
        updatedSet.edit = false;
        updatedSet.delete = false;
        updatedSet.export = false;
      } else if (action !== 'view' && nextVal) {
        updatedSet.view = true;
      }
      return {
        ...prev,
        modulePermissions: {
          ...prev.modulePermissions,
          [moduleId]: updatedSet,
        },
      };
    });
  };

  const toggleRowAll = (moduleId: string, enable: boolean) => {
    setDraft((prev) => ({
      ...prev,
      modulePermissions: {
        ...prev.modulePermissions,
        [moduleId]: {
          view: enable,
          create: enable,
          edit: enable,
          delete: enable,
          export: enable,
        },
      },
    }));
  };

  const handleSave = () => {
    const res = saveRoleGovernanceConfig(draft);
    if (res.ok) {
      setFeedback(`دسترسی‌ها و عنوان نقش «${draft.displayTitleFa}» با موفقیت ذخیره و فوراً اعمال شد.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleResetAll = () => {
    const res = resetAllRoleGovernanceConfigs();
    if (res.ok) {
      setFeedback('تمامی نقش‌ها و ماتریس دسترسی‌ها به حالت پیشفرض سامانه بازگردانی شدند.');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const activeViewCount = useMemo(() => {
    return Object.values(draft.modulePermissions).filter((p) => p?.view).length;
  }, [draft.modulePermissions]);

  return (
    <div className="space-y-4">
      {/* Feedback banner */}
      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Role Selector Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {MANAGEABLE_ROLES.map((roleDefItem) => {
          const roleId = roleDefItem.id as ManageableRoleId;
          const cfg = roleGovernanceConfigs.find((r) => r.roleId === roleId);
          const label = cfg?.shortTitleFa || roleDefItem.shortLabelFa;
          const isSelected = selectedRole === roleId;
          const permCount = cfg
            ? Object.values(cfg.modulePermissions).filter((p) => p?.view).length
            : 0;
          return (
            <button
              key={roleId}
              type="button"
              data-gov-role={roleId}
              onClick={() => setSelectedRole(roleId)}
              className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-right transition-colors ${
                isSelected
                  ? 'brand-btn border-transparent'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-xs font-extrabold">{label}</span>
              <span
                className={`mt-0.5 text-[11px] tabular-nums ${
                  isSelected ? 'opacity-90' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {toPersianDigits(permCount)} ماژول فعال
              </span>
            </button>
          );
        })}
      </div>

      {/* Role Identity Editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              هویت و عنوان نمایشی نقش ({ROLE_DEFINITIONS[selectedRole].labelFa})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>بازگردانی پیشفرض</span>
            </button>
            <button
              type="button"
              data-testid="save-role-permissions-btn"
              onClick={handleSave}
              className="brand-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold"
            >
              <Save className="h-3.5 w-3.5" />
              <span>ذخیره دسترسی‌های این نقش</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              عنوان رسمی نقش در سامانه
            </label>
            <input
              type="text"
              value={draft.displayTitleFa}
              onChange={(e) => setDraft((p) => ({ ...p, displayTitleFa: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[var(--brand-primary)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              عنوان کوتاه (هدر و برچسب)
            </label>
            <input
              type="text"
              value={draft.shortTitleFa}
              onChange={(e) => setDraft((p) => ({ ...p, shortTitleFa: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[var(--brand-primary)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              شرح مسئولیت نقش
            </label>
            <input
              type="text"
              value={draft.descriptionFa}
              onChange={(e) => setDraft((p) => ({ ...p, descriptionFa: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[var(--brand-primary)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Granular Permission Matrix Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              ماتریس دسترسی ماژول‌ها — {toPersianDigits(activeViewCount)} ماژول قابل مشاهده
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی ماژول..."
                className="w-48 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-3 text-xs text-slate-900 focus:border-[var(--brand-primary)] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">همه فازها</option>
              <option value="1">فاز ۱ (هسته و عملیات)</option>
              <option value="2">فاز ۲ (آموزش و نمره)</option>
              <option value="3">فاز ۳ (هوشمند و آنلاین)</option>
              <option value="4">فاز ۴ (ارتباطات)</option>
              <option value="5">فاز ۵ (سیدا و امتحانات)</option>
              <option value="6">فاز ۶ (مالی و تحلیل)</option>
              <option value="7">فاز ۷ (توسعه معلمان)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-3 py-2.5 font-extrabold">ماژول / بسته</th>
                <th className="px-2 py-2.5 text-center font-extrabold">فاز</th>
                {ACTIONS.map((act) => (
                  <th key={act} className="px-2 py-2.5 text-center font-extrabold">
                    {PERMISSION_ACTION_LABELS[act]}
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center font-extrabold">عملیات سریع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {modules.map((mod) => {
                const perms: ModulePermissionSet = draft.modulePermissions[mod.id] ?? {
                  view: false,
                  create: false,
                  edit: false,
                  delete: false,
                  export: false,
                };
                const allOn = ACTIONS.every((a) => perms[a]);
                return (
                  <tr
                    key={mod.id}
                    data-matrix-module={mod.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 dark:text-white">{mod.nameFa}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {mod.id}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-500 dark:text-slate-400">
                      فاز {toPersianDigits(mod.phase)}
                    </td>
                    {ACTIONS.map((act) => (
                      <td key={act} className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(perms[act])}
                          data-perm-toggle={`${selectedRole}:${mod.id}:${act}`}
                          aria-label={`${mod.nameFa} — ${PERMISSION_ACTION_LABELS[act]}`}
                          onChange={() => togglePermission(mod.id, act)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[var(--brand-primary)]"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleRowAll(mod.id, !allOn)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {allOn ? 'لغو همه' : 'همه مجاز'}
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
  );
};
