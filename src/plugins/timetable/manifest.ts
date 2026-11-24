import type { PluginManifest } from '../../core/plugins/types';
import { TimetablePage } from './TimetablePage';
import { TimetableWidget } from './TimetableWidget';

export const timetableManifest: PluginManifest = {
  id: 'timetable',
  nameFa: 'برنامه هفتگی و تداخل‌یاب هوشمند',
  shortNameFa: 'برنامه هفتگی',
  descriptionFa:
    'جدول تعاملی ۴ زنگه به تفکیک کلاس و معلم با تشخیص آنی تداخل زمانی، همگام‌سازی با جایگزینی و چاپ A4 افقی.',
  version: '2.0.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'CalendarClock',
  isCore: false,
  defaultEnabled: true,
  route: '/timetable',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['schedules'],
  implemented: true,
  component: TimetablePage,
  dashboardWidget: TimetableWidget,
};
