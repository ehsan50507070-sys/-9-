// Dashboard Widget for Add-on 1: Student Attendance
import React, { useMemo } from 'react';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { formatPersianPercent, toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';

export const StudentAttendanceWidget: React.FC = () => {
  const { students, studentAttendance, defaultWorkdayJalali } = useSchoolData();
  const { navigate } = useRouter();

  const stats = useMemo(() => {
    const activeStudents = students.filter((s) => s.active);
    const todayP1 = studentAttendance.filter(
      (a) => a.jalaliDate === defaultWorkdayJalali && a.period === 1
    );
    const absent = todayP1.filter((a) => a.status === 'absent').length;
    const late = todayP1.filter((a) => a.status === 'late').length;
    const excused = todayP1.filter((a) => a.status === 'excused').length;
    const present = Math.max(0, activeStudents.length - absent - late - excused);
    const rate =
      activeStudents.length > 0
        ? Math.round(((present + late) / activeStudents.length) * 100)
        : 100;
    return { total: activeStudents.length, present, absent, late, excused, rate };
  }, [students, studentAttendance, defaultWorkdayJalali]);

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              وضعیت حضور دانش‌آموزان
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {formatJalaliDisplay(defaultWorkdayJalali, false)}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2 tabular-nums">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatPersianPercent(stats.rate)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            حضور در زنگ اول از {toPersianDigits(stats.total)} نفر
          </span>
        </div>

        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${stats.rate}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
          <div className="py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
            <div className="font-bold text-base">{toPersianDigits(stats.absent)}</div>
            <div>غایب</div>
          </div>
          <div className="py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
            <div className="font-bold text-base">{toPersianDigits(stats.late)}</div>
            <div>تاخیر</div>
          </div>
          <div className="py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
            <div className="font-bold text-base">{toPersianDigits(stats.excused)}</div>
            <div>موجه</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/student-attendance')}
        className="mt-4 min-h-[42px] w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span>ورود به ثبت زنگ‌به‌زنگ</span>
        <ArrowLeft className="w-4 h-4" />
      </button>
    </section>
  );
};
