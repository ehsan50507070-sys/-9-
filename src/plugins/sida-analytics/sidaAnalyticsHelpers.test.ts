import test from 'node:test';
import assert from 'node:assert/strict';
import type { SidaAnalyticsGradeRecord, SidaAppealWindowConfig } from '../../types/domain';
import {
  buildMatrixReport,
  buildSmartRemedialGroups,
  buildStudentBalancingProfiles,
  buildSubjectLeaderboards,
  computeBalancedClassStats,
  computeBoxPlotStats,
  computeFailingAndBorderlineStudents,
  computeFinalExamDiscrepancy,
  computeGradeDistribution,
  computeYearlyComparison,
  evaluateAppealWindow,
  moveStudentBetweenBalancedClasses,
  parseJalaliDateTimeMs,
  runSnakeDraftClassBalancing,
} from './sidaAnalyticsHelpers';

function makeGrade(overrides: Partial<SidaAnalyticsGradeRecord>): SidaAnalyticsGradeRecord {
  return {
    id: overrides.id ?? 'g-1',
    complexId: 'complex-1',
    schoolId: 'school-1',
    academicYearId: 'ay-1404-1405',
    createdByUserId: 'admin',
    createdAtIso: '2025-11-01T08:00:00.000Z',
    updatedAtIso: '2025-11-01T08:00:00.000Z',
    studentId: 'st-1',
    studentName: 'امیرعلی احمدی',
    classId: 'cls-1',
    className: 'ششم الف',
    gradeNumber: 6,
    subject: 'ریاضی',
    subjectCoefficient: 3,
    score: 16,
    previousScore: 15,
    schoolInternalScore: 16,
    finalExamScore: 15.5,
    disciplineScore: 19,
    term: 'term1',
    ...overrides,
  };
}

test('Tab 1: evaluateAppealWindow handles active, waiting, ended, and manually_disabled accurately', () => {
  const baseCfg: SidaAppealWindowConfig = {
    id: 'win-1',
    complexId: 'complex-1',
    schoolId: 'school-1',
    academicYearId: 'ay-1404-1405',
    createdByUserId: 'u-1',
    createdAtIso: '2025-10-01T00:00:00.000Z',
    updatedAtIso: '2025-10-01T00:00:00.000Z',
    term: 'term1',
    termLabelFa: 'نوبت اول',
    masterEnabled: true,
    useSchedule: true,
    startDateJalali: '1404/10/10',
    startTime: '08:00',
    endDateJalali: '1404/10/20',
    endTime: '20:00',
    updatedByName: 'مدیر مدرسه',
  };

  const beforeMs = parseJalaliDateTimeMs('1404/10/09', '12:00')!;
  const duringMs = parseJalaliDateTimeMs('1404/10/15', '10:00')!;
  const afterMs = parseJalaliDateTimeMs('1404/10/21', '09:00')!;

  const waitEval = evaluateAppealWindow(baseCfg, beforeMs);
  assert.equal(waitEval.status, 'waiting_to_start');
  assert.equal(waitEval.canSubmit, false);

  const activeEval = evaluateAppealWindow(baseCfg, duringMs);
  assert.equal(activeEval.status, 'active_in_window');
  assert.equal(activeEval.canSubmit, true);

  const endedEval = evaluateAppealWindow(baseCfg, afterMs);
  assert.equal(endedEval.status, 'ended');
  assert.equal(endedEval.canSubmit, false);

  const disabledEval = evaluateAppealWindow({ ...baseCfg, masterEnabled: false }, duringMs);
  assert.equal(disabledEval.status, 'manually_disabled');
  assert.equal(disabledEval.canSubmit, false);
});

test('Tab 2: failing & borderline report + smart remedial grouping respects max capacity', () => {
  const records: SidaAnalyticsGradeRecord[] = [
    makeGrade({ id: '1', studentId: 's1', studentName: 'الف', subject: 'ریاضی', score: 7.5 }),
    makeGrade({ id: '2', studentId: 's2', studentName: 'ب', subject: 'ریاضی', score: 8.5 }),
    makeGrade({ id: '3', studentId: 's3', studentName: 'ج', subject: 'ریاضی', score: 9.5 }),
    makeGrade({ id: '4', studentId: 's4', studentName: 'د', subject: 'ریاضی', score: 11.0 }),
    makeGrade({ id: '5', studentId: 's5', studentName: 'هـ', subject: 'ریاضی', score: 11.5 }),
    makeGrade({ id: '6', studentId: 's6', studentName: 'و', subject: 'ریاضی', score: 18.0 }),
  ];

  const rows = computeFailingAndBorderlineStudents(records, {
    passingThreshold: 10,
    borderlineUpper: 12,
    includeBorderline: true,
  });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].studentId, 's1');
  assert.equal(rows[0].failingCount, 1);

  const groups = buildSmartRemedialGroups(records, {
    subject: 'ریاضی',
    passingThreshold: 10,
    borderlineUpper: 12,
    includeBorderline: true,
    maxCapacity: 3,
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].studentIds.length, 3);
  assert.equal(groups[1].studentIds.length, 2);
  assert.ok(groups[0].averageScore < groups[1].averageScore);
});

test('Tab 3: Snake Draft balances class GPA, top performers, and support students + manual move recalculates stats', () => {
  const scores = [19.8, 19.2, 18.5, 17.4, 16.2, 15.0, 13.8, 11.2, 9.5];
  const records = scores.map((sc, idx) =>
    makeGrade({
      id: `b-${idx}`,
      studentId: `st-${idx}`,
      studentName: `دانش‌آموز ${idx + 1}`,
      score: sc,
      disciplineScore: 18 + (idx % 3),
    })
  );

  const profiles = buildStudentBalancingProfiles(records, 6);
  const buckets = runSnakeDraftClassBalancing(profiles, 3, 'پایه ششم');
  assert.equal(buckets.length, 3);
  assert.equal(buckets[0].studentIds.length, 3);
  assert.equal(buckets[1].studentIds.length, 3);
  assert.equal(buckets[2].studentIds.length, 3);

  const map = new Map(profiles.map((p) => [p.studentId, p]));
  const stats = computeBalancedClassStats(buckets, map);
  assert.ok(stats.meanSpread < 1.2, `Expected balanced spread < 1.2, got ${stats.meanSpread}`);
  assert.ok(stats.parityIndexPercent > 75);

  const moved = moveStudentBetweenBalancedClasses(buckets, 'st-0', buckets[2].id);
  assert.equal(moved[0].studentIds.length, 2);
  assert.equal(moved[2].studentIds.length, 4);
});

test('Tab 4: Box Plot quartiles/outliers & 5-band Histogram compute exact statistics', () => {
  const scores = [5.0, 14.0, 15.0, 15.5, 16.0, 16.5, 17.0, 17.5, 18.0];
  const box = computeBoxPlotStats([{ key: 'math', label: 'ریاضی', scores }]);
  assert.equal(box.length, 1);
  assert.equal(box[0].median, 16);
  assert.ok(box[0].outliers.includes(5), 'Score 5.0 must be detected as a Tukey outlier');
  assert.ok(box[0].q1 < box[0].median && box[0].median < box[0].q3);

  const dist = computeGradeDistribution([8, 11, 13, 16, 19, 19.5]);
  assert.equal(dist.totalCount, 6);
  assert.equal(dist.bands[0].count, 1); // <10
  assert.equal(dist.bands[1].count, 1); // 10..12
  assert.equal(dist.bands[2].count, 1); // 12..15
  assert.equal(dist.bands[3].count, 1); // 15..18
  assert.equal(dist.bands[4].count, 2); // 18..20
});

test('Tab 5: Matrix computes weighted GPA, class/grade ranks & subject leaderboards', () => {
  const records = [
    makeGrade({ id: 'm1', studentId: 'a', studentName: 'آراد', classId: 'c1', subject: 'ریاضی', subjectCoefficient: 3, score: 19, previousScore: 15 }),
    makeGrade({ id: 'm2', studentId: 'a', studentName: 'آراد', classId: 'c1', subject: 'علوم تجربی', subjectCoefficient: 2, score: 18, previousScore: 17 }),
    makeGrade({ id: 'm3', studentId: 'b', studentName: 'کیان', classId: 'c1', subject: 'ریاضی', subjectCoefficient: 3, score: 14, previousScore: 13 }),
    makeGrade({ id: 'm4', studentId: 'b', studentName: 'کیان', classId: 'c1', subject: 'علوم تجربی', subjectCoefficient: 2, score: 15, previousScore: 14 }),
  ];

  const matrix = buildMatrixReport(records, 10);
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.rows[0].studentId, 'a');
  assert.equal(matrix.rows[0].classRank, 1);
  assert.equal(matrix.rows[0].gradeRank, 1);
  assert.equal(matrix.rows[0].weightedGpa, 18.6);
  assert.equal(matrix.rows[1].classRank, 2);

  const lb = buildSubjectLeaderboards(records);
  const mathLb = lb.find((x) => x.subject === 'ریاضی');
  assert.ok(mathLb);
  assert.equal(mathLb.topStudents[0].studentId, 'a');
  assert.equal(mathLb.mostImproved[0].growth, 4);
});

test('Tab 6: Year-over-Year comparison & Final Exam discrepancy flag over/underestimation', () => {
  const prev = [
    makeGrade({ academicYearId: 'ay-1403-1404', subject: 'ریاضی', score: 14 }),
    makeGrade({ academicYearId: 'ay-1403-1404', subject: 'ریاضی', score: 9 }),
  ];
  const curr = [
    makeGrade({ academicYearId: 'ay-1404-1405', subject: 'ریاضی', score: 17, schoolInternalScore: 18.5, finalExamScore: 15.0 }),
    makeGrade({ academicYearId: 'ay-1404-1405', subject: 'علوم تجربی', score: 16, schoolInternalScore: 14.0, finalExamScore: 16.5 }),
  ];

  const yoy = computeYearlyComparison(prev, curr);
  assert.ok(yoy.deltaSchoolAvg > 0);
  assert.equal(yoy.prevPassRate, 50);
  assert.equal(yoy.currPassRate, 100);

  const finalCheck = computeFinalExamDiscrepancy(curr, 1.5);
  const mathFlag = finalCheck.subjects.find((s) => s.subject === 'ریاضی');
  const sciFlag = finalCheck.subjects.find((s) => s.subject === 'علوم تجربی');
  assert.equal(mathFlag?.flag, 'overestimated');
  assert.equal(sciFlag?.flag, 'underestimated');
});
