// Comprehensive Unit Tests for Phase 3 Plugins (flipped-video, online-classroom, online-exams)
// Covers: Pure telemetry/grading/analytics logic, RBAC isolation, Non-destructive preservation, and Backup/Restore
import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation, type AuthGuardContext } from '../core/auth/policy';
import { LocalIndexedDBAdapter } from '../core/data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../core/data/seedData';
import { buildPluginRuntimeStatuses, createPluginStateTransition } from '../core/plugins/pluginHelpers';
import { validateBackupPayload, validateFlippedVideoFile, validateOnlineClassSessionInput, validateOnlineExamInput } from '../core/validation/validators';
import {
  buildClassHeatmap,
  buildRemedialAgenda,
  clampForwardSeek,
  classifyPlaybackSpeed,
  computeWatchMetrics,
  formatMmSs,
  formatRemedialAgendaMessenger,
  gradeMicroQuiz,
} from './flipped-video/flippedVideoHelpers';
import {
  computeOnlineAttendanceSummary,
  formatClassroomInviteMessenger,
  getPlatformLabelFa,
} from './online-classroom/onlineClassroomHelpers';
import {
  autoGradeExamSubmission,
  computeExamClassAnalytics,
  convertQuestionBankToExamQuestion,
  formatExamMessengerAnnouncement,
  normalizePersianAnswer,
  recalculateSubmissionAfterManualGrading,
} from './online-exams/onlineExamHelpers';
import type { FlippedSecondWatchState, OnlineExam, OnlineExamSubmission, QuestionBankItem } from '../types/domain';

test('Flipped Video: clampForwardSeek blocks seeking beyond maxWatchedSecond + 2 and allows rewind', () => {
  const blocked = clampForwardSeek(40, 12, 60);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.targetSecond, 12);

  const withinTolerance = clampForwardSeek(14, 12, 60);
  assert.equal(withinTolerance.allowed, true);
  assert.equal(withinTolerance.targetSecond, 14);

  const rewind = clampForwardSeek(4, 25, 60);
  assert.equal(rewind.allowed, true);
  assert.equal(rewind.targetSecond, 4);
});

test('Flipped Video: speed telemetry, 85% Micro-Quiz unlock, grading, heatmap & remedial agenda', () => {
  assert.equal(classifyPlaybackSpeed(1), 'normal');
  assert.equal(classifyPlaybackSpeed(1.15), 'normal');
  assert.equal(classifyPlaybackSpeed(1.25), 'fast');
  assert.equal(classifyPlaybackSpeed(2), 'fast');
  assert.equal(formatMmSs(65), '۰۱:۰۵');

  const partialStates: Record<string, FlippedSecondWatchState> = {};
  for (let s = 0; s < 50; s++) partialStates[String(s)] = 'normal';
  const m50 = computeWatchMetrics(partialStates, 60);
  assert.equal(m50.watchedPercent, 83);
  assert.equal(m50.isMicroQuizUnlocked, false);

  partialStates['50'] = 'fast';
  const m51 = computeWatchMetrics(partialStates, 60);
  assert.equal(m51.watchedPercent, 85);
  assert.equal(m51.isMicroQuizUnlocked, true);

  const seed = generateSeedDataset();
  const lesson = seed.flipped_lessons[0];
  assert.ok(lesson, 'Expected 1 seeded flipped video lesson for school-1');
  assert.equal(lesson.schoolId, 'school-1');

  const perfectGrade = gradeMicroQuiz(
    lesson.microQuiz,
    lesson.microQuiz.map((q) => q.correctOptionIndex)
  );
  assert.equal(perfectGrade.score20, 20);
  assert.equal(perfectGrade.descriptiveStatus, 'تسلط کامل');

  const lowGrade = gradeMicroQuiz(lesson.microQuiz, [0, 0, 0]);
  assert.ok(lowGrade.score20 < 15);

  const heatmap = buildClassHeatmap(lesson.durationSeconds, seed.flipped_telemetry);
  assert.equal(heatmap.length, lesson.durationSeconds);

  const classStudents = seed.students.filter((s) => s.classId === lesson.classId);
  const agenda = buildRemedialAgenda({
    lesson,
    classStudents,
    telemetries: seed.flipped_telemetry,
    questions: seed.flipped_questions,
  });
  assert.ok(agenda.groupedQuestions.length >= 1);
  assert.ok(agenda.notWatchedStudents.length >= 1);
  assert.ok(agenda.lowQuizStudents.length >= 1);

  const messenger = formatRemedialAgendaMessenger({
    schoolName: 'دبستان امید',
    className: 'چهارم الف',
    lesson,
    agenda,
    jalaliDate: '1404/08/25',
  });
  assert.ok(messenger.includes('دستور جلسه کلاس رفع اشکال'));
});

test('Online Classroom: attendance summary, platform labels & messenger invite', () => {
  const seed = generateSeedDataset();
  const session = seed.online_class_sessions[0];
  assert.ok(session, 'Expected 1 seeded online classroom session for school-1');
  assert.equal(getPlatformLabelFa('shad'), 'شاد');
  assert.equal(getPlatformLabelFa('skyroom'), 'اسکایروم');

  const classStudents = seed.students.filter((s) => s.classId === session.classId);
  const summary = computeOnlineAttendanceSummary(classStudents, seed.online_class_attendance);
  assert.equal(summary.presentCount, 1);
  assert.equal(summary.lateCount, 1);
  assert.equal(summary.joinedViaLinkCount, 2);
  assert.equal(summary.absentCount, classStudents.filter((s) => s.active).length - 2);

  const invite = formatClassroomInviteMessenger({
    schoolName: 'دبستان امید',
    className: 'چهارم الف',
    session,
  });
  assert.ok(invite.includes(session.joinUrl));
  assert.ok(invite.includes('اسکایروم'));
});

test('Online Exams: Persian normalization, auto-grading, manual grading, analytics & Question Bank conversion', () => {
  assert.equal(normalizePersianAnswer('  يک / ۲  '), 'یک / 2');
  assert.equal(normalizePersianAnswer('کسر  مساوي'), 'کسر مساوی');

  const seed = generateSeedDataset();
  const exam: OnlineExam = seed.online_exams[0];
  assert.ok(exam, 'Expected 1 seeded online exam for school-1');

  const autoRes = autoGradeExamSubmission(exam, [
    { questionId: 'exq-1', selectedOptionIndex: 1 }, // 4 pts
    { questionId: 'exq-2', selectedOptionIndex: 1 }, // 4 pts
    { questionId: 'exq-3', trueFalseValue: false }, // 4 pts
    { questionId: 'exq-4', textAnswer: 'عرض' }, // 4 pts
    { questionId: 'exq-5', textAnswer: 'محیط ۳۸ و مساحت ۸۴' }, // descriptive (4 pts)
  ]);

  assert.equal(autoRes.autoGradedPoints, 16);
  assert.equal(autoRes.hasDescriptive, true);
  assert.equal(autoRes.gradingStatus, 'pending_descriptive');

  const draftSub: OnlineExamSubmission = {
    id: 'school-1:exsub:test:stu1',
    schoolId: 'school-1',
    examId: exam.id,
    classId: exam.classId,
    studentId: 'stu-test',
    answers: autoRes.gradedAnswers,
    startedAtIso: new Date().toISOString(),
    submittedAtIso: new Date().toISOString(),
    submittedAtJalali: '1404/08/25',
    elapsedSeconds: 300,
    tabSwitchCount: 1,
    autoGradedPoints: autoRes.autoGradedPoints,
    manualGradedPoints: 0,
    finalPoints: autoRes.finalPoints,
    finalScore20: autoRes.finalScore20,
    gradingStatus: autoRes.gradingStatus,
    updatedAt: new Date().toISOString(),
  };

  const finalized = recalculateSubmissionAfterManualGrading(
    exam,
    draftSub,
    { 'exq-5': { score: 3.5, feedback: 'توضیح عالی' } },
    'بسیار خوب'
  );
  assert.equal(finalized.gradingStatus, 'finalized');
  assert.equal(finalized.manualGradedPoints, 3.5);
  assert.equal(finalized.finalPoints, 19.5);
  assert.equal(finalized.finalScore20, 19.5);

  const analytics = computeExamClassAnalytics(exam, [...seed.online_exam_submissions, finalized]);
  assert.equal(analytics.submissionCount, seed.online_exam_submissions.length + 1);
  assert.ok(analytics.averageScore20 !== null && analytics.averageScore20 > 10);
  assert.ok(analytics.tabSwitchFlaggedCount >= 2);

  const qbSample: QuestionBankItem = seed.question_bank[0];
  const converted = convertQuestionBankToExamQuestion(qbSample, 3);
  assert.equal(converted.points, 3);
  assert.equal(converted.sourceQuestionBankId, qbSample.id);

  const msg = formatExamMessengerAnnouncement({
    schoolName: 'دبستان امید',
    className: 'چهارم الف',
    exam,
    analytics,
  });
  assert.ok(msg.includes(exam.title));
});

test('Phase 3 RBAC Policy: student interactive participation strictly locked to own linkedStudentId, parent strictly read-only on learning modules', () => {
  const studentCtx: AuthGuardContext = {
    session: {
      userId: 'student-1',
      username: 'student1',
      displayName: 'دانش‌آموز ۱',
      role: 'student',
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: 'school-1-s-1',
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: [],
  };

  const parentCtx: AuthGuardContext = {
    session: {
      userId: 'parent-1',
      username: 'parent1',
      displayName: 'ولی دانش‌آموز ۱',
      role: 'parent',
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: 'school-1-s-1',
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: [],
  };

  // Student CANNOT create flipped lessons, online sessions, or exams
  assert.equal(
    authorizeMutation(studentCtx, 'flipped_lessons', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'online_class_sessions', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'online_exams', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    false
  );

  // Student CAN submit own flipped telemetry, question, online classroom join attendance, and exam submission
  assert.equal(
    authorizeMutation(studentCtx, 'flipped_telemetry', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(studentCtx, 'flipped_telemetry', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-2' }, // other student blocked!
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'online_class_attendance', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1', status: 'present', joinedViaLink: true },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(studentCtx, 'online_class_attendance', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1', status: 'absent', joinedViaLink: false }, // cannot falsify teacher manual status
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'online_exam_submissions', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1', gradingStatus: 'auto_graded' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(studentCtx, 'online_exam_submissions', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1', gradingStatus: 'finalized', manualGradedPoints: 10 }, // cannot self-grade descriptive!
    }).allowed,
    false
  );

  // Parent is STRICTLY BLOCKED from taking exams, joining as student, or submitting flipped telemetry
  assert.equal(
    authorizeMutation(parentCtx, 'flipped_telemetry', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'online_class_attendance', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1', status: 'present', joinedViaLink: true },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'online_exam_submissions', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { studentId: 'school-1-s-1', gradingStatus: 'auto_graded' },
    }).allowed,
    false
  );

  // Teacher scoped strictly to assigned classes
  const teacherCtx: AuthGuardContext = {
    session: {
      userId: 'teacher-1',
      username: 'teacher1',
      displayName: 'معلم اول',
      role: 'teacher',
      schoolId: 'school-1',
      isComplexWide: false,
      linkedTeacherId: 'school-1-t-1',
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: ['school-1-c-1'],
  };
  assert.equal(
    authorizeMutation(teacherCtx, 'online_exams', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'online_exams', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-2', // unassigned class blocked
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'flipped_lessons', 'write', {
      schoolId: 'school-2', // cross-school blocked
      classId: 'school-1-c-1',
    }).allowed,
    false
  );
});

test('Phase 3 Validators: 40MB video guard, classroom URL & exam input', () => {
  assert.equal(
    validateFlippedVideoFile({ fileName: 'lesson.mp4', mimeType: 'video/mp4', sizeBytes: 10 * 1024 * 1024 }).valid,
    true
  );
  assert.equal(
    validateFlippedVideoFile({ fileName: 'huge.mp4', mimeType: 'video/mp4', sizeBytes: 45 * 1024 * 1024 }).valid,
    false
  );
  assert.equal(
    validateFlippedVideoFile({ fileName: 'pic.png', mimeType: 'image/png', sizeBytes: 500_000 }).valid,
    false
  );

  assert.equal(
    validateOnlineClassSessionInput({
      title: 'جلسه ریاضی',
      classId: 'c1',
      subject: 'ریاضی',
      jalaliDate: '1404/08/25',
      startTime: '16:00',
      endTime: '17:00',
      joinUrl: 'https://skyroom.online/ch/test',
    }).valid,
    true
  );
  assert.equal(
    validateOnlineClassSessionInput({
      title: 'جلسه ریاضی',
      classId: 'c1',
      subject: 'ریاضی',
      jalaliDate: '1404/08/25',
      startTime: '16:00',
      endTime: '17:00',
      joinUrl: 'javascript:alert(1)',
    }).valid,
    false
  );

  assert.equal(
    validateOnlineExamInput({
      title: 'آزمون فصل اول',
      classId: 'c1',
      subject: 'ریاضی',
      startDateJalali: '1404/08/25',
      endDateJalali: '1404/08/28',
      durationMinutes: 20,
      questionCount: 3,
    }).valid,
    true
  );
  assert.equal(
    validateOnlineExamInput({
      title: 'آزمون خالی',
      classId: 'c1',
      subject: 'ریاضی',
      startDateJalali: '1404/08/25',
      endDateJalali: '1404/08/28',
      durationMinutes: 20,
      questionCount: 0,
    }).valid,
    false
  );
});

test('Phase 3 Non-Destructive Disable/Uninstall & Backup/Restore Round-Trip', async () => {
  const repo = new LocalIndexedDBAdapter();
  await repo.init();

  const school1FlippedBefore = await repo.getBySchool('flipped_lessons', 'school-1');
  const school1ExamsBefore = await repo.getBySchool('online_exams', 'school-1');
  const school1SignalsBefore = await repo.getBySchool('student_360_signals', 'school-1');
  assert.equal(school1FlippedBefore.length, 1);
  assert.equal(school1ExamsBefore.length, 1);
  assert.ok(school1SignalsBefore.length >= 2);

  // Soft-uninstall flipped-video and verify record count is preserved non-destructively
  const nextState = createPluginStateTransition({
    schoolId: 'school-1',
    pluginId: 'flipped-video',
    action: 'uninstall',
    updatedBy: 'principal1',
  });
  await repo.putItem('school_plugin_states', nextState);

  const school1FlippedAfter = await repo.getBySchool('flipped_lessons', 'school-1');
  assert.equal(school1FlippedAfter.length, 1, 'Soft-uninstalling plugin must NOT delete data');

  const runtime = buildPluginRuntimeStatuses(
    [
      {
        id: 'flipped-video',
        nameFa: 'کلاس وارونه',
        shortNameFa: 'کلاس وارونه',
        descriptionFa: 'desc',
        version: '3.0.0',
        phase: 3,
        category: 'digital_learning',
        categoryLabelFa: 'یادگیری دیجیتال',
        iconName: 'PlayCircle',
        isCore: false,
        defaultEnabled: true,
        route: '/flipped-video',
        allowedRoles: ['principal', 'teacher', 'parent'],
        dataStores: ['flipped_lessons', 'flipped_telemetry', 'flipped_questions'],
        implemented: true,
      },
    ],
    [nextState],
    {
      flipped_lessons: 1,
      flipped_telemetry: 2,
      flipped_questions: 2,
    }
  );
  assert.equal(runtime[0].installed, false);
  assert.equal(runtime[0].preservedRecordCount, 5);

  // Single-school & complex-wide backup round-trip includes all Phase 3 stores & student_360_signals
  const singleBackup = await repo.exportSchoolBackup('school-1');
  assert.equal(validateBackupPayload(singleBackup).valid, true);
  assert.equal(singleBackup.data.flipped_lessons?.length, 1);
  assert.equal(singleBackup.data.online_class_sessions?.length, 1);
  assert.equal(singleBackup.data.online_exams?.length, 1);
  assert.ok((singleBackup.data.student_360_signals?.length ?? 0) >= 2);

  const complexBackup = await repo.exportComplexBackup();
  assert.equal(validateBackupPayload(complexBackup).valid, true);
  await repo.restoreBackup(complexBackup);

  const restoredSignals = await repo.getBySchool('student_360_signals', 'school-1');
  assert.equal(restoredSignals.length, school1SignalsBefore.length);
});
