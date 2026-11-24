// Non-Destructive Plugin Manifest for Phase 9A Enterprise Mock & Konkur Exam System
import type { PluginManifest } from '../../core/plugins/types';
import { MockExamsPage } from './MockExamsPage';

export const mockExamsManifest: PluginManifest = {
  id: 'mock-exams',
  nameFa: 'آزمون تستی و آزمایشی (کنکوری)',
  shortNameFa: 'آزمون آزمایشی',
  descriptionFa:
    'طراحی آزمون‌های چنددفترچه‌ای و هماهنگ، نمره منفی، تراز علمی، چند از ۱۰ همترازان، تحلیل سوال دامدار، ورود سریع پاسخبرگ و چاپ کارنامه A4/A5.',
  version: '9.0.0',
  phase: 9,
  category: 'exams_records',
  categoryLabelFa: 'امتحانات و سنجش کنکوری',
  iconName: 'Target',
  isCore: false,
  defaultEnabled: true,
  route: '/mock-exams',
  allowedRoles: [
    'super_admin',
    'complex_admin',
    'principal',
    'deputy',
    'teacher',
    'parent',
    'student',
  ],
  dataStores: ['mock_exams', 'mock_exam_attempts'],
  implemented: true,
  component: MockExamsPage,
};
