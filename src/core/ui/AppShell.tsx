// Responsive RTL AppShell: Collapsible Desktop Sidebar, Mobile Bottom Tab Bar, Authenticated User Badge, Logout & Global Smart Search
import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogOut,
  Menu,
  ShieldAlert,
  UserCircle2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import {
  AcademicYearSwitcher,
  ArchivedYearBanner,
} from '../academic-year/AcademicYearSwitcher';
import { useAppearance, useSectionLabel } from '../appearance/AppearanceContext';
import { QuickAppearancePopover } from '../appearance/QuickAppearancePopover';
import { IdleLogoutWarningModal } from '../auth/IdleLogoutWarningModal';
import { canRoleAccessRoute } from '../auth/rbac';
import { SystemBrandLogo } from '../branding/BrandLogo';
import { CommandPalette } from '../components/CommandPalette';
import { useSchoolData } from '../data/DataContext';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { useRouter } from '../router/RouterContext';
import { useIdleLogout } from '../security/securityGuard';
import { useRoleLabel } from '../super-admin/LabelContext';
import { DEFAULT_COMPLEX_ID, evaluateModulePermission } from '../super-admin/superAdminHelpers';
import { PluginIcon } from './IconResolver';
import { useToast } from './ToastContext';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    session,
    impersonation,
    stopImpersonation,
    logout,
    schools,
    allSchools,
    activeSchool,
    educationalComplexes,
    activeSchoolId,
    setActiveSchoolId,
    activeRole,
    roleDef,
    roleGovernanceConfigs,
    isOnline,
    pluginStatuses,
    unreadParentChatCount,
    notificationCenter,
    globalSystemConfig,
    schoolBrandingConfigs,
    logSecurityEvent,
    panicModeState,
    isActiveSchoolPanicLocked,
    antiWipeAlertFa,
    clearAntiWipeAlert,
  } = useSchoolData();
  const {
    activeAppTitle,
    activeSchoolDisplayName,
    schoolLogoUrl,
  } = useAppearance();
  const {
    academicYears,
    academicYearId,
    switchAcademicYear,
  } = useAcademicYear();
  const { getSectionTitle } = useSectionLabel();
  const activeRoleMeta = useRoleLabel(activeRole);
  const { path, navigate } = useRouter();
  const { showToast } = useToast();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const effectiveBrandLogo =
    schoolLogoUrl || activeSchool?.logoDataUrl || globalSystemConfig?.systemLogoDataUrl || undefined;

  const schoolDisplayNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cfg of schoolBrandingConfigs) {
      const custom = cfg.schoolDisplayName?.trim();
      if (custom) map.set(cfg.schoolId, custom);
    }
    return map;
  }, [schoolBrandingConfigs]);

  const handleLogout = useCallback(() => {
    setMobileMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
    showToast('از حساب کاربری خارج شدید.', 'info');
  }, [logout, navigate, showToast]);

  const handleAutoIdleLogout = useCallback(() => {
    setMobileMenuOpen(false);
    logSecurityEvent({
      eventType: 'auto_logout_idle',
      schoolId: activeSchoolId,
      username: session?.username ?? 'unknown',
      displayName: session?.displayName,
      role: activeRole,
      detailsFa: 'خروج خودکار امنیتی پس از ۳۰ دقیقه عدم فعالیت کاربر',
    });
    logout();
    navigate('/login', { replace: true });
    showToast('به دلیل ۳۰ دقیقه عدم فعالیت، جهت حفظ امنیت از سامانه خارج شدید.', 'warning');
  }, [activeRole, activeSchoolId, logSecurityEvent, logout, navigate, session, showToast]);

  const { showWarning, secondsRemaining, stayActive } = useIdleLogout(
    Boolean(session),
    handleAutoIdleLogout
  );

  // Build dynamic navigation from Core + Enabled add-ons respecting BOTH static RBAC & live Super Admin permission matrix
  const coreNavItems = useMemo(
    () =>
      pluginStatuses.filter(
        (p) =>
          p.manifest.isCore &&
          p.manifest.implemented &&
          canRoleAccessRoute(activeRole, p.manifest.allowedRoles) &&
          (activeRole === 'super_admin' ||
            p.manifest.id === 'dashboard' ||
            ((p.manifest.id === 'smart-import-wizard' ||
              p.manifest.id === 'security-logs' ||
              p.manifest.id === 'recycle-bin') &&
              activeRole === 'principal') ||
            evaluateModulePermission({
              role: activeRole,
              moduleId: p.manifest.id,
              action: 'view',
              configs: roleGovernanceConfigs,
              manifests: pluginStatuses.map((x) => x.manifest),
            }))
      ),
    [pluginStatuses, activeRole, roleGovernanceConfigs]
  );

  const addonNavItems = useMemo(
    () =>
      pluginStatuses.filter(
        (p) =>
          !p.manifest.isCore &&
          p.manifest.implemented &&
          p.installed &&
          p.enabled &&
          canRoleAccessRoute(activeRole, p.manifest.allowedRoles) &&
          evaluateModulePermission({
            role: activeRole,
            moduleId: p.manifest.id,
            action: 'view',
            configs: roleGovernanceConfigs,
            manifests: pluginStatuses.map((x) => x.manifest),
          })
      ),
    [pluginStatuses, activeRole, roleGovernanceConfigs]
  );

  // Mobile bottom tab bar: Role-prioritized top 4 destinations so every touch target is >= 48px
  const mobileBottomTabs = useMemo(() => {
    const dashboard = coreNavItems.find((i) => i.manifest.id === 'dashboard');
    const list: typeof coreNavItems = [];
    if (dashboard) list.push(dashboard);

    if (activeRole === 'student') {
      const subjectsItem = coreNavItems.find((i) => i.manifest.id === 'subjects');
      if (subjectsItem) list.push(subjectsItem);
      const preferredStudentIds = ['homework', 'flipped-video', 'online-exams', 'online-classroom'];
      for (const pid of preferredStudentIds) {
        if (list.length >= 4) break;
        const found = addonNavItems.find((a) => a.manifest.id === pid);
        if (found) list.push(found);
      }
    } else if (activeRole === 'parent') {
      const subjectsItem = coreNavItems.find((i) => i.manifest.id === 'subjects');
      if (subjectsItem) list.push(subjectsItem);
      const preferredParentIds = ['parent-staff-chat', 'gradebook', 'online-exams', 'student-attendance'];
      for (const pid of preferredParentIds) {
        if (list.length >= 4) break;
        const found = addonNavItems.find((a) => a.manifest.id === pid);
        if (found) list.push(found);
      }
    } else if (activeRole === 'teacher') {
      const subjectsItem = coreNavItems.find((i) => i.manifest.id === 'subjects');
      if (subjectsItem) list.push(subjectsItem);
      const archiveItem = coreNavItems.find((i) => i.manifest.id === 'smart-archive');
      if (archiveItem) list.push(archiveItem);
    } else {
      const directory = coreNavItems.find((i) => i.manifest.id === 'directory');
      if (directory) list.push(directory);
    }

    for (const addon of addonNavItems) {
      if (list.length >= 4) break;
      if (!list.some((x) => x.manifest.id === addon.manifest.id)) {
        list.push(addon);
      }
    }
    if (list.length < 4) {
      const addonsPage = coreNavItems.find((i) => i.manifest.id === 'addons');
      if (addonsPage && !list.some((x) => x.manifest.id === 'addons')) {
        list.push(addonsPage);
      }
    }
    return list.slice(0, 4);
  }, [coreNavItems, addonNavItems, activeRole]);

  const isNavRouteActive = useCallback(
    (route: string) => {
      if (path === route) return true;
      if (route === '/subjects' && path.startsWith('/subjects/')) return true;
      return false;
    },
    [path]
  );

  const getItemBadgeCount = useCallback(
    (manifestId: string): number => {
      const liveBadge = notificationCenter.sidebarBadges[manifestId] ?? 0;
      if (manifestId === 'parent-staff-chat') {
        return Math.max(liveBadge, unreadParentChatCount);
      }
      return liveBadge;
    },
    [notificationCenter.sidebarBadges, unreadParentChatCount]
  );

  const activeNavClass = 'brand-nav-active';

  const handleNavClick = (route: string) => {
    navigate(route);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell-root min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Collapsible RTL Sidebar */}
      <aside
        aria-label="ناوبری اصلی سامانه"
        className={`no-print hidden md:flex flex-col shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 sticky top-0 h-screen ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {/* Brand Row */}
        <div className="h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleNavClick('/dashboard')}
            className="flex items-center gap-2.5 min-w-0 text-right"
          >
            <SystemBrandLogo
              logoDataUrl={effectiveBrandLogo}
              size="sm"
              className="shrink-0"
              alt={activeSchoolDisplayName || activeAppTitle}
            />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="block text-[13px] font-extrabold text-slate-900 dark:text-slate-100 leading-snug truncate">
                  {activeSchoolDisplayName}
                </span>
                <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {activeAppTitle}
                </span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'باز کردن منوی کناری' : 'جمع کردن منوی کناری'}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Core Section */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                هسته مدیریت
              </div>
            )}
            {coreNavItems.map((item) => {
              const isActive = isNavRouteActive(item.manifest.route);
              const defaultCoreLabel =
                item.manifest.id === 'subjects' && activeRole === 'teacher'
                  ? 'کلاس‌ها و دروس من'
                  : item.manifest.shortNameFa;
              const coreLabel = getSectionTitle(item.manifest.id, defaultCoreLabel);
              const badgeCount = getItemBadgeCount(item.manifest.id);
              return (
                <button
                  key={item.manifest.id}
                  type="button"
                  onClick={() => handleNavClick(item.manifest.route)}
                  title={coreLabel}
                  className={`sidebar-nav-item relative w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm transition-colors ${
                    isActive
                      ? activeNavClass
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <PluginIcon name={item.manifest.iconName} className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-right text-[13px] leading-snug">{coreLabel}</span>
                      {badgeCount > 0 && (
                        <span className="relative inline-flex items-center justify-center shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60" />
                          <span className="relative px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                            {toPersianDigits(badgeCount)}
                          </span>
                        </span>
                      )}
                    </>
                  )}
                  {sidebarCollapsed && badgeCount > 0 && (
                    <span className="absolute top-1.5 left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {toPersianDigits(badgeCount)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Operational Add-ons Section */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                <span>
                  {activeRole === 'student'
                    ? 'امکانات دانش‌آموز'
                    : activeRole === 'parent'
                      ? 'امکانات پنل خانواده'
                      : 'بسته‌های الحاقی فعال'}
                </span>
                <span className="tabular-nums">{toPersianDigits(addonNavItems.length)}</span>
              </div>
            )}
            {addonNavItems.length === 0 ? (
              !sidebarCollapsed && (
                <div className="px-3 py-2 text-xs text-slate-400">
                  بسته عملیاتی فعالی وجود ندارد.
                </div>
              )
            ) : (
              addonNavItems.map((item) => {
                const isActive = isNavRouteActive(item.manifest.route);
                const roleDefaultLabel =
                  activeRole === 'parent' && item.manifest.id === 'student-attendance'
                    ? 'حضور و غیاب فرزند من'
                    : activeRole === 'teacher' && item.manifest.id === 'staff-attendance'
                      ? 'برنامه و کارکرد من'
                      : item.manifest.shortNameFa;
                const displayLabel = getSectionTitle(item.manifest.id, roleDefaultLabel);
                const badgeCount = getItemBadgeCount(item.manifest.id);
                return (
                  <button
                    key={item.manifest.id}
                    type="button"
                    onClick={() => handleNavClick(item.manifest.route)}
                    title={displayLabel}
                    className={`sidebar-nav-item w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm transition-colors relative ${
                      isActive
                        ? activeNavClass
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <PluginIcon name={item.manifest.iconName} className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate whitespace-nowrap flex-1 text-right">
                          {displayLabel}
                        </span>
                        {badgeCount > 0 && (
                          <span className="relative inline-flex items-center justify-center shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60" />
                            <span className="relative px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                              {toPersianDigits(badgeCount)}
                            </span>
                          </span>
                        )}
                      </>
                    )}
                    {sidebarCollapsed && badgeCount > 0 && (
                      <span className="absolute top-1.5 left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {toPersianDigits(badgeCount)}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </nav>

        {/* Sidebar Footer: Authenticated Account Summary + Logout */}
        {!sidebarCollapsed ? (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {session?.displayName ?? 'کاربر سامانه'}
              </div>
              <div className="text-slate-500 dark:text-slate-400 truncate">
                {activeRoleMeta.labelFa} · {activeSchoolDisplayName}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold px-3 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                خروج از حساب کاربری
              </button>
            </div>
            <PWAInstallButton compact />
          </div>
        ) : (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <button
              type="button"
              onClick={handleLogout}
              title="خروج از حساب کاربری"
              aria-label="خروج از حساب کاربری"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Unified Sticky Top Stack: Fixed Global Panic Mode Red Alert + Impersonation + Anti-Wipe + Workspace Header */}
        <div className="no-print sticky top-0 z-40">
          {/* Fixed Global Red Panic Mode (Read-Only Freeze) Warning Bar */}
          {(isActiveSchoolPanicLocked || (activeRole === 'super_admin' && panicModeState.enabled)) && (
            <div
              role="alert"
              data-testid="global-panic-mode-banner"
              className="bg-rose-600 text-white px-3 sm:px-5 py-2.5 border-b border-rose-700 flex flex-wrap items-center justify-between gap-2 text-xs shadow-md"
            >
              <div className="flex items-center gap-2 font-extrabold leading-5">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>
                  {isActiveSchoolPanicLocked ? (
                    <>
                      قفل اضطراری سامانه (حالت فقط‌خواندنی) فعال است — تمامی عملیات ثبت، ویرایش و حذف
                      در این مدرسه تا رفع قفل توسط راهبر ارشد مسدود شده است.
                    </>
                  ) : (
                    <>
                      قفل اضطراری سامانه برای{' '}
                      {panicModeState.scope === 'all_schools'
                        ? `کل ${toPersianDigits(allSchools.length)} مدرسه`
                        : allSchools
                            .filter((s) => panicModeState.lockedSchoolIds.includes(s.id))
                            .map((s) => s.name)
                            .join('، ') ||
                          `${toPersianDigits(panicModeState.lockedSchoolIds.length)} مدرسه منتخب`}{' '}
                      فعال است (حالت فقط‌خواندنی).
                    </>
                  )}
                  {panicModeState.reasonFa ? ` — ${panicModeState.reasonFa}` : ''}
                </span>
              </div>
              {activeRole === 'super_admin' && (
                <button
                  type="button"
                  onClick={() => navigate('/data-health-migration')}
                  className="min-h-[36px] rounded-lg bg-white/20 hover:bg-white/30 px-3 text-[11px] font-extrabold transition-colors shrink-0"
                >
                  مدیریت و رفع قفل اضطراری
                </button>
              )}
            </div>
          )}

          {/* Sticky Impersonation Preview Banner (Visible ONLY when Super Admin previews another role) */}
          {impersonation && (
            <div
              data-testid="impersonation-banner"
              className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-3 py-2 text-xs font-extrabold text-slate-950 sm:px-5"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 shrink-0" />
                <span>
                  در حال مشاهده با دید «{activeRoleMeta.labelFa}» ({impersonation.targetDisplayName})
                </span>
              </div>
              <button
                type="button"
                data-testid="exit-impersonation-btn"
                onClick={stopImpersonation}
                className="rounded-lg bg-slate-950 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                بازگشت به پنل راهبر ارشد
              </button>
            </div>
          )}

          {/* Anti-Wipe Circuit Breaker Security Banner */}
          {antiWipeAlertFa && (
            <div
              role="alert"
              className="bg-amber-600 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{antiWipeAlertFa}</span>
              </div>
              <button
                type="button"
                onClick={clearAntiWipeAlert}
                className="min-h-[32px] rounded-lg bg-white/20 hover:bg-white/30 px-2.5 text-[11px] font-bold"
              >
                بستن هشدار
              </button>
            </div>
          )}

          {/* Top Workspace Header */}
          <header className="h-14 md:h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Right side (RTL start): Mobile drawer trigger + brand icon + School Workspace Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 md:flex-initial">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منوی سامانه"
              className="md:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('/dashboard')}
              aria-label={activeAppTitle}
              className="md:hidden shrink-0"
            >
              <SystemBrandLogo
                logoDataUrl={effectiveBrandLogo}
                size="sm"
                alt={activeAppTitle}
              />
            </button>

            <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              {roleDef.canSwitchSchool ? (
                <select
                  aria-label="انتخاب مدرسه فعال"
                  value={activeSchoolId}
                  onChange={(e) => setActiveSchoolId(e.target.value)}
                  className="min-h-[38px] w-full max-w-[130px] sm:max-w-[230px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] sm:text-sm font-bold text-slate-900 dark:text-slate-100 px-2 sm:px-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] truncate"
                >
                  {activeRole === 'super_admin' && educationalComplexes.length > 1
                    ? educationalComplexes.map((complex) => {
                        const groupSchools = schools.filter(
                          (s) => (s.complexId ?? DEFAULT_COMPLEX_ID) === complex.id
                        );
                        if (groupSchools.length === 0) return null;
                        return (
                          <optgroup key={complex.id} label={complex.name}>
                            {groupSchools.map((school) => (
                              <option key={school.id} value={school.id}>
                                {school.id === activeSchoolId
                                  ? activeSchoolDisplayName
                                  : schoolDisplayNameById.get(school.id) || school.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })
                    : schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.id === activeSchoolId
                            ? activeSchoolDisplayName
                            : schoolDisplayNameById.get(school.id) || school.name}
                        </option>
                      ))}
                </select>
              ) : (
                <div
                  title={activeSchoolDisplayName}
                  className="min-h-[40px] max-w-[140px] sm:max-w-[220px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 px-2.5 sm:px-3 flex items-center text-[11px] sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate"
                >
                  {activeSchoolDisplayName}
                </div>
              )}
            </div>
          </div>

          {/* Center: Unified Global Role-Scoped Command Palette (Ctrl + K) */}
          <CommandPalette />

          {/* Left side (RTL end): User Badge, Online/Offline, Logout, and Top-Left Quick Appearance Popover */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Authenticated User Identity Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 max-w-[240px]">
              <UserCircle2 className="w-4 h-4 brand-text shrink-0" />
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {session?.displayName}
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {activeRoleMeta.shortLabelFa}
                </div>
              </div>
            </div>

            {/* Compact role badge on tablet only (hidden on ultra-narrow 360px phones to prevent crowding) */}
            <div className="hidden sm:inline-flex lg:hidden items-center gap-1 px-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-700 dark:text-slate-200 max-w-[96px] truncate">
              <span className="truncate">{activeRoleMeta.shortLabelFa}</span>
            </div>

            <div
              title={isOnline ? 'متصل به شبکه (ذخیره‌سازی آفلاین فعال)' : 'حالت آفلاین — ذخیره در حافظه محلی'}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>آنلاین</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>آفلاین</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="خروج از حساب کاربری"
              title="خروج از حساب کاربری"
              className="min-h-[38px] min-w-[38px] sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">خروج</span>
            </button>

            {/* Internal Notification Center Bell with Functional Pulsing Red Dot */}
            <NotificationCenter />

            {/* Academic Year Switcher next to Quick Appearance Popover */}
            <AcademicYearSwitcher />

            {/* Far Top-Left Corner: Quick Appearance Popover (Font, Color, Background Tint & Theme Mode) */}
            <QuickAppearancePopover />
          </div>
        </header>
        </div>

        {/* Slim Amber Read-Only Archive Banner when viewing an archived academic year */}
        <ArchivedYearBanner hasImpersonationBanner={Boolean(impersonation)} />

        {/* Main Scrollable Viewport */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 md:pb-10">
          {children}
          <footer className="no-print mt-10 pt-4 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span>{activeAppTitle}</span>
            <span>{activeSchoolDisplayName}</span>
          </footer>
        </main>
      </div>

      {/* Idle Logout 60-Second Security Warning Modal */}
      <IdleLogoutWarningModal
        open={showWarning}
        secondsRemaining={secondsRemaining}
        onStayActive={stayActive}
        onLogoutNow={handleLogout}
      />

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col border-l border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="h-14 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <SystemBrandLogo
                  logoDataUrl={effectiveBrandLogo}
                  size="sm"
                  alt={activeSchoolDisplayName || activeAppTitle}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {activeSchoolDisplayName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {activeAppTitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="بستن منو"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Authenticated User Card + Mobile Academic Year Switcher inside Mobile Drawer */}
            <div className="px-3 pt-3 space-y-2.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 p-3 flex items-center gap-2.5">
                <UserCircle2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {session?.displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {activeRoleMeta.labelFa}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  aria-label="انتخاب سال تحصیلی در موبایل"
                  value={academicYearId}
                  onChange={(e) => switchAcademicYear(e.target.value)}
                  className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {academicYears.map((yr) => (
                    <option key={yr.id} value={yr.id}>
                      سال تحصیلی {toPersianDigits(yr.code || yr.label)}
                      {yr.status === 'archived'
                        ? ' (آرشیو)'
                        : yr.status === 'active'
                          ? ' (فعال)'
                          : ' (آینده)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1">
                <div className="px-3 text-[11px] font-semibold text-slate-400">هسته مدیریت</div>
                {coreNavItems.map((item) => {
                  const badgeCount = getItemBadgeCount(item.manifest.id);
                  const defaultCoreLabel =
                    item.manifest.id === 'subjects' && activeRole === 'teacher'
                      ? 'کلاس‌ها و دروس من'
                      : item.manifest.shortNameFa;
                  return (
                    <button
                      key={item.manifest.id}
                      type="button"
                      onClick={() => handleNavClick(item.manifest.route)}
                      className={`w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm ${
                        isNavRouteActive(item.manifest.route)
                          ? activeNavClass
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <PluginIcon name={item.manifest.iconName} className="w-5 h-5 shrink-0" />
                      <span className="flex-1 text-right leading-snug text-[13px]">
                        {getSectionTitle(item.manifest.id, defaultCoreLabel)}
                      </span>
                      {badgeCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                          {toPersianDigits(badgeCount)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {addonNavItems.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 text-[11px] font-semibold text-slate-400">
                    {activeRole === 'student'
                      ? 'امکانات دانش‌آموز'
                      : activeRole === 'parent'
                        ? 'امکانات پنل خانواده'
                        : 'بسته‌های فعال'}
                  </div>
                  {addonNavItems.map((item) => {
                    const roleDefaultLabel =
                      activeRole === 'parent' && item.manifest.id === 'student-attendance'
                        ? 'حضور و غیاب فرزند من'
                        : activeRole === 'teacher' && item.manifest.id === 'staff-attendance'
                          ? 'برنامه و کارکرد من'
                          : item.manifest.shortNameFa;
                    const displayLabel = getSectionTitle(item.manifest.id, roleDefaultLabel);
                    const badgeCount = getItemBadgeCount(item.manifest.id);
                    return (
                      <button
                        key={item.manifest.id}
                        type="button"
                        onClick={() => handleNavClick(item.manifest.route)}
                        className={`w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm ${
                          isNavRouteActive(item.manifest.route)
                            ? activeNavClass
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <PluginIcon name={item.manifest.iconName} className="w-5 h-5 shrink-0" />
                        <span className="flex-1 text-right truncate">{displayLabel}</span>
                        {badgeCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                            {toPersianDigits(badgeCount)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </nav>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm font-semibold"
              >
                <LogOut className="w-4 h-4" />
                خروج از حساب کاربری
              </button>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{isOnline ? 'وضعیت: آنلاین' : 'وضعیت: آفلاین'}</span>
                <PWAInstallButton compact />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Tab Bar (< md) */}
      <nav
        aria-label="ناوبری پایین موبایل"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div
          className="grid h-16 items-center"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, mobileBottomTabs.length)}, minmax(0, 1fr))` }}
        >
          {mobileBottomTabs.map((item) => {
            const isActive = isNavRouteActive(item.manifest.route);
            const badgeCount = getItemBadgeCount(item.manifest.id);
            const roleDefaultLabel =
              activeRole === 'parent' && item.manifest.id === 'student-attendance'
                ? 'فرزند من'
                : activeRole === 'teacher' && item.manifest.id === 'staff-attendance'
                  ? 'برنامه من'
                  : item.manifest.id === 'subjects' && activeRole === 'teacher'
                    ? 'کلاس‌ها'
                    : item.manifest.shortNameFa;
            const displayLabel = getSectionTitle(item.manifest.id, roleDefaultLabel);
            return (
              <button
                key={item.manifest.id}
                type="button"
                onClick={() => handleNavClick(item.manifest.route)}
                className={`relative min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                  isActive
                    ? 'brand-text font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="relative inline-flex">
                  <PluginIcon name={item.manifest.iconName} className="w-5 h-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -left-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
                      {toPersianDigits(badgeCount)}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-none truncate max-w-full">
                  {displayLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
