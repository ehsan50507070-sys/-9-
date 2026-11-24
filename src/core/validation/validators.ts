// Native TypeScript Runtime Validators (zero external packages, zero `any`)
import { toAsciiDigits } from '../../lib/digits';
import { parseJalaliString } from '../../lib/jalali';
import type {
  BackupPayload,
  DailyLogCategory,
  PersianWeekdayIndex,
  School,
} from '../../types/domain';

export interface ValidationResult<T = true> {
  valid: boolean;
  data?: T;
  errors: string[];
}

/**
 * Validates a 10-digit Iranian National ID (کد ملی) with strict checksum verification
 * after normalizing Persian/Arabic digits to ASCII.
 */
export function validateIranianNationalId(code: string): boolean {
  const digits = toAsciiDigits(code).replace(/\s|-/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  // Reject all identical digits (e.g., 1111111111)
  if (/^(\d)\1{9}$/.test(digits)) return false;

  const check = Number(digits[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/**
 * Generates a mathematically valid 10-digit Iranian National ID from a 9-digit prefix (for deterministic seeding).
 */
export function buildValidIranianNationalId(nineDigits: string): string {
  const clean = toAsciiDigits(nineDigits).replace(/\D/g, '').slice(0, 9).padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(clean[i]) * (10 - i);
  }
  const rem = sum % 11;
  const check = rem < 2 ? rem : 11 - rem;
  return `${clean}${check}`;
}

/**
 * Validates Jalali date string (YYYY/MM/DD) including exact month lengths and leap year Esfand.
 */
export function validateJalaliDate(dateStr: string): boolean {
  return parseJalaliString(dateStr) !== null;
}

/**
 * Validates Iranian mobile phone number (09xxxxxxxxx).
 */
export function validateIranianMobile(phone: string): boolean {
  const normalized = toAsciiDigits(phone).replace(/[\s-]/g, '');
  return /^09\d{9}$/.test(normalized);
}

/**
 * Validates Persian school grade score (0 <= score <= 20).
 */
export function validateGradeScore(score: number): boolean {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 20;
}

export function validateTimeHHMM(timeStr: string): boolean {
  const normalized = toAsciiDigits(timeStr).trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalized);
  return match !== null;
}

export interface DailyLogFormInput {
  jalaliDate: string;
  category: DailyLogCategory;
  title: string;
  description: string;
  studentId?: string;
  classId?: string;
  pickupPersonName?: string;
  pickupRelation?: string;
  exitTime?: string;
  severity?: 'normal' | 'attention' | 'urgent';
}

export function validateDailyLogInput(input: DailyLogFormInput): ValidationResult<DailyLogFormInput> {
  const errors: string[] = [];

  if (!validateJalaliDate(input.jalaliDate)) {
    errors.push('تاریخ شمسی معتبر نیست (قالب صحیح: ۱۴۰۵/۰۸/۲۹).');
  }
  if (!input.title || input.title.trim().length < 3) {
    errors.push('عنوان گزارش باید حداقل ۳ کاراکتر باشد.');
  }
  if (!input.description || input.description.trim().length < 5) {
    errors.push('شرح واقعه باید حداقل ۵ کاراکتر باشد.');
  }

  if (input.category === 'early_dismissal') {
    if (!input.studentId) {
      errors.push('برای مرخصی ساعتی، انتخاب دانش‌آموز الزامی است.');
    }
    if (!input.pickupPersonName || input.pickupPersonName.trim().length < 2) {
      errors.push('نام تحویل‌گیرنده (ولی یا نماینده) الزامی است.');
    }
    if (!input.pickupRelation || input.pickupRelation.trim().length < 2) {
      errors.push('نسبت تحویل‌گیرنده با دانش‌آموز الزامی است.');
    }
    if (!input.exitTime || !validateTimeHHMM(input.exitTime)) {
      errors.push('ساعت خروج معتبر وارد کنید (مثال: ۱۰:۳۰).');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: input, errors: [] };
}

export interface SchoolSettingsInput {
  name: string;
  subtitle: string;
  principalName: string;
  phone: string;
  address: string;
  academicYear: string;
  activeWorkdays: PersianWeekdayIndex[];
  letterheadTitle: string;
  letterheadSubtitle: string;
  signatureFooter: string;
  periodDurationMinutes: number;
}

export function validateSchoolSettings(
  input: SchoolSettingsInput
): ValidationResult<SchoolSettingsInput> {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 3) {
    errors.push('نام مدرسه باید حداقل ۳ کاراکتر باشد.');
  }
  if (!input.principalName || input.principalName.trim().length < 3) {
    errors.push('نام مدیر مدرسه الزامی است.');
  }
  if (!input.academicYear || !/^\d{4}-\d{4}$/.test(toAsciiDigits(input.academicYear).trim())) {
    errors.push('سال تحصیلی باید در قالب ۱۴۰۵-۱۴۰۶ باشد.');
  }
  if (!Array.isArray(input.activeWorkdays) || input.activeWorkdays.length === 0) {
    errors.push('حداقل یک روز کاری در هفته باید انتخاب شود.');
  }
  if (
    typeof input.periodDurationMinutes !== 'number' ||
    input.periodDurationMinutes < 30 ||
    input.periodDurationMinutes > 120
  ) {
    errors.push('مدت هر زنگ باید بین ۳۰ تا ۱۲۰ دقیقه باشد.');
  }
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: input, errors: [] };
}

export interface StudentCsvRowInput {
  fullName: string;
  nationalId: string;
  classId: string;
  parentName: string;
  parentMobile: string;
}

export function validateStudentCsvRow(
  row: StudentCsvRowInput,
  rowNumber: number
): ValidationResult<StudentCsvRowInput> {
  const errors: string[] = [];
  if (!row.fullName || row.fullName.trim().length < 3) {
    errors.push(`ردیف ${rowNumber}: نام و نام خانوادگی دانش‌آموز نامعتبر است.`);
  }
  if (!validateIranianNationalId(row.nationalId)) {
    errors.push(`ردیف ${rowNumber}: کد ملی «${row.nationalId}» معتبر نیست.`);
  }
  if (!row.parentName || row.parentName.trim().length < 2) {
    errors.push(`ردیف ${rowNumber}: نام ولی الزامی است.`);
  }
  if (!validateIranianMobile(row.parentMobile)) {
    errors.push(`ردیف ${rowNumber}: شماره موبایل ولی «${row.parentMobile}» معتبر نیست.`);
  }
  if (!row.classId) {
    errors.push(`ردیف ${rowNumber}: شناسه کلاس مشخص نشده است.`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    data: {
      ...row,
      nationalId: toAsciiDigits(row.nationalId).replace(/\s|-/g, ''),
      parentMobile: toAsciiDigits(row.parentMobile).replace(/[\s-]/g, ''),
    },
    errors: [],
  };
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a JSON Backup payload before restoring into the repository.
 * Ensures schema integrity and schoolId presence on all tenant records.
 */
export function validateBackupPayload(raw: unknown): ValidationResult<BackupPayload> {
  const errors: string[] = [];
  if (!isRecordObject(raw)) {
    return { valid: false, errors: ['ساختار فایل پشتیبان JSON معتبر نیست.'] };
  }

  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion < 1) {
    errors.push('نسخه ساختار فایل پشتیبان نامعتبر است.');
  }
  if (raw.scope !== 'single_school' && raw.scope !== 'complex_wide') {
    errors.push('دامنه فایل پشتیبان (تک‌مدرسه یا کل مجموعه) مشخص نیست.');
  }
  if (raw.scope === 'single_school' && (typeof raw.schoolId !== 'string' || !raw.schoolId)) {
    errors.push('در پشتیبان تک‌مدرسه، شناسه مدرسه (schoolId) الزامی است.');
  }
  if (!isRecordObject(raw.data)) {
    errors.push('بخش داده‌ها (data) در فایل پشتیبان یافت نشد.');
    return { valid: false, errors };
  }

  const requiredCollections = [
    'schools',
    'classes',
    'students',
    'teachers',
    'schedules',
    'student_attendance',
    'staff_attendance',
    'substitutions',
    'daily_logs',
    'school_plugin_states',
  ] as const;

  const optionalPhase2Collections = [
    'curriculum_topics',
    'media_resources',
    'chat_outbox',
    'gradebook_entries',
    'lesson_plans',
    'gradebook_weights',
    'grade_appeals',
    'homework_assignments',
    'homework_submissions',
    'student_rewards',
    'question_bank',
    'class_chat_draft_queue',
    'exam_question_basket',
    'flipped_lessons',
    'flipped_telemetry',
    'flipped_questions',
    'online_class_sessions',
    'online_class_attendance',
    'online_exams',
    'online_exam_submissions',
    'student_360_signals',
    'parent_staff_messages',
    'class_chat_rooms',
    'class_chat_messages',
    'appointment_slots',
    'electronic_forms',
    'electronic_form_responses',
    'notification_templates',
    'sida_grade_audit_logs',
    'in_person_exam_halls',
    'in_person_exam_sessions',
    'exam_seating_charts',
    'student_profiles',
    'staff_profiles',
    'sida_speed_entry_ticks',
    'user_appearance_prefs',
    'school_branding_configs',
    'finance_fee_plans',
    'finance_student_ledgers',
    'finance_payments',
    'finance_expenses',
    'remedial_plans',
    'anonymous_surveys',
    'survey_participation_receipts',
    'survey_anonymous_responses',
    'td_courses',
    'td_progress',
    'td_certificates',
    'td_school_settings',
    'educational_complexes',
    'managed_admin_accounts',
    'role_governance_configs',
    'global_system_configs',
    'super_admin_audit_logs',
    'import_mapping_templates',
    'discipline_records',
    'discipline_pledges',
    'student_exit_passes',
    'staff_leave_requests',
    'counseling_sessions',
    'counseling_clinical_notes',
    'virtual_class_sessions',
    'virtual_class_attendance',
  ] as const;

  const checkCollectionArray = (col: string, arr: unknown[]) => {
    for (const item of arr) {
      if (!isRecordObject(item) || typeof item.id !== 'string' || typeof item.schoolId !== 'string') {
        errors.push(`رکورد نامعتبر در مجموعه «${col}» (فقدان id یا schoolId).`);
        break;
      }
      if (raw.scope === 'single_school' && item.schoolId !== raw.schoolId) {
        errors.push(`تعارض ایزوله‌سازی مدرسه در «${col}»: رکورد متعلق به مدرسه دیگری است.`);
        break;
      }
    }
  };

  for (const col of requiredCollections) {
    const arr = raw.data[col];
    if (!Array.isArray(arr)) {
      errors.push(`مجموعه «${col}» در فایل پشتیبان وجود ندارد یا آرایه نیست.`);
      continue;
    }
    checkCollectionArray(col, arr);
  }

  const normalizedData: Record<string, unknown[]> = {
    ...(raw.data as Record<string, unknown[]>),
  };

  for (const col of optionalPhase2Collections) {
    const arr = raw.data[col];
    if (arr === undefined) {
      normalizedData[col] = [];
    } else if (!Array.isArray(arr)) {
      errors.push(`مجموعه «${col}» در فایل پشتیبان آرایه معتبر نیست.`);
    } else {
      checkCollectionArray(col, arr);
    }
  }

  if (Array.isArray(raw.data.schools) && raw.data.schools.length === 0) {
    errors.push('فایل پشتیبان باید حداقل اطلاعات یک مدرسه را شامل باشد.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const schools = raw.data.schools as School[];
  if (!schools.every((s) => typeof s.name === 'string' && Array.isArray(s.activeWorkdays))) {
    return { valid: false, errors: ['ساختار اطلاعات مدرسه در فایل پشتیبان ناقص است.'] };
  }

  return {
    valid: true,
    data: {
      ...(raw as unknown as BackupPayload),
      data: normalizedData as unknown as BackupPayload['data'],
    },
    errors: [],
  };
}

export interface StudentFormInput {
  fullName: string;
  nationalId: string;
  classId: string;
  parentName: string;
  parentMobile: string;
  birthDateJalali?: string;
  emergencyNotes?: string;
}

export function validateStudentFormInput(
  input: StudentFormInput,
  existingNationalIds: string[] = []
): ValidationResult<StudentFormInput> {
  const errors: string[] = [];
  const cleanNatId = toAsciiDigits(input.nationalId).replace(/[\s-]/g, '');
  const cleanMobile = toAsciiDigits(input.parentMobile).replace(/[\s-]/g, '');
  const cleanBirthDate = input.birthDateJalali ? toAsciiDigits(input.birthDateJalali).trim() : '';

  if (!input.fullName || input.fullName.trim().length < 3) {
    errors.push('نام و نام خانوادگی دانش‌آموز باید حداقل ۳ کاراکتر باشد.');
  }
  if (!validateIranianNationalId(cleanNatId)) {
    errors.push('کد ملی دانش‌آموز نامعتبر است (باید ۱۰ رقم با رقم کنترل صحیح باشد).');
  } else if (existingNationalIds.includes(cleanNatId)) {
    errors.push('دانش‌آموزی با این کد ملی قبلاً در این مدرسه ثبت شده است.');
  }
  if (!input.classId) {
    errors.push('انتخاب پایه و کلاس الزامی است.');
  }
  if (!input.parentName || input.parentName.trim().length < 2) {
    errors.push('نام ولی دانش‌آموز الزامی است.');
  }
  if (!validateIranianMobile(cleanMobile)) {
    errors.push('شماره موبایل ولی معتبر نیست (باید با ۰۹ شروع شده و ۱۱ رقم باشد).');
  }
  if (cleanBirthDate && !validateJalaliDate(cleanBirthDate)) {
    errors.push('تاریخ تولد شمسی نامعتبر است (قالب صحیح: ۱۳۹۶/۰۵/۱۴).');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    data: {
      fullName: input.fullName.trim(),
      nationalId: cleanNatId,
      classId: input.classId,
      parentName: input.parentName.trim(),
      parentMobile: cleanMobile,
      birthDateJalali: cleanBirthDate || undefined,
      emergencyNotes: input.emergencyNotes?.trim() || undefined,
    },
    errors: [],
  };
}

export interface ClassFormInput {
  name: string;
  gradeLevel: 2 | 3 | 4 | 5 | 6;
  customGradeLabel?: string;
  section: string;
  homeroomTeacherId: string;
  capacity: number;
  roomCode: string;
}

export function validateClassFormInput(input: ClassFormInput): ValidationResult<ClassFormInput> {
  const errors: string[] = [];
  const cleanRoom = toAsciiDigits(input.roomCode).trim();

  if (!input.name || input.name.trim().length < 3) {
    errors.push('عنوان کلاس باید حداقل ۳ کاراکتر باشد.');
  }
  if (!input.section || input.section.trim().length < 1) {
    errors.push('شعبه یا نام کلاس (مثلاً الف یا ب) الزامی است.');
  }
  if (!cleanRoom) {
    errors.push('کد اتاق کلاس الزامی است.');
  }
  if (!Number.isFinite(input.capacity) || input.capacity < 1 || input.capacity > 60) {
    errors.push('ظرفیت کلاس باید عددی بین ۱ تا ۶۰ نفر باشد.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    data: {
      ...input,
      name: input.name.trim(),
      customGradeLabel: input.customGradeLabel?.trim() || undefined,
      section: input.section.trim(),
      roomCode: cleanRoom,
    },
    errors: [],
  };
}

export interface TeacherFormInput {
  fullName: string;
  nationalId: string;
  mobile: string;
  specialty: string;
  assignedClassIds: string[];
  weeklyQuotaPeriods: number;
}

export function validateTeacherFormInput(
  input: TeacherFormInput,
  existingNationalIds: string[] = []
): ValidationResult<TeacherFormInput> {
  const errors: string[] = [];
  const cleanNatId = toAsciiDigits(input.nationalId).replace(/[\s-]/g, '');
  const cleanMobile = toAsciiDigits(input.mobile).replace(/[\s-]/g, '');

  if (!input.fullName || input.fullName.trim().length < 3) {
    errors.push('نام و نام خانوادگی معلم باید حداقل ۳ کاراکتر باشد.');
  }
  if (!validateIranianNationalId(cleanNatId)) {
    errors.push('کد ملی معلم نامعتبر است (باید ۱۰ رقم معتبر باشد).');
  } else if (existingNationalIds.includes(cleanNatId)) {
    errors.push('همکاری با این کد ملی قبلاً در این مدرسه ثبت شده است.');
  }
  if (!validateIranianMobile(cleanMobile)) {
    errors.push('شماره موبایل معلم معتبر نیست (قالب صحیح: ۰۹۱۲۱۲۳۴۵۶۷).');
  }
  if (!input.specialty || input.specialty.trim().length < 2) {
    errors.push('تخصص یا درس تدریسی الزامی است.');
  }
  if (!Number.isFinite(input.weeklyQuotaPeriods) || input.weeklyQuotaPeriods < 1 || input.weeklyQuotaPeriods > 32) {
    errors.push('سقف زنگ موظف هفتگی باید بین ۱ تا ۳۲ زنگ باشد.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    data: {
      ...input,
      fullName: input.fullName.trim(),
      nationalId: cleanNatId,
      mobile: cleanMobile,
      specialty: input.specialty.trim(),
    },
    errors: [],
  };
}

// --- Phase 2 Security & Form Validators ---

export const MAX_ATTACHMENT_BYTES = 350 * 1024; // 350 KB cap to protect offline localStorage budget

const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
]);

/**
 * Strictly validates external educational links: allows ONLY http:// and https:// schemes.
 * Blocks javascript:, data:, vbscript:, file:, etc.
 */
export function validateSafeHttpUrl(rawUrl: string): ValidationResult<string> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, errors: ['نشانی اینترنتی وارد نشده است.'] };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        errors: ['فقط پیوندهای امن با پروتکل http:// یا https:// مجاز هستند.'],
      };
    }
    return { valid: true, data: parsed.toString(), errors: [] };
  } catch {
    return {
      valid: false,
      errors: ['قالب نشانی اینترنتی معتبر نیست (مثال: https://example.ir/lesson).'],
    };
  }
}

/**
 * Validates uploaded media/homework attachment MIME type and size limit.
 * Explicitly blocks HTML/SVG/script files and files larger than 350 KB.
 */
export function validateAttachmentFile(meta: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): ValidationResult<true> {
  const errors: string[] = [];
  const lowerName = meta.fileName.toLowerCase();
  const baseMime = meta.mimeType.split(';')[0].trim().toLowerCase();

  if (lowerName.endsWith('.svg') || lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerName.endsWith('.js')) {
    errors.push('بارگذاری فایل‌های اسکریپتی، HTML یا SVG به دلایل امنیتی مجاز نیست.');
  } else if (baseMime && !ALLOWED_ATTACHMENT_MIMES.has(baseMime)) {
    const allowedExt = /\.(png|jpe?g|webp|pdf|pptx?|webm|ogg|mp3|wav|m4a)$/.test(lowerName);
    if (!allowedExt) {
      errors.push('نوع فایل انتخاب‌شده پشتیبانی نمی‌شود (مجاز: تصویر PNG/JPG/WebP، PDF، پاورپوینت یا فایل صوتی).');
    }
  }

  if (meta.sizeBytes > MAX_ATTACHMENT_BYTES) {
    errors.push('حجم فایل پیوست نباید بیشتر از ۳۵۰ کیلوبایت باشد (جهت پایداری حافظه آفلاین).');
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: true, errors: [] };
}

export function validateCurriculumTopicInput(input: {
  subject: string;
  weekNumber: number;
  topic: string;
}): ValidationResult<true> {
  const errors: string[] = [];
  if (!input.subject.trim()) errors.push('عنوان درس الزامی است.');
  if (!Number.isInteger(input.weekNumber) || input.weekNumber < 1 || input.weekNumber > 36) {
    errors.push('شماره هفته باید عددی صحیح بین ۱ تا ۳۶ باشد.');
  }
  if (!input.topic || input.topic.trim().length < 3) {
    errors.push('عنوان مبحث هفته باید حداقل ۳ کاراکتر باشد.');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true, data: true, errors: [] };
}

export function validateHomeworkAssignmentInput(input: {
  classId: string;
  subject: string;
  title: string;
  description: string;
  dueDateJalali: string;
  attachmentUrl?: string;
}): ValidationResult<true> {
  const errors: string[] = [];
  if (!input.classId) errors.push('انتخاب کلاس الزامی است.');
  if (!input.subject.trim()) errors.push('نام درس الزامی است.');
  if (!input.title || input.title.trim().length < 3) {
    errors.push('عنوان تکلیف باید حداقل ۳ کاراکتر باشد.');
  }
  if (!input.description || input.description.trim().length < 5) {
    errors.push('شرح تکلیف باید حداقل ۵ کاراکتر باشد.');
  }
  if (!validateJalaliDate(input.dueDateJalali)) {
    errors.push('تاریخ مهلت تحویل شمسی معتبر نیست (مثال: ۱۴۰۵/۰۹/۰۵).');
  }
  if (input.attachmentUrl && input.attachmentUrl.trim().length > 0) {
    const urlRes = validateSafeHttpUrl(input.attachmentUrl);
    if (!urlRes.valid) errors.push(...urlRes.errors);
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true, data: true, errors: [] };
}

// --- Phase 2.5 Rich Media (IndexedDB Blob) & Question Bank Validators ---

export const MAX_IMAGE_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_AUDIO_VIDEO_BYTES = 15 * 1024 * 1024; // 15 MB

const SAFE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const SAFE_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
]);
const SAFE_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);

export function validateRichMediaFile(meta: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  allowPdf?: boolean;
}): ValidationResult<'image' | 'audio' | 'video' | 'pdf'> {
  const lowerName = meta.fileName.toLowerCase();
  const baseMime = meta.mimeType.split(';')[0].trim().toLowerCase();

  // Explicitly block active web content formats
  if (
    lowerName.endsWith('.svg') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.js') ||
    lowerName.endsWith('.mjs') ||
    lowerName.endsWith('.xml') ||
    baseMime.includes('svg') ||
    baseMime.includes('html') ||
    baseMime.includes('javascript')
  ) {
    return {
      valid: false,
      errors: ['بارگذاری فایل‌های SVG، HTML یا اسکریپتی به دلایل امنیتی مجاز نیست.'],
    };
  }

  let kind: 'image' | 'audio' | 'video' | 'pdf' | null = null;
  if (SAFE_IMAGE_MIMES.has(baseMime) || /\.(png|jpe?g|webp|gif)$/.test(lowerName)) {
    kind = 'image';
  } else if (SAFE_AUDIO_MIMES.has(baseMime) || /\.(mp3|wav|ogg|m4a|aac)$/.test(lowerName)) {
    kind = 'audio';
  } else if (SAFE_VIDEO_MIMES.has(baseMime) || /\.(mp4|webm|ogv|mov)$/.test(lowerName)) {
    kind = 'video';
  } else if (meta.allowPdf && (baseMime === 'application/pdf' || lowerName.endsWith('.pdf'))) {
    kind = 'pdf';
  }

  if (!kind) {
    return {
      valid: false,
      errors: [
        meta.allowPdf
          ? 'فرمت فایل پشتیبانی نمی‌شود (مجاز: تصویر PNG/JPG/WebP، فایل PDF، صوت یا ویدیو).'
          : 'فرمت فایل پشتیبانی نمی‌شود (مجاز: عکس PNG/JPG/WebP، فایل صوتی MP3/WAV/OGG یا ویدیو MP4/WebM).',
      ],
    };
  }

  if ((kind === 'image' || kind === 'pdf') && meta.sizeBytes > MAX_IMAGE_PDF_BYTES) {
    return {
      valid: false,
      errors: ['حجم فایل تصویر یا PDF نباید بیشتر از ۵ مگابایت باشد. لطفاً فایل سبک‌تری انتخاب کنید.'],
    };
  }

  if ((kind === 'audio' || kind === 'video') && meta.sizeBytes > MAX_AUDIO_VIDEO_BYTES) {
    return {
      valid: false,
      errors: ['حجم فایل صوتی یا ویدیویی نباید بیشتر از ۱۵ مگابایت باشد. لطفاً نسخه فشرده‌تری بارگذاری کنید.'],
    };
  }

  return { valid: true, data: kind, errors: [] };
}

export function validateQuestionBankInput(input: {
  gradeLabel: string;
  subject: string;
  chapter: string;
  type: 'multiple_choice' | 'descriptive' | 'true_false' | 'fill_blank' | 'file_sample';
  questionText: string;
  options?: string[];
  correctOptionIndex?: number;
  hasMedia?: boolean;
}): ValidationResult<true> {
  const errors: string[] = [];
  if (!input.gradeLabel.trim()) errors.push('انتخاب پایه تحصیلی الزامی است.');
  if (!input.subject.trim()) errors.push('وارد کردن نام درس الزامی است.');
  if (!input.chapter.trim()) errors.push('وارد کردن فصل یا مبحث الزامی است.');
  if (input.type === 'file_sample') {
    if (!input.hasMedia && input.questionText.trim().length < 3) {
      errors.push('برای نمونه سوال فایلی، بارگذاری تصویر/PDF یا ثبت توضیح سوال الزامی است.');
    }
  } else if (!input.questionText || input.questionText.trim().length < 4) {
    errors.push('متن سوال باید حداقل ۴ کاراکتر باشد.');
  }

  if (input.type === 'multiple_choice') {
    const opts = input.options ?? [];
    if (opts.length !== 4 || opts.some((o) => !o || o.trim().length === 0)) {
      errors.push('برای سوال چهارگزینه‌ای وارد کردن هر ۴ گزینه الزامی است.');
    }
    if (
      input.correctOptionIndex === undefined ||
      input.correctOptionIndex < 0 ||
      input.correctOptionIndex > 3
    ) {
      errors.push('گزینه صحیح باید بین ۱ تا ۴ انتخاب شود.');
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, data: true, errors: [] };
}

// --- Phase 3 Validators (Flipped Video 40MB guard, Online Classroom, Online Exams) ---

export const MAX_FLIPPED_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB cap for offline Flipped Video

export function validateFlippedVideoFile(meta: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): ValidationResult<true> {
  const lowerName = meta.fileName.toLowerCase();
  const baseMime = meta.mimeType.split(';')[0].trim().toLowerCase();

  if (
    lowerName.endsWith('.svg') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.js') ||
    baseMime.includes('html') ||
    baseMime.includes('javascript')
  ) {
    return {
      valid: false,
      errors: ['بارگذاری فایل‌های اسکریپتی یا HTML مجاز نیست.'],
    };
  }

  const isVideo =
    baseMime.startsWith('video/') || /\.(mp4|webm|ogv|ogg|mov|m4v)$/.test(lowerName);
  if (!isVideo) {
    return {
      valid: false,
      errors: ['لطفاً فقط فایل ویدیویی معتبر (MP4، WebM یا MOV) انتخاب کنید.'],
    };
  }

  if (meta.sizeBytes > MAX_FLIPPED_VIDEO_BYTES) {
    return {
      valid: false,
      errors: [
        'حجم فایل ویدیویی نباید بیشتر از ۴۰ مگابایت باشد. برای پایداری حافظه آفلاین، ویدیوی فشرده‌تر انتخاب کنید یا از «حالت نمایشی ۶۰ ثانیه‌ای» استفاده نمایید.',
      ],
    };
  }

  return { valid: true, data: true, errors: [] };
}

export function validateOnlineClassSessionInput(input: {
  title: string;
  classId: string;
  subject: string;
  jalaliDate: string;
  startTime: string;
  endTime: string;
  joinUrl: string;
}): ValidationResult<true> {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length < 3) {
    errors.push('عنوان جلسه کلاس آنلاین باید حداقل ۳ کاراکتر باشد.');
  }
  if (!input.classId) errors.push('انتخاب کلاس الزامی است.');
  if (!input.subject.trim()) errors.push('نام درس الزامی است.');
  if (!validateJalaliDate(input.jalaliDate)) {
    errors.push('تاریخ برگزاری شمسی معتبر نیست (مثال: ۱۴۰۵/۰۹/۰۵).');
  }
  if (!validateTimeHHMM(input.startTime) || !validateTimeHHMM(input.endTime)) {
    errors.push('ساعت شروع و پایان جلسه باید در قالب معتبر HH:MM وارد شود (مثال: ۰۹:۰۰).');
  }
  const urlRes = validateSafeHttpUrl(input.joinUrl);
  if (!urlRes.valid) errors.push(...urlRes.errors);

  return errors.length > 0 ? { valid: false, errors } : { valid: true, data: true, errors: [] };
}

export function validateOnlineExamInput(input: {
  title: string;
  classId: string;
  subject: string;
  startDateJalali: string;
  endDateJalali: string;
  durationMinutes: number;
  questionCount: number;
}): ValidationResult<true> {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length < 3) {
    errors.push('عنوان آزمون باید حداقل ۳ کاراکتر باشد.');
  }
  if (!input.classId) errors.push('انتخاب کلاس هدف الزامی است.');
  if (!input.subject.trim()) errors.push('نام درس الزامی است.');
  if (!validateJalaliDate(input.startDateJalali) || !validateJalaliDate(input.endDateJalali)) {
    errors.push('تاریخ شروع و پایان بازه آزمون باید تاریخ شمسی معتبر باشد.');
  }
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 240) {
    errors.push('مدت زمان آزمون باید بین ۱ تا ۲۴۰ دقیقه باشد.');
  }
  if (input.questionCount < 1) {
    errors.push('آزمون باید حداقل شامل یک سوال باشد.');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true, data: true, errors: [] };
}
