// Strict Student Video Player: Built-in 60s Interactive Persian Lesson OR IndexedDB Blob Video
// Enforces: No Forward Seeking («قفل جلو زدن»), Auto-Pause on Tab Switch, Second-by-Second Speed Telemetry,
// «سوال دارم از این دقیقه» timestamp capture, and Automatic Post-Video Micro-Quiz (>= 85% watched)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FastForward,
  HelpCircle,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { getMediaBlob } from '../../core/data/mediaBlobStore';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  FlippedSecondWatchState,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
  FlippedVideoTelemetry,
  Student,
  Student360Signal,
} from '../../types/domain';
import { FlippedTimelineBar } from './FlippedTimelineBar';
import {
  clampForwardSeek,
  classifyPlaybackSpeed,
  computeWatchMetrics,
  formatMmSs,
  gradeMicroQuiz,
  MICRO_QUIZ_UNLOCK_THRESHOLD_PERCENT,
} from './flippedVideoHelpers';

interface FlippedVideoPlayerProps {
  lesson: FlippedVideoLesson;
  student: Student;
  initialTelemetry?: FlippedVideoTelemetry;
  studentQuestions: FlippedTimestampQuestion[];
  onPersistTelemetry: (telemetry: FlippedVideoTelemetry) => void;
  onAddQuestion: (question: FlippedTimestampQuestion) => void;
  onCompleteMicroQuiz: (params: {
    lesson: FlippedVideoLesson;
    telemetry: FlippedVideoTelemetry;
    signal: Student360Signal;
  }) => void;
  isPreviewMode?: boolean;
}

const DEMO_SLIDES = [
  {
    start: 0,
    end: 15,
    chapter: 'بخش ۱ از ۴ — مفهوم کسر مساوی',
    heading: 'دو کسر با شکل متفاوت اما مقدار یکسان',
    body: 'اگر یک پیتزا را به ۲ قسمت تقسیم کنیم و ۱ تکه برداریم (۱/۲)، دقیقاً برابر است با زمانی که به ۴ قسمت تقسیم کرده و ۲ تکه برداریم (۲/۴).',
    formula: '۱/۲ = ۲/۴ = ۳/۶',
  },
  {
    start: 15,
    end: 30,
    chapter: 'بخش ۲ از ۴ — قانون ضرب صورت و مخرج',
    heading: 'چگونه کسر مساوی بسازیم؟',
    body: 'هرگاه صورت و مخرج یک کسر را در یک عدد غیرصفر (مثل ۲، ۳ یا ۵) ضرب کنیم، اندازه کسر تغییر نمی‌کند و کسر مساوی ساخته می‌شود.',
    formula: '(۲ × ۳) / (۳ × ۳) = ۶/۹',
  },
  {
    start: 30,
    end: 45,
    chapter: 'بخش ۳ از ۴ — ساده کردن کسرها',
    heading: 'تقسیم هم‌زمان صورت و مخرج',
    body: 'برای ساده‌کردن کسر ۴/۸، بزرگ‌ترین عدد مشترک یعنی ۴ را پیدا کرده و صورت و مخرج را بر ۴ تقسیم می‌کنیم تا به ۱/۲ برسیم.',
    formula: '۴/۸ ÷ ۴ = ۱/۲',
  },
  {
    start: 45,
    end: 61,
    chapter: 'بخش ۴ از ۴ — جمع‌بندی و آمادگی برای تستک',
    heading: 'نکته طلایی امتحان ریاضی',
    body: 'همیشه بررسی کنید صورت و مخرج هر دو در یک عدد یکسان ضرب یا تقسیم شده باشند؛ جمع کردن عدد با صورت و مخرج کسر مساوی نمی‌سازد!',
    formula: 'آماده پاسخ به تستک ۳ سوالی',
  },
];

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

export const FlippedVideoPlayer: React.FC<FlippedVideoPlayerProps> = ({
  lesson,
  student,
  initialTelemetry,
  studentQuestions,
  onPersistTelemetry,
  onAddQuestion,
  onCompleteMicroQuiz,
  isPreviewMode = false,
}) => {
  const { showToast } = useToast();
  const duration = Math.max(10, Math.floor(lesson.durationSeconds || 60));

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSecond, setCurrentSecond] = useState<number>(
    Math.min(duration, initialTelemetry?.lastPositionSecond ?? 0)
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [maxWatchedSecond, setMaxWatchedSecond] = useState<number>(
    initialTelemetry?.maxWatchedSecond ?? 0
  );
  const [secondStates, setSecondStates] = useState<Record<string, FlippedSecondWatchState>>(
    () => ({ ...(initialTelemetry?.secondStates ?? {}) })
  );
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(
    initialTelemetry?.tabSwitchCount ?? 0
  );
  const [tabPauseNotice, setTabPauseNotice] = useState<boolean>(false);
  const [seekBlockNotice, setSeekBlockNotice] = useState<string | null>(null);
  const [blobVideoUrl, setBlobVideoUrl] = useState<string | null>(null);

  // Timestamped question composer state
  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false);
  const [capturedSecond, setCapturedSecond] = useState<number>(0);
  const [questionText, setQuestionText] = useState('');

  // Micro-Quiz state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>(() =>
    lesson.microQuiz.map(() => -1)
  );
  const [quizAttempt, setQuizAttempt] = useState(initialTelemetry?.microQuizAttempt);
  const autoOpenedQuizRef = useRef<boolean>(Boolean(initialTelemetry?.microQuizAttempt));

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Refs for latest telemetry flush without re-binding timers
  const telemetrySnapshotRef = useRef({
    currentSecond,
    maxWatchedSecond,
    secondStates,
    tabSwitchCount,
    quizAttempt,
  });
  telemetrySnapshotRef.current = {
    currentSecond,
    maxWatchedSecond,
    secondStates,
    tabSwitchCount,
    quizAttempt,
  };

  // Load IndexedDB blob URL if this lesson uses an uploaded video file
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (lesson.videoSource === 'uploaded_blob' && lesson.videoMediaRef) {
      void getMediaBlob(lesson.videoMediaRef.mediaId, lesson.schoolId).then((rec) => {
        if (!active || !rec) return;
        objectUrl = URL.createObjectURL(rec.blob);
        setBlobVideoUrl(objectUrl);
      });
    } else {
      setBlobVideoUrl(null);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lesson.videoSource, lesson.videoMediaRef, lesson.schoolId]);

  const watchMetrics = useMemo(
    () => computeWatchMetrics(secondStates, duration),
    [secondStates, duration]
  );

  const buildTelemetryPayload = useCallback((): FlippedVideoTelemetry => {
    const snap = telemetrySnapshotRef.current;
    const metrics = computeWatchMetrics(snap.secondStates, duration);
    return {
      id: `${lesson.schoolId}:fvtel:${lesson.id}:${student.id}`,
      schoolId: lesson.schoolId,
      lessonId: lesson.id,
      classId: lesson.classId,
      studentId: student.id,
      durationSeconds: duration,
      maxWatchedSecond: snap.maxWatchedSecond,
      lastPositionSecond: Math.floor(snap.currentSecond),
      secondStates: snap.secondStates,
      tabSwitchCount: snap.tabSwitchCount,
      microQuizUnlocked: metrics.isMicroQuizUnlocked || Boolean(snap.quizAttempt),
      microQuizAttempt: snap.quizAttempt,
      updatedAt: new Date().toISOString(),
    };
  }, [duration, lesson.classId, lesson.id, lesson.schoolId, student.id]);

  const persistNow = useCallback(() => {
    if (isPreviewMode) return;
    onPersistTelemetry(buildTelemetryPayload());
  }, [buildTelemetryPayload, isPreviewMode, onPersistTelemetry]);

  const persistNowRef = useRef(persistNow);
  persistNowRef.current = persistNow;

  // Auto-open Micro-Quiz the moment >= 85% unique seconds threshold is reached
  useEffect(() => {
    if (watchMetrics.isMicroQuizUnlocked && !quizAttempt && !autoOpenedQuizRef.current) {
      autoOpenedQuizRef.current = true;
      setIsPlaying(false);
      if (videoElRef.current) videoElRef.current.pause();
      setQuizOpen(true);
      persistNowRef.current();
    }
  }, [watchMetrics.isMicroQuizUnlocked, quizAttempt]);

  // Auto-Pause on Tab Switch / Window Blur
  useEffect(() => {
    const handleLeavePage = () => {
      if (!isPlayingRef.current) return;
      setIsPlaying(false);
      if (videoElRef.current) videoElRef.current.pause();
      setTabPauseNotice(true);
      setTabSwitchCount((c) => {
        const next = c + 1;
        telemetrySnapshotRef.current.tabSwitchCount = next;
        return next;
      });
      setTimeout(() => persistNowRef.current(), 50);
    };

    const onVisibility = () => {
      if (document.hidden) handleLeavePage();
    };
    const onBlur = () => {
      handleLeavePage();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Persist periodically every 3 seconds while playing & on true unmount only
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      persistNowRef.current();
    }, 3000);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      const snap = telemetrySnapshotRef.current;
      if (Object.keys(snap.secondStates).length > 0 || snap.tabSwitchCount > 0) {
        persistNowRef.current();
      }
    };
  }, []);

  // Built-in 60s Interactive Demo Timer Loop (pure React/CSS)
  useEffect(() => {
    if (lesson.videoSource !== 'demo_60s' || !isPlaying) return;
    const tickMs = Math.max(120, Math.round(1000 / playbackRate));
    const speedState = classifyPlaybackSpeed(playbackRate);

    const timer = window.setInterval(() => {
      setCurrentSecond((prev) => {
        const secIndex = Math.min(duration - 1, Math.floor(prev));
        setSecondStates((map) => {
          // Preserve 'normal' if already watched at normal speed, or record current state
          if (map[String(secIndex)] === 'normal' && speedState === 'fast') {
            return map;
          }
          if (map[String(secIndex)] === speedState) return map;
          return { ...map, [String(secIndex)]: speedState };
        });
        const nextSec = prev + 1;
        setMaxWatchedSecond((mw) => Math.max(mw, Math.min(duration, nextSec)));
        if (nextSec >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return nextSec;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [lesson.videoSource, isPlaying, playbackRate, duration]);

  // Sync HTML5 video playbackRate
  useEffect(() => {
    if (videoElRef.current) {
      videoElRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    setTabPauseNotice(false);
    setSeekBlockNotice(null);
    if (lesson.videoSource === 'uploaded_blob' && videoElRef.current) {
      if (isPlaying) {
        videoElRef.current.pause();
        setIsPlaying(false);
        persistNow();
      } else {
        void videoElRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      persistNow();
    } else {
      if (currentSecond >= duration) {
        setCurrentSecond(0);
      }
      setIsPlaying(true);
    }
  };

  const handleSeekRequest = (requestedSec: number) => {
    const check = clampForwardSeek(requestedSec, maxWatchedSecond, duration);
    if (!check.allowed) {
      setSeekBlockNotice('برای یادگیری کامل، امکان جلو زدن بخش‌های دیده‌نشده وجود ندارد.');
      setCurrentSecond(check.targetSecond);
      if (videoElRef.current) {
        videoElRef.current.currentTime = check.targetSecond;
      }
      return;
    }
    setSeekBlockNotice(null);
    setCurrentSecond(check.targetSecond);
    if (videoElRef.current) {
      videoElRef.current.currentTime = check.targetSecond;
    }
  };

  const handleRewind5s = () => {
    handleSeekRequest(Math.max(0, currentSecond - 5));
  };

  const handleHtmlVideoTimeUpdate = () => {
    const el = videoElRef.current;
    if (!el) return;
    const nowSec = Math.floor(el.currentTime);
    const check = clampForwardSeek(nowSec, maxWatchedSecond, duration);
    if (!check.allowed) {
      el.currentTime = check.targetSecond;
      setSeekBlockNotice('برای یادگیری کامل، امکان جلو زدن بخش‌های دیده‌نشده وجود ندارد.');
      return;
    }
    setCurrentSecond(nowSec);
    setMaxWatchedSecond((mw) => Math.max(mw, nowSec));
    const speedState = classifyPlaybackSpeed(el.playbackRate);
    setSecondStates((map) => {
      if (map[String(nowSec)] === 'normal' && speedState === 'fast') return map;
      if (map[String(nowSec)] === speedState) return map;
      return { ...map, [String(nowSec)]: speedState };
    });
  };

  const handleOpenQuestionDrawer = () => {
    setIsPlaying(false);
    if (videoElRef.current) videoElRef.current.pause();
    setCapturedSecond(Math.floor(currentSecond));
    setQuestionDrawerOpen(true);
    persistNow();
  };

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionText.trim().length < 4) {
      showToast('لطفاً متن سوال خود را حداقل در ۴ کاراکتر بنویسید.', 'error');
      return;
    }
    const newQ: FlippedTimestampQuestion = {
      id: `${lesson.schoolId}:fvq:${lesson.id}:${Date.now()}`,
      schoolId: lesson.schoolId,
      lessonId: lesson.id,
      classId: lesson.classId,
      studentId: student.id,
      studentName: student.fullName,
      timestampSecond: capturedSecond,
      questionText: questionText.trim(),
      createdAtJalali: getTodayJalali(),
      createdAt: new Date().toISOString(),
    };
    onAddQuestion(newQ);
    setQuestionText('');
    setQuestionDrawerOpen(false);
    showToast(`سوال شما در دقیقه ${formatMmSs(capturedSecond)} برای معلم ثبت شد.`);
  };

  const handleSubmitMicroQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (quizAnswers.some((a) => a < 0)) {
      showToast('لطفاً به همه سوالات تستک درک مطلب پاسخ دهید.', 'error');
      return;
    }

    const graded = gradeMicroQuiz(lesson.microQuiz, quizAnswers);
    const nowIso = new Date().toISOString();
    const todayJalali = getTodayJalali();
    const attempt = {
      selectedOptionIndices: [...quizAnswers],
      correctCount: graded.correctCount,
      totalCount: graded.totalCount,
      score20: graded.score20,
      descriptiveStatus: graded.descriptiveStatus,
      completedAtIso: nowIso,
      completedAtJalali: todayJalali,
      syncedToGradebook: true,
    };
    setQuizAttempt(attempt);
    telemetrySnapshotRef.current.quizAttempt = attempt;

    const updatedTel: FlippedVideoTelemetry = {
      ...buildTelemetryPayload(),
      microQuizUnlocked: true,
      microQuizAttempt: attempt,
    };

    const signal: Student360Signal = {
      id: `${lesson.schoolId}:s360:flipped_video:${lesson.id}:${student.id}`,
      schoolId: lesson.schoolId,
      studentId: student.id,
      classId: lesson.classId,
      subject: lesson.subject,
      source: 'flipped_video',
      sourceEntityId: lesson.id,
      title: lesson.title,
      score20: graded.score20,
      statusLabelFa: graded.descriptiveStatus,
      summaryFa: `تماشای ${toPersianDigits(watchMetrics.watchedPercent)}٪ ویدیو و کسب نمره ${toPersianDigits(graded.score20)} از ۲۰ در تستک درک مطلب`,
      metrics: {
        watchedPercent: watchMetrics.watchedPercent,
        normalSeconds: watchMetrics.normalSeconds,
        fastSeconds: watchMetrics.fastSeconds,
        tabSwitchCount,
      },
      recordedAtJalali: todayJalali,
      updatedAt: nowIso,
    };

    if (!isPreviewMode) {
      onCompleteMicroQuiz({ lesson, telemetry: updatedTel, signal });
    }
    showToast(
      `نتیجه تستک ثبت شد: ${graded.descriptiveStatus} (${toPersianDigits(graded.score20)} از ۲۰) و به دفتر نمره منتقل گردید.`
    );
  };

  const activeDemoSlide =
    DEMO_SLIDES.find((s) => currentSecond >= s.start && currentSecond < s.end) ??
    DEMO_SLIDES[DEMO_SLIDES.length - 1];

  return (
    <div className="space-y-5">
      {/* Main Video Stage + Side Question Trigger */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="relative bg-slate-950 text-white">
          {lesson.videoSource === 'uploaded_blob' && blobVideoUrl ? (
            <video
              ref={videoElRef}
              src={blobVideoUrl}
              onTimeUpdate={handleHtmlVideoTimeUpdate}
              onEnded={() => {
                setIsPlaying(false);
                persistNow();
              }}
              className="w-full max-h-[380px] object-contain bg-black"
              playsInline
            />
          ) : (
            /* Built-in 60-Second Interactive Animated Persian Lesson Stage */
            <div className="p-6 sm:p-8 min-h-[290px] sm:min-h-[330px] flex flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-200">
                <span className="font-bold">{activeDemoSlide.chapter}</span>
                <span className="tabular-nums text-slate-300">
                  {lesson.subject} · {lesson.teacherName}
                </span>
              </div>

              <div className="my-5 space-y-3 max-w-2xl">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                  {activeDemoSlide.heading}
                </h3>
                <p className="text-sm sm:text-base text-slate-200 leading-7">
                  {activeDemoSlide.body}
                </p>

                {/* Animated Visual Fraction Bar Demonstration */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/10 border border-white/15 p-3">
                    <div className="text-xs text-indigo-200 mb-1.5 font-semibold">
                      نمایش تصویری کسر ۱/۲
                    </div>
                    <div className="grid grid-cols-2 gap-1 h-6">
                      <div className="rounded bg-emerald-500/90 transition-opacity duration-300" />
                      <div className="rounded bg-white/15" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/15 p-3">
                    <div className="text-xs text-indigo-200 mb-1.5 font-semibold">
                      کسر مساوی ۳/۶
                    </div>
                    <div className="grid grid-cols-6 gap-1 h-6">
                      <div className="rounded bg-emerald-500/90" />
                      <div className="rounded bg-emerald-500/90" />
                      <div className="rounded bg-emerald-500/90" />
                      <div className="rounded bg-white/15" />
                      <div className="rounded bg-white/15" />
                      <div className="rounded bg-white/15" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                <span className="text-sm font-extrabold text-amber-300 tabular-nums">
                  {activeDemoSlide.formula}
                </span>
                <span className="text-xs text-slate-300 tabular-nums">
                  حالت نمایشی تعاملی ۶۰ ثانیه‌ای {isPlaying ? '· در حال پخش' : '· متوقف'}
                </span>
              </div>
            </div>
          )}

          {/* Auto-Pause on Tab Switch Overlay */}
          {tabPauseNotice && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-6 z-20">
              <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-amber-500/50 p-5 text-center space-y-3">
                <ShieldAlert className="w-9 h-9 text-amber-400 mx-auto" />
                <p className="text-sm font-bold text-white leading-6">
                  پخش ویدیو به دلیل خروج از صفحه متوقف شد — برای ادامه دکمه پخش را بزنید.
                </p>
                <p className="text-xs text-slate-300 tabular-nums">
                  تعداد خروج از صفحه در این درس: {toPersianDigits(tabSwitchCount)} بار
                </p>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>ادامه تماشای ویدیو</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Strict Scrubber + Controls Bar */}
        <div className="p-4 sm:p-5 space-y-4 bg-white dark:bg-slate-900">
          {seekBlockNotice && (
            <div
              role="alert"
              className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{seekBlockNotice}</span>
            </div>
          )}

          {/* Scrubber with No-Forward-Seeking Lock */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>
                زمان فعلی: <strong className="text-slate-900 dark:text-slate-100">{formatMmSs(currentSecond)}</strong> از{' '}
                {formatMmSs(duration)}
              </span>
              <span>
                حداکثر زمان دیده‌شده: {formatMmSs(maxWatchedSecond)} · پیشرفت تماشا:{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">
                  {toPersianDigits(watchMetrics.watchedPercent)}٪
                </strong>
              </span>
            </div>
            <input
              type="range"
              dir="ltr"
              min={0}
              max={duration}
              value={Math.min(duration, Math.floor(currentSecond))}
              onChange={(e) => handleSeekRequest(Number(e.target.value))}
              aria-label="نوار زمان ویدیو با قفل جلو زدن"
              className="w-full accent-indigo-600 cursor-pointer h-2 rounded-lg"
            />
          </div>

          {/* Primary Controls + Always-Visible Timestamped Question Button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'توقف موقت' : 'پخش ویدیو'}</span>
              </button>

              <button
                type="button"
                onClick={handleRewind5s}
                className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>۵ ثانیه عقب</span>
              </button>

              {/* Playback Speed Selector */}
              <div
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
                role="group"
                aria-label="سرعت پخش ویدیو"
              >
                <FastForward className="w-3.5 h-3.5 text-slate-500 mx-1" />
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                      playbackRate === rate
                        ? rate > 1.15
                          ? 'bg-amber-500 text-white'
                          : 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {toPersianDigits(rate)}x
                  </button>
                ))}
              </div>
            </div>

            {/* Always-Visible «سوال دارم از این دقیقه» Button */}
            <button
              type="button"
              onClick={handleOpenQuestionDrawer}
              className="min-h-[42px] px-4 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4" />
              <span>سوال دارم از این دقیقه ({formatMmSs(currentSecond)})</span>
            </button>
          </div>

          {/* Live Color-Coded Student Watch Timeline */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <FlippedTimelineBar
              durationSeconds={duration}
              secondStates={secondStates}
              questions={studentQuestions}
              label="نوار خط‌زمانی تماشای شما"
              compact
            />
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                سرعت عادی: {toPersianDigits(watchMetrics.normalSeconds)} ثانیه
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                سرعت بالا: {toPersianDigits(watchMetrics.fastSeconds)} ثانیه
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-700 inline-block" />
                دیده‌نشده: {toPersianDigits(watchMetrics.unwatchedSeconds)} ثانیه
              </span>
              {tabSwitchCount > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  خروج از صفحه: {toPersianDigits(tabSwitchCount)} بار
                </span>
              )}
            </div>
          </div>

          {/* Timestamped Question Input Drawer */}
          {questionDrawerOpen && (
            <form
              onSubmit={handleSubmitQuestion}
              className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-800 dark:text-indigo-300">
                  ثبت سوال در زمان دقیق {formatMmSs(capturedSecond)}
                </span>
                <button
                  type="button"
                  onClick={() => setQuestionDrawerOpen(false)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  بستن
                </button>
              </div>
              <textarea
                rows={2}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="سوال خود را درباره همین بخش از ویدیو بنویسید تا در کارت کلاس رفع اشکال معلم نمایش داده شود..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ثبت سوال برای معلم</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Automatic Post-Video Micro-Quiz Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              تستک درک مطلب ({toPersianDigits(lesson.microQuiz.length)} سوال چهارگزینه‌ای)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {quizAttempt
                ? `تکمیل شده در تاریخ ${toPersianDigits(quizAttempt.completedAtJalali)} · متصل به دفتر نمره`
                : watchMetrics.isMicroQuizUnlocked
                ? 'حدنصاب ۸۵٪ تماشا تکمیل شد — اکنون می‌توانید تستک درک مطلب را پاسخ دهید.'
                : `برای باز شدن قفل تستک، حداقل ${toPersianDigits(MICRO_QUIZ_UNLOCK_THRESHOLD_PERCENT)}٪ از ویدیو را تماشا کنید (وضعیت فعلی: ${toPersianDigits(watchMetrics.watchedPercent)}٪).`}
            </p>
          </div>

          {!quizAttempt && (
            <button
              type="button"
              disabled={!watchMetrics.isMicroQuizUnlocked}
              onClick={() => setQuizOpen((v) => !v)}
              className={`min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                watchMetrics.isMicroQuizUnlocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {watchMetrics.isMicroQuizUnlocked ? (
                <>
                  <Award className="w-4 h-4" />
                  <span>{quizOpen ? 'بستن فرم تستک' : 'شروع تستک درک مطلب'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>قفل ({toPersianDigits(watchMetrics.watchedPercent)}٪ از ۸۵٪)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Completed Micro-Quiz Result */}
        {quizAttempt && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  وضعیت درک مطلب: {quizAttempt.descriptiveStatus}
                </div>
                <div className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 tabular-nums">
                  {toPersianDigits(quizAttempt.correctCount)} پاسخ صحیح از{' '}
                  {toPersianDigits(quizAttempt.totalCount)} سوال · ثبت خودکار در دفتر کلاسی و برگه ۳۶۰ درجه
                </div>
              </div>
            </div>
            <div className="text-left tabular-nums">
              <div className="text-xs text-emerald-700 dark:text-emerald-400">نمره تستک</div>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {toPersianDigits(quizAttempt.score20)} / ۲۰
              </div>
            </div>
          </div>
        )}

        {/* Active Micro-Quiz Form */}
        {quizOpen && !quizAttempt && watchMetrics.isMicroQuizUnlocked && (
          <form onSubmit={handleSubmitMicroQuiz} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {lesson.microQuiz.map((q, qIdx) => (
              <div key={q.id} className="space-y-2.5">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {toPersianDigits(qIdx + 1)}. {q.questionText}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => {
                    const selected = quizAnswers[qIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() =>
                          setQuizAnswers((prev) =>
                            prev.map((val, idx) => (idx === qIdx ? optIdx : val))
                          )
                        }
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-right text-xs sm:text-sm font-medium transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {toPersianDigits(optIdx + 1)}) {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
              >
                ثبت و تصحیح خودکار تستک
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Student's Own Logged Timestamp Questions */}
      {studentQuestions.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            سوالات ثبت‌شده شما از این ویدیو ({toPersianDigits(studentQuestions.length)})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {studentQuestions.map((q) => (
              <div key={q.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleSeekRequest(q.timestampSecond)}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline tabular-nums"
                  >
                    دقیقه {formatMmSs(q.timestampSecond)}
                  </button>
                  <span className="tabular-nums">{toPersianDigits(q.createdAtJalali)}</span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200">{q.questionText}</p>
                {q.teacherReply && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>پاسخ معلم:</strong> {q.teacherReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
