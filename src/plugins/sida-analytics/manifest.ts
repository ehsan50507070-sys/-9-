// Plugin Manifest: Phase 9-B Advanced SIDA Analytics (/sida-analytics)
import type { PluginManifest } from '../../core/plugins/types';
import { SidaAnalyticsPage } from './SidaAnalyticsPage';

export const sidaAnalyticsManifest: PluginManifest = {
  id: 'sida-analytics',
  nameFa: 'تحلیل پیشرفته سیدا',
  shortNameFa: 'تحلیل سیدا',
  descriptionFa:
    'نمودار جعبه‌ای (Box Plot)، هیستوگرام توزیع نمرات، ماتریس کلاسی، مقایسه سالانه و شناسایی دانش‌آموزان مرزی.',
  version: '9.2.0',
  phase: 9,
  category: 'finance_analytics',
  categoryLabelFa: 'ارزیابی و تحلیل هوشمند',
  iconName: 'BarChart3',
  isCore: false,
  defaultEnabled: true,
  route: '/sida-analytics',
  allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: [
    'sida_analytics_grades',
    'sida_appeal_windows',
    'sida_remedial_groups',
    'sida_class_balancing_drafts',
  ],
  implemented: true,
  component: SidaAnalyticsPage,
};
