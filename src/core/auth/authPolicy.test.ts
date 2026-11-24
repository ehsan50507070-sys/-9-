import assert from 'node:assert/strict';
import test from 'node:test';
import { toPersianDigits } from '../../lib/digits';
import type { Student } from '../../types/domain';
import { LocalIndexedDBAdapter } from '../data/LocalIndexedDBAdapter';
import { generateSeedDataset } from '../data/seedData';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import { sanitizeText } from '../security/sanitize';
import { clearFailedLoginAttempts } from '../security/securityGuard';
import { generatePhase8ASeedData } from '../super-admin/superAdminHelpers';
import { buildValidIranianNationalId, validateStudentFormInput } from '../validation/validators';
import {
  authenticateUserAsync,
  COMPLEX_ADMIN_SCOPE,
  createStudentWithInitialCredentials,
  deriveDefaultParentPassword,
  deriveDefaultStudentPassword,
  SUPER_ADMIN_SCOPE,
} from './authService';
import { authorizeBackupOperation, authorizeMutation } from './policy';

test('authenticateUserAsync verifies hashed roles, rejects wrong scope & Persian usernames, and enforces 5-attempt lockout', async () => {
  const seed = generateSeedDataset();
  const p8 = generatePhase8ASeedData({ schools: seed.schools, manifests: PLUGIN_REGISTRY });
  const accounts = p8.managed_admin_accounts;

  // Bootstrap super_admin (09120000001 / Admin@1404) requires password change on first login
  clearFailedLoginAttempts('09120000001');
  const superRes = await authenticateUserAsync(
    { selectedScope: SUPER_ADMIN_SCOPE, roleGroup: 'management', username: '09120000001', password: 'Admin@1404' },
    seed.schools,
    seed.students,
    seed.teachers,
    accounts
  );
  assert.equal(superRes.ok, true);
  assert.equal(superRes.session?.role, 'super_admin');
  assert.equal(superRes.session?.mustChangePassword, true);

  // Complex admin works in complex scope with Persian digits
  clearFailedLoginAttempts('09120000002');
  const adminRes = await authenticateUserAsync(
    {
      selectedScope: COMPLEX_ADMIN_SCOPE,
      roleGroup: 'management',
      username: toPersianDigits('09120000002'),
      password: 'Complex@1404',
    },
    seed.schools,
    seed.students,
    seed.teachers,
    accounts
  );
  assert.equal(adminRes.ok, true);
  assert.equal(adminRes.session?.role, 'complex_admin');

  // Principal of School 1 rejected on School 2
  clearFailedLoginAttempts('09120000101');
  const wrongSchool = await authenticateUserAsync(
    { selectedScope: 'school-2', username: '09120000101', password: 'Modir@1405' },
    seed.schools,
    seed.students,
    seed.teachers,
    accounts
  );
  assert.equal(wrongSchool.ok, false);

  // Persian letters in username are strictly rejected
  const persianUser = await authenticateUserAsync(
    { roleGroup: 'management', username: 'مدیرمدرسه', password: 'Modir@1405' },
    seed.schools,
    seed.students,
    seed.teachers,
    accounts
  );
  assert.equal(persianUser.ok, false);
  assert.match(persianUser.errorFa ?? '', /انگلیسی|فارسی/);

  // Student & parent login with salted hashes (zero plaintext on record)
  const student = seed.students.find((s) => s.schoolId === 'school-1')!;
  assert.equal(student.studentPassword, undefined);
  assert.equal(student.parentPassword, undefined);
  assert.ok(student.studentPasswordHash && student.studentPasswordSalt);
  assert.ok(student.parentPasswordHash && student.parentPasswordSalt);

  clearFailedLoginAttempts(student.studentUsername!);
  const studentRes = await authenticateUserAsync(
    {
      selectedScope: 'school-1',
      roleGroup: 'student',
      username: student.studentUsername!,
      password: toPersianDigits(deriveDefaultStudentPassword(student.nationalId)),
    },
    seed.schools,
    seed.students,
    seed.teachers,
    accounts
  );
  assert.equal(studentRes.ok, true);
  assert.equal(studentRes.session?.role, 'student');
  assert.equal(studentRes.session?.linkedStudentId, student.id);

  // Brute-force lockout after 5 consecutive failures
  const lockTestUser = '09129998877';
  clearFailedLoginAttempts(lockTestUser);
  for (let i = 1; i <= 4; i++) {
    const fail = await authenticateUserAsync(
      { roleGroup: 'management', username: lockTestUser, password: `WrongPass${i}` },
      seed.schools,
      seed.students,
      seed.teachers,
      accounts
    );
    assert.equal(fail.ok, false);
    assert.equal(fail.lockedNow, false);
  }
  const fifthFail = await authenticateUserAsync(
    { roleGroup: 'management', username: lockTestUser, password: 'WrongPass5' },
    seed.schools,
    seed.students,
    seed.teachers,
    accounts
  );
  assert.equal(fifthFail.ok, false);
  assert.equal(fifthFail.lockedNow, true);
  assert.equal(fifthFail.lockoutStatus?.isLocked, true);
  clearFailedLoginAttempts(lockTestUser);

  // XSS sanitization strips dangerous tags & javascript URIs
  assert.equal(sanitizeText('<script>alert(1)</script>سلام <b>جهان</b>'), 'سلام جهان');
});

test('Newly added student auto-generates distinct hashed student & parent credentials scoped strictly to that child', async () => {
  const seed = generateSeedDataset();
  const newNatId = buildValidIranianNationalId('009876543');
  const form = validateStudentFormInput(
    {
      fullName: 'سروش نیک‌نهاد',
      nationalId: toPersianDigits(newNatId),
      classId: 'school-2-c-1',
      parentName: 'فرهاد نیک‌نهاد',
      parentMobile: '۰۹۱۲۷۷۷۸۸۹۹',
      birthDateJalali: '۱۳۹۷/۰۴/۱۵',
    },
    seed.students.filter((s) => s.schoolId === 'school-2').map((s) => s.nationalId)
  );
  assert.equal(form.valid, true);

  const rawStudent: Student = {
    id: 'school-2-s-new',
    schoolId: 'school-2',
    classId: form.data!.classId,
    fullName: form.data!.fullName,
    nationalId: form.data!.nationalId,
    studentCode: '24099',
    parentName: form.data!.parentName,
    parentMobile: form.data!.parentMobile,
    birthDateJalali: form.data!.birthDateJalali,
    active: true,
  };

  const { student: newStudent, initialStudentPassword, initialParentPassword } =
    await createStudentWithInitialCredentials(rawStudent);

  // Zero plaintext stored on student record, distinct student vs parent passwords
  assert.equal(newStudent.studentPassword, undefined);
  assert.equal(newStudent.parentPassword, undefined);
  assert.ok(newStudent.studentPasswordHash && newStudent.studentPasswordSalt);
  assert.ok(newStudent.parentPasswordHash && newStudent.parentPasswordSalt);
  assert.equal(initialStudentPassword, newNatId);
  assert.notEqual(initialStudentPassword, initialParentPassword);
  assert.notEqual(deriveDefaultStudentPassword(newNatId), deriveDefaultParentPassword(newNatId));

  clearFailedLoginAttempts(newStudent.parentUsername!);
  const parentLoginRes = await authenticateUserAsync(
    {
      selectedScope: 'school-2',
      roleGroup: 'parent',
      username: newStudent.parentUsername!,
      password: initialParentPassword,
    },
    seed.schools,
    [...seed.students, newStudent],
    seed.teachers
  );
  assert.equal(parentLoginRes.ok, true);
  assert.equal(parentLoginRes.session?.role, 'parent');
  assert.equal(parentLoginRes.session?.schoolId, 'school-2');
  assert.equal(parentLoginRes.session?.linkedStudentId, newStudent.id);

  clearFailedLoginAttempts(newStudent.studentUsername!);
  const studentLoginRes = await authenticateUserAsync(
    {
      selectedScope: 'school-2',
      roleGroup: 'student',
      username: newStudent.studentUsername!,
      password: initialStudentPassword,
    },
    seed.schools,
    [...seed.students, newStudent],
    seed.teachers
  );
  assert.equal(studentLoginRes.ok, true);
  assert.equal(studentLoginRes.session?.role, 'student');
  assert.equal(studentLoginRes.session?.schoolId, 'school-2');
  assert.equal(studentLoginRes.session?.linkedStudentId, newStudent.id);
});

test('authorizeMutation and repository enforce strict end-to-end RBAC boundaries including exclusive super_admin plugin control', async () => {
  const seed = generateSeedDataset();
  const repo = new LocalIndexedDBAdapter();

  // 1. Parent is 100% read-only on attendance
  const parentSession = {
    userId: 'u-p',
    username: 'pr-1',
    displayName: 'ولی دانش‌آموز',
    role: 'parent' as const,
    schoolId: 'school-1',
    isComplexWide: false,
    linkedStudentId: 'school-1-s-1',
    loggedInAt: new Date().toISOString(),
  };
  repo.setAuthContext({ session: parentSession });
  await assert.rejects(
    () =>
      repo.putItem('student_attendance', {
        id: 'school-1:1405/08/29:school-1-c-1:1:school-1-s-1',
        schoolId: 'school-1',
        jalaliDate: '1405/08/29',
        classId: 'school-1-c-1',
        period: 1,
        studentId: 'school-1-s-1',
        status: 'absent',
        recordedBy: 'parent',
        updatedAt: new Date().toISOString(),
      }),
    /فقط‌خواندنی/
  );

  // 2. Teacher can edit ONLY assigned classes, blocked on other classes, staff_attendance, and students
  const teacherAuth = {
    session: {
      userId: 'u-t',
      username: 'teacher1',
      displayName: 'استاد علی اکبری',
      role: 'teacher' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      linkedTeacherId: 'school-1-t-1',
      loggedInAt: new Date().toISOString(),
    },
    teacherAssignedClassIds: ['school-1-c-1'],
  };
  assert.equal(
    authorizeMutation(teacherAuth, 'student_attendance', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-1',
    }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(teacherAuth, 'student_attendance', 'write', {
      schoolId: 'school-1',
      classId: 'school-1-c-2',
    }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(teacherAuth, 'staff_attendance', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(teacherAuth, 'students', 'write', { schoolId: 'school-1' }).allowed,
    false
  );

  // 3. Deputy can manage students/attendance in own school ONLY, blocked from add-ons and other schools
  const deputyAuth = {
    session: {
      userId: 'u-d',
      username: '09120000102',
      displayName: 'معاون اجرایی',
      role: 'deputy' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      loggedInAt: new Date().toISOString(),
    },
  };
  assert.equal(
    authorizeMutation(deputyAuth, 'students', 'write', { schoolId: 'school-1' }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(deputyAuth, 'students', 'write', { schoolId: 'school-2' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(deputyAuth, 'school_plugin_states', 'write', { schoolId: 'school-1' }).allowed,
    false
  );

  // 4. Principal & Complex Admin are strictly BLOCKED from plugin management (exclusive to super_admin)
  const principalAuth = {
    session: {
      userId: 'u-pr',
      username: '09120000101',
      displayName: 'مدیر دبستان گلستان راه روشن',
      role: 'principal' as const,
      schoolId: 'school-1',
      isComplexWide: false,
      loggedInAt: new Date().toISOString(),
    },
  };
  assert.equal(
    authorizeMutation(principalAuth, 'school_plugin_states', 'write', { schoolId: 'school-1' }).allowed,
    false
  );
  assert.equal(
    authorizeMutation(principalAuth, 'school_plugin_states', 'write', { schoolId: 'school-2' }).allowed,
    false
  );
  assert.equal(authorizeBackupOperation(principalAuth, 'complex_wide').allowed, false);
  assert.equal(authorizeBackupOperation(principalAuth, 'single_school', 'school-1').allowed, true);
  assert.equal(authorizeBackupOperation(principalAuth, 'single_school', 'school-2').allowed, false);

  const complexAdminAuth = {
    session: {
      userId: 'u-ca',
      username: '09120000002',
      displayName: 'مدیر کل مجموعه',
      role: 'complex_admin' as const,
      schoolId: 'school-1',
      complexId: 'complex-1',
      isComplexWide: true,
      loggedInAt: new Date().toISOString(),
    },
  };
  assert.equal(
    authorizeMutation(complexAdminAuth, 'school_plugin_states', 'write', { schoolId: 'school-1' }).allowed,
    false
  );

  // 5. Super Admin has exclusive plugin management across all schools
  const superAdminAuth = {
    session: {
      userId: 'user-super-admin',
      username: '09120000001',
      displayName: 'راهبر ارشد',
      role: 'super_admin' as const,
      schoolId: 'school-1',
      isComplexWide: true,
      isSuperAdmin: true,
      loggedInAt: new Date().toISOString(),
    },
  };
  assert.equal(
    authorizeMutation(superAdminAuth, 'school_plugin_states', 'write', { schoolId: 'school-1' }).allowed,
    true
  );
  assert.equal(
    authorizeMutation(superAdminAuth, 'school_plugin_states', 'write', { schoolId: 'school-2' }).allowed,
    true
  );

  assert.ok(seed.schools.length === 3);
});
