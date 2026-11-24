// Pure Business Logic for Plugin: Online Exams («سامانه آزمون آنلاین»)
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  OnlineExam,
  OnlineExamAnswer,
  OnlineExamGradingStatus,
  OnlineExamQuestion,
  OnlineExamQuestionType,
  OnlineExamStatus,
  OnlineExamSubmission,
  QuestionBankItem,
} from '../../types/domain';

export function getExamQuestionTypeLabelFa(type: OnlineExamQuestionType): string {
  switch (type) {
    case 'multiple_choice':
      return 'چهارگزینه‌ای (تستی)';
    case 'true_false':
      return 'صحیح / غلط';
    case 'fill_blank':
      return 'جای خالی';
    case 'descriptive':
      return 'تشریحی';
  }
}

export function getExamStatusMeta(status: OnlineExamStatus): {
  labelFa: string;
  badgeClass: string;
} {
  switch (status) {
    case 'published':
      return {
        labelFa: 'منتشرشده (فعال)',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'draft':
      return {
        labelFa: 'پیش‌نویس',
        badgeClass:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      };
    case 'ended':
      return {
        labelFa: 'پایان‌یافته',
        badgeClass:
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}

export function getGradingStatusLabelFa(status: OnlineExamGradingStatus): string {
  switch (status) {
    case 'auto_graded':
      return 'تصحیح خودکار کامل';
    case 'pending_descriptive':
      return 'در انتظار تصحیح تشریحی';
    case 'finalized':
      return 'نمره نهایی تاییدشده';
  }
}

/**
 * Normalizes Persian/Arabic characters, digits, and whitespace for fair fill-in-the-blank auto-grading.
 */
export function normalizePersianAnswer(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/[\u064b-\u065f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function convertQuestionBankToExamQuestion(
  qb: QuestionBankItem,
  defaultPoints = 2
): OnlineExamQuestion {
  const mappedType: OnlineExamQuestionType =
    qb.type === 'multiple_choice' ||
    qb.type === 'true_false' ||
    qb.type === 'fill_blank' ||
    qb.type === 'descriptive'
      ? qb.type
      : 'descriptive';

  return {
    id: `exq-${qb.id}-${Math.random().toString(36).slice(2, 6)}`,
    type: mappedType,
    questionText: qb.questionText,
    points: defaultPoints,
    options: mappedType === 'multiple_choice' ? qb.options ?? ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'] : undefined,
    correctOptionIndex: mappedType === 'multiple_choice' ? (qb.correctOptionIndex ?? 0) : undefined,
    trueFalseAnswer: mappedType === 'true_false' ? (qb.trueFalseAnswer ?? true) : undefined,
    acceptedAnswers:
      mappedType === 'fill_blank' && qb.modelAnswer
        ? qb.modelAnswer
            .split(/[،,/|]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    modelAnswer: qb.modelAnswer,
    sourceQuestionBankId: qb.id,
  };
}

export function computeTotalExamPoints(questions: OnlineExamQuestion[]): number {
  const sum = questions.reduce((acc, q) => acc + Math.max(0, Number(q.points) || 0), 0);
  return Math.round(sum * 100) / 100;
}

export function scalePointsTo20(earnedPoints: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0;
  const raw = (Math.max(0, earnedPoints) / totalPoints) * 20;
  return Math.min(20, Math.round(raw * 100) / 100);
}

export function autoGradeExamSubmission(
  exam: OnlineExam,
  rawAnswers: OnlineExamAnswer[]
): {
  gradedAnswers: OnlineExamAnswer[];
  autoGradedPoints: number;
  hasDescriptive: boolean;
  gradingStatus: OnlineExamGradingStatus;
  finalPoints: number;
  finalScore20: number;
} {
  const byQid = new Map(rawAnswers.map((a) => [a.questionId, a]));
  let autoGradedPoints = 0;
  let hasDescriptive = false;

  const gradedAnswers: OnlineExamAnswer[] = exam.questions.map((q) => {
    const ans = byQid.get(q.id) ?? { questionId: q.id };

    if (q.type === 'multiple_choice') {
      const correct = ans.selectedOptionIndex === q.correctOptionIndex;
      const pts = correct ? q.points : 0;
      autoGradedPoints += pts;
      return { ...ans, autoScore: pts };
    }

    if (q.type === 'true_false') {
      const correct =
        typeof ans.trueFalseValue === 'boolean' && ans.trueFalseValue === q.trueFalseAnswer;
      const pts = correct ? q.points : 0;
      autoGradedPoints += pts;
      return { ...ans, autoScore: pts };
    }

    if (q.type === 'fill_blank') {
      const studentNorm = normalizePersianAnswer(ans.textAnswer ?? '');
      const candidates = (q.acceptedAnswers && q.acceptedAnswers.length > 0
        ? q.acceptedAnswers
        : q.modelAnswer
        ? [q.modelAnswer]
        : []
      ).map(normalizePersianAnswer);
      const correct = studentNorm.length > 0 && candidates.includes(studentNorm);
      const pts = correct ? q.points : 0;
      autoGradedPoints += pts;
      return { ...ans, autoScore: pts };
    }

    hasDescriptive = true;
    return { ...ans };
  });

  const roundedAuto = Math.round(autoGradedPoints * 100) / 100;
  const totalPoints = computeTotalExamPoints(exam.questions);
  const gradingStatus: OnlineExamGradingStatus = hasDescriptive
    ? 'pending_descriptive'
    : 'auto_graded';

  return {
    gradedAnswers,
    autoGradedPoints: roundedAuto,
    hasDescriptive,
    gradingStatus,
    finalPoints: roundedAuto,
    finalScore20: scalePointsTo20(roundedAuto, totalPoints),
  };
}

export function recalculateSubmissionAfterManualGrading(
  exam: OnlineExam,
  submission: OnlineExamSubmission,
  manualOverrides: Record<string, { score: number; feedback?: string }>,
  overallFeedback?: string
): OnlineExamSubmission {
  const totalPoints = computeTotalExamPoints(exam.questions);
  let autoSum = 0;
  let manualSum = 0;

  const updatedAnswers: OnlineExamAnswer[] = exam.questions.map((q) => {
    const existing = submission.answers.find((a) => a.questionId === q.id) ?? {
      questionId: q.id,
    };
    if (q.type === 'descriptive') {
      const override = manualOverrides[q.id];
      const clampedScore =
        override !== undefined
          ? Math.max(0, Math.min(q.points, Number(override.score) || 0))
          : Math.max(0, Math.min(q.points, existing.manualScore ?? 0));
      manualSum += clampedScore;
      return {
        ...existing,
        manualScore: Math.round(clampedScore * 100) / 100,
        teacherFeedback:
          override?.feedback !== undefined ? override.feedback.trim() : existing.teacherFeedback,
      };
    }
    autoSum += existing.autoScore ?? 0;
    return existing;
  });

  const finalPoints = Math.round((autoSum + manualSum) * 100) / 100;
  return {
    ...submission,
    answers: updatedAnswers,
    autoGradedPoints: Math.round(autoSum * 100) / 100,
    manualGradedPoints: Math.round(manualSum * 100) / 100,
    finalPoints,
    finalScore20: scalePointsTo20(finalPoints, totalPoints),
    gradingStatus: 'finalized',
    teacherOverallFeedback:
      overallFeedback !== undefined ? overallFeedback.trim() : submission.teacherOverallFeedback,
    updatedAt: new Date().toISOString(),
  };
}

export interface ExamScoreBucket {
  labelFa: string;
  min: number;
  max: number;
  count: number;
  colorHex: string;
}

export interface MostMissedQuestionRow {
  questionId: string;
  questionIndex: number;
  questionText: string;
  missRatePercent: number;
  attempts: number;
}

export interface ExamClassAnalytics {
  submissionCount: number;
  finalizedCount: number;
  pendingDescriptiveCount: number;
  tabSwitchFlaggedCount: number;
  averageScore20: number | null;
  highestScore20: number | null;
  lowestScore20: number | null;
  buckets: ExamScoreBucket[];
  mostMissedQuestions: MostMissedQuestionRow[];
}

export function computeExamClassAnalytics(
  exam: OnlineExam,
  submissions: OnlineExamSubmission[]
): ExamClassAnalytics {
  const buckets: ExamScoreBucket[] = [
    { labelFa: 'زیر ۱۰', min: 0, max: 9.99, count: 0, colorHex: '#e11d48' },
    { labelFa: '۱۰ تا ۱۴', min: 10, max: 13.99, count: 0, colorHex: '#d97706' },
    { labelFa: '۱۴ تا ۱۷', min: 14, max: 16.99, count: 0, colorHex: '#4f46e5' },
    { labelFa: '۱۷ تا ۲۰', min: 17, max: 20, count: 0, colorHex: '#16a34a' },
  ];

  const scores: number[] = [];
  let finalizedCount = 0;
  let pendingDescriptiveCount = 0;
  let tabSwitchFlaggedCount = 0;

  for (const sub of submissions) {
    if (sub.gradingStatus === 'pending_descriptive') pendingDescriptiveCount++;
    else finalizedCount++;
    if (sub.tabSwitchCount > 0) tabSwitchFlaggedCount++;

    scores.push(sub.finalScore20);
    const bucket = buckets.find((b) => sub.finalScore20 >= b.min && sub.finalScore20 <= b.max);
    if (bucket) bucket.count++;
  }

  const averageScore20 =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
  const highestScore20 = scores.length > 0 ? Math.max(...scores) : null;
  const lowestScore20 = scores.length > 0 ? Math.min(...scores) : null;

  const mostMissedQuestions: MostMissedQuestionRow[] = exam.questions
    .map((q, idx) => {
      if (submissions.length === 0) {
        return {
          questionId: q.id,
          questionIndex: idx + 1,
          questionText: q.questionText,
          missRatePercent: 0,
          attempts: 0,
        };
      }
      let missed = 0;
      let counted = 0;
      for (const sub of submissions) {
        const ans = sub.answers.find((a) => a.questionId === q.id);
        const earned = q.type === 'descriptive' ? ans?.manualScore : ans?.autoScore;
        if (typeof earned === 'number') {
          counted++;
          if (earned < q.points * 0.6) missed++;
        }
      }
      const missRatePercent = counted > 0 ? Math.round((missed / counted) * 100) : 0;
      return {
        questionId: q.id,
        questionIndex: idx + 1,
        questionText: q.questionText,
        missRatePercent,
        attempts: counted,
      };
    })
    .filter((row) => row.attempts > 0)
    .sort((a, b) => b.missRatePercent - a.missRatePercent)
    .slice(0, 3);

  return {
    submissionCount: submissions.length,
    finalizedCount,
    pendingDescriptiveCount,
    tabSwitchFlaggedCount,
    averageScore20,
    highestScore20,
    lowestScore20,
    buckets,
    mostMissedQuestions,
  };
}

export function formatExamMessengerAnnouncement(params: {
  schoolName: string;
  className: string;
  exam: OnlineExam;
  analytics: ExamClassAnalytics;
}): string {
  const { schoolName, className, exam, analytics } = params;
  const summaryLines = [
    `کلاس: ${className} — درس ${exam.subject}`,
    `معلم: ${exam.teacherName}`,
    `بازه برگزاری: ${toPersianDigits(exam.startDateJalali)} تا ${toPersianDigits(exam.endDateJalali)}`,
    `مدت آزمون: ${toPersianDigits(exam.durationMinutes)} دقیقه · تعداد سوالات: ${toPersianDigits(exam.questions.length)} سوال (جمع بارم: ${toPersianDigits(exam.totalPoints)} نمره)`,
  ];

  const statsLines =
    analytics.submissionCount > 0
      ? [
          `تعداد شرکت‌کنندگان: ${toPersianDigits(analytics.submissionCount)} نفر`,
          `میانگین کلاس: ${analytics.averageScore20 !== null ? `${toPersianDigits(analytics.averageScore20)} از ۲۰` : '—'}`,
          `بالاترین نمره: ${analytics.highestScore20 !== null ? toPersianDigits(analytics.highestScore20) : '—'} · پایین‌ترین نمره: ${analytics.lowestScore20 !== null ? toPersianDigits(analytics.lowestScore20) : '—'}`,
        ]
      : ['آزمون آماده شرکت دانش‌آموزان در سامانه مدرسه است.'];

  return formatSingleColumnMessengerReport({
    schoolName,
    reportTitle: `اطلاع‌رسانی و گزارش آزمون آنلاین — ${exam.title}`,
    jalaliDateDisplay: exam.startDateJalali,
    sections: [
      { heading: 'مشخصات آزمون', lines: summaryLines },
      { heading: 'وضعیت مشارکت و نتایج', lines: statsLines },
    ],
    footerNote: 'سامانه آزمون آنلاین مدارس — آماده ارسال در ایتا، بله و شاد',
  });
}
