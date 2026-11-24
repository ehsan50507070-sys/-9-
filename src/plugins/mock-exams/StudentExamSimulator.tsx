// Distraction-Free Student Konkur Exam Simulator with Sequential Booklet Timers,
// Interactive OMR Bubble Sheet (click-again to clear/blank, Flag/Bookmark, Strike-through Eliminator),
// Subject Navigator, Silent Tab-Switch Counter, and Optional Per-Student Option Shuffling.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Eraser,
  Send,
  Strikethrough,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  MockAnswerOption,
  MockExam,
  MockExamAttempt,
  Student,
} from '../../types/domain';
import {
  getDeterministicOptionOrder,
  getNegativeMarkingLabelFa,
} from './statsEngine';

interface StudentExamSimulatorProps {
  exam: MockExam;
  student: Student;
  className: string;
  onSubmitAttempt: (attempt: MockExamAttempt) => Promise<void>;
  onCancel: () => void;
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${toPersianDigits(String(mins).padStart(2, '0'))}:${toPersianDigits(String(secs).padStart(2, '0'))}`;
}

export const StudentExamSimulator: React.FC<StudentExamSimulatorProps> = ({
  exam,
  student,
  className,
  onSubmitAttempt,
  onCancel,
}) => {
  const sortedBooklets = useMemo(
    () => [...exam.booklets].sort((a, b) => a.orderIndex - b.orderIndex),
    [exam.booklets]
  );

  const [activeBookletIndex, setActiveBookletIndex] = useState(0);
  const activeBooklet = sortedBooklets[activeBookletIndex] ?? sortedBooklets[0];

  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    () => (activeBooklet?.durationMinutes ?? 40) * 60
  );
  const [answers, setAnswers] = useState<Record<number, MockAnswerOption | null>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>([]);
  const [eliminatedOptions, setEliminatedOptions] = useState<
    Record<number, MockAnswerOption[]>
  >({});
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  const startedAtIsoRef = useRef<string>(new Date().toISOString());
  const submittedOnceRef = useRef(false);

  // Determine whether option shuffle is enabled (strictly disabled in Answer-Key-Only mode)
  const shouldShuffleOptions = exam.mode === 'online_full' && exam.shuffleOptions;

  const bookletSubjects = useMemo(() => {
    if (!activeBooklet) return exam.subjects;
    return exam.subjects.filter((s) => s.bookletId === activeBooklet.id);
  }, [exam.subjects, activeBooklet]);

  const bookletQuestions = useMemo(() => {
    const subjIds = new Set(bookletSubjects.map((s) => s.id));
    return exam.questions
      .filter((q) => subjIds.has(q.subjectId))
      .sort((a, b) => a.questionNumber - b.questionNumber);
  }, [exam.questions, bookletSubjects]);

  // Reset active question when switching booklets
  useEffect(() => {
    if (bookletQuestions.length > 0) {
      setActiveQuestionNumber(bookletQuestions[0].questionNumber);
    }
    setRemainingSeconds((activeBooklet?.durationMinutes ?? 40) * 60);
  }, [activeBookletIndex, activeBooklet?.durationMinutes, bookletQuestions]);

  const handleFinalSubmit = useCallback(async () => {
    if (submittedOnceRef.current) return;
    submittedOnceRef.current = true;
    setSubmitting(true);

    const nowIso = new Date().toISOString();
    const attempt: MockExamAttempt = {
      id: `attempt-${exam.id}-${student.id}`,
      complexId: exam.complexId,
      schoolId: student.schoolId,
      academicYearId: exam.academicYearId,
      examId: exam.id,
      studentId: student.id,
      studentName: student.fullName,
      classId: student.classId,
      className,
      entryMethod: 'online',
      status: 'submitted',
      answers,
      flaggedQuestions,
      eliminatedOptions,
      tabSwitchCount,
      activeBookletIndex,
      startedAtIso: startedAtIsoRef.current,
      submittedAtJalali: getTodayJalali(),
      createdByUserId: student.id,
      createdAtIso: startedAtIsoRef.current,
      updatedAtIso: nowIso,
    };

    try {
      await onSubmitAttempt(attempt);
    } finally {
      setSubmitting(false);
    }
  }, [
    exam,
    student,
    className,
    answers,
    flaggedQuestions,
    eliminatedOptions,
    tabSwitchCount,
    activeBookletIndex,
    onSubmitAttempt,
  ]);

  // Per-booklet countdown timer with auto-advance / auto-submit
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (activeBookletIndex < sortedBooklets.length - 1) {
            setActiveBookletIndex((idx) => idx + 1);
            return (sortedBooklets[activeBookletIndex + 1]?.durationMinutes ?? 35) * 60;
          }
          void handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeBookletIndex, sortedBooklets, handleFinalSubmit]);

  // Silent anti-cheat tab-switch detection
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitchCount((c) => c + 1);
      }
    };
    const onBlur = () => {
      setTabSwitchCount((c) => c + 1);
    };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const currentQuestion =
    bookletQuestions.find((q) => q.questionNumber === activeQuestionNumber) ??
    bookletQuestions[0];

  const currentQIndex = bookletQuestions.findIndex(
    (q) => q.questionNumber === currentQuestion?.questionNumber
  );

  // Clicking selected bubble again clears answer (crucial for negative-marking exams)
  const toggleAnswer = (questionNumber: number, originalOption: MockAnswerOption) => {
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: prev[questionNumber] === originalOption ? null : originalOption,
    }));
  };

  const toggleFlag = (questionNumber: number) => {
    setFlaggedQuestions((prev) =>
      prev.includes(questionNumber)
        ? prev.filter((q) => q !== questionNumber)
        : [...prev, questionNumber]
    );
  };

  const toggleEliminate = (questionNumber: number, originalOption: MockAnswerOption) => {
    setEliminatedOptions((prev) => {
      const current = prev[questionNumber] ?? [];
      const next = current.includes(originalOption)
        ? current.filter((o) => o !== originalOption)
        : [...current, originalOption];
      return { ...prev, [questionNumber]: next };
    });
  };

  const isLowTime = remainingSeconds <= 300; // Final 5 minutes warning
  const totalAnswered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const totalQuestions = exam.questions.length;
  const totalUnanswered = totalQuestions - totalAnswered;

  const isLastBooklet = activeBookletIndex >= sortedBooklets.length - 1;

  return (
    <div
      data-testid="student-exam-simulator"
      className="space-y-4"
    >
      {/* Top Distraction-Free Konkur Control Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {activeBooklet?.title} · دفترچه {toPersianDigits(activeBookletIndex + 1)} از{' '}
            {toPersianDigits(sortedBooklets.length)}
          </div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
            {exam.title}
          </h2>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {getNegativeMarkingLabelFa(exam.negativeMarking)} · پاسخ‌داده‌شده:{' '}
            <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(totalAnswered)}
            </span>{' '}
            از {toPersianDigits(totalQuestions)} · نشان‌دار:{' '}
            <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {toPersianDigits(flaggedQuestions.length)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Per-Booklet Countdown Timer */}
          <div
            data-testid="booklet-timer"
            className={`min-h-[44px] px-3.5 rounded-xl border flex items-center gap-2 text-sm font-extrabold tabular-nums ${
              isLowTime
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{formatTimer(remainingSeconds)}</span>
            {isLowTime && <span className="text-[11px]">کمتر از ۵ دقیقه!</span>}
          </div>

          {!isLastBooklet ? (
            <button
              type="button"
              onClick={() => setActiveBookletIndex((i) => i + 1)}
              className="min-h-[44px] px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition-colors whitespace-nowrap"
            >
              پایان زودهنگام و رفتن به دفترچه بعدی
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmFinishOpen(true)}
              disabled={submitting}
              className="min-h-[44px] px-4 rounded-xl brand-btn text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              ثبت نهایی و صدور کارنامه
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            انصراف
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Question Pane (2/3) + Interactive OMR Bubble Sheet (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Question Viewer & Controls */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {currentQuestion && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                    سوال {toPersianDigits(currentQuestion.questionNumber)}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {bookletSubjects.find((s) => s.id === currentQuestion.subjectId)?.subjectName}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    مبحث: {currentQuestion.topic}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {answers[currentQuestion.questionNumber] && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.questionNumber]: null,
                        }))
                      }
                      className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      پاک کردن پاسخ
                    </button>
                  )}
                  <button
                    type="button"
                    aria-pressed={flaggedQuestions.includes(currentQuestion.questionNumber)}
                    onClick={() => toggleFlag(currentQuestion.questionNumber)}
                    className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                      flaggedQuestions.includes(currentQuestion.questionNumber)
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>
                      {flaggedQuestions.includes(currentQuestion.questionNumber)
                        ? 'نشان‌دار شد'
                        : 'نشان‌دار برای مرور'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Question Body */}
              {exam.mode === 'online_full' && currentQuestion.questionText ? (
                <div className="space-y-4">
                  <p className="text-base font-semibold leading-8 text-slate-900 dark:text-slate-100">
                    {currentQuestion.questionText}
                  </p>

                  {/* Options with Strike-through Eliminator */}
                  <div className="space-y-2.5">
                    {getDeterministicOptionOrder(
                      exam.id,
                      student.id,
                      currentQuestion.questionNumber,
                      shouldShuffleOptions
                    ).map((origOpt, displayIdx) => {
                      const displayNum = (displayIdx + 1) as MockAnswerOption;
                      const optionText =
                        currentQuestion.options?.[origOpt - 1] ?? `گزینه ${toPersianDigits(displayNum)}`;
                      const isSelected = answers[currentQuestion.questionNumber] === origOpt;
                      const isEliminated = (
                        eliminatedOptions[currentQuestion.questionNumber] ?? []
                      ).includes(origOpt);

                      return (
                        <div
                          key={origOpt}
                          className={`flex items-stretch gap-2 rounded-xl border transition-colors ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleAnswer(currentQuestion.questionNumber, origOpt)}
                            className="flex-1 min-h-[48px] px-3.5 py-2.5 text-right flex items-center gap-3"
                          >
                            <span
                              className={`w-7 h-7 rounded-full border-2 inline-flex items-center justify-center text-xs font-extrabold shrink-0 tabular-nums transition-colors ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {toPersianDigits(displayNum)}
                            </span>
                            <span
                              className={`text-sm leading-6 ${
                                isEliminated
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-800 dark:text-slate-100 font-medium'
                              }`}
                            >
                              {optionText}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleEliminate(currentQuestion.questionNumber, origOpt)}
                            title={isEliminated ? 'بازگرداندن گزینه' : 'خط زدن گزینه ردشده'}
                            aria-label={`خط زدن گزینه ${toPersianDigits(displayNum)}`}
                            aria-pressed={isEliminated}
                            className={`min-w-[44px] px-2.5 border-r border-slate-200/80 dark:border-slate-800 inline-flex items-center justify-center rounded-l-xl transition-colors ${
                              isEliminated
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <Strikethrough className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-5 space-y-3 text-center">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    حالت دفترچه کاغذی / PDF (پاسخبرگ کلیدی)
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-6">
                    سوال {toPersianDigits(currentQuestion.questionNumber)} را از دفترچه کاغذی یا فایل PDF مطالعه کرده و گزینه صحیح را مستقیماً در پاسخبرگ کلیدی ثبت کنید. برای نزده گذاشتن، دوباره روی همان گزینه کلیک کنید.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    {([1, 2, 3, 4] as const).map((opt) => {
                      const isSel = answers[currentQuestion.questionNumber] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleAnswer(currentQuestion.questionNumber, opt)}
                          className={`w-12 h-12 rounded-full border-2 font-extrabold text-sm tabular-nums transition-colors ${
                            isSel
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-indigo-400'
                          }`}
                        >
                          {toPersianDigits(opt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Previous / Next Question Navigation */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={currentQIndex <= 0}
                  onClick={() => {
                    if (currentQIndex > 0) {
                      setActiveQuestionNumber(bookletQuestions[currentQIndex - 1].questionNumber);
                    }
                  }}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  سوال قبلی
                </button>

                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {toPersianDigits(currentQIndex + 1)} از {toPersianDigits(bookletQuestions.length)}
                </span>

                <button
                  type="button"
                  disabled={currentQIndex >= bookletQuestions.length - 1}
                  onClick={() => {
                    if (currentQIndex < bookletQuestions.length - 1) {
                      setActiveQuestionNumber(bookletQuestions[currentQIndex + 1].questionNumber);
                    }
                  }}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  سوال بعدی
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Subject Quick Navigator */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                ناوبری سریع سوالات دفترچه فعال
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span>پاسخ‌داده‌شده (سبز)</span>
                <span>·</span>
                <span>نزده (سفید)</span>
                <span>·</span>
                <span>نشان‌دار (زرد)</span>
              </div>
            </div>

            <div className="space-y-3">
              {bookletSubjects.map((subj) => {
                const sQs = bookletQuestions.filter((q) => q.subjectId === subj.id);
                const sAns = sQs.filter((q) => answers[q.questionNumber] != null).length;
                return (
                  <div key={subj.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {subj.subjectName}
                      </span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {toPersianDigits(sAns)} از {toPersianDigits(sQs.length)} پاسخ‌داده‌شده
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sQs.map((q) => {
                        const isAns = answers[q.questionNumber] != null;
                        const isFlag = flaggedQuestions.includes(q.questionNumber);
                        const isCurr = q.questionNumber === currentQuestion?.questionNumber;
                        return (
                          <button
                            key={q.questionNumber}
                            type="button"
                            onClick={() => setActiveQuestionNumber(q.questionNumber)}
                            aria-label={`رفتن به سوال ${toPersianDigits(q.questionNumber)}`}
                            className={`w-9 h-9 rounded-lg border text-xs font-bold tabular-nums transition-colors ${
                              isCurr ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 ' : ''
                            }${
                              isFlag
                                ? 'border-amber-400 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                                : isAns
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {toPersianDigits(q.questionNumber)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Interactive OMR Bubble Sheet («پاسخبرگ کلیدی تستی») */}
        <aside
          aria-label="پاسخبرگ کلیدی تستی"
          className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 lg:sticky lg:top-20"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                پاسخبرگ کلیدی تستی (OMR)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                کلیک مجدد روی گزینه انتخابی، پاسخ را پاک (نزده) می‌کند
              </p>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
            {bookletQuestions.map((q) => {
              const order = getDeterministicOptionOrder(
                exam.id,
                student.id,
                q.questionNumber,
                shouldShuffleOptions
              );
              const selectedOrig = answers[q.questionNumber] ?? null;
              const isFlag = flaggedQuestions.includes(q.questionNumber);
              const isCurrent = q.questionNumber === currentQuestion?.questionNumber;

              return (
                <div
                  key={q.questionNumber}
                  className={`py-2 px-2 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                    isCurrent ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveQuestionNumber(q.questionNumber)}
                    className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 tabular-nums min-w-[46px]"
                  >
                    <span>{toPersianDigits(q.questionNumber)}</span>
                    {isFlag && <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {order.map((origOpt, idx) => {
                      const dispNum = (idx + 1) as MockAnswerOption;
                      const active = selectedOrig === origOpt;
                      return (
                        <button
                          key={origOpt}
                          type="button"
                          data-testid={`omr-q${q.questionNumber}-opt${dispNum}`}
                          aria-label={`سوال ${toPersianDigits(q.questionNumber)} گزینه ${toPersianDigits(dispNum)}`}
                          aria-pressed={active}
                          onClick={() => {
                            setActiveQuestionNumber(q.questionNumber);
                            toggleAnswer(q.questionNumber, origOpt);
                          }}
                          className={`w-8 h-8 rounded-full border-2 text-xs font-extrabold tabular-nums transition-colors ${
                            active
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {toPersianDigits(dispNum)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Confirmation Dialog before Final Submit */}
      {confirmFinishOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تایید ثبت نهایی آزمون"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <h3 className="text-base font-extrabold">پایان آزمون و صدور کارنامه کنکوری</h3>
            </div>
            <div className="text-xs leading-6 text-slate-600 dark:text-slate-300 space-y-1 tabular-nums">
              <p>
                پاسخ‌داده‌شده: <strong>{toPersianDigits(totalAnswered)}</strong> سوال · نزده:{' '}
                <strong>{toPersianDigits(totalUnanswered)}</strong> سوال · نشان‌دار:{' '}
                <strong>{toPersianDigits(flaggedQuestions.length)}</strong> سوال
              </p>
              {totalUnanswered > 0 && (
                <p className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  هنوز {toPersianDigits(totalUnanswered)} سوال بدون پاسخ باقی مانده است.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmFinishOpen(false)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                ادامه و مرور پاسخ‌ها
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setConfirmFinishOpen(false);
                  void handleFinalSubmit();
                }}
                className="min-h-[40px] px-4 rounded-xl brand-btn text-xs font-bold"
              >
                {submitting ? 'در حال محاسبه تراز...' : 'ثبت قطعی و مشاهده کارنامه'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
