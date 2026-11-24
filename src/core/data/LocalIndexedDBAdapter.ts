// Offline-First LocalIndexedDBAdapter with strict 3-second Promise.race timeout & automatic localStorage/memory fallback
import type {
  BackupPayload,
  CollectionName,
  CollectionTypeMap,
  DailyRollingSnapshot,
  MigrationVaultMeta,
  PanicModeState,
  School,
  SecurityAuditLogEntry,
  SoftDeletedRecordEntry,
  SoftDeleteVersionFields,
} from '../../types/domain';
import {
  authorizeBackupOperation,
  authorizeMutation,
  type AuthGuardContext,
} from '../auth/policy';
import {
  ensureManagedAdminAccountHashed,
  ensureStudentDualCredentials,
  ensureTeacherHashed,
} from '../auth/authService';
import {
  OFFICIAL_COMPLEX_NAME_FA,
  OFFICIAL_SCHOOL_NAMES,
  OFFICIAL_SYSTEM_NAME_FA,
} from '../branding/BrandLogo';
import { hashPasswordSync } from '../security/cryptoService';
import { assertTenantReadAccess } from '../security/securityGuard';
import {
  DEFAULT_PANIC_MODE_STATE,
  extractRecordDisplayTitle,
  getCollectionLabelFa,
  isRecordSoftDeleted,
  isSchoolUnderPanicLock,
  sealAuditEntrySync,
} from '../security/DataIntegrityGuard';
import {
  CURRENT_SCHEMA_VERSION,
  normalizeRecordDefaults,
} from '../storage/MigrationEngine';
import { PHASE2_PLUGIN_IDS, generatePhase2SeedData } from './phase2SeedData';
import { PHASE25_PLUGIN_IDS, generatePhase25SeedData } from './phase25SeedData';
import { PHASE3_PLUGIN_IDS, generatePhase3SeedData } from './phase3SeedData';
import { PHASE35_PLUGIN_IDS, generatePhase35SeedData } from './phase35SeedData';
import { PHASE4_PLUGIN_IDS, generatePhase4SeedData } from './phase4SeedData';
import { PHASE5_PLUGIN_IDS, generatePhase5SeedData } from './phase5SeedData';
import { PHASE6_PLUGIN_IDS, generatePhase6SeedData } from './phase6SeedData';
import { PHASE7_PLUGIN_IDS, generatePhase7SeedData } from './phase7SeedData';
import { PHASE9A_PLUGIN_IDS, generatePhase9ASeedData } from '../../plugins/mock-exams/phase9ASeedData';
import {
  PHASE9B_PLUGIN_IDS,
  generatePhase9BSeedData,
} from '../../plugins/sida-analytics/phase9BSeedData';
import {
  PHASE9C_PLUGIN_IDS,
  generatePhase9CSeedData,
} from '../../services/phase9c/phase9cSeedData';
import { normalizeAcademicYear } from '../academic-year/academicYearHelpers';
import type {
  IDataRepository,
  RepositoryChangeEvent,
  RepositoryChangeListener,
  StorageBackendMode,
} from './repository';
import {
  generateSeedDataset,
  generateStep3InitialAnnouncements,
  generateStep3InitialArchive,
  PHASE55_PLUGIN_IDS,
  type SeedDataset,
} from './seedData';
import { DEFAULT_COMPLEX_ID, generatePhase8ASeedData } from '../super-admin/superAdminHelpers';
import { dateToJalaliString, getNearestActiveWorkday, getTodayJalali } from '../../lib/jalali';

const DB_NAME = 'smart_school_complex_db';
const DB_VERSION = 18; // Additive bump: Phase 9-C (discipline, leave/exit, confidential counseling, virtual classes)
const VAULT_META_STORE = 'vault_metadata';
const IDB_TIMEOUT_MS = 3000;
const LS_STORAGE_KEY = 'smart_school_complex_ls_v1';
const LS_VAULT_META_KEY = 'golestan_data_vault_meta_v1';
const SYNC_CHANNEL_NAME = 'golestan_school_live_sync_v1';
const MAX_DAILY_ROLLING_SNAPSHOTS = 5;

export const ALL_COLLECTIONS: readonly CollectionName[] = [
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
  'academic_years',
  'mock_exams',
  'mock_exam_attempts',
  'sida_appeal_windows',
  'sida_remedial_groups',
  'sida_class_balancing_drafts',
  'sida_analytics_grades',
  'security_audit_logs',
  'smart_content_archive',
  'school_announcements',
  'student_transfer_logs',
  'notification_read_receipts',
  'recovery_snapshots',
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

const PHASE2_COLLECTIONS: readonly CollectionName[] = [
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
  'academic_years',
  'mock_exams',
  'mock_exam_attempts',
  'sida_appeal_windows',
  'sida_remedial_groups',
  'sida_class_balancing_drafts',
  'sida_analytics_grades',
  'security_audit_logs',
  'smart_content_archive',
  'school_announcements',
  'student_transfer_logs',
  'notification_read_receipts',
  'recovery_snapshots',
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

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IDB timeout (${IDB_TIMEOUT_MS}ms): ${label}`));
    }, IDB_TIMEOUT_MS);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function createEmptyStore(): SeedDataset {
  return {
    schools: [],
    classes: [],
    students: [],
    teachers: [],
    schedules: [],
    student_attendance: [],
    staff_attendance: [],
    substitutions: [],
    daily_logs: [],
    school_plugin_states: [],
    curriculum_topics: [],
    media_resources: [],
    chat_outbox: [],
    gradebook_entries: [],
    lesson_plans: [],
    gradebook_weights: [],
    grade_appeals: [],
    homework_assignments: [],
    homework_submissions: [],
    student_rewards: [],
    question_bank: [],
    class_chat_draft_queue: [],
    exam_question_basket: [],
    flipped_lessons: [],
    flipped_telemetry: [],
    flipped_questions: [],
    online_class_sessions: [],
    online_class_attendance: [],
    online_exams: [],
    online_exam_submissions: [],
    student_360_signals: [],
    parent_staff_messages: [],
    class_chat_rooms: [],
    class_chat_messages: [],
    appointment_slots: [],
    electronic_forms: [],
    electronic_form_responses: [],
    notification_templates: [],
    sida_grade_audit_logs: [],
    in_person_exam_halls: [],
    in_person_exam_sessions: [],
    exam_seating_charts: [],
    student_profiles: [],
    staff_profiles: [],
    sida_speed_entry_ticks: [],
    user_appearance_prefs: [],
    school_branding_configs: [],
    finance_fee_plans: [],
    finance_student_ledgers: [],
    finance_payments: [],
    finance_expenses: [],
    remedial_plans: [],
    anonymous_surveys: [],
    survey_participation_receipts: [],
    survey_anonymous_responses: [],
    td_courses: [],
    td_progress: [],
    td_certificates: [],
    td_school_settings: [],
    educational_complexes: [],
    managed_admin_accounts: [],
    role_governance_configs: [],
    global_system_configs: [],
    super_admin_audit_logs: [],
    academic_years: [],
    mock_exams: [],
    mock_exam_attempts: [],
    sida_appeal_windows: [],
    sida_remedial_groups: [],
    sida_class_balancing_drafts: [],
    sida_analytics_grades: [],
    security_audit_logs: [],
    smart_content_archive: [],
    school_announcements: [],
    student_transfer_logs: [],
    notification_read_receipts: [],
    recovery_snapshots: [],
    import_mapping_templates: [],
    discipline_records: [],
    discipline_pledges: [],
    student_exit_passes: [],
    staff_leave_requests: [],
    counseling_sessions: [],
    counseling_clinical_notes: [],
    virtual_class_sessions: [],
    virtual_class_attendance: [],
  };
}

/**
 * Additive migration helper: if a user already has Phase 1 data saved in localStorage or IndexedDB,
 * seed ONLY the newly introduced Phase 2 stores and missing Phase 2 plugin states without touching
 * ANY existing Phase 1 records or plugin toggles.
 */
function hydrateMissingPhase2Collections(data: SeedDataset): { dataset: SeedDataset; mutated: boolean } {
  let mutated = false;
  const needsPhase2Data =
    data.curriculum_topics.length === 0 &&
    data.gradebook_entries.length === 0 &&
    data.homework_assignments.length === 0 &&
    data.schools.length > 0;

  let next = data;
  if (needsPhase2Data) {
    const activeDay = getNearestActiveWorkday(
      getTodayJalali(),
      data.schools[0]?.activeWorkdays ?? [3, 4, 5, 6]
    );
    const p2 = generatePhase2SeedData({
      schools: data.schools,
      classes: data.classes,
      students: data.students,
      teachers: data.teachers,
      activeDayJalali: activeDay,
    });
    next = {
      ...data,
      curriculum_topics: p2.curriculum_topics,
      media_resources: data.media_resources.length > 0 ? data.media_resources : p2.media_resources,
      chat_outbox: data.chat_outbox.length > 0 ? data.chat_outbox : p2.chat_outbox,
      gradebook_entries: p2.gradebook_entries,
      lesson_plans: data.lesson_plans.length > 0 ? data.lesson_plans : p2.lesson_plans,
      gradebook_weights: data.gradebook_weights.length > 0 ? data.gradebook_weights : p2.gradebook_weights,
      grade_appeals: data.grade_appeals.length > 0 ? data.grade_appeals : p2.grade_appeals,
      homework_assignments: p2.homework_assignments,
      homework_submissions:
        data.homework_submissions.length > 0 ? data.homework_submissions : p2.homework_submissions,
      student_rewards: data.student_rewards.length > 0 ? data.student_rewards : p2.student_rewards,
    };
    mutated = true;
  }

  // Ensure every school has Phase 2, Phase 2.5, Phase 3 & Phase 3.5 plugin states registered (default enabled) without overriding existing entries
  const existingStateKeys = new Set(next.school_plugin_states.map((s) => s.id));
  const missingStates = [...next.school_plugin_states];
  const nowIso = new Date().toISOString();
  for (const school of next.schools) {
    for (const pluginId of [
      ...PHASE2_PLUGIN_IDS,
      ...PHASE25_PLUGIN_IDS,
      ...PHASE3_PLUGIN_IDS,
      ...PHASE35_PLUGIN_IDS,
      ...PHASE4_PLUGIN_IDS,
      ...PHASE5_PLUGIN_IDS,
      ...PHASE55_PLUGIN_IDS,
      ...PHASE6_PLUGIN_IDS,
      ...PHASE7_PLUGIN_IDS,
      ...PHASE9A_PLUGIN_IDS,
      ...PHASE9B_PLUGIN_IDS,
      ...PHASE9C_PLUGIN_IDS,
    ]) {
      const key = `${school.id}:${pluginId}`;
      if (!existingStateKeys.has(key)) {
        missingStates.push({
          id: key,
          schoolId: school.id,
          pluginId,
          installed: true,
          enabled: true,
          updatedAt: nowIso,
          updatedBy: 'سیستم (ارتقای افزونه‌های سامانه)',
        });
        existingStateKeys.add(key);
        mutated = true;
      }
    }
  }
  if (mutated) {
    next = { ...next, school_plugin_states: missingStates };
  }

  // Additive Phase 2.5 migration: seed 6 questions for school-1 ONLY when question_bank is empty
  if (next.question_bank.length === 0 && next.schools.length > 0) {
    const activeDay = getNearestActiveWorkday(
      getTodayJalali(),
      next.schools[0]?.activeWorkdays ?? [3, 4, 5, 6]
    );
    const p25 = generatePhase25SeedData({
      schools: next.schools,
      classes: next.classes,
      teachers: next.teachers,
      activeDayJalali: activeDay,
    });
    const existingHwIds = new Set(next.homework_assignments.map((h) => h.id));
    const missingGameHw = p25.extra_homework_assignments.filter((h) => !existingHwIds.has(h.id));
    next = {
      ...next,
      question_bank: p25.question_bank,
      homework_assignments: [...missingGameHw, ...next.homework_assignments],
    };
    mutated = true;
  }

  // Additive Phase 3 migration: seed 1 demo record per new plugin for school-1 ONLY when each respective store is empty
  const needsFlippedSeed = next.flipped_lessons.length === 0;
  const needsOnlineClassSeed = next.online_class_sessions.length === 0;
  const needsOnlineExamSeed = next.online_exams.length === 0;
  if ((needsFlippedSeed || needsOnlineClassSeed || needsOnlineExamSeed) && next.schools.length > 0) {
    const activeDay = getNearestActiveWorkday(
      getTodayJalali(),
      next.schools[0]?.activeWorkdays ?? [3, 4, 5, 6]
    );
    const p3 = generatePhase3SeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
      teachers: next.teachers,
      activeDayJalali: activeDay,
    });
    const existingSigIds = new Set(next.student_360_signals.map((s) => s.id));
    const newSignals = p3.student_360_signals.filter((s) => !existingSigIds.has(s.id));
    next = {
      ...next,
      flipped_lessons: needsFlippedSeed ? p3.flipped_lessons : next.flipped_lessons,
      flipped_telemetry:
        needsFlippedSeed && next.flipped_telemetry.length === 0
          ? p3.flipped_telemetry
          : next.flipped_telemetry,
      flipped_questions:
        needsFlippedSeed && next.flipped_questions.length === 0
          ? p3.flipped_questions
          : next.flipped_questions,
      online_class_sessions: needsOnlineClassSeed
        ? p3.online_class_sessions
        : next.online_class_sessions,
      online_class_attendance:
        needsOnlineClassSeed && next.online_class_attendance.length === 0
          ? p3.online_class_attendance
          : next.online_class_attendance,
      online_exams: needsOnlineExamSeed ? p3.online_exams : next.online_exams,
      online_exam_submissions:
        needsOnlineExamSeed && next.online_exam_submissions.length === 0
          ? p3.online_exam_submissions
          : next.online_exam_submissions,
      student_360_signals:
        next.student_360_signals.length === 0
          ? p3.student_360_signals
          : [...next.student_360_signals, ...newSignals],
    };
    mutated = true;
  }

  // Additive Phase 3.5 migration (1): Non-destructively ensure every existing student has BOTH student & parent credentials
  let studentsMigrated = false;
  const migratedStudents = next.students.map((st) => {
    const upgraded = ensureStudentDualCredentials(st);
    if (upgraded !== st) studentsMigrated = true;
    return upgraded;
  });
  if (studentsMigrated) {
    next = { ...next, students: migratedStudents };
    mutated = true;
  }

  // Additive Phase 3.5 migration (2): Seed 2 realistic parent-staff chat conversations for school-1 ONLY when empty
  if (next.parent_staff_messages.length === 0 && next.schools.length > 0) {
    const p35 = generatePhase35SeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
      teachers: next.teachers,
    });
    if (p35.parent_staff_messages.length > 0) {
      next = {
        ...next,
        parent_staff_messages: p35.parent_staff_messages,
      };
      mutated = true;
    }
  }

  // Additive Phase 4 migration: Seed demo items for school-1 ONLY when each respective new plugin store is empty
  const needsClassChatSeed = next.class_chat_messages.length === 0;
  const needsApptSeed = next.appointment_slots.length === 0;
  const needsFormsSeed = next.electronic_forms.length === 0;
  const needsTemplatesSeed = next.notification_templates.length === 0;
  if (
    (needsClassChatSeed || needsApptSeed || needsFormsSeed || needsTemplatesSeed) &&
    next.schools.length > 0
  ) {
    const p4 = generatePhase4SeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
      teachers: next.teachers,
    });
    next = {
      ...next,
      class_chat_rooms:
        needsClassChatSeed && next.class_chat_rooms.length === 0
          ? p4.class_chat_rooms
          : next.class_chat_rooms,
      class_chat_messages: needsClassChatSeed ? p4.class_chat_messages : next.class_chat_messages,
      appointment_slots: needsApptSeed ? p4.appointment_slots : next.appointment_slots,
      electronic_forms: needsFormsSeed ? p4.electronic_forms : next.electronic_forms,
      electronic_form_responses:
        needsFormsSeed && next.electronic_form_responses.length === 0
          ? p4.electronic_form_responses
          : next.electronic_form_responses,
      notification_templates: needsTemplatesSeed
        ? p4.notification_templates
        : next.notification_templates,
    };
    mutated = true;
  }

  // Additive Phase 5 migration: Seed demo items for school-1 ONLY when each respective new plugin store is empty
  const needsHallsSeed = next.in_person_exam_halls.length === 0;
  const needsExamSessionsSeed = next.in_person_exam_sessions.length === 0;
  const needsSeatingSeed = next.exam_seating_charts.length === 0;
  const needsStudentProfilesSeed = next.student_profiles.length === 0;
  const needsStaffProfilesSeed = next.staff_profiles.length === 0;
  const hasSchool1PendingAppeal = next.grade_appeals.some(
    (a) => a.schoolId === 'school-1' && (a.status === 'submitted' || a.status === 'in_review')
  );
  if (
    (needsHallsSeed ||
      needsExamSessionsSeed ||
      needsSeatingSeed ||
      needsStudentProfilesSeed ||
      needsStaffProfilesSeed ||
      !hasSchool1PendingAppeal) &&
    next.schools.length > 0
  ) {
    const p5 = generatePhase5SeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
      teachers: next.teachers,
      gradebookEntries: next.gradebook_entries,
      existingGradeAppeals: next.grade_appeals,
    });
    const existingAppealIds = new Set(next.grade_appeals.map((a) => a.id));
    const missingAppeals = p5.extra_grade_appeals.filter((a) => !existingAppealIds.has(a.id));
    next = {
      ...next,
      grade_appeals:
        missingAppeals.length > 0 ? [...missingAppeals, ...next.grade_appeals] : next.grade_appeals,
      in_person_exam_halls: needsHallsSeed ? p5.in_person_exam_halls : next.in_person_exam_halls,
      in_person_exam_sessions: needsExamSessionsSeed
        ? p5.in_person_exam_sessions
        : next.in_person_exam_sessions,
      exam_seating_charts: needsSeatingSeed ? p5.exam_seating_charts : next.exam_seating_charts,
      student_profiles: needsStudentProfilesSeed ? p5.student_profiles : next.student_profiles,
      staff_profiles: needsStaffProfilesSeed ? p5.staff_profiles : next.staff_profiles,
    };
    mutated = true;
  }

  // Additive Phase 6 migration: Seed Finance, Smart Analytics Remedial Plans & Anonymous Surveys ONLY when empty
  const needsFinanceSeed = next.finance_fee_plans.length === 0 && next.finance_student_ledgers.length === 0;
  const needsRemedialSeed = next.remedial_plans.length === 0;
  const needsSurveysSeed = next.anonymous_surveys.length === 0;
  if ((needsFinanceSeed || needsRemedialSeed || needsSurveysSeed) && next.schools.length > 0) {
    const p6 = generatePhase6SeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
      teachers: next.teachers,
    });
    next = {
      ...next,
      finance_fee_plans: needsFinanceSeed ? p6.finance_fee_plans : next.finance_fee_plans,
      finance_student_ledgers: needsFinanceSeed
        ? p6.finance_student_ledgers
        : next.finance_student_ledgers,
      finance_payments:
        needsFinanceSeed && next.finance_payments.length === 0
          ? p6.finance_payments
          : next.finance_payments,
      finance_expenses:
        needsFinanceSeed && next.finance_expenses.length === 0
          ? p6.finance_expenses
          : next.finance_expenses,
      remedial_plans: needsRemedialSeed ? p6.remedial_plans : next.remedial_plans,
      anonymous_surveys: needsSurveysSeed ? p6.anonymous_surveys : next.anonymous_surveys,
      survey_participation_receipts:
        needsSurveysSeed && next.survey_participation_receipts.length === 0
          ? p6.survey_participation_receipts
          : next.survey_participation_receipts,
      survey_anonymous_responses:
        needsSurveysSeed && next.survey_anonymous_responses.length === 0
          ? p6.survey_anonymous_responses
          : next.survey_anonymous_responses,
    };
    mutated = true;
  }

  // Additive Phase 7 migration: Seed Teacher Development & 5-Tier Ranking ONLY when td_courses is empty
  const needsTeacherDevSeed = next.td_courses.length === 0;
  if (needsTeacherDevSeed && next.schools.length > 0) {
    const p7 = generatePhase7SeedData({
      schools: next.schools,
      teachers: next.teachers,
      anchorTodayJalali: getTodayJalali(),
    });
    next = {
      ...next,
      td_courses: p7.td_courses,
      td_progress: next.td_progress.length === 0 ? p7.td_progress : next.td_progress,
      td_certificates: next.td_certificates.length === 0 ? p7.td_certificates : next.td_certificates,
      td_school_settings:
        next.td_school_settings.length === 0 ? p7.td_school_settings : next.td_school_settings,
    };
    mutated = true;
  }

  // Additive Phase 8A migration: attach default complexId onto legacy schools & seed Super Admin governance stores ONLY when empty
  let schoolsStamped = false;
  const stampedSchools = next.schools.map((school) => {
    if (!school.complexId || !school.gradeLevel || school.isActive === undefined) {
      schoolsStamped = true;
      return {
        ...school,
        complexId: school.complexId ?? DEFAULT_COMPLEX_ID,
        gradeLevel: school.gradeLevel ?? 'elementary',
        isActive: school.isActive ?? true,
      };
    }
    return school;
  });
  if (schoolsStamped) {
    next = { ...next, schools: stampedSchools };
    mutated = true;
  }

  const needsComplexSeed = next.educational_complexes.length === 0;
  const needsAdminAccountsSeed = next.managed_admin_accounts.length === 0;
  const needsRoleGovSeed = next.role_governance_configs.length === 0;
  const needsGlobalCfgSeed = next.global_system_configs.length === 0;
  if (
    (needsComplexSeed || needsAdminAccountsSeed || needsRoleGovSeed || needsGlobalCfgSeed) &&
    next.schools.length > 0
  ) {
    const p8 = generatePhase8ASeedData({ schools: next.schools });
    next = {
      ...next,
      educational_complexes: needsComplexSeed ? p8.educational_complexes : next.educational_complexes,
      managed_admin_accounts: needsAdminAccountsSeed
        ? p8.managed_admin_accounts
        : next.managed_admin_accounts,
      role_governance_configs: needsRoleGovSeed
        ? p8.role_governance_configs
        : next.role_governance_configs,
      global_system_configs: needsGlobalCfgSeed
        ? p8.global_system_configs
        : next.global_system_configs,
      super_admin_audit_logs:
        next.super_admin_audit_logs.length === 0
          ? p8.super_admin_audit_logs
          : next.super_admin_audit_logs,
    };
    mutated = true;
  }

  // Additive Phase 9A migration: seed Academic Years & Mock/Konkur Exams ONLY when empty
  const needsAcademicYears = next.academic_years.length === 0;
  const needsMockExams = next.mock_exams.length === 0;
  if ((needsAcademicYears || needsMockExams) && next.schools.length > 0) {
    const p9 = generatePhase9ASeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
    });
    next = {
      ...next,
      academic_years: needsAcademicYears ? p9.academic_years : next.academic_years,
      mock_exams: needsMockExams ? p9.mock_exams : next.mock_exams,
      mock_exam_attempts:
        needsMockExams && next.mock_exam_attempts.length === 0
          ? p9.mock_exam_attempts
          : next.mock_exam_attempts,
    };
    mutated = true;
  }

  // Normalize any legacy Phase 9A academic_years records with Phase 9B canonical fields
  if (next.academic_years.some((y) => !y.code || !y.status || !y.startDateJalali)) {
    next = {
      ...next,
      academic_years: next.academic_years.map(normalizeAcademicYear),
    };
    mutated = true;
  }

  // Additive Phase 9B migration: seed Advanced SIDA Analytics collections ONLY when empty
  const needsSidaAnalytics =
    (next.sida_analytics_grades.length === 0 || next.sida_appeal_windows.length === 0) &&
    next.schools.length > 0;
  if (needsSidaAnalytics) {
    const p9b = generatePhase9BSeedData({
      schools: next.schools,
      classes: next.classes,
      students: next.students,
    });
    next = {
      ...next,
      sida_appeal_windows:
        next.sida_appeal_windows.length === 0
          ? p9b.sida_appeal_windows
          : next.sida_appeal_windows,
      sida_remedial_groups:
        next.sida_remedial_groups.length === 0
          ? p9b.sida_remedial_groups
          : next.sida_remedial_groups,
      sida_class_balancing_drafts:
        next.sida_class_balancing_drafts.length === 0
          ? p9b.sida_class_balancing_drafts
          : next.sida_class_balancing_drafts,
      sida_analytics_grades:
        next.sida_analytics_grades.length === 0
          ? p9b.sida_analytics_grades
          : next.sida_analytics_grades,
    };
    mutated = true;
  }

  // Non-destructive branding migration: replace legacy temporary school/complex names with official Golestan Rah-e Roshan names
  const LEGACY_SCHOOL_NAME_MAP: Record<string, { name: string; subtitle: string; gradeLevel: 'elementary' | 'middle' | 'high'; letterheadTitle: string; signatureFooter: string }> = {
    'مدرسه شماره ۱ - واحد الف': {
      name: OFFICIAL_SCHOOL_NAMES.school1,
      subtitle: 'دوره ابتدایی (اول و دوم) · مجموعه مدارس گلستان راه روشن',
      gradeLevel: 'elementary',
      letterheadTitle: `${OFFICIAL_SYSTEM_NAME_FA} — ${OFFICIAL_SCHOOL_NAMES.school1}`,
      signatureFooter: `تایید معلم مربوطه | تایید معاون اجرایی | مهر و امضای مدیریت ${OFFICIAL_SCHOOL_NAMES.school1}`,
    },
    'مدرسه شماره ۲ - واحد ب': {
      name: OFFICIAL_SCHOOL_NAMES.school2,
      subtitle: 'دوره اول متوسطه · مجموعه مدارس گلستان راه روشن',
      gradeLevel: 'middle',
      letterheadTitle: `${OFFICIAL_SYSTEM_NAME_FA} — ${OFFICIAL_SCHOOL_NAMES.school2}`,
      signatureFooter: `تایید دبیر مربوطه | تایید معاون آموزشی | مهر و امضای مدیریت ${OFFICIAL_SCHOOL_NAMES.school2}`,
    },
    'مدرسه شماره ۳ - واحد ج': {
      name: OFFICIAL_SCHOOL_NAMES.school3,
      subtitle: 'دوره دوم متوسطه و پژوهش · مجموعه مدارس گلستان راه روشن',
      gradeLevel: 'high',
      letterheadTitle: `${OFFICIAL_SYSTEM_NAME_FA} — ${OFFICIAL_SCHOOL_NAMES.school3}`,
      signatureFooter: `تایید دبیر مربوطه | تایید معاون پرورشی | مهر و امضای مدیریت ${OFFICIAL_SCHOOL_NAMES.school3}`,
    },
  };

  if (next.schools.some((s) => s.name in LEGACY_SCHOOL_NAME_MAP)) {
    next = {
      ...next,
      schools: next.schools.map((s) => {
        const mapped = LEGACY_SCHOOL_NAME_MAP[s.name];
        return mapped ? { ...s, ...mapped } : s;
      }),
    };
    mutated = true;
  }

  if (next.educational_complexes.some((c) => c.name === 'مجموعه آموزشی پیشفرض')) {
    next = {
      ...next,
      educational_complexes: next.educational_complexes.map((c) =>
        c.name === 'مجموعه آموزشی پیشفرض' ? { ...c, name: OFFICIAL_COMPLEX_NAME_FA } : c
      ),
    };
    mutated = true;
  }

  // Non-destructive Layer-1 Security credential hashing migration (ensures ZERO plaintext passwords remain in storage)
  let accountsMigrated = false;
  const migratedAdmins = next.managed_admin_accounts.map((acc) => {
    // Migrate legacy default superadmin ('superadmin'/'super123') to official bootstrap ('09120000001'/'Admin@1404', mustChangePassword: true)
    if (acc.id === 'user-super-admin' && acc.username === 'superadmin') {
      accountsMigrated = true;
      const bootCred = hashPasswordSync('Admin@1404');
      const upgraded = {
        ...acc,
        fullName: 'راهبر ارشد سامانه گلستان راه روشن',
        username: '09120000001',
        passwordHash: bootCred.passwordHash,
        passwordSalt: bootCred.passwordSalt,
        mustChangePassword: true,
      };
      delete upgraded.password;
      return upgraded;
    }
    const hashedAcc = ensureManagedAdminAccountHashed(acc);
    if (hashedAcc !== acc) accountsMigrated = true;
    return hashedAcc;
  });

  if (accountsMigrated) {
    next = { ...next, managed_admin_accounts: migratedAdmins };
    mutated = true;
  }

  let secStudentsMigrated = false;
  const secMigratedStudents = next.students.map((st) => {
    const hashedSt = ensureStudentDualCredentials(st);
    if (hashedSt !== st) secStudentsMigrated = true;
    return hashedSt;
  });
  if (secStudentsMigrated) {
    next = { ...next, students: secMigratedStudents };
    mutated = true;
  }

  let teachersMigrated = false;
  const migratedTeachers = next.teachers.map((t) => {
    const hashedT = ensureTeacherHashed(t);
    if (hashedT !== t) teachersMigrated = true;
    return hashedT;
  });
  if (teachersMigrated) {
    next = { ...next, teachers: migratedTeachers };
    mutated = true;
  }

  // Enforce exclusive super_admin governance on addons module in stored role_governance_configs
  if (
    next.role_governance_configs.some(
      (cfg) => cfg.modulePermissions?.addons?.view === true
    )
  ) {
    next = {
      ...next,
      role_governance_configs: next.role_governance_configs.map((cfg) => ({
        ...cfg,
        modulePermissions: {
          ...cfg.modulePermissions,
          addons: { view: false, create: false, edit: false, delete: false, export: false },
        },
      })),
    };
    mutated = true;
  }

  if (!Array.isArray(next.security_audit_logs)) {
    next = { ...next, security_audit_logs: [] };
    mutated = true;
  }

  // Additive Step 3 migration: hydrate smart_content_archive, school_announcements, transfer logs, notification receipts & recovery snapshots
  if (!Array.isArray(next.smart_content_archive) || next.smart_content_archive.length === 0) {
    const todayJalali = getTodayJalali();
    const seededArchive =
      next.schools.length > 0
        ? generateStep3InitialArchive({
            schools: next.schools,
            classes: next.classes,
            teachers: next.teachers,
            flippedLessons: next.flipped_lessons,
            mediaResources: next.media_resources,
            questionBank: next.question_bank,
            todayJalali,
          })
        : [];
    next = { ...next, smart_content_archive: seededArchive };
    if (seededArchive.length > 0) mutated = true;
  }

  if (!Array.isArray(next.school_announcements) || next.school_announcements.length === 0) {
    const todayJalali = getTodayJalali();
    const seededAnnouncements =
      next.schools.length > 0
        ? generateStep3InitialAnnouncements({
            schools: next.schools,
            classes: next.classes,
            todayJalali,
          })
        : [];
    next = { ...next, school_announcements: seededAnnouncements };
    if (seededAnnouncements.length > 0) mutated = true;
  }

  if (!Array.isArray(next.student_transfer_logs)) {
    next = { ...next, student_transfer_logs: [] };
    mutated = true;
  }
  if (!Array.isArray(next.notification_read_receipts)) {
    next = { ...next, notification_read_receipts: [] };
    mutated = true;
  }
  if (!Array.isArray(next.recovery_snapshots)) {
    next = { ...next, recovery_snapshots: [] };
    mutated = true;
  }
  if (!Array.isArray(next.import_mapping_templates)) {
    next = { ...next, import_mapping_templates: [] };
    mutated = true;
  }

  // Additive Phase 9-C migration: ensure seeded counselor accounts exist for existing schools & hydrate 8 Phase 9-C stores when empty
  if (next.schools.length > 0) {
    const existingAccountIds = new Set(next.managed_admin_accounts.map((a) => a.id));
    const hasMissingCounselor = next.schools.some(
      (s) => !existingAccountIds.has(`user-counselor-${s.id}`)
    );
    if (hasMissingCounselor) {
      const p8Fresh = generatePhase8ASeedData({ schools: next.schools });
      const missingCounselors = p8Fresh.managed_admin_accounts.filter(
        (a) => a.role === 'counselor' && !existingAccountIds.has(a.id)
      );
      if (missingCounselors.length > 0) {
        next = {
          ...next,
          managed_admin_accounts: [...next.managed_admin_accounts, ...missingCounselors],
        };
        mutated = true;
      }
    }

    const needsP9CDiscipline = !Array.isArray(next.discipline_records) || next.discipline_records.length === 0;
    const needsP9CExit = !Array.isArray(next.student_exit_passes) || next.student_exit_passes.length === 0;
    const needsP9CCounseling = !Array.isArray(next.counseling_sessions) || next.counseling_sessions.length === 0;
    const needsP9CVirtual = !Array.isArray(next.virtual_class_sessions) || next.virtual_class_sessions.length === 0;

    if (needsP9CDiscipline || needsP9CExit || needsP9CCounseling || needsP9CVirtual) {
      const p9c = generatePhase9CSeedData({
        schools: next.schools,
        classes: next.classes,
        students: next.students,
        teachers: next.teachers,
        todayJalali: getTodayJalali(),
      });
      next = {
        ...next,
        discipline_records: needsP9CDiscipline ? p9c.discipline_records : next.discipline_records,
        discipline_pledges:
          !Array.isArray(next.discipline_pledges) || next.discipline_pledges.length === 0
            ? p9c.discipline_pledges
            : next.discipline_pledges,
        student_exit_passes: needsP9CExit ? p9c.student_exit_passes : next.student_exit_passes,
        staff_leave_requests:
          !Array.isArray(next.staff_leave_requests) || next.staff_leave_requests.length === 0
            ? p9c.staff_leave_requests
            : next.staff_leave_requests,
        counseling_sessions: needsP9CCounseling ? p9c.counseling_sessions : next.counseling_sessions,
        counseling_clinical_notes:
          !Array.isArray(next.counseling_clinical_notes) || next.counseling_clinical_notes.length === 0
            ? p9c.counseling_clinical_notes
            : next.counseling_clinical_notes,
        virtual_class_sessions: needsP9CVirtual
          ? p9c.virtual_class_sessions
          : next.virtual_class_sessions,
        virtual_class_attendance:
          !Array.isArray(next.virtual_class_attendance) || next.virtual_class_attendance.length === 0
            ? p9c.virtual_class_attendance
            : next.virtual_class_attendance,
      };
      mutated = true;
    }
  }

  return { dataset: next, mutated };
}

function readLocalStorageSnapshot(): SeedDataset | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SeedDataset>;
    if (!parsed || !Array.isArray(parsed.schools) || parsed.schools.length === 0) return null;
    const merged: SeedDataset = {
      ...createEmptyStore(),
      ...parsed,
    };
    const { dataset, mutated } = hydrateMissingPhase2Collections(merged);
    if (mutated) {
      writeLocalStorageSnapshot(dataset);
    }
    return dataset;
  } catch {
    return null;
  }
}

function writeLocalStorageSnapshot(data: SeedDataset): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(LS_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

interface PersistedVaultBundle {
  vaultMeta: MigrationVaultMeta;
  panicModeState: PanicModeState;
  preMigrationSnapshot: string | null;
  dailyRollingSnapshots: DailyRollingSnapshot[];
}

function createDefaultVaultBundle(): PersistedVaultBundle {
  return {
    vaultMeta: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      history: [],
    },
    panicModeState: { ...DEFAULT_PANIC_MODE_STATE },
    preMigrationSnapshot: null,
    dailyRollingSnapshots: [],
  };
}

function readLocalStorageVaultBundle(): PersistedVaultBundle {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultVaultBundle();
    }
    const raw = window.localStorage.getItem(LS_VAULT_META_KEY);
    if (!raw) return createDefaultVaultBundle();
    const parsed = JSON.parse(raw) as Partial<PersistedVaultBundle>;
    const defaults = createDefaultVaultBundle();
    return {
      vaultMeta: parsed.vaultMeta
        ? {
            schemaVersion: parsed.vaultMeta.schemaVersion ?? CURRENT_SCHEMA_VERSION,
            lastMigratedAtIso: parsed.vaultMeta.lastMigratedAtIso,
            lastMigratedAtJalali: parsed.vaultMeta.lastMigratedAtJalali,
            preMigrationSnapshotAtIso: parsed.vaultMeta.preMigrationSnapshotAtIso,
            history: Array.isArray(parsed.vaultMeta.history) ? parsed.vaultMeta.history : [],
          }
        : defaults.vaultMeta,
      panicModeState: parsed.panicModeState
        ? { ...DEFAULT_PANIC_MODE_STATE, ...parsed.panicModeState }
        : defaults.panicModeState,
      preMigrationSnapshot:
        typeof parsed.preMigrationSnapshot === 'string' ? parsed.preMigrationSnapshot : null,
      dailyRollingSnapshots: Array.isArray(parsed.dailyRollingSnapshots)
        ? parsed.dailyRollingSnapshots.slice(0, MAX_DAILY_ROLLING_SNAPSHOTS)
        : [],
    };
  } catch {
    return createDefaultVaultBundle();
  }
}

function writeLocalStorageVaultBundle(bundle: PersistedVaultBundle): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LS_VAULT_META_KEY, JSON.stringify(bundle));
  } catch {
    // Graceful degradation if storage quota is tight
  }
}

const PANIC_EXEMPT_COLLECTIONS: ReadonlySet<CollectionName> = new Set<CollectionName>([
  'security_audit_logs',
  'notification_read_receipts',
  'user_appearance_prefs',
]);

export class LocalIndexedDBAdapter implements IDataRepository {
  public backendMode: StorageBackendMode = 'memory';
  public readonly schemaVersion: number = CURRENT_SCHEMA_VERSION;
  private db: IDBDatabase | null = null;
  private cache: SeedDataset;
  private vaultBundle: PersistedVaultBundle;
  private initialized = false;
  private authContext: AuthGuardContext | null = null;
  private listeners = new Set<RepositoryChangeListener>();
  private tabId = `tab-${Math.random().toString(36).slice(2, 10)}`;
  private broadcastChannel: BroadcastChannel | null = null;

  public setAuthContext(auth: AuthGuardContext | null): void {
    this.authContext = auth;
  }

  public subscribe(listener: RepositoryChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(event: Omit<RepositoryChangeEvent, 'timestamp' | 'sourceTabId'>, broadcast = true): void {
    const fullEvent: RepositoryChangeEvent = {
      ...event,
      timestamp: Date.now(),
      sourceTabId: this.tabId,
    };
    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch {
        // Isolate listener failures
      }
    }
    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullEvent);
      } catch {
        // Ignore closed channel errors
      }
    }
  }

  private handleExternalSync(incomingEvent?: RepositoryChangeEvent): void {
    const refreshed = readLocalStorageSnapshot();
    if (refreshed) {
      this.cache = refreshed;
    }
    this.vaultBundle = readLocalStorageVaultBundle();
    this.emitChange(
      {
        type: 'external_sync',
        collection: incomingEvent?.collection,
        schoolId: incomingEvent?.schoolId,
      },
      false
    );
  }

  private assertWriteAllowed<K extends CollectionName>(
    collection: K,
    action: 'write' | 'delete',
    schoolId: string,
    record?: unknown
  ): void {
    // Panic Mode (Read-Only Freeze) blocks all non-exempt writes/deletes in locked scope
    if (
      !PANIC_EXEMPT_COLLECTIONS.has(collection) &&
      isSchoolUnderPanicLock(this.vaultBundle.panicModeState, schoolId)
    ) {
      throw new Error(
        'سامانه در حالت اضطراری (قفل فقط‌خواندنی) قرار دارد؛ ثبت، ویرایش یا حذف اطلاعات تا رفع قفل توسط راهبر ارشد غیرفعال است.'
      );
    }

    if (!this.authContext) return;
    const decision = authorizeMutation(this.authContext, collection, action, {
      schoolId,
      record,
    });
    if (!decision.allowed) {
      throw new Error(decision.reasonFa ?? 'عدم دسترسی برای انجام این عملیات.');
    }
  }

  constructor() {
    // Immediate synchronous boot from localStorage or seed — guarantees ZERO loading freeze
    this.vaultBundle = readLocalStorageVaultBundle();
    const ls = readLocalStorageSnapshot();
    if (ls) {
      this.cache = ls;
      this.backendMode = 'localstorage';
    } else {
      this.cache = generateSeedDataset();
      if (writeLocalStorageSnapshot(this.cache)) {
        this.backendMode = 'localstorage';
      } else {
        this.backendMode = 'memory';
      }
    }

    // Set up native cross-tab live sync (BroadcastChannel + storage event fallback)
    if (typeof window !== 'undefined') {
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
          this.broadcastChannel.onmessage = (msg: MessageEvent<RepositoryChangeEvent>) => {
            if (msg.data && msg.data.sourceTabId !== this.tabId) {
              this.handleExternalSync(msg.data);
            }
          };
        } catch {
          this.broadcastChannel = null;
        }
      }
      window.addEventListener('storage', (evt: StorageEvent) => {
        if ((evt.key === LS_STORAGE_KEY || evt.key === LS_VAULT_META_KEY) && evt.newValue) {
          this.handleExternalSync();
        }
      });
    }
  }

  public getSyncSnapshot(): SeedDataset {
    return this.cache;
  }

  public async init(): Promise<StorageBackendMode> {
    if (this.initialized) return this.backendMode;
    this.initialized = true;

    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return this.backendMode;
    }

    try {
      const db = await withTimeout(this.openDatabase(), 'open');
      this.db = db;

      const existingSchools = await withTimeout(
        this.idbGetAll<School>(db, 'schools'),
        'read_schools'
      );

      if (existingSchools.length > 0) {
        // Hydrate cache from IndexedDB
        const hydrated = createEmptyStore();
        for (const col of ALL_COLLECTIONS) {
          const rows = await withTimeout(this.idbGetAll(db, col), `hydrate_${col}`);
          (hydrated as unknown as Record<CollectionName, unknown[]>)[col] = rows;
        }
        // Additive Phase 2 upgrade for existing Phase 1 IDB users
        const { dataset: upgraded, mutated } = hydrateMissingPhase2Collections(hydrated);
        this.cache = upgraded;
        if (mutated) {
          for (const col of [
            ...PHASE2_COLLECTIONS,
            'schools' as const,
            'school_plugin_states' as const,
            'students' as const,
          ]) {
            const rows = upgraded[col] as CollectionTypeMap[typeof col][];
            if (rows.length > 0) {
              await withTimeout(this.idbPutItems(db, col, rows), `upgrade_${col}`);
            }
          }
        }
        writeLocalStorageSnapshot(this.cache);
      } else {
        // Seed IndexedDB from current cache
        await this.flushAllToIdb(db, this.cache);
      }

      // Hydrate vault metadata (schemaVersion, history, Panic Mode, snapshots) from IndexedDB
      if (db.objectStoreNames.contains(VAULT_META_STORE)) {
        const storedVaultRows = await withTimeout(
          this.idbGetVaultEntries(db),
          'read_vault_metadata'
        );
        if (storedVaultRows.length > 0) {
          const map = new Map(storedVaultRows.map((r) => [r.key, r.value]));
          if (map.has('vaultMeta')) {
            this.vaultBundle.vaultMeta = map.get('vaultMeta') as MigrationVaultMeta;
          }
          if (map.has('panicModeState')) {
            this.vaultBundle.panicModeState = {
              ...DEFAULT_PANIC_MODE_STATE,
              ...(map.get('panicModeState') as PanicModeState),
            };
          }
          if (map.has('preMigrationSnapshot')) {
            this.vaultBundle.preMigrationSnapshot = map.get('preMigrationSnapshot') as string | null;
          }
          if (map.has('dailyRollingSnapshots')) {
            const arr = map.get('dailyRollingSnapshots');
            if (Array.isArray(arr)) {
              this.vaultBundle.dailyRollingSnapshots = (arr as DailyRollingSnapshot[]).slice(
                0,
                MAX_DAILY_ROLLING_SNAPSHOTS
              );
            }
          }
          writeLocalStorageVaultBundle(this.vaultBundle);
        } else {
          await this.persistVaultBundleToIdb(db);
        }
      }

      this.backendMode = 'indexeddb';
      return this.backendMode;
    } catch {
      // Silent automatic fallback to localStorage / memory — NEVER hang!
      this.db = null;
      this.backendMode = writeLocalStorageSnapshot(this.cache) ? 'localstorage' : 'memory';
      return this.backendMode;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        // Additive-only migration: NEVER drop or clear existing stores
        for (const col of ALL_COLLECTIONS) {
          if (!db.objectStoreNames.contains(col)) {
            const store = db.createObjectStore(col, { keyPath: 'id' });
            if (col !== 'schools') {
              store.createIndex('schoolId', 'schoolId', { unique: false });
            }
          }
        }
        if (!db.objectStoreNames.contains(VAULT_META_STORE)) {
          db.createObjectStore(VAULT_META_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
  }

  private idbGetVaultEntries(db: IDBDatabase): Promise<Array<{ key: string; value: unknown }>> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_META_STORE, 'readonly');
      const req = tx.objectStore(VAULT_META_STORE).getAll();
      req.onsuccess = () => resolve((req.result as Array<{ key: string; value: unknown }>) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IDB vault read failed'));
    });
  }

  private async persistVaultBundleToIdb(dbOverride?: IDBDatabase | null): Promise<void> {
    writeLocalStorageVaultBundle(this.vaultBundle);
    const targetDb = dbOverride ?? this.db;
    if (!targetDb || !targetDb.objectStoreNames.contains(VAULT_META_STORE)) return;
    try {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const tx = targetDb.transaction(VAULT_META_STORE, 'readwrite');
          const store = tx.objectStore(VAULT_META_STORE);
          store.put({ key: 'vaultMeta', value: this.vaultBundle.vaultMeta });
          store.put({ key: 'panicModeState', value: this.vaultBundle.panicModeState });
          store.put({ key: 'preMigrationSnapshot', value: this.vaultBundle.preMigrationSnapshot });
          store.put({ key: 'dailyRollingSnapshots', value: this.vaultBundle.dailyRollingSnapshots });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('IDB vault write failed'));
        }),
        'write_vault_metadata'
      );
    } catch {
      // Fall back gracefully without hanging
    }
  }

  private idbGetAll<T>(db: IDBDatabase, storeName: CollectionName): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error ?? new Error(`IDB getAll failed: ${storeName}`));
    });
  }

  private idbPutItems<K extends CollectionName>(
    db: IDBDatabase,
    storeName: K,
    items: CollectionTypeMap[K][]
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`IDB put failed: ${storeName}`));
      tx.onabort = () => reject(new Error(`IDB put aborted: ${storeName}`));
    });
  }

  private idbDeleteKeys(db: IDBDatabase, storeName: CollectionName, keys: string[]): Promise<void> {
    if (keys.length === 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const k of keys) {
        store.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`IDB delete failed: ${storeName}`));
      tx.onabort = () => reject(new Error(`IDB delete aborted: ${storeName}`));
    });
  }

  private async flushAllToIdb(db: IDBDatabase, dataset: SeedDataset): Promise<void> {
    for (const col of ALL_COLLECTIONS) {
      const rows = dataset[col] as CollectionTypeMap[typeof col][];
      if (rows.length > 0) {
        await withTimeout(this.idbPutItems(db, col, rows), `seed_${col}`);
      }
    }
  }

  private async persistItemToIdb<K extends CollectionName>(
    collection: K,
    items: CollectionTypeMap[K][]
  ): Promise<void> {
    writeLocalStorageSnapshot(this.cache);
    if (!this.db) return;
    try {
      await withTimeout(this.idbPutItems(this.db, collection, items), `put_${collection}`);
    } catch {
      this.db = null;
      this.backendMode = 'localstorage';
    }
  }

  public async getAllSchools(): Promise<School[]> {
    return this.cache.schools
      .filter((s) => !isRecordSoftDeleted(s))
      .map((s) => normalizeRecordDefaults(s).record);
  }

  public async saveSchool(school: School): Promise<void> {
    this.assertWriteAllowed('schools', 'write', school.schoolId, school);
    const idx = this.cache.schools.findIndex((s) => s.id === school.id);
    const normalized = normalizeRecordDefaults(school).record;
    const versioned: School =
      idx >= 0
        ? {
            ...normalized,
            recordVersion:
              Math.max(
                (this.cache.schools[idx] as SoftDeleteVersionFields).recordVersion ?? 1,
                (normalized as SoftDeleteVersionFields).recordVersion ?? 1
              ) + 1,
          }
        : normalized;
    if (idx >= 0) {
      this.cache.schools[idx] = versioned;
    } else {
      this.cache.schools.push(versioned);
    }
    await this.persistItemToIdb('schools', [versioned]);
    this.emitChange({ type: 'school_saved', collection: 'schools', schoolId: versioned.schoolId });
  }

  public async getBySchool<K extends CollectionName>(
    collection: K,
    schoolId: string
  ): Promise<CollectionTypeMap[K][]> {
    if (this.authContext) {
      const readDecision = assertTenantReadAccess(this.authContext.session, collection, schoolId);
      if (!readDecision.allowed) {
        throw new Error(readDecision.reasonFa ?? 'عدم دسترسی به داده‌های مدرسه انتخاب‌شده.');
      }
    }
    const list = this.cache[collection] as CollectionTypeMap[K][];
    return list
      .filter((item) => item.schoolId === schoolId && !isRecordSoftDeleted(item))
      .map((item) => normalizeRecordDefaults(item).record);
  }

  public async appendSecurityAuditLog(entry: SecurityAuditLogEntry): Promise<void> {
    const sealed = sealAuditEntrySync(
      normalizeRecordDefaults(entry).record,
      this.cache.security_audit_logs
    );
    this.cache.security_audit_logs = [sealed, ...this.cache.security_audit_logs].slice(0, 1000);
    await this.persistItemToIdb('security_audit_logs', [sealed]);
    this.emitChange({ type: 'put', collection: 'security_audit_logs', schoolId: sealed.schoolId });
  }

  public async putItem<K extends CollectionName>(
    collection: K,
    item: CollectionTypeMap[K]
  ): Promise<void> {
    this.assertWriteAllowed(collection, 'write', item.schoolId, item);
    const list = this.cache[collection] as CollectionTypeMap[K][];
    let staleKeys: string[] = [];
    if (collection === 'school_branding_configs') {
      staleKeys = list
        .filter((existing) => existing.schoolId === item.schoolId && existing.id !== item.id)
        .map((existing) => existing.id);
      if (staleKeys.length > 0) {
        const staleSet = new Set(staleKeys);
        for (let i = list.length - 1; i >= 0; i -= 1) {
          if (staleSet.has(list[i].id)) {
            list.splice(i, 1);
          }
        }
      }
    }
    const idx = list.findIndex((existing) => existing.id === item.id);
    const normalized = normalizeRecordDefaults(item).record;
    const versioned =
      idx >= 0
        ? ({
            ...normalized,
            recordVersion:
              Math.max(
                (list[idx] as SoftDeleteVersionFields).recordVersion ?? 1,
                (normalized as SoftDeleteVersionFields).recordVersion ?? 1
              ) + 1,
          } as CollectionTypeMap[K])
        : normalized;

    if (idx >= 0) {
      list[idx] = versioned;
    } else {
      list.push(versioned);
    }
    if (staleKeys.length > 0 && this.db) {
      try {
        await withTimeout(this.idbDeleteKeys(this.db, collection, staleKeys), `del_${collection}`);
      } catch {
        // ignore cleanup failure
      }
    }
    await this.persistItemToIdb(collection, [versioned]);
    this.emitChange({ type: 'put', collection, schoolId: versioned.schoolId });
  }

  public async putMany<K extends CollectionName>(
    collection: K,
    items: CollectionTypeMap[K][]
  ): Promise<void> {
    if (items.length === 0) return;
    for (const item of items) {
      this.assertWriteAllowed(collection, 'write', item.schoolId, item);
    }
    const list = this.cache[collection] as CollectionTypeMap[K][];
    const staleKeys: string[] = [];
    if (collection === 'school_branding_configs') {
      const incomingBySchool = new Map(items.map((it) => [it.schoolId, it.id]));
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const incomingId = incomingBySchool.get(list[i].schoolId);
        if (incomingId && list[i].id !== incomingId) {
          staleKeys.push(list[i].id);
          list.splice(i, 1);
        }
      }
    }
    const indexById = new Map(list.map((existing, i) => [existing.id, i]));
    const persistedItems: CollectionTypeMap[K][] = [];
    for (const item of items) {
      const normalized = normalizeRecordDefaults(item).record;
      const idx = indexById.get(item.id);
      if (idx !== undefined) {
        const versioned = {
          ...normalized,
          recordVersion:
            Math.max(
              (list[idx] as SoftDeleteVersionFields).recordVersion ?? 1,
              (normalized as SoftDeleteVersionFields).recordVersion ?? 1
            ) + 1,
        } as CollectionTypeMap[K];
        list[idx] = versioned;
        persistedItems.push(versioned);
      } else {
        indexById.set(normalized.id, list.length);
        list.push(normalized);
        persistedItems.push(normalized);
      }
    }
    if (staleKeys.length > 0 && this.db) {
      try {
        await withTimeout(this.idbDeleteKeys(this.db, collection, staleKeys), `del_${collection}`);
      } catch {
        // ignore cleanup failure
      }
    }
    await this.persistItemToIdb(collection, persistedItems);
    this.emitChange({ type: 'putMany', collection, schoolId: items[0]?.schoolId });
  }

  /**
   * Zero-Hard-Delete policy (Soft Delete):
   * Never physically erases records from cache or IndexedDB; stamps deletedAtIso & deletedByUserId
   * so records vanish from normal queries while remaining 100% recoverable in Recycle Bin.
   */
  public async deleteItem<K extends CollectionName>(
    collection: K,
    schoolId: string,
    id: string
  ): Promise<void> {
    this.assertWriteAllowed(collection, 'delete', schoolId);
    const list = this.cache[collection] as CollectionTypeMap[K][];
    const idx = list.findIndex((item) => item.id === id && item.schoolId === schoolId);
    if (idx < 0) return;

    const target = list[idx];
    const nowIso = new Date().toISOString();
    const softDeleted = {
      ...normalizeRecordDefaults(target).record,
      recordVersion: ((target as SoftDeleteVersionFields).recordVersion ?? 1) + 1,
      deletedAtIso: nowIso,
      deletedByUserId: this.authContext?.session?.userId ?? 'system',
      deletedByName: this.authContext?.session?.displayName ?? 'کاربر سامانه',
    } as CollectionTypeMap[K];

    list[idx] = softDeleted;
    await this.persistItemToIdb(collection, [softDeleted]);
    this.emitChange({ type: 'delete', collection, schoolId });
  }

  public async getSoftDeletedItems(schoolId?: string): Promise<SoftDeletedRecordEntry[]> {
    const entries: SoftDeletedRecordEntry[] = [];
    for (const col of ALL_COLLECTIONS) {
      if (col === 'security_audit_logs' || col === 'recovery_snapshots') continue;
      const list = this.cache[col] as unknown as Array<
        Record<string, unknown> & SoftDeleteVersionFields & { id: string; schoolId: string }
      >;
      for (const item of list) {
        if (!isRecordSoftDeleted(item)) continue;
        if (schoolId && item.schoolId !== schoolId) continue;
        const deletedAtIso = item.deletedAtIso as string;
        const deletedDate = new Date(deletedAtIso);
        const deletedAtJalali = Number.isNaN(deletedDate.getTime())
          ? getTodayJalali()
          : dateToJalaliString(deletedDate);
        const deletedAtTimeHm = Number.isNaN(deletedDate.getTime())
          ? '۰۰:۰۰'
          : `${String(deletedDate.getHours()).padStart(2, '0')}:${String(deletedDate.getMinutes()).padStart(2, '0')}`;
        const { titleFa, subtitleFa } = extractRecordDisplayTitle(col, item);
        entries.push({
          id: item.id,
          collection: col,
          collectionLabelFa: getCollectionLabelFa(col),
          schoolId: item.schoolId,
          titleFa,
          subtitleFa,
          recordVersion: item.recordVersion ?? 1,
          deletedAtIso,
          deletedAtJalali,
          deletedAtTimeHm,
          deletedByUserId: item.deletedByUserId ?? 'system',
          deletedByName: item.deletedByName ?? 'کاربر سامانه',
        });
      }
    }
    return entries.sort((a, b) => b.deletedAtIso.localeCompare(a.deletedAtIso));
  }

  public async restoreSoftDeletedItem<K extends CollectionName>(
    collection: K,
    schoolId: string,
    id: string
  ): Promise<boolean> {
    this.assertWriteAllowed(collection, 'write', schoolId);
    const list = this.cache[collection] as CollectionTypeMap[K][];
    const idx = list.findIndex(
      (item) => item.id === id && item.schoolId === schoolId && isRecordSoftDeleted(item)
    );
    if (idx < 0) return false;

    const target = list[idx];
    const restored = {
      ...normalizeRecordDefaults(target).record,
      recordVersion: ((target as SoftDeleteVersionFields).recordVersion ?? 1) + 1,
      deletedAtIso: null,
      deletedByUserId: null,
      deletedByName: null,
    } as CollectionTypeMap[K];

    list[idx] = restored;
    await this.persistItemToIdb(collection, [restored]);
    this.emitChange({ type: 'restore_soft_delete', collection, schoolId });
    return true;
  }

  public getVaultMeta(): MigrationVaultMeta {
    return structuredClone(this.vaultBundle.vaultMeta);
  }

  public async saveVaultMeta(meta: MigrationVaultMeta): Promise<void> {
    this.vaultBundle.vaultMeta = structuredClone(meta);
    await this.persistVaultBundleToIdb();
    this.emitChange({ type: 'vault_updated' });
  }

  public getPanicModeState(): PanicModeState {
    return structuredClone(this.vaultBundle.panicModeState);
  }

  public async savePanicModeState(state: PanicModeState): Promise<void> {
    this.vaultBundle.panicModeState = structuredClone(state);
    await this.persistVaultBundleToIdb();
    this.emitChange({ type: 'panic_mode_changed' });
  }

  public getDailyRollingSnapshots(): DailyRollingSnapshot[] {
    return structuredClone(this.vaultBundle.dailyRollingSnapshots);
  }

  public async saveDailyRollingSnapshot(snapshot: DailyRollingSnapshot): Promise<void> {
    const existing = this.vaultBundle.dailyRollingSnapshots.filter((item) => {
      if (snapshot.trigger === 'auto_daily' && item.trigger === 'auto_daily') {
        return item.jalaliDate !== snapshot.jalaliDate;
      }
      return item.id !== snapshot.id;
    });
    this.vaultBundle.dailyRollingSnapshots = [snapshot, ...existing].slice(
      0,
      MAX_DAILY_ROLLING_SNAPSHOTS
    );
    await this.persistVaultBundleToIdb();
    this.emitChange({ type: 'vault_updated' });
  }

  public async savePreMigrationSnapshot(snapshotJson: string): Promise<void> {
    this.vaultBundle.preMigrationSnapshot = snapshotJson;
    this.vaultBundle.vaultMeta = {
      ...this.vaultBundle.vaultMeta,
      preMigrationSnapshotAtIso: new Date().toISOString(),
    };
    await this.persistVaultBundleToIdb();
  }

  public getPreMigrationSnapshot(): string | null {
    return this.vaultBundle.preMigrationSnapshot;
  }

  public async replaceEntireDataset(newDataset: SeedDataset): Promise<void> {
    this.cache = structuredClone(newDataset);
    writeLocalStorageSnapshot(this.cache);
    this.emitChange({ type: 'restore' });
    if (this.db) {
      try {
        for (const col of ALL_COLLECTIONS) {
          await withTimeout(
            this.clearAndWriteIdbStore(this.db, col, this.cache[col]),
            `replace_${col}`
          );
        }
      } catch {
        this.db = null;
        this.backendMode = 'localstorage';
      }
    }
  }

  public async getCollectionCountsBySchool(
    schoolId: string
  ): Promise<Record<CollectionName, number>> {
    const counts = {} as Record<CollectionName, number>;
    for (const col of ALL_COLLECTIONS) {
      const list = this.cache[col];
      counts[col] = list.filter(
        (item) => item.schoolId === schoolId && !isRecordSoftDeleted(item)
      ).length;
    }
    return counts;
  }

  public async exportSchoolBackup(schoolId: string): Promise<BackupPayload> {
    if (this.authContext) {
      const decision = authorizeBackupOperation(this.authContext, 'single_school', schoolId);
      if (!decision.allowed) throw new Error(decision.reasonFa ?? 'عدم دسترسی پشتیبان‌گیری.');
    }
    // Always includes ALL Phase 1 + Phase 2 collections for this schoolId, including disabled/uninstalled plugin data
    return {
      schemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      scope: 'single_school',
      schoolId,
      data: {
        schools: this.cache.schools.filter((x) => x.schoolId === schoolId),
        classes: this.cache.classes.filter((x) => x.schoolId === schoolId),
        students: this.cache.students.filter((x) => x.schoolId === schoolId),
        teachers: this.cache.teachers.filter((x) => x.schoolId === schoolId),
        schedules: this.cache.schedules.filter((x) => x.schoolId === schoolId),
        student_attendance: this.cache.student_attendance.filter((x) => x.schoolId === schoolId),
        staff_attendance: this.cache.staff_attendance.filter((x) => x.schoolId === schoolId),
        substitutions: this.cache.substitutions.filter((x) => x.schoolId === schoolId),
        daily_logs: this.cache.daily_logs.filter((x) => x.schoolId === schoolId),
        school_plugin_states: this.cache.school_plugin_states.filter((x) => x.schoolId === schoolId),
        curriculum_topics: this.cache.curriculum_topics.filter((x) => x.schoolId === schoolId),
        media_resources: this.cache.media_resources.filter((x) => x.schoolId === schoolId),
        chat_outbox: this.cache.chat_outbox.filter((x) => x.schoolId === schoolId),
        gradebook_entries: this.cache.gradebook_entries.filter((x) => x.schoolId === schoolId),
        lesson_plans: this.cache.lesson_plans.filter((x) => x.schoolId === schoolId),
        gradebook_weights: this.cache.gradebook_weights.filter((x) => x.schoolId === schoolId),
        grade_appeals: this.cache.grade_appeals.filter((x) => x.schoolId === schoolId),
        homework_assignments: this.cache.homework_assignments.filter((x) => x.schoolId === schoolId),
        homework_submissions: this.cache.homework_submissions.filter((x) => x.schoolId === schoolId),
        student_rewards: this.cache.student_rewards.filter((x) => x.schoolId === schoolId),
        question_bank: this.cache.question_bank.filter((x) => x.schoolId === schoolId),
        class_chat_draft_queue: this.cache.class_chat_draft_queue.filter((x) => x.schoolId === schoolId),
        exam_question_basket: this.cache.exam_question_basket.filter((x) => x.schoolId === schoolId),
        flipped_lessons: this.cache.flipped_lessons.filter((x) => x.schoolId === schoolId),
        flipped_telemetry: this.cache.flipped_telemetry.filter((x) => x.schoolId === schoolId),
        flipped_questions: this.cache.flipped_questions.filter((x) => x.schoolId === schoolId),
        online_class_sessions: this.cache.online_class_sessions.filter((x) => x.schoolId === schoolId),
        online_class_attendance: this.cache.online_class_attendance.filter((x) => x.schoolId === schoolId),
        online_exams: this.cache.online_exams.filter((x) => x.schoolId === schoolId),
        online_exam_submissions: this.cache.online_exam_submissions.filter((x) => x.schoolId === schoolId),
        student_360_signals: this.cache.student_360_signals.filter((x) => x.schoolId === schoolId),
        parent_staff_messages: this.cache.parent_staff_messages.filter((x) => x.schoolId === schoolId),
        class_chat_rooms: this.cache.class_chat_rooms.filter((x) => x.schoolId === schoolId),
        class_chat_messages: this.cache.class_chat_messages.filter((x) => x.schoolId === schoolId),
        appointment_slots: this.cache.appointment_slots.filter((x) => x.schoolId === schoolId),
        electronic_forms: this.cache.electronic_forms.filter((x) => x.schoolId === schoolId),
        electronic_form_responses: this.cache.electronic_form_responses.filter((x) => x.schoolId === schoolId),
        notification_templates: this.cache.notification_templates.filter((x) => x.schoolId === schoolId),
        sida_grade_audit_logs: this.cache.sida_grade_audit_logs.filter((x) => x.schoolId === schoolId),
        in_person_exam_halls: this.cache.in_person_exam_halls.filter((x) => x.schoolId === schoolId),
        in_person_exam_sessions: this.cache.in_person_exam_sessions.filter((x) => x.schoolId === schoolId),
        exam_seating_charts: this.cache.exam_seating_charts.filter((x) => x.schoolId === schoolId),
        student_profiles: this.cache.student_profiles.filter((x) => x.schoolId === schoolId),
        staff_profiles: this.cache.staff_profiles.filter((x) => x.schoolId === schoolId),
        sida_speed_entry_ticks: this.cache.sida_speed_entry_ticks.filter((x) => x.schoolId === schoolId),
        user_appearance_prefs: this.cache.user_appearance_prefs.filter((x) => x.schoolId === schoolId),
        school_branding_configs: this.cache.school_branding_configs.filter((x) => x.schoolId === schoolId),
        finance_fee_plans: this.cache.finance_fee_plans.filter((x) => x.schoolId === schoolId),
        finance_student_ledgers: this.cache.finance_student_ledgers.filter((x) => x.schoolId === schoolId),
        finance_payments: this.cache.finance_payments.filter((x) => x.schoolId === schoolId),
        finance_expenses: this.cache.finance_expenses.filter((x) => x.schoolId === schoolId),
        remedial_plans: this.cache.remedial_plans.filter((x) => x.schoolId === schoolId),
        anonymous_surveys: this.cache.anonymous_surveys.filter((x) => x.schoolId === schoolId),
        survey_participation_receipts: this.cache.survey_participation_receipts.filter((x) => x.schoolId === schoolId),
        survey_anonymous_responses: this.cache.survey_anonymous_responses.filter((x) => x.schoolId === schoolId),
        td_courses: this.cache.td_courses.filter((x) => x.schoolId === schoolId),
        td_progress: this.cache.td_progress.filter((x) => x.schoolId === schoolId),
        td_certificates: this.cache.td_certificates.filter((x) => x.schoolId === schoolId),
        td_school_settings: this.cache.td_school_settings.filter((x) => x.schoolId === schoolId),
        educational_complexes: [],
        managed_admin_accounts: [],
        role_governance_configs: [],
        global_system_configs: [],
        super_admin_audit_logs: [],
        academic_years: [...this.cache.academic_years],
        mock_exams: this.cache.mock_exams.filter(
          (x) => x.schoolId === schoolId || x.scope === 'complex'
        ),
        mock_exam_attempts: this.cache.mock_exam_attempts.filter((x) => x.schoolId === schoolId),
        sida_appeal_windows: this.cache.sida_appeal_windows.filter((x) => x.schoolId === schoolId),
        sida_remedial_groups: this.cache.sida_remedial_groups.filter((x) => x.schoolId === schoolId),
        sida_class_balancing_drafts: this.cache.sida_class_balancing_drafts.filter(
          (x) => x.schoolId === schoolId
        ),
        sida_analytics_grades: this.cache.sida_analytics_grades.filter(
          (x) => x.schoolId === schoolId
        ),
        security_audit_logs: this.cache.security_audit_logs.filter(
          (x) => x.schoolId === schoolId
        ),
        smart_content_archive: this.cache.smart_content_archive.filter(
          (x) => x.schoolId === schoolId
        ),
        school_announcements: this.cache.school_announcements.filter(
          (x) => x.schoolId === schoolId
        ),
        student_transfer_logs: this.cache.student_transfer_logs.filter(
          (x) => x.schoolId === schoolId
        ),
        notification_read_receipts: this.cache.notification_read_receipts.filter(
          (x) => x.schoolId === schoolId
        ),
        recovery_snapshots: this.cache.recovery_snapshots.filter(
          (x) => x.schoolId === schoolId
        ),
        import_mapping_templates: this.cache.import_mapping_templates.filter(
          (x) => x.schoolId === schoolId
        ),
        discipline_records: this.cache.discipline_records.filter((x) => x.schoolId === schoolId),
        discipline_pledges: this.cache.discipline_pledges.filter((x) => x.schoolId === schoolId),
        student_exit_passes: this.cache.student_exit_passes.filter((x) => x.schoolId === schoolId),
        staff_leave_requests: this.cache.staff_leave_requests.filter((x) => x.schoolId === schoolId),
        counseling_sessions: this.cache.counseling_sessions.filter((x) => x.schoolId === schoolId),
        counseling_clinical_notes: this.cache.counseling_clinical_notes.filter(
          (x) => x.schoolId === schoolId
        ),
        virtual_class_sessions: this.cache.virtual_class_sessions.filter(
          (x) => x.schoolId === schoolId
        ),
        virtual_class_attendance: this.cache.virtual_class_attendance.filter(
          (x) => x.schoolId === schoolId
        ),
      },
    };
  }

  public async exportComplexBackup(): Promise<BackupPayload> {
    if (this.authContext) {
      const decision = authorizeBackupOperation(this.authContext, 'complex_wide');
      if (!decision.allowed) throw new Error(decision.reasonFa ?? 'عدم دسترسی پشتیبان‌گیری کل مجموعه.');
    }
    return {
      schemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      scope: 'complex_wide',
      data: {
        schools: [...this.cache.schools],
        classes: [...this.cache.classes],
        students: [...this.cache.students],
        teachers: [...this.cache.teachers],
        schedules: [...this.cache.schedules],
        student_attendance: [...this.cache.student_attendance],
        staff_attendance: [...this.cache.staff_attendance],
        substitutions: [...this.cache.substitutions],
        daily_logs: [...this.cache.daily_logs],
        school_plugin_states: [...this.cache.school_plugin_states],
        curriculum_topics: [...this.cache.curriculum_topics],
        media_resources: [...this.cache.media_resources],
        chat_outbox: [...this.cache.chat_outbox],
        gradebook_entries: [...this.cache.gradebook_entries],
        lesson_plans: [...this.cache.lesson_plans],
        gradebook_weights: [...this.cache.gradebook_weights],
        grade_appeals: [...this.cache.grade_appeals],
        homework_assignments: [...this.cache.homework_assignments],
        homework_submissions: [...this.cache.homework_submissions],
        student_rewards: [...this.cache.student_rewards],
        question_bank: [...this.cache.question_bank],
        class_chat_draft_queue: [...this.cache.class_chat_draft_queue],
        exam_question_basket: [...this.cache.exam_question_basket],
        flipped_lessons: [...this.cache.flipped_lessons],
        flipped_telemetry: [...this.cache.flipped_telemetry],
        flipped_questions: [...this.cache.flipped_questions],
        online_class_sessions: [...this.cache.online_class_sessions],
        online_class_attendance: [...this.cache.online_class_attendance],
        online_exams: [...this.cache.online_exams],
        online_exam_submissions: [...this.cache.online_exam_submissions],
        student_360_signals: [...this.cache.student_360_signals],
        parent_staff_messages: [...this.cache.parent_staff_messages],
        class_chat_rooms: [...this.cache.class_chat_rooms],
        class_chat_messages: [...this.cache.class_chat_messages],
        appointment_slots: [...this.cache.appointment_slots],
        electronic_forms: [...this.cache.electronic_forms],
        electronic_form_responses: [...this.cache.electronic_form_responses],
        notification_templates: [...this.cache.notification_templates],
        sida_grade_audit_logs: [...this.cache.sida_grade_audit_logs],
        in_person_exam_halls: [...this.cache.in_person_exam_halls],
        in_person_exam_sessions: [...this.cache.in_person_exam_sessions],
        exam_seating_charts: [...this.cache.exam_seating_charts],
        student_profiles: [...this.cache.student_profiles],
        staff_profiles: [...this.cache.staff_profiles],
        sida_speed_entry_ticks: [...this.cache.sida_speed_entry_ticks],
        user_appearance_prefs: [...this.cache.user_appearance_prefs],
        school_branding_configs: [...this.cache.school_branding_configs],
        finance_fee_plans: [...this.cache.finance_fee_plans],
        finance_student_ledgers: [...this.cache.finance_student_ledgers],
        finance_payments: [...this.cache.finance_payments],
        finance_expenses: [...this.cache.finance_expenses],
        remedial_plans: [...this.cache.remedial_plans],
        anonymous_surveys: [...this.cache.anonymous_surveys],
        survey_participation_receipts: [...this.cache.survey_participation_receipts],
        survey_anonymous_responses: [...this.cache.survey_anonymous_responses],
        td_courses: [...this.cache.td_courses],
        td_progress: [...this.cache.td_progress],
        td_certificates: [...this.cache.td_certificates],
        td_school_settings: [...this.cache.td_school_settings],
        educational_complexes: [...this.cache.educational_complexes],
        managed_admin_accounts: [...this.cache.managed_admin_accounts],
        role_governance_configs: [...this.cache.role_governance_configs],
        global_system_configs: [...this.cache.global_system_configs],
        super_admin_audit_logs: [...this.cache.super_admin_audit_logs],
        academic_years: [...this.cache.academic_years],
        mock_exams: [...this.cache.mock_exams],
        mock_exam_attempts: [...this.cache.mock_exam_attempts],
        sida_appeal_windows: [...this.cache.sida_appeal_windows],
        sida_remedial_groups: [...this.cache.sida_remedial_groups],
        sida_class_balancing_drafts: [...this.cache.sida_class_balancing_drafts],
        sida_analytics_grades: [...this.cache.sida_analytics_grades],
        security_audit_logs: [...this.cache.security_audit_logs],
        smart_content_archive: [...this.cache.smart_content_archive],
        school_announcements: [...this.cache.school_announcements],
        student_transfer_logs: [...this.cache.student_transfer_logs],
        notification_read_receipts: [...this.cache.notification_read_receipts],
        recovery_snapshots: [...this.cache.recovery_snapshots],
        import_mapping_templates: [...this.cache.import_mapping_templates],
        discipline_records: [...this.cache.discipline_records],
        discipline_pledges: [...this.cache.discipline_pledges],
        student_exit_passes: [...this.cache.student_exit_passes],
        staff_leave_requests: [...this.cache.staff_leave_requests],
        counseling_sessions: [...this.cache.counseling_sessions],
        counseling_clinical_notes: [...this.cache.counseling_clinical_notes],
        virtual_class_sessions: [...this.cache.virtual_class_sessions],
        virtual_class_attendance: [...this.cache.virtual_class_attendance],
      },
    };
  }

  public async restoreBackup(payload: BackupPayload): Promise<void> {
    if (this.authContext) {
      const decision = authorizeBackupOperation(this.authContext, payload.scope, payload.schoolId);
      if (!decision.allowed) throw new Error(decision.reasonFa ?? 'عدم دسترسی بازیابی پشتیبان.');
    }
    if (payload.scope === 'complex_wide') {
      this.cache = {
        schools: [...(payload.data.schools ?? [])],
        classes: [...(payload.data.classes ?? [])],
        students: [...(payload.data.students ?? [])],
        teachers: [...(payload.data.teachers ?? [])],
        schedules: [...(payload.data.schedules ?? [])],
        student_attendance: [...(payload.data.student_attendance ?? [])],
        staff_attendance: [...(payload.data.staff_attendance ?? [])],
        substitutions: [...(payload.data.substitutions ?? [])],
        daily_logs: [...(payload.data.daily_logs ?? [])],
        school_plugin_states: [...(payload.data.school_plugin_states ?? [])],
        curriculum_topics: [...(payload.data.curriculum_topics ?? [])],
        media_resources: [...(payload.data.media_resources ?? [])],
        chat_outbox: [...(payload.data.chat_outbox ?? [])],
        gradebook_entries: [...(payload.data.gradebook_entries ?? [])],
        lesson_plans: [...(payload.data.lesson_plans ?? [])],
        gradebook_weights: [...(payload.data.gradebook_weights ?? [])],
        grade_appeals: [...(payload.data.grade_appeals ?? [])],
        homework_assignments: [...(payload.data.homework_assignments ?? [])],
        homework_submissions: [...(payload.data.homework_submissions ?? [])],
        student_rewards: [...(payload.data.student_rewards ?? [])],
        question_bank: [...(payload.data.question_bank ?? [])],
        class_chat_draft_queue: [...(payload.data.class_chat_draft_queue ?? [])],
        exam_question_basket: [...(payload.data.exam_question_basket ?? [])],
        flipped_lessons: [...(payload.data.flipped_lessons ?? [])],
        flipped_telemetry: [...(payload.data.flipped_telemetry ?? [])],
        flipped_questions: [...(payload.data.flipped_questions ?? [])],
        online_class_sessions: [...(payload.data.online_class_sessions ?? [])],
        online_class_attendance: [...(payload.data.online_class_attendance ?? [])],
        online_exams: [...(payload.data.online_exams ?? [])],
        online_exam_submissions: [...(payload.data.online_exam_submissions ?? [])],
        student_360_signals: [...(payload.data.student_360_signals ?? [])],
        parent_staff_messages: [...(payload.data.parent_staff_messages ?? [])],
        class_chat_rooms: [...(payload.data.class_chat_rooms ?? [])],
        class_chat_messages: [...(payload.data.class_chat_messages ?? [])],
        appointment_slots: [...(payload.data.appointment_slots ?? [])],
        electronic_forms: [...(payload.data.electronic_forms ?? [])],
        electronic_form_responses: [...(payload.data.electronic_form_responses ?? [])],
        notification_templates: [...(payload.data.notification_templates ?? [])],
        sida_grade_audit_logs: [...(payload.data.sida_grade_audit_logs ?? [])],
        in_person_exam_halls: [...(payload.data.in_person_exam_halls ?? [])],
        in_person_exam_sessions: [...(payload.data.in_person_exam_sessions ?? [])],
        exam_seating_charts: [...(payload.data.exam_seating_charts ?? [])],
        student_profiles: [...(payload.data.student_profiles ?? [])],
        staff_profiles: [...(payload.data.staff_profiles ?? [])],
        sida_speed_entry_ticks: [...(payload.data.sida_speed_entry_ticks ?? [])],
        user_appearance_prefs: [...(payload.data.user_appearance_prefs ?? [])],
        school_branding_configs: [...(payload.data.school_branding_configs ?? [])],
        finance_fee_plans: [...(payload.data.finance_fee_plans ?? [])],
        finance_student_ledgers: [...(payload.data.finance_student_ledgers ?? [])],
        finance_payments: [...(payload.data.finance_payments ?? [])],
        finance_expenses: [...(payload.data.finance_expenses ?? [])],
        remedial_plans: [...(payload.data.remedial_plans ?? [])],
        anonymous_surveys: [...(payload.data.anonymous_surveys ?? [])],
        survey_participation_receipts: [...(payload.data.survey_participation_receipts ?? [])],
        survey_anonymous_responses: [...(payload.data.survey_anonymous_responses ?? [])],
        td_courses: [...(payload.data.td_courses ?? [])],
        td_progress: [...(payload.data.td_progress ?? [])],
        td_certificates: [...(payload.data.td_certificates ?? [])],
        td_school_settings: [...(payload.data.td_school_settings ?? [])],
        educational_complexes: [...(payload.data.educational_complexes ?? [])],
        managed_admin_accounts: [...(payload.data.managed_admin_accounts ?? [])],
        role_governance_configs: [...(payload.data.role_governance_configs ?? [])],
        global_system_configs: [...(payload.data.global_system_configs ?? [])],
        super_admin_audit_logs: [...(payload.data.super_admin_audit_logs ?? [])],
        academic_years: [...(payload.data.academic_years ?? [])],
        mock_exams: [...(payload.data.mock_exams ?? [])],
        mock_exam_attempts: [...(payload.data.mock_exam_attempts ?? [])],
        sida_appeal_windows: [...(payload.data.sida_appeal_windows ?? [])],
        sida_remedial_groups: [...(payload.data.sida_remedial_groups ?? [])],
        sida_class_balancing_drafts: [...(payload.data.sida_class_balancing_drafts ?? [])],
        sida_analytics_grades: [...(payload.data.sida_analytics_grades ?? [])],
        security_audit_logs: [...(payload.data.security_audit_logs ?? [])],
        smart_content_archive: [...(payload.data.smart_content_archive ?? [])],
        school_announcements: [...(payload.data.school_announcements ?? [])],
        student_transfer_logs: [...(payload.data.student_transfer_logs ?? [])],
        notification_read_receipts: [...(payload.data.notification_read_receipts ?? [])],
        recovery_snapshots: [...(payload.data.recovery_snapshots ?? [])],
        import_mapping_templates: [...(payload.data.import_mapping_templates ?? [])],
        discipline_records: [...(payload.data.discipline_records ?? [])],
        discipline_pledges: [...(payload.data.discipline_pledges ?? [])],
        student_exit_passes: [...(payload.data.student_exit_passes ?? [])],
        staff_leave_requests: [...(payload.data.staff_leave_requests ?? [])],
        counseling_sessions: [...(payload.data.counseling_sessions ?? [])],
        counseling_clinical_notes: [...(payload.data.counseling_clinical_notes ?? [])],
        virtual_class_sessions: [...(payload.data.virtual_class_sessions ?? [])],
        virtual_class_attendance: [...(payload.data.virtual_class_attendance ?? [])],
      };
      // Ensure restored pre-3.5 / pre-8A backups stay seamlessly upgraded
      this.cache.students = this.cache.students.map(ensureStudentDualCredentials);
      this.cache = hydrateMissingPhase2Collections(this.cache).dataset;
    } else if (payload.schoolId) {
      const targetSchoolId = payload.schoolId;
      for (const col of ALL_COLLECTIONS) {
        const existingOtherSchools = this.cache[col].filter(
          (item) => item.schoolId !== targetSchoolId
        );
        const incoming = payload.data[col] ?? [];
        (this.cache as unknown as Record<CollectionName, unknown[]>)[col] = [
          ...existingOtherSchools,
          ...incoming,
        ];
      }
    }

    writeLocalStorageSnapshot(this.cache);
    this.emitChange({ type: 'restore', schoolId: payload.schoolId });

    if (this.db) {
      try {
        for (const col of ALL_COLLECTIONS) {
          await withTimeout(this.clearAndWriteIdbStore(this.db, col, this.cache[col]), `restore_${col}`);
        }
      } catch {
        this.db = null;
        this.backendMode = 'localstorage';
      }
    }
  }

  private clearAndWriteIdbStore<K extends CollectionName>(
    db: IDBDatabase,
    storeName: K,
    items: CollectionTypeMap[K][]
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`IDB restore failed: ${storeName}`));
    });
  }

  public async resetToSeed(): Promise<void> {
    this.cache = generateSeedDataset();
    writeLocalStorageSnapshot(this.cache);
    this.emitChange({ type: 'reset' });
    if (this.db) {
      try {
        for (const col of ALL_COLLECTIONS) {
          await withTimeout(this.clearAndWriteIdbStore(this.db, col, this.cache[col]), `reset_${col}`);
        }
      } catch {
        this.db = null;
        this.backendMode = 'localstorage';
      }
    }
  }
}

export const sharedRepository = new LocalIndexedDBAdapter();
