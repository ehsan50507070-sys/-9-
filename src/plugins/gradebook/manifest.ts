import type { PluginManifest } from '../../core/plugins/types';
import { GradebookPage } from './GradebookPage';
import { GradebookWidget } from './GradebookWidget';

export const gradebookManifest: PluginManifest = {
  id: 'gradebook',
  nameFa: 'کاربرگ الکترونیک دبیر و دفتر کلاسی هوشمند',
  shortNameFa: 'دفتر کلاسی و نمره',
  descriptionFa:
    'نمره‌دهی دوگانه توصیفی و عددی، طرح درس، محاسبه هوشمند نمره مستمر، دستیار کارنامه با نمودار ماهانه و رسیدگی به اعتراض نمره.',
  version: '2.0.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'GraduationCap',
  isCore: false,
  defaultEnabled: true,
  route: '/gradebook',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['gradebook_entries', 'lesson_plans', 'gradebook_weights', 'grade_appeals'],
  implemented: true,
  component: GradebookPage,
  dashboardWidget: GradebookWidget,
};
