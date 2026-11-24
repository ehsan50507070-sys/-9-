// Non-Destructive Plugin Manifest: Parent Portal (Phase 4)
import type { PluginManifest } from '../../core/plugins/types';
import { ParentPortalPage } from './ParentPortalPage';

export const parentPortalManifest: PluginManifest = {
  id: 'parent-portal',
  nameFa: 'پنل اختصاصی خانواده',
  shortNameFa: 'پنل خانواده',
  descriptionFa:
    'کارنامه آنلاین و جامع فرزند، نمودار روند پیشرفت و افت درسی (SVG)، ثبت و پیگیری رسمی اعتراض نمره و چاپ A4 و A5.',
  version: '4.0.0',
  phase: 4,
  category: 'communication',
  categoryLabelFa: 'ارتباط با خانواده',
  iconName: 'Home',
  isCore: false,
  defaultEnabled: true,
  route: '/parent-portal',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['grade_appeals'],
  implemented: true,
  component: ParentPortalPage,
};
