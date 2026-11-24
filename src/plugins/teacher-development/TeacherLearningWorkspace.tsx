// Teacher Personal Learning, Step-by-Step Study, Anti-Cheat Shuffled Quiz & Instant Auto-Certification Workspace
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { getMediaBlob } from '../../core/data/mediaBlobStore';
import type { TeacherDevQuizSubmissionResult } from '../../core/data/DataContext';
import { PrintButtons } from '../../core/print/PrintButtons';
import type { PrintPaperSize } from '../../core/print/printService';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import type {
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevProgress,
} from '../../types/domain';
import {
  CONTENT_TYPE_LABELS,
  REQUIREMENT_LABELS,
  buildShuffledQuizAttempt,
  getChapterCompletionStats,
  isCourseOverdue,
  isQuizUnlocked,
  type TeacherStandingRow,
} from './teacherDevHelpers';

interface TeacherLearningWorkspaceProps {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  isPreviewMode: boolean;
  courses: TeacherDevCourse[];
  progressList: TeacherDevProgress[];
  certificates: TeacherDevCertificate[];
  ownStanding: TeacherStandingRow | null;
  onCompleteChapter: (courseId: string, chapterId: string) => void;
  onSubmitQuiz: (params: {
    courseId: string;
    seed: string;
    answers: Record<string, string>;
  }) => TeacherDevQuizSubmissionResult;
  onPrintCertificate: (cert: TeacherDevCertificate, size: PrintPaperSize) => void;
  onPrintTranscript: (teacherId: string, size: PrintPaperSize) => void;
}

const OPTION_LABELS = ['۱', '۲', '۳', '۴', '۵', '۶'];

export const TeacherLearningWorkspace: React.FC<TeacherLearningWorkspaceProps> = ({
  schoolId,
  teacherId,
  teacherName,
  isPreviewMode,
  courses,
  progressList,
  certificates,
  ownStanding,
  onCompleteChapter,
  onSubmitQuiz,
  onPrintCertificate,
  onPrintTranscript,
}) => {
  const [subTab, setSubTab] = useState<'mandatory' | 'optional' | 'certificates'>('mandatory');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);

  // Active quiz state
  const [quizActive, setQuizActive] = useState<boolean>(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [lastQuizResult, setLastQuizResult] = useState<TeacherDevQuizSubmissionResult | null>(null);

  // Local preview state when managers open preview mode (does not mutate real teacher records)
  const [previewCompletedChapters, setPreviewCompletedChapters] = useState<Record<string, string[]>>({});
  const [chapterBlobUrl, setChapterBlobUrl] = useState<string | null>(null);

  const todayJalali = useMemo(() => getTodayJalali(), []);

  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active'),
    [courses]
  );

  const progressByCourseId = useMemo(() => {
    const map = new Map<string, TeacherDevProgress>();
    for (const p of progressList) {
      if (p.teacherId === teacherId) map.set(p.courseId, p);
    }
    return map;
  }, [progressList, teacherId]);

  const certByCourseId = useMemo(() => {
    const map = new Map<string, TeacherDevCertificate>();
    for (const c of certificates) {
      if (c.teacherId === teacherId) map.set(c.courseId, c);
    }
    return map;
  }, [certificates, teacherId]);

  const selectedCourse = useMemo(
    () => activeCourses.find((c) => c.id === selectedCourseId) ?? null,
    [activeCourses, selectedCourseId]
  );

  const effectiveSelectedProgress = useMemo<TeacherDevProgress | null>(() => {
    if (!selectedCourse) return null;
    const real = progressByCourseId.get(selectedCourse.id) ?? null;
    if (!isPreviewMode) return real;
    const previewCh = previewCompletedChapters[selectedCourse.id];
    if (!previewCh) return real;
    return {
      id: real?.id ?? `preview-${selectedCourse.id}`,
      schoolId,
      courseId: selectedCourse.id,
      teacherId,
      completedChapterIds: Array.from(new Set([...(real?.completedChapterIds ?? []), ...previewCh])),
      attempts: real?.attempts ?? [],
      bestScorePercent: real?.bestScorePercent,
      status: real?.status ?? 'in_progress',
      updatedAt: new Date().toISOString(),
    };
  }, [selectedCourse, progressByCourseId, isPreviewMode, previewCompletedChapters, schoolId, teacherId]);

  const activeChapter = selectedCourse?.chapters[activeChapterIdx] ?? selectedCourse?.chapters[0] ?? null;

  // Load optional chapter attachment blob from IndexedDB safely
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setChapterBlobUrl(null);
    const mediaId = activeChapter?.mediaAttachment?.mediaId;
    if (!mediaId) return;

    void getMediaBlob(mediaId, schoolId).then((rec) => {
      if (!active || !rec) return;
      createdUrl = URL.createObjectURL(rec.blob);
      setChapterBlobUrl(createdUrl);
    });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [activeChapter?.mediaAttachment?.mediaId, schoolId]);

  // Deterministic anti-cheat shuffled quiz payload for the current attempt number
  const nextAttemptNumber = (effectiveSelectedProgress?.attempts.length ?? 0) + 1;
  const shuffledQuiz = useMemo(() => {
    if (!selectedCourse || !quizActive) return null;
    return buildShuffledQuizAttempt(selectedCourse, teacherId, nextAttemptNumber);
  }, [selectedCourse, quizActive, teacherId, nextAttemptNumber]);

  const openCourse = (courseId: string) => {
    const course = activeCourses.find((c) => c.id === courseId);
    const prog = progressByCourseId.get(courseId);
    const completedSet = new Set(prog?.completedChapterIds ?? []);
    const firstIncompleteIdx = course
      ? course.chapters.findIndex((ch) => !completedSet.has(ch.id))
      : 0;
    setSelectedCourseId(courseId);
    setActiveChapterIdx(firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0);
    setQuizActive(false);
    setQuizAnswers({});
    setLastQuizResult(null);
  };

  const handleMarkChapterComplete = (course: TeacherDevCourse, chapterId: string) => {
    if (isPreviewMode) {
      setPreviewCompletedChapters((prev) => ({
        ...prev,
        [course.id]: Array.from(new Set([...(prev[course.id] ?? []), chapterId])),
      }));
    } else {
      onCompleteChapter(course.id, chapterId);
    }
    if (activeChapterIdx < course.chapters.length - 1) {
      setActiveChapterIdx((prev) => prev + 1);
    }
  };

  const handleStartQuiz = () => {
    setQuizAnswers({});
    setLastQuizResult(null);
    setQuizActive(true);
  };

  const handleSubmitQuiz = () => {
    if (!selectedCourse || !shuffledQuiz) return;
    if (isPreviewMode) {
      let correctCount = 0;
      for (const q of selectedCourse.quizQuestions) {
        if (quizAnswers[q.id] === q.correctOptionId) correctCount++;
      }
      const scorePercent = Math.round((correctCount / selectedCourse.quizQuestions.length) * 100);
      setLastQuizResult({
        ok: true,
        correctCount,
        totalQuestions: selectedCourse.quizQuestions.length,
        scorePercent,
        passed: scorePercent >= selectedCourse.passingScorePercent,
      });
      setQuizActive(false);
      return;
    }

    const res = onSubmitQuiz({
      courseId: selectedCourse.id,
      seed: shuffledQuiz.seed,
      answers: quizAnswers,
    });
    setLastQuizResult(res);
    setQuizActive(false);
  };

  const mandatoryCourses = useMemo(
    () => activeCourses.filter((c) => c.requirement === 'mandatory'),
    [activeCourses]
  );
  const optionalCourses = useMemo(
    () => activeCourses.filter((c) => c.requirement === 'optional'),
    [activeCourses]
  );

  // Course Detail Study & Quiz View
  if (selectedCourse) {
    const stats = getChapterCompletionStats(selectedCourse, effectiveSelectedProgress);
    const unlocked = isQuizUnlocked(selectedCourse, effectiveSelectedProgress);
    const existingCert = certByCourseId.get(selectedCourse.id) ?? lastQuizResult?.certificate ?? null;
    const attemptsUsed = effectiveSelectedProgress?.attempts.length ?? 0;
    const remainingAttempts = Math.max(0, selectedCourse.maxAttempts - attemptsUsed);
    const completedSet = new Set(effectiveSelectedProgress?.completedChapterIds ?? []);
    const allQuestionsAnswered =
      shuffledQuiz !== null &&
      shuffledQuiz.questions.every((q) => Boolean(quizAnswers[q.id]));

    return (
      <div className="space-y-5">
        {/* Back Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedCourseId(null);
              setQuizActive(false);
              setLastQuizResult(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به فهرست دوره‌ها</span>
          </button>

          {isPreviewMode && (
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              حالت پیش‌نمایش مدیریتی (بدون تغییر در سوابق واقعی معلمان)
            </span>
          )}
        </div>

        {/* Course Overview Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {CONTENT_TYPE_LABELS[selectedCourse.contentType]} ·{' '}
                <span
                  className={
                    selectedCourse.requirement === 'mandatory'
                      ? 'font-bold text-rose-700 dark:text-rose-400'
                      : 'font-bold text-indigo-700 dark:text-indigo-300'
                  }
                >
                  {REQUIREMENT_LABELS[selectedCourse.requirement]}
                </span>{' '}
                · {toPersianDigits(selectedCourse.inServiceHours)} ساعت ضمن خدمت مصوب · مهلت{' '}
                {toPersianDigits(selectedCourse.deadlineJalali)}
                {selectedCourse.scope === 'all' && ' · منتشرشده در هر ۳ مدرسه'}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {selectedCourse.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                {selectedCourse.description}
              </p>
            </div>

            {existingCert && (
              <div className="shrink-0">
                <PrintButtons
                  documentLabel={`گواهینامه ${selectedCourse.title}`}
                  onPrint={(size) => onPrintCertificate(existingCert, size)}
                />
              </div>
            )}
          </div>

          {/* Study Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                پیشرفت مطالعه: {toPersianDigits(stats.completedCount)} از{' '}
                {toPersianDigits(stats.totalCount)} فصل
              </span>
              <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                {toPersianDigits(stats.percent)}٪
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Celebratory Auto-Issued Certificate Banner */}
        {existingCert && (
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Award className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                  تبریک! دوره با موفقیت تکمیل و گواهینامه شما صادر شد
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mt-1 tabular-nums">
                  شماره گواهینامه:{' '}
                  <strong dir="ltr" className="inline-block font-mono">
                    {toPersianDigits(existingCert.serialNumber)}
                  </strong>{' '}
                  ·
                  نمره آزمون: <strong>{toPersianDigits(existingCert.scorePercent)}٪</strong> ·
                  ساعات مصوب: <strong>{toPersianDigits(existingCert.inServiceHours)} ساعت</strong> ·
                  تاریخ صدور: {formatJalaliDisplay(existingCert.issuedDateJalali, false)}
                </p>
              </div>
            </div>
            <PrintButtons
              documentLabel={`گواهینامه ${existingCert.courseTitle}`}
              onPrint={(size) => onPrintCertificate(existingCert, size)}
            />
          </div>
        )}

        {/* Quiz Failed Feedback (Does NOT leak correct answer key while retries remain) */}
        {lastQuizResult && !lastQuizResult.passed && !quizActive && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-amber-900 dark:text-amber-200">
                نمره کسب‌شده: {toPersianDigits(lastQuizResult.scorePercent ?? 0)}٪ (حد نصاب قبولی:{' '}
                {toPersianDigits(selectedCourse.passingScorePercent)}٪)
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                پاسخ صحیح {toPersianDigits(lastQuizResult.correctCount ?? 0)} از{' '}
                {toPersianDigits(lastQuizResult.totalQuestions ?? 0)} سوال بود. جهت حفظ اعتبار آزمون، کلید پاسخ‌ها نمایش داده نمی‌شود؛ لطفاً فصل‌ها را مرور کرده و مجدداً تلاش کنید.
              </p>
            </div>
            {remainingAttempts > 0 && (
              <button
                type="button"
                onClick={handleStartQuiz}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold"
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  شروع تلاش مجدد ({toPersianDigits(remainingAttempts)} فرصت باقی‌مانده)
                </span>
              </button>
            )}
          </div>
        )}

        {/* Active Shuffled Anti-Cheat Quiz Runner */}
        {quizActive && shuffledQuiz ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  آزمون کوتاه پایانی — تلاش شماره {toPersianDigits(shuffledQuiz.attemptNumber)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    چیدمان سوالات و گزینه‌ها اختصاصاً برای حساب شما و این نوبت به‌صورت تصادفی تنظیم شده است. حد نصاب قبولی:{' '}
                    {toPersianDigits(selectedCourse.passingScorePercent)}٪
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuizActive(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                انصراف و بازگشت به مطالعه
              </button>
            </div>

            <div className="space-y-4">
              {shuffledQuiz.questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 space-y-3"
                >
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                    {toPersianDigits(qIdx + 1)}. {q.prompt}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const chosen = quizAnswers[q.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setQuizAnswers((prev) => ({
                              ...prev,
                              [q.id]: opt.id,
                            }))
                          }
                          aria-pressed={chosen}
                          className={`text-right rounded-xl border px-3.5 py-3 text-xs sm:text-sm transition-colors flex items-start gap-2.5 ${
                            chosen
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 font-bold'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              chosen
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {OPTION_LABELS[optIdx] ?? toPersianDigits(optIdx + 1)}
                          </span>
                          <span className="leading-relaxed">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                پاسخ‌داده‌شده: {toPersianDigits(Object.keys(quizAnswers).length)} از{' '}
                {toPersianDigits(shuffledQuiz.questions.length)} سوال
              </span>
              <button
                type="button"
                disabled={!allQuestionsAnswered}
                onClick={handleSubmitQuiz}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 text-xs sm:text-sm font-bold"
              >
                ثبت نهایی پاسخ‌ها و مشاهده نتیجه
              </button>
            </div>
          </div>
        ) : (
          /* Step-by-Step Chapter Study Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chapter Stepper Sidebar */}
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2">
                  فصل‌های مطالعاتی دوره
                </h3>
                {selectedCourse.chapters.map((ch, idx) => {
                  const done = completedSet.has(ch.id);
                  const isCurrent = idx === activeChapterIdx;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setActiveChapterIdx(idx)}
                      className={`w-full text-right rounded-xl border px-3.5 py-3 transition-colors flex items-start gap-2.5 ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 inline-block" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          فصل {toPersianDigits(idx + 1)}: {ch.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          حدود {toPersianDigits(ch.estimatedMinutes)} دقیقه ·{' '}
                          {done ? 'مطالعه تکمیل شده' : 'در انتظار مطالعه'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Final Quiz Lock / Unlock Box */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    آزمون کوتاه پایانی
                  </h4>
                  {!unlocked && <Lock className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed tabular-nums">
                  {existingCert
                    ? 'شما با موفقیت این آزمون را گذرانده و گواهینامه ضمن خدمت را دریافت کرده‌اید.'
                    : unlocked
                      ? `${toPersianDigits(selectedCourse.quizQuestions.length)} سوال چهارگزینه‌ای · حد نصاب قبولی ${toPersianDigits(selectedCourse.passingScorePercent)}٪ · ${toPersianDigits(remainingAttempts)} فرصت باقی‌مانده`
                      : `برای باز شدن آزمون پایانی، ابتدا مطالعه تمام ${toPersianDigits(selectedCourse.chapters.length)} فصل دوره را تکمیل و ثبت کنید.`}
                </p>
                {!existingCert && (
                  <button
                    type="button"
                    disabled={!unlocked || remainingAttempts <= 0}
                    onClick={handleStartQuiz}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                      unlocked && remainingAttempts > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {unlocked ? <PlayCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    <span>
                      {!unlocked
                        ? 'آزمون پایانی قفل است (تکمیل فصل‌ها الزامی است)'
                        : remainingAttempts <= 0
                          ? 'سقف تلاش‌های مجاز تکمیل شده است'
                          : attemptsUsed > 0
                            ? 'تلاش مجدد در آزمون کوتاه پایانی'
                            : 'شروع آزمون کوتاه پایانی'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Chapter Reading Pane */}
            <div className="lg:col-span-8">
              {activeChapter && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        فصل {toPersianDigits(activeChapterIdx + 1)} از{' '}
                        {toPersianDigits(selectedCourse.chapters.length)}
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                        {activeChapter.title}
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{toPersianDigits(activeChapter.estimatedMinutes)} دقیقه مطالعه</span>
                    </span>
                  </div>

                  <div className="text-sm text-slate-700 dark:text-slate-200 leading-8 whitespace-pre-line">
                    {activeChapter.content}
                  </div>

                  {/* Optional External Link or Uploaded File */}
                  {(activeChapter.externalUrl || chapterBlobUrl) && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        منابع و پیوست‌های این فصل
                      </div>
                      {activeChapter.externalUrl && (
                        <a
                          href={activeChapter.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>مشاهده منبع تکمیلی / ویدیو</span>
                        </a>
                      )}
                      {chapterBlobUrl && (
                        <div className="space-y-2">
                          {activeChapter.mediaAttachment?.mimeType?.startsWith('image/') ? (
                            <img
                              src={chapterBlobUrl}
                              alt={activeChapter.mediaAttachment?.fileName ?? 'پیوست فصل'}
                              className="max-h-72 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                            />
                          ) : (
                            <a
                              href={chapterBlobUrl}
                              download={
                                activeChapter.mediaAttachment?.fileName ?? 'chapter-attachment.pdf'
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                            >
                              <FileText className="w-4 h-4 text-indigo-600" />
                              <span>
                                دریافت فایل پیوست ({activeChapter.mediaAttachment?.fileName})
                              </span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mark Chapter Complete Action */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    {completedSet.has(activeChapter.id) ? (
                      <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>مطالعه این فصل قبلاً با موفقیت ثبت شده است.</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkChapterComplete(selectedCourse, activeChapter.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تکمیل و ثبت مطالعه این فصل</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      {activeChapterIdx > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveChapterIdx((i) => i - 1)}
                          className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          فصل قبلی
                        </button>
                      )}
                      {activeChapterIdx < selectedCourse.chapters.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setActiveChapterIdx((i) => i + 1)}
                          className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          فصل بعدی
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Teacher Portal Dashboard View
  const displayedCourses = subTab === 'mandatory' ? mandatoryCourses : optionalCourses;

  return (
    <div className="space-y-5">
      {isPreviewMode && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 px-4 py-3 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200">
          شما در حال مشاهده <strong>پیش‌نمایش نمای معلم</strong> ({teacherName}) هستید. برای تجربه مطالعه و آزمون واقعی با ذخیره در پایگاه داده، با حساب معلم وارد شوید.
        </div>
      )}

      {/* Personal Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            ساعات ضمن خدمت مصوب شما
          </div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(ownStanding?.totalApprovedHours ?? 0)}{' '}
            <span className="text-xs font-medium">ساعت</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            دوره‌های الزامی تکمیل‌شده
          </div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(ownStanding?.mandatoryCompletedCount ?? 0)}{' '}
            <span className="text-sm font-medium text-slate-500">
              از {toPersianDigits(mandatoryCourses.length)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            سطح ۵گانه و امتیاز کل
          </div>
          <div className="mt-1 text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
            {ownStanding?.tier.titleFa ?? 'سطح ۱ — همکار تازه‌مسیر'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {toPersianDigits(ownStanding?.points ?? 0)} امتیاز
            {ownStanding?.nextTier
              ? ` · ${toPersianDigits(ownStanding.pointsToNextTier)} امتیاز تا سطح بعدی`
              : ' · بالاترین سطح'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              کارنامه ضمن خدمت من
            </span>
            <span className="text-xs font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
              {toPersianDigits(certificates.filter((c) => c.teacherId === teacherId).length)} گواهی
            </span>
          </div>
          <PrintButtons
            compact
            documentLabel="کارنامه ضمن خدمت من"
            onPrint={(size) => onPrintTranscript(teacherId, size)}
          />
        </div>
      </div>

      {/* Filter Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSubTab('mandatory')}
          className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors ${
            subTab === 'mandatory'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          دوره‌های الزامی ({toPersianDigits(mandatoryCourses.length)})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('optional')}
          className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors ${
            subTab === 'optional'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          دوره‌های اختیاری ({toPersianDigits(optionalCourses.length)})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('certificates')}
          className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors ${
            subTab === 'certificates'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          تکمیل‌شده و گواهینامه‌ها (
          {toPersianDigits(certificates.filter((c) => c.teacherId === teacherId).length)})
        </button>
      </div>

      {/* Certificates Tab */}
      {subTab === 'certificates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.filter((c) => c.teacherId === teacherId).length === 0 ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              هنوز گواهینامه‌ای صادر نشده است. با تکمیل فصل‌ها و قبولی در آزمون پایانی هر دوره، گواهینامه شما به‌صورت خودکار اینجا ثبت می‌شود.
            </div>
          ) : (
            certificates
              .filter((c) => c.teacherId === teacherId)
              .map((cert) => (
                <div
                  key={cert.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {CONTENT_TYPE_LABELS[cert.contentType]} ·{' '}
                        {REQUIREMENT_LABELS[cert.requirement]}
                      </span>
                      <span
                        dir="ltr"
                        className="inline-block font-mono font-bold text-emerald-700 dark:text-emerald-400"
                      >
                        {toPersianDigits(cert.serialNumber)}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {cert.courseTitle}
                    </h4>
                    <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                      {toPersianDigits(cert.inServiceHours)} ساعت ضمن خدمت مصوب · نمره آزمون:{' '}
                      <strong>{toPersianDigits(cert.scorePercent)}٪</strong> · صدور:{' '}
                      {formatJalaliDisplay(cert.issuedDateJalali, false)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <Award className="w-4 h-4" />
                      <span>گواهینامه معتبر صادرشده</span>
                    </span>
                    <PrintButtons
                      compact
                      documentLabel={`گواهینامه ${cert.courseTitle}`}
                      onPrint={(size) => onPrintCertificate(cert, size)}
                    />
                  </div>
                </div>
              ))
          )}
        </div>
      ) : (
        /* Course Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedCourses.length === 0 ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              در حال حاضر دوره‌ای در این بخش تعریف نشده است.
            </div>
          ) : (
            displayedCourses.map((course) => {
              const prog = progressByCourseId.get(course.id);
              const cert = certByCourseId.get(course.id);
              const stats = getChapterCompletionStats(course, prog);
              const overdue = isCourseOverdue(course, todayJalali, prog);
              const unlocked = isQuizUnlocked(course, prog);

              return (
                <div
                  key={course.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          {CONTENT_TYPE_LABELS[course.contentType]} ·{' '}
                          {toPersianDigits(course.inServiceHours)} ساعت
                        </span>
                      </span>
                      {course.scope === 'all' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          <Globe className="w-3.5 h-3.5" />
                          <span>منتشرشده در هر ۳ مدرسه</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                      {course.description}
                    </p>

                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      مهلت تکمیل:{' '}
                      <strong
                        className={
                          overdue
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }
                      >
                        {toPersianDigits(course.deadlineJalali)}
                        {overdue ? ' (گذشته از مهلت)' : ''}
                      </strong>{' '}
                      · {toPersianDigits(course.chapters.length)} فصل ·{' '}
                      {toPersianDigits(course.quizQuestions.length)} سوال آزمون
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {cert
                            ? `تکمیل‌شده (نمره ${toPersianDigits(cert.scorePercent)}٪)`
                            : `مطالعه فصل‌ها: ${toPersianDigits(stats.completedCount)} از ${toPersianDigits(stats.totalCount)}`}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {toPersianDigits(cert ? 100 : stats.percent)}٪
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cert ? 'bg-emerald-600' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${cert ? 100 : stats.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    {cert ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openCourse(course.id)}
                          className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          مرور محتوای دوره
                        </button>
                        <PrintButtons
                          compact
                          documentLabel={`گواهینامه ${course.title}`}
                          onPrint={(size) => onPrintCertificate(cert, size)}
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {unlocked
                            ? 'آزمون پایانی آماده شرکت است'
                            : 'آزمون پس از تکمیل فصل‌ها باز می‌شود'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openCourse(course.id)}
                          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold"
                        >
                          {stats.completedCount > 0 ? 'ادامه مطالعه و آزمون' : 'شروع مطالعه دوره'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
