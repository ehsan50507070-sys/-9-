// Non-Destructive Plugin Manifest: Appointments & Student 360° Summary Sheet (Phase 4)
import type { PluginManifest } from '../../core/plugins/types';
import { AppointmentsPage } from './AppointmentsPage';

export const appointmentsManifest: PluginManifest = {
  id: 'appointments',
  nameFa: 'نوبت‌دهی جلسات اولیا و برگه ۳۶۰ درجه',
  shortNameFa: 'جلسات اولیا و ۳۶۰°',
  descriptionFa:
    'تعریف و رزرو نوبت ملاقات اولیا با تقسیم خودکار بازه زمانی همراه با چاپ یک‌کلیکی برگه خلاصه وضعیت ۳۶۰ درجه دانش‌آموز (A4 و A5).',
  version: '4.0.0',
  phase: 4,
  category: 'communication',
  categoryLabelFa: 'ارتباط با خانواده',
  iconName: 'CalendarHeart',
  isCore: false,
  defaultEnabled: true,
  route: '/appointments',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent'],
  dataStores: ['appointment_slots'],
  implemented: true,
  component: AppointmentsPage,
};
