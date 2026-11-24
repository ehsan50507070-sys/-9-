// Dashboard Widget for Phase 3 Plugin: Flipped Video Classroom («کلاس وارونه هوشمند»)
import React from 'react';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const FlippedVideoWidget: React.FC = () => {
  const { flippedLessons, flippedQuestions, flippedTelemetry } = useSchoolData();
  const { navigate } = useRouter();

  const unansweredQuestions = flippedQuestions.filter((q) => !q.teacherReply).length;
  const quizCompletedCount = flippedTelemetry.filter((t) => Boolean(t.microQuizAttempt)).length;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              کلاس وارونه هوشمند
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(flippedLessons.length)} ویدیو · {toPersianDigits(quizCompletedCount)} تستک تکمیل‌شده
            </p>
          </div>
        </div>
        {unansweredQuestions > 0 && (
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {toPersianDigits(unansweredQuestions)} سوال بی‌پاسخ
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>پایش خط‌زمانی سرعت تماشا و کارت رفع اشکال</span>
        <button
          type="button"
          onClick={() => navigate('/flipped-video')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>ورود به کلاس وارونه</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
