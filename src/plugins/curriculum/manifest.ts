import type { PluginManifest } from '../../core/plugins/types';
import { CurriculumPage } from './CurriculumPage';
import { CurriculumWidget } from './CurriculumWidget';

export const curriculumManifest: PluginManifest = {
  id: 'curriculum',
  nameFa: 'بودجه‌بندی هفتگی فارسی و ریاضی (پایه ۲ تا ۶)',
  shortNameFa: 'بودجه‌بندی هفتگی',
  descriptionFa:
    'پایش پیشروی هفتگی دروس فارسی و ریاضی پایه‌های دوم تا ششم با تیک یک‌کلیکی و فرم چاپی A4 عمودی تیک‌دار.',
  version: '2.0.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'BookOpenCheck',
  isCore: false,
  defaultEnabled: true,
  route: '/curriculum',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['curriculum_topics'],
  implemented: true,
  component: CurriculumPage,
  dashboardWidget: CurriculumWidget,
};
