// Non-Destructive Plugin Manifest: Notification Templates Bank (Phase 4)
import type { PluginManifest } from '../../core/plugins/types';
import { NotificationTemplatesPage } from './NotificationTemplatesPage';

export const notificationTemplatesManifest: PluginManifest = {
  id: 'notification-templates',
  nameFa: 'بانک قالب‌های پیام آماده',
  shortNameFa: 'قالب‌های پیام',
  descriptionFa:
    'مجموعه قالب‌های پیام آماده با متغیرهای پویا، تولید فوری پیام برای غایبین امروز، کپی یک‌کلیکی ایتا/بله/شاد و چاپ اطلاعیه A4 و A5.',
  version: '4.0.0',
  phase: 4,
  category: 'communication',
  categoryLabelFa: 'ارتباط با خانواده',
  iconName: 'BellRing',
  isCore: false,
  defaultEnabled: true,
  route: '/notification-templates',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['notification_templates'],
  implemented: true,
  component: NotificationTemplatesPage,
};
