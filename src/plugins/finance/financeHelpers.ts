// Pure Deterministic Finance & Tuition Calculation Engine (Zero External Dependencies)
import { buildUtf8BomCsv } from '../../lib/csv';
import { formatToman, toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  ClassRoom,
  FinanceChequeStatus,
  FinanceDiscountItem,
  FinanceDiscountType,
  FinanceExpenseCategory,
  FinanceExpenseRecord,
  FinanceExtraFeeType,
  FinanceInstallmentItem,
  FinanceInstallmentStatus,
  FinancePaymentMethod,
  FinancePaymentRecord,
  FinanceStudentLedger,
  School,
  Student,
} from '../../types/domain';

export const PAYMENT_METHOD_LABELS: Record<FinancePaymentMethod, string> = {
  pos: 'کارتخوان (POS)',
  card_to_card: 'کارت‌به‌کارت',
  cash: 'نقدی',
  cheque: 'چک بانکی',
  online_sim: 'درگاه آنلاین (شبیه‌ساز)',
};

export const CHEQUE_STATUS_LABELS: Record<FinanceChequeStatus, string> = {
  cleared: 'پاس‌شده',
  in_progress: 'در جریان',
  bounced: 'برگشتی',
};

export const INSTALLMENT_STATUS_LABELS: Record<FinanceInstallmentStatus, string> = {
  paid: 'پرداخت‌شده',
  partial: 'پرداخت جزئی',
  pending: 'در انتظار پرداخت',
  overdue: 'معوق',
};

export const DISCOUNT_TYPE_LABELS: Record<FinanceDiscountType, string> = {
  sibling: 'تخفیف چندفرزندی',
  talented: 'تخفیف استعداد درخشان',
  staff_special: 'تخفیف پرسنلی / خاص',
};

export const EXTRA_FEE_TYPE_LABELS: Record<FinanceExtraFeeType, string> = {
  extracurricular: 'کلاس‌های فوق‌برنامه',
  transport: 'سرویس ایاب‌وذهاب',
  books: 'کتاب و جزوه آموزشی',
  trip_activity: 'اردو و فعالیت‌ها',
};

export const EXPENSE_CATEGORY_LABELS: Record<FinanceExpenseCategory, string> = {
  salary: 'حقوق و دستمزد',
  rent_utilities: 'اجاره و قبوض',
  equipment_repairs: 'تجهیزات و تعمیرات',
  trips_catering: 'اردو و پذیرایی',
  office_supplies: 'ملزومات اداری',
  other: 'سایر هزینه‌ها',
};

const INSTALLMENT_MONTH_SEQUENCE: Array<{ month: number; name: string; day: string }> = [
  { month: 7, name: 'مهر', day: '10' },
  { month: 8, name: 'آبان', day: '10' },
  { month: 9, name: 'آذر', day: '10' },
  { month: 10, name: 'دی', day: '10' },
  { month: 11, name: 'بهمن', day: '10' },
  { month: 12, name: 'اسفند', day: '10' },
  { month: 1, name: 'فروردین', day: '15' },
  { month: 2, name: 'اردیبهشت', day: '15' },
  { month: 3, name: 'خرداد', day: '10' },
  { month: 4, name: 'تیر', day: '10' },
];

const JALALI_MONTH_NAMES: Record<string, string> = {
  '01': 'فروردین',
  '02': 'اردیبهشت',
  '03': 'خرداد',
  '04': 'تیر',
  '05': 'مرداد',
  '06': 'شهریور',
  '07': 'مهر',
  '08': 'آبان',
  '09': 'آذر',
  '10': 'دی',
  '11': 'بهمن',
  '12': 'اسفند',
};

export interface StudentLedgerSummary {
  grossTuitionAndExtrasToman: number;
  totalDiscountToman: number;
  netTuitionToman: number;
  tuitionPaidToman: number;
  tuitionRemainingToman: number;
  tripTotalToman: number;
  tripPaidToman: number;
  tripRemainingToman: number;
  totalExpectedToman: number;
  totalPaidToman: number;
  totalRemainingToman: number;
  overdueAmountToman: number;
  overdueInstallmentsCount: number;
  paidInstallmentsCount: number;
  totalInstallmentsCount: number;
  collectionRatePercent: number;
  overallStatus: 'settled' | 'overdue' | 'partial' | 'pending';
}

export function resolveInstallmentStatus(
  inst: Pick<FinanceInstallmentItem, 'amountToman' | 'paidAmountToman' | 'dueDateJalali'>,
  todayJalali: string
): FinanceInstallmentStatus {
  if (inst.paidAmountToman >= inst.amountToman && inst.amountToman > 0) return 'paid';
  if (inst.dueDateJalali < todayJalali) return 'overdue';
  if (inst.paidAmountToman > 0) return 'partial';
  return 'pending';
}

export function computeTotalDiscountToman(
  grossToman: number,
  discounts: FinanceDiscountItem[]
): number {
  let total = 0;
  for (const d of discounts) {
    if (d.mode === 'percent') {
      const clampedPct = Math.max(0, Math.min(100, d.value));
      total += Math.round((grossToman * clampedPct) / 100);
    } else {
      total += Math.max(0, Math.round(d.value));
    }
  }
  return Math.min(grossToman, total);
}

export function computeLedgerSummary(
  ledger: FinanceStudentLedger,
  todayJalali: string
): StudentLedgerSummary {
  const extrasTotal = ledger.selectedExtras.reduce((sum, e) => sum + Math.max(0, e.amountToman), 0);
  const grossTuitionAndExtrasToman = Math.max(0, ledger.baseTuitionToman) + extrasTotal;
  const totalDiscountToman = computeTotalDiscountToman(grossTuitionAndExtrasToman, ledger.discounts);
  const netTuitionToman = Math.max(0, grossTuitionAndExtrasToman - totalDiscountToman);

  let tuitionPaidToman = 0;
  let overdueAmountToman = 0;
  let overdueInstallmentsCount = 0;
  let paidInstallmentsCount = 0;

  for (const inst of ledger.installments) {
    const status = resolveInstallmentStatus(inst, todayJalali);
    const paid = Math.min(inst.amountToman, Math.max(0, inst.paidAmountToman));
    tuitionPaidToman += paid;
    if (status === 'paid') {
      paidInstallmentsCount += 1;
    } else if (status === 'overdue') {
      overdueInstallmentsCount += 1;
      overdueAmountToman += Math.max(0, inst.amountToman - paid);
    }
  }

  const installmentTotalSum = ledger.installments.reduce((s, i) => s + Math.max(0, i.amountToman), 0);
  const effectiveTuitionExpected = installmentTotalSum > 0 ? installmentTotalSum : netTuitionToman;
  const tuitionRemainingToman = Math.max(0, effectiveTuitionExpected - tuitionPaidToman);

  const tripTotalToman = ledger.tripFees.reduce((s, t) => s + Math.max(0, t.amountToman), 0);
  const tripPaidToman = ledger.tripFees.reduce(
    (s, t) => s + Math.min(t.amountToman, Math.max(0, t.paidAmountToman)),
    0
  );
  const tripRemainingToman = Math.max(0, tripTotalToman - tripPaidToman);

  const totalExpectedToman = effectiveTuitionExpected + tripTotalToman;
  const totalPaidToman = tuitionPaidToman + tripPaidToman;
  const totalRemainingToman = Math.max(0, totalExpectedToman - totalPaidToman);
  const collectionRatePercent =
    totalExpectedToman > 0 ? Math.min(100, Math.round((totalPaidToman / totalExpectedToman) * 100)) : 100;

  let overallStatus: StudentLedgerSummary['overallStatus'] = 'pending';
  if (totalRemainingToman <= 0) {
    overallStatus = 'settled';
  } else if (overdueInstallmentsCount > 0) {
    overallStatus = 'overdue';
  } else if (totalPaidToman > 0) {
    overallStatus = 'partial';
  }

  return {
    grossTuitionAndExtrasToman,
    totalDiscountToman,
    netTuitionToman: effectiveTuitionExpected,
    tuitionPaidToman,
    tuitionRemainingToman,
    tripTotalToman,
    tripPaidToman,
    tripRemainingToman,
    totalExpectedToman,
    totalPaidToman,
    totalRemainingToman,
    overdueAmountToman,
    overdueInstallmentsCount,
    paidInstallmentsCount,
    totalInstallmentsCount: ledger.installments.length,
    collectionRatePercent,
    overallStatus,
  };
}

/**
 * Generates 1..10 Jalali tuition installments whose sum equals `netTuitionToman` exactly,
 * optionally preserving already-paid amount proportionally from earliest installments.
 */
export function generateInstallmentSchedule(params: {
  studentId: string;
  netTuitionToman: number;
  installmentsCount: number;
  startYear?: number;
  todayJalali: string;
  existingPaidToman?: number;
}): FinanceInstallmentItem[] {
  const count = Math.max(1, Math.min(10, Math.round(params.installmentsCount)));
  const net = Math.max(0, Math.round(params.netTuitionToman));
  const startYear = params.startYear ?? 1405;
  const baseChunk = Math.floor(net / count / 10_000) * 10_000;
  let remainingPaidCredit = Math.max(0, Math.round(params.existingPaidToman ?? 0));

  const items: FinanceInstallmentItem[] = [];
  let allocated = 0;

  for (let i = 0; i < count; i++) {
    const seq = INSTALLMENT_MONTH_SEQUENCE[i] ?? INSTALLMENT_MONTH_SEQUENCE[INSTALLMENT_MONTH_SEQUENCE.length - 1];
    const year = seq.month >= 7 ? startYear : startYear + 1;
    const mm = String(seq.month).padStart(2, '0');
    const dueDateJalali = `${year}/${mm}/${seq.day}`;
    const amountToman = i === count - 1 ? Math.max(0, net - allocated) : baseChunk;
    allocated += amountToman;

    const paidAmountToman = Math.min(amountToman, remainingPaidCredit);
    remainingPaidCredit = Math.max(0, remainingPaidCredit - paidAmountToman);

    const status = resolveInstallmentStatus(
      { amountToman, paidAmountToman, dueDateJalali },
      params.todayJalali
    );

    items.push({
      id: `inst-${params.studentId}-${i + 1}`,
      order: i + 1,
      title: `قسط ${toPersianDigits(i + 1)} — ${seq.name}`,
      dueDateJalali,
      amountToman,
      paidAmountToman,
      status,
      ...(status === 'paid' ? { paidDateJalali: dueDateJalali } : {}),
    });
  }

  return items;
}

export function applyPaymentToLedger(params: {
  ledger: FinanceStudentLedger;
  targetType: 'tuition' | 'trip';
  installmentId?: string;
  tripFeeId?: string;
  amountToman: number;
  paidDateJalali: string;
  trackingCode: string;
  todayJalali: string;
}): FinanceStudentLedger {
  const amount = Math.max(0, Math.round(params.amountToman));

  if (params.targetType === 'trip' && params.tripFeeId) {
    return {
      ...params.ledger,
      tripFees: params.ledger.tripFees.map((t) => {
        if (t.id !== params.tripFeeId) return t;
        const nextPaid = Math.min(t.amountToman, t.paidAmountToman + amount);
        return {
          ...t,
          paidAmountToman: nextPaid,
          status: nextPaid >= t.amountToman ? 'paid' : 'pending',
          paidDateJalali: nextPaid >= t.amountToman ? params.paidDateJalali : t.paidDateJalali,
          trackingCode: params.trackingCode,
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  // Tuition payment: apply to specific installment first, spillover to next unpaid installments if any
  let leftover = amount;
  const targetIndex = params.installmentId
    ? params.ledger.installments.findIndex((i) => i.id === params.installmentId)
    : params.ledger.installments.findIndex((i) => i.paidAmountToman < i.amountToman);

  const nextInstallments = params.ledger.installments.map((inst) => ({ ...inst }));

  const applyAtIndex = (idx: number) => {
    if (idx < 0 || idx >= nextInstallments.length || leftover <= 0) return;
    const inst = nextInstallments[idx];
    const needed = Math.max(0, inst.amountToman - inst.paidAmountToman);
    if (needed <= 0) return;
    const applied = Math.min(needed, leftover);
    inst.paidAmountToman += applied;
    leftover -= applied;
    inst.status = resolveInstallmentStatus(inst, params.todayJalali);
    if (inst.status === 'paid') {
      inst.paidDateJalali = params.paidDateJalali;
    }
  };

  if (targetIndex >= 0) {
    applyAtIndex(targetIndex);
  }
  if (leftover > 0) {
    for (let i = 0; i < nextInstallments.length && leftover > 0; i++) {
      if (i === targetIndex) continue;
      applyAtIndex(i);
    }
  }

  return {
    ...params.ledger,
    installments: nextInstallments,
    updatedAt: new Date().toISOString(),
  };
}

export function revertPaymentFromLedger(params: {
  ledger: FinanceStudentLedger;
  payment: FinancePaymentRecord;
  todayJalali: string;
}): FinanceStudentLedger {
  const { ledger, payment, todayJalali } = params;
  if (payment.targetType === 'trip' && payment.tripFeeId) {
    return {
      ...ledger,
      tripFees: ledger.tripFees.map((t) => {
        if (t.id !== payment.tripFeeId) return t;
        const nextPaid = Math.max(0, t.paidAmountToman - payment.amountToman);
        return {
          ...t,
          paidAmountToman: nextPaid,
          status: nextPaid >= t.amountToman ? 'paid' : 'pending',
          paidDateJalali: nextPaid >= t.amountToman ? t.paidDateJalali : undefined,
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  let toRevert = payment.amountToman;
  const nextInstallments = ledger.installments.map((i) => ({ ...i }));
  const targetIdx = payment.installmentId
    ? nextInstallments.findIndex((i) => i.id === payment.installmentId)
    : -1;

  const revertIdx = (idx: number) => {
    if (idx < 0 || idx >= nextInstallments.length || toRevert <= 0) return;
    const inst = nextInstallments[idx];
    const deducted = Math.min(inst.paidAmountToman, toRevert);
    inst.paidAmountToman -= deducted;
    toRevert -= deducted;
    inst.status = resolveInstallmentStatus(inst, todayJalali);
    if (inst.status !== 'paid') {
      inst.paidDateJalali = undefined;
    }
  };

  if (targetIdx >= 0) revertIdx(targetIdx);
  for (let i = nextInstallments.length - 1; i >= 0 && toRevert > 0; i--) {
    if (i === targetIdx) continue;
    revertIdx(i);
  }

  return {
    ...ledger,
    installments: nextInstallments,
    updatedAt: new Date().toISOString(),
  };
}

export interface SchoolFinanceKpis {
  totalExpectedToman: number;
  totalCollectedToman: number;
  totalRemainingToman: number;
  overdueDebtorsCount: number;
  overdueTotalToman: number;
  totalExpensesToman: number;
  netBalanceToman: number;
  collectionRatePercent: number;
  settledStudentsCount: number;
  partialStudentsCount: number;
  pendingStudentsCount: number;
}

export function computeSchoolFinanceKpis(params: {
  ledgers: FinanceStudentLedger[];
  payments: FinancePaymentRecord[];
  expenses: FinanceExpenseRecord[];
  todayJalali: string;
}): SchoolFinanceKpis {
  let totalExpectedToman = 0;
  let totalCollectedFromLedgers = 0;
  let totalRemainingToman = 0;
  let overdueDebtorsCount = 0;
  let overdueTotalToman = 0;
  let settledStudentsCount = 0;
  let partialStudentsCount = 0;
  let pendingStudentsCount = 0;

  for (const ledger of params.ledgers) {
    const s = computeLedgerSummary(ledger, params.todayJalali);
    totalExpectedToman += s.totalExpectedToman;
    totalCollectedFromLedgers += s.totalPaidToman;
    totalRemainingToman += s.totalRemainingToman;
    if (s.overdueInstallmentsCount > 0) {
      overdueDebtorsCount += 1;
      overdueTotalToman += s.overdueAmountToman;
    }
    if (s.overallStatus === 'settled') settledStudentsCount += 1;
    else if (s.overallStatus === 'partial') partialStudentsCount += 1;
    else if (s.overallStatus === 'pending') pendingStudentsCount += 1;
  }

  const totalPaymentsSum = params.payments
    .filter((p) => p.chequeStatus !== 'bounced')
    .reduce((sum, p) => sum + Math.max(0, p.amountToman), 0);

  // Use ledger-tracked collected amount for consistency with expected/remaining
  const totalCollectedToman = Math.max(totalCollectedFromLedgers, 0);
  const totalExpensesToman = params.expenses.reduce((sum, e) => sum + Math.max(0, e.amountToman), 0);
  const netBalanceToman =
    (totalPaymentsSum > 0 ? Math.max(totalCollectedToman, totalPaymentsSum) : totalCollectedToman) -
    totalExpensesToman;
  const collectionRatePercent =
    totalExpectedToman > 0 ? Math.min(100, Math.round((totalCollectedToman / totalExpectedToman) * 100)) : 0;

  return {
    totalExpectedToman,
    totalCollectedToman,
    totalRemainingToman,
    overdueDebtorsCount,
    overdueTotalToman,
    totalExpensesToman,
    netBalanceToman,
    collectionRatePercent,
    settledStudentsCount,
    partialStudentsCount,
    pendingStudentsCount,
  };
}

export interface MonthlyCashflowPoint {
  monthKey: string;
  monthLabel: string;
  incomeToman: number;
  expenseToman: number;
}

export function computeMonthlyCashflowSeries(params: {
  payments: FinancePaymentRecord[];
  expenses: FinanceExpenseRecord[];
}): MonthlyCashflowPoint[] {
  const bucketMap = new Map<string, { income: number; expense: number }>();

  const ensureBucket = (jalaliDate: string) => {
    const parts = jalaliDate.split('/');
    const key = parts.length >= 2 ? `${parts[0]}/${parts[1].padStart(2, '0')}` : '1405/07';
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { income: 0, expense: 0 });
    }
    return bucketMap.get(key)!;
  };

  for (const p of params.payments) {
    if (p.chequeStatus === 'bounced') continue;
    ensureBucket(p.jalaliDate).income += Math.max(0, p.amountToman);
  }
  for (const e of params.expenses) {
    ensureBucket(e.jalaliDate).expense += Math.max(0, e.amountToman);
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, val]) => {
      const mm = monthKey.split('/')[1] ?? '07';
      return {
        monthKey,
        monthLabel: JALALI_MONTH_NAMES[mm] ?? monthKey,
        incomeToman: val.income,
        expenseToman: val.expense,
      };
    });
}

export interface ComplexFinanceSchoolRow {
  school: School;
  studentCount: number;
  totalExpectedToman: number;
  totalCollectedToman: number;
  totalRemainingToman: number;
  totalExpensesToman: number;
  netBalanceToman: number;
  collectionRatePercent: number;
  overdueDebtorsCount: number;
}

export function computeComplexFinanceComparison(params: {
  schools: School[];
  ledgers: FinanceStudentLedger[];
  payments: FinancePaymentRecord[];
  expenses: FinanceExpenseRecord[];
  todayJalali: string;
}): ComplexFinanceSchoolRow[] {
  return params.schools.map((school) => {
    const sLedgers = params.ledgers.filter((l) => l.schoolId === school.id);
    const sPayments = params.payments.filter((p) => p.schoolId === school.id);
    const sExpenses = params.expenses.filter((e) => e.schoolId === school.id);
    const kpi = computeSchoolFinanceKpis({
      ledgers: sLedgers,
      payments: sPayments,
      expenses: sExpenses,
      todayJalali: params.todayJalali,
    });
    return {
      school,
      studentCount: sLedgers.length,
      totalExpectedToman: kpi.totalExpectedToman,
      totalCollectedToman: kpi.totalCollectedToman,
      totalRemainingToman: kpi.totalRemainingToman,
      totalExpensesToman: kpi.totalExpensesToman,
      netBalanceToman: kpi.netBalanceToman,
      collectionRatePercent: kpi.collectionRatePercent,
      overdueDebtorsCount: kpi.overdueDebtorsCount,
    };
  });
}

export function generateReceiptNumber(existingCount: number): string {
  const num = 1001 + existingCount + Math.floor(Math.random() * 50);
  return `F-1405-${num}`;
}

export function generateTrackingCode(prefix = 'TRK'): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${digits}`;
}

export function buildDebtorReminderMessenger(params: {
  schoolName: string;
  studentName: string;
  className: string;
  parentName: string;
  overdueCount: number;
  overdueAmountToman: number;
  remainingTotalToman: number;
  todayJalali: string;
}): string {
  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: 'یادآوری محترمانه اقساط شهریه',
    jalaliDateDisplay: params.todayJalali,
    sections: [
      {
        lines: [
          `با سلام و احترام خدمت اولیای گرامی ${params.parentName}`,
          `دانش‌آموز: ${params.studentName}`,
          `کلاس: ${params.className}`,
        ],
      },
      {
        heading: 'وضعیت اقساط سررسیدشده',
        lines: [
          `تعداد قسط معوق: ${toPersianDigits(params.overdueCount)} قسط`,
          `مبلغ سررسیدشده: ${formatToman(params.overdueAmountToman)}`,
          `جمع کل مانده شهریه سال تحصیلی: ${formatToman(params.remainingTotalToman)}`,
        ],
      },
      {
        lines: [
          'خواهشمند است جهت تسویه یا هماهنگی زمان پرداخت از طریق بخش مالی سامانه یا دفتر مدرسه اقدام فرمایید.',
          'پیشاپیش از همکاری و همراهی ارزشمند شما سپاسگزاریم.',
        ],
      },
    ],
    footerNote: 'پیام رسمی واحد مالی مدرسه (مناسب ارسال در ایتا، بله و شاد)',
  });
}

export function buildFinanceSummaryMessenger(params: {
  schoolName: string;
  todayJalali: string;
  kpis: SchoolFinanceKpis;
}): string {
  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: 'خلاصه تراز مالی و وصول شهریه',
    jalaliDateDisplay: params.todayJalali,
    sections: [
      {
        heading: 'شاخص‌های کلیدی مالی',
        lines: [
          `کل شهریه مصوب و فعالیت‌ها: ${formatToman(params.kpis.totalExpectedToman)}`,
          `جمع کل وصولی تا امروز: ${formatToman(params.kpis.totalCollectedToman)} (${toPersianDigits(params.kpis.collectionRatePercent)}٪)`,
          `مانده مطالبات قابل وصول: ${formatToman(params.kpis.totalRemainingToman)}`,
          `تعداد پرونده‌های دارای قسط معوق: ${toPersianDigits(params.kpis.overdueDebtorsCount)} نفر`,
          `جمع هزینه‌های عملیاتی مدرسه: ${formatToman(params.kpis.totalExpensesToman)}`,
          `تراز خالص مالی: ${formatToman(params.kpis.netBalanceToman)}`,
        ],
      },
    ],
  });
}

export function buildFinanceLedgersCsv(params: {
  ledgers: FinanceStudentLedger[];
  students: Student[];
  classes: ClassRoom[];
  todayJalali: string;
}): string {
  const studentMap = new Map(params.students.map((s) => [s.id, s]));
  const classMap = new Map(params.classes.map((c) => [c.id, c]));
  const headers = [
    'نام دانش‌آموز',
    'کد ملی',
    'کلاس',
    'شهریه و فوق‌برنامه (تومان)',
    'تخفیف (تومان)',
    'خالص قابل پرداخت (تومان)',
    'پرداخت‌شده (تومان)',
    'مانده بدهی (تومان)',
    'تعداد قسط معوق',
    'درصد وصول',
  ];

  const rows = params.ledgers.map((l) => {
    const st = studentMap.get(l.studentId);
    const cls = classMap.get(l.classId);
    const s = computeLedgerSummary(l, params.todayJalali);
    return [
      st ? st.fullName : l.studentId,
      st?.nationalId ?? '',
      cls?.name ?? '',
      s.grossTuitionAndExtrasToman,
      s.totalDiscountToman,
      s.totalExpectedToman,
      s.totalPaidToman,
      s.totalRemainingToman,
      s.overdueInstallmentsCount,
      `${s.collectionRatePercent}%`,
    ];
  });

  return buildUtf8BomCsv(headers, rows);
}

export function buildFinanceExpensesCsv(expenses: FinanceExpenseRecord[]): string {
  const headers = ['تاریخ شمسی', 'دسته‌بندی', 'عنوان هزینه', 'مبلغ (تومان)', 'شماره سند', 'توضیحات', 'ثبت‌کننده'];
  const rows = expenses.map((e) => [
    e.jalaliDate,
    EXPENSE_CATEGORY_LABELS[e.category],
    e.title,
    e.amountToman,
    e.voucherNumber,
    e.description,
    e.recordedBy,
  ]);
  return buildUtf8BomCsv(headers, rows);
}
