// Pure TypeScript Analytics Engine for Phase 9-B: Advanced SIDA Analytics
// Covers: Appeal Windows, Failing/Borderline & Remedial Grouping, Snake-Draft Balancing,
// Box Plot (Tukey Quartiles/Outliers), 5-Band Histogram, Matrix/Ranks, YoY & Final Exam Discrepancy.
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { jalaliToGregorian, parseJalaliString } from '../../lib/jalali';
import type {
  AppealTermType,
  AppealWindowComputedStatus,
  SidaAnalyticsGradeRecord,
  SidaAppealWindowConfig,
  SidaBalancedClassBucket,
  SidaRemedialGroupItem,
} from '../../types/domain';

export const APPEAL_TERM_LABELS: Record<AppealTermType, string> = {
  monthly: 'ارزشیابی ماهانه',
  term1: 'نوبت اول (دی‌ماه)',
  term2: 'نوبت دوم (خردادماه)',
  annual: 'نمره نهایی / سالانه',
};

export const CORE_KEY_SUBJECTS = ['ریاضی', 'علوم تجربی', 'فارسی و نگارش', 'ادبیات فارسی'];

export function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Parses a Jalali date (YYYY/MM/DD) + time (HH:mm) into a local timestamp (ms).
 */
export function parseJalaliDateTimeMs(dateJalali: string, timeHm: string): number | null {
  const parts = parseJalaliString(dateJalali);
  if (!parts) return null;
  const g = jalaliToGregorian(parts.jy, parts.jm, parts.jd);
  const cleanTime = toAsciiDigits(timeHm).trim();
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(cleanTime);
  const hours = timeMatch ? Math.min(23, Math.max(0, Number(timeMatch[1]))) : 0;
  const minutes = timeMatch ? Math.min(59, Math.max(0, Number(timeMatch[2]))) : 0;
  return new Date(g.gy, g.gm - 1, g.gd, hours, minutes, 0, 0).getTime();
}

export interface AppealWindowEvaluation {
  status: AppealWindowComputedStatus;
  canSubmit: boolean;
  labelFa: string;
  badgeClass: string;
  parentMessageFa: string;
}

/**
 * Evaluates whether a Grade Appeal Window is currently open, waiting, ended, or manually disabled.
 */
export function evaluateAppealWindow(
  config: Pick<
    SidaAppealWindowConfig,
    'termLabelFa' | 'masterEnabled' | 'useSchedule' | 'startDateJalali' | 'startTime' | 'endDateJalali' | 'endTime'
  > | null | undefined,
  nowMs = Date.now()
): AppealWindowEvaluation {
  if (!config || !config.masterEnabled) {
    return {
      status: 'manually_disabled',
      canSubmit: false,
      labelFa: 'لغو دستی',
      badgeClass:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
      parentMessageFa: config
        ? `امکان ثبت اعتراض نمره برای «${config.termLabelFa}» توسط مدیریت مدرسه به صورت دستی غیرفعال شده است.`
        : 'امکان ثبت اعتراض نمره در حال حاضر توسط مدیریت مدرسه غیرفعال است.',
    };
  }

  if (!config.useSchedule) {
    return {
      status: 'active_in_window',
      canSubmit: true,
      labelFa: 'فعال در بازه زمانی',
      badgeClass:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      parentMessageFa: `ثبت اعتراض نمره برای «${config.termLabelFa}» فعال است.`,
    };
  }

  const startMs = parseJalaliDateTimeMs(config.startDateJalali, config.startTime);
  const endMs = parseJalaliDateTimeMs(config.endDateJalali, config.endTime);

  const startLabel = `${toPersianDigits(config.startDateJalali)} ساعت ${toPersianDigits(config.startTime)}`;
  const endLabel = `${toPersianDigits(config.endDateJalali)} ساعت ${toPersianDigits(config.endTime)}`;

  if (startMs === null || endMs === null || endMs < startMs) {
    return {
      status: 'manually_disabled',
      canSubmit: false,
      labelFa: 'لغو دستی',
      badgeClass:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
      parentMessageFa: 'بازه زمانی تعریف‌شده برای ثبت اعتراض معتبر نیست. لطفاً با دفتر مدرسه تماس بگیرید.',
    };
  }

  if (nowMs < startMs) {
    return {
      status: 'waiting_to_start',
      canSubmit: false,
      labelFa: 'در انتظار شروع',
      badgeClass:
        'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
      parentMessageFa: `مهلت ثبت اعتراض نمره (${config.termLabelFa}) هنوز آغاز نشده است. زمان شروع: ${startLabel} تا ${endLabel}.`,
    };
  }

  if (nowMs > endMs) {
    return {
      status: 'ended',
      canSubmit: false,
      labelFa: 'پایان یافته',
      badgeClass:
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      parentMessageFa: `مهلت ثبت اعتراض نمره (${config.termLabelFa}) در تاریخ ${endLabel} به پایان رسیده است.`,
    };
  }

  return {
    status: 'active_in_window',
    canSubmit: true,
    labelFa: 'فعال در بازه زمانی',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    parentMessageFa: `سامانه ثبت اعتراض نمره (${config.termLabelFa}) از ${startLabel} تا ${endLabel} فعال است.`,
  };
}

/**
 * Evaluates whether ANY configured appeal window for a school/year currently allows submission.
 */
export function evaluateOverallParentAppealGate(
  windows: SidaAppealWindowConfig[],
  preferredTerm?: AppealTermType,
  nowMs = Date.now()
): {
  canSubmit: boolean;
  activeWindow: SidaAppealWindowConfig | null;
  evaluation: AppealWindowEvaluation;
} {
  if (windows.length === 0) {
    return {
      canSubmit: true,
      activeWindow: null,
      evaluation: {
        status: 'active_in_window',
        canSubmit: true,
        labelFa: 'فعال در بازه زمانی',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        parentMessageFa: 'ثبت درخواست بازبینی نمره فعال است.',
      },
    };
  }

  if (preferredTerm) {
    const exact = windows.find((w) => w.term === preferredTerm);
    if (exact) {
      const ev = evaluateAppealWindow(exact, nowMs);
      return { canSubmit: ev.canSubmit, activeWindow: exact, evaluation: ev };
    }
  }

  // Prefer any window that is currently active_in_window
  for (const w of windows) {
    const ev = evaluateAppealWindow(w, nowMs);
    if (ev.canSubmit) {
      return { canSubmit: true, activeWindow: w, evaluation: ev };
    }
  }

  // Otherwise prioritize waiting_to_start, then ended, then manually_disabled
  const evals = windows.map((w) => ({ w, ev: evaluateAppealWindow(w, nowMs) }));
  const waiting = evals.find((x) => x.ev.status === 'waiting_to_start');
  if (waiting) return { canSubmit: false, activeWindow: waiting.w, evaluation: waiting.ev };
  const ended = evals.find((x) => x.ev.status === 'ended');
  if (ended) return { canSubmit: false, activeWindow: ended.w, evaluation: ended.ev };
  return {
    canSubmit: false,
    activeWindow: evals[0].w,
    evaluation: evals[0].ev,
  };
}

// ============================================================================
// TAB 2: FAILING / BORDERLINE STUDENTS & SMART REMEDIAL GROUPING
// ============================================================================

export interface StudentFailingSummary {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  gradeNumber: number;
  failingSubjects: Array<{ subject: string; score: number }>;
  borderlineSubjects: Array<{ subject: string; score: number }>;
  failingCount: number;
  borderlineCount: number;
  lowestScore: number;
  overallAverage: number;
}

export function computeFailingAndBorderlineStudents(
  records: SidaAnalyticsGradeRecord[],
  options: {
    gradeFilter?: number | 'ALL';
    classFilter?: string;
    subjectFilter?: string;
    passingThreshold: number;
    borderlineUpper: number;
    includeBorderline: boolean;
  }
): StudentFailingSummary[] {
  const {
    gradeFilter = 'ALL',
    classFilter = 'ALL',
    subjectFilter = 'ALL',
    passingThreshold,
    borderlineUpper,
    includeBorderline,
  } = options;

  const filtered = records.filter((r) => {
    if (gradeFilter !== 'ALL' && r.gradeNumber !== gradeFilter) return false;
    if (classFilter !== 'ALL' && r.classId !== classFilter) return false;
    if (subjectFilter !== 'ALL' && r.subject !== subjectFilter) return false;
    return true;
  });

  const byStudent = new Map<string, SidaAnalyticsGradeRecord[]>();
  for (const rec of filtered) {
    const arr = byStudent.get(rec.studentId);
    if (arr) arr.push(rec);
    else byStudent.set(rec.studentId, [rec]);
  }

  const summaries: StudentFailingSummary[] = [];
  for (const [, list] of byStudent.entries()) {
    const first = list[0];
    const failingSubjects: Array<{ subject: string; score: number }> = [];
    const borderlineSubjects: Array<{ subject: string; score: number }> = [];

    let sum = 0;
    let lowest = 20;
    for (const r of list) {
      sum += r.score;
      if (r.score < lowest) lowest = r.score;
      if (r.score < passingThreshold) {
        failingSubjects.push({ subject: r.subject, score: r.score });
      } else if (includeBorderline && r.score >= passingThreshold && r.score < borderlineUpper) {
        borderlineSubjects.push({ subject: r.subject, score: r.score });
      }
    }

    if (failingSubjects.length > 0 || (includeBorderline && borderlineSubjects.length > 0)) {
      summaries.push({
        studentId: first.studentId,
        studentName: first.studentName,
        classId: first.classId,
        className: first.className,
        gradeNumber: first.gradeNumber,
        failingSubjects: failingSubjects.sort((a, b) => a.score - b.score),
        borderlineSubjects: borderlineSubjects.sort((a, b) => a.score - b.score),
        failingCount: failingSubjects.length,
        borderlineCount: borderlineSubjects.length,
        lowestScore: round2(lowest),
        overallAverage: round2(sum / list.length),
      });
    }
  }

  return summaries.sort(
    (a, b) =>
      b.failingCount - a.failingCount ||
      a.lowestScore - b.lowestScore ||
      a.studentName.localeCompare(b.studentName, 'fa')
  );
}

/**
 * Automatically groups students needing remedial support in a target subject into
 * level-homogeneous groups respecting maxCapacity.
 */
export function buildSmartRemedialGroups(
  records: SidaAnalyticsGradeRecord[],
  options: {
    subject: string;
    passingThreshold: number;
    borderlineUpper: number;
    includeBorderline: boolean;
    maxCapacity: number;
    gradeFilter?: number | 'ALL';
    classFilter?: string;
  }
): SidaRemedialGroupItem[] {
  const cap = Math.max(2, Math.floor(options.maxCapacity));
  const upperLimit = options.includeBorderline
    ? Math.max(options.passingThreshold, options.borderlineUpper)
    : options.passingThreshold;

  const candidates = records
    .filter((r) => {
      if (r.subject !== options.subject) return false;
      if (options.gradeFilter && options.gradeFilter !== 'ALL' && r.gradeNumber !== options.gradeFilter) {
        return false;
      }
      if (options.classFilter && options.classFilter !== 'ALL' && r.classId !== options.classFilter) {
        return false;
      }
      return r.score < upperLimit;
    })
    .sort((a, b) => a.score - b.score);

  if (candidates.length === 0) return [];

  const groupCount = Math.max(1, Math.ceil(candidates.length / cap));
  const baseSize = Math.floor(candidates.length / groupCount);
  const remainder = candidates.length % groupCount;

  const levelDescriptors = [
    'سطح تقویتی پایه (اولویت فوری)',
    'سطح تقویتی میانی (تثبیت مفاهیم)',
    'سطح تقویتی مرزی (ارتقا به تسلط)',
    'سطح مرور و تمرین تکمیلی',
  ];

  const groups: SidaRemedialGroupItem[] = [];
  let cursor = 0;
  for (let i = 0; i < groupCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const slice = candidates.slice(cursor, cursor + size);
    cursor += size;
    const avg =
      slice.length > 0
        ? round2(slice.reduce((acc, s) => acc + s.score, 0) / slice.length)
        : 0;
    const desc = levelDescriptors[Math.min(i, levelDescriptors.length - 1)];
    groups.push({
      id: `rem-grp-${i + 1}`,
      name: `گروه تقویتی ${options.subject} ${toPersianDigits(i + 1)}`,
      levelLabelFa: desc,
      studentIds: slice.map((s) => s.studentId),
      averageScore: avg,
    });
  }

  return groups;
}

export function moveStudentBetweenRemedialGroups(
  groups: SidaRemedialGroupItem[],
  studentId: string,
  targetGroupId: string,
  scoreLookup: Map<string, number>
): SidaRemedialGroupItem[] {
  return groups.map((g) => {
    const filtered = g.studentIds.filter((id) => id !== studentId);
    const nextIds = g.id === targetGroupId ? [...filtered, studentId] : filtered;
    const avg =
      nextIds.length > 0
        ? round2(
            nextIds.reduce((sum, id) => sum + (scoreLookup.get(id) ?? 0), 0) / nextIds.length
          )
        : 0;
    return {
      ...g,
      studentIds: nextIds,
      averageScore: avg,
    };
  });
}

// ============================================================================
// TAB 3: SMART BALANCED CLASS ALLOCATION (SNAKE DRAFT)
// ============================================================================

export interface StudentBalancingProfile {
  studentId: string;
  studentName: string;
  currentClassName: string;
  gradeNumber: number;
  overallGpa: number;
  keySubjectsAvg: number;
  disciplineScore: number;
  compositeScore: number;
  tier: 'top' | 'middle' | 'support';
}

export function buildStudentBalancingProfiles(
  records: SidaAnalyticsGradeRecord[],
  targetGrade: number
): StudentBalancingProfile[] {
  const gradeRecords = records.filter((r) => r.gradeNumber === targetGrade);
  const byStudent = new Map<string, SidaAnalyticsGradeRecord[]>();
  for (const r of gradeRecords) {
    const arr = byStudent.get(r.studentId);
    if (arr) arr.push(r);
    else byStudent.set(r.studentId, [r]);
  }

  const profiles: StudentBalancingProfile[] = [];
  for (const [, list] of byStudent.entries()) {
    const first = list[0];
    let weightedSum = 0;
    let coeffSum = 0;
    let keySum = 0;
    let keyCount = 0;
    for (const r of list) {
      const c = r.subjectCoefficient || 1;
      weightedSum += r.score * c;
      coeffSum += c;
      if (CORE_KEY_SUBJECTS.some((k) => r.subject.includes(k) || k.includes(r.subject))) {
        keySum += r.score;
        keyCount += 1;
      }
    }
    const overallGpa = coeffSum > 0 ? round2(weightedSum / coeffSum) : 0;
    const keySubjectsAvg = keyCount > 0 ? round2(keySum / keyCount) : overallGpa;
    const disciplineScore = round2(first.disciplineScore ?? 19);
    const compositeScore = round2(
      overallGpa * 0.5 + keySubjectsAvg * 0.35 + disciplineScore * 0.15
    );
    const tier: 'top' | 'middle' | 'support' =
      overallGpa >= 18 ? 'top' : overallGpa < 12 ? 'support' : 'middle';

    profiles.push({
      studentId: first.studentId,
      studentName: first.studentName,
      currentClassName: first.className,
      gradeNumber: first.gradeNumber,
      overallGpa,
      keySubjectsAvg,
      disciplineScore,
      compositeScore,
      tier,
    });
  }

  return profiles.sort(
    (a, b) => b.compositeScore - a.compositeScore || b.overallGpa - a.overallGpa
  );
}

const PERSIAN_CLASS_LETTERS = ['الف', 'ب', 'ج', 'د', 'هـ', 'و'];

/**
 * Snake Draft distribution so every destination class receives equalized mean GPA,
 * top performers, and students needing academic support.
 */
export function runSnakeDraftClassBalancing(
  profiles: StudentBalancingProfile[],
  classCount: number,
  gradeLabelFa: string
): SidaBalancedClassBucket[] {
  const k = Math.max(2, Math.min(6, Math.floor(classCount)));
  const buckets: SidaBalancedClassBucket[] = Array.from({ length: k }, (_, idx) => ({
    id: `balanced-cls-${idx + 1}`,
    name: `${gradeLabelFa} — کلاس ${PERSIAN_CLASS_LETTERS[idx] ?? toPersianDigits(idx + 1)}`,
    studentIds: [],
  }));

  const sorted = [...profiles].sort(
    (a, b) => b.compositeScore - a.compositeScore || b.overallGpa - a.overallGpa
  );

  sorted.forEach((student, index) => {
    const row = Math.floor(index / k);
    const col = index % k;
    const targetBucketIdx = row % 2 === 0 ? col : k - 1 - col;
    buckets[targetBucketIdx].studentIds.push(student.studentId);
  });

  return buckets;
}

export interface BalancedClassStatCard {
  bucketId: string;
  name: string;
  studentCount: number;
  meanGpa: number;
  meanKeySubjects: number;
  meanDiscipline: number;
  topCount: number;
  supportCount: number;
  stdDevGpa: number;
}

export interface BalancingOverallMetrics {
  classStats: BalancedClassStatCard[];
  meanSpread: number;
  parityIndexPercent: number; // 0..100, higher is more balanced
}

export function computeBalancedClassStats(
  buckets: SidaBalancedClassBucket[],
  profilesById: Map<string, StudentBalancingProfile>
): BalancingOverallMetrics {
  const classStats: BalancedClassStatCard[] = buckets.map((bucket) => {
    const members = bucket.studentIds
      .map((id) => profilesById.get(id))
      .filter((x): x is StudentBalancingProfile => Boolean(x));
    const n = members.length;
    if (n === 0) {
      return {
        bucketId: bucket.id,
        name: bucket.name,
        studentCount: 0,
        meanGpa: 0,
        meanKeySubjects: 0,
        meanDiscipline: 0,
        topCount: 0,
        supportCount: 0,
        stdDevGpa: 0,
      };
    }

    const meanGpa = members.reduce((s, m) => s + m.overallGpa, 0) / n;
    const meanKeySubjects = members.reduce((s, m) => s + m.keySubjectsAvg, 0) / n;
    const meanDiscipline = members.reduce((s, m) => s + m.disciplineScore, 0) / n;
    const variance =
      members.reduce((s, m) => s + (m.overallGpa - meanGpa) ** 2, 0) / n;

    return {
      bucketId: bucket.id,
      name: bucket.name,
      studentCount: n,
      meanGpa: round2(meanGpa),
      meanKeySubjects: round2(meanKeySubjects),
      meanDiscipline: round2(meanDiscipline),
      topCount: members.filter((m) => m.tier === 'top').length,
      supportCount: members.filter((m) => m.tier === 'support').length,
      stdDevGpa: round2(Math.sqrt(variance)),
    };
  });

  const nonEmptyMeans = classStats.filter((c) => c.studentCount > 0).map((c) => c.meanGpa);
  const meanSpread =
    nonEmptyMeans.length >= 2
      ? round2(Math.max(...nonEmptyMeans) - Math.min(...nonEmptyMeans))
      : 0;
  // Parity index: 100% when spread is 0, decreases smoothly with spread
  const parityIndexPercent = round2(Math.max(0, Math.min(100, 100 - meanSpread * 20)));

  return { classStats, meanSpread, parityIndexPercent };
}

export function moveStudentBetweenBalancedClasses(
  buckets: SidaBalancedClassBucket[],
  studentId: string,
  targetBucketId: string
): SidaBalancedClassBucket[] {
  return buckets.map((b) => {
    const cleaned = b.studentIds.filter((id) => id !== studentId);
    return {
      ...b,
      studentIds: b.id === targetBucketId ? [...cleaned, studentId] : cleaned,
    };
  });
}

// ============================================================================
// TAB 4: BOX PLOT (TUKEY QUARTILES & OUTLIERS) & 5-BAND HISTOGRAM
// ============================================================================

export interface BoxPlotGroupStat {
  key: string;
  label: string;
  count: number;
  rawMin: number;
  rawMax: number;
  whiskerMin: number;
  q1: number;
  median: number;
  q3: number;
  whiskerMax: number;
  iqr: number;
  mean: number;
  outliers: number[];
}

export function computePercentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const weight = idx - lo;
  return sortedAsc[lo] * (1 - weight) + sortedAsc[hi] * weight;
}

export function computeBoxPlotStats(
  groups: Array<{ key: string; label: string; scores: number[] }>
): BoxPlotGroupStat[] {
  return groups
    .filter((g) => g.scores.length > 0)
    .map((g) => {
      const sorted = [...g.scores].sort((a, b) => a - b);
      const q1 = computePercentile(sorted, 0.25);
      const median = computePercentile(sorted, 0.5);
      const q3 = computePercentile(sorted, 0.75);
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      const inliers = sorted.filter((v) => v >= lowerFence && v <= upperFence);
      const outliers = sorted.filter((v) => v < lowerFence || v > upperFence).map(round2);

      const whiskerMin = inliers.length > 0 ? inliers[0] : sorted[0];
      const whiskerMax = inliers.length > 0 ? inliers[inliers.length - 1] : sorted[sorted.length - 1];
      const mean = sorted.reduce((acc, v) => acc + v, 0) / sorted.length;

      return {
        key: g.key,
        label: g.label,
        count: sorted.length,
        rawMin: round2(sorted[0]),
        rawMax: round2(sorted[sorted.length - 1]),
        whiskerMin: round2(whiskerMin),
        q1: round2(q1),
        median: round2(median),
        q3: round2(q3),
        whiskerMax: round2(whiskerMax),
        iqr: round2(iqr),
        mean: round2(mean),
        outliers,
      };
    });
}

export interface GradeDistributionBand {
  id: 'under_10' | '10_to_12' | '12_to_15' | '15_to_18' | '18_to_20';
  labelFa: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
  percent: number;
  colorHex: string;
}

export interface GradeDistributionSummary {
  bands: GradeDistributionBand[];
  totalCount: number;
  mean: number;
  median: number;
  stdDev: number;
}

export function computeGradeDistribution(scores: number[]): GradeDistributionSummary {
  const bandDefs: Array<{
    id: GradeDistributionBand['id'];
    labelFa: string;
    rangeMin: number;
    rangeMax: number;
    colorHex: string;
    match: (v: number) => boolean;
  }> = [
    {
      id: 'under_10',
      labelFa: 'زیر ۱۰',
      rangeMin: 0,
      rangeMax: 10,
      colorHex: '#e11d48',
      match: (v) => v < 10,
    },
    {
      id: '10_to_12',
      labelFa: '۱۰ تا ۱۲',
      rangeMin: 10,
      rangeMax: 12,
      colorHex: '#d97706',
      match: (v) => v >= 10 && v < 12,
    },
    {
      id: '12_to_15',
      labelFa: '۱۲ تا ۱۵',
      rangeMin: 12,
      rangeMax: 15,
      colorHex: '#eab308',
      match: (v) => v >= 12 && v < 15,
    },
    {
      id: '15_to_18',
      labelFa: '۱۵ تا ۱۸',
      rangeMin: 15,
      rangeMax: 18,
      colorHex: '#0284c7',
      match: (v) => v >= 15 && v < 18,
    },
    {
      id: '18_to_20',
      labelFa: '۱۸ تا ۲۰',
      rangeMin: 18,
      rangeMax: 20,
      colorHex: '#059669',
      match: (v) => v >= 18,
    },
  ];

  const totalCount = scores.length;
  const bands: GradeDistributionBand[] = bandDefs.map((def) => {
    const count = scores.filter(def.match).length;
    return {
      id: def.id,
      labelFa: def.labelFa,
      rangeMin: def.rangeMin,
      rangeMax: def.rangeMax,
      count,
      percent: totalCount > 0 ? round2((count / totalCount) * 100) : 0,
      colorHex: def.colorHex,
    };
  });

  if (totalCount === 0) {
    return { bands, totalCount: 0, mean: 0, median: 0, stdDev: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((s, v) => s + v, 0) / totalCount;
  const median = computePercentile(sorted, 0.5);
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / totalCount;

  return {
    bands,
    totalCount,
    mean: round2(mean),
    median: round2(median),
    stdDev: round2(Math.sqrt(variance)),
  };
}

// ============================================================================
// TAB 5: MATRIX REPORT, WEIGHTED GPA, CLASS & GRADE RANKS, SUBJECT LEADERBOARD
// ============================================================================

export interface MatrixStudentRow {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  gradeNumber: number;
  subjectScores: Record<string, number | undefined>;
  weightedGpa: number;
  classRank: number;
  gradeRank: number;
  failingCount: number;
}

export function buildMatrixReport(
  records: SidaAnalyticsGradeRecord[],
  passingThreshold = 10
): {
  subjects: string[];
  rows: MatrixStudentRow[];
} {
  const subjectSet = new Set<string>();
  const byStudent = new Map<string, SidaAnalyticsGradeRecord[]>();

  for (const r of records) {
    subjectSet.add(r.subject);
    const arr = byStudent.get(r.studentId);
    if (arr) arr.push(r);
    else byStudent.set(r.studentId, [r]);
  }

  const subjects = Array.from(subjectSet).sort((a, b) => a.localeCompare(b, 'fa'));

  const rows: MatrixStudentRow[] = [];
  for (const [, list] of byStudent.entries()) {
    const first = list[0];
    const subjectScores: Record<string, number | undefined> = {};
    let weightedSum = 0;
    let coeffSum = 0;
    let failingCount = 0;

    for (const r of list) {
      subjectScores[r.subject] = round2(r.score);
      const c = r.subjectCoefficient || 1;
      weightedSum += r.score * c;
      coeffSum += c;
      if (r.score < passingThreshold) failingCount += 1;
    }

    rows.push({
      studentId: first.studentId,
      studentName: first.studentName,
      classId: first.classId,
      className: first.className,
      gradeNumber: first.gradeNumber,
      subjectScores,
      weightedGpa: coeffSum > 0 ? round2(weightedSum / coeffSum) : 0,
      classRank: 1,
      gradeRank: 1,
      failingCount,
    });
  }

  // Assign dense/standard competition classRank within each classId
  const byClass = new Map<string, MatrixStudentRow[]>();
  const byGrade = new Map<number, MatrixStudentRow[]>();
  for (const row of rows) {
    const cList = byClass.get(row.classId);
    if (cList) cList.push(row);
    else byClass.set(row.classId, [row]);

    const gList = byGrade.get(row.gradeNumber);
    if (gList) gList.push(row);
    else byGrade.set(row.gradeNumber, [row]);
  }

  for (const list of byClass.values()) {
    list.sort((a, b) => b.weightedGpa - a.weightedGpa);
    list.forEach((row, idx) => {
      if (idx > 0 && row.weightedGpa === list[idx - 1].weightedGpa) {
        row.classRank = list[idx - 1].classRank;
      } else {
        row.classRank = idx + 1;
      }
    });
  }

  for (const list of byGrade.values()) {
    list.sort((a, b) => b.weightedGpa - a.weightedGpa);
    list.forEach((row, idx) => {
      if (idx > 0 && row.weightedGpa === list[idx - 1].weightedGpa) {
        row.gradeRank = list[idx - 1].gradeRank;
      } else {
        row.gradeRank = idx + 1;
      }
    });
  }

  rows.sort((a, b) => a.gradeRank - b.gradeRank || b.weightedGpa - a.weightedGpa);
  return { subjects, rows };
}

export interface SubjectLeaderboard {
  subject: string;
  topStudents: Array<{
    studentId: string;
    studentName: string;
    className: string;
    score: number;
  }>;
  mostImproved: Array<{
    studentId: string;
    studentName: string;
    className: string;
    previousScore: number;
    score: number;
    growth: number;
  }>;
}

export function buildSubjectLeaderboards(
  records: SidaAnalyticsGradeRecord[]
): SubjectLeaderboard[] {
  const bySubject = new Map<string, SidaAnalyticsGradeRecord[]>();
  for (const r of records) {
    const arr = bySubject.get(r.subject);
    if (arr) arr.push(r);
    else bySubject.set(r.subject, [r]);
  }

  return Array.from(bySubject.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'fa'))
    .map(([subject, list]) => {
      const topStudents = [...list]
        .sort((a, b) => b.score - a.score || b.previousScore - a.previousScore)
        .slice(0, 3)
        .map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          className: r.className,
          score: round2(r.score),
        }));

      const mostImproved = [...list]
        .map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          className: r.className,
          previousScore: round2(r.previousScore),
          score: round2(r.score),
          growth: round2(r.score - r.previousScore),
        }))
        .sort((a, b) => b.growth - a.growth || b.score - a.score)
        .slice(0, 3);

      return { subject, topStudents, mostImproved };
    });
}

export function getScoreCellColorClass(score: number | undefined): string {
  if (score === undefined) {
    return 'bg-slate-50 dark:bg-slate-800/40 text-slate-400';
  }
  if (score >= 18) {
    return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-extrabold';
  }
  if (score >= 15) {
    return 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 font-bold';
  }
  if (score >= 10) {
    return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold';
  }
  return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-extrabold';
}

// ============================================================================
// TAB 6: YEAR-OVER-YEAR COMPARISON & COORDINATED FINAL EXAM DISCREPANCY
// ============================================================================

export interface SubjectYearlyComparisonRow {
  subject: string;
  prevYearAvg: number;
  currYearAvg: number;
  deltaAvg: number;
  prevPassRate: number;
  currPassRate: number;
  deltaPassRate: number;
}

export interface YearlyComparisonSummary {
  prevYearCode: string;
  currYearCode: string;
  prevSchoolAvg: number;
  currSchoolAvg: number;
  deltaSchoolAvg: number;
  prevPassRate: number;
  currPassRate: number;
  deltaPassRate: number;
  subjectRows: SubjectYearlyComparisonRow[];
}

export function computeYearlyComparison(
  prevRecords: SidaAnalyticsGradeRecord[],
  currRecords: SidaAnalyticsGradeRecord[],
  prevYearCode = '1403-1404',
  currYearCode = '1404-1405',
  passingThreshold = 10
): YearlyComparisonSummary {
  const avgOf = (arr: SidaAnalyticsGradeRecord[]) =>
    arr.length > 0 ? round2(arr.reduce((s, r) => s + r.score, 0) / arr.length) : 0;
  const passRateOf = (arr: SidaAnalyticsGradeRecord[]) =>
    arr.length > 0
      ? round2((arr.filter((r) => r.score >= passingThreshold).length / arr.length) * 100)
      : 0;

  const prevSchoolAvg = avgOf(prevRecords);
  const currSchoolAvg = avgOf(currRecords);
  const prevPassRate = passRateOf(prevRecords);
  const currPassRate = passRateOf(currRecords);

  const subjectSet = new Set<string>();
  for (const r of prevRecords) subjectSet.add(r.subject);
  for (const r of currRecords) subjectSet.add(r.subject);

  const subjectRows: SubjectYearlyComparisonRow[] = Array.from(subjectSet)
    .sort((a, b) => a.localeCompare(b, 'fa'))
    .map((subject) => {
      const pList = prevRecords.filter((r) => r.subject === subject);
      const cList = currRecords.filter((r) => r.subject === subject);
      const pAvg = avgOf(pList);
      const cAvg = avgOf(cList);
      const pPass = passRateOf(pList);
      const cPass = passRateOf(cList);
      return {
        subject,
        prevYearAvg: pAvg,
        currYearAvg: cAvg,
        deltaAvg: round2(cAvg - pAvg),
        prevPassRate: pPass,
        currPassRate: cPass,
        deltaPassRate: round2(cPass - pPass),
      };
    });

  return {
    prevYearCode,
    currYearCode,
    prevSchoolAvg,
    currSchoolAvg,
    deltaSchoolAvg: round2(currSchoolAvg - prevSchoolAvg),
    prevPassRate,
    currPassRate,
    deltaPassRate: round2(currPassRate - prevPassRate),
    subjectRows,
  };
}

export type FinalExamAlignmentFlag = 'overestimated' | 'underestimated' | 'aligned';

export interface FinalExamSubjectDiscrepancy {
  subject: string;
  studentCount: number;
  schoolInternalAvg: number;
  finalExamAvg: number;
  /** Positive means school grades are inflated compared to coordinated final exam */
  gap: number;
  /** 0..100% alignment index (100% = perfect alignment) */
  alignmentIndexPercent: number;
  flag: FinalExamAlignmentFlag;
  flagLabelFa: string;
  managementAlertFa: string;
}

export function computeFinalExamDiscrepancy(
  records: SidaAnalyticsGradeRecord[],
  thresholdGap = 1.5
): {
  overallSchoolInternalAvg: number;
  overallFinalExamAvg: number;
  overallGap: number;
  overallAlignmentPercent: number;
  subjects: FinalExamSubjectDiscrepancy[];
} {
  const withFinal = records.filter((r) => typeof r.finalExamScore === 'number');
  if (withFinal.length === 0) {
    return {
      overallSchoolInternalAvg: 0,
      overallFinalExamAvg: 0,
      overallGap: 0,
      overallAlignmentPercent: 100,
      subjects: [],
    };
  }

  const bySubject = new Map<string, SidaAnalyticsGradeRecord[]>();
  for (const r of withFinal) {
    const arr = bySubject.get(r.subject);
    if (arr) arr.push(r);
    else bySubject.set(r.subject, [r]);
  }

  const subjects: FinalExamSubjectDiscrepancy[] = Array.from(bySubject.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'fa'))
    .map(([subject, list]) => {
      const schoolInternalAvg = round2(
        list.reduce((s, r) => s + r.schoolInternalScore, 0) / list.length
      );
      const finalExamAvg = round2(
        list.reduce((s, r) => s + (r.finalExamScore ?? 0), 0) / list.length
      );
      const gap = round2(schoolInternalAvg - finalExamAvg);
      const alignmentIndexPercent = round2(Math.max(0, Math.min(100, 100 - Math.abs(gap) * 12)));

      let flag: FinalExamAlignmentFlag = 'aligned';
      let flagLabelFa = 'تطابق مطلوب';
      let managementAlertFa =
        'ارزشیابی مستمر و پایانی مدرسه با سطح آزمون نهایی هماهنگ همخوانی استاندارد دارد.';

      if (gap >= thresholdGap) {
        flag = 'overestimated';
        flagLabelFa = 'بیش‌برآورد نمره مدرسه';
        managementAlertFa = `هشدار مدیریتی: میانگین نمره مدرسه در درس «${subject}» به میزان ${toPersianDigits(gap)} نمره بالاتر از آزمون نهایی است؛ بازنگری در سخت‌گیری و استاندارد آزمون‌های داخلی توصیه می‌شود.`;
      } else if (gap <= -thresholdGap) {
        flag = 'underestimated';
        flagLabelFa = 'کم‌برآورد نمره مدرسه';
        managementAlertFa = `نکته مدیریتی: دانش‌آموزان در آزمون نهایی درس «${subject}» به میزان ${toPersianDigits(Math.abs(gap))} نمره بهتر از نمره مستمر مدرسه عمل کرده‌اند؛ احتمال سخت‌گیری بیش از حد در نمره‌دهی داخلی وجود دارد.`;
      }

      return {
        subject,
        studentCount: list.length,
        schoolInternalAvg,
        finalExamAvg,
        gap,
        alignmentIndexPercent,
        flag,
        flagLabelFa,
        managementAlertFa,
      };
    });

  const overallSchoolInternalAvg = round2(
    withFinal.reduce((s, r) => s + r.schoolInternalScore, 0) / withFinal.length
  );
  const overallFinalExamAvg = round2(
    withFinal.reduce((s, r) => s + (r.finalExamScore ?? 0), 0) / withFinal.length
  );
  const overallGap = round2(overallSchoolInternalAvg - overallFinalExamAvg);
  const overallAlignmentPercent = round2(
    Math.max(0, Math.min(100, 100 - Math.abs(overallGap) * 12))
  );

  return {
    overallSchoolInternalAvg,
    overallFinalExamAvg,
    overallGap,
    overallAlignmentPercent,
    subjects,
  };
}
