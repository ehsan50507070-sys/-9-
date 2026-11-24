// Comprehensive Unit Tests for Phase 3.5:
// 1. Strict 6-Role Split (`student` vs `parent`) & Dual Credential Migration
// 2. Private Parent-Staff Chat (`parent-staff-chat`) Helpers, Scoping, Unread Counts & Non-Destructive Backup/Restore
// 3. Global Dynamic A4 + A5 Print Engine (`printService`)
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authenticateUserAsync,
  deriveDefaultParentPassword,
  deriveDefaultStudentPassword,
  ensureStudentDualCredentials,
} from '../core/auth/authService';
import { authorizeMutation, type AuthGuardContext } from '../core/auth/policy';
import { ROLE_DEFINITIONS } from '../core/auth/rbac';
import { LocalIndexedDBAdapter } from '../core/data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../core/data/seedData';
import { buildPluginRuntimeStatuses, createPluginStateTransition } from '../core/plugins/pluginHelpers';
import { buildDynamicPageCss } from '../core/print/printService';
import { clearFailedLoginAttempts } from '../core/security/securityGuard';
import { validateBackupPayload } from '../core/validation/validators';
import type { ParentStaffMessage, Student } from '../types/domain';
import { parentStaffChatManifest } from './parent-staff-chat/manifest';
import {
  buildParentChatThreads,
  computeUnreadParentChatCount,
  filterMessagesForRole,
  formatChatSummaryMessenger,
  getParentChatChannelName,
} from './parent-staff-chat/parentChatHelpers';

test('Dual Credentials: ensureStudentDualCredentials migrates legacy students into salted hashes, strips plaintext, and preserves distinct student/parent logins', async () => {
  const legacyStudent: Student = {
    id: 'school-1-s-legacy',
    schoolId: 'school-1',
    classId: 'school-1-c-1',
    fullName: 'کیانوش راد',
    nationalId: '0023456789',
    studentCode: '14051',
    parentName: 'بهمن راد',
    parentMobile: '09121112233',
    birthDateJalali: '1395/02/10',
    parentPassword: 'custom-parent-pw',
    active: true,
  };

  const migrated = ensureStudentDualCredentials(legacyStudent);
  assert.equal(migrated.parentPassword, undefined, 'Legacy plaintext parent password must be stripped');
  assert.equal(migrated.studentPassword, undefined, 'Legacy plaintext student password must be stripped');
  assert.ok(migrated.parentPasswordHash && migrated.parentPasswordSalt);
  assert.ok(migrated.studentPasswordHash && migrated.studentPasswordSalt);
  assert.equal(migrated.parentUsername, 'pr-0023456789');
  assert.equal(migrated.studentUsername, 'st-0023456789');
  assert.notEqual(migrated.studentUsername, migrated.parentUsername);
  assert.notEqual(
    deriveDefaultStudentPassword('0023456789'),
    deriveDefaultParentPassword('0023456789')
  );

  // Palindrome national ID edge case still yields distinct student vs parent passwords
  assert.notEqual(
    deriveDefaultStudentPassword('123456123456'),
    deriveDefaultParentPassword('123456123456')
  );

  // Both accounts authenticate independently to distinct roles for the same linkedStudentId
  const seed = generateSeedDataset();
  clearFailedLoginAttempts(migrated.studentUsername!);
  const sRes = await authenticateUserAsync(
    {
      selectedScope: 'school-1',
      roleGroup: 'student',
      username: migrated.studentUsername!,
      password: deriveDefaultStudentPassword('0023456789'),
    },
    seed.schools,
    [...seed.students, migrated],
    seed.teachers
  );
  assert.equal(sRes.ok, true);
  assert.equal(sRes.session?.role, 'student');
  assert.equal(sRes.session?.linkedStudentId, migrated.id);

  clearFailedLoginAttempts(migrated.parentUsername!);
  const pRes = await authenticateUserAsync(
    {
      selectedScope: 'school-1',
      roleGroup: 'parent',
      username: migrated.parentUsername!,
      password: 'custom-parent-pw',
    },
    seed.schools,
    [...seed.students, migrated],
    seed.teachers
  );
  assert.equal(pRes.ok, true);
  assert.equal(pRes.session?.role, 'parent');
  assert.equal(pRes.session?.linkedStudentId, migrated.id);
});

test('Zero-Overlap RBAC: parent_staff_messages strictly hidden from student, interactive for parent (own child), class-scoped for teacher, school-scoped for principal', () => {
  assert.equal(ROLE_DEFINITIONS.student.canUseParentStaffChat, false);
  assert.equal(ROLE_DEFINITIONS.parent.canUseParentStaffChat, true);
  assert.equal(parentStaffChatManifest.allowedRoles.includes('student'), false);
  assert.equal(parentStaffChatManifest.allowedRoles.includes('parent'), true);

  const studentCtx: AuthGuardContext = {
    session: {
      userId: 'user-student-school-1-s-1',
      username: 'st-1',
      displayName: 'دانش‌آموز ۱',
      role: 'student',
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: 'school-1-s-1',
      loggedInAt: new Date().toISOString(),
    },
  };

  const parentCtx: AuthGuardContext = {
    session: {
      userId: 'user-parent-school-1-s-1',
      username: 'pr-1',
      displayName: 'ولی ۱',
      role: 'parent',
      schoolId: 'school-1',
      isComplexWide: false,
      linkedStudentId: 'school-1-s-1',
      loggedInAt: new Date().toISOString(),
    },
  };

  const teacherCtx: AuthGuardContext = {
    session: {
      userId: 'user-teacher-school-1-t-1',
      username: 'teacher1',
      displayName: 'معلم ۱',
      role: 'teacher',
      schoolId: 'school-1',
      isComplexWide: false,
      linkedTeacherId: 'school-1-t-1',
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: ['school-1-c-1'],
  };

  const principalCtx: AuthGuardContext = {
    session: {
      userId: 'user-principal-school-1',
      username: 'principal1',
      displayName: 'مدیر مدرسه',
      role: 'principal',
      schoolId: 'school-1',
      isComplexWide: false,
      loggedInAt: new Date().toISOString(),
    },
  };

  const sampleParentMsg: ParentStaffMessage = {
    id: 'msg-1',
    schoolId: 'school-1',
    studentId: 'school-1-s-1',
    classId: 'school-1-c-1',
    channelType: 'teacher',
    senderRole: 'parent',
    senderUserId: 'user-parent-school-1-s-1',
    senderName: 'ولی ۱',
    text: 'سلام استاد',
    jalaliDate: '1404/08/25',
    timeText: '10:30',
    createdAt: new Date().toISOString(),
    readByParent: true,
    readByStaff: false,
  };

  // Student CANNOT write or delete parent_staff_messages
  assert.equal(
    authorizeMutation(studentCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: sampleParentMsg,
    }).allowed,
    false
  );

  // Parent CAN write own child message in school-1, CANNOT write for another student or delete
  assert.equal(
    authorizeMutation(parentCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: sampleParentMsg,
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(parentCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { ...sampleParentMsg, studentId: 'school-1-s-2' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(parentCtx, 'parent_staff_messages', 'delete', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: sampleParentMsg,
    }).allowed,
    false
  );

  // Teacher CAN reply in teacher channel for assigned class, BLOCKED on principal channel or unassigned class
  assert.equal(
    authorizeMutation(teacherCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { ...sampleParentMsg, senderRole: 'teacher', channelType: 'teacher' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { ...sampleParentMsg, senderRole: 'teacher', channelType: 'principal' },
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(teacherCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-2',
      record: { ...sampleParentMsg, classId: 'school-1-c-2', senderRole: 'teacher', channelType: 'teacher' },
    }).allowed,
    false
  );

  // Principal CAN write/delete in own school, BLOCKED on school-2
  assert.equal(
    authorizeMutation(principalCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
      record: { ...sampleParentMsg, senderRole: 'principal', channelType: 'principal' },
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(principalCtx, 'parent_staff_messages', 'write', {
      schoolId: 'school-2',
      classId: 'school-2-c-1',
      record: { ...sampleParentMsg, schoolId: 'school-2', senderRole: 'principal', channelType: 'principal' },
    }).allowed,
    false
  );
});

test('parentChatHelpers: filtering, unread counts, 2-channel parent view, cross-tab channel name & messenger copy', () => {
  const seed = generateSeedDataset();
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1');
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const s1Teachers = seed.teachers.filter((t) => t.schoolId === 'school-1');
  const s1Messages = seed.parent_staff_messages.filter((m) => m.schoolId === 'school-1');
  const firstStudent = s1Students[0];
  const teacherNameById = Object.fromEntries(s1Teachers.map((t) => [t.id, t.fullName]));

  assert.equal(getParentChatChannelName('school-1'), 'school_parent_chat_school-1');
  assert.ok(s1Messages.length >= 4, 'Expected 2 seeded realistic Persian demo conversations');

  // Student sees ZERO messages & ZERO threads
  assert.equal(
    filterMessagesForRole({
      messages: s1Messages,
      role: 'student',
      linkedStudentId: firstStudent.id,
    }).length,
    0
  );
  assert.equal(
    buildParentChatThreads({
      role: 'student',
      messages: s1Messages,
      students: s1Students,
      classes: s1Classes,
      teachers: s1Teachers,
      teacherNameById,
      principalName: seed.schools[0].principalName,
      linkedStudent: firstStudent,
    }).length,
    0
  );

  // Parent always sees BOTH channels (teacher + principal) even when messages array is empty
  const emptyParentThreads = buildParentChatThreads({
    role: 'parent',
    messages: [],
    students: s1Students,
    classes: s1Classes,
    teachers: s1Teachers,
    teacherNameById,
    principalName: seed.schools[0].principalName,
    linkedStudent: firstStudent,
  });
  assert.equal(emptyParentThreads.length, 2);
  assert.equal(emptyParentThreads[0].channelLabelFa, 'گفت‌وگو با معلم کلاس');
  assert.equal(emptyParentThreads[1].channelLabelFa, 'گفت‌وگو با مدیر مدرسه');

  // Parent visible messages strictly filtered to own child and unread count calculated accurately
  const parentVisible = filterMessagesForRole({
    messages: s1Messages,
    role: 'parent',
    linkedStudentId: firstStudent.id,
  });
  assert.ok(parentVisible.length >= 2);
  assert.ok(parentVisible.every((m) => m.studentId === firstStudent.id));
  const parentUnread = computeUnreadParentChatCount(parentVisible, 'parent');
  assert.ok(parentUnread >= 1);

  // Messenger summary formats cleanly into single-column text
  const populatedParentThreads = buildParentChatThreads({
    role: 'parent',
    messages: parentVisible,
    students: s1Students,
    classes: s1Classes,
    teachers: s1Teachers,
    teacherNameById,
    principalName: seed.schools[0].principalName,
    linkedStudent: firstStudent,
  });
  const messengerSummary = formatChatSummaryMessenger({
    schoolName: seed.schools[0].name,
    thread: populatedParentThreads[0],
  });
  assert.ok(messengerSummary.includes(firstStudent.fullName));
  assert.ok(messengerSummary.includes('گفت‌وگو با معلم کلاس'));
});

test('Global Print Service: buildDynamicPageCss generates exact @page rules for A4/A5 portrait & landscape', () => {
  const a4Portrait = buildDynamicPageCss('a4', 'portrait');
  assert.ok(a4Portrait.includes('size: A4 portrait'));
  assert.ok(a4Portrait.includes('margin: 10mm'));

  const a5Portrait = buildDynamicPageCss('a5', 'portrait');
  assert.ok(a5Portrait.includes('size: A5 portrait'));
  assert.ok(a5Portrait.includes('margin: 8mm'));

  const a5Landscape = buildDynamicPageCss('a5', 'landscape');
  assert.ok(a5Landscape.includes('size: A5 landscape'));
  assert.ok(a5Landscape.includes('margin: 6mm'));
});

test('Non-Destructive parent-staff-chat Disable/Uninstall & Single-School / Complex-Wide Backup Round-Trip', async () => {
  const repo = new LocalIndexedDBAdapter();
  await repo.init();

  const beforeMsgs = await repo.getBySchool('parent_staff_messages', 'school-1');
  assert.ok(beforeMsgs.length >= 4);

  // Soft-uninstall parent-staff-chat for school-1
  const nextState = createPluginStateTransition({
    schoolId: 'school-1',
    pluginId: 'parent-staff-chat',
    action: 'uninstall',
    updatedBy: 'principal1',
  });
  await repo.putItem('school_plugin_states', nextState);

  const afterMsgs = await repo.getBySchool('parent_staff_messages', 'school-1');
  assert.equal(afterMsgs.length, beforeMsgs.length, 'Soft-uninstalling parent-staff-chat MUST preserve all messages');

  const runtime = buildPluginRuntimeStatuses(
    [parentStaffChatManifest],
    [nextState],
    { parent_staff_messages: afterMsgs.length }
  );
  assert.equal(runtime[0].installed, false);
  assert.equal(runtime[0].preservedRecordCount, afterMsgs.length);

  // Single-school & complex-wide backup round-trip preserves parent_staff_messages and student dual credentials
  const singleBackup = await repo.exportSchoolBackup('school-1');
  assert.equal(validateBackupPayload(singleBackup).valid, true);
  assert.equal(singleBackup.data.parent_staff_messages?.length, beforeMsgs.length);
  assert.ok(singleBackup.data.students.every((s) => Boolean(s.studentUsername && s.parentUsername)));

  const complexBackup = await repo.exportComplexBackup();
  assert.equal(validateBackupPayload(complexBackup).valid, true);
  await repo.restoreBackup(complexBackup);

  const restoredMsgs = await repo.getBySchool('parent_staff_messages', 'school-1');
  assert.equal(restoredMsgs.length, beforeMsgs.length);
});
