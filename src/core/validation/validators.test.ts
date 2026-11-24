import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidIranianNationalId,
  validateBackupPayload,
  validateDailyLogInput,
  validateGradeScore,
  validateIranianMobile,
  validateIranianNationalId,
  validateJalaliDate,
} from './validators';
import { generateSeedDataset } from '../data/seedData';

test('validateIranianNationalId enforces strict 10-digit checksum and Persian digit normalization', () => {
  const validId = buildValidIranianNationalId('001352084');
  assert.equal(validateIranianNationalId(validId), true);
  assert.equal(validateIranianNationalId('۰۰۱۳۵۲۰۸۴' + validId[9]), true);
  assert.equal(validateIranianNationalId('1111111111'), false);
  assert.equal(validateIranianNationalId('0013520840'), validId.endsWith('0'));
  assert.equal(validateIranianNationalId('12345'), false);
});

test('validateJalaliDate, validateIranianMobile, and validateGradeScore work accurately', () => {
  assert.equal(validateJalaliDate('1405/08/29'), true);
  assert.equal(validateJalaliDate('۱۴۰۵/۰۱/۳۱'), true);
  assert.equal(validateJalaliDate('1405/07/31'), false);
  assert.equal(validateJalaliDate('1405/13/01'), false);

  assert.equal(validateIranianMobile('09123456789'), true);
  assert.equal(validateIranianMobile('۰۹۱۲۳۴۵۶۷۸۹'), true);
  assert.equal(validateIranianMobile('02188451201'), false);

  assert.equal(validateGradeScore(0), true);
  assert.equal(validateGradeScore(19.75), true);
  assert.equal(validateGradeScore(20), true);
  assert.equal(validateGradeScore(-0.5), false);
  assert.equal(validateGradeScore(20.25), false);
});

test('validateDailyLogInput requires pickup person, relation, and HH:MM exit time for early dismissal', () => {
  const bad = validateDailyLogInput({
    jalaliDate: '1405/08/29',
    category: 'early_dismissal',
    title: 'خروج',
    description: 'هماهنگی با ولی جهت دندانپزشکی',
    studentId: '',
    pickupPersonName: '',
    pickupRelation: '',
    exitTime: '25:99',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 4);

  const ok = validateDailyLogInput({
    jalaliDate: '1405/08/29',
    category: 'early_dismissal',
    title: 'خروج زودهنگام امیرعلی',
    description: 'تحویل به پدر دانش‌آموز با امضای دفتر',
    studentId: 'school-1-s-1',
    classId: 'school-1-c-1',
    pickupPersonName: 'رضا احمدی',
    pickupRelation: 'پدر',
    exitTime: '10:30',
  });
  assert.equal(ok.valid, true);
});

test('validateBackupPayload rejects cross-school leakage inside single_school backups', () => {
  const seed = generateSeedDataset('1405/08/29');
  const validSingle = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    scope: 'single_school',
    schoolId: 'school-1',
    data: {
      schools: seed.schools.filter((s) => s.schoolId === 'school-1'),
      classes: seed.classes.filter((s) => s.schoolId === 'school-1'),
      students: seed.students.filter((s) => s.schoolId === 'school-1'),
      teachers: seed.teachers.filter((s) => s.schoolId === 'school-1'),
      schedules: seed.schedules.filter((s) => s.schoolId === 'school-1'),
      student_attendance: seed.student_attendance.filter((s) => s.schoolId === 'school-1'),
      staff_attendance: seed.staff_attendance.filter((s) => s.schoolId === 'school-1'),
      substitutions: seed.substitutions.filter((s) => s.schoolId === 'school-1'),
      daily_logs: seed.daily_logs.filter((s) => s.schoolId === 'school-1'),
      school_plugin_states: seed.school_plugin_states.filter((s) => s.schoolId === 'school-1'),
    },
  };
  assert.equal(validateBackupPayload(validSingle).valid, true);

  // Inject a student from school-2 into school-1 backup -> MUST FAIL validation
  const leaked = {
    ...validSingle,
    data: {
      ...validSingle.data,
      students: [...validSingle.data.students, seed.students.find((s) => s.schoolId === 'school-2')!],
    },
  };
  const leakedRes = validateBackupPayload(leaked);
  assert.equal(leakedRes.valid, false);
});
