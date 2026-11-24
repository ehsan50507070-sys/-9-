/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect } from 'react';
import { ShieldAlert, ArrowRight, LogOut } from 'lucide-react';
import { AcademicYearProvider } from './core/academic-year/AcademicYearContext';
import { AppearanceProvider, useSectionLabel } from './core/appearance/AppearanceContext';
import { ForcePasswordChangeModal } from './core/auth/ForcePasswordChangeModal';
import { LoginPage } from './core/auth/LoginPage';
import { canRoleAccessRoute } from './core/auth/rbac';
import { DataProvider, useSchoolData } from './core/data/DataContext';
import { PluginDisabledGuard } from './core/plugins/PluginDisabledGuard';
import { PLUGIN_REGISTRY } from './core/plugins/registry';
import { PrintProvider } from './core/print/PrintPreviewPortal';
import { RouterProvider, useRouter } from './core/router/RouterContext';
import { checkRouteSecurityGuard } from './core/security/securityGuard';
import { LabelProvider, useRoleLabel } from './core/super-admin/LabelContext';
import { evaluateModulePermission } from './core/super-admin/superAdminHelpers';
import { AppShell } from './core/ui/AppShell';
import { ErrorBoundary } from './core/ui/ErrorBoundary';
import { ToastProvider } from './core/ui/ToastContext';

const ActiveRouteView: React.FC = () => {
  const { path, navigate } = useRouter();
  const { pluginStatuses, activeRole, roleDef, roleGovernanceConfigs, logout } = useSchoolData();
  const { getSectionTitle } = useSectionLabel();
  const activeRoleMeta = useRoleLabel(activeRole);

  const matched =
    pluginStatuses.find((p) => p.manifest.route === path) ??
    (path.startsWith('/subjects/')
      ? pluginStatuses.find((p) => p.manifest.id === 'subjects')
      : undefined) ??
    pluginStatuses.find((p) => p.manifest.id === 'dashboard');

  if (!matched) {
    return null;
  }

  // Strict Layer-1 SecurityGuard + RBAC + Super Admin Permission Matrix check BEFORE disabled guard
  const guardDecision = checkRouteSecurityGuard(activeRole, matched.manifest.allowedRoles);
  const hasStaticRouteAccess =
    guardDecision.allowed && canRoleAccessRoute(activeRole, matched.manifest.allowedRoles);
  const hasDynamicViewAccess =
    activeRole === 'super_admin' ||
    matched.manifest.id === 'dashboard' ||
    ((matched.manifest.id === 'security-logs' ||
      matched.manifest.id === 'recycle-bin' ||
      matched.manifest.id === 'smart-import-wizard') &&
      activeRole === 'principal') ||
    evaluateModulePermission({
      role: activeRole,
      moduleId: matched.manifest.id,
      action: 'view',
      configs: roleGovernanceConfigs,
      manifests: PLUGIN_REGISTRY,
    });

  if (!hasStaticRouteAccess || !hasDynamicViewAccess) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 p-6 text-right space-y-4 shadow-xs">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400">محدودیت امنیتی دسترسی</div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                دسترسی به «{getSectionTitle(matched.manifest.id, matched.manifest.nameFa)}» برای نقش «{activeRoleMeta.labelFa}» مجاز نیست
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-6 text-slate-600 dark:text-slate-300">
            حساب کاربری شما مجوز مشاهده یا ویرایش این بخش را ندارد. در صورت نیاز می‌توانید به
            داشبورد بازگردید یا از حساب کاربری خارج شده و با حساب مجاز وارد شوید.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl brand-btn text-xs sm:text-sm font-semibold px-4 py-2 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              بازگشت به داشبورد
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold px-4 py-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              خروج و ورود با حساب دیگر
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-destructive guard: visiting a disabled or soft-uninstalled plugin route
  if (matched.manifest.implemented && !matched.manifest.isCore && (!matched.installed || !matched.enabled)) {
    return <PluginDisabledGuard status={matched} />;
  }

  const Component = matched.manifest.component;
  if (!Component) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-right space-y-3">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {matched.manifest.nameFa}
          </h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            این بسته الحاقی در نقشه راه فازهای بعدی قرار دارد.
          </p>
          <button
            type="button"
            onClick={() => navigate(roleDef.canManageAddons ? '/plugins' : '/dashboard')}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold px-4 py-2"
          >
            {roleDef.canManageAddons ? 'بازگشت به مدیریت بسته‌های الحاقی' : 'بازگشت به داشبورد'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div key={matched.manifest.route} className="route-fade-enter">
      <Component />
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { session } = useSchoolData();
  const { path, navigate } = useRouter();

  // Keep clean browser URL synced with auth state (/login vs /dashboard)
  useEffect(() => {
    if (!session && path !== '/login') {
      navigate('/login', { replace: true });
    } else if (session && path === '/login') {
      navigate('/dashboard', { replace: true });
    }
  }, [session, path, navigate]);

  if (!session) {
    return <LoginPage />;
  }

  if (session.mustChangePassword) {
    return <ForcePasswordChangeModal />;
  }

  return (
    <AppShell>
      <ActiveRouteView />
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <DataProvider manifests={PLUGIN_REGISTRY}>
          <AcademicYearProvider>
            <LabelProvider>
              <AppearanceProvider>
                <PrintProvider>
                  <RouterProvider>
                    <AuthenticatedApp />
                  </RouterProvider>
                </PrintProvider>
              </AppearanceProvider>
            </LabelProvider>
          </AcademicYearProvider>
        </DataProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
