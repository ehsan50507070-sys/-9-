// Plugin Manifest: Hourly/Daily Leave & Official Student Exit Pass (Phase 9-C)
import type { PluginManifest } from '../../core/plugins/types';
import { LeaveExitPage } from './LeaveExitPage';

export const leaveExitManifest: PluginManifest = {
  id: 'leave-exit',
  nameFa: 'مرخصی کادر و برگه خروج رسمی دانش‌آموز',
  shortNameFa: 'مرخصی و برگه خروج',
  descriptionFa:
    'صدور برگه خروج رسمی A5 دانش‌آموز برای نگهبانی با ثبت ساعت خروج/بازگشت در زنجیره امنیتی، و مدیریت درخواست مرخصی ساعتی/روزانه کادر با شمارنده سالانه.',
  version: '9.3.0',
  phase: 9,
  category: 'operations',
  categoryLabelFa: 'امور اجرایی و تربیتی',
  iconName: 'DoorOpen',
  isCore: false,
  defaultEnabled: true,
  route: '/leave-exit',
  allowedRoles: [
    'super_admin',
    'complex_admin',
    'principal',
    'deputy',
    'counselor',
    'teacher',
    'parent',
  ],
  dataStores: ['student_exit_passes', 'staff_leave_requests'],
  implemented: true,
  component: LeaveExitPage,
};
