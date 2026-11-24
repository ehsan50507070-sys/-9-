// Layer-1 Security: 60-Second Pre-Logout Idle Warning Modal
import React from 'react';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';

export interface IdleLogoutWarningModalProps {
  open: boolean;
  secondsRemaining: number;
  onStayActive: () => void;
  onLogoutNow: () => void;
}

export const IdleLogoutWarningModal: React.FC<IdleLogoutWarningModalProps> = ({
  open,
  secondsRemaining,
  onStayActive,
  onLogoutNow,
}) => {
  if (!open) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="idle-warning-title"
              className="text-sm font-extrabold text-slate-900 dark:text-white"
            >
              هشدار پایان نشست امنیتی
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              به دلیل ۳۰ دقیقه عدم فعالیت در سامانه
            </p>
          </div>
        </div>

        <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
          برای حفاظت از اطلاعات مدرسه، نشست کاربری شما تا{' '}
          <span className="inline-block rounded-md bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 font-extrabold tabular-nums text-rose-700 dark:text-rose-300">
            {toPersianDigits(secondsRemaining)} ثانیه
          </span>{' '}
          دیگر به‌صورت خودکار بسته می‌شود.
        </p>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onStayActive}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl brand-btn px-4 py-2 text-xs font-bold"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>ادامه فعالیت</span>
          </button>
          <button
            type="button"
            onClick={onLogoutNow}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
