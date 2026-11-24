// Dashboard Widget for Add-on 4: Daily Log & Early Dismissal
import React from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const DailyLogWidget: React.FC = () => {
  const { dailyLogs } = useSchoolData();
  const { navigate } = useRouter();

  const earlyDismissals = dailyLogs.filter((l) => l.category === 'early_dismissal').length;
  const latest = dailyLogs[0];

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              دفتر روزانه و خروج زودهنگام
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {toPersianDigits(dailyLogs.length)} رکورد
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2 tabular-nums">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {toPersianDigits(earlyDismissals)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            مرخصی ساعتی ثبت‌شده
          </span>
        </div>

        {latest && (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-5">
            آخرین ثبت: {latest.title} ({toPersianDigits(latest.jalaliDate)})
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/daily-log')}
        className="mt-4 min-h-[42px] w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span>مشاهده و ثبت وقایع</span>
        <ArrowLeft className="w-4 h-4" />
      </button>
    </section>
  );
};
