import type { PluginManifest } from '../../core/plugins/types';
import { HomeworkPage } from './HomeworkPage';
import { HomeworkWidget } from './HomeworkWidget';

export const homeworkManifest: PluginManifest = {
  id: 'homework',
  nameFa: 'کارپوشه تکالیف آنلاین و بازخورد معلم',
  shortNameFa: 'تکالیف آنلاین',
  descriptionFa:
    'تعریف تکلیف با مهلت تحویل، ارسال پاسخ آنلاین دانش‌آموز و نمره‌دهی مستقیم متصل به دفتر نمره هوشمند.',
  version: '2.0.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'FileCheck2',
  isCore: false,
  defaultEnabled: true,
  route: '/homework',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['homework_assignments', 'homework_submissions'],
  implemented: true,
  component: HomeworkPage,
  dashboardWidget: HomeworkWidget,
};
