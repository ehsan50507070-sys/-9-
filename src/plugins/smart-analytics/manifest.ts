import type { PluginManifest } from '../../core/plugins/types';
import { SmartAnalyticsPage } from './SmartAnalyticsPage';

export const smartAnalyticsManifest: PluginManifest = {
  id: 'smart-analytics',
  nameFa: 'داشبورد تحلیل هوشمند و رصد پیشرفت',
  shortNameFa: 'تحلیل هوشمند',
  descriptionFa:
    'تحلیل یکپارچه نمرات، حضور و غیاب، تکالیف و کلاس معکوس، تشخیص افت تحصیلی، پیشنهاد خودکار کلاس‌های تقویتی، ارزیابی سازنده معلمان و مقایسه هوشمند ۳ مدرسه.',
  version: '6.0.0',
  phase: 6,
  category: 'finance_analytics',
  categoryLabelFa: 'مالی و تحلیل هوشمند',
  iconName: 'BarChart3',
  isCore: false,
  defaultEnabled: true,
  route: '/smart-analytics',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['remedial_plans'],
  implemented: true,
  component: SmartAnalyticsPage,
};
