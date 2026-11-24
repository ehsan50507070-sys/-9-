// Printable A5 & A4 Financial Documents (Official Payment Receipt, Student Statement, Debtors List, Balance Sheet)
import React from 'react';
import { PrintShell } from '../../core/export/PrintShell';
import { formatToman, toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  FinanceExpenseRecord,
  FinancePaymentRecord,
  FinanceStudentLedger,
  School,
  Student,
} from '../../types/domain';
import {
  CHEQUE_STATUS_LABELS,
  computeLedgerSummary,
  EXPENSE_CATEGORY_LABELS,
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  resolveInstallmentStatus,
  type SchoolFinanceKpis,
} from './financeHelpers';

export type FinancePrintMode =
  | { kind: 'receipt'; payment: FinancePaymentRecord; student: Student; classRoom?: ClassRoom }
  | {
      kind: 'statement';
      ledger: FinanceStudentLedger;
      student: Student;
      classRoom?: ClassRoom;
      payments: FinancePaymentRecord[];
    }
  | {
      kind: 'debtors';
      rows: Array<{
        student: Student;
        className: string;
        overdueCount: number;
        overdueAmountToman: number;
        remainingTotalToman: number;
      }>;
    }
  | {
      kind: 'balance_sheet';
      kpis: SchoolFinanceKpis;
      expenses: FinanceExpenseRecord[];
    };

interface FinancePrintViewProps {
  school: School;
  todayJalali: string;
  mode: FinancePrintMode;
}

export const FinancePrintView: React.FC<FinancePrintViewProps> = ({
  school,
  todayJalali,
  mode,
}) => {
  if (mode.kind === 'receipt') {
    const { payment, student, classRoom } = mode;
    return (
      <PrintShell
        school={school}
        documentTitle="رسید رسمی پرداخت شهریه و خدمات آموزشی"
        subtitle={`شماره رسید: ${payment.receiptNumber} · کد رهگیری: ${payment.trackingCode}`}
      >
        <div className="print-only space-y-3 text-xs text-black">
          <div className="grid grid-cols-2 gap-3 p-3 border border-slate-400 rounded-lg">
            <div>
              <span className="text-slate-600">نام دانش‌آموز: </span>
              <strong>{student.fullName}</strong>
            </div>
            <div>
              <span className="text-slate-600">کد ملی: </span>
              <strong>{toPersianDigits(student.nationalId)}</strong>
            </div>
            <div>
              <span className="text-slate-600">کلاس / پایه: </span>
              <strong>{classRoom?.name ?? '—'}</strong>
            </div>
            <div>
              <span className="text-slate-600">نام ولی: </span>
              <strong>{student.parentName}</strong>
            </div>
            <div>
              <span className="text-slate-600">بابت: </span>
              <strong>{payment.targetTitle}</strong>
            </div>
            <div>
              <span className="text-slate-600">تاریخ پرداخت: </span>
              <strong>{toPersianDigits(payment.jalaliDate)}</strong>
            </div>
            <div>
              <span className="text-slate-600">روش پرداخت: </span>
              <strong>{PAYMENT_METHOD_LABELS[payment.method]}</strong>
            </div>
            <div>
              <span className="text-slate-600">شماره پیگیری: </span>
              <strong>{toPersianDigits(payment.trackingCode)}</strong>
            </div>
            {payment.method === 'cheque' && (
              <>
                <div>
                  <span className="text-slate-600">سررسید چک: </span>
                  <strong>{toPersianDigits(payment.chequeDueDateJalali ?? '—')}</strong>
                </div>
                <div>
                  <span className="text-slate-600">وضعیت چک: </span>
                  <strong>
                    {payment.chequeStatus ? CHEQUE_STATUS_LABELS[payment.chequeStatus] : '—'}
                  </strong>
                </div>
              </>
            )}
          </div>

          <div className="p-3 border-2 border-slate-900 rounded-lg flex items-center justify-between bg-slate-50">
            <span className="font-bold text-sm">مبلغ کل دریافتی:</span>
            <span className="font-extrabold text-base tabular-nums">
              {formatToman(payment.amountToman)}
            </span>
          </div>

          {payment.notes && (
            <div className="p-2 border border-slate-300 rounded text-xs">
              <strong>توضیحات: </strong>
              {payment.notes}
            </div>
          )}

          <div className="text-[11px] text-slate-700">
            ثبت‌کننده سند: {payment.recordedBy} · تاریخ صدور رسید: {toPersianDigits(todayJalali)}
          </div>
        </div>
      </PrintShell>
    );
  }

  if (mode.kind === 'statement') {
    const { ledger, student, classRoom, payments } = mode;
    const summary = computeLedgerSummary(ledger, todayJalali);
    return (
      <PrintShell
        school={school}
        documentTitle="صورتحساب جامع مالی دانش‌آموز"
        subtitle={`${student.fullName} · ${classRoom?.name ?? ''} · سال تحصیلی ${ledger.academicYear}`}
      >
        <div className="print-only space-y-4 text-xs text-black">
          <div className="grid grid-cols-4 gap-2 border border-slate-400 p-2.5 rounded-lg">
            <div>
              <div className="text-slate-600">جمع کل قابل پرداخت</div>
              <div className="font-extrabold tabular-nums mt-0.5">
                {formatToman(summary.totalExpectedToman)}
              </div>
            </div>
            <div>
              <div className="text-slate-600">تخفیف اعمال‌شده</div>
              <div className="font-extrabold tabular-nums mt-0.5">
                {formatToman(summary.totalDiscountToman)}
              </div>
            </div>
            <div>
              <div className="text-slate-600">جمع پرداخت‌شده</div>
              <div className="font-extrabold tabular-nums mt-0.5">
                {formatToman(summary.totalPaidToman)}
              </div>
            </div>
            <div>
              <div className="text-slate-600">مانده بدهی</div>
              <div className="font-extrabold tabular-nums mt-0.5">
                {formatToman(summary.totalRemainingToman)}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-1.5">جدول اقساط شهریه</h3>
            <table className="w-full border-collapse border border-slate-400 text-[11px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5 text-right">ردیف</th>
                  <th className="border border-slate-400 p-1.5 text-right">عنوان قسط</th>
                  <th className="border border-slate-400 p-1.5 text-right">سررسید</th>
                  <th className="border border-slate-400 p-1.5 text-right">مبلغ قسط</th>
                  <th className="border border-slate-400 p-1.5 text-right">پرداخت‌شده</th>
                  <th className="border border-slate-400 p-1.5 text-right">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {ledger.installments.map((inst) => {
                  const st = resolveInstallmentStatus(inst, todayJalali);
                  return (
                    <tr key={inst.id}>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(inst.order)}</td>
                      <td className="border border-slate-400 p-1.5">{inst.title}</td>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(inst.dueDateJalali)}</td>
                      <td className="border border-slate-400 p-1.5 tabular-nums">{formatToman(inst.amountToman)}</td>
                      <td className="border border-slate-400 p-1.5 tabular-nums">{formatToman(inst.paidAmountToman)}</td>
                      <td className="border border-slate-400 p-1.5">{INSTALLMENT_STATUS_LABELS[st]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {payments.length > 0 && (
            <div>
              <h3 className="font-bold mb-1.5">سوابق پرداخت ثبت‌شده</h3>
              <table className="w-full border-collapse border border-slate-400 text-[11px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 p-1.5 text-right">شماره رسید</th>
                    <th className="border border-slate-400 p-1.5 text-right">تاریخ</th>
                    <th className="border border-slate-400 p-1.5 text-right">بابت</th>
                    <th className="border border-slate-400 p-1.5 text-right">روش</th>
                    <th className="border border-slate-400 p-1.5 text-right">کد رهگیری</th>
                    <th className="border border-slate-400 p-1.5 text-right">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(p.receiptNumber)}</td>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(p.jalaliDate)}</td>
                      <td className="border border-slate-400 p-1.5">{p.targetTitle}</td>
                      <td className="border border-slate-400 p-1.5">{PAYMENT_METHOD_LABELS[p.method]}</td>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(p.trackingCode)}</td>
                      <td className="border border-slate-400 p-1.5 tabular-nums">{formatToman(p.amountToman)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PrintShell>
    );
  }

  if (mode.kind === 'debtors') {
    return (
      <PrintShell
        school={school}
        documentTitle="فهرست اقساط معوق و پیگیری مطالبات شهریه"
        subtitle={`تعداد پرونده معوق: ${toPersianDigits(mode.rows.length)} نفر`}
      >
        <div className="print-only text-xs text-black">
          <table className="w-full border-collapse border border-slate-400 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1.5 text-right">ردیف</th>
                <th className="border border-slate-400 p-1.5 text-right">دانش‌آموز</th>
                <th className="border border-slate-400 p-1.5 text-right">کلاس</th>
                <th className="border border-slate-400 p-1.5 text-right">ولی و شماره تماس</th>
                <th className="border border-slate-400 p-1.5 text-right">اقساط معوق</th>
                <th className="border border-slate-400 p-1.5 text-right">مبلغ معوق</th>
                <th className="border border-slate-400 p-1.5 text-right">کل مانده</th>
              </tr>
            </thead>
            <tbody>
              {mode.rows.map((r, idx) => (
                <tr key={r.student.id}>
                  <td className="border border-slate-400 p-1.5">{toPersianDigits(idx + 1)}</td>
                  <td className="border border-slate-400 p-1.5 font-semibold">{r.student.fullName}</td>
                  <td className="border border-slate-400 p-1.5">{r.className}</td>
                  <td className="border border-slate-400 p-1.5">{`${r.student.parentName} — ${toPersianDigits(r.student.parentMobile)}`}</td>
                  <td className="border border-slate-400 p-1.5">{toPersianDigits(r.overdueCount)} قسط</td>
                  <td className="border border-slate-400 p-1.5 tabular-nums">{formatToman(r.overdueAmountToman)}</td>
                  <td className="border border-slate-400 p-1.5 tabular-nums">{formatToman(r.remainingTotalToman)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PrintShell>
    );
  }

  // balance_sheet
  return (
    <PrintShell
      school={school}
      documentTitle="ترازنامه و گزارش جامع مالی مدرسه"
      subtitle={`نرخ وصول شهریه: ${toPersianDigits(mode.kpis.collectionRatePercent)}٪`}
    >
      <div className="print-only space-y-4 text-xs text-black">
        <div className="grid grid-cols-3 gap-2.5 border border-slate-400 p-3 rounded-lg">
          <div>
            <div className="text-slate-600">کل شهریه مصوب</div>
            <div className="font-extrabold tabular-nums">{formatToman(mode.kpis.totalExpectedToman)}</div>
          </div>
          <div>
            <div className="text-slate-600">جمع کل وصولی</div>
            <div className="font-extrabold tabular-nums">{formatToman(mode.kpis.totalCollectedToman)}</div>
          </div>
          <div>
            <div className="text-slate-600">مانده مطالبات</div>
            <div className="font-extrabold tabular-nums">{formatToman(mode.kpis.totalRemainingToman)}</div>
          </div>
          <div>
            <div className="text-slate-600">جمع هزینه‌های مدرسه</div>
            <div className="font-extrabold tabular-nums">{formatToman(mode.kpis.totalExpensesToman)}</div>
          </div>
          <div>
            <div className="text-slate-600">تراز خالص مالی</div>
            <div className="font-extrabold tabular-nums">{formatToman(mode.kpis.netBalanceToman)}</div>
          </div>
          <div>
            <div className="text-slate-600">پرونده‌های معوق</div>
            <div className="font-extrabold tabular-nums">{toPersianDigits(mode.kpis.overdueDebtorsCount)} نفر</div>
          </div>
        </div>

        <div>
          <h3 className="font-bold mb-1.5">خلاصه هزینه‌های عملیاتی ثبت‌شده</h3>
          <table className="w-full border-collapse border border-slate-400 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1.5 text-right">تاریخ</th>
                <th className="border border-slate-400 p-1.5 text-right">دسته‌بندی</th>
                <th className="border border-slate-400 p-1.5 text-right">عنوان هزینه</th>
                <th className="border border-slate-400 p-1.5 text-right">شماره سند</th>
                <th className="border border-slate-400 p-1.5 text-right">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {mode.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="border border-slate-400 p-1.5">{toPersianDigits(e.jalaliDate)}</td>
                  <td className="border border-slate-400 p-1.5">{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                  <td className="border border-slate-400 p-1.5">{e.title}</td>
                  <td className="border border-slate-400 p-1.5">{toPersianDigits(e.voucherNumber)}</td>
                  <td className="border border-slate-400 p-1.5 tabular-nums">{formatToman(e.amountToman)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PrintShell>
  );
};
