// Dashboard Widget for Add-on 2: 4-Period Staff Attendance
import React, { useMemo } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { formatPersianHours, toPersianDigits } from '../../lib/digits';

export const StaffAttendanceWidget: React.FC = () => {
  const { activeSchool, activeRole, teachers, staffAttendance, defaultWorkdayJalali } = useSchoolData();
  const { navigate } = useRouter();
  const isTeacher = activeRole === 'teacher';

  const stats = useMemo(() => {
    const activeTeachers = teachers.filter((t) => t.active);
    const todayRecs = staffAttendance.filter((r) => r.jalaliDate === defaultWorkdayJalali);
    const totalSlots = activeTeachers.length * 4;
    let absentSlots = 0;
    let lateSlots = 0;
    for (const r of todayRecs) {
      if (r.status === 'absent') absentSlots++;
      if (r.status === 'late') lateSlots++;
    }
    const attendedSlots = Math.max(0, totalSlots - absentSlots);
    return {
      teacherCount: activeTeachers.length,
      attendedSlots,
      absentSlots,
      lateSlots,
      totalMinutes: attendedSlots * activeSchool.periodDurationMinutes,
    };
  }, [teachers, staffAttendance, defaultWorkdayJalali, activeSchool.periodDurationMinutes]);

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isTeacher ? 'حضور و برنامه شخصی من' : 'حضور ۴ زنگه کادر'}
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {isTeacher ? 'فقط‌خواندنی' : `${toPersianDigits(stats.teacherCount)} همکار`}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2 tabular-nums">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {toPersianDigits(stats.attendedSlots)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            زنگ فعال امروز ({formatPersianHours(stats.totalMinutes)})
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs tabular-nums">
          <span className="text-rose-700 dark:text-rose-400 font-semibold">
            غیبت زنگ: {toPersianDigits(stats.absentSlots)}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-amber-700 dark:text-amber-400 font-semibold">
            تاخیر زنگ: {toPersianDigits(stats.lateSlots)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/staff-attendance')}
        className="mt-4 min-h-[42px] w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span>{isTeacher ? 'مشاهده برنامه و کارکرد من' : 'جدول ۴ زنگه کادر'}</span>
        <ArrowLeft className="w-4 h-4" />
      </button>
    </section>
  );
};
