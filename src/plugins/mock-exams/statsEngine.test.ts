import test from 'node:test';
import assert from 'node:assert/strict';
import type { MockExam, MockExamAttempt, School, Student } from '../../types/domain';
import {
  assignTieAwareRanks,
  buildExamCohortReport,
  calculateOutOfTen,
  calculateSubjectPercentage,
  calculateTarazFromZ,
  calculateWeightedTotalTaraz,
  formatMockReportCardForMessenger,
  getDeterministicOptionOrder,
  parseBulkOmrCsv,
} from './statsEngine';

test('negative marking formulas compute exact percentages including negative scores', () => {
  // 6 correct, 3 wrong out of 10 with 3:1 negative marking => (18 - 3) / 30 = 50%
  assert.equal(calculateSubjectPercentage(6, 3, 10, 'three_to_one'), 50);
  // 0 correct, 9 wrong out of 10 with 3:1 => -9 / 30 = -30%
  assert.equal(calculateSubjectPercentage(0, 9, 10, 'three_to_one'), -30);
  // 6 correct, 4 wrong out of 10 with 4:1 => (24 - 4) / 40 = 50%
  assert.equal(calculateSubjectPercentage(6, 4, 10, 'four_to_one'), 50);
  // No negative marking => 6 / 10 = 60%
  assert.equal(calculateSubjectPercentage(6, 4, 10, 'none'), 60);
});

test('Taraz Z-score clamping, weighted total Taraz, and Out-of-10 scale work accurately', () => {
  assert.equal(calculateTarazFromZ(50, 50, 0), 5500);
  assert.equal(calculateTarazFromZ(70, 50, 10), 7500);
  assert.equal(calculateTarazFromZ(200, 10, 5), 11000);
  assert.equal(calculateTarazFromZ(-200, 50, 5), 1000);

  const weighted = calculateWeightedTotalTaraz([
    { taraz: 7000, coefficient: 4 },
    { taraz: 5000, coefficient: 2 },
  ]);
  assert.equal(weighted, Math.round((7000 * 4 + 5000 * 2) / 6));

  assert.equal(calculateOutOfTen(76), 8);
  assert.equal(calculateOutOfTen(-25), 0);
  assert.equal(calculateOutOfTen(100), 10);
});

test('tie-aware ranking assigns 1, 1, 3 cleanly', () => {
  const items = [{ id: 'a', s: 7000 }, { id: 'b', s: 7000 }, { id: 'c', s: 6200 }];
  const ranks = assignTieAwareRanks(items, (x) => x.s);
  assert.equal(ranks.get(items[0]), 1);
  assert.equal(ranks.get(items[1]), 1);
  assert.equal(ranks.get(items[2]), 3);
});

test('cohort report calculates ranks, topic map, 3-school stats, and Trap Question detector (>=35% distractor)', () => {
  const exam: MockExam = {
    id: 'ex-1',
    complexId: 'complex-1',
    schoolId: 'global',
    academicYearId: 'ay-1404-1405',
    title: 'آزمون تستی نمونه',
    stageNumber: 2,
    stageLabelFa: 'مرحله ۲',
    examDateJalali: '1404/09/14',
    scope: 'complex',
    track: 'math_physics',
    negativeMarking: 'three_to_one',
    mode: 'online_full',
    shuffleOptions: false,
    status: 'published',
    booklets: [{ id: 'b1', title: 'دفترچه ۱', durationMinutes: 45, orderIndex: 0 }],
    subjects: [
      { id: 'sub-math', bookletId: 'b1', subjectName: 'ریاضی', questionStart: 1, questionEnd: 2, coefficient: 4 },
      { id: 'sub-sci', bookletId: 'b1', subjectName: 'علوم', questionStart: 3, questionEnd: 4, coefficient: 2 },
    ],
    questions: [
      { questionNumber: 1, subjectId: 'sub-math', correctOption: 1, topic: 'مشتق', difficulty: 'medium' },
      { questionNumber: 2, subjectId: 'sub-math', correctOption: 2, topic: 'حد', difficulty: 'hard' }, // Trap: 3 of 4 pick opt 3 (75%!)
      { questionNumber: 3, subjectId: 'sub-sci', correctOption: 3, topic: 'ژنتیک', difficulty: 'easy' },
      { questionNumber: 4, subjectId: 'sub-sci', correctOption: 4, topic: 'ژنتیک', difficulty: 'medium' },
    ],
    createdByUserId: 'admin',
    createdAtIso: '2025-11-01T00:00:00Z',
    updatedAtIso: '2025-11-01T00:00:00Z',
  };

  const makeAttempt = (
    id: string,
    schoolId: string,
    classId: string,
    answers: Record<number, 1 | 2 | 3 | 4 | null>
  ): MockExamAttempt => ({
    id,
    complexId: 'complex-1',
    schoolId,
    academicYearId: 'ay-1404-1405',
    examId: 'ex-1',
    studentId: id,
    studentName: `دانش‌آموز ${id}`,
    classId,
    className: `کلاس ${classId}`,
    entryMethod: 'online',
    status: 'submitted',
    answers,
    flaggedQuestions: [],
    eliminatedOptions: {},
    tabSwitchCount: 0,
    activeBookletIndex: 0,
    startedAtIso: '2025-11-01T08:00:00Z',
    submittedAtJalali: '1404/09/14',
    createdByUserId: id,
    createdAtIso: '2025-11-01T08:00:00Z',
    updatedAtIso: '2025-11-01T08:30:00Z',
  });

  const attempts = [
    makeAttempt('st-1', 'school-1', 'c1', { 1: 1, 2: 2, 3: 3, 4: 4 }), // 100% all
    makeAttempt('st-2', 'school-1', 'c1', { 1: 1, 2: 3, 3: 3, 4: null }), // falls into trap on Q2
    makeAttempt('st-3', 'school-2', 'c2', { 1: 4, 2: 3, 3: 3, 4: 4 }), // falls into trap on Q2
    makeAttempt('st-4', 'school-2', 'c2', { 1: null, 2: 3, 3: 1, 4: 1 }), // falls into trap on Q2
  ];

  const schools = [
    { id: 'school-1', name: 'مدرسه ۱' },
    { id: 'school-2', name: 'مدرسه ۲' },
  ] as School[];

  const report = buildExamCohortReport({
    exam,
    attempts,
    schools,
    previousStageTarazByStudent: { 'st-1': 6100 },
  });

  assert.equal(report.students.length, 4);
  assert.equal(report.students[0].studentId, 'st-1');
  assert.equal(report.students[0].complexRank, 1);
  assert.equal(report.students[0].schoolRank, 1);
  assert.ok(report.students[0].tarazDeltaFromPrev !== null);

  // Q2 should be flagged as Trap Question because 3/4 (75% >= 35%) picked wrong option 3
  const q2 = report.itemAnalysis.find((q) => q.questionNumber === 2);
  assert.ok(q2);
  assert.equal(q2.isTrapQuestion, true);
  assert.equal(q2.trapOption, 3);
  assert.equal(q2.trapOptionPercent, 75);

  assert.equal(report.schoolComparison.length, 2);

  // Single-column messenger output contains Persian digits and exam title
  const msg = formatMockReportCardForMessenger(report.students[0], exam, 'مدرسه ۱');
  assert.ok(msg.includes('آزمون تستی نمونه'));
  assert.ok(msg.includes('رتبه در کل مجموعه'));
});

test('option shuffling is deterministic when enabled and identity when disabled', () => {
  const unshuffled = getDeterministicOptionOrder('ex-1', 'st-1', 1, false);
  assert.deepEqual(unshuffled, [1, 2, 3, 4]);
  const s1 = getDeterministicOptionOrder('ex-1', 'st-1', 1, true);
  const s2 = getDeterministicOptionOrder('ex-1', 'st-1', 1, true);
  assert.deepEqual(s1, s2);
  assert.deepEqual([...s1].sort(), [1, 2, 3, 4]);
});

test('bulk CSV OMR parser matches national ID and Persian digits cleanly', () => {
  const students = [
    { id: 's1', fullName: 'آراد احمدی', nationalId: '0012345678', classId: 'c1', schoolId: 'school-1' },
  ] as Student[];

  const parsed = parseBulkOmrCsv(
    'کد ملی,س۱,س۲,س۳\n۰۰۱۲۳۴۵۶۷۸, ۱, ۰, ۴',
    students,
    [1, 2, 3]
  );

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].matchedStudent?.id, 's1');
  assert.equal(parsed[0].answers[1], 1);
  assert.equal(parsed[0].answers[2], null);
  assert.equal(parsed[0].answers[3], 4);
  assert.equal(parsed[0].answeredCount, 2);
});
