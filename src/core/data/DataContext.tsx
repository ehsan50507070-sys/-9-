// Central Multi-School State, Real Session Management, Strict End-to-End RBAC & Non-Destructive Plugin Provider
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getNearestActiveWorkday, getTodayJalali } from '../../lib/jalali';
import type {
  AcademicYear,
  AnonymousSurvey,
  AppointmentSlot,
  AuthSession,
  BackupPayload,
  ChatOutboxItem,
  ClassChatDraftItem,
  ClassChatMessage,
  ClassChatPoll,
  ClassChatRoomConfig,
  ClassChatRoomMode,
  ClassRoom,
  CurriculumTopic,
  DailyLogEntry,
  DescriptiveLevel,
  ElectronicForm,
  ElectronicFormResponse,
  ExamBasketItem,
  ExamSeatingChart,
  FinanceExpenseRecord,
  FinanceFeePlan,
  FinancePaymentRecord,
  FinanceStudentLedger,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
  FlippedVideoTelemetry,
  GradeAppeal,
  GradebookEntry,
  GradebookWeightConfig,
  HomeworkAssignment,
  HomeworkSubmission,
  InPersonExamHall,
  InPersonExamSession,
  JalaliAcademicMonth,
  LessonPlanRecord,
  MediaResource,
  MockExam,
  MockExamAttempt,
  NotificationTemplate,
  OnlineClassAttendanceRecord,
  OnlineClassSession,
  OnlineExam,
  OnlineExamSubmission,
  ParentChatChannelType,
  ParentStaffMessage,
  QuestionBankItem,
  RemedialPlanRecord,
  RoleId,
  ScheduleSlot,
  School,
  SchoolBrandingConfig,
  SchoolPluginState,
  SecurityAuditEventType,
  SecurityAuditLogEntry,
  SidaAnalyticsGradeRecord,
  SidaAppealWindowConfig,
  SidaClassBalancingDraft,
  SidaGradeAuditLog,
  SidaRemedialGroupRecord,
  SidaSpeedEntryRecord,
  StaffAttendanceRecord,
  StaffElectronicProfile,
  Student,
  Student360Signal,
  StudentAttendanceRecord,
  StudentElectronicProfile,
  StudentReward,
  SubstitutionRecord,
  SurveyAnonymousResponse,
  SurveyAudienceRole,
  SurveyCommentReviewStatus,
  SurveyParticipationReceipt,
  Teacher,
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevProgress,
  TeacherDevQuizAttempt,
  TeacherDevRankingPrivacyMode,
  TeacherDevSchoolSettings,
  UserAppearancePreference,
  EducationalComplex,
  GlobalSystemConfig,
  ImpersonationState,
  LoginBackgroundConfig,
  ManagedAdminAccount,
  RoleGovernanceConfig,
  SchoolGradeLevel,
  SuperAdminAuditCategory,
  SuperAdminAuditEntry,
  SmartContentArchiveItem,
  SchoolAnnouncement,
  StudentTransferLog,
  NotificationReadReceipt,
  RecoverySnapshotRecord,
  SelectiveResetModuleKey,
  CollectionName,
  DailyRollingSnapshot,
  MigrationBundleScope,
  MigrationBundleVerificationResult,
  MigrationVaultMeta,
  PanicModeScope,
  PanicModeState,
  ReferentialIntegrityReport,
  SealedMigrationBundle,
  SoftDeletedRecordEntry,
  ImportMappingTemplate,
  AppealTermType,
  SidaEnrollmentStatus,
  DisciplineRecord,
  DisciplinePledge,
  StudentExitPass,
  StaffLeaveRequest,
  CounselingSession,
  CounselingClinicalNote,
  VirtualClassSession,
  VirtualClassAttendance,
} from '../../types/domain';
import { canViewClinicalLayer1 } from '../../services/phase9c/counselingService';
import type { ExistingSchoolLookup } from '../../services/smartImport/importPipeline';
import { SMART_IMPORT_TARGET_LABELS_FA } from '../../services/smartImport/columnMatcher';
import { normalizePersianText } from '../../services/smartImport/iranianValidators';
import type {
  SmartImportCommitPayload,
  SmartImportCommitReceipt,
} from '../../services/smartImport/types';
import {
  applyGranularBundleToDataset,
  buildDailyRollingSnapshot,
  createSealedMigrationBundle,
  DEFAULT_PANIC_MODE_STATE,
  isRecordSoftDeleted,
  isSchoolUnderPanicLock,
  runReferentialIntegrityCheck,
  sharedAntiWipeBreaker,
  verifyAndPreviewMigrationBundle,
} from '../security/DataIntegrityGuard';
import {
  CURRENT_SCHEMA_VERSION,
  runChunkedMigration,
  type ChunkedMigrationResult,
  type MigrationProgressState,
} from '../storage/MigrationEngine';
import {
  computeInternalNotifications,
  type ComputedNotificationCenterState,
} from '../notifications/notificationHelpers';
import {
  getSelectiveResetModuleMeta,
  parseModuleSnapshot,
  serializeModuleSnapshot,
} from '../settings/recoveryHelpers';
import {
  applyLeaderboardPrivacy,
  buildSchoolLeaderboard,
  generateCertificateSerial,
  gradeTeacherQuizAttempt,
  isOnTimeCompletion,
  isQuizUnlocked,
  type PrivacyFilteredLeaderboard,
} from '../../plugins/teacher-development/teacherDevHelpers';
import { scoreToDescriptiveLevel } from '../../plugins/gradebook/gradebookHelpers';
import { canBookAppointmentSlot } from '../../plugins/appointments/appointmentsHelpers';
import {
  applyPollVote,
  canUserPostInClassRoom,
  getClassChatChannelName,
} from '../../plugins/class-chat/classChatHelpers';
import {
  computeUnreadParentChatCount,
  filterMessagesForRole,
  getParentChatChannelName,
} from '../../plugins/parent-staff-chat/parentChatHelpers';
import {
  authenticateUserAsync,
  ensureManagedAdminAccountHashed,
  ensureStudentDualCredentials,
  ensureTeacherHashed,
  loadStoredSession,
  saveStoredSession,
  updateUserPasswordAsync,
  verifyUserPasswordAsync,
  type LoginAttemptInput,
  type LoginResult,
} from '../auth/authService';
import {
  authorizeBackupOperation,
  authorizeMutation,
  type AuthGuardContext,
} from '../auth/policy';
import { ROLE_DEFINITIONS, type RoleDefinition } from '../auth/rbac';
import { syncBrowserFaviconAndTitle } from '../branding/BrandLogo';
import { hashPasswordSync } from '../security/cryptoService';
import {
  generateUUID,
  sanitizeText,
  sanitizeUrl,
  validateNonPersianUsername,
  validateStrongPassword,
} from '../security/sanitize';
import { deleteMediaBlob } from './mediaBlobStore';
import {
  buildPluginRuntimeStatuses,
  computeStudentAttendanceSummary,
  createPluginStateTransition,
  type CollectionCountMap,
} from '../plugins/pluginHelpers';
import type { PluginManifest, PluginRuntimeStatus } from '../plugins/types';
import {
  buildDefaultRoleGovernanceConfigs,
  clampLoginBackgroundConfig,
  createAuditEntry,
  createDefaultLoginBackgroundConfig,
  createNewComplexBundle,
  createNewSchoolBundle,
  getVisibleSchoolsForSession,
  GLOBAL_TENANT_ID,
} from '../super-admin/superAdminHelpers';
import { ALL_COLLECTIONS, sharedRepository } from './LocalIndexedDBAdapter';
import type { StorageBackendMode } from './repository';
import { DEFAULT_ENABLED_PLUGIN_IDS, type SeedDataset } from './seedData';

const UI_PREFS_KEY = 'smart_school_ui_prefs_v1';

interface UiPrefs {
  activeSchoolId: string;
  darkMode: boolean;
}

function loadUiPrefs(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(UI_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiPrefs>;
      return {
        activeSchoolId: parsed.activeSchoolId || 'school-1',
        darkMode: Boolean(parsed.darkMode),
      };
    }
  } catch {
    // fallback
  }
  return {
    activeSchoolId: 'school-1',
    darkMode: false,
  };
}

function saveUiPrefs(prefs: UiPrefs): void {
  try {
    window.localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota
  }
}

/**
 * Step 3-B: Produces the active (non-soft-deleted) view of the repository dataset
 * so normal UI views never show soft-deleted items while Recycle Bin & Backups keep them intact.
 */
function buildActiveViewDataset(raw: SeedDataset): SeedDataset {
  const next = { ...raw };
  for (const col of ALL_COLLECTIONS) {
    if (col === 'security_audit_logs' || col === 'recovery_snapshots') continue;
    const list = raw[col] as unknown[];
    if (Array.isArray(list)) {
      (next as unknown as Record<CollectionName, unknown[]>)[col] = list.filter(
        (item) => !isRecordSoftDeleted(item)
      );
    }
  }
  return next;
}

export interface SchoolComparisonRow {
  school: School;
  studentCount: number;
  teacherCount: number;
  classCount: number;
  presentRatePercent: number;
  absentStudentsToday: number;
  pendingSubstitutionsToday: number;
  dailyLogsCount: number;
  enabledAddonsCount: number;
}

export interface SearchFocusTarget {
  schoolId: string;
  classId: string;
  studentId?: string;
  studentName?: string;
  timestamp: number;
}

export interface SmartSearchCatalog {
  canSearchAllSchools: boolean;
  schools: School[];
  students: Student[];
  classes: ClassRoom[];
  teachers: Teacher[];
}

export interface MutationResult {
  ok: boolean;
  errorFa?: string;
}

export interface ComplexPhase6Dataset {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  gradebookEntries: GradebookEntry[];
  studentAttendance: StudentAttendanceRecord[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  flippedTelemetry: FlippedVideoTelemetry[];
  remedialPlans: RemedialPlanRecord[];
  financeLedgers: FinanceStudentLedger[];
  financePayments: FinancePaymentRecord[];
  financeExpenses: FinanceExpenseRecord[];
  anonymousSurveys: AnonymousSurvey[];
  surveyAnonymousResponses: SurveyAnonymousResponse[];
  surveyParticipationReceipts: SurveyParticipationReceipt[];
}

export interface ComplexPhase7Dataset {
  schools: School[];
  teachers: Teacher[];
  tdCourses: TeacherDevCourse[];
  tdProgress: TeacherDevProgress[];
  tdCertificates: TeacherDevCertificate[];
  tdSchoolSettings: TeacherDevSchoolSettings[];
}

export interface TeacherDevQuizSubmissionResult extends MutationResult {
  scorePercent?: number;
  correctCount?: number;
  totalQuestions?: number;
  passed?: boolean;
  certificate?: TeacherDevCertificate;
}

interface DataContextValue {
  backendMode: StorageBackendMode;
  isOnline: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkModeDirect: (enabled: boolean) => void;
  changeOwnLocalPassword: (currentPassword: string, newPassword: string) => Promise<MutationResult>;
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<MutationResult>;

  // Authentication & Session
  session: AuthSession | null;
  realSession: AuthSession | null;
  impersonation: ImpersonationState | null;
  startImpersonation: (target: Omit<ImpersonationState, 'startedAt'>) => MutationResult;
  stopImpersonation: () => void;
  login: (input: LoginAttemptInput) => Promise<LoginResult>;
  logout: () => void;
  linkedStudent: Student | null;
  linkedTeacher: Teacher | null;
  teacherAssignedClassIds: string[];

  // Multi-Complex, Multi-School & Role
  allSchools: School[];
  schools: School[];
  activeSchoolId: string;
  activeSchool: School;
  setActiveSchoolId: (schoolId: string) => void;

  activeRole: RoleId;
  roleDef: RoleDefinition;

  // Phase 8A Super Admin Governance Datasets
  educationalComplexes: EducationalComplex[];
  managedAdminAccounts: ManagedAdminAccount[];
  roleGovernanceConfigs: RoleGovernanceConfig[];
  globalSystemConfig: GlobalSystemConfig;
  superAdminAuditLogs: SuperAdminAuditEntry[];
  securityAuditLogs: SecurityAuditLogEntry[];
  logSecurityEvent: (params: {
    eventType: SecurityAuditEventType;
    schoolId?: string;
    complexId?: string;
    username: string;
    displayName?: string;
    role?: RoleId;
    detailsFa: string;
  }) => void;
  updateSystemLogo: (logoDataUrl: string | undefined, fileName?: string) => MutationResult;

  // Active school reference date (nearest active workday)
  defaultWorkdayJalali: string;

  // Strictly role-scoped & active-school-scoped datasets
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  teacherNameById: Record<string, string>;
  schedules: ScheduleSlot[];
  studentAttendance: StudentAttendanceRecord[];
  staffAttendance: StaffAttendanceRecord[];
  substitutions: SubstitutionRecord[];
  dailyLogs: DailyLogEntry[];
  pluginStates: SchoolPluginState[];
  collectionCounts: CollectionCountMap;

  // Phase 2 Strictly Role-Scoped & School-Scoped Datasets
  curriculumTopics: CurriculumTopic[];
  mediaResources: MediaResource[];
  chatOutbox: ChatOutboxItem[];
  gradebookEntries: GradebookEntry[];
  lessonPlans: LessonPlanRecord[];
  gradebookWeights: GradebookWeightConfig[];
  gradeAppeals: GradeAppeal[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  studentRewards: StudentReward[];

  // Phase 2.5 Strictly Role-Scoped & School-Scoped Datasets
  questionBank: QuestionBankItem[];
  classChatDraftQueue: ClassChatDraftItem[];
  examQuestionBasket: ExamBasketItem[];

  // Phase 3 Strictly Role-Scoped & School-Scoped Datasets
  flippedLessons: FlippedVideoLesson[];
  flippedTelemetry: FlippedVideoTelemetry[];
  flippedQuestions: FlippedTimestampQuestion[];
  onlineClassSessions: OnlineClassSession[];
  onlineClassAttendance: OnlineClassAttendanceRecord[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  student360Signals: Student360Signal[];

  // Phase 3.5 Strictly Role-Scoped & School-Scoped Private Parent-Staff Chat
  parentStaffMessages: ParentStaffMessage[];
  unreadParentChatCount: number;

  // Phase 4 Strictly Role-Scoped & School-Scoped Datasets
  classChatRooms: ClassChatRoomConfig[];
  classChatMessages: ClassChatMessage[];
  appointmentSlots: AppointmentSlot[];
  electronicForms: ElectronicForm[];
  electronicFormResponses: ElectronicFormResponse[];
  notificationTemplates: NotificationTemplate[];

  // Phase 5 Strictly Role-Scoped & School-Scoped Datasets
  sidaGradeAuditLogs: SidaGradeAuditLog[];
  inPersonExamHalls: InPersonExamHall[];
  inPersonExamSessions: InPersonExamSession[];
  examSeatingCharts: ExamSeatingChart[];
  studentProfiles: StudentElectronicProfile[];
  staffProfiles: StaffElectronicProfile[];

  // Phase 5.5 Strictly Role-Scoped & School-Scoped Datasets
  sidaSpeedEntryTicks: SidaSpeedEntryRecord[];
  userAppearancePref: UserAppearancePreference | null;
  schoolBrandingConfig: SchoolBrandingConfig | null;
  /** Role-scoped branding configs: super_admin sees all schools, complex_admin sees own complex, principal sees ONLY own school */
  schoolBrandingConfigs: SchoolBrandingConfig[];

  // Phase 6 Strictly Role-Scoped & School-Scoped Datasets
  financeFeePlans: FinanceFeePlan[];
  financeLedgers: FinanceStudentLedger[];
  financePayments: FinancePaymentRecord[];
  financeExpenses: FinanceExpenseRecord[];
  remedialPlans: RemedialPlanRecord[];
  anonymousSurveys: AnonymousSurvey[];
  surveyParticipationReceipts: SurveyParticipationReceipt[];
  surveyAnonymousResponses: SurveyAnonymousResponse[];
  /** Strictly null for every role except complex_admin */
  complexPhase6Dataset: ComplexPhase6Dataset | null;

  // Phase 7 Strictly Role-Scoped & School-Scoped Teacher Professional Development
  tdCourses: TeacherDevCourse[];
  tdProgress: TeacherDevProgress[];
  tdCertificates: TeacherDevCertificate[];
  tdSchoolSettings: TeacherDevSchoolSettings;
  tdLeaderboard: PrivacyFilteredLeaderboard;
  /** Strictly null for every role except complex_admin */
  complexPhase7Dataset: ComplexPhase7Dataset | null;

  // Plugin Engine
  allManifests: PluginManifest[];
  pluginStatuses: PluginRuntimeStatus[];
  isPluginEnabled: (pluginId: string) => boolean;
  getPluginStatusesForSchool: (schoolId: string) => PluginRuntimeStatus[];
  updatePluginState: (
    pluginId: string,
    action: 'enable' | 'disable' | 'uninstall' | 'install',
    applyToAllSchools?: boolean
  ) => Promise<MutationResult>;
  updatePluginStateForSchool: (
    schoolId: string,
    pluginId: string,
    action: 'enable' | 'disable' | 'uninstall' | 'install',
    applyToAllSchools?: boolean
  ) => Promise<MutationResult>;

  // RBAC-Guarded Optimistic CRUD mutations (always scoped to activeSchoolId)
  upsertStudentAttendance: (record: StudentAttendanceRecord) => MutationResult;
  upsertStaffAttendance: (record: StaffAttendanceRecord) => MutationResult;
  upsertSubstitution: (record: SubstitutionRecord) => MutationResult;
  deleteSubstitution: (id: string) => MutationResult;
  addDailyLog: (entry: DailyLogEntry) => MutationResult;
  deleteDailyLog: (id: string) => MutationResult;
  updateActiveSchool: (updated: School) => Promise<MutationResult>;
  importStudentsBatch: (newStudents: Student[]) => Promise<MutationResult>;
  importTeachersBatch: (newTeachers: Teacher[]) => Promise<MutationResult>;

  // Directory CRUD (Phase 1.5)
  upsertStudent: (student: Student) => Promise<MutationResult>;
  setStudentActiveStatus: (studentId: string, active: boolean) => Promise<MutationResult>;
  deleteStudentPermanently: (studentId: string) => Promise<MutationResult>;
  upsertClassRoom: (cls: ClassRoom) => Promise<MutationResult>;
  upsertTeacherWithSchedule: (
    teacher: Teacher,
    teacherSlots: ScheduleSlot[]
  ) => Promise<MutationResult>;

  // Phase 2 RBAC-Guarded Mutations
  upsertScheduleSlot: (slot: ScheduleSlot) => MutationResult;
  deleteScheduleSlot: (id: string) => MutationResult;
  upsertCurriculumTopic: (topic: CurriculumTopic) => MutationResult;
  toggleCurriculumClassCompletion: (topicId: string, classId: string) => MutationResult;
  deleteCurriculumTopic: (id: string) => MutationResult;
  addMediaResource: (resource: MediaResource) => MutationResult;
  deleteMediaResource: (id: string) => MutationResult;
  sendMediaToClassChat: (item: ChatOutboxItem) => MutationResult;
  upsertGradebookEntry: (entry: GradebookEntry) => MutationResult;
  upsertLessonPlan: (plan: LessonPlanRecord) => MutationResult;
  deleteLessonPlan: (id: string) => MutationResult;
  upsertGradebookWeights: (config: GradebookWeightConfig) => MutationResult;
  upsertGradeAppeal: (appeal: GradeAppeal) => MutationResult;
  upsertHomeworkAssignment: (assignment: HomeworkAssignment) => MutationResult;
  deleteHomeworkAssignment: (id: string) => MutationResult;
  upsertHomeworkSubmission: (submission: HomeworkSubmission) => MutationResult;
  addStudentReward: (reward: StudentReward) => MutationResult;
  deleteStudentReward: (id: string) => MutationResult;

  // Phase 2.5 Question Bank & Dispatch Queue Mutations
  upsertQuestionItem: (item: QuestionBankItem) => MutationResult;
  deleteQuestionItem: (id: string) => MutationResult;
  addClassChatDraft: (draft: ClassChatDraftItem) => MutationResult;
  addToExamBasket: (items: ExamBasketItem[]) => MutationResult;
  removeFromExamBasket: (id: string) => MutationResult;
  clearExamBasket: () => MutationResult;

  // Phase 3 RBAC-Guarded Mutations
  upsertFlippedLesson: (lesson: FlippedVideoLesson) => MutationResult;
  deleteFlippedLesson: (id: string) => MutationResult;
  upsertFlippedTelemetry: (telemetry: FlippedVideoTelemetry) => MutationResult;
  addFlippedQuestion: (question: FlippedTimestampQuestion) => MutationResult;
  replyFlippedQuestion: (questionId: string, replyText: string) => MutationResult;
  recordFlippedMicroQuizOutcome: (params: {
    lesson: FlippedVideoLesson;
    telemetry: FlippedVideoTelemetry;
    signal: Student360Signal;
  }) => MutationResult;
  upsertOnlineClassSession: (session: OnlineClassSession) => MutationResult;
  deleteOnlineClassSession: (id: string) => MutationResult;
  upsertOnlineClassAttendance: (record: OnlineClassAttendanceRecord) => MutationResult;
  upsertOnlineExam: (exam: OnlineExam) => MutationResult;
  deleteOnlineExam: (id: string) => MutationResult;
  upsertOnlineExamSubmission: (
    submission: OnlineExamSubmission,
    signal?: Student360Signal
  ) => MutationResult;
  syncExamGradesToGradebook: (examId: string, month?: JalaliAcademicMonth) => MutationResult;
  upsertStudent360Signal: (signal: Student360Signal) => MutationResult;

  // Phase 3.5 Private Parent-Staff Chat Mutations (BroadcastChannel synced)
  sendParentStaffMessage: (params: {
    studentId: string;
    classId: string;
    channelType: ParentChatChannelType;
    targetTeacherId?: string;
    text: string;
  }) => MutationResult;
  markParentChatThreadRead: (studentId: string, channelType: ParentChatChannelType) => void;

  // Phase 4 RBAC-Guarded Mutations
  setClassChatRoomMode: (classId: string, mode: ClassChatRoomMode) => MutationResult;
  sendClassChatMessage: (params: {
    classId: string;
    kind: 'text' | 'poll' | 'question_bank';
    text: string;
    poll?: ClassChatPoll;
  }) => MutationResult;
  voteClassChatPoll: (messageId: string, optionId: string) => MutationResult;
  deleteClassChatDraft: (id: string) => MutationResult;
  createAppointmentSlots: (slots: AppointmentSlot[]) => MutationResult;
  deleteAppointmentSlot: (id: string) => MutationResult;
  bookAppointmentSlot: (slotId: string, topic: string) => MutationResult;
  cancelAppointmentBooking: (slotId: string) => MutationResult;
  completeAppointmentSlot: (slotId: string, outcomeNotes: string) => MutationResult;
  upsertElectronicForm: (form: ElectronicForm) => MutationResult;
  deleteElectronicForm: (id: string) => MutationResult;
  submitElectronicFormResponse: (response: ElectronicFormResponse) => MutationResult;
  upsertNotificationTemplate: (template: NotificationTemplate) => MutationResult;
  deleteNotificationTemplate: (id: string) => MutationResult;

  // Phase 5 RBAC-Guarded Mutations
  importSidaStudentsBatch: (
    items: Array<{ student: Student; profile: StudentElectronicProfile }>
  ) => Promise<MutationResult>;
  resolveSidaGradeAppeal: (params: {
    appealId: string;
    nextStatus: 'in_review' | 'teacher_reviewed' | 'principal_approved' | 'rejected';
    revisedScore?: number;
    revisedDescriptiveLevel?: DescriptiveLevel;
    explanation: string;
  }) => MutationResult;
  upsertInPersonExamHall: (hall: InPersonExamHall) => MutationResult;
  deleteInPersonExamHall: (id: string) => MutationResult;
  upsertInPersonExamSession: (examSession: InPersonExamSession) => MutationResult;
  deleteInPersonExamSession: (id: string) => MutationResult;
  upsertExamSeatingChart: (chart: ExamSeatingChart) => MutationResult;
  deleteExamSeatingChart: (id: string) => MutationResult;
  upsertStudentProfile: (profile: StudentElectronicProfile) => MutationResult;
  upsertStaffProfile: (profile: StaffElectronicProfile) => MutationResult;

  // Phase 5.5 RBAC-Guarded Mutations
  upsertSingleSidaStudent: (
    student: Student,
    profile: StudentElectronicProfile
  ) => Promise<MutationResult & { savedStudent?: Student }>;
  transferStudentsToClass: (
    studentIds: string[],
    targetClassId: string,
    reason?: string
  ) => Promise<MutationResult & { movedCount?: number }>;
  upsertSidaSpeedEntryRecord: (record: SidaSpeedEntryRecord) => MutationResult;
  saveUserAppearancePreference: (pref: UserAppearancePreference) => MutationResult;
  saveSchoolBrandingConfig: (
    config: SchoolBrandingConfig,
    applyToAllSchools?: boolean
  ) => Promise<MutationResult>;
  saveSchoolPrintBranding: (input: {
    schoolId: string;
    schoolDisplayName: string;
    printSubtitle: string;
    logoDataUrl?: string | null;
    isArchivedYear?: boolean;
  }) => Promise<MutationResult & { config?: SchoolBrandingConfig }>;

  // Phase 6 RBAC-Guarded Mutations
  upsertFinanceFeePlan: (plan: FinanceFeePlan) => MutationResult;
  upsertFinanceLedger: (ledger: FinanceStudentLedger) => MutationResult;
  recordFinancePayment: (params: {
    payment: FinancePaymentRecord;
    updatedLedger: FinanceStudentLedger;
  }) => MutationResult;
  deleteFinancePayment: (
    paymentId: string,
    revertedLedger?: FinanceStudentLedger
  ) => MutationResult;
  upsertFinanceExpense: (expense: FinanceExpenseRecord) => MutationResult;
  deleteFinanceExpense: (expenseId: string) => MutationResult;
  addTripFeeToStudents: (params: {
    studentIds: string[];
    title: string;
    amountToman: number;
    dueDateJalali: string;
  }) => Promise<MutationResult & { updatedCount?: number }>;
  upsertRemedialPlan: (plan: RemedialPlanRecord) => MutationResult;
  deleteRemedialPlan: (planId: string) => MutationResult;
  upsertAnonymousSurvey: (
    survey: AnonymousSurvey,
    publishAllSchools?: boolean
  ) => Promise<MutationResult>;
  deleteAnonymousSurvey: (surveyId: string) => MutationResult;
  submitAnonymousSurveyVote: (params: {
    surveyId: string;
    participantKey: string;
    audienceRole: SurveyAudienceRole;
    answers: Record<string, string | number>;
    openComment?: string;
    submittedDayBucket: string;
  }) => MutationResult;
  updateSurveyResponseReview: (params: {
    responseId: string;
    reviewStatus: SurveyCommentReviewStatus;
    internalManagementNote?: string;
  }) => MutationResult;

  // Phase 7 RBAC-Guarded Teacher Development Mutations
  upsertTeacherDevCourse: (
    course: TeacherDevCourse,
    publishAllSchools?: boolean
  ) => Promise<MutationResult>;
  archiveTeacherDevCourse: (
    courseId: string,
    archiveAllLinked?: boolean
  ) => Promise<MutationResult>;
  deleteTeacherDevCourse: (
    courseId: string,
    deleteAllLinked?: boolean
  ) => Promise<MutationResult>;
  completeTeacherDevChapter: (courseId: string, chapterId: string) => MutationResult;
  submitTeacherDevQuizAttempt: (params: {
    courseId: string;
    seed: string;
    answers: Record<string, string>;
  }) => TeacherDevQuizSubmissionResult;
  saveTeacherDevPrivacySettings: (
    rankingPrivacyMode: TeacherDevRankingPrivacyMode
  ) => MutationResult;

  // Phase 8A Super Admin Governance Mutations
  saveRoleGovernanceConfig: (config: RoleGovernanceConfig) => MutationResult;
  resetAllRoleGovernanceConfigs: () => MutationResult;
  updateGlobalLabels: (labels: Record<string, string>) => MutationResult;
  resetGlobalLabels: () => MutationResult;
  updateLoginBackgroundConfig: (config: LoginBackgroundConfig) => MutationResult;
  upsertManagedAdminAccount: (account: ManagedAdminAccount) => MutationResult;
  deleteManagedAdminAccount: (accountId: string) => MutationResult;
  toggleManagedAdminAccountActive: (accountId: string) => MutationResult;
  createNewSchool: (input: {
    complexId: string;
    name: string;
    subtitle?: string;
    gradeLevel: SchoolGradeLevel;
    principalName: string;
    phone?: string;
    address?: string;
    logoDataUrl?: string;
    createPrincipalAccount?: boolean;
    principalUsername?: string;
    principalPassword?: string;
  }) => Promise<MutationResult & { school?: School }>;
  updateSchoolUnit: (school: School) => Promise<MutationResult>;
  createNewComplex: (input: {
    name: string;
    description?: string;
    adminFullName: string;
    adminUsername: string;
    adminPassword: string;
    initialSchools: Array<{
      name: string;
      gradeLevel: SchoolGradeLevel;
      principalName: string;
      createPrincipalAccount?: boolean;
      principalUsername?: string;
      principalPassword?: string;
    }>;
  }) => Promise<MutationResult & { complex?: EducationalComplex }>;
  updateComplex: (complex: EducationalComplex) => Promise<MutationResult>;

  // Step 3: Smart Content Archive, School Announcements, Mid-Year Transfer Logs, Notifications & Safe Reset/Restore
  smartContentArchive: SmartContentArchiveItem[];
  schoolAnnouncements: SchoolAnnouncement[];
  studentTransferLogs: StudentTransferLog[];
  recoverySnapshots: RecoverySnapshotRecord[];
  notificationCenter: ComputedNotificationCenterState;
  upsertSmartArchiveItem: (item: SmartContentArchiveItem) => MutationResult;
  deleteSmartArchiveItem: (id: string) => MutationResult;
  reuseArchiveItemInClass: (params: {
    archiveId: string;
    targetClassId: string;
    deadlineJalali?: string;
  }) => MutationResult;
  upsertSchoolAnnouncement: (announcement: SchoolAnnouncement) => MutationResult;
  deleteSchoolAnnouncement: (id: string) => MutationResult;
  markNotificationRead: (notificationKey: string) => void;
  markAllNotificationsRead: () => void;
  createRecoverySnapshot: (
    moduleKey: SelectiveResetModuleKey | 'full_school',
    reasonFa: string
  ) => Promise<MutationResult & { snapshot?: RecoverySnapshotRecord }>;
  executeSelectiveSafeReset: (
    moduleKey: SelectiveResetModuleKey,
    reasonFa?: string
  ) => Promise<MutationResult & { snapshot?: RecoverySnapshotRecord; clearedCount?: number }>;
  restoreRecoverySnapshot: (snapshotId: string) => Promise<MutationResult>;

  // Backup & Restore (preserves all disabled/uninstalled plugin records)
  exportSingleSchoolBackup: () => Promise<BackupPayload>;
  exportComplexBackup: () => Promise<BackupPayload>;
  restoreBackup: (payload: BackupPayload) => Promise<void>;
  resetAllData: () => Promise<void>;

  // Cross-school comparison (strictly gated for complex_admin / super_admin)
  complexComparison: SchoolComparisonRow[];

  // Phase 9A: Multi-Academic-Year Engine & Enterprise Mock / Konkur Exams
  academicYears: AcademicYear[];
  mockExams: MockExam[];
  mockExamAttempts: MockExamAttempt[];
  allMockExamsForSchool: MockExam[];
  allMockAttemptsForComplex: MockExamAttempt[];
  saveAcademicYearsList: (years: AcademicYear[]) => Promise<MutationResult>;
  upsertMockExam: (exam: MockExam) => Promise<MutationResult>;
  deleteMockExam: (examId: string) => Promise<MutationResult>;
  upsertMockExamAttempt: (attempt: MockExamAttempt) => Promise<MutationResult>;
  upsertMockExamAttemptsBatch: (attempts: MockExamAttempt[]) => Promise<MutationResult>;
  deleteMockExamAttempt: (attemptId: string, schoolId: string) => Promise<MutationResult>;

  // Phase 9B: Advanced SIDA Analytics Engine
  sidaAppealWindows: SidaAppealWindowConfig[];
  sidaRemedialGroups: SidaRemedialGroupRecord[];
  sidaClassBalancingDrafts: SidaClassBalancingDraft[];
  sidaAnalyticsGrades: SidaAnalyticsGradeRecord[];
  upsertSidaAppealWindow: (config: SidaAppealWindowConfig) => Promise<MutationResult>;
  upsertSidaRemedialGroup: (group: SidaRemedialGroupRecord) => Promise<MutationResult>;
  deleteSidaRemedialGroup: (groupId: string) => Promise<MutationResult>;
  upsertSidaClassBalancingDraft: (draft: SidaClassBalancingDraft) => Promise<MutationResult>;
  deleteSidaClassBalancingDraft: (draftId: string) => Promise<MutationResult>;

  // Smart Fuzzy Search catalog (all complex schools for complex_admin, strictly scoped for other roles)
  searchCatalog: SmartSearchCatalog;
  searchFocusTarget: SearchFocusTarget | null;
  setSearchFocusTarget: (target: SearchFocusTarget | null) => void;
  clearSearchFocusTarget: () => void;

  // Step 3-B: Data Vault, Chunked Migration Engine, Soft-Delete Recycle Bin, Panic Mode & Integrity Guard
  verifyCurrentUserPassword: (candidatePassword: string) => Promise<boolean>;
  panicModeState: PanicModeState;
  isActiveSchoolPanicLocked: boolean;
  antiWipeAlertFa: string | null;
  clearAntiWipeAlert: () => void;
  activatePanicMode: (
    scope: PanicModeScope,
    schoolIds: string[],
    reasonFa: string
  ) => Promise<MutationResult>;
  deactivatePanicMode: (passwordPlain: string, confirmPhrase: string) => Promise<MutationResult>;
  vaultMeta: MigrationVaultMeta;
  dailyRollingSnapshots: DailyRollingSnapshot[];
  lastUndoSnapshot: DailyRollingSnapshot | null;
  softDeletedItems: SoftDeletedRecordEntry[];
  refreshSoftDeletedItems: () => Promise<void>;
  restoreSoftDeletedRecord: (
    collection: CollectionName,
    schoolId: string,
    id: string
  ) => Promise<MutationResult>;
  runVaultChunkedMigration: (
    onProgress?: (progress: MigrationProgressState) => void,
    simulateError?: boolean
  ) => Promise<ChunkedMigrationResult>;
  runDataIntegrityCheck: (schoolId?: string) => ReferentialIntegrityReport;
  exportPhase10MigrationBundle: (
    scope: MigrationBundleScope,
    schoolId?: string,
    academicYearId?: string
  ) => Promise<SealedMigrationBundle>;
  verifyMigrationBundleFile: (rawJson: string) => Promise<MigrationBundleVerificationResult>;
  executeGranularBundleRestore: (
    bundle: SealedMigrationBundle,
    passwordPlain: string,
    confirmPhrase: string
  ) => Promise<MutationResult & { undoSnapshot?: DailyRollingSnapshot }>;
  undoLastBundleRestore: () => Promise<MutationResult>;
  createDailyRollingSnapshotNow: (
    labelFa?: string
  ) => Promise<MutationResult & { snapshot?: DailyRollingSnapshot }>;
  restoreDailyRollingSnapshot: (
    snapshotId: string,
    passwordPlain: string,
    confirmPhrase: string
  ) => Promise<MutationResult>;
  // Step 3-C: Smart Table Mapping & Auto Column Matching Wizard
  importMappingTemplates: ImportMappingTemplate[];
  getSchoolRecordsForImport: (schoolId: string) => ExistingSchoolLookup;
  saveImportMappingTemplate: (template: ImportMappingTemplate) => Promise<MutationResult>;
  deleteImportMappingTemplate: (
    templateId: string,
    schoolId: string
  ) => Promise<MutationResult>;
  commitSmartImportBatch: (
    payload: SmartImportCommitPayload
  ) => Promise<MutationResult & { receipt?: SmartImportCommitReceipt }>;
  // Phase 9-C: Discipline, Leave/Exit Pass, Confidential Counseling & Virtual Class Hub
  disciplineRecords: DisciplineRecord[];
  disciplinePledges: DisciplinePledge[];
  studentExitPasses: StudentExitPass[];
  staffLeaveRequests: StaffLeaveRequest[];
  counselingSessions: CounselingSession[];
  counselingClinicalNotes: CounselingClinicalNote[];
  virtualClassSessions: VirtualClassSession[];
  virtualClassAttendance: VirtualClassAttendance[];
  upsertDisciplineRecord: (record: DisciplineRecord) => Promise<MutationResult>;
  softDeleteDisciplineRecord: (id: string) => Promise<MutationResult>;
  upsertDisciplinePledge: (pledge: DisciplinePledge) => Promise<MutationResult>;
  softDeleteDisciplinePledge: (id: string) => Promise<MutationResult>;
  signDisciplinePledge: (
    pledgeId: string,
    mode: 'signed_digital' | 'signed_in_person',
    note?: string
  ) => Promise<MutationResult>;
  upsertStudentExitPass: (pass: StudentExitPass) => Promise<MutationResult>;
  softDeleteStudentExitPass: (id: string) => Promise<MutationResult>;
  updateStudentExitStatus: (
    passId: string,
    nextStatus: StudentExitPass['status'],
    note?: string
  ) => Promise<MutationResult>;
  upsertStaffLeaveRequest: (req: StaffLeaveRequest) => Promise<MutationResult>;
  softDeleteStaffLeaveRequest: (id: string) => Promise<MutationResult>;
  reviewStaffLeaveRequest: (
    reqId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ) => Promise<MutationResult>;
  upsertCounselingSession: (sessionRec: CounselingSession) => Promise<MutationResult>;
  softDeleteCounselingSession: (id: string) => Promise<MutationResult>;
  upsertCounselingClinicalNote: (note: CounselingClinicalNote) => Promise<MutationResult>;
  logCounselingClinicalViewed: (params: {
    sessionId: string;
    studentName: string;
    auditReasonFa?: string;
  }) => void;
  togglePrincipalCounselingAuditAccess: (
    targetSchoolId: string,
    enabled: boolean
  ) => Promise<MutationResult>;
  upsertVirtualClassSession: (sess: VirtualClassSession) => Promise<MutationResult>;
  softDeleteVirtualClassSession: (id: string) => Promise<MutationResult>;
  recordVirtualClassJoinAttendance: (sessionId: string) => Promise<MutationResult>;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider: React.FC<{
  manifests: PluginManifest[];
  children: React.ReactNode;
}> = ({ manifests, children }) => {
  const initialPrefs = useMemo(() => loadUiPrefs(), []);

  // Hydrate immediately from synchronous snapshot so app NEVER hangs on loading screen
  const [dataset, setDataset] = useState<SeedDataset>(() =>
    buildActiveViewDataset(sharedRepository.getSyncSnapshot())
  );
  const [backendMode, setBackendMode] = useState<StorageBackendMode>(sharedRepository.backendMode);
  const [realSession, setRealSession] = useState<AuthSession | null>(() => loadStoredSession());
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [complexSelectedSchoolId, setComplexSelectedSchoolId] = useState<string>(
    initialPrefs.activeSchoolId
  );
  const [darkMode, setDarkMode] = useState<boolean>(initialPrefs.darkMode);
  const [searchFocusTarget, setSearchFocusTarget] = useState<SearchFocusTarget | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // Step 3-B reactive vault states
  const [panicModeState, setPanicModeState] = useState<PanicModeState>(() =>
    sharedRepository.getPanicModeState()
  );
  const [vaultMeta, setVaultMeta] = useState<MigrationVaultMeta>(() =>
    sharedRepository.getVaultMeta()
  );
  const [dailyRollingSnapshots, setDailyRollingSnapshots] = useState<DailyRollingSnapshot[]>(() =>
    sharedRepository.getDailyRollingSnapshots()
  );
  const [softDeletedItems, setSoftDeletedItems] = useState<SoftDeletedRecordEntry[]>([]);
  const [lastUndoSnapshot, setLastUndoSnapshot] = useState<DailyRollingSnapshot | null>(null);
  const [antiWipeAlertFa, setAntiWipeAlertFa] = useState<string | null>(null);

  const refreshSoftDeletedItems = useCallback(async () => {
    const items = await sharedRepository.getSoftDeletedItems();
    setSoftDeletedItems(items);
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist UI preferences
  useEffect(() => {
    saveUiPrefs({ activeSchoolId: complexSelectedSchoolId, darkMode });
  }, [complexSelectedSchoolId, darkMode]);

  // Online/Offline listener
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Silent background IndexedDB boot with 3s timeout protection + Live Cross-Tab Sync subscription
  useEffect(() => {
    let mounted = true;
    sharedRepository
      .init()
      .then(async (mode) => {
        if (!mounted) return;
        setBackendMode(mode);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        setPanicModeState(sharedRepository.getPanicModeState());
        setVaultMeta(sharedRepository.getVaultMeta());
        const existingSnapshots = sharedRepository.getDailyRollingSnapshots();
        setDailyRollingSnapshots(existingSnapshots);
        const deletedList = await sharedRepository.getSoftDeletedItems();
        if (mounted) setSoftDeletedItems(deletedList);

        // Automatic Daily Rolling Snapshot (max 5 recent Jalali days)
        const today = getTodayJalali();
        const hasTodayAuto = existingSnapshots.some(
          (s) => s.trigger === 'auto_daily' && s.jalaliDate === today
        );
        if (!hasTodayAuto) {
          try {
            const snap = await buildDailyRollingSnapshot({
              dataset: sharedRepository.getSyncSnapshot(),
              trigger: 'auto_daily',
              labelFa: `پشتیبان خودکار روزانه (${today})`,
              schemaVersion: sharedRepository.getVaultMeta().schemaVersion,
            });
            await sharedRepository.saveDailyRollingSnapshot(snap);
            if (mounted) {
              setDailyRollingSnapshots(sharedRepository.getDailyRollingSnapshots());
            }
          } catch {
            // Non-blocking background snapshot
          }
        }
      })
      .catch(() => {
        // Fallback already active
      });

    const unsubscribe = sharedRepository.subscribe((event) => {
      if (!mounted) return;
      if (event.type === 'external_sync' || event.type === 'restore' || event.type === 'reset') {
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
      }
      if (
        event.type === 'delete' ||
        event.type === 'restore_soft_delete' ||
        event.type === 'restore' ||
        event.type === 'reset' ||
        event.type === 'external_sync'
      ) {
        void sharedRepository.getSoftDeletedItems().then((items) => {
          if (mounted) setSoftDeletedItems(items);
        });
      }
      if (
        event.type === 'panic_mode_changed' ||
        event.type === 'vault_updated' ||
        event.type === 'external_sync'
      ) {
        setPanicModeState(sharedRepository.getPanicModeState());
        setVaultMeta(sharedRepository.getVaultMeta());
        setDailyRollingSnapshots(sharedRepository.getDailyRollingSnapshots());
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Effective session reflects impersonation when Super Admin enters preview mode
  const session = useMemo<AuthSession | null>(() => {
    if (!realSession) return null;
    if (realSession.role === 'super_admin' && impersonation) {
      const impSchoolId =
        impersonation.targetSchoolId ||
        dataset.schools.find((s) => (s.complexId ?? 'complex-1') === impersonation.targetComplexId)
          ?.id ||
        dataset.schools[0]?.id ||
        'school-1';
      const impTeacher =
        impersonation.targetRole === 'teacher'
          ? dataset.teachers.find((t) => t.schoolId === impSchoolId && t.active)
          : undefined;
      const impStudent =
        impersonation.targetRole === 'parent' || impersonation.targetRole === 'student'
          ? dataset.students.find((s) => s.schoolId === impSchoolId && s.active)
          : undefined;
      return {
        userId: impersonation.targetUserId ?? `impersonated-${impersonation.targetRole}-${impSchoolId}`,
        username: `preview-${impersonation.targetRole}`,
        displayName: impersonation.targetDisplayName,
        role: impersonation.targetRole,
        schoolId: impSchoolId,
        complexId:
          impersonation.targetComplexId ??
          dataset.schools.find((s) => s.id === impSchoolId)?.complexId ??
          'complex-1',
        isComplexWide: impersonation.targetRole === 'complex_admin',
        isSuperAdmin: false,
        linkedTeacherId: impTeacher?.id,
        linkedStudentId: impStudent?.id,
        loggedInAt: impersonation.startedAt,
      };
    }
    return realSession;
  }, [realSession, impersonation, dataset.schools, dataset.teachers, dataset.students]);

  const allSchools = dataset.schools;
  const schools = useMemo(
    () => getVisibleSchoolsForSession(session, allSchools),
    [session, allSchools]
  );
  const visibleSchoolIdSet = useMemo(() => new Set(schools.map((s) => s.id)), [schools]);

  const activeRole: RoleId = session?.role ?? 'parent';
  const roleDef = ROLE_DEFINITIONS[activeRole];

  // Lock schoolId to session.schoolId for non-switchable roles, and keep within visible complex schools for complex_admin
  const resolvedSchoolId = useMemo(() => {
    if (!session) return allSchools[0]?.id ?? 'school-1';
    if (roleDef.canSwitchSchool) {
      if (schools.some((s) => s.id === complexSelectedSchoolId)) {
        return complexSelectedSchoolId;
      }
      if (schools.some((s) => s.id === session.schoolId)) {
        return session.schoolId;
      }
      return schools[0]?.id ?? allSchools[0]?.id ?? 'school-1';
    }
    return session.schoolId;
  }, [session, roleDef.canSwitchSchool, complexSelectedSchoolId, schools, allSchools]);

  const activeSchool = useMemo<School>(() => {
    return (
      schools.find((s) => s.id === resolvedSchoolId) ??
      allSchools.find((s) => s.id === resolvedSchoolId) ??
      schools[0] ??
      allSchools[0]
    );
  }, [schools, allSchools, resolvedSchoolId]);

  // Phase 8A Governance Datasets
  const educationalComplexes = dataset.educational_complexes;
  const managedAdminAccounts = dataset.managed_admin_accounts;
  const roleGovernanceConfigs = useMemo(() => {
    return dataset.role_governance_configs.length > 0
      ? dataset.role_governance_configs
      : buildDefaultRoleGovernanceConfigs(manifests);
  }, [dataset.role_governance_configs, manifests]);

  const globalSystemConfig = useMemo<GlobalSystemConfig>(() => {
    const found = dataset.global_system_configs[0];
    if (found) return found;
    return {
      id: 'global-system-config',
      schoolId: GLOBAL_TENANT_ID,
      labels: {},
      loginBackground: createDefaultLoginBackgroundConfig(),
      updatedAt: new Date().toISOString(),
    };
  }, [dataset.global_system_configs]);

  const superAdminAuditLogs = useMemo(() => {
    const seen = new Set<string>();
    const unique: SuperAdminAuditEntry[] = [];
    for (const item of dataset.super_admin_audit_logs) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique.sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
  }, [dataset.super_admin_audit_logs]);

  // Linked identity records for Teacher, Parent & Student sessions
  const linkedStudent = useMemo<Student | null>(() => {
    if (
      !session ||
      (session.role !== 'parent' && session.role !== 'student') ||
      !session.linkedStudentId
    ) {
      return null;
    }
    return (
      dataset.students.find(
        (s) => s.id === session.linkedStudentId && s.schoolId === session.schoolId
      ) ?? null
    );
  }, [session, dataset.students]);

  const linkedTeacher = useMemo<Teacher | null>(() => {
    if (!session || session.role !== 'teacher' || !session.linkedTeacherId) return null;
    return (
      dataset.teachers.find(
        (t) => t.id === session.linkedTeacherId && t.schoolId === session.schoolId
      ) ?? null
    );
  }, [session, dataset.teachers]);

  const teacherAssignedClassIds = useMemo<string[]>(() => {
    if (!linkedTeacher) return [];
    return linkedTeacher.assignedClassIds;
  }, [linkedTeacher]);

  const logSecurityEvent = useCallback(
    (params: {
      eventType: SecurityAuditEventType;
      schoolId?: string;
      complexId?: string;
      username: string;
      displayName?: string;
      role?: RoleId;
      detailsFa: string;
    }) => {
      const now = new Date();
      const nowIso = now.toISOString();
      const timeHm = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const targetSchoolId = params.schoolId || resolvedSchoolId || GLOBAL_TENANT_ID;
      const targetSchool = dataset.schools.find((s) => s.id === targetSchoolId);
      const cleanUser = sanitizeText(params.username, 80) || 'unknown';
      const cleanName = params.displayName ? sanitizeText(params.displayName, 120) : cleanUser;
      const cleanDetails = sanitizeText(params.detailsFa, 400);
      const entry: SecurityAuditLogEntry = {
        id: generateUUID(),
        complexId: params.complexId ?? targetSchool?.complexId ?? 'complex-1',
        schoolId: targetSchoolId,
        academicYearId: targetSchool?.academicYear ?? '1404-1405',
        createdByUserId: cleanUser,
        eventType: params.eventType,
        actorUsername: cleanUser,
        actorName: cleanName,
        actorRole: params.role,
        summaryFa: cleanDetails,
        detailsFa: cleanDetails,
        timestampJalali: getTodayJalali(),
        timeHm,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      // Seal immediately via sharedRepository so prevHash & SHA-256 entryHash are attached synchronously
      void sharedRepository.appendSecurityAuditLog(entry).catch(() => {});
      const sealedTop = sharedRepository.getSyncSnapshot().security_audit_logs[0] ?? entry;
      setDataset((prev) => ({
        ...prev,
        security_audit_logs: [
          sealedTop,
          ...(prev.security_audit_logs ?? []).filter((e) => e.id !== sealedTop.id),
        ].slice(0, 600),
      }));
    },
    [dataset.schools, resolvedSchoolId]
  );

  const handleDestructiveAttempt = useCallback(
    (userId: string, collection: CollectionName, schoolId: string) => {
      const evaluation = sharedAntiWipeBreaker.recordAndEvaluate(userId);
      if (evaluation.allowed) {
        return { allowed: true };
      }

      const actorName = session?.displayName ?? 'کاربر سامانه';
      const actorUsername = session?.username ?? userId;
      const msg =
        'سپر ضدحمله فعال شد: بیش از ۵ عملیات حذف در کمتر از یک دقیقه شناسایی و مسدود گردید. جهت حفظ سلامت داده‌ها نشست کاربری قفل شد.';

      logSecurityEvent({
        eventType: 'anti_wipe_triggered',
        schoolId,
        complexId: session?.complexId ?? 'complex-1',
        username: actorUsername,
        displayName: actorName,
        role: session?.role,
        detailsFa: `مسدودسازی حذف گروهی مشکوک روی بخش «${collection}» توسط «${actorName}» (${evaluation.recentCount} تلاش حذف در کمتر از ۶۰ ثانیه)`,
      });

      setAntiWipeAlertFa(msg);

      if (session && session.role !== 'super_admin') {
        // Immediately terminate non-super_admin session to halt mass-deletion attack
        saveStoredSession(null);
        setRealSession(null);
        setImpersonation(null);
        sharedRepository.setAuthContext({ session: null, teacherAssignedClassIds: [] });
      }

      return { allowed: false, reasonFa: msg };
    },
    [session, logSecurityEvent]
  );

  const authGuardContext = useMemo<AuthGuardContext>(
    () => ({
      session,
      teacherAssignedClassIds,
      panicModeState,
      onDestructiveAttempt: handleDestructiveAttempt,
    }),
    [session, teacherAssignedClassIds, panicModeState, handleDestructiveAttempt]
  );

  // Keep repository-level RBAC guard synchronized with active effective session
  useEffect(() => {
    sharedRepository.setAuthContext(authGuardContext);
  }, [authGuardContext]);

  const isActiveSchoolPanicLocked = useMemo(
    () => isSchoolUnderPanicLock(panicModeState, resolvedSchoolId),
    [panicModeState, resolvedSchoolId]
  );

  const clearAntiWipeAlert = useCallback(() => {
    setAntiWipeAlertFa(null);
  }, []);

  // Security Audit Logs (strictly scoped: super_admin sees all, principal sees own school only, others see none)
  const securityAuditLogs = useMemo<SecurityAuditLogEntry[]>(() => {
    if (!session) return [];
    const list = dataset.security_audit_logs ?? [];
    const sorted = [...list].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    if (session.role === 'super_admin') {
      return sorted;
    }
    if (session.role === 'principal') {
      return sorted.filter((entry) => entry.schoolId === resolvedSchoolId);
    }
    return [];
  }, [dataset.security_audit_logs, session, resolvedSchoolId]);

  const login = useCallback(
    async (input: LoginAttemptInput): Promise<LoginResult> => {
      const result = await authenticateUserAsync(
        input,
        dataset.schools,
        dataset.students,
        dataset.teachers,
        dataset.managed_admin_accounts
      );
      if (result.ok && result.session) {
        saveStoredSession(result.session);
        setRealSession(result.session);
        setImpersonation(null);
        setComplexSelectedSchoolId(result.session.schoolId);
        // Immediately sync repository guard before any subsequent UI interaction
        const teacherObj = result.session.linkedTeacherId
          ? dataset.teachers.find((t) => t.id === result.session?.linkedTeacherId)
          : undefined;
        sharedRepository.setAuthContext({
          session: result.session,
          teacherAssignedClassIds: teacherObj?.assignedClassIds ?? [],
        });
        logSecurityEvent({
          eventType: 'login_success',
          schoolId: result.session.schoolId,
          complexId: result.session.complexId,
          username: result.session.username,
          displayName: result.session.displayName,
          role: result.session.role,
          detailsFa: `ورود موفق کاربر «${result.session.displayName}» (${ROLE_DEFINITIONS[result.session.role].labelFa})`,
        });
      } else {
        logSecurityEvent({
          eventType: result.lockedNow ? 'account_locked' : 'login_failed',
          schoolId:
            input.selectedScope && input.selectedScope !== 'complex'
              ? input.selectedScope
              : GLOBAL_TENANT_ID,
          username: input.username.trim() || 'empty',
          detailsFa:
            result.errorFa ??
            (result.lockedNow
              ? 'قفل موقت حساب به دلیل ۵ بار خطای متوالی ورود'
              : 'تلاش ناموفق برای ورود به سامانه'),
        });
      }
      return result;
    },
    [dataset.schools, dataset.students, dataset.teachers, dataset.managed_admin_accounts, logSecurityEvent]
  );

  const logout = useCallback(() => {
    saveStoredSession(null);
    setRealSession(null);
    setImpersonation(null);
    setSearchFocusTarget(null);
    sharedRepository.setAuthContext({ session: null, teacherAssignedClassIds: [] });
  }, []);

  const setActiveSchoolId = useCallback(
    (nextId: string) => {
      if (!roleDef.canSwitchSchool) return;
      if (schools.some((s) => s.id === nextId)) {
        setComplexSelectedSchoolId(nextId);
      }
    },
    [roleDef.canSwitchSchool, schools]
  );

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const setDarkModeDirect = useCallback((enabled: boolean) => {
    setDarkMode(enabled);
  }, []);

  const changeOwnPassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<MutationResult> => {
      const targetSession = realSession ?? session;
      if (!targetSession) return { ok: false, errorFa: 'لطفاً ابتدا وارد حساب کاربری شوید.' };
      const res = await updateUserPasswordAsync({
        userId: targetSession.userId,
        currentPassword,
        newPassword,
        schools: dataset.schools,
        students: dataset.students,
        teachers: dataset.teachers,
        managedAdminAccounts: dataset.managed_admin_accounts,
      });
      if (!res.ok || !res.passwordHash || !res.passwordSalt) {
        return { ok: false, errorFa: res.errorFa ?? 'تغییر رمز عبور ناموفق بود.' };
      }

      const nowIso = new Date().toISOString();
      // Persist updated PBKDF2 hash directly onto the backing user record & clear mustChangePassword
      const adminIdx = dataset.managed_admin_accounts.findIndex(
        (a) => a.id === targetSession.userId
      );
      if (adminIdx >= 0) {
        const updatedAdmin: ManagedAdminAccount = {
          ...dataset.managed_admin_accounts[adminIdx],
          passwordHash: res.passwordHash,
          passwordSalt: res.passwordSalt,
          mustChangePassword: false,
          updatedAt: nowIso,
        };
        delete updatedAdmin.password;
        setDataset((prev) => ({
          ...prev,
          managed_admin_accounts: prev.managed_admin_accounts.map((a) =>
            a.id === updatedAdmin.id ? updatedAdmin : a
          ),
        }));
        void sharedRepository.putItem('managed_admin_accounts', updatedAdmin).catch(() => {});
      } else if (targetSession.role === 'teacher' && targetSession.linkedTeacherId) {
        const teacherObj = dataset.teachers.find((t) => t.id === targetSession.linkedTeacherId);
        if (teacherObj) {
          const updatedTeacher: Teacher = {
            ...teacherObj,
            passwordHash: res.passwordHash,
            passwordSalt: res.passwordSalt,
            mustChangePassword: false,
          };
          setDataset((prev) => ({
            ...prev,
            teachers: prev.teachers.map((t) => (t.id === updatedTeacher.id ? updatedTeacher : t)),
          }));
          void sharedRepository.putItem('teachers', updatedTeacher).catch(() => {});
        }
      } else if (
        (targetSession.role === 'student' || targetSession.role === 'parent') &&
        targetSession.linkedStudentId
      ) {
        const stObj = dataset.students.find((s) => s.id === targetSession.linkedStudentId);
        if (stObj) {
          const updatedStudent: Student =
            targetSession.role === 'student'
              ? {
                  ...stObj,
                  studentPasswordHash: res.passwordHash,
                  studentPasswordSalt: res.passwordSalt,
                  studentMustChangePassword: false,
                }
              : {
                  ...stObj,
                  parentPasswordHash: res.passwordHash,
                  parentPasswordSalt: res.passwordSalt,
                  parentMustChangePassword: false,
                };
          delete updatedStudent.studentPassword;
          delete updatedStudent.parentPassword;
          setDataset((prev) => ({
            ...prev,
            students: prev.students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)),
          }));
          void sharedRepository.putItem('students', updatedStudent).catch(() => {});
        }
      }

      if (targetSession.mustChangePassword) {
        const clearedSession: AuthSession = {
          ...targetSession,
          mustChangePassword: false,
        };
        saveStoredSession(clearedSession);
        setRealSession(clearedSession);
      }

      logSecurityEvent({
        eventType: 'password_changed',
        schoolId: targetSession.schoolId,
        complexId: targetSession.complexId,
        username: targetSession.username,
        displayName: targetSession.displayName,
        role: targetSession.role,
        detailsFa: `تغییر امن رمز عبور حساب کاربری «${targetSession.displayName}»`,
      });
      return { ok: true };
    },
    [
      realSession,
      session,
      dataset.schools,
      dataset.students,
      dataset.teachers,
      dataset.managed_admin_accounts,
      logSecurityEvent,
    ]
  );

  const changeOwnLocalPassword = changeOwnPassword;

  const clearSearchFocusTarget = useCallback(() => {
    setSearchFocusTarget(null);
  }, []);

  const defaultWorkdayJalali = useMemo(() => {
    return getNearestActiveWorkday(
      getTodayJalali(),
      activeSchool?.activeWorkdays ?? [3, 4, 5, 6]
    );
  }, [activeSchool?.activeWorkdays]);

  // --- STRICT SCHOOL + ROLE SCOPED DATASETS (Zero cross-school & zero cross-role leakage) ---
  const isParentOrStudent = session?.role === 'parent' || session?.role === 'student';

  const classes = useMemo(() => {
    const schoolClasses = dataset.classes.filter((c) => c.schoolId === resolvedSchoolId);
    if (!session) return [];
    if (isParentOrStudent) {
      return linkedStudent ? schoolClasses.filter((c) => c.id === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return schoolClasses.filter((c) => teacherAssignedClassIds.includes(c.id));
    }
    return schoolClasses;
  }, [dataset.classes, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const students = useMemo(() => {
    const schoolStudents = dataset.students.filter((s) => s.schoolId === resolvedSchoolId);
    if (!session) return [];
    if (isParentOrStudent) {
      return linkedStudent ? [linkedStudent] : [];
    }
    if (session.role === 'teacher') {
      return schoolStudents.filter((s) => teacherAssignedClassIds.includes(s.classId));
    }
    return schoolStudents;
  }, [dataset.students, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const teachers = useMemo(() => {
    const schoolTeachers = dataset.teachers.filter((t) => t.schoolId === resolvedSchoolId);
    if (!session) return [];
    if (isParentOrStudent) {
      return [];
    }
    if (session.role === 'teacher') {
      return linkedTeacher ? [linkedTeacher] : [];
    }
    return schoolTeachers;
  }, [dataset.teachers, resolvedSchoolId, session, isParentOrStudent, linkedTeacher]);

  const teacherNameById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of dataset.teachers) {
      if (t.schoolId === resolvedSchoolId) {
        map[t.id] = t.fullName;
      }
    }
    return map;
  }, [dataset.teachers, resolvedSchoolId]);

  const schedules = useMemo(() => {
    const schoolSchedules = dataset.schedules.filter((s) => s.schoolId === resolvedSchoolId);
    if (!session) return [];
    if (isParentOrStudent) {
      return linkedStudent
        ? schoolSchedules.filter((s) => s.classId === linkedStudent.classId)
        : [];
    }
    if (session.role === 'teacher') {
      return linkedTeacher
        ? schoolSchedules.filter(
            (s) =>
              s.teacherId === linkedTeacher.id || teacherAssignedClassIds.includes(s.classId)
          )
        : [];
    }
    return schoolSchedules;
  }, [dataset.schedules, resolvedSchoolId, session, isParentOrStudent, linkedStudent, linkedTeacher, teacherAssignedClassIds]);

  const studentAttendance = useMemo(() => {
    const schoolAtt = dataset.student_attendance.filter((a) => a.schoolId === resolvedSchoolId);
    if (!session || session.role === 'student') return [];
    if (session.role === 'parent') {
      return linkedStudent ? schoolAtt.filter((a) => a.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return schoolAtt.filter((a) => teacherAssignedClassIds.includes(a.classId));
    }
    return schoolAtt;
  }, [dataset.student_attendance, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const staffAttendance = useMemo(() => {
    const schoolStaffAtt = dataset.staff_attendance.filter((a) => a.schoolId === resolvedSchoolId);
    if (!session || isParentOrStudent) {
      return [];
    }
    if (session.role === 'teacher') {
      return linkedTeacher
        ? schoolStaffAtt.filter((a) => a.teacherId === linkedTeacher.id)
        : [];
    }
    return schoolStaffAtt;
  }, [dataset.staff_attendance, resolvedSchoolId, session, isParentOrStudent, linkedTeacher]);

  const substitutions = useMemo(() => {
    if (!session || isParentOrStudent || session.role === 'teacher') return [];
    return dataset.substitutions.filter((s) => s.schoolId === resolvedSchoolId);
  }, [dataset.substitutions, resolvedSchoolId, session, isParentOrStudent]);

  const dailyLogs = useMemo(() => {
    const schoolLogs = dataset.daily_logs
      .filter((l) => l.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!session || session.role === 'student') return [];
    if (session.role === 'parent') {
      return linkedStudent ? schoolLogs.filter((l) => l.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      const allowedStudentIds = new Set(students.map((s) => s.id));
      return schoolLogs.filter(
        (l) =>
          (l.classId && teacherAssignedClassIds.includes(l.classId)) ||
          (l.studentId && allowedStudentIds.has(l.studentId))
      );
    }
    return schoolLogs;
  }, [dataset.daily_logs, resolvedSchoolId, session, linkedStudent, students, teacherAssignedClassIds]);

  // --- PHASE 2 STRICTLY SCOPED DATASETS ---
  const curriculumTopics = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    const list = dataset.curriculum_topics.filter((t) => t.schoolId === resolvedSchoolId);
    if (session.role === 'teacher') {
      const allowedGrades = new Set(classes.map((c) => c.gradeLevel));
      return list.filter((t) => allowedGrades.has(t.gradeLevel));
    }
    return list;
  }, [dataset.curriculum_topics, resolvedSchoolId, session, isParentOrStudent, classes]);

  const mediaResources = useMemo(() => {
    if (!session) return [];
    const list = dataset.media_resources
      .filter((m) => m.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (isParentOrStudent) {
      const childClass = classes[0];
      return childClass ? list.filter((m) => m.gradeLevel === childClass.gradeLevel) : [];
    }
    if (session.role === 'teacher') {
      const allowedGrades = new Set(classes.map((c) => c.gradeLevel));
      return list.filter((m) => allowedGrades.has(m.gradeLevel));
    }
    return list;
  }, [dataset.media_resources, resolvedSchoolId, session, isParentOrStudent, classes]);

  const chatOutbox = useMemo(() => {
    if (!session) return [];
    const list = dataset.chat_outbox
      .filter((c) => c.schoolId === resolvedSchoolId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((c) => c.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((c) => teacherAssignedClassIds.includes(c.classId));
    }
    return list;
  }, [dataset.chat_outbox, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const gradebookEntries = useMemo(() => {
    if (!session) return [];
    const list = dataset.gradebook_entries.filter((g) => g.schoolId === resolvedSchoolId);
    if (session.role === 'parent' || session.role === 'student') {
      if (!linkedStudent) return [];
      // CRITICAL PRIVACY: strip privateTeacherNote before ever reaching parent/student views!
      return list
        .filter((g) => g.studentId === linkedStudent.id)
        .map((g) => ({ ...g, privateTeacherNote: undefined }));
    }
    if (session.role === 'teacher') {
      return list.filter((g) => teacherAssignedClassIds.includes(g.classId));
    }
    return list;
  }, [dataset.gradebook_entries, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const lessonPlans = useMemo(() => {
    // Strictly hidden from parents and students
    if (!session || isParentOrStudent) return [];
    const list = dataset.lesson_plans
      .filter((lp) => lp.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (session.role === 'teacher') {
      return list.filter((lp) => teacherAssignedClassIds.includes(lp.classId));
    }
    return list;
  }, [dataset.lesson_plans, resolvedSchoolId, session, isParentOrStudent, teacherAssignedClassIds]);

  const gradebookWeights = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const list = dataset.gradebook_weights.filter((w) => w.schoolId === resolvedSchoolId);
    if (session.role === 'parent') {
      return linkedStudent ? list.filter((w) => w.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((w) => teacherAssignedClassIds.includes(w.classId));
    }
    return list;
  }, [dataset.gradebook_weights, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const gradeAppeals = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const list = dataset.grade_appeals
      .filter((a) => a.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (session.role === 'parent') {
      return linkedStudent ? list.filter((a) => a.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((a) => teacherAssignedClassIds.includes(a.classId));
    }
    return list;
  }, [dataset.grade_appeals, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const homeworkAssignments = useMemo(() => {
    if (!session) return [];
    const list = dataset.homework_assignments
      .filter((h) => h.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((h) => h.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((h) => teacherAssignedClassIds.includes(h.classId));
    }
    return list;
  }, [dataset.homework_assignments, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const homeworkSubmissions = useMemo(() => {
    if (!session) return [];
    const list = dataset.homework_submissions.filter((s) => s.schoolId === resolvedSchoolId);
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((s) => s.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((s) => teacherAssignedClassIds.includes(s.classId));
    }
    return list;
  }, [dataset.homework_submissions, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const studentRewards = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const list = dataset.student_rewards
      .filter((r) => r.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'parent') {
      return linkedStudent ? list.filter((r) => r.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((r) => teacherAssignedClassIds.includes(r.classId));
    }
    return list;
  }, [dataset.student_rewards, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const questionBank = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    return dataset.question_bank
      .filter((q) => q.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [dataset.question_bank, resolvedSchoolId, session, isParentOrStudent]);

  const classChatDraftQueue = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    const list = dataset.class_chat_draft_queue
      .filter((d) => d.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'teacher') {
      return list.filter((d) => teacherAssignedClassIds.includes(d.classId));
    }
    return list;
  }, [dataset.class_chat_draft_queue, resolvedSchoolId, session, isParentOrStudent, teacherAssignedClassIds]);

  const examQuestionBasket = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    return dataset.exam_question_basket
      .filter((e) => e.schoolId === resolvedSchoolId)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, [dataset.exam_question_basket, resolvedSchoolId, session, isParentOrStudent]);

  // --- PHASE 3 STRICTLY SCOPED DATASETS ---
  const flippedLessons = useMemo(() => {
    if (!session) return [];
    const list = dataset.flipped_lessons
      .filter((l) => l.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((l) => l.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((l) => teacherAssignedClassIds.includes(l.classId));
    }
    return list;
  }, [dataset.flipped_lessons, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const flippedTelemetry = useMemo(() => {
    if (!session) return [];
    const list = dataset.flipped_telemetry.filter((t) => t.schoolId === resolvedSchoolId);
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((t) => t.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((t) => teacherAssignedClassIds.includes(t.classId));
    }
    return list;
  }, [dataset.flipped_telemetry, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const flippedQuestions = useMemo(() => {
    if (!session) return [];
    const list = dataset.flipped_questions
      .filter((q) => q.schoolId === resolvedSchoolId)
      .sort((a, b) => a.timestampSecond - b.timestampSecond);
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((q) => q.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((q) => teacherAssignedClassIds.includes(q.classId));
    }
    return list;
  }, [dataset.flipped_questions, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const onlineClassSessions = useMemo(() => {
    if (!session) return [];
    const list = dataset.online_class_sessions
      .filter((s) => s.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((s) => s.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((s) => teacherAssignedClassIds.includes(s.classId));
    }
    return list;
  }, [dataset.online_class_sessions, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const onlineClassAttendance = useMemo(() => {
    if (!session) return [];
    const list = dataset.online_class_attendance.filter((a) => a.schoolId === resolvedSchoolId);
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((a) => a.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((a) => teacherAssignedClassIds.includes(a.classId));
    }
    return list;
  }, [dataset.online_class_attendance, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const onlineExams = useMemo(() => {
    if (!session) return [];
    const list = dataset.online_exams
      .filter((e) => e.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (isParentOrStudent) {
      return linkedStudent
        ? list.filter((e) => e.classId === linkedStudent.classId && e.status !== 'draft')
        : [];
    }
    if (session.role === 'teacher') {
      return list.filter((e) => teacherAssignedClassIds.includes(e.classId));
    }
    return list;
  }, [dataset.online_exams, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const onlineExamSubmissions = useMemo(() => {
    if (!session) return [];
    const list = dataset.online_exam_submissions
      .filter((s) => s.schoolId === resolvedSchoolId)
      .sort((a, b) => b.submittedAtIso.localeCompare(a.submittedAtIso));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((s) => s.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((s) => teacherAssignedClassIds.includes(s.classId));
    }
    return list;
  }, [dataset.online_exam_submissions, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const student360Signals = useMemo(() => {
    if (!session) return [];
    const list = dataset.student_360_signals
      .filter((s) => s.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((s) => s.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((s) => teacherAssignedClassIds.includes(s.classId));
    }
    return list;
  }, [dataset.student_360_signals, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  // --- PHASE 3.5 PRIVATE PARENT-STAFF CHAT (STRICTLY HIDDEN FROM STUDENT ROLE) ---
  const parentStaffMessages = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const schoolMsgs = dataset.parent_staff_messages
      .filter((m) => m.schoolId === resolvedSchoolId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return filterMessagesForRole({
      messages: schoolMsgs,
      role: session.role,
      linkedStudentId: linkedStudent?.id,
      teacherAssignedClassIds,
    });
  }, [dataset.parent_staff_messages, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const unreadParentChatCount = useMemo(() => {
    if (!session || session.role === 'student') return 0;
    return computeUnreadParentChatCount(parentStaffMessages, session.role);
  }, [parentStaffMessages, session]);

  // Real-time cross-tab sync via native BroadcastChannel (`school_parent_chat_<schoolId>`)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(getParentChatChannelName(resolvedSchoolId));
    channel.onmessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type: 'chat_message'; message: ParentStaffMessage }
        | { type: 'chat_read'; studentId: string; channelType: ParentChatChannelType; reader: 'parent' | 'staff' }
        | undefined;
      if (!payload) return;
      if (payload.type === 'chat_message' && payload.message?.schoolId === resolvedSchoolId) {
        setDataset((prev) => {
          const exists = prev.parent_staff_messages.some((m) => m.id === payload.message.id);
          if (exists) return prev;
          return {
            ...prev,
            parent_staff_messages: [...prev.parent_staff_messages, payload.message],
          };
        });
      } else if (payload.type === 'chat_read') {
        setDataset((prev) => ({
          ...prev,
          parent_staff_messages: prev.parent_staff_messages.map((m) => {
            if (
              m.schoolId === resolvedSchoolId &&
              m.studentId === payload.studentId &&
              m.channelType === payload.channelType
            ) {
              return payload.reader === 'parent'
                ? { ...m, readByParent: true }
                : { ...m, readByStaff: true };
            }
            return m;
          }),
        }));
      }
    };
    return () => {
      channel.close();
    };
  }, [resolvedSchoolId]);

  // --- PHASE 4 STRICTLY SCOPED DATASETS ---
  const classChatRooms = useMemo(() => {
    if (!session) return [];
    const list = dataset.class_chat_rooms.filter((r) => r.schoolId === resolvedSchoolId);
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((r) => r.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((r) => teacherAssignedClassIds.includes(r.classId));
    }
    return list;
  }, [dataset.class_chat_rooms, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  const classChatMessages = useMemo(() => {
    if (!session) return [];
    const list = dataset.class_chat_messages
      .filter((m) => m.schoolId === resolvedSchoolId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((m) => m.classId === linkedStudent.classId) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((m) => teacherAssignedClassIds.includes(m.classId));
    }
    return list;
  }, [dataset.class_chat_messages, resolvedSchoolId, session, isParentOrStudent, linkedStudent, teacherAssignedClassIds]);

  // Real-time cross-tab sync via native BroadcastChannel (`school_class_chat_<schoolId>`)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(getClassChatChannelName(resolvedSchoolId));
    channel.onmessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type: 'class_chat_message'; message: ClassChatMessage }
        | { type: 'class_chat_room'; room: ClassChatRoomConfig }
        | undefined;
      if (!payload) return;
      if (payload.type === 'class_chat_message' && payload.message?.schoolId === resolvedSchoolId) {
        setDataset((prev) => {
          const exists = prev.class_chat_messages.some((m) => m.id === payload.message.id);
          return {
            ...prev,
            class_chat_messages: exists
              ? prev.class_chat_messages.map((m) =>
                  m.id === payload.message.id ? payload.message : m
                )
              : [...prev.class_chat_messages, payload.message],
          };
        });
      } else if (payload.type === 'class_chat_room' && payload.room?.schoolId === resolvedSchoolId) {
        setDataset((prev) => {
          const filtered = prev.class_chat_rooms.filter(
            (r) => !(r.schoolId === payload.room.schoolId && r.classId === payload.room.classId)
          );
          return {
            ...prev,
            class_chat_rooms: [...filtered, payload.room],
          };
        });
      }
    };
    return () => {
      channel.close();
    };
  }, [resolvedSchoolId]);

  const appointmentSlots = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const list = dataset.appointment_slots
      .filter((s) => s.schoolId === resolvedSchoolId)
      .sort((a, b) =>
        `${a.jalaliDate} ${a.startTime}`.localeCompare(`${b.jalaliDate} ${b.startTime}`)
      );
    if (session.role === 'parent') {
      if (!linkedStudent) return [];
      return list
        .filter((s) => {
          const targetsChildClass =
            s.targetClassIds.length === 0 || s.targetClassIds.includes(linkedStudent.classId);
          if (!targetsChildClass) return false;
          // Parents see open slots OR slots booked for their own child (never other families' bookings)
          return s.status === 'open' || s.bookedStudentId === linkedStudent.id;
        })
        .map((s) => ({
          ...s,
          // Keep staff-only meeting outcome notes strictly confidential
          meetingOutcomeNotes: undefined,
        }));
    }
    if (session.role === 'teacher') {
      return list.filter(
        (s) =>
          (linkedTeacher && s.linkedTeacherId === linkedTeacher.id) ||
          (s.bookedClassId && teacherAssignedClassIds.includes(s.bookedClassId)) ||
          s.targetClassIds.some((cid) => teacherAssignedClassIds.includes(cid))
      );
    }
    return list;
  }, [dataset.appointment_slots, resolvedSchoolId, session, linkedStudent, linkedTeacher, teacherAssignedClassIds]);

  const electronicForms = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const list = dataset.electronic_forms
      .filter((f) => f.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'parent') {
      if (!linkedStudent) return [];
      return list.filter(
        (f) =>
          f.active &&
          (f.targetAudience === 'all_school' || f.targetClassIds.includes(linkedStudent.classId))
      );
    }
    if (session.role === 'teacher') {
      return list.filter(
        (f) =>
          f.targetAudience === 'all_school' ||
          f.targetClassIds.some((cid) => teacherAssignedClassIds.includes(cid))
      );
    }
    return list;
  }, [dataset.electronic_forms, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const electronicFormResponses = useMemo(() => {
    if (!session || session.role === 'student') return [];
    const list = dataset.electronic_form_responses
      .filter((r) => r.schoolId === resolvedSchoolId)
      .sort((a, b) => b.submittedAtIso.localeCompare(a.submittedAtIso));
    if (session.role === 'parent') {
      return linkedStudent ? list.filter((r) => r.studentId === linkedStudent.id) : [];
    }
    if (session.role === 'teacher') {
      return list.filter((r) => teacherAssignedClassIds.includes(r.classId));
    }
    return list;
  }, [dataset.electronic_form_responses, resolvedSchoolId, session, linkedStudent, teacherAssignedClassIds]);

  const notificationTemplates = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    return dataset.notification_templates
      .filter((t) => t.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [dataset.notification_templates, resolvedSchoolId, session, isParentOrStudent]);

  // --- PHASE 5 STRICTLY SCOPED DATASETS ---
  const sidaGradeAuditLogs = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    const list = dataset.sida_grade_audit_logs
      .filter((l) => l.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'teacher') {
      return list.filter((l) => teacherAssignedClassIds.includes(l.classId));
    }
    return list;
  }, [dataset.sida_grade_audit_logs, resolvedSchoolId, session, isParentOrStudent, teacherAssignedClassIds]);

  const inPersonExamHalls = useMemo(() => {
    if (!session) return [];
    return dataset.in_person_exam_halls
      .filter((h) => h.schoolId === resolvedSchoolId)
      .sort((a, b) => a.startSeatNumber - b.startSeatNumber);
  }, [dataset.in_person_exam_halls, resolvedSchoolId, session]);

  const inPersonExamSessions = useMemo(() => {
    if (!session) return [];
    const list = dataset.in_person_exam_sessions
      .filter((s) => s.schoolId === resolvedSchoolId)
      .sort((a, b) => `${a.jalaliDate} ${a.startTime}`.localeCompare(`${b.jalaliDate} ${b.startTime}`));
    if (isParentOrStudent) {
      return linkedStudent ? list.filter((s) => s.classIds.includes(linkedStudent.classId)) : [];
    }
    return list;
  }, [dataset.in_person_exam_sessions, resolvedSchoolId, session, isParentOrStudent, linkedStudent]);

  const examSeatingCharts = useMemo(() => {
    if (!session) return [];
    const list = dataset.exam_seating_charts
      .filter((c) => c.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (isParentOrStudent) {
      if (!linkedStudent) return [];
      // Privacy guard: parent/student ONLY sees their own seat entry, never other classmates' seat assignments
      return list
        .filter((c) => c.assignments.some((a) => a.studentId === linkedStudent.id))
        .map((c) => ({
          ...c,
          assignments: c.assignments.map((a) =>
            a.studentId === linkedStudent.id
              ? a
              : { ...a, studentId: null, classId: undefined }
          ),
        }));
    }
    return list;
  }, [dataset.exam_seating_charts, resolvedSchoolId, session, isParentOrStudent, linkedStudent]);

  const studentProfiles = useMemo(() => {
    if (!session) return [];
    const list = dataset.student_profiles.filter((p) => p.schoolId === resolvedSchoolId);
    if (isParentOrStudent) {
      if (!linkedStudent) return [];
      return list
        .filter((p) => p.studentId === linkedStudent.id)
        .map((p) => ({ ...p, confidentialAdminNotes: undefined }));
    }
    if (session.role === 'teacher') {
      const allowedStudentIds = new Set(
        dataset.students
          .filter(
            (st) => st.schoolId === resolvedSchoolId && teacherAssignedClassIds.includes(st.classId)
          )
          .map((st) => st.id)
      );
      return list
        .filter((p) => allowedStudentIds.has(p.studentId))
        .map((p) => ({ ...p, confidentialAdminNotes: undefined }));
    }
    return list;
  }, [
    dataset.student_profiles,
    dataset.students,
    resolvedSchoolId,
    session,
    isParentOrStudent,
    linkedStudent,
    teacherAssignedClassIds,
  ]);

  const staffProfiles = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    const list = dataset.staff_profiles.filter((p) => p.schoolId === resolvedSchoolId);
    if (session.role === 'teacher') {
      if (!linkedTeacher) return [];
      return list
        .filter((p) => p.teacherId === linkedTeacher.id)
        .map((p) => ({ ...p, confidentialEvaluationNotes: undefined }));
    }
    if (!roleDef.canViewConfidentialStaffEvaluation) {
      return list.map((p) => ({ ...p, confidentialEvaluationNotes: undefined }));
    }
    return list;
  }, [
    dataset.staff_profiles,
    resolvedSchoolId,
    session,
    isParentOrStudent,
    linkedTeacher,
    roleDef.canViewConfidentialStaffEvaluation,
  ]);

  const sidaSpeedEntryTicks = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    const list = dataset.sida_speed_entry_ticks.filter((t) => t.schoolId === resolvedSchoolId);
    if (session.role === 'teacher') {
      return list.filter((t) => teacherAssignedClassIds.includes(t.classId));
    }
    return list;
  }, [dataset.sida_speed_entry_ticks, resolvedSchoolId, session, isParentOrStudent, teacherAssignedClassIds]);

  const userAppearancePref = useMemo<UserAppearancePreference | null>(() => {
    if (!session) return null;
    return (
      dataset.user_appearance_prefs.find(
        (p) => p.schoolId === resolvedSchoolId && p.userId === session.userId
      ) ?? null
    );
  }, [dataset.user_appearance_prefs, resolvedSchoolId, session]);

  const schoolBrandingConfig = useMemo<SchoolBrandingConfig | null>(() => {
    return (
      dataset.school_branding_configs.find((c) => c.schoolId === resolvedSchoolId) ?? null
    );
  }, [dataset.school_branding_configs, resolvedSchoolId]);

  const schoolBrandingConfigs = useMemo<SchoolBrandingConfig[]>(() => {
    if (!session) return [];
    if (activeRole === 'super_admin') {
      return dataset.school_branding_configs;
    }
    if (activeRole === 'complex_admin') {
      const allowedIds = new Set(schools.map((s) => s.id));
      return dataset.school_branding_configs.filter((c) => allowedIds.has(c.schoolId));
    }
    // Strictly isolated to current schoolId for principal and all other roles
    return dataset.school_branding_configs.filter((c) => c.schoolId === resolvedSchoolId);
  }, [activeRole, dataset.school_branding_configs, resolvedSchoolId, schools, session]);

  // --- Phase 6 Strictly Role-Scoped & School-Scoped Datasets ---
  const financeFeePlans = useMemo(() => {
    if (!session || !roleDef.canAccessFinance || session.role === 'parent') return [];
    return dataset.finance_fee_plans.filter((p) => p.schoolId === resolvedSchoolId);
  }, [dataset.finance_fee_plans, resolvedSchoolId, session, roleDef.canAccessFinance]);

  const financeLedgers = useMemo(() => {
    if (!session || !roleDef.canAccessFinance) return [];
    const list = dataset.finance_student_ledgers.filter((l) => l.schoolId === resolvedSchoolId);
    if (session.role === 'parent') {
      if (!linkedStudent) return [];
      return list.filter((l) => l.studentId === linkedStudent.id);
    }
    return list;
  }, [dataset.finance_student_ledgers, resolvedSchoolId, session, roleDef.canAccessFinance, linkedStudent]);

  const financePayments = useMemo(() => {
    if (!session || !roleDef.canAccessFinance) return [];
    const list = dataset.finance_payments
      .filter((p) => p.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'parent') {
      if (!linkedStudent) return [];
      return list.filter((p) => p.studentId === linkedStudent.id);
    }
    return list;
  }, [dataset.finance_payments, resolvedSchoolId, session, roleDef.canAccessFinance, linkedStudent]);

  const financeExpenses = useMemo(() => {
    if (!session || !roleDef.canAccessFinance || session.role === 'parent') return [];
    return dataset.finance_expenses
      .filter((e) => e.schoolId === resolvedSchoolId)
      .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate));
  }, [dataset.finance_expenses, resolvedSchoolId, session, roleDef.canAccessFinance]);

  const remedialPlans = useMemo(() => {
    if (!session || !roleDef.canAccessSmartAnalytics) return [];
    const list = dataset.remedial_plans
      .filter((r) => r.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (session.role === 'teacher') {
      return list.filter((r) => teacherAssignedClassIds.includes(r.classId));
    }
    return list;
  }, [
    dataset.remedial_plans,
    resolvedSchoolId,
    session,
    roleDef.canAccessSmartAnalytics,
    teacherAssignedClassIds,
  ]);

  const anonymousSurveys = useMemo(() => {
    if (!session) return [];
    const list = dataset.anonymous_surveys
      .filter((s) => s.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (roleDef.canManageSurveys) {
      return list;
    }
    if (session.role === 'teacher' || session.role === 'parent' || session.role === 'student') {
      const targetRole: SurveyAudienceRole = session.role;
      return list.filter((s) => s.status === 'active' && s.targetRoles.includes(targetRole));
    }
    return [];
  }, [dataset.anonymous_surveys, resolvedSchoolId, session, roleDef.canManageSurveys]);

  const surveyParticipationReceipts = useMemo(() => {
    if (!session) return [];
    return dataset.survey_participation_receipts.filter((r) => r.schoolId === resolvedSchoolId);
  }, [dataset.survey_participation_receipts, resolvedSchoolId, session]);

  const surveyAnonymousResponses = useMemo(() => {
    // Strictly visible only to management roles; participants never see raw responses
    if (!session || !roleDef.canManageSurveys) return [];
    return dataset.survey_anonymous_responses.filter((r) => r.schoolId === resolvedSchoolId);
  }, [dataset.survey_anonymous_responses, resolvedSchoolId, session, roleDef.canManageSurveys]);

  const complexPhase6Dataset = useMemo<ComplexPhase6Dataset | null>(() => {
    if (!session || !roleDef.canViewComplexComparison) return null;
    const inScope = (schoolId: string) => visibleSchoolIdSet.has(schoolId);
    return {
      schools,
      classes: dataset.classes.filter((x) => inScope(x.schoolId)),
      students: dataset.students.filter((x) => inScope(x.schoolId)),
      teachers: dataset.teachers.filter((x) => inScope(x.schoolId)),
      gradebookEntries: dataset.gradebook_entries.filter((x) => inScope(x.schoolId)),
      studentAttendance: dataset.student_attendance.filter((x) => inScope(x.schoolId)),
      homeworkAssignments: dataset.homework_assignments.filter((x) => inScope(x.schoolId)),
      homeworkSubmissions: dataset.homework_submissions.filter((x) => inScope(x.schoolId)),
      onlineExams: dataset.online_exams.filter((x) => inScope(x.schoolId)),
      onlineExamSubmissions: dataset.online_exam_submissions.filter((x) => inScope(x.schoolId)),
      flippedTelemetry: dataset.flipped_telemetry.filter((x) => inScope(x.schoolId)),
      remedialPlans: dataset.remedial_plans.filter((x) => inScope(x.schoolId)),
      financeLedgers: dataset.finance_student_ledgers.filter((x) => inScope(x.schoolId)),
      financePayments: dataset.finance_payments.filter((x) => inScope(x.schoolId)),
      financeExpenses: dataset.finance_expenses.filter((x) => inScope(x.schoolId)),
      anonymousSurveys: dataset.anonymous_surveys.filter((x) => inScope(x.schoolId)),
      surveyAnonymousResponses: dataset.survey_anonymous_responses.filter((x) =>
        inScope(x.schoolId)
      ),
      surveyParticipationReceipts: dataset.survey_participation_receipts.filter((x) =>
        inScope(x.schoolId)
      ),
    };
  }, [session, roleDef.canViewComplexComparison, schools, visibleSchoolIdSet, dataset]);

  // --- Phase 7 Strictly Role-Scoped & School-Scoped Teacher Development Datasets ---
  const tdCourses = useMemo(() => {
    if (!session || !roleDef.canAccessTeacherDev) return [];
    const list = dataset.td_courses
      .filter((c) => c.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'teacher') {
      return list.filter((c) => c.status === 'active');
    }
    return list;
  }, [dataset.td_courses, resolvedSchoolId, session, roleDef.canAccessTeacherDev]);

  const tdProgress = useMemo(() => {
    if (!session || !roleDef.canAccessTeacherDev) return [];
    const list = dataset.td_progress.filter((p) => p.schoolId === resolvedSchoolId);
    if (session.role === 'teacher') {
      if (!linkedTeacher) return [];
      return list.filter((p) => p.teacherId === linkedTeacher.id);
    }
    return list;
  }, [dataset.td_progress, resolvedSchoolId, session, roleDef.canAccessTeacherDev, linkedTeacher]);

  const tdCertificates = useMemo(() => {
    if (!session || !roleDef.canAccessTeacherDev) return [];
    const list = dataset.td_certificates
      .filter((c) => c.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (session.role === 'teacher') {
      if (!linkedTeacher) return [];
      return list.filter((c) => c.teacherId === linkedTeacher.id);
    }
    return list;
  }, [dataset.td_certificates, resolvedSchoolId, session, roleDef.canAccessTeacherDev, linkedTeacher]);

  const tdSchoolSettings = useMemo<TeacherDevSchoolSettings>(() => {
    const existing = dataset.td_school_settings.find((s) => s.schoolId === resolvedSchoolId);
    if (existing) return existing;
    return {
      id: `${resolvedSchoolId}:tdsettings`,
      schoolId: resolvedSchoolId,
      rankingPrivacyMode: 'private',
      updatedByName: activeSchool?.principalName ?? 'مدیریت مدرسه',
      updatedAt: new Date().toISOString(),
    };
  }, [dataset.td_school_settings, resolvedSchoolId, activeSchool?.principalName]);

  const tdLeaderboard = useMemo<PrivacyFilteredLeaderboard>(() => {
    if (!session || !roleDef.canAccessTeacherDev) {
      return {
        privacyMode: 'private',
        visibleRows: [],
        ownStanding: null,
        totalTeachersCount: 0,
      };
    }
    const allRows = buildSchoolLeaderboard({
      schoolId: resolvedSchoolId,
      teachers: dataset.teachers,
      courses: dataset.td_courses,
      progressList: dataset.td_progress,
      certificates: dataset.td_certificates,
    });
    return applyLeaderboardPrivacy({
      allRows,
      privacyMode: tdSchoolSettings.rankingPrivacyMode,
      viewerIsManager: roleDef.canViewTeacherDevMatrix,
      currentTeacherId: linkedTeacher?.id ?? null,
    });
  }, [
    session,
    roleDef.canAccessTeacherDev,
    roleDef.canViewTeacherDevMatrix,
    resolvedSchoolId,
    dataset.teachers,
    dataset.td_courses,
    dataset.td_progress,
    dataset.td_certificates,
    tdSchoolSettings.rankingPrivacyMode,
    linkedTeacher?.id,
  ]);

  const complexPhase7Dataset = useMemo<ComplexPhase7Dataset | null>(() => {
    if (!session || !roleDef.canViewComplexComparison) return null;
    const inScope = (schoolId: string) => visibleSchoolIdSet.has(schoolId);
    return {
      schools,
      teachers: dataset.teachers.filter((x) => inScope(x.schoolId)),
      tdCourses: dataset.td_courses.filter((x) => inScope(x.schoolId)),
      tdProgress: dataset.td_progress.filter((x) => inScope(x.schoolId)),
      tdCertificates: dataset.td_certificates.filter((x) => inScope(x.schoolId)),
      tdSchoolSettings: dataset.td_school_settings.filter((x) => inScope(x.schoolId)),
    };
  }, [session, roleDef.canViewComplexComparison, schools, visibleSchoolIdSet, dataset]);

  const pluginStates = useMemo(
    () => dataset.school_plugin_states.filter((p) => p.schoolId === resolvedSchoolId),
    [dataset.school_plugin_states, resolvedSchoolId]
  );

  // --- PHASE 9A: ACADEMIC YEARS & MOCK / KONKUR EXAMS ---
  const academicYears = useMemo(
    () => [...dataset.academic_years].sort((a, b) => a.label.localeCompare(b.label)),
    [dataset.academic_years]
  );

  const allMockExamsForSchool = useMemo(() => {
    if (!session) return [];
    return dataset.mock_exams
      .filter((ex) => {
        if (ex.scope === 'complex') return true;
        if (roleDef.canSwitchSchool && visibleSchoolIdSet.has(ex.schoolId)) return true;
        return ex.schoolId === resolvedSchoolId;
      })
      .filter((ex) => {
        if ((session.role === 'student' || session.role === 'parent') && ex.status === 'draft') {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.examDateJalali.localeCompare(a.examDateJalali) || b.stageNumber - a.stageNumber);
  }, [dataset.mock_exams, session, roleDef.canSwitchSchool, visibleSchoolIdSet, resolvedSchoolId]);

  const allMockAttemptsForComplex = useMemo(() => {
    if (!session) return [];
    // For complex-wide Taraz & cohort analytics, we need cohort attempts across visible schools
    if (roleDef.canSwitchSchool) {
      return dataset.mock_exam_attempts.filter((a) => visibleSchoolIdSet.has(a.schoolId));
    }
    // Single-school staff, student, and parent can compute accurate complex-wide Taraz on coordinated exams
    // while UI strictly restricts personal detailed drill-down to own student / own school
    const complexExamIds = new Set(
      dataset.mock_exams.filter((e) => e.scope === 'complex').map((e) => e.id)
    );
    return dataset.mock_exam_attempts.filter(
      (a) => a.schoolId === resolvedSchoolId || complexExamIds.has(a.examId)
    );
  }, [dataset.mock_exam_attempts, dataset.mock_exams, session, roleDef.canSwitchSchool, visibleSchoolIdSet, resolvedSchoolId]);

  const mockExams = allMockExamsForSchool;
  const mockExamAttempts = useMemo(() => {
    if (!session) return [];
    if (session.role === 'student' || session.role === 'parent') {
      return linkedStudent
        ? dataset.mock_exam_attempts.filter((a) => a.studentId === linkedStudent.id)
        : [];
    }
    if (roleDef.canSwitchSchool) {
      return dataset.mock_exam_attempts.filter((a) => visibleSchoolIdSet.has(a.schoolId));
    }
    return dataset.mock_exam_attempts.filter((a) => a.schoolId === resolvedSchoolId);
  }, [dataset.mock_exam_attempts, session, linkedStudent, roleDef.canSwitchSchool, visibleSchoolIdSet, resolvedSchoolId]);

  // --- PHASE 9B: ADVANCED SIDA ANALYTICS ENGINE ---
  const sidaAppealWindows = useMemo(() => {
    if (!session) return [];
    return dataset.sida_appeal_windows.filter((w) => w.schoolId === resolvedSchoolId);
  }, [dataset.sida_appeal_windows, session, resolvedSchoolId]);

  const sidaRemedialGroups = useMemo(() => {
    if (!session || session.role === 'parent' || session.role === 'student') return [];
    const scoped = dataset.sida_remedial_groups.filter((g) => g.schoolId === resolvedSchoolId);
    if (session.role === 'teacher') {
      return scoped.filter(
        (g) => !g.classId || teacherAssignedClassIds.includes(g.classId)
      );
    }
    return scoped;
  }, [dataset.sida_remedial_groups, session, resolvedSchoolId, teacherAssignedClassIds]);

  const sidaClassBalancingDrafts = useMemo(() => {
    if (
      !session ||
      session.role === 'parent' ||
      session.role === 'student' ||
      session.role === 'teacher'
    ) {
      return [];
    }
    return dataset.sida_class_balancing_drafts.filter((d) => d.schoolId === resolvedSchoolId);
  }, [dataset.sida_class_balancing_drafts, session, resolvedSchoolId]);

  const sidaAnalyticsGrades = useMemo(() => {
    if (!session || session.role === 'parent' || session.role === 'student') return [];
    const scoped = dataset.sida_analytics_grades.filter((g) => g.schoolId === resolvedSchoolId);
    if (session.role === 'teacher') {
      const assignedSubjects = new Set(
        dataset.schedules
          .filter(
            (s) =>
              s.schoolId === resolvedSchoolId &&
              linkedTeacher &&
              s.teacherId === linkedTeacher.id
          )
          .map((s) => s.subjectName)
      );
      return scoped.filter((g) => {
        if (!teacherAssignedClassIds.includes(g.classId)) return false;
        if (assignedSubjects.size === 0) return true;
        return assignedSubjects.has(g.subject);
      });
    }
    return scoped;
  }, [
    dataset.sida_analytics_grades,
    dataset.schedules,
    session,
    resolvedSchoolId,
    teacherAssignedClassIds,
    linkedTeacher,
  ]);

  const collectionCounts = useMemo<CollectionCountMap>(() => {
    const counts: CollectionCountMap = {};
    for (const col of ALL_COLLECTIONS) {
      if (col === 'mock_exams') {
        counts[col] = dataset.mock_exams.filter(
          (item) => item.schoolId === resolvedSchoolId || item.scope === 'complex'
        ).length;
      } else {
        counts[col] = dataset[col].filter((item) => item.schoolId === resolvedSchoolId).length;
      }
    }
    return counts;
  }, [dataset, resolvedSchoolId]);

  const pluginStatuses = useMemo(
    () => buildPluginRuntimeStatuses(manifests, pluginStates, collectionCounts),
    [manifests, pluginStates, collectionCounts]
  );

  const isPluginEnabled = useCallback(
    (pluginId: string): boolean => {
      const status = pluginStatuses.find((p) => p.manifest.id === pluginId);
      return status ? status.installed && status.enabled : false;
    },
    [pluginStatuses]
  );

  const getPluginStatusesForSchool = useCallback(
    (schoolId: string): PluginRuntimeStatus[] => {
      const targetStates = dataset.school_plugin_states.filter((p) => p.schoolId === schoolId);
      const targetCounts: CollectionCountMap = {};
      for (const col of ALL_COLLECTIONS) {
        if (col === 'mock_exams') {
          targetCounts[col] = dataset.mock_exams.filter(
            (item) => item.schoolId === schoolId || item.scope === 'complex'
          ).length;
        } else {
          targetCounts[col] = dataset[col].filter((item) => item.schoolId === schoolId).length;
        }
      }
      return buildPluginRuntimeStatuses(manifests, targetStates, targetCounts);
    },
    [dataset, manifests]
  );

  // --- RBAC-GUARDED MUTATIONS ---
  const updatePluginStateForSchool = useCallback(
    async (
      schoolId: string,
      pluginId: string,
      action: 'enable' | 'disable' | 'uninstall' | 'install',
      applyToAllSchools = false
    ): Promise<MutationResult> => {
      if (activeRole !== 'super_admin' || !roleDef.canManageAddons) {
        return {
          ok: false,
          errorFa: 'مدیریت، نصب و تغییر وضعیت بسته‌های الحاقی منحصراً در اختیار راهبر ارشد سامانه است.',
        };
      }

      const targetSchoolIds =
        applyToAllSchools && roleDef.canBatchManageAllSchoolsAddons
          ? allSchools.map((s) => s.id)
          : [schoolId];

      for (const sid of targetSchoolIds) {
        const decision = authorizeMutation(authGuardContext, 'school_plugin_states', 'write', {
          schoolId: sid,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      const transitions = targetSchoolIds.map((sid) =>
        createPluginStateTransition({
          schoolId: sid,
          pluginId,
          action,
          updatedBy: session?.displayName ?? roleDef.labelFa,
        })
      );

      // Optimistic state update (NON-DESTRUCTIVE: only updates school_plugin_states!)
      setDataset((prev) => {
        const nextStates = [...prev.school_plugin_states];
        for (const tr of transitions) {
          const idx = nextStates.findIndex((s) => s.id === tr.id);
          if (idx >= 0) nextStates[idx] = tr;
          else nextStates.push(tr);
        }
        return { ...prev, school_plugin_states: nextStates };
      });

      await sharedRepository.putMany('school_plugin_states', transitions);

      const actionLabelFa =
        action === 'enable'
          ? 'فعال‌سازی'
          : action === 'disable'
            ? 'غیرفعال‌سازی'
            : action === 'install'
              ? 'نصب'
              : 'حذف نمایشی (با حفظ داده‌ها)';
      const manifestName = manifests.find((m) => m.id === pluginId)?.nameFa ?? pluginId;
      const scopeName = applyToAllSchools
        ? 'تمامی مدارس مجموعه'
        : (allSchools.find((s) => s.id === schoolId)?.name ?? schoolId);

      logSecurityEvent({
        eventType: 'plugin_toggled',
        schoolId: applyToAllSchools ? GLOBAL_TENANT_ID : schoolId,
        username: session?.username ?? 'super_admin',
        displayName: session?.displayName,
        role: activeRole,
        detailsFa: `${actionLabelFa} بسته «${manifestName}» برای ${scopeName}`,
      });

      return { ok: true };
    },
    [activeRole, roleDef, allSchools, authGuardContext, session, manifests, logSecurityEvent]
  );

  const updatePluginState = useCallback(
    async (
      pluginId: string,
      action: 'enable' | 'disable' | 'uninstall' | 'install',
      applyToAllSchools = false
    ): Promise<MutationResult> => {
      return updatePluginStateForSchool(resolvedSchoolId, pluginId, action, applyToAllSchools);
    },
    [resolvedSchoolId, updatePluginStateForSchool]
  );

  const upsertStudentAttendance = useCallback(
    (record: StudentAttendanceRecord): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'student_attendance', 'write', {
        schoolId: record.schoolId,
        classId: record.classId,
        record,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.student_attendance];
        const idx = list.findIndex((r) => r.id === record.id);
        if (idx >= 0) list[idx] = record;
        else list.push(record);
        return { ...prev, student_attendance: list };
      });
      void sharedRepository.putItem('student_attendance', record).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertStaffAttendance = useCallback(
    (record: StaffAttendanceRecord): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'staff_attendance', 'write', {
        schoolId: record.schoolId,
        record,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.staff_attendance];
        const idx = list.findIndex((r) => r.id === record.id);
        if (idx >= 0) list[idx] = record;
        else list.push(record);
        return { ...prev, staff_attendance: list };
      });
      void sharedRepository.putItem('staff_attendance', record).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertSubstitution = useCallback(
    (record: SubstitutionRecord): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'substitutions', 'write', {
        schoolId: record.schoolId,
        record,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.substitutions];
        const idx = list.findIndex((r) => r.id === record.id);
        if (idx >= 0) list[idx] = record;
        else list.push(record);
        return { ...prev, substitutions: list };
      });
      void sharedRepository.putItem('substitutions', record).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteSubstitution = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'substitutions', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        substitutions: prev.substitutions.filter(
          (s) => !(s.id === id && s.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('substitutions', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const addDailyLog = useCallback(
    (rawEntry: DailyLogEntry): MutationResult => {
      const entry: DailyLogEntry = {
        ...rawEntry,
        title: sanitizeText(rawEntry.title, 200),
        description: sanitizeText(rawEntry.description, 2000),
      };
      const decision = authorizeMutation(authGuardContext, 'daily_logs', 'write', {
        schoolId: entry.schoolId,
        classId: entry.classId,
        record: entry,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        daily_logs: [entry, ...prev.daily_logs],
      }));
      void sharedRepository.putItem('daily_logs', entry).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteDailyLog = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'daily_logs', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        daily_logs: prev.daily_logs.filter(
          (l) => !(l.id === id && l.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('daily_logs', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const updateActiveSchool = useCallback(
    async (updated: School): Promise<MutationResult> => {
      const decision = authorizeMutation(authGuardContext, 'schools', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        schools: prev.schools.map((s) => (s.id === updated.id ? updated : s)),
      }));
      await sharedRepository.saveSchool(updated);
      return { ok: true };
    },
    [authGuardContext]
  );

  const importStudentsBatch = useCallback(
    async (rawStudents: Student[]): Promise<MutationResult> => {
      if (rawStudents.length === 0) return { ok: true };
      const newStudents = rawStudents.map(ensureStudentDualCredentials);
      for (const st of newStudents) {
        const decision = authorizeMutation(authGuardContext, 'students', 'write', {
          schoolId: st.schoolId,
          classId: st.classId,
          record: st,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      setDataset((prev) => {
        const next = [...prev.students];
        for (const st of newStudents) {
          const idx = next.findIndex((x) => x.id === st.id);
          if (idx >= 0) next[idx] = st;
          else next.push(st);
        }
        return { ...prev, students: next };
      });
      await sharedRepository.putMany('students', newStudents);
      return { ok: true };
    },
    [authGuardContext]
  );

  const importTeachersBatch = useCallback(
    async (rawTeachers: Teacher[]): Promise<MutationResult> => {
      if (rawTeachers.length === 0) return { ok: true };
      const newTeachers = rawTeachers.map((t) =>
        ensureTeacherHashed({
          ...t,
          fullName: sanitizeText(t.fullName, 140),
          specialty: sanitizeText(t.specialty, 120),
        })
      );
      for (const teacher of newTeachers) {
        const decision = authorizeMutation(authGuardContext, 'teachers', 'write', {
          schoolId: teacher.schoolId,
          record: teacher,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }
      setDataset((prev) => {
        const next = [...prev.teachers];
        for (const t of newTeachers) {
          const idx = next.findIndex((x) => x.id === t.id);
          if (idx >= 0) next[idx] = t;
          else next.push(t);
        }
        return { ...prev, teachers: next };
      });
      await sharedRepository.putMany('teachers', newTeachers);
      return { ok: true };
    },
    [authGuardContext]
  );

  // --- Phase 1.5 Directory CRUD ---
  const upsertStudent = useCallback(
    async (rawStudent: Student): Promise<MutationResult> => {
      const sanitizedRaw: Student = {
        ...rawStudent,
        fullName: sanitizeText(rawStudent.fullName, 140),
        fatherName: sanitizeText(rawStudent.fatherName, 120),
        emergencyNotes: rawStudent.emergencyNotes
          ? sanitizeText(rawStudent.emergencyNotes, 600)
          : rawStudent.emergencyNotes,
      };
      const student = ensureStudentDualCredentials(sanitizedRaw);
      const decision = authorizeMutation(authGuardContext, 'students', 'write', {
        schoolId: student.schoolId,
        classId: student.classId,
        record: student,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      const isNew = !dataset.students.some((s) => s.id === student.id);
      setDataset((prev) => {
        const list = [...prev.students];
        const idx = list.findIndex((s) => s.id === student.id);
        if (idx >= 0) list[idx] = student;
        else list.unshift(student);
        return { ...prev, students: list };
      });
      await sharedRepository.putItem('students', student);
      if (isNew && session) {
        logSecurityEvent({
          eventType: 'user_created',
          schoolId: student.schoolId,
          username: student.studentUsername ?? student.nationalId,
          displayName: student.fullName,
          role: 'student',
          detailsFa: `ایجاد حساب دانش‌آموز و ولی برای «${student.fullName}» توسط ${session.displayName}`,
        });
      }
      return { ok: true };
    },
    [authGuardContext, dataset.students, session, logSecurityEvent]
  );

  const setStudentActiveStatus = useCallback(
    async (studentId: string, active: boolean): Promise<MutationResult> => {
      const existing = dataset.students.find(
        (s) => s.id === studentId && s.schoolId === resolvedSchoolId
      );
      if (!existing) return { ok: false, errorFa: 'دانش‌آموز یافت نشد.' };

      const updated: Student = { ...existing, active };
      return upsertStudent(updated);
    },
    [dataset.students, resolvedSchoolId, upsertStudent]
  );

  const deleteStudentPermanently = useCallback(
    async (studentId: string): Promise<MutationResult> => {
      const decision = authorizeMutation(authGuardContext, 'students', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        students: prev.students.filter(
          (s) => !(s.id === studentId && s.schoolId === resolvedSchoolId)
        ),
      }));
      await sharedRepository.deleteItem('students', resolvedSchoolId, studentId);
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertClassRoom = useCallback(
    async (cls: ClassRoom): Promise<MutationResult> => {
      const decision = authorizeMutation(authGuardContext, 'classes', 'write', {
        schoolId: cls.schoolId,
        record: cls,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.classes];
        const idx = list.findIndex((c) => c.id === cls.id);
        if (idx >= 0) list[idx] = cls;
        else list.push(cls);
        return { ...prev, classes: list };
      });
      await sharedRepository.putItem('classes', cls);
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertTeacherWithSchedule = useCallback(
    async (teacher: Teacher, teacherSlots: ScheduleSlot[]): Promise<MutationResult> => {
      const teacherDecision = authorizeMutation(authGuardContext, 'teachers', 'write', {
        schoolId: teacher.schoolId,
        record: teacher,
      });
      if (!teacherDecision.allowed) return { ok: false, errorFa: teacherDecision.reasonFa };

      const schedDecision = authorizeMutation(authGuardContext, 'schedules', 'write', {
        schoolId: teacher.schoolId,
      });
      if (!schedDecision.allowed) return { ok: false, errorFa: schedDecision.reasonFa };

      const existingTeacherSlots = dataset.schedules.filter(
        (s) => s.schoolId === teacher.schoolId && s.teacherId === teacher.id
      );

      setDataset((prev) => {
        const nextTeachers = [...prev.teachers];
        const tIdx = nextTeachers.findIndex((t) => t.id === teacher.id);
        if (tIdx >= 0) nextTeachers[tIdx] = teacher;
        else nextTeachers.push(teacher);

        // Replace this teacher's schedule slots in active school cleanly
        const otherSlots = prev.schedules.filter(
          (s) => !(s.schoolId === teacher.schoolId && s.teacherId === teacher.id)
        );
        return {
          ...prev,
          teachers: nextTeachers,
          schedules: [...otherSlots, ...teacherSlots],
        };
      });

      await sharedRepository.putItem('teachers', teacher);
      // Remove obsolete slots for this teacher and persist updated slots
      const newIds = new Set(teacherSlots.map((s) => s.id));
      for (const old of existingTeacherSlots) {
        if (!newIds.has(old.id)) {
          await sharedRepository.deleteItem('schedules', teacher.schoolId, old.id);
        }
      }
      if (teacherSlots.length > 0) {
        await sharedRepository.putMany('schedules', teacherSlots);
      }
      return { ok: true };
    },
    [authGuardContext, dataset.schedules]
  );

  // --- Phase 2 RBAC-Guarded Optimistic Mutations ---
  const upsertScheduleSlot = useCallback(
    (slot: ScheduleSlot): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'schedules', 'write', {
        schoolId: slot.schoolId,
        classId: slot.classId,
        record: slot,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.schedules];
        const idx = list.findIndex((s) => s.id === slot.id);
        if (idx >= 0) list[idx] = slot;
        else list.push(slot);
        return { ...prev, schedules: list };
      });
      void sharedRepository.putItem('schedules', slot).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteScheduleSlot = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'schedules', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        schedules: prev.schedules.filter((s) => !(s.id === id && s.schoolId === resolvedSchoolId)),
      }));
      void sharedRepository.deleteItem('schedules', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertCurriculumTopic = useCallback(
    (topic: CurriculumTopic): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'curriculum_topics', 'write', {
        schoolId: topic.schoolId,
        record: topic,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.curriculum_topics];
        const idx = list.findIndex((t) => t.id === topic.id);
        if (idx >= 0) list[idx] = topic;
        else list.push(topic);
        return { ...prev, curriculum_topics: list };
      });
      void sharedRepository.putItem('curriculum_topics', topic).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const toggleCurriculumClassCompletion = useCallback(
    (topicId: string, classId: string): MutationResult => {
      const existing = dataset.curriculum_topics.find(
        (t) => t.id === topicId && t.schoolId === resolvedSchoolId
      );
      if (!existing) return { ok: false, errorFa: 'سرفصل مورد نظر یافت نشد.' };
      if (session?.role === 'teacher' && !teacherAssignedClassIds.includes(classId)) {
        return { ok: false, errorFa: 'معلم فقط مجاز به تغییر پیشرفت کلاس‌های خود است.' };
      }

      const hasCompleted = existing.completedClassIds.includes(classId);
      const updated: CurriculumTopic = {
        ...existing,
        completedClassIds: hasCompleted
          ? existing.completedClassIds.filter((id) => id !== classId)
          : [...existing.completedClassIds, classId],
        updatedAt: new Date().toISOString(),
      };
      return upsertCurriculumTopic(updated);
    },
    [dataset.curriculum_topics, resolvedSchoolId, session?.role, teacherAssignedClassIds, upsertCurriculumTopic]
  );

  const deleteCurriculumTopic = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'curriculum_topics', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        curriculum_topics: prev.curriculum_topics.filter(
          (t) => !(t.id === id && t.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('curriculum_topics', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const addMediaResource = useCallback(
    (resource: MediaResource): MutationResult => {
      const sanitizedResource: MediaResource = {
        ...resource,
        title: sanitizeText(resource.title, 180),
        description: sanitizeText(resource.description, 1000),
      };
      const decision = authorizeMutation(authGuardContext, 'media_resources', 'write', {
        schoolId: sanitizedResource.schoolId,
        record: sanitizedResource,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      const nowIso = new Date().toISOString();
      const archiveCopy: SmartContentArchiveItem = {
        id: `arch-md-${sanitizedResource.id}`,
        complexId: activeSchool.complexId ?? 'complex-1',
        schoolId: sanitizedResource.schoolId,
        academicYearId: activeSchool.academicYear || '1404-1405',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        createdByUserId: session?.userId ?? 'staff',
        title: sanitizedResource.title,
        contentType: 'handout',
        subject: sanitizedResource.subject,
        gradeLevel: sanitizedResource.gradeLevel,
        gradeLabel: `پایه ${sanitizedResource.gradeLevel}`,
        teacherId: session?.linkedTeacherId ?? session?.userId ?? 'staff',
        teacherName: sanitizedResource.uploadedByName,
        description: sanitizedResource.description,
        url: sanitizedResource.url,
        attachmentName: sanitizedResource.fileName,
        tags: [sanitizedResource.subject, 'جزوه و محتوا', sanitizedResource.kind],
        sourceEntityId: sanitizedResource.id,
        reuseCount: 0,
        reusedInClassIds: [],
        createdAtJalali: sanitizedResource.createdAtJalali || getTodayJalali(),
      };

      setDataset((prev) => ({
        ...prev,
        media_resources: [sanitizedResource, ...prev.media_resources],
        smart_content_archive: [
          archiveCopy,
          ...prev.smart_content_archive.filter((a) => a.id !== archiveCopy.id),
        ],
      }));
      void sharedRepository.putItem('media_resources', sanitizedResource).catch(() => {});
      void sharedRepository.putItem('smart_content_archive', archiveCopy).catch(() => {});
      return { ok: true };
    },
    [activeSchool.academicYear, activeSchool.complexId, authGuardContext, session]
  );

  const deleteMediaResource = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'media_resources', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        media_resources: prev.media_resources.filter(
          (m) => !(m.id === id && m.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('media_resources', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const sendMediaToClassChat = useCallback(
    (item: ChatOutboxItem): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'chat_outbox', 'write', {
        schoolId: item.schoolId,
        classId: item.classId,
        record: item,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        chat_outbox: [item, ...prev.chat_outbox],
      }));
      void sharedRepository.putItem('chat_outbox', item).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertGradebookEntry = useCallback(
    (entry: GradebookEntry): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'gradebook_entries', 'write', {
        schoolId: entry.schoolId,
        classId: entry.classId,
        record: entry,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.gradebook_entries];
        const idx = list.findIndex((g) => g.id === entry.id);
        if (idx >= 0) list[idx] = entry;
        else list.push(entry);
        return { ...prev, gradebook_entries: list };
      });
      void sharedRepository.putItem('gradebook_entries', entry).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertLessonPlan = useCallback(
    (plan: LessonPlanRecord): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'lesson_plans', 'write', {
        schoolId: plan.schoolId,
        classId: plan.classId,
        record: plan,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.lesson_plans];
        const idx = list.findIndex((lp) => lp.id === plan.id);
        if (idx >= 0) list[idx] = plan;
        else list.unshift(plan);
        return { ...prev, lesson_plans: list };
      });
      void sharedRepository.putItem('lesson_plans', plan).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteLessonPlan = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.lesson_plans.find((p) => p.id === id && p.schoolId === resolvedSchoolId);
      const decision = authorizeMutation(authGuardContext, 'lesson_plans', 'delete', {
        schoolId: resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        lesson_plans: prev.lesson_plans.filter(
          (lp) => !(lp.id === id && lp.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('lesson_plans', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.lesson_plans, resolvedSchoolId]
  );

  const upsertGradebookWeights = useCallback(
    (config: GradebookWeightConfig): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'gradebook_weights', 'write', {
        schoolId: config.schoolId,
        classId: config.classId,
        record: config,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.gradebook_weights];
        const idx = list.findIndex((w) => w.id === config.id);
        if (idx >= 0) list[idx] = config;
        else list.push(config);
        return { ...prev, gradebook_weights: list };
      });
      void sharedRepository.putItem('gradebook_weights', config).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertGradeAppeal = useCallback(
    (appeal: GradeAppeal): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'grade_appeals', 'write', {
        schoolId: appeal.schoolId,
        classId: appeal.classId,
        record: appeal,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.grade_appeals];
        const idx = list.findIndex((a) => a.id === appeal.id);
        if (idx >= 0) list[idx] = appeal;
        else list.unshift(appeal);
        return { ...prev, grade_appeals: list };
      });
      void sharedRepository.putItem('grade_appeals', appeal).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertHomeworkAssignment = useCallback(
    (assignment: HomeworkAssignment): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'homework_assignments', 'write', {
        schoolId: assignment.schoolId,
        classId: assignment.classId,
        record: assignment,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.homework_assignments];
        const idx = list.findIndex((h) => h.id === assignment.id);
        if (idx >= 0) list[idx] = assignment;
        else list.unshift(assignment);
        return { ...prev, homework_assignments: list };
      });
      void sharedRepository.putItem('homework_assignments', assignment).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteHomeworkAssignment = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.homework_assignments.find(
        (h) => h.id === id && h.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'homework_assignments', 'delete', {
        schoolId: resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        homework_assignments: prev.homework_assignments.filter(
          (h) => !(h.id === id && h.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('homework_assignments', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.homework_assignments, resolvedSchoolId]
  );

  const upsertHomeworkSubmission = useCallback(
    (submission: HomeworkSubmission): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'homework_submissions', 'write', {
        schoolId: submission.schoolId,
        classId: submission.classId,
        record: submission,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.homework_submissions];
        const idx = list.findIndex((s) => s.id === submission.id);
        if (idx >= 0) list[idx] = submission;
        else list.unshift(submission);
        return { ...prev, homework_submissions: list };
      });
      void sharedRepository.putItem('homework_submissions', submission).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const addStudentReward = useCallback(
    (reward: StudentReward): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'student_rewards', 'write', {
        schoolId: reward.schoolId,
        classId: reward.classId,
        record: reward,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        student_rewards: [reward, ...prev.student_rewards],
      }));
      void sharedRepository.putItem('student_rewards', reward).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteStudentReward = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'student_rewards', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        student_rewards: prev.student_rewards.filter(
          (r) => !(r.id === id && r.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('student_rewards', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertQuestionItem = useCallback(
    (item: QuestionBankItem): MutationResult => {
      const sanitizedItem: QuestionBankItem = {
        ...item,
        questionText: sanitizeText(item.questionText, 1200),
        chapter: sanitizeText(item.chapter, 160),
      };
      const decision = authorizeMutation(authGuardContext, 'question_bank', 'write', {
        schoolId: sanitizedItem.schoolId,
        record: sanitizedItem,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      const nowIso = new Date().toISOString();
      const archiveCopy: SmartContentArchiveItem = {
        id: `arch-qb-${sanitizedItem.id}`,
        complexId: activeSchool.complexId ?? 'complex-1',
        schoolId: sanitizedItem.schoolId,
        academicYearId: activeSchool.academicYear || '1404-1405',
        createdAtIso: sanitizedItem.createdAt || nowIso,
        updatedAtIso: nowIso,
        createdByUserId: sanitizedItem.createdById || session?.userId || 'staff',
        title: `${sanitizedItem.subject} — ${sanitizedItem.chapter}`,
        contentType: 'question',
        subject: sanitizedItem.subject,
        gradeLevel: sanitizedItem.gradeLevel,
        gradeLabel: sanitizedItem.gradeLabel,
        teacherId: sanitizedItem.createdById,
        teacherName: sanitizedItem.createdByName,
        description: sanitizedItem.questionText,
        tags: [sanitizedItem.subject, sanitizedItem.chapter, 'سوال امتحانی'],
        sourceEntityId: sanitizedItem.id,
        reuseCount: 0,
        reusedInClassIds: [],
        createdAtJalali: sanitizedItem.createdAtJalali || getTodayJalali(),
      };

      setDataset((prev) => {
        const list = [...prev.question_bank];
        const idx = list.findIndex((q) => q.id === sanitizedItem.id);
        if (idx >= 0) list[idx] = sanitizedItem;
        else list.unshift(sanitizedItem);
        const existingArch = prev.smart_content_archive.find((a) => a.id === archiveCopy.id);
        const mergedArch: SmartContentArchiveItem = existingArch
          ? {
              ...archiveCopy,
              reuseCount: existingArch.reuseCount,
              reusedInClassIds: existingArch.reusedInClassIds,
            }
          : archiveCopy;
        return {
          ...prev,
          question_bank: list,
          smart_content_archive: [
            mergedArch,
            ...prev.smart_content_archive.filter((a) => a.id !== archiveCopy.id),
          ],
        };
      });
      void sharedRepository.putItem('question_bank', sanitizedItem).catch(() => {});
      void sharedRepository.putItem('smart_content_archive', archiveCopy).catch(() => {});
      return { ok: true };
    },
    [activeSchool.academicYear, activeSchool.complexId, authGuardContext]
  );

  const deleteQuestionItem = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'question_bank', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        question_bank: prev.question_bank.filter(
          (q) => !(q.id === id && q.schoolId === resolvedSchoolId)
        ),
        exam_question_basket: prev.exam_question_basket.filter(
          (b) => !(b.questionId === id && b.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('question_bank', resolvedSchoolId, id).catch(() => {});
      void sharedRepository
        .deleteItem('exam_question_basket', resolvedSchoolId, `${resolvedSchoolId}:exambasket:${id}`)
        .catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const addClassChatDraft = useCallback(
    (draft: ClassChatDraftItem): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'class_chat_draft_queue', 'write', {
        schoolId: draft.schoolId,
        classId: draft.classId,
        record: draft,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        class_chat_draft_queue: [draft, ...prev.class_chat_draft_queue],
      }));
      void sharedRepository.putItem('class_chat_draft_queue', draft).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const addToExamBasket = useCallback(
    (items: ExamBasketItem[]): MutationResult => {
      if (items.length === 0) return { ok: true };
      for (const item of items) {
        const decision = authorizeMutation(authGuardContext, 'exam_question_basket', 'write', {
          schoolId: item.schoolId,
          record: item,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      setDataset((prev) => {
        const existingMap = new Map(prev.exam_question_basket.map((b) => [b.id, b]));
        for (const item of items) {
          existingMap.set(item.id, item);
        }
        return { ...prev, exam_question_basket: Array.from(existingMap.values()) };
      });
      void sharedRepository.putMany('exam_question_basket', items).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const removeFromExamBasket = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'exam_question_basket', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        exam_question_basket: prev.exam_question_basket.filter(
          (b) => !(b.id === id && b.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('exam_question_basket', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const clearExamBasket = useCallback((): MutationResult => {
    const decision = authorizeMutation(authGuardContext, 'exam_question_basket', 'delete', {
      schoolId: resolvedSchoolId,
    });
    if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

    const idsToDelete = dataset.exam_question_basket
      .filter((b) => b.schoolId === resolvedSchoolId)
      .map((b) => b.id);
    setDataset((prev) => ({
      ...prev,
      exam_question_basket: prev.exam_question_basket.filter((b) => b.schoolId !== resolvedSchoolId),
    }));
    for (const id of idsToDelete) {
      void sharedRepository.deleteItem('exam_question_basket', resolvedSchoolId, id).catch(() => {});
    }
    return { ok: true };
  }, [authGuardContext, dataset.exam_question_basket, resolvedSchoolId]);

  // --- Phase 3 RBAC-Guarded Optimistic Mutations ---
  const upsertFlippedLesson = useCallback(
    (lesson: FlippedVideoLesson): MutationResult => {
      const sanitizedLesson: FlippedVideoLesson = {
        ...lesson,
        title: sanitizeText(lesson.title, 200),
        description: lesson.description ? sanitizeText(lesson.description, 1000) : lesson.description,
      };
      const decision = authorizeMutation(authGuardContext, 'flipped_lessons', 'write', {
        schoolId: sanitizedLesson.schoolId,
        classId: sanitizedLesson.classId,
        record: sanitizedLesson,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      const targetCls = dataset.classes.find((c) => c.id === sanitizedLesson.classId);
      const gradeNum = targetCls?.gradeLevel ?? 3;
      const nowIso = new Date().toISOString();
      const archiveCopy: SmartContentArchiveItem = {
        id: `arch-fv-${sanitizedLesson.id}`,
        complexId: activeSchool.complexId ?? 'complex-1',
        schoolId: sanitizedLesson.schoolId,
        academicYearId: activeSchool.academicYear || '1404-1405',
        createdAtIso: sanitizedLesson.createdAt || nowIso,
        updatedAtIso: nowIso,
        createdByUserId: session?.userId ?? sanitizedLesson.teacherId ?? 'staff',
        title: sanitizedLesson.title,
        contentType: 'video',
        subject: sanitizedLesson.subject,
        gradeLevel: gradeNum,
        gradeLabel: targetCls?.customGradeLabel ?? `پایه ${gradeNum}`,
        teacherId: sanitizedLesson.teacherId,
        teacherName: sanitizedLesson.teacherName,
        description: sanitizedLesson.description ?? 'ویدیوی آموزشی ثبت‌شده در کلاس',
        tags: [sanitizedLesson.subject, 'ویدیو آموزشی'],
        sourceClassId: sanitizedLesson.classId,
        sourceEntityId: sanitizedLesson.id,
        reuseCount: 0,
        reusedInClassIds: [],
        createdAtJalali: sanitizedLesson.createdAtJalali || getTodayJalali(),
      };

      setDataset((prev) => {
        const list = [...prev.flipped_lessons];
        const idx = list.findIndex((l) => l.id === sanitizedLesson.id);
        if (idx >= 0) list[idx] = sanitizedLesson;
        else list.unshift(sanitizedLesson);
        const existingArch = prev.smart_content_archive.find((a) => a.id === archiveCopy.id);
        const mergedArch: SmartContentArchiveItem = existingArch
          ? {
              ...archiveCopy,
              reuseCount: existingArch.reuseCount,
              reusedInClassIds: existingArch.reusedInClassIds,
            }
          : archiveCopy;
        return {
          ...prev,
          flipped_lessons: list,
          smart_content_archive: [
            mergedArch,
            ...prev.smart_content_archive.filter((a) => a.id !== archiveCopy.id),
          ],
        };
      });
      void sharedRepository.putItem('flipped_lessons', sanitizedLesson).catch(() => {});
      void sharedRepository.putItem('smart_content_archive', archiveCopy).catch(() => {});
      return { ok: true };
    },
    [activeSchool.academicYear, activeSchool.complexId, authGuardContext, dataset.classes]
  );

  const deleteFlippedLesson = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.flipped_lessons.find(
        (l) => l.id === id && l.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'flipped_lessons', 'delete', {
        schoolId: resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        flipped_lessons: prev.flipped_lessons.filter(
          (l) => !(l.id === id && l.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('flipped_lessons', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.flipped_lessons, resolvedSchoolId]
  );

  const upsertFlippedTelemetry = useCallback(
    (telemetry: FlippedVideoTelemetry): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'flipped_telemetry', 'write', {
        schoolId: telemetry.schoolId,
        classId: telemetry.classId,
        record: telemetry,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.flipped_telemetry];
        const idx = list.findIndex((t) => t.id === telemetry.id);
        if (idx >= 0) list[idx] = telemetry;
        else list.push(telemetry);
        return { ...prev, flipped_telemetry: list };
      });
      void sharedRepository.putItem('flipped_telemetry', telemetry).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const addFlippedQuestion = useCallback(
    (question: FlippedTimestampQuestion): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'flipped_questions', 'write', {
        schoolId: question.schoolId,
        classId: question.classId,
        record: question,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        flipped_questions: [...prev.flipped_questions, question],
      }));
      void sharedRepository.putItem('flipped_questions', question).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const replyFlippedQuestion = useCallback(
    (questionId: string, replyText: string): MutationResult => {
      const existing = dataset.flipped_questions.find(
        (q) => q.id === questionId && q.schoolId === resolvedSchoolId
      );
      if (!existing) return { ok: false, errorFa: 'سوال مورد نظر یافت نشد.' };
      const updated: FlippedTimestampQuestion = {
        ...existing,
        teacherReply: replyText.trim(),
        resolved: true,
      };
      const decision = authorizeMutation(authGuardContext, 'flipped_questions', 'write', {
        schoolId: updated.schoolId,
        classId: updated.classId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        flipped_questions: prev.flipped_questions.map((q) => (q.id === questionId ? updated : q)),
      }));
      void sharedRepository.putItem('flipped_questions', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.flipped_questions, resolvedSchoolId]
  );

  const upsertStudent360Signal = useCallback(
    (signal: Student360Signal): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'student_360_signals', 'write', {
        schoolId: signal.schoolId,
        classId: signal.classId,
        record: signal,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.student_360_signals];
        const idx = list.findIndex((s) => s.id === signal.id);
        if (idx >= 0) list[idx] = signal;
        else list.unshift(signal);
        return { ...prev, student_360_signals: list };
      });
      void sharedRepository.putItem('student_360_signals', signal).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const recordFlippedMicroQuizOutcome = useCallback(
    (params: {
      lesson: FlippedVideoLesson;
      telemetry: FlippedVideoTelemetry;
      signal: Student360Signal;
    }): MutationResult => {
      const { lesson, telemetry, signal } = params;
      const telRes = upsertFlippedTelemetry(telemetry);
      if (!telRes.ok) return telRes;

      upsertStudent360Signal(signal);

      // Push formative Micro-Quiz summary record directly into Gradebook
      const attempt = telemetry.microQuizAttempt;
      if (attempt) {
        const month: JalaliAcademicMonth = 'آذر';
        const gbId = `${lesson.schoolId}:gb:${lesson.classId}:${lesson.subject}:${month}:${telemetry.studentId}`;
        const existingGb = dataset.gradebook_entries.find((g) => g.id === gbId);
        const nowIso = new Date().toISOString();
        const formativeNote = `تستک کلاس وارونه «${lesson.title}»: ${attempt.descriptiveStatus} (${attempt.score20}/20)`;

        const nextGbEntry: GradebookEntry =
          session?.role === 'student'
            ? {
                id: gbId,
                schoolId: lesson.schoolId,
                studentId: telemetry.studentId,
                classId: lesson.classId,
                subject: lesson.subject,
                jalaliMonth: month,
                jalaliDate: attempt.completedAtJalali,
                numericScore: existingGb?.numericScore,
                descriptiveLevel:
                  existingGb?.descriptiveLevel ?? scoreToDescriptiveLevel(attempt.score20),
                microQuizScore: attempt.score20,
                disciplinaryNote: existingGb?.disciplinaryNote
                  ? `${existingGb.disciplinaryNote} | ${formativeNote}`
                  : formativeNote,
                recordedBy: 'student',
                updatedAt: nowIso,
              }
            : {
                ...(existingGb ?? {
                  id: gbId,
                  schoolId: lesson.schoolId,
                  studentId: telemetry.studentId,
                  classId: lesson.classId,
                  subject: lesson.subject,
                  jalaliMonth: month,
                }),
                jalaliDate: attempt.completedAtJalali,
                microQuizScore: attempt.score20,
                descriptiveLevel:
                  existingGb?.descriptiveLevel ?? scoreToDescriptiveLevel(attempt.score20),
                disciplinaryNote: existingGb?.disciplinaryNote
                  ? `${existingGb.disciplinaryNote} | ${formativeNote}`
                  : formativeNote,
                recordedBy: session?.role ?? 'teacher',
                updatedAt: nowIso,
              };

        const gbDecision = authorizeMutation(authGuardContext, 'gradebook_entries', 'write', {
          schoolId: nextGbEntry.schoolId,
          classId: nextGbEntry.classId,
          record: nextGbEntry,
        });
        if (gbDecision.allowed) {
          setDataset((prev) => {
            const list = [...prev.gradebook_entries];
            const idx = list.findIndex((g) => g.id === nextGbEntry.id);
            if (idx >= 0) {
              // Preserve existing teacher-only fields when parent triggers micro-quiz sync
              list[idx] = {
                ...list[idx],
                microQuizScore: nextGbEntry.microQuizScore,
                disciplinaryNote: nextGbEntry.disciplinaryNote,
                updatedAt: nextGbEntry.updatedAt,
              };
            } else {
              list.push(nextGbEntry);
            }
            return { ...prev, gradebook_entries: list };
          });
          void sharedRepository.putItem('gradebook_entries', nextGbEntry).catch(() => {});
        }
      }

      return { ok: true };
    },
    [authGuardContext, dataset.gradebook_entries, session?.role, upsertFlippedTelemetry, upsertStudent360Signal]
  );

  const upsertOnlineClassSession = useCallback(
    (sessionItem: OnlineClassSession): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'online_class_sessions', 'write', {
        schoolId: sessionItem.schoolId,
        classId: sessionItem.classId,
        record: sessionItem,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.online_class_sessions];
        const idx = list.findIndex((s) => s.id === sessionItem.id);
        if (idx >= 0) list[idx] = sessionItem;
        else list.unshift(sessionItem);
        return { ...prev, online_class_sessions: list };
      });
      void sharedRepository.putItem('online_class_sessions', sessionItem).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteOnlineClassSession = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.online_class_sessions.find(
        (s) => s.id === id && s.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'online_class_sessions', 'delete', {
        schoolId: resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        online_class_sessions: prev.online_class_sessions.filter(
          (s) => !(s.id === id && s.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('online_class_sessions', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.online_class_sessions, resolvedSchoolId]
  );

  const upsertOnlineClassAttendance = useCallback(
    (record: OnlineClassAttendanceRecord): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'online_class_attendance', 'write', {
        schoolId: record.schoolId,
        classId: record.classId,
        record,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.online_class_attendance];
        const idx = list.findIndex((a) => a.id === record.id);
        if (idx >= 0) list[idx] = record;
        else list.push(record);
        return { ...prev, online_class_attendance: list };
      });
      void sharedRepository.putItem('online_class_attendance', record).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertOnlineExam = useCallback(
    (exam: OnlineExam): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'online_exams', 'write', {
        schoolId: exam.schoolId,
        classId: exam.classId,
        record: exam,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.online_exams];
        const idx = list.findIndex((e) => e.id === exam.id);
        if (idx >= 0) list[idx] = exam;
        else list.unshift(exam);
        return { ...prev, online_exams: list };
      });
      void sharedRepository.putItem('online_exams', exam).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteOnlineExam = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.online_exams.find(
        (e) => e.id === id && e.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'online_exams', 'delete', {
        schoolId: resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        online_exams: prev.online_exams.filter(
          (e) => !(e.id === id && e.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('online_exams', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.online_exams, resolvedSchoolId]
  );

  const upsertOnlineExamSubmission = useCallback(
    (submission: OnlineExamSubmission, signal?: Student360Signal): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'online_exam_submissions', 'write', {
        schoolId: submission.schoolId,
        classId: submission.classId,
        record: submission,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...prev.online_exam_submissions];
        const idx = list.findIndex((s) => s.id === submission.id);
        if (idx >= 0) list[idx] = submission;
        else list.unshift(submission);
        return { ...prev, online_exam_submissions: list };
      });
      void sharedRepository.putItem('online_exam_submissions', submission).catch(() => {});
      if (signal) {
        upsertStudent360Signal(signal);
      }
      return { ok: true };
    },
    [authGuardContext, upsertStudent360Signal]
  );

  const syncExamGradesToGradebook = useCallback(
    (examId: string, month: JalaliAcademicMonth = 'آذر'): MutationResult => {
      const exam = dataset.online_exams.find(
        (e) => e.id === examId && e.schoolId === resolvedSchoolId
      );
      if (!exam) return { ok: false, errorFa: 'آزمون مورد نظر یافت نشد.' };

      const examSubs = dataset.online_exam_submissions.filter(
        (s) =>
          s.schoolId === resolvedSchoolId &&
          s.examId === examId &&
          (s.gradingStatus === 'finalized' || s.gradingStatus === 'auto_graded')
      );
      if (examSubs.length === 0) {
        return {
          ok: false,
          errorFa: 'هیچ کارنامه تاییدشده یا تصحیح‌شده‌ای برای انتقال به دفتر کلاسی وجود ندارد.',
        };
      }

      const gbCheck = authorizeMutation(authGuardContext, 'gradebook_entries', 'write', {
        schoolId: exam.schoolId,
        classId: exam.classId,
      });
      if (!gbCheck.allowed) return { ok: false, errorFa: gbCheck.reasonFa };

      const nowIso = new Date().toISOString();
      const todayJalali = getTodayJalali();
      const updatedEntries: GradebookEntry[] = [];
      const updatedSignals: Student360Signal[] = [];
      const updatedSubs: OnlineExamSubmission[] = [];

      for (const sub of examSubs) {
        const gbId = `${exam.schoolId}:gb:${exam.classId}:${exam.subject}:${month}:${sub.studentId}`;
        const existingGb = dataset.gradebook_entries.find((g) => g.id === gbId);
        const entry: GradebookEntry = {
          ...(existingGb ?? {
            id: gbId,
            schoolId: exam.schoolId,
            studentId: sub.studentId,
            classId: exam.classId,
            subject: exam.subject,
            jalaliMonth: month,
          }),
          jalaliDate: todayJalali,
          numericScore: sub.finalScore20,
          descriptiveLevel: scoreToDescriptiveLevel(sub.finalScore20),
          oralQuizScore: existingGb?.oralQuizScore ?? sub.finalScore20,
          disciplinaryNote: `نمره آزمون آنلاین «${exam.title}»: ${sub.finalScore20} از ۲۰`,
          recordedBy: session?.role ?? 'teacher',
          updatedAt: nowIso,
        };
        updatedEntries.push(entry);

        updatedSignals.push({
          id: `${exam.schoolId}:s360:online_exam:${exam.id}:${sub.studentId}`,
          schoolId: exam.schoolId,
          studentId: sub.studentId,
          classId: exam.classId,
          subject: exam.subject,
          source: 'online_exam',
          sourceEntityId: exam.id,
          title: exam.title,
          score20: sub.finalScore20,
          statusLabelFa: scoreToDescriptiveLevel(sub.finalScore20),
          summaryFa: `نمره تاییدشده آزمون «${exam.title}»: ${sub.finalScore20} از ۲۰ (انتقال به دفتر کلاسی)`,
          metrics: { finalScore20: sub.finalScore20, tabSwitchCount: sub.tabSwitchCount },
          recordedAtJalali: todayJalali,
          updatedAt: nowIso,
        });

        updatedSubs.push({
          ...sub,
          syncedToGradebook: true,
          updatedAt: nowIso,
        });
      }

      const updatedExam: OnlineExam = {
        ...exam,
        gradebookSyncedAt: nowIso,
        updatedAt: nowIso,
      };

      setDataset((prev) => {
        const nextGb = [...prev.gradebook_entries];
        for (const entry of updatedEntries) {
          const idx = nextGb.findIndex((g) => g.id === entry.id);
          if (idx >= 0) nextGb[idx] = entry;
          else nextGb.push(entry);
        }

        const nextSigs = [...prev.student_360_signals];
        for (const sig of updatedSignals) {
          const idx = nextSigs.findIndex((s) => s.id === sig.id);
          if (idx >= 0) nextSigs[idx] = sig;
          else nextSigs.unshift(sig);
        }

        const nextSubs = prev.online_exam_submissions.map(
          (s) => updatedSubs.find((u) => u.id === s.id) ?? s
        );

        const nextExams = prev.online_exams.map((e) => (e.id === updatedExam.id ? updatedExam : e));

        return {
          ...prev,
          gradebook_entries: nextGb,
          student_360_signals: nextSigs,
          online_exam_submissions: nextSubs,
          online_exams: nextExams,
        };
      });

      void sharedRepository.putMany('gradebook_entries', updatedEntries).catch(() => {});
      void sharedRepository.putMany('student_360_signals', updatedSignals).catch(() => {});
      void sharedRepository.putMany('online_exam_submissions', updatedSubs).catch(() => {});
      void sharedRepository.putItem('online_exams', updatedExam).catch(() => {});

      return { ok: true };
    },
    [
      authGuardContext,
      dataset.gradebook_entries,
      dataset.online_exam_submissions,
      dataset.online_exams,
      resolvedSchoolId,
      session?.role,
    ]
  );

  // --- Phase 3.5 Private Parent-Staff Chat Mutations (with BroadcastChannel live sync) ---
  const sendParentStaffMessage = useCallback(
    (params: {
      studentId: string;
      classId: string;
      channelType: ParentChatChannelType;
      targetTeacherId?: string;
      text: string;
    }): MutationResult => {
      if (!session || session.role === 'student') {
        return {
          ok: false,
          errorFa: 'دسترسی به گفت‌وگوی اختصاصی اولیا برای این نقش مجاز نیست.',
        };
      }
      const trimmed = sanitizeText(params.text, 2000);
      if (!trimmed) {
        return { ok: false, errorFa: 'لطفاً متن پیام معتبر را وارد کنید.' };
      }
      const now = new Date();
      const timeText = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const isParentSender = session.role === 'parent';

      const msg: ParentStaffMessage = {
        id: `${resolvedSchoolId}:pchat:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        schoolId: resolvedSchoolId,
        studentId: params.studentId,
        classId: params.classId,
        channelType: params.channelType,
        targetTeacherId: params.targetTeacherId,
        senderRole: session.role,
        senderUserId: session.userId,
        senderName: session.displayName,
        text: trimmed,
        jalaliDate: getTodayJalali(),
        timeText,
        createdAt: now.toISOString(),
        readByParent: isParentSender,
        readByStaff: !isParentSender,
      };

      const decision = authorizeMutation(authGuardContext, 'parent_staff_messages', 'write', {
        schoolId: msg.schoolId,
        classId: msg.classId,
        record: msg,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        parent_staff_messages: [...prev.parent_staff_messages, msg],
      }));
      void sharedRepository.putItem('parent_staff_messages', msg).catch(() => {});

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(getParentChatChannelName(resolvedSchoolId));
          ch.postMessage({ type: 'chat_message', message: msg });
          ch.close();
        } catch {
          // ignore broadcast errors in restricted contexts
        }
      }
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, session]
  );

  const markParentChatThreadRead = useCallback(
    (studentId: string, channelType: ParentChatChannelType): void => {
      if (!session || session.role === 'student') return;
      const isParentReader = session.role === 'parent';
      const toUpdate = dataset.parent_staff_messages
        .filter((m) => {
          if (
            m.schoolId !== resolvedSchoolId ||
            m.studentId !== studentId ||
            m.channelType !== channelType
          ) {
            return false;
          }
          return isParentReader
            ? m.senderRole !== 'parent' && !m.readByParent
            : m.senderRole === 'parent' && !m.readByStaff;
        })
        .map((m) =>
          isParentReader ? { ...m, readByParent: true } : { ...m, readByStaff: true }
        );

      if (toUpdate.length === 0) return;

      const updatedById = new Map(toUpdate.map((m) => [m.id, m]));
      setDataset((prev) => ({
        ...prev,
        parent_staff_messages: prev.parent_staff_messages.map((m) => updatedById.get(m.id) ?? m),
      }));
      void sharedRepository.putMany('parent_staff_messages', toUpdate).catch(() => {});

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(getParentChatChannelName(resolvedSchoolId));
          ch.postMessage({
            type: 'chat_read',
            studentId,
            channelType,
            reader: isParentReader ? 'parent' : 'staff',
          });
          ch.close();
        } catch {
          // ignore
        }
      }
    },
    [dataset.parent_staff_messages, resolvedSchoolId, session]
  );

  // --- PHASE 4 RBAC-GUARDED MUTATIONS ---
  const setClassChatRoomMode = useCallback(
    (classId: string, mode: ClassChatRoomMode): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً وارد حساب کاربری شوید.' };
      const existingRooms = dataset.class_chat_rooms.filter(
        (r) => r.schoolId === resolvedSchoolId && r.classId === classId
      );
      const canonicalId = `${resolvedSchoolId}:room:${classId}`;
      const room: ClassChatRoomConfig = {
        id: canonicalId,
        schoolId: resolvedSchoolId,
        classId,
        mode,
        updatedBy: session.displayName,
        updatedAt: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'class_chat_rooms', 'write', {
        schoolId: room.schoolId,
        classId: room.classId,
        record: room,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const filtered = prev.class_chat_rooms.filter(
          (r) => !(r.schoolId === room.schoolId && r.classId === room.classId)
        );
        return {
          ...prev,
          class_chat_rooms: [...filtered, room],
        };
      });
      for (const stale of existingRooms) {
        if (stale.id !== canonicalId) {
          void sharedRepository.deleteItem('class_chat_rooms', resolvedSchoolId, stale.id).catch(() => {});
        }
      }
      void sharedRepository.putItem('class_chat_rooms', room).catch(() => {});

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(getClassChatChannelName(resolvedSchoolId));
          ch.postMessage({ type: 'class_chat_room', room });
          ch.close();
        } catch {
          // ignore
        }
      }
      return { ok: true };
    },
    [authGuardContext, dataset.class_chat_rooms, resolvedSchoolId, session]
  );

  const sendClassChatMessage = useCallback(
    (params: {
      classId: string;
      kind: 'text' | 'poll' | 'question_bank';
      text: string;
      poll?: ClassChatPoll;
    }): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً وارد حساب کاربری شوید.' };
      const trimmed = sanitizeText(params.text, 2000);
      if (!trimmed && params.kind !== 'poll') {
        return { ok: false, errorFa: 'لطفاً متن پیام معتبر را وارد کنید.' };
      }

      const roomCfg = dataset.class_chat_rooms.find(
        (r) => r.schoolId === resolvedSchoolId && r.classId === params.classId
      );
      const currentMode: ClassChatRoomMode = roomCfg?.mode ?? 'open';
      if (!canUserPostInClassRoom(session.role, currentMode)) {
        return {
          ok: false,
          errorFa:
            'این گروه در «حالت اطلاع‌رسانی» است و در حال حاضر فقط معلم و مدیریت امکان ارسال پیام دارند.',
        };
      }

      const now = new Date();
      const timeText = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      const sanitizedPoll: ClassChatPoll | undefined = params.poll
        ? {
            ...params.poll,
            question: sanitizeText(params.poll.question, 300),
            options: params.poll.options.map((opt) => ({
              ...opt,
              text: sanitizeText(opt.text, 160),
            })),
          }
        : undefined;

      const msg: ClassChatMessage = {
        id: `${resolvedSchoolId}:ccmsg:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        schoolId: resolvedSchoolId,
        classId: params.classId,
        kind: params.kind,
        senderRole: session.role,
        senderUserId: session.userId,
        senderName: session.displayName,
        text: trimmed || (sanitizedPoll ? sanitizedPoll.question : ''),
        poll: sanitizedPoll,
        jalaliDate: getTodayJalali(),
        timeText,
        createdAt: now.toISOString(),
      };

      const decision = authorizeMutation(authGuardContext, 'class_chat_messages', 'write', {
        schoolId: msg.schoolId,
        classId: msg.classId,
        record: msg,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        class_chat_messages: [...prev.class_chat_messages, msg],
      }));
      void sharedRepository.putItem('class_chat_messages', msg).catch(() => {});

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(getClassChatChannelName(resolvedSchoolId));
          ch.postMessage({ type: 'class_chat_message', message: msg });
          ch.close();
        } catch {
          // ignore
        }
      }
      return { ok: true };
    },
    [authGuardContext, dataset.class_chat_rooms, resolvedSchoolId, session]
  );

  const voteClassChatPoll = useCallback(
    (messageId: string, optionId: string): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً وارد حساب کاربری شوید.' };
      const existing = dataset.class_chat_messages.find(
        (m) => m.id === messageId && m.schoolId === resolvedSchoolId
      );
      if (!existing || existing.kind !== 'poll' || !existing.poll) {
        return { ok: false, errorFa: 'نظرسنجی مورد نظر یافت نشد.' };
      }
      const voteRes = applyPollVote(existing.poll, optionId, session.userId);
      if (!voteRes.ok || !voteRes.updatedPoll) {
        return { ok: false, errorFa: voteRes.errorFa };
      }

      const updated: ClassChatMessage = {
        ...existing,
        poll: voteRes.updatedPoll,
      };
      const decision = authorizeMutation(authGuardContext, 'class_chat_messages', 'write', {
        schoolId: updated.schoolId,
        classId: updated.classId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        class_chat_messages: prev.class_chat_messages.map((m) =>
          m.id === updated.id ? updated : m
        ),
      }));
      void sharedRepository.putItem('class_chat_messages', updated).catch(() => {});

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(getClassChatChannelName(resolvedSchoolId));
          ch.postMessage({ type: 'class_chat_message', message: updated });
          ch.close();
        } catch {
          // ignore
        }
      }
      return { ok: true };
    },
    [authGuardContext, dataset.class_chat_messages, resolvedSchoolId, session]
  );

  const deleteClassChatDraft = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.class_chat_draft_queue.find(
        (d) => d.id === id && d.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'class_chat_draft_queue', 'delete', {
        schoolId: resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        class_chat_draft_queue: prev.class_chat_draft_queue.filter(
          (d) => !(d.id === id && d.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('class_chat_draft_queue', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.class_chat_draft_queue, resolvedSchoolId]
  );

  const createAppointmentSlots = useCallback(
    (slots: AppointmentSlot[]): MutationResult => {
      if (slots.length === 0) return { ok: false, errorFa: 'بازه زمانی معتبری تولید نشد.' };
      for (const slot of slots) {
        const decision = authorizeMutation(authGuardContext, 'appointment_slots', 'write', {
          schoolId: slot.schoolId,
          record: slot,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }
      setDataset((prev) => ({
        ...prev,
        appointment_slots: [...prev.appointment_slots, ...slots],
      }));
      void sharedRepository.putMany('appointment_slots', slots).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteAppointmentSlot = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.appointment_slots.find(
        (s) => s.id === id && s.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'appointment_slots', 'delete', {
        schoolId: resolvedSchoolId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        appointment_slots: prev.appointment_slots.filter(
          (s) => !(s.id === id && s.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('appointment_slots', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.appointment_slots, resolvedSchoolId]
  );

  const bookAppointmentSlot = useCallback(
    (slotId: string, topic: string): MutationResult => {
      if (!session || session.role !== 'parent' || !linkedStudent) {
        return { ok: false, errorFa: 'فقط ولی دانش‌آموز امکان رزرو نوبت جلسه را دارد.' };
      }
      const existing = dataset.appointment_slots.find(
        (s) => s.id === slotId && s.schoolId === resolvedSchoolId
      );
      if (!existing) return { ok: false, errorFa: 'بازه زمانی مورد نظر یافت نشد.' };

      const guard = canBookAppointmentSlot(existing);
      if (!guard.allowed) return { ok: false, errorFa: guard.reasonFa };

      const nowIso = new Date().toISOString();
      const updated: AppointmentSlot = {
        ...existing,
        status: 'booked',
        bookedByParentUserId: session.userId,
        bookedStudentId: linkedStudent.id,
        bookedClassId: linkedStudent.classId,
        bookedParentName: linkedStudent.parentName || session.displayName,
        bookingTopic: topic.trim() || 'گفت‌وگو و بررسی وضعیت تحصیلی دانش‌آموز',
        bookedAtIso: nowIso,
        updatedAt: nowIso,
      };

      const decision = authorizeMutation(authGuardContext, 'appointment_slots', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        appointment_slots: prev.appointment_slots.map((s) => (s.id === slotId ? updated : s)),
      }));
      void sharedRepository.putItem('appointment_slots', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.appointment_slots, linkedStudent, resolvedSchoolId, session]
  );

  const cancelAppointmentBooking = useCallback(
    (slotId: string): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً وارد حساب کاربری شوید.' };
      const existing = dataset.appointment_slots.find(
        (s) => s.id === slotId && s.schoolId === resolvedSchoolId
      );
      if (!existing) return { ok: false, errorFa: 'بازه زمانی مورد نظر یافت نشد.' };
      if (session.role === 'parent' && existing.bookedStudentId !== linkedStudent?.id) {
        return { ok: false, errorFa: 'شما فقط می‌توانید نوبت رزروشده فرزند خود را لغو کنید.' };
      }

      const updated: AppointmentSlot = {
        ...existing,
        status: 'open',
        bookedByParentUserId: undefined,
        bookedStudentId: undefined,
        bookedClassId: undefined,
        bookedParentName: undefined,
        bookingTopic: undefined,
        bookedAtIso: undefined,
        updatedAt: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'appointment_slots', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        appointment_slots: prev.appointment_slots.map((s) => (s.id === slotId ? updated : s)),
      }));
      void sharedRepository.putItem('appointment_slots', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.appointment_slots, linkedStudent, resolvedSchoolId, session]
  );

  const completeAppointmentSlot = useCallback(
    (slotId: string, outcomeNotes: string): MutationResult => {
      const existing = dataset.appointment_slots.find(
        (s) => s.id === slotId && s.schoolId === resolvedSchoolId
      );
      if (!existing) return { ok: false, errorFa: 'بازه زمانی مورد نظر یافت نشد.' };
      const updated: AppointmentSlot = {
        ...existing,
        status: 'completed',
        meetingOutcomeNotes: outcomeNotes.trim(),
        updatedAt: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'appointment_slots', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        appointment_slots: prev.appointment_slots.map((s) => (s.id === slotId ? updated : s)),
      }));
      void sharedRepository.putItem('appointment_slots', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.appointment_slots, resolvedSchoolId]
  );

  const upsertElectronicForm = useCallback(
    (form: ElectronicForm): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'electronic_forms', 'write', {
        schoolId: form.schoolId,
        record: form,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.electronic_forms.some((f) => f.id === form.id);
        return {
          ...prev,
          electronic_forms: exists
            ? prev.electronic_forms.map((f) => (f.id === form.id ? form : f))
            : [form, ...prev.electronic_forms],
        };
      });
      void sharedRepository.putItem('electronic_forms', form).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteElectronicForm = useCallback(
    (id: string): MutationResult => {
      const existing = dataset.electronic_forms.find(
        (f) => f.id === id && f.schoolId === resolvedSchoolId
      );
      const decision = authorizeMutation(authGuardContext, 'electronic_forms', 'delete', {
        schoolId: resolvedSchoolId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        electronic_forms: prev.electronic_forms.filter(
          (f) => !(f.id === id && f.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('electronic_forms', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.electronic_forms, resolvedSchoolId]
  );

  const submitElectronicFormResponse = useCallback(
    (response: ElectronicFormResponse): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'electronic_form_responses', 'write', {
        schoolId: response.schoolId,
        classId: response.classId,
        record: response,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.electronic_form_responses.some((r) => r.id === response.id);
        return {
          ...prev,
          electronic_form_responses: exists
            ? prev.electronic_form_responses.map((r) => (r.id === response.id ? response : r))
            : [response, ...prev.electronic_form_responses],
        };
      });
      void sharedRepository.putItem('electronic_form_responses', response).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertNotificationTemplate = useCallback(
    (template: NotificationTemplate): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'notification_templates', 'write', {
        schoolId: template.schoolId,
        record: template,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.notification_templates.some((t) => t.id === template.id);
        return {
          ...prev,
          notification_templates: exists
            ? prev.notification_templates.map((t) => (t.id === template.id ? template : t))
            : [template, ...prev.notification_templates],
        };
      });
      void sharedRepository.putItem('notification_templates', template).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteNotificationTemplate = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'notification_templates', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        notification_templates: prev.notification_templates.filter(
          (t) => !(t.id === id && t.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('notification_templates', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  // --- PHASE 5 RBAC-GUARDED MUTATIONS ---
  const importSidaStudentsBatch = useCallback(
    async (
      items: Array<{ student: Student; profile: StudentElectronicProfile }>
    ): Promise<MutationResult> => {
      if (!session || !roleDef.canImportSidaStudents) {
        return {
          ok: false,
          errorFa: 'ورود گروهی دانش‌آموزان از سیدا صرفاً بر عهده مدیریت و معاونت مدرسه است.',
        };
      }
      if (items.length === 0) {
        return { ok: false, errorFa: 'هیچ ردیف معتبری برای ثبت انتخاب نشده است.' };
      }
      for (const item of items) {
        const decStudent = authorizeMutation(authGuardContext, 'students', 'write', {
          schoolId: item.student.schoolId,
          classId: item.student.classId,
          record: item.student,
        });
        if (!decStudent.allowed) return { ok: false, errorFa: decStudent.reasonFa };
        const decProf = authorizeMutation(authGuardContext, 'student_profiles', 'write', {
          schoolId: item.profile.schoolId,
          record: item.profile,
        });
        if (!decProf.allowed) return { ok: false, errorFa: decProf.reasonFa };
      }

      const upgradedStudents = items.map((i) => ensureStudentDualCredentials(i.student));
      const incomingProfiles = items.map((i) => i.profile);

      setDataset((prev) => {
        const studentMap = new Map(prev.students.map((s) => [s.id, s]));
        for (const st of upgradedStudents) {
          studentMap.set(st.id, st);
        }
        const profileMap = new Map(prev.student_profiles.map((p) => [p.studentId, p]));
        for (const prof of incomingProfiles) {
          const existing = profileMap.get(prof.studentId);
          profileMap.set(
            prof.studentId,
            existing
              ? {
                  ...existing,
                  fatherName: prof.fatherName || existing.fatherName,
                  emergencyContactName: prof.emergencyContactName || existing.emergencyContactName,
                  emergencyContactPhone: prof.emergencyContactPhone || existing.emergencyContactPhone,
                  updatedAt: prof.updatedAt,
                  updatedByName: prof.updatedByName,
                }
              : prof
          );
        }
        return {
          ...prev,
          students: Array.from(studentMap.values()),
          student_profiles: Array.from(profileMap.values()),
        };
      });

      for (const st of upgradedStudents) {
        await sharedRepository.putItem('students', st).catch(() => {});
      }
      for (const prof of incomingProfiles) {
        const existing = dataset.student_profiles.find(
          (p) => p.schoolId === prof.schoolId && p.studentId === prof.studentId
        );
        const merged = existing
          ? {
              ...existing,
              fatherName: prof.fatherName || existing.fatherName,
              emergencyContactName: prof.emergencyContactName || existing.emergencyContactName,
              emergencyContactPhone: prof.emergencyContactPhone || existing.emergencyContactPhone,
              updatedAt: prof.updatedAt,
              updatedByName: prof.updatedByName,
            }
          : prof;
        await sharedRepository.putItem('student_profiles', merged).catch(() => {});
      }
      return { ok: true };
    },
    [authGuardContext, dataset.student_profiles, roleDef.canImportSidaStudents, session]
  );

  const resolveSidaGradeAppeal = useCallback(
    (params: {
      appealId: string;
      nextStatus: 'in_review' | 'teacher_reviewed' | 'principal_approved' | 'rejected';
      revisedScore?: number;
      revisedDescriptiveLevel?: DescriptiveLevel;
      explanation: string;
    }): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً وارد حساب کاربری شوید.' };
      const existingAppeal = dataset.grade_appeals.find(
        (a) => a.id === params.appealId && a.schoolId === resolvedSchoolId
      );
      if (!existingAppeal) {
        return { ok: false, errorFa: 'درخواست اعتراض موردنظر یافت نشد.' };
      }
      const explanation = params.explanation.trim();
      if (explanation.length < 4) {
        return { ok: false, errorFa: 'لطفاً شرح بررسی برگه (حداقل ۴ کاراکتر) را وارد کنید.' };
      }

      const today = getTodayJalali();
      const nowIso = new Date().toISOString();

      const updatedAppeal: GradeAppeal = {
        ...existingAppeal,
        status: params.nextStatus,
        revisedScore:
          params.revisedScore !== undefined ? params.revisedScore : existingAppeal.revisedScore,
        revisedDescriptiveLevel:
          params.revisedDescriptiveLevel ??
          (params.revisedScore !== undefined
            ? scoreToDescriptiveLevel(params.revisedScore)
            : existingAppeal.revisedDescriptiveLevel),
        teacherResponse:
          session.role === 'teacher' ? explanation : existingAppeal.teacherResponse ?? explanation,
        teacherReviewedByName:
          session.role === 'teacher' ? session.displayName : existingAppeal.teacherReviewedByName,
        principalNote:
          session.role !== 'teacher' ? explanation : existingAppeal.principalNote,
        principalApprovedByName:
          params.nextStatus === 'principal_approved'
            ? session.displayName
            : existingAppeal.principalApprovedByName,
        sidaResolutionNote: explanation,
        resolvedAtJalali:
          params.nextStatus === 'principal_approved' || params.nextStatus === 'rejected'
            ? today
            : existingAppeal.resolvedAtJalali,
        updatedAt: nowIso,
      };

      const decAppeal = authorizeMutation(authGuardContext, 'grade_appeals', 'write', {
        schoolId: updatedAppeal.schoolId,
        classId: updatedAppeal.classId,
        record: updatedAppeal,
      });
      if (!decAppeal.allowed) return { ok: false, errorFa: decAppeal.reasonFa };

      const auditAction: SidaGradeAuditLog['action'] =
        params.nextStatus === 'principal_approved'
          ? 'approved_revised'
          : params.nextStatus === 'rejected'
            ? 'rejected_original'
            : 'in_review';

      const auditLog: SidaGradeAuditLog = {
        id: `${resolvedSchoolId}:sidaaudit:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
        schoolId: resolvedSchoolId,
        appealId: updatedAppeal.id,
        studentId: updatedAppeal.studentId,
        classId: updatedAppeal.classId,
        subject: updatedAppeal.subject,
        jalaliMonth: updatedAppeal.jalaliMonth,
        action: auditAction,
        oldScore: existingAppeal.originalScore,
        newScore:
          params.nextStatus === 'principal_approved'
            ? updatedAppeal.revisedScore
            : existingAppeal.originalScore,
        oldDescriptiveLevel: existingAppeal.originalDescriptiveLevel,
        newDescriptiveLevel:
          params.nextStatus === 'principal_approved'
            ? updatedAppeal.revisedDescriptiveLevel
            : existingAppeal.originalDescriptiveLevel,
        explanation,
        reviewerName: session.displayName,
        reviewerRole: session.role,
        jalaliDate: today,
        createdAt: nowIso,
      };

      const decAudit = authorizeMutation(authGuardContext, 'sida_grade_audit_logs', 'write', {
        schoolId: auditLog.schoolId,
        classId: auditLog.classId,
        record: auditLog,
      });
      if (!decAudit.allowed) return { ok: false, errorFa: decAudit.reasonFa };

      // Automatically sync corrected grade into gradebook_entries when objection is approved
      let updatedGradeEntry: GradebookEntry | null = null;
      if (params.nextStatus === 'principal_approved') {
        const existingEntry = dataset.gradebook_entries.find(
          (g) =>
            g.schoolId === resolvedSchoolId &&
            (g.id === updatedAppeal.gradeEntryId ||
              (g.studentId === updatedAppeal.studentId &&
                g.subject === updatedAppeal.subject &&
                g.jalaliMonth === updatedAppeal.jalaliMonth))
        );
        const nextNumeric =
          updatedAppeal.revisedScore !== undefined
            ? updatedAppeal.revisedScore
            : existingEntry?.numericScore;
        const nextDesc =
          updatedAppeal.revisedDescriptiveLevel ??
          (nextNumeric !== undefined ? scoreToDescriptiveLevel(nextNumeric) : existingEntry?.descriptiveLevel);

        const candidateEntry: GradebookEntry = existingEntry
          ? {
              ...existingEntry,
              numericScore: nextNumeric,
              descriptiveLevel: nextDesc,
              disciplinaryNote: `اصلاح نمره پس از بررسی اعتراض (${today})`,
              recordedBy: session.role,
              updatedAt: nowIso,
            }
          : {
              id: updatedAppeal.gradeEntryId,
              schoolId: resolvedSchoolId,
              studentId: updatedAppeal.studentId,
              classId: updatedAppeal.classId,
              subject: updatedAppeal.subject,
              jalaliMonth: updatedAppeal.jalaliMonth,
              jalaliDate: today,
              numericScore: nextNumeric,
              descriptiveLevel: nextDesc,
              disciplinaryNote: `اصلاح نمره پس از بررسی اعتراض (${today})`,
              recordedBy: session.role,
              updatedAt: nowIso,
            };

        const decGrade = authorizeMutation(authGuardContext, 'gradebook_entries', 'write', {
          schoolId: candidateEntry.schoolId,
          classId: candidateEntry.classId,
          record: candidateEntry,
        });
        if (!decGrade.allowed) return { ok: false, errorFa: decGrade.reasonFa };
        updatedGradeEntry = candidateEntry;
      }

      setDataset((prev) => {
        const nextAppeals = prev.grade_appeals.map((a) =>
          a.id === updatedAppeal.id ? updatedAppeal : a
        );
        const nextLogs = [auditLog, ...prev.sida_grade_audit_logs];
        let nextGrades = prev.gradebook_entries;
        if (updatedGradeEntry) {
          const exists = prev.gradebook_entries.some((g) => g.id === updatedGradeEntry!.id);
          nextGrades = exists
            ? prev.gradebook_entries.map((g) =>
                g.id === updatedGradeEntry!.id ? updatedGradeEntry! : g
              )
            : [updatedGradeEntry, ...prev.gradebook_entries];
        }
        return {
          ...prev,
          grade_appeals: nextAppeals,
          sida_grade_audit_logs: nextLogs,
          gradebook_entries: nextGrades,
        };
      });

      void sharedRepository.putItem('grade_appeals', updatedAppeal).catch(() => {});
      void sharedRepository.putItem('sida_grade_audit_logs', auditLog).catch(() => {});
      if (updatedGradeEntry) {
        void sharedRepository.putItem('gradebook_entries', updatedGradeEntry).catch(() => {});
      }

      return { ok: true };
    },
    [authGuardContext, dataset.grade_appeals, dataset.gradebook_entries, resolvedSchoolId, session]
  );

  const upsertInPersonExamHall = useCallback(
    (hall: InPersonExamHall): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'in_person_exam_halls', 'write', {
        schoolId: hall.schoolId,
        record: hall,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.in_person_exam_halls.some((h) => h.id === hall.id);
        return {
          ...prev,
          in_person_exam_halls: exists
            ? prev.in_person_exam_halls.map((h) => (h.id === hall.id ? hall : h))
            : [...prev.in_person_exam_halls, hall],
        };
      });
      void sharedRepository.putItem('in_person_exam_halls', hall).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteInPersonExamHall = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'in_person_exam_halls', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        in_person_exam_halls: prev.in_person_exam_halls.filter(
          (h) => !(h.id === id && h.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('in_person_exam_halls', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertInPersonExamSession = useCallback(
    (examSession: InPersonExamSession): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'in_person_exam_sessions', 'write', {
        schoolId: examSession.schoolId,
        record: examSession,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.in_person_exam_sessions.some((s) => s.id === examSession.id);
        return {
          ...prev,
          in_person_exam_sessions: exists
            ? prev.in_person_exam_sessions.map((s) => (s.id === examSession.id ? examSession : s))
            : [...prev.in_person_exam_sessions, examSession],
        };
      });
      void sharedRepository.putItem('in_person_exam_sessions', examSession).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteInPersonExamSession = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'in_person_exam_sessions', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        in_person_exam_sessions: prev.in_person_exam_sessions.filter(
          (s) => !(s.id === id && s.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository
        .deleteItem('in_person_exam_sessions', resolvedSchoolId, id)
        .catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertExamSeatingChart = useCallback(
    (chart: ExamSeatingChart): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'exam_seating_charts', 'write', {
        schoolId: chart.schoolId,
        record: chart,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.exam_seating_charts.some((c) => c.id === chart.id);
        return {
          ...prev,
          exam_seating_charts: exists
            ? prev.exam_seating_charts.map((c) => (c.id === chart.id ? chart : c))
            : [chart, ...prev.exam_seating_charts],
        };
      });
      void sharedRepository.putItem('exam_seating_charts', chart).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteExamSeatingChart = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'exam_seating_charts', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        exam_seating_charts: prev.exam_seating_charts.filter(
          (c) => !(c.id === id && c.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('exam_seating_charts', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertStudentProfile = useCallback(
    (profile: StudentElectronicProfile): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'student_profiles', 'write', {
        schoolId: profile.schoolId,
        record: profile,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.student_profiles.some(
          (p) => p.schoolId === profile.schoolId && p.studentId === profile.studentId
        );
        return {
          ...prev,
          student_profiles: exists
            ? prev.student_profiles.map((p) =>
                p.schoolId === profile.schoolId && p.studentId === profile.studentId ? profile : p
              )
            : [...prev.student_profiles, profile],
        };
      });
      void sharedRepository.putItem('student_profiles', profile).catch(() => {});
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertStaffProfile = useCallback(
    (profile: StaffElectronicProfile): MutationResult => {
      const existing = dataset.staff_profiles.find(
        (p) => p.schoolId === profile.schoolId && p.teacherId === profile.teacherId
      );
      // If deputy edits non-confidential staff profile fields, preserve prior principal confidential notes without failing policy
      const sanitizedProfile: StaffElectronicProfile = roleDef.canViewConfidentialStaffEvaluation
        ? profile
        : { ...profile, confidentialEvaluationNotes: undefined };

      const decision = authorizeMutation(authGuardContext, 'staff_profiles', 'write', {
        schoolId: sanitizedProfile.schoolId,
        record: sanitizedProfile,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      const persistedProfile: StaffElectronicProfile = roleDef.canViewConfidentialStaffEvaluation
        ? profile
        : {
            ...sanitizedProfile,
            confidentialEvaluationNotes: existing?.confidentialEvaluationNotes,
          };

      setDataset((prev) => {
        const exists = prev.staff_profiles.some(
          (p) => p.schoolId === persistedProfile.schoolId && p.teacherId === persistedProfile.teacherId
        );
        return {
          ...prev,
          staff_profiles: exists
            ? prev.staff_profiles.map((p) =>
                p.schoolId === persistedProfile.schoolId &&
                p.teacherId === persistedProfile.teacherId
                  ? persistedProfile
                  : p
              )
            : [...prev.staff_profiles, persistedProfile],
        };
      });
      void sharedRepository.putItem('staff_profiles', persistedProfile).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.staff_profiles, roleDef.canViewConfidentialStaffEvaluation]
  );

  // --- Phase 5.5 RBAC-Guarded Mutations ---
  const upsertSingleSidaStudent = useCallback(
    async (
      rawStudent: Student,
      profile: StudentElectronicProfile
    ): Promise<MutationResult & { savedStudent?: Student }> => {
      if (!session || !roleDef.canImportSidaStudents) {
        return { ok: false, errorFa: 'ثبت یا ویرایش دانش‌آموز در سیدا صرفاً بر عهده مدیریت و معاونت است.' };
      }
      const student = ensureStudentDualCredentials({
        ...rawStudent,
        schoolId: resolvedSchoolId,
      });
      const decSt = authorizeMutation(authGuardContext, 'students', 'write', {
        schoolId: student.schoolId,
        record: student,
      });
      if (!decSt.allowed) return { ok: false, errorFa: decSt.reasonFa };

      const normalizedProfile: StudentElectronicProfile = {
        ...profile,
        id: `${resolvedSchoolId}:stprof:${student.id}`,
        schoolId: resolvedSchoolId,
        studentId: student.id,
      };
      const decProf = authorizeMutation(authGuardContext, 'student_profiles', 'write', {
        schoolId: normalizedProfile.schoolId,
        record: normalizedProfile,
      });
      if (!decProf.allowed) return { ok: false, errorFa: decProf.reasonFa };

      const existingProfile = dataset.student_profiles.find(
        (p) => p.schoolId === resolvedSchoolId && p.studentId === student.id
      );
      const mergedProfile: StudentElectronicProfile = existingProfile
        ? {
            ...existingProfile,
            fatherName: normalizedProfile.fatherName || existingProfile.fatherName,
            emergencyContactName:
              normalizedProfile.emergencyContactName || existingProfile.emergencyContactName,
            emergencyContactPhone:
              normalizedProfile.emergencyContactPhone || existingProfile.emergencyContactPhone,
            updatedByName: normalizedProfile.updatedByName,
            updatedAt: normalizedProfile.updatedAt,
          }
        : normalizedProfile;

      setDataset((prev) => {
        const stExists = prev.students.some((s) => s.id === student.id);
        const nextStudents = stExists
          ? prev.students.map((s) => (s.id === student.id ? student : s))
          : [...prev.students, student];
        const profExists = prev.student_profiles.some(
          (p) => p.schoolId === resolvedSchoolId && p.studentId === student.id
        );
        const nextProfiles = profExists
          ? prev.student_profiles.map((p) =>
              p.schoolId === resolvedSchoolId && p.studentId === student.id ? mergedProfile : p
            )
          : [...prev.student_profiles, mergedProfile];
        return {
          ...prev,
          students: nextStudents,
          student_profiles: nextProfiles,
        };
      });

      await sharedRepository.putItem('students', student).catch(() => {});
      await sharedRepository.putItem('student_profiles', mergedProfile).catch(() => {});
      return { ok: true, savedStudent: student };
    },
    [authGuardContext, dataset.student_profiles, resolvedSchoolId, roleDef.canImportSidaStudents, session]
  );

  const transferStudentsToClass = useCallback(
    async (
      studentIds: string[],
      targetClassId: string,
      reason?: string
    ): Promise<MutationResult & { movedCount?: number }> => {
      if (!session || !roleDef.canManageStudents) {
        return { ok: false, errorFa: 'جابه‌جایی کلاس و ارتقای پایه صرفاً توسط مدیریت و معاونت مجاز است.' };
      }
      const targetClass = dataset.classes.find(
        (c) => c.id === targetClassId && c.schoolId === resolvedSchoolId
      );
      if (!targetClass) {
        return { ok: false, errorFa: 'کلاس مقصد در مدرسه فعال یافت نشد.' };
      }
      const idSet = new Set(studentIds);
      const targets = dataset.students.filter(
        (s) => s.schoolId === resolvedSchoolId && idSet.has(s.id) && s.classId !== targetClassId
      );
      if (targets.length === 0) {
        return { ok: false, errorFa: 'هیچ دانش‌آموزی برای انتقال انتخاب نشده یا همه در کلاس مقصد هستند.' };
      }
      const updatedStudents = targets.map((s) => ({ ...s, classId: targetClassId }));
      for (const st of updatedStudents) {
        const dec = authorizeMutation(authGuardContext, 'students', 'write', {
          schoolId: st.schoolId,
          record: st,
        });
        if (!dec.allowed) return { ok: false, errorFa: dec.reasonFa };
      }

      const classNameById = new Map(dataset.classes.map((c) => [c.id, c.name]));
      const nowIso = new Date().toISOString();
      const todayJalali = getTodayJalali();
      const cleanReason = sanitizeText(reason || 'انتقال امن کلاس در میانه سال تحصیلی', 300);

      const newTransferLogs: StudentTransferLog[] = targets.map((st) => {
        const preservedGradesCount = dataset.gradebook_entries.filter(
          (g) => g.schoolId === resolvedSchoolId && g.studentId === st.id
        ).length;
        const preservedAttendanceCount = dataset.student_attendance.filter(
          (a) => a.schoolId === resolvedSchoolId && a.studentId === st.id
        ).length;
        return {
          id: generateUUID(),
          complexId: activeSchool.complexId ?? 'complex-1',
          schoolId: resolvedSchoolId,
          academicYearId: activeSchool.academicYear || '1404-1405',
          createdAtIso: nowIso,
          updatedAtIso: nowIso,
          createdByUserId: session.userId,
          studentId: st.id,
          studentName: st.fullName,
          fromClassId: st.classId,
          fromClassName: classNameById.get(st.classId) ?? 'کلاس قبلی',
          toClassId: targetClass.id,
          toClassName: targetClass.name,
          transferDateJalali: todayJalali,
          reason: cleanReason,
          performedByName: session.displayName,
          performedByRole: session.role,
          preservedGradesCount,
          preservedAttendanceCount,
        };
      });

      // Safely update ONLY student.classId so 100% of past grades, attendance, and electronic profile history stays intact!
      const updatedById = new Map(updatedStudents.map((s) => [s.id, s]));
      setDataset((prev) => ({
        ...prev,
        students: prev.students.map((s) => updatedById.get(s.id) ?? s),
        student_transfer_logs: [...newTransferLogs, ...prev.student_transfer_logs],
      }));
      await sharedRepository.putMany('students', updatedStudents).catch(() => {});
      await sharedRepository.putMany('student_transfer_logs', newTransferLogs).catch(() => {});
      return { ok: true, movedCount: updatedStudents.length };
    },
    [
      activeSchool.academicYear,
      activeSchool.complexId,
      authGuardContext,
      dataset.classes,
      dataset.gradebook_entries,
      dataset.student_attendance,
      dataset.students,
      resolvedSchoolId,
      roleDef.canManageStudents,
      session,
    ]
  );

  const upsertSidaSpeedEntryRecord = useCallback(
    (record: SidaSpeedEntryRecord): MutationResult => {
      const normalized: SidaSpeedEntryRecord = {
        ...record,
        schoolId: resolvedSchoolId,
      };
      const dec = authorizeMutation(authGuardContext, 'sida_speed_entry_ticks', 'write', {
        schoolId: normalized.schoolId,
        classId: normalized.classId,
        record: normalized,
      });
      if (!dec.allowed) return { ok: false, errorFa: dec.reasonFa };

      setDataset((prev) => {
        const exists = prev.sida_speed_entry_ticks.some((r) => r.id === normalized.id);
        return {
          ...prev,
          sida_speed_entry_ticks: exists
            ? prev.sida_speed_entry_ticks.map((r) => (r.id === normalized.id ? normalized : r))
            : [...prev.sida_speed_entry_ticks, normalized],
        };
      });
      void sharedRepository.putItem('sida_speed_entry_ticks', normalized).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const saveUserAppearancePreference = useCallback(
    (pref: UserAppearancePreference): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً ابتدا وارد سامانه شوید.' };
      const normalized: UserAppearancePreference = {
        ...pref,
        id: `${resolvedSchoolId}:uap:${session.userId}`,
        schoolId: resolvedSchoolId,
        userId: session.userId,
        updatedAt: new Date().toISOString(),
      };
      const dec = authorizeMutation(authGuardContext, 'user_appearance_prefs', 'write', {
        schoolId: normalized.schoolId,
        record: normalized,
      });
      if (!dec.allowed) return { ok: false, errorFa: dec.reasonFa };

      setDataset((prev) => {
        const exists = prev.user_appearance_prefs.some((p) => p.id === normalized.id);
        return {
          ...prev,
          user_appearance_prefs: exists
            ? prev.user_appearance_prefs.map((p) => (p.id === normalized.id ? normalized : p))
            : [...prev.user_appearance_prefs, normalized],
        };
      });
      void sharedRepository.putItem('user_appearance_prefs', normalized).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, session]
  );

  const saveSchoolBrandingConfig = useCallback(
    async (
      config: SchoolBrandingConfig,
      applyToAllSchools = false
    ): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'لطفاً ابتدا وارد سامانه شوید.' };
      const targetSchoolIds =
        applyToAllSchools && roleDef.canBatchManageAllSchoolsAddons
          ? schools.map((s) => s.id)
          : [resolvedSchoolId];

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const nowIso = new Date().toISOString();
      const nextItems: SchoolBrandingConfig[] = targetSchoolIds.map((sid) => {
        const existing = dataset.school_branding_configs.find((c) => c.schoolId === sid);
        const schoolRec = dataset.schools.find((s) => s.id === sid);
        const id = existing && uuidRegex.test(existing.id) ? existing.id : generateUUID();
        const createdAtIso = existing?.createdAtIso ?? existing?.updatedAt ?? nowIso;
        return {
          ...existing,
          ...config,
          id,
          complexId: schoolRec?.complexId ?? existing?.complexId ?? 'complex-1',
          schoolId: sid,
          // When cloning across multiple schools, keep each school's own display name & logo unless explicitly set for single school
          schoolDisplayName:
            applyToAllSchools && sid !== resolvedSchoolId
              ? existing?.schoolDisplayName
              : config.schoolDisplayName,
          logoDataUrl:
            applyToAllSchools && sid !== resolvedSchoolId
              ? existing?.logoDataUrl
              : config.logoDataUrl ?? existing?.logoDataUrl,
          updatedByName: session.displayName,
          updatedByRole: activeRole,
          updatedAt: nowIso,
          createdAtIso,
          updatedAtIso: nowIso,
        };
      });

      for (const item of nextItems) {
        const dec = authorizeMutation(authGuardContext, 'school_branding_configs', 'write', {
          schoolId: item.schoolId,
          record: item,
        });
        if (!dec.allowed) return { ok: false, errorFa: dec.reasonFa };
      }

      const updatedSchoolIds = new Set(nextItems.map((i) => i.schoolId));
      setDataset((prev) => {
        const kept = prev.school_branding_configs.filter((c) => !updatedSchoolIds.has(c.schoolId));
        return {
          ...prev,
          school_branding_configs: [...kept, ...nextItems],
        };
      });

      await sharedRepository.putMany('school_branding_configs', nextItems).catch(() => {});
      return { ok: true };
    },
    [
      activeRole,
      authGuardContext,
      dataset.school_branding_configs,
      dataset.schools,
      resolvedSchoolId,
      roleDef.canBatchManageAllSchoolsAddons,
      schools,
      session,
    ]
  );

  const saveSchoolPrintBranding = useCallback(
    async (input: {
      schoolId: string;
      schoolDisplayName: string;
      printSubtitle: string;
      logoDataUrl?: string | null;
      isArchivedYear?: boolean;
    }): Promise<MutationResult & { config?: SchoolBrandingConfig }> => {
      if (!session) return { ok: false, errorFa: 'لطفاً ابتدا وارد سامانه شوید.' };

      if (input.isArchivedYear) {
        return {
          ok: false,
          errorFa: 'در حالت مشاهده سال تحصیلی آرشیو، امکان ویرایش لوگو و سربرگ چاپی مدرسه وجود ندارد.',
        };
      }

      // Strict RBAC & multi-tenant schoolId isolation
      const targetSchoolId = input.schoolId.trim();
      if (activeRole === 'principal') {
        if (targetSchoolId !== session.schoolId) {
          return {
            ok: false,
            errorFa:
              'تخلف ایزوله‌سازی مدرسه: مدیر مدرسه فقط مجاز به مشاهده و ویرایش لوگو و سربرگ مدرسه خود است.',
          };
        }
      } else if (activeRole === 'complex_admin') {
        if (!schools.some((s) => s.id === targetSchoolId)) {
          return {
            ok: false,
            errorFa: 'شما فقط مجاز به مدیریت مدارس زیرمجموعه خود هستید.',
          };
        }
      } else if (activeRole !== 'super_admin') {
        return {
          ok: false,
          errorFa: 'تغییر لوگو و سربرگ چاپی مدرسه صرفاً در اختیار مدیر مدرسه و راهبر ارشد سامانه است.',
        };
      }

      const targetSchool = dataset.schools.find((s) => s.id === targetSchoolId);
      if (!targetSchool) {
        return { ok: false, errorFa: 'مدرسه انتخاب‌شده در سامانه یافت نشد.' };
      }

      if (isSchoolUnderPanicLock(panicModeState, targetSchool.id)) {
        return {
          ok: false,
          errorFa:
            'سامانه برای این مدرسه در حالت «قفل اضطراری (فقط‌خواندنی)» قرار دارد؛ ویرایش لوگو و سربرگ تا رفع قفل مسدود است.',
        };
      }

      const existing = dataset.school_branding_configs.find((c) => c.schoolId === targetSchool.id);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const recordId = existing && uuidRegex.test(existing.id) ? existing.id : generateUUID();
      const nowIso = new Date().toISOString();
      const createdAtIso = existing?.createdAtIso ?? existing?.updatedAt ?? nowIso;
      const complexId = targetSchool.complexId ?? existing?.complexId ?? 'complex-1';

      const cleanDisplayName = sanitizeText(input.schoolDisplayName, 140);
      const cleanPrintSubtitle = sanitizeText(input.printSubtitle, 200);

      let nextLogoDataUrl: string | undefined;
      if (input.logoDataUrl === null || input.logoDataUrl === '') {
        nextLogoDataUrl = undefined;
      } else if (typeof input.logoDataUrl === 'string') {
        const safeUrl = sanitizeUrl(input.logoDataUrl);
        if (!safeUrl || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(safeUrl)) {
          return {
            ok: false,
            errorFa: 'فرمت تصویر لوگوی مدرسه نامعتبر است. لطفاً تصویر PNG، JPG یا WebP انتخاب کنید.',
          };
        }
        nextLogoDataUrl = safeUrl;
      } else {
        nextLogoDataUrl = existing?.logoDataUrl ?? targetSchool.logoDataUrl;
      }

      const nextConfig: SchoolBrandingConfig = {
        ...existing,
        id: recordId,
        complexId,
        schoolId: targetSchool.id,
        schoolDisplayName: cleanDisplayName || undefined,
        printSubtitle: cleanPrintSubtitle || undefined,
        logoDataUrl: nextLogoDataUrl,
        logoMediaId: undefined,
        sectionLabels: existing?.sectionLabels ?? {},
        updatedByName: session.displayName,
        updatedByRole: activeRole,
        updatedAt: nowIso,
        createdAtIso,
        updatedAtIso: nowIso,
      };

      const brandingDecision = authorizeMutation(
        authGuardContext,
        'school_branding_configs',
        'write',
        {
          schoolId: targetSchool.id,
          record: nextConfig,
        }
      );
      if (!brandingDecision.allowed) {
        return { ok: false, errorFa: brandingDecision.reasonFa };
      }

      const updatedSchool: School = {
        ...targetSchool,
        logoDataUrl: nextLogoDataUrl,
        letterheadTitle: cleanDisplayName || targetSchool.letterheadTitle,
        letterheadSubtitle: cleanPrintSubtitle || targetSchool.letterheadSubtitle,
        updatedAt: nowIso,
      };

      const schoolDecision = authorizeMutation(authGuardContext, 'schools', 'write', {
        schoolId: targetSchool.id,
        record: updatedSchool,
      });
      if (!schoolDecision.allowed) {
        return { ok: false, errorFa: schoolDecision.reasonFa };
      }

      if (existing?.logoMediaId) {
        void deleteMediaBlob(existing.logoMediaId).catch(() => {});
      }

      setDataset((prev) => ({
        ...prev,
        school_branding_configs: [
          ...prev.school_branding_configs.filter((c) => c.schoolId !== targetSchool.id),
          nextConfig,
        ],
        schools: prev.schools.map((s) => (s.id === targetSchool.id ? updatedSchool : s)),
      }));

      try {
        await sharedRepository.putItem('school_branding_configs', nextConfig);
        await sharedRepository.saveSchool(updatedSchool);
      } catch (err) {
        return {
          ok: false,
          errorFa:
            err instanceof Error
              ? err.message
              : 'خطا در ذخیره‌سازی لوگو و سربرگ مدرسه در مخزن داده.',
        };
      }

      const changedParts: string[] = [];
      const prevLogo = existing?.logoDataUrl ?? targetSchool.logoDataUrl ?? '';
      if ((nextLogoDataUrl ?? '') !== prevLogo) {
        changedParts.push(nextLogoDataUrl ? 'بارگذاری/تغییر لوگوی مدرسه' : 'حذف لوگوی مدرسه');
      }
      if ((cleanDisplayName || '') !== (existing?.schoolDisplayName ?? '')) {
        changedParts.push(`نام نمایشی سربرگ («${cleanDisplayName || targetSchool.name}»)`);
      }
      if ((cleanPrintSubtitle || '') !== (existing?.printSubtitle ?? '')) {
        changedParts.push(`زیرعنوان چاپی («${cleanPrintSubtitle || targetSchool.letterheadSubtitle}»)`);
      }
      const changeSummary =
        changedParts.length > 0 ? changedParts.join('، ') : 'به‌روزرسانی تنظیمات لوگو و سربرگ چاپی';

      logSecurityEvent({
        eventType: 'school_branding_updated',
        schoolId: targetSchool.id,
        complexId,
        username: session.username,
        displayName: session.displayName,
        role: activeRole,
        detailsFa: `ویرایش لوگو و سربرگ چاپی مدرسه «${targetSchool.name}» توسط ${session.displayName} (${ROLE_DEFINITIONS[activeRole].labelFa}): ${changeSummary}`,
      });

      return { ok: true, config: nextConfig };
    },
    [
      activeRole,
      authGuardContext,
      dataset.school_branding_configs,
      dataset.schools,
      logSecurityEvent,
      panicModeState,
      schools,
      session,
    ]
  );

  // --- Phase 6 RBAC-Guarded Mutations ---
  const upsertFinanceFeePlan = useCallback(
    (plan: FinanceFeePlan): MutationResult => {
      const normalized: FinanceFeePlan = { ...plan, schoolId: resolvedSchoolId };
      const decision = authorizeMutation(authGuardContext, 'finance_fee_plans', 'write', {
        schoolId: normalized.schoolId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        finance_fee_plans: [
          ...prev.finance_fee_plans.filter((p) => p.id !== normalized.id),
          normalized,
        ],
      }));
      void sharedRepository.putItem('finance_fee_plans', normalized).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const upsertFinanceLedger = useCallback(
    (ledger: FinanceStudentLedger): MutationResult => {
      const normalized: FinanceStudentLedger = {
        ...ledger,
        schoolId: resolvedSchoolId,
        updatedAt: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'finance_student_ledgers', 'write', {
        schoolId: normalized.schoolId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        finance_student_ledgers: [
          ...prev.finance_student_ledgers.filter((l) => l.id !== normalized.id),
          normalized,
        ],
      }));
      void sharedRepository.putItem('finance_student_ledgers', normalized).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const recordFinancePayment = useCallback(
    (params: {
      payment: FinancePaymentRecord;
      updatedLedger: FinanceStudentLedger;
    }): MutationResult => {
      const normalizedPayment: FinancePaymentRecord = {
        ...params.payment,
        schoolId: resolvedSchoolId,
      };
      const normalizedLedger: FinanceStudentLedger = {
        ...params.updatedLedger,
        schoolId: resolvedSchoolId,
        updatedAt: new Date().toISOString(),
      };
      const payDecision = authorizeMutation(authGuardContext, 'finance_payments', 'write', {
        schoolId: normalizedPayment.schoolId,
        record: normalizedPayment,
      });
      if (!payDecision.allowed) return { ok: false, errorFa: payDecision.reasonFa };

      const ledgerDecision = authorizeMutation(
        authGuardContext,
        'finance_student_ledgers',
        'write',
        {
          schoolId: normalizedLedger.schoolId,
          record: normalizedLedger,
        }
      );
      if (!ledgerDecision.allowed) return { ok: false, errorFa: ledgerDecision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        finance_payments: [
          ...prev.finance_payments.filter((p) => p.id !== normalizedPayment.id),
          normalizedPayment,
        ],
        finance_student_ledgers: [
          ...prev.finance_student_ledgers.filter((l) => l.id !== normalizedLedger.id),
          normalizedLedger,
        ],
      }));
      void sharedRepository.putItem('finance_payments', normalizedPayment).catch(() => {});
      void sharedRepository.putItem('finance_student_ledgers', normalizedLedger).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const deleteFinancePayment = useCallback(
    (paymentId: string, revertedLedger?: FinanceStudentLedger): MutationResult => {
      const existing = dataset.finance_payments.find((p) => p.id === paymentId);
      const decision = authorizeMutation(authGuardContext, 'finance_payments', 'delete', {
        schoolId: existing?.schoolId ?? resolvedSchoolId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      const normalizedLedger = revertedLedger
        ? { ...revertedLedger, schoolId: resolvedSchoolId, updatedAt: new Date().toISOString() }
        : undefined;

      setDataset((prev) => ({
        ...prev,
        finance_payments: prev.finance_payments.filter((p) => p.id !== paymentId),
        finance_student_ledgers: normalizedLedger
          ? [
              ...prev.finance_student_ledgers.filter((l) => l.id !== normalizedLedger.id),
              normalizedLedger,
            ]
          : prev.finance_student_ledgers,
      }));
      void sharedRepository.deleteItem('finance_payments', paymentId, resolvedSchoolId).catch(() => {});
      if (normalizedLedger) {
        void sharedRepository.putItem('finance_student_ledgers', normalizedLedger).catch(() => {});
      }
      return { ok: true };
    },
    [authGuardContext, dataset.finance_payments, resolvedSchoolId]
  );

  const upsertFinanceExpense = useCallback(
    (expense: FinanceExpenseRecord): MutationResult => {
      const normalized: FinanceExpenseRecord = { ...expense, schoolId: resolvedSchoolId };
      const decision = authorizeMutation(authGuardContext, 'finance_expenses', 'write', {
        schoolId: normalized.schoolId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        finance_expenses: [
          ...prev.finance_expenses.filter((e) => e.id !== normalized.id),
          normalized,
        ],
      }));
      void sharedRepository.putItem('finance_expenses', normalized).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const deleteFinanceExpense = useCallback(
    (expenseId: string): MutationResult => {
      const existing = dataset.finance_expenses.find((e) => e.id === expenseId);
      const decision = authorizeMutation(authGuardContext, 'finance_expenses', 'delete', {
        schoolId: existing?.schoolId ?? resolvedSchoolId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        finance_expenses: prev.finance_expenses.filter((e) => e.id !== expenseId),
      }));
      void sharedRepository.deleteItem('finance_expenses', expenseId, resolvedSchoolId).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.finance_expenses, resolvedSchoolId]
  );

  const addTripFeeToStudents = useCallback(
    async (params: {
      studentIds: string[];
      title: string;
      amountToman: number;
      dueDateJalali: string;
    }): Promise<MutationResult & { updatedCount?: number }> => {
      const targetIds = new Set(params.studentIds);
      const updatedLedgers: FinanceStudentLedger[] = [];
      const nowIso = new Date().toISOString();
      const baseId = `trip-${Date.now().toString(36)}`;

      for (const ledger of dataset.finance_student_ledgers) {
        if (ledger.schoolId !== resolvedSchoolId || !targetIds.has(ledger.studentId)) continue;
        const nextLedger: FinanceStudentLedger = {
          ...ledger,
          tripFees: [
            ...ledger.tripFees,
            {
              id: `${baseId}-${ledger.studentId}`,
              title: params.title.trim(),
              dueDateJalali: params.dueDateJalali,
              amountToman: params.amountToman,
              paidAmountToman: 0,
              status: 'pending',
            },
          ],
          updatedAt: nowIso,
        };
        const decision = authorizeMutation(authGuardContext, 'finance_student_ledgers', 'write', {
          schoolId: nextLedger.schoolId,
          record: nextLedger,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
        updatedLedgers.push(nextLedger);
      }

      if (updatedLedgers.length === 0) {
        return { ok: false, errorFa: 'پرونده مالی فعالی برای دانش‌آموزان انتخاب‌شده یافت نشد.' };
      }

      const updatedIds = new Set(updatedLedgers.map((l) => l.id));
      setDataset((prev) => ({
        ...prev,
        finance_student_ledgers: [
          ...prev.finance_student_ledgers.filter((l) => !updatedIds.has(l.id)),
          ...updatedLedgers,
        ],
      }));
      await sharedRepository.putMany('finance_student_ledgers', updatedLedgers).catch(() => {});
      return { ok: true, updatedCount: updatedLedgers.length };
    },
    [authGuardContext, dataset.finance_student_ledgers, resolvedSchoolId]
  );

  const upsertRemedialPlan = useCallback(
    (plan: RemedialPlanRecord): MutationResult => {
      const normalized: RemedialPlanRecord = {
        ...plan,
        schoolId: resolvedSchoolId,
        updatedAt: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'remedial_plans', 'write', {
        schoolId: normalized.schoolId,
        classId: normalized.classId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        remedial_plans: [
          ...prev.remedial_plans.filter((r) => r.id !== normalized.id),
          normalized,
        ],
      }));
      void sharedRepository.putItem('remedial_plans', normalized).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const deleteRemedialPlan = useCallback(
    (planId: string): MutationResult => {
      const existing = dataset.remedial_plans.find((r) => r.id === planId);
      const decision = authorizeMutation(authGuardContext, 'remedial_plans', 'delete', {
        schoolId: existing?.schoolId ?? resolvedSchoolId,
        classId: existing?.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        remedial_plans: prev.remedial_plans.filter((r) => r.id !== planId),
      }));
      void sharedRepository.deleteItem('remedial_plans', planId, resolvedSchoolId).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.remedial_plans, resolvedSchoolId]
  );

  const upsertAnonymousSurvey = useCallback(
    async (survey: AnonymousSurvey, publishAllSchools = false): Promise<MutationResult> => {
      const nowIso = new Date().toISOString();
      const canPublishAll = publishAllSchools && roleDef.canViewComplexComparison;
      const groupKey = canPublishAll
        ? survey.groupKey || `complex-survey-${Date.now().toString(36)}`
        : survey.groupKey;

      const targets = canPublishAll
        ? schools.map((sc) => ({
            ...survey,
            id:
              sc.id === resolvedSchoolId
                ? survey.id
                : `${sc.id}:survey:${groupKey}`,
            schoolId: sc.id,
            groupKey,
            updatedAt: nowIso,
          }))
        : [{ ...survey, schoolId: resolvedSchoolId, groupKey, updatedAt: nowIso }];

      for (const item of targets) {
        const decision = authorizeMutation(authGuardContext, 'anonymous_surveys', 'write', {
          schoolId: item.schoolId,
          record: item,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      const targetIds = new Set(targets.map((t) => t.id));
      setDataset((prev) => ({
        ...prev,
        anonymous_surveys: [
          ...prev.anonymous_surveys.filter((s) => !targetIds.has(s.id)),
          ...targets,
        ],
      }));
      await sharedRepository.putMany('anonymous_surveys', targets).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, roleDef.canViewComplexComparison, schools]
  );

  const deleteAnonymousSurvey = useCallback(
    (surveyId: string): MutationResult => {
      const existing = dataset.anonymous_surveys.find((s) => s.id === surveyId);
      const decision = authorizeMutation(authGuardContext, 'anonymous_surveys', 'delete', {
        schoolId: existing?.schoolId ?? resolvedSchoolId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        anonymous_surveys: prev.anonymous_surveys.filter((s) => s.id !== surveyId),
      }));
      void sharedRepository.deleteItem('anonymous_surveys', surveyId, resolvedSchoolId).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.anonymous_surveys, resolvedSchoolId]
  );

  const submitAnonymousSurveyVote = useCallback(
    (params: {
      surveyId: string;
      participantKey: string;
      audienceRole: SurveyAudienceRole;
      answers: Record<string, string | number>;
      openComment?: string;
      submittedDayBucket: string;
    }): MutationResult => {
      // 1. Prevent duplicate submission via receipt collection ONLY
      const receiptId = `${resolvedSchoolId}:receipt:${params.surveyId}:${params.participantKey}`;
      const alreadyVoted = dataset.survey_participation_receipts.some(
        (r) =>
          r.id === receiptId ||
          (r.schoolId === resolvedSchoolId &&
            r.surveyId === params.surveyId &&
            r.participantKey === params.participantKey)
      );
      if (alreadyVoted) {
        return { ok: false, errorFa: 'پاسخ شما قبلاً برای این نظرسنجی ثبت شده است.' };
      }

      const receipt: SurveyParticipationReceipt = {
        id: receiptId,
        schoolId: resolvedSchoolId,
        surveyId: params.surveyId,
        participantKey: params.participantKey,
        submittedDateJalali: params.submittedDayBucket,
      };

      // 2. Strictly PII-free anonymous response record (opaque random ID, NO userId/studentId/fullName/phone/exact timestamp)
      const randomToken = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
      const anonymousResponse: SurveyAnonymousResponse = {
        id: `anon-${randomToken}`,
        schoolId: resolvedSchoolId,
        surveyId: params.surveyId,
        audienceRole: params.audienceRole,
        answers: { ...params.answers },
        ...(params.openComment?.trim() ? { openComment: params.openComment.trim() } : {}),
        submittedDayBucket: params.submittedDayBucket,
        reviewStatus: 'new',
      };

      const receiptDecision = authorizeMutation(
        authGuardContext,
        'survey_participation_receipts',
        'write',
        { schoolId: receipt.schoolId, record: receipt }
      );
      if (!receiptDecision.allowed) return { ok: false, errorFa: receiptDecision.reasonFa };

      const respDecision = authorizeMutation(
        authGuardContext,
        'survey_anonymous_responses',
        'write',
        { schoolId: anonymousResponse.schoolId, record: anonymousResponse }
      );
      if (!respDecision.allowed) return { ok: false, errorFa: respDecision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        survey_participation_receipts: [...prev.survey_participation_receipts, receipt],
        survey_anonymous_responses: [...prev.survey_anonymous_responses, anonymousResponse],
      }));
      void sharedRepository.putItem('survey_participation_receipts', receipt).catch(() => {});
      void sharedRepository.putItem('survey_anonymous_responses', anonymousResponse).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.survey_participation_receipts, resolvedSchoolId]
  );

  const updateSurveyResponseReview = useCallback(
    (params: {
      responseId: string;
      reviewStatus: SurveyCommentReviewStatus;
      internalManagementNote?: string;
    }): MutationResult => {
      const existing = dataset.survey_anonymous_responses.find(
        (r) => r.id === params.responseId && r.schoolId === resolvedSchoolId
      );
      if (!existing) {
        return { ok: false, errorFa: 'پاسخ مورد نظر یافت نشد.' };
      }
      const updated: SurveyAnonymousResponse = {
        ...existing,
        reviewStatus: params.reviewStatus,
        internalManagementNote: params.internalManagementNote?.trim() || undefined,
      };
      const decision = authorizeMutation(authGuardContext, 'survey_anonymous_responses', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      setDataset((prev) => ({
        ...prev,
        survey_anonymous_responses: [
          ...prev.survey_anonymous_responses.filter((r) => r.id !== updated.id),
          updated,
        ],
      }));
      void sharedRepository.putItem('survey_anonymous_responses', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.survey_anonymous_responses, resolvedSchoolId]
  );

  // --- Phase 7 RBAC-Guarded Teacher Development Mutations ---
  const upsertTeacherDevCourse = useCallback(
    async (course: TeacherDevCourse, publishAllSchools = false): Promise<MutationResult> => {
      const nowIso = new Date().toISOString();
      const canPublishAll = publishAllSchools && roleDef.canPublishAllSchoolsCourses;
      if (publishAllSchools && !roleDef.canPublishAllSchoolsCourses) {
        return {
          ok: false,
          errorFa: 'انتشار همزمان دوره در هر ۳ مدرسه صرفاً توسط مدیر کل مجموعه مجاز است.',
        };
      }
      const nextScope: TeacherDevCourse['scope'] = canPublishAll ? 'all' : 'school';
      const groupKey = canPublishAll
        ? course.groupKey || `td-global-${Date.now().toString(36)}`
        : undefined;

      const targets: TeacherDevCourse[] = canPublishAll
        ? schools.map((sc) => {
            const existingLinked = dataset.td_courses.find(
              (existing) => existing.schoolId === sc.id && groupKey && existing.groupKey === groupKey
            );
            return {
              ...course,
              id:
                existingLinked?.id ??
                (sc.id === resolvedSchoolId ? course.id : `${sc.id}:tdc:${groupKey}`),
              schoolId: sc.id,
              scope: 'all',
              groupKey,
              updatedAt: nowIso,
            };
          })
        : [
            {
              ...course,
              schoolId: resolvedSchoolId,
              scope: nextScope,
              groupKey: course.scope === 'all' ? course.groupKey : undefined,
              updatedAt: nowIso,
            },
          ];

      for (const item of targets) {
        const decision = authorizeMutation(authGuardContext, 'td_courses', 'write', {
          schoolId: item.schoolId,
          record: item,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      const targetIds = new Set(targets.map((t) => t.id));
      setDataset((prev) => ({
        ...prev,
        td_courses: [...prev.td_courses.filter((c) => !targetIds.has(c.id)), ...targets],
      }));
      await sharedRepository.putMany('td_courses', targets).catch(() => {});
      return { ok: true };
    },
    [
      authGuardContext,
      dataset.td_courses,
      resolvedSchoolId,
      roleDef.canPublishAllSchoolsCourses,
      schools,
    ]
  );

  const archiveTeacherDevCourse = useCallback(
    async (courseId: string, archiveAllLinked = false): Promise<MutationResult> => {
      const existing = dataset.td_courses.find((c) => c.id === courseId);
      if (!existing) return { ok: false, errorFa: 'دوره مورد نظر یافت نشد.' };
      const nextStatus: TeacherDevCourse['status'] =
        existing.status === 'active' ? 'archived' : 'active';
      const nowIso = new Date().toISOString();

      const canApplyAll =
        archiveAllLinked &&
        existing.scope === 'all' &&
        Boolean(existing.groupKey) &&
        roleDef.canPublishAllSchoolsCourses;

      const targets = canApplyAll
        ? dataset.td_courses
            .filter((c) => c.groupKey === existing.groupKey)
            .map((c) => ({ ...c, status: nextStatus, updatedAt: nowIso }))
        : [{ ...existing, status: nextStatus, updatedAt: nowIso }];

      for (const item of targets) {
        const decision = authorizeMutation(authGuardContext, 'td_courses', 'write', {
          schoolId: item.schoolId,
          record: item,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      const targetIds = new Set(targets.map((t) => t.id));
      setDataset((prev) => ({
        ...prev,
        td_courses: [...prev.td_courses.filter((c) => !targetIds.has(c.id)), ...targets],
      }));
      await sharedRepository.putMany('td_courses', targets).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.td_courses, roleDef.canPublishAllSchoolsCourses]
  );

  const deleteTeacherDevCourse = useCallback(
    async (courseId: string, deleteAllLinked = false): Promise<MutationResult> => {
      const existing = dataset.td_courses.find((c) => c.id === courseId);
      if (!existing) return { ok: false, errorFa: 'دوره مورد نظر یافت نشد.' };

      const canApplyAll =
        deleteAllLinked &&
        existing.scope === 'all' &&
        Boolean(existing.groupKey) &&
        roleDef.canPublishAllSchoolsCourses;

      const targets = canApplyAll
        ? dataset.td_courses.filter((c) => c.groupKey === existing.groupKey)
        : [existing];

      for (const item of targets) {
        const decision = authorizeMutation(authGuardContext, 'td_courses', 'delete', {
          schoolId: item.schoolId,
          record: item,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }

      const targetIds = new Set(targets.map((t) => t.id));
      setDataset((prev) => ({
        ...prev,
        td_courses: prev.td_courses.filter((c) => !targetIds.has(c.id)),
      }));
      for (const item of targets) {
        await sharedRepository.deleteItem('td_courses', item.schoolId, item.id).catch(() => {});
      }
      return { ok: true };
    },
    [authGuardContext, dataset.td_courses, roleDef.canPublishAllSchoolsCourses]
  );

  const completeTeacherDevChapter = useCallback(
    (courseId: string, chapterId: string): MutationResult => {
      if (!session || session.role !== 'teacher' || !linkedTeacher) {
        return {
          ok: false,
          errorFa: 'ثبت تکمیل مطالعه فصل‌ها صرفاً در حساب کاربری معلم انجام می‌شود.',
        };
      }
      const course = dataset.td_courses.find(
        (c) => c.id === courseId && c.schoolId === resolvedSchoolId && c.status === 'active'
      );
      if (!course) return { ok: false, errorFa: 'دوره فعال مورد نظر یافت نشد.' };
      if (!course.chapters.some((ch) => ch.id === chapterId)) {
        return { ok: false, errorFa: 'فصل انتخاب‌شده در این دوره یافت نشد.' };
      }

      const existing = dataset.td_progress.find(
        (p) =>
          p.schoolId === resolvedSchoolId &&
          p.courseId === courseId &&
          p.teacherId === linkedTeacher.id
      );
      const nextCompleted = Array.from(
        new Set([...(existing?.completedChapterIds ?? []), chapterId])
      );
      const nowIso = new Date().toISOString();
      const updated: TeacherDevProgress = {
        id: existing?.id ?? `${resolvedSchoolId}:tdprog:${courseId}:${linkedTeacher.id}`,
        schoolId: resolvedSchoolId,
        courseId,
        teacherId: linkedTeacher.id,
        completedChapterIds: nextCompleted,
        attempts: existing?.attempts ?? [],
        bestScorePercent: existing?.bestScorePercent,
        status: existing?.status === 'completed' ? 'completed' : 'in_progress',
        completedAtJalali: existing?.completedAtJalali,
        completedAtIso: existing?.completedAtIso,
        certificateId: existing?.certificateId,
        updatedAt: nowIso,
      };

      const decision = authorizeMutation(authGuardContext, 'td_progress', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        td_progress: [...prev.td_progress.filter((p) => p.id !== updated.id), updated],
      }));
      void sharedRepository.putItem('td_progress', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.td_courses, dataset.td_progress, linkedTeacher, resolvedSchoolId, session]
  );

  const submitTeacherDevQuizAttempt = useCallback(
    (params: {
      courseId: string;
      seed: string;
      answers: Record<string, string>;
    }): TeacherDevQuizSubmissionResult => {
      if (!session || session.role !== 'teacher' || !linkedTeacher) {
        return {
          ok: false,
          errorFa: 'شرکت در آزمون و صدور گواهینامه صرفاً در حساب کاربری معلم امکان‌پذیر است.',
        };
      }
      const course = dataset.td_courses.find(
        (c) => c.id === params.courseId && c.schoolId === resolvedSchoolId && c.status === 'active'
      );
      if (!course) return { ok: false, errorFa: 'دوره مورد نظر یافت نشد.' };

      const existing = dataset.td_progress.find(
        (p) =>
          p.schoolId === resolvedSchoolId &&
          p.courseId === course.id &&
          p.teacherId === linkedTeacher.id
      );

      if (existing?.status === 'completed') {
        return { ok: false, errorFa: 'شما پیش‌تر در این دوره قبول شده و گواهینامه دریافت کرده‌اید.' };
      }

      if (!isQuizUnlocked(course, existing)) {
        return {
          ok: false,
          errorFa: 'برای شرکت در آزمون پایانی، ابتدا باید مطالعه تمام فصل‌های دوره را تکمیل کنید.',
        };
      }

      const prevAttempts = existing?.attempts ?? [];
      if (prevAttempts.length >= course.maxAttempts) {
        return {
          ok: false,
          errorFa: 'سقف مجاز تعداد دفعات شرکت در آزمون این دوره به پایان رسیده است.',
        };
      }

      const grade = gradeTeacherQuizAttempt(course, params.answers);
      const todayJalali = getTodayJalali();
      const nowIso = new Date().toISOString();
      const attemptNumber = prevAttempts.length + 1;

      const attemptRecord: TeacherDevQuizAttempt = {
        attemptNumber,
        seed: params.seed,
        answers: { ...params.answers },
        correctCount: grade.correctCount,
        totalQuestions: grade.totalQuestions,
        scorePercent: grade.scorePercent,
        passed: grade.passed,
        submittedAtJalali: todayJalali,
        submittedAtIso: nowIso,
      };

      let issuedCertificate: TeacherDevCertificate | undefined;
      if (grade.passed) {
        const certId = `${resolvedSchoolId}:tdcert:${course.id}:${linkedTeacher.id}`;
        issuedCertificate = {
          id: certId,
          schoolId: resolvedSchoolId,
          courseId: course.id,
          teacherId: linkedTeacher.id,
          teacherName: linkedTeacher.fullName,
          courseTitle: course.title,
          contentType: course.contentType,
          requirement: course.requirement,
          inServiceHours: course.inServiceHours,
          scorePercent: grade.scorePercent,
          serialNumber: generateCertificateSerial({
            schoolId: resolvedSchoolId,
            teacherId: linkedTeacher.id,
            courseId: course.id,
            issuedDateJalali: todayJalali,
          }),
          issuedDateJalali: todayJalali,
          onTime: isOnTimeCompletion(todayJalali, course.deadlineJalali),
          createdAt: nowIso,
        };
        const certDecision = authorizeMutation(authGuardContext, 'td_certificates', 'write', {
          schoolId: issuedCertificate.schoolId,
          record: issuedCertificate,
        });
        if (!certDecision.allowed) return { ok: false, errorFa: certDecision.reasonFa };
      }

      const bestScore = Math.max(existing?.bestScorePercent ?? 0, grade.scorePercent);
      const updatedProgress: TeacherDevProgress = {
        id: existing?.id ?? `${resolvedSchoolId}:tdprog:${course.id}:${linkedTeacher.id}`,
        schoolId: resolvedSchoolId,
        courseId: course.id,
        teacherId: linkedTeacher.id,
        completedChapterIds: existing?.completedChapterIds ?? course.chapters.map((ch) => ch.id),
        attempts: [...prevAttempts, attemptRecord],
        bestScorePercent: bestScore,
        status: grade.passed ? 'completed' : 'quiz_failed',
        completedAtJalali: grade.passed ? todayJalali : existing?.completedAtJalali,
        completedAtIso: grade.passed ? nowIso : existing?.completedAtIso,
        certificateId: issuedCertificate?.id ?? existing?.certificateId,
        updatedAt: nowIso,
      };

      const progDecision = authorizeMutation(authGuardContext, 'td_progress', 'write', {
        schoolId: updatedProgress.schoolId,
        record: updatedProgress,
      });
      if (!progDecision.allowed) return { ok: false, errorFa: progDecision.reasonFa };

      const certToSave = issuedCertificate;
      setDataset((prev) => ({
        ...prev,
        td_progress: [...prev.td_progress.filter((p) => p.id !== updatedProgress.id), updatedProgress],
        td_certificates: certToSave
          ? [
              ...prev.td_certificates.filter((c) => c.id !== certToSave.id),
              certToSave,
            ]
          : prev.td_certificates,
      }));
      void sharedRepository.putItem('td_progress', updatedProgress).catch(() => {});
      if (certToSave) {
        void sharedRepository.putItem('td_certificates', certToSave).catch(() => {});
      }

      return {
        ok: true,
        scorePercent: grade.scorePercent,
        correctCount: grade.correctCount,
        totalQuestions: grade.totalQuestions,
        passed: grade.passed,
        certificate: issuedCertificate,
      };
    },
    [authGuardContext, dataset.td_courses, dataset.td_progress, linkedTeacher, resolvedSchoolId, session]
  );

  const saveTeacherDevPrivacySettings = useCallback(
    (rankingPrivacyMode: TeacherDevRankingPrivacyMode): MutationResult => {
      if (!session) return { ok: false, errorFa: 'لطفاً ابتدا وارد حساب کاربری شوید.' };
      const updated: TeacherDevSchoolSettings = {
        id: `${resolvedSchoolId}:tdsettings`,
        schoolId: resolvedSchoolId,
        rankingPrivacyMode,
        updatedByName: session.displayName,
        updatedAt: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'td_school_settings', 'write', {
        schoolId: updated.schoolId,
        record: updated,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        td_school_settings: [
          ...prev.td_school_settings.filter((s) => s.schoolId !== resolvedSchoolId),
          updated,
        ],
      }));
      void sharedRepository.putItem('td_school_settings', updated).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, session]
  );

  // --- PHASE 8A SUPER ADMIN GOVERNANCE MUTATIONS ---
  const appendAudit = useCallback(
    (category: SuperAdminAuditCategory, summaryFa: string, detailsFa?: string): SuperAdminAuditEntry | null => {
      if (!realSession || realSession.role !== 'super_admin') return null;
      const entry = createAuditEntry({
        actorName: realSession.displayName,
        category,
        summaryFa,
        detailsFa,
      });
      setDataset((prev) => ({
        ...prev,
        super_admin_audit_logs: [
          entry,
          ...prev.super_admin_audit_logs.filter((x) => x.id !== entry.id),
        ].slice(0, 200),
      }));
      void sharedRepository.putItem('super_admin_audit_logs', entry).catch(() => {});
      return entry;
    },
    [realSession]
  );

  const startImpersonation = useCallback(
    (target: Omit<ImpersonationState, 'startedAt'>): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد سامانه مجاز به استفاده از حالت پیش‌نمایش نقش است.' };
      }
      const nextState: ImpersonationState = {
        ...target,
        startedAt: new Date().toISOString(),
      };
      setImpersonation(nextState);
      if (target.targetSchoolId) {
        setComplexSelectedSchoolId(target.targetSchoolId);
      }
      appendAudit(
        'impersonation',
        `ورود به پیش‌نمایش دید نقش «${ROLE_DEFINITIONS[target.targetRole].labelFa}» (${target.targetDisplayName})`
      );
      if (typeof window !== 'undefined') {
        window.location.hash = '#/';
      }
      return { ok: true };
    },
    [realSession, appendAudit]
  );

  const stopImpersonation = useCallback(() => {
    setImpersonation(null);
    if (typeof window !== 'undefined') {
      window.location.hash = '#/super-admin';
    }
  }, []);

  const saveRoleGovernanceConfig = useCallback(
    (config: RoleGovernanceConfig): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const normalized: RoleGovernanceConfig = {
        ...config,
        id: `role-gov:${config.roleId}`,
        schoolId: GLOBAL_TENANT_ID,
        updatedAt: new Date().toISOString(),
      };
      setDataset((prev) => {
        const list = prev.role_governance_configs.length > 0
          ? [...prev.role_governance_configs]
          : buildDefaultRoleGovernanceConfigs(manifests);
        const idx = list.findIndex((r) => r.roleId === normalized.roleId);
        if (idx >= 0) list[idx] = normalized;
        else list.push(normalized);
        return { ...prev, role_governance_configs: list };
      });
      void sharedRepository.putItem('role_governance_configs', normalized).catch(() => {});
      appendAudit(
        'permissions',
        `به‌روزرسانی دسترسی‌ها و عنوان نقش «${normalized.displayTitleFa}»`
      );
      return { ok: true };
    },
    [realSession, manifests, appendAudit]
  );

  const resetAllRoleGovernanceConfigs = useCallback((): MutationResult => {
    if (!realSession || realSession.role !== 'super_admin') {
      return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
    }
    const defaults = buildDefaultRoleGovernanceConfigs(manifests);
    setDataset((prev) => ({ ...prev, role_governance_configs: defaults }));
    void sharedRepository.putMany('role_governance_configs', defaults).catch(() => {});
    appendAudit('permissions', 'بازگردانی کامل ماتریس دسترسی‌ها و عناوین نقش‌ها به تنظیمات پیشفرض');
    return { ok: true };
  }, [realSession, manifests, appendAudit]);

  const updateGlobalLabels = useCallback(
    (labels: Record<string, string>): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(labels)) {
        if (typeof v === 'string' && v.trim().length > 0) {
          cleaned[k] = v.trim();
        }
      }
      const nextCfg: GlobalSystemConfig = {
        ...globalSystemConfig,
        id: 'global-system-config',
        schoolId: GLOBAL_TENANT_ID,
        labels: cleaned,
        updatedAt: new Date().toISOString(),
        updatedBy: realSession.displayName,
      };
      setDataset((prev) => ({ ...prev, global_system_configs: [nextCfg] }));
      void sharedRepository.putItem('global_system_configs', nextCfg).catch(() => {});
      appendAudit(
        'labels',
        `ذخیره واژگان و عناوین سراسری سامانه (${Object.keys(cleaned).length} برچسب سفارشی)`
      );
      return { ok: true };
    },
    [realSession, globalSystemConfig, appendAudit]
  );

  const resetGlobalLabels = useCallback((): MutationResult => {
    if (!realSession || realSession.role !== 'super_admin') {
      return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
    }
    const nextCfg: GlobalSystemConfig = {
      ...globalSystemConfig,
      id: 'global-system-config',
      schoolId: GLOBAL_TENANT_ID,
      labels: {},
      updatedAt: new Date().toISOString(),
      updatedBy: realSession.displayName,
    };
    setDataset((prev) => ({ ...prev, global_system_configs: [nextCfg] }));
    void sharedRepository.putItem('global_system_configs', nextCfg).catch(() => {});
    appendAudit('labels', 'بازگردانی تمامی عناوین منوها و واژگان کلیدی به پیشفرض');
    return { ok: true };
  }, [realSession, globalSystemConfig, appendAudit]);

  const updateLoginBackgroundConfig = useCallback(
    (config: LoginBackgroundConfig): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const safeBg = clampLoginBackgroundConfig(config);
      const nextCfg: GlobalSystemConfig = {
        ...globalSystemConfig,
        id: 'global-system-config',
        schoolId: GLOBAL_TENANT_ID,
        loginBackground: safeBg,
        updatedAt: new Date().toISOString(),
        updatedBy: realSession.displayName,
      };
      setDataset((prev) => ({ ...prev, global_system_configs: [nextCfg] }));
      void sharedRepository.putItem('global_system_configs', nextCfg).catch(() => {});
      appendAudit(
        'login_studio',
        `به‌روزرسانی پس‌زمینه و ظاهر صفحه ورود (${safeBg.mode === 'custom_image' ? 'تصویر اختصاصی' : `قالب ${safeBg.presetId}`})`
      );
      return { ok: true };
    },
    [realSession, globalSystemConfig, appendAudit]
  );

  const updateSystemLogo = useCallback(
    (logoDataUrl: string | undefined, fileName?: string): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — تغییر لوگوی اصلی سامانه ویژه راهبر ارشد است.' };
      }
      const nowIso = new Date().toISOString();
      const nextCfg: GlobalSystemConfig = {
        ...globalSystemConfig,
        id: 'global-system-config',
        schoolId: GLOBAL_TENANT_ID,
        systemLogoDataUrl: logoDataUrl,
        systemLogoFileName: fileName,
        updatedAt: nowIso,
        updatedBy: realSession.displayName,
      };
      setDataset((prev) => ({ ...prev, global_system_configs: [nextCfg] }));
      void sharedRepository.putItem('global_system_configs', nextCfg).catch(() => {});
      syncBrowserFaviconAndTitle(logoDataUrl);
      appendAudit(
        'login_studio',
        logoDataUrl
          ? `به‌روزرسانی لوگو و فاوآیکون رسمی سامانه (${fileName ?? 'تصویر جدید'})`
          : 'بازگردانی لوگو و فاوآیکون سامانه به نشان پیش‌فرض گلستان راه روشن'
      );
      return { ok: true };
    },
    [realSession, globalSystemConfig, appendAudit]
  );

  const upsertManagedAdminAccount = useCallback(
    (account: ManagedAdminAccount): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const userCheck = validateNonPersianUsername(account.username);
      if (!userCheck.valid) {
        return { ok: false, errorFa: userCheck.errorFa };
      }
      const cleanUser = userCheck.normalized;
      const existing = dataset.managed_admin_accounts.find((a) => a.id === account.id);
      const rawPassword = (account.password ?? '').trim();

      if (!existing) {
        const pwCheck = validateStrongPassword(rawPassword);
        if (!pwCheck.valid) {
          return { ok: false, errorFa: pwCheck.errorFa };
        }
      } else if (rawPassword.length > 0) {
        const pwCheck = validateStrongPassword(rawPassword);
        if (!pwCheck.valid) {
          return { ok: false, errorFa: pwCheck.errorFa };
        }
      }

      const duplicate = dataset.managed_admin_accounts.find(
        (a) => a.id !== account.id && a.username.trim().toLowerCase() === cleanUser
      );
      if (duplicate) {
        return { ok: false, errorFa: `نام کاربری «${cleanUser}» قبلاً برای حساب دیگری ثبت شده است.` };
      }

      let passwordHash = existing?.passwordHash ?? account.passwordHash;
      let passwordSalt = existing?.passwordSalt ?? account.passwordSalt;
      if (rawPassword.length > 0) {
        const hashed = hashPasswordSync(rawPassword);
        passwordHash = hashed.passwordHash;
        passwordSalt = hashed.passwordSalt;
      }

      const nowIso = new Date().toISOString();
      const baseNormalized: ManagedAdminAccount = {
        ...account,
        schoolId:
          account.role === 'super_admin' || account.role === 'complex_admin'
            ? GLOBAL_TENANT_ID
            : account.schoolId || dataset.schools[0]?.id || 'school-1',
        username: cleanUser,
        passwordHash,
        passwordSalt,
        fullName: sanitizeText(account.fullName, 120),
        updatedAt: nowIso,
      };
      delete baseNormalized.password;
      const normalized = ensureManagedAdminAccountHashed(baseNormalized);

      setDataset((prev) => {
        const list = [...prev.managed_admin_accounts];
        const idx = list.findIndex((a) => a.id === normalized.id);
        if (idx >= 0) list[idx] = normalized;
        else list.push(normalized);
        return { ...prev, managed_admin_accounts: list };
      });
      void sharedRepository.putItem('managed_admin_accounts', normalized).catch(() => {});
      appendAudit(
        'accounts',
        `ثبت/ویرایش حساب مدیریتی «${normalized.fullName}» (${ROLE_DEFINITIONS[normalized.role].labelFa})`,
        `نام کاربری: ${normalized.username}`
      );
      if (!existing) {
        logSecurityEvent({
          eventType: 'user_created',
          schoolId: normalized.schoolId,
          complexId: normalized.complexId,
          username: normalized.username,
          displayName: normalized.fullName,
          role: normalized.role,
          detailsFa: `ایجاد حساب مدیریتی جدید (${ROLE_DEFINITIONS[normalized.role].labelFa}) توسط ${realSession.displayName}`,
        });
      }
      return { ok: true };
    },
    [realSession, dataset.managed_admin_accounts, dataset.schools, appendAudit, logSecurityEvent]
  );

  const deleteManagedAdminAccount = useCallback(
    (accountId: string): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const target = dataset.managed_admin_accounts.find((a) => a.id === accountId);
      if (!target) return { ok: false, errorFa: 'حساب موردنظر یافت نشد.' };
      if (target.role === 'super_admin') {
        const activeSuperCount = dataset.managed_admin_accounts.filter(
          (a) => a.role === 'super_admin' && a.isActive
        ).length;
        if (activeSuperCount <= 1) {
          return { ok: false, errorFa: 'حذف آخرین حساب فعال راهبر ارشد سامانه مجاز نیست.' };
        }
      }
      setDataset((prev) => ({
        ...prev,
        managed_admin_accounts: prev.managed_admin_accounts.filter((a) => a.id !== accountId),
      }));
      void sharedRepository.deleteItem('managed_admin_accounts', target.schoolId, accountId).catch(() => {});
      appendAudit('accounts', `حذف حساب مدیریتی «${target.fullName}» (${target.username})`);
      return { ok: true };
    },
    [realSession, dataset.managed_admin_accounts, appendAudit]
  );

  const toggleManagedAdminAccountActive = useCallback(
    (accountId: string): MutationResult => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const target = dataset.managed_admin_accounts.find((a) => a.id === accountId);
      if (!target) return { ok: false, errorFa: 'حساب موردنظر یافت نشد.' };
      if (target.role === 'super_admin' && target.isActive) {
        const activeSuperCount = dataset.managed_admin_accounts.filter(
          (a) => a.role === 'super_admin' && a.isActive
        ).length;
        if (activeSuperCount <= 1) {
          return { ok: false, errorFa: 'غیرفعال کردن آخرین حساب فعال راهبر ارشد مجاز نیست.' };
        }
      }
      const updated: ManagedAdminAccount = {
        ...target,
        isActive: !target.isActive,
        updatedAt: new Date().toISOString(),
      };
      setDataset((prev) => ({
        ...prev,
        managed_admin_accounts: prev.managed_admin_accounts.map((a) =>
          a.id === accountId ? updated : a
        ),
      }));
      void sharedRepository.putItem('managed_admin_accounts', updated).catch(() => {});
      appendAudit(
        'accounts',
        `${updated.isActive ? 'فعال‌سازی' : 'تعلیق موقت'} حساب «${updated.fullName}» (${updated.username})`
      );
      return { ok: true };
    },
    [realSession, dataset.managed_admin_accounts, appendAudit]
  );

  const createNewSchool = useCallback(
    async (input: {
      complexId: string;
      name: string;
      subtitle?: string;
      gradeLevel: SchoolGradeLevel;
      principalName: string;
      phone?: string;
      address?: string;
      logoDataUrl?: string;
      createPrincipalAccount?: boolean;
      principalUsername?: string;
      principalPassword?: string;
    }): Promise<MutationResult & { school?: School }> => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد سامانه مجاز به افزودن مدرسه جدید است.' };
      }
      if (!input.name.trim() || input.name.trim().length < 3) {
        return { ok: false, errorFa: 'نام مدرسه باید حداقل ۳ کاراکتر باشد.' };
      }
      if (!input.principalName.trim()) {
        return { ok: false, errorFa: 'نام مدیر مدرسه الزامی است.' };
      }
      if (input.createPrincipalAccount && input.principalUsername) {
        const cleanUser = input.principalUsername.trim().toLowerCase();
        if (
          dataset.managed_admin_accounts.some(
            (a) => a.username.trim().toLowerCase() === cleanUser
          )
        ) {
          return { ok: false, errorFa: `نام کاربری «${cleanUser}» تکراری است.` };
        }
      }
      const bundle = createNewSchoolBundle({
        complexId: input.complexId,
        name: input.name,
        gradeLevel: input.gradeLevel,
        phone: input.phone,
        address: input.address,
        logoDataUrl: input.logoDataUrl,
        printHeaderSubtitle: input.subtitle,
        principalFullName: input.principalName,
        createPrincipalAccount: input.createPrincipalAccount,
        principalUsername: input.principalUsername,
        principalPassword: input.principalPassword,
        existingSchoolIds: dataset.schools.map((s) => s.id),
        activePluginIds: [...DEFAULT_ENABLED_PLUGIN_IDS],
      });

      setDataset((prev) => ({
        ...prev,
        schools: [...prev.schools, bundle.school],
        school_plugin_states: [...prev.school_plugin_states, ...bundle.pluginStates],
        td_school_settings: [...prev.td_school_settings, bundle.tdSettings],
        managed_admin_accounts: bundle.principalAccount
          ? [...prev.managed_admin_accounts, bundle.principalAccount]
          : prev.managed_admin_accounts,
      }));

      await sharedRepository.putItem('schools', bundle.school);
      await sharedRepository.putMany('school_plugin_states', bundle.pluginStates);
      await sharedRepository.putItem('td_school_settings', bundle.tdSettings);
      if (bundle.principalAccount) {
        await sharedRepository.putItem('managed_admin_accounts', bundle.principalAccount);
      }

      appendAudit(
        'complex_school',
        `افزودن مدرسه جدید «${bundle.school.name}» با شناسه ایزوله ${bundle.school.id}`,
        bundle.principalAccount
          ? `حساب مدیر مدرسه ایجاد شد: ${bundle.principalAccount.username}`
          : undefined
      );
      return { ok: true, school: bundle.school };
    },
    [realSession, dataset.managed_admin_accounts, dataset.schools, appendAudit]
  );

  const updateSchoolUnit = useCallback(
    async (school: School): Promise<MutationResult> => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const updated: School = {
        ...school,
        updatedAt: new Date().toISOString(),
      };
      setDataset((prev) => ({
        ...prev,
        schools: prev.schools.map((s) => (s.id === updated.id ? updated : s)),
      }));
      await sharedRepository.putItem('schools', updated);
      appendAudit('complex_school', `ویرایش مشخصات واحد آموزشی «${updated.name}»`);
      return { ok: true };
    },
    [realSession, appendAudit]
  );

  const createNewComplex = useCallback(
    async (input: {
      name: string;
      description?: string;
      adminFullName: string;
      adminUsername: string;
      adminPassword: string;
      initialSchools: Array<{
        name: string;
        gradeLevel: SchoolGradeLevel;
        principalName: string;
        createPrincipalAccount?: boolean;
        principalUsername?: string;
        principalPassword?: string;
      }>;
    }): Promise<MutationResult & { complex?: EducationalComplex }> => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد سامانه مجاز به ایجاد مجموعه مدارس جدید است.' };
      }
      if (!input.name.trim() || input.name.trim().length < 3) {
        return { ok: false, errorFa: 'نام مجموعه مدارس باید حداقل ۳ کاراکتر باشد.' };
      }
      if (!input.adminFullName.trim() || input.adminUsername.trim().length < 3) {
        return { ok: false, errorFa: 'مشخصات مدیر کل مجموعه جدید را کامل وارد کنید.' };
      }
      const cleanAdminUser = input.adminUsername.trim().toLowerCase();
      if (
        dataset.managed_admin_accounts.some(
          (a) => a.username.trim().toLowerCase() === cleanAdminUser
        )
      ) {
        return { ok: false, errorFa: `نام کاربری «${cleanAdminUser}» قبلاً استفاده شده است.` };
      }
      if (input.initialSchools.length === 0) {
        return { ok: false, errorFa: 'حداقل یک مدرسه اولیه برای مجموعه جدید تعریف کنید.' };
      }

      const bundle = createNewComplexBundle({
        name: input.name,
        description: input.description,
        adminFullName: input.adminFullName,
        adminUsername: input.adminUsername,
        adminPassword: input.adminPassword,
        initialSchools: input.initialSchools.map((s) => ({
          name: s.name,
          gradeLevel: s.gradeLevel,
          principalFullName: s.principalName,
          createPrincipalAccount: s.createPrincipalAccount,
          principalUsername: s.principalUsername,
          principalPassword: s.principalPassword,
        })),
        existingComplexIds: dataset.educational_complexes.map((c) => c.id),
        existingSchoolIds: dataset.schools.map((s) => s.id),
        activePluginIds: [...DEFAULT_ENABLED_PLUGIN_IDS],
      });

      setDataset((prev) => ({
        ...prev,
        educational_complexes: [...prev.educational_complexes, bundle.complex],
        schools: [...prev.schools, ...bundle.schools],
        school_plugin_states: [...prev.school_plugin_states, ...bundle.pluginStates],
        td_school_settings: [...prev.td_school_settings, ...bundle.tdSettings],
        managed_admin_accounts: [...prev.managed_admin_accounts, ...bundle.accounts],
      }));

      await sharedRepository.putItem('educational_complexes', bundle.complex);
      await sharedRepository.putMany('schools', bundle.schools);
      await sharedRepository.putMany('school_plugin_states', bundle.pluginStates);
      await sharedRepository.putMany('td_school_settings', bundle.tdSettings);
      await sharedRepository.putMany('managed_admin_accounts', bundle.accounts);

      appendAudit(
        'complex_school',
        `ایجاد مجموعه مدارس جدید «${bundle.complex.name}» به همراه ${bundle.schools.length} مدرسه اولیه`,
        `مدیر کل مجموعه: ${bundle.adminAccount.fullName} (${bundle.adminAccount.username})`
      );
      return { ok: true, complex: bundle.complex };
    },
    [realSession, dataset.managed_admin_accounts, dataset.educational_complexes, dataset.schools, appendAudit]
  );

  const updateComplex = useCallback(
    async (complex: EducationalComplex): Promise<MutationResult> => {
      if (!realSession || realSession.role !== 'super_admin') {
        return { ok: false, errorFa: 'دسترسی غیرمجاز — ویژه راهبر ارشد سامانه.' };
      }
      const updated: EducationalComplex = {
        ...complex,
        schoolId: GLOBAL_TENANT_ID,
        updatedAt: new Date().toISOString(),
      };
      setDataset((prev) => ({
        ...prev,
        educational_complexes: prev.educational_complexes.map((c) =>
          c.id === updated.id ? updated : c
        ),
      }));
      await sharedRepository.putItem('educational_complexes', updated);
      appendAudit('complex_school', `ویرایش مجموعه آموزشی «${updated.name}»`);
      return { ok: true };
    },
    [realSession, appendAudit]
  );

  // --- PHASE 9A MUTATIONS: ACADEMIC YEARS & MOCK / KONKUR EXAMS ---
  const saveAcademicYearsList = useCallback(
    async (years: AcademicYear[]): Promise<MutationResult> => {
      if (
        !session ||
        (session.role !== 'super_admin' &&
          session.role !== 'complex_admin' &&
          session.role !== 'principal')
      ) {
        return {
          ok: false,
          errorFa:
            'مدیریت سال‌های تحصیلی صرفاً در اختیار راهبر ارشد، مدیر کل مجموعه و مدیر مدرسه است.',
        };
      }
      const decision = authorizeMutation(authGuardContext, 'academic_years', 'write', {
        schoolId: GLOBAL_TENANT_ID,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        academic_years: [...years].sort((a, b) => a.code.localeCompare(b.code)),
      }));
      await sharedRepository.putMany('academic_years', years);
      return { ok: true };
    },
    [session, authGuardContext]
  );

  const upsertMockExam = useCallback(
    async (exam: MockExam): Promise<MutationResult> => {
      const targetSchoolId = exam.scope === 'complex' ? GLOBAL_TENANT_ID : resolvedSchoolId;
      const normalized: MockExam = {
        ...exam,
        schoolId: targetSchoolId,
        updatedAtIso: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'mock_exams', 'write', {
        schoolId: targetSchoolId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.mock_exams.some((x) => x.id === normalized.id);
        return {
          ...prev,
          mock_exams: exists
            ? prev.mock_exams.map((x) => (x.id === normalized.id ? normalized : x))
            : [normalized, ...prev.mock_exams],
        };
      });
      await sharedRepository.putItem('mock_exams', normalized);
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const deleteMockExam = useCallback(
    async (examId: string): Promise<MutationResult> => {
      const existing = dataset.mock_exams.find((e) => e.id === examId);
      if (!existing) return { ok: false, errorFa: 'آزمون مورد نظر یافت نشد.' };
      const decision = authorizeMutation(authGuardContext, 'mock_exams', 'delete', {
        schoolId: existing.schoolId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        mock_exams: prev.mock_exams.filter((e) => e.id !== examId),
      }));
      await sharedRepository.deleteItem('mock_exams', existing.schoolId, examId);
      return { ok: true };
    },
    [dataset.mock_exams, authGuardContext]
  );

  const upsertMockExamAttempt = useCallback(
    async (attempt: MockExamAttempt): Promise<MutationResult> => {
      const normalized: MockExamAttempt = {
        ...attempt,
        updatedAtIso: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'mock_exam_attempts', 'write', {
        schoolId: normalized.schoolId,
        classId: normalized.classId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.mock_exam_attempts.some((a) => a.id === normalized.id);
        return {
          ...prev,
          mock_exam_attempts: exists
            ? prev.mock_exam_attempts.map((a) => (a.id === normalized.id ? normalized : a))
            : [normalized, ...prev.mock_exam_attempts],
        };
      });
      await sharedRepository.putItem('mock_exam_attempts', normalized);
      return { ok: true };
    },
    [authGuardContext]
  );

  const upsertMockExamAttemptsBatch = useCallback(
    async (attempts: MockExamAttempt[]): Promise<MutationResult> => {
      if (attempts.length === 0) return { ok: true };
      for (const att of attempts) {
        const decision = authorizeMutation(authGuardContext, 'mock_exam_attempts', 'write', {
          schoolId: att.schoolId,
          classId: att.classId,
          record: att,
        });
        if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };
      }
      const nowIso = new Date().toISOString();
      const normalized = attempts.map((a) => ({ ...a, updatedAtIso: nowIso }));
      const byId = new Map(normalized.map((a) => [a.id, a]));
      setDataset((prev) => {
        const remaining = prev.mock_exam_attempts.filter((a) => !byId.has(a.id));
        return {
          ...prev,
          mock_exam_attempts: [...normalized, ...remaining],
        };
      });
      await sharedRepository.putMany('mock_exam_attempts', normalized);
      return { ok: true };
    },
    [authGuardContext]
  );

  const deleteMockExamAttempt = useCallback(
    async (attemptId: string, schoolId: string): Promise<MutationResult> => {
      const decision = authorizeMutation(authGuardContext, 'mock_exam_attempts', 'delete', {
        schoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        mock_exam_attempts: prev.mock_exam_attempts.filter((a) => a.id !== attemptId),
      }));
      await sharedRepository.deleteItem('mock_exam_attempts', schoolId, attemptId);
      return { ok: true };
    },
    [authGuardContext]
  );

  // --- PHASE 9B MUTATIONS: ADVANCED SIDA ANALYTICS ENGINE ---
  const upsertSidaAppealWindow = useCallback(
    async (config: SidaAppealWindowConfig): Promise<MutationResult> => {
      const normalized: SidaAppealWindowConfig = {
        ...config,
        schoolId: resolvedSchoolId,
        complexId: config.complexId || activeSchool?.complexId || 'complex-1',
        updatedAtIso: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'sida_appeal_windows', 'write', {
        schoolId: normalized.schoolId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.sida_appeal_windows.some((w) => w.id === normalized.id);
        return {
          ...prev,
          sida_appeal_windows: exists
            ? prev.sida_appeal_windows.map((w) => (w.id === normalized.id ? normalized : w))
            : [normalized, ...prev.sida_appeal_windows],
        };
      });
      await sharedRepository.putItem('sida_appeal_windows', normalized);
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, activeSchool?.complexId]
  );

  const upsertSidaRemedialGroup = useCallback(
    async (group: SidaRemedialGroupRecord): Promise<MutationResult> => {
      const normalized: SidaRemedialGroupRecord = {
        ...group,
        schoolId: resolvedSchoolId,
        complexId: group.complexId || activeSchool?.complexId || 'complex-1',
        updatedAtIso: new Date().toISOString(),
      };
      const decision = authorizeMutation(authGuardContext, 'sida_remedial_groups', 'write', {
        schoolId: normalized.schoolId,
        classId: normalized.classId,
        record: normalized,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.sida_remedial_groups.some((g) => g.id === normalized.id);
        return {
          ...prev,
          sida_remedial_groups: exists
            ? prev.sida_remedial_groups.map((g) => (g.id === normalized.id ? normalized : g))
            : [normalized, ...prev.sida_remedial_groups],
        };
      });
      await sharedRepository.putItem('sida_remedial_groups', normalized);
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, activeSchool?.complexId]
  );

  const deleteSidaRemedialGroup = useCallback(
    async (groupId: string): Promise<MutationResult> => {
      const existing = dataset.sida_remedial_groups.find((g) => g.id === groupId);
      if (!existing) return { ok: false, errorFa: 'گروه تقویتی مورد نظر یافت نشد.' };
      const decision = authorizeMutation(authGuardContext, 'sida_remedial_groups', 'delete', {
        schoolId: existing.schoolId,
        classId: existing.classId,
        record: existing,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        sida_remedial_groups: prev.sida_remedial_groups.filter((g) => g.id !== groupId),
      }));
      await sharedRepository.deleteItem('sida_remedial_groups', existing.schoolId, groupId);
      return { ok: true };
    },
    [dataset.sida_remedial_groups, authGuardContext]
  );

  const upsertSidaClassBalancingDraft = useCallback(
    async (draft: SidaClassBalancingDraft): Promise<MutationResult> => {
      const normalized: SidaClassBalancingDraft = {
        ...draft,
        schoolId: resolvedSchoolId,
        complexId: draft.complexId || activeSchool?.complexId || 'complex-1',
        updatedAtIso: new Date().toISOString(),
      };
      const decision = authorizeMutation(
        authGuardContext,
        'sida_class_balancing_drafts',
        'write',
        {
          schoolId: normalized.schoolId,
          record: normalized,
        }
      );
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const exists = prev.sida_class_balancing_drafts.some((d) => d.id === normalized.id);
        return {
          ...prev,
          sida_class_balancing_drafts: exists
            ? prev.sida_class_balancing_drafts.map((d) =>
                d.id === normalized.id ? normalized : d
              )
            : [normalized, ...prev.sida_class_balancing_drafts],
        };
      });
      await sharedRepository.putItem('sida_class_balancing_drafts', normalized);
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId, activeSchool?.complexId]
  );

  const deleteSidaClassBalancingDraft = useCallback(
    async (draftId: string): Promise<MutationResult> => {
      const existing = dataset.sida_class_balancing_drafts.find((d) => d.id === draftId);
      if (!existing) return { ok: false, errorFa: 'پیش‌نویس کلاس‌بندی مورد نظر یافت نشد.' };
      const decision = authorizeMutation(
        authGuardContext,
        'sida_class_balancing_drafts',
        'delete',
        {
          schoolId: existing.schoolId,
          record: existing,
        }
      );
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        sida_class_balancing_drafts: prev.sida_class_balancing_drafts.filter(
          (d) => d.id !== draftId
        ),
      }));
      await sharedRepository.deleteItem('sida_class_balancing_drafts', existing.schoolId, draftId);
      return { ok: true };
    },
    [dataset.sida_class_balancing_drafts, authGuardContext]
  );

  const exportSingleSchoolBackup = useCallback(async () => {
    const decision = authorizeBackupOperation(authGuardContext, 'single_school', resolvedSchoolId);
    if (!decision.allowed) throw new Error(decision.reasonFa ?? 'عدم دسترسی');
    return sharedRepository.exportSchoolBackup(resolvedSchoolId);
  }, [authGuardContext, resolvedSchoolId]);

  const exportComplexBackup = useCallback(async () => {
    const decision = authorizeBackupOperation(authGuardContext, 'complex_wide');
    if (!decision.allowed) throw new Error(decision.reasonFa ?? 'عدم دسترسی');
    return sharedRepository.exportComplexBackup();
  }, [authGuardContext]);

  const restoreBackup = useCallback(
    async (payload: BackupPayload) => {
      const decision = authorizeBackupOperation(authGuardContext, payload.scope, payload.schoolId);
      if (!decision.allowed) throw new Error(decision.reasonFa ?? 'عدم دسترسی');
      await sharedRepository.restoreBackup(payload);
      setDataset({ ...sharedRepository.getSyncSnapshot() });
    },
    [authGuardContext]
  );

  const resetAllData = useCallback(async () => {
    await sharedRepository.resetToSeed();
    setDataset({ ...sharedRepository.getSyncSnapshot() });
  }, []);

  // Cross-school comparison (strictly computed for complex_admin)
  const complexComparison = useMemo<SchoolComparisonRow[]>(() => {
    if (!session || !roleDef.canViewComplexComparison) return [];
    const today = getTodayJalali();
    return schools.map((school) => {
      const sStudents = dataset.students.filter((x) => x.schoolId === school.id && x.active);
      const sTeachers = dataset.teachers.filter((x) => x.schoolId === school.id && x.active);
      const sClasses = dataset.classes.filter((x) => x.schoolId === school.id);
      const workday = getNearestActiveWorkday(today, school.activeWorkdays);

      const attToday = dataset.student_attendance.filter(
        (x) => x.schoolId === school.id && x.jalaliDate === workday && x.period === 1
      );
      const summary = computeStudentAttendanceSummary({
        totalActiveStudents: sStudents.length,
        recordsForSlot: attToday,
      });
      const absentCount = summary.absent;
      const presentRatePercent = summary.attendanceRatePercent;

      const staffAbsentToday = dataset.staff_attendance.filter(
        (x) =>
          x.schoolId === school.id &&
          x.jalaliDate === workday &&
          (x.status === 'absent' || x.status === 'late')
      );
      const subsToday = dataset.substitutions.filter(
        (x) => x.schoolId === school.id && x.jalaliDate === workday
      );
      const pendingSubstitutionsToday = staffAbsentToday.filter(
        (st) =>
          !subsToday.some(
            (sub) => sub.period === st.period && sub.absentTeacherId === st.teacherId
          )
      ).length;

      const logsCount = dataset.daily_logs.filter((x) => x.schoolId === school.id).length;
      const states = dataset.school_plugin_states.filter((x) => x.schoolId === school.id);
      const enabledAddonsCount = manifests.filter((m) => {
        if (m.isCore || !m.implemented) return false;
        const st = states.find((p) => p.pluginId === m.id);
        return st ? st.installed && st.enabled : m.defaultEnabled;
      }).length;

      return {
        school,
        studentCount: sStudents.length,
        teacherCount: sTeachers.length,
        classCount: sClasses.length,
        presentRatePercent,
        absentStudentsToday: absentCount,
        pendingSubstitutionsToday,
        dailyLogsCount: logsCount,
        enabledAddonsCount,
      };
    });
  }, [session, roleDef.canViewComplexComparison, schools, dataset, manifests]);

  // Smart Fuzzy Search catalog strictly respecting RBAC & multi-school boundaries
  const searchCatalog = useMemo<SmartSearchCatalog>(() => {
    if (!session || isParentOrStudent) {
      return {
        canSearchAllSchools: false,
        schools: [],
        students: [],
        classes: [],
        teachers: [],
      };
    }

    if (roleDef.canSwitchSchool) {
      return {
        canSearchAllSchools: true,
        schools,
        students: dataset.students.filter((x) => visibleSchoolIdSet.has(x.schoolId)),
        classes: dataset.classes.filter((x) => visibleSchoolIdSet.has(x.schoolId)),
        teachers: dataset.teachers.filter((x) => visibleSchoolIdSet.has(x.schoolId)),
      };
    }

    return {
      canSearchAllSchools: false,
      schools: activeSchool ? [activeSchool] : [],
      students,
      classes,
      teachers,
    };
  }, [session, roleDef.canSwitchSchool, dataset, schools, visibleSchoolIdSet, activeSchool, students, classes, teachers]);

  // --- Step 3: Smart Content Archive, School Announcements, Mid-Year Transfer Logs, Notifications & Safe Reset/Restore ---
  const smartContentArchive = useMemo(() => {
    if (!session) return [];
    return (dataset.smart_content_archive ?? [])
      .filter((item) => item.schoolId === resolvedSchoolId)
      .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
  }, [dataset.smart_content_archive, resolvedSchoolId, session]);

  const schoolAnnouncements = useMemo(() => {
    if (!session) return [];
    const list = (dataset.school_announcements ?? [])
      .filter((ann) => ann.schoolId === resolvedSchoolId)
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return b.updatedAtIso.localeCompare(a.updatedAtIso);
      });
    if (session.role === 'student' || session.role === 'parent') {
      const childClassId = linkedStudent?.classId;
      return list.filter(
        (ann) =>
          (ann.audienceRoles.length === 0 || ann.audienceRoles.includes(session.role)) &&
          (!ann.classId || ann.classId === childClassId)
      );
    }
    if (session.role === 'teacher') {
      return list.filter(
        (ann) =>
          (ann.audienceRoles.length === 0 || ann.audienceRoles.includes('teacher')) &&
          (!ann.classId || teacherAssignedClassIds.includes(ann.classId))
      );
    }
    return list;
  }, [dataset.school_announcements, linkedStudent?.classId, resolvedSchoolId, session, teacherAssignedClassIds]);

  const studentTransferLogs = useMemo(() => {
    if (!session || isParentOrStudent) return [];
    return (dataset.student_transfer_logs ?? [])
      .filter((log) => log.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  }, [dataset.student_transfer_logs, isParentOrStudent, resolvedSchoolId, session]);

  const recoverySnapshots = useMemo(() => {
    if (!session || (session.role !== 'super_admin' && session.role !== 'complex_admin' && session.role !== 'principal')) {
      return [];
    }
    return (dataset.recovery_snapshots ?? [])
      .filter((snap) => snap.schoolId === resolvedSchoolId)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  }, [dataset.recovery_snapshots, resolvedSchoolId, session]);

  const notificationCenter = useMemo<ComputedNotificationCenterState>(() => {
    if (!session) {
      return {
        items: [],
        totalUnreadCount: 0,
        homeworkAlertCount: 0,
        messagesAlertCount: 0,
        announcementsAlertCount: 0,
        sidebarBadges: {},
        teacherHomeworkTrackers: [],
      };
    }
    const schoolCounselingSessions = (dataset.counseling_sessions ?? []).filter(
      (cs) => cs.schoolId === resolvedSchoolId
    );
    return computeInternalNotifications({
      role: session.role,
      userId: session.userId,
      linkedStudentId: linkedStudent?.id,
      linkedTeacherId: linkedTeacher?.id,
      classes,
      students,
      homeworkAssignments,
      homeworkSubmissions,
      parentStaffMessages,
      classChatMessages,
      schoolAnnouncements,
      readReceipts: (dataset.notification_read_receipts ?? []).filter(
        (r) => r.schoolId === resolvedSchoolId
      ),
      counselingSessions: schoolCounselingSessions,
    });
  }, [
    classChatMessages,
    classes,
    dataset.counseling_sessions,
    dataset.notification_read_receipts,
    homeworkAssignments,
    homeworkSubmissions,
    linkedStudent?.id,
    linkedTeacher?.id,
    parentStaffMessages,
    resolvedSchoolId,
    schoolAnnouncements,
    session,
    students,
  ]);

  const upsertSmartArchiveItem = useCallback(
    (rawItem: SmartContentArchiveItem): MutationResult => {
      const nowIso = new Date().toISOString();
      const item: SmartContentArchiveItem = {
        ...rawItem,
        id: rawItem.id || generateUUID(),
        complexId: rawItem.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: rawItem.academicYearId || activeSchool.academicYear || '1404-1405',
        createdAtIso: rawItem.createdAtIso || nowIso,
        updatedAtIso: nowIso,
        title: sanitizeText(rawItem.title, 200),
        subject: sanitizeText(rawItem.subject, 100),
        description: sanitizeText(rawItem.description, 1200),
        teacherName: sanitizeText(rawItem.teacherName, 120),
        tags: rawItem.tags.map((t) => sanitizeText(t, 40)).filter(Boolean),
      };
      const decision = authorizeMutation(authGuardContext, 'smart_content_archive', 'write', {
        schoolId: item.schoolId,
        record: item,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...(prev.smart_content_archive ?? [])];
        const idx = list.findIndex((a) => a.id === item.id);
        if (idx >= 0) list[idx] = item;
        else list.unshift(item);
        return { ...prev, smart_content_archive: list };
      });
      void sharedRepository.putItem('smart_content_archive', item).catch(() => {});
      return { ok: true };
    },
    [activeSchool.academicYear, activeSchool.complexId, authGuardContext, resolvedSchoolId]
  );

  const deleteSmartArchiveItem = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'smart_content_archive', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        smart_content_archive: (prev.smart_content_archive ?? []).filter(
          (a) => !(a.id === id && a.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('smart_content_archive', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const reuseArchiveItemInClass = useCallback(
    (params: { archiveId: string; targetClassId: string; deadlineJalali?: string }): MutationResult => {
      const archiveItem = (dataset.smart_content_archive ?? []).find(
        (a) => a.id === params.archiveId && a.schoolId === resolvedSchoolId
      );
      if (!archiveItem) {
        return { ok: false, errorFa: 'مورد انتخاب‌شده در آرشیو هوشمند یافت نشد.' };
      }
      const targetClass = dataset.classes.find(
        (c) => c.id === params.targetClassId && c.schoolId === resolvedSchoolId
      );
      if (!targetClass) {
        return { ok: false, errorFa: 'کلاس مقصد معتبر نیست.' };
      }

      const nowIso = new Date().toISOString();
      const todayJalali = getTodayJalali();
      const actorName = session?.displayName ?? archiveItem.teacherName;
      const actorTeacherId = session?.linkedTeacherId ?? archiveItem.teacherId;

      if (archiveItem.contentType === 'video') {
        const newLesson: FlippedVideoLesson = {
          id: generateUUID(),
          schoolId: resolvedSchoolId,
          classId: targetClass.id,
          teacherId: actorTeacherId,
          teacherName: actorName,
          subject: archiveItem.subject,
          title: archiveItem.title,
          description: `${archiveItem.description}${archiveItem.url ? ` — لینک: ${archiveItem.url}` : ''}`,
          deadlineJalali: params.deadlineJalali || todayJalali,
          videoSource: 'demo_60s',
          durationSeconds: 60,
          microQuiz: [
            {
              id: generateUUID(),
              questionText: `مهم‌ترین نکته آموزشی درس «${archiveItem.title}» کدام است؟`,
              options: [
                'درک کامل مفاهیم پایه و تمرین عملی',
                'حفظ کردن بدون درک مفهوم',
                'بی‌توجهی به نکات کلیدی',
                'نداشتن مرور هفتگی',
              ],
              correctOptionIndex: 0,
            },
          ],
          createdAtJalali: todayJalali,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const res = authorizeMutation(authGuardContext, 'flipped_lessons', 'write', {
          schoolId: resolvedSchoolId,
          classId: targetClass.id,
          record: newLesson,
        });
        if (!res.allowed) return { ok: false, errorFa: res.reasonFa };
        setDataset((prev) => ({
          ...prev,
          flipped_lessons: [newLesson, ...prev.flipped_lessons],
        }));
        void sharedRepository.putItem('flipped_lessons', newLesson).catch(() => {});
      } else if (archiveItem.contentType === 'handout') {
        const newMedia: MediaResource = {
          id: generateUUID(),
          schoolId: resolvedSchoolId,
          gradeLevel: targetClass.gradeLevel,
          subject: archiveItem.subject,
          weekNumber: 1,
          kind: archiveItem.url ? 'link' : 'pdf',
          title: `${archiveItem.title} (${targetClass.name})`,
          description: archiveItem.description,
          url: archiveItem.url,
          fileName: archiveItem.attachmentName,
          uploadedByName: actorName,
          uploadedByRole: session?.role ?? 'teacher',
          createdAtJalali: todayJalali,
          createdAt: nowIso,
        };
        const res = authorizeMutation(authGuardContext, 'media_resources', 'write', {
          schoolId: resolvedSchoolId,
          record: newMedia,
        });
        if (!res.allowed) return { ok: false, errorFa: res.reasonFa };
        setDataset((prev) => ({
          ...prev,
          media_resources: [newMedia, ...prev.media_resources],
        }));
        void sharedRepository.putItem('media_resources', newMedia).catch(() => {});
      } else {
        const newQuestion: QuestionBankItem = {
          id: generateUUID(),
          schoolId: resolvedSchoolId,
          gradeLevel: targetClass.gradeLevel,
          gradeLabel: targetClass.customGradeLabel ?? `پایه ${targetClass.gradeLevel}`,
          subject: archiveItem.subject,
          chapter: archiveItem.tags[1] ?? 'بازاستفاده از آرشیو',
          difficulty: 'medium',
          type: 'descriptive',
          questionText: archiveItem.description || archiveItem.title,
          createdById: session?.userId ?? 'staff',
          createdByName: actorName,
          createdByRole: session?.role ?? 'teacher',
          createdAtJalali: todayJalali,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const res = authorizeMutation(authGuardContext, 'question_bank', 'write', {
          schoolId: resolvedSchoolId,
          record: newQuestion,
        });
        if (!res.allowed) return { ok: false, errorFa: res.reasonFa };
        setDataset((prev) => ({
          ...prev,
          question_bank: [newQuestion, ...prev.question_bank],
        }));
        void sharedRepository.putItem('question_bank', newQuestion).catch(() => {});
      }

      const updatedArchive: SmartContentArchiveItem = {
        ...archiveItem,
        reuseCount: archiveItem.reuseCount + 1,
        reusedInClassIds: archiveItem.reusedInClassIds.includes(targetClass.id)
          ? archiveItem.reusedInClassIds
          : [...archiveItem.reusedInClassIds, targetClass.id],
        updatedAtIso: nowIso,
      };
      setDataset((prev) => ({
        ...prev,
        smart_content_archive: (prev.smart_content_archive ?? []).map((a) =>
          a.id === updatedArchive.id ? updatedArchive : a
        ),
      }));
      void sharedRepository.putItem('smart_content_archive', updatedArchive).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, dataset.classes, dataset.smart_content_archive, resolvedSchoolId, session]
  );

  const upsertSchoolAnnouncement = useCallback(
    (rawAnn: SchoolAnnouncement): MutationResult => {
      const nowIso = new Date().toISOString();
      const ann: SchoolAnnouncement = {
        ...rawAnn,
        id: rawAnn.id || generateUUID(),
        complexId: rawAnn.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: rawAnn.academicYearId || activeSchool.academicYear || '1404-1405',
        createdAtIso: rawAnn.createdAtIso || nowIso,
        updatedAtIso: nowIso,
        title: sanitizeText(rawAnn.title, 200),
        body: sanitizeText(rawAnn.body, 2000),
        subject: rawAnn.subject ? sanitizeText(rawAnn.subject, 100) : undefined,
        authorName: sanitizeText(rawAnn.authorName || session?.displayName || 'مدیریت مدرسه', 120),
        publishedAtJalali: rawAnn.publishedAtJalali || getTodayJalali(),
      };
      const decision = authorizeMutation(authGuardContext, 'school_announcements', 'write', {
        schoolId: ann.schoolId,
        classId: ann.classId,
        record: ann,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => {
        const list = [...(prev.school_announcements ?? [])];
        const idx = list.findIndex((a) => a.id === ann.id);
        if (idx >= 0) list[idx] = ann;
        else list.unshift(ann);
        return { ...prev, school_announcements: list };
      });
      void sharedRepository.putItem('school_announcements', ann).catch(() => {});
      return { ok: true };
    },
    [activeSchool.academicYear, activeSchool.complexId, authGuardContext, resolvedSchoolId, session]
  );

  const deleteSchoolAnnouncement = useCallback(
    (id: string): MutationResult => {
      const decision = authorizeMutation(authGuardContext, 'school_announcements', 'delete', {
        schoolId: resolvedSchoolId,
      });
      if (!decision.allowed) return { ok: false, errorFa: decision.reasonFa };

      setDataset((prev) => ({
        ...prev,
        school_announcements: (prev.school_announcements ?? []).filter(
          (a) => !(a.id === id && a.schoolId === resolvedSchoolId)
        ),
      }));
      void sharedRepository.deleteItem('school_announcements', resolvedSchoolId, id).catch(() => {});
      return { ok: true };
    },
    [authGuardContext, resolvedSchoolId]
  );

  const markNotificationRead = useCallback(
    (notificationKey: string) => {
      if (!session || !notificationKey) return;
      const receiptId = `${resolvedSchoolId}:nread:${session.userId}:${notificationKey}`;
      const alreadyExists = (dataset.notification_read_receipts ?? []).some(
        (r) => r.id === receiptId
      );
      if (alreadyExists) return;
      const nowIso = new Date().toISOString();
      const receipt: NotificationReadReceipt = {
        id: receiptId,
        complexId: activeSchool.complexId ?? 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: activeSchool.academicYear || '1404-1405',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        createdByUserId: session.userId,
        userId: session.userId,
        notificationKey,
        readAtIso: nowIso,
      };
      setDataset((prev) => ({
        ...prev,
        notification_read_receipts: [...(prev.notification_read_receipts ?? []), receipt],
      }));
      void sharedRepository.putItem('notification_read_receipts', receipt).catch(() => {});
    },
    [activeSchool.academicYear, activeSchool.complexId, dataset.notification_read_receipts, resolvedSchoolId, session]
  );

  const markAllNotificationsRead = useCallback(() => {
    if (!session) return;
    const nowIso = new Date().toISOString();
    const newReceipts: NotificationReadReceipt[] = [];
    for (const item of notificationCenter.items) {
      if (!item.canDismissByRead || !item.readReceiptKey) continue;
      const receiptId = `${resolvedSchoolId}:nread:${session.userId}:${item.readReceiptKey}`;
      if ((dataset.notification_read_receipts ?? []).some((r) => r.id === receiptId)) continue;
      newReceipts.push({
        id: receiptId,
        complexId: activeSchool.complexId ?? 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: activeSchool.academicYear || '1404-1405',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        createdByUserId: session.userId,
        userId: session.userId,
        notificationKey: item.readReceiptKey,
        readAtIso: nowIso,
      });
    }
    if (newReceipts.length === 0) return;
    setDataset((prev) => ({
      ...prev,
      notification_read_receipts: [...(prev.notification_read_receipts ?? []), ...newReceipts],
    }));
    void sharedRepository.putMany('notification_read_receipts', newReceipts).catch(() => {});
  }, [
    activeSchool.academicYear,
    activeSchool.complexId,
    dataset.notification_read_receipts,
    notificationCenter.items,
    resolvedSchoolId,
    session,
  ]);

  const createRecoverySnapshot = useCallback(
    async (
      moduleKey: SelectiveResetModuleKey | 'full_school',
      reasonFa: string
    ): Promise<MutationResult & { snapshot?: RecoverySnapshotRecord }> => {
      const dec = authorizeMutation(authGuardContext, 'recovery_snapshots', 'write', {
        schoolId: resolvedSchoolId,
      });
      if (!dec.allowed || !session) {
        return { ok: false, errorFa: dec.reasonFa ?? 'دسترسی ذخیره نقطه بازگشت مجاز نیست.' };
      }
      const collectionsToCapture: CollectionName[] =
        moduleKey === 'full_school'
          ? [
              'homework_assignments',
              'homework_submissions',
              'student_attendance',
              'staff_attendance',
              'parent_staff_messages',
              'class_chat_messages',
              'smart_content_archive',
              'school_announcements',
              'school_branding_configs',
            ]
          : getSelectiveResetModuleMeta(moduleKey).collections;

      const capturedCollections: Partial<Record<CollectionName, unknown[]>> = {};
      let affectedCount = 0;
      for (const col of collectionsToCapture) {
        const rows = (dataset[col] as Array<{ schoolId: string }>).filter(
          (row) => row.schoolId === resolvedSchoolId
        );
        capturedCollections[col] = rows;
        affectedCount += rows.length;
      }

      const nowIso = new Date().toISOString();
      const snapshot: RecoverySnapshotRecord = {
        id: generateUUID(),
        complexId: activeSchool.complexId ?? 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: activeSchool.academicYear || '1404-1405',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        createdByUserId: session.userId,
        moduleKey,
        moduleLabelFa:
          moduleKey === 'full_school'
            ? 'کل ماژول‌های عملیاتی مدرسه'
            : getSelectiveResetModuleMeta(moduleKey).labelFa,
        reasonFa: sanitizeText(reasonFa, 240),
        createdByName: session.displayName,
        createdByRole: session.role,
        createdAtJalali: getTodayJalali(),
        affectedCount,
        payloadJson: serializeModuleSnapshot({
          version: 1,
          schoolId: resolvedSchoolId,
          moduleKey,
          collections: capturedCollections,
        }),
      };

      setDataset((prev) => ({
        ...prev,
        recovery_snapshots: [snapshot, ...(prev.recovery_snapshots ?? [])].slice(0, 20),
      }));
      await sharedRepository.putItem('recovery_snapshots', snapshot).catch(() => {});
      return { ok: true, snapshot };
    },
    [activeSchool.academicYear, activeSchool.complexId, authGuardContext, dataset, resolvedSchoolId, session]
  );

  const executeSelectiveSafeReset = useCallback(
    async (
      moduleKey: SelectiveResetModuleKey,
      reasonFa?: string
    ): Promise<MutationResult & { snapshot?: RecoverySnapshotRecord; clearedCount?: number }> => {
      const meta = getSelectiveResetModuleMeta(moduleKey);
      // Step 1: ALWAYS capture automatic emergency backup BEFORE resetting anything!
      const snapRes = await createRecoverySnapshot(
        moduleKey,
        reasonFa || `بکاپ اضطراری خودکار پیش از ریست امن بخش «${meta.labelFa}»`
      );
      if (!snapRes.ok || !snapRes.snapshot) {
        return { ok: false, errorFa: snapRes.errorFa ?? 'ایجاد بکاپ اضطراری پیش از ریست ناموفق بود.' };
      }

      let clearedCount = 0;
      const idsToDeleteByCol: Array<{ col: CollectionName; ids: string[] }> = [];
      for (const col of meta.collections) {
        const rows = (dataset[col] as Array<{ id: string; schoolId: string }>).filter(
          (row) => row.schoolId === resolvedSchoolId
        );
        clearedCount += rows.length;
        idsToDeleteByCol.push({ col, ids: rows.map((r) => r.id) });
      }

      setDataset((prev) => {
        const next = { ...prev } as SeedDataset;
        for (const col of meta.collections) {
          const existing = next[col] as Array<{ schoolId: string }>;
          (next as unknown as Record<CollectionName, unknown[]>)[col] = existing.filter(
            (row) => row.schoolId !== resolvedSchoolId
          );
        }
        return next;
      });

      for (const entry of idsToDeleteByCol) {
        for (const id of entry.ids) {
          await sharedRepository.deleteItem(entry.col, resolvedSchoolId, id).catch(() => {});
        }
      }

      return { ok: true, snapshot: snapRes.snapshot, clearedCount };
    },
    [createRecoverySnapshot, dataset, resolvedSchoolId]
  );

  const restoreRecoverySnapshot = useCallback(
    async (snapshotId: string): Promise<MutationResult> => {
      const dec = authorizeMutation(authGuardContext, 'recovery_snapshots', 'write', {
        schoolId: resolvedSchoolId,
      });
      if (!dec.allowed) return { ok: false, errorFa: dec.reasonFa };

      const target = (dataset.recovery_snapshots ?? []).find(
        (s) => s.id === snapshotId && s.schoolId === resolvedSchoolId
      );
      if (!target) {
        return { ok: false, errorFa: 'نقطه بازگشت انتخاب‌شده یافت نشد.' };
      }
      const parsed = parseModuleSnapshot(target.payloadJson);
      if (!parsed || parsed.schoolId !== resolvedSchoolId) {
        return { ok: false, errorFa: 'ساختار فایل پشتیبان اضطراری معتبر نیست.' };
      }

      const entries = Object.entries(parsed.collections) as Array<[CollectionName, unknown[]]>;
      // First clear current school rows in those collections, then restore snapshot rows
      setDataset((prev) => {
        const next = { ...prev } as SeedDataset;
        for (const [col, restoredRows] of entries) {
          const existingOther = (next[col] as Array<{ schoolId: string }>).filter(
            (row) => row.schoolId !== resolvedSchoolId
          );
          (next as unknown as Record<CollectionName, unknown[]>)[col] = [
            ...existingOther,
            ...restoredRows,
          ];
        }
        return next;
      });

      for (const [col, restoredRows] of entries) {
        const currentIds = (dataset[col] as Array<{ id: string; schoolId: string }>)
          .filter((row) => row.schoolId === resolvedSchoolId)
          .map((row) => row.id);
        for (const id of currentIds) {
          await sharedRepository.deleteItem(col, resolvedSchoolId, id).catch(() => {});
        }
        if (restoredRows.length > 0) {
          await sharedRepository
            .putMany(col, restoredRows as never[])
            .catch(() => {});
        }
      }

      return { ok: true };
    },
    [authGuardContext, dataset, resolvedSchoolId]
  );

  // ============================================================================
  // STEP 3-B: DATA VAULT, MIGRATION ENGINE, RECYCLE BIN, PANIC MODE & BUNDLES
  // ============================================================================

  const verifyCurrentUserPassword = useCallback(
    async (candidatePassword: string): Promise<boolean> => {
      const targetSession = realSession ?? session;
      if (!targetSession) return false;
      const rawSnapshot = sharedRepository.getSyncSnapshot();
      return verifyUserPasswordAsync({
        userId: targetSession.userId,
        candidatePassword,
        schools: rawSnapshot.schools,
        students: rawSnapshot.students,
        teachers: rawSnapshot.teachers,
        managedAdminAccounts: rawSnapshot.managed_admin_accounts,
      });
    },
    [realSession, session]
  );

  const activatePanicMode = useCallback(
    async (
      scope: PanicModeScope,
      schoolIds: string[],
      reasonFa: string
    ): Promise<MutationResult> => {
      const actor = realSession ?? session;
      if (!actor || actor.role !== 'super_admin') {
        return {
          ok: false,
          errorFa: 'فقط راهبر ارشد سامانه مجاز به فعال‌سازی حالت اضطراری (قفل فقط‌خواندنی) است.',
        };
      }
      const cleanReason =
        sanitizeText(reasonFa, 240) || 'فعال‌سازی قفل اضطراری محافظتی جهت بررسی امنیت داده‌ها';
      const lockedIds =
        scope === 'all_schools'
          ? dataset.schools.map((s) => s.id)
          : schoolIds.filter((id) => dataset.schools.some((s) => s.id === id));

      if (scope === 'selected_schools' && lockedIds.length === 0) {
        return { ok: false, errorFa: 'حداقل یک مدرسه را برای قفل اضطراری انتخاب کنید.' };
      }

      const nextState: PanicModeState = {
        enabled: true,
        scope,
        lockedSchoolIds: lockedIds,
        reasonFa: cleanReason,
        activatedByUserId: actor.userId,
        activatedByName: actor.displayName,
        activatedAtJalali: getTodayJalali(),
        activatedAtIso: new Date().toISOString(),
      };
      await sharedRepository.savePanicModeState(nextState);
      setPanicModeState(nextState);

      logSecurityEvent({
        eventType: 'panic_mode_enabled',
        schoolId: scope === 'selected_schools' && lockedIds.length === 1 ? lockedIds[0] : GLOBAL_TENANT_ID,
        complexId: actor.complexId ?? 'complex-1',
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        detailsFa: `فعال‌سازی قفل اضطراری (${
          scope === 'all_schools' ? 'هر ۳ مدرسه مجتمع' : `${lockedIds.length} مدرسه منتخب`
        }) — دلیل: ${cleanReason}`,
      });
      return { ok: true };
    },
    [realSession, session, dataset.schools, logSecurityEvent]
  );

  const deactivatePanicMode = useCallback(
    async (passwordPlain: string, confirmPhrase: string): Promise<MutationResult> => {
      const actor = realSession ?? session;
      if (!actor || actor.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد مجاز به غیرفعال‌سازی قفل اضطراری است.' };
      }
      if (confirmPhrase.trim() !== 'تایید بازگشایی') {
        return { ok: false, errorFa: 'عبارت تایید «تایید بازگشایی» باید دقیقاً وارد شود.' };
      }
      const passwordOk = await verifyCurrentUserPassword(passwordPlain);
      if (!passwordOk) {
        return { ok: false, errorFa: 'رمز عبور راهبر ارشد نادرست است.' };
      }

      const nextState: PanicModeState = { ...DEFAULT_PANIC_MODE_STATE };
      await sharedRepository.savePanicModeState(nextState);
      setPanicModeState(nextState);

      logSecurityEvent({
        eventType: 'panic_mode_disabled',
        schoolId: GLOBAL_TENANT_ID,
        complexId: actor.complexId ?? 'complex-1',
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        detailsFa: `رفع قفل اضطراری سامانه پس از احراز هویت دومرحله‌ای توسط «${actor.displayName}»`,
      });
      return { ok: true };
    },
    [realSession, session, verifyCurrentUserPassword, logSecurityEvent]
  );

  const restoreSoftDeletedRecord = useCallback(
    async (collection: CollectionName, schoolId: string, id: string): Promise<MutationResult> => {
      if (!session || (session.role !== 'super_admin' && session.role !== 'principal')) {
        return { ok: false, errorFa: 'فقط راهبر ارشد یا مدیر مدرسه مجاز به بازیابی رکوردهای حذف‌شده است.' };
      }
      if (session.role === 'principal' && schoolId !== resolvedSchoolId) {
        return { ok: false, errorFa: 'مدیر مدرسه فقط مجاز به بازیابی رکوردهای مدرسه خود است.' };
      }
      if (isSchoolUnderPanicLock(panicModeState, schoolId)) {
        return {
          ok: false,
          errorFa: 'در وضعیت قفل اضطراری (فقط‌خواندنی)، بازیابی اطلاعات تا رفع قفل ممکن نیست.',
        };
      }

      try {
        const restored = await sharedRepository.restoreSoftDeletedItem(collection, schoolId, id);
        if (!restored) {
          return { ok: false, errorFa: 'رکورد مورد نظر در سطل بازیابی یافت نشد.' };
        }
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();

        logSecurityEvent({
          eventType: 'soft_delete_restored',
          schoolId,
          complexId: session.complexId ?? 'complex-1',
          username: session.username,
          displayName: session.displayName,
          role: session.role,
          detailsFa: `بازیابی فوری رکورد (${id}) از بخش «${collection}» در سطل بازیابی امن`,
        });
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          errorFa: err instanceof Error ? err.message : 'خطا در بازیابی رکورد از سطل بازیابی.',
        };
      }
    },
    [session, resolvedSchoolId, panicModeState, refreshSoftDeletedItems, logSecurityEvent]
  );

  const runVaultChunkedMigration = useCallback(
    async (
      onProgress?: (progress: MigrationProgressState) => void,
      simulateError = false
    ): Promise<ChunkedMigrationResult> => {
      const actor = realSession ?? session;
      const currentMeta = sharedRepository.getVaultMeta();
      const rawDataset = sharedRepository.getSyncSnapshot();

      const result = await runChunkedMigration({
        dataset: rawDataset,
        fromVersion: currentMeta.schemaVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
        chunkSize: 50,
        executedByName: actor?.displayName ?? 'راهبر ارشد سامانه',
        savePreSnapshot: async (json) => {
          await sharedRepository.savePreMigrationSnapshot(json);
        },
        onProgress,
        simulateErrorAtChunk: simulateError ? 2 : undefined,
      });

      await sharedRepository.replaceEntireDataset(result.dataset);
      setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));

      const updatedMeta: MigrationVaultMeta = {
        ...sharedRepository.getVaultMeta(),
        schemaVersion: result.schemaVersion,
        lastMigratedAtIso: result.historyEntry.executedAtIso,
        lastMigratedAtJalali: result.historyEntry.executedAtJalali,
        history: [result.historyEntry, ...currentMeta.history].slice(0, 30),
      };
      await sharedRepository.saveVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);

      logSecurityEvent({
        eventType: 'migration_executed',
        schoolId: GLOBAL_TENANT_ID,
        complexId: actor?.complexId ?? 'complex-1',
        username: actor?.username ?? 'superadmin',
        displayName: actor?.displayName ?? 'راهبر ارشد',
        role: actor?.role ?? 'super_admin',
        detailsFa: result.historyEntry.summaryFa,
      });

      return result;
    },
    [realSession, session, logSecurityEvent]
  );

  const runDataIntegrityCheck = useCallback((schoolId?: string): ReferentialIntegrityReport => {
    return runReferentialIntegrityCheck(sharedRepository.getSyncSnapshot(), schoolId);
  }, []);

  const exportPhase10MigrationBundle = useCallback(
    async (
      scope: MigrationBundleScope,
      schoolId?: string,
      academicYearId?: string
    ): Promise<SealedMigrationBundle> => {
      const actor = realSession ?? session;
      const rawDataset = sharedRepository.getSyncSnapshot();
      const targetSchool = schoolId ? rawDataset.schools.find((s) => s.id === schoolId) : undefined;
      return createSealedMigrationBundle({
        dataset: rawDataset,
        scope,
        schoolId,
        schoolName: targetSchool?.name,
        academicYearId,
        exportedByName: actor?.displayName ?? 'راهبر ارشد',
        schemaVersion: sharedRepository.getVaultMeta().schemaVersion,
      });
    },
    [realSession, session]
  );

  const verifyMigrationBundleFile = useCallback(
    async (rawJson: string): Promise<MigrationBundleVerificationResult> => {
      return verifyAndPreviewMigrationBundle(rawJson);
    },
    []
  );

  const executeGranularBundleRestore = useCallback(
    async (
      bundle: SealedMigrationBundle,
      passwordPlain: string,
      confirmPhrase: string
    ): Promise<MutationResult & { undoSnapshot?: DailyRollingSnapshot }> => {
      const actor = realSession ?? session;
      if (!actor || actor.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد مجاز به بازگردانی بسته‌های مهاجرت است.' };
      }
      if (confirmPhrase.trim() !== 'تایید بازگردانی') {
        return { ok: false, errorFa: 'عبارت تایید «تایید بازگردانی» باید دقیقاً وارد شود.' };
      }
      const passwordOk = await verifyCurrentUserPassword(passwordPlain);
      if (!passwordOk) {
        return { ok: false, errorFa: 'رمز عبور واردشده صحیح نیست.' };
      }

      // Auto-capture emergency Undo snapshot BEFORE touching current data
      const currentRaw = sharedRepository.getSyncSnapshot();
      const undoSnapshot = await buildDailyRollingSnapshot({
        dataset: currentRaw,
        trigger: 'pre_restore_undo',
        labelFa: `نقطه بازگشت اضطراری پیش از بازگردانی (${bundle.scope === 'single_school' ? bundle.schoolName ?? bundle.schoolId : bundle.scope === 'academic_year' ? bundle.academicYearId : 'کل مجتمع'})`,
        schemaVersion: sharedRepository.getVaultMeta().schemaVersion,
      });
      setLastUndoSnapshot(undoSnapshot);
      await sharedRepository.saveDailyRollingSnapshot(undoSnapshot);
      setDailyRollingSnapshots(sharedRepository.getDailyRollingSnapshots());

      const merged = applyGranularBundleToDataset(currentRaw, bundle);
      await sharedRepository.replaceEntireDataset(merged);
      setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
      await refreshSoftDeletedItems();

      logSecurityEvent({
        eventType: 'backup_restored',
        schoolId: bundle.schoolId ?? GLOBAL_TENANT_ID,
        complexId: actor.complexId ?? 'complex-1',
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        detailsFa: `بازگردانی امضاشده (${bundle.scope}) شامل ${bundle.totalRecords} رکورد با تایید دومرحله‌ای`,
      });

      return { ok: true, undoSnapshot };
    },
    [realSession, session, verifyCurrentUserPassword, refreshSoftDeletedItems, logSecurityEvent]
  );

  const undoLastBundleRestore = useCallback(async (): Promise<MutationResult> => {
    const actor = realSession ?? session;
    if (!actor || actor.role !== 'super_admin') {
      return { ok: false, errorFa: 'فقط راهبر ارشد مجاز به اجرای بازگشت فوری است.' };
    }
    if (!lastUndoSnapshot) {
      return { ok: false, errorFa: 'نقطه بازگشت فوری فعالی در این نشست وجود ندارد.' };
    }
    try {
      const parsed = JSON.parse(lastUndoSnapshot.payloadJson) as SeedDataset;
      await sharedRepository.replaceEntireDataset(parsed);
      setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
      await refreshSoftDeletedItems();

      logSecurityEvent({
        eventType: 'backup_restored',
        schoolId: GLOBAL_TENANT_ID,
        complexId: actor.complexId ?? 'complex-1',
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        detailsFa: `اجرای بازگشت فوری (Undo) به وضعیت قبل از آخرین بازگردانی (${lastUndoSnapshot.jalaliDate})`,
      });
      setLastUndoSnapshot(null);
      return { ok: true };
    } catch {
      return { ok: false, errorFa: 'خطا در خواندن نقطه بازگشت فوری.' };
    }
  }, [realSession, session, lastUndoSnapshot, refreshSoftDeletedItems, logSecurityEvent]);

  const createDailyRollingSnapshotNow = useCallback(
    async (
      labelFa?: string
    ): Promise<MutationResult & { snapshot?: DailyRollingSnapshot }> => {
      const actor = realSession ?? session;
      if (!actor || actor.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد مجاز به ایجاد نقطه پشتیبان فوری است.' };
      }
      const snapshot = await buildDailyRollingSnapshot({
        dataset: sharedRepository.getSyncSnapshot(),
        trigger: 'manual',
        labelFa: labelFa?.trim() || `پشتیبان دستی راهبر ارشد (${getTodayJalali()})`,
        schemaVersion: sharedRepository.getVaultMeta().schemaVersion,
      });
      await sharedRepository.saveDailyRollingSnapshot(snapshot);
      setDailyRollingSnapshots(sharedRepository.getDailyRollingSnapshots());
      return { ok: true, snapshot };
    },
    [realSession, session]
  );

  const restoreDailyRollingSnapshot = useCallback(
    async (
      snapshotId: string,
      passwordPlain: string,
      confirmPhrase: string
    ): Promise<MutationResult> => {
      const actor = realSession ?? session;
      if (!actor || actor.role !== 'super_admin') {
        return { ok: false, errorFa: 'فقط راهبر ارشد مجاز به بازگردانی نقاط پشتیبان روزانه است.' };
      }
      if (confirmPhrase.trim() !== 'تایید بازگردانی') {
        return { ok: false, errorFa: 'عبارت تایید «تایید بازگردانی» باید دقیقاً وارد شود.' };
      }
      const passwordOk = await verifyCurrentUserPassword(passwordPlain);
      if (!passwordOk) {
        return { ok: false, errorFa: 'رمز عبور واردشده صحیح نیست.' };
      }

      const target = sharedRepository
        .getDailyRollingSnapshots()
        .find((item) => item.id === snapshotId);
      if (!target) {
        return { ok: false, errorFa: 'نقطه پشتیبان انتخاب‌شده یافت نشد.' };
      }

      try {
        const parsed = JSON.parse(target.payloadJson) as SeedDataset;
        // Capture undo snapshot first
        const undoSnap = await buildDailyRollingSnapshot({
          dataset: sharedRepository.getSyncSnapshot(),
          trigger: 'pre_restore_undo',
          labelFa: `بازگشت فوری پیش از بازیابی نقطه ${target.jalaliDate}`,
          schemaVersion: sharedRepository.getVaultMeta().schemaVersion,
        });
        setLastUndoSnapshot(undoSnap);

        await sharedRepository.replaceEntireDataset(parsed);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();

        logSecurityEvent({
          eventType: 'backup_restored',
          schoolId: GLOBAL_TENANT_ID,
          complexId: actor.complexId ?? 'complex-1',
          username: actor.username,
          displayName: actor.displayName,
          role: actor.role,
          detailsFa: `بازگردانی نقطه پشتیبان «${target.labelFa}» مورخ ${target.jalaliDate}`,
        });
        return { ok: true };
      } catch {
        return { ok: false, errorFa: 'ساختار نقطه پشتیبان انتخاب‌شده معتبر نیست.' };
      }
    },
    [realSession, session, verifyCurrentUserPassword, refreshSoftDeletedItems, logSecurityEvent]
  );

  // ============================================================================
  // STEP 3-C: SMART TABLE MAPPING & AUTO COLUMN MATCHING WIZARD ACTIONS
  // ============================================================================

  const importMappingTemplates = useMemo(
    () => dataset.import_mapping_templates ?? [],
    [dataset.import_mapping_templates]
  );

  const getSchoolRecordsForImport = useCallback(
    (targetSchoolId: string): ExistingSchoolLookup => {
      const snap = buildActiveViewDataset(sharedRepository.getSyncSnapshot());
      return {
        students: snap.students.filter((s) => s.schoolId === targetSchoolId),
        teachers: snap.teachers.filter((t) => t.schoolId === targetSchoolId),
        classes: snap.classes.filter((c) => c.schoolId === targetSchoolId),
        gradebookEntries: snap.gradebook_entries.filter((g) => g.schoolId === targetSchoolId),
      };
    },
    []
  );

  const saveImportMappingTemplate = useCallback(
    async (template: ImportMappingTemplate): Promise<MutationResult> => {
      if (!session) {
        return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      }
      if (session.role !== 'super_admin' && session.role !== 'principal') {
        return {
          ok: false,
          errorFa: 'ذخیره الگوی نگاشت صرفاً در اختیار راهبر ارشد و مدیر مدرسه است.',
        };
      }
      if (session.role === 'principal' && template.schoolId !== session.schoolId) {
        return {
          ok: false,
          errorFa: 'مدیر مدرسه فقط مجاز به ذخیره الگو برای مدرسه خود است.',
        };
      }
      const enforcedTemplate: ImportMappingTemplate = {
        ...template,
        isComplexWide: session.role === 'super_admin' ? Boolean(template.isComplexWide) : false,
        updatedAtIso: new Date().toISOString(),
      };
      try {
        await sharedRepository.putItem('import_mapping_templates', enforcedTemplate);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          errorFa: err instanceof Error ? err.message : 'خطا در ذخیره الگوی نگاشت.',
        };
      }
    },
    [session]
  );

  const deleteImportMappingTemplate = useCallback(
    async (templateId: string, schoolId: string): Promise<MutationResult> => {
      if (!session || (session.role !== 'super_admin' && session.role !== 'principal')) {
        return { ok: false, errorFa: 'عدم دسترسی به حذف نرم الگوی نگاشت.' };
      }
      if (session.role === 'principal' && schoolId !== session.schoolId) {
        return { ok: false, errorFa: 'شما مجاز به حذف الگوی مدرسه دیگر نیستید.' };
      }
      try {
        await sharedRepository.deleteItem('import_mapping_templates', schoolId, templateId);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          errorFa: err instanceof Error ? err.message : 'خطا در انتقال الگو به سطل بازیابی.',
        };
      }
    },
    [session, refreshSoftDeletedItems]
  );

  const commitSmartImportBatch = useCallback(
    async (
      payload: SmartImportCommitPayload
    ): Promise<MutationResult & { receipt?: SmartImportCommitReceipt }> => {
      if (!session) {
        return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      }
      if (session.role !== 'super_admin' && session.role !== 'principal') {
        return {
          ok: false,
          errorFa: 'اجرای ورود هوشمند داده صرفاً برای راهبر ارشد و مدیر مدرسه مجاز است.',
        };
      }
      if (session.role === 'principal' && payload.schoolId !== session.schoolId) {
        return {
          ok: false,
          errorFa: 'تخلف ایزوله‌سازی مدرسه: مدیر مدرسه فقط مجاز به ثبت داده در مدرسه فعال خود است.',
        };
      }
      if (isSchoolUnderPanicLock(sharedRepository.getPanicModeState(), payload.schoolId)) {
        return {
          ok: false,
          errorFa:
            'مدرسه انتخاب‌شده در وضعیت قفل اضطراری (فقط‌خواندنی) قرار دارد و ثبت داده جدید ممکن نیست.',
        };
      }

      const targetSchool = dataset.schools.find((s) => s.id === payload.schoolId);
      if (!targetSchool) {
        return { ok: false, errorFa: 'مدرسه انتخاب‌شده در سامانه یافت نشد.' };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const todayJalali = getTodayJalali();
      const timeHm = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const batchId = generateUUID();

      const snap = buildActiveViewDataset(sharedRepository.getSyncSnapshot());
      const schoolClasses = snap.classes.filter((c) => c.schoolId === payload.schoolId);
      const schoolStudents = snap.students.filter((s) => s.schoolId === payload.schoolId);
      const schoolTeachers = snap.teachers.filter((t) => t.schoolId === payload.schoolId);
      const schoolGrades = snap.gradebook_entries.filter((g) => g.schoolId === payload.schoolId);

      const classByName = new Map<string, ClassRoom>(
        schoolClasses.map((c) => [normalizePersianText(c.name), c])
      );
      const studentById = new Map<string, Student>(schoolStudents.map((s) => [s.id, s]));
      const studentByNatId = new Map<string, Student>(schoolStudents.map((s) => [s.nationalId, s]));
      const teacherById = new Map<string, Teacher>(schoolTeachers.map((t) => [t.id, t]));

      const inferGradeNumber = (label: string): 2 | 3 | 4 | 5 | 6 => {
        if (label.includes('دوم') || label.includes('2') || label.includes('۲')) return 2;
        if (label.includes('سوم') || label.includes('3') || label.includes('۳')) return 3;
        if (label.includes('چهارم') || label.includes('4') || label.includes('۴')) return 4;
        if (label.includes('پنجم') || label.includes('5') || label.includes('۵')) return 5;
        if (label.includes('ششم') || label.includes('6') || label.includes('۶')) return 6;
        return 4;
      };

      const classesToPersist: ClassRoom[] = [];
      let newClassesCreatedCount = 0;

      const ensureClassIdByName = (rawName: string, gradeHint?: string): string => {
        const clean = normalizePersianText(rawName);
        if (!clean) {
          return schoolClasses[0]?.id ?? `${payload.schoolId}-c-1`;
        }
        const existing = classByName.get(clean);
        if (existing) return existing.id;

        const newClass: ClassRoom & {
          complexId?: string;
          academicYearId?: string;
          createdAtIso?: string;
          updatedAtIso?: string;
        } = {
          id: generateUUID(),
          complexId: payload.complexId,
          schoolId: payload.schoolId,
          academicYearId: payload.academicYearId,
          name: clean,
          gradeLevel: inferGradeNumber(gradeHint || clean),
          customGradeLabel: gradeHint?.trim() || undefined,
          section: clean.includes('ب') ? 'ب' : clean.includes('ج') ? 'ج' : 'الف',
          homeroomTeacherId: schoolTeachers[0]?.id ?? '',
          capacity: 28,
          roomCode: String(110 + schoolClasses.length + classesToPersist.length + 1),
          recordVersion: 1,
          deletedAtIso: null,
          createdAtIso: nowIso,
          updatedAtIso: nowIso,
        };
        classByName.set(clean, newClass);
        classesToPersist.push(newClass);
        newClassesCreatedCount++;
        return newClass.id;
      };

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let newAccountsCreatedCount = 0;

      try {
        if (payload.targetType === 'students') {
          const studentsToPersist: Student[] = [];
          for (const row of payload.validRows) {
            if (row.operation === 'skip') {
              skippedCount++;
              continue;
            }
            const v = row.normalizedValues;
            const classId = ensureClassIdByName(v.className ?? '', v.gradeLabel);
            const existing = row.existingRecordId
              ? studentById.get(row.existingRecordId)
              : undefined;

            if (existing) {
              const fillOnly = payload.duplicateStrategy === 'fill_empty_only';
              const mergeVal = (incoming: string | undefined, current: string | undefined): string => {
                const inc = (incoming ?? '').trim();
                const cur = (current ?? '').trim();
                if (fillOnly) return cur || inc;
                return inc || cur;
              };
              const updatedStudent: Student & {
                complexId?: string;
                academicYearId?: string;
                updatedAtIso?: string;
              } = ensureStudentDualCredentials({
                ...existing,
                complexId: payload.complexId,
                academicYearId: payload.academicYearId,
                classId: fillOnly ? existing.classId || classId : classId || existing.classId,
                fullName: mergeVal(v.fullName, existing.fullName),
                firstName: mergeVal(v.firstName, existing.firstName) || undefined,
                lastName: mergeVal(v.lastName, existing.lastName) || undefined,
                fatherName: mergeVal(v.fatherName, existing.fatherName) || undefined,
                parentName: mergeVal(v.parentName, existing.parentName),
                parentMobile: mergeVal(v.parentMobile, existing.parentMobile),
                birthDateJalali: mergeVal(v.birthDateJalali, existing.birthDateJalali) || undefined,
                sidaStudentCode: mergeVal(v.sidaStudentCode, existing.sidaStudentCode) || undefined,
                enrollmentStatus: (mergeVal(v.enrollmentStatus, existing.enrollmentStatus) ||
                  'عادی') as SidaEnrollmentStatus,
                emergencyNotes: mergeVal(v.emergencyNotes, existing.emergencyNotes) || undefined,
                recordVersion: (existing.recordVersion ?? 1) + 1,
                deletedAtIso: null,
                updatedAtIso: nowIso,
              });
              studentsToPersist.push(updatedStudent);
              updatedCount++;
            } else {
              const createdStudent: Student & {
                complexId?: string;
                academicYearId?: string;
                createdAtIso?: string;
                updatedAtIso?: string;
              } = ensureStudentDualCredentials({
                id: generateUUID(),
                complexId: payload.complexId,
                schoolId: payload.schoolId,
                academicYearId: payload.academicYearId,
                classId,
                fullName: v.fullName ?? 'دانش‌آموز جدید',
                firstName: v.firstName || undefined,
                lastName: v.lastName || undefined,
                fatherName: v.fatherName || undefined,
                nationalId: v.nationalId ?? '',
                studentCode:
                  v.studentCode || String(50000 + Math.floor(Math.random() * 45000)),
                sidaStudentCode: v.sidaStudentCode || undefined,
                enrollmentStatus: (v.enrollmentStatus || 'عادی') as SidaEnrollmentStatus,
                parentName: v.parentName || `ولی ${v.fullName ?? ''}`,
                parentMobile: v.parentMobile ?? '',
                birthDateJalali: v.birthDateJalali || undefined,
                emergencyNotes: v.emergencyNotes || undefined,
                studentMustChangePassword: true,
                parentMustChangePassword: true,
                active: true,
                recordVersion: 1,
                deletedAtIso: null,
                createdAtIso: nowIso,
                updatedAtIso: nowIso,
              });
              studentsToPersist.push(createdStudent);
              createdCount++;
              newAccountsCreatedCount++;
            }
          }

          if (classesToPersist.length > 0) {
            await sharedRepository.putMany('classes', classesToPersist);
          }
          if (studentsToPersist.length > 0) {
            await sharedRepository.putMany('students', studentsToPersist);
          }
        } else if (payload.targetType === 'teachers') {
          const teachersToPersist: Teacher[] = [];
          for (const row of payload.validRows) {
            if (row.operation === 'skip') {
              skippedCount++;
              continue;
            }
            const v = row.normalizedValues;
            const existing = row.existingRecordId
              ? teacherById.get(row.existingRecordId)
              : undefined;

            if (existing) {
              const fillOnly = payload.duplicateStrategy === 'fill_empty_only';
              const mergeVal = (incoming: string | undefined, current: string | undefined): string => {
                const inc = (incoming ?? '').trim();
                const cur = (current ?? '').trim();
                if (fillOnly) return cur || inc;
                return inc || cur;
              };
              const updatedTeacher: Teacher & {
                complexId?: string;
                academicYearId?: string;
                updatedAtIso?: string;
              } = ensureTeacherHashed({
                ...existing,
                complexId: payload.complexId,
                academicYearId: payload.academicYearId,
                fullName: mergeVal(v.fullName, existing.fullName),
                mobile: mergeVal(v.mobile, existing.mobile),
                personnelCode: mergeVal(v.personnelCode, existing.personnelCode),
                specialty: mergeVal(v.specialty, existing.specialty),
                weeklyQuotaPeriods: v.weeklyQuotaPeriods
                  ? Number(v.weeklyQuotaPeriods)
                  : existing.weeklyQuotaPeriods,
                recordVersion: (existing.recordVersion ?? 1) + 1,
                deletedAtIso: null,
                updatedAtIso: nowIso,
              });
              teachersToPersist.push(updatedTeacher);
              updatedCount++;
            } else {
              const createdTeacher: Teacher & {
                complexId?: string;
                academicYearId?: string;
                createdAtIso?: string;
                updatedAtIso?: string;
              } = ensureTeacherHashed({
                id: generateUUID(),
                complexId: payload.complexId,
                schoolId: payload.schoolId,
                academicYearId: payload.academicYearId,
                fullName: v.fullName ?? 'همکار جدید',
                nationalId: v.nationalId ?? '',
                personnelCode:
                  v.personnelCode || String(480000 + Math.floor(Math.random() * 19000)),
                mobile: v.mobile ?? '',
                specialty: v.specialty || 'آموزگار عمومی',
                assignedClassIds: [],
                weeklyQuotaPeriods: Number(v.weeklyQuotaPeriods || '24') || 24,
                mustChangePassword: true,
                active: true,
                recordVersion: 1,
                deletedAtIso: null,
                createdAtIso: nowIso,
                updatedAtIso: nowIso,
              });
              teachersToPersist.push(createdTeacher);
              createdCount++;
              newAccountsCreatedCount++;
            }
          }
          if (teachersToPersist.length > 0) {
            await sharedRepository.putMany('teachers', teachersToPersist);
          }
        } else if (payload.targetType === 'classes') {
          for (const row of payload.validRows) {
            if (row.operation === 'skip') {
              skippedCount++;
              continue;
            }
            const v = row.normalizedValues;
            const cleanName = normalizePersianText(v.className ?? '');
            const existing = classByName.get(cleanName);
            if (existing) {
              const fillOnly = payload.duplicateStrategy === 'fill_empty_only';
              const updatedClass: ClassRoom & {
                complexId?: string;
                academicYearId?: string;
                updatedAtIso?: string;
              } = {
                ...existing,
                complexId: payload.complexId,
                academicYearId: payload.academicYearId,
                gradeLevel: v.gradeLabel ? inferGradeNumber(v.gradeLabel) : existing.gradeLevel,
                customGradeLabel: v.gradeLabel || existing.customGradeLabel,
                section: fillOnly ? existing.section || v.section || 'الف' : v.section || existing.section,
                roomCode: fillOnly ? existing.roomCode || v.roomCode || '101' : v.roomCode || existing.roomCode,
                capacity: v.capacity ? Number(v.capacity) : existing.capacity,
                recordVersion: (existing.recordVersion ?? 1) + 1,
                deletedAtIso: null,
                updatedAtIso: nowIso,
              };
              classesToPersist.push(updatedClass);
              updatedCount++;
            } else {
              const newCls: ClassRoom & {
                complexId?: string;
                academicYearId?: string;
                createdAtIso?: string;
                updatedAtIso?: string;
              } = {
                id: generateUUID(),
                complexId: payload.complexId,
                schoolId: payload.schoolId,
                academicYearId: payload.academicYearId,
                name: cleanName,
                gradeLevel: inferGradeNumber(v.gradeLabel || cleanName),
                customGradeLabel: v.gradeLabel || undefined,
                section: v.section || 'الف',
                homeroomTeacherId: schoolTeachers[0]?.id ?? '',
                capacity: Number(v.capacity || '28') || 28,
                roomCode: v.roomCode || String(100 + schoolClasses.length + classesToPersist.length + 1),
                recordVersion: 1,
                deletedAtIso: null,
                createdAtIso: nowIso,
                updatedAtIso: nowIso,
              };
              classByName.set(cleanName, newCls);
              classesToPersist.push(newCls);
              createdCount++;
              newClassesCreatedCount++;
            }
          }
          if (classesToPersist.length > 0) {
            await sharedRepository.putMany('classes', classesToPersist);
          }
        } else if (payload.targetType === 'sida_grades') {
          const gradebookToPersist: GradebookEntry[] = [];
          const sidaAnalyticsToPersist: SidaAnalyticsGradeRecord[] = [];
          const existingGradeKeyMap = new Map<string, GradebookEntry>(
            schoolGrades.map((g) => [`${g.studentId}:${g.subject}:${g.jalaliMonth}`, g])
          );

          for (const row of payload.validRows) {
            if (row.operation === 'skip') {
              skippedCount++;
              continue;
            }
            const v = row.normalizedValues;
            const matchedStudent = v.nationalId ? studentByNatId.get(v.nationalId) : undefined;
            const studentId = matchedStudent?.id ?? `sida-ext-${v.nationalId || generateUUID()}`;
            const studentName = matchedStudent?.fullName ?? v.fullName ?? 'دانش‌آموز سیدا';
            const classId = matchedStudent?.classId ?? ensureClassIdByName(v.className ?? '', v.gradeLabel);
            const className =
              schoolClasses.find((c) => c.id === classId)?.name ??
              classesToPersist.find((c) => c.id === classId)?.name ??
              (v.className || 'کلاس عمومی');
            const subject = v.subject || 'ریاضی';
            const jalaliMonth = (v.jalaliMonth || payload.defaultMonth || 'دی') as JalaliAcademicMonth;
            const term = (v.term || payload.defaultTerm || 'نوبت اول') as AppealTermType;
            const finalNum = Number(v.finalScore ?? '0');
            const contNum = v.continuousScore ? Number(v.continuousScore) : finalNum;

            const gKey = `${studentId}:${subject}:${jalaliMonth}`;
            const existingEntry = existingGradeKeyMap.get(gKey);
            const entryId = existingEntry?.id ?? generateUUID();

            const gbEntry: GradebookEntry & {
              complexId?: string;
              academicYearId?: string;
              createdAtIso?: string;
              updatedAtIso?: string;
            } = {
              ...(existingEntry ?? {}),
              id: entryId,
              complexId: payload.complexId,
              schoolId: payload.schoolId,
              academicYearId: payload.academicYearId,
              studentId,
              classId,
              subject,
              jalaliMonth,
              jalaliDate: todayJalali,
              numericScore: finalNum,
              classActivityScore: contNum,
              descriptiveLevel: scoreToDescriptiveLevel(finalNum),
              recordedBy: session.role,
              updatedAt: nowIso,
              createdAtIso: existingEntry ? undefined : nowIso,
              updatedAtIso: nowIso,
              recordVersion: (existingEntry?.recordVersion ?? 0) + 1,
              deletedAtIso: null,
            };
            gradebookToPersist.push(gbEntry);

            const analyticsEntry: SidaAnalyticsGradeRecord = {
              id: generateUUID(),
              complexId: payload.complexId,
              schoolId: payload.schoolId,
              academicYearId: payload.academicYearId,
              createdByUserId: session.userId,
              createdAtIso: nowIso,
              updatedAtIso: nowIso,
              studentId,
              studentName,
              classId,
              className,
              gradeNumber: inferGradeNumber(v.gradeLabel || className),
              subject,
              subjectCoefficient: 2,
              score: finalNum,
              previousScore: contNum,
              schoolInternalScore: contNum,
              finalExamScore: finalNum,
              disciplineScore: 20,
              term,
              recordVersion: 1,
              deletedAtIso: null,
            };
            sidaAnalyticsToPersist.push(analyticsEntry);

            if (existingEntry) {
              updatedCount++;
            } else {
              createdCount++;
            }
          }

          if (classesToPersist.length > 0) {
            await sharedRepository.putMany('classes', classesToPersist);
          }
          if (gradebookToPersist.length > 0) {
            await sharedRepository.putMany('gradebook_entries', gradebookToPersist);
          }
          if (sidaAnalyticsToPersist.length > 0) {
            await sharedRepository.putMany('sida_analytics_grades', sidaAnalyticsToPersist);
          }
        }

        // Refresh in-memory view dataset from repository
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));

        // Append tamper-evident SHA-256 summary event to security_audit_logs
        const targetLabelFa = SMART_IMPORT_TARGET_LABELS_FA[payload.targetType];
        const summaryText = `ورود هوشمند «${targetLabelFa}» از فایل «${payload.sourceFileName}» در «${targetSchool.name}» (${payload.academicYearId}): ${createdCount} جدید، ${updatedCount} به‌روزرسانی، ${payload.joinedCount} پیوندخورده، ${payload.quarantinedRows.length} قرنطینه`;
        logSecurityEvent({
          eventType: 'smart_import_executed',
          schoolId: payload.schoolId,
          complexId: payload.complexId,
          username: session.username,
          displayName: session.displayName,
          role: session.role,
          detailsFa: summaryText,
        });

        const latestHash =
          sharedRepository.getSyncSnapshot().security_audit_logs[0]?.entryHash;

        const receipt: SmartImportCommitReceipt = {
          batchId,
          executedAtIso: nowIso,
          executedAtJalali: todayJalali,
          executedAtTimeHm: timeHm,
          complexId: payload.complexId,
          schoolId: payload.schoolId,
          schoolName: targetSchool.name,
          academicYearId: payload.academicYearId,
          targetType: payload.targetType,
          targetLabelFa,
          actorName: session.displayName,
          actorRoleFa: ROLE_DEFINITIONS[session.role].labelFa,
          sourceFileName: payload.sourceFileName,
          secondaryFileName: payload.secondaryFileName,
          createdCount,
          updatedCount,
          skippedCount,
          newClassesCreatedCount,
          joinedCount: payload.joinedCount,
          quarantinedCount: payload.quarantinedRows.length,
          newAccountsCreatedCount,
          auditLogEntryHash: latestHash,
          quarantinedRows: payload.quarantinedRows.map((q) => ({
            sourceRowNumber: q.sourceRowNumber,
            identifier:
              q.rawValues.nationalId ||
              q.normalizedValues.nationalId ||
              q.rawValues.className ||
              '—',
            displayName:
              q.rawValues.fullName ||
              q.normalizedValues.fullName ||
              q.rawValues.className ||
              'بدون نام',
            errors: q.errors,
          })),
        };

        return { ok: true, receipt };
      } catch (err) {
        return {
          ok: false,
          errorFa:
            err instanceof Error
              ? err.message
              : 'خطای غیرمنتظره در ثبت نهایی داده‌های ورود هوشمند.',
        };
      }
    },
    [session, dataset.schools, logSecurityEvent]
  );

  // ============================================================================
  // PHASE 9-C: DISCIPLINE, LEAVE/EXIT PASS, CONFIDENTIAL COUNSELING & VIRTUAL CLASSES
  // ============================================================================

  const disciplineRecords = useMemo(
    () =>
      (dataset.discipline_records ?? [])
        .filter((r) => r.schoolId === resolvedSchoolId)
        .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate)),
    [dataset.discipline_records, resolvedSchoolId]
  );

  const disciplinePledges = useMemo(
    () =>
      (dataset.discipline_pledges ?? [])
        .filter((p) => p.schoolId === resolvedSchoolId)
        .sort((a, b) => b.issuedAtJalali.localeCompare(a.issuedAtJalali)),
    [dataset.discipline_pledges, resolvedSchoolId]
  );

  const studentExitPasses = useMemo(
    () =>
      (dataset.student_exit_passes ?? [])
        .filter((p) => p.schoolId === resolvedSchoolId)
        .sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? '')),
    [dataset.student_exit_passes, resolvedSchoolId]
  );

  const staffLeaveRequests = useMemo(
    () =>
      (dataset.staff_leave_requests ?? [])
        .filter((r) => r.schoolId === resolvedSchoolId)
        .sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? '')),
    [dataset.staff_leave_requests, resolvedSchoolId]
  );

  const counselingSessions = useMemo(
    () =>
      (dataset.counseling_sessions ?? [])
        .filter((cs) => cs.schoolId === resolvedSchoolId)
        .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate)),
    [dataset.counseling_sessions, resolvedSchoolId]
  );

  // DEFENSE-IN-DEPTH LAYER-1 ISOLATION: Strip all clinical notes unless counselor, super_admin, or super_admin-audited principal
  const counselingClinicalNotes = useMemo(() => {
    const access = canViewClinicalLayer1(
      activeRole,
      resolvedSchoolId,
      globalSystemConfig.counselingPrincipalAuditSchoolIds
    );
    if (!access.allowed) return [];
    return (dataset.counseling_clinical_notes ?? []).filter(
      (n) => n.schoolId === resolvedSchoolId
    );
  }, [
    activeRole,
    dataset.counseling_clinical_notes,
    globalSystemConfig.counselingPrincipalAuditSchoolIds,
    resolvedSchoolId,
  ]);

  const virtualClassSessions = useMemo(
    () =>
      (dataset.virtual_class_sessions ?? [])
        .filter((s) => s.schoolId === resolvedSchoolId)
        .sort((a, b) => {
          const dCmp = b.jalaliDate.localeCompare(a.jalaliDate);
          if (dCmp !== 0) return dCmp;
          return b.startTimeHm.localeCompare(a.startTimeHm);
        }),
    [dataset.virtual_class_sessions, resolvedSchoolId]
  );

  const virtualClassAttendance = useMemo(
    () =>
      (dataset.virtual_class_attendance ?? []).filter(
        (a) => a.schoolId === resolvedSchoolId
      ),
    [dataset.virtual_class_attendance, resolvedSchoolId]
  );

  const upsertDisciplineRecord = useCallback(
    async (raw: DisciplineRecord): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const nowIso = new Date().toISOString();
      const record: DisciplineRecord = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        title: sanitizeText(raw.title, 180),
        category: sanitizeText(raw.category, 100),
        description: sanitizeText(raw.description, 1000),
        pointsDelta: Math.max(0.25, Math.min(20, Number(raw.pointsDelta) || 0.5)),
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('discipline_records', record);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ذخیره مورد انضباطی.' };
      }
    },
    [session, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const softDeleteDisciplineRecord = useCallback(
    async (id: string): Promise<MutationResult> => {
      try {
        await sharedRepository.deleteItem('discipline_records', resolvedSchoolId, id);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در انتقال به سطل بازیابی.' };
      }
    },
    [resolvedSchoolId, refreshSoftDeletedItems]
  );

  const upsertDisciplinePledge = useCallback(
    async (raw: DisciplinePledge): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const nowIso = new Date().toISOString();
      const pledge: DisciplinePledge = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        title: sanitizeText(raw.title, 180),
        bodyText: sanitizeText(raw.bodyText, 3000),
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('discipline_pledges', pledge);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در صدور تعهدنامه.' };
      }
    },
    [session, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const softDeleteDisciplinePledge = useCallback(
    async (id: string): Promise<MutationResult> => {
      try {
        await sharedRepository.deleteItem('discipline_pledges', resolvedSchoolId, id);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در انتقال تعهدنامه به سطل بازیابی.' };
      }
    },
    [resolvedSchoolId, refreshSoftDeletedItems]
  );

  const signDisciplinePledge = useCallback(
    async (
      pledgeId: string,
      mode: 'signed_digital' | 'signed_in_person',
      note?: string
    ): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const existing = disciplinePledges.find((p) => p.id === pledgeId);
      if (!existing) return { ok: false, errorFa: 'تعهدنامه مورد نظر یافت نشد.' };
      const nowIso = new Date().toISOString();
      const todayJalali = getTodayJalali();
      const updated: DisciplinePledge = {
        ...existing,
        status: mode,
        parentSignedAtJalali: todayJalali,
        parentSignedAtIso: nowIso,
        parentSignedByName: session.displayName,
        parentSignatureNote: note ? sanitizeText(note, 500) : existing.parentSignatureNote,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('discipline_pledges', updated);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        logSecurityEvent({
          eventType: 'discipline_pledge_signed',
          schoolId: resolvedSchoolId,
          complexId: activeSchool.complexId,
          username: session.username,
          displayName: session.displayName,
          role: session.role,
          detailsFa: `ثبت ${mode === 'signed_digital' ? 'تایید دیجیتال ولی' : 'امضای حضوری'} برای تعهدنامه «${existing.title}»`,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ثبت امضای تعهدنامه.' };
      }
    },
    [session, disciplinePledges, resolvedSchoolId, activeSchool.complexId, logSecurityEvent]
  );

  const upsertStudentExitPass = useCallback(
    async (raw: StudentExitPass): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const nowIso = new Date().toISOString();
      const pass: StudentExitPass = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        pickupPersonName: sanitizeText(raw.pickupPersonName, 120),
        reasonDetail: raw.reasonDetail ? sanitizeText(raw.reasonDetail, 500) : undefined,
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('student_exit_passes', pass);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ثبت برگه خروج.' };
      }
    },
    [session, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const softDeleteStudentExitPass = useCallback(
    async (id: string): Promise<MutationResult> => {
      try {
        await sharedRepository.deleteItem('student_exit_passes', resolvedSchoolId, id);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در انتقال به سطل بازیابی.' };
      }
    },
    [resolvedSchoolId, refreshSoftDeletedItems]
  );

  const updateStudentExitStatus = useCallback(
    async (
      passId: string,
      nextStatus: StudentExitPass['status'],
      note?: string
    ): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const existing = studentExitPasses.find((p) => p.id === passId);
      if (!existing) return { ok: false, errorFa: 'برگه خروج مورد نظر یافت نشد.' };
      const now = new Date();
      const nowIso = now.toISOString();
      const timeHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const updated: StudentExitPass = {
        ...existing,
        status: nextStatus,
        approvedByName:
          nextStatus === 'approved' || nextStatus === 'exited'
            ? existing.approvedByName ?? session.displayName
            : existing.approvedByName,
        actualExitTimeHm: nextStatus === 'exited' ? timeHm : existing.actualExitTimeHm,
        actualExitAtIso: nextStatus === 'exited' ? nowIso : existing.actualExitAtIso,
        actualReturnTimeHm: nextStatus === 'returned' ? timeHm : existing.actualReturnTimeHm,
        actualReturnAtIso: nextStatus === 'returned' ? nowIso : existing.actualReturnAtIso,
        securityGuardNote: note ? sanitizeText(note, 300) : existing.securityGuardNote,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('student_exit_passes', updated);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        if (nextStatus === 'exited' || nextStatus === 'returned') {
          const stName =
            dataset.students.find((s) => s.id === existing.studentId)?.fullName ?? existing.studentId;
          logSecurityEvent({
            eventType: 'student_exit_logged',
            schoolId: resolvedSchoolId,
            complexId: activeSchool.complexId,
            username: session.username,
            displayName: session.displayName,
            role: session.role,
            detailsFa:
              nextStatus === 'exited'
                ? `ثبت خروج نهایی دانش‌آموز «${stName}» (کد ${existing.trackingCode}) در ساعت ${timeHm} تحویل به ${existing.pickupPersonName}`
                : `ثبت بازگشت دانش‌آموز «${stName}» (کد ${existing.trackingCode}) به مدرسه در ساعت ${timeHm}`,
          });
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در به‌روزرسانی وضعیت خروج.' };
      }
    },
    [session, studentExitPasses, dataset.students, resolvedSchoolId, activeSchool.complexId, logSecurityEvent]
  );

  const upsertStaffLeaveRequest = useCallback(
    async (raw: StaffLeaveRequest): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const nowIso = new Date().toISOString();
      const req: StaffLeaveRequest = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        reason: sanitizeText(raw.reason, 600),
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('staff_leave_requests', req);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ثبت درخواست مرخصی.' };
      }
    },
    [session, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const softDeleteStaffLeaveRequest = useCallback(
    async (id: string): Promise<MutationResult> => {
      try {
        await sharedRepository.deleteItem('staff_leave_requests', resolvedSchoolId, id);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در انتقال به سطل بازیابی.' };
      }
    },
    [resolvedSchoolId, refreshSoftDeletedItems]
  );

  const reviewStaffLeaveRequest = useCallback(
    async (
      reqId: string,
      decision: 'approved' | 'rejected',
      note?: string
    ): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const existing = staffLeaveRequests.find((r) => r.id === reqId);
      if (!existing) return { ok: false, errorFa: 'درخواست مرخصی یافت نشد.' };
      const nowIso = new Date().toISOString();
      const updated: StaffLeaveRequest = {
        ...existing,
        status: decision,
        reviewedByName: session.displayName,
        reviewedAtJalali: getTodayJalali(),
        principalReviewNote: note ? sanitizeText(note, 500) : existing.principalReviewNote,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('staff_leave_requests', updated);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در بررسی درخواست مرخصی.' };
      }
    },
    [session, staffLeaveRequests]
  );

  const upsertCounselingSession = useCallback(
    async (raw: CounselingSession): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const nowIso = new Date().toISOString();
      const rec: CounselingSession = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        referralReason: raw.referralReason ? sanitizeText(raw.referralReason, 600) : undefined,
        sharedAdviceText: raw.sharedAdviceText ? sanitizeText(raw.sharedAdviceText, 2000) : undefined,
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('counseling_sessions', rec);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ذخیره نوبت مشاوره.' };
      }
    },
    [session, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const softDeleteCounselingSession = useCallback(
    async (id: string): Promise<MutationResult> => {
      try {
        await sharedRepository.deleteItem('counseling_sessions', resolvedSchoolId, id);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در انتقال نوبت به سطل بازیابی.' };
      }
    },
    [resolvedSchoolId, refreshSoftDeletedItems]
  );

  const upsertCounselingClinicalNote = useCallback(
    async (raw: CounselingClinicalNote): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      if (activeRole !== 'counselor' && activeRole !== 'super_admin') {
        return {
          ok: false,
          errorFa: 'ثبت یا ویرایش یادداشت‌های بالینی محرمانه صرفاً در انحصار مشاور مدرسه است.',
        };
      }
      const nowIso = new Date().toISOString();
      const note: CounselingClinicalNote = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        clinicalSummary: sanitizeText(raw.clinicalSummary, 3500),
        privateActionPlan: raw.privateActionPlan ? sanitizeText(raw.privateActionPlan, 1500) : undefined,
        lastUpdatedAtJalali: getTodayJalali(),
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('counseling_clinical_notes', note);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        const stName =
          dataset.students.find((s) => s.id === note.studentId)?.fullName ?? note.studentId;
        logSecurityEvent({
          eventType: 'counseling_clinical_edited',
          schoolId: resolvedSchoolId,
          complexId: activeSchool.complexId,
          username: session.username,
          displayName: session.displayName,
          role: session.role,
          detailsFa: `ثبت/ویرایش یادداشت بالینی لایه محرمانه برای دانش‌آموز «${stName}» (جلسه ${note.sessionId.slice(-6)})`,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ذخیره یادداشت بالینی.' };
      }
    },
    [session, activeRole, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId, dataset.students, logSecurityEvent]
  );

  const logCounselingClinicalViewed = useCallback(
    (params: { sessionId: string; studentName: string; auditReasonFa?: string }) => {
      if (!session) return;
      logSecurityEvent({
        eventType: 'counseling_clinical_viewed',
        schoolId: resolvedSchoolId,
        complexId: activeSchool.complexId,
        username: session.username,
        displayName: session.displayName,
        role: session.role,
        detailsFa: params.auditReasonFa
          ? `مشاهده ممیزی‌شده یادداشت محرمانه بالینی «${params.studentName}» — علت اعلام‌شده: ${sanitizeText(params.auditReasonFa, 240)}`
          : `مشاهده یادداشت بالینی لایه محرمانه «${params.studentName}» (جلسه ${params.sessionId.slice(-6)})`,
      });
    },
    [session, resolvedSchoolId, activeSchool.complexId, logSecurityEvent]
  );

  const togglePrincipalCounselingAuditAccess = useCallback(
    async (targetSchoolId: string, enabled: boolean): Promise<MutationResult> => {
      if (!session || session.role !== 'super_admin') {
        return {
          ok: false,
          errorFa: 'اعطا یا لغو دسترسی ویژه ممیزی مشاوره برای مدیر مدرسه صرفاً در اختیار راهبر ارشد سامانه است.',
        };
      }
      const existingList = new Set(globalSystemConfig.counselingPrincipalAuditSchoolIds ?? []);
      if (enabled) existingList.add(targetSchoolId);
      else existingList.delete(targetSchoolId);

      const updatedConfig: GlobalSystemConfig = {
        ...globalSystemConfig,
        counselingPrincipalAuditSchoolIds: Array.from(existingList),
        updatedAt: new Date().toISOString(),
        updatedByName: session.displayName,
      };
      try {
        await sharedRepository.putItem('global_system_configs', updatedConfig);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        const targetSchoolName =
          dataset.schools.find((s) => s.id === targetSchoolId)?.name ?? targetSchoolId;
        logSecurityEvent({
          eventType: 'counseling_audit_access_toggled',
          schoolId: targetSchoolId,
          complexId: activeSchool.complexId,
          username: session.username,
          displayName: session.displayName,
          role: session.role,
          detailsFa: `${enabled ? 'فعال‌سازی' : 'لغو'} دسترسی ویژه ممیزی (فقط‌خواندنی) لایه محرمانه مشاوره برای مدیر «${targetSchoolName}»`,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در به‌روزرسانی دسترسی امنیتی.' };
      }
    },
    [session, globalSystemConfig, dataset.schools, activeSchool.complexId, logSecurityEvent]
  );

  const upsertVirtualClassSession = useCallback(
    async (raw: VirtualClassSession): Promise<MutationResult> => {
      if (!session) return { ok: false, errorFa: 'نشست کاربری معتبر نیست.' };
      const nowIso = new Date().toISOString();
      const sess: VirtualClassSession = {
        ...raw,
        id: raw.id || generateUUID(),
        complexId: raw.complexId || activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: raw.academicYearId || activeSchool.academicYear || '1405-1406',
        title: sanitizeText(raw.title, 180),
        subject: sanitizeText(raw.subject, 100),
        description: raw.description ? sanitizeText(raw.description, 800) : undefined,
        recordingTitle: raw.recordingTitle ? sanitizeText(raw.recordingTitle, 180) : undefined,
        handoutTitle: raw.handoutTitle ? sanitizeText(raw.handoutTitle, 180) : undefined,
        createdAtIso: raw.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('virtual_class_sessions', sess);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ذخیره جلسه کلاس مجازی.' };
      }
    },
    [session, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const softDeleteVirtualClassSession = useCallback(
    async (id: string): Promise<MutationResult> => {
      try {
        await sharedRepository.deleteItem('virtual_class_sessions', resolvedSchoolId, id);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        await refreshSoftDeletedItems();
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در انتقال جلسه به سطل بازیابی.' };
      }
    },
    [resolvedSchoolId, refreshSoftDeletedItems]
  );

  const recordVirtualClassJoinAttendance = useCallback(
    async (sessionId: string): Promise<MutationResult> => {
      if (!session || !linkedStudent) {
        return { ok: false, errorFa: 'ثبت حضور خودکار صرفاً برای حساب دانش‌آموز متصل انجام می‌شود.' };
      }
      const targetSession = virtualClassSessions.find((s) => s.id === sessionId);
      if (!targetSession) return { ok: false, errorFa: 'جلسه کلاس مجازی یافت نشد.' };

      const now = new Date();
      const nowIso = now.toISOString();
      const timeHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const record: VirtualClassAttendance = {
        id: `vcatt-${sessionId}-${linkedStudent.id}`,
        complexId: activeSchool.complexId || 'complex-1',
        schoolId: resolvedSchoolId,
        academicYearId: activeSchool.academicYear || '1405-1406',
        sessionId,
        classId: targetSession.classId,
        studentId: linkedStudent.id,
        studentName: linkedStudent.fullName,
        joinedAtIso: nowIso,
        joinedAtJalali: getTodayJalali(),
        joinedAtTimeHm: timeHm,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      try {
        await sharedRepository.putItem('virtual_class_attendance', record);
        setDataset(buildActiveViewDataset(sharedRepository.getSyncSnapshot()));
        return { ok: true };
      } catch (err) {
        return { ok: false, errorFa: err instanceof Error ? err.message : 'خطا در ثبت حضور کلاس مجازی.' };
      }
    },
    [session, linkedStudent, virtualClassSessions, activeSchool.complexId, activeSchool.academicYear, resolvedSchoolId]
  );

  const value: DataContextValue = {
    backendMode,
    isOnline,
    darkMode,
    toggleDarkMode,
    setDarkModeDirect,
    changeOwnLocalPassword,
    changeOwnPassword,
    session,
    realSession,
    impersonation,
    startImpersonation,
    stopImpersonation,
    login,
    logout,
    linkedStudent,
    linkedTeacher,
    teacherAssignedClassIds,
    allSchools,
    schools,
    activeSchoolId: resolvedSchoolId,
    activeSchool,
    setActiveSchoolId,
    activeRole,
    roleDef,
    educationalComplexes,
    managedAdminAccounts,
    roleGovernanceConfigs,
    globalSystemConfig,
    superAdminAuditLogs,
    securityAuditLogs,
    logSecurityEvent,
    updateSystemLogo,
    defaultWorkdayJalali,
    classes,
    students,
    teachers,
    teacherNameById,
    schedules,
    studentAttendance,
    staffAttendance,
    substitutions,
    dailyLogs,
    pluginStates,
    collectionCounts,
    curriculumTopics,
    mediaResources,
    chatOutbox,
    gradebookEntries,
    lessonPlans,
    gradebookWeights,
    gradeAppeals,
    homeworkAssignments,
    homeworkSubmissions,
    studentRewards,
    questionBank,
    classChatDraftQueue,
    examQuestionBasket,
    flippedLessons,
    flippedTelemetry,
    flippedQuestions,
    onlineClassSessions,
    onlineClassAttendance,
    onlineExams,
    onlineExamSubmissions,
    student360Signals,
    parentStaffMessages,
    unreadParentChatCount,
    classChatRooms,
    classChatMessages,
    appointmentSlots,
    electronicForms,
    electronicFormResponses,
    notificationTemplates,
    sidaGradeAuditLogs,
    inPersonExamHalls,
    inPersonExamSessions,
    examSeatingCharts,
    studentProfiles,
    staffProfiles,
    sidaSpeedEntryTicks,
    userAppearancePref,
    schoolBrandingConfig,
    schoolBrandingConfigs,
    financeFeePlans,
    financeLedgers,
    financePayments,
    financeExpenses,
    remedialPlans,
    anonymousSurveys,
    surveyParticipationReceipts,
    surveyAnonymousResponses,
    complexPhase6Dataset,
    tdCourses,
    tdProgress,
    tdCertificates,
    tdSchoolSettings,
    tdLeaderboard,
    complexPhase7Dataset,
    allManifests: manifests,
    pluginStatuses,
    isPluginEnabled,
    getPluginStatusesForSchool,
    updatePluginState,
    updatePluginStateForSchool,
    upsertStudentAttendance,
    upsertStaffAttendance,
    upsertSubstitution,
    deleteSubstitution,
    addDailyLog,
    deleteDailyLog,
    updateActiveSchool,
    importStudentsBatch,
    upsertStudent,
    setStudentActiveStatus,
    deleteStudentPermanently,
    upsertClassRoom,
    upsertTeacherWithSchedule,
    upsertScheduleSlot,
    deleteScheduleSlot,
    upsertCurriculumTopic,
    toggleCurriculumClassCompletion,
    deleteCurriculumTopic,
    addMediaResource,
    deleteMediaResource,
    sendMediaToClassChat,
    upsertGradebookEntry,
    upsertLessonPlan,
    deleteLessonPlan,
    upsertGradebookWeights,
    upsertGradeAppeal,
    upsertHomeworkAssignment,
    deleteHomeworkAssignment,
    upsertHomeworkSubmission,
    addStudentReward,
    deleteStudentReward,
    upsertQuestionItem,
    deleteQuestionItem,
    addClassChatDraft,
    addToExamBasket,
    removeFromExamBasket,
    clearExamBasket,
    upsertFlippedLesson,
    deleteFlippedLesson,
    upsertFlippedTelemetry,
    addFlippedQuestion,
    replyFlippedQuestion,
    recordFlippedMicroQuizOutcome,
    upsertOnlineClassSession,
    deleteOnlineClassSession,
    upsertOnlineClassAttendance,
    upsertOnlineExam,
    deleteOnlineExam,
    upsertOnlineExamSubmission,
    syncExamGradesToGradebook,
    upsertStudent360Signal,
    sendParentStaffMessage,
    markParentChatThreadRead,
    setClassChatRoomMode,
    sendClassChatMessage,
    voteClassChatPoll,
    deleteClassChatDraft,
    createAppointmentSlots,
    deleteAppointmentSlot,
    bookAppointmentSlot,
    cancelAppointmentBooking,
    completeAppointmentSlot,
    upsertElectronicForm,
    deleteElectronicForm,
    submitElectronicFormResponse,
    upsertNotificationTemplate,
    deleteNotificationTemplate,
    importSidaStudentsBatch,
    resolveSidaGradeAppeal,
    upsertInPersonExamHall,
    deleteInPersonExamHall,
    upsertInPersonExamSession,
    deleteInPersonExamSession,
    upsertExamSeatingChart,
    deleteExamSeatingChart,
    upsertStudentProfile,
    upsertStaffProfile,
    upsertSingleSidaStudent,
    transferStudentsToClass,
    upsertSidaSpeedEntryRecord,
    saveUserAppearancePreference,
    saveSchoolBrandingConfig,
    saveSchoolPrintBranding,
    upsertFinanceFeePlan,
    upsertFinanceLedger,
    recordFinancePayment,
    deleteFinancePayment,
    upsertFinanceExpense,
    deleteFinanceExpense,
    addTripFeeToStudents,
    upsertRemedialPlan,
    deleteRemedialPlan,
    upsertAnonymousSurvey,
    deleteAnonymousSurvey,
    submitAnonymousSurveyVote,
    updateSurveyResponseReview,
    upsertTeacherDevCourse,
    archiveTeacherDevCourse,
    deleteTeacherDevCourse,
    completeTeacherDevChapter,
    submitTeacherDevQuizAttempt,
    saveTeacherDevPrivacySettings,
    saveRoleGovernanceConfig,
    resetAllRoleGovernanceConfigs,
    updateGlobalLabels,
    resetGlobalLabels,
    updateLoginBackgroundConfig,
    upsertManagedAdminAccount,
    deleteManagedAdminAccount,
    toggleManagedAdminAccountActive,
    createNewSchool,
    updateSchoolUnit,
    createNewComplex,
    updateComplex,
    academicYears,
    mockExams,
    mockExamAttempts,
    allMockExamsForSchool,
    allMockAttemptsForComplex,
    saveAcademicYearsList,
    upsertMockExam,
    deleteMockExam,
    upsertMockExamAttempt,
    upsertMockExamAttemptsBatch,
    deleteMockExamAttempt,
    sidaAppealWindows,
    sidaRemedialGroups,
    sidaClassBalancingDrafts,
    sidaAnalyticsGrades,
    upsertSidaAppealWindow,
    upsertSidaRemedialGroup,
    deleteSidaRemedialGroup,
    upsertSidaClassBalancingDraft,
    deleteSidaClassBalancingDraft,
    exportSingleSchoolBackup,
    exportComplexBackup,
    restoreBackup,
    resetAllData,
    complexComparison,
    searchCatalog,
    searchFocusTarget,
    setSearchFocusTarget,
    clearSearchFocusTarget,
    importTeachersBatch,
    smartContentArchive,
    schoolAnnouncements,
    studentTransferLogs,
    recoverySnapshots,
    notificationCenter,
    upsertSmartArchiveItem,
    deleteSmartArchiveItem,
    reuseArchiveItemInClass,
    upsertSchoolAnnouncement,
    deleteSchoolAnnouncement,
    markNotificationRead,
    markAllNotificationsRead,
    createRecoverySnapshot,
    executeSelectiveSafeReset,
    restoreRecoverySnapshot,
    // Step 3-B exports
    verifyCurrentUserPassword,
    panicModeState,
    isActiveSchoolPanicLocked,
    antiWipeAlertFa,
    clearAntiWipeAlert,
    activatePanicMode,
    deactivatePanicMode,
    vaultMeta,
    dailyRollingSnapshots,
    lastUndoSnapshot,
    softDeletedItems,
    refreshSoftDeletedItems,
    restoreSoftDeletedRecord,
    runVaultChunkedMigration,
    runDataIntegrityCheck,
    exportPhase10MigrationBundle,
    verifyMigrationBundleFile,
    executeGranularBundleRestore,
    undoLastBundleRestore,
    createDailyRollingSnapshotNow,
    restoreDailyRollingSnapshot,
    // Step 3-C exports
    importMappingTemplates,
    getSchoolRecordsForImport,
    saveImportMappingTemplate,
    deleteImportMappingTemplate,
    commitSmartImportBatch,
    // Phase 9-C exports
    disciplineRecords,
    disciplinePledges,
    studentExitPasses,
    staffLeaveRequests,
    counselingSessions,
    counselingClinicalNotes,
    virtualClassSessions,
    virtualClassAttendance,
    upsertDisciplineRecord,
    softDeleteDisciplineRecord,
    upsertDisciplinePledge,
    softDeleteDisciplinePledge,
    signDisciplinePledge,
    upsertStudentExitPass,
    softDeleteStudentExitPass,
    updateStudentExitStatus,
    upsertStaffLeaveRequest,
    softDeleteStaffLeaveRequest,
    reviewStaffLeaveRequest,
    upsertCounselingSession,
    softDeleteCounselingSession,
    upsertCounselingClinicalNote,
    logCounselingClinicalViewed,
    togglePrincipalCounselingAuditAccess,
    upsertVirtualClassSession,
    softDeleteVirtualClassSession,
    recordVirtualClassJoinAttendance,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export function useSchoolData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useSchoolData must be used inside DataProvider');
  }
  return ctx;
}
