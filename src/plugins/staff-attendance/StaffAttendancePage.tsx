// Add-on 2: 4-Period Staff Attendance («حضور و غیاب ۴ زنگه کادر و معلمان»)
import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Lock,
  UserPlus,
  Clock,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useRouter } from '../../core/router/RouterContext';
import { useToast } from '../../core/ui/ToastContext';
import { buildUtf8BomCsv, downloadTextFile } from '../../lib/csv';
import { formatPersianHours, toPersianDigits } from '../../lib/digits';
import {
  addDaysToJalali,
  formatJalaliDisplay,
  getWorkdayDatesForWeeks,
  PERSIAN_WEEKDAY_NAMES,
} from '../../lib/jalali';
import { copyTextToClipboard, formatSingleColumnMessengerReport } from '../../lib/messenger';
import type { PeriodNumber, StaffAttendanceStatus } from '../../types/domain';

const STAFF_CYCLE: StaffAttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const STAFF_STATUS_META: Record<
  StaffAttendanceStatus,
  { label: string; short: string; cellClass: string }
> = {
  present: {
    label: 'حاضر',
    short: 'ح',
    cellClass:
      'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  absent: {
    label: 'غایب',
    short: 'غ',
    cellClass:
      'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
  late: {
    label: 'تاخیر',
    short: 'ت',
    cellClass:
      'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  excused: {
    label: 'مرخصی موجه',
    short: 'م',
    cellClass:
      'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  },
};

type WeekSpanOption = 1 | 4 | 8 | 12;

export const StaffAttendancePage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    linkedTeacher,
    classes,
    teachers,
    schedules,
    defaultWorkdayJalali,
    staffAttendance,
    upsertStaffAttendance,
    isPluginEnabled,
  } = useSchoolData();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const isTeacherReadOnly = activeRole === 'teacher';
  const classNameMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const [anchorDate, setAnchorDate] = useState<string>(defaultWorkdayJalali);
  const [weekSpan, setWeekSpan] = useState<WeekSpanOption>(1);

  const activeTeachers = useMemo(() => teachers.filter((t) => t.active), [teachers]);

  const workdayDates = useMemo(
    () =>
      getWorkdayDatesForWeeks(
        anchorDate,
        activeSchool.activeWorkdays,
        weekSpan,
        activeSchool.holidays
      ),
    [anchorDate, activeSchool.activeWorkdays, weekSpan, activeSchool.holidays]
  );

  // In weekly view (1 week) we show the full interactive 4-period grid for every workday.
  // In multi-week view (4, 8, 12 weeks) we show per-teacher cumulative attended periods & hours + expandable active week grid.
  const currentWeekDays = useMemo(
    () => workdayDates.filter((d) => d.weekIndex === 0),
    [workdayDates]
  );

  const attendanceIndex = useMemo(() => {
    const map = new Map<string, StaffAttendanceStatus>();
    for (const rec of staffAttendance) {
      map.set(`${rec.jalaliDate}:${rec.period}:${rec.teacherId}`, rec.status);
    }
    return map;
  }, [staffAttendance]);

  const toggleStaffCell = (
    jalaliDate: string,
    weekday: (typeof currentWeekDays)[number]['weekday'],
    period: PeriodNumber,
    teacherId: string
  ) => {
    if (!roleDef.canEditStaffAttendance) return;
    const key = `${jalaliDate}:${period}:${teacherId}`;
    const current = attendanceIndex.get(key) ?? 'present';
    const next = STAFF_CYCLE[(STAFF_CYCLE.indexOf(current) + 1) % STAFF_CYCLE.length];

    const res = upsertStaffAttendance({
      id: `${activeSchoolId}:${jalaliDate}:${period}:${teacherId}`,
      schoolId: activeSchoolId,
      jalaliDate,
      weekday,
      period,
      teacherId,
      status: next,
      recordedBy: activeRole,
      updatedAt: new Date().toISOString(),
    });
    if (!res.ok && res.errorFa) {
      showToast(res.errorFa, 'warning');
    }
  };

  const teacherTotals = useMemo(() => {
    const result = new Map<
      string,
      { attendedPeriods: number; absentPeriods: number; latePeriods: number; excusedPeriods: number; minutes: number }
    >();

    for (const teacher of activeTeachers) {
      let attendedPeriods = 0;
      let absentPeriods = 0;
      let latePeriods = 0;
      let excusedPeriods = 0;

      for (const day of workdayDates) {
        if (day.isHoliday) continue;
        for (let p = 1; p <= 4; p++) {
          const status = attendanceIndex.get(`${day.jalaliDate}:${p}:${teacher.id}`) ?? 'present';
          if (status === 'present') attendedPeriods++;
          else if (status === 'late') {
            attendedPeriods++;
            latePeriods++;
          } else if (status === 'absent') {
            absentPeriods++;
          } else {
            excusedPeriods++;
          }
        }
      }

      result.set(teacher.id, {
        attendedPeriods,
        absentPeriods,
        latePeriods,
        excusedPeriods,
        minutes: attendedPeriods * activeSchool.periodDurationMinutes,
      });
    }
    return result;
  }, [activeTeachers, workdayDates, attendanceIndex, activeSchool.periodDurationMinutes]);

  const absentOrLateCountThisWeek = useMemo(() => {
    let count = 0;
    for (const day of currentWeekDays) {
      for (const teacher of activeTeachers) {
        for (let p = 1; p <= 4; p++) {
          const st = attendanceIndex.get(`${day.jalaliDate}:${p}:${teacher.id}`) ?? 'present';
          if (st === 'absent' || st === 'late') count++;
        }
      }
    }
    return count;
  }, [currentWeekDays, activeTeachers, attendanceIndex]);

  const handleCopyMessenger = async () => {
    const firstDate = workdayDates[0]?.jalaliDate ?? anchorDate;
    const lastDate = workdayDates[workdayDates.length - 1]?.jalaliDate ?? anchorDate;

    const lines = activeTeachers.map((t, idx) => {
      const tot = teacherTotals.get(t.id);
      return `${toPersianDigits(idx + 1)}. ${t.fullName}: ${toPersianDigits(tot?.attendedPeriods ?? 0)} زنگ حضور (${formatPersianHours(tot?.minutes ?? 0)}) | غیبت: ${toPersianDigits(tot?.absentPeriods ?? 0)} | تاخیر: ${toPersianDigits(tot?.latePeriods ?? 0)}`;
    });

    const report = formatSingleColumnMessengerReport({
      schoolName: activeSchool.name,
      reportTitle: `گزارش حضور و غیاب ۴ زنگه کادر (${weekSpan === 1 ? 'هفتگی' : `دوره ${toPersianDigits(weekSpan)} هفته‌ای`})`,
      jalaliDateDisplay: `${toPersianDigits(firstDate)} تا ${toPersianDigits(lastDate)}`,
      sections: [
        {
          heading: 'خلاصه کارکرد زنگ‌ها و ساعات حضور معلمان',
          lines,
        },
      ],
      footerNote: `مبنای هر زنگ: ${toPersianDigits(activeSchool.periodDurationMinutes)} دقیقه`,
    });

    const ok = await copyTextToClipboard(report);
    showToast(
      ok ? 'گزارش تک‌ستونه کادر برای پیام‌رسان‌های «ایتا»، «بله» و «شاد» کپی شد.' : 'خطا در کپی کردن متن.',
      ok ? 'success' : 'warning'
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'کد پرسنلی',
      'نام همکار',
      'تخصص',
      'بازه بررسی',
      'تعداد زنگ حضور',
      'تعداد غیبت',
      'تعداد تاخیر',
      'مرخصی موجه',
      'جمع ساعات حضور (دقیقه)',
    ];
    const rows = activeTeachers.map((t) => {
      const tot = teacherTotals.get(t.id);
      return [
        t.personnelCode,
        t.fullName,
        t.specialty,
        `${weekSpan} هفته`,
        tot?.attendedPeriods ?? 0,
        tot?.absentPeriods ?? 0,
        tot?.latePeriods ?? 0,
        tot?.excusedPeriods ?? 0,
        tot?.minutes ?? 0,
      ];
    });
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(
      `staff-attendance-${activeSchoolId}-${weekSpan}w.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    showToast('فایل اکسل کارکرد کادر (CSV با UTF-8 BOM) دریافت شد.');
  };

  const weekStartDisplay = currentWeekDays[0]
    ? formatJalaliDisplay(currentWeekDays[0].jalaliDate, false)
    : formatJalaliDisplay(anchorDate, false);
  const weekEndDisplay = currentWeekDays[currentWeekDays.length - 1]
    ? formatJalaliDisplay(currentWeekDays[currentWeekDays.length - 1].jalaliDate, false)
    : '';

  return (
    <PrintShell
      school={activeSchool}
      documentTitle={`برگه حضور و غیاب ۴ زنگه کادر و معلمان (${weekSpan === 1 ? 'هفتگی' : `دوره ${toPersianDigits(weekSpan)} هفته‌ای`})`}
      subtitle={`بازه: ${weekStartDisplay}${weekEndDisplay ? ` تا ${weekEndDisplay}` : ''}`}
      landscape={true}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="no-print flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            {isTeacherReadOnly && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                <Lock className="w-3.5 h-3.5" />
                <span>نمای شخصی و فقط‌خواندنی معلم</span>
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isTeacherReadOnly
                ? `برنامه هفتگی و کارکرد شخصی ${linkedTeacher?.fullName ?? ''}`
                : 'حضور و غیاب ۴ زنگه کادر و معلمان'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isTeacherReadOnly
                ? 'مشاهده وضعیت حضور ۴ زنگه و ساعات موظف شخصی شما (ثبت و تغییر فقط توسط مدیریت مدرسه انجام می‌شود).'
                : `جدول زنگ‌های ۱ تا ۴ بر اساس روزهای کاری مدرسه (${toPersianDigits(activeSchool.activeWorkdays.length)} روز در هفته) با محاسبه خودکار جمع زنگ‌ها و ساعات حضور.`}
            </p>
          </div>
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
            {!isTeacherReadOnly && (
              <button
                type="button"
                onClick={() => void handleCopyMessenger()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors whitespace-nowrap"
              >
                <Copy className="w-4 h-4 shrink-0" />
                کپی هوشمند برای پیام‌رسان‌ها
              </button>
            )}
            <PrintButtons landscape compact documentLabel="حضور و غیاب کادر" />
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

        {/* Substitution Link Banner when absences/lates exist (Admins & Deputy only) */}
        {roleDef.canAssignSubstitution &&
          absentOrLateCountThisWeek > 0 &&
          isPluginEnabled('substitution') && (
            <div className="no-print rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-amber-900 dark:text-amber-200">
                <span className="font-bold tabular-nums">
                  {toPersianDigits(absentOrLateCountThisWeek)} زنگ غیبت یا تاخیر
                </span>{' '}
                در هفته جاری ثبت شده است. همکاران آزاد در همان ساعت‌ها در سامانه یافتن جایگزین آماده
                تخصیص هستند.
              </div>
              <button
                type="button"
                onClick={() => navigate('/substitution')}
                className="min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 transition-colors whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                تخصیص معلم جایگزین
              </button>
            </div>
          )}

        {/* Controls: Week Navigator + Multi-Week Period View Selector (1 / 4 / 8 / 12 weeks) */}
        <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnchorDate((d) => addDaysToJalali(d, -7))}
              aria-label="هفته قبل"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="min-h-[44px] px-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              <span>هفته {toPersianDigits(currentWeekDays[0]?.academicWeek ?? 1)} تحصیلی</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                {weekStartDisplay} تا {weekEndDisplay}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAnchorDate((d) => addDaysToJalali(d, 7))}
              aria-label="هفته بعد"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              بازه محاسبه:
            </span>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 gap-1">
              {([1, 4, 8, 12] as WeekSpanOption[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeekSpan(w)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    weekSpan === w
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {w === 1 ? 'هفتگی' : `${toPersianDigits(w)} هفته`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive 4-Period Weekly Grid */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="no-print px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {roleDef.canEditStaffAttendance
                ? 'برای تغییر وضعیت هر زنگ، روی خانه مربوطه کلیک کنید (ح: حاضر · غ: غایب · ت: تاخیر · م: مرخصی موجه).'
                : 'راهنمای وضعیت ثبت‌شده توسط مدرسه: ح: حاضر · غ: غایب · ت: تاخیر · م: مرخصی موجه (فقط‌خواندنی).'}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              مدت هر زنگ: {toPersianDigits(activeSchool.periodDurationMinutes)} دقیقه
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <th rowSpan={2} className="p-3 font-bold min-w-[175px] border-l border-slate-200 dark:border-slate-700">
                    نام همکار و سمت
                  </th>
                  {currentWeekDays.map((day) => (
                    <th
                      key={day.jalaliDate}
                      colSpan={4}
                      className="p-2 text-center font-bold border-l border-slate-200 dark:border-slate-700 tabular-nums"
                    >
                      <div>{day.weekdayName}</div>
                      <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        {toPersianDigits(day.jalaliDate)}
                      </div>
                    </th>
                  ))}
                  <th rowSpan={2} className="p-3 text-center font-bold min-w-[130px] tabular-nums">
                    جمع دوره ({weekSpan === 1 ? '۱ هفته' : `${toPersianDigits(weekSpan)} هفته`})
                  </th>
                </tr>
                <tr className="bg-slate-50/70 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  {currentWeekDays.map((day) =>
                    ([1, 2, 3, 4] as PeriodNumber[]).map((p) => (
                      <th
                        key={`${day.jalaliDate}-h-${p}`}
                        className="py-1.5 px-1 text-center font-semibold border-l border-slate-200/70 dark:border-slate-700/70 tabular-nums"
                      >
                        ز{toPersianDigits(p)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {activeTeachers.map((teacher) => {
                  const totals = teacherTotals.get(teacher.id);
                  return (
                    <tr
                      key={teacher.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-3 border-l border-slate-200/70 dark:border-slate-800">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {teacher.fullName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {teacher.specialty}
                        </div>
                      </td>

                      {currentWeekDays.map((day) =>
                        ([1, 2, 3, 4] as PeriodNumber[]).map((p) => {
                          const key = `${day.jalaliDate}:${p}:${teacher.id}`;
                          const status = attendanceIndex.get(key) ?? 'present';
                          const meta = STAFF_STATUS_META[status];

                          return (
                            <td
                              key={key}
                              className="p-1 text-center border-l border-slate-100 dark:border-slate-800/70"
                            >
                              {roleDef.canEditStaffAttendance ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleStaffCell(day.jalaliDate, day.weekday, p, teacher.id)
                                  }
                                  title={`${teacher.fullName} — ${day.weekdayName} زنگ ${toPersianDigits(p)}: ${meta.label}`}
                                  aria-label={`${teacher.fullName} ${day.weekdayName} زنگ ${toPersianDigits(p)} وضعیت ${meta.label}`}
                                  className={`no-print w-10 h-10 rounded-lg border text-xs font-bold transition-colors ${meta.cellClass}`}
                                >
                                  {meta.short}
                                </button>
                              ) : (
                                <span
                                  title={`${teacher.fullName} — ${day.weekdayName} زنگ ${toPersianDigits(p)}: ${meta.label}`}
                                  className={`no-print inline-flex items-center justify-center w-10 h-10 rounded-lg border text-xs font-bold select-none ${meta.cellClass}`}
                                >
                                  {meta.short}
                                </span>
                              )}
                              <div className="print-only text-center">
                                <span className="print-checkbox" />
                                <span className="mr-1 text-[10px]">{meta.short}</span>
                              </div>
                            </td>
                          );
                        })
                      )}

                      <td className="p-3 text-center tabular-nums">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {toPersianDigits(totals?.attendedPeriods ?? 0)} زنگ
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatPersianHours(totals?.minutes ?? 0)}
                        </div>
                        {(totals?.absentPeriods ?? 0) > 0 && (
                          <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            {toPersianDigits(totals?.absentPeriods ?? 0)} غیبت
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Multi-week summary breakdown when weekSpan > 1 */}
        {weekSpan > 1 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
              خلاصه عملکرد تجمیعی دوره {toPersianDigits(weekSpan)} هفته‌ای ({toPersianDigits(workdayDates.length)} روز کاری)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">همکار</th>
                    <th className="py-2.5 px-3 text-center">زنگ‌های حضور</th>
                    <th className="py-2.5 px-3 text-center">غیبت</th>
                    <th className="py-2.5 px-3 text-center">تاخیر</th>
                    <th className="py-2.5 px-3 text-center">مرخصی موجه</th>
                    <th className="py-2.5 px-3 text-left">مجموع ساعات موظف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {activeTeachers.map((teacher) => {
                    const tot = teacherTotals.get(teacher.id);
                    return (
                      <tr key={teacher.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                          {teacher.fullName}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400 font-semibold">
                          {toPersianDigits(tot?.attendedPeriods ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-700 dark:text-rose-400 font-semibold">
                          {toPersianDigits(tot?.absentPeriods ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-700 dark:text-amber-400 font-semibold">
                          {toPersianDigits(tot?.latePeriods ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-sky-700 dark:text-sky-400 font-semibold">
                          {toPersianDigits(tot?.excusedPeriods ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-bold text-slate-800 dark:text-slate-200">
                          {formatPersianHours(tot?.minutes ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Teacher's Personal Weekly 4-Period Teaching Schedule (Read-only) */}
        {isTeacherReadOnly && linkedTeacher && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                برنامه هفتگی تدریس من ({linkedTeacher.fullName})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">روز کاری</th>
                    {([1, 2, 3, 4] as PeriodNumber[]).map((p) => (
                      <th key={p} className="py-2.5 px-3 text-center tabular-nums">
                        زنگ {toPersianDigits(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeSchool.activeWorkdays.map((wd) => (
                    <tr key={wd}>
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {PERSIAN_WEEKDAY_NAMES[wd]}
                      </td>
                      {([1, 2, 3, 4] as PeriodNumber[]).map((p) => {
                        const slot = schedules.find(
                          (s) => s.teacherId === linkedTeacher.id && s.weekday === wd && s.period === p
                        );
                        return (
                          <td key={p} className="py-3 px-3 text-center">
                            {slot ? (
                              <div className="inline-flex flex-col items-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 px-3 py-1.5">
                                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200">
                                  {classNameMap.get(slot.classId) ?? 'کلاس'}
                                </span>
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                                  {slot.subjectName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">آزاد</span>
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
        )}
      </div>
    </PrintShell>
  );
};
