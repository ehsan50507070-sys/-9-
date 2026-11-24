// Non-Destructive Plugin Manifest: Class Group Chat (Phase 4)
import type { PluginManifest } from '../../core/plugins/types';
import { ClassChatPage } from './ClassChatPage';

export const classChatManifest: PluginManifest = {
  id: 'class-chat',
  nameFa: 'چت اختصاصی هر کلاس',
  shortNameFa: 'چت کلاسی',
  descriptionFa:
    'کانال گروهی هر کلاس با نشان نقش، حالت اطلاع‌رسانی/گفت‌وگوی آزاد، نظرسنجی زنده، اتصال به بانک سوالات و همگام‌سازی لحظه‌ای.',
  version: '4.0.0',
  phase: 4,
  category: 'communication',
  categoryLabelFa: 'ارتباط با خانواده',
  iconName: 'MessageSquare',
  isCore: false,
  defaultEnabled: true,
  route: '/class-chat',
  allowedRoles: ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
  dataStores: ['class_chat_rooms', 'class_chat_messages'],
  implemented: true,
  component: ClassChatPage,
};
