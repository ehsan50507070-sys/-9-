import type { PluginManifest } from '../../core/plugins/types';
import { OnlineClassroomPage } from './OnlineClassroomPage';
import { OnlineClassroomWidget } from './OnlineClassroomWidget';

export const onlineClassroomManifest: PluginManifest = {
  id: 'online-classroom',
  nameFa: 'مدیریت کلاس آنلاین و حضور و غیاب برخط',
  shortNameFa: 'کلاس آنلاین',
  descriptionFa:
    'زمان‌بندی جلسات آنلاین در شاد، اسکایروم و ادوبی کانکت، ثبت خودکار حضور با کلیک ورود، آرشیو فیلم ضبط‌شده و دعوتنامه تک‌ستونی.',
  version: '3.0.0',
  phase: 3,
  category: 'digital_learning',
  categoryLabelFa: 'یادگیری دیجیتال و کلاس آنلاین',
  iconName: 'Video',
  isCore: false,
  defaultEnabled: true,
  route: '/online-classroom',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['online_class_sessions', 'online_class_attendance'],
  implemented: true,
  component: OnlineClassroomPage,
  dashboardWidget: OnlineClassroomWidget,
};
