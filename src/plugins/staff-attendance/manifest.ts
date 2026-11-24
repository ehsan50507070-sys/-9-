import type { PluginManifest } from '../../core/plugins/types';
import { StaffAttendancePage } from './StaffAttendancePage';
import { StaffAttendanceWidget } from './StaffAttendanceWidget';

export const staffAttendanceManifest: PluginManifest = {
  id: 'staff-attendance',
  nameFa: 'حضور و غیاب کادر (۴ زنگه)',
  shortNameFa: 'حضور کادر',
  descriptionFa:
    'ثبت حضور و غیاب ۴ زنگه معلمان و کادر در روزهای کاری مدرسه، محاسبه ساعات کارکرد هفتگی تا ۱۲ هفته‌ای و چاپ A4 افقی.',
  version: '1.0.0',
  phase: 1,
  category: 'operations',
  categoryLabelFa: 'عملیات روزانه مدرسه',
  iconName: 'Users',
  isCore: false,
  defaultEnabled: true,
  route: '/staff-attendance',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['staff_attendance'],
  implemented: true,
  component: StaffAttendancePage,
  dashboardWidget: StaffAttendanceWidget,
};
