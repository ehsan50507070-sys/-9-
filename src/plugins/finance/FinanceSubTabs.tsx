// Modular Staff Views for Finance & Tuition Plugin (Overview, Setup, Ledgers, Expenses, Debtors, Complex 3-School)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PrintButtons } from '../../core/print/PrintButtons';
import type { PrintPaperSize } from '../../core/print/printService';
import { SvgDonutChart, SvgGroupedBarChart } from '../../core/ui/SvgCharts';
import { downloadTextFile } from '../../lib/csv';
import { formatToman, formatTomanCompact, toPersianDigits } from '../../lib/digits';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  ClassRoom,
  FinanceChequeStatus,
  FinanceDiscountItem,
  FinanceDiscountMode,
  FinanceDiscountType,
  FinanceExpenseCategory,
  FinanceExpenseRecord,
  FinanceFeePlan,
  FinancePaymentMethod,
  FinancePaymentRecord,
  FinanceStudentLedger,
  RoleId,
  Student,
} from '../../types/domain';
import {
  applyPaymentToLedger,
  buildDebtorReminderMessenger,
  buildFinanceExpensesCsv,
  buildFinanceLedgersCsv,
  buildFinanceSummaryMessenger,
  CHEQUE_STATUS_LABELS,
  computeLedgerSummary,
  computeMonthlyCashflowSeries,
  DISCOUNT_TYPE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  EXTRA_FEE_TYPE_LABELS,
  generateInstallmentSchedule,
  generateReceiptNumber,
  generateTrackingCode,
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  resolveInstallmentStatus,
  revertPaymentFromLedger,
  type ComplexFinanceSchoolRow,
  type SchoolFinanceKpis,
} from './financeHelpers';

/* ============================================================================
 * 1. Financial Overview Dashboard Tab
 * ============================================================================ */
export const FinanceOverviewTab: React.FC<{
  schoolName: string;
  todayJalali: string;
  kpis: SchoolFinanceKpis;
  payments: FinancePaymentRecord[];
  expenses: FinanceExpenseRecord[];
  onPrintBalanceSheet: (size: PrintPaperSize) => void;
}> = ({ schoolName, todayJalali, kpis, payments, expenses, onPrintBalanceSheet }) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  const cashflowSeries = useMemo(
    () => computeMonthlyCashflowSeries({ payments, expenses }),
    [payments, expenses]
  );

  const handleCopySummary = async () => {
    const txt = buildFinanceSummaryMessenger({ schoolName, todayJalali, kpis });
    await copyTextToClipboard(txt);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2200);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          نمای یکپارچه جریان نقدینگی، وصول شهریه و هزینه‌های عملیاتی ({schoolName})
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? 'کپی شد (ایتا / بله / شاد)' : 'کپی گزارش تک‌ستونی'}</span>
          </button>
          <PrintButtons compact documentLabel="ترازنامه مالی مدرسه" onPrint={onPrintBalanceSheet} />
        </div>
      </div>

      {/* 6 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">کل شهریه و فعالیت‌های مصوب</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1.5">
            {formatToman(kpis.totalExpectedToman)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            مبنای کل سال تحصیلی پس از کسر تخفیف‌ها
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">جمع کل وصولی تا امروز</div>
          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1.5">
            {formatToman(kpis.totalCollectedToman)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums font-semibold">
            نرخ تحقق وصول: {toPersianDigits(kpis.collectionRatePercent)}٪
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">مانده مطالبات قابل وصول</div>
          <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-1.5">
            {formatToman(kpis.totalRemainingToman)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            از این میزان {formatToman(kpis.overdueTotalToman)} سررسیدشده است
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">تعداد اقساط / پرونده‌های معوق</div>
          <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums mt-1.5">
            {toPersianDigits(kpis.overdueDebtorsCount)} پرونده
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            نیازمند ارسال یادآوری محترمانه به اولیا
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">جمع هزینه‌های عملیاتی مدرسه</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1.5">
            {formatToman(kpis.totalExpensesToman)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {toPersianDigits(expenses.length)} سند هزینه ثبت‌شده
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">تراز خالص مالی (وصولی منهای هزینه)</div>
          <div
            className={`text-xl font-extrabold tabular-nums mt-1.5 ${
              kpis.netBalanceToman >= 0
                ? 'text-indigo-700 dark:text-indigo-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatToman(kpis.netBalanceToman)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {kpis.netBalanceToman >= 0 ? 'تراز عملیاتی مثبت و پایدار' : 'هزینه‌ها بیش از وصولی نقدی دوره است'}
          </div>
        </div>
      </div>

      {/* Pure Custom SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <SvgGroupedBarChart
            title="نمودار ماهانه درآمد وصولی در برابر هزینه‌های مدرسه"
            subtitle="بر حسب ماه‌های سال تحصیلی شمسی (تومان)"
            data={cashflowSeries.map((pt) => ({
              label: pt.monthLabel,
              values: { income: pt.incomeToman, expense: pt.expenseToman },
            }))}
            series={[
              { key: 'income', label: 'وصولی شهریه و خدمات', color: '#10b981' },
              { key: 'expense', label: 'هزینه‌های عملیاتی', color: '#f43f5e' },
            ]}
            valueFormatter={(v) => formatToman(v)}
            axisFormatter={(v) => formatTomanCompact(v)}
          />
        </div>
        <div className="lg:col-span-5">
          <SvgDonutChart
            title="وضعیت وصول کل شهریه مدرسه"
            subtitle="تفکیک سهم وصول‌شده، سررسیدشده و اقساط آتی"
            centerValue={`${toPersianDigits(kpis.collectionRatePercent)}٪`}
            centerLabel="نرخ وصول"
            valueFormatter={(v) => formatToman(v)}
            slices={[
              {
                id: 'collected',
                label: 'وصول‌شده',
                value: kpis.totalCollectedToman,
                color: '#10b981',
              },
              {
                id: 'overdue',
                label: 'سررسیدشده (معوق)',
                value: kpis.overdueTotalToman,
                color: '#f43f5e',
              },
              {
                id: 'upcoming',
                label: 'اقساط آتی (در موعد)',
                value: Math.max(0, kpis.totalRemainingToman - kpis.overdueTotalToman),
                color: '#f59e0b',
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. Tuition Setup, Discounts & Installment Generator Tab (Principal / Complex Admin)
 * ============================================================================ */
export const FinanceSetupTab: React.FC<{
  schoolId: string;
  activeUserName: string;
  todayJalali: string;
  canEditPlans: boolean;
  feePlans: FinanceFeePlan[];
  students: Student[];
  classes: ClassRoom[];
  ledgers: FinanceStudentLedger[];
  onSaveFeePlan: (plan: FinanceFeePlan) => { ok: boolean; errorFa?: string };
  onSaveLedger: (ledger: FinanceStudentLedger) => { ok: boolean; errorFa?: string };
  onAddTripFee: (params: {
    studentIds: string[];
    title: string;
    amountToman: number;
    dueDateJalali: string;
  }) => Promise<{ ok: boolean; errorFa?: string; updatedCount?: number }>;
}> = ({
  activeUserName,
  todayJalali,
  canEditPlans,
  feePlans,
  students,
  classes,
  ledgers,
  onSaveFeePlan,
  onSaveLedger,
  onAddTripFee,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState(feePlans[0]?.id ?? '');
  const activePlan = feePlans.find((p) => p.id === selectedPlanId) ?? feePlans[0] ?? null;

  const [baseTuitionInput, setBaseTuitionInput] = useState<string>(
    String(activePlan?.baseTuitionToman ?? 18_500_000)
  );
  const [defaultInstCount, setDefaultInstCount] = useState<number>(
    activePlan?.defaultInstallmentsCount ?? 6
  );

  // Individual student discount & installment schedule editor
  const [selectedStudentId, setSelectedStudentId] = useState<string>(ledgers[0]?.studentId ?? '');
  const selectedLedger = ledgers.find((l) => l.studentId === selectedStudentId) ?? ledgers[0] ?? null;
  const [discountType, setDiscountType] = useState<FinanceDiscountType>('sibling');
  const [discountMode, setDiscountMode] = useState<FinanceDiscountMode>('percent');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [installmentCountInput, setInstallmentCountInput] = useState<number>(
    selectedLedger?.installments.length ?? 6
  );

  // New Trip / Event Fee creator
  const [tripTitle, setTripTitle] = useState('');
  const [tripAmount, setTripAmount] = useState('450000');
  const [tripDueDate, setTripDueDate] = useState('1405/12/15');
  const [tripClassId, setTripClassId] = useState<string>('all');

  const [notice, setNotice] = useState<string | null>(null);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const p = feePlans.find((x) => x.id === planId);
    if (p) {
      setBaseTuitionInput(String(p.baseTuitionToman));
      setDefaultInstCount(p.defaultInstallmentsCount);
    }
  };

  const handleSavePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan || !canEditPlans) return;
    const nextBase = Math.max(0, Number(baseTuitionInput) || 0);
    const res = onSaveFeePlan({
      ...activePlan,
      baseTuitionToman: nextBase,
      defaultInstallmentsCount: Math.max(1, Math.min(10, defaultInstCount)),
      updatedByName: activeUserName,
      updatedAt: new Date().toISOString(),
    });
    setNotice(res.ok ? `تعرفه «${activePlan.title}» با موفقیت ذخیره شد.` : (res.errorFa ?? 'خطا در ذخیره تعرفه.'));
  };

  const handleApplyDiscountAndRegenerate = () => {
    if (!selectedLedger || !canEditPlans) return;
    const val = Math.max(0, Number(discountValue) || 0);
    const existingSummary = computeLedgerSummary(selectedLedger, todayJalali);
    const newDiscount: FinanceDiscountItem = {
      id: `disc-${Date.now().toString(36)}`,
      type: discountType,
      title: DISCOUNT_TYPE_LABELS[discountType],
      mode: discountMode,
      value: discountMode === 'percent' ? Math.min(100, val) : val,
    };
    const nextDiscounts = val > 0 ? [...selectedLedger.discounts, newDiscount] : selectedLedger.discounts;
    const tempLedger: FinanceStudentLedger = { ...selectedLedger, discounts: nextDiscounts };
    const nextSummary = computeLedgerSummary(tempLedger, todayJalali);

    const regenerated = generateInstallmentSchedule({
      studentId: selectedLedger.studentId,
      netTuitionToman: Math.max(0, nextSummary.grossTuitionAndExtrasToman - nextSummary.totalDiscountToman),
      installmentsCount: installmentCountInput,
      todayJalali,
      existingPaidToman: existingSummary.tuitionPaidToman,
    });

    const res = onSaveLedger({
      ...tempLedger,
      installments: regenerated,
      updatedAt: new Date().toISOString(),
    });
    setNotice(
      res.ok
        ? `تخفیف و تقسیط ${toPersianDigits(installmentCountInput)} قسطی دانش‌آموز با موفقیت بازتولید و ذخیره شد.`
        : (res.errorFa ?? 'خطا در ذخیره پرونده.')
    );
  };

  const handleCreateTripFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripTitle.trim()) return;
    const amt = Math.max(0, Number(tripAmount) || 0);
    if (amt <= 0) return;
    const targetIds = students
      .filter((s) => s.active && (tripClassId === 'all' || s.classId === tripClassId))
      .map((s) => s.id);
    const res = await onAddTripFee({
      studentIds: targetIds,
      title: tripTitle.trim(),
      amountToman: amt,
      dueDateJalali: tripDueDate.trim() || todayJalali,
    });
    if (res.ok) {
      setTripTitle('');
      setNotice(
        `هزینه «${tripTitle.trim()}» برای ${toPersianDigits(res.updatedCount ?? targetIds.length)} دانش‌آموز اضافه شد و در درگاه پرداخت اولیا قابل مشاهده است.`
      );
    } else {
      setNotice(res.errorFa ?? 'خطا در ثبت هزینه اردو.');
    }
  };

  return (
    <div className="space-y-5">
      {!canEditPlans && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-200">
          تغییر تعرفه‌های پایه شهریه و ساختار تخفیف‌ها صرفاً در اختیار مدیر مدرسه و مدیر کل مجموعه است. شما می‌توانید تعرفه‌های مصوب را مشاهده کنید.
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Base Tuition Plans */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ۱. تعرفه پایه شهریه و خدمات فوق‌برنامه بر اساس پایه تحصیلی
          </h4>

          <div className="flex flex-wrap gap-1.5">
            {feePlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleSelectPlan(plan.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  activePlan?.id === plan.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                پایه {toPersianDigits(plan.gradeLevel)}
              </button>
            ))}
          </div>

          {activePlan && (
            <form onSubmit={handleSavePlanSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  شهریه پایه سالانه (تومان)
                </label>
                <input
                  type="number"
                  disabled={!canEditPlans}
                  value={baseTuitionInput}
                  onChange={(e) => setBaseTuitionInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  معادل: {formatToman(Number(baseTuitionInput) || 0)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تعداد اقساط پیش‌فرض (۱ تا ۱۰ قسط شمسی)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={!canEditPlans}
                  value={defaultInstCount}
                  onChange={(e) => setDefaultInstCount(Number(e.target.value) || 6)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  خدمات جانبی تعریف‌شده در این پایه:
                </div>
                <div className="space-y-1.5">
                  {activePlan.extraItems.map((extra) => (
                    <div
                      key={extra.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{extra.title}</span>
                        <span className="text-[11px] text-slate-500 mr-2">
                          ({EXTRA_FEE_TYPE_LABELS[extra.type]})
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatToman(extra.amountToman)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {canEditPlans && (
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 font-bold transition-colors"
                >
                  ذخیره تعرفه پایه {toPersianDigits(activePlan.gradeLevel)}
                </button>
              )}
            </form>
          )}
        </div>

        {/* Individual Discounts & Installment Schedule Generator */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ۲. اعمال تخفیف منعطف و تقسیط خودکار (۱ تا ۱۰ قسط شمسی)
          </h4>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                انتخاب دانش‌آموز
              </label>
              <select
                value={selectedLedger?.studentId ?? ''}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  const found = ledgers.find((l) => l.studentId === e.target.value);
                  if (found) setInstallmentCountInput(found.installments.length);
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
              >
                {ledgers.map((l) => {
                  const st = students.find((s) => s.id === l.studentId);
                  const cls = classes.find((c) => c.id === l.classId);
                  if (!st) return null;
                  return (
                    <option key={l.id} value={l.studentId}>
                      {`${st.fullName} — ${cls?.name ?? ''}`}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedLedger && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      نوع تخفیف
                    </label>
                    <select
                      disabled={!canEditPlans}
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as FinanceDiscountType)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    >
                      {Object.entries(DISCOUNT_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      نحوه محاسبه
                    </label>
                    <select
                      disabled={!canEditPlans}
                      value={discountMode}
                      onChange={(e) => setDiscountMode(e.target.value as FinanceDiscountMode)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    >
                      <option value="percent">درصدی (٪)</option>
                      <option value="fixed">مبلغ ثابت (تومان)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {discountMode === 'percent' ? 'درصد تخفیف (۰ تا ۱۰۰)' : 'مبلغ تخفیف (تومان)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={!canEditPlans}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      تعداد اقساط (۱ تا ۱۰)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      disabled={!canEditPlans}
                      value={installmentCountInput}
                      onChange={(e) =>
                        setInstallmentCountInput(Math.max(1, Math.min(10, Number(e.target.value) || 6)))
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">تخفیف‌های فعلی پرونده:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatToman(computeLedgerSummary(selectedLedger, todayJalali).totalDiscountToman)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تعداد اقساط فعلی:</span>
                    <strong className="tabular-nums">
                      {toPersianDigits(selectedLedger.installments.length)} قسط
                    </strong>
                  </div>
                </div>

                {canEditPlans && (
                  <button
                    type="button"
                    onClick={handleApplyDiscountAndRegenerate}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 font-bold transition-colors"
                  >
                    اعمال تخفیف و تولید مجدد جدول اقساط شمسی
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add New School Trip / Activity Fee */}
      {canEditPlans && (
        <form
          onSubmit={handleCreateTripFee}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
        >
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ۳. تعریف هزینه اردوی علمی / فعالیت فوق‌برنامه جدید (قابل پرداخت در پنل اولیا)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <input
              type="text"
              required
              placeholder="عنوان اردو (مثلاً اردوی پارک علم و فناوری)"
              value={tripTitle}
              onChange={(e) => setTripTitle(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              required
              min={10000}
              placeholder="مبلغ (تومان)"
              value={tripAmount}
              onChange={(e) => setTripAmount(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
            />
            <input
              type="text"
              placeholder="مهلت شمسی (مثلاً 1405/12/20)"
              value={tripDueDate}
              onChange={(e) => setTripDueDate(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
            />
            <select
              value={tripClassId}
              onChange={(e) => setTripClassId(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
            >
              <option value="all">همه کلاس‌های مدرسه</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن هزینه اردو به پرونده دانش‌آموزان</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. Student Financial Ledgers & Manual Payment Recording Tab
 * ============================================================================ */
export const FinanceLedgersTab: React.FC<{
  activeRole: RoleId;
  activeUserName: string;
  todayJalali: string;
  canDeletePayments: boolean;
  students: Student[];
  classes: ClassRoom[];
  ledgers: FinanceStudentLedger[];
  payments: FinancePaymentRecord[];
  onRecordPayment: (params: {
    payment: FinancePaymentRecord;
    updatedLedger: FinanceStudentLedger;
  }) => { ok: boolean; errorFa?: string };
  onDeletePayment: (
    paymentId: string,
    revertedLedger?: FinanceStudentLedger
  ) => { ok: boolean; errorFa?: string };
  onPrintReceipt: (payment: FinancePaymentRecord, student: Student, size: PrintPaperSize) => void;
  onPrintStatement: (ledger: FinanceStudentLedger, student: Student, size: PrintPaperSize) => void;
}> = ({
  activeRole,
  activeUserName,
  todayJalali,
  canDeletePayments,
  students,
  classes,
  ledgers,
  payments,
  onRecordPayment,
  onDeletePayment,
  onPrintReceipt,
  onPrintStatement,
}) => {
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [paymentModalLedgerId, setPaymentModalLedgerId] = useState<string | null>(null);

  // Manual Payment Modal State
  const [payInstallmentId, setPayInstallmentId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<FinancePaymentMethod>('pos');
  const [payDate, setPayDate] = useState<string>(todayJalali);
  const [payTrackingCode, setPayTrackingCode] = useState<string>('');
  const [payChequeDue, setPayChequeDue] = useState<string>('1405/12/25');
  const [payChequeStatus, setPayChequeStatus] = useState<FinanceChequeStatus>('in_progress');
  const [payNotes, setPayNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<{ text: string; receipt?: { payment: FinancePaymentRecord; student: Student } } | null>(null);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ledgers
      .map((ledger) => {
        const student = studentMap.get(ledger.studentId);
        const classRoom = classMap.get(ledger.classId);
        const summary = computeLedgerSummary(ledger, todayJalali);
        return { ledger, student, classRoom, summary };
      })
      .filter((row) => {
        if (!row.student) return false;
        if (classFilter !== 'all' && row.ledger.classId !== classFilter) return false;
        if (statusFilter !== 'all' && row.summary.overallStatus !== statusFilter) return false;
        if (q) {
          const full = `${row.student.fullName} ${row.student.nationalId}`.toLowerCase();
          if (!full.includes(q)) return false;
        }
        return true;
      });
  }, [ledgers, studentMap, classMap, todayJalali, classFilter, statusFilter, searchQuery]);

  const openPaymentModal = (ledger: FinanceStudentLedger) => {
    const firstUnpaid = ledger.installments.find((i) => i.paidAmountToman < i.amountToman);
    setPaymentModalLedgerId(ledger.id);
    setPayInstallmentId(firstUnpaid?.id ?? ledger.installments[0]?.id ?? '');
    setPayAmount(
      String(firstUnpaid ? Math.max(0, firstUnpaid.amountToman - firstUnpaid.paidAmountToman) : 1_000_000)
    );
    setPayMethod('pos');
    setPayDate(todayJalali);
    setPayTrackingCode(generateTrackingCode('POS'));
    setPayNotes('');
  };

  const modalLedger = ledgers.find((l) => l.id === paymentModalLedgerId) ?? null;
  const modalStudent = modalLedger ? studentMap.get(modalLedger.studentId) ?? null : null;

  const handleSaveManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLedger || !modalStudent) return;
    const amt = Math.max(0, Number(payAmount) || 0);
    if (amt <= 0) return;

    const targetInst = modalLedger.installments.find((i) => i.id === payInstallmentId);
    const tracking = payTrackingCode.trim() || generateTrackingCode('PAY');
    const updatedLedger = applyPaymentToLedger({
      ledger: modalLedger,
      targetType: 'tuition',
      installmentId: targetInst?.id,
      amountToman: amt,
      paidDateJalali: payDate.trim() || todayJalali,
      trackingCode: tracking,
      todayJalali,
    });

    const payment: FinancePaymentRecord = {
      id: `pay-manual-${Date.now().toString(36)}`,
      schoolId: modalLedger.schoolId,
      receiptNumber: generateReceiptNumber(payments.length),
      studentId: modalStudent.id,
      classId: modalStudent.classId,
      ledgerId: modalLedger.id,
      targetType: 'tuition',
      installmentId: targetInst?.id,
      targetTitle: targetInst ? targetInst.title : 'پرداخت علی‌الحساب شهریه',
      amountToman: amt,
      jalaliDate: payDate.trim() || todayJalali,
      method: payMethod,
      ...(payMethod === 'cheque'
        ? { chequeDueDateJalali: payChequeDue, chequeStatus: payChequeStatus }
        : {}),
      trackingCode: tracking,
      notes: payNotes.trim() || undefined,
      recordedBy: activeUserName,
      recordedByRole: activeRole,
      createdAt: new Date().toISOString(),
    };

    const res = onRecordPayment({ payment, updatedLedger });
    if (res.ok) {
      setFeedback({
        text: `رسید ${toPersianDigits(payment.receiptNumber)} به مبلغ ${formatToman(amt)} برای ${modalStudent.fullName} با موفقیت ثبت شد.`,
        receipt: { payment, student: modalStudent },
      });
      setPaymentModalLedgerId(null);
    } else {
      setFeedback({ text: res.errorFa ?? 'خطا در ثبت پرداخت.' });
    }
  };

  const handleExportCsv = () => {
    const csv = buildFinanceLedgersCsv({ ledgers, students, classes, todayJalali });
    downloadTextFile(`student-ledgers-${todayJalali.replace(/\//g, '-')}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const expandedRow = rows.find((r) => r.ledger.id === selectedLedgerId) ?? null;

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          <span>{feedback.text}</span>
          {feedback.receipt && (
            <PrintButtons
              compact
              documentLabel="رسید رسمی پرداخت"
              onPrint={(size) =>
                onPrintReceipt(feedback.receipt!.payment, feedback.receipt!.student, size)
              }
            />
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجوی نام دانش‌آموز یا کد ملی..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>

        <select
          aria-label="فیلتر کلاس"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه کلاس‌ها</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="فیلتر وضعیت مالی"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه وضعیت‌ها</option>
          <option value="overdue">دارای قسط معوق</option>
          <option value="partial">در حال پرداخت</option>
          <option value="settled">تسویه‌شده</option>
          <option value="pending">پرداخت‌نشده</option>
        </select>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>خروجی اکسل فارسی</span>
        </button>
      </div>

      {/* Ledgers Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-3 px-3 font-bold">دانش‌آموز</th>
                <th className="py-3 px-3 font-bold">کلاس</th>
                <th className="py-3 px-3 font-bold">جمع قابل پرداخت</th>
                <th className="py-3 px-3 font-bold">پرداخت‌شده</th>
                <th className="py-3 px-3 font-bold">مانده بدهی</th>
                <th className="py-3 px-3 font-bold">وضعیت</th>
                <th className="py-3 px-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ ledger, student, classRoom, summary }) => {
                if (!student) return null;
                return (
                  <tr
                    key={ledger.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLedgerId((prev) => (prev === ledger.id ? null : ledger.id))
                        }
                        className="text-right font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {student.fullName}
                      </button>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        کد ملی: {toPersianDigits(student.nationalId)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {classRoom?.name ?? '—'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      {formatToman(summary.totalExpectedToman)}
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatToman(summary.totalPaidToman)}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatToman(summary.totalRemainingToman)}
                    </td>
                    <td className="py-3 px-3">
                      {summary.overallStatus === 'settled' ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">تسویه‌شده</span>
                      ) : summary.overallStatus === 'overdue' ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {toPersianDigits(summary.overdueInstallmentsCount)} قسط معوق
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {toPersianDigits(summary.collectionRatePercent)}٪ پرداخت‌شده
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openPaymentModal(ledger)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 text-[11px] font-bold transition-colors"
                        >
                          <Wallet className="w-3 h-3" />
                          <span>ثبت پرداخت</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedLedgerId((prev) => (prev === ledger.id ? null : ledger.id))
                          }
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {selectedLedgerId === ledger.id ? 'بستن جزئیات' : 'اقساط و رسیدها'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Student Ledger Detail Drawer */}
      {expandedRow && expandedRow.student && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                جزئیات پرونده مالی {expandedRow.student.fullName}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {expandedRow.classRoom?.name} · ولی: {expandedRow.student.parentName} ({toPersianDigits(expandedRow.student.parentMobile)})
              </p>
            </div>
            <PrintButtons
              compact
              documentLabel="صورتحساب جامع دانش‌آموز"
              onPrint={(size) =>
                onPrintStatement(expandedRow.ledger, expandedRow.student!, size)
              }
            />
          </div>

          {/* Installments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {expandedRow.ledger.installments.map((inst) => {
              const st = resolveInstallmentStatus(inst, todayJalali);
              return (
                <div
                  key={inst.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{inst.title}</span>
                    <span
                      className={`font-bold ${
                        st === 'paid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : st === 'overdue'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {INSTALLMENT_STATUS_LABELS[st]}
                    </span>
                  </div>
                  <div className="text-slate-500">سررسید: {toPersianDigits(inst.dueDateJalali)}</div>
                  <div className="flex justify-between pt-1 tabular-nums">
                    <span>مبلغ: {formatToman(inst.amountToman)}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      وصولی: {formatToman(inst.paidAmountToman)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recorded Payments for this Student */}
          <div>
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              رسیدهای ثبت‌شده این دانش‌آموز
            </h5>
            <div className="space-y-2">
              {payments
                .filter((p) => p.studentId === expandedRow.student!.id)
                .map((pay) => (
                  <div
                    key={pay.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {toPersianDigits(pay.receiptNumber)} — {pay.targetTitle}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {toPersianDigits(pay.jalaliDate)} · {PAYMENT_METHOD_LABELS[pay.method]} · رهگیری:{' '}
                        {toPersianDigits(pay.trackingCode)}
                        {pay.method === 'cheque' && pay.chequeStatus && (
                          <span className="mr-1.5">
                            (چک {CHEQUE_STATUS_LABELS[pay.chequeStatus]})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatToman(pay.amountToman)}
                      </span>
                      <PrintButtons
                        compact
                        documentLabel={`رسید ${pay.receiptNumber}`}
                        onPrint={(size) => onPrintReceipt(pay, expandedRow.student!, size)}
                      />
                      {canDeletePayments && (
                        <button
                          type="button"
                          onClick={() => {
                            const reverted = revertPaymentFromLedger({
                              ledger: expandedRow.ledger,
                              payment: pay,
                              todayJalali,
                            });
                            onDeletePayment(pay.id, reverted);
                          }}
                          aria-label={`حذف رسید ${pay.receiptNumber}`}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Recording Modal */}
      {modalLedger && modalStudent && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ثبت پرداخت دستی شهریه"
        >
          <form
            onSubmit={handleSaveManualPayment}
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  ثبت پرداخت جدید — {modalStudent.fullName}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  صدور خودکار رسید رسمی قابل چاپ A5 و A4
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalLedgerId(null)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
              >
                بستن
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  بابت قسط
                </label>
                <select
                  value={payInstallmentId}
                  onChange={(e) => {
                    setPayInstallmentId(e.target.value);
                    const found = modalLedger.installments.find((i) => i.id === e.target.value);
                    if (found) {
                      setPayAmount(String(Math.max(0, found.amountToman - found.paidAmountToman)));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  {modalLedger.installments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {`${inst.title} (مانده: ${formatToman(Math.max(0, inst.amountToman - inst.paidAmountToman))})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ پرداختی (تومان)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  روش پرداخت
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as FinancePaymentMethod)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="pos">کارتخوان (POS)</option>
                  <option value="card_to_card">کارت‌به‌کارت</option>
                  <option value="cash">نقدی</option>
                  <option value="cheque">چک بانکی</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تاریخ پرداخت (شمسی)
                </label>
                <input
                  type="text"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  کد رهگیری / شماره فیش
                </label>
                <input
                  type="text"
                  required
                  value={payTrackingCode}
                  onChange={(e) => setPayTrackingCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              {payMethod === 'cheque' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ سررسید چک (شمسی)
                    </label>
                    <input
                      type="text"
                      value={payChequeDue}
                      onChange={(e) => setPayChequeDue(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      وضعیت چک
                    </label>
                    <select
                      value={payChequeStatus}
                      onChange={(e) => setPayChequeStatus(e.target.value as FinanceChequeStatus)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                    >
                      <option value="cleared">پاس‌شده</option>
                      <option value="in_progress">در جریان</option>
                      <option value="bounced">برگشتی</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                توضیحات اختیاری
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="مثلاً دریافت از طریق دستگاه کارتخوان دفتر مدرسه"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalLedgerId(null)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 font-extrabold"
              >
                ثبت پرداخت و صدور رسید
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 4. Operational School Expenses Tab
 * ============================================================================ */
export const FinanceExpensesTab: React.FC<{
  schoolId: string;
  activeUserName: string;
  todayJalali: string;
  canDeleteExpenses: boolean;
  expenses: FinanceExpenseRecord[];
  onSaveExpense: (expense: FinanceExpenseRecord) => { ok: boolean; errorFa?: string };
  onDeleteExpense: (expenseId: string) => { ok: boolean; errorFa?: string };
}> = ({
  schoolId,
  activeUserName,
  todayJalali,
  canDeleteExpenses,
  expenses,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [category, setCategory] = useState<FinanceExpenseCategory>('office_supplies');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dateJalali, setDateJalali] = useState(todayJalali);
  const [voucher, setVoucher] = useState(`V-${toPersianDigits(1405)}-${Math.floor(100 + Math.random() * 899)}`);
  const [description, setDescription] = useState('');

  const filtered = useMemo(
    () =>
      categoryFilter === 'all'
        ? expenses
        : expenses.filter((e) => e.category === categoryFilter),
    [expenses, categoryFilter]
  );

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amountToman, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Number(amount) || 0);
    if (!title.trim() || amt <= 0) return;
    onSaveExpense({
      id: `exp-${Date.now().toString(36)}`,
      schoolId,
      category,
      title: title.trim(),
      amountToman: amt,
      jalaliDate: dateJalali.trim() || todayJalali,
      voucherNumber: voucher.trim() || `V-${Date.now().toString().slice(-4)}`,
      description: description.trim(),
      recordedBy: activeUserName,
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setAmount('');
    setDescription('');
    setVoucher(`V-1405-${Math.floor(100 + Math.random() * 899)}`);
  };

  const handleExportCsv = () => {
    const csv = buildFinanceExpensesCsv(filtered);
    downloadTextFile(`school-expenses-${todayJalali.replace(/\//g, '-')}.csv`, csv, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
      >
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          ثبت سند هزینه عملیاتی مدرسه
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FinanceExpenseCategory)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
          >
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="عنوان هزینه (مثلاً خرید کاغذ و تونر چاپگر)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            required
            min={1000}
            placeholder="مبلغ (تومان)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
          />
          <input
            type="text"
            required
            placeholder="تاریخ شمسی (مثلاً 1405/11/20)"
            value={dateJalali}
            onChange={(e) => setDateJalali(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            placeholder="شماره سند"
            value={voucher}
            onChange={(e) => setVoucher(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            placeholder="توضیحات تکمیلی"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سند هزینه</span>
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="all">همه دسته‌های هزینه</option>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              جمع نمایش‌داده‌شده: {formatToman(totalFiltered)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>خروجی اکسل فارسی</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 px-2">تاریخ</th>
                <th className="py-2 px-2">دسته‌بندی</th>
                <th className="py-2 px-2">عنوان هزینه</th>
                <th className="py-2 px-2">شماره سند</th>
                <th className="py-2 px-2">مبلغ</th>
                {canDeleteExpenses && <th className="py-2 px-2">حذف</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((exp) => (
                <tr key={exp.id}>
                  <td className="py-2.5 px-2 tabular-nums text-slate-600 dark:text-slate-400">
                    {toPersianDigits(exp.jalaliDate)}
                  </td>
                  <td className="py-2.5 px-2 font-semibold text-slate-700 dark:text-slate-300">
                    {EXPENSE_CATEGORY_LABELS[exp.category]}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{exp.title}</div>
                    {exp.description && (
                      <div className="text-[11px] text-slate-500">{exp.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 tabular-nums text-slate-600 dark:text-slate-400">
                    {toPersianDigits(exp.voucherNumber)}
                  </td>
                  <td className="py-2.5 px-2 font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatToman(exp.amountToman)}
                  </td>
                  {canDeleteExpenses && (
                    <td className="py-2.5 px-2">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        aria-label={`حذف سند ${exp.title}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. Overdue Debtors & Messenger Reminder Tab
 * ============================================================================ */
export const FinanceDebtorsTab: React.FC<{
  schoolName: string;
  todayJalali: string;
  rows: Array<{
    student: Student;
    className: string;
    overdueCount: number;
    overdueAmountToman: number;
    remainingTotalToman: number;
  }>;
  onPrintDebtors: (size: PrintPaperSize) => void;
}> = ({ schoolName, todayJalali, rows, onPrintDebtors }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyReminder = async (row: (typeof rows)[number]) => {
    const text = buildDebtorReminderMessenger({
      schoolName,
      studentName: row.student.fullName,
      className: row.className,
      parentName: row.student.parentName,
      overdueCount: row.overdueCount,
      overdueAmountToman: row.overdueAmountToman,
      remainingTotalToman: row.remainingTotalToman,
      todayJalali,
    });
    await copyTextToClipboard(text);
    setCopiedId(row.student.id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>
            تعداد <strong>{toPersianDigits(rows.length)}</strong> پرونده دارای قسط سررسیدشده برای پیگیری محترمانه
          </span>
        </div>
        <PrintButtons compact documentLabel="فهرست اقساط معوق" onPrint={onPrintDebtors} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          هیچ قسط معوقی در این مدرسه وجود ندارد.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-3 font-bold">دانش‌آموز</th>
                  <th className="py-3 px-3 font-bold">کلاس</th>
                  <th className="py-3 px-3 font-bold">ولی و تلفن</th>
                  <th className="py-3 px-3 font-bold">تعداد قسط معوق</th>
                  <th className="py-3 px-3 font-bold">مبلغ معوق</th>
                  <th className="py-3 px-3 font-bold">پیام یادآوری پیام‌رسان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.student.id}>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {row.student.fullName}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{row.className}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      <div>{row.student.parentName}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {toPersianDigits(row.student.parentMobile)}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {toPersianDigits(row.overdueCount)} قسط
                    </td>
                    <td className="py-3 px-3 font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                      {formatToman(row.overdueAmountToman)}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => handleCopyReminder(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 text-[11px] font-bold transition-colors"
                      >
                        {copiedId === row.student.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>کپی شد برای ایتا / بله / شاد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>کپی یادآوری برای ایتا / بله / شاد</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 6. Consolidated 3-School Financial Comparison (complex_admin ONLY)
 * ============================================================================ */
export const FinanceComplexTab: React.FC<{
  rows: ComplexFinanceSchoolRow[];
}> = ({ rows }) => {
  const totalExpected = rows.reduce((s, r) => s + r.totalExpectedToman, 0);
  const totalCollected = rows.reduce((s, r) => s + r.totalCollectedToman, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.totalExpensesToman, 0);
  const totalNet = rows.reduce((s, r) => s + r.netBalanceToman, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
        <Building2 className="w-4 h-4 shrink-0" />
        <span>
          <strong>گزارش تجمیعی ۳ مدرسه (اختصاصی مدیر کل مجموعه):</strong> مقایسه هم‌زمان وصولی، مطالبات، هزینه‌ها و تراز خالص کل مجموعه.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-xs text-slate-500">کل شهریه ۳ مدرسه</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
            {formatToman(totalExpected)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-xs text-slate-500">کل وصولی مجموعه</div>
          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
            {formatToman(totalCollected)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-xs text-slate-500">کل هزینه‌های مجموعه</div>
          <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            {formatToman(totalExpenses)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-xs text-slate-500">تراز خالص کل مجموعه</div>
          <div className="text-base font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums mt-1">
            {formatToman(totalNet)}
          </div>
        </div>
      </div>

      <SvgGroupedBarChart
        title="مقایسه وصولی، مانده مطالبات و هزینه‌ها به تفکیک ۳ مدرسه"
        data={rows.map((r) => ({
          label: r.school.name,
          values: {
            collected: r.totalCollectedToman,
            remaining: r.totalRemainingToman,
            expenses: r.totalExpensesToman,
          },
        }))}
        series={[
          { key: 'collected', label: 'جمع وصولی', color: '#10b981' },
          { key: 'remaining', label: 'مانده مطالبات', color: '#f59e0b' },
          { key: 'expenses', label: 'هزینه‌های عملیاتی', color: '#f43f5e' },
        ]}
        valueFormatter={(v) => formatToman(v)}
        axisFormatter={(v) => formatTomanCompact(v)}
      />

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-3 px-3 font-bold">واحد آموزشی</th>
                <th className="py-3 px-3 font-bold">پرونده‌ها</th>
                <th className="py-3 px-3 font-bold">کل شهریه</th>
                <th className="py-3 px-3 font-bold">وصولی</th>
                <th className="py-3 px-3 font-bold">درصد وصول</th>
                <th className="py-3 px-3 font-bold">هزینه‌ها</th>
                <th className="py-3 px-3 font-bold">تراز خالص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.school.id}>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {r.school.name}
                  </td>
                  <td className="py-3 px-3 tabular-nums">{toPersianDigits(r.studentCount)} نفر</td>
                  <td className="py-3 px-3 tabular-nums">{formatToman(r.totalExpectedToman)}</td>
                  <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatToman(r.totalCollectedToman)}
                  </td>
                  <td className="py-3 px-3 font-bold tabular-nums">
                    {toPersianDigits(r.collectionRatePercent)}٪
                  </td>
                  <td className="py-3 px-3 text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatToman(r.totalExpensesToman)}
                  </td>
                  <td className="py-3 px-3 font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
                    {formatToman(r.netBalanceToman)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
