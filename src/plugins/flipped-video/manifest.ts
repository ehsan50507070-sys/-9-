import type { PluginManifest } from '../../core/plugins/types';
import { FlippedVideoPage } from './FlippedVideoPage';
import { FlippedVideoWidget } from './FlippedVideoWidget';

export const flippedVideoManifest: PluginManifest = {
  id: 'flipped-video',
  nameFa: 'کلاس وارونه هوشمند و پایش خط‌زمانی ویدیو',
  shortNameFa: 'کلاس وارونه',
  descriptionFa:
    'پخش‌کننده ویدیوی قفل‌شده ضد جلو زدن، ثبت سوالات دقیقه‌ای، تستک درک مطلب خودکار و کارت دستور جلسه کلاس رفع اشکال.',
  version: '3.0.0',
  phase: 3,
  category: 'digital_learning',
  categoryLabelFa: 'یادگیری دیجیتال و کلاس آنلاین',
  iconName: 'PlayCircle',
  isCore: false,
  defaultEnabled: true,
  route: '/flipped-video',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['flipped_lessons', 'flipped_telemetry', 'flipped_questions'],
  implemented: true,
  component: FlippedVideoPage,
  dashboardWidget: FlippedVideoWidget,
};
