import type { PluginManifest } from '../../core/plugins/types';
import { SubstitutionPage } from './SubstitutionPage';
import { SubstitutionWidget } from './SubstitutionWidget';

export const substitutionManifest: PluginManifest = {
  id: 'substitution',
  nameFa: 'یافتن هوشمند معلم جایگزین',
  shortNameFa: 'معلم جایگزین',
  descriptionFa:
    'پیشنهاد خودکار همکاران آزاد همان روز و زنگ به محض ثبت غیبت یا تاخیر معلم، با تخصیص یک‌کلیکی و چاپ ابلاغیه.',
  version: '1.0.0',
  phase: 1,
  category: 'operations',
  categoryLabelFa: 'عملیات روزانه مدرسه',
  iconName: 'UserPlus',
  isCore: false,
  defaultEnabled: true,
  dependencies: ['staff-attendance'],
  route: '/substitution',
  allowedRoles: ['complex_admin', 'principal', 'deputy'],
  dataStores: ['substitutions'],
  implemented: true,
  component: SubstitutionPage,
  dashboardWidget: SubstitutionWidget,
};
