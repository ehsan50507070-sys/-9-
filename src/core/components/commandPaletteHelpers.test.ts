import test from 'node:test';
import assert from 'node:assert/strict';
import type { ClassRoom, MockExam, School, Student, Teacher } from '../../types/domain';
import type { PluginRuntimeStatus } from '../plugins/types';
import { buildCommandPaletteItems } from './commandPaletteHelpers';

const mockPlugins: PluginRuntimeStatus[] = [
  {
    manifest: {
      id: 'dashboard',
      nameFa: 'داشبورد هوشمند مدرسه',
      shortNameFa: 'داشبورد',
      descriptionFa: 'نمای کلی',
      version: '1.0.0',
      phase: 1,
      category: 'core',
      categoryLabelFa: 'هسته',
      iconName: 'LayoutDashboard',
      isCore: true,
      defaultEnabled: true,
      route: '/',
      allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
      dataStores: ['schools'],
      implemented: true,
    },
    installed: true,
    enabled: true,
    preservedRecordCount: 0,
    blockedByDisabledDependencies: [],
    activeDependents: [],
  },
  {
    manifest: {
      id: 'super-admin',
      nameFa: 'کنسول راهبر ارشد سامانه',
      shortNameFa: 'راهبر ارشد',
      descriptionFa: 'حاکمیت کلان',
      version: '8.0.0',
      phase: 8,
      category: 'core',
      categoryLabelFa: 'حاکمیت',
      iconName: 'ShieldCheck',
      isCore: true,
      defaultEnabled: true,
      route: '/super-admin',
      allowedRoles: ['super_admin'],
      dataStores: [],
      implemented: true,
    },
    installed: true,
    enabled: true,
    preservedRecordCount: 0,
    blockedByDisabledDependencies: [],
    activeDependents: [],
  },
  {
    manifest: {
      id: 'mock-exams',
      nameFa: 'آزمون تستی و آزمایشی (کنکوری)',
      shortNameFa: 'آزمون آزمایشی',
      descriptionFa: 'تراز و رتبه کنکور',
      version: '9.0.0',
      phase: 9,
      category: 'exams_records',
      categoryLabelFa: 'آزمون',
      iconName: 'Target',
      isCore: false,
      defaultEnabled: true,
      route: '/mock-exams',
      allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
      dataStores: ['mock_exams'],
      implemented: true,
    },
    installed: true,
    enabled: true,
    preservedRecordCount: 4,
    blockedByDisabledDependencies: [],
    activeDependents: [],
  },
];

const schools = [
  { id: 'school-1', name: 'مدرسه ۱', subtitle: 'واحد الف' },
  { id: 'school-2', name: 'مدرسه ۲', subtitle: 'واحد ب' },
] as School[];

const classes = [{ id: 'c1', schoolId: 'school-1', name: 'ششم الف' }] as ClassRoom[];
const students = [
  { id: 's1', schoolId: 'school-1', classId: 'c1', fullName: 'امیرعلی احمدی', nationalId: '0011223344', active: true },
  { id: 's2', schoolId: 'school-2', classId: 'c2', fullName: 'زهرا کاظمی', nationalId: '0099887766', active: true },
] as Student[];
const teachers = [
  { id: 't1', schoolId: 'school-1', fullName: 'استاد علی اکبری', specialty: 'ریاضی', mobile: '09120000001' },
] as Teacher[];
const mockExams = [
  {
    id: 'ex-1',
    schoolId: 'global',
    scope: 'complex',
    title: 'آزمون آزمایشی مرحله ۳',
    stageLabelFa: 'مرحله ۳',
    status: 'published',
    questions: [{ questionNumber: 1 }],
  },
] as MockExam[];

test('student role never sees unauthorized staff modules, other students, or staff records in Ctrl+K', () => {
  const results = buildCommandPaletteItems({
    query: '',
    activeRole: 'student',
    activeSchoolId: 'school-1',
    canSwitchSchool: false,
    pluginStatuses: mockPlugins,
    roleGovernanceConfigs: [],
    getSectionTitle: (_id, fallback) => fallback,
    schools,
    students,
    classes,
    teachers,
    mockExams,
    isViewingArchivedYear: false,
  });

  assert.equal(results.some((r) => r.id === 'mod-super-admin'), false);
  assert.equal(results.some((r) => r.category === 'students'), false);
  assert.equal(results.some((r) => r.category === 'staff'), false);
  assert.equal(results.some((r) => r.id === 'mod-mock-exams'), true);
});

test('principal sees only active school students while complex_admin sees cross-school students and school switch actions', () => {
  const principalResults = buildCommandPaletteItems({
    query: 'زهرا',
    activeRole: 'principal',
    activeSchoolId: 'school-1',
    canSwitchSchool: false,
    pluginStatuses: mockPlugins,
    roleGovernanceConfigs: [],
    getSectionTitle: (_id, fallback) => fallback,
    schools,
    students,
    classes,
    teachers,
    mockExams,
    isViewingArchivedYear: false,
  });
  assert.equal(principalResults.some((r) => r.studentId === 's2'), false);

  const complexResults = buildCommandPaletteItems({
    query: '',
    activeRole: 'complex_admin',
    activeSchoolId: 'school-1',
    canSwitchSchool: true,
    pluginStatuses: mockPlugins,
    roleGovernanceConfigs: [],
    getSectionTitle: (_id, fallback) => fallback,
    schools,
    students,
    classes,
    teachers,
    mockExams,
    isViewingArchivedYear: false,
  });
  assert.equal(complexResults.some((r) => r.studentId === 's2'), true);
  assert.equal(complexResults.some((r) => r.actionType === 'switch_school'), true);
});
