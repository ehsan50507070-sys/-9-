// Dashboard Widget for Class Rewards & Auto A4 Certificate Generator
import React from 'react';
import { Award, ChevronLeft } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const RewardsWidget: React.FC = () => {
  const { studentRewards, students } = useSchoolData();
  const { navigate } = useRouter();

  const latest = studentRewards[0];
  const latestStudent = latest ? students.find((s) => s.id === latest.studentId) : undefined;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              تشویق و لوح تقدیر A4
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(studentRewards.length)} نشان ثبت‌شده
            </p>
          </div>
        </div>
      </div>

      <div className="text-xs leading-6 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
        {latest ? (
          <>
            آخرین تقدیر: <strong>{latest.badgeTitle}</strong> برای{' '}
            <strong>{latestStudent?.fullName ?? 'دانش‌آموز'}</strong>
          </>
        ) : (
          'هنوز نشان تشویقی ثبت نشده است.'
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/rewards')}
        className="inline-flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <span>مشاهده نشان‌ها و چاپ لوح A4</span>
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
};
