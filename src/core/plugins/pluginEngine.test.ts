import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPluginRuntimeStatuses,
  computeStudentAttendanceSummary,
  computeSubstitutionNeeds,
  createPluginStateTransition,
  getActiveDependents,
} from './pluginHelpers';
import type { PluginManifest } from './types';
import { generateSeedDataset } from '../data/seedData';
import { getPersianWeekdayFromJalali } from '../../lib/jalali';

const TEST_MANIFESTS: PluginManifest[] = [
  {
    id: 'staff-attendance',
    nameFa: 'حضور و غیاب کادر (۴ زنگه)',
    shortNameFa: 'حضور کادر',
    descriptionFa: 'test',
    version: '1.0.0',
    phase: 1,
    category: 'operations',
    categoryLabelFa: 'عملیات',
    iconName: 'Users',
    isCore: false,
    defaultEnabled: true,
    route: '/staff-attendance',
    allowedRoles: ['complex_admin', 'principal', 'deputy'],
    dataStores: ['staff_attendance'],
    implemented: true,
  },
  {
    id: 'substitution',
    nameFa: 'یافتن هوشمند معلم جایگزین',
    shortNameFa: 'معلم جایگزین',
    descriptionFa: 'test',
    version: '1.0.0',
    phase: 1,
    category: 'operations',
    categoryLabelFa: 'عملیات',
    iconName: 'UserPlus',
    isCore: false,
    defaultEnabled: true,
    dependencies: ['staff-attendance'],
    route: '/substitution',
    allowedRoles: ['complex_admin', 'principal', 'deputy'],
    dataStores: ['substitutions'],
    implemented: true,
  },
  {
    id: 'daily-log',
    nameFa: 'دفتر روزانه',
    shortNameFa: 'دفتر روزانه',
    descriptionFa: 'test',
    version: '1.0.0',
    phase: 1,
    category: 'operations',
    categoryLabelFa: 'عملیات',
    iconName: 'ClipboardList',
    isCore: false,
    defaultEnabled: true,
    route: '/daily-log',
    allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
    dataStores: ['daily_logs'],
    implemented: true,
  },
];

test('Non-destructive plugin disable and soft-uninstall preserves 100% of record counts', () => {
  const counts = { staff_attendance: 56, substitutions: 3, daily_logs: 12 };
  const initialStates = [
    createPluginStateTransition({ schoolId: 'school-1', pluginId: 'daily-log', action: 'enable', updatedBy: 'admin' }),
  ];

  const before = buildPluginRuntimeStatuses(TEST_MANIFESTS, initialStates, counts);
  const dailyBefore = before.find((p) => p.manifest.id === 'daily-log')!;
  assert.equal(dailyBefore.enabled, true);
  assert.equal(dailyBefore.preservedRecordCount, 12);

  // Soft-uninstall daily-log
  const afterUninstallStates = [
    createPluginStateTransition({ schoolId: 'school-1', pluginId: 'daily-log', action: 'uninstall', updatedBy: 'admin' }),
  ];
  const afterUninstall = buildPluginRuntimeStatuses(TEST_MANIFESTS, afterUninstallStates, counts);
  const dailyAfter = afterUninstall.find((p) => p.manifest.id === 'daily-log')!;
  assert.equal(dailyAfter.installed, false);
  assert.equal(dailyAfter.enabled, false);
  // Preserved count MUST remain exactly 12
  assert.equal(dailyAfter.preservedRecordCount, 12);
});

test('Dependency Guard detects substitution when disabling staff-attendance', () => {
  const activeStates = [
    createPluginStateTransition({ schoolId: 'school-1', pluginId: 'staff-attendance', action: 'enable', updatedBy: 'admin' }),
    createPluginStateTransition({ schoolId: 'school-1', pluginId: 'substitution', action: 'enable', updatedBy: 'admin' }),
  ];
  const dependents = getActiveDependents('staff-attendance', TEST_MANIFESTS, activeStates);
  assert.equal(dependents.length, 1);
  assert.equal(dependents[0].id, 'substitution');
});

test('Smart Substitute Finder enforces strict schoolId isolation and suggests only free colleagues in same school', () => {
  const seed = generateSeedDataset('1405/08/29');
  const weekday = getPersianWeekdayFromJalali('1405/08/29');

  const needsSchool1 = computeSubstitutionNeeds({
    schoolId: 'school-1',
    jalaliDate: '1405/08/29',
    weekday,
    teachers: seed.teachers, // pass ALL 3 schools' teachers intentionally to prove zero leakage
    schedules: seed.schedules,
    staffAttendance: seed.staff_attendance,
    substitutions: seed.substitutions,
  });

  assert.ok(needsSchool1.length >= 2);
  for (const need of needsSchool1) {
    assert.equal(need.schoolId, 'school-1');
    assert.equal(need.absentTeacher.schoolId, 'school-1');
    assert.ok(need.suggestedFreeTeachers.length > 0);
    for (const candidate of need.suggestedFreeTeachers) {
      assert.equal(candidate.schoolId, 'school-1');
      assert.notEqual(candidate.id, need.absentTeacher.id);
    }
  }
});

test('computeStudentAttendanceSummary computes unified rate counting absent and excused out of class', () => {
  const res = computeStudentAttendanceSummary({
    totalActiveStudents: 25,
    recordsForSlot: [
      { status: 'absent' },
      { status: 'absent' },
      { status: 'late' },
      { status: 'excused' },
    ],
  });
  assert.equal(res.present, 21);
  assert.equal(res.absent, 2);
  assert.equal(res.late, 1);
  assert.equal(res.excused, 1);
  assert.equal(res.attendanceRatePercent, 88);
});

