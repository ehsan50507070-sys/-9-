import type { PluginManifest } from '../../core/plugins/types';
import { MediaHubPage } from './MediaHubPage';
import { MediaHubWidget } from './MediaHubWidget';

export const mediaHubManifest: PluginManifest = {
  id: 'media-hub',
  nameFa: 'بانک محتوای جلسه و رسانه آموزشی',
  shortNameFa: 'بانک محتوا',
  descriptionFa:
    'سازمان‌دهی اسلاید، کاربرگ PDF، تصویر، پیوند امن و یادداشت صوتی هر هفته با نمایش کلاسی و ارسال به چت کلاسی.',
  version: '2.0.0',
  phase: 2,
  category: 'academics',
  categoryLabelFa: 'آموزش و ارزشیابی',
  iconName: 'FolderKanban',
  isCore: false,
  defaultEnabled: true,
  route: '/media-hub',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['media_resources', 'chat_outbox'],
  implemented: true,
  component: MediaHubPage,
  dashboardWidget: MediaHubWidget,
};
