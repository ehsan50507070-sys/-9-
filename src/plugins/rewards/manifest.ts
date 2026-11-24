// Plugin Manifest: Class Rewards & Auto A4 Certificate Generator (Phase 2 Add-on 10)
import type { PluginManifest } from '../../core/plugins/types';
import { RewardsPage } from './RewardsPage';
import { RewardsWidget } from './RewardsWidget';

export const rewardsManifest: PluginManifest = {
  id: 'rewards',
  nameFa: 'سیستم تشویق و صدور لوح تقدیر A4',
  shortNameFa: 'تشویق و تقدیرنامه',
  descriptionFa:
    'اهدای نشان‌های انگیزشی آماده و سفارشی، رتبه‌بندی تشویقی کلاس و تولید یک‌کلیکی لوح تقدیر رسمی چاپی A4 با سربرگ اختصاصی مدرسه.',
  version: '2.0.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'Award',
  isCore: false,
  defaultEnabled: true,
  route: '/rewards',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['student_rewards'],
  implemented: true,
  component: RewardsPage,
  dashboardWidget: RewardsWidget,
};
