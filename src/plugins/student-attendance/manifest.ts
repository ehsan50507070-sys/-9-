import type { PluginManifest } from '../../core/plugins/types';
import { StudentAttendancePage } from './StudentAttendancePage';
import { StudentAttendanceWidget } from './StudentAttendanceWidget';

export const studentAttendanceManifest: PluginManifest = {
  id: 'student-attendance',
  nameFa: 'حضور و غیاب دانش‌آموزان',
  shortNameFa: 'حضور دانش‌آموز',
  descriptionFa:
    'ثبت هوشمند حضور و غیاب زنگ‌به‌زنگ با تغییر وضعیت تک‌لمسی، گزارش تک‌ستونه پیام‌رسان‌ها و چاپ فهرست کلاسی A4.',
  version: '1.0.0',
  phase: 1,
  category: 'operations',
  categoryLabelFa: 'عملیات روزانه مدرسه',
  iconName: 'UserCheck',
  isCore: false,
  defaultEnabled: true,
  route: '/student-attendance',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['student_attendance'],
  implemented: true,
  component: StudentAttendancePage,
  dashboardWidget: StudentAttendanceWidget,
};
