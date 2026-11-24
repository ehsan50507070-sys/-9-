// Step 3: Safe Selective Reset & Restore Last State Helpers
// Guarantees automatic emergency backup snapshot creation BEFORE any destructive module reset.
import type {
  CollectionName,
  SelectiveResetModuleKey,
} from '../../types/domain';

export interface SelectiveResetModuleMeta {
  key: SelectiveResetModuleKey;
  labelFa: string;
  descriptionFa: string;
  collections: CollectionName[];
}

export const SELECTIVE_RESET_MODULES: SelectiveResetModuleMeta[] = [
  {
    key: 'homework',
    labelFa: 'تکالیف و تحویل دانش‌آموزان',
    descriptionFa: 'پاک‌سازی لیست تکالیف و پاسخ‌های ارسال‌شده دانش‌آموزان این مدرسه (با ذخیره خودکار بکاپ اضطراری قبل از ریست).',
    collections: ['homework_assignments', 'homework_submissions'],
  },
  {
    key: 'attendance',
    labelFa: 'سوابق حضور و غیاب',
    descriptionFa: 'پاک‌سازی رکوردهای حضور و غیاب زنگ‌به‌زنگ دانش‌آموزان و کادر در این مدرسه.',
    collections: ['student_attendance', 'staff_attendance'],
  },
  {
    key: 'messages',
    labelFa: 'پیام‌ها و گفت‌وگوهای داخلی',
    descriptionFa: 'پاک‌سازی پیام‌های گفت‌وگوی اولیا، چت کلاسی و رسیدهای خوانده‌شدن اعلان‌ها در این مدرسه.',
    collections: ['parent_staff_messages', 'class_chat_messages', 'notification_read_receipts'],
  },
  {
    key: 'archive',
    labelFa: 'آرشیو هوشمند محتوا',
    descriptionFa: 'پاک‌سازی فهرست محتوای ذخیره‌شده در آرشیو هوشمند این مدرسه (بدون حذف دروس اصلی).',
    collections: ['smart_content_archive'],
  },
  {
    key: 'announcements_settings',
    labelFa: 'اطلاعیه‌ها و عناوین سفارشی بخش‌ها',
    descriptionFa: 'پاک‌سازی اطلاعیه‌های ثبت‌شده و بازگرداندن عناوین سفارشی منوها به حالت استاندارد مدرسه.',
    collections: ['school_announcements', 'school_branding_configs'],
  },
];

export function getSelectiveResetModuleMeta(
  key: SelectiveResetModuleKey
): SelectiveResetModuleMeta {
  return (
    SELECTIVE_RESET_MODULES.find((m) => m.key === key) ?? SELECTIVE_RESET_MODULES[0]
  );
}

export interface ModuleSnapshotPayload {
  version: 1;
  schoolId: string;
  moduleKey: SelectiveResetModuleKey | 'full_school';
  collections: Partial<Record<CollectionName, unknown[]>>;
}

export function serializeModuleSnapshot(payload: ModuleSnapshotPayload): string {
  return JSON.stringify(payload);
}

export function parseModuleSnapshot(rawJson: string): ModuleSnapshotPayload | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<ModuleSnapshotPayload>;
    if (!parsed || parsed.version !== 1 || !parsed.schoolId || !parsed.collections) {
      return null;
    }
    return parsed as ModuleSnapshotPayload;
  } catch {
    return null;
  }
}
