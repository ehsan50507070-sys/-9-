// Add-on 1: Smart Student Attendance («حضور و غیاب زنگ‌به‌زنگ دانش‌آموزان»)
import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileCheck2,
  Lock,
  MessageSquareText,
  Search,
  XCircle,
} from 'lucide-react';
import { useAcademicYear } from '../../core/academic-year/AcademicYearContext';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { sanitizeText } from '../../core/security/sanitize';
import { useToast } from '../../core/ui/ToastContext';
import { buildUtf8BomCsv, downloadTextFile } from '../../lib/csv';
import { formatPersianPercent, toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, formatJalaliDisplay } from '../../lib/jalali';
import type { AttendanceStatus, PeriodNumber } from '../../types/domain';

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    activeRadioClass: string;
    idleRadioClass: string;
    badgeClass: string;
    textClass: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  present: {
    label: 'حاضر',
    icon: CheckCircle2,
    activeRadioClass:
      'bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-600 dark:border-emerald-500',
    idleRadioClass:
      'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-300',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
  absent: {
    label: 'غایب',
    icon: XCircle,
    activeRadioClass:
      'bg-rose-600 text-white border-rose-600 shadow-xs dark:bg-rose-600 dark:border-rose-500',
    idleRadioClass:
      'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-300',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80',
    textClass: 'text-rose-700 dark:text-rose-400',
  },
  late: {
    label: 'تأخیر',
    icon: Clock,
    activeRadioClass:
      'bg-amber-500 text-slate-950 border-amber-500 shadow-xs dark:bg-amber-500 dark:border-amber-400',
    idleRadioClass:
      'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:text-amber-700 dark:hover:text-amber-300',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  excused: {
    label: 'غیبت موجه',
    icon: FileCheck2,
    activeRadioClass:
      'bg-sky-600 text-white border-sky-600 shadow-xs dark:bg-sky-600 dark:border-sky-500',
    idleRadioClass:
      'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-300 hover:text-sky-700 dark:hover:text-sky-300',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80',
    textClass: 'text-sky-700 dark:text-sky-400',
  },
};

export const StudentAttendancePage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    linkedStudent,
    linkedTeacher,
    defaultWorkdayJalali,
    classes,
    students,
    studentAttendance,
    upsertStudentAttendance,
    searchFocusTarget,
    clearSearchFocusTarget,
  } = useSchoolData();
  const { isViewingArchivedYear } = useAcademicYear();
  const { showToast } = useToast();

  const canEdit = roleDef.canEditStudentAttendance && !isViewingArchivedYear;

  // DataContext already strictly scopes `classes` to assignedClassIds for teachers and child's class for parents.
  const visibleClasses = classes;

  const [selectedDate, setSelectedDate] = useState<string>(defaultWorkdayJalali);
  const [selectedClassId, setSelectedClassId] = useState<string>(visibleClasses[0]?.id ?? '');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodNumber>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingNoteStudentId, setEditingNoteStudentId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  // Deep-link from Smart Fuzzy Search: auto-select exact class and pre-filter student
  useEffect(() => {
    if (!searchFocusTarget || searchFocusTarget.schoolId !== activeSchoolId) return;
    if (visibleClasses.some((c) => c.id === searchFocusTarget.classId)) {
      setSelectedClassId(searchFocusTarget.classId);
    }
    setSearchTerm(searchFocusTarget.studentName ?? '');
    clearSearchFocusTarget();
  }, [searchFocusTarget, activeSchoolId, visibleClasses, clearSearchFocusTarget]);

  const effectiveClassId = visibleClasses.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : (visibleClasses[0]?.id ?? '');

  const currentClass = visibleClasses.find((c) => c.id === effectiveClassId);

  const classStudents = useMemo(() => {
    let list = students.filter((s) => s.classId === effectiveClassId && s.active);
    if (searchTerm.trim()) {
      const q = searchTerm.trim();
      const qAscii = toAsciiDigits(q);
      list = list.filter(
        (s) =>
          s.fullName.includes(q) ||
          s.parentName.includes(q) ||
          s.studentCode.includes(qAscii) ||
          s.nationalId.includes(qAscii)
      );
    }
    return list;
  }, [students, effectiveClassId, searchTerm]);

  const recordMap = useMemo(() => {
    const map = new Map<string, (typeof studentAttendance)[number]>();
    for (const rec of studentAttendance) {
      if (
        rec.jalaliDate === selectedDate &&
        rec.classId === effectiveClassId &&
        rec.period === selectedPeriod
      ) {
        map.set(rec.studentId, rec);
      }
    }
    return map;
  }, [studentAttendance, selectedDate, effectiveClassId, selectedPeriod]);

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    for (const st of classStudents) {
      const status = recordMap.get(st.id)?.status ?? 'present';
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else excused++;
    }
    const total = classStudents.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    return { total, present, absent, late, excused, rate };
  }, [classStudents, recordMap]);

  // Dedicated strictly READ-ONLY Parent View («گزارش حضور و غیاب فرزند من»)
  // Zero toggle buttons, zero edit controls, zero other students, zero class rosters!
  if (activeRole === 'parent') {
    const child = linkedStudent;
    const childClass = classes[0];
    const dayRecordsByPeriod = new Map<PeriodNumber, (typeof studentAttendance)[number]>();
    for (const rec of studentAttendance) {
      if (rec.jalaliDate === selectedDate) {
        dayRecordsByPeriod.set(rec.period, rec);
      }
    }

    const historyRecords = [...studentAttendance].sort((a, b) => {
      if (a.jalaliDate !== b.jalaliDate) return b.jalaliDate.localeCompare(a.jalaliDate);
      return a.period - b.period;
    });

    const absentCount = historyRecords.filter((r) => r.status === 'absent').length;
    const lateCount = historyRecords.filter((r) => r.status === 'late').length;
    const excusedCount = historyRecords.filter((r) => r.status === 'excused').length;

    return (
      <PrintShell
        school={activeSchool}
        documentTitle={`گزارش حضور و غیاب دانش‌آموز — ${child?.fullName ?? ''}`}
        subtitle={`کلاس: ${childClass?.name ?? '—'} | تاریخ انتخابی: ${formatJalaliDisplay(selectedDate, true)}`}
        landscape={false}
      >
        <div className="space-y-6">
          <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <Lock className="w-3.5 h-3.5" />
                <span>فقط‌خواندنی · دسترسی اختصاصی ولی</span>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                گزارش حضور و غیاب فرزند من
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                وضعیت حضور زنگ‌به‌زنگ {child?.fullName ?? 'فرزند شما'} در {activeSchool.name} (ثبت و
                ویرایش تنها توسط معلم و دفتر مدرسه انجام می‌شود).
              </p>
            </div>
            <PrintIconButton documentLabel="گزارش حضور و غیاب فرزند" />
          </div>

          {!child ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-600 dark:text-slate-300">
              دانش‌آموزی برای این حساب کاربری ثبت نشده است.
            </div>
          ) : (
            <>
              {/* Child Profile + Date Stepper */}
              <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {child.fullName}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>کلاس: {childClass?.name ?? '—'}</span>
                    <span aria-hidden="true">·</span>
                    <span>کد ملی: {toPersianDigits(child.nationalId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>کد دانش‌آموزی: {toPersianDigits(child.studentCode)}</span>
                    <span aria-hidden="true">·</span>
                    <span>ولی: {child.parentName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => addDaysToJalali(d, -1))}
                    aria-label="روز قبل"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="min-h-[44px] min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 flex items-center justify-center text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    {formatJalaliDisplay(selectedDate, true)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => addDaysToJalali(d, 1))}
                    aria-label="روز بعد"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Non-Interactive 4-Period Daily Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {([1, 2, 3, 4] as PeriodNumber[]).map((period) => {
                  const rec = dayRecordsByPeriod.get(period);
                  const status: AttendanceStatus = rec?.status ?? 'present';
                  const meta = STATUS_META[status];
                  return (
                    <div
                      key={period}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          زنگ {toPersianDigits(period)}
                        </span>
                        <span
                          data-readonly-status={status}
                          className={`inline-flex items-center px-3 py-1 rounded-xl border text-xs font-bold select-none ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[18px]">
                        {rec?.note ? `یادداشت مدرسه: ${rec.note}` : 'بدون یادداشت ویژه'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Summary & Recorded History Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    سوابق ثبت‌شده حضور و غیاب
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums">
                    <span className="text-rose-700 dark:text-rose-400">
                      غیبت: {toPersianDigits(absentCount)}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">
                      تاخیر: {toPersianDigits(lateCount)}
                    </span>
                    <span className="text-sky-700 dark:text-sky-400">
                      موجه: {toPersianDigits(excusedCount)}
                    </span>
                  </div>
                </div>

                {historyRecords.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    هیچ مورد غیبت، تاخیر یا یادداشت خاصی برای فرزند شما ثبت نشده است (حضور کامل).
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 px-4">تاریخ شمسی</th>
                          <th className="py-2.5 px-4">زنگ درسی</th>
                          <th className="py-2.5 px-4">وضعیت</th>
                          <th className="py-2.5 px-4">توضیحات مدرسه</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                        {historyRecords.map((rec) => {
                          const meta = STATUS_META[rec.status];
                          return (
                            <tr key={rec.id}>
                              <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                {formatJalaliDisplay(rec.jalaliDate, true)}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                زنگ {toPersianDigits(rec.period)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${meta.badgeClass}`}
                                >
                                  {meta.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                {rec.note ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PrintShell>
    );
  }

  const setSpecificStatus = (studentId: string, status: AttendanceStatus) => {
    if (!canEdit) return;
    const existing = recordMap.get(studentId);
    const res = upsertStudentAttendance({
      id: `${activeSchoolId}:${selectedDate}:${effectiveClassId}:${selectedPeriod}:${studentId}`,
      schoolId: activeSchoolId,
      jalaliDate: selectedDate,
      classId: effectiveClassId,
      period: selectedPeriod,
      studentId,
      status,
      note: existing?.note,
      recordedBy: activeRole,
      updatedAt: new Date().toISOString(),
    });
    if (!res.ok && res.errorFa) {
      showToast(res.errorFa, 'warning');
    }
  };

  const saveNote = (studentId: string) => {
    if (!canEdit) return;
    const existing = recordMap.get(studentId);
    const cleanedNote = sanitizeText(noteDraft, 300);
    const res = upsertStudentAttendance({
      id: `${activeSchoolId}:${selectedDate}:${effectiveClassId}:${selectedPeriod}:${studentId}`,
      schoolId: activeSchoolId,
      jalaliDate: selectedDate,
      classId: effectiveClassId,
      period: selectedPeriod,
      studentId,
      status: existing?.status ?? 'present',
      note: cleanedNote || undefined,
      recordedBy: activeRole,
      updatedAt: new Date().toISOString(),
    });
    if (!res.ok && res.errorFa) {
      showToast(res.errorFa, 'warning');
      return;
    }
    setEditingNoteStudentId(null);
    setNoteDraft('');
    showToast('یادداشت دانش‌آموز ذخیره شد.');
  };

  const markAllPresent = () => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    let blockedError: string | undefined;
    for (const st of classStudents) {
      const res = upsertStudentAttendance({
        id: `${activeSchoolId}:${selectedDate}:${effectiveClassId}:${selectedPeriod}:${st.id}`,
        schoolId: activeSchoolId,
        jalaliDate: selectedDate,
        classId: effectiveClassId,
        period: selectedPeriod,
        studentId: st.id,
        status: 'present',
        recordedBy: activeRole,
        updatedAt: now,
      });
      if (!res.ok && res.errorFa) {
        blockedError = res.errorFa;
        break;
      }
    }
    if (blockedError) {
      showToast(blockedError, 'warning');
      return;
    }
    showToast(`وضعیت تمامی ${toPersianDigits(classStudents.length)} دانش‌آموز روی «حاضر» ثبت شد.`);
  };

  const handleExportCsv = () => {
    const headers = ['ردیف', 'کد دانش‌آموز', 'نام و نام خانوادگی', 'کلاس', 'تاریخ', 'زنگ', 'وضعیت', 'نام ولی', 'موبایل ولی', 'یادداشت'];
    const rows = classStudents.map((s, idx) => {
      const rec = recordMap.get(s.id);
      const st = rec?.status ?? 'present';
      return [
        idx + 1,
        s.studentCode,
        s.fullName,
        currentClass?.name ?? '',
        selectedDate,
        `زنگ ${selectedPeriod}`,
        STATUS_META[st].label,
        s.parentName,
        s.parentMobile,
        rec?.note ?? '',
      ];
    });
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(
      `attendance-${activeSchoolId}-${selectedDate.replace(/\//g, '-')}-p${selectedPeriod}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    showToast('فایل اکسل فارسی (CSV با UTF-8 BOM) دریافت شد.');
  };

  return (
    <PrintShell
      school={activeSchool}
      documentTitle={`فهرست حضور و غیاب کلاسی — ${currentClass?.name ?? ''}`}
      subtitle={`تاریخ: ${formatJalaliDisplay(selectedDate, true)} | زنگ ${toPersianDigits(selectedPeriod)}`}
      landscape={false}
    >
      <div className="space-y-6">
        {/* Page Header & Actions */}
        <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              حضور و غیاب زنگ‌به‌زنگ دانش‌آموزان
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {activeRole === 'teacher' && linkedTeacher
                ? `دسترسی ویژه معلم (${linkedTeacher.fullName}): ثبت تک‌کلیکی وضعیت هر دانش‌آموز در ${toPersianDigits(visibleClasses.length)} کلاس تخصیص‌یافته شما.`
                : 'وضعیت هر دانش‌آموز را با یک کلیک مستقیم از میان گزینه‌های حاضر، غایب، تأخیر یا غیبت موجه انتخاب کنید.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={markAllPresent}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 transition-colors whitespace-nowrap shadow-xs"
              >
                <CheckCheck className="w-4 h-4 shrink-0" />
                ثبت همه به‌عنوان حاضر
              </button>
            )}
            <PrintIconButton documentLabel="لیست حضور و غیاب کلاس" />
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              اکسل (CSV)
            </button>
          </div>
        </div>

        {/* Control Toolbar */}
        <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Class Selector */}
            <div>
              <label
                htmlFor="att-class-select"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
              >
                انتخاب کلاس
              </label>
              <select
                id="att-class-select"
                value={effectiveClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {visibleClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (اتاق {toPersianDigits(cls.roomCode)})
                  </option>
                ))}
              </select>
            </div>

            {/* Jalali Date Stepper */}
            <div>
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                تاریخ شمسی
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => addDaysToJalali(d, -1))}
                  aria-label="روز قبل"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 flex items-center justify-center text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatJalaliDisplay(selectedDate, true)}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => addDaysToJalali(d, 1))}
                  aria-label="روز بعد"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Period Segmented Selector */}
            <div>
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                انتخاب زنگ درسی
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                {([1, 2, 3, 4] as PeriodNumber[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPeriod(p)}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedPeriod === p
                        ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    زنگ {toPersianDigits(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search & Bulk Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام دانش‌آموز یا ولی..."
                aria-label="جستجوی دانش‌آموز"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pr-10 pl-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm tabular-nums">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                حاضر: {toPersianDigits(summary.present)}
              </span>
              <span className="text-rose-700 dark:text-rose-400 font-semibold">
                غایب: {toPersianDigits(summary.absent)}
              </span>
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                تاخیر: {toPersianDigits(summary.late)}
              </span>
              <span className="text-sky-700 dark:text-sky-400 font-semibold">
                موجه: {toPersianDigits(summary.excused)}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                نرخ حضور: {formatPersianPercent(summary.rate)}
              </span>

              {isViewingArchivedYear && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Lock className="w-3.5 h-3.5" />
                  سال آرشیو (فقط‌خواندنی)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Student List (Screen View) */}
        <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          {classStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              دانش‌آموزی با این مشخصات یافت نشد.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {classStudents.map((student, index) => {
                const record = recordMap.get(student.id);
                const status: AttendanceStatus = record?.status ?? 'present';
                const isEditingNote = editingNoteStudentId === student.id;

                return (
                  <li
                    key={student.id}
                    className="p-4 flex flex-col gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                          {toPersianDigits(index + 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                            {student.fullName}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            <span>کد ملی: {toPersianDigits(student.nationalId)}</span>
                            <span aria-hidden="true">·</span>
                            <span>کد: {toPersianDigits(student.studentCode)}</span>
                            <span aria-hidden="true">·</span>
                            <span>ولی: {student.parentName}</span>
                            <span aria-hidden="true">·</span>
                            <span dir="ltr">{toPersianDigits(student.parentMobile)}</span>
                          </div>
                          {record?.note && !isEditingNote && (
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              یادداشت: {record.note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Direct 4-Way Color-Coded Segmented Radio Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div
                          role="radiogroup"
                          aria-label={`وضعیت حضور ${student.fullName}`}
                          className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1 sm:flex-initial"
                        >
                          {ATTENDANCE_OPTIONS.map((opt) => {
                            const optMeta = STATUS_META[opt];
                            const OptIcon = optMeta.icon;
                            const isChecked = status === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                role="radio"
                                aria-checked={isChecked}
                                disabled={!canEdit}
                                onClick={() => setSpecificStatus(student.id, opt)}
                                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-75 disabled:cursor-default ${
                                  isChecked ? optMeta.activeRadioClass : optMeta.idleRadioClass
                                }`}
                              >
                                <OptIcon className="w-3.5 h-3.5 shrink-0" />
                                <span>{optMeta.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingNote) {
                                setEditingNoteStudentId(null);
                              } else {
                                setEditingNoteStudentId(student.id);
                                setNoteDraft(record?.note ?? '');
                              }
                            }}
                            aria-label={`افزودن یادداشت برای ${student.fullName}`}
                            title="یادداشت دانش‌آموز"
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <MessageSquareText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditingNote && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="علت غیبت، تاخیر یا یادداشت پیگیری..."
                          className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveNote(student.id)}
                            className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium"
                          >
                            ذخیره یادداشت
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteStudentId(null)}
                            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300"
                          >
                            انصراف
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Precision A4 Portrait Print Roster (visible strictly in @media print) */}
        <div className="print-only">
          <table>
            <thead>
              <tr>
                <th style={{ width: '6%' }}>ردیف</th>
                <th style={{ width: '28%' }}>نام و نام خانوادگی</th>
                <th style={{ width: '16%' }}>نام ولی و تماس</th>
                <th style={{ width: '8%' }}>زنگ ۱</th>
                <th style={{ width: '8%' }}>زنگ ۲</th>
                <th style={{ width: '8%' }}>زنگ ۳</th>
                <th style={{ width: '8%' }}>زنگ ۴</th>
                <th style={{ width: '18%' }}>وضعیت و ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((st, idx) => {
                const rec = recordMap.get(st.id);
                const status = rec?.status ?? 'present';
                return (
                  <tr key={st.id}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="font-semibold">{st.fullName}</td>
                    <td className="text-[10px]">
                      {st.parentName} ({toPersianDigits(st.parentMobile)})
                    </td>
                    <td className="text-center">
                      <span className="print-checkbox" />
                    </td>
                    <td className="text-center">
                      <span className="print-checkbox" />
                    </td>
                    <td className="text-center">
                      <span className="print-checkbox" />
                    </td>
                    <td className="text-center">
                      <span className="print-checkbox" />
                    </td>
                    <td className="text-[10px]">
                      {STATUS_META[status].label}
                      {rec?.note ? ` — ${rec.note}` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PrintShell>
  );
};
