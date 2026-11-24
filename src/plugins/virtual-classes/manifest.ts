// Plugin Manifest: Virtual Class Hub & Smart Click-to-Join Attendance (Phase 9-C)
import type { PluginManifest } from '../../core/plugins/types';
import { VirtualClassesPage } from './VirtualClassesPage';

export const virtualClassesManifest: PluginManifest = {
  id: 'virtual-classes',
  nameFa: 'هاب کلاس‌های مجازی و حضور هوشمند',
  shortNameFa: 'کلاس‌های مجازی',
  descriptionFa:
    'زمان‌بندی کلاس‌های آنلاین (اسکای‌روم، ادوبی کانکت، بیگ‌بلوباتن، شاد، گوگل میت)، نمایش وضعیت زنده، ثبت حضور خودکار با کلیک ورود و آرشیو فیلم و جزوه در صفحه هر درس.',
  version: '9.3.0',
  phase: 9,
  category: 'digital_learning',
  categoryLabelFa: 'آموزش دیجیتال و کلاس مجازی',
  iconName: 'Radio',
  isCore: false,
  defaultEnabled: true,
  route: '/virtual-classes',
  allowedRoles: [
    'super_admin',
    'complex_admin',
    'principal',
    'deputy',
    'teacher',
    'parent',
    'student',
  ],
  dataStores: ['virtual_class_sessions', 'virtual_class_attendance'],
  implemented: true,
  component: VirtualClassesPage,
};
