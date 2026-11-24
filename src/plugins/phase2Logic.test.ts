import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation } from '../core/auth/policy';
import { LocalIndexedDBAdapter } from '../core/data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../core/data/seedData';
import { createPluginStateTransition } from '../core/plugins/pluginHelpers';
import {
  validateAttachmentFile,
  validateBackupPayload,
  validateSafeHttpUrl,
} from '../core/validation/validators';
import {
  buildMonthlyTrendPoints,
  computeSmartContinuousScore,
  DEFAULT_GRADEBOOK_WEIGHTS,
  generatePersianDescriptiveReport,
} from './gradebook/gradebookHelpers';
import { detectScheduleConflict } from './timetable/timetableHelpers';

test('Timetable conflict detector blocks teacher double-booking & class slot collision within same school only', () => {
  const seed = generateSeedDataset();
  const s1Schedules = seed.schedules.filter((s) => s.schoolId === 'school-1');
  const existing = s1Schedules[0];
  assert.ok(existing);

  // Teacher double-booked in another class at the same weekday + period
  const otherClass = seed.classes.find(
    (c) => c.schoolId === 'school-1' && c.id !== existing.classId
  )!;
  const teacherConflict = detectScheduleConflict({
    candidate: {
      schoolId: 'school-1',
      weekday: existing.weekday,
      period: existing.period,
      classId: otherClass.id,
      teacherId: existing.teacherId,
    },
    existingSchedules: seed.schedules,
    classes: seed.classes,
    teachers: seed.teachers,
  });
  assert.equal(teacherConflict.hasConflict, true);
  assert.equal(teacherConflict.conflictType, 'teacher_double_booked');

  // Same class slot collision (using a genuinely free teacher at that weekday/period)
  const busyTeacherIds = new Set(
    s1Schedules
      .filter((s) => s.weekday === existing.weekday && s.period === existing.period)
      .map((s) => s.teacherId)
  );
  const freeTeacher = seed.teachers.find(
    (t) => t.schoolId === 'school-1' && !busyTeacherIds.has(t.id)
  )!;
  const classConflict = detectScheduleConflict({
    candidate: {
      schoolId: 'school-1',
      weekday: existing.weekday,
      period: existing.period,
      classId: existing.classId,
      teacherId: freeTeacher.id,
    },
    existingSchedules: seed.schedules,
    classes: seed.classes,
    teachers: seed.teachers,
  });
  assert.equal(classConflict.hasConflict, true);
  assert.equal(classConflict.conflictType, 'class_slot_occupied');

  // Editing the same existing slot ID must NOT self-conflict
  const selfEdit = detectScheduleConflict({
    candidate: {
      id: existing.id,
      schoolId: 'school-1',
      weekday: existing.weekday,
      period: existing.period,
      classId: existing.classId,
      teacherId: existing.teacherId,
    },
    existingSchedules: seed.schedules,
    classes: seed.classes,
    teachers: seed.teachers,
  });
  assert.equal(selfEdit.hasConflict, false);
});

test('Smart Continuous Assessment computes accurate weighted 0..20 score with and without Phase 3 microQuizScore', () => {
  const seed = generateSeedDataset();
  const student = seed.students.find((s) => s.schoolId === 'school-1')!;
  const entry = seed.gradebook_entries.find(
    (g) => g.schoolId === 'school-1' && g.studentId === student.id && g.subject === 'ریاضی'
  )!;

  // Without Phase 3 microQuizScore (renormalized over active weights)
  const withoutMicro = computeSmartContinuousScore({
    studentId: student.id,
    classId: student.classId,
    subject: 'ریاضی',
    weights: DEFAULT_GRADEBOOK_WEIGHTS,
    attendanceRecords: seed.student_attendance.filter((a) => a.schoolId === 'school-1'),
    assignments: seed.homework_assignments.filter((h) => h.schoolId === 'school-1'),
    submissions: seed.homework_submissions.filter((s) => s.schoolId === 'school-1'),
    gradeEntry: entry,
  });
  assert.ok(withoutMicro.finalScore >= 0 && withoutMicro.finalScore <= 20);
  assert.equal(withoutMicro.effectiveWeights.microQuiz, 0);

  // With Phase 3 microQuizScore wired in
  const withMicro = computeSmartContinuousScore({
    studentId: student.id,
    classId: student.classId,
    subject: 'ریاضی',
    weights: DEFAULT_GRADEBOOK_WEIGHTS,
    attendanceRecords: seed.student_attendance.filter((a) => a.schoolId === 'school-1'),
    assignments: seed.homework_assignments.filter((h) => h.schoolId === 'school-1'),
    submissions: seed.homework_submissions.filter((s) => s.schoolId === 'school-1'),
    gradeEntry: { ...entry, microQuizScore: 20 },
  });
  assert.equal(withMicro.effectiveWeights.microQuiz, 10);
  assert.ok(withMicro.finalScore >= withoutMicro.finalScore - 0.01);

  // Auto descriptive report & monthly trend points
  const paragraph = generatePersianDescriptiveReport({
    studentName: student.fullName,
    subject: 'ریاضی',
    month: 'آذر',
    breakdown: withoutMicro,
    disciplinaryNote: entry.disciplinaryNote,
  });
  assert.ok(paragraph.includes(student.fullName));
  assert.ok(paragraph.includes('ریاضی'));

  const trend = buildMonthlyTrendPoints({
    entries: seed.gradebook_entries,
    studentId: student.id,
    subject: 'ریاضی',
  });
  assert.equal(trend.length, 4);
  assert.equal(trend[0].month, 'مهر');
  assert.equal(trend[3].month, 'دی');
});

test('Phase 2 RBAC policy enforces strict student homework ownership, parent read-only academic boundary, and teacher/principal roles', () => {
  const studentAuth = {
    session: {
      userId: 'st1',
      username: 'student1',
      displayName: 'دانش‌آموز',
      role: 'student' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: 'school-1-s-1',
      loggedInAt: new Date().toISOString(),
    },
  };

  const parentAuth = {
    session: {
      userId: 'p1',
      username: 'parent1',
      displayName: 'ولی',
      role: 'parent' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: 'school-1-s-1',
      loggedInAt: new Date().toISOString(),
    },
  };

  // Student CAN submit own homework (without teacher review fields)
  assert.equal(
    authorizeMutation(studentAuth, 'homework_submissions', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: {
        id: 'sub1',
        schoolId: 'school-1',
        assignmentId: 'hw1',
        studentId: 'school-1-s-1',
        classId: 'school-1-c-1',
        answerText: 'پاسخ تمرین',
        submittedAtJalali: '1405/08/29',
        submittedAtIso: new Date().toISOString(),
        status: 'submitted',
      },
    }).allowed,
    true
  );

  // Student CANNOT submit homework for another student or forge a teacher score
  assert.equal(
    authorizeMutation(studentAuth, 'homework_submissions', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-2', status: 'submitted' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentAuth, 'homework_submissions', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-1', status: 'reviewed', score: 20 },
    }).allowed,
    false
  );

  // Parent is STRICTLY READ-ONLY on homework, grade appeals, gradebook, curriculum, and rewards
  assert.equal(
    authorizeMutation(parentAuth, 'homework_submissions', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-1', status: 'submitted' },
    }).allowed,
    false
  );
  // Phase 4 Parent Portal: Parent CAN submit formal grade objection for own child (status: 'submitted'),
  // but CANNOT forge approval/revisedScore or submit for another child
  assert.equal(
    authorizeMutation(parentAuth, 'grade_appeals', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-1', status: 'submitted' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(parentAuth, 'grade_appeals', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-1', status: 'principal_approved', revisedScore: 20 },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentAuth, 'grade_appeals', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-2', status: 'submitted' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentAuth, 'gradebook_entries', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentAuth, 'curriculum_topics', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentAuth, 'student_rewards', 'write', { schoolId: 'school-1' }).allowed,
    false
  );

  // Teacher CANNOT give principal final approval on grade appeals
  const teacherAuth = {
    session: {
      userId: 't1',
      username: 'teacher1',
      displayName: 'استاد',
      role: 'teacher' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedTeacherId: 'school-1-t-1',
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: ['school-1-c-1'],
  };
  assert.equal(
    authorizeMutation(teacherAuth, 'grade_appeals', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { classId: 'school-1-c-1', status: 'teacher_reviewed' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherAuth, 'grade_appeals', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { classId: 'school-1-c-1', status: 'principal_approved' },
    }).allowed,
    false
  );
});

test('Safe URL & attachment validators reject javascript: links, SVG/HTML uploads, and oversized files', () => {
  assert.equal(validateSafeHttpUrl('https://www.roshd.ir/lesson').valid, true);
  assert.equal(validateSafeHttpUrl('javascript:alert(1)').valid, false);
  assert.equal(validateSafeHttpUrl('data:text/html,<script>alert(1)</script>').valid, false);

  assert.equal(
    validateAttachmentFile({ fileName: 'sheet.pdf', mimeType: 'application/pdf', sizeBytes: 120_000 })
      .valid,
    true
  );
  assert.equal(
    validateAttachmentFile({ fileName: 'evil.svg', mimeType: 'image/svg+xml', sizeBytes: 10_000 })
      .valid,
    false
  );
  assert.equal(
    validateAttachmentFile({ fileName: 'huge.png', mimeType: 'image/png', sizeBytes: 900_000 }).valid,
    false
  );
});

test('Non-destructive Phase 2 add-on disable preserves all records and includes them in JSON backups', async () => {
  const repo = new LocalIndexedDBAdapter();
  const beforeCounts = await repo.getCollectionCountsBySchool('school-1');
  assert.ok(beforeCounts.curriculum_topics >= 60);
  assert.ok(beforeCounts.gradebook_entries >= 100);
  assert.ok(beforeCounts.homework_assignments >= 10);
  assert.ok(beforeCounts.student_rewards >= 5);

  // Soft-uninstall gradebook & rewards for school-1
  await repo.putMany('school_plugin_states', [
    createPluginStateTransition({
      schoolId: 'school-1',
      pluginId: 'gradebook',
      action: 'uninstall',
      updatedBy: 'مدیر تست',
    }),
    createPluginStateTransition({
      schoolId: 'school-1',
      pluginId: 'rewards',
      action: 'disable',
      updatedBy: 'مدیر تست',
    }),
  ]);

  const afterCounts = await repo.getCollectionCountsBySchool('school-1');
  assert.equal(afterCounts.gradebook_entries, beforeCounts.gradebook_entries);
  assert.equal(afterCounts.student_rewards, beforeCounts.student_rewards);

  // Backup MUST include disabled/uninstalled Phase 2 collections and pass validator
  const backup = await repo.exportSchoolBackup('school-1');
  assert.ok(backup.schemaVersion >= 2);
  assert.equal(backup.data.gradebook_entries.length, beforeCounts.gradebook_entries);
  assert.equal(backup.data.student_rewards.length, beforeCounts.student_rewards);
  assert.equal(validateBackupPayload(backup).valid, true);
});
