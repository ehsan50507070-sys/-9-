import type { PluginManifest } from '../../core/plugins/types';
import { ExamsManagementPage } from './ExamsManagementPage';

export const examsManagementManifest: PluginManifest = {
  id: 'exams-management',
  nameFa: 'مدیریت هوشمند امتحانات حضوری',
  shortNameFa: 'امتحانات حضوری',
  descriptionFa:
    'برنامه‌ریزی بدون تداخل کلاس، حوزه و مراقب، الگوریتم چیدمان شطرنجی ضدتقلب با جابه‌جایی دستی و چاپ گروهی کارت ورود به جلسه A4/A5.',
  version: '5.0.0',
  phase: 5,
  category: 'exams_records',
  categoryLabelFa: 'امتحانات و پرونده‌ها',
  iconName: 'Grid2x2Check',
  isCore: false,
  defaultEnabled: true,
  route: '/exams-management',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['in_person_exam_halls', 'in_person_exam_sessions', 'exam_seating_charts'],
  implemented: true,
  component: ExamsManagementPage,
};
