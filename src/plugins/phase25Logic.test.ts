import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation } from '../core/auth/policy';
import { LocalIndexedDBAdapter } from '../core/data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../core/data/seedData';
import { createPluginStateTransition } from '../core/plugins/pluginHelpers';
import {
  MAX_AUDIO_VIDEO_BYTES,
  MAX_IMAGE_PDF_BYTES,
  validateBackupPayload,
  validateQuestionBankInput,
  validateRichMediaFile,
} from '../core/validation/validators';
import {
  calculateGameScore,
  convertQuestionsToSpeedQuiz,
  formatPendingStudentsMessengerList,
  isAssignmentActive,
  partitionClassHomeworkStatus,
} from './homework/homeworkHelpers';
import {
  buildHomeworkFromQuestions,
  filterQuestions,
  formatQuestionsForMessenger,
} from './question-bank/questionBankHelpers';

test('Homework live status helpers compute active state, partition submitted vs pending, and format messenger list', () => {
  const seed = generateSeedDataset();
  const s1Class = seed.classes.find((c) => c.schoolId === 'school-1')!;
  const classStudents = seed.students.filter(
    (s) => s.schoolId === 'school-1' && s.classId === s1Class.id
  );
  const hw = seed.homework_assignments.find(
    (a) => a.schoolId === 'school-1' && a.classId === s1Class.id
  )!;

  assert.equal(isAssignmentActive('1405/09/12', '1405/09/10'), true);
  assert.equal(isAssignmentActive('1405/09/10', '1405/09/10'), true);
  assert.equal(isAssignmentActive('1405/09/08', '1405/09/10'), false);

  const partition = partitionClassHomeworkStatus(
    classStudents,
    hw.id,
    seed.homework_submissions
  );
  assert.equal(partition.totalCount, classStudents.length);
  assert.equal(
    partition.submittedCount + partition.pendingStudents.length,
    classStudents.length
  );

  const msg = formatPendingStudentsMessengerList({
    schoolName: 'دبستان یکم',
    className: s1Class.name,
    assignment: hw,
    pendingStudents: partition.pendingStudents,
    submittedCount: partition.submittedCount,
    totalCount: partition.totalCount,
    currentDateJalali: '1405/09/05',
  });
  assert.ok(msg.includes(hw.title));
  assert.ok(msg.includes('دانش‌آموزان در انتظار تحویل'));
});

test('Educational game scoring and MCQ-to-SpeedQuiz conversion calculate accurate score, stars, and quiz items', () => {
  const perfect = calculateGameScore({ correctCount: 5, totalCount: 5, durationSec: 22 });
  assert.equal(perfect.score, 100);
  assert.equal(perfect.stars, 3);
  assert.equal(perfect.suggestedGrade20, 20);

  const mid = calculateGameScore({ correctCount: 3, totalCount: 5, durationSec: 40 });
  assert.equal(mid.score, 60);
  assert.equal(mid.stars, 2);
  assert.equal(mid.suggestedGrade20, 12);

  const low = calculateGameScore({ correctCount: 1, totalCount: 5, durationSec: 50 });
  assert.equal(low.score, 20);
  assert.equal(low.stars, 1);

  const seed = generateSeedDataset();
  const s1Questions = seed.question_bank.filter((q) => q.schoolId === 'school-1');
  assert.equal(s1Questions.length, 6);
  const s2Questions = seed.question_bank.filter((q) => q.schoolId === 'school-2');
  assert.equal(s2Questions.length, 0);

  const quizItems = convertQuestionsToSpeedQuiz(s1Questions);
  assert.equal(quizItems.length, 3);
  assert.equal(quizItems[0].options.length, 4);
});

test('Rich media validator enforces 5MB image/PDF cap, 15MB audio/video cap, and blocks active scripts/SVG/HTML', () => {
  // Safe image within 5MB
  assert.equal(
    validateRichMediaFile({
      fileName: 'homework.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2 * 1024 * 1024,
    }).valid,
    true
  );

  // Oversized image > 5MB
  assert.equal(
    validateRichMediaFile({
      fileName: 'huge.png',
      mimeType: 'image/png',
      sizeBytes: MAX_IMAGE_PDF_BYTES + 1,
    }).valid,
    false
  );

  // Safe video within 15MB
  assert.equal(
    validateRichMediaFile({
      fileName: 'reading.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 12 * 1024 * 1024,
    }).valid,
    true
  );

  // Oversized audio > 15MB
  assert.equal(
    validateRichMediaFile({
      fileName: 'long.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: MAX_AUDIO_VIDEO_BYTES + 100,
    }).valid,
    false
  );

  // Blocked SVG / HTML / JS
  assert.equal(
    validateRichMediaFile({
      fileName: 'xss.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 512,
    }).valid,
    false
  );
  assert.equal(
    validateRichMediaFile({
      fileName: 'payload.html',
      mimeType: 'text/html',
      sizeBytes: 512,
    }).valid,
    false
  );

  // PDF only allowed when allowPdf is true
  assert.equal(
    validateRichMediaFile({
      fileName: 'exam.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 400_000,
      allowPdf: false,
    }).valid,
    false
  );
  assert.equal(
    validateRichMediaFile({
      fileName: 'exam.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 400_000,
      allowPdf: true,
    }).valid,
    true
  );
});

test('Question Bank validators, filtering, messenger formatter, and homework/game dispatch work end-to-end', () => {
  const seed = generateSeedDataset();
  const s1Questions = seed.question_bank.filter((q) => q.schoolId === 'school-1');

  const mathMcqs = filterQuestions(s1Questions, {
    query: '',
    gradeLabel: '',
    subject: 'ریاضی',
    type: 'multiple_choice',
    difficulty: '',
  });
  assert.ok(mathMcqs.length >= 2);

  // Dispatch MCQs as Educational Speed Quiz Game
  const gameHw = buildHomeworkFromQuestions({
    id: 'school-1:hw:test-game',
    schoolId: 'school-1',
    classId: 's1-cls-1',
    teacherId: 's1-tch-1',
    teacherName: 'معلم آزمایشی',
    title: 'مسابقه ریاضی کلاسی',
    dueDateJalali: '1405/09/20',
    createdAtJalali: '1405/09/10',
    questions: mathMcqs,
    convertToSpeedQuiz: true,
  });
  assert.equal(gameHw.mode, 'game');
  assert.equal(gameHw.gameConfig?.template, 'speed_quiz');
  assert.equal(gameHw.gameConfig?.quizItems?.length, mathMcqs.length);

  // Dispatch as Standard Homework when toggle is off
  const stdHw = buildHomeworkFromQuestions({
    id: 'school-1:hw:test-std',
    schoolId: 'school-1',
    classId: 's1-cls-1',
    teacherId: 's1-tch-1',
    teacherName: 'معلم آزمایشی',
    title: 'تمرین تشریحی ریاضی',
    dueDateJalali: '1405/09/20',
    createdAtJalali: '1405/09/10',
    questions: mathMcqs,
    convertToSpeedQuiz: false,
  });
  assert.equal(stdHw.mode, 'standard');
  assert.equal(stdHw.gameConfig, undefined);

  const messengerText = formatQuestionsForMessenger({
    schoolName: 'دبستان دخترانه',
    className: 'پنجم الف',
    questions: mathMcqs,
    jalaliDate: '1405/09/10',
    senderName: 'معلم ریاضی',
    includeAnswers: true,
  });
  assert.ok(messengerText.includes('پاسخ صحیح:'));

  // Question Bank input validator rejects incomplete MCQ
  const badMcq = validateQuestionBankInput({
    gradeLabel: 'پایه پنجم',
    subject: 'ریاضی',
    chapter: 'فصل ۱',
    type: 'multiple_choice',
    questionText: 'حاصل ۲+۲ چیست؟',
    options: ['۴', '۵', '', '۷'],
    correctOptionIndex: 0,
  });
  assert.equal(badMcq.valid, false);
});

test('Phase 2.5 RBAC blocks parents & students from Question Bank & dispatch queues while permitting student own game submission only', () => {
  const seed = generateSeedDataset();
  const s1Student = seed.students.find((s) => s.schoolId === 'school-1')!;
  const s1Teacher = seed.teachers.find((t) => t.schoolId === 'school-1')!;
  const s1Question = seed.question_bank.find((q) => q.schoolId === 'school-1')!;

  const parentCtx = {
    session: {
      userId: 'parent-1',
      username: s1Student.nationalId,
      displayName: 'ولی دانش‌آموز',
      role: 'parent' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: s1Student.id,
      loggedInAt: new Date().toISOString(),
    },
    activeSchoolId: 'school-1',
    teacherAssignedClassIds: [],
  };

  const studentCtx = {
    session: {
      userId: 'student-1',
      username: s1Student.studentUsername ?? 'student1',
      displayName: s1Student.fullName,
      role: 'student' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: s1Student.id,
      loggedInAt: new Date().toISOString(),
    },
    activeSchoolId: 'school-1',
    teacherAssignedClassIds: [],
  };

  // Parent & Student are strictly denied from question_bank, class_chat_draft_queue, exam_question_basket
  assert.equal(
    authorizeMutation(parentCtx, 'question_bank', 'write', {
      schoolId: 'school-1',
      record: s1Question,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'class_chat_draft_queue', 'write', {
      schoolId: 'school-1',
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'exam_question_basket', 'write', {
      schoolId: 'school-1',
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'question_bank', 'write', {
      schoolId: 'school-1',
      record: s1Question,
    }).allowed,
    false
  );

  const gameSubRecord = {
    id: `school-1:hwsub:game1:${s1Student.id}`,
    schoolId: 'school-1',
    assignmentId: 'game1',
    studentId: s1Student.id,
    classId: s1Student.classId,
    answerText: 'بازی آموزشی تکمیل شد',
    gameResult: {
      score: 100,
      maxScore: 100,
      stars: 3,
      durationSec: 18,
      completedAtIso: new Date().toISOString(),
      source: 'builtin',
    },
    submittedAtJalali: '1405/09/10',
    submittedAtIso: new Date().toISOString(),
    status: 'submitted',
  };

  // Student IS allowed to submit their own educational game result (status: 'submitted', no teacher review score)
  assert.equal(
    authorizeMutation(studentCtx, 'homework_submissions', 'write', {
      schoolId: 'school-1',
      classId: s1Student.classId,
      record: gameSubRecord,
    }).allowed,
    true
  );

  // Parent is STRICTLY BLOCKED from submitting educational game results on behalf of the student
  assert.equal(
    authorizeMutation(parentCtx, 'homework_submissions', 'write', {
      schoolId: 'school-1',
      classId: s1Student.classId,
      record: gameSubRecord,
    }).allowed,
    false
  );

  // Teacher can manage question_bank in own school, but NOT in school-2
  const teacherCtx = {
    session: {
      userId: s1Teacher.id,
      username: s1Teacher.nationalId,
      displayName: s1Teacher.fullName,
      role: 'teacher' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedTeacherId: s1Teacher.id,
      loggedInAt: new Date().toISOString(),
    },
    activeSchoolId: 'school-1',
    teacherAssignedClassIds: s1Teacher.assignedClassIds,
  };

  assert.equal(
    authorizeMutation(teacherCtx, 'question_bank', 'write', {
      schoolId: 'school-1',
      record: s1Question,
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'question_bank', 'write', {
      schoolId: 'school-2',
      record: { ...s1Question, schoolId: 'school-2' },
    }).allowed,
    false
  );
});

test('Non-destructive disable of question-bank preserves all 6 seeded records and round-trips through JSON backup', async () => {
  const repo = new LocalIndexedDBAdapter();
  const beforeCounts = await repo.getCollectionCountsBySchool('school-1');
  assert.equal(beforeCounts.question_bank, 6);

  // Disable question-bank for school-1
  const nextState = createPluginStateTransition({
    schoolId: 'school-1',
    pluginId: 'question-bank',
    action: 'disable',
    updatedBy: 'مدیر آزمایشی',
  });
  await repo.putMany('school_plugin_states', [nextState]);

  // Records MUST remain 100% preserved
  const afterCounts = await repo.getCollectionCountsBySchool('school-1');
  assert.equal(afterCounts.question_bank, 6);

  // Single-school & complex-wide backups include question_bank even while disabled
  const singleBackup = await repo.exportSchoolBackup('school-1');
  assert.ok(singleBackup.schemaVersion >= 3);
  assert.equal(validateBackupPayload(singleBackup).valid, true);
  assert.equal(singleBackup.data.question_bank?.length, 6);

  const complexBackup = await repo.exportComplexBackup();
  assert.equal(validateBackupPayload(complexBackup).valid, true);
  assert.equal(complexBackup.data.question_bank?.length, 6);
});
