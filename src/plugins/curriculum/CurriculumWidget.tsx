// Dashboard Widget for Add-on 6: Weekly Curriculum Pacing
import React from 'react';
import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const CurriculumWidget: React.FC = () => {
  const { curriculumTopics } = useSchoolData();
  const { navigate } = useRouter();

  const total = curriculumTopics.length;
  const completedCount = curriculumTopics.filter((t) => t.completedClassIds.length > 0).length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              بودجه‌بندی هفتگی (فارسی و ریاضی)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(completedCount)} از {toPersianDigits(total)} مبحث تکمیل‌شده
            </p>
          </div>
        </div>
        <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
          {toPersianDigits(pct)}٪
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>پایه‌های دوم تا ششم + برگه چاپی A4</span>
        <button
          type="button"
          onClick={() => navigate('/curriculum')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>مدیریت بودجه‌بندی</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
