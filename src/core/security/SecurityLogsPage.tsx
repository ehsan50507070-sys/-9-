// Layer-1 Security: «گزارش امنیتی و ورودها» (/security-logs)
// Accessible strictly to super_admin (all schools with school filter) and principal (strictly scoped to own school).
// Supports A4/A5 pure-white printing exclusively via <PrintIconButton /> & PrintPreviewPortal.
import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  Unlock,
  UserPlus,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  AuditChainVerificationResult,
  SecurityAuditEventType,
  SecurityAuditLogEntry,
} from '../../types/domain';
import { ROLE_DEFINITIONS } from '../auth/rbac';
import { OFFICIAL_SYSTEM_NAME_FA } from '../branding/BrandLogo';
import { useSchoolData } from '../data/DataContext';
import { PrintIconButton } from '../print/PrintIconButton';
import { EmptyStateSvg } from '../ui/EmptyStateSvg';
import { verifyAuditLogChain } from './DataIntegrityGuard';

const EVENT_TYPE_META: Record<
  SecurityAuditEventType,
  { labelFa: string; badgeClass: string; Icon: React.FC<{ className?: string }> }
> = {
  login_success: {
    labelFa: 'ورود موفق',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  login_failed: {
    labelFa: 'ورود ناموفق',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    Icon: AlertTriangle,
  },
  account_locked: {
    labelFa: 'قفل شدن حساب',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    Icon: Lock,
  },
  password_changed: {
    labelFa: 'تغییر رمز عبور',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    Icon: KeyRound,
  },
  plugin_toggled: {
    labelFa: 'تغییر وضعیت بسته الحاقی',
    badgeClass:
      'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    Icon: ToggleLeft,
  },
  user_created: {
    labelFa: 'ایجاد حساب کاربری',
    badgeClass:
      'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    Icon: UserPlus,
  },
  auto_logout_idle: {
    labelFa: 'خروج خودکار (عدم فعالیت)',
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    Icon: Shield,
  },
  panic_mode_enabled: {
    labelFa: 'فعال‌سازی قفل اضطراری',
    badgeClass:
      'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    Icon: AlertOctagon,
  },
  panic_mode_disabled: {
    labelFa: 'رفع قفل اضطراری',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Icon: Unlock,
  },
  anti_wipe_triggered: {
    labelFa: 'فعال‌شدن سپر ضدحذف گروهی',
    badgeClass:
      'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    Icon: ShieldAlert,
  },
  soft_delete_restored: {
    labelFa: 'بازیابی از سطل بازیابی امن',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Icon: RotateCcw,
  },
  migration_executed: {
    labelFa: 'اجرای موتور مهاجرت داده',
    badgeClass:
      'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    Icon: Database,
  },
  backup_restored: {
    labelFa: 'بازگردانی پشتیبان امن',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    Icon: ShieldCheck,
  },
  school_branding_updated: {
    labelFa: 'تغییر لوگو و سربرگ مدرسه',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    Icon: Building2,
  },
  smart_import_executed: {
    labelFa: 'ورود هوشمند و نگاشت جدول‌ها',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Icon: Database,
  },
  discipline_pledge_signed: {
    labelFa: 'تأیید و امضای تعهدنامه انضباطی',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    Icon: ShieldCheck,
  },
  student_exit_logged: {
    labelFa: 'ثبت برگه خروج / بازگشت دانش‌آموز',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    Icon: CheckCircle2,
  },
  counseling_clinical_viewed: {
    labelFa: 'مشاهده یادداشت بالینی محرمانه مشاوره',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    Icon: Lock,
  },
  counseling_clinical_edited: {
    labelFa: 'ثبت / ویرایش یادداشت بالینی مشاوره',
    badgeClass:
      'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    Icon: ShieldAlert,
  },
  counseling_audit_access_toggled: {
    labelFa: 'تغییر مجوز ممیزی مشاوره مدیر',
    badgeClass:
      'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    Icon: ToggleLeft,
  },
};

export const SecurityLogsPage: React.FC = () => {
  const {
    activeRole,
    activeSchool,
    allSchools,
    securityAuditLogs,
    session,
  } = useSchoolData();

  const isSuperAdmin = activeRole === 'super_admin';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [chainReport, setChainReport] = useState<AuditChainVerificationResult | null>(null);

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    try {
      const report = await verifyAuditLogChain(securityAuditLogs);
      setChainReport(report);
    } finally {
      setVerifyingChain(false);
    }
  };

  const schoolNameById = useMemo(
    () => new Map(allSchools.map((s) => [s.id, s.name])),
    [allSchools]
  );

  // Strict scope filtering: Principal sees ONLY own school; Super Admin sees all schools + optional filter
  const scopedLogs = useMemo(() => {
    const base = isSuperAdmin
      ? selectedSchoolId === 'all'
        ? securityAuditLogs
        : securityAuditLogs.filter((l) => l.schoolId === selectedSchoolId)
      : securityAuditLogs.filter((l) => l.schoolId === (session?.schoolId ?? activeSchool.id));

    return base.filter((log) => {
      if (eventFilter !== 'all' && log.eventType !== eventFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = `${log.actorName} ${log.actorUsername} ${log.summaryFa} ${log.detailsFa ?? ''} ${log.targetLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    isSuperAdmin,
    selectedSchoolId,
    securityAuditLogs,
    session?.schoolId,
    activeSchool.id,
    eventFilter,
    query,
  ]);

  const kpis = useMemo(() => {
    const counts = {
      total: scopedLogs.length,
      success: 0,
      failed: 0,
      locked: 0,
    };
    for (const log of scopedLogs) {
      if (log.eventType === 'login_success') counts.success += 1;
      else if (log.eventType === 'login_failed') counts.failed += 1;
      else if (log.eventType === 'account_locked') counts.locked += 1;
    }
    return counts;
  }, [scopedLogs]);

  if (!isSuperAdmin && activeRole !== 'principal') {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            عدم دسترسی به گزارش امنیتی
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            مشاهده گزارش‌های امنیتی و ورودها صرفاً برای راهبر ارشد سامانه و مدیر مدرسه مجاز است.
          </p>
        </div>
      </div>
    );
  }

  const resolveSchoolLabel = (log: SecurityAuditLogEntry): string => {
    if (log.schoolId === '__global__') return 'کل سامانه';
    return schoolNameById.get(log.schoolId) ?? log.schoolId;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#2B5B84]/10 dark:bg-sky-950/60 text-[#2B5B84] dark:text-sky-300 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              گزارش امنیتی و ورودها
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
              {isSuperAdmin
                ? `پایش کامل رویدادهای احراز هویت، قفل حساب، تغییر رمز و بسته‌های الحاقی در ${OFFICIAL_SYSTEM_NAME_FA}`
                : `گزارش رویدادهای امنیتی اختصاصی «${activeSchool.name}»`}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={verifyingChain}
            onClick={() => void handleVerifyChain()}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {verifyingChain
                ? 'در حال بررسی زنجیره SHA-256...'
                : 'بررسی اصالت زنجیره SHA-256 گزارش‌ها'}
            </span>
          </button>
          <PrintIconButton
            documentLabel={`گزارش امنیتی و ورودها — ${isSuperAdmin && selectedSchoolId === 'all' ? OFFICIAL_SYSTEM_NAME_FA : activeSchool.name}`}
            targetSelector="#security-logs-print-area"
            landscape
          />
        </div>
      </div>

      {/* Tamper-Evident SHA-256 Audit Chain Verification Result */}
      {chainReport && (
        <div
          role="status"
          className={`rounded-2xl border p-4 space-y-2 text-xs ${
            chainReport.valid
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
            <div className="flex items-center gap-2">
              {chainReport.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>
                {chainReport.valid
                  ? 'اصالت و سلامت زنجیره امضای SHA-256 گزارش‌های امنیتی کاملاً تایید شد (بدون دستکاری).'
                  : `هشدار امنیتی: ${toPersianDigits(chainReport.corruptedEntries.length)} مورد مغایرت یا حذف ردیف در زنجیره SHA-256 شناسایی شد!`}
              </span>
            </div>
            <span className="tabular-nums text-[11px] opacity-85">
              تاییدشده: {toPersianDigits(chainReport.verifiedEntries)} از{' '}
              {toPersianDigits(chainReport.totalEntries)} ردیف
              {chainReport.headHash && (
                <>
                  {' '}
                  • امضای سرزنجیره:{' '}
                  <span dir="ltr" className="font-mono">
                    {chainReport.headHash.slice(0, 12)}…
                  </span>
                </>
              )}
            </span>
          </div>
          {chainReport.corruptedEntries.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-rose-200 dark:border-rose-900">
              {chainReport.corruptedEntries.map((item) => (
                <div key={`${item.id}-${item.index}`} className="text-[11px]">
                  • ردیف {toPersianDigits(item.index + 1)} ({toPersianDigits(item.timestampJalali)}):{' '}
                  {item.reasonFa}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">کل رویدادهای ثبت‌شده</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {toPersianDigits(kpis.total)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">ورودهای موفق</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
            {toPersianDigits(kpis.success)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">تلاش‌های ناموفق</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
            {toPersianDigits(kpis.failed)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">رویدادهای قفل حساب</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
            {toPersianDigits(kpis.locked)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در نام کاربری، نام کاربر یا شرح رویداد..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-xs text-slate-900 dark:text-white focus:border-[#2B5B84] focus:outline-none"
          />
        </div>

        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه نوع رویدادها</option>
          {(Object.keys(EVENT_TYPE_META) as SecurityAuditEventType[]).map((key) => (
            <option key={key} value={key}>
              {EVENT_TYPE_META[key].labelFa}
            </option>
          ))}
        </select>

        {isSuperAdmin ? (
          <div className="relative flex items-center">
            <Building2 className="pointer-events-none absolute right-3 w-4 h-4 text-slate-400" />
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="all">همه مدارس و رویدادهای کل سامانه</option>
              <option value="__global__">فقط رویدادهای کل سامانه</option>
              {allSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#2B5B84] dark:text-sky-400 shrink-0" />
            <span className="truncate">محدوده: {activeSchool.name}</span>
          </div>
        )}
      </div>

      {/* Responsive Audit Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {scopedLogs.length === 0 ? (
          <div className="p-4">
            <EmptyStateSvg
              variant="security"
              titleFa="هنوز رویداد امنیتی مطابقی ثبت نشده است"
              descriptionFa="ورودهای کاربران، تلاش‌های ناموفق، تغییر رمز عبور، ایجاد کاربران جدید و تغییر وضعیت بسته‌های الحاقی به‌صورت خودکار در این بخش ثبت می‌شوند."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">تاریخ و ساعت</th>
                  <th className="px-3 py-3 font-extrabold whitespace-nowrap">نوع رویداد</th>
                  <th className="px-3 py-3 font-extrabold">کاربر / شناسه</th>
                  <th className="px-3 py-3 font-extrabold">واحد آموزشی</th>
                  <th className="px-4 py-3 font-extrabold">شرح و جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {scopedLogs.map((log) => {
                  const meta = EVENT_TYPE_META[log.eventType];
                  const Icon = meta.Icon;
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200 font-semibold">
                        <div>{toPersianDigits(log.timestampJalali)}</div>
                        <div className="text-[11px] text-slate-400">
                          ساعت {toPersianDigits(log.timeHm)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${meta.badgeClass}`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{meta.labelFa}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {log.actorName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span className="font-mono" dir="ltr">
                            {log.actorUsername}
                          </span>
                          {log.actorRole && (
                            <>
                              <span>·</span>
                              <span>{ROLE_DEFINITIONS[log.actorRole]?.shortLabelFa ?? log.actorRole}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {resolveSchoolLabel(log)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {log.summaryFa}
                        </div>
                        {log.detailsFa && log.detailsFa !== log.summaryFa && (
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {log.detailsFa}
                          </div>
                        )}
                        {log.entryHash && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                            SHA-256: {log.entryHash.slice(0, 12)}…
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden Print-Ready Table Container for PrintPreviewPortal */}
      <div id="security-logs-print-area" className="hidden print:block space-y-4 text-right text-xs">
        <div className="text-xs text-slate-600">
          تاریخ تهیه گزارش: {toPersianDigits(getTodayJalali())} · تعداد رویداد: {toPersianDigits(scopedLogs.length)}
          {chainReport && (
            <>
              {' '}
              · وضعیت زنجیره SHA-256:{' '}
              <strong>
                {chainReport.valid ? 'سالم و بدون دستکاری' : 'دارای هشدار دستکاری'}
              </strong>
            </>
          )}
        </div>
        <table className="w-full border-collapse text-right text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5">تاریخ و ساعت</th>
              <th className="border border-slate-300 px-2 py-1.5">نوع رویداد</th>
              <th className="border border-slate-300 px-2 py-1.5">کاربر / نام کاربری</th>
              <th className="border border-slate-300 px-2 py-1.5">واحد آموزشی</th>
              <th className="border border-slate-300 px-2 py-1.5">شرح رویداد</th>
            </tr>
          </thead>
          <tbody>
            {scopedLogs.slice(0, 120).map((log) => (
              <tr key={log.id}>
                <td className="border border-slate-300 px-2 py-1 tabular-nums whitespace-nowrap">
                  {toPersianDigits(log.timestampJalali)} — {toPersianDigits(log.timeHm)}
                </td>
                <td className="border border-slate-300 px-2 py-1 font-bold">
                  {EVENT_TYPE_META[log.eventType].labelFa}
                </td>
                <td className="border border-slate-300 px-2 py-1">
                  {log.actorName} ({log.actorUsername})
                </td>
                <td className="border border-slate-300 px-2 py-1">{resolveSchoolLabel(log)}</td>
                <td className="border border-slate-300 px-2 py-1">{log.summaryFa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
