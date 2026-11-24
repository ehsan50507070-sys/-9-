// Comprehensive Phase 5 Unit Test Suite (node:test)
// Covers: SIDA Bridge CSV & Mod-11 validation, Grade Export, Exam 3-Way Conflict Detector,
// Checkerboard Seating Algorithm + Swap, Electronic Profiles Validators & Timelines,
// Strict 6-Role RBAC Policy Matrix, and Single-School / Complex-Wide Backup & Restore.
import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation } from '../core/auth/policy';
import { ROLE_DEFINITIONS } from '../core/auth/rbac';
import { LocalIndexedDBAdapter } from '../core/data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../core/data/seedData';
import {
  buildValidIranianNationalId,
  validateBackupPayload,
} from '../core/validation/validators';
import {
  aggregateStaffAttendanceSummary,
  aggregateStudentTimeline,
  buildStaffProfilesCsv,
  buildStudentProfilesCsv,
  computeStaffProfileCompleteness,
  computeStudentProfileCompleteness,
  MAX_PROFILE_IMAGE_BYTES,
  MAX_PROFILE_PDF_BYTES,
  validateProfileDocumentFile,
} from './electronic-profiles/electronicProfilesHelpers';
import {
  chunkArray,
  detectExamScheduleConflicts,
  evaluateSeatingAdjacency,
  formatExamScheduleMessenger,
  generateCheckerboardSeating,
  swapSeatsInGrid,
} from './exams-management/examsManagementHelpers';
import {
  buildSidaGradeExportCsv,
  buildSidaGradeExportRows,
  buildSidaSampleCsv,
  buildStudentAndProfileFromSidaRow,
  detectCsvDelimiter,
  formatObjectionResolutionMessenger,
  parseSidaCsvRaw,
  validateSidaImportRows,
} from './sida-bridge/sidaBridgeHelpers';

test('Phase 5 — SIDA CSV parser handles UTF-8 BOM, comma/semicolon delimiters & quoted fields', () => {
  const sampleCsv = buildSidaSampleCsv();
  assert.equal(sampleCsv.startsWith('\uFEFF'), true, 'Sample CSV must include UTF-8 BOM');
  assert.equal(detectCsvDelimiter(sampleCsv), ',');

  const parsedComma = parseSidaCsvRaw(sampleCsv);
  assert.equal(parsedComma.headers.length, 7);
  assert.equal(parsedComma.rows.length, 3);

  const semiCsv =
    '\uFEFFکد ملی;نام;نام خانوادگی;نام پدر;پایه;نام کلاس;شماره تماس ولی\n' +
    `${buildValidIranianNationalId('002499101')};"امیر علی";رضایی;حسین;دوم;"پایه دوم - کلاس الف";09121112233`;
  assert.equal(detectCsvDelimiter(semiCsv), ';');
  const parsedSemi = parseSidaCsvRaw(semiCsv);
  assert.equal(parsedSemi.rows.length, 1);
  assert.equal(parsedSemi.rows[0][1], 'امیر علی');
  assert.equal(parsedSemi.rows[0][5], 'پایه دوم - کلاس الف');
});

test('Phase 5 — SIDA strict mod-11 National ID validation categorizes Valid/Duplicate/Invalid & auto-generates dual credentials', () => {
  const seed = generateSeedDataset();
  const school1Students = seed.students.filter((s) => s.schoolId === 'school-1');
  const school1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const existingNid = school1Students[0].nationalId;
  const freshValidNid = buildValidIranianNationalId('002881122');

  const rawCsv = [
    'کد ملی,نام,نام خانوادگی,نام پدر,پایه,نام کلاس,شماره تماس ولی',
    `${freshValidNid},سپهر,کاظمی,رضا,دوم,${school1Classes[0].name},09123334455`, // valid
    `${existingNid},تکراری,نمونه,علی,دوم,${school1Classes[0].name},09123334456`, // duplicate in school
    `1111111111,اشتباه,تکراری,مهدی,دوم,${school1Classes[0].name},09123334457`, // repeating digits
    `1234567899,رقم,کنترلی,حسن,دوم,${school1Classes[0].name},09123334458`, // bad mod-11 check digit
    `00288112,کوتاه,ناقص,جواد,دوم,${school1Classes[0].name},09123334459`, // < 10 digits
  ].join('\n');

  const preview = validateSidaImportRows({
    rawText: rawCsv,
    existingStudents: school1Students,
    classes: school1Classes,
  });

  assert.equal(preview.length, 5);
  assert.equal(preview[0].status, 'valid');
  assert.equal(preview[1].status, 'duplicate');
  assert.equal(preview[2].status, 'invalid');
  assert.equal(preview[3].status, 'invalid');
  assert.equal(preview[4].status, 'invalid');

  // Building student & profile from valid row produces separate hashed student + parent login credentials
  const built = buildStudentAndProfileFromSidaRow({
    row: preview[0],
    schoolId: 'school-1',
    sequenceNumber: 1,
    actorName: 'مدیر آزمایشی',
  });
  assert.ok(built.student.studentUsername && built.student.studentPasswordHash && built.student.studentPasswordSalt);
  assert.ok(built.student.parentUsername && built.student.parentPasswordHash && built.student.parentPasswordSalt);
  assert.equal(built.student.studentPassword, undefined);
  assert.equal(built.student.parentPassword, undefined);
  assert.notEqual(built.student.studentUsername, built.student.parentUsername);
  assert.equal(built.profile.fatherName, 'رضا');
  assert.equal(built.profile.studentId, built.student.id);
});

test('Phase 5 — SIDA Grade Export flags missing scores/invalid NIDs & builds UTF-8 BOM CSV + Messenger reply', () => {
  const seed = generateSeedDataset();
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1').slice(0, 3);
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const s1Gradebook = seed.gradebook_entries.filter((g) => g.schoolId === 'school-1');

  const rows = buildSidaGradeExportRows({
    students: s1Students,
    classes: s1Classes,
    gradebookEntries: s1Gradebook,
    onlineExams: [],
    onlineExamSubmissions: [],
    gradeLevelFilter: 'all',
    classIdFilter: 'all',
    subjectFilter: 'درس‌ناموجود',
    term: 'نوبت اول',
  });

  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.warningsFa.some((w) => w.includes('نمره'))));

  const csv = buildSidaGradeExportCsv(rows);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.ok(csv.includes('کد ملی'));

  const msg = formatObjectionResolutionMessenger({
    schoolName: 'دبستان فرهنگ ۱',
    studentName: s1Students[0].fullName,
    className: s1Classes[0].name,
    appeal: {
      id: 'app-1',
      schoolId: 'school-1',
      gradeEntryId: 'gb-1',
      studentId: s1Students[0].id,
      classId: s1Students[0].classId,
      subject: 'ریاضی',
      jalaliMonth: 'آذر',
      parentReason: 'جمع اشتباه',
      submittedByName: 'ولی نمونه',
      submittedAtJalali: '1405/09/15',
      originalScore: 17,
      revisedScore: 18.5,
      status: 'principal_approved',
      sidaResolutionNote: 'نیم‌نمره سوال ۳ اضافه شد',
      resolvedAtJalali: '1405/09/18',
      updatedAt: new Date().toISOString(),
    },
  });
  assert.ok(msg.includes('تایید اعتراض'));
  assert.ok(msg.includes('۱۸.۵'));
});

test('Phase 5 — In-Person Exams 3-Way Conflict Detector catches class, hall, and proctor overlaps', () => {
  const seed = generateSeedDataset();
  const classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const halls = seed.in_person_exam_halls.filter((h) => h.schoolId === 'school-1');
  const teachers = seed.teachers.filter((t) => t.schoolId === 'school-1');
  const existing = seed.in_person_exam_sessions.filter((s) => s.schoolId === 'school-1');
  assert.ok(existing.length >= 1, 'Seed should include at least 1 in-person exam session');

  const first = existing[0];

  // Triple collision: same date, overlapping time, same class + same hall + same proctor
  const conflicts = detectExamScheduleConflicts({
    candidate: {
      jalaliDate: first.jalaliDate,
      startTime: '09:00',
      endTime: '10:30',
      classIds: [first.classIds[0]],
      hallId: first.hallId,
      proctorTeacherId: first.proctorTeacherId,
    },
    existingSessions: existing,
    classes,
    halls,
    teachers,
  });

  const types = new Set(conflicts.map((c) => c.type));
  assert.equal(types.has('class'), true);
  assert.equal(types.has('hall'), true);
  assert.equal(types.has('proctor'), true);

  // Non-overlapping time slot has zero conflicts
  const noConflicts = detectExamScheduleConflicts({
    candidate: {
      jalaliDate: first.jalaliDate,
      startTime: '14:00',
      endTime: '15:30',
      classIds: [first.classIds[0]],
      hallId: first.hallId,
      proctorTeacherId: first.proctorTeacherId,
    },
    existingSessions: existing,
    classes,
    halls,
    teachers,
  });
  assert.equal(noConflicts.length, 0);

  const messengerText = formatExamScheduleMessenger({
    schoolName: 'دبستان فرهنگ ۱',
    termTitle: first.termTitle,
    sessions: existing,
    classes,
    halls,
    teachers,
  });
  assert.ok(messengerText.includes(first.subject));
});

test('Phase 5 — Checkerboard Seating Algorithm produces 0 orthogonal adjacencies across balanced classes, flags >50% unavoidable cases & re-evaluates manual swaps', () => {
  const seed = generateSeedDataset();
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const classAStudents = seed.students
    .filter((s) => s.schoolId === 'school-1' && s.classId === s1Classes[0].id)
    .slice(0, 6);
  const classBStudents = seed.students
    .filter((s) => s.schoolId === 'school-1' && s.classId === s1Classes[1].id)
    .slice(0, 6);

  // 12 students (6 from class A, 6 from class B) in a 3x4 hall -> guaranteed 0 orthogonal same-class adjacencies
  const balanced = generateCheckerboardSeating({
    rows: 3,
    cols: 4,
    startSeatNumber: 101,
    students: [...classAStudents, ...classBStudents],
  });
  assert.equal(balanced.adjacencyWarningCount, 0, 'Balanced 2-class checkerboard must have 0 adjacencies');
  assert.equal(balanced.unseatedStudentIds.length, 0);

  // Manual swap of seat 101 (row 0, col 0) with seat 102 (row 0, col 1) puts two same-class students adjacent!
  const swapped = swapSeatsInGrid({
    assignments: balanced.assignments,
    rows: 3,
    cols: 4,
    seatNumberA: 101,
    seatNumberB: 102,
  });
  assert.ok(
    swapped.adjacencyWarningCount > 0,
    'Swapping two adjacent alternating seats should immediately trigger adjacency warning'
  );
  const recheck = evaluateSeatingAdjacency(swapped.assignments, 3, 4);
  assert.equal(recheck.adjacentPairCount, swapped.adjacencyWarningCount);

  // Unavoidable case: 6 students all from the SAME class in a 2x3 hall -> must flag warnings
  const singleClassUnavoidable = generateCheckerboardSeating({
    rows: 2,
    cols: 3,
    startSeatNumber: 201,
    students: classAStudents,
  });
  assert.ok(
    singleClassUnavoidable.adjacencyWarningCount > 0,
    'Single-class full hall must report unavoidable orthogonal adjacencies'
  );

  assert.equal(chunkArray([1, 2, 3, 4, 5], 4).length, 2);
});

test('Phase 5 — Electronic Profiles file validator, completeness score, auto timelines & CSV exports', () => {
  // Valid image & PDF
  assert.equal(
    validateProfileDocumentFile({
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2 * 1024 * 1024,
    }).valid,
    true
  );
  assert.equal(
    validateProfileDocumentFile({
      fileName: 'certificate.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8 * 1024 * 1024,
    }).valid,
    true
  );

  // Oversized image (>5MB), oversized PDF (>10MB), unsafe SVG/HTML
  assert.equal(
    validateProfileDocumentFile({
      fileName: 'big.png',
      mimeType: 'image/png',
      sizeBytes: MAX_PROFILE_IMAGE_BYTES + 1,
    }).valid,
    false
  );
  assert.equal(
    validateProfileDocumentFile({
      fileName: 'huge.pdf',
      mimeType: 'application/pdf',
      sizeBytes: MAX_PROFILE_PDF_BYTES + 1,
    }).valid,
    false
  );
  assert.equal(
    validateProfileDocumentFile({
      fileName: 'xss.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 1024,
    }).valid,
    false
  );

  const seed = generateSeedDataset();
  const student = seed.students.find((s) => s.schoolId === 'school-1')!;
  const stProf = seed.student_profiles.find((p) => p.studentId === student.id);
  const stComp = computeStudentProfileCompleteness(student, stProf);
  assert.ok(stComp.percent > 0 && stComp.percent <= 100);

  const timeline = aggregateStudentTimeline({
    studentId: student.id,
    attendance: seed.student_attendance,
    gradebook: seed.gradebook_entries,
    onlineExams: seed.online_exams,
    onlineExamSubmissions: seed.online_exam_submissions,
    rewards: seed.student_rewards,
    electronicForms: seed.electronic_forms,
    electronicFormResponses: seed.electronic_form_responses,
    dailyLogs: seed.daily_logs,
  });
  assert.ok(Array.isArray(timeline));

  const teacher = seed.teachers.find((t) => t.schoolId === 'school-1')!;
  const sfProf = seed.staff_profiles.find((p) => p.teacherId === teacher.id);
  const sfComp = computeStaffProfileCompleteness(teacher, sfProf);
  assert.ok(sfComp.percent > 0 && sfComp.percent <= 100);

  const staffSummary = aggregateStaffAttendanceSummary({
    teacherId: teacher.id,
    teacherName: teacher.fullName,
    staffAttendance: seed.staff_attendance,
    substitutions: seed.substitutions,
    dailyLogs: seed.daily_logs,
  });
  assert.equal(typeof staffSummary.presentPeriods, 'number');

  const stCsv = buildStudentProfilesCsv({
    students: [student],
    classes: seed.classes,
    profiles: seed.student_profiles,
  });
  assert.equal(stCsv.startsWith('\uFEFF'), true);
  assert.ok(stCsv.includes(student.fullName));

  const sfCsv = buildStaffProfilesCsv({
    teachers: [teacher],
    classes: seed.classes,
    profiles: seed.staff_profiles,
  });
  assert.equal(sfCsv.startsWith('\uFEFF'), true);
  assert.ok(sfCsv.includes(teacher.fullName));
});

test('Phase 5 — Strict 6-Role RBAC Policy Matrix enforces all Phase 5 boundaries', () => {
  // Capability matrix sanity checks
  assert.equal(ROLE_DEFINITIONS.principal.canUseSidaBridge, true);
  assert.equal(ROLE_DEFINITIONS.deputy.canImportSidaStudents, true);
  assert.equal(ROLE_DEFINITIONS.teacher.canUseSidaBridge, true);
  assert.equal(ROLE_DEFINITIONS.teacher.canImportSidaStudents, false);
  assert.equal(ROLE_DEFINITIONS.parent.canUseSidaBridge, false);
  assert.equal(ROLE_DEFINITIONS.student.canUseSidaBridge, false);
  assert.equal(ROLE_DEFINITIONS.principal.canViewConfidentialStaffEvaluation, true);
  assert.equal(ROLE_DEFINITIONS.deputy.canViewConfidentialStaffEvaluation, false);
  assert.equal(ROLE_DEFINITIONS.teacher.canViewConfidentialStudentNotes, false);

  // Immutable SIDA audit logs: nobody can delete, only staff can append
  const makeCtx = (
    role: 'principal' | 'deputy' | 'teacher' | 'parent' | 'student',
    opts?: { teacherAssignedClassIds?: string[]; linkedStudentId?: string }
  ) => ({
    session: {
      userId: `u-${role}`,
      username: role,
      displayName: role,
      role,
      schoolId: 'school-1',
      allowedSchoolIds: ['school-1'],
      isComplexWide: false,
      linkedStudentId: opts?.linkedStudentId,
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: opts?.teacherAssignedClassIds ?? [],
  });

  const principalCtx = makeCtx('principal');
  const deputyCtx = makeCtx('deputy');
  const teacherCtx = makeCtx('teacher', { teacherAssignedClassIds: ['school-1-c1'] });
  const parentCtx = makeCtx('parent', { linkedStudentId: 'school-1-s1' });
  const studentCtx = makeCtx('student', { linkedStudentId: 'school-1-s1' });

  assert.equal(
    authorizeMutation(principalCtx, 'sida_grade_audit_logs', 'write', { schoolId: 'school-1' }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(principalCtx, 'sida_grade_audit_logs', 'delete', { schoolId: 'school-1' }).allowed,
    false,
    'SIDA audit logs must be immutable'
  );
  assert.equal(
    authorizeMutation(parentCtx, 'sida_grade_audit_logs', 'write', { schoolId: 'school-1' }).allowed,
    false
  );

  // In-person exam management: Principal/Deputy allowed, Teacher/Parent/Student blocked
  assert.equal(
    authorizeMutation(deputyCtx, 'in_person_exam_sessions', 'write', { schoolId: 'school-1' }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'in_person_exam_sessions', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'exam_seating_charts', 'write', { schoolId: 'school-1' }).allowed,
    false
  );

  // Staff profile confidential evaluation notes: Deputy blocked from writing confidentialEvaluationNotes, Principal allowed
  assert.equal(
    authorizeMutation(deputyCtx, 'staff_profiles', 'write', {
      schoolId: 'school-1',
      record: { confidentialEvaluationNotes: 'یادداشت غیرمجاز معاون' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(deputyCtx, 'staff_profiles', 'write', {
      schoolId: 'school-1',
      record: { academicDegree: 'کارشناسی ارشد' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(principalCtx, 'staff_profiles', 'write', {
      schoolId: 'school-1',
      record: { confidentialEvaluationNotes: 'ارزیابی رسمی مدیر' },
    }).allowed,
    true
  );

  // Student profiles: Teacher/Parent/Student strictly read-only
  assert.equal(
    authorizeMutation(teacherCtx, 'student_profiles', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'student_profiles', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(studentCtx, 'student_profiles', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
});

test('Phase 5 — Single-School & Complex-Wide JSON Backup/Restore preserves all 6 Phase 5 collections', async () => {
  const repo = new LocalIndexedDBAdapter();
  await repo.init();

  const school1Backup = await repo.exportSchoolBackup('school-1');
  const v1 = validateBackupPayload(school1Backup);
  assert.equal(v1.valid, true, `Single-school backup invalid: ${v1.errors.join(', ')}`);
  assert.ok((school1Backup.data.in_person_exam_halls?.length ?? 0) >= 2);
  assert.ok((school1Backup.data.in_person_exam_sessions?.length ?? 0) >= 2);
  assert.ok((school1Backup.data.exam_seating_charts?.length ?? 0) >= 1);
  assert.ok((school1Backup.data.student_profiles?.length ?? 0) >= 1);
  assert.ok((school1Backup.data.staff_profiles?.length ?? 0) >= 1);

  const complexBackup = await repo.exportComplexBackup();
  const v2 = validateBackupPayload(complexBackup);
  assert.equal(v2.valid, true, `Complex backup invalid: ${v2.errors.join(', ')}`);

  // Restore round-trip
  await repo.restoreBackup(school1Backup);
  const hallsAfter = repo
    .getSyncSnapshot()
    .in_person_exam_halls.filter((h) => h.schoolId === 'school-1');
  assert.equal(hallsAfter.length, school1Backup.data.in_person_exam_halls?.length);
});
