// Step 3-B: Reusable Emergency System Lock («قفل اضطراری سامانه» / Panic Mode) Control Card
// Placed prominently at the top of SuperAdminPage and inside DataVaultCenterTab (/data-vault)
import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type { PanicModeScope } from '../../types/domain';
import { useSchoolData } from '../data/DataContext';
import { useToast } from '../ui/ToastContext';
import { SensitiveActionModal } from './SensitiveActionModal';

export interface PanicModeControlCardProps {
  /** 'compact' for top of SuperAdminPage; 'full' for DataVaultCenterTab / standalone /data-vault */
  variant?: 'compact' | 'full';
  /** Optional callback to sync inline feedback banner in parent page */
  onStatusChange?: (feedback: { type: 'ok' | 'err'; text: string }) => void;
}

export const PanicModeControlCard: React.FC<PanicModeControlCardProps> = ({
  variant = 'full',
  onStatusChange,
}) => {
  const {
    allSchools,
    activeSchoolId,
    panicModeState,
    activatePanicMode,
    deactivatePanicMode,
  } = useSchoolData();
  const { showToast } = useToast();

  const [scope, setScope] = useState<PanicModeScope>('all_schools');
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>(() =>
    activeSchoolId ? [activeSchoolId] : allSchools[0] ? [allSchools[0].id] : []
  );
  const [reasonFa, setReasonFa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);

  // Keep selectedSchoolIds valid if school list changes
  useEffect(() => {
    setSelectedSchoolIds((prev) => {
      const valid = prev.filter((id) => allSchools.some((s) => s.id === id));
      if (valid.length > 0) return valid;
      if (activeSchoolId && allSchools.some((s) => s.id === activeSchoolId)) {
        return [activeSchoolId];
      }
      return allSchools[0] ? [allSchools[0].id] : [];
    });
  }, [allSchools, activeSchoolId]);

  const toggleSchool = (schoolId: string) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const emitFeedback = (type: 'ok' | 'err', text: string) => {
    onStatusChange?.({ type, text });
    showToast(text, type === 'ok' ? 'warning' : 'error');
  };

  const handleActivate = async () => {
    setSubmitting(true);
    try {
      const res = await activatePanicMode(scope, selectedSchoolIds, reasonFa);
      if (res.ok) {
        setReasonFa('');
        const targetText =
          scope === 'all_schools'
            ? `کل ${toPersianDigits(allSchools.length)} مدرسه به‌طور همزمان`
            : `${toPersianDigits(selectedSchoolIds.length)} مدرسه منتخب`;
        emitFeedback(
          'ok',
          `قفل اضطراری سامانه برای ${targetText} فعال شد. تمامی عملیات ثبت، ویرایش و حذف مسدود گردید.`
        );
      } else {
        emitFeedback('err', res.errorFa ?? 'فعال‌سازی قفل اضطراری سامانه ناموفق بود.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSwitch = () => {
    if (panicModeState.enabled) {
      setUnlockModalOpen(true);
    } else {
      void handleActivate();
    }
  };

  const lockedSchoolNames = allSchools
    .filter((s) => panicModeState.lockedSchoolIds.includes(s.id))
    .map((s) => s.name);

  const isCompact = variant === 'compact';

  return (
    <>
      <section
        aria-label="قفل اضطراری سامانه"
        data-testid={`panic-mode-card-${variant}`}
        dir="rtl"
        className={`rounded-2xl border transition-colors ${
          panicModeState.enabled
            ? 'border-rose-400 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-950/35'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        } ${isCompact ? 'p-4' : 'p-5'} space-y-4 shadow-xs`}
      >
        {/* Top Row: Title + Prominent Toggle Switch + Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                panicModeState.enabled
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400'
              }`}
            >
              {panicModeState.enabled ? (
                <AlertOctagon className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  قفل اضطراری سامانه
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                    panicModeState.enabled
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {panicModeState.enabled ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>قفل فقط‌خواندنی فعال است</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>وضعیت عادی (باز)</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-5">
                در مواقع اضطراری، کل {toPersianDigits(allSchools.length)} مدرسه یا یک مدرسه خاص را
                به‌صورت آنی به حالت فقط‌خواندنی ببرید تا هرگونه ثبت، ویرایش و حذف مسدود شود.
              </p>
            </div>
          </div>

          {/* Unmistakable Master Panic Switch */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={panicModeState.enabled}
              aria-label={
                panicModeState.enabled
                  ? 'غیرفعال‌سازی قفل اضطراری سامانه'
                  : 'فعال‌سازی قفل اضطراری سامانه'
              }
              disabled={submitting}
              onClick={handleToggleSwitch}
              data-testid={`panic-mode-switch-${variant}`}
              className={`min-h-[44px] inline-flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors disabled:opacity-50 ${
                panicModeState.enabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                  : 'border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-200'
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  panicModeState.enabled
                    ? 'bg-white/30'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    panicModeState.enabled ? '-translate-x-4' : '-translate-x-0.5'
                  }`}
                />
              </span>
              <span>
                {panicModeState.enabled ? 'قفل اضطراری: روشن' : 'قفل اضطراری: خاموش'}
              </span>
            </button>
          </div>
        </div>

        {/* Body: Locked Details OR Scope Selector & Activate Action */}
        {panicModeState.enabled ? (
          <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-white/85 dark:bg-slate-900/80 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 text-xs text-rose-950 dark:text-rose-100">
              <div className="font-extrabold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  محدوده قفل‌شده:{' '}
                  {panicModeState.scope === 'all_schools'
                    ? `کل مجتمع (هر ${toPersianDigits(allSchools.length)} مدرسه به‌طور همزمان)`
                    : lockedSchoolNames.length > 0
                      ? lockedSchoolNames.join('، ')
                      : `${toPersianDigits(panicModeState.lockedSchoolIds.length)} مدرسه منتخب`}
                </span>
              </div>
              {panicModeState.reasonFa && (
                <div className="text-slate-700 dark:text-slate-300">
                  <strong>دلیل ثبت‌شده:</strong> {panicModeState.reasonFa}
                </div>
              )}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                فعال‌شده توسط «{panicModeState.activatedByName}» در تاریخ{' '}
                {toPersianDigits(panicModeState.activatedAtJalali)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUnlockModalOpen(true)}
              data-testid={`panic-mode-unlock-btn-${variant}`}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 text-xs font-extrabold transition-colors shrink-0"
            >
              <Unlock className="w-4 h-4" />
              <span>غیرفعال‌سازی قفل اضطراری (رمز + عبارت تأیید)</span>
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 ${
              isCompact ? 'lg:grid-cols-12' : 'lg:grid-cols-3'
            } gap-3.5 items-end pt-1 border-t border-slate-100 dark:border-slate-800`}
          >
            {/* Scope Selector: All 3 Schools vs Specific School(s) */}
            <div className={`space-y-2 ${isCompact ? 'lg:col-span-5' : ''}`}>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                انتخاب محدوده اعمال قفل اضطراری:
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope('all_schools')}
                  className={`flex-1 min-h-[42px] rounded-xl border text-xs font-bold px-3 transition-colors ${
                    scope === 'all_schools'
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  کل {toPersianDigits(allSchools.length)} مدرسه همزمان
                </button>
                <button
                  type="button"
                  onClick={() => setScope('selected_schools')}
                  className={`flex-1 min-h-[42px] rounded-xl border text-xs font-bold px-3 transition-colors ${
                    scope === 'selected_schools'
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  یک مدرسه خاص / منتخب
                </button>
              </div>

              {scope === 'selected_schools' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {allSchools.map((school) => {
                    const checked = selectedSchoolIds.includes(school.id);
                    return (
                      <label
                        key={school.id}
                        className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
                          checked
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSchool(school.id)}
                          className="accent-rose-600 w-3.5 h-3.5"
                        />
                        <span>{school.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Optional Reason Input */}
            <div className={isCompact ? 'lg:col-span-4' : ''}>
              <label
                htmlFor={`panic-reason-input-${variant}`}
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                متن توضیح در نوار هشدار قرمز (اختیاری):
              </label>
              <input
                id={`panic-reason-input-${variant}`}
                type="text"
                value={reasonFa}
                onChange={(e) => setReasonFa(e.target.value)}
                placeholder="مثال: ممیزی امنیتی یا بررسی اضطراری داده‌ها..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Explicit Activate Button */}
            <div className={isCompact ? 'lg:col-span-3' : ''}>
              <button
                type="button"
                disabled={submitting || (scope === 'selected_schools' && selectedSchoolIds.length === 0)}
                onClick={() => void handleActivate()}
                data-testid={`panic-mode-activate-btn-${variant}`}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 text-xs font-extrabold transition-colors disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {submitting ? 'در حال فعال‌سازی...' : 'فعال‌سازی قفل اضطراری'}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Two-Step Verification Modal for Deactivating Panic Mode (Super Admin Password + Persian Phrase) */}
      <SensitiveActionModal
        open={unlockModalOpen}
        titleFa="غیرفعال‌سازی قفل اضطراری سامانه (تأیید دومرحله‌ای)"
        descriptionFa="برای خروج از حالت فقط‌خواندنی و بازگشایی عملیات ثبت، ویرایش و حذف، وارد کردن مجدد رمز عبور راهبر ارشد و تایپ دقیق عبارت تأیید فارسی الزامی است."
        requiredPhrase="تایید بازگشایی"
        confirmButtonLabelFa="تأیید و غیرفعال‌سازی قفل"
        tone="warning"
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={async (pw, phrase) => {
          const res = await deactivatePanicMode(pw, phrase);
          if (res.ok) {
            onStatusChange?.({
              type: 'ok',
              text: 'قفل اضطراری سامانه با موفقیت غیرفعال شد و دسترسی نوشتن و ویرایش به حالت عادی بازگشت.',
            });
            showToast('قفل اضطراری سامانه با موفقیت غیرفعال شد.', 'success');
          }
          return res;
        }}
      />
    </>
  );
};

export default PanicModeControlCard;
