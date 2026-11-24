// Dashboard Widget for Phase 3 Plugin: Online Exams («سامانه آزمون آنلاین»)
import React from 'react';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const OnlineExamsWidget: React.FC = () => {
  const { onlineExams, onlineExamSubmissions } = useSchoolData();
  const { navigate } = useRouter();

  const pendingDescriptive = onlineExamSubmissions.filter(
    (s) => s.gradingStatus === 'pending_descriptive'
  ).length;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              سامانه آزمون آنلاین
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(onlineExams.length)} آزمون · {toPersianDigits(onlineExamSubmissions.length)} پاسخ‌نامه ثبت‌شده
            </p>
          </div>
        </div>
        {pendingDescriptive > 0 && (
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {toPersianDigits(pendingDescriptive)} در صف تصحیح
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>متصل به بانک سوالات و دفتر کلاسی هوشمند</span>
        <button
          type="button"
          onClick={() => navigate('/online-exams')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>مدیریت آزمون‌ها</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
