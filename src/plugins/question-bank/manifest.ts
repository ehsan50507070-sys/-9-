// Plugin Manifest: Standalone Question Bank («بانک سوالات» - Phase 2.5)
import type { PluginManifest } from '../../core/plugins/types';
import { QuestionBankPage } from './QuestionBankPage';
import { QuestionBankWidget } from './QuestionBankWidget';

export const questionBankManifest: PluginManifest = {
  id: 'question-bank',
  nameFa: 'بانک سوالات و طراحی آزمون A4',
  shortNameFa: 'بانک سوالات',
  descriptionFa:
    'مخزن استاندارد سوالات تستی، تشریحی، صحیح و غلط، جایخالی و نمونه سوال فایلی با ارسال یک‌کلیکی به تکالیف آنلاین، بازی آموزشی، چت کلاسی و چاپ A4 برگه آزمون.',
  version: '2.5.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'Library',
  isCore: false,
  defaultEnabled: true,
  route: '/question-bank',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher'],
  dataStores: ['question_bank'],
  implemented: true,
  component: QuestionBankPage,
  dashboardWidget: QuestionBankWidget,
};
