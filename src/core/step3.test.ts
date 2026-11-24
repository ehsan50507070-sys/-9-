// Step 3 Comprehensive Unit Tests
// Covers: Subject-Centric Hub & Quick Search, Smart 3-Tier Student/Teacher CSV Import,
// Smart Content Archive filtering, Internal Notification Center (persistent homework + teacher trackers),
// Safe Selective Reset snapshots, and Live Repository Subscription.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArchiveCatalogPrintHtml,
  filterSmartArchiveItems,
} from './archive/archiveHelpers';
import { LocalIndexedDBAdapter } from './data/LocalIndexedDBAdapter';
import {
  buildImportReportPrintHtml,
  buildStandardStudentTemplateCsv,
  buildStandardTeacherTemplateCsv,
  buildStudentsFromValidImportRows,
  buildTeachersFromValidImportRows,
  parseAndValidateStudentCsv,
  parseAndValidateTeacherCsv,
} from './directory/smartCsvImport';
import { computeInternalNotifications } from './notifications/notificationHelpers';
import {
  getSelectiveResetModuleMeta,
  parseModuleSnapshot,
  SELECTIVE_RESET_MODULES,
  serializeModuleSnapshot,
} from './settings/recoveryHelpers';
import {
  buildSubjectRoute,
  collectSubjectsForContext,
  encodeSubjectSlug,
  extractSubjectFromPath,
  parseSubjectTabParam,
  runQuickPortalSearch,
} from './subjects/subjectHelpers';
import type {
  ClassChatMessage,
  ClassRoom,
  FlippedVideoLesson,
  GradebookEntry,
  HomeworkAssignment,
  HomeworkSubmission,
  MediaResource,
  OnlineExam,
  ParentStaffMessage,
  SchoolAnnouncement,
  SmartContentArchiveItem,
  Student,
  Teacher,
} from '../types/domain';

const sampleClasses: ClassRoom[] = [
  {
    id: 'cls-1',
    schoolId: 'school-1',
    name: 'پایه پنجم - کلاس الف',
    gradeLevel: 5,
    section: 'الف',
    homeroomTeacherId: 't-1',
    roomCode: '501',
    capacity: 28,
  },
  {
    id: 'cls-2',
    schoolId: 'school-1',
    name: 'پایه ششم - کلاس الف',
    gradeLevel: 6,
    section: 'الف',
    homeroomTeacherId: 't-2',
    roomCode: '601',
    capacity: 28,
  },
];

// ---------------------------------------------------------------------------
// 1. Subject-Centric Hub & Instant Quick Search
// ---------------------------------------------------------------------------
test('Step 3: Subject slug encoding, dynamic route extraction & tab parsing', () => {
  const slug = encodeSubjectSlug('فارسی و نگارش');
  assert.ok(!slug.includes(' '));

  const route = buildSubjectRoute('ریاضی', 'videos');
  assert.equal(route, `/subjects/${encodeURIComponent('ریاضی')}?tab=videos`);

  const extracted = extractSubjectFromPath(`/subjects/${encodeURIComponent('علوم تجربی')}`);
  assert.equal(extracted, 'علوم تجربی');
  assert.equal(extractSubjectFromPath('/dashboard'), null);

  assert.equal(parseSubjectTabParam('exams'), 'exams');
  assert.equal(parseSubjectTabParam('announcements'), 'announcements');
  assert.equal(parseSubjectTabParam('invalid-tab'), 'homework');
  assert.equal(parseSubjectTabParam(null), 'homework');
});

test('Step 3: collectSubjectsForContext sorts Persian subjects alphabetically and counts pending homework', () => {
  const hw1: HomeworkAssignment = {
    id: 'hw-1',
    schoolId: 'school-1',
    classId: 'cls-1',
    subject: 'ریاضی',
    title: 'تمرین کسرها',
    description: 'صفحه ۲۵ کتاب ریاضی',
    dueDateJalali: '1404/08/10',
    createdAtJalali: '1404/08/01',
    teacherId: 't-1',
    teacherName: 'استاد کریمی',
    maxScore: 20,
    createdAt: '2025-10-23T08:00:00.000Z',
  };
  const hw2: HomeworkAssignment = {
    ...hw1,
    id: 'hw-2',
    subject: 'علوم تجربی',
    title: 'گزارش آزمایش آهنربا',
  };
  const sub1: HomeworkSubmission = {
    id: 'sub-1',
    schoolId: 'school-1',
    assignmentId: 'hw-1',
    studentId: 'st-1',
    classId: 'cls-1',
    status: 'submitted',
    answerText: 'انجام شد',
    submittedAtJalali: '1404/08/02',
    submittedAtIso: '2025-10-24T08:00:00.000Z',
  };

  const cards = collectSubjectsForContext({
    role: 'student',
    linkedStudentId: 'st-1',
    classes: [sampleClasses[0]],
    schedules: [],
    teachersById: new Map([['t-1', 'استاد کریمی']]),
    homeworkAssignments: [hw2, hw1],
    homeworkSubmissions: [sub1],
    flippedLessons: [],
    onlineExams: [],
    mockExams: [],
    mediaResources: [],
    questionBank: [],
    gradebookEntries: [] as GradebookEntry[],
    schoolAnnouncements: [],
    smartContentArchive: [],
  });

  assert.equal(cards.length, 2);
  // Persian alphabetical order: ریاضی comes before علوم تجربی
  assert.equal(cards[0].subject, 'ریاضی');
  assert.equal(cards[0].pendingHomeworkCount, 0);
  assert.equal(cards[1].subject, 'علوم تجربی');
  assert.equal(cards[1].pendingHomeworkCount, 1);
});

test('Step 3: runQuickPortalSearch finds cross-entity items and hides parent-staff messages from students', () => {
  const hw: HomeworkAssignment = {
    id: 'hw-10',
    schoolId: 'school-1',
    classId: 'cls-1',
    subject: 'ریاضی',
    title: 'تمرین هندسه فضایی',
    description: 'محاسبه حجم مکعب',
    dueDateJalali: '1404/08/20',
    createdAtJalali: '1404/08/05',
    teacherId: 't-1',
    teacherName: 'استاد رحیمی',
    maxScore: 20,
    createdAt: '2025-10-25T08:00:00.000Z',
  };
  const video: FlippedVideoLesson = {
    id: 'vid-1',
    schoolId: 'school-1',
    classId: 'cls-1',
    subject: 'ریاضی',
    title: 'آموزش هندسه مقدماتی',
    description: 'فیلم تدریس فصل سوم',
    deadlineJalali: '1404/08/20',
    videoSource: 'demo_60s',
    durationSeconds: 720,
    teacherId: 't-1',
    teacherName: 'استاد رحیمی',
    createdAtJalali: '1404/08/04',
    microQuiz: [],
    createdAt: '2025-10-25T08:00:00.000Z',
    updatedAt: '2025-10-25T08:00:00.000Z',
  };
  const exam: OnlineExam = {
    id: 'ex-1',
    schoolId: 'school-1',
    classId: 'cls-1',
    subject: 'ریاضی',
    title: 'آزمونک هندسه',
    description: 'پنج سوال تستی',
    teacherId: 't-1',
    teacherName: 'استاد رحیمی',
    startDateJalali: '1404/08/18',
    endDateJalali: '1404/08/22',
    durationMinutes: 15,
    randomizeOrder: false,
    showResultImmediately: true,
    status: 'published',
    questions: [],
    totalPoints: 20,
    createdAtJalali: '1404/08/05',
    createdAt: '2025-10-25T08:00:00.000Z',
    updatedAt: '2025-10-25T08:00:00.000Z',
  };
  const parentMsg: ParentStaffMessage = {
    id: 'pmsg-1',
    schoolId: 'school-1',
    studentId: 'st-1',
    classId: 'cls-1',
    channelType: 'teacher',
    senderRole: 'teacher',
    senderUserId: 'u-t1',
    senderName: 'استاد رحیمی',
    text: 'پیام محرمانه درباره پیشرفت هندسه دانش‌آموز',
    jalaliDate: '1404/08/06',
    timeText: '10:15',
    readByParent: false,
    readByStaff: true,
    createdAt: '2025-10-25T08:00:00.000Z',
  };
  const classMsg: ClassChatMessage = {
    id: 'cmsg-1',
    schoolId: 'school-1',
    classId: 'cls-1',
    kind: 'text',
    senderRole: 'teacher',
    senderUserId: 'u-t1',
    senderName: 'استاد رحیمی',
    text: 'نکته مهم درباره تمرین هندسه فردا',
    jalaliDate: '1404/08/06',
    timeText: '11:00',
    createdAt: '2025-10-25T08:00:00.000Z',
  };
  const announcement: SchoolAnnouncement = {
    id: 'ann-1',
    complexId: 'complex-1',
    schoolId: 'school-1',
    academicYearId: '1404-1405',
    title: 'مسابقه هندسه و خلاقیت',
    body: 'برگزاری المپیاد داخلی مدرسه',
    scope: 'subject',
    subject: 'ریاضی',
    audienceRoles: ['student', 'parent'],
    pinned: true,
    authorName: 'مدیریت مدرسه',
    authorRole: 'principal',
    publishedAtJalali: '1404/08/05',
    createdAtIso: '2025-10-25T08:00:00.000Z',
    updatedAtIso: '2025-10-25T08:00:00.000Z',
    createdByUserId: 'u-p1',
  };

  const studentResults = runQuickPortalSearch({
    query: 'هندسه',
    role: 'student',
    linkedStudentId: 'st-1',
    subjects: [],
    homeworkAssignments: [hw],
    homeworkSubmissions: [],
    flippedLessons: [video],
    onlineExams: [exam],
    mediaResources: [] as MediaResource[],
    schoolAnnouncements: [announcement],
    parentStaffMessages: [parentMsg],
    classChatMessages: [classMsg],
  });

  // Student should see homework, video, exam, announcement, class message — NOT private parentMsg
  assert.ok(studentResults.some((r) => r.kind === 'homework'));
  assert.ok(studentResults.some((r) => r.kind === 'video'));
  assert.ok(studentResults.some((r) => r.kind === 'exam'));
  assert.ok(studentResults.some((r) => r.kind === 'announcement'));
  assert.ok(studentResults.some((r) => r.id === 'cmsg-cmsg-1'));
  assert.ok(!studentResults.some((r) => r.id === 'pmsg-pmsg-1'));

  const parentResults = runQuickPortalSearch({
    query: 'هندسه',
    role: 'parent',
    linkedStudentId: 'st-1',
    subjects: [],
    homeworkAssignments: [hw],
    homeworkSubmissions: [],
    flippedLessons: [video],
    onlineExams: [exam],
    mediaResources: [],
    schoolAnnouncements: [announcement],
    parentStaffMessages: [parentMsg],
    classChatMessages: [classMsg],
  });
  assert.ok(parentResults.some((r) => r.id === 'pmsg-pmsg-1'));
});

// ---------------------------------------------------------------------------
// 2. Zero-Dependency Smart Excel / CSV Importer (Students + Teachers)
// ---------------------------------------------------------------------------
test('Step 3: parseAndValidateStudentCsv classifies Valid/Incomplete/Duplicate buckets and generates distinct dual credentials', () => {
  const existingStudent: Student = {
    id: 'st-existing',
    schoolId: 'school-1',
    classId: 'cls-1',
    fullName: 'امیرحسین رضایی',
    nationalId: '0084567892',
    studentCode: '145001',
    parentName: 'محمد رضایی',
    parentMobile: '09121112233',
    active: true,
  };

  const csv = [
    'نام,نام خانوادگی,کد ملی,نام ولی,شماره موبایل ولی,پایه,کلاس',
    'آرمین,کاظمی,0013520849,حسین کاظمی,09127654321,پایه پنجم,پایه پنجم - کلاس الف',
    'امیرحسین,رضایی,0084567892,محمد رضایی,09121112233,پایه پنجم,پایه پنجم - کلاس الف',
    'تکراری,در فایل,0013520849,ولی تکراری,09129998877,پایه پنجم,پایه پنجم - کلاس الف',
    'سارا,ناقص,12345,ولی ناقص,,پایه پنجم,پایه پنجم - کلاس الف',
  ].join('\n');

  const summary = parseAndValidateStudentCsv({
    csvText: csv,
    classes: sampleClasses,
    existingStudents: [existingStudent],
  });

  assert.equal(summary.validCount, 1);
  assert.equal(summary.duplicateCount, 2);
  assert.equal(summary.incompleteCount, 1);

  const validRow = summary.rows.find((r) => r.status === 'valid');
  assert.ok(validRow);
  assert.equal(validRow.generatedStudentUsername, 'st-0013520849');
  assert.equal(validRow.generatedParentUsername, 'pr-0013520849');

  const incompleteRow = summary.rows.find((r) => r.status === 'incomplete');
  assert.ok(incompleteRow);
  assert.ok(incompleteRow.reasons.some((r) => r.includes('کد ملی')));
  assert.ok(incompleteRow.reasons.some((r) => r.includes('شماره موبایل ولی')));

  const builtStudents = buildStudentsFromValidImportRows({
    validRows: summary.rows.filter((r) => r.status === 'valid'),
    schoolId: 'school-1',
    existingCount: 1,
  });
  assert.equal(builtStudents.length, 1);
  assert.equal(builtStudents[0].studentUsername, 'st-0013520849');
  assert.equal(builtStudents[0].parentUsername, 'pr-0013520849');
  assert.ok(builtStudents[0].studentPasswordHash);
  assert.ok(builtStudents[0].parentPasswordHash);
  assert.notEqual(builtStudents[0].studentPasswordHash, builtStudents[0].parentPasswordHash);
});

test('Step 3: parseAndValidateTeacherCsv validates teachers and standard templates include UTF-8 BOM', () => {
  const existingTeacher: Teacher = {
    id: 't-existing',
    schoolId: 'school-1',
    fullName: 'مریم جلالی',
    nationalId: '0084567892',
    personnelCode: '1001',
    mobile: '09123334455',
    specialty: 'ریاضی',
    assignedClassIds: ['cls-1'],
    weeklyQuotaPeriods: 16,
    active: true,
  };

  const csv = [
    'نام,نام خانوادگی,کد ملی,شماره موبایل,تخصص,کد پرسنلی,ساعات هفتگی,کلاس',
    'علی,موسوی,0013520849,09126663344,علوم تجربی,1046,18,پایه ششم - کلاس الف',
    'مریم,جلالی,0084567892,09123334455,ریاضی,1001,16,پایه پنجم - کلاس الف',
    'همکار,ناقص,,0912111,فارسی,1047,16,پایه پنجم - کلاس الف',
  ].join('\n');

  const summary = parseAndValidateTeacherCsv({
    csvText: csv,
    classes: sampleClasses,
    existingTeachers: [existingTeacher],
  });

  assert.equal(summary.validCount, 1);
  assert.equal(summary.duplicateCount, 1);
  assert.equal(summary.incompleteCount, 1);

  const builtTeachers = buildTeachersFromValidImportRows({
    validRows: summary.rows.filter((r) => r.status === 'valid'),
    schoolId: 'school-1',
  });
  assert.equal(builtTeachers.length, 1);
  assert.ok(builtTeachers[0].passwordHash);
  assert.equal(builtTeachers[0].assignedClassIds[0], 'cls-2');

  const stTemplate = buildStandardStudentTemplateCsv('پایه پنجم - کلاس الف');
  const tTemplate = buildStandardTeacherTemplateCsv('پایه پنجم - کلاس الف');
  assert.ok(stTemplate.startsWith('\uFEFF'));
  assert.ok(tTemplate.startsWith('\uFEFF'));

  const printHtml = buildImportReportPrintHtml({
    title: 'گزارش ورود اکسل',
    schoolName: 'دبستان گلستان راه روشن',
    jalaliDate: '1404/08/10',
    validCount: 1,
    incompleteCount: 1,
    duplicateCount: 1,
    rows: summary.rows.map((r) => ({
      rowNumber: r.rowNumber,
      fullName: r.fullName,
      nationalId: r.nationalId,
      extraInfo: r.specialty,
      status: r.status,
      reasons: r.reasons,
    })),
  });
  assert.ok(printHtml.includes('گزارش ورود اکسل'));
  assert.ok(printHtml.includes('سالم و آماده ثبت'));
});

// ---------------------------------------------------------------------------
// 3. Smart Content & Video Archive Filtering & Printable Catalog
// ---------------------------------------------------------------------------
test('Step 3: filterSmartArchiveItems filters across year, grade, subject, teacher, contentType, tag & query', () => {
  const items: SmartContentArchiveItem[] = [
    {
      id: 'arch-1',
      complexId: 'complex-1',
      schoolId: 'school-1',
      academicYearId: '1404-1405',
      title: 'ویدیوی آموزش کسر متعارفی',
      description: 'تدریس گام به گام فصل دوم ریاضی',
      contentType: 'video',
      subject: 'ریاضی',
      gradeLevel: 5,
      gradeLabel: 'پایه پنجم',
      teacherId: 't-1',
      teacherName: 'استاد کریمی',
      tags: ['فصل۲', 'کسر'],
      createdAtJalali: '1404/08/01',
      reuseCount: 2,
      reusedInClassIds: [],
      createdAtIso: '2025-10-20T08:00:00.000Z',
      updatedAtIso: '2025-10-25T08:00:00.000Z',
      createdByUserId: 'u-t1',
    },
    {
      id: 'arch-2',
      complexId: 'complex-1',
      schoolId: 'school-1',
      academicYearId: '1403-1404',
      title: 'جزوه آزمایشگاه علوم ششم',
      description: 'نکات امتحانی نوبت اول',
      contentType: 'handout',
      subject: 'علوم تجربی',
      gradeLevel: 6,
      gradeLabel: 'پایه ششم',
      teacherId: 't-2',
      teacherName: 'استاد موسوی',
      tags: ['نوبت اول'],
      createdAtJalali: '1403/09/15',
      reuseCount: 5,
      reusedInClassIds: [],
      createdAtIso: '2024-12-05T08:00:00.000Z',
      updatedAtIso: '2024-12-05T08:00:00.000Z',
      createdByUserId: 'u-t2',
    },
  ];

  const byYearAndType = filterSmartArchiveItems(items, {
    query: '',
    academicYearId: '1404-1405',
    gradeLevel: '5',
    subject: 'ریاضی',
    teacherName: 'استاد کریمی',
    contentType: 'video',
    tag: 'کسر',
  });
  assert.equal(byYearAndType.length, 1);
  assert.equal(byYearAndType[0].id, 'arch-1');

  const byQuery = filterSmartArchiveItems(items, {
    query: 'آزمایشگاه',
    academicYearId: 'all',
    gradeLevel: 'all',
    subject: 'all',
    teacherName: 'all',
    contentType: 'all',
    tag: 'all',
  });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].id, 'arch-2');

  const html = buildArchiveCatalogPrintHtml({
    schoolName: 'دبستان گلستان راه روشن',
    jalaliDate: '1404/08/10',
    items,
  });
  assert.ok(html.includes('آرشیو هوشمند محتوا'));
  assert.ok(html.includes('ویدیوی آموزش کسر متعارفی'));
});

// ---------------------------------------------------------------------------
// 4. Internal Notification Center (Persistent Homework + Teacher Trackers)
// ---------------------------------------------------------------------------
test('Step 3: computeInternalNotifications persists student homework until submission and builds teacher submission tracker', () => {
  const students: Student[] = [
    {
      id: 'st-1',
      schoolId: 'school-1',
      classId: 'cls-1',
      fullName: 'آرمین کاظمی',
      nationalId: '0013520849',
      studentCode: '145001',
      parentName: 'حسین کاظمی',
      parentMobile: '09127654321',
      active: true,
    },
    {
      id: 'st-2',
      schoolId: 'school-1',
      classId: 'cls-1',
      fullName: 'سهیل محمدپور',
      nationalId: '0084567892',
      studentCode: '145002',
      parentName: 'مهدی محمدپور',
      parentMobile: '09123456789',
      active: true,
    },
  ];
  const hw: HomeworkAssignment = {
    id: 'hw-1',
    schoolId: 'school-1',
    classId: 'cls-1',
    subject: 'ریاضی',
    title: 'تمرین جمع و تفریق',
    description: 'صفحه ۱۲',
    dueDateJalali: '1404/08/12',
    createdAtJalali: '1404/08/05',
    teacherId: 't-1',
    teacherName: 'استاد کریمی',
    maxScore: 20,
    createdAt: '2025-10-25T08:00:00.000Z',
  };

  // Before st-1 submits: persistent homework alert must exist and cannot be dismissed by read
  const beforeSubmit = computeInternalNotifications({
    role: 'student',
    userId: 'u-st-1',
    linkedStudentId: 'st-1',
    classes: [sampleClasses[0]],
    students,
    homeworkAssignments: [hw],
    homeworkSubmissions: [],
    parentStaffMessages: [],
    classChatMessages: [],
    schoolAnnouncements: [],
    readReceipts: [],
  });
  assert.equal(beforeSubmit.homeworkAlertCount, 1);
  assert.equal(beforeSubmit.sidebarBadges.subjects, 1);
  assert.equal(beforeSubmit.sidebarBadges.homework, 1);
  assert.equal(beforeSubmit.items[0].canDismissByRead, false);

  // After st-1 submits: homework alert disappears for st-1
  const submission: HomeworkSubmission = {
    id: 'sub-1',
    schoolId: 'school-1',
    assignmentId: 'hw-1',
    studentId: 'st-1',
    classId: 'cls-1',
    status: 'submitted',
    answerText: 'ارسال شد',
    submittedAtJalali: '1404/08/06',
    submittedAtIso: '2025-10-26T08:00:00.000Z',
  };
  const afterSubmit = computeInternalNotifications({
    role: 'student',
    userId: 'u-st-1',
    linkedStudentId: 'st-1',
    classes: [sampleClasses[0]],
    students,
    homeworkAssignments: [hw],
    homeworkSubmissions: [submission],
    parentStaffMessages: [],
    classChatMessages: [],
    schoolAnnouncements: [],
    readReceipts: [],
  });
  assert.equal(afterSubmit.homeworkAlertCount, 0);
  assert.equal(afterSubmit.totalUnreadCount, 0);
  assert.equal(afterSubmit.sidebarBadges.subjects, undefined);

  // Teacher tracker accurately splits submitted (st-1) vs missing (st-2)
  const teacherState = computeInternalNotifications({
    role: 'teacher',
    userId: 'u-t-1',
    linkedTeacherId: 't-1',
    classes: [sampleClasses[0]],
    students,
    homeworkAssignments: [hw],
    homeworkSubmissions: [submission],
    parentStaffMessages: [],
    classChatMessages: [],
    schoolAnnouncements: [],
    readReceipts: [],
  });
  assert.equal(teacherState.teacherHomeworkTrackers.length, 1);
  assert.equal(teacherState.teacherHomeworkTrackers[0].submittedStudents.length, 1);
  assert.equal(teacherState.teacherHomeworkTrackers[0].submittedStudents[0].id, 'st-1');
  assert.equal(teacherState.teacherHomeworkTrackers[0].missingStudents.length, 1);
  assert.equal(teacherState.teacherHomeworkTrackers[0].missingStudents[0].id, 'st-2');
});

// ---------------------------------------------------------------------------
// 5. Safe Selective Reset & Restore Last State Helpers
// ---------------------------------------------------------------------------
test('Step 3: Recovery snapshot serialization/parsing and selective reset modules integrity', () => {
  assert.equal(SELECTIVE_RESET_MODULES.length, 5);
  const hwMeta = getSelectiveResetModuleMeta('homework');
  assert.deepEqual(hwMeta.collections, ['homework_assignments', 'homework_submissions']);

  const json = serializeModuleSnapshot({
    version: 1,
    schoolId: 'school-1',
    moduleKey: 'homework',
    collections: {
      homework_assignments: [{ id: 'hw-1' }],
      homework_submissions: [],
    },
  });
  const parsed = parseModuleSnapshot(json);
  assert.ok(parsed);
  assert.equal(parsed.schoolId, 'school-1');
  assert.equal(parsed.moduleKey, 'homework');
  assert.equal(parsed.collections.homework_assignments?.length, 1);

  assert.equal(parseModuleSnapshot('invalid-json'), null);
  assert.equal(parseModuleSnapshot(JSON.stringify({ version: 2 })), null);
});

// ---------------------------------------------------------------------------
// 6. Live Repository Subscription (Cross-Panel Live Sync)
// ---------------------------------------------------------------------------
test('Step 3: LocalIndexedDBAdapter.subscribe emits live events on putItem/deleteItem', async () => {
  const repo = new LocalIndexedDBAdapter();
  await repo.init();
  repo.setAuthContext({
    session: {
      userId: 'u-p1',
      username: 'principal1',
      displayName: 'مدیر مدرسه',
      role: 'principal',
      schoolId: 'school-1',
      complexId: 'complex-1',
      isComplexWide: false,
      loggedInAt: '2025-10-28T08:00:00.000Z',
    },
  });

  const received: Array<{ collection?: string; type: string }> = [];
  const unsubscribe = repo.subscribe((ev) => {
    received.push({ collection: ev.collection, type: ev.type });
  });

  const ann: SchoolAnnouncement = {
    id: 'test-ann-sync-1',
    complexId: 'complex-1',
    schoolId: 'school-1',
    academicYearId: '1404-1405',
    title: 'اطلاعیه آزمایشی همگام‌سازی',
    body: 'متن اطلاعیه آزمایشی',
    scope: 'school',
    audienceRoles: ['student', 'parent'],
    pinned: false,
    authorName: 'مدیر مدرسه',
    authorRole: 'principal',
    publishedAtJalali: '1404/08/10',
    createdAtIso: '2025-10-28T08:00:00.000Z',
    updatedAtIso: '2025-10-28T08:00:00.000Z',
    createdByUserId: 'u-p1',
  };

  await repo.putItem('school_announcements', ann);
  await repo.deleteItem('school_announcements', 'school-1', ann.id);

  unsubscribe();

  assert.ok(
    received.some((e) => e.collection === 'school_announcements' && e.type === 'put')
  );
  assert.ok(
    received.some((e) => e.collection === 'school_announcements' && e.type === 'delete')
  );
});
