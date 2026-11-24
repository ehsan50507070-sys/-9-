import type { PluginManifest } from '../../core/plugins/types';
import { SiteUserSettingsPage } from './SiteUserSettingsPage';

export const siteUserSettingsManifest: PluginManifest = {
  id: 'site-user-settings',
  nameFa: 'کاربر سایت و تنظیمات ظاهری',
  shortNameFa: 'ظاهر و کاربر سایت',
  descriptionFa:
    'پروفایل کاربری و تغییر رمز محلی، انتخاب حالت روشن/تاریک/مطالعه، رنگ سازمانی، ۵ فونت فارسی، مقیاس متن و تغییر نام بخش‌های سامانه و لوگوی مدرسه.',
  version: '5.5.0',
  phase: 5,
  category: 'exams_records',
  categoryLabelFa: 'شخصی‌سازی و تنظیمات',
  iconName: 'Palette',
  isCore: false,
  defaultEnabled: true,
  route: '/site-user-settings',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['user_appearance_prefs', 'school_branding_configs'],
  implemented: true,
  component: SiteUserSettingsPage,
};
