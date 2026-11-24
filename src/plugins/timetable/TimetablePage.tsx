// Add-on 5: School Timetable Manager («برنامه هفتگی مدرسه») with real-time conflict detection & A4 Landscape print
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  Edit3,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, PERSIAN_WEEKDAY_NAMES } from '../../lib/jalali';
import { copyTextToClipboard, formatSingleColumnMessengerReport } from '../../lib/messenger';
import type { PeriodNumber, PersianWeekdayIndex, ScheduleSlot } from '../../types/domain';
import { countTeacherWeeklyPeriods, detectScheduleConflict } from './timetableHelpers';

type ViewMode = 'class' | 'teacher';

const COMMON_SUBJECTS = [
  'فارسی و نگارش',
  'ریاضی',
  'علوم تجربی',
  'قرآن و هدیه‌ها',
  'مطالعات اجتماعی',
  'تربیت بدنی و هنر',
  'کار و فناوری',
];

interface EditorState {
  existingSlotId?: string;
  weekday: PersianWeekdayIndex;
  period: PeriodNumber;
  classId: string;
  teacherId: string;
  subjectName: string;
}

export const TimetablePage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    defaultWorkdayJalali,
    classes,
    teachers,
    teacherNameById,
    schedules,
    linkedStudent,
    linkedTeacher,
    upsertScheduleSlot,
    deleteScheduleSlot,
  } = useSchoolData();
  const { showToast } = useToast();

  const isParent = activeRole === 'parent';
  const isStudent = activeRole === 'student';
  const isLearnerReadOnly = isParent || isStudent;
  const isTeacher = activeRole === 'teacher';
  const canEdit = roleDef.canEditTimetable;

  const [viewMode, setViewMode] = useState<ViewMode>(isTeacher ? 'teacher' : 'class');
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    linkedTeacher?.id ?? teachers[0]?.id ?? ''
  );
  const [editor, setEditor] = useState<EditorState | null>(null);

  const effectiveClassId = classes.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : classes[0]?.id ?? '';
  const effectiveTeacherId = teachers.some((t) => t.id === selectedTeacherId)
    ? selectedTeacherId
    : teachers[0]?.id ?? '';

  const workdays = activeSchool.activeWorkdays;
  const periods: PeriodNumber[] = [1, 2, 3, 4];

  const selectedClass = classes.find((c) => c.id === effectiveClassId);
  const selectedTeacher = teachers.find((t) => t.id === effectiveTeacherId);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // Grid lookup map: `${weekday}:${period}` -> ScheduleSlot
  const slotGridMap = useMemo(() => {
    const map = new Map<string, ScheduleSlot>();
    for (const s of schedules) {
      if (viewMode === 'class' && s.classId === effectiveClassId) {
        map.set(`${s.weekday}:${s.period}`, s);
      } else if (viewMode === 'teacher' && s.teacherId === effectiveTeacherId) {
        map.set(`${s.weekday}:${s.period}`, s);
      }
    }
    return map;
  }, [schedules, viewMode, effectiveClassId, effectiveTeacherId]);

  // Real-time conflict check while modal is open
  const liveConflict = useMemo(() => {
    if (!editor || !editor.classId || !editor.teacherId) return { hasConflict: false };
    return detectScheduleConflict({
      candidate: {
        id: editor.existingSlotId,
        schoolId: activeSchoolId,
        weekday: editor.weekday,
        period: editor.period,
        classId: editor.classId,
        teacherId: editor.teacherId,
      },
      existingSchedules: schedules,
      classes,
      teachers,
    });
  }, [editor, activeSchoolId, schedules, classes, teachers]);

  const openSlotEditor = (weekday: PersianWeekdayIndex, period: PeriodNumber, slot?: ScheduleSlot) => {
    if (!canEdit) return;
    setEditor({
      existingSlotId: slot?.id,
      weekday,
      period,
      classId: slot?.classId ?? (viewMode === 'class' ? effectiveClassId : classes[0]?.id ?? ''),
      teacherId:
        slot?.teacherId ??
        (viewMode === 'teacher'
          ? effectiveTeacherId
          : selectedClass?.homeroomTeacherId ?? teachers[0]?.id ?? ''),
      subjectName: slot?.subjectName ?? COMMON_SUBJECTS[0],
    });
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !canEdit) return;
    if (!editor.classId || !editor.teacherId || !editor.subjectName.trim()) {
      showToast('انتخاب کلاس، معلم و نام درس الزامی است.', 'error');
      return;
    }
    if (liveConflict.hasConflict) {
      showToast(liveConflict.messageFa ?? 'تداخل زمانی شناسایی شد.', 'error');
      return;
    }

    const slotId =
      editor.existingSlotId ??
      `${activeSchoolId}:sched:${editor.weekday}:${editor.period}:${editor.classId}`;
    const res = upsertScheduleSlot({
      id: slotId,
      schoolId: activeSchoolId,
      weekday: editor.weekday,
      period: editor.period,
      classId: editor.classId,
      teacherId: editor.teacherId,
      subjectName: editor.subjectName.trim(),
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ذخیره زنگ هفتگی.', 'error');
      return;
    }
    showToast('برنامه هفتگی با موفقیت ذخیره و با ماژول جایگزینی همگام‌سازی شد.');
    setEditor(null);
  };

  const handleDeleteSlot = (slotId: string) => {
    const res = deleteScheduleSlot(slotId);
    if (!res.ok) {
      showToast(res.errorFa ?? 'عدم دسترسی جهت حذف زنگ.', 'error');
      return;
    }
    showToast('زنگ انتخاب‌شده از برنامه هفتگی حذف شد.', 'info');
    setEditor(null);
  };

  const handleCopyMessenger = async () => {
    const title =
      viewMode === 'class'
        ? `برنامه هفتگی ${selectedClass?.name ?? ''}`
        : `برنامه هفتگی ${selectedTeacher?.fullName ?? ''}`;

    const sections = workdays.map((wd) => {
      const lines = periods.map((p) => {
        const slot = slotGridMap.get(`${wd}:${p}`);
        if (!slot) return `زنگ ${toPersianDigits(p)}: آزاد / تعیین‌نشده`;
        const partner =
          viewMode === 'class'
            ? teacherNameById[slot.teacherId] ?? 'معلم'
            : classMap.get(slot.classId)?.name ?? slot.classId;
        return `زنگ ${toPersianDigits(p)}: ${slot.subjectName} (${partner})`;
      });
      return {
        heading: PERSIAN_WEEKDAY_NAMES[wd],
        lines,
      };
    });

    const text = formatSingleColumnMessengerReport({
      schoolName: activeSchool.name,
      reportTitle: title,
      jalaliDateDisplay: formatJalaliDisplay(defaultWorkdayJalali, false),
      sections,
      footerNote: `مدت هر زنگ: ${toPersianDigits(activeSchool.periodDurationMinutes)} دقیقه`,
    });

    const ok = await copyTextToClipboard(text);
    showToast(
      ok
        ? 'برنامه هفتگی تک‌ستونه (ایتا / بله / شاد) کپی شد.'
        : 'امکان کپی خودکار وجود نداشت.',
      ok ? 'success' : 'error'
    );
  };

  const printTitle =
    viewMode === 'class'
      ? `برنامه هفتگی کلاس ${selectedClass?.name ?? ''}`
      : `برنامه هفتگی تدریس — ${selectedTeacher?.fullName ?? ''}`;

  const totalWeeklySlots = slotGridMap.size;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            برنامه هفتگی مدرسه و تداخل‌یاب هوشمند
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isLearnerReadOnly && linkedStudent
              ? `برنامه هفتگی کلاس ${isStudent ? 'شما' : 'فرزند شما'} (${linkedStudent.fullName}) — حالت مشاهده و چاپ A4 / A5`
              : `مدیریت برنامه ۴ زنگه ${activeSchool.name} با تشخیص آنی تداخل معلم و همگام‌سازی زنده با جایگزینی.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyMessenger()}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <Copy className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            کپی برای ایتا / بله / شاد
          </button>
          <PrintButtons landscape documentLabel="برنامه هفتگی" />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isLearnerReadOnly && (
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setViewMode('class')}
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  viewMode === 'class'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                نمای کلاسی
              </button>
              <button
                type="button"
                onClick={() => setViewMode('teacher')}
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  viewMode === 'teacher'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                نمای معلمان
              </button>
            </div>
          )}

          {viewMode === 'class' ? (
            <select
              aria-label="انتخاب کلاس"
              value={effectiveClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={isLearnerReadOnly}
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (اتاق {toPersianDigits(c.roomCode)})
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="انتخاب معلم"
              value={effectiveTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isTeacher}
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} — {t.specialty} (
                  {toPersianDigits(countTeacherWeeklyPeriods(schedules, activeSchoolId, t.id))} زنگ)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {toPersianDigits(totalWeeklySlots)} زنگ برنامه‌ریزی‌شده
          </span>
          {canEdit ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              برای ویرایش یا افزودن روی هر خانه کلیک کنید
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              فقط‌خواندنی
            </span>
          )}
        </div>
      </div>

      {/* Printable Landscape A4 Weekly Timetable Grid */}
      <PrintShell
        school={activeSchool}
        documentTitle={printTitle}
        subtitle={`مدت هر زنگ: ${toPersianDigits(activeSchool.periodDurationMinutes)} دقیقه · ${toPersianDigits(workdays.length)} روز کاری`}
        landscape
      >
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-3.5 px-4 w-32">روز هفته</th>
                  {periods.map((p) => (
                    <th key={p} className="py-3.5 px-4 text-center tabular-nums">
                      <div>زنگ {toPersianDigits(p)}</div>
                      <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                        {toPersianDigits(activeSchool.periodDurationMinutes)} دقیقه
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {workdays.map((wd) => (
                  <tr key={wd} className="align-top">
                    <td className="py-4 px-4 font-bold text-sm text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30 whitespace-nowrap">
                      {PERSIAN_WEEKDAY_NAMES[wd]}
                    </td>
                    {periods.map((p) => {
                      const slot = slotGridMap.get(`${wd}:${p}`);
                      const partnerLabel = slot
                        ? viewMode === 'class'
                          ? teacherNameById[slot.teacherId] ?? 'تعیین‌نشده'
                          : classMap.get(slot.classId)?.name ?? slot.classId
                        : '';

                      return (
                        <td key={p} className="p-2.5 min-w-[165px]">
                          {slot ? (
                            <div
                              onClick={() => canEdit && openSlotEditor(wd, p, slot)}
                              role={canEdit ? 'button' : undefined}
                              tabIndex={canEdit ? 0 : undefined}
                              onKeyDown={(e) => {
                                if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                                  e.preventDefault();
                                  openSlotEditor(wd, p, slot);
                                }
                              }}
                              className={`rounded-xl border p-3 transition-colors ${
                                canEdit
                                  ? 'cursor-pointer border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/30 hover:border-indigo-400 dark:hover:border-indigo-600'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-5">
                                  {slot.subjectName}
                                </div>
                                {canEdit && (
                                  <Edit3 className="no-print w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                )}
                              </div>
                              <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                                {partnerLabel}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full min-h-[68px] flex items-center justify-center">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => openSlotEditor(wd, p)}
                                  className="no-print w-full min-h-[68px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-xs font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  تخصیص زنگ
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PrintShell>

      {/* Slot Editor Modal with Live Real-Time Conflict Detection */}
      {editor && canEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="timetable-editor-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <form
            onSubmit={handleSaveSlot}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2
                  id="timetable-editor-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  {editor.existingSlotId ? 'ویرایش زنگ هفتگی' : 'تخصیص زنگ جدید'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {PERSIAN_WEEKDAY_NAMES[editor.weekday]} · زنگ {toPersianDigits(editor.period)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  کلاس
                </label>
                <select
                  value={editor.classId}
                  onChange={(e) => setEditor({ ...editor, classId: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  معلم / دبیر
                </label>
                <select
                  value={editor.teacherId}
                  onChange={(e) => setEditor({ ...editor, teacherId: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                عنوان درس
              </label>
              <input
                type="text"
                value={editor.subjectName}
                onChange={(e) => setEditor({ ...editor, subjectName: e.target.value })}
                list="common-subjects-list"
                placeholder="مثال: ریاضی"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
              <datalist id="common-subjects-list">
                {COMMON_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj} />
                ))}
              </datalist>
            </div>

            {/* Real-time Conflict Warning Banner */}
            {liveConflict.hasConflict ? (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 flex items-start gap-2.5 text-xs leading-5 text-rose-800 dark:text-rose-200"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <div className="font-bold">هشدار تداخل زمانی (مسدودسازی خودکار)</div>
                  <p className="mt-0.5">{liveConflict.messageFa}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/70 p-3 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                <Check className="w-4 h-4 shrink-0" />
                <span>بدون تداخل زمانی — این زنگ آماده ثبت و همگام‌سازی است.</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              {editor.existingSlotId ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSlot(editor.existingSlotId!)}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3.5 text-xs font-semibold"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف زنگ
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={liveConflict.hasConflict}
                  className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  ذخیره در برنامه
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
