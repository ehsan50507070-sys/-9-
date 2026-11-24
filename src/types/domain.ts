// Core Multi-School Domain Types (Phase 1 full entities + forward-compatible Phases 2-6 contracts)

export type RoleId =
  | 'super_admin'
  | 'complex_admin'
  | 'principal'
  | 'deputy'
  | 'counselor'
  | 'teacher'
  | 'parent'
  | 'student';

export type AccentTheme = 'indigo' | 'emerald' | 'violet';

// 0=شنبه, 1=یکشنبه, 2=دوشنبه, 3=سه‌شنبه, 4=چهارشنبه, 5=پنج‌شنبه, 6=جمعه
export type PersianWeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PeriodNumber = 1 | 2 | 3 | 4;

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type StaffAttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type DailyLogCategory = 'early_dismissal' | 'health' | 'disciplinary' | 'administrative';

export type SchoolGradeLevel = 'elementary' | 'middle' | 'high';

/**
 * Step 3-B Standard Concurrency & Zero-Hard-Delete (Soft Delete) Metadata.
 * Automatically populated and incremented by IDataRepository & MigrationEngine.
 */
export interface SoftDeleteVersionFields {
  complexId?: string;
  academicYearId?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
  recordVersion?: number;
  deletedAtIso?: string | null;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
}

export interface School extends SoftDeleteVersionFields {
  id: string;
  schoolId: string; // Equals id for uniform tenant filtering
  complexId?: string; // Defaults seamlessly to 'complex-1' for zero-loss migration
  name: string;
  subtitle: string;
  gradeLevel?: SchoolGradeLevel;
  accent: AccentTheme;
  principalName: string;
  principalUserId?: string;
  phone: string;
  address: string;
  logoDataUrl?: string;
  isActive?: boolean;
  academicYear: string;
  activeWorkdays: PersianWeekdayIndex[]; // Default: [3, 4, 5, 6] (سه‌شنبه، چهارشنبه، پنج‌شنبه و جمعه)
  holidays: string[]; // Jalali YYYY/MM/DD
  letterheadTitle: string;
  letterheadSubtitle: string;
  signatureFooter: string;
  periodDurationMinutes: number; // e.g., 75 minutes per period
  createdAt: string;
  updatedAt: string;
}

export interface ClassRoom extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  name: string; // e.g., «پایه دوم - کلاس الف»
  gradeLevel: 2 | 3 | 4 | 5 | 6;
  customGradeLabel?: string;
  section: string;
  homeroomTeacherId: string;
  capacity: number;
  roomCode: string;
}

export type SidaEnrollmentStatus = 'عادی' | 'انتقالی' | 'میهمان' | 'جهشی' | 'اتباع';

export interface Student extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  nationalId: string; // 10-digit Iranian National ID
  studentCode: string;
  sidaStudentCode?: string; // کد دانش‌آموزی سیدا (اختیاری)
  birthCertificateNumber?: string; // شماره شناسنامه
  enrollmentStatus?: SidaEnrollmentStatus; // وضعیت ثبت‌نام سیدا
  parentName: string;
  parentMobile: string; // 09xxxxxxxxx
  birthDateJalali?: string; // YYYY/MM/DD
  emergencyNotes?: string;
  studentUsername?: string; // Auto-generated non-Persian student login username
  studentPassword?: string; // Deprecated plaintext field (never persisted; migrated to hash)
  studentPasswordHash?: string; // PBKDF2/SHA-256 salted hash
  studentPasswordSalt?: string;
  studentMustChangePassword?: boolean;
  parentUsername?: string; // Auto-generated non-Persian parent login username
  parentNationalId?: string; // Optional 10-digit parent National ID
  parentPassword?: string; // Deprecated plaintext field (never persisted; migrated to hash)
  parentPasswordHash?: string; // PBKDF2/SHA-256 salted hash (always distinct from student's)
  parentPasswordSalt?: string;
  parentMustChangePassword?: boolean;
  active: boolean;
}

export type UserRole = RoleId;

export interface AuthSession {
  userId: string;
  username: string;
  displayName: string;
  role: RoleId;
  schoolId: string;
  complexId?: string;
  isComplexWide: boolean;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
  linkedTeacherId?: string;
  linkedStudentId?: string;
  loggedInAt: string;
}

export interface Teacher extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  fullName: string;
  nationalId: string;
  personnelCode: string;
  mobile: string;
  specialty: string; // e.g., «آموزگار پایه سوم», «ریاضی و علوم»
  assignedClassIds: string[];
  weeklyQuotaPeriods: number;
  passwordHash?: string;
  passwordSalt?: string;
  mustChangePassword?: boolean;
  active: boolean;
}

export interface ScheduleSlot extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  weekday: PersianWeekdayIndex;
  period: PeriodNumber;
  classId: string;
  teacherId: string;
  subjectName: string;
}

export interface StudentAttendanceRecord extends SoftDeleteVersionFields {
  id: string; // `${schoolId}:${jalaliDate}:${classId}:${period}:${studentId}`
  schoolId: string;
  jalaliDate: string; // YYYY/MM/DD
  classId: string;
  period: PeriodNumber;
  studentId: string;
  status: AttendanceStatus;
  note?: string;
  recordedBy: RoleId;
  updatedAt: string;
}

export interface StaffAttendanceRecord extends SoftDeleteVersionFields {
  id: string; // `${schoolId}:${jalaliDate}:${period}:${teacherId}`
  schoolId: string;
  jalaliDate: string; // YYYY/MM/DD
  weekday: PersianWeekdayIndex;
  period: PeriodNumber;
  teacherId: string;
  status: StaffAttendanceStatus;
  note?: string;
  recordedBy: RoleId;
  updatedAt: string;
}

export interface SubstitutionRecord extends SoftDeleteVersionFields {
  id: string; // `${schoolId}:${jalaliDate}:${period}:${absentTeacherId}`
  schoolId: string;
  jalaliDate: string;
  weekday: PersianWeekdayIndex;
  period: PeriodNumber;
  classId: string;
  subjectName: string;
  absentTeacherId: string;
  substituteTeacherId: string;
  reason: 'absent' | 'late';
  note?: string;
  assignedBy: RoleId;
  assignedAt: string;
}

export interface DailyLogEntry extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  jalaliDate: string;
  category: DailyLogCategory;
  title: string;
  description: string;
  studentId?: string;
  classId?: string;
  pickupPersonName?: string;
  pickupRelation?: string;
  exitTime?: string; // HH:MM
  severity?: 'normal' | 'attention' | 'urgent';
  recordedBy: RoleId;
  createdAt: string;
}

export interface SchoolPluginState {
  id: string; // `${schoolId}:${pluginId}`
  schoolId: string;
  pluginId: string;
  installed: boolean;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

// --- Phase 2 Operational Domain Entities ---

export type DescriptiveLevel = 'خیلی خوب' | 'خوب' | 'قابل قبول' | 'نیاز به تلاش بیشتر';

export type JalaliAcademicMonth =
  | 'مهر'
  | 'آبان'
  | 'آذر'
  | 'دی'
  | 'بهمن'
  | 'اسفند'
  | 'فروردین'
  | 'اردیبهشت'
  | 'خرداد';

export interface CurriculumTopic extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  gradeLevel: 2 | 3 | 4 | 5 | 6;
  subject: 'فارسی' | 'ریاضی' | string;
  weekNumber: number;
  topic: string;
  pagesRef?: string;
  objectives?: string;
  completedClassIds: string[]; // Per-class 1-tap completion tracking
  updatedAt: string;
}

export type MediaResourceKind = 'pptx' | 'pdf' | 'image' | 'link' | 'audio';

export interface MediaResource extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  gradeLevel: 2 | 3 | 4 | 5 | 6;
  subject: string;
  weekNumber: number;
  kind: MediaResourceKind;
  title: string;
  description: string;
  url?: string; // Validated http/https external educational link
  dataUrl?: string; // Size-capped base64 attachment (<= 350 KB)
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  slideCount?: number;
  durationSeconds?: number;
  uploadedByName: string;
  uploadedByRole: RoleId;
  createdAtJalali: string;
  createdAt: string;
}

export interface ChatOutboxItem {
  id: string;
  schoolId: string;
  classId: string;
  resourceId: string;
  resourceTitle: string;
  resourceKind: MediaResourceKind;
  messageText: string;
  sentByName: string;
  sentByRole: RoleId;
  sentAtJalali: string;
  sentAt: string;
  status: 'queued_for_class_chat';
}

export interface GradebookEntry extends SoftDeleteVersionFields {
  id: string; // `${schoolId}:gb:${classId}:${subject}:${jalaliMonth}:${studentId}`
  schoolId: string;
  studentId: string;
  classId: string;
  subject: string;
  jalaliMonth: JalaliAcademicMonth;
  jalaliDate: string;
  numericScore?: number; // 0..20
  descriptiveLevel?: DescriptiveLevel;
  oralQuizScore?: number; // 0..20
  classActivityScore?: number; // 0..20
  microQuizScore?: number; // 0..20 (pre-wired for Phase 3 Flipped Video Micro-Quiz!)
  disciplinaryNote?: string;
  privateTeacherNote?: string; // Strictly stripped for parent role
  recordedBy: RoleId;
  updatedAt: string;
}

export interface LessonPlanRecord extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  jalaliDate: string;
  period: PeriodNumber;
  topicTitle: string;
  goals: string;
  tools: string;
  activities: string;
  teachingReport: string;
  educationalRemarks: string;
  updatedAt: string;
}

export interface GradebookWeightConfig {
  id: string; // `${schoolId}:weights:${classId}:${subject}`
  schoolId: string;
  classId: string;
  subject: string;
  attendanceWeight: number; // %
  homeworkWeight: number; // %
  oralQuizWeight: number; // %
  classActivityWeight: number; // %
  microQuizWeight: number; // % (pre-wired for Phase 3 Flipped Video Micro-Quiz)
  updatedAt: string;
}

export type GradeAppealStatus =
  | 'submitted'
  | 'in_review'
  | 'teacher_reviewed'
  | 'principal_approved'
  | 'rejected';

export interface GradeAppeal {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  subject: string;
  jalaliMonth: JalaliAcademicMonth;
  gradeEntryId: string;
  originalScore?: number;
  originalDescriptiveLevel?: DescriptiveLevel;
  parentReason: string;
  submittedByName: string;
  submittedAtJalali: string;
  status: GradeAppealStatus;
  teacherResponse?: string;
  teacherReviewedByName?: string;
  revisedScore?: number;
  revisedDescriptiveLevel?: DescriptiveLevel;
  principalNote?: string;
  principalApprovedByName?: string;
  sidaResolutionNote?: string;
  resolvedAtJalali?: string;
  updatedAt: string;
}

export type MediaAttachmentKind = 'image' | 'audio' | 'video' | 'pdf';

export interface MediaAttachmentRef {
  mediaId: string;
  schoolId: string;
  fileName: string;
  mimeType: string;
  kind: MediaAttachmentKind;
  sizeBytes: number;
}

export type BuiltinGameTemplate = 'matching' | 'memory' | 'speed_quiz';

export interface GamePairItem {
  id: string;
  term: string;
  match: string;
}

export interface GameQuizItem {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface HomeworkGameConfig {
  source: 'builtin' | 'external';
  template?: BuiltinGameTemplate;
  timeLimitSec?: number;
  pairs?: GamePairItem[];
  quizItems?: GameQuizItem[];
  externalTitle?: string;
  externalUrl?: string;
  externalInstructions?: string;
}

export interface HomeworkGameResult {
  score: number; // 0..100
  maxScore: number; // 100
  stars: 1 | 2 | 3;
  durationSec: number;
  completedAtIso: string;
  source: 'builtin' | 'external';
}

export interface HomeworkAssignment extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  title: string;
  description: string;
  dueDateJalali: string;
  createdAtJalali: string;
  maxScore: number; // Default 20
  mode?: 'standard' | 'game';
  gameConfig?: HomeworkGameConfig;
  mediaAttachments?: MediaAttachmentRef[];
  attachmentName?: string;
  attachmentUrl?: string; // Validated http/https link
  attachmentDataUrl?: string; // Size-capped base64 attachment (legacy Phase 2)
  attachmentMime?: string;
  createdAt: string;
}

export type HomeworkSubmissionStatus = 'submitted' | 'late' | 'reviewed';

export interface HomeworkSubmission extends SoftDeleteVersionFields {
  id: string; // `${schoolId}:hwsub:${assignmentId}:${studentId}`
  schoolId: string;
  assignmentId: string;
  studentId: string;
  classId: string;
  answerText: string;
  mediaAttachments?: MediaAttachmentRef[];
  attachmentName?: string;
  attachmentDataUrl?: string;
  attachmentMime?: string;
  manualInPerson?: boolean;
  gameResult?: HomeworkGameResult;
  submittedAtJalali: string;
  submittedAtIso: string;
  status: HomeworkSubmissionStatus;
  score?: number; // 0..20 (feeds Gradebook Smart Continuous Assessment)
  qualityLevel?: DescriptiveLevel;
  teacherFeedback?: string;
  reviewedAt?: string;
}

// --- Phase 2.5 Question Bank & Dispatch Queues ---
export type QuestionType =
  | 'multiple_choice'
  | 'descriptive'
  | 'true_false'
  | 'fill_blank'
  | 'file_sample';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankItem extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  gradeLevel: number;
  gradeLabel: string;
  subject: string;
  chapter: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  questionText: string;
  options?: [string, string, string, string];
  correctOptionIndex?: number;
  trueFalseAnswer?: boolean;
  modelAnswer?: string;
  mediaAttachment?: MediaAttachmentRef;
  createdById: string;
  createdByName: string;
  createdByRole: RoleId;
  createdAtJalali: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassChatDraftItem {
  id: string;
  schoolId: string;
  classId: string;
  sourceType: 'question_bank' | 'homework' | 'media';
  title: string;
  formattedText: string;
  questionIds?: string[];
  createdByName: string;
  createdByRole: RoleId;
  createdAtJalali: string;
  createdAt: string;
}

export interface ExamBasketItem {
  id: string; // `${schoolId}:exambasket:${questionId}`
  schoolId: string;
  questionId: string;
  addedByName: string;
  addedAt: string;
}

export interface StudentReward extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  badgeId: string;
  badgeTitle: string;
  badgeColor: 'amber' | 'emerald' | 'indigo' | 'rose' | 'violet' | 'sky';
  category: string;
  reason: string;
  jalaliDate: string;
  awardedByName: string;
  awardedByRole: RoleId;
  certificateSerial: string;
  createdAt: string;
}

// --- Phase 3 Digital Learning & Online Assessment Entities ---

export type FlippedVideoSource = 'demo_60s' | 'uploaded_blob';

export type FlippedSecondWatchState = 'unwatched' | 'normal' | 'fast';

export type FlippedMicroQuizStatusFa = 'تسلط کامل' | 'قابل قبول' | 'نیاز به مرور و تمرین';

export interface FlippedMicroQuizQuestion {
  id: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  sourceQuestionBankId?: string;
}

export interface FlippedVideoLesson extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  title: string;
  description?: string;
  deadlineJalali: string;
  videoSource: FlippedVideoSource;
  videoMediaRef?: MediaAttachmentRef;
  durationSeconds: number;
  microQuiz: FlippedMicroQuizQuestion[];
  createdAtJalali: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlippedMicroQuizAttempt {
  selectedOptionIndices: number[];
  correctCount: number;
  totalCount: number;
  score20: number;
  descriptiveStatus: FlippedMicroQuizStatusFa;
  completedAtIso: string;
  completedAtJalali: string;
  syncedToGradebook: boolean;
}

export interface FlippedVideoTelemetry {
  id: string; // `${schoolId}:fvtel:${lessonId}:${studentId}`
  schoolId: string;
  lessonId: string;
  classId: string;
  studentId: string;
  durationSeconds: number;
  maxWatchedSecond: number;
  lastPositionSecond: number;
  secondStates: Record<string, FlippedSecondWatchState>; // key: integer second '0'..'duration'
  tabSwitchCount: number;
  microQuizUnlocked: boolean;
  microQuizAttempt?: FlippedMicroQuizAttempt;
  updatedAt: string;
}

export interface FlippedTimestampQuestion {
  id: string;
  schoolId: string;
  lessonId: string;
  classId: string;
  studentId: string;
  studentName: string;
  timestampSecond: number;
  questionText: string;
  teacherReply?: string;
  resolved?: boolean;
  createdAtJalali: string;
  createdAt: string;
}

export type OnlineClassPlatform =
  | 'shad'
  | 'skyroom'
  | 'adobe_connect'
  | 'bigbluebutton'
  | 'google_meet'
  | 'other';

export type OnlineClassStatus = 'live' | 'scheduled' | 'ended';

export interface OnlineClassSession extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  title: string;
  jalaliDate: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  platform: OnlineClassPlatform;
  joinUrl: string;
  accessPassword?: string;
  description?: string;
  status: OnlineClassStatus;
  recordingUrl?: string;
  postSessionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type OnlineClassAttendanceStatus = 'present' | 'absent' | 'late';

export interface OnlineClassAttendanceRecord {
  id: string; // `${schoolId}:ocatt:${sessionId}:${studentId}`
  schoolId: string;
  sessionId: string;
  classId: string;
  studentId: string;
  status: OnlineClassAttendanceStatus;
  joinedAtJalali?: string;
  joinedAtTime?: string; // HH:MM
  joinedViaLink: boolean;
  note?: string;
  updatedAt: string;
}

export type OnlineExamQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'descriptive';

export type OnlineExamStatus = 'draft' | 'published' | 'ended';

export interface OnlineExamQuestion {
  id: string;
  type: OnlineExamQuestionType;
  questionText: string;
  points: number;
  options?: [string, string, string, string];
  correctOptionIndex?: number;
  trueFalseAnswer?: boolean;
  acceptedAnswers?: string[]; // for fill_blank auto-grading
  modelAnswer?: string;
  sourceQuestionBankId?: string;
}

export interface OnlineExam extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  title: string;
  description?: string;
  startDateJalali: string;
  endDateJalali: string;
  durationMinutes: number;
  randomizeOrder: boolean;
  showResultImmediately: boolean;
  status: OnlineExamStatus;
  questions: OnlineExamQuestion[];
  totalPoints: number;
  gradebookSyncedAt?: string;
  createdAtJalali: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineExamAnswer {
  questionId: string;
  selectedOptionIndex?: number;
  trueFalseValue?: boolean;
  textAnswer?: string;
  handwrittenMediaRef?: MediaAttachmentRef;
  autoScore?: number;
  manualScore?: number;
  teacherFeedback?: string;
}

export type OnlineExamGradingStatus = 'auto_graded' | 'pending_descriptive' | 'finalized';

export interface OnlineExamSubmission {
  id: string; // `${schoolId}:exsub:${examId}:${studentId}`
  schoolId: string;
  examId: string;
  classId: string;
  studentId: string;
  answers: OnlineExamAnswer[];
  startedAtIso: string;
  submittedAtIso: string;
  submittedAtJalali: string;
  elapsedSeconds: number;
  tabSwitchCount: number;
  autoGradedPoints: number;
  manualGradedPoints: number;
  finalPoints: number;
  finalScore20: number;
  gradingStatus: OnlineExamGradingStatus;
  syncedToGradebook?: boolean;
  teacherOverallFeedback?: string;
  updatedAt: string;
}

export interface Student360Signal {
  id: string; // `${schoolId}:s360:${source}:${sourceEntityId}:${studentId}`
  schoolId: string;
  studentId: string;
  classId: string;
  subject: string;
  source: 'flipped_video' | 'online_exam' | 'online_classroom';
  sourceEntityId: string;
  title: string;
  score20?: number;
  statusLabelFa: string;
  summaryFa: string;
  metrics?: Record<string, number>;
  recordedAtJalali: string;
  updatedAt: string;
}

// --- Phase 3.5 Private Parent-Staff Communication Entities ---

export type ParentChatChannelType = 'teacher' | 'principal';

export interface ParentStaffMessage extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  channelType: ParentChatChannelType; // 'teacher' = گفت‌وگو با معلم کلاس, 'principal' = گفت‌وگو با مدیر مدرسه
  targetTeacherId?: string;
  senderRole: Exclude<RoleId, 'student'>;
  senderUserId: string;
  senderName: string;
  text: string;
  jalaliDate: string; // YYYY/MM/DD
  timeText: string; // HH:MM
  createdAt: string; // ISO
  readByParent: boolean;
  readByStaff: boolean;
}

// --- Forward-Compatible Contracts for Phases 4 to 6 ---
export interface FlippedVideoTelemetryContract {
  id: string;
  schoolId: string;
  studentId: string;
  videoId: string;
  normalWatchSeconds: number;
  fastWatchSeconds: number;
  microQuizScore?: number;
}

export interface ParentAppointmentContract {
  id: string;
  schoolId: string;
  studentId: string;
  teacherId: string;
  jalaliDate: string;
  timeSlot: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface ExamSeatingContract {
  id: string;
  schoolId: string;
  examId: string;
  hallName: string;
  seatNumber: number;
  studentId: string;
}

export interface TuitionLedgerContract {
  id: string;
  schoolId: string;
  studentId: string;
  totalAmountRial: number;
  paidAmountRial: number;
  dueDateJalali: string;
}

// --- Phase 4: Family Portal, Class Chat, Appointments & 360° Sheet, Electronic Forms & Notification Templates ---

export type ClassChatRoomMode = 'open' | 'announcement_only';

export interface ClassChatRoomConfig {
  id: string; // `${schoolId}:room:${classId}`
  schoolId: string;
  classId: string;
  mode: ClassChatRoomMode;
  updatedBy: string;
  updatedAt: string;
}

export type ClassChatMessageKind = 'text' | 'announcement' | 'poll' | 'question_bank';

export interface ClassChatPollOption {
  id: string;
  text: string;
  voterUserIds: string[];
}

export interface ClassChatPoll {
  question: string;
  options: ClassChatPollOption[];
  closed?: boolean;
}

export interface ClassChatMessage extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  classId: string;
  kind: ClassChatMessageKind;
  senderRole: RoleId;
  senderUserId: string;
  senderName: string;
  text: string;
  poll?: ClassChatPoll;
  sourceQuestionId?: string;
  jalaliDate: string;
  timeText: string;
  createdAt: string;
}

export type AppointmentMeetingType = 'in_person' | 'phone' | 'online';
export type AppointmentSlotStatus = 'open' | 'booked' | 'completed' | 'cancelled';

export interface AppointmentSlot extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  staffUserId: string;
  staffName: string;
  staffRole: 'complex_admin' | 'principal' | 'deputy' | 'teacher';
  linkedTeacherId?: string;
  targetClassIds: string[]; // empty means school-wide (e.g., principal/deputy)
  jalaliDate: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  meetingType: AppointmentMeetingType;
  staffNote?: string;
  status: AppointmentSlotStatus;
  bookedByParentUserId?: string;
  bookedStudentId?: string;
  bookedClassId?: string;
  bookedParentName?: string;
  bookingTopic?: string;
  bookedAtIso?: string;
  meetingOutcomeNotes?: string; // Confidential staff summary & agreements
  updatedAt: string;
}

export type ElectronicFormPresetType = 'field_trip' | 'extra_class' | 'health_emergency' | 'custom';
export type ElectronicFormFieldType = 'short_text' | 'single_choice' | 'yes_no';

export interface ElectronicFormField {
  id: string;
  label: string;
  type: ElectronicFormFieldType;
  required: boolean;
  options?: string[];
}

export interface ElectronicForm extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  presetType: ElectronicFormPresetType;
  title: string;
  bodyText: string;
  targetAudience: 'all_school' | 'specific_classes';
  targetClassIds: string[];
  deadlineJalali: string;
  requireSignature: boolean;
  fields: ElectronicFormField[];
  active: boolean;
  createdByName: string;
  createdByRole: RoleId;
  createdAt: string;
  updatedAt: string;
}

export interface ElectronicFormResponse {
  id: string; // `${schoolId}:efres:${formId}:${studentId}`
  schoolId: string;
  formId: string;
  studentId: string;
  classId: string;
  parentUserId: string;
  parentName: string;
  answers: Record<string, string>;
  signatureDataUrl?: string; // Compressed PNG data URL from HTML5 <canvas>
  fallbackConfirmed?: boolean;
  fallbackConfirmationCode?: string;
  submittedAtJalali: string;
  submittedAtTime: string;
  submittedAtIso: string;
}

export type NotificationTemplateCategory =
  | 'absence_late'
  | 'praise'
  | 'homework_exam'
  | 'meeting_trip'
  | 'general';

export interface NotificationTemplate extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  category: NotificationTemplateCategory;
  title: string;
  body: string;
  isSystemPreset?: boolean;
  createdByName: string;
  updatedAt: string;
}

// --- Phase 5 Domain Entities: SIDA Bridge, In-Person Exams Management, Electronic Profiles ---

export interface SidaGradeAuditLog {
  id: string;
  schoolId: string;
  appealId: string;
  studentId: string;
  classId: string;
  subject: string;
  jalaliMonth: JalaliAcademicMonth;
  action: 'approved_revised' | 'rejected_original' | 'in_review';
  oldScore?: number;
  newScore?: number;
  oldDescriptiveLevel?: DescriptiveLevel;
  newDescriptiveLevel?: DescriptiveLevel;
  explanation: string;
  reviewerName: string;
  reviewerRole: RoleId;
  jalaliDate: string;
  createdAt: string;
}

export interface InPersonExamHall {
  id: string;
  schoolId: string;
  name: string; // e.g., «سالن اجتماعات — حوزه ۱»
  roomCode: string;
  rows: number; // e.g., 4..10
  cols: number; // e.g., 3..8
  startSeatNumber: number; // e.g., 101
  description?: string;
  updatedAt: string;
}

export interface InPersonExamSession {
  id: string;
  schoolId: string;
  termTitle: string; // e.g., «امتحانات نوبت اول ۱۴۰۵-۱۴۰۶»
  subject: string;
  classIds: string[];
  hallId: string;
  proctorTeacherId: string;
  jalaliDate: string; // YYYY/MM/DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  notes?: string;
  createdByName: string;
  updatedAt: string;
}

export interface ExamSeatAssignment {
  row: number; // 0-indexed
  col: number; // 0-indexed
  seatNumber: number;
  studentId: string | null;
  classId?: string;
}

export interface ExamSeatingChart {
  id: string;
  schoolId: string;
  title: string;
  hallId: string;
  examSessionId?: string;
  classIds: string[];
  rows: number;
  cols: number;
  startSeatNumber: number;
  assignments: ExamSeatAssignment[];
  adjacencyWarningCount: number;
  updatedByName: string;
  updatedAt: string;
}

export type ProfileDocumentCategory =
  | 'photo'
  | 'birth_certificate'
  | 'previous_report_card'
  | 'medical_certificate'
  | 'teaching_decree'
  | 'academic_degree'
  | 'in_service_cert'
  | 'other';

export interface ProfileDocumentItem {
  id: string;
  mediaId: string;
  schoolId: string;
  title: string;
  docCategory: ProfileDocumentCategory;
  fileName: string;
  mimeType: string;
  kind: 'image' | 'pdf';
  sizeBytes: number;
  uploadedByName: string;
  uploadedAtJalali: string;
  uploadedAtIso: string;
}

export interface StudentElectronicProfile {
  id: string; // `${schoolId}:stprof:${studentId}`
  schoolId: string;
  studentId: string;
  fatherName: string;
  motherName: string;
  motherMobile?: string;
  homeAddress: string;
  guardianRelation: string; // e.g., «پدر», «مادر», «سرپرست قانونی»
  bloodGroup?: string; // e.g., 'A+', 'O+'
  allergiesOrConditions?: string; // Highlighted with alert badge for teachers when non-empty
  emergencyContactName: string;
  emergencyContactPhone: string;
  specialEducationalNotes?: string;
  documents: ProfileDocumentItem[];
  confidentialAdminNotes?: string; // Strictly stripped for teacher, parent, student
  updatedByName: string;
  updatedAt: string;
}

export type StaffEmploymentType = 'رسمی' | 'پیمانی' | 'حق‌التدریس' | 'غیردولتی';

export interface StaffElectronicProfile {
  id: string; // `${schoolId}:sfprof:${teacherId}`
  schoolId: string;
  teacherId: string;
  roleTitle: string;
  academicDegree: string; // e.g., «کارشناسی ارشد»
  academicMajor: string; // e.g., «آموزش ابتدایی»
  yearsOfExperience: number;
  employmentType: StaffEmploymentType;
  homeAddress?: string;
  emergencyPhone?: string;
  documents: ProfileDocumentItem[];
  confidentialEvaluationNotes?: string; // Strictly stripped for teacher, parent, student
  updatedByName: string;
  updatedAt: string;
}

// --- Phase 5.5 Domain Entities: SIDA Speed-Entry Ticks, Personal Appearance Preferences & School Branding ---

export type ThemeModeId = 'light' | 'dark' | 'reading';

export type SurfaceTintId = 'classic_white' | 'soft_gray' | 'pale_blue' | 'calm_cream';

export type AccentPresetId = 'sky' | 'emerald' | 'navy' | 'royal' | 'orange' | 'crimson' | 'custom';

export type PersianFontId =
  | 'vazirmatn'
  | 'sahel'
  | 'iransans'
  | 'vazirmatn_rounded'
  | 'rubik'
  | 'lalezar'
  | 'tahoma'
  | 'system';

export type FontScalePercent = 90 | 100 | 110 | 120;

export type CornerStyleId = 'sharp' | 'balanced' | 'rounded';

export type SidebarDensityId = 'standard' | 'compact';

export interface SidaSpeedEntryRecord {
  id: string; // `${schoolId}:sidatick:${classId}:${subject}:${term}`
  schoolId: string;
  classId: string;
  subject: string;
  term: string;
  checkedStudentIds: string[];
  updatedByName: string;
  updatedAt: string;
}

export interface UserAppearancePreference {
  id: string; // `${schoolId}:uap:${userId}`
  schoolId: string;
  userId: string;
  themeMode: ThemeModeId;
  surfaceTint?: SurfaceTintId;
  accentPreset: AccentPresetId;
  customAccentHex: string;
  fontFamily: PersianFontId;
  fontScale: FontScalePercent;
  cornerStyle: CornerStyleId;
  sidebarDensity: SidebarDensityId;
  updatedAt: string;
}

export interface SchoolBrandingConfig {
  id: string; // UUID (unique per schoolId in IDataRepository)
  complexId?: string; // Parent EducationalComplex id for strict tenant isolation
  schoolId: string; // Unique key per school
  appTitle?: string; // عنوان اصلی سامانه در نوار بالا
  schoolDisplayName?: string; // نام نمایشی مدرسه در سربرگ
  printSubtitle?: string; // شعار / زیرعنوان رسمی برگه‌های چاپی A4 و A5
  logoDataUrl?: string; // Compressed school logo data URL stored per schoolId
  logoMediaId?: string; // Optional legacy IndexedDB mediaBlob reference (max 2MB)
  sectionLabels: Record<string, string>; // sectionId (plugin/core id) -> custom Persian label
  updatedByName: string;
  updatedByRole?: RoleId;
  updatedAt: string;
  createdAtIso?: string;
  updatedAtIso?: string;
}

// --- Phase 6: Integrated School Finance & Tuition ---

export type FinanceExtraFeeType = 'extracurricular' | 'transport' | 'books' | 'trip_activity';

export interface FinanceFeeExtraItem {
  id: string;
  type: FinanceExtraFeeType;
  title: string;
  amountToman: number;
  optional: boolean;
}

export interface FinanceFeePlan {
  id: string; // `${schoolId}:feeplan:grade-${gradeLevel}` or class-specific
  schoolId: string;
  academicYear: string;
  gradeLevel: 2 | 3 | 4 | 5 | 6;
  classId?: string;
  title: string;
  baseTuitionToman: number;
  extraItems: FinanceFeeExtraItem[];
  defaultInstallmentsCount: number; // 1..10
  updatedByName: string;
  updatedAt: string;
}

export type FinanceDiscountType = 'sibling' | 'talented' | 'staff_special';
export type FinanceDiscountMode = 'percent' | 'fixed';

export interface FinanceDiscountItem {
  id: string;
  type: FinanceDiscountType;
  title: string;
  mode: FinanceDiscountMode;
  value: number; // 0..100 if percent, or Toman amount if fixed
}

export type FinanceInstallmentStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface FinanceInstallmentItem {
  id: string;
  order: number;
  title: string; // e.g., «قسط اول - مهر»
  dueDateJalali: string; // YYYY/MM/DD
  amountToman: number;
  paidAmountToman: number;
  status: FinanceInstallmentStatus;
  paidDateJalali?: string;
}

export interface FinanceTripFeeItem {
  id: string;
  title: string; // e.g., «اردوی علمی باغ کتاب»
  dueDateJalali: string;
  amountToman: number;
  paidAmountToman: number;
  status: 'paid' | 'pending';
  paidDateJalali?: string;
  trackingCode?: string;
}

export interface FinanceStudentLedger {
  id: string; // `${schoolId}:ledger:${studentId}`
  schoolId: string;
  studentId: string;
  classId: string;
  academicYear: string;
  baseTuitionToman: number;
  selectedExtras: FinanceFeeExtraItem[];
  discounts: FinanceDiscountItem[];
  installments: FinanceInstallmentItem[];
  tripFees: FinanceTripFeeItem[];
  updatedAt: string;
}

export type FinancePaymentMethod = 'pos' | 'card_to_card' | 'cash' | 'cheque' | 'online_sim';
export type FinanceChequeStatus = 'cleared' | 'in_progress' | 'bounced';

export interface FinancePaymentRecord extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  receiptNumber: string; // e.g., F-1405-1001
  studentId: string;
  classId: string;
  ledgerId: string;
  targetType: 'tuition' | 'trip';
  installmentId?: string;
  tripFeeId?: string;
  targetTitle: string;
  amountToman: number;
  jalaliDate: string; // YYYY/MM/DD
  method: FinancePaymentMethod;
  chequeDueDateJalali?: string;
  chequeStatus?: FinanceChequeStatus;
  trackingCode: string;
  notes?: string;
  recordedBy: string;
  recordedByRole: RoleId;
  createdAt: string;
}

export type FinanceExpenseCategory =
  | 'salary'
  | 'rent_utilities'
  | 'equipment_repairs'
  | 'trips_catering'
  | 'office_supplies'
  | 'other';

export interface FinanceExpenseRecord extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  category: FinanceExpenseCategory;
  title: string;
  amountToman: number;
  jalaliDate: string; // YYYY/MM/DD
  voucherNumber: string;
  description: string;
  recordedBy: string;
  createdAt: string;
}

// --- Phase 6: Smart Analytics Remedial & Tutoring Plans ---

export type RemedialPlanStatus = 'planned' | 'in_progress' | 'improved';

export interface RemedialPlanRecord extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  subject: string;
  teacherId?: string;
  teacherName: string;
  reasons: string[];
  status: RemedialPlanStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Phase 6: Privacy-First Anonymous Surveys ---

export type SurveyAudienceRole = 'teacher' | 'parent' | 'student';
export type SurveyQuestionType = 'likert_5' | 'multiple_choice' | 'yes_no' | 'open_text';
export type SurveyStatus = 'active' | 'draft' | 'closed';

export interface SurveyQuestion {
  id: string;
  prompt: string;
  type: SurveyQuestionType;
  required: boolean;
  options?: string[]; // used for multiple_choice
}

export interface AnonymousSurvey extends SoftDeleteVersionFields {
  id: string;
  schoolId: string;
  /** Shared across 3 schools when complex_admin publishes simultaneously to all 3 schools */
  groupKey?: string;
  title: string;
  description: string;
  targetRoles: SurveyAudienceRole[];
  questions: SurveyQuestion[];
  startDateJalali: string;
  endDateJalali: string;
  minAnonymityThreshold: number; // default: 3
  status: SurveyStatus;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * STRICT PRIVACY-BY-DESIGN COLLECTION #1:
 * Stored ONLY to check whether the logged-in user already participated and prevent duplicate votes.
 * Never joined with survey_anonymous_responses.
 */
export interface SurveyParticipationReceipt {
  id: string; // `${schoolId}:receipt:${surveyId}:${participantKey}`
  schoolId: string;
  surveyId: string;
  participantKey: string; // opaque hash/key derived from session userId
  submittedDateJalali: string; // YYYY/MM/DD (day-level only)
}

export type SurveyCommentReviewStatus = 'new' | 'reviewed' | 'in_followup';

/**
 * STRICT PRIVACY-BY-DESIGN COLLECTION #2:
 * NEVER contains userId, studentId, fullName, phone, or exact-second timestamp!
 */
export interface SurveyAnonymousResponse {
  id: string; // random opaque ID, e.g., `anon-${random}`
  schoolId: string;
  surveyId: string;
  audienceRole: SurveyAudienceRole;
  answers: Record<string, string | number>; // questionId -> numeric likert (1..5) or option/yes_no/text
  openComment?: string;
  submittedDayBucket: string; // YYYY/MM/DD (day-level bucket only — no exact time)
  reviewStatus?: SurveyCommentReviewStatus;
  internalManagementNote?: string;
}

// --- Phase 7: Teacher Professional Development, Anti-Cheat Quizzes & 5-Tier Ranking ---

export type TeacherDevContentType = 'course' | 'book' | 'video_workshop';

export type TeacherDevRequirement = 'mandatory' | 'optional';

export type TeacherDevScope = 'school' | 'all';

export type TeacherDevCourseStatus = 'active' | 'archived';

export interface TeacherDevChapter {
  id: string;
  order: number;
  title: string;
  content: string;
  estimatedMinutes: number;
  externalUrl?: string;
  mediaAttachment?: MediaAttachmentRef;
}

export interface TeacherDevQuizOption {
  id: string; // Stable unique ID (e.g., opt-1..opt-4) so shuffling never breaks grading
  text: string;
}

export interface TeacherDevQuizQuestion {
  id: string;
  prompt: string;
  options: TeacherDevQuizOption[];
  correctOptionId: string;
}

export interface TeacherDevCourse {
  id: string;
  schoolId: string;
  scope: TeacherDevScope; // 'school' = active school only, 'all' = complex_admin published across all 3 schools
  groupKey?: string; // Shared across 3 schools when scope === 'all'
  title: string;
  description: string;
  contentType: TeacherDevContentType;
  requirement: TeacherDevRequirement;
  inServiceHours: number;
  deadlineJalali: string; // YYYY/MM/DD
  passingScorePercent: number; // default 70
  maxAttempts: number; // default 3
  shuffleOptions: boolean; // default true
  shuffleQuestions: boolean; // default true
  status: TeacherDevCourseStatus;
  chapters: TeacherDevChapter[];
  quizQuestions: TeacherDevQuizQuestion[];
  createdByName: string;
  createdByRole: RoleId;
  createdAtJalali: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherDevQuizAttempt {
  attemptNumber: number;
  seed: string;
  answers: Record<string, string>; // questionId -> selectedOptionId
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  passed: boolean;
  submittedAtJalali: string;
  submittedAtIso: string;
}

export type TeacherDevProgressStatus = 'not_started' | 'in_progress' | 'quiz_failed' | 'completed';

export interface TeacherDevProgress {
  id: string; // `${schoolId}:tdprog:${courseId}:${teacherId}`
  schoolId: string;
  courseId: string;
  teacherId: string;
  completedChapterIds: string[];
  attempts: TeacherDevQuizAttempt[];
  bestScorePercent?: number;
  status: TeacherDevProgressStatus;
  completedAtJalali?: string;
  completedAtIso?: string;
  certificateId?: string;
  updatedAt: string;
}

export interface TeacherDevCertificate {
  id: string; // `${schoolId}:tdcert:${courseId}:${teacherId}`
  schoolId: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
  courseTitle: string;
  contentType: TeacherDevContentType;
  requirement: TeacherDevRequirement;
  inServiceHours: number;
  scorePercent: number;
  issuedDateJalali: string;
  serialNumber: string; // e.g., TD-1405-S1-1001
  onTime: boolean;
  createdAt: string;
}

export type TeacherDevRankingPrivacyMode = 'public' | 'top3_only' | 'private';

export interface TeacherDevSchoolSettings {
  id: string; // `${schoolId}:tdsettings`
  schoolId: string;
  rankingPrivacyMode: TeacherDevRankingPrivacyMode;
  updatedByName: string;
  updatedAt: string;
}

// --- Phase 8A: Super Admin Governance, Dynamic Multi-Complex/School Engine & Login Studio ---

export interface EducationalComplex {
  id: string;
  schoolId: string; // '__global__' for uniform repository storage
  name: string;
  description?: string;
  logoDataUrl?: string;
  adminUserId: string;
  createdAtJalali: string;
  isActive: boolean;
  updatedAt: string;
}

export type ManagedAdminRole =
  | 'super_admin'
  | 'complex_admin'
  | 'principal'
  | 'deputy'
  | 'counselor';

export interface ManagedAdminAccount {
  id: string;
  schoolId: string; // '__global__' for super_admin/complex_admin, or specific schoolId for principal/deputy
  complexId?: string;
  role: ManagedAdminRole;
  fullName: string;
  username: string;
  password?: string; // Deprecated plaintext (stripped before persistence)
  passwordHash?: string; // PBKDF2/SHA-256 salted hash
  passwordSalt?: string;
  mustChangePassword?: boolean;
  isActive: boolean;
  createdAtJalali: string;
  updatedAt: string;
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface ModulePermissionSet {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
}

export type ManageableRoleId = Exclude<RoleId, 'super_admin'>;

export interface RoleGovernanceConfig {
  id: string; // `role-gov:${roleId}`
  schoolId: string; // '__global__'
  roleId: ManageableRoleId;
  displayTitleFa: string;
  shortTitleFa: string;
  descriptionFa: string;
  modulePermissions: Record<string, ModulePermissionSet>; // moduleId (plugin/core id) -> CRUD+export booleans
  updatedAt: string;
}

export type LoginBgPresetId =
  | 'classic_clean'
  | 'aurora_edu'
  | 'geometric_arch'
  | 'emerald_campus'
  | 'midnight_slate';

export interface LoginBackgroundConfig {
  mode: 'preset' | 'custom_image';
  presetId: LoginBgPresetId;
  customImageDataUrl?: string;
  customImageFileName?: string;
  customImageSizeKb?: number;
  loginLogoDataUrl?: string;
  blurPx: number; // 0..20
  overlayOpacity: number; // 0..80 (%)
  overlayTone: 'dark' | 'light';
}

export interface GlobalSystemConfig {
  id: string; // 'global-system-config'
  schoolId: string; // '__global__'
  labels: Record<string, string>; // global key -> custom Persian label
  systemLogoDataUrl?: string; // Main brand logo & dynamic favicon uploaded by super_admin
  systemLogoFileName?: string;
  loginBackground: LoginBackgroundConfig;
  /** Schools where super_admin explicitly granted principal read-only audit access to Counseling Layer-1 clinical notes */
  counselingPrincipalAuditSchoolIds?: string[];
  updatedBy?: string;
  updatedByName?: string;
  updatedAt: string;
}

export type SuperAdminAuditCategory =
  | 'permissions'
  | 'labels'
  | 'accounts'
  | 'complex_school'
  | 'login_studio'
  | 'impersonation';

export interface SuperAdminAuditEntry {
  id: string;
  schoolId: string; // '__global__'
  category: SuperAdminAuditCategory;
  actorName: string;
  summaryFa: string;
  detailsFa?: string;
  timestampJalali: string;
  timestampIso: string;
}

export interface ImpersonationState {
  targetRole: ManageableRoleId;
  targetDisplayName: string;
  targetUserId?: string;
  targetSchoolId?: string;
  targetComplexId?: string;
  startedAt: string;
}

// ============================================================================
// PHASE 9A: MULTI-ACADEMIC-YEAR ENGINE & ENTERPRISE MOCK / KONKUR EXAM SYSTEM
// Normalized relational DTOs ready for Phase 10 PostgreSQL / Prisma backend
// ============================================================================

export interface NormalizedRelationalDto extends SoftDeleteVersionFields {
  id: string;
  complexId: string;
  schoolId: string;
  academicYearId: string;
  createdByUserId: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export type AcademicYearStatus = 'active' | 'archived' | 'upcoming';

export interface AcademicYear extends NormalizedRelationalDto {
  code: string; // e.g. '1404-1405'
  title: string; // e.g. 'سال تحصیلی ۱۴۰۴-۱۴۰۵'
  label: string; // backward-compatible alias of code ('1404-1405')
  startDateJalali: string; // e.g. '1404/07/01'
  endDateJalali: string; // e.g. '1405/06/31'
  startJalali: string; // backward-compatible alias of startDateJalali
  endJalali: string; // backward-compatible alias of endDateJalali
  status: AcademicYearStatus;
  isDefault: boolean;
  isActive: boolean;
  isArchived: boolean;
}

// ============================================================================
// PHASE 9B: ADVANCED SIDA ANALYTICS ENGINE (NON-DESTRUCTIVE ADD-ON)
// ============================================================================

export type AppealTermType = 'monthly' | 'term1' | 'term2' | 'annual';

export type AppealWindowComputedStatus =
  | 'active_in_window'
  | 'waiting_to_start'
  | 'ended'
  | 'manually_disabled';

export interface SidaAppealWindowConfig extends NormalizedRelationalDto {
  term: AppealTermType;
  termLabelFa: string;
  masterEnabled: boolean;
  useSchedule: boolean;
  startDateJalali: string; // YYYY/MM/DD
  startTime: string; // HH:mm
  endDateJalali: string; // YYYY/MM/DD
  endTime: string; // HH:mm
  updatedByName: string;
}

export interface SidaRemedialGroupItem {
  id: string;
  name: string;
  levelLabelFa: string;
  studentIds: string[];
  averageScore: number;
}

export interface SidaRemedialGroupRecord extends NormalizedRelationalDto {
  classId?: string;
  subject: string;
  gradeLabel: string;
  passingThreshold: number;
  borderlineUpper: number;
  includeBorderline: boolean;
  maxCapacity: number;
  groups: SidaRemedialGroupItem[];
  savedByName: string;
}

export interface SidaBalancedClassBucket {
  id: string;
  name: string;
  studentIds: string[];
}

export interface SidaClassBalancingDraft extends NormalizedRelationalDto {
  targetGrade: number;
  targetYearCode: string;
  classCount: number;
  buckets: SidaBalancedClassBucket[];
  savedByName: string;
}

export interface SidaAnalyticsGradeRecord extends NormalizedRelationalDto {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  gradeNumber: number;
  subject: string;
  subjectCoefficient: number;
  /** Score on 0..20 scale for current period */
  score: number;
  /** Previous term score on 0..20 scale for growth leaderboard */
  previousScore: number;
  /** School internal/continuous score on 0..20 scale */
  schoolInternalScore: number;
  /** Coordinated final exam score on 0..20 scale (for final exam discrepancy analysis) */
  finalExamScore?: number;
  /** Student discipline score on 0..20 scale */
  disciplineScore: number;
  term: AppealTermType;
}

export type MockExamScope = 'school' | 'complex';

export type MockExamTrack =
  | 'general_elementary'
  | 'middle_school'
  | 'math_physics'
  | 'experimental_sciences'
  | 'humanities'
  | 'custom';

export type NegativeMarkingRule = 'three_to_one' | 'four_to_one' | 'none';

export type MockExamMode = 'online_full' | 'answer_key_only';

export type MockExamStatus = 'draft' | 'active' | 'published';

export type MockQuestionDifficulty = 'easy' | 'medium' | 'hard';

export type MockAnswerOption = 1 | 2 | 3 | 4;

export interface MockExamBooklet {
  id: string;
  title: string; // e.g. 'دفترچه اول — اختصاصی ۱'
  durationMinutes: number;
  orderIndex: number;
}

export interface MockExamSubject {
  id: string;
  bookletId: string;
  subjectName: string;
  questionStart: number;
  questionEnd: number;
  coefficient: number; // ضریب درس
}

export interface MockExamQuestion {
  questionNumber: number;
  subjectId: string;
  correctOption: MockAnswerOption;
  topic: string; // مبحث / فصل
  difficulty: MockQuestionDifficulty;
  questionText?: string;
  options?: [string, string, string, string];
  solutionText?: string; // پاسخ تشریحی
}

export interface MockExam extends NormalizedRelationalDto {
  title: string;
  stageNumber: number; // e.g. 1, 2, 3
  stageLabelFa: string; // e.g. 'مرحله ۳ - دی'
  examDateJalali: string;
  scope: MockExamScope; // 'school' or 'complex' (3-school coordinated)
  track: MockExamTrack;
  negativeMarking: NegativeMarkingRule;
  mode: MockExamMode;
  shuffleOptions: boolean;
  status: MockExamStatus;
  booklets: MockExamBooklet[];
  subjects: MockExamSubject[];
  questions: MockExamQuestion[];
}

export type MockAttemptEntryMethod = 'online' | 'paper_keyboard' | 'paper_csv';

export interface MockExamAttempt extends NormalizedRelationalDto {
  examId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  entryMethod: MockAttemptEntryMethod;
  status: 'in_progress' | 'submitted';
  answers: Record<number, MockAnswerOption | null>;
  flaggedQuestions: number[];
  eliminatedOptions: Record<number, MockAnswerOption[]>;
  tabSwitchCount: number;
  activeBookletIndex: number;
  startedAtIso: string;
  submittedAtJalali: string;
}

// ============================================================================
// LAYER-1 SECURITY AUDIT LOGS (Phase 10 Backend-Ready)
// ============================================================================

export type SecurityAuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'account_locked'
  | 'password_changed'
  | 'plugin_toggled'
  | 'user_created'
  | 'auto_logout_idle'
  | 'panic_mode_enabled'
  | 'panic_mode_disabled'
  | 'anti_wipe_triggered'
  | 'soft_delete_restored'
  | 'migration_executed'
  | 'backup_restored'
  | 'school_branding_updated'
  | 'smart_import_executed'
  | 'discipline_pledge_signed'
  | 'student_exit_logged'
  | 'counseling_clinical_viewed'
  | 'counseling_clinical_edited'
  | 'counseling_audit_access_toggled';

export interface SecurityAuditLogEntry extends NormalizedRelationalDto {
  eventType: SecurityAuditEventType;
  actorUserId?: string;
  actorUsername: string;
  actorName: string;
  actorRole?: RoleId;
  targetLabel?: string;
  summaryFa: string;
  detailsFa?: string;
  timestampJalali: string;
  timeHm: string;
  /** Tamper-evident SHA-256 chain link pointing to previous log entryHash (or 'GENESIS') */
  prevHash?: string;
  /** Tamper-evident SHA-256 digest computed over canonical entry fields + prevHash */
  entryHash?: string;
}

// ============================================================================
// STEP 3: SMART CONTENT ARCHIVE, ANNOUNCEMENTS, TRANSFERS, NOTIFICATIONS & RECOVERY
// ============================================================================

export type SmartArchiveContentType = 'video' | 'handout' | 'question';

export interface SmartContentArchiveItem extends NormalizedRelationalDto {
  title: string;
  contentType: SmartArchiveContentType;
  subject: string;
  gradeLevel: number;
  gradeLabel: string;
  teacherId: string;
  teacherName: string;
  description: string;
  url?: string;
  attachmentName?: string;
  tags: string[];
  sourceClassId?: string;
  sourceEntityId?: string;
  reuseCount: number;
  reusedInClassIds: string[];
  createdAtJalali: string;
}

export type SchoolAnnouncementScope = 'school' | 'class' | 'subject';

export interface SchoolAnnouncement extends NormalizedRelationalDto {
  title: string;
  body: string;
  scope: SchoolAnnouncementScope;
  classId?: string;
  subject?: string;
  audienceRoles: RoleId[];
  pinned?: boolean;
  authorName: string;
  authorRole: RoleId;
  publishedAtJalali: string;
}

export interface StudentTransferLog extends NormalizedRelationalDto {
  studentId: string;
  studentName: string;
  fromClassId: string;
  fromClassName: string;
  toClassId: string;
  toClassName: string;
  transferDateJalali: string;
  reason: string;
  performedByName: string;
  performedByRole: RoleId;
  preservedGradesCount: number;
  preservedAttendanceCount: number;
}

export interface NotificationReadReceipt extends NormalizedRelationalDto {
  userId: string;
  notificationKey: string;
  readAtIso: string;
}

export type SelectiveResetModuleKey =
  | 'homework'
  | 'attendance'
  | 'messages'
  | 'archive'
  | 'announcements_settings';

export interface RecoverySnapshotRecord extends NormalizedRelationalDto {
  moduleKey: SelectiveResetModuleKey | 'full_school';
  moduleLabelFa: string;
  reasonFa: string;
  createdByName: string;
  createdByRole: RoleId;
  createdAtJalali: string;
  affectedCount: number;
  payloadJson: string;
}

// ============================================================================
// STEP 3-B: DATA VAULT, CHUNKED MIGRATION ENGINE, SOFT DELETE & INTEGRITY GUARD
// ============================================================================

export interface MigrationHistoryEntry {
  id: string;
  fromVersion: number;
  toVersion: number;
  status: 'succeeded' | 'rolled_back';
  processedRecords: number;
  normalizedRecords: number;
  chunkSize: number;
  durationMs: number;
  executedAtJalali: string;
  executedAtIso: string;
  executedByName: string;
  summaryFa: string;
  errorDetailFa?: string;
}

export interface MigrationVaultMeta {
  schemaVersion: number;
  lastMigratedAtIso?: string;
  lastMigratedAtJalali?: string;
  preMigrationSnapshotAtIso?: string;
  history: MigrationHistoryEntry[];
}

export type PanicModeScope = 'all_schools' | 'selected_schools';

export interface PanicModeState {
  enabled: boolean;
  scope: PanicModeScope;
  lockedSchoolIds: string[];
  reasonFa: string;
  activatedByUserId: string;
  activatedByName: string;
  activatedAtJalali: string;
  activatedAtIso: string;
}

export interface SoftDeletedRecordEntry {
  id: string;
  collection: CollectionName;
  collectionLabelFa: string;
  schoolId: string;
  titleFa: string;
  subtitleFa?: string;
  recordVersion: number;
  deletedAtIso: string;
  deletedAtJalali: string;
  deletedAtTimeHm: string;
  deletedByUserId: string;
  deletedByName: string;
}

export type ReferentialIntegritySeverity = 'critical' | 'warning';

export interface ReferentialIntegrityIssue {
  id: string;
  collection: CollectionName;
  collectionLabelFa: string;
  recordId: string;
  schoolId: string;
  severity: ReferentialIntegritySeverity;
  reasonFa: string;
}

export interface ReferentialIntegrityReport {
  status: 'green' | 'amber' | 'red';
  checkedAtJalali: string;
  checkedAtIso: string;
  totalRecordsChecked: number;
  orphanCount: number;
  warningCount: number;
  collectionStats: Array<{
    collection: CollectionName;
    labelFa: string;
    total: number;
    issues: number;
  }>;
  issues: ReferentialIntegrityIssue[];
}

export type MigrationBundleScope = 'complex_wide' | 'single_school' | 'academic_year';

export interface SealedMigrationBundle {
  bundleFormat: 'golestan_phase10_migration_bundle';
  schemaVersion: number;
  scope: MigrationBundleScope;
  schoolId?: string;
  schoolName?: string;
  academicYearId?: string;
  exportedAtJalali: string;
  exportedAtIso: string;
  exportedByName: string;
  totalRecords: number;
  recordCounts: Record<string, number>;
  /** Native SHA-256 hex signature over canonical bundle metadata + data */
  sha256Signature: string;
  data: Partial<Record<CollectionName, unknown[]>>;
}

export interface MigrationBundleVerificationResult {
  valid: boolean;
  tampered: boolean;
  errorFa?: string;
  bundle?: SealedMigrationBundle;
  previewSummary?: {
    scopeLabelFa: string;
    targetLabelFa: string;
    totalRecords: number;
    nonEmptyCollections: Array<{
      collection: CollectionName;
      labelFa: string;
      count: number;
    }>;
  };
}

export interface DailyRollingSnapshot {
  id: string;
  jalaliDate: string;
  createdAtIso: string;
  createdAtTimeHm: string;
  trigger: 'auto_daily' | 'manual' | 'pre_restore_undo';
  labelFa: string;
  schemaVersion: number;
  totalRecords: number;
  sha256Signature: string;
  payloadJson: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  legacyUnchainedCount: number;
  corruptedEntries: Array<{
    index: number;
    id: string;
    timestampJalali: string;
    reasonFa: string;
  }>;
  headHash: string | null;
  checkedAtJalali: string;
  checkedAtIso: string;
}

// ============================================================================
// STEP 3-C: SMART TABLE MAPPING & AUTO COLUMN MATCHING WIZARD TEMPLATES
// ============================================================================

export interface ImportMappingTemplate extends NormalizedRelationalDto {
  nameFa: string;
  targetType: 'students' | 'teachers' | 'classes' | 'sida_grades';
  isComplexWide: boolean;
  createdByName: string;
  headerMap: Record<string, string>;
  splitFullName: boolean;
  missingPolicies: Record<string, { mode: string; defaultValue: string } | undefined>;
}

// ============================================================================
// PHASE 9-C: DISCIPLINE, LEAVE & EXIT PASSES, CONFIDENTIAL COUNSELING & VIRTUAL CLASS HUB
// ============================================================================

export interface Phase9CRelationalBase extends SoftDeleteVersionFields {
  id: string;
  complexId: string;
  schoolId: string;
  academicYearId: string;
  createdByUserId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export type DisciplineRecordKind = 'reward' | 'infraction';
export type DisciplineSeverity = 'minor' | 'moderate' | 'critical';
export type DisciplinePledgeStatus = 'pending_parent' | 'signed_digital' | 'signed_in_person';

export interface DisciplineRecord extends Phase9CRelationalBase {
  studentId: string;
  classId: string;
  kind: DisciplineRecordKind;
  severity: DisciplineSeverity;
  category: string;
  title: string;
  description: string;
  jalaliDate: string;
  pointsDelta: number; // Magnitude; sign determined by kind ('reward' adds, 'infraction' subtracts)
  visibleToParentStudent: boolean;
  recordedByUserId: string;
  recordedByName: string;
  recordedByRole: RoleId;
}

export interface DisciplinePledge extends Phase9CRelationalBase {
  studentId: string;
  classId: string;
  relatedRecordId?: string;
  title: string;
  bodyText: string;
  issuedAtJalali: string;
  issuedByUserId: string;
  issuedByName: string;
  status: DisciplinePledgeStatus;
  parentSignedAtJalali?: string;
  parentSignedAtIso?: string;
  parentSignedByName?: string;
  parentSignatureNote?: string;
}

export type StudentExitReason = 'medical' | 'administrative' | 'family';
export type StudentExitStatus =
  | 'requested'
  | 'approved'
  | 'exited'
  | 'returned'
  | 'rejected';

export interface StudentExitPass extends Phase9CRelationalBase {
  trackingCode: string;
  studentId: string;
  classId: string;
  jalaliDate: string;
  reasonCategory: StudentExitReason;
  reasonDetail?: string;
  plannedExitTimeHm: string;
  expectedReturnTimeHm?: string;
  pickupPersonName: string;
  pickupRelation: 'پدر' | 'مادر' | 'سرویس' | 'سایر';
  pickupNationalId?: string;
  parentVerified: boolean;
  requestedByRole: RoleId;
  requestedByName: string;
  approvedByName?: string;
  status: StudentExitStatus;
  actualExitTimeHm?: string;
  actualExitAtIso?: string;
  actualReturnTimeHm?: string;
  actualReturnAtIso?: string;
  securityGuardNote?: string;
}

export type StaffLeaveType = 'hourly' | 'daily';
export type StaffLeaveStatus = 'pending' | 'approved' | 'rejected';

export interface StaffLeaveRequest extends Phase9CRelationalBase {
  staffUserId: string;
  staffName: string;
  staffRole: RoleId;
  linkedTeacherId?: string;
  leaveType: StaffLeaveType;
  jalaliDate: string;
  startTimeHm?: string;
  endTimeHm?: string;
  durationHours?: number;
  reason: string;
  suggestedSubstituteTeacherId?: string;
  suggestedSubstituteTeacherName?: string;
  status: StaffLeaveStatus;
  reviewedByName?: string;
  reviewedAtJalali?: string;
  principalReviewNote?: string;
}

export type CounselingSessionMode = 'in_person' | 'phone' | 'online';
export type CounselingSessionStatus =
  | 'requested'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

export interface CounselingSession extends Phase9CRelationalBase {
  studentId: string;
  classId: string;
  jalaliDate: string;
  timeHm: string;
  mode: CounselingSessionMode;
  status: CounselingSessionStatus;
  requestedByRole: RoleId;
  requestedByName: string;
  isReferral: boolean;
  referredByUserId?: string;
  referralReason?: string;
  counselorUserId?: string;
  counselorName?: string;
  followUpDateJalali?: string;
  // Layer 2 (Non-confidential shared recommendations)
  sharedAdviceText?: string;
  shareWithParent: boolean;
  shareWithTeacher: boolean;
}

export type ClinicalRiskLevel = 'low' | 'medium' | 'high';

/**
 * Layer 1 STRICTLY CONFIDENTIAL clinical counseling record.
 * Never exposed to teacher, parent, student, deputy, or complex_admin.
 */
export interface CounselingClinicalNote extends Phase9CRelationalBase {
  sessionId: string;
  studentId: string;
  counselorUserId: string;
  counselorName: string;
  clinicalSummary: string;
  riskLevel: ClinicalRiskLevel;
  privateActionPlan?: string;
  lastUpdatedAtJalali: string;
}

export type VirtualClassPlatform =
  | 'skyroom'
  | 'adobe_connect'
  | 'bigbluebutton'
  | 'shad'
  | 'google_meet'
  | 'custom';

export interface VirtualClassSession extends Phase9CRelationalBase {
  title: string;
  classId: string;
  subject: string;
  teacherId?: string;
  teacherName: string;
  platform: VirtualClassPlatform;
  joinUrl: string;
  jalaliDate: string;
  startTimeHm: string; // HH:MM
  durationMinutes: number;
  description?: string;
  recordingUrl?: string;
  recordingTitle?: string;
  handoutUrl?: string;
  handoutTitle?: string;
}

export interface VirtualClassAttendance extends Phase9CRelationalBase {
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  joinedAtIso: string;
  joinedAtJalali: string;
  joinedAtTimeHm: string;
}

export type CollectionName =
  | 'schools'
  | 'classes'
  | 'students'
  | 'teachers'
  | 'schedules'
  | 'student_attendance'
  | 'staff_attendance'
  | 'substitutions'
  | 'daily_logs'
  | 'school_plugin_states'
  | 'curriculum_topics'
  | 'media_resources'
  | 'chat_outbox'
  | 'gradebook_entries'
  | 'lesson_plans'
  | 'gradebook_weights'
  | 'grade_appeals'
  | 'homework_assignments'
  | 'homework_submissions'
  | 'student_rewards'
  | 'question_bank'
  | 'class_chat_draft_queue'
  | 'exam_question_basket'
  | 'flipped_lessons'
  | 'flipped_telemetry'
  | 'flipped_questions'
  | 'online_class_sessions'
  | 'online_class_attendance'
  | 'online_exams'
  | 'online_exam_submissions'
  | 'student_360_signals'
  | 'parent_staff_messages'
  | 'class_chat_rooms'
  | 'class_chat_messages'
  | 'appointment_slots'
  | 'electronic_forms'
  | 'electronic_form_responses'
  | 'notification_templates'
  | 'sida_grade_audit_logs'
  | 'in_person_exam_halls'
  | 'in_person_exam_sessions'
  | 'exam_seating_charts'
  | 'student_profiles'
  | 'staff_profiles'
  | 'sida_speed_entry_ticks'
  | 'user_appearance_prefs'
  | 'school_branding_configs'
  | 'finance_fee_plans'
  | 'finance_student_ledgers'
  | 'finance_payments'
  | 'finance_expenses'
  | 'remedial_plans'
  | 'anonymous_surveys'
  | 'survey_participation_receipts'
  | 'survey_anonymous_responses'
  | 'td_courses'
  | 'td_progress'
  | 'td_certificates'
  | 'td_school_settings'
  | 'educational_complexes'
  | 'managed_admin_accounts'
  | 'role_governance_configs'
  | 'global_system_configs'
  | 'super_admin_audit_logs'
  | 'academic_years'
  | 'mock_exams'
  | 'mock_exam_attempts'
  | 'sida_appeal_windows'
  | 'sida_remedial_groups'
  | 'sida_class_balancing_drafts'
  | 'sida_analytics_grades'
  | 'security_audit_logs'
  | 'smart_content_archive'
  | 'school_announcements'
  | 'student_transfer_logs'
  | 'notification_read_receipts'
  | 'recovery_snapshots'
  | 'import_mapping_templates'
  | 'discipline_records'
  | 'discipline_pledges'
  | 'student_exit_passes'
  | 'staff_leave_requests'
  | 'counseling_sessions'
  | 'counseling_clinical_notes'
  | 'virtual_class_sessions'
  | 'virtual_class_attendance';

export interface CollectionTypeMap {
  schools: School;
  classes: ClassRoom;
  students: Student;
  teachers: Teacher;
  schedules: ScheduleSlot;
  student_attendance: StudentAttendanceRecord;
  staff_attendance: StaffAttendanceRecord;
  substitutions: SubstitutionRecord;
  daily_logs: DailyLogEntry;
  school_plugin_states: SchoolPluginState;
  curriculum_topics: CurriculumTopic;
  media_resources: MediaResource;
  chat_outbox: ChatOutboxItem;
  gradebook_entries: GradebookEntry;
  lesson_plans: LessonPlanRecord;
  gradebook_weights: GradebookWeightConfig;
  grade_appeals: GradeAppeal;
  homework_assignments: HomeworkAssignment;
  homework_submissions: HomeworkSubmission;
  student_rewards: StudentReward;
  question_bank: QuestionBankItem;
  class_chat_draft_queue: ClassChatDraftItem;
  exam_question_basket: ExamBasketItem;
  flipped_lessons: FlippedVideoLesson;
  flipped_telemetry: FlippedVideoTelemetry;
  flipped_questions: FlippedTimestampQuestion;
  online_class_sessions: OnlineClassSession;
  online_class_attendance: OnlineClassAttendanceRecord;
  online_exams: OnlineExam;
  online_exam_submissions: OnlineExamSubmission;
  student_360_signals: Student360Signal;
  parent_staff_messages: ParentStaffMessage;
  class_chat_rooms: ClassChatRoomConfig;
  class_chat_messages: ClassChatMessage;
  appointment_slots: AppointmentSlot;
  electronic_forms: ElectronicForm;
  electronic_form_responses: ElectronicFormResponse;
  notification_templates: NotificationTemplate;
  sida_grade_audit_logs: SidaGradeAuditLog;
  in_person_exam_halls: InPersonExamHall;
  in_person_exam_sessions: InPersonExamSession;
  exam_seating_charts: ExamSeatingChart;
  student_profiles: StudentElectronicProfile;
  staff_profiles: StaffElectronicProfile;
  sida_speed_entry_ticks: SidaSpeedEntryRecord;
  user_appearance_prefs: UserAppearancePreference;
  school_branding_configs: SchoolBrandingConfig;
  finance_fee_plans: FinanceFeePlan;
  finance_student_ledgers: FinanceStudentLedger;
  finance_payments: FinancePaymentRecord;
  finance_expenses: FinanceExpenseRecord;
  remedial_plans: RemedialPlanRecord;
  anonymous_surveys: AnonymousSurvey;
  survey_participation_receipts: SurveyParticipationReceipt;
  survey_anonymous_responses: SurveyAnonymousResponse;
  td_courses: TeacherDevCourse;
  td_progress: TeacherDevProgress;
  td_certificates: TeacherDevCertificate;
  td_school_settings: TeacherDevSchoolSettings;
  educational_complexes: EducationalComplex;
  managed_admin_accounts: ManagedAdminAccount;
  role_governance_configs: RoleGovernanceConfig;
  global_system_configs: GlobalSystemConfig;
  super_admin_audit_logs: SuperAdminAuditEntry;
  academic_years: AcademicYear;
  mock_exams: MockExam;
  mock_exam_attempts: MockExamAttempt;
  sida_appeal_windows: SidaAppealWindowConfig;
  sida_remedial_groups: SidaRemedialGroupRecord;
  sida_class_balancing_drafts: SidaClassBalancingDraft;
  sida_analytics_grades: SidaAnalyticsGradeRecord;
  security_audit_logs: SecurityAuditLogEntry;
  smart_content_archive: SmartContentArchiveItem;
  school_announcements: SchoolAnnouncement;
  student_transfer_logs: StudentTransferLog;
  notification_read_receipts: NotificationReadReceipt;
  recovery_snapshots: RecoverySnapshotRecord;
  import_mapping_templates: ImportMappingTemplate;
  discipline_records: DisciplineRecord;
  discipline_pledges: DisciplinePledge;
  student_exit_passes: StudentExitPass;
  staff_leave_requests: StaffLeaveRequest;
  counseling_sessions: CounselingSession;
  counseling_clinical_notes: CounselingClinicalNote;
  virtual_class_sessions: VirtualClassSession;
  virtual_class_attendance: VirtualClassAttendance;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  scope: 'single_school' | 'complex_wide';
  schoolId?: string;
  data: {
    schools: School[];
    classes: ClassRoom[];
    students: Student[];
    teachers: Teacher[];
    schedules: ScheduleSlot[];
    student_attendance: StudentAttendanceRecord[];
    staff_attendance: StaffAttendanceRecord[];
    substitutions: SubstitutionRecord[];
    daily_logs: DailyLogEntry[];
    school_plugin_states: SchoolPluginState[];
    curriculum_topics: CurriculumTopic[];
    media_resources: MediaResource[];
    chat_outbox: ChatOutboxItem[];
    gradebook_entries: GradebookEntry[];
    lesson_plans: LessonPlanRecord[];
    gradebook_weights: GradebookWeightConfig[];
    grade_appeals: GradeAppeal[];
    homework_assignments: HomeworkAssignment[];
    homework_submissions: HomeworkSubmission[];
    student_rewards: StudentReward[];
    question_bank?: QuestionBankItem[];
    class_chat_draft_queue?: ClassChatDraftItem[];
    exam_question_basket?: ExamBasketItem[];
    flipped_lessons?: FlippedVideoLesson[];
    flipped_telemetry?: FlippedVideoTelemetry[];
    flipped_questions?: FlippedTimestampQuestion[];
    online_class_sessions?: OnlineClassSession[];
    online_class_attendance?: OnlineClassAttendanceRecord[];
    online_exams?: OnlineExam[];
    online_exam_submissions?: OnlineExamSubmission[];
    student_360_signals?: Student360Signal[];
    parent_staff_messages?: ParentStaffMessage[];
    class_chat_rooms?: ClassChatRoomConfig[];
    class_chat_messages?: ClassChatMessage[];
    appointment_slots?: AppointmentSlot[];
    electronic_forms?: ElectronicForm[];
    electronic_form_responses?: ElectronicFormResponse[];
    notification_templates?: NotificationTemplate[];
    sida_grade_audit_logs?: SidaGradeAuditLog[];
    in_person_exam_halls?: InPersonExamHall[];
    in_person_exam_sessions?: InPersonExamSession[];
    exam_seating_charts?: ExamSeatingChart[];
    student_profiles?: StudentElectronicProfile[];
    staff_profiles?: StaffElectronicProfile[];
    sida_speed_entry_ticks?: SidaSpeedEntryRecord[];
    user_appearance_prefs?: UserAppearancePreference[];
    school_branding_configs?: SchoolBrandingConfig[];
    finance_fee_plans?: FinanceFeePlan[];
    finance_student_ledgers?: FinanceStudentLedger[];
    finance_payments?: FinancePaymentRecord[];
    finance_expenses?: FinanceExpenseRecord[];
    remedial_plans?: RemedialPlanRecord[];
    anonymous_surveys?: AnonymousSurvey[];
    survey_participation_receipts?: SurveyParticipationReceipt[];
    survey_anonymous_responses?: SurveyAnonymousResponse[];
    td_courses?: TeacherDevCourse[];
    td_progress?: TeacherDevProgress[];
    td_certificates?: TeacherDevCertificate[];
    td_school_settings?: TeacherDevSchoolSettings[];
    educational_complexes?: EducationalComplex[];
    managed_admin_accounts?: ManagedAdminAccount[];
    role_governance_configs?: RoleGovernanceConfig[];
    global_system_configs?: GlobalSystemConfig[];
    super_admin_audit_logs?: SuperAdminAuditEntry[];
    academic_years?: AcademicYear[];
    mock_exams?: MockExam[];
    mock_exam_attempts?: MockExamAttempt[];
    sida_appeal_windows?: SidaAppealWindowConfig[];
    sida_remedial_groups?: SidaRemedialGroupRecord[];
    sida_class_balancing_drafts?: SidaClassBalancingDraft[];
    sida_analytics_grades?: SidaAnalyticsGradeRecord[];
    security_audit_logs?: SecurityAuditLogEntry[];
    smart_content_archive?: SmartContentArchiveItem[];
    school_announcements?: SchoolAnnouncement[];
    student_transfer_logs?: StudentTransferLog[];
    notification_read_receipts?: NotificationReadReceipt[];
    recovery_snapshots?: RecoverySnapshotRecord[];
    import_mapping_templates?: ImportMappingTemplate[];
    discipline_records?: DisciplineRecord[];
    discipline_pledges?: DisciplinePledge[];
    student_exit_passes?: StudentExitPass[];
    staff_leave_requests?: StaffLeaveRequest[];
    counseling_sessions?: CounselingSession[];
    counseling_clinical_notes?: CounselingClinicalNote[];
    virtual_class_sessions?: VirtualClassSession[];
    virtual_class_attendance?: VirtualClassAttendance[];
  };
}
