import type { PluginManifest } from '../../core/plugins/types';
import { DailyLogPage } from './DailyLogPage';
import { DailyLogWidget } from './DailyLogWidget';

export const dailyLogManifest: PluginManifest = {
  id: 'daily-log',
  nameFa: 'دفتر روزانه و خروج زودهنگام',
  shortNameFa: 'دفتر روزانه',
  descriptionFa:
    'ثبت مرخصی ساعتی و خروج زودهنگام دانش‌آموزان (نام تحویل‌گیرنده و ساعت خروج) به‌همراه وقایع بهداشتی، انضباطی و اداری.',
  version: '1.0.0',
  phase: 1,
  category: 'operations',
  categoryLabelFa: 'عملیات روزانه مدرسه',
  iconName: 'ClipboardList',
  isCore: false,
  defaultEnabled: true,
  route: '/daily-log',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['daily_logs'],
  implemented: true,
  component: DailyLogPage,
  dashboardWidget: DailyLogWidget,
};
