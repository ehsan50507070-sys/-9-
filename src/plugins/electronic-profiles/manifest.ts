import type { PluginManifest } from '../../core/plugins/types';
import { ElectronicProfilesPage } from './ElectronicProfilesPage';

export const electronicProfilesManifest: PluginManifest = {
  id: 'electronic-profiles',
  nameFa: 'پرونده الکترونیک جامع دانش‌آموزان و همکاران',
  shortNameFa: 'پرونده الکترونیک',
  descriptionFa:
    'بایگانی کامل سوابق هویتی، سلامت و هشدار پزشکی، مدارک دیجیتال (تصویر و PDF)، خط زمانی خودکار تحصیلی و پرونده پرسنلی با سطوح دسترسی دقیق.',
  version: '5.0.0',
  phase: 5,
  category: 'exams_records',
  categoryLabelFa: 'امتحانات و پرونده‌ها',
  iconName: 'IdCard',
  isCore: false,
  defaultEnabled: true,
  route: '/electronic-profiles',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['student_profiles', 'staff_profiles'],
  implemented: true,
  component: ElectronicProfilesPage,
};
