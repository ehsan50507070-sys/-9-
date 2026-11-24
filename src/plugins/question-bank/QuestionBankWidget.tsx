// Dashboard Widget for Standalone Question Bank Plugin (Phase 2.5)
import React from 'react';
import { ChevronLeft, Library } from 'lucide-react';
import { canManageQuestionBank } from '../../core/auth/rbac';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const QuestionBankWidget: React.FC = () => {
  const { activeRole, questionBank, examQuestionBasket } = useSchoolData();
  const { navigate } = useRouter();

  if (!canManageQuestionBank(activeRole)) return null;

  const mcqCount = questionBank.filter((q) => q.type === 'multiple_choice').length;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              بانک سوالات آموزشی
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(questionBank.length)} سوال محفوظ · سبد آزمون:{' '}
              {toPersianDigits(examQuestionBasket.length)}
            </p>
          </div>
        </div>
      </div>

      <div className="text-xs leading-6 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 tabular-nums">
        {questionBank.length > 0 ? (
          <>
            آماده ارسال مستقیم به تکالیف، بازی آموزشی ({toPersianDigits(mcqCount)} سوال تستی)، چت
            کلاسی و چاپ A4 برگه آزمون.
          </>
        ) : (
          'هنوز سوالی در این مدرسه ثبت نشده است؛ نخستین نمونه سوال را اضافه کنید.'
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/question-bank')}
        className="inline-flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <span>مدیریت بانک سوالات و طراحی آزمون A4</span>
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
};
