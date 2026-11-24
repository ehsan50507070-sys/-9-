// Dashboard Widget for Add-on 5: School Timetable Manager
import React from 'react';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const TimetableWidget: React.FC = () => {
  const { activeSchool, classes, schedules } = useSchoolData();
  const { navigate } = useRouter();

  const totalPossible = classes.length * activeSchool.activeWorkdays.length * 4;
  const fillPercent = totalPossible > 0 ? Math.min(100, Math.round((schedules.length / totalPossible) * 100)) : 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              برنامه هفتگی مدرسه
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(schedules.length)} زنگ فعال · تداخل‌یاب زنده
            </p>
          </div>
        </div>
        <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
          {toPersianDigits(fillPercent)}٪
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all"
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="tabular-nums">
          {toPersianDigits(activeSchool.activeWorkdays.length)} روز کاری × ۴ زنگ
        </span>
        <button
          type="button"
          onClick={() => navigate('/timetable')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>مشاهده و چاپ A4</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
