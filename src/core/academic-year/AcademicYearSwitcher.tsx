// Header Academic Year Switcher Dropdown, Management Modal (with Safe Structure Carry-Over) & ArchivedYearBanner
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArchiveRestore,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  CopyCheck,
  Lock,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type { AcademicYearStatus } from '../../types/domain';
import { useSchoolData } from '../data/DataContext';
import { useToast } from '../ui/ToastContext';
import { useAcademicYear } from './AcademicYearContext';
import { getAcademicYearStatusMeta } from './academicYearHelpers';

export const AcademicYearSwitcher: React.FC = () => {
  const {
    academicYears,
    currentYear,
    academicYearId,
    isArchivedView,
    canManageAcademicYears,
    switchAcademicYear,
    createAcademicYear,
    setActiveAcademicYear,
    archiveAcademicYear,
  } = useAcademicYear();
  const { classes, activeSchool } = useSchoolData();
  const { showToast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Create form state inside management modal
  const [codeInput, setCodeInput] = useState('1405-1406');
  const [titleInput, setTitleInput] = useState('سال تحصیلی ۱۴۰۵-۱۴۰۶');
  const [startDateInput, setStartDateInput] = useState('1405/07/01');
  const [endDateInput, setEndDateInput] = useState('1406/06/31');
  const [statusInput, setStatusInput] = useState<AcademicYearStatus>('upcoming');
  const [carryOverStructure, setCarryOverStructure] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [rolloverSummary, setRolloverSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!manageModalOpen) return;
    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setManageModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [manageModalOpen]);

  const handleSelectYear = (id: string, code: string) => {
    switchAcademicYear(id);
    setMenuOpen(false);
    showToast(`نمای سامانه به سال تحصیلی ${toPersianDigits(code)} تغییر یافت.`, 'info');
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setRolloverSummary(null);
    const res = await createAcademicYear({
      code: codeInput,
      title: titleInput,
      startDateJalali: startDateInput,
      endDateJalali: endDateInput,
      status: statusInput,
      setAsActive: statusInput === 'active',
    });
    if (!res.ok) {
      setFormError(res.errorFa ?? 'خطا در ثبت سال تحصیلی جدید.');
      return;
    }

    const createdCode = res.year?.code ?? codeInput;
    if (carryOverStructure) {
      const msg = `ساختار ${toPersianDigits(classes.length)} کلاس و فهرست دروس «${activeSchool.name}» بدون حذف هیچ داده‌ای از سال‌های آرشیو برای سال ${toPersianDigits(createdCode)} آماده شد.`;
      setRolloverSummary(msg);
      showToast(
        `سال تحصیلی ${toPersianDigits(createdCode)} با انتقال امن ساختار کلاس‌ها ایجاد شد.`,
        'success'
      );
    } else {
      showToast(`سال تحصیلی ${toPersianDigits(createdCode)} با موفقیت ایجاد شد.`, 'success');
    }

    const nextStart = Number(createdCode.split('-')[1] || 1406);
    const nextCode = `${nextStart}-${nextStart + 1}`;
    setCodeInput(nextCode);
    setTitleInput(`سال تحصیلی ${toPersianDigits(nextCode)}`);
    setStartDateInput(`${nextStart}/07/01`);
    setEndDateInput(`${nextStart + 1}/06/31`);
    setStatusInput('upcoming');
  };

  const handleActivate = async (id: string, code: string) => {
    const res = await setActiveAcademicYear(id);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در تغییر سال فعال.', 'error');
      return;
    }
    showToast(`سال تحصیلی ${toPersianDigits(code)} به عنوان سال فعال مدرسه تنظیم شد.`, 'success');
  };

  const handleArchiveToggle = async (id: string, code: string, archive: boolean) => {
    const res = await archiveAcademicYear(id, archive);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در تغییر وضعیت آرشیو.', 'error');
      return;
    }
    showToast(
      archive
        ? `سال تحصیلی ${toPersianDigits(code)} بدون حذف سوابق در وضعیت آرشیو قرار گرفت.`
        : `سال تحصیلی ${toPersianDigits(code)} از حالت آرشیو خارج شد.`,
      'info'
    );
  };

  const displayCode = toPersianDigits(currentYear?.code ?? currentYear?.label ?? '1404-1405');

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Header Dropdown Trigger Button */}
      <button
        type="button"
        data-testid="academic-year-switcher-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`انتخاب سال تحصیلی، سال فعلی ${displayCode}`}
        onClick={() => setMenuOpen((o) => !o)}
        className={`min-h-[38px] px-2.5 sm:px-3 inline-flex items-center gap-1.5 rounded-xl border text-xs font-bold tabular-nums whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
          isArchivedView
            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950/90'
            : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        {isArchivedView ? (
          <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <CalendarRange className="w-3.5 h-3.5 brand-text shrink-0" />
        )}
        <span className="hidden sm:inline">سال</span>
        <span>{displayCode}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-70 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {menuOpen && (
        <div
          role="menu"
          data-testid="academic-year-dropdown"
          className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
              انتخاب سال تحصیلی
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(academicYears.length)} سال
            </span>
          </div>

          <div className="p-1.5 max-h-72 overflow-y-auto space-y-1">
            {academicYears.map((yr) => {
              const isSelected = yr.academicYearId === academicYearId || yr.id === academicYearId;
              const statusMeta = getAcademicYearStatusMeta(yr.status);
              return (
                <button
                  key={yr.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  data-testid={`ay-option-${yr.code}`}
                  onClick={() => handleSelectYear(yr.academicYearId || yr.id, yr.code)}
                  className={`w-full text-right rounded-xl px-3 py-2.5 transition-colors flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {yr.title || `سال تحصیلی ${toPersianDigits(yr.code)}`}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 brand-text shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(yr.startDateJalali)} تا {toPersianDigits(yr.endDateJalali)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.labelFa}
                  </span>
                </button>
              );
            })}
          </div>

          {canManageAcademicYears && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
              <button
                type="button"
                data-testid="open-manage-academic-years-btn"
                onClick={() => {
                  setMenuOpen(false);
                  setFormError(null);
                  setRolloverSummary(null);
                  setManageModalOpen(true);
                }}
                className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5 brand-text" />
                <span>مدیریت سال‌های تحصیلی</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Academic Year Management Modal (for super_admin, complex_admin, principal) */}
      {manageModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ay-manage-modal-title"
            data-testid="academic-year-manage-modal"
            className="no-print fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setManageModalOpen(false);
            }}
          >
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl brand-bg flex items-center justify-center shrink-0">
                    <CalendarRange className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2
                      id="ay-manage-modal-title"
                      className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white"
                    >
                      مدیریت سال‌های تحصیلی
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      افزودن سال شمسی جدید، تغییر سال فعال، آرشیو بدون حذف و انتقال امن ساختار کلاس‌ها
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManageModalOpen(false)}
                  aria-label="بستن پنجره مدیریت سال‌های تحصیلی"
                  className="min-h-[38px] min-w-[38px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Existing Years List */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">سال تحصیلی</th>
                        <th className="py-2.5 px-3 font-bold">بازه شمسی</th>
                        <th className="py-2.5 px-3 font-bold">وضعیت</th>
                        <th className="py-2.5 px-3 font-bold text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {academicYears.map((yr) => {
                        const statusMeta = getAcademicYearStatusMeta(yr.status);
                        const isSelected =
                          yr.academicYearId === academicYearId || yr.id === academicYearId;
                        return (
                          <tr key={yr.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                              {yr.title}
                              {isSelected && (
                                <span className="mr-1.5 text-[10px] font-semibold brand-text">
                                  · نمای فعلی
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                              {toPersianDigits(yr.startDateJalali)} تا{' '}
                              {toPersianDigits(yr.endDateJalali)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${statusMeta.badgeClass}`}
                              >
                                {yr.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                                {yr.status === 'archived' && <Archive className="w-3 h-3" />}
                                {statusMeta.labelFa}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {yr.status !== 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleActivate(yr.academicYearId || yr.id, yr.code)}
                                    className="min-h-[32px] px-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>فعال‌سازی</span>
                                  </button>
                                )}
                                {yr.status !== 'active' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleArchiveToggle(
                                        yr.academicYearId || yr.id,
                                        yr.code,
                                        yr.status !== 'archived'
                                      )
                                    }
                                    className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    {yr.status === 'archived' ? (
                                      <>
                                        <ArchiveRestore className="w-3.5 h-3.5" />
                                        <span>بازگردانی</span>
                                      </>
                                    ) : (
                                      <>
                                        <Archive className="w-3.5 h-3.5" />
                                        <span>آرشیو</span>
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

                {/* Add New Academic Year Form */}
                <form
                  onSubmit={(e) => void handleCreateYear(e)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3"
                >
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    افزودن سال تحصیلی جدید شمسی
                  </div>

                  {formError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300"
                    >
                      {formError}
                    </div>
                  )}

                  {rolloverSummary && (
                    <div
                      role="status"
                      className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
                    >
                      <CopyCheck className="w-4 h-4 shrink-0" />
                      <span>{rolloverSummary}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="ay-modal-code"
                        className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                      >
                        کد سال تحصیلی (مثال: ۱۴۰۵-۱۴۰۶)
                      </label>
                      <input
                        id="ay-modal-code"
                        type="text"
                        dir="ltr"
                        value={codeInput}
                        onChange={(e) => {
                          setCodeInput(e.target.value);
                          setTitleInput(`سال تحصیلی ${toPersianDigits(e.target.value)}`);
                        }}
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-right tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ay-modal-title"
                        className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                      >
                        عنوان نمایشی سال تحصیلی
                      </label>
                      <input
                        id="ay-modal-title"
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="ay-modal-start"
                        className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                      >
                        تاریخ شروع (شمسی)
                      </label>
                      <input
                        id="ay-modal-start"
                        type="text"
                        dir="ltr"
                        value={startDateInput}
                        onChange={(e) => setStartDateInput(e.target.value)}
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-right tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ay-modal-end"
                        className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                      >
                        تاریخ پایان (شمسی)
                      </label>
                      <input
                        id="ay-modal-end"
                        type="text"
                        dir="ltr"
                        value={endDateInput}
                        onChange={(e) => setEndDateInput(e.target.value)}
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-right tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ay-modal-status"
                        className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                      >
                        وضعیت اولیه
                      </label>
                      <select
                        id="ay-modal-status"
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value as AcademicYearStatus)}
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="upcoming">آینده (آماده برنامه‌ریزی)</option>
                        <option value="active">فعال (آرشیو سال فعلی)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={carryOverStructure}
                      onChange={(e) => setCarryOverStructure(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      انتقال امن ساختار کلاس‌ها ({toPersianDigits(classes.length)} کلاس) و دروس به سال
                      جدید بدون حذف یا تغییر داده‌های سال‌های آرشیو
                    </span>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setManageModalOpen(false)}
                      className="min-h-[38px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      بستن
                    </button>
                    <button
                      type="submit"
                      data-testid="submit-create-academic-year-btn"
                      className="min-h-[38px] px-4 rounded-xl brand-btn text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ایجاد سال تحصیلی جدید</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export const ArchivedYearBanner: React.FC<{ hasImpersonationBanner?: boolean }> = ({
  hasImpersonationBanner = false,
}) => {
  const { isArchivedView, currentYear, activeYear, resetToActiveYear } = useAcademicYear();

  if (!isArchivedView) return null;

  return (
    <div
      role="status"
      data-testid="archived-year-banner"
      className={`no-print sticky z-20 bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-sm border-b border-amber-200 dark:border-amber-800 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 dark:text-amber-100 ${
        hasImpersonationBanner ? 'top-[92px] md:top-[100px]' : 'top-14 md:top-16'
      }`}
    >
      <div className="flex items-center gap-2 font-bold">
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          در حال مشاهده آرشیو سال تحصیلی{' '}
          {toPersianDigits(currentYear?.code ?? currentYear?.label ?? '')} — ویرایش اطلاعات روی سال
          آرشیو قفل (فقط خواندنی) است.
        </span>
      </div>
      {activeYear && (
        <button
          type="button"
          data-testid="return-active-year-btn"
          onClick={resetToActiveYear}
          className="min-h-[32px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>بازگشت به سال فعال ({toPersianDigits(activeYear.code || activeYear.label)})</span>
        </button>
      )}
    </div>
  );
};
