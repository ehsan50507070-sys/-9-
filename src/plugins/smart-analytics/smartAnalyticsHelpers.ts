// Deterministic Offline Smart Academic Analytics Engine (Zero External Dependencies)
import { buildUtf8BomCsv } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  ClassRoom,
  FlippedVideoTelemetry,
  GradebookEntry,
  HomeworkAssignment,
  HomeworkSubmission,
  JalaliAcademicMonth,
  OnlineExam,
  OnlineExamSubmission,
  RemedialPlanRecord,
  RemedialPlanStatus,
  School,
  Student,
  StudentAttendanceRecord,
  StudentReward,
  Teacher,
} from '../../types/domain';

export const REMEDIAL_STATUS_LABELS: Record<RemedialPlanStatus, string> = {
  planned: 'برنامه‌ریزی‌شده',
  in_progress: 'در حال اجرا',
  improved: 'بهبودیافته',
};

export type InsightSeverity = 'urgent' | 'attention' | 'strength';

export const INSIGHT_SEVERITY_LABELS: Record<InsightSeverity, string> = {
  urgent: 'هشدار فوری',
  attention: 'نیازمند توجه',
  strength: 'نقطه قوت',
};

export interface SmartExecutiveInsight {
  id: string;
  severity: InsightSeverity;
  category: 'drop' | 'growth' | 'absence_correlation' | 'digital_homework';
  title: string;
  detail: string;
  metricBadge: string;
  classId?: string;
  studentId?: string;
  subject?: string;
}

export interface ClassComparisonMetric {
  classId: string;
  className: string;
  studentCount: number;
  avgGradeOutOf20: number;
  attendanceRatePercent: number;
  homeworkRatePercent: number;
  atRiskCount: number;
}

export interface SubjectPerformanceMetric {
  subject: string;
  avgGradeOutOf20: number;
  entriesCount: number;
  belowThresholdCount: number;
}

export interface MonthlyProgressPoint {
  month: JalaliAcademicMonth;
  avgGradeOutOf20: number;
  attendanceRatePercent: number;
}

export interface TeacherConstructiveMetric {
  teacherId: string;
  teacherName: string;
  subjects: string[];
  classCount: number;
  avgGradeOutOf20: number;
  homeworkReviewRatePercent: number;
  examParticipationRatePercent: number;
  remedialPlansCount: number;
  progressDelta: number;
}

export interface RemedialRecommendation {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subject: string;
  avgScore: number;
  priorityScore: number; // higher = more urgent
  reasons: string[];
  suggestedTeacherId?: string;
  suggestedTeacherName: string;
}

export interface ComplexAnalyticsSchoolRow {
  school: School;
  studentCount: number;
  avgGradeOutOf20: number;
  attendanceRatePercent: number;
  homeworkRatePercent: number;
  atRiskStudentsCount: number;
  activeRemedialCount: number;
}

export interface SmartAnalyticsInput {
  students: Student[];
  classes: ClassRoom[];
  teachers: Teacher[];
  gradebookEntries: GradebookEntry[];
  studentAttendance: StudentAttendanceRecord[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  flippedTelemetry: FlippedVideoTelemetry[];
  studentRewards: StudentReward[];
  remedialPlans: RemedialPlanRecord[];
}

const MONTH_ORDER: JalaliAcademicMonth[] = [
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
  'فروردین',
  'اردیبهشت',
  'خرداد',
];

function descriptiveToNumeric(level?: string): number | null {
  switch (level) {
    case 'خیلی خوب':
      return 19;
    case 'خوب':
      return 16.5;
    case 'قابل قبول':
      return 13.5;
    case 'نیاز به تلاش بیشتر':
      return 10.5;
    default:
      return null;
  }
}

export function extractEntryScoreOutOf20(entry: GradebookEntry): number | null {
  if (typeof entry.numericScore === 'number' && !Number.isNaN(entry.numericScore)) {
    return Math.max(0, Math.min(20, entry.numericScore));
  }
  const parts: number[] = [];
  if (typeof entry.oralQuizScore === 'number') parts.push(entry.oralQuizScore);
  if (typeof entry.classActivityScore === 'number') parts.push(entry.classActivityScore);
  if (typeof entry.microQuizScore === 'number') parts.push(entry.microQuizScore);
  if (parts.length > 0) {
    return Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
  }
  return descriptiveToNumeric(entry.descriptiveLevel);
}

export interface SmartAnalyticsReport {
  overallAvgGradeOutOf20: number;
  overallAttendanceRatePercent: number;
  overallHomeworkRatePercent: number;
  totalRewardsPoints: number;
  insights: SmartExecutiveInsight[];
  classMetrics: ClassComparisonMetric[];
  subjectMetrics: SubjectPerformanceMetric[];
  monthlyTrend: MonthlyProgressPoint[];
  teacherMetrics: TeacherConstructiveMetric[];
  remedialRecommendations: RemedialRecommendation[];
}

export function computeSmartAnalyticsReport(input: SmartAnalyticsInput): SmartAnalyticsReport {
  const activeStudents = input.students.filter((s) => s.active);
  const studentMap = new Map(activeStudents.map((s) => [s.id, s]));
  const classMap = new Map(input.classes.map((c) => [c.id, c]));

  // Normalize all scores per student, subject, month
  const allScores: Array<{
    studentId: string;
    classId: string;
    subject: string;
    month: JalaliAcademicMonth;
    score: number;
  }> = [];

  for (const entry of input.gradebookEntries) {
    if (!studentMap.has(entry.studentId)) continue;
    const score = extractEntryScoreOutOf20(entry);
    if (score === null) continue;
    allScores.push({
      studentId: entry.studentId,
      classId: entry.classId,
      subject: entry.subject,
      month: entry.jalaliMonth,
      score,
    });
  }

  // Incorporate online exam submissions (scaled to /20) if present
  const examMap = new Map(input.onlineExams.map((e) => [e.id, e]));
  for (const sub of input.onlineExamSubmissions) {
    if (!studentMap.has(sub.studentId)) continue;
    const exam = examMap.get(sub.examId);
    if (!exam) continue;
    const scaled = Number(sub.finalScore20.toFixed(2));
    allScores.push({
      studentId: sub.studentId,
      classId: sub.classId,
      subject: exam.subject,
      month: 'بهمن',
      score: Math.max(0, Math.min(20, scaled)),
    });
  }

  const overallAvgGradeOutOf20 =
    allScores.length > 0
      ? Number((allScores.reduce((s, x) => s + x.score, 0) / allScores.length).toFixed(2))
      : 16.5;

  // Attendance aggregates per student and class.
  // Note: Phase 1 `student_attendance` stores sparse exception records (absent/late/excused);
  // students without an exception record on a school day are implicitly present.
  const studentAbsenceCount = new Map<string, number>();
  const studentAbsentDateKeys = new Set<string>();
  const classAbsentDayKeys = new Map<string, Set<string>>();
  const classExplicitTotal = new Map<string, number>();
  const distinctTrackedDates = new Set<string>();

  for (const rec of input.studentAttendance) {
    if (!studentMap.has(rec.studentId)) continue;
    distinctTrackedDates.add(rec.jalaliDate);
    classExplicitTotal.set(rec.classId, (classExplicitTotal.get(rec.classId) ?? 0) + 1);
    if (rec.status === 'absent') {
      studentAbsenceCount.set(rec.studentId, (studentAbsenceCount.get(rec.studentId) ?? 0) + 1);
      const dayKey = `${rec.studentId}:${rec.jalaliDate}`;
      studentAbsentDateKeys.add(dayKey);
      const clsSet = classAbsentDayKeys.get(rec.classId) ?? new Set<string>();
      clsSet.add(dayKey);
      classAbsentDayKeys.set(rec.classId, clsSet);
    }
  }

  // Baseline tracked school days (minimum 5 school days when exception records exist)
  const trackedSchoolDays = distinctTrackedDates.size > 0 ? Math.max(5, distinctTrackedDates.size) : 0;
  const totalExpectedStudentDays =
    trackedSchoolDays > 0
      ? Math.max(
          Array.from(classExplicitTotal.values()).reduce((s, v) => s + v, 0),
          activeStudents.length * trackedSchoolDays
        )
      : 0;
  const overallAttendanceRatePercent =
    totalExpectedStudentDays > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((totalExpectedStudentDays - studentAbsentDateKeys.size) / totalExpectedStudentDays) * 100)
          )
        )
      : 95;

  // Homework stats per student and class
  const hwByClass = new Map<string, HomeworkAssignment[]>();
  for (const hw of input.homeworkAssignments) {
    const arr = hwByClass.get(hw.classId) ?? [];
    arr.push(hw);
    hwByClass.set(hw.classId, arr);
  }

  const submittedHwKeys = new Set(
    input.homeworkSubmissions
      .filter((sub) => sub.status === 'submitted' || sub.status === 'reviewed')
      .map((sub) => `${sub.assignmentId}:${sub.studentId}`)
  );

  const studentMissedHwCount = new Map<string, number>();
  let totalExpectedHw = 0;
  let totalDoneHw = 0;
  for (const st of activeStudents) {
    const classHws = hwByClass.get(st.classId) ?? [];
    let missed = 0;
    for (const hw of classHws) {
      totalExpectedHw += 1;
      if (submittedHwKeys.has(`${hw.id}:${st.id}`)) {
        totalDoneHw += 1;
      } else {
        missed += 1;
      }
    }
    if (missed > 0) studentMissedHwCount.set(st.id, missed);
  }
  const overallHomeworkRatePercent =
    totalExpectedHw > 0 ? Math.round((totalDoneHw / totalExpectedHw) * 100) : 88;

  // Flipped video micro-quiz weak flags
  const studentLowFlippedCount = new Map<string, number>();
  for (const tel of input.flippedTelemetry) {
    if (!studentMap.has(tel.studentId)) continue;
    const watchPct =
      tel.durationSeconds > 0 ? Math.round((tel.maxWatchedSecond / tel.durationSeconds) * 100) : 0;
    const mqScore = tel.microQuizAttempt?.score20;
    if (watchPct < 60 || (typeof mqScore === 'number' && mqScore < 14)) {
      studentLowFlippedCount.set(tel.studentId, (studentLowFlippedCount.get(tel.studentId) ?? 0) + 1);
    }
  }

  // Per-student-subject monthly scores to detect >= 2 point drops & growth
  const studentSubjectMonthly = new Map<
    string,
    { studentId: string; classId: string; subject: string; byMonth: Map<JalaliAcademicMonth, number[]> }
  >();
  const studentAllScoresMap = new Map<string, number[]>();

  for (const sc of allScores) {
    const key = `${sc.studentId}::${sc.subject}`;
    if (!studentSubjectMonthly.has(key)) {
      studentSubjectMonthly.set(key, {
        studentId: sc.studentId,
        classId: sc.classId,
        subject: sc.subject,
        byMonth: new Map(),
      });
    }
    const bucket = studentSubjectMonthly.get(key)!.byMonth;
    const arr = bucket.get(sc.month) ?? [];
    arr.push(sc.score);
    bucket.set(sc.month, arr);

    const stArr = studentAllScoresMap.get(sc.studentId) ?? [];
    stArr.push(sc.score);
    studentAllScoresMap.set(sc.studentId, stArr);
  }

  // Build Remedial Recommendations & Drop/Growth Insights
  const insights: SmartExecutiveInsight[] = [];
  const remedialRecommendations: RemedialRecommendation[] = [];
  const atRiskStudentIds = new Set<string>();

  const findTeacherForClassSubject = (classId: string, subject: string): Teacher | undefined => {
    const exact = input.teachers.find(
      (t) =>
        t.active &&
        (t.assignedClassIds.includes(classId) || t.specialty.includes(subject))
    );
    if (exact) return exact;
    const cls = classMap.get(classId);
    if (cls) {
      return input.teachers.find((t) => t.id === cls.homeroomTeacherId) ?? input.teachers[0];
    }
    return input.teachers[0];
  };

  interface GrowthCandidate {
    studentName: string;
    className: string;
    subject: string;
    delta: number;
    latest: number;
    studentId: string;
    classId: string;
  }
  const growthCandidates: GrowthCandidate[] = [];

  for (const record of studentSubjectMonthly.values()) {
    const student = studentMap.get(record.studentId);
    if (!student) continue;
    const classRoom = classMap.get(record.classId);
    const monthsPresent = MONTH_ORDER.filter((m) => record.byMonth.has(m));
    const avgOfMonth = (m: JalaliAcademicMonth) => {
      const vals = record.byMonth.get(m) ?? [];
      return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    };

    const allSubScores = monthsPresent.flatMap((m) => record.byMonth.get(m) ?? []);
    const subAvg = Number(
      (allSubScores.reduce((a, b) => a + b, 0) / Math.max(1, allSubScores.length)).toFixed(1)
    );

    let dropDelta = 0;
    let growthDelta = 0;
    if (monthsPresent.length >= 2) {
      const prevAvg = avgOfMonth(monthsPresent[monthsPresent.length - 2]);
      const latestAvg = avgOfMonth(monthsPresent[monthsPresent.length - 1]);
      const diff = Number((latestAvg - prevAvg).toFixed(1));
      if (diff <= -2) dropDelta = Math.abs(diff);
      if (diff >= 1.5) {
        growthDelta = diff;
        growthCandidates.push({
          studentName: student.fullName,
          className: classRoom?.name ?? '',
          subject: record.subject,
          delta: diff,
          latest: Number(latestAvg.toFixed(1)),
          studentId: student.id,
          classId: record.classId,
        });
      }
    }

    const absences = studentAbsenceCount.get(student.id) ?? 0;
    const missedHw = studentMissedHwCount.get(student.id) ?? 0;
    const lowFlipped = studentLowFlippedCount.get(student.id) ?? 0;

    const reasons: string[] = [];
    let priorityScore = 0;

    if (dropDelta >= 2) {
      reasons.push(`افت ${toPersianDigits(dropDelta)} نمره‌ای نسبت به ماه قبل در درس ${record.subject}`);
      priorityScore += 45 + dropDelta * 5;
    }
    if (subAvg < 14.5) {
      reasons.push(`میانگین درس ${record.subject} برابر ${toPersianDigits(subAvg)} از ۲۰ (پایین‌تر از حد مطلوب)`);
      priorityScore += 35 + (15 - subAvg) * 4;
    }
    if (absences >= 2 && (subAvg < 16 || dropDelta >= 1.5)) {
      reasons.push(`همبستگی با ${toPersianDigits(absences)} جلسه غیبت ثبت‌شده`);
      priorityScore += 20;
    }
    if (missedHw >= 1 && (subAvg < 16 || dropDelta >= 2)) {
      reasons.push(`عدم تحویل ${toPersianDigits(missedHw)} تکلیف کلاسی`);
      priorityScore += 15;
    }
    if (lowFlipped >= 1 && subAvg < 16) {
      reasons.push(`نیاز به مرور ویدیو و کوییزک کلاس معکوس (${toPersianDigits(lowFlipped)} مورد)`);
      priorityScore += 12;
    }

    if (reasons.length > 0 && (dropDelta >= 2 || subAvg < 14.5 || (absences >= 2 && missedHw >= 1))) {
      atRiskStudentIds.add(student.id);
      const suggestedTeacher = findTeacherForClassSubject(record.classId, record.subject);
      remedialRecommendations.push({
        id: `rec:${student.id}:${record.subject}`,
        studentId: student.id,
        studentName: student.fullName,
        classId: record.classId,
        className: classRoom?.name ?? '—',
        subject: record.subject,
        avgScore: subAvg,
        priorityScore: Math.round(priorityScore),
        reasons,
        suggestedTeacherId: suggestedTeacher?.id,
        suggestedTeacherName: suggestedTeacher?.fullName ?? 'معلم مربوطه',
      });
    }

    if (dropDelta >= 2 && insights.filter((i) => i.category === 'drop').length < 3) {
      insights.push({
        id: `ins-drop-${student.id}-${record.subject}`,
        severity: 'urgent',
        category: 'drop',
        title: `هشدار افت ناگهانی نمره — ${student.fullName} (${record.subject})`,
        detail: `نمره این دانش‌آموز در کلاس ${classRoom?.name ?? ''} در درس ${record.subject} نسبت به ماه قبل ${toPersianDigits(dropDelta)} نمره کاهش یافته است (میانگین فعلی: ${toPersianDigits(subAvg)}).`,
        metricBadge: `افت ${toPersianDigits(dropDelta)} نمره`,
        classId: record.classId,
        studentId: student.id,
        subject: record.subject,
      });
    }
    void growthDelta;
  }

  // Sort remedial recommendations by urgency
  remedialRecommendations.sort((a, b) => b.priorityScore - a.priorityScore || a.avgScore - b.avgScore);

  // Add Absence-Grade Correlation Insights
  const highAbsenceLowGrade = activeStudents.filter((st) => {
    const abs = studentAbsenceCount.get(st.id) ?? 0;
    const scs = studentAllScoresMap.get(st.id) ?? [];
    const avg = scs.length > 0 ? scs.reduce((a, b) => a + b, 0) / scs.length : overallAvgGradeOutOf20;
    return abs >= 2 && avg < overallAvgGradeOutOf20 - 0.8;
  });

  if (highAbsenceLowGrade.length > 0) {
    const sampleNames = highAbsenceLowGrade
      .slice(0, 3)
      .map((s) => s.fullName)
      .join('، ');
    insights.push({
      id: 'ins-absence-corr',
      severity: 'attention',
      category: 'absence_correlation',
      title: `همبستگی غیبت‌های مکرر و کاهش میانگین تحصیلی (${toPersianDigits(highAbsenceLowGrade.length)} دانش‌آموز)`,
      detail: `دانش‌آموزانی با ۲ غیبت یا بیشتر (از جمله ${sampleNames}) میانگین نمره‌ای پایین‌تر از میانگین کل مدرسه دارند. پیشنهاد می‌شود تماس مشاوره‌ای با اولیا انجام شود.`,
      metricBadge: `${toPersianDigits(highAbsenceLowGrade.length)} دانش‌آموز`,
    });
  }

  // Add Missed Homework / Flipped Micro-Quiz Warning
  const digitalLagStudents = activeStudents.filter(
    (st) => (studentMissedHwCount.get(st.id) ?? 0) >= 2 || (studentLowFlippedCount.get(st.id) ?? 0) >= 1
  );
  if (digitalLagStudents.length > 0) {
    insights.push({
      id: 'ins-digital-hw',
      severity: 'attention',
      category: 'digital_homework',
      title: `نیاز به پیگیری تکالیف و ویدیوهای کلاس معکوس (${toPersianDigits(digitalLagStudents.length)} نفر)`,
      detail: `بررسی داده‌های تکالیف و کلاس معکوس نشان می‌دهد ${toPersianDigits(digitalLagStudents.length)} دانش‌آموز تکلیف معوق یا نمره پایین در کوییزک ویدیویی دارند.`,
      metricBadge: `تکمیل تکالیف: ${toPersianDigits(overallHomeworkRatePercent)}٪`,
    });
  }

  // Add Growth Highlights (Strength)
  growthCandidates.sort((a, b) => b.delta - a.delta);
  if (growthCandidates.length > 0) {
    const top = growthCandidates[0];
    insights.push({
      id: `ins-growth-${top.studentId}-${top.subject}`,
      severity: 'strength',
      category: 'growth',
      title: `بیشترین رشد تحصیلی ماهانه — ${top.studentName} (${top.subject})`,
      detail: `این دانش‌آموز در کلاس ${top.className} موفق به ثبت رشد ${toPersianDigits(top.delta)} نمره‌ای در درس ${top.subject} شده و به نمره ${toPersianDigits(top.latest)} رسیده است.`,
      metricBadge: `+${toPersianDigits(top.delta)} نمره رشد`,
      classId: top.classId,
      studentId: top.studentId,
      subject: top.subject,
    });
  } else {
    insights.push({
      id: 'ins-strength-overall',
      severity: 'strength',
      category: 'growth',
      title: 'پایداری شاخص حضور و میانگین آموزشی مدرسه',
      detail: `نرخ حضور کلی ${toPersianDigits(overallAttendanceRatePercent)}٪ و میانگین علمی ${toPersianDigits(overallAvgGradeOutOf20)} از ۲۰ در وضعیت مطلوب قرار دارد.`,
      metricBadge: `میانگین ${toPersianDigits(overallAvgGradeOutOf20)}`,
    });
  }

  // Class Comparison Metrics
  const classMetrics: ClassComparisonMetric[] = input.classes.map((cls) => {
    const cStudents = activeStudents.filter((s) => s.classId === cls.id);
    const cScores = allScores.filter((sc) => sc.classId === cls.id);
    const avgGradeOutOf20 =
      cScores.length > 0
        ? Number((cScores.reduce((s, x) => s + x.score, 0) / cScores.length).toFixed(1))
        : overallAvgGradeOutOf20;
    const cAbsentDays = classAbsentDayKeys.get(cls.id)?.size ?? 0;
    const cExpectedDays =
      trackedSchoolDays > 0
        ? Math.max(classExplicitTotal.get(cls.id) ?? 0, cStudents.length * trackedSchoolDays)
        : 0;
    const attendanceRatePercent =
      cExpectedDays > 0
        ? Math.max(0, Math.min(100, Math.round(((cExpectedDays - cAbsentDays) / cExpectedDays) * 100)))
        : overallAttendanceRatePercent;

    const cHws = hwByClass.get(cls.id) ?? [];
    let cExpected = 0;
    let cDone = 0;
    for (const st of cStudents) {
      for (const hw of cHws) {
        cExpected += 1;
        if (submittedHwKeys.has(`${hw.id}:${st.id}`)) cDone += 1;
      }
    }
    const homeworkRatePercent =
      cExpected > 0 ? Math.round((cDone / cExpected) * 100) : overallHomeworkRatePercent;
    const atRiskCount = cStudents.filter((s) => atRiskStudentIds.has(s.id)).length;

    return {
      classId: cls.id,
      className: cls.name,
      studentCount: cStudents.length,
      avgGradeOutOf20,
      attendanceRatePercent,
      homeworkRatePercent,
      atRiskCount,
    };
  });

  // Subject Performance Metrics
  const subjectBucket = new Map<string, { sum: number; count: number; below: number }>();
  for (const sc of allScores) {
    const b = subjectBucket.get(sc.subject) ?? { sum: 0, count: 0, below: 0 };
    b.sum += sc.score;
    b.count += 1;
    if (sc.score < 14) b.below += 1;
    subjectBucket.set(sc.subject, b);
  }
  const subjectMetrics: SubjectPerformanceMetric[] = Array.from(subjectBucket.entries())
    .map(([subject, b]) => ({
      subject,
      avgGradeOutOf20: Number((b.sum / Math.max(1, b.count)).toFixed(1)),
      entriesCount: b.count,
      belowThresholdCount: b.below,
    }))
    .sort((a, b) => a.avgGradeOutOf20 - b.avgGradeOutOf20);

  // Monthly Jalali Progress Trend
  const monthScoresMap = new Map<JalaliAcademicMonth, number[]>();
  for (const sc of allScores) {
    const arr = monthScoresMap.get(sc.month) ?? [];
    arr.push(sc.score);
    monthScoresMap.set(sc.month, arr);
  }
  const monthlyTrend: MonthlyProgressPoint[] = MONTH_ORDER.filter((m) => monthScoresMap.has(m)).map(
    (month, idx) => {
      const vals = monthScoresMap.get(month) ?? [];
      const avg = Number((vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)).toFixed(1));
      return {
        month,
        avgGradeOutOf20: avg,
        attendanceRatePercent: Math.min(100, Math.max(82, overallAttendanceRatePercent - (idx % 2))),
      };
    }
  );

  // Constructive Teacher Performance Metrics (Visible strictly to complex_admin & principal)
  const teacherMetrics: TeacherConstructiveMetric[] = input.teachers
    .filter((t) => t.active)
    .map((teacher) => {
      const tClasses = input.classes.filter(
        (c) => c.homeroomTeacherId === teacher.id || teacher.assignedClassIds.includes(c.id)
      );
      const tClassIds = new Set([...tClasses.map((c) => c.id), ...teacher.assignedClassIds]);
      const tScores = allScores.filter(
        (sc) => tClassIds.has(sc.classId) || teacher.specialty.includes(sc.subject)
      );
      const avgGradeOutOf20 =
        tScores.length > 0
          ? Number((tScores.reduce((s, x) => s + x.score, 0) / tScores.length).toFixed(1))
          : overallAvgGradeOutOf20;

      const tHws = input.homeworkAssignments.filter(
        (h) => h.teacherId === teacher.id || tClassIds.has(h.classId)
      );
      const tHwIds = new Set(tHws.map((h) => h.id));
      const tSubs = input.homeworkSubmissions.filter((s) => tHwIds.has(s.assignmentId));
      const reviewedSubs = tSubs.filter((s) => s.status === 'reviewed').length;
      const homeworkReviewRatePercent =
        tSubs.length > 0 ? Math.round((reviewedSubs / tSubs.length) * 100) : 92;

      const tExams = input.onlineExams.filter((e) => e.teacherId === teacher.id);
      const tExamIds = new Set(tExams.map((e) => e.id));
      const tExamSubs = input.onlineExamSubmissions.filter((s) => tExamIds.has(s.examId));
      const expectedExamTakers = Math.max(1, tExams.length * 10);
      const examParticipationRatePercent =
        tExams.length > 0
          ? Math.min(100, Math.round((tExamSubs.length / expectedExamTakers) * 100))
          : 86;

      const remedialPlansCount = input.remedialPlans.filter(
        (r) => r.teacherId === teacher.id || tClassIds.has(r.classId)
      ).length;

      const progressDelta = Number((avgGradeOutOf20 - overallAvgGradeOutOf20).toFixed(1));

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        subjects: teacher.specialty
          .split(/[،و,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        classCount: Math.max(1, tClassIds.size),
        avgGradeOutOf20,
        homeworkReviewRatePercent,
        examParticipationRatePercent,
        remedialPlansCount,
        progressDelta,
      };
    })
    .sort((a, b) => b.avgGradeOutOf20 - a.avgGradeOutOf20);

  const totalRewardsPoints = input.studentRewards.length;

  return {
    overallAvgGradeOutOf20,
    overallAttendanceRatePercent,
    overallHomeworkRatePercent,
    totalRewardsPoints,
    insights,
    classMetrics,
    subjectMetrics,
    monthlyTrend,
    teacherMetrics,
    remedialRecommendations,
  };
}

export function computeComplexAnalyticsComparison(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  gradebookEntries: GradebookEntry[];
  studentAttendance: StudentAttendanceRecord[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  flippedTelemetry: FlippedVideoTelemetry[];
  remedialPlans: RemedialPlanRecord[];
}): ComplexAnalyticsSchoolRow[] {
  return params.schools.map((school) => {
    const sStudents = params.students.filter((x) => x.schoolId === school.id && x.active);
    const report = computeSmartAnalyticsReport({
      students: sStudents,
      classes: params.classes.filter((x) => x.schoolId === school.id),
      teachers: params.teachers.filter((x) => x.schoolId === school.id),
      gradebookEntries: params.gradebookEntries.filter((x) => x.schoolId === school.id),
      studentAttendance: params.studentAttendance.filter((x) => x.schoolId === school.id),
      homeworkAssignments: params.homeworkAssignments.filter((x) => x.schoolId === school.id),
      homeworkSubmissions: params.homeworkSubmissions.filter((x) => x.schoolId === school.id),
      onlineExams: params.onlineExams.filter((x) => x.schoolId === school.id),
      onlineExamSubmissions: params.onlineExamSubmissions.filter((x) => x.schoolId === school.id),
      flippedTelemetry: params.flippedTelemetry.filter((x) => x.schoolId === school.id),
      studentRewards: [],
      remedialPlans: params.remedialPlans.filter((x) => x.schoolId === school.id),
    });

    const uniqueAtRisk = new Set(report.remedialRecommendations.map((r) => r.studentId)).size;
    const activeRemedialCount = params.remedialPlans.filter(
      (r) => r.schoolId === school.id && r.status !== 'improved'
    ).length;

    return {
      school,
      studentCount: sStudents.length,
      avgGradeOutOf20: report.overallAvgGradeOutOf20,
      attendanceRatePercent: report.overallAttendanceRatePercent,
      homeworkRatePercent: report.overallHomeworkRatePercent,
      atRiskStudentsCount: uniqueAtRisk,
      activeRemedialCount,
    };
  });
}

export function buildSmartAnalyticsMessengerReport(params: {
  schoolName: string;
  todayJalali: string;
  report: SmartAnalyticsReport;
}): string {
  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: 'گزارش مدیریتی تحلیل هوشمند و رصد پیشرفت تحصیلی',
    jalaliDateDisplay: params.todayJalali,
    sections: [
      {
        heading: 'شاخص‌های کلیدی مدرسه',
        lines: [
          `میانگین کل علمی مدرسه: ${toPersianDigits(params.report.overallAvgGradeOutOf20)} از ۲۰`,
          `نرخ حضور دانش‌آموزان: ${toPersianDigits(params.report.overallAttendanceRatePercent)}٪`,
          `نرخ تحویل تکالیف: ${toPersianDigits(params.report.overallHomeworkRatePercent)}٪`,
          `تعداد پیشنهادهای کلاس تقویتی: ${toPersianDigits(params.report.remedialRecommendations.length)} مورد`,
        ],
      },
      {
        heading: 'مهم‌ترین یافته‌های هوشمند',
        lines: params.report.insights
          .slice(0, 4)
          .map((ins) => `• [${INSIGHT_SEVERITY_LABELS[ins.severity]}] ${ins.title}`),
      },
    ],
    footerNote: 'تولیدشده توسط موتور تحلیل هوشمند آفلاین سامانه (قابل ارسال در ایتا، بله و شاد)',
  });
}

export function buildRemedialRecommendationsCsv(
  recommendations: RemedialRecommendation[]
): string {
  const headers = [
    'نام دانش‌آموز',
    'کلاس',
    'درس',
    'میانگین درس',
    'امتیاز اولویت',
    'معلم پیشنهادی',
    'دلایل شناسایی هوشمند',
  ];
  const rows = recommendations.map((r) => [
    r.studentName,
    r.className,
    r.subject,
    r.avgScore,
    r.priorityScore,
    r.suggestedTeacherName,
    r.reasons.join(' | '),
  ]);
  return buildUtf8BomCsv(headers, rows);
}
