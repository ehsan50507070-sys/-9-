// Exclusive Super Admin Add-on Manager (/plugins) with Per-School Independent Selector & 100% Non-Destructive Guarantee
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Globe,
  Lock,
  Power,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useSectionLabel } from '../appearance/AppearanceContext';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import { EmptyStateSvg } from '../ui/EmptyStateSvg';
import { PluginIcon } from '../ui/IconResolver';
import { useToast } from '../ui/ToastContext';
import type { PluginRuntimeStatus } from './types';

type ManagerTab = 'active' | 'disabled' | 'roadmap';

interface PendingGuardAction {
  status: PluginRuntimeStatus;
  action: 'disable' | 'uninstall';
  applyToAllSchools: boolean;
}

export const AddonsManagerPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const {
    activeRole,
    activeSchool,
    allSchools,
    roleDef,
    allManifests,
    getPluginStatusesForSchool,
    updatePluginStateForSchool,
  } = useSchoolData();
  const { getSectionTitle } = useSectionLabel();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [targetSchoolId, setTargetSchoolId] = useState<string>(activeSchool.id);
  const [activeTab, setActiveTab] = useState<ManagerTab>('active');
  const [applyAllSchools, setApplyAllSchools] = useState<boolean>(false);
  const [guardPrompt, setGuardPrompt] = useState<PendingGuardAction | null>(null);

  const selectedSchool = useMemo(
    () => allSchools.find((s) => s.id === targetSchoolId) ?? activeSchool,
    [allSchools, targetSchoolId, activeSchool]
  );

  const scopedStatuses = useMemo(
    () => getPluginStatusesForSchool(selectedSchool.id),
    [getPluginStatusesForSchool, selectedSchool.id]
  );

  const manifestById = useMemo(
    () => new Map(allManifests.map((m) => [m.id, m])),
    [allManifests]
  );

  const activeInstalled = useMemo(
    () => scopedStatuses.filter((p) => p.manifest.implemented && p.installed && p.enabled),
    [scopedStatuses]
  );
  const activeOperationalAddons = useMemo(
    () => activeInstalled.filter((p) => !p.manifest.isCore),
    [activeInstalled]
  );
  const activeCoreModules = useMemo(
    () => activeInstalled.filter((p) => p.manifest.isCore),
    [activeInstalled]
  );
  const disabledOrUninstalled = useMemo(
    () => scopedStatuses.filter((p) => p.manifest.implemented && (!p.installed || !p.enabled)),
    [scopedStatuses]
  );
  const roadmapPlugins = useMemo(
    () => scopedStatuses.filter((p) => !p.manifest.implemented),
    [scopedStatuses]
  );

  // Strict exclusive super_admin guard
  if (activeRole !== 'super_admin' || !roleDef.canManageAddons) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 text-right space-y-3">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <div className="text-xs font-bold">دسترسی انحصاری راهبر ارشد</div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">
                مدیریت بسته‌های الحاقی فقط در اختیار راهبر ارشد سامانه است
              </h1>
            </div>
          </div>
          <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
            مدیر کل مجموعه و مدیران مدارس امکان فعال‌سازی یا غیرفعال‌سازی بسته‌های الحاقی را ندارند.
            برای تغییر ماژول‌های فعال مدرسه، با راهبر ارشد سامانه هماهنگ فرمایید.
          </p>
        </div>
      </div>
    );
  }

  const executePluginAction = async (
    status: PluginRuntimeStatus,
    action: 'enable' | 'disable' | 'uninstall' | 'install',
    batchAll: boolean
  ) => {
    await updatePluginStateForSchool(selectedSchool.id, status.manifest.id, action, batchAll);
    const scopeLabel = batchAll
      ? `در هر ${toPersianDigits(allSchools.length)} مدرسه سامانه`
      : `در «${selectedSchool.name}»`;

    if (action === 'enable' || action === 'install') {
      showToast(`بسته «${status.manifest.nameFa}» ${scopeLabel} فعال شد و تمام اطلاعات در دسترس است.`);
    } else if (action === 'disable') {
      showToast(
        `بسته «${status.manifest.nameFa}» ${scopeLabel} غیرفعال شد؛ ${toPersianDigits(status.preservedRecordCount)} رکورد بدون کوچک‌ترین حذف محفوظ ماند.`,
        'info'
      );
    } else {
      showToast(
        `بسته «${status.manifest.nameFa}» ${scopeLabel} از منوها حذف شد؛ تمام ${toPersianDigits(status.preservedRecordCount)} رکورد محفوظ و قابل بازیابی است.`,
        'info'
      );
    }
  };

  const requestAction = (
    status: PluginRuntimeStatus,
    action: 'enable' | 'disable' | 'uninstall' | 'install'
  ) => {
    if (status.manifest.isCore) return;
    if ((action === 'disable' || action === 'uninstall') && status.activeDependents.length > 0) {
      setGuardPrompt({ status, action, applyToAllSchools: applyAllSchools });
      return;
    }
    void executePluginAction(status, action, applyAllSchools);
  };

  const renderPluginCard = (status: PluginRuntimeStatus) => {
    const { manifest, installed, enabled, preservedRecordCount, blockedByDisabledDependencies } =
      status;
    const isImplemented = manifest.implemented;
    const dependencyNames = (manifest.dependencies ?? [])
      .map((depId) => manifestById.get(depId)?.nameFa ?? depId)
      .join('، ');

    return (
      <article
        key={manifest.id}
        data-plugin-id={manifest.id}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xs transition-colors duration-150"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  manifest.isCore
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    : enabled
                      ? 'bg-[#2B5B84]/10 dark:bg-sky-950/60 text-[#2B5B84] dark:text-sky-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <PluginIcon name={manifest.iconName} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {getSectionTitle(manifest.id, manifest.nameFa)}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{manifest.categoryLabelFa}</span>
                  <span aria-hidden="true">·</span>
                  <span>فاز {toPersianDigits(manifest.phase)}</span>
                  <span aria-hidden="true">·</span>
                  <span>نسخه {toPersianDigits(manifest.version)}</span>
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold shrink-0">
              {manifest.isCore ? (
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                  هسته مرکزی
                </span>
              ) : !isImplemented ? (
                <span className="text-slate-400">نقشه راه</span>
              ) : enabled ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  فعال
                </span>
              ) : !installed ? (
                <span className="text-rose-600 dark:text-rose-400">حذف نرم</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">غیرفعال</span>
              )}
            </div>
          </div>

          <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
            {manifest.descriptionFa}
          </p>

          {dependencyNames && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              وابستگی: <span className="font-semibold text-slate-700 dark:text-slate-200">{dependencyNames}</span>
            </div>
          )}

          {blockedByDisabledDependencies.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                بسته پیش‌نیاز این ماژول غیرفعال است:{' '}
                {blockedByDisabledDependencies.map((dep) => dep.nameFa).join('، ')}
              </span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <Database className="w-3.5 h-3.5" />
            <span>
              {toPersianDigits(preservedRecordCount)} رکورد محفوظ در «{selectedSchool.name}»
            </span>
          </div>

          {!manifest.isCore && isImplemented && (
            <div className="flex flex-wrap items-center gap-2">
              {enabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(manifest.route)}
                    className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    باز کردن
                  </button>
                  <button
                    type="button"
                    onClick={() => requestAction(status, 'disable')}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/70"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>غیرفعال‌سازی</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestAction(status, 'uninstall')}
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                    title="حذف نرم بدون حذف داده"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => requestAction(status, installed ? 'enable' : 'install')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 py-1.5 text-xs font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{installed ? 'فعال‌سازی مجدد' : 'نصب و بازیابی'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header + Per-School Selector */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#2B5B84]/10 dark:bg-sky-950/60 text-[#2B5B84] dark:text-sky-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              {!embedded && (
                <div className="text-xs font-bold text-[#2B5B84] dark:text-sky-400">
                  حاکمیت انحصاری راهبر ارشد
                </div>
              )}
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                مدیریت بسته‌های الحاقی به تفکیک هر مدرسه
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
                با انتخاب هر مدرسه، بسته‌های آن را به‌صورت مستقل فعال یا غیرفعال کنید. داده‌ها ۱۰۰٪ حفظ
                شده و منوی بسته‌های غیرفعال فقط برای کاربران همان مدرسه پنهان می‌شود.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <div className="relative min-w-[220px]">
              <Building2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2B5B84] dark:text-sky-400" />
              <select
                data-testid="plugins-school-selector"
                value={selectedSchool.id}
                onChange={(e) => setTargetSchoolId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 py-2 text-xs font-extrabold text-slate-900 dark:text-white"
              >
                {allSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyAllSchools}
                onChange={(e) => setApplyAllSchools(e.target.checked)}
                className="rounded border-slate-300 text-[#2B5B84]"
              />
              <Globe className="w-3.5 h-3.5 text-[#2B5B84] dark:text-sky-400" />
              <span>اعمال هم‌زمان به همه مدارس ({toPersianDigits(allSchools.length)})</span>
            </label>
          </div>
        </div>

        {/* Non-Destructive Guarantee Strip */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <Database className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>
            تضمین عدم حذف داده: غیرفعال‌سازی یا حذف نرم هیچ رکوردی را پاک نمی‌کند و با فعال‌سازی مجدد
            تمام اطلاعات فوراً در دسترس خواهند بود.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'active'
                ? 'brand-btn'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            بسته‌های فعال ({toPersianDigits(activeOperationalAddons.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('disabled')}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'disabled'
                ? 'brand-btn'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            غیرفعال / حذف نرم ({toPersianDigits(disabledOrUninstalled.length)})
          </button>
          {roadmapPlugins.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('roadmap')}
              className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                activeTab === 'roadmap'
                  ? 'brand-btn'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              نقشه راه ({toPersianDigits(roadmapPlugins.length)})
            </button>
          )}
        </div>
      </div>

      {/* Plugin Cards Grid */}
      {activeTab === 'active' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOperationalAddons.map(renderPluginCard)}
          </div>
          {activeCoreModules.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                ماژول‌های هسته مرکزی (همواره فعال)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeCoreModules.map(renderPluginCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'disabled' &&
        (disabledOrUninstalled.length === 0 ? (
          <EmptyStateSvg
            variant="records"
            titleFa={`همه بسته‌های الحاقی در «${selectedSchool.name}» فعال هستند`}
            descriptionFa="در صورت غیرفعال کردن هر بسته، کارت آن به همراه تعداد رکوردهای محفوظ در این بخش نمایش داده می‌شود."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {disabledOrUninstalled.map(renderPluginCard)}
          </div>
        ))}

      {activeTab === 'roadmap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roadmapPlugins.map(renderPluginCard)}
        </div>
      )}

      {/* Dependency Guard Modal */}
      {guardPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  هشدار وابستگی بسته‌ها
                </h3>
                <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  بسته «{guardPrompt.status.manifest.nameFa}» پیش‌نیاز بسته‌های فعال زیر است:{' '}
                  <strong>
                    {guardPrompt.status.activeDependents
                      .map((dep) => dep.nameFa)
                      .join('، ')}
                  </strong>
                  . آیا مطمئن هستید؟ هیچ داده‌ای حذف نخواهد شد.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setGuardPrompt(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = guardPrompt;
                  setGuardPrompt(null);
                  void executePluginAction(p.status, p.action, p.applyToAllSchools);
                }}
                className="min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold"
              >
                تایید و ادامه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
