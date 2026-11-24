// Step 3-B: Data Integrity Guard — Panic Mode, Anti-Wipe Circuit Breaker,
// SHA-256 Tamper-Evident Audit Chain, Referential Integrity Checker & Sealed Phase-10 Bundles
import type {
  AuditChainVerificationResult,
  CollectionName,
  DailyRollingSnapshot,
  MigrationBundleScope,
  MigrationBundleVerificationResult,
  PanicModeState,
  ReferentialIntegrityIssue,
  ReferentialIntegrityReport,
  SealedMigrationBundle,
  SecurityAuditLogEntry,
  SoftDeleteVersionFields,
} from '../../types/domain';
import type { SeedDataset } from '../data/seedData';
import { sha256Hex, sha256HexSync } from './cryptoService';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';

export const COLLECTION_LABELS_FA: Partial<Record<CollectionName, string>> = {
  schools: 'مدارس',
  classes: 'کلاس‌ها',
  students: 'دانش‌آموزان',
  teachers: 'معلمان و کادر آموزشی',
  schedules: 'برنامه هفتگی',
  student_attendance: 'حضور و غیاب دانش‌آموزان',
  staff_attendance: 'حضور و غیاب کادر',
  substitutions: 'جایگزینی معلمان',
  daily_logs: 'گزارش روزانه مدرسه',
  school_plugin_states: 'وضعیت ماژول‌ها',
  curriculum_topics: 'سرفصل‌های درسی',
  media_resources: 'منابع آموزشی و چندرسانه‌ای',
  chat_outbox: 'صف ارسال پیام',
  gradebook_entries: 'دفتر نمره و ارزشیابی',
  lesson_plans: 'طرح درس',
  gradebook_weights: 'ضرایب دفتر نمره',
  grade_appeals: 'اعتراض به نمره',
  homework_assignments: 'تکالیف کلاسی',
  homework_submissions: 'پاسخ تکالیف',
  student_rewards: 'تشویق و امتیاز دانش‌آموزان',
  question_bank: 'بانک سوال',
  flipped_lessons: 'کلاس معکوس',
  online_class_sessions: 'کلاس‌های آنلاین',
  online_exams: 'آزمون‌های آنلاین',
  online_exam_submissions: 'پاسخ‌برگ آزمون‌های آنلاین',
  parent_staff_messages: 'پیام‌های اولیا و مدرسه',
  appointment_slots: 'نوبت‌دهی مشاوره و ملاقات',
  electronic_forms: 'فرم‌های الکترونیک',
  electronic_form_responses: 'پاسخ فرم‌های الکترونیک',
  student_profiles: 'پرونده الکترونیک دانش‌آموزان',
  staff_profiles: 'پرونده الکترونیک کادر',
  finance_fee_plans: 'تعرفه‌های شهریه',
  finance_student_ledgers: 'حساب شهریه دانش‌آموزان',
  finance_payments: 'تراکنش‌های پرداخت',
  finance_expenses: 'هزینه‌های مدرسه',
  remedial_plans: 'برنامه‌های جبرانی',
  anonymous_surveys: 'نظرسنجی‌های ناشناس',
  td_courses: 'دوره‌های ضمن‌خدمت معلمان',
  educational_complexes: 'مجتمع‌های آموزشی',
  managed_admin_accounts: 'حساب‌های مدیریتی',
  academic_years: 'سال‌های تحصیلی',
  mock_exams: 'آزمون‌های آزمایشی',
  mock_exam_attempts: 'کارنامه آزمون‌های آزمایشی',
  sida_analytics_grades: 'سوابق تحلیلی سیدا',
  sida_remedial_groups: 'گروه‌های جبرانی سیدا',
  security_audit_logs: 'گزارش رویدادهای امنیتی',
  smart_content_archive: 'آرشیو هوشمند محتوا',
  school_announcements: 'اطلاعیه‌های مدرسه',
  student_transfer_logs: 'سوابق انتقال دانش‌آموزان',
  notification_read_receipts: 'رسید خواندن اعلان‌ها',
  recovery_snapshots: 'نقاط بازگردانی اضطراری',
  import_mapping_templates: 'الگوهای نگاشت ورود هوشمند',
  discipline_records: 'موارد انضباطی و تشویقی',
  discipline_pledges: 'تعهدنامه‌های انضباطی',
  student_exit_passes: 'برگه‌های خروج دانش‌آموزان',
  staff_leave_requests: 'مرخصی کادر و معلمان',
  counseling_sessions: 'جلسات و نوبت‌های مشاوره',
  counseling_clinical_notes: 'یادداشت‌های بالینی محرمانه مشاوره',
  virtual_class_sessions: 'جلسات هاب کلاس مجازی',
  virtual_class_attendance: 'حضور هوشمند کلاس مجازی',
};

export function getCollectionLabelFa(collection: CollectionName): string {
  return COLLECTION_LABELS_FA[collection] ?? collection;
}

export function isRecordSoftDeleted(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const candidate = record as SoftDeleteVersionFields;
  return typeof candidate.deletedAtIso === 'string' && candidate.deletedAtIso.trim().length > 0;
}

export function extractRecordDisplayTitle(
  collection: CollectionName,
  record: Record<string, unknown>
): { titleFa: string; subtitleFa?: string } {
  const str = (key: string): string => {
    const val = record[key];
    return typeof val === 'string' && val.trim() ? val.trim() : '';
  };

  const fullName =
    str('fullName') ||
    [str('firstName'), str('lastName')].filter(Boolean).join(' ') ||
    str('studentName') ||
    str('teacherName');
  const primaryTitle =
    str('title') ||
    str('name') ||
    fullName ||
    str('subject') ||
    str('topic') ||
    str('summaryFa') ||
    str('description') ||
    `${getCollectionLabelFa(collection)} (${str('id').slice(0, 8)})`;

  const subtitleParts: string[] = [];
  if (str('subject') && str('subject') !== primaryTitle) {
    subtitleParts.push(`درس: ${str('subject')}`);
  }
  if (str('gradeLabel')) {
    subtitleParts.push(str('gradeLabel'));
  }
  if (str('jalaliDate') || str('dueDateJalali') || str('dateJalali') || str('publishedAtJalali')) {
    subtitleParts.push(
      toPersianDigits(
        str('jalaliDate') || str('dueDateJalali') || str('dateJalali') || str('publishedAtJalali')
      )
    );
  }
  if (str('nationalId')) {
    subtitleParts.push(`کد ملی: ${toPersianDigits(str('nationalId'))}`);
  }

  return {
    titleFa: primaryTitle,
    subtitleFa: subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined,
  };
}

export function getCurrentTimeHm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ============================================================================
// 1. PANIC MODE / READ-ONLY FREEZE
// ============================================================================

export const DEFAULT_PANIC_MODE_STATE: PanicModeState = {
  enabled: false,
  scope: 'all_schools',
  lockedSchoolIds: [],
  reasonFa: '',
  activatedByUserId: '',
  activatedByName: '',
  activatedAtJalali: '',
  activatedAtIso: '',
};

export function isSchoolUnderPanicLock(
  panicState: PanicModeState | null | undefined,
  schoolId: string | undefined
): boolean {
  if (!panicState || !panicState.enabled) return false;
  if (panicState.scope === 'all_schools') return true;
  if (!schoolId || schoolId === '__global__') {
    return panicState.lockedSchoolIds.length > 0;
  }
  return panicState.lockedSchoolIds.includes(schoolId);
}

// ============================================================================
// 2. ANTI-WIPE CIRCUIT BREAKER (> 5 destructive ops in < 60 seconds)
// ============================================================================

export interface CircuitBreakerEvaluation {
  allowed: boolean;
  recentCount: number;
  maxAllowed: number;
  windowMs: number;
  remainingMs: number;
}

export class DestructiveActionCircuitBreaker {
  private readonly timestampsByUser = new Map<string, number[]>();
  public readonly maxAllowed: number;
  public readonly windowMs: number;

  constructor(maxAllowed = 5, windowMs = 60_000) {
    this.maxAllowed = maxAllowed;
    this.windowMs = windowMs;
  }

  private prune(userId: string, nowMs: number): number[] {
    const existing = this.timestampsByUser.get(userId) ?? [];
    const cutoff = nowMs - this.windowMs;
    const active = existing.filter((ts) => ts > cutoff);
    this.timestampsByUser.set(userId, active);
    return active;
  }

  public getRecentCount(userId: string, nowMs = Date.now()): number {
    return this.prune(userId, nowMs).length;
  }

  /**
   * Records a destructive attempt and evaluates whether the user exceeded
   * the threshold (> maxAllowed within windowMs).
   */
  public recordAndEvaluate(userId: string, nowMs = Date.now()): CircuitBreakerEvaluation {
    const active = this.prune(userId, nowMs);
    active.push(nowMs);
    this.timestampsByUser.set(userId, active);

    const recentCount = active.length;
    if (recentCount > this.maxAllowed) {
      const oldest = active[0] ?? nowMs;
      const remainingMs = Math.max(1000, this.windowMs - (nowMs - oldest));
      return {
        allowed: false,
        recentCount,
        maxAllowed: this.maxAllowed,
        windowMs: this.windowMs,
        remainingMs,
      };
    }

    return {
      allowed: true,
      recentCount,
      maxAllowed: this.maxAllowed,
      windowMs: this.windowMs,
      remainingMs: 0,
    };
  }

  public resetUser(userId: string): void {
    this.timestampsByUser.delete(userId);
  }

  public resetAll(): void {
    this.timestampsByUser.clear();
  }
}

export const sharedAntiWipeBreaker = new DestructiveActionCircuitBreaker(5, 60_000);

// ============================================================================
// 3. TAMPER-EVIDENT SHA-256 AUDIT LOG CHAIN
// ============================================================================

export const AUDIT_CHAIN_GENESIS = 'GENESIS';

export function canonicalizeAuditEntryForHash(
  entry: SecurityAuditLogEntry,
  prevHash: string
): string {
  return [
    entry.id,
    entry.complexId ?? '',
    entry.schoolId ?? '',
    entry.academicYearId ?? '',
    entry.eventType,
    entry.actorUserId ?? '',
    entry.actorUsername ?? '',
    entry.actorName ?? '',
    entry.actorRole ?? '',
    entry.targetLabel ?? '',
    entry.summaryFa ?? '',
    entry.detailsFa ?? '',
    entry.timestampJalali ?? '',
    entry.timeHm ?? '',
    entry.createdAtIso ?? '',
    prevHash,
  ].join('|');
}

export function computeAuditEntryHashSync(
  entry: SecurityAuditLogEntry,
  prevHash: string
): string {
  return sha256HexSync(canonicalizeAuditEntryForHash(entry, prevHash));
}

export async function computeAuditEntryHash(
  entry: SecurityAuditLogEntry,
  prevHash: string
): Promise<string> {
  return sha256Hex(canonicalizeAuditEntryForHash(entry, prevHash));
}

/**
 * Seals a new security audit entry with prevHash & SHA-256 entryHash.
 * Expects existingLogs in newest-first order (as stored in repository cache).
 */
export function sealAuditEntrySync(
  entry: SecurityAuditLogEntry,
  existingNewestFirstLogs: SecurityAuditLogEntry[]
): SecurityAuditLogEntry {
  const latestChained = existingNewestFirstLogs.find(
    (item) => typeof item.entryHash === 'string' && item.entryHash.length === 64
  );
  const prevHash = latestChained?.entryHash ?? AUDIT_CHAIN_GENESIS;
  const entryHash = computeAuditEntryHashSync(entry, prevHash);
  return {
    ...entry,
    prevHash,
    entryHash,
  };
}

/**
 * Verifies the entire SHA-256 audit log chain asynchronously using native crypto.subtle.
 * Expects logs in newest-first order (reverses internally to walk chronologically).
 */
export async function verifyAuditLogChain(
  newestFirstLogs: SecurityAuditLogEntry[]
): Promise<AuditChainVerificationResult> {
  const chronological = [...newestFirstLogs].reverse();
  const corruptedEntries: AuditChainVerificationResult['corruptedEntries'] = [];
  let expectedPrevHash = AUDIT_CHAIN_GENESIS;
  let verifiedEntries = 0;
  let legacyUnchainedCount = 0;
  let headHash: string | null = null;
  let seenFirstChained = false;

  for (let idx = 0; idx < chronological.length; idx++) {
    const entry = chronological[idx];
    if (!entry.entryHash || !entry.prevHash) {
      if (seenFirstChained) {
        corruptedEntries.push({
          index: idx,
          id: entry.id,
          timestampJalali: entry.timestampJalali,
          reasonFa: 'امضای زنجیره‌ای این ردیف پس از شروع زنجیره امن حذف شده است.',
        });
      } else {
        legacyUnchainedCount += 1;
      }
      continue;
    }

    seenFirstChained = true;

    if (entry.prevHash !== expectedPrevHash) {
      corruptedEntries.push({
        index: idx,
        id: entry.id,
        timestampJalali: entry.timestampJalali,
        reasonFa:
          expectedPrevHash === AUDIT_CHAIN_GENESIS
            ? 'پیوند ابتدای زنجیره (GENESIS) نامعتبر است؛ احتمال حذف ردیف‌های اولیه وجود دارد.'
            : 'گسست در زنجیره هش؛ احتمال حذف یا جابه‌جایی ردیف قبلی وجود دارد.',
      });
    }

    const recomputed = await computeAuditEntryHash(entry, entry.prevHash);
    if (recomputed !== entry.entryHash) {
      corruptedEntries.push({
        index: idx,
        id: entry.id,
        timestampJalali: entry.timestampJalali,
        reasonFa: 'مغایرت امضای SHA-256؛ محتوای این گزارش پس از ثبت تغییر داده شده است.',
      });
    } else if (entry.prevHash === expectedPrevHash) {
      verifiedEntries += 1;
    }

    expectedPrevHash = entry.entryHash;
    headHash = entry.entryHash;
  }

  return {
    valid: corruptedEntries.length === 0,
    totalEntries: chronological.length,
    verifiedEntries,
    legacyUnchainedCount,
    corruptedEntries,
    headHash,
    checkedAtJalali: getTodayJalali(),
    checkedAtIso: new Date().toISOString(),
  };
}

// ============================================================================
// 4. REFERENTIAL INTEGRITY CHECKER
// ============================================================================

export function runReferentialIntegrityCheck(
  dataset: SeedDataset,
  targetSchoolId?: string
): ReferentialIntegrityReport {
  const scopeSchoolId =
    targetSchoolId && targetSchoolId !== 'all' ? targetSchoolId : undefined;
  const inScope = (schoolId: string | undefined): boolean =>
    !scopeSchoolId || schoolId === scopeSchoolId;

  const activeSchools = (dataset.schools ?? []).filter((s) => !isRecordSoftDeleted(s));
  const activeClasses = (dataset.classes ?? []).filter((c) => !isRecordSoftDeleted(c));
  const activeStudents = (dataset.students ?? []).filter((s) => !isRecordSoftDeleted(s));
  const activeTeachers = (dataset.teachers ?? []).filter((t) => !isRecordSoftDeleted(t));
  const activeHomework = (dataset.homework_assignments ?? []).filter((h) => !isRecordSoftDeleted(h));
  const activeMockExams = (dataset.mock_exams ?? []).filter((m) => !isRecordSoftDeleted(m));

  const schoolIds = new Set(activeSchools.map((s) => s.id));
  const classIds = new Set(activeClasses.map((c) => c.id));
  const studentIds = new Set(activeStudents.map((s) => s.id));
  const teacherIds = new Set(activeTeachers.map((t) => t.id));
  const homeworkIds = new Set(activeHomework.map((h) => h.id));
  const mockExamIds = new Set(activeMockExams.map((m) => m.id));

  const issues: ReferentialIntegrityIssue[] = [];
  const collectionIssueCounts = new Map<CollectionName, number>();
  const collectionTotalCounts = new Map<CollectionName, number>();

  const recordIssue = (
    collection: CollectionName,
    recordId: string,
    schoolId: string,
    severity: 'critical' | 'warning',
    reasonFa: string
  ) => {
    issues.push({
      id: `${collection}:${recordId}:${issues.length}`,
      collection,
      collectionLabelFa: getCollectionLabelFa(collection),
      recordId,
      schoolId,
      severity,
      reasonFa,
    });
    collectionIssueCounts.set(collection, (collectionIssueCounts.get(collection) ?? 0) + 1);
  };

  const track = (collection: CollectionName, total: number) => {
    collectionTotalCounts.set(collection, total);
  };

  // 1. Classes -> valid schoolId
  const scopedClasses = activeClasses.filter((c) => inScope(c.schoolId));
  track('classes', scopedClasses.length);
  for (const cls of scopedClasses) {
    if (!schoolIds.has(cls.schoolId)) {
      recordIssue(
        'classes',
        cls.id,
        cls.schoolId,
        'critical',
        `کلاس «${cls.name}» به مدرسه نامعتبر (${cls.schoolId}) متصل است.`
      );
    }
  }

  // 2. Students -> valid schoolId & classId
  const scopedStudents = activeStudents.filter((st) => inScope(st.schoolId));
  track('students', scopedStudents.length);
  for (const st of scopedStudents) {
    if (!schoolIds.has(st.schoolId)) {
      recordIssue(
        'students',
        st.id,
        st.schoolId,
        'critical',
        `دانش‌آموز «${st.fullName}» به مدرسه نامعتبر متصل است.`
      );
    }
    if (!classIds.has(st.classId)) {
      recordIssue(
        'students',
        st.id,
        st.schoolId,
        'critical',
        `دانش‌آموز «${st.fullName}» به کلاس حذف‌شده یا نامعتبر (${st.classId}) متصل است.`
      );
    }
  }

  // 3. Teachers -> valid schoolId
  const scopedTeachers = activeTeachers.filter((t) => inScope(t.schoolId));
  track('teachers', scopedTeachers.length);
  for (const t of scopedTeachers) {
    if (!schoolIds.has(t.schoolId)) {
      recordIssue(
        'teachers',
        t.id,
        t.schoolId,
        'critical',
        `معلم «${t.fullName}» به مدرسه نامعتبر متصل است.`
      );
    }
  }

  // 4. Schedules -> schoolId, classId, teacherId
  const activeSchedules = (dataset.schedules ?? []).filter(
    (s) => !isRecordSoftDeleted(s) && inScope(s.schoolId)
  );
  track('schedules', activeSchedules.length);
  for (const slot of activeSchedules) {
    if (!schoolIds.has(slot.schoolId)) {
      recordIssue('schedules', slot.id, slot.schoolId, 'critical', 'برنامه هفتگی به مدرسه نامعتبر متصل است.');
    }
    if (!classIds.has(slot.classId)) {
      recordIssue(
        'schedules',
        slot.id,
        slot.schoolId,
        'critical',
        `زنگ درس «${slot.subjectName}» به کلاس نامعتبر (${slot.classId}) اشاره دارد.`
      );
    }
    if (slot.teacherId && !teacherIds.has(slot.teacherId)) {
      recordIssue(
        'schedules',
        slot.id,
        slot.schoolId,
        'warning',
        `زنگ درس «${slot.subjectName}» به معلم یافت‌نشده (${slot.teacherId}) اشاره دارد.`
      );
    }
  }

  // 5. Student Attendance -> schoolId, studentId, classId
  const activeAttendance = (dataset.student_attendance ?? []).filter(
    (a) => !isRecordSoftDeleted(a) && inScope(a.schoolId)
  );
  track('student_attendance', activeAttendance.length);
  for (const att of activeAttendance) {
    if (!schoolIds.has(att.schoolId)) {
      recordIssue('student_attendance', att.id, att.schoolId, 'critical', 'رکورد حضور و غیاب به مدرسه نامعتبر اشاره دارد.');
    }
    if (!studentIds.has(att.studentId)) {
      recordIssue(
        'student_attendance',
        att.id,
        att.schoolId,
        'critical',
        `رکورد حضور و غیاب (${toPersianDigits(att.jalaliDate)}) به دانش‌آموز ناموجود (${att.studentId}) متصل است.`
      );
    }
    if (!classIds.has(att.classId)) {
      recordIssue(
        'student_attendance',
        att.id,
        att.schoolId,
        'warning',
        `رکورد حضور و غیاب (${toPersianDigits(att.jalaliDate)}) به کلاس ناموجود (${att.classId}) متصل است.`
      );
    }
  }

  // 6. Gradebook Entries -> schoolId, studentId, classId
  const activeGrades = (dataset.gradebook_entries ?? []).filter(
    (g) => !isRecordSoftDeleted(g) && inScope(g.schoolId)
  );
  track('gradebook_entries', activeGrades.length);
  for (const gr of activeGrades) {
    if (!schoolIds.has(gr.schoolId)) {
      recordIssue('gradebook_entries', gr.id, gr.schoolId, 'critical', 'نمره ثبت‌شده به مدرسه نامعتبر اشاره دارد.');
    }
    if (!studentIds.has(gr.studentId)) {
      recordIssue(
        'gradebook_entries',
        gr.id,
        gr.schoolId,
        'critical',
        `نمره درس «${gr.subject}» به دانش‌آموز ناموجود (${gr.studentId}) متصل است.`
      );
    }
    if (!classIds.has(gr.classId)) {
      recordIssue(
        'gradebook_entries',
        gr.id,
        gr.schoolId,
        'warning',
        `نمره درس «${gr.subject}» به کلاس ناموجود (${gr.classId}) متصل است.`
      );
    }
  }

  // 7. Homework Assignments & Submissions
  const scopedHomework = activeHomework.filter((h) => inScope(h.schoolId));
  track('homework_assignments', scopedHomework.length);
  for (const hw of scopedHomework) {
    if (!schoolIds.has(hw.schoolId) || !classIds.has(hw.classId)) {
      recordIssue(
        'homework_assignments',
        hw.id,
        hw.schoolId,
        'critical',
        `تکلیف «${hw.title}» به مدرسه یا کلاس ناموجود اشاره دارد.`
      );
    }
  }

  const activeSubmissions = (dataset.homework_submissions ?? []).filter(
    (s) => !isRecordSoftDeleted(s) && inScope(s.schoolId)
  );
  track('homework_submissions', activeSubmissions.length);
  for (const sub of activeSubmissions) {
    if (!homeworkIds.has(sub.assignmentId)) {
      recordIssue(
        'homework_submissions',
        sub.id,
        sub.schoolId,
        'critical',
        `پاسخ تکلیف به تکلیف ناموجود (${sub.assignmentId}) متصل است.`
      );
    }
    if (!studentIds.has(sub.studentId)) {
      recordIssue(
        'homework_submissions',
        sub.id,
        sub.schoolId,
        'critical',
        `پاسخ تکلیف به دانش‌آموز ناموجود (${sub.studentId}) متصل است.`
      );
    }
  }

  // 8. SIDA Analytics Grades -> schoolId, studentId, classId
  const activeSidaGrades = (dataset.sida_analytics_grades ?? []).filter(
    (g) => !isRecordSoftDeleted(g) && inScope(g.schoolId)
  );
  track('sida_analytics_grades', activeSidaGrades.length);
  for (const sg of activeSidaGrades) {
    if (!schoolIds.has(sg.schoolId)) {
      recordIssue('sida_analytics_grades', sg.id, sg.schoolId, 'critical', 'رکورد تحلیل سیدا به مدرسه ناموجود متصل است.');
    }
    if (!studentIds.has(sg.studentId)) {
      recordIssue(
        'sida_analytics_grades',
        sg.id,
        sg.schoolId,
        'warning',
        `رکورد تحلیل سیدا درس «${sg.subject}» به دانش‌آموز ناموجود (${sg.studentId}) متصل است.`
      );
    }
  }

  // 9. Mock Exam Attempts -> examId, studentId
  const activeAttempts = (dataset.mock_exam_attempts ?? []).filter(
    (a) => !isRecordSoftDeleted(a) && inScope(a.schoolId)
  );
  track('mock_exam_attempts', activeAttempts.length);
  for (const att of activeAttempts) {
    if (!mockExamIds.has(att.examId)) {
      recordIssue(
        'mock_exam_attempts',
        att.id,
        att.schoolId,
        'critical',
        `کارنامه آزمون آزمایشی به آزمون ناموجود (${att.examId}) متصل است.`
      );
    }
    if (!studentIds.has(att.studentId)) {
      recordIssue(
        'mock_exam_attempts',
        att.id,
        att.schoolId,
        'warning',
        `کارنامه آزمون آزمایشی به دانش‌آموز ناموجود (${att.studentId}) متصل است.`
      );
    }
  }

  // 10. Parent-Staff Messages -> schoolId
  const activeMessages = (dataset.parent_staff_messages ?? []).filter(
    (m) => !isRecordSoftDeleted(m) && inScope(m.schoolId)
  );
  track('parent_staff_messages', activeMessages.length);
  for (const msg of activeMessages) {
    if (!schoolIds.has(msg.schoolId)) {
      recordIssue(
        'parent_staff_messages',
        msg.id,
        msg.schoolId,
        'warning',
        'پیام ارتباطی به مدرسه ناموجود متصل است.'
      );
    }
  }

  const orphanCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const totalRecordsChecked = Array.from(collectionTotalCounts.values()).reduce((sum, n) => sum + n, 0);

  const collectionStats = Array.from(collectionTotalCounts.entries()).map(([collection, total]) => ({
    collection,
    labelFa: getCollectionLabelFa(collection),
    total,
    issues: collectionIssueCounts.get(collection) ?? 0,
  }));

  const status: ReferentialIntegrityReport['status'] =
    orphanCount > 0 ? 'red' : warningCount > 0 ? 'amber' : 'green';

  return {
    status,
    checkedAtJalali: getTodayJalali(),
    checkedAtIso: new Date().toISOString(),
    totalRecordsChecked,
    orphanCount,
    warningCount,
    collectionStats,
    issues,
  };
}

// ============================================================================
// 5. SEALED PHASE-10 MIGRATION BUNDLE & GRANULAR DRY-RUN RESTORE
// ============================================================================

function computeBundleSignatureInput(
  bundleWithoutSig: Omit<SealedMigrationBundle, 'sha256Signature'>
): string {
  return JSON.stringify({
    bundleFormat: bundleWithoutSig.bundleFormat,
    schemaVersion: bundleWithoutSig.schemaVersion,
    scope: bundleWithoutSig.scope,
    schoolId: bundleWithoutSig.schoolId ?? null,
    academicYearId: bundleWithoutSig.academicYearId ?? null,
    exportedAtIso: bundleWithoutSig.exportedAtIso,
    totalRecords: bundleWithoutSig.totalRecords,
    recordCounts: bundleWithoutSig.recordCounts,
    data: bundleWithoutSig.data,
  });
}

function recordMatchesAcademicYear(record: Record<string, unknown>, academicYearId: string): boolean {
  if (typeof record.academicYearId === 'string' && record.academicYearId === academicYearId) {
    return true;
  }
  if (typeof record.code === 'string' && record.code === academicYearId) {
    return true;
  }
  if (typeof record.targetYearCode === 'string' && record.targetYearCode === academicYearId) {
    return true;
  }
  // Extract first 4-digit Jalali year from academicYearId (e.g. '1404-1405' -> '1404', '1405')
  const years = academicYearId.match(/\d{4}/g) ?? [];
  if (years.length > 0) {
    const dateCandidates = [
      record.jalaliDate,
      record.dueDateJalali,
      record.dateJalali,
      record.examDateJalali,
      record.publishedAtJalali,
      record.createdAtJalali,
      record.timestampJalali,
    ];
    for (const d of dateCandidates) {
      if (typeof d === 'string' && years.some((yr) => d.startsWith(yr))) {
        return true;
      }
    }
  }
  return false;
}

export async function createSealedMigrationBundle(params: {
  dataset: SeedDataset;
  scope: MigrationBundleScope;
  schoolId?: string;
  schoolName?: string;
  academicYearId?: string;
  exportedByName: string;
  schemaVersion: number;
}): Promise<SealedMigrationBundle> {
  const { dataset, scope, schoolId, schoolName, academicYearId, exportedByName, schemaVersion } =
    params;

  const data: Partial<Record<CollectionName, unknown[]>> = {};
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;

  const keys = Object.keys(dataset) as CollectionName[];
  for (const col of keys) {
    const rawList = (dataset[col] as unknown[]) ?? [];
    let filtered: unknown[] = rawList;

    if (scope === 'single_school' && schoolId) {
      if (col === 'schools') {
        filtered = rawList.filter((item) => (item as { id?: string }).id === schoolId);
      } else {
        filtered = rawList.filter((item) => (item as { schoolId?: string }).schoolId === schoolId);
      }
    } else if (scope === 'academic_year' && academicYearId) {
      filtered = rawList.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const rec = item as Record<string, unknown>;
        if (schoolId && col !== 'schools' && rec.schoolId && rec.schoolId !== schoolId && rec.schoolId !== '__global__') {
          return false;
        }
        return recordMatchesAcademicYear(rec, academicYearId);
      });
    }

    data[col] = structuredClone(filtered);
    recordCounts[col] = filtered.length;
    totalRecords += filtered.length;
  }

  const unsignedBundle: Omit<SealedMigrationBundle, 'sha256Signature'> = {
    bundleFormat: 'golestan_phase10_migration_bundle',
    schemaVersion,
    scope,
    schoolId: scope === 'single_school' || schoolId ? schoolId : undefined,
    schoolName: schoolName ?? undefined,
    academicYearId: scope === 'academic_year' ? academicYearId : undefined,
    exportedAtJalali: getTodayJalali(),
    exportedAtIso: new Date().toISOString(),
    exportedByName,
    totalRecords,
    recordCounts,
    data,
  };

  const sha256Signature = await sha256Hex(computeBundleSignatureInput(unsignedBundle));
  return {
    ...unsignedBundle,
    sha256Signature,
  };
}

export async function verifyAndPreviewMigrationBundle(
  rawJson: string
): Promise<MigrationBundleVerificationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      tampered: false,
      errorFa: 'ساختار فایل JSON معتبر نیست و قابل خواندن نمی‌باشد.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      tampered: false,
      errorFa: 'فایل انتخاب‌شده فاقد ساختار بسته پشتیبان معتبر است.',
    };
  }

  const candidate = parsed as Partial<SealedMigrationBundle>;
  if (candidate.bundleFormat !== 'golestan_phase10_migration_bundle') {
    return {
      valid: false,
      tampered: false,
      errorFa: 'این فایل از نوع «بسته مهاجرت امضاشده فاز ۱۰» سامانه گلستان راه روشن نیست.',
    };
  }

  if (
    typeof candidate.sha256Signature !== 'string' ||
    candidate.sha256Signature.length !== 64 ||
    !candidate.data ||
    typeof candidate.data !== 'object' ||
    typeof candidate.schemaVersion !== 'number'
  ) {
    return {
      valid: false,
      tampered: true,
      errorFa: 'امضای دیجیتال SHA-256 یا متادیتای حیاتی بسته پشتیبان ناقص یا مخدوش است.',
    };
  }

  const bundle = candidate as SealedMigrationBundle;
  const { sha256Signature, ...unsigned } = bundle;
  const recomputed = await sha256Hex(computeBundleSignatureInput(unsigned));
  if (recomputed !== sha256Signature) {
    return {
      valid: false,
      tampered: true,
      errorFa:
        'هشدار امنیتی: امضای دیجیتال SHA-256 این فایل با محتوای آن مطابقت ندارد. فایل دستکاری یا خراب شده است و بازگردانی مسدود شد.',
    };
  }

  const nonEmptyCollections = (Object.entries(bundle.data) as Array<[CollectionName, unknown[]]>)
    .filter(([, arr]) => Array.isArray(arr) && arr.length > 0)
    .map(([collection, arr]) => ({
      collection,
      labelFa: getCollectionLabelFa(collection),
      count: arr.length,
    }))
    .sort((a, b) => b.count - a.count);

  const scopeLabelFa =
    bundle.scope === 'complex_wide'
      ? 'کل مجتمع آموزشی (هر ۳ مدرسه)'
      : bundle.scope === 'single_school'
      ? 'تک‌مدرسه ایزوله'
      : 'سال تحصیلی مشخص';

  const targetLabelFa =
    bundle.scope === 'complex_wide'
      ? 'تمامی مدارس و تنظیمات مجتمع'
      : bundle.scope === 'single_school'
      ? bundle.schoolName || bundle.schoolId || 'مدرسه انتخاب‌شده'
      : `سال تحصیلی ${toPersianDigits(bundle.academicYearId ?? '')}`;

  return {
    valid: true,
    tampered: false,
    bundle,
    previewSummary: {
      scopeLabelFa,
      targetLabelFa,
      totalRecords: bundle.totalRecords,
      nonEmptyCollections,
    },
  };
}

/**
 * Applies a verified SealedMigrationBundle granularly to a clone of currentDataset:
 * - 'complex_wide': replaces collections included in bundle.
 * - 'single_school': replaces ONLY target school's records, leaving other schools 100% untouched.
 * - 'academic_year': replaces ONLY records belonging to bundle.academicYearId, preserving all other years/schools.
 */
export function applyGranularBundleToDataset(
  currentDataset: SeedDataset,
  bundle: SealedMigrationBundle
): SeedDataset {
  const next = structuredClone(currentDataset);
  const bundleCollections = Object.keys(bundle.data) as CollectionName[];

  for (const col of bundleCollections) {
    const incomingRaw = bundle.data[col];
    if (!Array.isArray(incomingRaw)) continue;
    const incoming = structuredClone(incomingRaw);
    const existing = ((next[col] as unknown[]) ?? []) as Array<Record<string, unknown>>;

    if (bundle.scope === 'complex_wide') {
      (next[col] as unknown[]) = incoming;
    } else if (bundle.scope === 'single_school' && bundle.schoolId) {
      const targetSchoolId = bundle.schoolId;
      if (col === 'schools') {
        const preserved = existing.filter((s) => s.id !== targetSchoolId);
        (next[col] as unknown[]) = [...preserved, ...incoming];
      } else {
        // Preserve ALL records of other schools and global config untouched
        const preserved = existing.filter((item) => item.schoolId !== targetSchoolId);
        (next[col] as unknown[]) = [...preserved, ...incoming];
      }
    } else if (bundle.scope === 'academic_year' && bundle.academicYearId) {
      const targetYearId = bundle.academicYearId;
      const targetSchoolId = bundle.schoolId;
      const preserved = existing.filter((item) => {
        if (targetSchoolId && item.schoolId && item.schoolId !== targetSchoolId) {
          return true;
        }
        return !recordMatchesAcademicYear(item, targetYearId);
      });
      // Deduplicate by id just in case
      const incomingIds = new Set(
        incoming
          .map((item) => (item && typeof item === 'object' ? (item as { id?: string }).id : undefined))
          .filter(Boolean)
      );
      const dedupedPreserved = preserved.filter((item) => !incomingIds.has(item.id as string));
      (next[col] as unknown[]) = [...dedupedPreserved, ...incoming];
    }
  }

  return next;
}

export async function buildDailyRollingSnapshot(params: {
  dataset: SeedDataset;
  trigger: DailyRollingSnapshot['trigger'];
  labelFa: string;
  schemaVersion: number;
}): Promise<DailyRollingSnapshot> {
  const payloadJson = JSON.stringify(params.dataset);
  const sha256Signature = await sha256Hex(payloadJson);
  const totalRecords = Object.values(params.dataset).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );
  const now = new Date();
  return {
    id: `roll-snap-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    jalaliDate: getTodayJalali(),
    createdAtIso: now.toISOString(),
    createdAtTimeHm: getCurrentTimeHm(),
    trigger: params.trigger,
    labelFa: params.labelFa,
    schemaVersion: params.schemaVersion,
    totalRecords,
    sha256Signature,
    payloadJson,
  };
}
