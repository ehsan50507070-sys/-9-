// Non-Destructive Plugin Manifest: Electronic Forms & Digital Consent (Phase 4)
import type { PluginManifest } from '../../core/plugins/types';
import { ElectronicFormsPage } from './ElectronicFormsPage';

export const electronicFormsManifest: PluginManifest = {
  id: 'electronic-forms',
  nameFa: 'فرم‌ساز الکترونیک و رضایت‌نامه دیجیتال',
  shortNameFa: 'رضایت‌نامه دیجیتال',
  descriptionFa:
    'ساخت رضایت‌نامه‌های اردو و فوق‌برنامه، امضای دیجیتال لمسی ولی (HTML5 Canvas)، پیگیری زنده، خروجی اکسل فارسی و چاپ A4 و A5.',
  version: '4.0.0',
  phase: 4,
  category: 'communication',
  categoryLabelFa: 'ارتباط با خانواده',
  iconName: 'FileSignature',
  isCore: false,
  defaultEnabled: true,
  route: '/electronic-forms',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['electronic_forms', 'electronic_form_responses'],
  implemented: true,
  component: ElectronicFormsPage,
};
