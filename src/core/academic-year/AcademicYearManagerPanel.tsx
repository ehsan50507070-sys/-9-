// Academic Year Management Panel (mounted inside Super Admin Console & School Settings for super_admin & complex_admin)
import React, { useState } from 'react';
import { Archive, ArchiveRestore, CalendarRange, CheckCircle2, Plus, ShieldCheck } from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useToast } from '../ui/ToastContext';
import { useAcademicYear } from './AcademicYearContext';

export const AcademicYearManagerPanel: React.FC = () => {
  const {
    academicYears,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    canManageAcademicYears,
    createAcademicYear,
    activateAcademicYear,
    toggleArchiveAcademicYear,
  } = useAcademicYear();
  const { showToast } = useToast();

  const [label, setLabel] = useState('1405-1406');
  const [startJalali, setStartJalali] = useState('1405/07/01');
  const [endJalali, setEndJalali] = useState('1406/03/31');
  const [setAsActive, setSetAsActive] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFa(null);
    const res = await createAcademicYear({
      label,
      startJalali,
      endJalali,
      setAsActive,
    });
    if (!res.ok) {
      setErrorFa(res.errorFa ?? 'خطا در ایجاد سال تحصیلی');
      return;
    }
    showToast(`سال تحصیلی ${toPersianDigits(res.year?.label ?? label)} با موفقیت ایجاد شد.`, 'success');
    // Suggest next sequential year automatically
    const nextStart = Number((res.year?.label ?? '1405-1406').split('-')[1] || 1406);
    setLabel(`${nextStart}-${nextStart + 1}`);
    setStartJalali(`${nextStart}/07/01`);
    setEndJalali(`${nextStart + 1}/03/31`);
    setSetAsActive(false);
  };

  const handleActivate = async (id: string, yrLabel: string) => {
    const res = await activateAcademicYear(id);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در فعال‌سازی سال تحصیلی', 'error');
      return;
    }
    showToast(`سال تحصیلی ${toPersianDigits(yrLabel)} به عنوان سال فعال پیش‌فرض تنظیم شد.`, 'success');
  };

  const handleToggleArchive = async (id: string, yrLabel: string, archive: boolean) => {
    const res = await toggleArchiveAcademicYear(id, archive);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در تغییر وضعیت آرشیو', 'error');
      return;
    }
    showToast(
      archive
        ? `سال تحصیلی ${toPersianDigits(yrLabel)} با حفظ کامل سوابق آرشیو شد.`
        : `سال تحصیلی ${toPersianDigits(yrLabel)} از حالت آرشیو خارج شد.`,
      'info'
    );
  };

  return (
    <section
      aria-label="مدیریت سال‌های تحصیلی"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              مدیریت سال‌های تحصیلی و آرشیو تاریخی
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تعریف سال تحصیلی جدید، تعیین سال فعال پیش‌فرض و آرشیو سال‌های گذشته بدون حذف هیچ‌یک از سوابق آموزشی
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {toPersianDigits(academicYears.length)} سال ثبت‌شده
        </span>
      </div>

      {/* Years Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">سال تحصیلی</th>
              <th className="py-3 px-4">بازه شمسی</th>
              <th className="py-3 px-4">وضعیت</th>
              <th className="py-3 px-4 text-left">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {academicYears.map((yr) => {
              const isSelected = yr.id === selectedAcademicYearId;
              return (
                <tr
                  key={yr.id}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-slate-50/90 dark:bg-slate-800/40'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    سال تحصیلی {toPersianDigits(yr.label)}
                    {isSelected && (
                      <span className="mr-2 text-xs font-medium text-sky-700 dark:text-sky-400">
                        · نمای فعلی
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {toPersianDigits(yr.startJalali)} تا {toPersianDigits(yr.endJalali)}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    {yr.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        سال فعال پیش‌فرض
                      </span>
                    ) : yr.isArchived ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Archive className="w-3.5 h-3.5" />
                        آرشیو (فقط خواندنی)
                      </span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">آماده و قابل ویرایش</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => setSelectedAcademicYearId(yr.id)}
                          className="min-h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          مشاهده این سال
                        </button>
                      )}
                      {canManageAcademicYears && !yr.isActive && (
                        <button
                          type="button"
                          onClick={() => void handleActivate(yr.id, yr.label)}
                          className="min-h-[34px] px-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          تنظیم به عنوان فعال
                        </button>
                      )}
                      {canManageAcademicYears && !yr.isActive && (
                        <button
                          type="button"
                          onClick={() => void handleToggleArchive(yr.id, yr.label, !yr.isArchived)}
                          className="min-h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                        >
                          {yr.isArchived ? (
                            <>
                              <ArchiveRestore className="w-3.5 h-3.5" />
                              خروج از آرشیو
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5" />
                              آرشیو کردن
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create New Academic Year Form (super_admin & complex_admin ONLY) */}
      {canManageAcademicYears && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3"
        >
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            تعریف سال تحصیلی جدید (مثلاً ۱۴۰۵-۱۴۰۶)
          </div>

          {errorFa && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
            >
              {errorFa}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="ay-label-input"
                className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                عنوان سال تحصیلی
              </label>
              <input
                id="ay-label-input"
                type="text"
                dir="ltr"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="1405-1406"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-right tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="ay-start-input"
                className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                تاریخ شروع (شمسی)
              </label>
              <input
                id="ay-start-input"
                type="text"
                dir="ltr"
                value={startJalali}
                onChange={(e) => setStartJalali(e.target.value)}
                placeholder="1405/07/01"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-right tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="ay-end-input"
                className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                تاریخ پایان (شمسی)
              </label>
              <input
                id="ay-end-input"
                type="text"
                dir="ltr"
                value={endJalali}
                onChange={(e) => setEndJalali(e.target.value)}
                placeholder="1406/03/31"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-right tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsActive}
                onChange={(e) => setSetAsActive(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>بلافاصله به عنوان سال تحصیلی فعال پیش‌فرض انتخاب شود</span>
            </label>

            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-xl brand-btn text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              ایجاد سال تحصیلی
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
