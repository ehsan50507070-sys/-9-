// Step 3-B: Dedicated «مرکز سلامت داده و مهاجرت» Page (/data-health-migration)
// Exclusively accessible to super_admin. Supports standalone route & embedded tab mode.
import React, { useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  History,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { useRouter } from '../../core/router/RouterContext';
import { PanicModeControlCard } from '../../core/security/PanicModeControlCard';
import { SensitiveActionModal } from '../../core/security/SensitiveActionModal';
import type { MigrationProgressState } from '../../core/storage/MigrationEngine';
import { toPersianDigits } from '../../lib/digits';
import type {
  DailyRollingSnapshot,
  MigrationBundleScope,
  MigrationBundleVerificationResult,
  ReferentialIntegrityReport,
} from '../../types/domain';

export interface DataHealthMigrationPageProps {
  embedded?: boolean;
}

export const DataHealthMigrationPage: React.FC<DataHealthMigrationPageProps> = ({
  embedded = false,
}) => {
  const {
    realSession,
    allSchools,
    academicYears,
    vaultMeta,
    dailyRollingSnapshots,
    lastUndoSnapshot,
    runVaultChunkedMigration,
    runDataIntegrityCheck,
    exportPhase10MigrationBundle,
    verifyMigrationBundleFile,
    executeGranularBundleRestore,
    undoLastBundleRestore,
    createDailyRollingSnapshotNow,
    restoreDailyRollingSnapshot,
  } = useSchoolData();
  const { navigate } = useRouter();

  // Section 1: Referential Integrity Checker (Complex-Wide or Per-School)
  const [integritySchoolScope, setIntegritySchoolScope] = useState<string>('all');
  const [integrityReport, setIntegrityReport] = useState<ReferentialIntegrityReport>(() =>
    runDataIntegrityCheck('all')
  );

  // Section 2: Sealed Migration Bundle JSON Export
  const [exportScope, setExportScope] = useState<MigrationBundleScope>('complex_wide');
  const [exportSchoolId, setExportSchoolId] = useState<string>(allSchools[0]?.id ?? 'school-1');
  const [exportYearId, setExportYearId] = useState<string>(
    academicYears[0]?.code ?? '1404-1405'
  );
  const [exporting, setExporting] = useState(false);

  // Section 3: Granular Dry-Run Restore
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bundleVerification, setBundleVerification] =
    useState<MigrationBundleVerificationResult | null>(null);
  const [restoreBundleModalOpen, setRestoreBundleModalOpen] = useState(false);

  // Section 4: Rolling Snapshots (up to 5 recent)
  const [snapshotToRestore, setSnapshotToRestore] = useState<DailyRollingSnapshot | null>(null);
  const [creatingSnap, setCreatingSnap] = useState(false);

  // Chunked Migration Engine
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgressState | null>(null);
  const [migrationBanner, setMigrationBanner] = useState<{
    type: 'ok' | 'rollback';
    text: string;
  } | null>(null);

  // Global feedback banner
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!realSession || realSession.role !== 'super_admin') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900/50 dark:bg-slate-900">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">
          دسترسی محدود به راهبر ارشد سامانه
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          صفحه «مرکز سلامت داده و مهاجرت»، پشتیبان‌گیری مهروموم‌شده، آزمون سلامت جداول و نقاط بازیابی صرفاً برای نقش «راهبر ارشد سامانه» مجاز است.
        </p>
      </div>
    );
  }

  const integrityScopeLabelFa =
    integritySchoolScope === 'all'
      ? `کل مجموعه (${toPersianDigits(allSchools.length)} مدرسه)`
      : allSchools.find((s) => s.id === integritySchoolScope)?.name ?? integritySchoolScope;

  const handleRunIntegrity = (targetScope: string = integritySchoolScope) => {
    const report = runDataIntegrityCheck(targetScope);
    setIntegrityReport(report);
    const label =
      targetScope === 'all'
        ? `کل مجموعه (${toPersianDigits(allSchools.length)} مدرسه)`
        : allSchools.find((s) => s.id === targetScope)?.name ?? targetScope;
    setFeedback({
      type: report.status === 'red' ? 'err' : 'ok',
      text:
        report.status === 'green'
          ? `بررسی سلامت «${label}» (${toPersianDigits(report.totalRecordsChecked)} رکورد) کامل شد: هیچ رکورد بی‌صاحب (Orphan) یا ارجاع نامعتبری یافت نشد.`
          : `بررسی سلامت «${label}» کامل شد: ${toPersianDigits(report.orphanCount)} رکورد بی‌صاحب بحرانی و ${toPersianDigits(report.warningCount)} هشدار شناسایی شد.`,
    });
  };

  const handleIntegrityScopeChange = (nextScope: string) => {
    setIntegritySchoolScope(nextScope);
    setIntegrityReport(runDataIntegrityCheck(nextScope));
  };

  const handleExportSealedBundle = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const bundle = await exportPhase10MigrationBundle(
        exportScope,
        exportScope === 'single_school' ? exportSchoolId : undefined,
        exportScope === 'academic_year' ? exportYearId : undefined
      );
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const scopeTag =
        exportScope === 'complex_wide'
          ? 'complex'
          : exportScope === 'single_school'
            ? exportSchoolId
            : exportYearId;
      a.download = `golestan-migration-bundle-${scopeTag}-v${bundle.schemaVersion}-${bundle.exportedAtJalali.replace(/\//g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'ok',
        text: `بسته استاندارد مهاجرت (${toPersianDigits(bundle.totalRecords)} رکورد، نسخه ساختار ${toPersianDigits(bundle.schemaVersion)}) با امضای دیجیتال SHA-256 دانلود شد.`,
      });
    } catch {
      setFeedback({ type: 'err', text: 'خطا در تولید و دانلود بسته استاندارد مهاجرت JSON.' });
    } finally {
      setExporting(false);
    }
  };

  const handleSelectBundleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    const text = await file.text();
    const result = await verifyMigrationBundleFile(text);
    setBundleVerification(result);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUndoRestore = async () => {
    setFeedback(null);
    const res = await undoLastBundleRestore();
    if (res.ok) {
      setIntegrityReport(runDataIntegrityCheck(integritySchoolScope));
      setFeedback({
        type: 'ok',
        text: 'بازگشت فوری (Undo) با موفقیت اجرا شد و پایگاه داده دقیقاً به وضعیت پیش از بازگردانی برگشت.',
      });
    } else {
      setFeedback({ type: 'err', text: res.errorFa ?? 'اجرای بازگشت فوری ناموفق بود.' });
    }
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnap(true);
    setFeedback(null);
    const res = await createDailyRollingSnapshotNow('نقطه بازیابی دستی راهبر ارشد');
    setCreatingSnap(false);
    if (res.ok) {
      setFeedback({
        type: 'ok',
        text: 'نقطه بازیابی دستی با امضای دیجیتال SHA-256 و تاریخ شمسی با موفقیت ثبت شد.',
      });
    } else {
      setFeedback({ type: 'err', text: res.errorFa ?? 'ایجاد نقطه بازیابی دستی ناموفق بود.' });
    }
  };

  const handleRunMigration = async (simulateError = false) => {
    setMigrating(true);
    setMigrationBanner(null);
    setFeedback(null);
    try {
      const result = await runVaultChunkedMigration((p) => {
        setMigrationProgress(p);
      }, simulateError);
      setIntegrityReport(runDataIntegrityCheck(integritySchoolScope));
      if (result.ok) {
        setMigrationBanner({
          type: 'ok',
          text: result.historyEntry.summaryFa,
        });
      } else {
        setMigrationBanner({
          type: 'rollback',
          text: result.errorFa ?? result.historyEntry.summaryFa,
        });
      }
    } finally {
      setMigrating(false);
    }
  };

  const integrityBadge =
    integrityReport.status === 'green'
      ? {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
          dot: 'bg-emerald-500',
          label: 'سبز — کاملاً سالم و بدون رکورد بی‌صاحب (Orphan)',
        }
      : integrityReport.status === 'amber'
        ? {
            bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
            dot: 'bg-amber-500',
            label: 'کهربایی — دارای هشدارهای غیربحرانی',
          }
        : {
            bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
            dot: 'bg-rose-600',
            label: 'قرمز — دارای رکوردهای بی‌صاحب و ارجاعات بحرانی',
          };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Standalone Page Header (/data-health-migration) */}
      {!embedded && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl brand-bg flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                مرکز سلامت داده و مهاجرت
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
                آزمون سلامت ارتباط جداول، خروجی بسته استاندارد مهاجرت (SHA-256)، بازگردانی ایمن با پیش‌نمایش و نقاط بازیابی خودکار
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => navigate('/smart-import-wizard')}
              data-testid="open-smart-import-from-vault"
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 text-xs font-bold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>ویزارد ورود هوشمند جدول‌ها</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/recycle-bin')}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>سطل بازیابی امن</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/security-logs')}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>گزارش امنیتی و ورودها</span>
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <FileSpreadsheet className="w-4 h-4 brand-text shrink-0" />
            <span>ورود گروهی فایل‌های اکسل و خروجی سیدا با تشخیص خودکار سرستون و قرنطینه خطاها</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/smart-import-wizard')}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>اجرای ویزارد ورود هوشمند</span>
          </button>
        </div>
      )}

      {/* Global Status Feedback */}
      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Immediate Undo Banner when pre-restore emergency snapshot exists */}
      {lastUndoSnapshot && (
        <div className="rounded-2xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
            <RotateCcw className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">نقطه بازگشت فوری (Undo) آماده است</div>
              <div className="text-[11px] opacity-85 mt-0.5 tabular-nums">
                {lastUndoSnapshot.labelFa} — {toPersianDigits(lastUndoSnapshot.jalaliDate)} ساعت{' '}
                {toPersianDigits(lastUndoSnapshot.createdAtTimeHm)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleUndoRestore()}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            بازگشت فوری (Undo)
          </button>
        </div>
      )}

      {/* Emergency System Lock Control Card */}
      <PanicModeControlCard variant="full" onStatusChange={setFeedback} />

      {/* ==================== SECTION 1: REFERENTIAL INTEGRITY CHECKER ==================== */}
      <section
        id="data-integrity-printable"
        aria-label="آزمون سلامت ارتباط جداول"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۱. آزمون سلامت ارتباط جداول (تشخیص رکوردهای بی‌صاحب)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                محدوده: <strong>{integrityScopeLabelFa}</strong> • آخرین بررسی:{' '}
                {toPersianDigits(integrityReport.checkedAtJalali)} • کل رکوردهای ممیزی‌شده:{' '}
                {toPersianDigits(integrityReport.totalRecordsChecked)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="relative flex items-center">
              <Building2 className="pointer-events-none absolute right-3 w-4 h-4 text-slate-400" />
              <select
                aria-label="انتخاب محدوده آزمون سلامت جداول"
                value={integritySchoolScope}
                onChange={(e) => handleIntegrityScopeChange(e.target.value)}
                className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="all">
                  کل مجموعه ({toPersianDigits(allSchools.length)} مدرسه)
                </option>
                {allSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleRunIntegrity(integritySchoolScope)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 text-xs font-bold transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              بررسی سلامت داده‌ها
            </button>
            <PrintIconButton
              documentLabel={`گزارش رسمی آزمون سلامت ارتباط جداول — ${integrityScopeLabelFa}`}
              targetSelector="#data-integrity-printable"
            />
          </div>
        </div>

        {/* Green / Amber / Red Status Bar */}
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${integrityBadge.bg}`}
        >
          <span className="inline-flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${integrityBadge.dot}`} />
            <span>وضعیت سلامت ارجاعات: {integrityBadge.label}</span>
          </span>
          <span className="tabular-nums">
            رکورد بی‌صاحب (Orphan): {toPersianDigits(integrityReport.orphanCount)} | هشدار:{' '}
            {toPersianDigits(integrityReport.warningCount)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {integrityReport.collectionStats.map((stat) => (
            <div
              key={stat.collection}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3"
            >
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                {stat.labelFa}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                  {toPersianDigits(stat.total)}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                    stat.issues === 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {stat.issues === 0 ? 'سالم' : `${toPersianDigits(stat.issues)} خطا`}
                </span>
              </div>
            </div>
          ))}
        </div>

        {integrityReport.issues.length > 0 && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-3.5 space-y-1.5 text-xs">
            <div className="font-bold text-rose-900 dark:text-rose-200">
              فهرست رکوردهای بی‌صاحب و ارجاعات نیازمند بررسی:
            </div>
            {integrityReport.issues.slice(0, 12).map((issue) => (
              <div key={issue.id} className="text-rose-800 dark:text-rose-300">
                • [{issue.collectionLabelFa}] {issue.reasonFa}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== SECTION 2 & 3: SEALED MIGRATION BUNDLE & GRANULAR DRY-RUN RESTORE ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: Export Sealed Migration Bundle JSON */}
        <section
          aria-label="خروجی بسته استاندارد مهاجرت"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۲. خروجی بسته استاندارد مهاجرت (Migration Bundle JSON)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فایل JSON مهروموم‌شده با نسخه ساختار{' '}
                <strong className="tabular-nums">{toPersianDigits(vaultMeta.schemaVersion)}</strong>{' '}
                و امضای دیجیتال بومی SHA-256
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'complex_wide',
                    label: `کل مجموعه (${toPersianDigits(allSchools.length)} مدرسه)`,
                  },
                  { id: 'single_school', label: 'یک مدرسه خاص' },
                  { id: 'academic_year', label: 'یک سال تحصیلی خاص' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExportScope(opt.id)}
                  className={`min-h-[42px] rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
                    exportScope === opt.id
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {exportScope === 'single_school' && (
              <select
                aria-label="انتخاب مدرسه برای خروجی بسته مهاجرت"
                value={exportSchoolId}
                onChange={(e) => setExportSchoolId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                {allSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            {exportScope === 'academic_year' && (
              <select
                aria-label="انتخاب سال تحصیلی برای خروجی بسته مهاجرت"
                value={exportYearId}
                onChange={(e) => setExportYearId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                {academicYears.length > 0 ? (
                  academicYears.map((y) => (
                    <option key={y.id} value={y.code}>
                      {y.title} ({toPersianDigits(y.code)})
                    </option>
                  ))
                ) : (
                  <option value="1404-1405">سال تحصیلی ۱۴۰۴-۱۴۰۵</option>
                )}
              </select>
            )}

            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportSealedBundle()}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              {exporting
                ? 'در حال محاسبه امضای SHA-256...'
                : 'تولید و دانلود بسته استاندارد مهاجرت JSON'}
            </button>
          </div>
        </section>

        {/* Section 3: Granular Dry-Run Restore */}
        <section
          aria-label="بازگردانی ایمن با پیش‌نمایش"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۳. بازگردانی ایمن با پیش‌نمایش (Granular Dry-Run Restore)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بررسی خودکار اصالت SHA-256، مسدودسازی فایل دستکاری‌شده، اسنپشات اضطراری خودکار و بازگشت فوری (Undo)
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleSelectBundleFile(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Upload className="w-4 h-4" />
            بارگذاری فایل پشتیبان JSON جهت بررسی SHA-256 و پیش‌نمایش
          </button>

          {bundleVerification && (
            <div
              className={`rounded-xl border p-4 space-y-3 text-xs ${
                bundleVerification.valid
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30'
                  : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40'
              }`}
            >
              {bundleVerification.valid && bundleVerification.previewSummary ? (
                <>
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>اصالت امضای دیجیتال SHA-256 تأیید شد — آماده بازگردانی ایمن</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                    <div>
                      <strong>محدوده:</strong> {bundleVerification.previewSummary.scopeLabelFa}
                    </div>
                    <div>
                      <strong>هدف:</strong> {bundleVerification.previewSummary.targetLabelFa}
                    </div>
                    <div className="tabular-nums">
                      <strong>مجموع رکوردها:</strong>{' '}
                      {toPersianDigits(bundleVerification.previewSummary.totalRecords)}
                    </div>
                    <div className="tabular-nums">
                      <strong>نسخه ساختار:</strong>{' '}
                      {toPersianDigits(bundleVerification.bundle?.schemaVersion ?? 1)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bundleVerification.previewSummary.nonEmptyCollections
                      .slice(0, 8)
                      .map((col) => (
                        <span
                          key={col.collection}
                          className="rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                        >
                          {col.labelFa}: {toPersianDigits(col.count)}
                        </span>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestoreBundleModalOpen(true)}
                    className="w-full min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                  >
                    اجرای بازگردانی ایمن (ثبت اسنپشات اضطراری + تأیید دومرحله‌ای)
                  </button>
                </>
              ) : (
                <div className="flex items-start gap-2 font-bold text-rose-800 dark:text-rose-200">
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{bundleVerification.errorFa}</span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ==================== SECTION 4: ROLLING SNAPSHOTS (UP TO 5 RECENT) ==================== */}
      <section
        aria-label="نقاط بازیابی خودکار"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ۴. نقاط بازیابی خودکار (Rolling Snapshots — تا ۵ نسخه اخیر)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                نگهداری خودکار تا ۵ اسنپشات اخیر با تاریخ و ساعت شمسی و امضای SHA-256 برای بازیابی سریع
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={creatingSnap}
            onClick={() => void handleCreateSnapshot()}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 px-4 text-xs font-bold transition-opacity disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            {creatingSnap ? 'در حال ایجاد...' : 'ایجاد نقطه بازیابی دستی'}
          </button>
        </div>

        {dailyRollingSnapshots.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            هنوز نقطه بازیابی ثبت نشده است. برای ثبت اولین نسخه روی «ایجاد نقطه بازیابی دستی» کلیک کنید.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {dailyRollingSnapshots.slice(0, 5).map((snap) => (
              <div
                key={snap.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {snap.labelFa}
                    </span>
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      {snap.trigger === 'auto_daily'
                        ? 'خودکار روزانه'
                        : snap.trigger === 'pre_restore_undo'
                          ? 'اسنپشات اضطراری Undo'
                          : 'دستی'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    تاریخ شمسی: {toPersianDigits(snap.jalaliDate)} — ساعت{' '}
                    {toPersianDigits(snap.createdAtTimeHm)} •{' '}
                    {toPersianDigits(snap.totalRecords)} رکورد • SHA-256:{' '}
                    <span dir="ltr" className="font-mono">
                      {snap.sha256Signature.slice(0, 12)}…
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSnapshotToRestore(snap)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3.5 text-xs font-bold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  بازیابی
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== CHUNKED MIGRATION ENGINE ==================== */}
      <section
        aria-label="موتور مهاجرت بدون اختلال"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                موتور مهاجرت بدون اختلال و استانداردسازی (دسته‌های ۵۰تایی)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                نسخه فعلی ساختار داده: <strong>نسخه {toPersianDigits(vaultMeta.schemaVersion)}</strong>
                {vaultMeta.lastMigratedAtJalali && (
                  <>
                    {' '}
                    • آخرین اجرا: {toPersianDigits(vaultMeta.lastMigratedAtJalali)}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={migrating}
              onClick={() => void handleRunMigration(false)}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
              {migrating ? 'در حال پردازش دسته‌ای...' : 'اجرای مهاجرت و استانداردسازی'}
            </button>
            <button
              type="button"
              disabled={migrating}
              onClick={() => void handleRunMigration(true)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 px-3.5 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              آزمون بازگشت خودکار (Auto-Rollback)
            </button>
          </div>
        </div>

        {migrationProgress && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span>
                پردازش بخش «{migrationProgress.currentCollectionLabelFa}» (دسته{' '}
                {toPersianDigits(migrationProgress.chunkIndex)})
              </span>
              <span className="tabular-nums">
                {toPersianDigits(migrationProgress.processed)} از{' '}
                {toPersianDigits(migrationProgress.total)} رکورد (
                {toPersianDigits(migrationProgress.percent)}٪)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-indigo-200/70 dark:bg-indigo-900/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-150"
                style={{ width: `${migrationProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {migrationBanner && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold flex items-start gap-2 ${
              migrationBanner.type === 'ok'
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
            }`}
          >
            {migrationBanner.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <RotateCcw className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{migrationBanner.text}</span>
          </div>
        )}

        {vaultMeta.history.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5 font-bold">تاریخ شمسی</th>
                  <th className="px-3 py-2.5 font-bold">وضعیت</th>
                  <th className="px-3 py-2.5 font-bold">رکوردهای بررسی‌شده</th>
                  <th className="px-3 py-2.5 font-bold">مجری</th>
                  <th className="px-3 py-2.5 font-bold">گزارش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vaultMeta.history.slice(0, 6).map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                      {toPersianDigits(item.executedAtJalali)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                          item.status === 'succeeded'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {item.status === 'succeeded' ? 'موفق' : 'بازگشت خودکار'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                      {toPersianDigits(item.processedRecords)} ({toPersianDigits(item.durationMs)}{' '}
                      میلی‌ثانیه)
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{item.executedByName}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {item.summaryFa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Two-Step Verification Modals */}
      <SensitiveActionModal
        open={restoreBundleModalOpen && Boolean(bundleVerification?.bundle)}
        titleFa="تأیید بازگردانی ایمن بسته مهاجرت"
        descriptionFa="پیش از اعمال تغییرات، یک نقطه بازیابی اضطراری (Undo) به‌صورت خودکار ذخیره می‌شود و فقط محدوده انتخابی بسته به‌روزرسانی خواهد شد."
        requiredPhrase="تایید بازگردانی"
        confirmButtonLabelFa="اجرای بازگردانی ایمن"
        tone="danger"
        onClose={() => setRestoreBundleModalOpen(false)}
        onConfirm={async (pw, phrase) => {
          if (!bundleVerification?.bundle) {
            return { ok: false, errorFa: 'بسته معتبری برای بازگردانی انتخاب نشده است.' };
          }
          const res = await executeGranularBundleRestore(bundleVerification.bundle, pw, phrase);
          if (res.ok) {
            setBundleVerification(null);
            setIntegrityReport(runDataIntegrityCheck(integritySchoolScope));
            setFeedback({
              type: 'ok',
              text: 'بازگردانی ایمن با موفقیت انجام شد. در صورت نیاز می‌توانید از دکمه «بازگشت فوری (Undo)» استفاده کنید.',
            });
          }
          return res;
        }}
      />

      <SensitiveActionModal
        open={Boolean(snapshotToRestore)}
        titleFa="بازیابی نقطه بازیابی انتخاب‌شده"
        descriptionFa={
          snapshotToRestore
            ? `پایگاه داده به نسخه «${snapshotToRestore.labelFa}» مورخ ${toPersianDigits(snapshotToRestore.jalaliDate)} ساعت ${toPersianDigits(snapshotToRestore.createdAtTimeHm)} بازگردانده می‌شود.`
            : ''
        }
        requiredPhrase="تایید بازگردانی"
        confirmButtonLabelFa="تأیید و بازیابی نسخه"
        tone="danger"
        onClose={() => setSnapshotToRestore(null)}
        onConfirm={async (pw, phrase) => {
          if (!snapshotToRestore) return { ok: false, errorFa: 'نقطه بازیابی یافت نشد.' };
          const res = await restoreDailyRollingSnapshot(snapshotToRestore.id, pw, phrase);
          if (res.ok) {
            setSnapshotToRestore(null);
            setIntegrityReport(runDataIntegrityCheck(integritySchoolScope));
            setFeedback({
              type: 'ok',
              text: 'نسخه انتخاب‌شده از نقاط بازیابی با موفقیت اعمال شد.',
            });
          }
          return res;
        }}
      />
    </div>
  );
};

export default DataHealthMigrationPage;
