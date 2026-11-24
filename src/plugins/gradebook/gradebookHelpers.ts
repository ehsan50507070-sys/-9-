// Pure Smart Continuous Assessment Engine, Auto Descriptive Report Assistant & Monthly Trend Builder
import { toPersianDigits } from '../../lib/digits';
import type {
  DescriptiveLevel,
  GradebookEntry,
  GradebookWeightConfig,
  HomeworkAssignment,
  HomeworkSubmission,
  JalaliAcademicMonth,
  StudentAttendanceRecord,
} from '../../types/domain';

export const ACADEMIC_MONTHS: readonly JalaliAcademicMonth[] = [
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
  'فروردین',
  'اردیبهشت',
  'خرداد',
] as const;

export const DEFAULT_GRADEBOOK_WEIGHTS: Omit<
  GradebookWeightConfig,
  'id' | 'schoolId' | 'classId' | 'subject' | 'updatedAt'
> = {
  attendanceWeight: 15,
  homeworkWeight: 30,
  oralQuizWeight: 25,
  classActivityWeight: 20,
  microQuizWeight: 10, // Pre-wired for Phase 3 Flipped Video Micro-Quiz
};

export function scoreToDescriptiveLevel(score: number): DescriptiveLevel {
  if (score >= 17) return 'خیلی خوب';
  if (score >= 14) return 'خوب';
  if (score >= 11) return 'قابل قبول';
  return 'نیاز به تلاش بیشتر';
}

export interface SmartContinuousScoreBreakdown {
  finalScore: number; // 0..20 rounded to 2 decimal places
  descriptiveLevel: DescriptiveLevel;
  attendanceRatePercent: number;
  attendanceScore20: number;
  homeworkAverage20: number | null;
  homeworkCompletionPercent: number;
  oralQuizScore20: number | null;
  classActivityScore20: number | null;
  microQuizScore20: number | null;
  effectiveWeights: {
    attendance: number;
    homework: number;
    oralQuiz: number;
    classActivity: number;
    microQuiz: number;
  };
}

/**
 * Computes a live student's Smart Continuous Assessment score (0..20) by combining:
 * - Live Attendance ratio (absence deducts more than lateness; excused is neutral)
 * - Live Reviewed Homework average score (0..20)
 * - Oral Quiz score (0..20)
 * - Class Activity score (0..20)
 * - Pre-wired Micro-Quiz score (0..20) for Phase 3 Flipped Video integration
 *
 * When a component has no recorded data yet (e.g. Phase 3 microQuizScore is undefined),
 * its configured weight is proportionally normalized across the active components so the
 * resulting continuous grade always stays accurately calibrated on the 0..20 scale.
 */
export function computeSmartContinuousScore(params: {
  studentId: string;
  classId: string;
  subject: string;
  weights: Pick<
    GradebookWeightConfig,
    'attendanceWeight' | 'homeworkWeight' | 'oralQuizWeight' | 'classActivityWeight' | 'microQuizWeight'
  >;
  attendanceRecords: StudentAttendanceRecord[];
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  gradeEntry?: GradebookEntry;
}): SmartContinuousScoreBreakdown {
  const {
    studentId,
    classId,
    subject,
    weights,
    attendanceRecords,
    assignments,
    submissions,
    gradeEntry,
  } = params;

  // 1. Attendance Score (0..20)
  const studentAtt = attendanceRecords.filter((a) => a.studentId === studentId);
  let absentCount = 0;
  let lateCount = 0;
  for (const rec of studentAtt) {
    if (rec.status === 'absent') absentCount++;
    else if (rec.status === 'late') lateCount++;
  }
  // Baseline 20 sessions per evaluation period; each unexcused absence = -8%, late = -3%
  const attendancePenalty = absentCount * 8 + lateCount * 3;
  const attendanceRatePercent = Math.max(0, Math.min(100, 100 - attendancePenalty));
  const attendanceScore20 = Math.round((attendanceRatePercent / 100) * 20 * 100) / 100;

  // 2. Homework Completion & Average Score (0..20)
  const subjectAssignments = assignments.filter(
    (a) => a.classId === classId && (!subject || a.subject === subject)
  );
  const targetAssignments =
    subjectAssignments.length > 0
      ? subjectAssignments
      : assignments.filter((a) => a.classId === classId);
  const assignmentIds = new Set(targetAssignments.map((a) => a.id));

  const studentSubs = submissions.filter(
    (s) => s.studentId === studentId && assignmentIds.has(s.assignmentId)
  );
  const homeworkCompletionPercent =
    targetAssignments.length > 0
      ? Math.round((studentSubs.length / targetAssignments.length) * 100)
      : 100;

  const scoredSubs = studentSubs.filter((s) => typeof s.score === 'number');
  const homeworkAverage20 =
    scoredSubs.length > 0
      ? Math.round(
          (scoredSubs.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSubs.length) * 100
        ) / 100
      : null;

  // 3. Direct gradebook components
  const oralQuizScore20 =
    typeof gradeEntry?.oralQuizScore === 'number' ? gradeEntry.oralQuizScore : null;
  const classActivityScore20 =
    typeof gradeEntry?.classActivityScore === 'number' ? gradeEntry.classActivityScore : null;
  const microQuizScore20 =
    typeof gradeEntry?.microQuizScore === 'number' ? gradeEntry.microQuizScore : null;

  // 4. Weighted aggregation with dynamic renormalization over available components
  const parts: Array<{ key: keyof SmartContinuousScoreBreakdown['effectiveWeights']; weight: number; score: number }> = [
    { key: 'attendance', weight: Math.max(0, weights.attendanceWeight), score: attendanceScore20 },
  ];
  if (homeworkAverage20 !== null) {
    parts.push({ key: 'homework', weight: Math.max(0, weights.homeworkWeight), score: homeworkAverage20 });
  }
  if (oralQuizScore20 !== null) {
    parts.push({ key: 'oralQuiz', weight: Math.max(0, weights.oralQuizWeight), score: oralQuizScore20 });
  }
  if (classActivityScore20 !== null) {
    parts.push({ key: 'classActivity', weight: Math.max(0, weights.classActivityWeight), score: classActivityScore20 });
  }
  if (microQuizScore20 !== null) {
    parts.push({ key: 'microQuiz', weight: Math.max(0, weights.microQuizWeight), score: microQuizScore20 });
  }

  const totalActiveWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const effectiveWeights: SmartContinuousScoreBreakdown['effectiveWeights'] = {
    attendance: 0,
    homework: 0,
    oralQuiz: 0,
    classActivity: 0,
    microQuiz: 0,
  };

  let weightedSum = 0;
  if (totalActiveWeight > 0) {
    for (const part of parts) {
      const normalizedRatio = part.weight / totalActiveWeight;
      effectiveWeights[part.key] = Math.round(normalizedRatio * 100);
      weightedSum += part.score * normalizedRatio;
    }
  } else {
    weightedSum = attendanceScore20;
    effectiveWeights.attendance = 100;
  }

  const finalScore = Math.max(0, Math.min(20, Math.round(weightedSum * 100) / 100));

  return {
    finalScore,
    descriptiveLevel: scoreToDescriptiveLevel(finalScore),
    attendanceRatePercent,
    attendanceScore20,
    homeworkAverage20,
    homeworkCompletionPercent,
    oralQuizScore20,
    classActivityScore20,
    microQuizScore20,
    effectiveWeights,
  };
}

/**
 * Auto Descriptive Report Assistant («دستیار کارنامه توصیفی»):
 * Generates a polished, natural Persian evaluation paragraph from live attendance,
 * homework performance, continuous grade, and teacher remarks.
 */
export function generatePersianDescriptiveReport(params: {
  studentName: string;
  subject: string;
  month: JalaliAcademicMonth;
  breakdown: SmartContinuousScoreBreakdown;
  disciplinaryNote?: string;
}): string {
  const { studentName, subject, month, breakdown, disciplinaryNote } = params;
  const scoreFa = toPersianDigits(breakdown.finalScore.toFixed(1));
  const attFa = toPersianDigits(breakdown.attendanceRatePercent);
  const hwFa = toPersianDigits(breakdown.homeworkCompletionPercent);

  let opening = '';
  if (breakdown.finalScore >= 18) {
    opening = `دانش‌آموز عزیز ${studentName} در ماه ${month} در درس ${subject} عملکردی بسیار درخشان و در سطح «${breakdown.descriptiveLevel}» (نمره مستمر ${scoreFa} از ۲۰) ارائه داده است.`;
  } else if (breakdown.finalScore >= 15.5) {
    opening = `عملکرد ${studentName} در ماه ${month} در درس ${subject} مطلوب و در سطح «${breakdown.descriptiveLevel}» (نمره مستمر ${scoreFa} از ۲۰) ارزیابی می‌شود.`;
  } else if (breakdown.finalScore >= 12) {
    opening = `${studentName} در ماه ${month} در درس ${subject} به سطح «${breakdown.descriptiveLevel}» (نمره مستمر ${scoreFa} از ۲۰) دست یافته و با تمرین هدفمندتر می‌تواند پیشرفت قابل توجهی داشته باشد.`;
  } else {
    opening = `${studentName} در ماه ${month} در درس ${subject} در سطح «${breakdown.descriptiveLevel}» (نمره مستمر ${scoreFa} از ۲۰) قرار دارد و نیازمند همراهی بیشتر منزل و تمرین‌های تقویتی منظم است.`;
  }

  const attendanceSentence =
    breakdown.attendanceRatePercent >= 95
      ? `نظم حضور ایشان در کلاس با نرخ ${attFa}٪ بسیار قابل تحسین بوده است.`
      : `نرخ حضور کلاسی ایشان ${attFa}٪ ثبت شده که توجه بیشتر به حضور مستمر موجب تثبیت بهتر مفاهیم خواهد شد.`;

  const homeworkSentence =
    breakdown.homeworkAverage20 !== null
      ? `در بخش تکالیف آنلاین، نرخ تحویل ${hwFa}٪ با میانگین کیفی ${toPersianDigits(breakdown.homeworkAverage20.toFixed(1))} از ۲۰ ثبت شده است.`
      : `در بخش تکالیف آنلاین، نرخ مشارکت ${hwFa}٪ گزارش شده است.`;

  const noteSentence =
    disciplinaryNote && disciplinaryNote.trim().length > 0
      ? `ملاحظه آموزشی و انضباطی معلم: ${disciplinaryNote.trim()}.`
      : 'امیدواریم با تداوم تلاش و همراهی ارزشمند خانواده، شاهد موفقیت‌های روزافزون ایشان باشیم.';

  return `${opening} ${attendanceSentence} ${homeworkSentence} ${noteSentence}`;
}

export interface MonthlyTrendPoint {
  month: JalaliAcademicMonth;
  score: number;
  descriptiveLevel: DescriptiveLevel;
}

export function buildMonthlyTrendPoints(params: {
  entries: GradebookEntry[];
  studentId: string;
  subject: string;
}): MonthlyTrendPoint[] {
  const { entries, studentId, subject } = params;
  const studentEntries = entries.filter(
    (e) => e.studentId === studentId && e.subject === subject && typeof e.numericScore === 'number'
  );

  const byMonth = new Map<JalaliAcademicMonth, GradebookEntry>();
  for (const e of studentEntries) {
    byMonth.set(e.jalaliMonth, e);
  }

  const points: MonthlyTrendPoint[] = [];
  for (const m of ACADEMIC_MONTHS) {
    const found = byMonth.get(m);
    if (found && typeof found.numericScore === 'number') {
      points.push({
        month: m,
        score: found.numericScore,
        descriptiveLevel: found.descriptiveLevel ?? scoreToDescriptiveLevel(found.numericScore),
      });
    }
  }
  return points;
}
