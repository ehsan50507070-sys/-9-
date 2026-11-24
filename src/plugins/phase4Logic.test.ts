// Phase 4 Unit Tests: Pure Logic, 6-Role RBAC Boundaries, Non-Destructive Plugin Isolation & Backup/Restore
import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation, type AuthGuardContext } from '../core/auth/policy';
import { LocalIndexedDBAdapter } from '../core/data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../core/data/seedData';
import { validateBackupPayload } from '../core/validation/validators';
import type {
  AppointmentSlot,
  ClassChatPoll,
  ElectronicForm,
  ElectronicFormResponse,
  GradebookEntry,
  OnlineExam,
  OnlineExamSubmission,
} from '../types/domain';
import {
  buildStudent360Summary,
  canBookAppointmentSlot,
  formatStudent360Messenger,
  generateSplitTimeSlots,
} from './appointments/appointmentsHelpers';
import {
  applyPollVote,
  canUserPostInClassRoom,
  computePollStats,
  formatDraftQuestionForChat,
} from './class-chat/classChatHelpers';
import {
  buildFormResponsesCsv,
  formatPendingParentsMessenger,
  partitionFormResponses,
} from './electronic-forms/electronicFormsHelpers';
import {
  getTodaysAbsentOrLateStudents,
  renderBatchNotificationMessages,
  renderNotificationTemplate,
} from './notification-templates/notificationTemplatesHelpers';
import {
  buildStudentProgressAnalysis,
  buildSubjectReportRows,
  classifyTrendDelta,
} from './parent-portal/parentPortalHelpers';

const seed = generateSeedDataset();

const parentCtx: AuthGuardContext = {
  session: {
    userId: 'parent-school-1-s-1',
    username: 'p_1001',
    displayName: 'ولی امیرعلی محمدی',
    role: 'parent',
    schoolId: 'school-1',
    isComplexWide: false,
    linkedStudentId: 'school-1-s-1',
    loggedInAt: '2026-11-21T08:00:00Z',
  },
  teacherAssignedClassIds: [],
};

const studentCtx: AuthGuardContext = {
  session: {
    userId: 'student-school-1-s-1',
    username: 's_1001',
    displayName: 'امیرعلی محمدی',
    role: 'student',
    schoolId: 'school-1',
    isComplexWide: false,
    linkedStudentId: 'school-1-s-1',
    loggedInAt: '2026-11-21T08:00:00Z',
  },
  teacherAssignedClassIds: [],
};

const teacherCtx: AuthGuardContext = {
  session: {
    userId: 'teacher-1',
    username: 'teacher1',
    displayName: 'استاد کریمی',
    role: 'teacher',
    schoolId: 'school-1',
    isComplexWide: false,
    linkedTeacherId: 'school-1-t-1',
    loggedInAt: '2026-11-21T08:00:00Z',
  },
  teacherAssignedClassIds: ['school-1-c-1'],
};

const principalCtx: AuthGuardContext = {
  session: {
    userId: 'principal-1',
    username: 'principal1',
    displayName: 'مدیر مدرسه',
    role: 'principal',
    schoolId: 'school-1',
    isComplexWide: false,
    loggedInAt: '2026-11-21T08:00:00Z',
  },
  teacherAssignedClassIds: [],
};

test('Phase 4 Parent Portal: progress trend classification & report card aggregation', () => {
  assert.equal(classifyTrendDelta(1.5).tone, 'improving');
  assert.equal(classifyTrendDelta(-1.2).tone, 'declining');
  assert.equal(classifyTrendDelta(0.2).tone, 'stable');

  const entries: GradebookEntry[] = [
    {
      id: 'g1',
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      studentId: 'school-1-s-1',
      subject: 'ریاضی',
      jalaliMonth: 'مهر',
      jalaliDate: '1405/07/20',
      descriptiveLevel: 'خوب',
      numericScore: 15,
      disciplinaryNote: 'تلاش خوب',
      recordedBy: 'teacher',
      updatedAt: '2026-10-01T08:00:00Z',
    },
    {
      id: 'g2',
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      studentId: 'school-1-s-1',
      subject: 'ریاضی',
      jalaliMonth: 'آبان',
      jalaliDate: '1405/08/20',
      descriptiveLevel: 'خیلی خوب',
      numericScore: 19,
      disciplinaryNote: 'پیشرفت عالی در کسرها',
      recordedBy: 'teacher',
      updatedAt: '2026-11-01T08:00:00Z',
    },
  ];
  const exams: OnlineExam[] = [
    {
      id: 'ex1',
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      teacherId: 'school-1-t-1',
      teacherName: 'استاد کریمی',
      subject: 'ریاضی',
      title: 'آزمون میان‌ترم ریاضی',
      startDateJalali: '1405/08/25',
      endDateJalali: '1405/08/26',
      durationMinutes: 20,
      randomizeOrder: false,
      showResultImmediately: true,
      questions: [],
      totalPoints: 20,
      status: 'published',
      createdAtJalali: '1405/08/24',
      createdAt: '2026-11-05T08:00:00Z',
      updatedAt: '2026-11-05T08:00:00Z',
    },
  ];
  const subs: OnlineExamSubmission[] = [
    {
      id: 'sub1',
      schoolId: 'school-1',
      examId: 'ex1',
      studentId: 'school-1-s-1',
      classId: 'school-1-c-1',
      answers: [],
      startedAtIso: '2026-11-05T09:40:00Z',
      submittedAtIso: '2026-11-05T10:00:00Z',
      submittedAtJalali: '1405/08/25',
      elapsedSeconds: 1200,
      tabSwitchCount: 0,
      autoGradedPoints: 19.5,
      manualGradedPoints: 0,
      finalPoints: 19.5,
      finalScore20: 19.5,
      gradingStatus: 'finalized',
      updatedAt: '2026-11-05T10:00:00Z',
    },
  ];

  const analysis = buildStudentProgressAnalysis({
    studentId: 'school-1-s-1',
    gradebookEntries: entries,
    onlineExams: exams,
    onlineExamSubmissions: subs,
  });
  assert.equal(analysis.points.length, 3);
  assert.equal(analysis.trendTone, 'improving');
  assert.equal(analysis.trendLabelFa, 'روند رو به رشد');

  const rows = buildSubjectReportRows({
    studentId: 'school-1-s-1',
    gradebookEntries: entries,
    onlineExams: exams,
    onlineExamSubmissions: subs,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject, 'ریاضی');
  assert.equal(rows[0].trendTone, 'improving');
});

test('Phase 4 Class Chat: room mode guard, single-vote poll integrity & Question Bank draft format', () => {
  assert.equal(canUserPostInClassRoom('parent', 'open'), true);
  assert.equal(canUserPostInClassRoom('student', 'open'), true);
  assert.equal(canUserPostInClassRoom('parent', 'announcement_only'), false);
  assert.equal(canUserPostInClassRoom('student', 'announcement_only'), false);
  assert.equal(canUserPostInClassRoom('teacher', 'announcement_only'), true);
  assert.equal(canUserPostInClassRoom('principal', 'announcement_only'), true);

  const poll: ClassChatPoll = {
    question: 'زمان کلاس جبرانی؟',
    options: [
      { id: 'o1', text: 'چهارشنبه', voterUserIds: [] },
      { id: 'o2', text: 'پنج‌شنبه', voterUserIds: [] },
    ],
    closed: false,
  };

  const v1 = applyPollVote(poll, 'o1', 'u-1');
  assert.equal(v1.ok, true);
  assert.ok(v1.updatedPoll);

  // Duplicate vote by same user must be rejected
  const dup = applyPollVote(v1.updatedPoll!, 'o2', 'u-1');
  assert.equal(dup.ok, false);

  const v2 = applyPollVote(v1.updatedPoll!, 'o2', 'u-2');
  assert.equal(v2.ok, true);
  const stats = computePollStats(v2.updatedPoll!, 'u-1');
  assert.equal(stats.totalVotes, 2);
  assert.equal(stats.hasVoted, true);
  assert.equal(stats.options[0].percent, 50);
  assert.equal(stats.options[0].votedByMe, true);

  const formattedDraft = formatDraftQuestionForChat({
    id: 'd1',
    schoolId: 'school-1',
    classId: 'school-1-c-1',
    sourceType: 'question_bank',
    title: 'سوال تمرینی علوم',
    formattedText: 'حالت‌های ماده را نام ببرید.',
    createdByName: 'استاد کریمی',
    createdByRole: 'teacher',
    createdAtJalali: '1405/09/01',
    createdAt: '2026-11-20T09:00:00Z',
  });
  assert.ok(formattedDraft.includes('علوم'));
  assert.ok(formattedDraft.includes('حالت‌های ماده'));
});

test('Phase 4 Appointments: auto-split time slots, double-booking guard & Student 360° summary', () => {
  const splits = generateSplitTimeSlots('10:00', '11:00', 20);
  assert.equal(splits.length, 3);
  assert.deepEqual(
    splits.map((s) => `${s.startTime}-${s.endTime}`),
    ['10:00-10:20', '10:20-10:40', '10:40-11:00']
  );

  const openSlot: AppointmentSlot = {
    id: 'a1',
    schoolId: 'school-1',
    staffUserId: 't1',
    staffName: 'استاد کریمی',
    staffRole: 'teacher',
    targetClassIds: ['school-1-c-1'],
    jalaliDate: '1405/09/05',
    startTime: '10:00',
    endTime: '10:20',
    durationMinutes: 20,
    meetingType: 'in_person',
    status: 'open',
    updatedAt: '2026-11-20T08:00:00Z',
  };
  assert.equal(canBookAppointmentSlot(openSlot).allowed, true);
  assert.equal(
    canBookAppointmentSlot({ ...openSlot, status: 'booked', bookedStudentId: 'school-1-s-1' })
      .allowed,
    false
  );

  const firstStudent = seed.students.find((s) => s.schoolId === 'school-1')!;
  const summary360 = buildStudent360Summary({
    student: firstStudent,
    classes: seed.classes.filter((c) => c.schoolId === 'school-1'),
    studentAttendance: seed.student_attendance.filter((a) => a.schoolId === 'school-1'),
    onlineClassAttendance: seed.online_class_attendance.filter((a) => a.schoolId === 'school-1'),
    gradebookEntries: seed.gradebook_entries.filter((g) => g.schoolId === 'school-1'),
    onlineExams: seed.online_exams.filter((e) => e.schoolId === 'school-1'),
    onlineExamSubmissions: seed.online_exam_submissions.filter((s) => s.schoolId === 'school-1'),
    homeworkAssignments: seed.homework_assignments.filter((h) => h.schoolId === 'school-1'),
    homeworkSubmissions: seed.homework_submissions.filter((s) => s.schoolId === 'school-1'),
    flippedLessons: seed.flipped_lessons.filter((f) => f.schoolId === 'school-1'),
    flippedTelemetry: seed.flipped_telemetry.filter((t) => t.schoolId === 'school-1'),
    flippedQuestions: seed.flipped_questions.filter((q) => q.schoolId === 'school-1'),
    student360Signals: seed.student_360_signals.filter((s) => s.schoolId === 'school-1'),
    studentRewards: seed.student_rewards.filter((r) => r.schoolId === 'school-1'),
    dailyLogs: seed.daily_logs.filter((d) => d.schoolId === 'school-1'),
  });
  assert.equal(summary360.student.id, firstStudent.id);
  const messenger360 = formatStudent360Messenger({
    schoolName: 'دبستان شهدای دانش',
    jalaliDate: '1405/09/05',
    summary: summary360,
  });
  assert.ok(messenger360.includes('خلاصه وضعیت ۳۶۰ درجه'));
  assert.ok(messenger360.includes(firstStudent.fullName));
});

test('Phase 4 Electronic Forms: tracking partition, pending messenger list & UTF-8 BOM CSV', () => {
  const schoolStudents = seed.students.filter((s) => s.schoolId === 'school-1' && s.active);
  const schoolClasses = seed.classes.filter((c) => c.schoolId === 'school-1');
  const form: ElectronicForm = seed.electronic_forms[0];
  const resp: ElectronicFormResponse = {
    id: 'r1',
    schoolId: 'school-1',
    formId: form.id,
    studentId: schoolStudents[0].id,
    classId: schoolStudents[0].classId,
    parentUserId: `parent-${schoolStudents[0].id}`,
    parentName: schoolStudents[0].parentName,
    answers: { 'fld-agree': 'بله، موافقم' },
    signatureDataUrl: 'data:image/png;base64,AAA',
    fallbackConfirmed: false,
    submittedAtJalali: '1405/09/01',
    submittedAtTime: '11:15',
    submittedAtIso: '2026-11-21T07:45:00Z',
  };

  const part = partitionFormResponses(form, schoolStudents, [resp]);
  assert.equal(part.signedCount, 1);
  assert.equal(part.pendingStudents.length, part.totalCount - 1);

  const csv = buildFormResponsesCsv({ form, partition: part, classes: schoolClasses });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(schoolStudents[0].fullName));
  assert.ok(csv.includes('امضای دیجیتال لمسی'));

  const pendingMsg = formatPendingParentsMessenger({
    schoolName: 'دبستان شهدای دانش',
    form,
    pendingStudents: part.pendingStudents,
    classes: schoolClasses,
    jalaliDate: '1405/09/01',
  });
  assert.ok(pendingMsg.includes('در انتظار تکمیل و امضا'));
});

test('Phase 4 Notification Templates: dynamic variables, Persian digits & today absentees batch', () => {
  const rendered = renderNotificationTemplate(
    'ولی گرامی {نام_دانشآموز} در کلاس {نام_کلاس} ({نام_مدرسه}) مورخ {تاریخ_امروز}: {توضیحات} — {نام_معلم} ({نام_درس})',
    {
      studentName: 'امیرعلی محمدی',
      className: 'چهارم الف',
      schoolName: 'دبستان شهدای دانش',
      todayJalali: '1405/09/01',
      teacherName: 'استاد کریمی',
      subjectName: 'ریاضی',
      notes: 'نمره 20 کسب شد',
    }
  );
  assert.ok(rendered.includes('امیرعلی محمدی'));
  assert.ok(rendered.includes('۱۴۰۵/۰۹/۰۱'));
  assert.ok(rendered.includes('۲۰'));
  assert.equal(rendered.includes('{نام_دانشآموز}'), false);

  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1');
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const absentees = getTodaysAbsentOrLateStudents({
    jalaliDate: '1405/09/01',
    students: s1Students,
    attendanceRecords: [
      {
        id: 'att-test-1',
        schoolId: 'school-1',
        classId: s1Students[0].classId,
        studentId: s1Students[0].id,
        jalaliDate: '1405/09/01',
        period: 1,
        status: 'absent',
        recordedBy: 'teacher',
        updatedAt: '2026-11-21T05:00:00Z',
      },
    ],
  });
  assert.equal(absentees.length, 1);

  const batch = renderBatchNotificationMessages({
    body: 'سلام ولی {نام_دانشآموز}',
    students: s1Students.slice(0, 2),
    classes: s1Classes,
    schoolName: 'دبستان شهدای دانش',
    todayJalali: '1405/09/01',
    teacherName: 'معلم',
    subjectName: 'ریاضی',
    notes: '',
  });
  assert.ok(batch.includes('────────────────────'));
});

test('Phase 4 RBAC Enforcement Matrix: strict boundaries across parent, student, teacher & principal', () => {
  // Student CANNOT write appointments, electronic forms, notification templates, or room modes
  assert.equal(
    authorizeMutation(studentCtx, 'appointment_slots', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'electronic_form_responses', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-1' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'notification_templates', 'write', { schoolId: 'school-1' })
      .allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'class_chat_rooms', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    false
  );

  // Student CAN post text to own class chat with own sender identity (spoofing another userId is blocked)
  assert.equal(
    authorizeMutation(studentCtx, 'class_chat_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: {
        kind: 'text',
        classId: 'school-1-c-1',
        senderRole: 'student',
        senderUserId: 'student-school-1-s-1',
      },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(studentCtx, 'class_chat_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: {
        kind: 'text',
        classId: 'school-1-c-1',
        senderRole: 'teacher',
        senderUserId: 'teacher-1',
      },
    }).allowed,
    false
  );

  // Parent CAN book appointment for own child & sign electronic form for own child
  assert.equal(
    authorizeMutation(parentCtx, 'appointment_slots', 'write', {
      schoolId: 'school-1',
      record: {
        status: 'booked',
        bookedStudentId: 'school-1-s-1',
        bookedByParentUserId: 'parent-school-1-s-1',
      },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(parentCtx, 'appointment_slots', 'write', {
      schoolId: 'school-1',
      record: {
        status: 'booked',
        bookedStudentId: 'school-1-s-2',
        bookedByParentUserId: 'parent-school-1-s-1',
      },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'electronic_form_responses', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-1', parentUserId: 'parent-school-1-s-1' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(parentCtx, 'electronic_form_responses', 'write', {
      schoolId: 'school-1',
      record: { studentId: 'school-1-s-2', parentUserId: 'parent-school-1-s-1' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'notification_templates', 'write', { schoolId: 'school-1' })
      .allowed,
    false
  );

  // Teacher & Principal permissions
  assert.equal(
    authorizeMutation(teacherCtx, 'class_chat_rooms', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'class_chat_rooms', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-2',
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(principalCtx, 'notification_templates', 'write', { schoolId: 'school-1' })
      .allowed,
    true
  );
});

test('Phase 4 Non-Destructive Backup & Restore preserves all 6 Phase 4 stores per school', async () => {
  const repo = new LocalIndexedDBAdapter();
  await repo.init();
  repo.setAuthContext({
    session: {
      userId: 'user-super-admin',
      username: '09120000001',
      displayName: 'راهبر ارشد سامانه',
      role: 'super_admin',
      schoolId: 'school-1',
      isComplexWide: true,
      isSuperAdmin: true,
      loggedInAt: '2026-11-21T08:00:00Z',
    },
    teacherAssignedClassIds: [],
  });

  const singleBackup = await repo.exportSchoolBackup('school-1');
  assert.equal(validateBackupPayload(singleBackup).valid, true);
  assert.ok((singleBackup.data.class_chat_messages?.length ?? 0) >= 2);
  assert.ok((singleBackup.data.appointment_slots?.length ?? 0) >= 4);
  assert.ok((singleBackup.data.electronic_forms?.length ?? 0) >= 1);
  assert.ok((singleBackup.data.notification_templates?.length ?? 0) >= 6);

  // Disable a Phase 4 plugin non-destructively and confirm its data stays intact in backup
  await repo.putItem('school_plugin_states', {
    id: 'school-1:notification-templates',
    schoolId: 'school-1',
    pluginId: 'notification-templates',
    installed: false,
    enabled: false,
    updatedAt: new Date().toISOString(),
    updatedBy: 'مدیر کل',
  });
  const backupAfterDisable = await repo.exportSchoolBackup('school-1');
  assert.equal(
    backupAfterDisable.data.notification_templates?.length,
    singleBackup.data.notification_templates?.length
  );

  // Restore round-trip
  await repo.restoreBackup(backupAfterDisable);
  const snap = repo.getSyncSnapshot();
  assert.ok(snap.notification_templates.filter((t) => t.schoolId === 'school-1').length >= 6);
});
