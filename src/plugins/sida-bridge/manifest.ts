import type { PluginManifest } from '../../core/plugins/types';
import { SidaBridgePage } from './SidaBridgePage';

export const sidaBridgeManifest: PluginManifest = {
  id: 'sida-bridge',
  nameFa: 'پل اتصال هوشمند به سامانه سیدا',
  shortNameFa: 'پل سیدا',
  descriptionFa:
    'ثبت فردی استاندارد سیدا، ورود گروهی هوشمند از اکسل/CSV با تطبیق ستون، عیب‌یاب آمادگی سیدا، دستیار ورود سریع نمرات، خروجی‌های رسمی و انتقال کلاس، و کارپوشه اعتراضات.',
  version: '5.5.0',
  phase: 5,
  category: 'exams_records',
  categoryLabelFa: 'امتحانات و پرونده‌ها',
  iconName: 'ArrowLeftRight',
  isCore: false,
  defaultEnabled: true,
  route: '/sida-bridge',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['sida_grade_audit_logs', 'grade_appeals', 'sida_speed_entry_ticks'],
  implemented: true,
  component: SidaBridgePage,
};
