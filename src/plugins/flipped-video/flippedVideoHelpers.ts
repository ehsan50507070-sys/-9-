// Pure Business Logic for Plugin: Flipped Video Classroom («کلاس وارونه هوشمند»)
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  FlippedMicroQuizQuestion,
  FlippedMicroQuizStatusFa,
  FlippedSecondWatchState,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
  FlippedVideoTelemetry,
  Student,
} from '../../types/domain';

export const MICRO_QUIZ_UNLOCK_THRESHOLD_PERCENT = 85;
export const NORMAL_SPEED_MAX_RATE = 1.15;
export const SEEK_FORWARD_TOLERANCE_SECONDS = 2;

export function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const raw = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return toPersianDigits(raw);
}

/**
 * Enforces «قفل جلو زدن» (No Forward Seeking):
 * Allows rewinding or seeking within already watched range (<= maxWatchedSecond + 2).
 * Rejects forward jumps beyond maxWatchedSecond + 2 and snaps back to maxWatchedSecond.
 */
export function clampForwardSeek(
  requestedSecond: number,
  maxWatchedSecond: number,
  durationSeconds: number
): { allowed: boolean; targetSecond: number } {
  const clampedDuration = Math.max(1, durationSeconds);
  const cleanRequested = Math.max(0, Math.min(clampedDuration, requestedSecond));
  const limit = Math.min(clampedDuration, Math.max(0, maxWatchedSecond) + SEEK_FORWARD_TOLERANCE_SECONDS);

  if (cleanRequested > limit) {
    return {
      allowed: false,
      targetSecond: Math.max(0, Math.min(clampedDuration, maxWatchedSecond)),
    };
  }

  return {
    allowed: true,
    targetSecond: cleanRequested,
  };
}

export function classifyPlaybackSpeed(playbackRate: number): 'normal' | 'fast' {
  return playbackRate <= NORMAL_SPEED_MAX_RATE ? 'normal' : 'fast';
}

export interface WatchMetrics {
  durationSeconds: number;
  watchedUniqueSeconds: number;
  normalSeconds: number;
  fastSeconds: number;
  unwatchedSeconds: number;
  watchedPercent: number;
  normalPercent: number;
  fastPercent: number;
  isMicroQuizUnlocked: boolean;
}

export function computeWatchMetrics(
  secondStates: Record<string, FlippedSecondWatchState>,
  durationSeconds: number
): WatchMetrics {
  const safeDuration = Math.max(1, Math.floor(durationSeconds));
  let normalSeconds = 0;
  let fastSeconds = 0;

  for (let s = 0; s < safeDuration; s++) {
    const state = secondStates[String(s)];
    if (state === 'normal') normalSeconds++;
    else if (state === 'fast') fastSeconds++;
  }

  const watchedUniqueSeconds = normalSeconds + fastSeconds;
  const unwatchedSeconds = Math.max(0, safeDuration - watchedUniqueSeconds);
  const watchedPercent = Math.min(100, Math.round((watchedUniqueSeconds / safeDuration) * 100));
  const normalPercent = Math.round((normalSeconds / safeDuration) * 100);
  const fastPercent = Math.round((fastSeconds / safeDuration) * 100);

  return {
    durationSeconds: safeDuration,
    watchedUniqueSeconds,
    normalSeconds,
    fastSeconds,
    unwatchedSeconds,
    watchedPercent,
    normalPercent,
    fastPercent,
    isMicroQuizUnlocked: watchedPercent >= MICRO_QUIZ_UNLOCK_THRESHOLD_PERCENT,
  };
}

export interface MicroQuizGradeResult {
  correctCount: number;
  totalCount: number;
  score20: number;
  descriptiveStatus: FlippedMicroQuizStatusFa;
}

export function gradeMicroQuiz(
  questions: FlippedMicroQuizQuestion[],
  selectedOptionIndices: number[]
): MicroQuizGradeResult {
  const totalCount = Math.max(1, questions.length);
  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (selectedOptionIndices[idx] === q.correctOptionIndex) {
      correctCount++;
    }
  });
  const score20 = Math.round(((correctCount / totalCount) * 20) * 10) / 10;
  let descriptiveStatus: FlippedMicroQuizStatusFa;
  if (score20 >= 16) {
    descriptiveStatus = 'تسلط کامل';
  } else if (score20 >= 11) {
    descriptiveStatus = 'قابل قبول';
  } else {
    descriptiveStatus = 'نیاز به مرور و تمرین';
  }

  return {
    correctCount,
    totalCount,
    score20,
    descriptiveStatus,
  };
}

export interface ClassHeatmapCell {
  second: number;
  normalCount: number;
  fastCount: number;
  unwatchedCount: number;
  dominant: FlippedSecondWatchState;
}

export function buildClassHeatmap(
  durationSeconds: number,
  telemetries: FlippedVideoTelemetry[]
): ClassHeatmapCell[] {
  const safeDuration = Math.max(1, Math.floor(durationSeconds));
  const cells: ClassHeatmapCell[] = [];

  for (let s = 0; s < safeDuration; s++) {
    let normalCount = 0;
    let fastCount = 0;
    let unwatchedCount = 0;
    for (const t of telemetries) {
      const st = t.secondStates[String(s)] ?? 'unwatched';
      if (st === 'normal') normalCount++;
      else if (st === 'fast') fastCount++;
      else unwatchedCount++;
    }
    let dominant: FlippedSecondWatchState = 'unwatched';
    if (fastCount > 0 && fastCount >= normalCount) {
      dominant = 'fast';
    } else if (normalCount > 0) {
      dominant = 'normal';
    }
    cells.push({ second: s, normalCount, fastCount, unwatchedCount, dominant });
  }
  return cells;
}

export interface ConfusingTimestampHotspot {
  bucketStartSecond: number;
  bucketEndSecond: number;
  labelFa: string;
  questionCount: number;
  fastWatchHits: number;
  score: number;
}

export interface RemedialAgendaSummary {
  topConfusingHotspots: ConfusingTimestampHotspot[];
  groupedQuestions: FlippedTimestampQuestion[];
  notWatchedStudents: Student[];
  lowQuizStudents: Array<{ student: Student; score20: number; status: FlippedMicroQuizStatusFa }>;
  watchedCount: number;
  completedQuizCount: number;
  totalStudents: number;
  avgQuizScore20: number | null;
}

export function buildRemedialAgenda(params: {
  lesson: FlippedVideoLesson;
  classStudents: Student[];
  telemetries: FlippedVideoTelemetry[];
  questions: FlippedTimestampQuestion[];
}): RemedialAgendaSummary {
  const { lesson, classStudents, telemetries, questions } = params;
  const activeStudents = classStudents.filter((s) => s.active);
  const telByStudent = new Map(telemetries.map((t) => [t.studentId, t]));

  const notWatchedStudents: Student[] = [];
  const lowQuizStudents: Array<{
    student: Student;
    score20: number;
    status: FlippedMicroQuizStatusFa;
  }> = [];

  let watchedCount = 0;
  let completedQuizCount = 0;
  let quizSum = 0;

  for (const stu of activeStudents) {
    const tel = telByStudent.get(stu.id);
    if (!tel) {
      notWatchedStudents.push(stu);
      continue;
    }
    const metrics = computeWatchMetrics(tel.secondStates, lesson.durationSeconds);
    if (metrics.watchedPercent >= 20) {
      watchedCount++;
    } else {
      notWatchedStudents.push(stu);
    }

    if (tel.microQuizAttempt) {
      completedQuizCount++;
      quizSum += tel.microQuizAttempt.score20;
      if (
        tel.microQuizAttempt.score20 < 14 ||
        tel.microQuizAttempt.descriptiveStatus === 'نیاز به مرور و تمرین'
      ) {
        lowQuizStudents.push({
          student: stu,
          score20: tel.microQuizAttempt.score20,
          status: tel.microQuizAttempt.descriptiveStatus,
        });
      }
    }
  }

  // Group into 15-second buckets to surface the most confusing parts of the video
  const bucketSize = lesson.durationSeconds <= 90 ? 15 : 30;
  const bucketCount = Math.max(1, Math.ceil(lesson.durationSeconds / bucketSize));
  const hotspots: ConfusingTimestampHotspot[] = [];

  for (let b = 0; b < bucketCount; b++) {
    const start = b * bucketSize;
    const end = Math.min(lesson.durationSeconds, start + bucketSize);
    const qInBucket = questions.filter(
      (q) => q.timestampSecond >= start && q.timestampSecond < end
    ).length;

    let fastHits = 0;
    for (const tel of telemetries) {
      let fastInBucket = 0;
      for (let s = start; s < end; s++) {
        if (tel.secondStates[String(s)] === 'fast') fastInBucket++;
      }
      if (fastInBucket >= Math.ceil((end - start) * 0.4)) {
        fastHits++;
      }
    }

    const score = qInBucket * 3 + fastHits;
    if (score > 0) {
      hotspots.push({
        bucketStartSecond: start,
        bucketEndSecond: end,
        labelFa: `${formatMmSs(start)} تا ${formatMmSs(end)}`,
        questionCount: qInBucket,
        fastWatchHits: fastHits,
        score,
      });
    }
  }

  hotspots.sort((a, b) => b.score - a.score);

  return {
    topConfusingHotspots: hotspots.slice(0, 3),
    groupedQuestions: [...questions].sort((a, b) => a.timestampSecond - b.timestampSecond),
    notWatchedStudents,
    lowQuizStudents,
    watchedCount,
    completedQuizCount,
    totalStudents: activeStudents.length,
    avgQuizScore20:
      completedQuizCount > 0 ? Math.round((quizSum / completedQuizCount) * 10) / 10 : null,
  };
}

export function formatRemedialAgendaMessenger(params: {
  schoolName: string;
  className: string;
  lesson: FlippedVideoLesson;
  agenda: RemedialAgendaSummary;
  jalaliDate: string;
}): string {
  const { schoolName, className, lesson, agenda, jalaliDate } = params;

  const hotspotLines =
    agenda.topConfusingHotspots.length > 0
      ? agenda.topConfusingHotspots.map(
          (h, idx) =>
            `${idx + 1}. بازه ${h.labelFa} — ${h.questionCount} سوال دانش‌آموز · ${h.fastWatchHits} مورد تماشای سریع`
        )
      : ['نقطه ابهام پرتکراری ثبت نشده است.'];

  const questionLines =
    agenda.groupedQuestions.length > 0
      ? agenda.groupedQuestions.map(
          (q) => `• [${formatMmSs(q.timestampSecond)}] ${q.studentName}: ${q.questionText}`
        )
      : ['سوال زمان‌دار ثبت نشده است.'];

  const lowQuizLines =
    agenda.lowQuizStudents.length > 0
      ? agenda.lowQuizStudents.map(
          (item) => `• ${item.student.fullName} (نمره تستک: ${item.score20} — ${item.status})`
        )
      : ['همه شرکت‌کنندگان به سطح مطلوب رسیده‌اند.'];

  const notWatchedLines =
    agenda.notWatchedStudents.length > 0
      ? agenda.notWatchedStudents.map((s, idx) => `${idx + 1}. ${s.fullName}`)
      : ['همه دانش‌آموزان ویدیو را مشاهده کرده‌اند.'];

  return formatSingleColumnMessengerReport({
    schoolName,
    reportTitle: `دستور جلسه کلاس رفع اشکال — ${lesson.title}`,
    jalaliDateDisplay: jalaliDate,
    sections: [
      {
        heading: `خلاصه مشارکت (${className} — ${lesson.subject})`,
        lines: [
          `مشاهده ویدیو: ${agenda.watchedCount} از ${agenda.totalStudents} نفر`,
          `تکمیل تستک درک مطلب: ${agenda.completedQuizCount} نفر${
            agenda.avgQuizScore20 !== null ? ` (میانگین ${agenda.avgQuizScore20} از ۲۰)` : ''
          }`,
        ],
      },
      {
        heading: 'دقایق پرتکرار و نیازمند توضیح مجدد',
        lines: hotspotLines,
      },
      {
        heading: 'سوالات ثبت‌شده دانش‌آموزان به ترتیب زمان ویدیو',
        lines: questionLines,
      },
      {
        heading: 'دانش‌آموزان نیازمند مرور در کلاس (تستک زیر ۱۴)',
        lines: lowQuizLines,
      },
      {
        heading: 'دانش‌آموزانی که هنوز ویدیو را مشاهده نکرده‌اند',
        lines: notWatchedLines,
      },
    ],
    footerNote: 'تولیدشده توسط افزونه کلاس وارونه هوشمند — آماده ارسال در ایتا، بله و شاد',
  });
}
