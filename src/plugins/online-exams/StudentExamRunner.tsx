// Distraction-Free RTL Student Exam Runner with Live Countdown, Question Navigator,
// Handwritten Photo Upload (5MB IDB), Tab-Switch Guard, and Auto-Submit
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import { useToast } from '../../core/ui/ToastContext';
import { validateRichMediaFile } from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  MediaAttachmentRef,
  OnlineExam,
  OnlineExamAnswer,
  OnlineExamQuestion,
  OnlineExamSubmission,
  Student,
  Student360Signal,
} from '../../types/domain';
import { autoGradeExamSubmission, getExamQuestionTypeLabelFa } from './onlineExamHelpers';

interface StudentExamRunnerProps {
  exam: OnlineExam;
  student: Student;
  onSubmit: (submission: OnlineExamSubmission, signal: Student360Signal) => void;
  onCancel: () => void;
}

function formatCountdown(secondsLeft: number): string {
  const safe = Math.max(0, Math.floor(secondsLeft));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return toPersianDigits(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
}

export const StudentExamRunner: React.FC<StudentExamRunnerProps> = ({
  exam,
  student,
  onSubmit,
  onCancel,
}) => {
  const { showToast } = useToast();

  // Optional randomized question order (stable per exam session)
  const orderedQuestions = useMemo<OnlineExamQuestion[]>(() => {
    if (!exam.randomizeOrder) return exam.questions;
    const copy = [...exam.questions];
    // Deterministic Fisher-Yates seeded by studentId + examId
    let seed = 0;
    const key = `${student.id}:${exam.id}`;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 100000;
    for (let i = copy.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) % 2147483647;
      const j = seed % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [exam.questions, exam.randomizeOrder, exam.id, student.id]);

  const totalSeconds = Math.max(60, exam.durationMinutes * 60);
  const startedAtIsoRef = useRef(new Date().toISOString());
  const submittedRef = useRef(false);

  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answersMap, setAnswersMap] = useState<Record<string, OnlineExamAnswer>>({});
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [tabWarningBanner, setTabWarningBanner] = useState<boolean>(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  const answersRef = useRef(answersMap);
  answersRef.current = answersMap;
  const tabCountRef = useRef(tabSwitchCount);
  tabCountRef.current = tabSwitchCount;
  const secondsLeftRef = useRef(secondsLeft);
  secondsLeftRef.current = secondsLeft;

  const finalizeAndSubmit = useCallback(
    (autoSubmitted = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;

      const rawAnswers: OnlineExamAnswer[] = exam.questions.map((q) => {
        return answersRef.current[q.id] ?? { questionId: q.id };
      });
      const graded = autoGradeExamSubmission(exam, rawAnswers);
      const nowIso = new Date().toISOString();
      const todayJalali = getTodayJalali();
      const elapsedSeconds = Math.max(1, totalSeconds - secondsLeftRef.current);

      const submission: OnlineExamSubmission = {
        id: `${exam.schoolId}:exsub:${exam.id}:${student.id}`,
        schoolId: exam.schoolId,
        examId: exam.id,
        classId: exam.classId,
        studentId: student.id,
        answers: graded.gradedAnswers,
        startedAtIso: startedAtIsoRef.current,
        submittedAtIso: nowIso,
        submittedAtJalali: todayJalali,
        elapsedSeconds,
        tabSwitchCount: tabCountRef.current,
        autoGradedPoints: graded.autoGradedPoints,
        manualGradedPoints: 0,
        finalPoints: graded.finalPoints,
        finalScore20: graded.finalScore20,
        gradingStatus: graded.gradingStatus,
        updatedAt: nowIso,
      };

      const signal: Student360Signal = {
        id: `${exam.schoolId}:s360:online_exam:${exam.id}:${student.id}`,
        schoolId: exam.schoolId,
        studentId: student.id,
        classId: exam.classId,
        subject: exam.subject,
        source: 'online_exam',
        sourceEntityId: exam.id,
        title: exam.title,
        score20: graded.finalScore20,
        statusLabelFa:
          graded.gradingStatus === 'pending_descriptive'
            ? 'در انتظار تصحیح تشریحی'
            : graded.finalScore20 >= 17
            ? 'خیلی خوب'
            : graded.finalScore20 >= 14
            ? 'خوب'
            : 'نیاز به تلاش بیشتر',
        summaryFa:
          graded.gradingStatus === 'pending_descriptive'
            ? `ارسال آزمون «${exam.title}» — نمره بخش تستی: ${toPersianDigits(graded.autoGradedPoints)} از ${toPersianDigits(exam.totalPoints)}`
            : `کسب نمره ${toPersianDigits(graded.finalScore20)} از ۲۰ در آزمون آنلاین «${exam.title}»`,
        metrics: {
          score20: graded.finalScore20,
          elapsedSeconds,
          tabSwitchCount: tabCountRef.current,
        },
        recordedAtJalali: todayJalali,
        updatedAt: nowIso,
      };

      onSubmit(submission, signal);
      showToast(
        autoSubmitted
          ? 'زمان آزمون به پایان رسید و پاسخ‌های شما به‌صورت خودکار ثبت شد.'
          : 'پاسخ‌نامه آزمون آنلاین شما با موفقیت ثبت شد.'
      );
    },
    [exam, onSubmit, showToast, student.id, totalSeconds]
  );

  // Live Countdown Timer with Auto-Submit at 0
  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          finalizeAndSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [finalizeAndSubmit]);

  // Tab-Switch Warning (visibilitychange / blur)
  useEffect(() => {
    const recordSwitch = () => {
      if (submittedRef.current) return;
      setTabSwitchCount((c) => c + 1);
      setTabWarningBanner(true);
    };
    const onVis = () => {
      if (document.hidden) recordSwitch();
    };
    window.addEventListener('blur', recordSwitch);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', recordSwitch);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const currentQuestion = orderedQuestions[currentIndex];
  const currentAnswer = currentQuestion ? answersMap[currentQuestion.id] : undefined;

  const isQuestionAnswered = (q: OnlineExamQuestion): boolean => {
    const a = answersMap[q.id];
    if (!a) return false;
    if (q.type === 'multiple_choice') return typeof a.selectedOptionIndex === 'number';
    if (q.type === 'true_false') return typeof a.trueFalseValue === 'boolean';
    if (q.type === 'fill_blank') return Boolean(a.textAnswer?.trim());
    return Boolean(a.textAnswer?.trim() || a.handwrittenMediaRef);
  };

  const answeredCount = orderedQuestions.filter(isQuestionAnswered).length;

  const updateCurrentAnswer = (patch: Partial<OnlineExamAnswer>) => {
    if (!currentQuestion) return;
    setAnswersMap((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] ?? { questionId: currentQuestion.id }),
        ...patch,
      },
    }));
  };

  const handleUploadHandwrittenPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentQuestion) return;
    const check = validateRichMediaFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!check.valid || check.data !== 'image') {
      showToast(
        check.errors[0] ?? 'لطفاً یک فایل تصویری معتبر (حداکثر ۵ مگابایت) انتخاب کنید.',
        'error'
      );
      return;
    }
    setUploadingPhoto(true);
    try {
      const mediaId = `${exam.schoolId}:exphoto:${exam.id}:${student.id}:${currentQuestion.id}:${Date.now()}`;
      await saveMediaBlob({
        mediaId,
        schoolId: exam.schoolId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        blob: file,
        createdAt: new Date().toISOString(),
      });
      const ref: MediaAttachmentRef = {
        mediaId,
        schoolId: exam.schoolId,
        kind: 'image',
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      updateCurrentAnswer({ handwrittenMediaRef: ref });
      showToast('تصویر پاسخ دست‌نویس با موفقیت پیوست شد.');
    } catch {
      showToast('ذخیره تصویر دست‌نویس انجام نشد.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!currentQuestion) return null;

  const lowTime = secondsLeft <= 120;

  return (
    <div className="space-y-5">
      {/* Sticky Distraction-Free Exam Header */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {exam.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {student.fullName} · درس {exam.subject} · پاسخ‌داده‌شده:{' '}
            {toPersianDigits(answeredCount)} از {toPersianDigits(orderedQuestions.length)} سوال
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 tabular-nums whitespace-nowrap ${
              lowTime
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>زمان باقی‌مانده: {formatCountdown(secondsLeft)}</span>
          </div>

          <button
            type="button"
            onClick={() => setConfirmSubmitOpen(true)}
            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>ثبت نهایی آزمون</span>
          </button>
        </div>
      </div>

      {/* Tab-Switch Warning Banner */}
      {tabWarningBanner && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              هشدار آزمون: خروج از صفحه آزمون ثبت شد ({toPersianDigits(tabSwitchCount)} بار) و در گزارش معلم نمایش داده می‌شود.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTabWarningBanner(false)}
            className="underline shrink-0"
          >
            متوجه شدم
          </button>
        </div>
      )}

      {/* Question Navigator Strip */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
          راهنمای سوالات (سبز = پاسخ‌داده‌شده · سفید = بی‌پاسخ)
        </div>
        <div className="flex flex-wrap gap-2">
          {orderedQuestions.map((q, idx) => {
            const answered = isQuestionAnswered(q);
            const active = idx === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-10 h-10 rounded-xl text-xs font-extrabold tabular-nums border transition-colors ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : answered
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {toPersianDigits(idx + 1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            سوال {toPersianDigits(currentIndex + 1)} از {toPersianDigits(orderedQuestions.length)} ·{' '}
            {getExamQuestionTypeLabelFa(currentQuestion.type)}
          </span>
          <span className="font-bold tabular-nums">
            بارم: {toPersianDigits(currentQuestion.points)} نمره
          </span>
        </div>

        <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-8">
          {currentQuestion.questionText}
        </p>

        {/* Answer Input by Type */}
        {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQuestion.options.map((opt, optIdx) => {
              const selected = currentAnswer?.selectedOptionIndex === optIdx;
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => updateCurrentAnswer({ selectedOptionIndex: optIdx })}
                  className={`min-h-[48px] px-4 py-3 rounded-xl border text-right text-sm transition-colors ${
                    selected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {toPersianDigits(optIdx + 1)}) {opt}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'true_false' && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {(
              [
                { value: true, label: 'صحیح است' },
                { value: false, label: 'غلط است' },
              ] as const
            ).map((choice) => {
              const selected = currentAnswer?.trueFalseValue === choice.value;
              return (
                <button
                  key={String(choice.value)}
                  type="button"
                  onClick={() => updateCurrentAnswer({ trueFalseValue: choice.value })}
                  className={`min-h-[48px] px-4 rounded-xl border text-sm font-bold transition-colors ${
                    selected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'fill_blank' && (
          <input
            type="text"
            value={currentAnswer?.textAnswer ?? ''}
            onChange={(e) => updateCurrentAnswer({ textAnswer: e.target.value })}
            placeholder="پاسخ کوتاه جای خالی را وارد کنید..."
            className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 text-sm text-slate-900 dark:text-slate-100"
          />
        )}

        {currentQuestion.type === 'descriptive' && (
          <div className="space-y-4">
            <textarea
              rows={4}
              value={currentAnswer?.textAnswer ?? ''}
              onChange={(e) => updateCurrentAnswer({ textAnswer: e.target.value })}
              placeholder="پاسخ تشریحی خود را تایپ کنید (یا عکس برگه دست‌نویس را در پایین بارگذاری نمایید)..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-slate-100"
            />

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer hover:bg-indigo-100/70">
                <Camera className="w-4 h-4" />
                <span>
                  {uploadingPhoto
                    ? 'در حال ذخیره تصویر...'
                    : 'بارگذاری عکس پاسخ دست‌نویس (حداکثر ۵ مگابایت)'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadHandwrittenPhoto}
                  className="hidden"
                />
              </label>

              {currentAnswer?.handwrittenMediaRef && (
                <MediaAttachmentPreview
                  attachment={currentAnswer.handwrittenMediaRef}
                  onRemove={() => updateCurrentAnswer({ handwrittenMediaRef: undefined })}
                />
              )}
            </div>
          </div>
        )}

        {/* Previous / Next Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <ChevronRight className="w-4 h-4" />
            <span>سوال قبلی</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            خروج بدون ثبت
          </button>

          {currentIndex < orderedQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(orderedQuestions.length - 1, i + 1))}
              className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
            >
              <span>سوال بعدی</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>پایان و ثبت پاسخ‌نامه</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirm Submit Dialog (inline modal, no window.confirm) */}
      {confirmSubmitOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تایید ثبت نهایی آزمون"
        >
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                تایید ثبت نهایی پاسخ‌نامه
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-6 tabular-nums">
              شما به {toPersianDigits(answeredCount)} سوال از {toPersianDigits(orderedQuestions.length)} سوال پاسخ داده‌اید. پس از ثبت نهایی امکان تغییر پاسخ‌ها وجود ندارد.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                بازگشت به آزمون
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSubmitOpen(false);
                  finalizeAndSubmit(false);
                }}
                className="min-h-[40px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                ثبت قطعی پاسخ‌نامه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
