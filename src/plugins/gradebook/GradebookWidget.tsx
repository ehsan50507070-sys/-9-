// Dashboard Widget for Add-on 8: Teacher Electronic Worksheet & Smart Gradebook
import React from 'react';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const GradebookWidget: React.FC = () => {
  const { gradebookEntries, lessonPlans, gradeAppeals } = useSchoolData();
  const { navigate } = useRouter();

  const openAppeals = gradeAppeals.filter((a) => a.status !== 'principal_approved').length;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              کاربرگ الکترونیک و دفتر کلاسی
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(gradebookEntries.length)} رکورد ارزشیابی · {toPersianDigits(lessonPlans.length)} طرح درس
            </p>
          </div>
        </div>
        {openAppeals > 0 && (
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {toPersianDigits(openAppeals)} اعتراض باز
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>نمره مستمر هوشمند، کارنامه توصیفی و نمودار</span>
        <button
          type="button"
          onClick={() => navigate('/gradebook')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>ورود به دفتر کلاسی</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
