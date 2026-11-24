// Online Tuition & School Trip Payment Simulator (Parent Portal + Principal/Complex Admin Demo Mode)
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Lock,
  Receipt,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { PrintButtons } from '../../core/print/PrintButtons';
import type { PrintPaperSize } from '../../core/print/printService';
import { formatToman, toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  FinancePaymentRecord,
  FinanceStudentLedger,
  RoleId,
  Student,
} from '../../types/domain';
import {
  applyPaymentToLedger,
  computeLedgerSummary,
  generateReceiptNumber,
  generateTrackingCode,
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  resolveInstallmentStatus,
} from './financeHelpers';

interface PayableItem {
  key: string;
  targetType: 'tuition' | 'trip';
  installmentId?: string;
  tripFeeId?: string;
  title: string;
  dueDateJalali: string;
  remainingToman: number;
  statusLabel: string;
  isOverdue: boolean;
}

interface FinanceOnlinePayTabProps {
  activeRole: RoleId;
  activeUserName: string;
  schoolName: string;
  todayJalali: string;
  students: Student[];
  classes: ClassRoom[];
  ledgers: FinanceStudentLedger[];
  payments: FinancePaymentRecord[];
  onRecordPayment: (params: {
    payment: FinancePaymentRecord;
    updatedLedger: FinanceStudentLedger;
  }) => { ok: boolean; errorFa?: string };
  onPrintReceipt: (payment: FinancePaymentRecord, student: Student, size: PrintPaperSize) => void;
  onPrintStatement: (ledger: FinanceStudentLedger, student: Student, size: PrintPaperSize) => void;
}

export const FinanceOnlinePayTab: React.FC<FinanceOnlinePayTabProps> = ({
  activeRole,
  activeUserName,
  schoolName,
  todayJalali,
  students,
  classes,
  ledgers,
  payments,
  onRecordPayment,
  onPrintReceipt,
  onPrintStatement,
}) => {
  const isParent = activeRole === 'parent';
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    ledgers[0]?.studentId ?? students[0]?.id ?? ''
  );

  const effectiveStudentId = isParent
    ? ledgers[0]?.studentId ?? ''
    : ledgers.some((l) => l.studentId === selectedStudentId)
      ? selectedStudentId
      : ledgers[0]?.studentId ?? '';

  const activeLedger = useMemo(
    () => ledgers.find((l) => l.studentId === effectiveStudentId) ?? null,
    [ledgers, effectiveStudentId]
  );

  const activeStudent = useMemo(
    () => students.find((s) => s.id === effectiveStudentId) ?? null,
    [students, effectiveStudentId]
  );

  const activeClass = useMemo(
    () => classes.find((c) => c.id === activeStudent?.classId),
    [classes, activeStudent]
  );

  const studentPayments = useMemo(
    () => payments.filter((p) => p.studentId === effectiveStudentId),
    [payments, effectiveStudentId]
  );

  const [gatewayTarget, setGatewayTarget] = useState<PayableItem | null>(null);
  const [simCardLast4, setSimCardLast4] = useState('۶۰۳۷-۹۹۷۵-****-۴۸۲۱');
  const [simBankName, setSimBankName] = useState('بانک ملی ایران (شاپرک آزمایشی)');
  const [gatewayFeedback, setGatewayFeedback] = useState<{
    kind: 'success' | 'cancelled' | 'error';
    message: string;
    receiptPayment?: FinancePaymentRecord;
  } | null>(null);

  if (!activeLedger || !activeStudent) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-600 dark:text-slate-300">
        پرونده مالی فعالی برای نمایش در این بخش ثبت نشده است.
      </div>
    );
  }

  const summary = computeLedgerSummary(activeLedger, todayJalali);

  const openInstallments: PayableItem[] = activeLedger.installments
    .map((inst) => {
      const st = resolveInstallmentStatus(inst, todayJalali);
      const rem = Math.max(0, inst.amountToman - inst.paidAmountToman);
      return {
        key: inst.id,
        targetType: 'tuition' as const,
        installmentId: inst.id,
        title: inst.title,
        dueDateJalali: inst.dueDateJalali,
        remainingToman: rem,
        statusLabel: INSTALLMENT_STATUS_LABELS[st],
        isOverdue: st === 'overdue',
      };
    })
    .filter((item) => item.remainingToman > 0);

  const openTrips: PayableItem[] = activeLedger.tripFees
    .filter((t) => t.status !== 'paid' && t.amountToman - t.paidAmountToman > 0)
    .map((t) => ({
      key: t.id,
      targetType: 'trip' as const,
      tripFeeId: t.id,
      title: t.title,
      dueDateJalali: t.dueDateJalali,
      remainingToman: Math.max(0, t.amountToman - t.paidAmountToman),
      statusLabel: 'در انتظار پرداخت',
      isOverdue: false,
    }));

  const handleConfirmSuccess = () => {
    if (!gatewayTarget) return;
    const trackingCode = generateTrackingCode('SHP');
    const receiptNumber = generateReceiptNumber(payments.length);

    const updatedLedger = applyPaymentToLedger({
      ledger: activeLedger,
      targetType: gatewayTarget.targetType,
      installmentId: gatewayTarget.installmentId,
      tripFeeId: gatewayTarget.tripFeeId,
      amountToman: gatewayTarget.remainingToman,
      paidDateJalali: todayJalali,
      trackingCode,
      todayJalali,
    });

    const newPayment: FinancePaymentRecord = {
      id: `pay-online-${Date.now().toString(36)}`,
      schoolId: activeLedger.schoolId,
      receiptNumber,
      studentId: activeStudent.id,
      classId: activeStudent.classId,
      ledgerId: activeLedger.id,
      targetType: gatewayTarget.targetType,
      installmentId: gatewayTarget.installmentId,
      tripFeeId: gatewayTarget.tripFeeId,
      targetTitle: gatewayTarget.title,
      amountToman: gatewayTarget.remainingToman,
      jalaliDate: todayJalali,
      method: 'online_sim',
      trackingCode,
      notes: `پرداخت اینترنتی آزمایشی از ${simBankName}`,
      recordedBy: activeUserName,
      recordedByRole: activeRole,
      createdAt: new Date().toISOString(),
    };

    const res = onRecordPayment({ payment: newPayment, updatedLedger });
    if (!res.ok) {
      setGatewayFeedback({
        kind: 'error',
        message: res.errorFa ?? 'ثبت پرداخت ناموفق بود.',
      });
      setGatewayTarget(null);
      return;
    }

    setGatewayFeedback({
      kind: 'success',
      message: `پرداخت موفق برای «${gatewayTarget.title}» با کد رهگیری ${toPersianDigits(trackingCode)} ثبت شد و پرونده مالی بلافاصله به‌روزرسانی گردید.`,
      receiptPayment: newPayment,
    });
    setGatewayTarget(null);
  };

  const handleCancelPayment = () => {
    if (!gatewayTarget) return;
    setGatewayFeedback({
      kind: 'cancelled',
      message: `عملیات پرداخت برای «${gatewayTarget.title}» لغو شد و هیچ مبلغی کسر یا ثبت نگردید.`,
    });
    setGatewayTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Demo Selector for Principal / Complex Admin */}
      {!isParent && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-indigo-900 dark:text-indigo-200">
            <strong>حالت پیش‌نمایش و تست درگاه پرداخت اولیا:</strong> می‌توانید پرونده مالی هر دانش‌آموز را انتخاب کرده و تجربه پرداخت آنلاین شبیه‌سازی‌شده اولیا را آزمایش کنید.
          </div>
          <select
            aria-label="انتخاب دانش‌آموز برای شبیه‌سازی پرداخت آنلاین"
            value={effectiveStudentId}
            onChange={(e) => {
              setSelectedStudentId(e.target.value);
              setGatewayFeedback(null);
            }}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            {ledgers.map((l) => {
              const st = students.find((s) => s.id === l.studentId);
              if (!st) return null;
              return (
                <option key={l.id} value={l.studentId}>
                  {st.fullName}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Feedback Banner */}
      {gatewayFeedback && (
        <div
          className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
            gatewayFeedback.kind === 'success'
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
              : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5 text-sm">
            {gatewayFeedback.kind === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            )}
            <p className="font-medium leading-6">{gatewayFeedback.message}</p>
          </div>
          {gatewayFeedback.receiptPayment && (
            <PrintButtons
              compact
              documentLabel="رسید پرداخت آنلاین"
              onPrint={(size) => onPrintReceipt(gatewayFeedback.receiptPayment!, activeStudent, size)}
            />
          )}
        </div>
      )}

      {/* Student Financial Summary Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              پرونده مالی {activeStudent.fullName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeClass?.name ?? '—'} · سال تحصیلی {toPersianDigits(activeLedger.academicYear)} · {schoolName}
            </p>
          </div>
          <PrintButtons
            compact
            documentLabel="صورتحساب جامع دانش‌آموز"
            onPrint={(size) => onPrintStatement(activeLedger, activeStudent, size)}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">جمع خالص قابل پرداخت</div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
              {formatToman(summary.totalExpectedToman)}
            </div>
            {summary.totalDiscountToman > 0 && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                شامل {formatToman(summary.totalDiscountToman)} تخفیف
              </div>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">جمع پرداخت‌شده</div>
            <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
              {formatToman(summary.totalPaidToman)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {toPersianDigits(summary.collectionRatePercent)}٪ تسویه‌شده
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">مانده کل بدهی</div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
              {formatToman(summary.totalRemainingToman)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">اقساط سررسیدشده (معوق)</div>
            <div
              className={`text-base font-extrabold tabular-nums mt-1 ${
                summary.overdueInstallmentsCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {summary.overdueInstallmentsCount > 0
                ? `${toPersianDigits(summary.overdueInstallmentsCount)} قسط (${formatToman(summary.overdueAmountToman)})`
                : 'بدون معوقه'}
            </div>
          </div>
        </div>
      </div>

      {/* Open Tuition Installments + School Trips / Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tuition Installments */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              اقساط باز شهریه
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(openInstallments.length)} قسط قابل پرداخت
            </span>
          </div>

          {openInstallments.length === 0 ? (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              تمامی اقساط شهریه سال تحصیلی به‌طور کامل تسویه شده است.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {openInstallments.map((item) => (
                <div
                  key={item.key}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>سررسید: {toPersianDigits(item.dueDateJalali)}</span>
                      <span>·</span>
                      <span
                        className={
                          item.isOverdue
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 font-medium'
                        }
                      >
                        {item.statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatToman(item.remainingToman)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGatewayTarget(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-bold transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>پرداخت آنلاین</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* School Trips & Optional Events */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              هزینه اردوها و فعالیت‌های آموزشی
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(openTrips.length)} مورد باز
            </span>
          </div>

          {activeLedger.tripFees.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              هزینه اردو یا فعالیت جداگانه‌ای تعریف نشده است.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeLedger.tripFees.map((trip) => {
                const rem = Math.max(0, trip.amountToman - trip.paidAmountToman);
                const isPaid = trip.status === 'paid' || rem <= 0;
                return (
                  <div
                    key={trip.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {trip.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        مهلت پرداخت: {toPersianDigits(trip.dueDateJalali)}
                        {isPaid && trip.trackingCode && (
                          <span className="mr-2 text-emerald-600 dark:text-emerald-400">
                            · کد رهگیری: {toPersianDigits(trip.trackingCode)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatToman(trip.amountToman)}
                      </span>
                      {isPaid ? (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          پرداخت‌شده
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setGatewayTarget({
                              key: trip.id,
                              targetType: 'trip',
                              tripFeeId: trip.id,
                              title: trip.title,
                              dueDateJalali: trip.dueDateJalali,
                              remainingToman: rem,
                              statusLabel: 'در انتظار پرداخت',
                              isOverdue: false,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>پرداخت آنلاین</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Paid Receipts History */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            سوابق پرداخت و رسیدهای رسمی
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {toPersianDigits(studentPayments.length)} رسید
          </span>
        </div>

        {studentPayments.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            هنوز پرداختی برای این دانش‌آموز ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 px-2 font-semibold">شماره رسید</th>
                  <th className="py-2 px-2 font-semibold">بابت</th>
                  <th className="py-2 px-2 font-semibold">تاریخ</th>
                  <th className="py-2 px-2 font-semibold">روش</th>
                  <th className="py-2 px-2 font-semibold">کد رهگیری</th>
                  <th className="py-2 px-2 font-semibold">مبلغ</th>
                  <th className="py-2 px-2 font-semibold">چاپ رسید</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentPayments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      {toPersianDigits(pay.receiptNumber)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">
                      {pay.targetTitle}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(pay.jalaliDate)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">
                      {PAYMENT_METHOD_LABELS[pay.method]}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(pay.trackingCode)}
                    </td>
                    <td className="py-2.5 px-2 font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatToman(pay.amountToman)}
                    </td>
                    <td className="py-2.5 px-2">
                      <PrintButtons
                        compact
                        documentLabel={`رسید ${pay.receiptNumber}`}
                        onPrint={(size) => onPrintReceipt(pay, activeStudent, size)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulated Iranian Bank Payment Gateway Modal */}
      {gatewayTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="شبیه‌ساز درگاه پرداخت بانکی — حالت آزمایشی"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold">
                    شبیه‌ساز درگاه پرداخت بانکی — حالت آزمایشی
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    شبکه الکترونیکی پرداخت کارت (بدون کسر واقعی وجه)
                  </p>
                </div>
              </div>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">پذیرنده:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{schoolName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">دانش‌آموز:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {activeStudent.fullName}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">بابت:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{gatewayTarget.title}</strong>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-200">مبلغ قابل پرداخت:</span>
                  <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
                    {formatToman(gatewayTarget.remainingToman)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    درگاه بانکی آزمایشی
                  </label>
                  <select
                    value={simBankName}
                    onChange={(e) => setSimBankName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-100"
                  >
                    <option value="بانک ملی ایران (شاپرک آزمایشی)">بانک ملی ایران (شاپرک آزمایشی)</option>
                    <option value="بانک ملت (به‌پرداخت آزمایشی)">بانک ملت (به‌پرداخت آزمایشی)</option>
                    <option value="بانک سامان (سپ آزمایشی)">بانک سامان (سپ آزمایشی)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    شماره کارت شبیه‌سازی‌شده (نمایشی)
                  </label>
                  <input
                    type="text"
                    value={simCardLast4}
                    onChange={(e) => setSimCardLast4(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-100 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmSuccess}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-extrabold transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأیید و پرداخت موفق</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelPayment}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-4 py-2.5 text-xs font-bold transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>انصراف / پرداخت ناموفق</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
