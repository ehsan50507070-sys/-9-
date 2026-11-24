// Pure Statistical & Konkur Grading Engine for Phase 9A Mock & Konkur Exams
// Implements negative marking, cohort μ/σ Z-score Taraz (1000..11000), weighted total Taraz,
// «چند از ۱۰» vs peer-tier (±500 Taraz), tie-aware rankings, topic strength/weakness map,
// Canvas-style Item Analysis with automatic Trap Question detector (≥35% single distractor),
// deterministic per-student option shuffling, CSV OMR import, and single-column messenger export.
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type {
  MockAnswerOption,
  MockExam,
  MockExamAttempt,
  MockExamQuestion,
  MockExamSubject,
  MockExamTrack,
  MockQuestionDifficulty,
  NegativeMarkingRule,
  School,
  Student,
} from '../../types/domain';

export interface SubjectScoreMetrics {
  subjectId: string;
  subjectName: string;
  bookletId: string;
  coefficient: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  blank: number;
  percentage: number; // rounded to 1 decimal place; may be negative!
  taraz: number; // clamped 1000..11000
  outOfTen: number; // 0..10
  peerOutOfTen: number; // average چند از ۱۰ among peers within ±500 Total Taraz
  cohortAvgPct: number;
  topTenPercentAvgPct: number;
  highestPct: number;
  subjectRank: number;
  cohortSize: number;
}

export type TopicStatus = 'strength' | 'consolidation' | 'weakness';

export interface TopicAnalysisRow {
  topic: string;
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  blank: number;
  accuracyPercent: number; // 0..100
  status: TopicStatus;
}

export interface StudentExamAnalytics {
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  classId: string;
  className: string;
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  totalQuestions: number;
  averagePercentage: number; // weighted or arithmetic avg across subjects
  totalTaraz: number; // weighted average of subject Taraz values
  tarazDeltaFromPrev: number | null; // ▲ +240 / ▼ -115 vs previous stage
  classRank: number;
  classTotal: number;
  schoolRank: number;
  schoolTotal: number;
  complexRank: number | null; // populated when exam.scope === 'complex'
  complexTotal: number | null;
  tabSwitchCount: number;
  entryMethod: MockExamAttempt['entryMethod'];
  submittedAtJalali: string;
  subjectMetrics: SubjectScoreMetrics[];
  topicAnalysis: TopicAnalysisRow[];
}

export interface TarazHistogramBucket {
  id: string;
  labelFa: string;
  min: number;
  max: number;
  count: number;
  percent: number;
}

export interface QuestionItemAnalysis {
  questionNumber: number;
  subjectId: string;
  subjectName: string;
  topic: string;
  declaredDifficulty: MockQuestionDifficulty;
  correctOption: MockAnswerOption;
  totalResponses: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  correctPercent: number; // actual facility index (درصد پاسخ صحیح)
  wrongPercent: number;
  blankPercent: number;
  optionDistribution: Record<MockAnswerOption, { count: number; percent: number }>;
  isTrapQuestion: boolean; // true if any single wrong option attracted ≥ 35% of respondents
  trapOption: MockAnswerOption | null;
  trapOptionPercent: number;
}

export interface SchoolMockComparisonRow {
  schoolId: string;
  schoolName: string;
  participantCount: number;
  averageTaraz: number;
  top6500Count: number;
  averagePercentage: number;
  subjectAverages: Record<string, number>; // subjectId -> avg pct
}

export interface ExamCohortReport {
  exam: MockExam;
  students: StudentExamAnalytics[]; // sorted descending by totalTaraz
  histogram: TarazHistogramBucket[];
  itemAnalysis: QuestionItemAnalysis[];
  trapQuestionsCount: number;
  schoolComparison: SchoolMockComparisonRow[];
  cohortMeanTaraz: number;
  cohortMaxTaraz: number;
}

export interface TrackPresetSubject {
  subjectName: string;
  bookletIndex: number;
  questionCount: number;
  coefficient: number;
  defaultTopics: string[];
}

export const TRACK_PRESETS: Record<
  MockExamTrack,
  {
    labelFa: string;
    booklets: Array<{ title: string; durationMinutes: number }>;
    subjects: TrackPresetSubject[];
  }
> = {
  general_elementary: {
    labelFa: 'عمومی / ابتدایی',
    booklets: [
      { title: 'دفترچه اول — دروس پایه (ریاضی و علوم)', durationMinutes: 45 },
      { title: 'دفترچه دوم — ادبیات، مطالعات و هوش', durationMinutes: 35 },
    ],
    subjects: [
      { subjectName: 'ریاضی', bookletIndex: 0, questionCount: 10, coefficient: 4, defaultTopics: ['کسر و اعشار', 'هندسه و مساحت', 'الگوها و معادله'] },
      { subjectName: 'علوم تجربی', bookletIndex: 0, questionCount: 10, coefficient: 3, defaultTopics: ['انرژی و نیرو', 'زیست‌شناسی و بدن', 'زمین و فضا'] },
      { subjectName: 'فارسی و نگارش', bookletIndex: 1, questionCount: 10, coefficient: 3, defaultTopics: ['آرایه‌های ادبی', 'دستور زبان', 'درک مطلب'] },
      { subjectName: 'مطالعات و هوش کلامی', bookletIndex: 1, questionCount: 10, coefficient: 2, defaultTopics: ['تاریخ و جغرافیا', 'هوش تحلیلی', 'استدلال منطقی'] },
    ],
  },
  middle_school: {
    labelFa: 'متوسطه اول',
    booklets: [
      { title: 'دفترچه اول — ریاضی و علوم تحلیلی', durationMinutes: 55 },
      { title: 'دفترچه دوم — ادبیات، عربی و زبان', durationMinutes: 45 },
    ],
    subjects: [
      { subjectName: 'ریاضی', bookletIndex: 0, questionCount: 10, coefficient: 4, defaultTopics: ['جبر و معادله', 'هندسه و استدلال', 'آمار و احتمال'] },
      { subjectName: 'علوم تجربی', bookletIndex: 0, questionCount: 10, coefficient: 3, defaultTopics: ['فیزیک و حرکت', 'شیمی و اتم', 'زیست سلولی'] },
      { subjectName: 'ادبیات فارسی', bookletIndex: 1, questionCount: 10, coefficient: 3, defaultTopics: ['قرابت معنایی', 'دستور زبان', 'آرایه‌های ادبی'] },
      { subjectName: 'زبان انگلیسی', bookletIndex: 1, questionCount: 10, coefficient: 2, defaultTopics: ['گرامر', 'واژگان', 'درک متن'] },
    ],
  },
  math_physics: {
    labelFa: 'ریاضی و فیزیک',
    booklets: [
      { title: 'دفترچه اول — ریاضیات (حسابان، هندسه، گسسته)', durationMinutes: 75 },
      { title: 'دفترچه دوم — فیزیک و شیمی', durationMinutes: 65 },
    ],
    subjects: [
      { subjectName: 'حسابان و ریاضیات', bookletIndex: 0, questionCount: 12, coefficient: 12, defaultTopics: ['مشتق و کاربرد آن', 'حد و پیوستگی', 'تابع و مثلثات'] },
      { subjectName: 'هندسه و گسسته', bookletIndex: 0, questionCount: 8, coefficient: 8, defaultTopics: ['مقاطع مخروطی', 'نظریه اعداد', 'گراف و ترکیبیات'] },
      { subjectName: 'فیزیک', bookletIndex: 1, questionCount: 10, coefficient: 9, defaultTopics: ['سینماتیک و دینامیک', 'الکتریسیته جاری', 'موج و نوسان'] },
      { subjectName: 'شیمی', bookletIndex: 1, questionCount: 10, coefficient: 7, defaultTopics: ['استوکیومتری', 'تعادل و اسید و باز', 'الکتروشیمی'] },
    ],
  },
  experimental_sciences: {
    labelFa: 'علوم تجربی',
    booklets: [
      { title: 'دفترچه اول — زیست‌شناسی', durationMinutes: 45 },
      { title: 'دفترچه دوم — فیزیک، شیمی و ریاضی', durationMinutes: 75 },
    ],
    subjects: [
      { subjectName: 'زیست‌شناسی', bookletIndex: 0, questionCount: 12, coefficient: 12, defaultTopics: ['ژنتیک', 'تنظیم عصبی', 'تنفس سلولی و فتوسنتز'] },
      { subjectName: 'شیمی', bookletIndex: 1, questionCount: 10, coefficient: 9, defaultTopics: ['استوکیومتری', 'سینتیک و تعادل', 'شیمی آلی'] },
      { subjectName: 'فیزیک', bookletIndex: 1, questionCount: 10, coefficient: 7, defaultTopics: ['دینامیک و کار و انرژی', 'مدارهای الکتریکی', 'فیزیک اتمی'] },
      { subjectName: 'ریاضی', bookletIndex: 1, questionCount: 8, coefficient: 7, defaultTopics: ['مشتق و کاربرد آن', 'آمار و احتمال', 'تابع نمایی و لگاریتمی'] },
    ],
  },
  humanities: {
    labelFa: 'علوم انسانی',
    booklets: [
      { title: 'دفترچه اول — ریاضی، ادبیات و علوم اجتماعی', durationMinutes: 70 },
      { title: 'دفترچه دوم — عربی، فلسفه، منطق و اقتصاد', durationMinutes: 65 },
    ],
    subjects: [
      { subjectName: 'علوم و فنون ادبی', bookletIndex: 0, questionCount: 10, coefficient: 8, defaultTopics: ['آرایه‌های ادبی', 'عروض و قافیه', 'تاریخ ادبیات'] },
      { subjectName: 'ریاضی و آمار', bookletIndex: 0, questionCount: 8, coefficient: 6, defaultTopics: ['آمار توصیفی', 'تابع و معادله', 'شمارش و احتمال'] },
      { subjectName: 'عربی اختصاصی', bookletIndex: 1, questionCount: 10, coefficient: 8, defaultTopics: ['ترجمه و تعریب', 'قواعد صرف و نحو', 'درک مطلب'] },
      { subjectName: 'فلسفه، منطق و اقتصاد', bookletIndex: 1, questionCount: 12, coefficient: 8, defaultTopics: ['قیاس منطقی', 'فلسفه اسلامی', 'اقتصاد کلان'] },
    ],
  },
  custom: {
    labelFa: 'سفارشی',
    booklets: [{ title: 'دفترچه اول — آزمون جامع سفارشی', durationMinutes: 60 }],
    subjects: [
      { subjectName: 'ریاضی', bookletIndex: 0, questionCount: 10, coefficient: 4, defaultTopics: ['مبحث اول', 'مبحث دوم'] },
      { subjectName: 'علوم تجربی', bookletIndex: 0, questionCount: 10, coefficient: 3, defaultTopics: ['مبحث اول', 'مبحث دوم'] },
    ],
  },
};

export function getNegativeMarkingLabelFa(rule: NegativeMarkingRule): string {
  switch (rule) {
    case 'three_to_one':
      return 'استاندارد کنکور (هر ۳ غلط = ۱ درست)';
    case 'four_to_one':
      return 'هر ۴ غلط = ۱ درست';
    case 'none':
      return 'بدون نمره منفی';
  }
}

export function getDifficultyLabelFa(diff: MockQuestionDifficulty): string {
  switch (diff) {
    case 'easy':
      return 'ساده';
    case 'medium':
      return 'متوسط';
    case 'hard':
      return 'دشوار';
  }
}

export function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * 1. Subject Percentage Calculation with Negative Marking (supports negative %)
 */
export function calculateSubjectPercentage(
  correct: number,
  wrong: number,
  totalQuestions: number,
  rule: NegativeMarkingRule
): number {
  if (totalQuestions <= 0) return 0;
  let raw = 0;
  if (rule === 'three_to_one') {
    raw = ((3 * correct - wrong) / (3 * totalQuestions)) * 100;
  } else if (rule === 'four_to_one') {
    raw = ((4 * correct - wrong) / (4 * totalQuestions)) * 100;
  } else {
    raw = (correct / totalQuestions) * 100;
  }
  return round1(raw);
}

/**
 * 2. Standardized Iranian Konkur Taraz (1000..11000) from Z-score
 */
export function calculateTarazFromZ(percentage: number, mean: number, stdDev: number): number {
  const z = stdDev > 0.0001 ? (percentage - mean) / stdDev : 0;
  return clamp(Math.round(5500 + 1000 * z), 1000, 11000);
}

/**
 * 3. Weighted Total Taraz across subject coefficients
 */
export function calculateWeightedTotalTaraz(
  items: Array<{ taraz: number; coefficient: number }>
): number {
  let num = 0;
  let den = 0;
  for (const item of items) {
    const coeff = Math.max(1, item.coefficient);
    num += item.taraz * coeff;
    den += coeff;
  }
  if (den <= 0) return 5500;
  return clamp(Math.round(num / den), 1000, 11000);
}

/**
 * 4. «چند از ۱۰» benchmark score (0..10)
 */
export function calculateOutOfTen(percentage: number): number {
  return clamp(Math.max(0, Math.round(percentage / 10)), 0, 10);
}

/**
 * Tie-aware competition ranking (e.g. [95, 95, 80] => ranks [1, 1, 3])
 */
export function assignTieAwareRanks<T>(
  items: T[],
  getScore: (item: T) => number
): Map<T, number> {
  const sorted = [...items].sort((a, b) => getScore(b) - getScore(a));
  const rankMap = new Map<T, number>();
  let prevScore: number | null = null;
  let currentRank = 0;

  sorted.forEach((item, index) => {
    const score = getScore(item);
    if (prevScore === null || Math.abs(score - prevScore) > 0.0001) {
      currentRank = index + 1;
      prevScore = score;
    }
    rankMap.set(item, currentRank);
  });

  return rankMap;
}

/**
 * Deterministic per-student option permutation for Full Online Mode (disabled in Answer-Key-Only mode).
 * Maps displayed position (1..4) <-> original option number (1..4).
 */
export function getDeterministicOptionOrder(
  examId: string,
  studentId: string,
  questionNumber: number,
  shouldShuffle: boolean
): [MockAnswerOption, MockAnswerOption, MockAnswerOption, MockAnswerOption] {
  const base: [MockAnswerOption, MockAnswerOption, MockAnswerOption, MockAnswerOption] = [1, 2, 3, 4];
  if (!shouldShuffle) return base;

  const seedStr = `${examId}:${studentId}:${questionNumber}`;
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const arr: MockAnswerOption[] = [1, 2, 3, 4];
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr as [MockAnswerOption, MockAnswerOption, MockAnswerOption, MockAnswerOption];
}

/**
 * Computes complete cohort report for a MockExam:
 * - Per-subject percentages, cohort μ/σ, Taraz, weighted Total Taraz
 * - «چند از ۱۰» & peer-tier (±500 Taraz) «چند از ۱۰ همترازان»
 * - Tie-aware Class, School, Complex, and Per-Subject ranks
 * - Previous-stage Taraz delta
 * - Topic Strength / Consolidation / Weakness breakdown
 * - Taraz distribution histogram
 * - Canvas-style Item Analysis with automatic Trap Question detector (≥ 35% distractor)
 * - 3-school comparison summary
 */
export function buildExamCohortReport(params: {
  exam: MockExam;
  attempts: MockExamAttempt[];
  schools: School[];
  previousStageTarazByStudent?: Record<string, number>;
}): ExamCohortReport {
  const { exam, schools, previousStageTarazByStudent = {} } = params;
  const submitted = params.attempts.filter(
    (a) => a.examId === exam.id && a.status === 'submitted'
  );
  const schoolNameMap = new Map<string, string>(schools.map((s) => [s.id, s.name]));

  // Map questions by subjectId
  const questionsBySubject = new Map<string, MockExamQuestion[]>();
  for (const subj of exam.subjects) {
    questionsBySubject.set(subj.id, []);
  }
  for (const q of exam.questions) {
    const arr = questionsBySubject.get(q.subjectId);
    if (arr) arr.push(q);
  }

  // Pass 1: Raw subject counts and percentages for every submitted attempt
  interface RawSubjectEval {
    subject: MockExamSubject;
    correct: number;
    wrong: number;
    blank: number;
    totalQuestions: number;
    percentage: number;
  }

  interface RawAttemptEval {
    attempt: MockExamAttempt;
    subjects: Record<string, RawSubjectEval>;
    totalCorrect: number;
    totalWrong: number;
    totalBlank: number;
    totalQuestions: number;
  }

  const rawEvals: RawAttemptEval[] = submitted.map((attempt) => {
    const subjects: Record<string, RawSubjectEval> = {};
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalBlank = 0;
    let totalQuestions = 0;

    for (const subj of exam.subjects) {
      const qs = questionsBySubject.get(subj.id) ?? [];
      let c = 0;
      let w = 0;
      let b = 0;
      for (const q of qs) {
        const ans = attempt.answers[q.questionNumber] ?? null;
        if (ans === null || ans === undefined) {
          b++;
        } else if (ans === q.correctOption) {
          c++;
        } else {
          w++;
        }
      }
      const pct = calculateSubjectPercentage(c, w, qs.length, exam.negativeMarking);
      subjects[subj.id] = {
        subject: subj,
        correct: c,
        wrong: w,
        blank: b,
        totalQuestions: qs.length,
        percentage: pct,
      };
      totalCorrect += c;
      totalWrong += w;
      totalBlank += b;
      totalQuestions += qs.length;
    }

    return { attempt, subjects, totalCorrect, totalWrong, totalBlank, totalQuestions };
  });

  // Pass 2: Per-subject cohort statistics (mean, stdDev, highest, top 10% avg, subject ranks)
  interface SubjectCohortStats {
    mean: number;
    stdDev: number;
    highest: number;
    topTenAvg: number;
    ranks: Map<RawAttemptEval, number>;
  }

  const subjectStatsMap = new Map<string, SubjectCohortStats>();
  for (const subj of exam.subjects) {
    const pcts = rawEvals.map((e) => e.subjects[subj.id]?.percentage ?? 0);
    const n = pcts.length;
    const mean = n > 0 ? pcts.reduce((s, v) => s + v, 0) / n : 0;
    const variance =
      n > 0 ? pcts.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n : 0;
    const stdDev = Math.sqrt(variance);
    const sortedDesc = [...pcts].sort((a, b) => b - a);
    const highest = sortedDesc[0] ?? 0;
    const topCount = Math.max(1, Math.ceil(n * 0.1));
    const topSlice = sortedDesc.slice(0, topCount);
    const topTenAvg =
      topSlice.length > 0 ? topSlice.reduce((s, v) => s + v, 0) / topSlice.length : 0;
    const ranks = assignTieAwareRanks(rawEvals, (e) => e.subjects[subj.id]?.percentage ?? 0);

    subjectStatsMap.set(subj.id, {
      mean: round1(mean),
      stdDev,
      highest: round1(highest),
      topTenAvg: round1(topTenAvg),
      ranks,
    });
  }

  // Pass 3: Compute Subject Taraz & Weighted Total Taraz for every student
  interface IntermediateStudent {
    raw: RawAttemptEval;
    totalTaraz: number;
    averagePercentage: number;
    subjectMetrics: SubjectScoreMetrics[];
  }

  const intermediates: IntermediateStudent[] = rawEvals.map((raw) => {
    const subjectMetrics: SubjectScoreMetrics[] = exam.subjects.map((subj) => {
      const ev = raw.subjects[subj.id];
      const stats = subjectStatsMap.get(subj.id)!;
      const taraz = calculateTarazFromZ(ev.percentage, stats.mean, stats.stdDev);
      return {
        subjectId: subj.id,
        subjectName: subj.subjectName,
        bookletId: subj.bookletId,
        coefficient: subj.coefficient,
        totalQuestions: ev.totalQuestions,
        correct: ev.correct,
        wrong: ev.wrong,
        blank: ev.blank,
        percentage: ev.percentage,
        taraz,
        outOfTen: calculateOutOfTen(ev.percentage),
        peerOutOfTen: 0, // filled in Pass 4
        cohortAvgPct: stats.mean,
        topTenPercentAvgPct: stats.topTenAvg,
        highestPct: stats.highest,
        subjectRank: stats.ranks.get(raw) ?? 1,
        cohortSize: rawEvals.length,
      };
    });

    const totalTaraz = calculateWeightedTotalTaraz(
      subjectMetrics.map((m) => ({ taraz: m.taraz, coefficient: m.coefficient }))
    );

    const totalCoeff = exam.subjects.reduce((s, x) => s + Math.max(1, x.coefficient), 0);
    const weightedPct =
      totalCoeff > 0
        ? subjectMetrics.reduce((s, m) => s + m.percentage * Math.max(1, m.coefficient), 0) /
          totalCoeff
        : 0;

    return {
      raw,
      totalTaraz,
      averagePercentage: round1(weightedPct),
      subjectMetrics,
    };
  });

  // Pass 4: Peer-tier «چند از ۱۰ همترازان» (±500 Total Taraz)
  for (const st of intermediates) {
    const peers = intermediates.filter(
      (other) => Math.abs(other.totalTaraz - st.totalTaraz) <= 500
    );
    const peerGroup = peers.length > 0 ? peers : [st];
    for (const sm of st.subjectMetrics) {
      const avgPeerTen =
        peerGroup.reduce((sum, p) => {
          const found = p.subjectMetrics.find((m) => m.subjectId === sm.subjectId);
          return sum + (found?.outOfTen ?? 0);
        }, 0) / peerGroup.length;
      sm.peerOutOfTen = clamp(Math.round(avgPeerTen), 0, 10);
    }
  }

  // Pass 5: Tie-aware Ranks (Class, School, Complex)
  const complexRanks = assignTieAwareRanks(intermediates, (x) => x.totalTaraz);

  const bySchool = new Map<string, IntermediateStudent[]>();
  const byClass = new Map<string, IntermediateStudent[]>();
  for (const st of intermediates) {
    const scList = bySchool.get(st.raw.attempt.schoolId) ?? [];
    scList.push(st);
    bySchool.set(st.raw.attempt.schoolId, scList);

    const clKey = `${st.raw.attempt.schoolId}::${st.raw.attempt.classId}`;
    const clList = byClass.get(clKey) ?? [];
    clList.push(st);
    byClass.set(clKey, clList);
  }

  const schoolRankMaps = new Map<string, Map<IntermediateStudent, number>>();
  for (const [sid, list] of bySchool.entries()) {
    schoolRankMaps.set(sid, assignTieAwareRanks(list, (x) => x.totalTaraz));
  }
  const classRankMaps = new Map<string, Map<IntermediateStudent, number>>();
  for (const [ckey, list] of byClass.entries()) {
    classRankMaps.set(ckey, assignTieAwareRanks(list, (x) => x.totalTaraz));
  }

  const subjectNameById = new Map<string, string>(
    exam.subjects.map((s) => [s.id, s.subjectName])
  );

  // Pass 6: Final StudentExamAnalytics objects + Topic Analysis
  const studentsAnalytics: StudentExamAnalytics[] = intermediates
    .map((st) => {
      const att = st.raw.attempt;
      const clKey = `${att.schoolId}::${att.classId}`;
      const scRanks = schoolRankMaps.get(att.schoolId);
      const clRanks = classRankMaps.get(clKey);

      // Group questions by subjectId + topic
      const topicBuckets = new Map<
        string,
        {
          topic: string;
          subjectId: string;
          subjectName: string;
          total: number;
          correct: number;
          wrong: number;
          blank: number;
        }
      >();

      for (const q of exam.questions) {
        const key = `${q.subjectId}::${q.topic}`;
        const bucket = topicBuckets.get(key) ?? {
          topic: q.topic || 'عمومی',
          subjectId: q.subjectId,
          subjectName: subjectNameById.get(q.subjectId) ?? 'درس',
          total: 0,
          correct: 0,
          wrong: 0,
          blank: 0,
        };
        bucket.total++;
        const ans = att.answers[q.questionNumber] ?? null;
        if (ans === null || ans === undefined) bucket.blank++;
        else if (ans === q.correctOption) bucket.correct++;
        else bucket.wrong++;
        topicBuckets.set(key, bucket);
      }

      const topicAnalysis: TopicAnalysisRow[] = Array.from(topicBuckets.values())
        .map((b) => {
          const acc = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
          const status: TopicStatus =
            acc >= 70 ? 'strength' : acc >= 40 ? 'consolidation' : 'weakness';
          return {
            topic: b.topic,
            subjectId: b.subjectId,
            subjectName: b.subjectName,
            totalQuestions: b.total,
            correct: b.correct,
            wrong: b.wrong,
            blank: b.blank,
            accuracyPercent: acc,
            status,
          };
        })
        .sort((a, b) => b.accuracyPercent - a.accuracyPercent);

      const prevTaraz = previousStageTarazByStudent[att.studentId];
      const tarazDeltaFromPrev =
        typeof prevTaraz === 'number' ? st.totalTaraz - prevTaraz : null;

      return {
        attemptId: att.id,
        examId: exam.id,
        studentId: att.studentId,
        studentName: att.studentName,
        schoolId: att.schoolId,
        schoolName: schoolNameMap.get(att.schoolId) ?? att.schoolId,
        classId: att.classId,
        className: att.className,
        totalCorrect: st.raw.totalCorrect,
        totalWrong: st.raw.totalWrong,
        totalBlank: st.raw.totalBlank,
        totalQuestions: st.raw.totalQuestions,
        averagePercentage: st.averagePercentage,
        totalTaraz: st.totalTaraz,
        tarazDeltaFromPrev,
        classRank: clRanks?.get(st) ?? 1,
        classTotal: byClass.get(clKey)?.length ?? 1,
        schoolRank: scRanks?.get(st) ?? 1,
        schoolTotal: bySchool.get(att.schoolId)?.length ?? 1,
        complexRank: exam.scope === 'complex' ? (complexRanks.get(st) ?? 1) : null,
        complexTotal: exam.scope === 'complex' ? intermediates.length : null,
        tabSwitchCount: att.tabSwitchCount,
        entryMethod: att.entryMethod,
        submittedAtJalali: att.submittedAtJalali,
        subjectMetrics: st.subjectMetrics,
        topicAnalysis,
      };
    })
    .sort((a, b) => b.totalTaraz - a.totalTaraz || b.averagePercentage - a.averagePercentage);

  // Pass 7: Taraz Distribution Histogram
  const bucketDefs: Array<{ id: string; labelFa: string; min: number; max: number }> = [
    { id: 'lt4500', labelFa: 'کمتر از ۴۵۰۰', min: 0, max: 4499 },
    { id: '4500_5500', labelFa: '۴۵۰۰ تا ۵۵۰۰', min: 4500, max: 5499 },
    { id: '5500_6500', labelFa: '۵۵۰۰ تا ۶۵۰۰', min: 5500, max: 6499 },
    { id: '6500_7500', labelFa: '۶۵۰۰ تا ۷۵۰۰', min: 6500, max: 7499 },
    { id: 'gt7500', labelFa: 'بالای ۷۵۰۰', min: 7500, max: 12000 },
  ];

  const totalN = studentsAnalytics.length;
  const histogram: TarazHistogramBucket[] = bucketDefs.map((b) => {
    const count = studentsAnalytics.filter(
      (s) => s.totalTaraz >= b.min && s.totalTaraz <= b.max
    ).length;
    return {
      ...b,
      count,
      percent: totalN > 0 ? Math.round((count / totalN) * 100) : 0,
    };
  });

  // Pass 8: Canvas-Style Item Analysis & Trap Question Detector (≥ 35% single wrong distractor)
  const itemAnalysis: QuestionItemAnalysis[] = exam.questions
    .slice()
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .map((q) => {
      const counts: Record<MockAnswerOption, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      let correctCount = 0;
      let wrongCount = 0;
      let blankCount = 0;

      for (const att of submitted) {
        const ans = att.answers[q.questionNumber] ?? null;
        if (ans === null || ans === undefined) {
          blankCount++;
        } else {
          counts[ans]++;
          if (ans === q.correctOption) correctCount++;
          else wrongCount++;
        }
      }

      const n = submitted.length;
      const optionDistribution: Record<MockAnswerOption, { count: number; percent: number }> = {
        1: { count: counts[1], percent: n > 0 ? Math.round((counts[1] / n) * 100) : 0 },
        2: { count: counts[2], percent: n > 0 ? Math.round((counts[2] / n) * 100) : 0 },
        3: { count: counts[3], percent: n > 0 ? Math.round((counts[3] / n) * 100) : 0 },
        4: { count: counts[4], percent: n > 0 ? Math.round((counts[4] / n) * 100) : 0 },
      };

      // Check if any single WRONG option attracted >= 35% of respondents
      let trapOption: MockAnswerOption | null = null;
      let trapOptionPercent = 0;
      for (const opt of [1, 2, 3, 4] as const) {
        if (opt === q.correctOption) continue;
        if (optionDistribution[opt].percent >= 35 && optionDistribution[opt].percent > trapOptionPercent) {
          trapOption = opt;
          trapOptionPercent = optionDistribution[opt].percent;
        }
      }

      return {
        questionNumber: q.questionNumber,
        subjectId: q.subjectId,
        subjectName: subjectNameById.get(q.subjectId) ?? 'درس',
        topic: q.topic,
        declaredDifficulty: q.difficulty,
        correctOption: q.correctOption,
        totalResponses: n,
        correctCount,
        wrongCount,
        blankCount,
        correctPercent: n > 0 ? Math.round((correctCount / n) * 100) : 0,
        wrongPercent: n > 0 ? Math.round((wrongCount / n) * 100) : 0,
        blankPercent: n > 0 ? Math.round((blankCount / n) * 100) : 0,
        optionDistribution,
        isTrapQuestion: trapOption !== null && n > 0,
        trapOption,
        trapOptionPercent,
      };
    });

  // Pass 9: 3-School Comparison
  const schoolComparison: SchoolMockComparisonRow[] = Array.from(bySchool.keys()).map((sid) => {
    const group = studentsAnalytics.filter((s) => s.schoolId === sid);
    const n = group.length;
    const avgTaraz = n > 0 ? Math.round(group.reduce((acc, s) => acc + s.totalTaraz, 0) / n) : 0;
    const avgPct =
      n > 0 ? round1(group.reduce((acc, s) => acc + s.averagePercentage, 0) / n) : 0;
    const top6500Count = group.filter((s) => s.totalTaraz >= 6500).length;

    const subjectAverages: Record<string, number> = {};
    for (const subj of exam.subjects) {
      const vals = group.map(
        (s) => s.subjectMetrics.find((m) => m.subjectId === subj.id)?.percentage ?? 0
      );
      subjectAverages[subj.id] =
        vals.length > 0 ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    }

    return {
      schoolId: sid,
      schoolName: schoolNameMap.get(sid) ?? sid,
      participantCount: n,
      averageTaraz: avgTaraz,
      top6500Count,
      averagePercentage: avgPct,
      subjectAverages,
    };
  });

  const cohortMeanTaraz =
    totalN > 0
      ? Math.round(studentsAnalytics.reduce((s, st) => s + st.totalTaraz, 0) / totalN)
      : 0;
  const cohortMaxTaraz = studentsAnalytics[0]?.totalTaraz ?? 0;

  return {
    exam,
    students: studentsAnalytics,
    histogram,
    itemAnalysis,
    trapQuestionsCount: itemAnalysis.filter((i) => i.isTrapQuestion).length,
    schoolComparison,
    cohortMeanTaraz,
    cohortMaxTaraz,
  };
}

/**
 * Bulk CSV / OMR Scanner Parser:
 * Format per line: `کد ملی یا نام دانش‌آموز, پاسخ سوال ۱, پاسخ سوال ۲, ...`
 * Supports both Persian & ASCII digits; 0 / empty / '-' treated as blank (null).
 */
export interface ParsedOmrCsvRow {
  lineNumber: number;
  identifier: string;
  matchedStudent: Student | null;
  answers: Record<number, MockAnswerOption | null>;
  answeredCount: number;
  errorFa?: string;
}

export function parseBulkOmrCsv(
  csvText: string,
  students: Student[],
  questionNumbers: number[]
): ParsedOmrCsvRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const normalizeName = (s: string) =>
    toAsciiDigits(s).replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/\s+/g, ' ').trim();

  const results: ParsedOmrCsvRow[] = [];

  lines.forEach((line, idx) => {
    const parts = line.split(/[,،;\t]+/).map((p) => p.trim());
    if (parts.length < 2) return;

    const rawId = parts[0];
    const normId = normalizeName(rawId);

    // Skip header line if detected
    if (
      idx === 0 &&
      (normId.includes('کد ملی') || normId.includes('نام') || normId.toLowerCase().includes('student'))
    ) {
      return;
    }

    const matchedStudent =
      students.find((s) => toAsciiDigits(s.nationalId) === normId) ??
      students.find((s) => normalizeName(s.fullName) === normId) ??
      students.find((s) => normalizeName(s.fullName).includes(normId) && normId.length >= 3) ??
      null;

    const answers: Record<number, MockAnswerOption | null> = {};
    let answeredCount = 0;

    questionNumbers.forEach((qNum, qIdx) => {
      const cell = toAsciiDigits(parts[qIdx + 1] ?? '').trim();
      if (cell === '1' || cell === '2' || cell === '3' || cell === '4') {
        answers[qNum] = Number(cell) as MockAnswerOption;
        answeredCount++;
      } else {
        answers[qNum] = null;
      }
    });

    results.push({
      lineNumber: idx + 1,
      identifier: rawId,
      matchedStudent,
      answers,
      answeredCount,
      errorFa: matchedStudent ? undefined : `دانش‌آموزی با شناسه «${rawId}» در مدرسه یافت نشد.`,
    });
  });

  return results;
}

/**
 * Generates clean single-column Persian summary ready to paste in Eitaa / Bale / Shad.
 */
export function formatMockReportCardForMessenger(
  report: StudentExamAnalytics,
  exam: MockExam,
  schoolDisplayName: string
): string {
  const lines: string[] = [
    `کارنامه آزمون آزمایشی: ${exam.title}`,
    `مدرسه: ${schoolDisplayName}`,
    `دانش‌آموز: ${report.studentName} (${report.className})`,
    `تاریخ برگزاری: ${toPersianDigits(exam.examDateJalali)}`,
    '────────────────────',
    `تراز کل: ${toPersianDigits(report.totalTaraz)}${
      report.tarazDeltaFromPrev !== null
        ? ` (${report.tarazDeltaFromPrev >= 0 ? '▲ +' : '▼ '}${toPersianDigits(report.tarazDeltaFromPrev)})`
        : ''
    }`,
    `میانگین درصد کل: ${toPersianDigits(report.averagePercentage)}٪`,
    `رتبه در کلاس: ${toPersianDigits(report.classRank)} از ${toPersianDigits(report.classTotal)}`,
    `رتبه در مدرسه: ${toPersianDigits(report.schoolRank)} از ${toPersianDigits(report.schoolTotal)}`,
  ];

  if (report.complexRank !== null && report.complexTotal !== null) {
    lines.push(
      `رتبه در کل مجموعه (۳ مدرسه): ${toPersianDigits(report.complexRank)} از ${toPersianDigits(report.complexTotal)}`
    );
  }

  lines.push(
    `جمع کل: ${toPersianDigits(report.totalCorrect)} درست | ${toPersianDigits(report.totalWrong)} غلط | ${toPersianDigits(report.totalBlank)} نزده`,
    '────────────────────',
    'عملکرد به تفکیک درس:'
  );

  for (const sm of report.subjectMetrics) {
    lines.push(
      `• ${sm.subjectName} (ضریب ${toPersianDigits(sm.coefficient)}): ${toPersianDigits(sm.percentage)}٪ | تراز ${toPersianDigits(sm.taraz)} | ${toPersianDigits(sm.outOfTen)} از ۱۰ (همتراز: ${toPersianDigits(sm.peerOutOfTen)})`
    );
  }

  const weaknesses = report.topicAnalysis.filter((t) => t.status === 'weakness').slice(0, 3);
  if (weaknesses.length > 0) {
    lines.push('────────────────────', 'اولویت‌های مرور مبحثی:');
    for (const w of weaknesses) {
      lines.push(`• ${w.subjectName} — ${w.topic} (${toPersianDigits(w.accuracyPercent)}٪ پاسخ صحیح)`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates UTF-8 BOM Persian CSV for Excel export of a Mock Exam leaderboard or single student report.
 */
export function buildMockExamCsv(cohort: ExamCohortReport): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const subjectHeaders = cohort.exam.subjects.flatMap((s) => [
    `درصد ${s.subjectName}`,
    `تراز ${s.subjectName}`,
  ]);

  const header = [
    'رتبه مدرسه',
    ...(cohort.exam.scope === 'complex' ? ['رتبه کل مجموعه'] : []),
    'نام دانش‌آموز',
    'مدرسه',
    'کلاس',
    'تراز کل',
    'میانگین درصد',
    'درست کل',
    'غلط کل',
    'نزده کل',
    ...subjectHeaders,
  ];

  const rows = cohort.students.map((st) => [
    toPersianDigits(st.schoolRank),
    ...(cohort.exam.scope === 'complex' ? [toPersianDigits(st.complexRank ?? '')] : []),
    st.studentName,
    st.schoolName,
    st.className,
    toPersianDigits(st.totalTaraz),
    toPersianDigits(st.averagePercentage),
    toPersianDigits(st.totalCorrect),
    toPersianDigits(st.totalWrong),
    toPersianDigits(st.totalBlank),
    ...cohort.exam.subjects.flatMap((s) => {
      const m = st.subjectMetrics.find((x) => x.subjectId === s.id);
      return [toPersianDigits(m?.percentage ?? 0), toPersianDigits(m?.taraz ?? 5500)];
    }),
  ]);

  return '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}
