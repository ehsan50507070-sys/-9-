// Phase 7 Plugin Manifest: Teacher Professional Development, Anti-Cheat Quizzes & 5-Tier Ranking
import type { PluginManifest } from '../../core/plugins/types';
import { TeacherDevelopmentPage } from './TeacherDevelopmentPage';

export const teacherDevelopmentManifest: PluginManifest = {
  id: 'teacher-development',
  nameFa: 'دانش‌افزایی و رتبه‌بندی معلمین',
  shortNameFa: 'دانش‌افزایی معلمین',
  descriptionFa:
    'تعریف دوره‌ها و کتاب‌های ضمن خدمت (اختصاصی مدرسه یا هر ۳ مدرسه)، مطالعه فصل‌به‌فصل، آزمون کوتاه ضدتقلب با صدور آنی گواهینامه A4/A5، ماتریس مشارکت کادر و رتبه‌بندی ۵سطحی با تنظیمات محرمانگی.',
  version: '7.0.0',
  phase: 7,
  category: 'teacher_development',
  categoryLabelFa: 'توسعه حرفه‌ای کادر',
  iconName: 'GraduationCap',
  isCore: false,
  defaultEnabled: true,
  route: '/teacher-development',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['td_courses', 'td_progress', 'td_certificates', 'td_school_settings'],
  implemented: true,
  component: TeacherDevelopmentPage,
};
