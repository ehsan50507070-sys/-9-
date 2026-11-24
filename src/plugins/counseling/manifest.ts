// Plugin Manifest: Confidential Two-Layer Counseling Office & Scheduling (Phase 9-C)
import type { PluginManifest } from '../../core/plugins/types';
import { CounselingPage } from './CounselingPage';

export const counselingManifest: PluginManifest = {
  id: 'counseling',
  nameFa: 'دفتر مشاوره محرمانه و نوبت‌دهی',
  shortNameFa: 'مشاوره محرمانه',
  descriptionFa:
    'نوبت‌دهی و ارجاع به مشاور با معماری دولایه محرمانگی (لایه ۱ بالینی کاملاً انحصاری مشاور با ممیزی SHA-256 و لایه ۲ توصیه‌های اشتراک‌گذاری‌شده با ولی و معلم).',
  version: '9.3.0',
  phase: 9,
  category: 'operations',
  categoryLabelFa: 'امور اجرایی و تربیتی',
  iconName: 'HeartHandshake',
  isCore: false,
  defaultEnabled: true,
  route: '/counseling',
  allowedRoles: [
    'super_admin',
    'complex_admin',
    'principal',
    'deputy',
    'counselor',
    'teacher',
    'parent',
    'student',
  ],
  dataStores: ['counseling_sessions', 'counseling_clinical_notes'],
  implemented: true,
  component: CounselingPage,
};
