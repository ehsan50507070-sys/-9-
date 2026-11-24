import type { PluginManifest } from '../../core/plugins/types';
import { AnonymousSurveysPage } from './AnonymousSurveysPage';

export const anonymousSurveysManifest: PluginManifest = {
  id: 'anonymous-surveys',
  nameFa: 'سامانه نظرسنجی ناشناس و سنجش رضایت',
  shortNameFa: 'نظرسنجی ناشناس',
  descriptionFa:
    'طراحی و اجرای نظرسنجی‌های کاملاً ناشناس ویژه اولیا، معلمان و دانش‌آموزان با جداسازی کامل رسید مشارکت از پاسخ، حد نصاب محرمانگی، تصادفی‌سازی دیدگاه‌ها و مقایسه ۳ مدرسه.',
  version: '6.0.0',
  phase: 6,
  category: 'finance_analytics',
  categoryLabelFa: 'مالی و تحلیل هوشمند',
  iconName: 'MessageSquareQuote',
  isCore: false,
  defaultEnabled: true,
  route: '/anonymous-surveys',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: [
    'anonymous_surveys',
    'survey_participation_receipts',
    'survey_anonymous_responses',
  ],
  implemented: true,
  component: AnonymousSurveysPage,
};
