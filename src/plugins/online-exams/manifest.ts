import type { PluginManifest } from '../../core/plugins/types';
import { OnlineExamsPage } from './OnlineExamsPage';
import { OnlineExamsWidget } from './OnlineExamsWidget';

export const onlineExamsManifest: PluginManifest = {
  id: 'online-exams',
  nameFa: 'سامانه آزمون آنلاین و تصحیح هوشمند',
  shortNameFa: 'آزمون آنلاین',
  descriptionFa:
    'ساخت آزمون متصل به بانک سوالات و سبد آزمون، تایمر شمارش معکوس، تصحیح خودکار تستی، صف تصحیح تشریحی و انتقال نمرات به دفتر کلاسی.',
  version: '3.0.0',
  phase: 3,
  category: 'digital_learning',
  categoryLabelFa: 'یادگیری دیجیتال و کلاس آنلاین',
  iconName: 'FileSpreadsheet',
  isCore: false,
  defaultEnabled: true,
  route: '/online-exams',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['online_exams', 'online_exam_submissions'],
  implemented: true,
  component: OnlineExamsPage,
  dashboardWidget: OnlineExamsWidget,
};
