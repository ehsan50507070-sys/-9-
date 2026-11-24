// Pure, Deterministic Business Logic for Phase 7: Teacher Professional Development, Anti-Cheat Quizzes, 5-Tier Ranking & 3-School Analytics
import { buildUtf8BomCsv } from '../../lib/csv';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, parseJalaliString } from '../../lib/jalali';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  School,
  Teacher,
  TeacherDevCertificate,
  TeacherDevContentType,
  TeacherDevCourse,
  TeacherDevProgress,
  TeacherDevQuizOption,
  TeacherDevQuizQuestion,
  TeacherDevRankingPrivacyMode,
  TeacherDevRequirement,
} from '../../types/domain';

export const CONTENT_TYPE_LABELS: Record<TeacherDevContentType, string> = {
  course: 'دوره آموزشی',
  book: 'کتاب و جزوه مطالعاتی',
  video_workshop: 'کارگاه ویدیویی',
};

export const REQUIREMENT_LABELS: Record<TeacherDevRequirement, string> = {
  mandatory: 'الزامی',
  optional: 'اختیاری',
};

export const PRIVACY_MODE_LABELS: Record<
  TeacherDevRankingPrivacyMode,
  { title: string; description: string }
> = {
  public: {
    title: 'عمومی بین همکاران',
    description: 'معلمان جدول کامل رتبه‌بندی، سطوح ۵گانه و امتیاز کل همکاران مدرسه خود را مشاهده می‌کنند.',
  },
  top3_only: {
    title: 'فقط نمایش ۳ نفر برتر',
    description: 'معلمان تنها سکوی افتخار ۳ نفر برتر مدرسه و رتبه و سطح شخصی خود را به‌صورت محرمانه می‌بینند.',
  },
  private: {
    title: 'کاملاً محرمانه (پیشنهادی)',
    description: 'هر معلم صرفاً سطح، امتیاز و مسیر پیشرفت شخصی خود را می‌بیند و امتیاز هیچ همکار دیگری نمایش داده نمی‌شود.',
  },
};

export interface TeacherRankTierDefinition {
  level: 1 | 2 | 3 | 4 | 5;
  titleFa: string;
  shortTitleFa: string;
  minPoints: number;
  maxPoints: number | null;
  colorHex: string;
  badgeClass: string;
}

export const TEACHER_RANK_TIERS: readonly TeacherRankTierDefinition[] = [
  {
    level: 1,
    titleFa: 'سطح ۱ — همکار تازه‌مسیر',
    shortTitleFa: 'همکار تازه‌مسیر',
    minPoints: 0,
    maxPoints: 99,
    colorHex: '#64748b',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  },
  {
    level: 2,
    titleFa: 'سطح ۲ — معلم کوشا',
    shortTitleFa: 'معلم کوشا',
    minPoints: 100,
    maxPoints: 249,
    colorHex: '#0284c7',
    badgeClass: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800',
  },
  {
    level: 3,
    titleFa: 'سطح ۳ — معلم پیشرو',
    shortTitleFa: 'معلم پیشرو',
    minPoints: 250,
    maxPoints: 449,
    colorHex: '#059669',
    badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  },
  {
    level: 4,
    titleFa: 'سطح ۴ — معلم خبره',
    shortTitleFa: 'معلم خبره',
    minPoints: 450,
    maxPoints: 699,
    colorHex: '#4f46e5',
    badgeClass: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
  },
  {
    level: 5,
    titleFa: 'سطح ۵ — استاد راهبر',
    shortTitleFa: 'استاد راهبر',
    minPoints: 700,
    maxPoints: null,
    colorHex: '#d97706',
    badgeClass: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
] as const;

// --- Deterministic Anti-Cheat Seeded PRNG (FNV-1a 32-bit + Mulberry32) & Fisher-Yates ---

export function hashSeedString(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: string): () => number {
  let state = hashSeedString(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededFisherYatesShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const rng = createSeededRng(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

export interface ShuffledQuizQuestion {
  id: string;
  prompt: string;
  options: TeacherDevQuizOption[];
  /** Stored only for internal grading verification; UI must never expose before final lock */
  correctOptionId: string;
}

export interface ShuffledQuizAttemptPayload {
  seed: string;
  attemptNumber: number;
  questions: ShuffledQuizQuestion[];
}

export function buildQuizAttemptSeed(
  teacherId: string,
  courseId: string,
  attemptNumber: number
): string {
  return `${teacherId}::${courseId}::attempt-${attemptNumber}`;
}

/**
 * Generates a deterministic per-person & per-attempt shuffled quiz.
 * Option order is shuffled for every question (when shuffleOptions is true) while preserving stable option IDs.
 */
export function buildShuffledQuizAttempt(
  course: TeacherDevCourse,
  teacherId: string,
  attemptNumber: number
): ShuffledQuizAttemptPayload {
  const seed = buildQuizAttemptSeed(teacherId, course.id, attemptNumber);
  const orderedQuestions: TeacherDevQuizQuestion[] = course.shuffleQuestions
    ? seededFisherYatesShuffle(course.quizQuestions, `${seed}:questions`)
    : [...course.quizQuestions];

  const questions: ShuffledQuizQuestion[] = orderedQuestions.map((q) => {
    const shuffledOptions = course.shuffleOptions
      ? seededFisherYatesShuffle(q.options, `${seed}:q:${q.id}`)
      : [...q.options];
    return {
      id: q.id,
      prompt: q.prompt,
      options: shuffledOptions,
      correctOptionId: q.correctOptionId,
    };
  });

  return {
    seed,
    attemptNumber,
    questions,
  };
}

export interface QuizGradingResult {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  passed: boolean;
}

/**
 * Strictly grades by comparing selected option.id === question.correctOptionId (never by index).
 */
export function gradeTeacherQuizAttempt(
  course: TeacherDevCourse,
  answersByQuestionId: Record<string, string>
): QuizGradingResult {
  const totalQuestions = course.quizQuestions.length;
  if (totalQuestions === 0) {
    return { correctCount: 0, totalQuestions: 0, scorePercent: 0, passed: false };
  }
  let correctCount = 0;
  for (const q of course.quizQuestions) {
    const selectedId = answersByQuestionId[q.id];
    if (selectedId && selectedId === q.correctOptionId) {
      correctCount++;
    }
  }
  const scorePercent = Math.round((correctCount / totalQuestions) * 100);
  const passed = scorePercent >= course.passingScorePercent;
  return {
    correctCount,
    totalQuestions,
    scorePercent,
    passed,
  };
}

/**
 * Final Quiz Lock rule: Quiz unlocks ONLY when 100% of course chapters are completed.
 */
export function isQuizUnlocked(
  course: TeacherDevCourse,
  progress?: TeacherDevProgress | null
): boolean {
  if (course.chapters.length === 0) return true;
  if (!progress) return false;
  const completedSet = new Set(progress.completedChapterIds);
  return course.chapters.every((ch) => completedSet.has(ch.id));
}

export function getChapterCompletionStats(
  course: TeacherDevCourse,
  progress?: TeacherDevProgress | null
): { completedCount: number; totalCount: number; percent: number } {
  const totalCount = course.chapters.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percent: 100 };
  }
  const completedSet = new Set(progress?.completedChapterIds ?? []);
  const completedCount = course.chapters.filter((ch) => completedSet.has(ch.id)).length;
  const percent = Math.round((completedCount / totalCount) * 100);
  return { completedCount, totalCount, percent };
}

// --- Jalali Date Comparison Helpers ---

export function compareJalaliDates(a: string, b: string): number {
  const pa = parseJalaliString(a);
  const pb = parseJalaliString(b);
  if (!pa || !pb) {
    return toAsciiDigits(a).localeCompare(toAsciiDigits(b));
  }
  if (pa.jy !== pb.jy) return pa.jy - pb.jy;
  if (pa.jm !== pb.jm) return pa.jm - pb.jm;
  return pa.jd - pb.jd;
}

export function isOnTimeCompletion(completedDateJalali: string, deadlineJalali: string): boolean {
  return compareJalaliDates(completedDateJalali, deadlineJalali) <= 0;
}

export function isCourseOverdue(
  course: TeacherDevCourse,
  todayJalali: string,
  progress?: TeacherDevProgress | null
): boolean {
  if (course.status !== 'active' || course.requirement !== 'mandatory') return false;
  if (progress?.status === 'completed') return false;
  return compareJalaliDates(todayJalali, course.deadlineJalali) > 0;
}

// --- Unique Certificate Serial Generator ---

export function generateCertificateSerial(params: {
  schoolId: string;
  teacherId: string;
  courseId: string;
  issuedDateJalali: string;
}): string {
  const year = toAsciiDigits(params.issuedDateJalali).slice(0, 4) || '1405';
  const schoolCode = params.schoolId.replace('school-', 'S').toUpperCase();
  const hash = hashSeedString(`${params.schoolId}:${params.teacherId}:${params.courseId}:${params.issuedDateJalali}`);
  const numericSuffix = String(1000 + (hash % 9000));
  return `TD-${year}-${schoolCode}-${numericSuffix}`;
}

// --- 5-Tier Ranking & Transparent Points Calculator ---

export function resolveTeacherRankTier(points: number): TeacherRankTierDefinition {
  const safePoints = Math.max(0, Math.floor(points));
  for (let i = TEACHER_RANK_TIERS.length - 1; i >= 0; i--) {
    if (safePoints >= TEACHER_RANK_TIERS[i].minPoints) {
      return TEACHER_RANK_TIERS[i];
    }
  }
  return TEACHER_RANK_TIERS[0];
}

export interface TeacherPointsBreakdown {
  mandatoryHoursPoints: number;
  optionalHoursPoints: number;
  qualityScoreBonus: number;
  onTimeBonus: number;
  activeStudyPoints: number;
  totalPoints: number;
}

export interface TeacherStandingRow {
  rank: number;
  teacherId: string;
  teacherName: string;
  specialty: string;
  schoolId: string;
  totalApprovedHours: number;
  mandatoryCompletedCount: number;
  mandatoryTotalCount: number;
  optionalCompletedCount: number;
  completedCertificatesCount: number;
  avgQuizScorePercent: number;
  points: number;
  breakdown: TeacherPointsBreakdown;
  tier: TeacherRankTierDefinition;
  nextTier: TeacherRankTierDefinition | null;
  pointsToNextTier: number;
  tierProgressPercent: number;
}

export function calculateTeacherPointsBreakdown(params: {
  certificates: TeacherDevCertificate[];
  progressList: TeacherDevProgress[];
  coursesById: Map<string, TeacherDevCourse>;
}): TeacherPointsBreakdown {
  let mandatoryHoursPoints = 0;
  let optionalHoursPoints = 0;
  let qualityScoreBonus = 0;
  let onTimeBonus = 0;
  let activeStudyPoints = 0;

  const completedCourseIds = new Set<string>();
  for (const cert of params.certificates) {
    completedCourseIds.add(cert.courseId);
    if (cert.requirement === 'mandatory') {
      mandatoryHoursPoints += cert.inServiceHours * 20;
    } else {
      optionalHoursPoints += cert.inServiceHours * 14;
    }
    if (cert.scorePercent >= 90) {
      qualityScoreBonus += 45;
    } else if (cert.scorePercent >= 80) {
      qualityScoreBonus += 25;
    } else {
      qualityScoreBonus += 10;
    }
    if (cert.onTime) {
      onTimeBonus += 30;
    }
  }

  // Encouraging partial progress points for in-progress chapters (not yet certified)
  for (const prog of params.progressList) {
    if (completedCourseIds.has(prog.courseId)) continue;
    const course = params.coursesById.get(prog.courseId);
    if (!course || course.status !== 'active') continue;
    activeStudyPoints += prog.completedChapterIds.length * 5;
  }

  return {
    mandatoryHoursPoints,
    optionalHoursPoints,
    qualityScoreBonus,
    onTimeBonus,
    activeStudyPoints,
    totalPoints:
      mandatoryHoursPoints +
      optionalHoursPoints +
      qualityScoreBonus +
      onTimeBonus +
      activeStudyPoints,
  };
}

export function buildSchoolLeaderboard(params: {
  schoolId: string;
  teachers: Teacher[];
  courses: TeacherDevCourse[];
  progressList: TeacherDevProgress[];
  certificates: TeacherDevCertificate[];
}): TeacherStandingRow[] {
  const schoolTeachers = params.teachers.filter((t) => t.schoolId === params.schoolId && t.active);
  const schoolCourses = params.courses.filter(
    (c) => c.schoolId === params.schoolId && c.status === 'active'
  );
  const coursesById = new Map(params.courses.filter((c) => c.schoolId === params.schoolId).map((c) => [c.id, c]));
  const mandatoryTotalCount = schoolCourses.filter((c) => c.requirement === 'mandatory').length;

  const rawRows: Omit<TeacherStandingRow, 'rank'>[] = schoolTeachers.map((teacher) => {
    const teacherCerts = params.certificates.filter(
      (c) => c.schoolId === params.schoolId && c.teacherId === teacher.id
    );
    const teacherProg = params.progressList.filter(
      (p) => p.schoolId === params.schoolId && p.teacherId === teacher.id
    );

    const breakdown = calculateTeacherPointsBreakdown({
      certificates: teacherCerts,
      progressList: teacherProg,
      coursesById,
    });
    const points = breakdown.totalPoints;
    const tier = resolveTeacherRankTier(points);
    const nextTier = TEACHER_RANK_TIERS.find((t) => t.level === tier.level + 1) ?? null;
    const pointsToNextTier = nextTier ? Math.max(0, nextTier.minPoints - points) : 0;
    const tierSpan = nextTier ? Math.max(1, nextTier.minPoints - tier.minPoints) : 1;
    const tierProgressPercent = nextTier
      ? Math.max(0, Math.min(100, Math.round(((points - tier.minPoints) / tierSpan) * 100)))
      : 100;

    const totalApprovedHours = teacherCerts.reduce((sum, c) => sum + c.inServiceHours, 0);
    const mandatoryCompletedCount = teacherCerts.filter((c) => c.requirement === 'mandatory').length;
    const optionalCompletedCount = teacherCerts.filter((c) => c.requirement === 'optional').length;
    const avgQuizScorePercent =
      teacherCerts.length > 0
        ? Math.round(teacherCerts.reduce((sum, c) => sum + c.scorePercent, 0) / teacherCerts.length)
        : 0;

    return {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      specialty: teacher.specialty,
      schoolId: params.schoolId,
      totalApprovedHours,
      mandatoryCompletedCount,
      mandatoryTotalCount,
      optionalCompletedCount,
      completedCertificatesCount: teacherCerts.length,
      avgQuizScorePercent,
      points,
      breakdown,
      tier,
      nextTier,
      pointsToNextTier,
      tierProgressPercent,
    };
  });

  rawRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalApprovedHours !== a.totalApprovedHours) {
      return b.totalApprovedHours - a.totalApprovedHours;
    }
    if (b.avgQuizScorePercent !== a.avgQuizScorePercent) {
      return b.avgQuizScorePercent - a.avgQuizScorePercent;
    }
    return a.teacherName.localeCompare(b.teacherName, 'fa');
  });

  return rawRows.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

export interface PrivacyFilteredLeaderboard {
  privacyMode: TeacherDevRankingPrivacyMode;
  visibleRows: TeacherStandingRow[];
  ownStanding: TeacherStandingRow | null;
  totalTeachersCount: number;
}

/**
 * Strictly enforces school ranking privacy mode for the `teacher` role.
 * Admins/Principals/Deputies receive full school leaderboard separately.
 */
export function applyLeaderboardPrivacy(params: {
  allRows: TeacherStandingRow[];
  privacyMode: TeacherDevRankingPrivacyMode;
  viewerIsManager: boolean;
  currentTeacherId?: string | null;
}): PrivacyFilteredLeaderboard {
  const { allRows, privacyMode, viewerIsManager, currentTeacherId } = params;
  const ownStanding = currentTeacherId
    ? allRows.find((r) => r.teacherId === currentTeacherId) ?? null
    : null;

  if (viewerIsManager) {
    return {
      privacyMode,
      visibleRows: allRows,
      ownStanding,
      totalTeachersCount: allRows.length,
    };
  }

  if (privacyMode === 'private') {
    return {
      privacyMode,
      visibleRows: [],
      ownStanding,
      totalTeachersCount: allRows.length,
    };
  }

  if (privacyMode === 'top3_only') {
    return {
      privacyMode,
      visibleRows: allRows.slice(0, 3),
      ownStanding,
      totalTeachersCount: allRows.length,
    };
  }

  return {
    privacyMode,
    visibleRows: allRows,
    ownStanding,
    totalTeachersCount: allRows.length,
  };
}

// --- Participation Matrix Computation ---

export type MatrixCellStatus =
  | 'completed'
  | 'in_progress'
  | 'quiz_failed'
  | 'not_started'
  | 'overdue';

export interface MatrixCellData {
  courseId: string;
  teacherId: string;
  status: MatrixCellStatus;
  labelFa: string;
  studyPercent: number;
  scorePercent?: number;
  inServiceHours?: number;
  attemptsUsed: number;
  certificate?: TeacherDevCertificate;
}

export interface ParticipationMatrixRow {
  teacher: Teacher;
  cells: MatrixCellData[];
  totalApprovedHours: number;
  completedCount: number;
  pendingMandatoryCourses: TeacherDevCourse[];
}

export interface ParticipationMatrixCourseSummary {
  courseId: string;
  completedCount: number;
  totalTeachers: number;
  completionRatePercent: number;
}

export interface ParticipationMatrixResult {
  courses: TeacherDevCourse[];
  rows: ParticipationMatrixRow[];
  courseSummaries: ParticipationMatrixCourseSummary[];
  overallCompletionRatePercent: number;
  totalSchoolApprovedHours: number;
}

export function computeParticipationMatrix(params: {
  schoolId: string;
  teachers: Teacher[];
  courses: TeacherDevCourse[];
  progressList: TeacherDevProgress[];
  certificates: TeacherDevCertificate[];
  todayJalali: string;
  requirementFilter?: 'all' | 'mandatory' | 'optional';
}): ParticipationMatrixResult {
  const filter = params.requirementFilter ?? 'all';
  const schoolTeachers = params.teachers.filter((t) => t.schoolId === params.schoolId && t.active);
  const filteredCourses = params.courses.filter((c) => {
    if (c.schoolId !== params.schoolId || c.status !== 'active') return false;
    if (filter !== 'all' && c.requirement !== filter) return false;
    return true;
  });

  const progressMap = new Map<string, TeacherDevProgress>();
  for (const p of params.progressList) {
    if (p.schoolId === params.schoolId) {
      progressMap.set(`${p.courseId}::${p.teacherId}`, p);
    }
  }

  const certMap = new Map<string, TeacherDevCertificate>();
  for (const cert of params.certificates) {
    if (cert.schoolId === params.schoolId) {
      certMap.set(`${cert.courseId}::${cert.teacherId}`, cert);
    }
  }

  const rows: ParticipationMatrixRow[] = schoolTeachers.map((teacher) => {
    const pendingMandatoryCourses: TeacherDevCourse[] = [];
    let totalApprovedHours = 0;
    let completedCount = 0;

    const cells: MatrixCellData[] = filteredCourses.map((course) => {
      const key = `${course.id}::${teacher.id}`;
      const prog = progressMap.get(key);
      const cert = certMap.get(key);
      const studyStats = getChapterCompletionStats(course, prog);

      if (cert || prog?.status === 'completed') {
        completedCount++;
        totalApprovedHours += cert?.inServiceHours ?? course.inServiceHours;
        return {
          courseId: course.id,
          teacherId: teacher.id,
          status: 'completed',
          labelFa: 'تکمیل و صدور گواهی',
          studyPercent: 100,
          scorePercent: cert?.scorePercent ?? prog?.bestScorePercent ?? course.passingScorePercent,
          inServiceHours: cert?.inServiceHours ?? course.inServiceHours,
          attemptsUsed: prog?.attempts.length ?? 1,
          certificate: cert,
        };
      }

      if (course.requirement === 'mandatory') {
        pendingMandatoryCourses.push(course);
      }

      if (isCourseOverdue(course, params.todayJalali, prog)) {
        return {
          courseId: course.id,
          teacherId: teacher.id,
          status: 'overdue',
          labelFa: 'تأخیر در مهلت',
          studyPercent: studyStats.percent,
          scorePercent: prog?.bestScorePercent,
          attemptsUsed: prog?.attempts.length ?? 0,
        };
      }

      if (prog?.status === 'quiz_failed' || (prog && prog.attempts.length > 0)) {
        return {
          courseId: course.id,
          teacherId: teacher.id,
          status: 'quiz_failed',
          labelFa: 'آزمون ناموفق (تلاش مجدد)',
          studyPercent: studyStats.percent,
          scorePercent: prog?.bestScorePercent,
          attemptsUsed: prog?.attempts.length ?? 0,
        };
      }

      if (prog && prog.completedChapterIds.length > 0) {
        return {
          courseId: course.id,
          teacherId: teacher.id,
          status: 'in_progress',
          labelFa: `در حال مطالعه (${toPersianDigits(studyStats.percent)}٪)`,
          studyPercent: studyStats.percent,
          attemptsUsed: prog.attempts.length,
        };
      }

      return {
        courseId: course.id,
        teacherId: teacher.id,
        status: 'not_started',
        labelFa: 'شروع‌نشده',
        studyPercent: 0,
        attemptsUsed: 0,
      };
    });

    // Also include approved hours from all certificates of this teacher if filter narrowed courses
    const allTeacherHours = params.certificates
      .filter((c) => c.schoolId === params.schoolId && c.teacherId === teacher.id)
      .reduce((sum, c) => sum + c.inServiceHours, 0);

    return {
      teacher,
      cells,
      totalApprovedHours: filter === 'all' ? allTeacherHours : totalApprovedHours,
      completedCount,
      pendingMandatoryCourses,
    };
  });

  const courseSummaries: ParticipationMatrixCourseSummary[] = filteredCourses.map((course, idx) => {
    const completedCount = rows.filter((r) => r.cells[idx]?.status === 'completed').length;
    const totalTeachers = rows.length;
    const completionRatePercent =
      totalTeachers > 0 ? Math.round((completedCount / totalTeachers) * 100) : 0;
    return {
      courseId: course.id,
      completedCount,
      totalTeachers,
      completionRatePercent,
    };
  });

  const totalSlots = rows.length * filteredCourses.length;
  const totalCompletedSlots = rows.reduce((sum, r) => sum + r.completedCount, 0);
  const overallCompletionRatePercent =
    totalSlots > 0 ? Math.round((totalCompletedSlots / totalSlots) * 100) : 0;
  const totalSchoolApprovedHours = rows.reduce((sum, r) => sum + r.totalApprovedHours, 0);

  return {
    courses: filteredCourses,
    rows,
    courseSummaries,
    overallCompletionRatePercent,
    totalSchoolApprovedHours,
  };
}

// --- 3-School Complex Comparison (complex_admin ONLY) ---

export interface ComplexSchoolTeacherDevMetrics {
  school: School;
  teacherCount: number;
  activeCoursesCount: number;
  mandatoryCoursesCount: number;
  avgApprovedHoursPerTeacher: number;
  totalApprovedHours: number;
  mandatoryCompletionPercent: number;
  avgQuizScorePercent: number;
  totalCertificatesIssued: number;
  tierDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function buildComplexTeacherDevComparison(params: {
  schools: School[];
  teachers: Teacher[];
  courses: TeacherDevCourse[];
  progressList: TeacherDevProgress[];
  certificates: TeacherDevCertificate[];
}): ComplexSchoolTeacherDevMetrics[] {
  return params.schools.map((school) => {
    const schoolTeachers = params.teachers.filter((t) => t.schoolId === school.id && t.active);
    const schoolCourses = params.courses.filter((c) => c.schoolId === school.id && c.status === 'active');
    const mandatoryCourses = schoolCourses.filter((c) => c.requirement === 'mandatory');
    const schoolCerts = params.certificates.filter((c) => c.schoolId === school.id);

    const teacherCount = schoolTeachers.length;
    const totalApprovedHours = schoolCerts.reduce((sum, c) => sum + c.inServiceHours, 0);
    const avgApprovedHoursPerTeacher =
      teacherCount > 0 ? Number((totalApprovedHours / teacherCount).toFixed(1)) : 0;

    const mandatoryTotalSlots = teacherCount * mandatoryCourses.length;
    const mandatoryCourseIds = new Set(mandatoryCourses.map((c) => c.id));
    const mandatoryCompletedSlots = schoolCerts.filter((c) =>
      mandatoryCourseIds.has(c.courseId)
    ).length;
    const mandatoryCompletionPercent =
      mandatoryTotalSlots > 0
        ? Math.min(100, Math.round((mandatoryCompletedSlots / mandatoryTotalSlots) * 100))
        : 0;

    const avgQuizScorePercent =
      schoolCerts.length > 0
        ? Math.round(schoolCerts.reduce((sum, c) => sum + c.scorePercent, 0) / schoolCerts.length)
        : 0;

    const leaderboard = buildSchoolLeaderboard({
      schoolId: school.id,
      teachers: params.teachers,
      courses: params.courses,
      progressList: params.progressList,
      certificates: params.certificates,
    });

    const tierDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of leaderboard) {
      tierDistribution[row.tier.level] += 1;
    }

    return {
      school,
      teacherCount,
      activeCoursesCount: schoolCourses.length,
      mandatoryCoursesCount: mandatoryCourses.length,
      avgApprovedHoursPerTeacher,
      totalApprovedHours,
      mandatoryCompletionPercent,
      avgQuizScorePercent,
      totalCertificatesIssued: schoolCerts.length,
      tierDistribution,
    };
  });
}

// --- Single-Column Messenger Text (Eitaa, Bale, Shad) & Persian CSV (UTF-8 BOM) ---

export function buildTeacherReminderMessage(params: {
  schoolName: string;
  teacherName: string;
  pendingMandatoryCourses: TeacherDevCourse[];
  todayJalali: string;
}): string {
  const lines: string[] = [
    `همکار گرامی ${params.teacherName}، سلام و وقت بخیر.`,
    'یادآوری دوستانه جهت تکمیل دوره‌ها و کتاب‌های الزامی ضمن خدمت:',
  ];

  if (params.pendingMandatoryCourses.length === 0) {
    lines.push('تمامی دوره‌های الزامی فعال شما با موفقیت تکمیل شده‌اند. سپاس از همراهی شما.');
  } else {
    params.pendingMandatoryCourses.forEach((course, idx) => {
      const overdue = compareJalaliDates(params.todayJalali, course.deadlineJalali) > 0;
      lines.push(
        `${toPersianDigits(idx + 1)}. ${course.title} (${toPersianDigits(course.inServiceHours)} ساعت)`
      );
      lines.push(
        `   مهلت تکمیل: ${toPersianDigits(course.deadlineJalali)}${overdue ? ' — نیازمند تکمیل فوری' : ''}`
      );
    });
  }

  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: 'یادآوری دوره‌های دانش‌افزایی و ضمن خدمت',
    jalaliDateDisplay: formatJalaliDisplay(params.todayJalali, true),
    sections: [{ lines }],
    footerNote:
      'پس از مطالعه تمام فصل‌ها و قبولی در آزمون کوتاه پایانی، گواهینامه ضمن خدمت شما به‌صورت خودکار صادر می‌شود.',
  });
}

export function buildSchoolMatrixSummaryMessage(params: {
  schoolName: string;
  matrix: ParticipationMatrixResult;
  todayJalali: string;
}): string {
  const courseLines = params.matrix.courses.map((course, idx) => {
    const summary = params.matrix.courseSummaries[idx];
    return `${toPersianDigits(idx + 1)}. ${course.title} (${REQUIREMENT_LABELS[course.requirement]}) — تکمیل: ${toPersianDigits(summary?.completedCount ?? 0)} از ${toPersianDigits(summary?.totalTeachers ?? 0)} همکار (${toPersianDigits(summary?.completionRatePercent ?? 0)}٪)`;
  });

  const pendingTeachersLines = params.matrix.rows
    .filter((r) => r.pendingMandatoryCourses.length > 0)
    .map(
      (r) =>
        `• ${r.teacher.fullName}: ${toPersianDigits(r.pendingMandatoryCourses.length)} دوره الزامی باقی‌مانده (ساعات مصوب فعلی: ${toPersianDigits(r.totalApprovedHours)} ساعت)`
    );

  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: 'خلاصه وضعیت دانش‌افزایی و دوره‌های ضمن خدمت کادر',
    jalaliDateDisplay: formatJalaliDisplay(params.todayJalali, true),
    sections: [
      {
        heading: 'آمار کل مدرسه',
        lines: [
          `تعداد همکاران فعال: ${toPersianDigits(params.matrix.rows.length)} نفر`,
          `نرخ کل تکمیل دوره‌های نمایش‌داده‌شده: ${toPersianDigits(params.matrix.overallCompletionRatePercent)}٪`,
          `مجموع ساعات ضمن خدمت مصوب کسب‌شده: ${toPersianDigits(params.matrix.totalSchoolApprovedHours)} ساعت`,
        ],
      },
      {
        heading: 'وضعیت هر دوره و کتاب',
        lines: courseLines.length > 0 ? courseLines : ['دوره فعالی ثبت نشده است.'],
      },
      {
        heading: 'همکاران دارای دوره الزامی در انتظار تکمیل',
        lines:
          pendingTeachersLines.length > 0
            ? pendingTeachersLines
            : ['تمامی همکاران دوره‌های الزامی خود را تکمیل کرده‌اند.'],
      },
    ],
    footerNote: 'تهیه‌شده در سامانه مدیریت هوشمند مدارس (واحد دانش‌افزایی معلمین)',
  });
}

export function buildParticipationMatrixCsv(matrix: ParticipationMatrixResult): string {
  const headers = [
    'نام همکار',
    'تخصص',
    'کد پرسنلی',
    ...matrix.courses.map((c) => `${c.title} (${REQUIREMENT_LABELS[c.requirement]} - ${c.inServiceHours} ساعت)`),
    'دوره‌های تکمیل‌شده',
    'کل ساعات ضمن خدمت مصوب',
  ];

  const rows = matrix.rows.map((row) => [
    row.teacher.fullName,
    row.teacher.specialty,
    row.teacher.personnelCode,
    ...row.cells.map((cell) => {
      if (cell.status === 'completed') {
        return `تکمیل و صدور گواهی (نمره ${cell.scorePercent ?? 0}% - ${cell.inServiceHours ?? 0} ساعت)`;
      }
      return cell.labelFa;
    }),
    row.completedCount,
    row.totalApprovedHours,
  ]);

  return buildUtf8BomCsv(headers, rows);
}
