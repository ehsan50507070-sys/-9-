// End-to-End RBAC Policy Guard enforced inside BOTH UI and Repository/Mutation Handlers (Phase 3.5 Strict 6-Role Split)
import type {
  AppointmentSlot,
  AuthSession,
  BackupPayload,
  ChatOutboxItem,
  ClassChatMessage,
  ClassChatRoomConfig,
  CollectionName,
  DailyLogEntry,
  ElectronicForm,
  ElectronicFormResponse,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
  FlippedVideoTelemetry,
  GradeAppeal,
  GradebookEntry,
  GradebookWeightConfig,
  HomeworkAssignment,
  HomeworkSubmission,
  LessonPlanRecord,
  MockExam,
  MockExamAttempt,
  NotificationTemplate,
  OnlineClassAttendanceRecord,
  OnlineClassSession,
  OnlineExam,
  OnlineExamSubmission,
  AnonymousSurvey,
  FinanceExpenseRecord,
  FinanceFeePlan,
  FinancePaymentRecord,
  FinanceStudentLedger,
  PanicModeState,
  ParentStaffMessage,
  RemedialPlanRecord,
  SchoolBrandingConfig,
  SidaGradeAuditLog,
  SidaSpeedEntryRecord,
  StaffElectronicProfile,
  Student360Signal,
  StudentAttendanceRecord,
  StudentElectronicProfile,
  StudentReward,
  SurveyAnonymousResponse,
  SurveyParticipationReceipt,
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevProgress,
  TeacherDevSchoolSettings,
  UserAppearancePreference,
  DisciplineRecord,
  DisciplinePledge,
  StudentExitPass,
  StaffLeaveRequest,
  CounselingSession,
  VirtualClassSession,
  VirtualClassAttendance,
} from '../../types/domain';
import { isSchoolUnderPanicLock } from '../security/DataIntegrityGuard';
import { ROLE_DEFINITIONS } from './rbac';

export interface AuthGuardContext {
  session: AuthSession | null;
  teacherAssignedClassIds?: string[];
  panicModeState?: PanicModeState;
  onDestructiveAttempt?: (
    userId: string,
    collection: CollectionName,
    schoolId: string
  ) => AuthorizationDecision | null;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reasonFa?: string;
}

export type MutationAction = 'write' | 'delete';

export interface MutationTargetMeta {
  schoolId: string;
  classId?: string;
  record?: unknown;
}

/**
 * Verifies whether the authenticated session is allowed to mutate a specific collection & target school/class.
 * Strictly blocks cross-school writes for non-complex_admin users.
 * Zero-overlap split:
 * - `student`: interactive learning ONLY on own `linkedStudentId` (homework, flipped video, online classroom join, online exams). Blocked from `parent_staff_messages` and staff collections.
 * - `parent`: strictly read-only across all academic modules, interactive ONLY in `parent_staff_messages` for own `linkedStudentId`.
 */
export function authorizeMutation(
  auth: AuthGuardContext,
  collection: CollectionName,
  action: MutationAction,
  meta: MutationTargetMeta
): AuthorizationDecision {
  const { session, teacherAssignedClassIds = [] } = auth;
  if (!session) {
    return {
      allowed: false,
      reasonFa: 'نشست کاربری معتبر نیست. لطفاً ابتدا وارد سامانه شوید.',
    };
  }

  // Step 3-B: Panic Mode (Read-Only Freeze) blocks all non-exempt writes/deletes across locked schools
  if (
    collection !== 'security_audit_logs' &&
    collection !== 'notification_read_receipts' &&
    collection !== 'user_appearance_prefs' &&
    isSchoolUnderPanicLock(auth.panicModeState, meta.schoolId)
  ) {
    return {
      allowed: false,
      reasonFa:
        'سامانه در وضعیت اضطراری (قفل فقط‌خواندنی) قرار دارد؛ ثبت، ویرایش یا حذف اطلاعات تا رفع قفل توسط راهبر ارشد غیرفعال است.',
    };
  }

  // Step 3-B: Anti-Wipe Circuit Breaker (> 5 destructive ops in < 60s)
  if (action === 'delete' && auth.onDestructiveAttempt) {
    const breakerDecision = auth.onDestructiveAttempt(session.userId, collection, meta.schoolId);
    if (breakerDecision && !breakerDecision.allowed) {
      return breakerDecision;
    }
  }

  const roleDef = ROLE_DEFINITIONS[session.role];

  // 0. Super Admin has top-level governance authority across all complexes, schools, and collections
  if (session.role === 'super_admin') {
    return { allowed: true };
  }

  // 0A. Security audit logs are append-only (deletes strictly prohibited; writes allowed for audit trail)
  if (collection === 'security_audit_logs') {
    if (action === 'delete') {
      return {
        allowed: false,
        reasonFa: 'حذف لاگ‌های امنیتی و ورودها به هیچ عنوان مجاز نیست.',
      };
    }
    return { allowed: true };
  }

  // 0B. Phase 8A Governance collections are strictly exclusive to super_admin
  if (
    collection === 'educational_complexes' ||
    collection === 'managed_admin_accounts' ||
    collection === 'role_governance_configs' ||
    collection === 'global_system_configs' ||
    collection === 'super_admin_audit_logs'
  ) {
    return {
      allowed: false,
      reasonFa: 'تغییر تنظیمات کلان سامانه، مجموعه‌ها و سطوح دسترسی صرفاً در اختیار راهبر ارشد سامانه است.',
    };
  }

  // 1. Strict multi-school boundary enforcement for every non-complex_admin role
  if (!roleDef.canSwitchSchool && meta.schoolId !== session.schoolId) {
    return {
      allowed: false,
      reasonFa: 'تخلف ایزوله‌سازی مدرسه: شما فقط مجاز به تغییر داده‌های مدرسه خود هستید.',
    };
  }

  // 2A. Parent role: strictly read-only on academic grades/exams/homework/attendance;
  // interactive ONLY on: parent_staff_messages, own-child grade_appeals (submitted only), class_chat_messages (own class),
  // appointment_slots (booking/cancelling own slot), and electronic_form_responses (signing for own child).
  if (session.role === 'parent') {
    if (collection === 'parent_staff_messages' && action === 'write') {
      const msg = meta.record as ParentStaffMessage | undefined;
      if (!session.linkedStudentId || !msg || msg.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به گفت‌وگو در پرونده اختصاصی فرزند خود است.',
        };
      }
      if (msg.channelType !== 'teacher' && msg.channelType !== 'principal') {
        return {
          allowed: false,
          reasonFa: 'کانال پیام‌رسانی معتبر نیست.',
        };
      }
      // Parents may send their own message (senderRole === 'parent') OR mark staff replies as readByParent
      if (msg.senderRole === 'parent' && msg.senderUserId !== session.userId) {
        return {
          allowed: false,
          reasonFa: 'شناسه فرستنده پیام با حساب کاربری ولی همخوانی ندارد.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'grade_appeals' && action === 'write') {
      const appeal = meta.record as GradeAppeal | undefined;
      if (!session.linkedStudentId || !appeal || appeal.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به ثبت اعتراض نمره برای فرزند خود است.',
        };
      }
      if (
        appeal.status !== 'submitted' ||
        appeal.revisedScore !== undefined ||
        appeal.teacherResponse !== undefined ||
        appeal.principalNote !== undefined
      ) {
        return {
          allowed: false,
          reasonFa: 'تغییر وضعیت بررسی یا اصلاح نمره فقط بر عهده معلم و مدیر مدرسه است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'class_chat_messages' && action === 'write') {
      const msg = meta.record as ClassChatMessage | undefined;
      if (!msg) {
        return { allowed: false, reasonFa: 'اطلاعات پیام کلاسی نامعتبر است.' };
      }
      // Parents can post text messages (senderRole === 'parent') OR vote on an existing poll
      if (msg.kind === 'announcement' || msg.kind === 'question_bank') {
        return {
          allowed: false,
          reasonFa: 'ارسال اطلاعیه رسمی یا سوال بانک سوالات صرفاً توسط معلم و مدیریت مجاز است.',
        };
      }
      if (msg.kind === 'text' && (msg.senderRole !== 'parent' || msg.senderUserId !== session.userId)) {
        return {
          allowed: false,
          reasonFa: 'شناسه ارسال‌کننده پیام کلاسی با حساب کاربری ولی همخوانی ندارد.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'appointment_slots' && action === 'write') {
      const slot = meta.record as AppointmentSlot | undefined;
      if (!session.linkedStudentId || !slot) {
        return { allowed: false, reasonFa: 'اطلاعات نوبت جلسه معتبر نیست.' };
      }
      if (slot.status === 'completed' || slot.meetingOutcomeNotes !== undefined) {
        return {
          allowed: false,
          reasonFa: 'ثبت گزارش برگزاری یا یادداشت محرمانه جلسه صرفاً بر عهده معلم و مدیریت است.',
        };
      }
      if (
        slot.status === 'booked' &&
        (slot.bookedStudentId !== session.linkedStudentId ||
          slot.bookedByParentUserId !== session.userId)
      ) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به رزرو جلسه برای فرزند خود است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'electronic_form_responses' && action === 'write') {
      const resp = meta.record as ElectronicFormResponse | undefined;
      if (
        !session.linkedStudentId ||
        !resp ||
        resp.studentId !== session.linkedStudentId ||
        resp.parentUserId !== session.userId
      ) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به تکمیل و امضای رضایت‌نامه برای فرزند خود است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'user_appearance_prefs' && action === 'write') {
      const pref = meta.record as UserAppearancePreference | undefined;
      if (!pref || pref.userId !== session.userId) {
        return {
          allowed: false,
          reasonFa: 'هر کاربر فقط مجاز به تغییر تنظیمات ظاهری حساب شخصی خود است.',
        };
      }
      return { allowed: true };
    }

    // Phase 6: Parent can pay own child's tuition/trip via online simulator
    if (collection === 'finance_payments' && action === 'write') {
      const pay = meta.record as FinancePaymentRecord | undefined;
      if (
        !session.linkedStudentId ||
        !pay ||
        pay.studentId !== session.linkedStudentId ||
        pay.method !== 'online_sim'
      ) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به ثبت پرداخت آنلاین برای پرونده مالی فرزند خود است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'finance_student_ledgers' && action === 'write') {
      const ledger = meta.record as FinanceStudentLedger | undefined;
      if (!session.linkedStudentId || !ledger || ledger.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به تسویه اقساط پرونده مالی فرزند خود است.',
        };
      }
      return { allowed: true };
    }

    // Phase 6: Parent can participate in anonymous surveys (strictly own role)
    if (collection === 'survey_participation_receipts' && action === 'write') {
      const receipt = meta.record as SurveyParticipationReceipt | undefined;
      if (!receipt || !receipt.participantKey) {
        return { allowed: false, reasonFa: 'رسید مشارکت نظرسنجی نامعتبر است.' };
      }
      return { allowed: true };
    }

    if (collection === 'survey_anonymous_responses' && action === 'write') {
      const resp = meta.record as SurveyAnonymousResponse | undefined;
      if (!resp || resp.audienceRole !== 'parent') {
        return { allowed: false, reasonFa: 'پاسخ نظرسنجی باید در نقش اولیا ثبت شود.' };
      }
      return { allowed: true };
    }

    // Phase 9-C: Parent can digitally sign own child's disciplinary pledge, request exit pass, or request counseling
    if (collection === 'discipline_pledges' && action === 'write') {
      const pledge = meta.record as DisciplinePledge | undefined;
      if (!session.linkedStudentId || !pledge || pledge.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به تایید دیجیتال تعهدنامه انضباطی فرزند خود است.',
        };
      }
      if (pledge.status !== 'signed_digital') {
        return {
          allowed: false,
          reasonFa: 'ولی صرفاً مجاز به ثبت تایید و امضای دیجیتال تعهدنامه است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'student_exit_passes' && action === 'write') {
      const pass = meta.record as StudentExitPass | undefined;
      if (!session.linkedStudentId || !pass || pass.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به ثبت درخواست خروج زودهنگام برای فرزند خود است.',
        };
      }
      if (pass.status !== 'requested') {
        return {
          allowed: false,
          reasonFa: 'تایید خروج نهایی یا صدور مجوز نگهبانی صرفاً بر عهده مدیریت و معاونت مدرسه است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'counseling_sessions' && action === 'write') {
      const cs = meta.record as CounselingSession | undefined;
      if (!session.linkedStudentId || !cs || cs.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ولی فقط مجاز به ثبت درخواست نوبت مشاوره برای فرزند خود است.',
        };
      }
      if (cs.status !== 'requested' || cs.requestedByRole !== 'parent') {
        return {
          allowed: false,
          reasonFa: 'تایید نهایی نوبت یا ثبت توصیه‌های مشاوره‌ای صرفاً بر عهده مشاور مدرسه است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'counseling_clinical_notes') {
      return {
        allowed: false,
        reasonFa: 'دسترسی به یادداشت‌های بالینی و محرمانه دفتر مشاوره برای اولیا مطلقاً ممنوع است.',
      };
    }

    if (collection === 'notification_read_receipts' && action === 'write') {
      return { allowed: true };
    }

    return {
      allowed: false,
      reasonFa: 'حساب اولیا در این بخش فقط‌خواندنی است و امکان ثبت یا ویرایش اطلاعات وجود ندارد.',
    };
  }

  // 2B. Student role: interactive ONLY on own learning modules (strictly locked to linkedStudentId), blocked from parent_staff_messages & staff collections
  if (session.role === 'student') {
    if (collection === 'parent_staff_messages') {
      return {
        allowed: false,
        reasonFa: 'دسترسی به گفت‌وگوی اختصاصی اولیا با معلم و مدیر برای حساب دانش‌آموز مجاز نیست.',
      };
    }

    if (collection === 'homework_submissions' && action === 'write') {
      const sub = meta.record as HomeworkSubmission | undefined;
      if (!session.linkedStudentId || !sub || sub.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز فقط مجاز به ارسال تکلیف برای حساب خود است.',
        };
      }
      if (sub.status === 'reviewed' || sub.score !== undefined || sub.teacherFeedback !== undefined) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز مجاز به ثبت یا تغییر نمره و بازخورد معلم نیست.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'flipped_telemetry' && action === 'write') {
      const tel = meta.record as FlippedVideoTelemetry | undefined;
      if (!session.linkedStudentId || !tel || tel.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز فقط مجاز به ثبت گزارش تماشای ویدیو برای حساب خود است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'flipped_questions' && action === 'write') {
      const q = meta.record as FlippedTimestampQuestion | undefined;
      if (!session.linkedStudentId || !q || q.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز فقط مجاز به ثبت سوال از ویدیو برای خود است.',
        };
      }
      if (q.teacherReply !== undefined) {
        return {
          allowed: false,
          reasonFa: 'ثبت پاسخ معلم فقط توسط معلم یا مدیریت مدرسه مجاز است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'online_class_attendance' && action === 'write') {
      const att = meta.record as OnlineClassAttendanceRecord | undefined;
      if (!session.linkedStudentId || !att || att.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ورود به کلاس آنلاین و ثبت حضور فقط برای خود دانش‌آموز مجاز است.',
        };
      }
      if (att.status !== 'present' || !att.joinedViaLink) {
        return {
          allowed: false,
          reasonFa: 'تغییر دستی وضعیت حضور و غیاب کلاس آنلاین فقط توسط معلم مجاز است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'online_exam_submissions' && action === 'write') {
      const sub = meta.record as OnlineExamSubmission | undefined;
      if (!session.linkedStudentId || !sub || sub.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز فقط مجاز به ارسال پاسخ آزمون برای خود است.',
        };
      }
      const hasTeacherManualFields =
        sub.syncedToGradebook === true ||
        sub.gradingStatus === 'finalized' ||
        (typeof sub.manualGradedPoints === 'number' && sub.manualGradedPoints > 0) ||
        sub.teacherOverallFeedback !== undefined ||
        (Array.isArray(sub.answers) &&
          sub.answers.some((a) => a.manualScore !== undefined || a.teacherFeedback !== undefined));
      if (hasTeacherManualFields) {
        return {
          allowed: false,
          reasonFa: 'ثبت نمره تشریحی یا تایید نهایی آزمون فقط بر عهده معلم است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'student_360_signals' && action === 'write') {
      const sig = meta.record as Student360Signal | undefined;
      if (!session.linkedStudentId || !sig || sig.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ثبت خلاصه عملکرد ۳۶۰ درجه فقط برای خود دانش‌آموز مجاز است.',
        };
      }
      return { allowed: true };
    }

    // Narrow automatic formative Micro-Quiz sync into gradebook when student completes a Flipped Video Micro-Quiz
    if (collection === 'gradebook_entries' && action === 'write') {
      const entry = meta.record as GradebookEntry | undefined;
      if (
        session.linkedStudentId &&
        entry &&
        entry.studentId === session.linkedStudentId &&
        entry.recordedBy === 'student' &&
        typeof entry.microQuizScore === 'number' &&
        entry.privateTeacherNote === undefined &&
        entry.oralQuizScore === undefined &&
        entry.classActivityScore === undefined
      ) {
        return { allowed: true };
      }
    }

    if (collection === 'class_chat_messages' && action === 'write') {
      const msg = meta.record as ClassChatMessage | undefined;
      if (!msg) {
        return { allowed: false, reasonFa: 'اطلاعات پیام کلاسی نامعتبر است.' };
      }
      if (msg.kind === 'announcement' || msg.kind === 'question_bank') {
        return {
          allowed: false,
          reasonFa: 'ارسال اطلاعیه رسمی یا سوال بانک سوالات صرفاً توسط معلم و مدیریت مجاز است.',
        };
      }
      if (msg.kind === 'text' && (msg.senderRole !== 'student' || msg.senderUserId !== session.userId)) {
        return {
          allowed: false,
          reasonFa: 'شناسه ارسال‌کننده پیام کلاسی با حساب دانش‌آموز همخوانی ندارد.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'user_appearance_prefs' && action === 'write') {
      const pref = meta.record as UserAppearancePreference | undefined;
      if (!pref || pref.userId !== session.userId) {
        return {
          allowed: false,
          reasonFa: 'هر کاربر فقط مجاز به تغییر تنظیمات ظاهری حساب شخصی خود است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'notification_read_receipts' && action === 'write') {
      return { allowed: true };
    }

    // Phase 6: Student can participate in anonymous surveys targeting students
    if (collection === 'survey_participation_receipts' && action === 'write') {
      const receipt = meta.record as SurveyParticipationReceipt | undefined;
      if (!receipt || !receipt.participantKey) {
        return { allowed: false, reasonFa: 'رسید مشارکت نظرسنجی نامعتبر است.' };
      }
      return { allowed: true };
    }

    if (collection === 'survey_anonymous_responses' && action === 'write') {
      const resp = meta.record as SurveyAnonymousResponse | undefined;
      if (!resp || resp.audienceRole !== 'student') {
        return { allowed: false, reasonFa: 'پاسخ نظرسنجی باید در نقش دانش‌آموز ثبت شود.' };
      }
      return { allowed: true };
    }

    // Phase 9A: Student can take & submit own online Mock/Konkur exam attempt strictly for linkedStudentId
    if (collection === 'mock_exam_attempts' && action === 'write') {
      const attempt = meta.record as MockExamAttempt | undefined;
      if (!session.linkedStudentId || !attempt || attempt.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز فقط مجاز به ثبت پاسخنامه آزمون آزمایشی برای حساب شخصی خود است.',
        };
      }
      if (attempt.entryMethod !== 'online') {
        return {
          allowed: false,
          reasonFa: 'ثبت پاسخبرگ حضوری صرفاً توسط کادر مدرسه و معلمان مجاز است.',
        };
      }
      return { allowed: true };
    }

    // Phase 9-C: Student can request own counseling appointment & log own virtual class join attendance
    if (collection === 'counseling_sessions' && action === 'write') {
      const cs = meta.record as CounselingSession | undefined;
      if (!session.linkedStudentId || !cs || cs.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'دانش‌آموز فقط مجاز به درخواست نوبت مشاوره برای خود است.',
        };
      }
      if (cs.status !== 'requested' || cs.requestedByRole !== 'student') {
        return {
          allowed: false,
          reasonFa: 'تعیین زمان قطعی یا ثبت یادداشت جلسه مشاوره صرفاً بر عهده مشاور مدرسه است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'virtual_class_attendance' && action === 'write') {
      const att = meta.record as VirtualClassAttendance | undefined;
      if (!session.linkedStudentId || !att || att.studentId !== session.linkedStudentId) {
        return {
          allowed: false,
          reasonFa: 'ثبت حضور هوشمند در کلاس مجازی فقط برای خود دانش‌آموز مجاز است.',
        };
      }
      return { allowed: true };
    }

    if (collection === 'counseling_clinical_notes') {
      return {
        allowed: false,
        reasonFa: 'دسترسی به لایه محرمانه یادداشت‌های بالینی مشاوره برای دانش‌آموز مطلقاً ممنوع است.',
      };
    }

    // Strictly block student from parent-only, financial, analytics & staff Phase 4-9C collections
    if (
      collection === 'appointment_slots' ||
      collection === 'electronic_forms' ||
      collection === 'electronic_form_responses' ||
      collection === 'notification_templates' ||
      collection === 'class_chat_rooms' ||
      collection === 'sida_grade_audit_logs' ||
      collection === 'sida_speed_entry_ticks' ||
      collection === 'school_branding_configs' ||
      collection === 'in_person_exam_halls' ||
      collection === 'in_person_exam_sessions' ||
      collection === 'exam_seating_charts' ||
      collection === 'student_profiles' ||
      collection === 'staff_profiles' ||
      collection === 'finance_fee_plans' ||
      collection === 'finance_student_ledgers' ||
      collection === 'finance_payments' ||
      collection === 'finance_expenses' ||
      collection === 'remedial_plans' ||
      collection === 'anonymous_surveys' ||
      collection === 'td_courses' ||
      collection === 'td_progress' ||
      collection === 'td_certificates' ||
      collection === 'td_school_settings' ||
      collection === 'academic_years' ||
      collection === 'mock_exams' ||
      collection === 'sida_appeal_windows' ||
      collection === 'sida_remedial_groups' ||
      collection === 'sida_class_balancing_drafts' ||
      collection === 'sida_analytics_grades' ||
      collection === 'discipline_records' ||
      collection === 'discipline_pledges' ||
      collection === 'student_exit_passes' ||
      collection === 'staff_leave_requests' ||
      collection === 'virtual_class_sessions'
    ) {
      return {
        allowed: false,
        reasonFa: 'این بخش صرفاً در اختیار اولیا یا کادر مدرسه است و برای حساب دانش‌آموز قابل دسترسی نیست.',
      };
    }

    return {
      allowed: false,
      reasonFa: 'حساب دانش‌آموز مجاز به تغییر اطلاعات در این بخش نیست.',
    };
  }

  const assertTeacherClassAccess = (targetClassId: string | undefined, contextFa: string): AuthorizationDecision => {
    if (session.role !== 'teacher') return { allowed: true };
    if (!targetClassId || !teacherAssignedClassIds.includes(targetClassId)) {
      return {
        allowed: false,
        reasonFa: `معلم فقط مجاز به ${contextFa} در کلاس‌های محول‌شده به خود است.`,
      };
    }
    return { allowed: true };
  };

  // 3. Collection-specific RBAC matrix (Staff roles: complex_admin, principal, deputy, teacher)
  switch (collection) {
    case 'student_attendance': {
      if (!roleDef.canEditStudentAttendance) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا ویرایش حضور و غیاب دانش‌آموزان را ندارید.',
        };
      }
      const rec = meta.record as StudentAttendanceRecord | undefined;
      return assertTeacherClassAccess(meta.classId ?? rec?.classId, 'ثبت حضور و غیاب');
    }

    case 'staff_attendance': {
      if (!roleDef.canEditStaffAttendance) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا ویرایش حضور و غیاب کادر و معلمان را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'substitutions': {
      if (!roleDef.canAssignSubstitution) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز تخصیص یا حذف معلم جایگزین را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'daily_logs': {
      if (!roleDef.canCreateDailyLog) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا حذف گزارش در دفتر روزانه را ندارید.',
        };
      }
      if (session.role === 'teacher') {
        if (action === 'delete') {
          return {
            allowed: false,
            reasonFa: 'معلم مجاز به حذف گزارش‌های دفتر روزانه نیست.',
          };
        }
        const entry = meta.record as DailyLogEntry | undefined;
        return assertTeacherClassAccess(meta.classId ?? entry?.classId, 'ثبت گزارش');
      }
      return { allowed: true };
    }

    case 'students': {
      if (!roleDef.canManageStudents) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت، ویرایش یا حذف دانش‌آموزان را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'classes': {
      if (!roleDef.canManageClasses) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ایجاد یا ویرایش کلاس‌های مدرسه را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'teachers': {
      if (!roleDef.canManageTeachers) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز مدیریت معلمان را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'schedules': {
      if (!roleDef.canEditTimetable && !roleDef.canManageTeachers) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ویرایش برنامه هفتگی مدرسه را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'school_plugin_states': {
      if (!roleDef.canManageAddons) {
        return {
          allowed: false,
          reasonFa: 'مدیریت بسته‌های الحاقی (فعال‌سازی یا غیرفعال‌سازی) صرفاً در اختیار راهبر ارشد سامانه است.',
        };
      }
      return { allowed: true };
    }

    case 'schools': {
      if (!roleDef.canEditSchoolSettings) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ویرایش تنظیمات مدرسه را ندارید.',
        };
      }
      return { allowed: true };
    }

    // --- Phase 2 Collections ---
    case 'curriculum_topics': {
      if (!roleDef.canManageCurriculum) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ویرایش بودجه‌بندی هفتگی را ندارید.',
        };
      }
      if (session.role === 'teacher' && action === 'delete') {
        return {
          allowed: false,
          reasonFa: 'حذف سرفصل‌های بودجه‌بندی صرفاً توسط مدیر یا معاون مدرسه مجاز است.',
        };
      }
      return { allowed: true };
    }

    case 'media_resources': {
      if (!roleDef.canManageMediaHub) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز افزودن یا حذف محتوای آموزشی را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'chat_outbox': {
      if (!roleDef.canManageMediaHub) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ارسال محتوا به چت کلاسی را ندارید.',
        };
      }
      const item = meta.record as ChatOutboxItem | undefined;
      return assertTeacherClassAccess(meta.classId ?? item?.classId, 'ارسال محتوا به چت کلاسی');
    }

    case 'gradebook_entries': {
      if (!roleDef.canManageGradebook) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا ویرایش نمرات و ارزشیابی دانش‌آموزان را ندارید.',
        };
      }
      const entry = meta.record as GradebookEntry | undefined;
      return assertTeacherClassAccess(meta.classId ?? entry?.classId, 'ثبت نمره و ارزشیابی');
    }

    case 'lesson_plans': {
      if (!roleDef.canManageGradebook) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت طرح درس و گزارش تدریس را ندارید.',
        };
      }
      const plan = meta.record as LessonPlanRecord | undefined;
      return assertTeacherClassAccess(meta.classId ?? plan?.classId, 'ثبت طرح درس');
    }

    case 'gradebook_weights': {
      if (!roleDef.canManageGradebook) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز تنظیم ضرایب نمره مستمر را ندارید.',
        };
      }
      const cfg = meta.record as GradebookWeightConfig | undefined;
      return assertTeacherClassAccess(meta.classId ?? cfg?.classId, 'تنظیم ضرایب نمره مستمر');
    }

    case 'grade_appeals': {
      if (!roleDef.canManageGradebook && !roleDef.canApproveGradeAppeals) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز رسیدگی به اعتراضات نمره را ندارید.',
        };
      }
      const appeal = meta.record as GradeAppeal | undefined;
      if (appeal?.status === 'principal_approved' && !roleDef.canApproveGradeAppeals) {
        return {
          allowed: false,
          reasonFa: 'تایید نهایی اعتراض نمره صرفاً بر عهده مدیر مدرسه یا مدیر کل است.',
        };
      }
      if (session.role === 'teacher') {
        return assertTeacherClassAccess(meta.classId ?? appeal?.classId, 'پاسخ‌دهی به اعتراض نمره');
      }
      return { allowed: true };
    }

    case 'homework_assignments': {
      if (!roleDef.canManageHomework) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ایجاد یا حذف تکلیف آنلاین را ندارید.',
        };
      }
      const hw = meta.record as HomeworkAssignment | undefined;
      return assertTeacherClassAccess(meta.classId ?? hw?.classId, 'مدیریت تکلیف');
    }

    case 'homework_submissions': {
      if (!roleDef.canManageHomework) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز بررسی و نمره‌دهی تکالیف را ندارید.',
        };
      }
      const sub = meta.record as HomeworkSubmission | undefined;
      return assertTeacherClassAccess(meta.classId ?? sub?.classId, 'نمره‌دهی تکلیف');
    }

    case 'student_rewards': {
      if (!roleDef.canAwardRewards) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت نشان تشویقی یا صدور لوح تقدیر را ندارید.',
        };
      }
      if (session.role === 'teacher' && action === 'delete') {
        return {
          allowed: false,
          reasonFa: 'حذف سابقه تشویقی ثبت‌شده صرفاً توسط مدیر یا معاون مدرسه مجاز است.',
        };
      }
      const rw = meta.record as StudentReward | undefined;
      return assertTeacherClassAccess(meta.classId ?? rw?.classId, 'ثبت نشان تشویقی');
    }

    // --- Phase 2.5 Collections ---
    case 'question_bank': {
      if (!roleDef.canManageQuestionBank) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز افزودن، ویرایش یا حذف سوالات در بانک سوالات را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'class_chat_draft_queue': {
      if (!roleDef.canManageQuestionBank && !roleDef.canManageMediaHub) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ارسال پیش‌نویس به صف چت کلاسی را ندارید.',
        };
      }
      if (session.role === 'teacher') {
        const draft = meta.record as { classId?: string } | undefined;
        if (draft?.classId || meta.classId) {
          return assertTeacherClassAccess(meta.classId ?? draft?.classId, 'ارسال سوال به چت کلاسی');
        }
      }
      return { allowed: true };
    }

    case 'exam_question_basket': {
      if (!roleDef.canManageQuestionBank) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز مدیریت سبد طراحی آزمون آنلاین را ندارید.',
        };
      }
      return { allowed: true };
    }

    // --- Phase 3 Collections ---
    case 'flipped_lessons': {
      if (!roleDef.canManageFlippedVideo) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ایجاد یا حذف ویدیوهای کلاس وارونه را ندارید.',
        };
      }
      const lesson = meta.record as FlippedVideoLesson | undefined;
      return assertTeacherClassAccess(meta.classId ?? lesson?.classId, 'مدیریت کلاس وارونه');
    }

    case 'flipped_telemetry': {
      if (!roleDef.canManageFlippedVideo) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز تغییر گزارش‌های تماشای کلاس وارونه را ندارید.',
        };
      }
      const tel = meta.record as FlippedVideoTelemetry | undefined;
      return assertTeacherClassAccess(meta.classId ?? tel?.classId, 'مدیریت گزارش کلاس وارونه');
    }

    case 'flipped_questions': {
      if (!roleDef.canManageFlippedVideo) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز پاسخ‌دهی به سوالات کلاس وارونه را ندارید.',
        };
      }
      const fq = meta.record as FlippedTimestampQuestion | undefined;
      return assertTeacherClassAccess(meta.classId ?? fq?.classId, 'پاسخ‌دهی به سوالات کلاس وارونه');
    }

    case 'online_class_sessions': {
      if (!roleDef.canManageOnlineClassroom) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز تعریف یا ویرایش جلسات کلاس آنلاین را ندارید.',
        };
      }
      const sess = meta.record as OnlineClassSession | undefined;
      return assertTeacherClassAccess(meta.classId ?? sess?.classId, 'مدیریت کلاس آنلاین');
    }

    case 'online_class_attendance': {
      if (!roleDef.canManageOnlineClassroom) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا ویرایش حضور و غیاب کلاس آنلاین را ندارید.',
        };
      }
      const att = meta.record as OnlineClassAttendanceRecord | undefined;
      return assertTeacherClassAccess(meta.classId ?? att?.classId, 'ثبت حضور و غیاب کلاس آنلاین');
    }

    case 'online_exams': {
      if (!roleDef.canManageOnlineExams) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز طراحی یا حذف آزمون آنلاین را ندارید.',
        };
      }
      const exam = meta.record as OnlineExam | undefined;
      return assertTeacherClassAccess(meta.classId ?? exam?.classId, 'مدیریت آزمون آنلاین');
    }

    case 'online_exam_submissions': {
      if (!roleDef.canManageOnlineExams) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز تصحیح یا تایید نمرات آزمون آنلاین را ندارید.',
        };
      }
      const sub = meta.record as OnlineExamSubmission | undefined;
      return assertTeacherClassAccess(meta.classId ?? sub?.classId, 'تصحیح آزمون آنلاین');
    }

    case 'student_360_signals': {
      if (
        !roleDef.canManageFlippedVideo &&
        !roleDef.canManageOnlineExams &&
        !roleDef.canManageOnlineClassroom &&
        !roleDef.canManageGradebook
      ) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت شاخص ۳۶۰ درجه دانش‌آموز را ندارید.',
        };
      }
      const sig = meta.record as Student360Signal | undefined;
      return assertTeacherClassAccess(meta.classId ?? sig?.classId, 'ثبت شاخص عملکرد دانش‌آموز');
    }

    // --- Phase 3.5 Private Parent-Staff Chat ---
    case 'parent_staff_messages': {
      if (!roleDef.canUseParentStaffChat) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ارسال پیام در گفت‌وگوی اختصاصی اولیا را ندارید.',
        };
      }
      if (action === 'delete') {
        if (session.role !== 'complex_admin' && session.role !== 'principal') {
          return {
            allowed: false,
            reasonFa: 'حذف سوابق مکالمه صرفاً توسط مدیر مدرسه یا مدیر کل مجاز است.',
          };
        }
        return { allowed: true };
      }
      const msg = meta.record as ParentStaffMessage | undefined;
      if (session.role === 'teacher') {
        if (msg && msg.channelType !== 'teacher') {
          return {
            allowed: false,
            reasonFa: 'معلم فقط مجاز به پاسخ‌گویی در گفت‌وگوهای کانال معلم کلاس است.',
          };
        }
        return assertTeacherClassAccess(meta.classId ?? msg?.classId, 'گفت‌وگو با اولیا');
      }
      return { allowed: true };
    }

    // --- Phase 4: Class Chat, Appointments, Electronic Forms, Notification Templates ---
    case 'class_chat_rooms': {
      if (!roleDef.canManageClassChat) {
        return {
          allowed: false,
          reasonFa: 'تغییر وضعیت اتاق گفت‌وگوی کلاسی صرفاً توسط معلم کلاس یا مدیریت مدرسه مجاز است.',
        };
      }
      const room = meta.record as ClassChatRoomConfig | undefined;
      return assertTeacherClassAccess(meta.classId ?? room?.classId, 'تنظیم حالت گفت‌وگوی کلاس');
    }

    case 'class_chat_messages': {
      if (!roleDef.canUseClassChat) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ارسال پیام در چت کلاسی را ندارید.',
        };
      }
      const msg = meta.record as ClassChatMessage | undefined;
      if (session.role === 'teacher') {
        return assertTeacherClassAccess(meta.classId ?? msg?.classId, 'ارسال پیام در چت کلاسی');
      }
      return { allowed: true };
    }

    case 'appointment_slots': {
      if (!roleDef.canManageAppointments) {
        return {
          allowed: false,
          reasonFa: 'تعریف یا مدیریت نوبت‌های ملاقات اولیا صرفاً بر عهده کادر و معلمان است.',
        };
      }
      const slot = meta.record as AppointmentSlot | undefined;
      if (session.role === 'teacher' && slot && slot.linkedTeacherId && slot.linkedTeacherId !== session.linkedTeacherId) {
        return {
          allowed: false,
          reasonFa: 'معلم فقط مجاز به مدیریت بازه‌های نوبت‌دهی اختصاصی خود است.',
        };
      }
      return { allowed: true };
    }

    case 'electronic_forms': {
      if (!roleDef.canManageElectronicForms) {
        return {
          allowed: false,
          reasonFa: 'ایجاد یا ویرایش فرم‌های الکترونیک و رضایت‌نامه‌ها صرفاً توسط کادر و معلمان مجاز است.',
        };
      }
      const form = meta.record as ElectronicForm | undefined;
      if (session.role === 'teacher' && form && form.targetAudience === 'specific_classes') {
        const unauthorized = form.targetClassIds.some((cid) => !teacherAssignedClassIds.includes(cid));
        if (unauthorized) {
          return {
            allowed: false,
            reasonFa: 'معلم فقط مجاز به تعریف رضایت‌نامه برای کلاس‌های محول‌شده به خود است.',
          };
        }
      }
      return { allowed: true };
    }

    case 'electronic_form_responses': {
      if (!roleDef.canManageElectronicForms && !roleDef.canSignElectronicForms) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا تغییر پاسخ فرم الکترونیک را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'notification_templates': {
      if (!roleDef.canUseNotificationTemplates) {
        return {
          allowed: false,
          reasonFa: 'مدیریت بانک قالب‌های پیام آماده صرفاً در اختیار کادر و معلمان است.',
        };
      }
      const tpl = meta.record as NotificationTemplate | undefined;
      void tpl;
      return { allowed: true };
    }

    // --- Phase 5: SIDA Bridge, In-Person Exams Management, Electronic Profiles ---
    case 'sida_grade_audit_logs': {
      if (!roleDef.canUseSidaBridge) {
        return {
          allowed: false,
          reasonFa: 'ثبت تاریخچه بررسی اعتراض نمره صرفاً بر عهده کادر مدرسه و معلمان مجاز است.',
        };
      }
      if (action === 'delete') {
        return {
          allowed: false,
          reasonFa: 'تاریخچه تغییر نمره جهت اصلاح در سیدا تغییرناپذیر است و قابل حذف نیست.',
        };
      }
      const log = meta.record as SidaGradeAuditLog | undefined;
      if (session.role === 'teacher') {
        return assertTeacherClassAccess(meta.classId ?? log?.classId, 'ثبت گزارش بررسی اعتراض نمره');
      }
      return { allowed: true };
    }

    case 'in_person_exam_halls':
    case 'in_person_exam_sessions':
    case 'exam_seating_charts': {
      if (!roleDef.canManageInPersonExams) {
        return {
          allowed: false,
          reasonFa: 'مدیریت برنامه امتحانات حضوری، حوزه‌ها و چیدمان صندلی‌ها صرفاً در اختیار مدیریت و معاونت مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'student_profiles': {
      if (!roleDef.canManageElectronicProfiles) {
        return {
          allowed: false,
          reasonFa: 'ویرایش پرونده الکترونیک دانش‌آموزان و بارگذاری مدارک صرفاً بر عهده مدیریت و معاونت مدرسه است.',
        };
      }
      const prof = meta.record as StudentElectronicProfile | undefined;
      void prof;
      return { allowed: true };
    }

    case 'staff_profiles': {
      if (!roleDef.canManageElectronicProfiles) {
        return {
          allowed: false,
          reasonFa: 'ویرایش پرونده الکترونیک همکاران و بارگذاری ابلاغ‌ها صرفاً بر عهده مدیریت و معاونت مدرسه است.',
        };
      }
      const staffProf = meta.record as StaffElectronicProfile | undefined;
      if (
        staffProf?.confidentialEvaluationNotes !== undefined &&
        staffProf.confidentialEvaluationNotes.trim().length > 0 &&
        !roleDef.canViewConfidentialStaffEvaluation
      ) {
        return {
          allowed: false,
          reasonFa: 'ثبت یا ویرایش ارزیابی محرمانه همکاران صرفاً در اختیار مدیر مدرسه یا مدیر کل است.',
        };
      }
      return { allowed: true };
    }

    // --- Phase 5.5: SIDA Speed-Entry Ticks, Personal Appearance Prefs, School Branding & Labels ---
    case 'sida_speed_entry_ticks': {
      if (!roleDef.canUseSidaBridge) {
        return {
          allowed: false,
          reasonFa: 'ثبت وضعیت ورود سریع نمرات در سیدا فقط برای کادر و معلمان مجاز است.',
        };
      }
      const tick = meta.record as SidaSpeedEntryRecord | undefined;
      if (session.role === 'teacher') {
        return assertTeacherClassAccess(meta.classId ?? tick?.classId, 'ثبت تیک سیدا');
      }
      return { allowed: true };
    }

    case 'user_appearance_prefs': {
      const pref = meta.record as UserAppearancePreference | undefined;
      if (pref && pref.userId !== session.userId && session.role !== 'complex_admin') {
        return {
          allowed: false,
          reasonFa: 'هر کاربر فقط مجاز به تغییر تنظیمات ظاهری حساب شخصی خود است.',
        };
      }
      return { allowed: true };
    }

    case 'school_branding_configs': {
      if (!roleDef.canEditSchoolSettings) {
        return {
          allowed: false,
          reasonFa: 'تغییر نام بخش‌های سامانه و برندینگ مدرسه صرفاً در اختیار مدیر مدرسه و مدیر کل مجموعه است.',
        };
      }
      const cfg = meta.record as SchoolBrandingConfig | undefined;
      void cfg;
      return { allowed: true };
    }

    // --- Phase 6: Finance, Smart Analytics Remedial Plans & Privacy-First Anonymous Surveys ---
    case 'finance_fee_plans': {
      if (!roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'تعریف یا ویرایش شهریه پایه و ساختار تعرفه‌ها صرفاً در اختیار مدیر مدرسه و مدیر کل است.',
        };
      }
      const plan = meta.record as FinanceFeePlan | undefined;
      void plan;
      return { allowed: true };
    }

    case 'finance_student_ledgers': {
      if (!roleDef.canRecordFinancePayments && !roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز مشاهده یا ویرایش دفتر حساب مالی دانش‌آموزان را ندارید.',
        };
      }
      if (action === 'delete' && !roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'حذف پرونده مالی دانش‌آموز صرفاً توسط مدیر مدرسه یا مدیر کل مجاز است.',
        };
      }
      const ledger = meta.record as FinanceStudentLedger | undefined;
      void ledger;
      return { allowed: true };
    }

    case 'finance_payments': {
      if (!roleDef.canRecordFinancePayments && !roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا ویرایش تراکنش‌های مالی را ندارید.',
        };
      }
      if (action === 'delete' && !roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'معاون مجاز به حذف رسیدهای مالی ثبت‌شده نیست؛ صرفاً مدیر مدرسه یا مدیر کل مجاز است.',
        };
      }
      const pay = meta.record as FinancePaymentRecord | undefined;
      void pay;
      return { allowed: true };
    }

    case 'finance_expenses': {
      if (!roleDef.canRecordFinancePayments && !roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا مدیریت هزینه‌های مدرسه را ندارید.',
        };
      }
      if (action === 'delete' && !roleDef.canManageFinanceFull) {
        return {
          allowed: false,
          reasonFa: 'حذف اسناد هزینه مدرسه صرفاً در اختیار مدیر مدرسه و مدیر کل است.',
        };
      }
      const exp = meta.record as FinanceExpenseRecord | undefined;
      void exp;
      return { allowed: true };
    }

    case 'remedial_plans': {
      if (!roleDef.canManageRemedialPlans) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز مدیریت برنامه‌های تقویتی دانش‌آموزان را ندارید.',
        };
      }
      const plan = meta.record as RemedialPlanRecord | undefined;
      if (session.role === 'teacher') {
        if (action === 'delete') {
          return {
            allowed: false,
            reasonFa: 'حذف برنامه تقویتی مصوب صرفاً توسط مدیر یا معاون مدرسه مجاز است.',
          };
        }
        return assertTeacherClassAccess(meta.classId ?? plan?.classId, 'مدیریت برنامه تقویتی');
      }
      return { allowed: true };
    }

    case 'anonymous_surveys': {
      if (!roleDef.canManageSurveys) {
        return {
          allowed: false,
          reasonFa: 'ساخت، ویرایش یا بستن نظرسنجی‌ها صرفاً در اختیار مدیر کل، مدیر مدرسه و معاون است.',
        };
      }
      const survey = meta.record as AnonymousSurvey | undefined;
      void survey;
      return { allowed: true };
    }

    case 'survey_participation_receipts': {
      if (!roleDef.canParticipateSurveys && !roleDef.canManageSurveys) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت رسید مشارکت در نظرسنجی را ندارید.',
        };
      }
      if (action === 'delete' && !roleDef.canManageSurveys) {
        return {
          allowed: false,
          reasonFa: 'حذف رسید مشارکت نظرسنجی مجاز نیست.',
        };
      }
      return { allowed: true };
    }

    case 'survey_anonymous_responses': {
      if (action === 'delete') {
        if (!roleDef.canManageSurveys) {
          return {
            allowed: false,
            reasonFa: 'حذف پاسخ نظرسنجی مجاز نیست.',
          };
        }
        return { allowed: true };
      }
      // Teachers can submit anonymous teacher responses; managers can update internal reviewStatus/notes
      if (session.role === 'teacher') {
        const resp = meta.record as SurveyAnonymousResponse | undefined;
        if (!resp || resp.audienceRole !== 'teacher') {
          return {
            allowed: false,
            reasonFa: 'معلم فقط مجاز به ثبت پاسخ ناشناس در نقش همکار/دبیر است.',
          };
        }
        return { allowed: true };
      }
      if (!roleDef.canManageSurveys) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز تغییر پاسخ‌های نظرسنجی را ندارید.',
        };
      }
      return { allowed: true };
    }

    // --- Phase 7: Teacher Professional Development, Quizzes, Certificates & Ranking Privacy ---
    case 'td_courses': {
      if (!roleDef.canManageTeacherDevCourses) {
        return {
          allowed: false,
          reasonFa: 'ایجاد، ویرایش یا بایگانی دوره‌ها و کتاب‌های ضمن خدمت صرفاً در اختیار مدیر مدرسه و مدیر کل مجموعه است.',
        };
      }
      const course = meta.record as TeacherDevCourse | undefined;
      if (course?.scope === 'all' && !roleDef.canPublishAllSchoolsCourses) {
        return {
          allowed: false,
          reasonFa: 'انتشار یا ویرایش دوره‌های مشترک هر ۳ مدرسه صرفاً توسط مدیر کل مجموعه مجاز است.',
        };
      }
      return { allowed: true };
    }

    case 'td_progress': {
      if (action === 'delete') {
        if (session.role !== 'complex_admin' && session.role !== 'principal') {
          return {
            allowed: false,
            reasonFa: 'حذف سوابق پیشرفت دوره صرفاً توسط مدیر مدرسه یا مدیر کل مجاز است.',
          };
        }
        return { allowed: true };
      }
      const prog = meta.record as TeacherDevProgress | undefined;
      if (session.role === 'teacher') {
        if (!session.linkedTeacherId || !prog || prog.teacherId !== session.linkedTeacherId) {
          return {
            allowed: false,
            reasonFa: 'معلم فقط مجاز به ثبت پیشرفت مطالعه و شرکت در آزمون برای حساب شخصی خود است.',
          };
        }
        return { allowed: true };
      }
      if (!roleDef.canManageTeacherDevCourses) {
        return {
          allowed: false,
          reasonFa: 'معاون مجاز به تغییر یا حذف سوابق مطالعه و آزمون همکاران نیست.',
        };
      }
      return { allowed: true };
    }

    case 'td_certificates': {
      if (action === 'delete') {
        if (session.role !== 'complex_admin' && session.role !== 'principal') {
          return {
            allowed: false,
            reasonFa: 'حذف گواهینامه صادرشده برای معاون و معلم مجاز نیست.',
          };
        }
        return { allowed: true };
      }
      const cert = meta.record as TeacherDevCertificate | undefined;
      if (session.role === 'teacher') {
        if (!session.linkedTeacherId || !cert || cert.teacherId !== session.linkedTeacherId) {
          return {
            allowed: false,
            reasonFa: 'صدور گواهینامه صرفاً برای خود همکار پس از قبولی در آزمون مجاز است.',
          };
        }
        return { allowed: true };
      }
      if (!roleDef.canManageTeacherDevCourses) {
        return {
          allowed: false,
          reasonFa: 'شما مجوز ثبت یا تغییر گواهینامه‌های ضمن خدمت را ندارید.',
        };
      }
      return { allowed: true };
    }

    case 'td_school_settings': {
      if (!roleDef.canConfigureTeacherDevPrivacy) {
        return {
          allowed: false,
          reasonFa: 'تغییر تنظیمات محرمانگی رتبه‌بندی معلمین صرفاً در اختیار مدیر مدرسه و مدیر کل مجموعه است.',
        };
      }
      const settings = meta.record as TeacherDevSchoolSettings | undefined;
      void settings;
      return { allowed: true };
    }

    // --- Phase 9A: Multi-Academic-Year Engine & Enterprise Mock / Konkur Exams ---
    case 'academic_years': {
      if (session.role !== 'complex_admin' && session.role !== 'principal') {
        return {
          allowed: false,
          reasonFa:
            'ایجاد، فعال‌سازی یا آرشیو کردن سال تحصیلی صرفاً در اختیار راهبر ارشد، مدیر کل مجموعه و مدیر مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'mock_exams': {
      const exam = meta.record as MockExam | undefined;
      if (exam?.scope === 'complex' && session.role !== 'complex_admin') {
        return {
          allowed: false,
          reasonFa: 'تعریف یا ویرایش آزمون هماهنگ کل مجموعه (۳ مدرسه) صرفاً توسط مدیر کل یا راهبر ارشد مجاز است.',
        };
      }
      return { allowed: true };
    }

    case 'mock_exam_attempts': {
      return { allowed: true };
    }

    // --- Phase 9B: Advanced SIDA Analytics Engine ---
    case 'sida_appeal_windows': {
      if (
        session.role !== 'complex_admin' &&
        session.role !== 'principal' &&
        session.role !== 'deputy'
      ) {
        return {
          allowed: false,
          reasonFa: 'تنظیم بازه زمانی ثبت اعتراض نمرات صرفاً در اختیار مدیریت و معاونت مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'sida_remedial_groups': {
      if (session.role === 'teacher') {
        if (meta.classId) {
          return assertTeacherClassAccess(meta.classId, 'مدیریت گروه‌های تقویتی کلاس');
        }
        return { allowed: true };
      }
      return { allowed: true };
    }

    case 'sida_class_balancing_drafts': {
      if (
        session.role !== 'complex_admin' &&
        session.role !== 'principal' &&
        session.role !== 'deputy'
      ) {
        return {
          allowed: false,
          reasonFa: 'ذخیره و مدیریت پیش‌نویس کلاس‌بندی همتراز صرفاً در اختیار مدیریت و معاونت مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'sida_analytics_grades': {
      if (session.role === 'teacher') {
        return assertTeacherClassAccess(meta.classId, 'ثبت یا ویرایش داده‌های تحلیلی سیدا');
      }
      return { allowed: true };
    }

    // --- Step 3: Smart Content Archive, Announcements, Transfers, Notification Receipts & Recovery Snapshots ---
    case 'smart_content_archive': {
      if (action === 'delete' && session.role === 'teacher') {
        return {
          allowed: false,
          reasonFa: 'حذف محتوای آرشیو هوشمند صرفاً توسط مدیریت یا معاونت مدرسه مجاز است.',
        };
      }
      return { allowed: true };
    }

    case 'school_announcements': {
      if (session.role === 'teacher' && action === 'delete') {
        return {
          allowed: false,
          reasonFa: 'حذف اطلاعیه‌های ثبت‌شده صرفاً توسط مدیریت مدرسه مجاز است.',
        };
      }
      return { allowed: true };
    }

    case 'student_transfer_logs': {
      if (!roleDef.canManageStudents) {
        return {
          allowed: false,
          reasonFa: 'ثبت انتقال کلاس دانش‌آموزان صرفاً توسط مدیریت و معاونت مدرسه مجاز است.',
        };
      }
      return { allowed: true };
    }

    case 'notification_read_receipts': {
      return { allowed: true };
    }

    case 'recovery_snapshots': {
      if (session.role !== 'complex_admin' && session.role !== 'principal') {
        return {
          allowed: false,
          reasonFa: 'مدیریت نقاط بازگشت و ریست امن انتخابی صرفاً در اختیار راهبر ارشد، مدیر کل و مدیر مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'import_mapping_templates': {
      if (session.role !== 'principal') {
        return {
          allowed: false,
          reasonFa: 'مدیریت الگوهای نگاشت ورود هوشمند صرفاً در اختیار راهبر ارشد و مدیر مدرسه است.',
        };
      }
      const tpl = meta.record as { isComplexWide?: boolean } | undefined;
      if (tpl?.isComplexWide) {
        return {
          allowed: false,
          reasonFa: 'انتشار الگوی نگاشت برای کل مجموعه صرفاً در اختیار راهبر ارشد سامانه است.',
        };
      }
      return { allowed: true };
    }

    // --- Phase 9-C: Discipline, Leave/Exit Pass, Confidential Counseling & Virtual Class Hub ---
    case 'discipline_records': {
      if (session.role === 'counselor') {
        return {
          allowed: false,
          reasonFa: 'ثبت یا ویرایش موارد انضباطی و تشویقی بر عهده مدیریت، معاونت و معلم کلاس است.',
        };
      }
      if (session.role === 'teacher') {
        if (action === 'delete') {
          return {
            allowed: false,
            reasonFa: 'حذف نرم سوابق انضباطی و تشویقی صرفاً توسط مدیریت یا معاونت مدرسه مجاز است.',
          };
        }
        const rec = meta.record as DisciplineRecord | undefined;
        return assertTeacherClassAccess(meta.classId ?? rec?.classId, 'ثبت تشویق یا تذکر انضباطی');
      }
      return { allowed: true };
    }

    case 'discipline_pledges': {
      if (
        session.role !== 'complex_admin' &&
        session.role !== 'principal' &&
        session.role !== 'deputy'
      ) {
        return {
          allowed: false,
          reasonFa: 'صدور، ویرایش یا حذف تعهدنامه انضباطی صرفاً در اختیار مدیریت و معاونت مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'student_exit_passes': {
      if (
        session.role !== 'complex_admin' &&
        session.role !== 'principal' &&
        session.role !== 'deputy'
      ) {
        return {
          allowed: false,
          reasonFa: 'صدور و تایید برگه خروج دانش‌آموز صرفاً در اختیار مدیریت و معاونت مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'staff_leave_requests': {
      if (session.role === 'complex_admin' || session.role === 'principal') {
        return { allowed: true };
      }
      if (action === 'delete') {
        return {
          allowed: false,
          reasonFa: 'حذف نرم درخواست مرخصی کادر صرفاً در اختیار مدیر مدرسه یا مدیر کل است.',
        };
      }
      const req = meta.record as StaffLeaveRequest | undefined;
      if (!req || req.staffUserId !== session.userId) {
        return {
          allowed: false,
          reasonFa: 'هر همکار فقط مجاز به ثبت یا ویرایش درخواست مرخصی شخصی خود است.',
        };
      }
      if (req.status !== 'pending') {
        return {
          allowed: false,
          reasonFa: 'تایید یا رد درخواست مرخصی کادر صرفاً در اختیار مدیر مدرسه است.',
        };
      }
      return { allowed: true };
    }

    case 'counseling_sessions': {
      if (session.role === 'counselor') {
        return { allowed: true };
      }
      if (action === 'delete') {
        if (session.role !== 'principal' && session.role !== 'complex_admin') {
          return {
            allowed: false,
            reasonFa: 'حذف نرم نوبت مشاوره صرفاً در اختیار مشاور یا مدیریت مدرسه است.',
          };
        }
        return { allowed: true };
      }
      // Teachers, deputies, principals, and complex_admin can submit student referrals (status 'requested')
      const cs = meta.record as CounselingSession | undefined;
      if (
        cs &&
        cs.isReferral &&
        cs.status === 'requested' &&
        !cs.sharedAdviceText
      ) {
        return { allowed: true };
      }
      if (session.role === 'principal' || session.role === 'deputy' || session.role === 'complex_admin') {
        // Admins may schedule/cancel appointments but cannot write counseling recommendations
        if (cs?.sharedAdviceText) {
          return {
            allowed: false,
            reasonFa: 'ثبت یا ویرایش توصیه‌های تخصصی مشاوره‌ای صرفاً بر عهده مشاور مدرسه است.',
          };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        reasonFa: 'معلم فقط مجاز به ثبت ارجاع دانش‌آموز به دفتر مشاوره است.',
      };
    }

    case 'counseling_clinical_notes': {
      // STRICT LAYER-1 CONFIDENTIALITY: ONLY counselor (and super_admin handled above) may write/delete clinical notes!
      if (session.role !== 'counselor') {
        return {
          allowed: false,
          reasonFa:
            'لایه محرمانه یادداشت‌های بالینی صرفاً در انحصار مشاور مدرسه است و سایر نقش‌ها مجاز به ثبت یا ویرایش آن نیستند.',
        };
      }
      return { allowed: true };
    }

    case 'virtual_class_sessions': {
      if (session.role === 'counselor') {
        return {
          allowed: false,
          reasonFa: 'برنامه‌ریزی کلاس‌های مجازی بر عهده معلمان، معاونت و مدیریت مدرسه است.',
        };
      }
      if (session.role === 'teacher') {
        if (action === 'delete') {
          return {
            allowed: false,
            reasonFa: 'حذف نرم جلسه کلاس مجازی صرفاً در اختیار مدیریت یا معاونت مدرسه است.',
          };
        }
        const sess = meta.record as VirtualClassSession | undefined;
        return assertTeacherClassAccess(meta.classId ?? sess?.classId, 'برنامه‌ریزی کلاس مجازی');
      }
      return { allowed: true };
    }

    case 'virtual_class_attendance': {
      if (session.role === 'counselor') {
        return {
          allowed: false,
          reasonFa: 'مدیریت لیست حضور کلاس مجازی صرفاً بر عهده معلم و مدیریت مدرسه است.',
        };
      }
      if (session.role === 'teacher') {
        const att = meta.record as VirtualClassAttendance | undefined;
        return assertTeacherClassAccess(meta.classId ?? att?.classId, 'ثبت حضور کلاس مجازی');
      }
      return { allowed: true };
    }
  }
}

export function authorizeBackupOperation(
  auth: AuthGuardContext,
  scope: BackupPayload['scope'],
  targetSchoolId?: string
): AuthorizationDecision {
  const { session } = auth;
  if (!session) {
    return { allowed: false, reasonFa: 'نشست کاربری معتبر نیست.' };
  }
  const roleDef = ROLE_DEFINITIONS[session.role];

  if (scope === 'complex_wide') {
    if (!roleDef.canBackupComplexWide) {
      return {
        allowed: false,
        reasonFa: 'پشتیبان‌گیری یا بازیابی کل مجموعه صرفاً در اختیار مدیر کل مجموعه است.',
      };
    }
    return { allowed: true };
  }

  if (!roleDef.canBackupSingleSchool) {
    return {
      allowed: false,
      reasonFa: 'نقش کاربری شما مجوز پشتیبان‌گیری یا بازیابی اطلاعات را ندارد.',
    };
  }
  if (!roleDef.canSwitchSchool && targetSchoolId && targetSchoolId !== session.schoolId) {
    return {
      allowed: false,
      reasonFa: 'شما فقط مجاز به پشتیبان‌گیری یا بازیابی مدرسه خود هستید.',
    };
  }
  return { allowed: true };
}
