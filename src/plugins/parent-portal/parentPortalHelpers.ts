// Pure Helper Functions for Phase 4 Parent Portal («پنل اختصاصی خانواده»)
// Decoupled from React for direct unit testing via node:test.
import { toPersianDigits } from '../../lib/digits';
import type {
  DescriptiveLevel,
  GradeAppealStatus,
  GradebookEntry,
  JalaliAcademicMonth,
  OnlineExam,
  OnlineExamSubmission,
} from '../../types/domain';
import { ACADEMIC_MONTHS, scoreToDescriptiveLevel } from '../gradebook/gradebookHelpers';

export type ProgressTrendTone = 'improving' | 'declining' | 'stable';

export interface ProgressPoint {
  id: string;
  label: string;
  subLabel: string;
  score: number; // 0..20
  source: 'gradebook' | 'online_exam';
}

export interface SubjectReportRow {
  subject: string;
  latestMonth: JalaliAcademicMonth | 'آزمون آنلاین';
  latestScore: number | null;
  averageScore: number | null;
  descriptiveLevel: DescriptiveLevel | null;
  descriptiveFeedback: string;
  trendTone: ProgressTrendTone;
  trendDelta: number;
  gradeEntryId?: string;
}

export interface ProgressAnalysis {
  points: ProgressPoint[];
  overallAverage: number | null;
  trendTone: ProgressTrendTone;
  trendDelta: number;
  trendLabelFa: string;
  trendDescriptionFa: string;
}

export const PARENT_APPEAL_STATUS_LABELS: Record<
  GradeAppealStatus,
  { labelFa: string; badgeClass: string }
> = {
  submitted: {
    labelFa: 'در حال بررسی',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  in_review: {
    labelFa: 'در حال بررسی سیدا',
    badgeClass:
      'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  teacher_reviewed: {
    labelFa: 'پاسخ داده شده',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  principal_approved: {
    labelFa: 'اصلاح نمره انجام شد',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  rejected: {
    labelFa: 'رد اعتراض (تایید نمره اولیه)',
    badgeClass:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
};

export function classifyTrendDelta(delta: number): {
  tone: ProgressTrendTone;
  labelFa: string;
  descriptionFa: string;
} {
  if (delta >= 0.75) {
    return {
      tone: 'improving',
      labelFa: 'روند رو به رشد',
      descriptionFa: `میانگین عملکرد نسبت به ارزیابی‌های اولیه ${toPersianDigits(delta.toFixed(1))} نمره بهبود یافته است.`,
    };
  }
  if (delta <= -0.75) {
    return {
      tone: 'declining',
      labelFa: 'نیاز به توجه بیشتر',
      descriptionFa: `کاهش ${toPersianDigits(Math.abs(delta).toFixed(1))} نمره‌ای در ارزیابی‌های اخیر مشاهده می‌شود؛ هماهنگی با معلم پیشنهاد می‌شود.`,
    };
  }
  return {
    tone: 'stable',
    labelFa: 'روند پایدار',
    descriptionFa: 'عملکرد درسی در ارزیابی‌های اخیر ثبات مطلوبی داشته است.',
  };
}

/**
 * Builds chronological progression points from monthly gradebook entries and published online exams.
 */
export function buildStudentProgressAnalysis(params: {
  studentId: string;
  gradebookEntries: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  subjectFilter?: string;
}): ProgressAnalysis {
  const { studentId, gradebookEntries, onlineExams, onlineExamSubmissions, subjectFilter } = params;
  const studentEntries = gradebookEntries.filter(
    (g) =>
      g.studentId === studentId &&
      typeof g.numericScore === 'number' &&
      (!subjectFilter || subjectFilter === 'ALL' || g.subject === subjectFilter)
  );

  const points: ProgressPoint[] = [];

  // 1. Monthly Gradebook averages in Jalali academic month order
  for (const month of ACADEMIC_MONTHS) {
    const monthEntries = studentEntries.filter((e) => e.jalaliMonth === month);
    if (monthEntries.length === 0) continue;
    const avg =
      monthEntries.reduce((sum, e) => sum + (e.numericScore ?? 0), 0) / monthEntries.length;
    points.push({
      id: `gb-${month}`,
      label: month,
      subLabel: `ارزشیابی ${month}`,
      score: Math.round(avg * 10) / 10,
      source: 'gradebook',
    });
  }

  // 2. Published Online Exams chronological progression
  const examById = new Map(onlineExams.map((e) => [e.id, e]));
  const publishedSubs = onlineExamSubmissions
    .filter((sub) => {
      if (sub.studentId !== studentId) return false;
      const exam = examById.get(sub.examId);
      if (!exam || exam.status === 'draft') return false;
      if (subjectFilter && subjectFilter !== 'ALL' && exam.subject !== subjectFilter) return false;
      return typeof sub.finalScore20 === 'number';
    })
    .sort((a, b) => a.submittedAtIso.localeCompare(b.submittedAtIso));

  publishedSubs.forEach((sub, idx) => {
    const exam = examById.get(sub.examId);
    points.push({
      id: `ex-${sub.id}`,
      label: exam ? `آزمون ${toPersianDigits(idx + 1)}` : `آزمون ${toPersianDigits(idx + 1)}`,
      subLabel: exam ? `${exam.title} (${exam.subject})` : 'آزمون آنلاین',
      score: Math.round(sub.finalScore20 * 10) / 10,
      source: 'online_exam',
    });
  });

  if (points.length === 0) {
    return {
      points: [],
      overallAverage: null,
      trendTone: 'stable',
      trendDelta: 0,
      trendLabelFa: 'در انتظار ثبت ارزیابی',
      trendDescriptionFa: 'هنوز نمره عددی یا کارنامه آزمونی برای ترسیم نمودار ثبت نشده است.',
    };
  }

  const overallAverage =
    Math.round((points.reduce((acc, p) => acc + p.score, 0) / points.length) * 10) / 10;

  let trendDelta = 0;
  if (points.length >= 2) {
    trendDelta = Math.round((points[points.length - 1].score - points[0].score) * 10) / 10;
  }

  const classified = classifyTrendDelta(trendDelta);

  return {
    points,
    overallAverage,
    trendTone: classified.tone,
    trendDelta,
    trendLabelFa: classified.labelFa,
    trendDescriptionFa: classified.descriptionFa,
  };
}

/**
 * Builds comprehensive subject-by-subject report card combining Gradebook & published Online Exams.
 */
export function buildSubjectReportRows(params: {
  studentId: string;
  gradebookEntries: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
}): SubjectReportRow[] {
  const { studentId, gradebookEntries, onlineExams, onlineExamSubmissions } = params;
  const studentEntries = gradebookEntries.filter((g) => g.studentId === studentId);
  const examById = new Map(onlineExams.map((e) => [e.id, e]));
  const studentSubs = onlineExamSubmissions.filter((s) => s.studentId === studentId);

  const subjectSet = new Set<string>();
  studentEntries.forEach((e) => subjectSet.add(e.subject));
  studentSubs.forEach((s) => {
    const ex = examById.get(s.examId);
    if (ex && ex.status !== 'draft') subjectSet.add(ex.subject);
  });

  const rows: SubjectReportRow[] = [];
  for (const subject of Array.from(subjectSet)) {
    const entries = studentEntries
      .filter((e) => e.subject === subject)
      .sort(
        (a, b) =>
          ACADEMIC_MONTHS.indexOf(a.jalaliMonth) -
          ACADEMIC_MONTHS.indexOf(b.jalaliMonth)
      );

    const examScores = studentSubs
      .filter((s) => {
        const ex = examById.get(s.examId);
        return ex && ex.status !== 'draft' && ex.subject === subject;
      })
      .map((s) => s.finalScore20);

    const numericScores: number[] = [
      ...entries.map((e) => e.numericScore).filter((n): n is number => typeof n === 'number'),
      ...examScores,
    ];

    const latestEntry = entries[entries.length - 1];
    const latestScore =
      latestEntry?.numericScore ??
      (examScores.length > 0 ? examScores[examScores.length - 1] : null);
    const averageScore =
      numericScores.length > 0
        ? Math.round((numericScores.reduce((a, b) => a + b, 0) / numericScores.length) * 10) / 10
        : null;

    const delta =
      numericScores.length >= 2
        ? Math.round((numericScores[numericScores.length - 1] - numericScores[0]) * 10) / 10
        : 0;
    const classified = classifyTrendDelta(delta);

    const descriptiveLevel =
      latestEntry?.descriptiveLevel ??
      (latestScore !== null ? scoreToDescriptiveLevel(latestScore) : null);

    rows.push({
      subject,
      latestMonth: latestEntry?.jalaliMonth ?? 'آزمون آنلاین',
      latestScore,
      averageScore,
      descriptiveLevel,
      descriptiveFeedback:
        latestEntry?.disciplinaryNote ||
        (examScores.length > 0
          ? `عملکرد ثبت‌شده بر اساس ${toPersianDigits(examScores.length)} آزمون آنلاین`
          : 'ارزشیابی ثبت شده است.'),
      trendTone: classified.tone,
      trendDelta: delta,
      gradeEntryId: latestEntry?.id,
    });
  }

  return rows.sort((a, b) => a.subject.localeCompare(b.subject, 'fa'));
}
