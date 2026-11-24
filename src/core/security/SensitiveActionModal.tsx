// Step 3-B: Two-Step Verification Modal for Sensitive Actions (Password + Exact Persian Phrase)
import React, { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, Lock, ShieldAlert, X } from 'lucide-react';

export interface SensitiveActionModalProps {
  open: boolean;
  titleFa: string;
  descriptionFa: string;
  requiredPhrase: string;
  confirmButtonLabelFa: string;
  tone?: 'danger' | 'warning';
  onClose: () => void;
  /**
   * Called with the entered password and phrase. Return { ok: true } to close,
   * or { ok: false, errorFa } to display inline validation error.
   */
  onConfirm: (
    passwordPlain: string,
    confirmPhrase: string
  ) => Promise<{ ok: boolean; errorFa?: string }>;
}

export const SensitiveActionModal: React.FC<SensitiveActionModalProps> = ({
  open,
  titleFa,
  descriptionFa,
  requiredPhrase,
  confirmButtonLabelFa,
  tone = 'danger',
  onClose,
  onConfirm,
}) => {
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setPhrase('');
      setErrorFa(null);
      setSubmitting(false);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const phraseMatches = phrase.trim() === requiredPhrase.trim();
  const canSubmit = password.trim().length > 0 && phraseMatches && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFa(null);
    if (!password.trim()) {
      setErrorFa('لطفاً رمز عبور حساب کاربری فعلی خود را وارد کنید.');
      return;
    }
    if (!phraseMatches) {
      setErrorFa(`لطفاً عبارت «${requiredPhrase}» را دقیقاً وارد کنید.`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await onConfirm(password, phrase.trim());
      if (result.ok) {
        onClose();
      } else {
        setErrorFa(result.errorFa ?? 'احراز هویت ناموفق بود.');
      }
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در تایید عملیات حساس.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensitive-action-title"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${
            tone === 'danger'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                tone === 'danger'
                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="sensitive-action-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-100"
              >
                {titleFa}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {descriptionFa}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="بستن پنجره"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-white/70 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
            <span>
              این عملیات حساس مشمول <strong>تایید دومرحله‌ای</strong> است؛ ورود مجدد رمز عبور فعلی
              و تایپ دقیق عبارت تایید الزامی می‌باشد.
            </span>
          </div>

          {errorFa && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorFa}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="sensitive-modal-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              مرحله ۱ — ورود مجدد رمز عبور حساب کاربری فعلی:
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="sensitive-modal-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور فعلی را وارد کنید..."
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pr-9 pl-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="sensitive-modal-phrase"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              مرحله ۲ — عبارت تایید زیر را دقیقاً تایپ کنید:{' '}
              <span className="inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-bold text-rose-700 dark:text-rose-300 select-all">
                {requiredPhrase}
              </span>
            </label>
            <input
              id="sensitive-modal-phrase"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={requiredPhrase}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`min-h-[44px] px-5 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tone === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting ? 'در حال بررسی و اجرا...' : confirmButtonLabelFa}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SensitiveActionModal;
