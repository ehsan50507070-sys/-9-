// Manifest for Private Parent-Staff Chat Plugin (Phase 3.5)
import type { PluginManifest } from '../../core/plugins/types';
import { ParentStaffChatPage } from './ParentStaffChatPage';
import { ParentStaffChatWidget } from './ParentStaffChatWidget';

export const parentStaffChatManifest: PluginManifest = {
  id: 'parent-staff-chat',
  nameFa: 'گفت‌وگوی اختصاصی اولیا با معلم و مدیر',
  shortNameFa: 'گفت‌وگوی اولیا',
  descriptionFa:
    'ارتباط خصوصی، امن و ۱ به ۱ اولیا با معلم کلاس و مدیر مدرسه با نشانگر پیام خوانده‌نشده، همگام‌سازی زنده بین زبانه‌ها، کپی تک‌ستونی و چاپ A4 / A5 (کاملاً پنهان از حساب دانش‌آموز).',
  version: '3.5.0',
  phase: 3,
  category: 'communication',
  categoryLabelFa: 'ارتباط خصوصی با اولیا',
  iconName: 'MessageSquare',
  isCore: false,
  defaultEnabled: true,
  route: '/parent-staff-chat',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['parent_staff_messages'],
  implemented: true,
  component: ParentStaffChatPage,
  dashboardWidget: ParentStaffChatWidget,
};
