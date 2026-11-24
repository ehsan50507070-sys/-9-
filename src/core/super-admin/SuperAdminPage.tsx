// Super Admin 5-Tab Governance Console (Phase 8A — Strictly visible ONLY to super_admin)
import React from 'react';
import {
  Blocks,
  Building,
  CalendarRange,
  Database,
  Image as ImageIcon,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { AcademicYearManagerPanel } from '../academic-year/AcademicYearManagerPanel';
import { useSchoolData } from '../data/DataContext';
import { AddonsManagerPage } from '../plugins/AddonsManagerPage';
import { useRouter } from '../router/RouterContext';
import { PanicModeControlCard } from '../security/PanicModeControlCard';
import { DataVaultCenterTab } from '../storage/DataVaultCenterTab';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { AdminAccountsTab } from './AdminAccountsTab';
import { ComplexSchoolManagerTab } from './ComplexSchoolManagerTab';
import { GlobalLabelCustomizerTab } from './GlobalLabelCustomizerTab';
import { LoginBackgroundStudioTab } from './LoginBackgroundStudioTab';
import { RoleMatrix } from './RoleMatrix';

type SuperAdminTabId =
  | 'permissions'
  | 'plugins'
  | 'data_vault'
  | 'labels'
  | 'accounts'
  | 'complexes'
  | 'academic_years'
  | 'login_studio';

const TABS: Array<{
  id: SuperAdminTabId;
  labelFa: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'permissions', labelFa: 'نقش‌ها و ماتریس دسترسی', icon: Shield },
  { id: 'plugins', labelFa: 'بسته‌های الحاقی مدارس', icon: Blocks },
  { id: 'data_vault', labelFa: 'مرکز سلامت داده و مهاجرت', icon: Database },
  { id: 'labels', labelFa: 'نام‌ها و واژگان سراسری', icon: Tag },
  { id: 'accounts', labelFa: 'مدیران، پیش‌نمایش و ممیزی', icon: KeyRound },
  { id: 'complexes', labelFa: 'مجموعه‌ها و مدارس', icon: Building },
  { id: 'academic_years', labelFa: 'مدیریت سال تحصیلی', icon: CalendarRange },
  { id: 'login_studio', labelFa: 'لوگو و صفحه ورود', icon: ImageIcon },
];

const VALID_TAB_IDS = new Set<SuperAdminTabId>(TABS.map((t) => t.id));

export const SuperAdminPage: React.FC = () => {
  const {
    realSession,
    educationalComplexes,
    allSchools,
    managedAdminAccounts,
    globalSystemConfig,
  } = useSchoolData();
  const { searchParams, navigate } = useRouter();

  const rawTabParam = searchParams.get('tab') as SuperAdminTabId | null;
  const activeTab: SuperAdminTabId =
    rawTabParam && VALID_TAB_IDS.has(rawTabParam) ? rawTabParam : 'permissions';

  const handleSelectTab = (tabId: SuperAdminTabId) => {
    navigate(tabId === 'permissions' ? '/super-admin' : `/super-admin?tab=${tabId}`);
  };

  if (!realSession || realSession.role !== 'super_admin') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900/50 dark:bg-slate-900">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">
          دسترسی محدود به راهبر ارشد سامانه
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          کنسول حاکمیت کلان، مدیریت مجموعه‌ها، ماتریس دسترسی‌ها و استودیو صفحه ورود صرفاً برای نقش «راهبر ارشد سامانه» فعال است.
        </p>
      </div>
    );
  }

  const customLabelCount = Object.keys(globalSystemConfig?.labels ?? {}).length;

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Console Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="brand-bg flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
                  کنسول راهبر ارشد سامانه (حاکمیت کلان و چندسازمانی)
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مدیریت متمرکز دسترسی نقش‌ها، سلامت داده و مهاجرت، واژگان سراسری، حساب‌های مدیریتی، مجموعه‌ها و طراحی صفحه ورود
                </p>
              </div>
            </div>

            {/* Compact KPI Strip */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">مجموعه‌ها</div>
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {toPersianDigits(educationalComplexes.length)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">کل مدارس</div>
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {toPersianDigits(allSchools.length)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">مدیران</div>
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {toPersianDigits(managedAdminAccounts.length)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">برچسب سفارشی</div>
                <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {toPersianDigits(customLabelCount)}
                </div>
              </div>
            </div>
          </div>

          {/* Governance Tabs Bar */}
          <div
            role="tablist"
            aria-label="بخش‌های کنسول راهبر ارشد"
            className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-super-tab={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                    active
                      ? 'brand-btn'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.labelFa}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prominent Top-Level Panic Mode Control Card on Main Super Admin Panel */}
        {activeTab !== 'data_vault' && <PanicModeControlCard variant="compact" />}

        {/* Active Tab View */}
        <div>
          {activeTab === 'permissions' && <RoleMatrix />}
          {activeTab === 'plugins' && <AddonsManagerPage embedded />}
          {activeTab === 'data_vault' && <DataVaultCenterTab embedded />}
          {activeTab === 'labels' && <GlobalLabelCustomizerTab />}
          {activeTab === 'accounts' && <AdminAccountsTab />}
          {activeTab === 'complexes' && <ComplexSchoolManagerTab />}
          {activeTab === 'academic_years' && <AcademicYearManagerPanel />}
          {activeTab === 'login_studio' && <LoginBackgroundStudioTab />}
        </div>
      </div>
    </ErrorBoundary>
  );
};
