// Unit Tests for Phase 5.5: Enterprise SIDA 6-Tab Suite, Core Appearance Engine, Dynamic Section Labels & RBAC
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeBrandPaletteVars,
  createDefaultAppearancePreference,
  getSectionTitle,
  MAX_SCHOOL_LOGO_BYTES,
  validateSchoolLogoFile,
} from '../core/appearance/appearanceHelpers';
import { authorizeMutation } from '../core/auth/policy';
import { generateSeedDataset } from '../core/data/seedData';
import {
  buildValidIranianNationalId,
  validateBackupPayload,
} from '../core/validation/validators';
import type { AuthSession, BackupPayload } from '../types/domain';
import {
  autoDetectSidaColumnMapping,
  buildSidaSpeedEntryRows,
  buildSidaStudentListCsv,
  detectCsvDelimiter,
  formatSingleStudentCredentialsMessenger,
  parseSidaCsvRaw,
  runSidaReadinessAudit,
  scoreToConfigurableDescriptive,
  validateSingleSidaStudentForm,
  validateSidaImportRows,
} from './sida-bridge/sidaBridgeHelpers';

test('SIDA Tab 2: detects tab-separated Excel paste and auto-maps shuffled columns accurately', () => {
  const validNid = buildValidIranianNationalId('002910451');
  const tsv = [
    'نام\tنام خانوادگی\tکد ملی\tنام پدر\tکلاس\tپایه\tتلفن ولی',
    `پارسا\tرادمنش\t${validNid}\tکیوان\tپایه دوم - کلاس الف\tدوم\t09123456780`,
    `کاربر\tغلط\t1111111111\tعلی\tپایه دوم - کلاس الف\tدوم\t09123456781`,
  ].join('\n');

  assert.equal(detectCsvDelimiter(tsv), '\t');
  const parsed = parseSidaCsvRaw(tsv);
  assert.equal(parsed.delimiter, '\t');
  assert.equal(parsed.headers.length, 7);

  const mapping = autoDetectSidaColumnMapping(parsed.headers);
  assert.equal(mapping.firstName, 0);
  assert.equal(mapping.lastName, 1);
  assert.equal(mapping.nationalId, 2);
  assert.equal(mapping.fatherName, 3);
  assert.equal(mapping.className, 4);
  assert.equal(mapping.grade, 5);
  assert.equal(mapping.parentMobile, 6);

  const seed = generateSeedDataset();
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1');

  const preview = validateSidaImportRows({
    rawText: tsv,
    existingStudents: s1Students,
    classes: s1Classes,
    columnMapping: mapping,
  });

  assert.equal(preview.length, 2);
  assert.equal(preview[0].status, 'valid');
  assert.equal(preview[0].fullName, 'پارسا رادمنش');
  assert.equal(preview[1].status, 'invalid');
});

test('SIDA Tab 1: validates individual SIDA student form with mod-11 and active-school duplicate detection', () => {
  const seed = generateSeedDataset();
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1');
  const s1Class = seed.classes.find((c) => c.schoolId === 'school-1')!;
  const existingNid = s1Students[0].nationalId;
  const freshValidNid = buildValidIranianNationalId('005928374');

  // 1. Invalid mod-11 National ID rejected
  const invalidCheck = validateSingleSidaStudentForm({
    input: {
      nationalId: '1234567890',
      firstName: 'نیما',
      lastName: 'رضایی',
      fatherName: 'سعید',
      classId: s1Class.id,
      enrollmentStatus: 'عادی',
      parentName: 'سعید رضایی',
      parentMobile: '09123456789',
    },
    existingStudents: s1Students,
  });
  assert.equal(invalidCheck.ok, false);
  assert.equal(invalidCheck.nationalIdStatus, 'invalid');

  // 2. Duplicate National ID inside active school rejected
  const dupCheck = validateSingleSidaStudentForm({
    input: {
      nationalId: existingNid,
      firstName: 'تکراری',
      lastName: 'آزمایشی',
      fatherName: 'حسین',
      classId: s1Class.id,
      enrollmentStatus: 'عادی',
      parentName: 'حسین آزمایشی',
      parentMobile: '09123456789',
    },
    existingStudents: s1Students,
  });
  assert.equal(dupCheck.ok, false);
  assert.equal(dupCheck.nationalIdStatus, 'duplicate');

  // 3. Valid new student passes & messenger formatter produces clean single-column credentials
  const okCheck = validateSingleSidaStudentForm({
    input: {
      nationalId: freshValidNid,
      firstName: 'سامان',
      lastName: 'بهرامی',
      fatherName: 'حمید',
      classId: s1Class.id,
      enrollmentStatus: 'انتقالی',
      parentName: 'حمید بهرامی',
      parentMobile: '09129876543',
    },
    existingStudents: s1Students,
  });
  assert.equal(okCheck.ok, true);
  assert.equal(okCheck.nationalIdStatus, 'valid');

  const msg = formatSingleStudentCredentialsMessenger({
    schoolName: 'دبستان امید',
    className: s1Class.name,
    student: s1Students[0],
  });
  assert.ok(msg.includes('حساب اختصاصی دانش‌آموز'));
  assert.ok(msg.includes('حساب اختصاصی ولی'));
});

test('SIDA Tab 3: readiness auditor detects invalid IDs, duplicates, incomplete identity, and computes 0..100 score', () => {
  const seed = generateSeedDataset();
  const s1Classes = seed.classes.filter((c) => c.schoolId === 'school-1');
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1').slice(0, 3);
  const s1Profiles = seed.student_profiles.filter((p) => p.schoolId === 'school-1');
  const s1Grades = seed.gradebook_entries.filter((g) => g.schoolId === 'school-1');

  // Inject one invalid NID and one duplicate NID
  const mutatedStudents = [
    { ...s1Students[0], nationalId: '1111111111', birthDateJalali: undefined },
    { ...s1Students[1], nationalId: s1Students[2].nationalId },
    { ...s1Students[2] },
  ];

  const audit = runSidaReadinessAudit({
    students: mutatedStudents,
    classes: s1Classes,
    studentProfiles: s1Profiles,
    gradebookEntries: s1Grades,
    onlineExams: [],
    onlineExamSubmissions: [],
  });

  assert.equal(audit.invalidNationalIds.length, 1);
  assert.equal(audit.duplicateNationalIds.length, 1);
  assert.ok(audit.incompleteIdentity.length >= 1);
  assert.ok(audit.readinessPercent >= 0 && audit.readinessPercent < 100);
});

test('SIDA Tab 4 & 5: speed-entry sorts by lastName vs nationalId, converts configurable thresholds, and exports UTF-8 BOM student CSV', () => {
  const seed = generateSeedDataset();
  const s1Class = seed.classes.find((c) => c.schoolId === 'school-1')!;
  const s1Students = seed.students.filter((s) => s.schoolId === 'school-1' && s.classId === s1Class.id);
  const s1Profiles = seed.student_profiles.filter((p) => p.schoolId === 'school-1');
  const s1Grades = seed.gradebook_entries.filter((g) => g.schoolId === 'school-1');

  assert.equal(scoreToConfigurableDescriptive(19, { veryGood: 18, good: 15, acceptable: 12 }), 'خیلی خوب');
  assert.equal(scoreToConfigurableDescriptive(16.5, { veryGood: 18, good: 15, acceptable: 12 }), 'خوب');
  assert.equal(scoreToConfigurableDescriptive(13, { veryGood: 18, good: 15, acceptable: 12 }), 'قابل قبول');
  assert.equal(scoreToConfigurableDescriptive(10, { veryGood: 18, good: 15, acceptable: 12 }), 'نیاز به تلاش بیشتر');

  const byNid = buildSidaSpeedEntryRows({
    students: s1Students,
    studentProfiles: s1Profiles,
    gradebookEntries: s1Grades,
    onlineExams: [],
    onlineExamSubmissions: [],
    classId: s1Class.id,
    subject: 'ریاضی',
    term: 'نوبت اول',
    sortBy: 'nationalId',
  });
  assert.equal(byNid.length, s1Students.length);
  for (let i = 1; i < byNid.length; i++) {
    assert.ok(byNid[i - 1].nationalId <= byNid[i].nationalId);
  }

  const csv = buildSidaStudentListCsv({
    students: s1Students,
    classes: [s1Class],
    studentProfiles: s1Profiles,
  });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('وضعیت ثبت‌نام'));
});

test('Core Appearance Engine: computes accessible brand CSS vars, dynamic section titles, and blocks SVG/oversized logos', () => {
  const def = createDefaultAppearancePreference('u-1', 'school-1');
  assert.equal(def.accentPreset, 'navy');
  assert.equal(def.fontScale, 100);

  const vars = computeBrandPaletteVars('#059669');
  assert.equal(vars['--brand-primary'], '#059669');
  assert.ok(vars['--brand-primary-soft'].startsWith('rgba('));
  assert.equal(vars['--brand-contrast-text'], '#ffffff');

  const labels = { 'sida-bridge': 'امور سیدا مدرسه', '  ': 'خالی' };
  assert.equal(getSectionTitle(labels, 'sida-bridge', 'پل سیدا'), 'امور سیدا مدرسه');
  assert.equal(getSectionTitle(labels, 'gradebook', 'دفتر کلاسی'), 'دفتر کلاسی');
  assert.equal(getSectionTitle({ gradebook: '   ' }, 'gradebook', 'دفتر کلاسی'), 'دفتر کلاسی');

  assert.equal(validateSchoolLogoFile({ name: 'logo.png', type: 'image/png', size: 120_000 }).ok, true);
  assert.equal(validateSchoolLogoFile({ name: 'xss.svg', type: 'image/svg+xml', size: 1024 }).ok, false);
  assert.equal(
    validateSchoolLogoFile({ name: 'huge.jpg', type: 'image/jpeg', size: MAX_SCHOOL_LOGO_BYTES + 1 }).ok,
    false
  );
});

test('Phase 5.5 RBAC Policy: enforces personal appearance for all 6 roles and restricts school_branding_configs to principal/complex_admin', () => {
  const studentSession: AuthSession = {
    userId: 'stu-user-1',
    username: 'student1',
    displayName: 'دانش‌آموز آزمایشی',
    role: 'student',
    schoolId: 'school-1',
    isComplexWide: false,
    linkedStudentId: 's1-st-1',
    loggedInAt: new Date().toISOString(),
  };

  const principalSession: AuthSession = {
    userId: 'prin-1',
    username: 'principal1',
    displayName: 'مدیر مدرسه ۱',
    role: 'principal',
    schoolId: 'school-1',
    isComplexWide: false,
    loggedInAt: new Date().toISOString(),
  };

  // Student CAN save own appearance preferences
  assert.equal(
    authorizeMutation(
      { session: studentSession },
      'user_appearance_prefs',
      'write',
      {
        schoolId: 'school-1',
        record: createDefaultAppearancePreference('stu-user-1', 'school-1'),
      }
    ).allowed,
    true
  );

  // Student CANNOT modify another user's appearance preferences
  assert.equal(
    authorizeMutation(
      { session: studentSession },
      'user_appearance_prefs',
      'write',
      {
        schoolId: 'school-1',
        record: createDefaultAppearancePreference('prin-1', 'school-1'),
      }
    ).allowed,
    false
  );

  // Student CANNOT modify school_branding_configs or sida_speed_entry_ticks
  assert.equal(
    authorizeMutation(
      { session: studentSession },
      'school_branding_configs',
      'write',
      { schoolId: 'school-1' }
    ).allowed,
    false
  );
  assert.equal(
    authorizeMutation(
      { session: studentSession },
      'sida_speed_entry_ticks',
      'write',
      { schoolId: 'school-1' }
    ).allowed,
    false
  );

  // Principal CAN write school_branding_configs for own school, NOT another school
  assert.equal(
    authorizeMutation(
      { session: principalSession },
      'school_branding_configs',
      'write',
      { schoolId: 'school-1' }
    ).allowed,
    true
  );
  assert.equal(
    authorizeMutation(
      { session: principalSession },
      'school_branding_configs',
      'write',
      { schoolId: 'school-2' }
    ).allowed,
    false
  );
});

test('Backup Validator: accepts Phase 5.5 collections (sida_speed_entry_ticks, user_appearance_prefs, school_branding_configs)', () => {
  const seed = generateSeedDataset();
  const payload: BackupPayload = {
    schemaVersion: 2,
    scope: 'complex_wide',
    exportedAt: new Date().toISOString(),
    data: {
      ...seed,
      sida_speed_entry_ticks: [
        {
          id: 'school-1:sidatick:c1:ریاضی:نوبت اول',
          schoolId: 'school-1',
          classId: 'c1',
          subject: 'ریاضی',
          term: 'نوبت اول',
          checkedStudentIds: ['s1'],
          updatedByName: 'مدیر',
          updatedAt: new Date().toISOString(),
        },
      ],
      user_appearance_prefs: [createDefaultAppearancePreference('u-1', 'school-1')],
      school_branding_configs: [
        {
          id: 'school-1:branding',
          schoolId: 'school-1',
          appTitle: 'سامانه اختصاصی',
          sectionLabels: { dashboard: 'پیشخوان من' },
          updatedByName: 'مدیر',
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  };

  assert.equal(validateBackupPayload(payload).valid, true);
});
