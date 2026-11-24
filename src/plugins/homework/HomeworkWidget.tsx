// Dashboard Widget for Add-on 9: Online Homework Portfolio
import React from 'react';
import { ArrowLeft, FileCheck2 } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const HomeworkWidget: React.FC = () => {
  const { homeworkAssignments, homeworkSubmissions } = useSchoolData();
  const { navigate } = useRouter();

  const awaitingReview = homeworkSubmissions.filter((s) => s.status !== 'reviewed').length;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              کارپوشه تکالیف آنلاین
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(homeworkAssignments.length)} تکلیف فعال · {toPersianDigits(homeworkSubmissions.length)} تحویل ثبت‌شده
            </p>
          </div>
        </div>
        {awaitingReview > 0 && (
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {toPersianDigits(awaitingReview)} در انتظار بررسی
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>متصل به محاسبه هوشمند نمره مستمر</span>
        <button
          type="button"
          onClick={() => navigate('/homework')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>مدیریت تکالیف</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
