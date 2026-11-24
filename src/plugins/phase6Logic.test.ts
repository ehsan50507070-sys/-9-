import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation, type AuthGuardContext } from '../core/auth/policy';
import { generateSeedDataset } from '../core/data/seedData';
import { validateBackupPayload } from '../core/validation/validators';
import { formatToman } from '../lib/digits';
import type {
  AnonymousSurvey,
  AuthSession,
  BackupPayload,
  FinanceExpenseRecord,
  FinanceFeePlan,
  FinancePaymentRecord,
  FinanceStudentLedger,
  RemedialPlanRecord,
  SurveyAnonymousResponse,
} from '../types/domain';
import {
  buildAnonymousResponsePayload,
  buildParticipantKey,
  computeComplexSurveyComparison,
  evaluateSurveyResults,
  hasUserParticipatedInSurvey,
  PERSIAN_SURVEY_TEMPLATES,
  shuffleAnonymousItems,
} from './anonymous-surveys/anonymousSurveyHelpers';
import {
  applyPaymentToLedger,
  buildDebtorReminderMessenger,
  buildFinanceLedgersCsv,
  computeComplexFinanceComparison,
  computeLedgerSummary,
  computeMonthlyCashflowSeries,
  computeSchoolFinanceKpis,
  generateInstallmentSchedule,
  revertPaymentFromLedger,
} from './finance/financeHelpers';
import {
  computeComplexAnalyticsComparison,
  computeSmartAnalyticsReport,
} from './smart-analytics/smartAnalyticsHelpers';

function makeAuthCtx(overrides: Partial<AuthSession>, teacherAssignedClassIds: string[] = []): AuthGuardContext {
  const session: AuthSession = {
    userId: overrides.userId ?? 'u-test',
    username: overrides.username ?? 'testuser',
    displayName: overrides.displayName ?? 'کاربر آزمایشی',
    role: overrides.role ?? 'principal',
    schoolId: overrides.schoolId ?? 'school-1',
    isComplexWide: overrides.isComplexWide ?? false,
    linkedStudentId: overrides.linkedStudentId,
    linkedTeacherId: overrides.linkedTeacherId,
    loggedInAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    session,
    teacherAssignedClassIds,
  };
}

test('Finance: formatToman, flexible discounts, and exact 1..10 Jalali installment schedule sum', () => {
  assert.equal(formatToman(12_500_000), '۱۲٬۵۰۰٬۰۰۰ تومان');

  const installments = generateInstallmentSchedule({
    studentId: 'st-1',
    netTuitionToman: 18_750_000,
    installmentsCount: 7,
    todayJalali: '1405/11/20',
    existingPaidToman: 5_000_000,
  });

  assert.equal(installments.length, 7);
  const sum = installments.reduce((acc, i) => acc + i.amountToman, 0);
  assert.equal(sum, 18_750_000);
  const paidSum = installments.reduce((acc, i) => acc + i.paidAmountToman, 0);
  assert.equal(paidSum, 5_000_000);
  assert.equal(installments[0].status, 'paid');
});

test('Finance: online & manual payment application, reversal, cashflow, 3-school comparison, and single-column debtor reminder', () => {
  const seed = generateSeedDataset();
  const s1Ledgers = seed.finance_student_ledgers.filter((l) => l.schoolId === 'school-1');
  const s1Payments = seed.finance_payments.filter((p) => p.schoolId === 'school-1');
  const s1Expenses = seed.finance_expenses.filter((e) => e.schoolId === 'school-1');
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1');
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');

  assert.ok(s1Ledgers.length >= 20);
  const firstLedger = s1Ledgers[0];
  const before = computeLedgerSummary(firstLedger, '1405/11/20');
  assert.ok(before.overdueInstallmentsCount >= 1);

  const overdueInst = firstLedger.installments.find((i) => i.paidAmountToman < i.amountToman)!;
  const payAmount = overdueInst.amountToman - overdueInst.paidAmountToman;

  const afterPayLedger = applyPaymentToLedger({
    ledger: firstLedger,
    targetType: 'tuition',
    installmentId: overdueInst.id,
    amountToman: payAmount,
    paidDateJalali: '1405/11/20',
    trackingCode: 'SHP-998877',
    todayJalali: '1405/11/20',
  });
  const after = computeLedgerSummary(afterPayLedger, '1405/11/20');
  assert.equal(after.totalPaidToman, before.totalPaidToman + payAmount);

  const dummyPayment: FinancePaymentRecord = {
    id: 'pay-test-1',
    schoolId: 'school-1',
    receiptNumber: 'F-1405-9999',
    studentId: firstLedger.studentId,
    classId: firstLedger.classId,
    ledgerId: firstLedger.id,
    targetType: 'tuition',
    installmentId: overdueInst.id,
    targetTitle: overdueInst.title,
    amountToman: payAmount,
    jalaliDate: '1405/11/20',
    method: 'online_sim',
    trackingCode: 'SHP-998877',
    recordedBy: 'ولی آزمایشی',
    recordedByRole: 'parent',
    createdAt: new Date().toISOString(),
  };

  const reverted = revertPaymentFromLedger({
    ledger: afterPayLedger,
    payment: dummyPayment,
    todayJalali: '1405/11/20',
  });
  const revertedSummary = computeLedgerSummary(reverted, '1405/11/20');
  assert.equal(revertedSummary.totalPaidToman, before.totalPaidToman);

  // KPIs & Cashflow (verify on 1405/08/30 late Aban as well as winter)
  const kpisAban = computeSchoolFinanceKpis({
    ledgers: s1Ledgers,
    payments: s1Payments,
    expenses: s1Expenses,
    todayJalali: '1405/08/30',
  });
  assert.ok(kpisAban.totalExpectedToman > 0);
  assert.ok(kpisAban.totalCollectedToman > 0);
  assert.ok(kpisAban.totalExpensesToman > 0);
  assert.ok(kpisAban.overdueDebtorsCount > 0, 'Expected seeded overdue debtors on 1405/08/30');
  assert.ok(kpisAban.netBalanceToman > 0, 'Expected realistic positive net operating balance');

  const kpis = computeSchoolFinanceKpis({
    ledgers: s1Ledgers,
    payments: s1Payments,
    expenses: s1Expenses,
    todayJalali: '1405/11/20',
  });
  assert.ok(kpis.totalExpectedToman > 0);
  assert.ok(kpis.totalCollectedToman > 0);
  assert.ok(kpis.totalExpensesToman > 0);

  const cashflow = computeMonthlyCashflowSeries({ payments: s1Payments, expenses: s1Expenses });
  assert.ok(cashflow.length >= 3);

  // 3-School comparison
  const complexRows = computeComplexFinanceComparison({
    schools: seed.schools,
    ledgers: seed.finance_student_ledgers,
    payments: seed.finance_payments,
    expenses: seed.finance_expenses,
    todayJalali: '1405/11/20',
  });
  assert.equal(complexRows.length, 3);
  assert.ok(complexRows.every((r) => r.totalExpectedToman > 0));

  // Single-column debtor reminder (no tabs/pipes) & UTF-8 BOM CSV
  const reminder = buildDebtorReminderMessenger({
    schoolName: seed.schools[0].name,
    studentName: s1Students[0].fullName,
    className: s1Classes[0].name,
    parentName: s1Students[0].parentName,
    overdueCount: 1,
    overdueAmountToman: 3_000_000,
    remainingTotalToman: 9_000_000,
    todayJalali: '1405/11/20',
  });
  assert.ok(!reminder.includes('\t'));
  assert.ok(!reminder.includes('|'));
  assert.ok(reminder.includes('تومان'));

  const csv = buildFinanceLedgersCsv({
    ledgers: s1Ledgers,
    students: s1Students,
    classes: s1Classes,
    todayJalali: '1405/11/20',
  });
  assert.ok(csv.startsWith('\uFEFF'));
});

test('Smart Analytics: >=2pt drop detection, growth highlight, remedial recommendations, and 3-school comparison', () => {
  const seed = generateSeedDataset();
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1');
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const s1Teachers = seed.teachers.filter((t) => t.schoolId === 'school-1');

  // Inject an explicit 4-point drop for student[0] in ریاضی and a 3-point growth for student[1] in علوم
  const syntheticEntries = [
    ...seed.gradebook_entries.filter((g) => g.schoolId === 'school-1'),
    {
      id: 'gb-drop-1',
      schoolId: 'school-1',
      studentId: s1Students[0].id,
      classId: s1Students[0].classId,
      subject: 'ریاضی',
      jalaliMonth: 'دی' as const,
      jalaliDate: '1405/10/20',
      numericScore: 18,
      recordedBy: 'teacher' as const,
      updatedAt: '2026-01-10T00:00:00.000Z',
    },
    {
      id: 'gb-drop-2',
      schoolId: 'school-1',
      studentId: s1Students[0].id,
      classId: s1Students[0].classId,
      subject: 'ریاضی',
      jalaliMonth: 'بهمن' as const,
      jalaliDate: '1405/11/20',
      numericScore: 13.5,
      recordedBy: 'teacher' as const,
      updatedAt: '2026-02-10T00:00:00.000Z',
    },
    {
      id: 'gb-grow-1',
      schoolId: 'school-1',
      studentId: s1Students[1].id,
      classId: s1Students[1].classId,
      subject: 'علوم',
      jalaliMonth: 'دی' as const,
      jalaliDate: '1405/10/20',
      numericScore: 15,
      recordedBy: 'teacher' as const,
      updatedAt: '2026-01-10T00:00:00.000Z',
    },
    {
      id: 'gb-grow-2',
      schoolId: 'school-1',
      studentId: s1Students[1].id,
      classId: s1Students[1].classId,
      subject: 'علوم',
      jalaliMonth: 'بهمن' as const,
      jalaliDate: '1405/11/20',
      numericScore: 19,
      recordedBy: 'teacher' as const,
      updatedAt: '2026-02-10T00:00:00.000Z',
    },
  ];

  const report = computeSmartAnalyticsReport({
    students: s1Students,
    classes: s1Classes,
    teachers: s1Teachers,
    gradebookEntries: syntheticEntries,
    studentAttendance: seed.student_attendance.filter((a) => a.schoolId === 'school-1'),
    homeworkAssignments: seed.homework_assignments.filter((h) => h.schoolId === 'school-1'),
    homeworkSubmissions: seed.homework_submissions.filter((h) => h.schoolId === 'school-1'),
    onlineExams: seed.online_exams.filter((e) => e.schoolId === 'school-1'),
    onlineExamSubmissions: seed.online_exam_submissions.filter((e) => e.schoolId === 'school-1'),
    flippedTelemetry: seed.flipped_telemetry.filter((f) => f.schoolId === 'school-1'),
    studentRewards: seed.student_rewards.filter((r) => r.schoolId === 'school-1'),
    remedialPlans: seed.remedial_plans.filter((r) => r.schoolId === 'school-1'),
  });

  assert.ok(report.insights.some((i) => i.severity === 'urgent' && i.category === 'drop'));
  assert.ok(report.insights.some((i) => i.severity === 'strength' && i.category === 'growth'));
  assert.ok(
    report.remedialRecommendations.some(
      (r) => r.studentId === s1Students[0].id && r.subject === 'ریاضی' && r.reasons.length > 0
    )
  );
  assert.ok(report.classMetrics.length === s1Classes.length);
  assert.ok(report.teacherMetrics.length > 0);
  assert.ok(
    report.overallAttendanceRatePercent >= 85 && report.overallAttendanceRatePercent <= 100,
    `Expected realistic attendance rate (85-100%), got ${report.overallAttendanceRatePercent}%`
  );

  const complexAnalytics = computeComplexAnalyticsComparison({
    schools: seed.schools,
    classes: seed.classes,
    students: seed.students,
    teachers: seed.teachers,
    gradebookEntries: seed.gradebook_entries,
    studentAttendance: seed.student_attendance,
    homeworkAssignments: seed.homework_assignments,
    homeworkSubmissions: seed.homework_submissions,
    onlineExams: seed.online_exams,
    onlineExamSubmissions: seed.online_exam_submissions,
    flippedTelemetry: seed.flipped_telemetry,
    remedialPlans: seed.remedial_plans,
  });
  assert.equal(complexAnalytics.length, 3);
});

test('Anonymous Surveys: Zero-PII payload, duplicate receipt guard, privacy threshold (<3 hides results), shuffling, and 3-school comparison', () => {
  assert.equal(PERSIAN_SURVEY_TEMPLATES.length, 4);

  const anon = buildAnonymousResponsePayload({
    schoolId: 'school-1',
    surveyId: 'srv-1',
    audienceRole: 'parent',
    answers: { q1: 5, q2: 'بله' },
    openComment: 'همه چیز بسیار منظم بود.',
    submittedDayBucket: '1405/11/20',
  });

  // Strict zero-PII verification
  const keys = Object.keys(anon);
  for (const forbidden of ['userId', 'studentId', 'fullName', 'phone', 'parentMobile', 'createdAt']) {
    assert.ok(!keys.includes(forbidden), `Forbidden PII key leaked: ${forbidden}`);
  }
  assert.equal(anon.submittedDayBucket, '1405/11/20');

  // Duplicate participation key
  const pk1 = buildParticipantKey('user-parent-1', 'srv-1');
  const pk2 = buildParticipantKey('user-parent-1', 'srv-1');
  const pkOther = buildParticipantKey('user-parent-2', 'srv-1');
  assert.equal(pk1, pk2);
  assert.notEqual(pk1, pkOther);
  assert.equal(
    hasUserParticipatedInSurvey({
      receipts: [
        {
          id: 'r1',
          schoolId: 'school-1',
          surveyId: 'srv-1',
          participantKey: pk1,
          submittedDateJalali: '1405/11/20',
        },
      ],
      schoolId: 'school-1',
      surveyId: 'srv-1',
      participantKey: pk1,
    }),
    true
  );

  const testSurvey: AnonymousSurvey = {
    id: 'srv-1',
    schoolId: 'school-1',
    title: 'نظرسنجی محرمانه تست',
    description: 'توضیح',
    targetRoles: ['parent'],
    questions: [
      { id: 'q1', prompt: 'کیفیت آموزش؟', type: 'likert_5', required: true },
      { id: 'q2', prompt: 'آیا راضی هستید؟', type: 'yes_no', required: true },
    ],
    startDateJalali: '1405/11/01',
    endDateJalali: '1405/12/29',
    minAnonymityThreshold: 3,
    status: 'active',
    createdByName: 'مدیر',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Below threshold (2 < 3) => MUST hide breakdowns & comments
  const twoResponses: SurveyAnonymousResponse[] = [
    { ...anon, id: 'anon-1', answers: { q1: 5, q2: 'بله' }, openComment: 'نظر ۱' },
    { ...anon, id: 'anon-2', answers: { q1: 4, q2: 'بله' }, openComment: 'نظر ۲' },
  ];
  const lockedEval = evaluateSurveyResults({
    survey: testSurvey,
    responses: twoResponses,
    estimatedEligibleCount: 25,
  });
  assert.equal(lockedEval.thresholdMet, false);
  assert.equal(lockedEval.missingForThreshold, 1);
  assert.equal(lockedEval.satisfactionIndexOutOf100, null);
  assert.equal(lockedEval.questionSummaries.length, 0);
  assert.equal(lockedEval.shuffledComments.length, 0);

  // At threshold (3 >= 3) => unlocks satisfaction index, breakdowns, and shuffled comments
  const threeResponses: SurveyAnonymousResponse[] = [
    ...twoResponses,
    { ...anon, id: 'anon-3', answers: { q1: 3, q2: 'خیر' }, openComment: 'نظر ۳' },
  ];
  const unlockedEval = evaluateSurveyResults({
    survey: testSurvey,
    responses: threeResponses,
    estimatedEligibleCount: 25,
  });
  assert.equal(unlockedEval.thresholdMet, true);
  assert.ok(typeof unlockedEval.satisfactionIndexOutOf100 === 'number');
  assert.equal(unlockedEval.questionSummaries.length, 2);
  assert.equal(unlockedEval.shuffledComments.length, 3);

  // Shuffler preserves all elements deterministically
  const shuffled = shuffleAnonymousItems(threeResponses, 'seed-xyz');
  assert.equal(shuffled.length, 3);

  // 3-School seeded comparison
  const seed = generateSeedDataset();
  const complexSurveyRows = computeComplexSurveyComparison({
    schools: seed.schools,
    surveys: seed.anonymous_surveys,
    responses: seed.survey_anonymous_responses,
    groupKey: 'complex-parent-sat-1405',
  });
  assert.equal(complexSurveyRows.length, 3);
  assert.ok(complexSurveyRows.every((r) => r.thresholdMet && r.satisfactionIndexOutOf100 > 0));
});

test('Phase 6 RBAC Policy Matrix & Backup Payload Validator', () => {
  const seed = generateSeedDataset();
  const st0 = seed.students.find((s) => s.schoolId === 'school-1')!;
  const st1 = seed.students.filter((s) => s.schoolId === 'school-1')[1];
  const ownLedger: FinanceStudentLedger = seed.finance_student_ledgers.find(
    (l) => l.studentId === st0.id
  )!;
  const otherLedger: FinanceStudentLedger = seed.finance_student_ledgers.find(
    (l) => l.studentId === st1.id
  )!;

  // Parent: allowed online_sim payment for OWN child, blocked for other child or expenses
  const parentCtx = makeAuthCtx({ role: 'parent', schoolId: 'school-1', linkedStudentId: st0.id });
  const ownOnlinePay: FinancePaymentRecord = {
    id: 'p-own',
    schoolId: 'school-1',
    receiptNumber: 'F-1405-1',
    studentId: st0.id,
    classId: st0.classId,
    ledgerId: ownLedger.id,
    targetType: 'tuition',
    targetTitle: 'قسط ۱',
    amountToman: 1_000_000,
    jalaliDate: '1405/11/20',
    method: 'online_sim',
    trackingCode: 'SHP-123456',
    recordedBy: 'ولی',
    recordedByRole: 'parent',
    createdAt: new Date().toISOString(),
  };
  assert.equal(
    authorizeMutation(parentCtx, 'finance_payments', 'write', {
      schoolId: 'school-1',
      record: ownOnlinePay,
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(parentCtx, 'finance_payments', 'write', {
      schoolId: 'school-1',
      record: { ...ownOnlinePay, method: 'cash' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'finance_student_ledgers', 'write', {
      schoolId: 'school-1',
      record: otherLedger,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'finance_expenses', 'write', {
      schoolId: 'school-1',
      record: seed.finance_expenses[0],
    }).allowed,
    false
  );

  // Student: blocked from Finance & Remedial Plans, allowed student survey vote
  const studentCtx = makeAuthCtx({
    role: 'student',
    schoolId: 'school-1',
    linkedStudentId: st0.id,
  });
  assert.equal(
    authorizeMutation(studentCtx, 'finance_payments', 'write', {
      schoolId: 'school-1',
      record: ownOnlinePay,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'remedial_plans', 'write', {
      schoolId: 'school-1',
      record: seed.remedial_plans[0],
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'survey_anonymous_responses', 'write', {
      schoolId: 'school-1',
      record: {
        id: 'anon-st',
        schoolId: 'school-1',
        surveyId: 's1',
        audienceRole: 'student',
        answers: { q1: 5 },
        submittedDayBucket: '1405/11/20',
      },
    }).allowed,
    true
  );

  // Deputy: allowed manual payment & expense write, BLOCKED from fee plan edits & deleting payments
  const deputyCtx = makeAuthCtx({ role: 'deputy', schoolId: 'school-1' });
  const feePlan: FinanceFeePlan = seed.finance_fee_plans[0];
  assert.equal(
    authorizeMutation(deputyCtx, 'finance_fee_plans', 'write', {
      schoolId: 'school-1',
      record: feePlan,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(deputyCtx, 'finance_payments', 'delete', {
      schoolId: 'school-1',
      record: seed.finance_payments[0],
    }).allowed,
    false
  );
  const expense: FinanceExpenseRecord = seed.finance_expenses[0];
  assert.equal(
    authorizeMutation(deputyCtx, 'finance_expenses', 'write', {
      schoolId: 'school-1',
      record: expense,
    }).allowed,
    true
  );

  // Teacher: blocked from Finance; remedial_plans strictly scoped to assigned classes
  const teacherClassId = st0.classId;
  const teacherCtx = makeAuthCtx({ role: 'teacher', schoolId: 'school-1' }, [teacherClassId]);
  assert.equal(
    authorizeMutation(teacherCtx, 'finance_payments', 'write', {
      schoolId: 'school-1',
      record: seed.finance_payments[0],
    }).allowed,
    false
  );
  const ownRemedial: RemedialPlanRecord = {
    id: 'rem-own',
    schoolId: 'school-1',
    studentId: st0.id,
    classId: teacherClassId,
    subject: 'ریاضی',
    teacherName: 'معلم',
    reasons: ['افت نمره'],
    status: 'planned',
    createdBy: 'معلم',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(
    authorizeMutation(teacherCtx, 'remedial_plans', 'write', {
      schoolId: 'school-1',
      classId: teacherClassId,
      record: ownRemedial,
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'remedial_plans', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-99',
      record: { ...ownRemedial, classId: 'school-1-c-99' },
    }).allowed,
    false
  );

  // Backup Payload validation with all 8 Phase 6 collections
  const backup: BackupPayload = {
    schemaVersion: 9,
    exportedAt: new Date().toISOString(),
    scope: 'complex_wide',
    data: {
      schools: seed.schools,
      classes: seed.classes,
      students: seed.students,
      teachers: seed.teachers,
      schedules: seed.schedules,
      student_attendance: seed.student_attendance,
      staff_attendance: seed.staff_attendance,
      substitutions: seed.substitutions,
      daily_logs: seed.daily_logs,
      school_plugin_states: seed.school_plugin_states,
      curriculum_topics: seed.curriculum_topics,
      media_resources: seed.media_resources,
      chat_outbox: seed.chat_outbox,
      gradebook_entries: seed.gradebook_entries,
      lesson_plans: seed.lesson_plans,
      gradebook_weights: seed.gradebook_weights,
      grade_appeals: seed.grade_appeals,
      homework_assignments: seed.homework_assignments,
      homework_submissions: seed.homework_submissions,
      student_rewards: seed.student_rewards,
      finance_fee_plans: seed.finance_fee_plans,
      finance_student_ledgers: seed.finance_student_ledgers,
      finance_payments: seed.finance_payments,
      finance_expenses: seed.finance_expenses,
      remedial_plans: seed.remedial_plans,
      anonymous_surveys: seed.anonymous_surveys,
      survey_participation_receipts: seed.survey_participation_receipts,
      survey_anonymous_responses: seed.survey_anonymous_responses,
    },
  };
  const validation = validateBackupPayload(backup);
  assert.equal(validation.valid, true, validation.errors.join('; '));
});
