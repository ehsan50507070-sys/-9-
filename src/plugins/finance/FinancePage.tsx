// Plugin 1: Integrated School Finance & Tuition Management («مدیریت یکپارچه مالی و شهریه»)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShieldAlert,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useSectionLabel } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { triggerPrint, type PrintPaperSize } from '../../core/print/printService';
import { getTodayJalali } from '../../lib/jalali';
import type { FinancePaymentRecord, FinanceStudentLedger, Student } from '../../types/domain';
import {
  computeComplexFinanceComparison,
  computeLedgerSummary,
  computeSchoolFinanceKpis,
} from './financeHelpers';
import { FinanceOnlinePayTab } from './FinanceOnlinePayTab';
import { FinancePrintView, type FinancePrintMode } from './FinancePrintView';
import {
  FinanceComplexTab,
  FinanceDebtorsTab,
  FinanceExpensesTab,
  FinanceLedgersTab,
  FinanceOverviewTab,
  FinanceSetupTab,
} from './FinanceSubTabs';

type FinanceTabId =
  | 'overview'
  | 'ledgers'
  | 'online_pay'
  | 'setup'
  | 'expenses'
  | 'debtors'
  | 'complex';

export const FinancePage: React.FC = () => {
  const {
    session,
    activeRole,
    roleDef,
    activeSchool,
    activeSchoolId,
    students,
    classes,
    financeFeePlans,
    financeLedgers,
    financePayments,
    financeExpenses,
    complexPhase6Dataset,
    upsertFinanceFeePlan,
    upsertFinanceLedger,
    recordFinancePayment,
    deleteFinancePayment,
    upsertFinanceExpense,
    deleteFinanceExpense,
    addTripFeeToStudents,
  } = useSchoolData();

  const { getSectionTitle } = useSectionLabel();
  const sectionLabel = getSectionTitle('finance', 'مدیریت یکپارچه مالی و شهریه');
  const todayJalali = getTodayJalali();

  const isParent = activeRole === 'parent';
  const canViewComplex = roleDef.canViewComplexComparison && Boolean(complexPhase6Dataset);

  const [activeTab, setActiveTab] = useState<FinanceTabId>(isParent ? 'online_pay' : 'overview');
  const [printMode, setPrintMode] = useState<FinancePrintMode | null>(null);

  const kpis = useMemo(
    () =>
      computeSchoolFinanceKpis({
        ledgers: financeLedgers,
        payments: financePayments,
        expenses: financeExpenses,
        todayJalali,
      }),
    [financeLedgers, financePayments, financeExpenses, todayJalali]
  );

  const debtorRows = useMemo(() => {
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const classMap = new Map(classes.map((c) => [c.id, c]));
    return financeLedgers
      .map((l) => {
        const student = studentMap.get(l.studentId);
        const cls = classMap.get(l.classId);
        const s = computeLedgerSummary(l, todayJalali);
        if (!student || s.overdueInstallmentsCount <= 0) return null;
        return {
          student,
          className: cls?.name ?? '—',
          overdueCount: s.overdueInstallmentsCount,
          overdueAmountToman: s.overdueAmountToman,
          remainingTotalToman: s.totalRemainingToman,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.overdueAmountToman - a.overdueAmountToman);
  }, [financeLedgers, students, classes, todayJalali]);

  const complexRows = useMemo(() => {
    if (!canViewComplex || !complexPhase6Dataset) return [];
    return computeComplexFinanceComparison({
      schools: complexPhase6Dataset.schools,
      ledgers: complexPhase6Dataset.financeLedgers,
      payments: complexPhase6Dataset.financePayments,
      expenses: complexPhase6Dataset.financeExpenses,
      todayJalali,
    });
  }, [canViewComplex, complexPhase6Dataset, todayJalali]);

  // Strict RBAC guard: teacher & student cannot access Finance at all
  if (!roleDef.canAccessFinance) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-6 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-extrabold text-rose-900 dark:text-rose-200">
          عدم دسترسی به بخش مالی و شهریه
        </h2>
        <p className="text-xs text-rose-700 dark:text-rose-300">
          دسترسی به پرونده‌های مالی و شهریه برای نقش کاربری فعلی مجاز نیست.
        </p>
      </div>
    );
  }

  const runPrint = (mode: FinancePrintMode, size: PrintPaperSize) => {
    setPrintMode(mode);
    setTimeout(() => {
      triggerPrint({ size, orientation: 'portrait' });
    }, 60);
  };

  const handlePrintReceipt = (payment: FinancePaymentRecord, student: Student, size: PrintPaperSize) => {
    const classRoom = classes.find((c) => c.id === student.classId);
    runPrint({ kind: 'receipt', payment, student, classRoom }, size);
  };

  const handlePrintStatement = (
    ledger: FinanceStudentLedger,
    student: Student,
    size: PrintPaperSize
  ) => {
    const classRoom = classes.find((c) => c.id === student.classId);
    const stPayments = financePayments.filter((p) => p.studentId === student.id);
    runPrint({ kind: 'statement', ledger, student, classRoom, payments: stPayments }, size);
  };

  const handlePrintDebtors = (size: PrintPaperSize) => {
    runPrint({ kind: 'debtors', rows: debtorRows }, size);
  };

  const handlePrintBalanceSheet = (size: PrintPaperSize) => {
    runPrint({ kind: 'balance_sheet', kpis, expenses: financeExpenses }, size);
  };

  const tabs: Array<{ id: FinanceTabId; label: string; icon: React.ReactNode }> = isParent
    ? [
        {
          id: 'online_pay',
          label: 'پرونده مالی فرزند و پرداخت آنلاین',
          icon: <CreditCard className="w-4 h-4" />,
        },
      ]
    : [
        { id: 'overview', label: 'نمای کلی و نمودارها', icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'ledgers', label: 'پرونده مالی و ثبت پرداخت', icon: <Receipt className="w-4 h-4" /> },
        { id: 'online_pay', label: 'شبیه‌ساز درگاه آنلاین اولیا', icon: <CreditCard className="w-4 h-4" /> },
        { id: 'setup', label: 'تعرفه، تخفیف و تقسیط', icon: <Settings2 className="w-4 h-4" /> },
        { id: 'expenses', label: 'هزینه‌های مدرسه', icon: <TrendingDown className="w-4 h-4" /> },
        { id: 'debtors', label: 'بدهکاران معوق و پیامک', icon: <AlertTriangle className="w-4 h-4" /> },
        ...(canViewComplex
          ? [{ id: 'complex' as const, label: 'گزارش تجمیعی ۳ مدرسه', icon: <Building2 className="w-4 h-4" /> }]
          : []),
      ];

  const resolvedTab: FinanceTabId = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : tabs[0].id;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {sectionLabel}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isParent
                ? `مشاهده شهریه، اقساط، هزینه اردوها و پرداخت آنلاین — ${activeSchool.name}`
                : `مدیریت شهریه، تخفیف‌ها، اقساط شمسی، هزینه‌های عملیاتی و صدور رسید A5 / A4 — ${activeSchool.name}`}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      {tabs.length > 1 && (
        <div
          className="no-print flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
          role="tablist"
        >
          {tabs.map((tab) => {
            const active = resolvedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Tab Content */}
      <div className="no-print">
        {resolvedTab === 'overview' && (
          <FinanceOverviewTab
            schoolName={activeSchool.name}
            todayJalali={todayJalali}
            kpis={kpis}
            payments={financePayments}
            expenses={financeExpenses}
            onPrintBalanceSheet={handlePrintBalanceSheet}
          />
        )}

        {resolvedTab === 'ledgers' && (
          <FinanceLedgersTab
            activeRole={activeRole}
            activeUserName={session?.displayName ?? 'کاربر مالی'}
            todayJalali={todayJalali}
            canDeletePayments={roleDef.canManageFinanceFull}
            students={students}
            classes={classes}
            ledgers={financeLedgers}
            payments={financePayments}
            onRecordPayment={recordFinancePayment}
            onDeletePayment={deleteFinancePayment}
            onPrintReceipt={handlePrintReceipt}
            onPrintStatement={handlePrintStatement}
          />
        )}

        {resolvedTab === 'online_pay' && (
          <FinanceOnlinePayTab
            activeRole={activeRole}
            activeUserName={session?.displayName ?? 'ولی دانش‌آموز'}
            schoolName={activeSchool.name}
            todayJalali={todayJalali}
            students={students}
            classes={classes}
            ledgers={financeLedgers}
            payments={financePayments}
            onRecordPayment={recordFinancePayment}
            onPrintReceipt={handlePrintReceipt}
            onPrintStatement={handlePrintStatement}
          />
        )}

        {resolvedTab === 'setup' && (
          <FinanceSetupTab
            schoolId={activeSchoolId}
            activeUserName={session?.displayName ?? 'مدیر مدرسه'}
            todayJalali={todayJalali}
            canEditPlans={roleDef.canManageFinanceFull}
            feePlans={financeFeePlans}
            students={students}
            classes={classes}
            ledgers={financeLedgers}
            onSaveFeePlan={upsertFinanceFeePlan}
            onSaveLedger={upsertFinanceLedger}
            onAddTripFee={addTripFeeToStudents}
          />
        )}

        {resolvedTab === 'expenses' && (
          <FinanceExpensesTab
            schoolId={activeSchoolId}
            activeUserName={session?.displayName ?? 'مسئول مالی'}
            todayJalali={todayJalali}
            canDeleteExpenses={roleDef.canManageFinanceFull}
            expenses={financeExpenses}
            onSaveExpense={upsertFinanceExpense}
            onDeleteExpense={deleteFinanceExpense}
          />
        )}

        {resolvedTab === 'debtors' && (
          <FinanceDebtorsTab
            schoolName={activeSchool.name}
            todayJalali={todayJalali}
            rows={debtorRows}
            onPrintDebtors={handlePrintDebtors}
          />
        )}

        {resolvedTab === 'complex' && canViewComplex && (
          <FinanceComplexTab rows={complexRows} />
        )}
      </div>

      {/* Print-Only Active Document */}
      {printMode && (
        <FinancePrintView school={activeSchool} todayJalali={todayJalali} mode={printMode} />
      )}
    </div>
  );
};
