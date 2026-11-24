import type { PluginManifest } from '../../core/plugins/types';
import { FinancePage } from './FinancePage';

export const financeManifest: PluginManifest = {
  id: 'finance',
  nameFa: 'مدیریت یکپارچه مالی و شهریه',
  shortNameFa: 'مالی و شهریه',
  descriptionFa:
    'مدیریت شهریه و اقساط شمسی، تخفیف‌ها، ثبت پرداخت دستی و شبیه‌ساز درگاه آنلاین اولیا، رسید رسمی A5/A4، هزینه‌های مدرسه، یادآوری بدهکاران و گزارش تجمیعی ۳ مدرسه.',
  version: '6.0.0',
  phase: 6,
  category: 'finance_analytics',
  categoryLabelFa: 'مالی و تحلیل هوشمند',
  iconName: 'Wallet',
  isCore: false,
  defaultEnabled: true,
  route: '/finance',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'parent'],
  dataStores: [
    'finance_fee_plans',
    'finance_student_ledgers',
    'finance_payments',
    'finance_expenses',
  ],
  implemented: true,
  component: FinancePage,
};
