import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation } from '../core/auth/policy';
import { generateSeedDataset } from '../core/data/seedData';
import { validateBackupPayload } from '../core/validation/validators';
import type {
  AuthSession,
  BackupPayload,
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevProgress,
} from '../types/domain';
import {
  applyLeaderboardPrivacy,
  buildComplexTeacherDevComparison,
  buildParticipationMatrixCsv,
  buildSchoolLeaderboard,
  buildSchoolMatrixSummaryMessage,
  buildShuffledQuizAttempt,
  buildTeacherReminderMessage,
  calculateTeacherPointsBreakdown,
  computeParticipationMatrix,
  generateCertificateSerial,
  gradeTeacherQuizAttempt,
  isQuizUnlocked,
  resolveTeacherRankTier,
} from './teacher-development/teacherDevHelpers';

function makeSession(
  role: AuthSession['role'],
  schoolId = 'school-1',
  extras: Partial<AuthSession> = {}
): AuthSession {
  return {
    userId: `u-${role}-${schoolId}`,
    username: role,
    displayName: role,
    role,
    schoolId,
    isComplexWide: role === 'complex_admin',
    loggedInAt: new Date().toISOString(),
    ...extras,
  };
}

test('Phase 7 Anti-Cheat Shuffling: deterministic per seed, unique across teachers and attempts, and grades strictly by stable option.id', () => {
  const dataset = generateSeedDataset();
  const course = dataset.td_courses.find(
    (c) => c.schoolId === 'school-1' && c.quizQuestions.length >= 4
  );
  assert.ok(course, 'Expected seeded course with at least 4 quiz questions');

  const a1 = buildShuffledQuizAttempt(course, 'school-1-t-1', 1);
  const a1Repeat = buildShuffledQuizAttempt(course, 'school-1-t-1', 1);
  const a2 = buildShuffledQuizAttempt(course, 'school-1-t-1', 2);
  const a3 = buildShuffledQuizAttempt(course, 'school-1-t-1', 3);
  const otherTeacher = buildShuffledQuizAttempt(course, 'school-1-t-2', 1);

  // Deterministic for identical (teacherId, courseId, attemptNumber)
  assert.deepEqual(
    a1.questions.map((q) => ({ id: q.id, opts: q.options.map((o) => o.id) })),
    a1Repeat.questions.map((q) => ({ id: q.id, opts: q.options.map((o) => o.id) }))
  );

  // Distinct permutation across attempts or teachers
  const sig = (attempt: ReturnType<typeof buildShuffledQuizAttempt>) =>
    attempt.questions.map((q) => `${q.id}:${q.options.map((o) => o.id).join(',')}`).join('|');

  assert.notEqual(sig(a1), sig(a2), 'Retry attempt #2 must shuffle differently from attempt #1');
  assert.notEqual(sig(a2), sig(a3), 'Retry attempt #3 must shuffle differently from attempt #2');
  assert.notEqual(
    sig(a1),
    sig(otherTeacher),
    'Different teachers must receive distinct shuffled quiz layouts'
  );

  // Grading strictly by stable option.id regardless of shuffled visual index
  const allCorrectById: Record<string, string> = {};
  for (const q of a2.questions) {
    const matchedOpt = q.options.find((o) => o.id === q.correctOptionId);
    assert.ok(matchedOpt, 'Shuffled options must preserve correctOptionId');
    allCorrectById[q.id] = matchedOpt.id;
  }
  const perfectGrade = gradeTeacherQuizAttempt(course, allCorrectById);
  assert.equal(perfectGrade.scorePercent, 100);
  assert.equal(perfectGrade.passed, true);

  // All wrong option IDs -> 0% fail
  const allWrongById: Record<string, string> = {};
  for (const q of a2.questions) {
    const wrongOpt = q.options.find((o) => o.id !== q.correctOptionId);
    assert.ok(wrongOpt);
    allWrongById[q.id] = wrongOpt.id;
  }
  const failGrade = gradeTeacherQuizAttempt(course, allWrongById);
  assert.equal(failGrade.scorePercent, 0);
  assert.equal(failGrade.passed, false);
});

test('Phase 7 Final Quiz Lock: unlocks ONLY when 100% of course chapters are completed', () => {
  const dataset = generateSeedDataset();
  const course = dataset.td_courses.find(
    (c) => c.schoolId === 'school-1' && c.chapters.length === 3
  )!;
  assert.ok(course);

  assert.equal(isQuizUnlocked(course, null), false);

  const partialProg: TeacherDevProgress = {
    id: 'p-partial',
    schoolId: 'school-1',
    courseId: course.id,
    teacherId: 'school-1-t-1',
    completedChapterIds: [course.chapters[0].id, course.chapters[1].id],
    attempts: [],
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
  };
  assert.equal(isQuizUnlocked(course, partialProg), false);

  const fullProg: TeacherDevProgress = {
    ...partialProg,
    completedChapterIds: course.chapters.map((ch) => ch.id),
  };
  assert.equal(isQuizUnlocked(course, fullProg), true);
});

test('Phase 7 5-Tier Ranking boundaries, transparent points formula, and strict privacy modes', () => {
  // Exact 5-tier boundary checks
  assert.equal(resolveTeacherRankTier(0).level, 1);
  assert.equal(resolveTeacherRankTier(99).level, 1);
  assert.equal(resolveTeacherRankTier(100).level, 2);
  assert.equal(resolveTeacherRankTier(249).level, 2);
  assert.equal(resolveTeacherRankTier(250).level, 3);
  assert.equal(resolveTeacherRankTier(449).level, 3);
  assert.equal(resolveTeacherRankTier(450).level, 4);
  assert.equal(resolveTeacherRankTier(699).level, 4);
  assert.equal(resolveTeacherRankTier(700).level, 5);
  assert.equal(resolveTeacherRankTier(1150).level, 5);

  const sampleCert: TeacherDevCertificate = {
    id: 'c-1',
    schoolId: 'school-1',
    courseId: 'course-1',
    teacherId: 't-1',
    teacherName: 'معلم تست',
    courseTitle: 'دوره تست',
    contentType: 'course',
    requirement: 'mandatory',
    inServiceHours: 10,
    scorePercent: 95,
    serialNumber: generateCertificateSerial({
      schoolId: 'school-1',
      teacherId: 't-1',
      courseId: 'course-1',
      issuedDateJalali: '1405/08/10',
    }),
    issuedDateJalali: '1405/08/10',
    onTime: true,
    createdAt: new Date().toISOString(),
  };
  const breakdown = calculateTeacherPointsBreakdown({
    certificates: [sampleCert],
    progressList: [],
    coursesById: new Map(),
  });
  // 10h * 20 = 200 mandatory + 45 quality (>=90%) + 30 onTime = 275
  assert.equal(breakdown.totalPoints, 275);
  assert.equal(resolveTeacherRankTier(breakdown.totalPoints).level, 3);

  // Strict privacy filtering on seeded school-1 leaderboard
  const dataset = generateSeedDataset();
  const fullBoard = buildSchoolLeaderboard({
    schoolId: 'school-1',
    teachers: dataset.teachers,
    courses: dataset.td_courses,
    progressList: dataset.td_progress,
    certificates: dataset.td_certificates,
  });
  assert.ok(fullBoard.length >= 5, 'Expected multiple teachers in school-1 leaderboard');

  const privateForTeacher = applyLeaderboardPrivacy({
    allRows: fullBoard,
    privacyMode: 'private',
    viewerIsManager: false,
    currentTeacherId: 'school-1-t-1',
  });
  assert.equal(privateForTeacher.visibleRows.length, 0, 'Private mode must expose ZERO peer rows');
  assert.equal(privateForTeacher.ownStanding?.teacherId, 'school-1-t-1');

  const top3ForTeacher = applyLeaderboardPrivacy({
    allRows: fullBoard,
    privacyMode: 'top3_only',
    viewerIsManager: false,
    currentTeacherId: 'school-1-t-1',
  });
  assert.equal(top3ForTeacher.visibleRows.length, 3, 'Top 3 mode must expose exactly 3 rows');
  assert.equal(top3ForTeacher.ownStanding?.teacherId, 'school-1-t-1');

  const publicForTeacher = applyLeaderboardPrivacy({
    allRows: fullBoard,
    privacyMode: 'public',
    viewerIsManager: false,
    currentTeacherId: 'school-1-t-1',
  });
  assert.equal(publicForTeacher.visibleRows.length, fullBoard.length);

  const privateForManager = applyLeaderboardPrivacy({
    allRows: fullBoard,
    privacyMode: 'private',
    viewerIsManager: true,
    currentTeacherId: null,
  });
  assert.equal(
    privateForManager.visibleRows.length,
    fullBoard.length,
    'Managers always see full school leaderboard'
  );
});

test('Phase 7 Participation Matrix, 3-School Comparison, Messenger single-column text & UTF-8 BOM CSV', () => {
  const dataset = generateSeedDataset();
  const matrix = computeParticipationMatrix({
    schoolId: 'school-1',
    teachers: dataset.teachers,
    courses: dataset.td_courses,
    progressList: dataset.td_progress,
    certificates: dataset.td_certificates,
    todayJalali: '1405/08/20',
    requirementFilter: 'all',
  });

  assert.ok(matrix.courses.length >= 4);
  assert.ok(matrix.rows.length >= 5);

  const allStatuses = new Set(matrix.rows.flatMap((r) => r.cells.map((c) => c.status)));
  assert.ok(allStatuses.has('completed'), 'Seeded matrix should contain completed state');
  assert.ok(allStatuses.has('in_progress'), 'Seeded matrix should contain in_progress state');
  assert.ok(allStatuses.has('quiz_failed'), 'Seeded matrix should contain quiz_failed state');

  // 3-School comparison strictly covers all 3 schools with accurate tier distribution sums
  const comparison = buildComplexTeacherDevComparison({
    schools: dataset.schools,
    teachers: dataset.teachers,
    courses: dataset.td_courses,
    progressList: dataset.td_progress,
    certificates: dataset.td_certificates,
  });
  assert.equal(comparison.length, 3);
  for (const row of comparison) {
    const tierSum =
      row.tierDistribution[1] +
      row.tierDistribution[2] +
      row.tierDistribution[3] +
      row.tierDistribution[4] +
      row.tierDistribution[5];
    assert.equal(tierSum, row.teacherCount);
  }

  // Messenger text must be strictly single-column (no tabs or ASCII table pipes)
  const reminderText = buildTeacherReminderMessage({
    schoolName: dataset.schools[0].name,
    teacherName: matrix.rows[0].teacher.fullName,
    pendingMandatoryCourses: matrix.rows[0].pendingMandatoryCourses,
    todayJalali: '1405/08/20',
  });
  assert.ok(!reminderText.includes('\t'));
  assert.ok(!reminderText.includes('|'));

  const summaryText = buildSchoolMatrixSummaryMessage({
    schoolName: dataset.schools[0].name,
    matrix,
    todayJalali: '1405/08/20',
  });
  assert.ok(!summaryText.includes('\t'));
  assert.ok(!summaryText.includes('|'));

  // CSV must begin with UTF-8 BOM
  const csv = buildParticipationMatrixCsv(matrix);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('نام همکار'));
});

test('Phase 7 6-Role RBAC Policy Matrix & Backup Validation', () => {
  const dataset = generateSeedDataset();
  const localCourse: TeacherDevCourse = {
    ...dataset.td_courses[0],
    scope: 'school',
    schoolId: 'school-1',
  };
  const globalCourse: TeacherDevCourse = {
    ...dataset.td_courses[0],
    scope: 'all',
    schoolId: 'school-1',
  };
  const ownProg: TeacherDevProgress = {
    id: 'p-own',
    schoolId: 'school-1',
    courseId: localCourse.id,
    teacherId: 'school-1-t-1',
    completedChapterIds: [],
    attempts: [],
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
  };
  const peerProg: TeacherDevProgress = { ...ownProg, id: 'p-peer', teacherId: 'school-1-t-2' };

  // complex_admin can publish global scope:'all' courses and configure privacy
  assert.equal(
    authorizeMutation({ session: makeSession('complex_admin') }, 'td_courses', 'write', {
      schoolId: 'school-1',
      record: globalCourse,
    }).allowed,
    true
  );

  // principal can create school course & configure privacy, but CANNOT publish scope:'all'
  assert.equal(
    authorizeMutation({ session: makeSession('principal', 'school-1') }, 'td_courses', 'write', {
      schoolId: 'school-1',
      record: localCourse,
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation({ session: makeSession('principal', 'school-1') }, 'td_courses', 'write', {
      schoolId: 'school-1',
      record: globalCourse,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(
      { session: makeSession('principal', 'school-1') },
      'td_school_settings',
      'write',
      { schoolId: 'school-1' }
    ).allowed,
    true
  );

  // deputy CANNOT write courses, CANNOT change privacy, CANNOT delete progress/certificates
  assert.equal(
    authorizeMutation({ session: makeSession('deputy', 'school-1') }, 'td_courses', 'write', {
      schoolId: 'school-1',
      record: localCourse,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(
      { session: makeSession('deputy', 'school-1') },
      'td_school_settings',
      'write',
      { schoolId: 'school-1' }
    ).allowed,
    false
  );
  assert.equal(
    authorizeMutation({ session: makeSession('deputy', 'school-1') }, 'td_certificates', 'delete', {
      schoolId: 'school-1',
    }).allowed,
    false
  );

  // teacher can write ONLY own progress, BLOCKED from peer progress and privacy settings
  const teacherSession = makeSession('teacher', 'school-1', { linkedTeacherId: 'school-1-t-1' });
  assert.equal(
    authorizeMutation({ session: teacherSession }, 'td_progress', 'write', {
      schoolId: 'school-1',
      record: ownProg,
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation({ session: teacherSession }, 'td_progress', 'write', {
      schoolId: 'school-1',
      record: peerProg,
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation({ session: teacherSession }, 'td_school_settings', 'write', {
      schoolId: 'school-1',
    }).allowed,
    false
  );

  // parent & student strictly BLOCKED from all Phase 7 collections
  for (const blockedRole of ['parent', 'student'] as const) {
    for (const col of [
      'td_courses',
      'td_progress',
      'td_certificates',
      'td_school_settings',
    ] as const) {
      assert.equal(
        authorizeMutation(
          { session: makeSession(blockedRole, 'school-1', { linkedStudentId: 'school-1-st-1' }) },
          col,
          'write',
          { schoolId: 'school-1' }
        ).allowed,
        false,
        `${blockedRole} must be blocked from ${col}`
      );
    }
  }

  // Backup payload validation with Phase 7 collections included
  const backup: BackupPayload = {
    schemaVersion: 10,
    exportedAt: new Date().toISOString(),
    scope: 'complex_wide',
    data: dataset,
  };
  const validation = validateBackupPayload(backup);
  assert.equal(validation.valid, true, validation.errors.join('; '));
});
