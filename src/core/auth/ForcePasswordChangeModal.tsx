// Layer-1 Security: Mandatory Password Change Gate (shown when session.mustChangePassword === true)
import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, LogOut, ShieldAlert } from 'lucide-react';
import { OFFICIAL_SYSTEM_NAME_FA, SystemBrandLogo } from '../branding/BrandLogo';
import { useSchoolData } from '../data/DataContext';
import { validateStrongPassword } from '../security/sanitize';

export const ForcePasswordChangeModal: React.FC = () => {
  const { session, globalSystemConfig, changeOwnPassword, logout } = useSchoolData();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  if (!session || !session.mustChangePassword) return null;

  const strength = validateStrongPassword(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFa(null);

    if (!currentPassword.trim()) {
      setErrorFa('لطفاً رمز عبور فعلی خود را وارد نمایید.');
      return;
    }
    if (!strength.valid) {
      setErrorFa(strength.errorFa ?? 'رمز عبور جدید استانداردهای امنیتی را ندارد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorFa('تکرار رمز عبور جدید با رمز واردشده مطابقت ندارد.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await changeOwnPassword(currentPassword, newPassword);
      if (!res.ok) {
        setErrorFa(res.errorFa ?? 'خطا در تغییر رمز عبور.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-pw-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <SystemBrandLogo logoDataUrl={globalSystemConfig.systemLogoDataUrl} size="md" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
              الزام امنیتی نخستین ورود
            </div>
            <h1
              id="force-pw-title"
              className="text-base font-extrabold text-slate-900 dark:text-white truncate"
            >
              تغییر اجباری رمز عبور
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {OFFICIAL_SYSTEM_NAME_FA}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 text-xs leading-6 text-amber-900 dark:text-amber-200">
          برای حفاظت از حساب کاربری <strong>{session.displayName}</strong>، پیش از ورود به محیط
          سامانه لازم است رمز عبور اولیه خود را به یک رمز عبور قوی تغییر دهید.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-200">
              رمز عبور فعلی
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                dir="ltr"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-10 py-2.5 text-sm text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="نمایش یا مخفی‌سازی رمز"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-200">
              رمز عبور جدید (حداقل ۸ کاراکتر شامل حروف انگلیسی و عدد)
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                dir="ltr"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
                placeholder="مثلاً: RahRoshan2026"
              />
            </div>
            {newPassword.length > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  <span
                    className={`h-1.5 flex-1 rounded-full ${
                      strength.valid ? 'bg-emerald-500' : 'bg-rose-400'
                    }`}
                  />
                  <span
                    className={`h-1.5 flex-1 rounded-full ${
                      strength.valid && strength.score >= 2
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                  <span
                    className={`h-1.5 flex-1 rounded-full ${
                      strength.valid && strength.score === 3
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    strength.valid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {strength.valid
                    ? strength.score === 3
                      ? 'بسیار قوی'
                      : 'مناسب'
                    : 'ضعیف'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-200">
              تکرار رمز عبور جدید
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              dir="ltr"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {errorFa && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-rose-700 dark:text-rose-300 font-semibold"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorFa}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl brand-btn px-4 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'در حال ثبت رمز جدید...' : 'ثبت رمز عبور جدید و ورود'}</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
