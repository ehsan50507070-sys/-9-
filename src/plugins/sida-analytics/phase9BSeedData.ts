// Deterministic Realistic Persian Seed Data for Phase 9-B Advanced SIDA Analytics
// Populates BOTH 1403-1404 (archived) and 1404-1405 (active) across schools with scores 7..20,
// failing cases, borderline cases, statistical outliers, previous-term scores & coordinated final exams.
import {
  ARCHIVED_ACADEMIC_YEAR_ID,
  DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
} from '../../core/academic-year/academicYearHelpers';
import { DEFAULT_COMPLEX_ID } from '../../core/super-admin/superAdminHelpers';
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import type {
  AppealTermType,
  ClassRoom,
  School,
  SidaAnalyticsGradeRecord,
  SidaAppealWindowConfig,
  SidaClassBalancingDraft,
  SidaRemedialGroupRecord,
  Student,
} from '../../types/domain';
import {
  APPEAL_TERM_LABELS,
  buildSmartRemedialGroups,
  buildStudentBalancingProfiles,
  round2,
  runSnakeDraftClassBalancing,
} from './sidaAnalyticsHelpers';

export const PHASE9B_PLUGIN_IDS = ['sida-analytics'] as const;

export interface Phase9BSeedBundle {
  sida_appeal_windows: SidaAppealWindowConfig[];
  sida_remedial_groups: SidaRemedialGroupRecord[];
  sida_class_balancing_drafts: SidaClassBalancingDraft[];
  sida_analytics_grades: SidaAnalyticsGradeRecord[];
}

const ANALYTICS_SUBJECTS: Array<{
  name: string;
  coefficient: number;
  /** Intentional school-vs-final bias so Tab 6 showcases realistic management alerts */
  finalGapBias: number;
}> = [
  { name: 'ریاضی', coefficient: 3, finalGapBias: 2.35 }, // Overestimated by school -> management warning
  { name: 'علوم تجربی', coefficient: 3, finalGapBias: 0.45 }, // Well-aligned
  { name: 'فارسی و نگارش', coefficient: 3, finalGapBias: -1.85 }, // Underestimated by school -> strict internal grading alert
  { name: 'مطالعات اجتماعی', coefficient: 2, finalGapBias: 1.95 }, // Overestimated -> warning
  { name: 'قرآن و هدیه‌ها', coefficient: 2, finalGapBias: 0.3 }, // Aligned
  { name: 'زبان انگلیسی', coefficient: 2, finalGapBias: 0.65 }, // Aligned
];

/**
 * Deterministic pseudo-random helper returning a stable value in [0, 1).
 */
function seededFraction(seedInt: number): number {
  const x = Math.sin(seedInt * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clampScore(v: number): number {
  return round2(Math.max(6.5, Math.min(20, Math.round(v * 4) / 4)));
}

export function generatePhase9BSeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
}): Phase9BSeedBundle {
  const { schools, classes, students } = params;
  const nowIso = '2025-11-22T09:00:00.000Z';
  const todayJalali = getTodayJalali();
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const sida_appeal_windows: SidaAppealWindowConfig[] = [];
  const sida_remedial_groups: SidaRemedialGroupRecord[] = [];
  const sida_class_balancing_drafts: SidaClassBalancingDraft[] = [];
  const sida_analytics_grades: SidaAnalyticsGradeRecord[] = [];

  for (let sIdx = 0; sIdx < schools.length; sIdx++) {
    const school = schools[sIdx];
    const complexId = school.complexId ?? DEFAULT_COMPLEX_ID;
    const schoolStudents = students.filter((st) => st.schoolId === school.id && st.active);

    // 1. Seed Automatic Appeal Windows for BOTH academic years across all 4 terms
    const terms: AppealTermType[] = ['monthly', 'term1', 'term2', 'annual'];
    for (const ayId of [DEFAULT_ACTIVE_ACADEMIC_YEAR_ID, ARCHIVED_ACADEMIC_YEAR_ID]) {
      const isArchived = ayId === ARCHIVED_ACADEMIC_YEAR_ID;
      terms.forEach((term) => {
        let startDateJalali = addDaysToJalali(todayJalali, -3);
        let endDateJalali = addDaysToJalali(todayJalali, 7);
        let masterEnabled = true;

        if (isArchived) {
          startDateJalali = '1404/03/20';
          endDateJalali = '1404/03/27';
          masterEnabled = false;
        } else if (term === 'term1') {
          // Active right now
          startDateJalali = addDaysToJalali(todayJalali, -4);
          endDateJalali = addDaysToJalali(todayJalali, 10);
          masterEnabled = true;
        } else if (term === 'monthly') {
          // Active right now
          startDateJalali = addDaysToJalali(todayJalali, -2);
          endDateJalali = addDaysToJalali(todayJalali, 5);
          masterEnabled = true;
        } else if (term === 'term2') {
          // Waiting to start (future)
          startDateJalali = addDaysToJalali(todayJalali, 45);
          endDateJalali = addDaysToJalali(todayJalali, 55);
          masterEnabled = true;
        } else if (term === 'annual') {
          // Ended earlier / closed
          startDateJalali = addDaysToJalali(todayJalali, -30);
          endDateJalali = addDaysToJalali(todayJalali, -15);
          masterEnabled = true;
        }

        sida_appeal_windows.push({
          id: `${school.id}:appeal-win:${ayId}:${term}`,
          complexId,
          schoolId: school.id,
          academicYearId: ayId,
          createdByUserId: 'user-principal',
          createdAtIso: nowIso,
          updatedAtIso: nowIso,
          term,
          termLabelFa: APPEAL_TERM_LABELS[term],
          masterEnabled,
          useSchedule: true,
          startDateJalali,
          startTime: '08:00',
          endDateJalali,
          endTime: '22:00',
          updatedByName: school.principalName,
        });
      });
    }

    // 2. Seed rich realistic scores (7..20) for BOTH 1403-1404 and 1404-1405
    const activeYearRecordsForSchool: SidaAnalyticsGradeRecord[] = [];
    for (let stIdx = 0; stIdx < schoolStudents.length; stIdx++) {
      const st = schoolStudents[stIdx];
      const cls = classMap.get(st.classId);
      const gradeNum = cls?.gradeLevel ?? 6;
      const className = cls?.name ?? `پایه ${gradeNum}`;

      // Assign realistic student ability tiers including struggling, borderline, average, strong, and outlier profiles
      const bucketMod = stIdx % 10;
      let studentBase = 16.0;
      if (bucketMod === 0) studentBase = 19.2; // Top star
      else if (bucketMod === 1) studentBase = 18.4; // High achiever
      else if (bucketMod === 2) studentBase = 17.1; // Strong
      else if (bucketMod === 3) studentBase = 15.8; // Good
      else if (bucketMod === 4) studentBase = 14.3; // Mid
      else if (bucketMod === 5) studentBase = 12.9; // Lower-mid
      else if (bucketMod === 6) studentBase = 11.1; // Borderline (10..12)
      else if (bucketMod === 7) studentBase = 9.2; // Failing in multiple subjects
      else if (bucketMod === 8) studentBase = 16.5; // Growth star
      else studentBase = 8.4; // Severe support / Tukey low outlier candidate

      const disciplineScore = clampScore(17.5 + seededFraction(sIdx * 31 + stIdx * 7) * 2.5);

      ANALYTICS_SUBJECTS.forEach((subj, subjIdx) => {
        const noiseActive = (seededFraction(sIdx * 97 + stIdx * 29 + subjIdx * 13) - 0.5) * 3.4;
        const noisePrevYear = (seededFraction(sIdx * 53 + stIdx * 19 + subjIdx * 41) - 0.5) * 3.6;

        // Intentional statistical outlier for Box Plot visibility on Math & Science
        let activeScore = clampScore(studentBase + noiseActive + (subjIdx === 4 ? 1.2 : 0));
        if (stIdx === 9 && subjIdx === 0) activeScore = 6.75; // Clear Tukey low outlier in Math
        if (stIdx === 7 && subjIdx === 1) activeScore = 7.25; // Clear Tukey low outlier in Science
        if (stIdx === 6 && subjIdx === 0) activeScore = 10.75; // Borderline Math
        if (stIdx === 16 && subjIdx === 0) activeScore = 8.5; // Failing Math

        // Previous term score for Most-Improved leaderboard (give bucketMod 8 & 5 strong growth)
        const growthShift =
          bucketMod === 8 ? -3.25 : bucketMod === 5 ? -2.25 : (seededFraction(stIdx * 17 + subjIdx) - 0.45) * 2.2;
        const prevTermScore = clampScore(activeScore + growthShift);

        // School internal score vs Coordinated Final Exam score
        const schoolInternalScore = activeScore;
        const finalNoise = (seededFraction(sIdx * 11 + stIdx * 37 + subjIdx * 23) - 0.5) * 1.1;
        const finalExamScore = clampScore(schoolInternalScore - subj.finalGapBias + finalNoise);

        const activeRec: SidaAnalyticsGradeRecord = {
          id: `${school.id}:sida-g:${DEFAULT_ACTIVE_ACADEMIC_YEAR_ID}:${st.id}:${subjIdx}`,
          complexId,
          schoolId: school.id,
          academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
          createdByUserId: 'user-principal',
          createdAtIso: nowIso,
          updatedAtIso: nowIso,
          studentId: st.id,
          studentName: st.fullName,
          classId: st.classId,
          className,
          gradeNumber: gradeNum,
          subject: subj.name,
          subjectCoefficient: subj.coefficient,
          score: activeScore,
          previousScore: prevTermScore,
          schoolInternalScore,
          finalExamScore,
          disciplineScore,
          term: 'term1',
        };
        sida_analytics_grades.push(activeRec);
        activeYearRecordsForSchool.push(activeRec);

        // Archived Year 1403-1404 record (slightly lower average in Math/Science, slightly higher in Social Studies for varied green/red YoY deltas!)
        const yearShift =
          subjIdx === 0 ? -1.15 : subjIdx === 1 ? -0.85 : subjIdx === 3 ? 0.65 : -0.45;
        const archivedScore = clampScore(activeScore + yearShift + noisePrevYear * 0.45);
        const archivedFinal = clampScore(archivedScore - subj.finalGapBias * 0.9 + finalNoise);

        sida_analytics_grades.push({
          id: `${school.id}:sida-g:${ARCHIVED_ACADEMIC_YEAR_ID}:${st.id}:${subjIdx}`,
          complexId,
          schoolId: school.id,
          academicYearId: ARCHIVED_ACADEMIC_YEAR_ID,
          createdByUserId: 'user-principal',
          createdAtIso: '2024-11-15T08:00:00.000Z',
          updatedAtIso: '2025-06-15T08:00:00.000Z',
          studentId: st.id,
          studentName: st.fullName,
          classId: st.classId,
          className,
          gradeNumber: gradeNum,
          subject: subj.name,
          subjectCoefficient: subj.coefficient,
          score: archivedScore,
          previousScore: clampScore(archivedScore - 0.5),
          schoolInternalScore: archivedScore,
          finalExamScore: archivedFinal,
          disciplineScore: clampScore(disciplineScore - 0.25),
          term: 'annual',
        });
      });
    }

    // 3. Seed 1 saved Smart Remedial Group & 1 saved Class Balancing Draft per school (active year)
    const mathRemedialGroups = buildSmartRemedialGroups(activeYearRecordsForSchool, {
      subject: 'ریاضی',
      passingThreshold: 10,
      borderlineUpper: 12,
      includeBorderline: true,
      maxCapacity: 8,
    });
    if (mathRemedialGroups.length > 0) {
      sida_remedial_groups.push({
        id: `${school.id}:rem-grp:math:${DEFAULT_ACTIVE_ACADEMIC_YEAR_ID}`,
        complexId,
        schoolId: school.id,
        academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
        createdByUserId: 'user-principal',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        subject: 'ریاضی',
        gradeLabel: 'همه پایه‌ها',
        passingThreshold: 10,
        borderlineUpper: 12,
        includeBorderline: true,
        maxCapacity: 8,
        groups: mathRemedialGroups,
        savedByName: school.principalName,
      });
    }

    const grade6Profiles = buildStudentBalancingProfiles(activeYearRecordsForSchool, 6);
    if (grade6Profiles.length >= 2) {
      const buckets = runSnakeDraftClassBalancing(grade6Profiles, 2, 'پایه ششم');
      sida_class_balancing_drafts.push({
        id: `${school.id}:bal-draft:g6:${DEFAULT_ACTIVE_ACADEMIC_YEAR_ID}`,
        complexId,
        schoolId: school.id,
        academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
        createdByUserId: 'user-principal',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        targetGrade: 6,
        targetYearCode: '1405-1406',
        classCount: 2,
        buckets,
        savedByName: school.principalName,
      });
    }
  }

  return {
    sida_appeal_windows,
    sida_remedial_groups,
    sida_class_balancing_drafts,
    sida_analytics_grades,
  };
}
