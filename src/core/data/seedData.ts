// Deterministic, realistic Persian multi-school seed data for 3 isolated schools
import {
  addDaysToJalali,
  getNearestActiveWorkday,
  getPersianWeekdayFromJalali,
  getTodayJalali,
} from '../../lib/jalali';
import type {
  AppointmentSlot,
  ChatOutboxItem,
  ClassChatDraftItem,
  ClassChatMessage,
  ClassChatRoomConfig,
  ClassRoom,
  CurriculumTopic,
  DailyLogEntry,
  ElectronicForm,
  ElectronicFormResponse,
  ExamBasketItem,
  ExamSeatingChart,
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
  LessonPlanRecord,
  MediaResource,
  NotificationTemplate,
  OnlineClassAttendanceRecord,
  OnlineClassSession,
  OnlineExam,
  OnlineExamSubmission,
  ParentStaffMessage,
  PeriodNumber,
  PersianWeekdayIndex,
  QuestionBankItem,
  ScheduleSlot,
  School,
  SchoolBrandingConfig,
  SchoolPluginState,
  SidaGradeAuditLog,
  SidaSpeedEntryRecord,
  StaffAttendanceRecord,
  StaffElectronicProfile,
  Student,
  Student360Signal,
  StudentAttendanceRecord,
  StudentElectronicProfile,
  StudentReward,
  SubstitutionRecord,
  Teacher,
  AnonymousSurvey,
  FinanceExpenseRecord,
  FinanceFeePlan,
  FinancePaymentRecord,
  FinanceStudentLedger,
  RemedialPlanRecord,
  SurveyAnonymousResponse,
  SurveyParticipationReceipt,
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevProgress,
  TeacherDevSchoolSettings,
  UserAppearancePreference,
  AcademicYear,
  MockExam,
  MockExamAttempt,
  SidaAppealWindowConfig,
  SidaRemedialGroupRecord,
  SidaClassBalancingDraft,
  SidaAnalyticsGradeRecord,
  EducationalComplex,
  ManagedAdminAccount,
  RoleGovernanceConfig,
  GlobalSystemConfig,
  SuperAdminAuditEntry,
  SecurityAuditLogEntry,
  SmartContentArchiveItem,
  SchoolAnnouncement,
  StudentTransferLog,
  NotificationReadReceipt,
  RecoverySnapshotRecord,
  ImportMappingTemplate,
  DisciplineRecord,
  DisciplinePledge,
  StudentExitPass,
  StaffLeaveRequest,
  CounselingSession,
  CounselingClinicalNote,
  VirtualClassSession,
  VirtualClassAttendance,
} from '../../types/domain';
import { ensureStudentDualCredentials } from '../auth/authService';
import { DEFAULT_COMPLEX_ID, generatePhase8ASeedData } from '../super-admin/superAdminHelpers';
import { buildValidIranianNationalId } from '../validation/validators';
import { generatePhase2SeedData, PHASE2_PLUGIN_IDS } from './phase2SeedData';
import { generatePhase25SeedData, PHASE25_PLUGIN_IDS } from './phase25SeedData';
import { generatePhase3SeedData, PHASE3_PLUGIN_IDS } from './phase3SeedData';
import { generatePhase35SeedData, PHASE35_PLUGIN_IDS } from './phase35SeedData';
import { generatePhase4SeedData, PHASE4_PLUGIN_IDS } from './phase4SeedData';
import { generatePhase5SeedData, PHASE5_PLUGIN_IDS } from './phase5SeedData';
import { generatePhase6SeedData, PHASE6_PLUGIN_IDS } from './phase6SeedData';
import { generatePhase7SeedData, PHASE7_PLUGIN_IDS } from './phase7SeedData';
import { generatePhase9ASeedData, PHASE9A_PLUGIN_IDS } from '../../plugins/mock-exams/phase9ASeedData';
import {
  generatePhase9BSeedData,
  PHASE9B_PLUGIN_IDS,
} from '../../plugins/sida-analytics/phase9BSeedData';
import {
  generatePhase9CSeedData,
  PHASE9C_PLUGIN_IDS,
} from '../../services/phase9c/phase9cSeedData';

export interface SeedDataset {
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
  question_bank: QuestionBankItem[];
  class_chat_draft_queue: ClassChatDraftItem[];
  exam_question_basket: ExamBasketItem[];
  flipped_lessons: FlippedVideoLesson[];
  flipped_telemetry: FlippedVideoTelemetry[];
  flipped_questions: FlippedTimestampQuestion[];
  online_class_sessions: OnlineClassSession[];
  online_class_attendance: OnlineClassAttendanceRecord[];
  online_exams: OnlineExam[];
  online_exam_submissions: OnlineExamSubmission[];
  student_360_signals: Student360Signal[];
  parent_staff_messages: ParentStaffMessage[];
  class_chat_rooms: ClassChatRoomConfig[];
  class_chat_messages: ClassChatMessage[];
  appointment_slots: AppointmentSlot[];
  electronic_forms: ElectronicForm[];
  electronic_form_responses: ElectronicFormResponse[];
  notification_templates: NotificationTemplate[];
  sida_grade_audit_logs: SidaGradeAuditLog[];
  in_person_exam_halls: InPersonExamHall[];
  in_person_exam_sessions: InPersonExamSession[];
  exam_seating_charts: ExamSeatingChart[];
  student_profiles: StudentElectronicProfile[];
  staff_profiles: StaffElectronicProfile[];
  sida_speed_entry_ticks: SidaSpeedEntryRecord[];
  user_appearance_prefs: UserAppearancePreference[];
  school_branding_configs: SchoolBrandingConfig[];
  finance_fee_plans: FinanceFeePlan[];
  finance_student_ledgers: FinanceStudentLedger[];
  finance_payments: FinancePaymentRecord[];
  finance_expenses: FinanceExpenseRecord[];
  remedial_plans: RemedialPlanRecord[];
  anonymous_surveys: AnonymousSurvey[];
  survey_participation_receipts: SurveyParticipationReceipt[];
  survey_anonymous_responses: SurveyAnonymousResponse[];
  td_courses: TeacherDevCourse[];
  td_progress: TeacherDevProgress[];
  td_certificates: TeacherDevCertificate[];
  td_school_settings: TeacherDevSchoolSettings[];
  educational_complexes: EducationalComplex[];
  managed_admin_accounts: ManagedAdminAccount[];
  role_governance_configs: RoleGovernanceConfig[];
  global_system_configs: GlobalSystemConfig[];
  super_admin_audit_logs: SuperAdminAuditEntry[];
  academic_years: AcademicYear[];
  mock_exams: MockExam[];
  mock_exam_attempts: MockExamAttempt[];
  sida_appeal_windows: SidaAppealWindowConfig[];
  sida_remedial_groups: SidaRemedialGroupRecord[];
  sida_class_balancing_drafts: SidaClassBalancingDraft[];
  sida_analytics_grades: SidaAnalyticsGradeRecord[];
  security_audit_logs: SecurityAuditLogEntry[];
  smart_content_archive: SmartContentArchiveItem[];
  school_announcements: SchoolAnnouncement[];
  student_transfer_logs: StudentTransferLog[];
  notification_read_receipts: NotificationReadReceipt[];
  recovery_snapshots: RecoverySnapshotRecord[];
  import_mapping_templates: ImportMappingTemplate[];
  discipline_records: DisciplineRecord[];
  discipline_pledges: DisciplinePledge[];
  student_exit_passes: StudentExitPass[];
  staff_leave_requests: StaffLeaveRequest[];
  counseling_sessions: CounselingSession[];
  counseling_clinical_notes: CounselingClinicalNote[];
  virtual_class_sessions: VirtualClassSession[];
  virtual_class_attendance: VirtualClassAttendance[];
}

export const PHASE55_PLUGIN_IDS = [] as const;

const DEFAULT_WORKDAYS: PersianWeekdayIndex[] = [3, 4, 5, 6]; // سه‌شنبه، چهارشنبه، پنج‌شنبه و جمعه

export const DEFAULT_ENABLED_PLUGIN_IDS = [
  'student-attendance',
  'staff-attendance',
  'substitution',
  'daily-log',
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
] as const;

const SUBJECTS_BY_PERIOD: Record<PeriodNumber, string[]> = {
  1: ['فارسی و نگارش', 'ریاضی', 'قرآن و هدیه‌ها', 'علوم تجربی', 'ریاضی'],
  2: ['ریاضی', 'علوم تجربی', 'فارسی و نگارش', 'مطالعات اجتماعی', 'فارسی و نگارش'],
  3: ['علوم تجربی', 'فارسی و نگارش', 'ریاضی', 'قرآن و هدیه‌ها', 'علوم تجربی'],
  4: ['تربیت بدنی و هنر', 'مطالعات اجتماعی', 'کار و فناوری', 'فارسی و نگارش', 'مطالعات اجتماعی'],
};

const SCHOOL_BLUEPRINTS = [
  {
    id: 'school-1',
    name: 'دبستان گلستان راه روشن',
    subtitle: 'دوره ابتدایی (اول و دوم) · مجموعه مدارس گلستان راه روشن',
    gradeLevel: 'elementary' as const,
    accent: 'indigo' as const,
    principalName: 'دکتر محمدرضا کریمی',
    phone: '02188451201',
    address: 'تهران، خیابان شریعتی، کوچه دانش، پلاک ۱۲',
    letterheadTitle: 'سامانه هوشمند مدارس گلستان راه روشن — دبستان گلستان راه روشن',
    letterheadSubtitle: 'نظام یکپارچه مدیریت آموزشی، پرورشی و ارزیابی مستمر',
    signatureFooter: 'تایید معلم مربوطه | تایید معاون اجرایی | مهر و امضای مدیریت دبستان گلستان راه روشن',
    teachers: [
      { name: 'استاد علی اکبری', specialty: 'آموزگار پایه دوم', mobile: '09121011101' },
      { name: 'استاد حسین رضایی', specialty: 'آموزگار پایه سوم', mobile: '09121011102' },
      { name: 'استاد مهدی موسوی', specialty: 'دبیر ریاضی و علوم', mobile: '09121011103' },
      { name: 'استاد سعید جلالی', specialty: 'آموزگار پایه پنجم', mobile: '09121011104' },
      { name: 'استاد فرهاد نادری', specialty: 'آموزگار پایه ششم', mobile: '09121011105' },
      { name: 'استاد کامران بهرامی', specialty: 'معلم تربیت بدنی و جایگزین', mobile: '09121011106' },
      { name: 'استاد پویا شریفی', specialty: 'دبیر ادبیات و پژوهش', mobile: '09121011107' },
    ],
    studentFirstNames: ['امیرعلی', 'آراد', 'کیان', 'پارسا', 'رادین', 'سامیار', 'طاها', 'آریا', 'ماهان', 'ایلیا', 'سبحان', 'بنیامین', 'سپهر', 'دانیال', 'آرتین', 'عرفان', 'متین', 'یاسین', 'نیما', 'مهدیار', 'شایان', 'سروش', 'پدرام', 'مانی', 'کسری'],
    studentLastNames: ['احمدی', 'محمدی', 'حسینی', 'رضایی', 'مرادی', 'کریمی', 'صادقی', 'جعفری', 'قاسمی', 'طاهری', 'نجفی', 'باقری', 'اکبری', 'زارعی', 'فرهادی'],
    parentFirstNames: ['رضا', 'حسین', 'مهدی', 'جواد', 'مجید', 'حمید', 'ناصر', 'بهرام', 'محسن', 'کاظم'],
  },
  {
    id: 'school-2',
    name: 'متوسطه اول گلستان راه روشن',
    subtitle: 'دوره اول متوسطه · مجموعه مدارس گلستان راه روشن',
    gradeLevel: 'middle' as const,
    accent: 'emerald' as const,
    principalName: 'سرکار خانم زهرا محمودی',
    phone: '02188451202',
    address: 'تهران، بلوار کشاورز، خیابان خردمند، پلاک ۲۸',
    letterheadTitle: 'سامانه هوشمند مدارس گلستان راه روشن — متوسطه اول گلستان راه روشن',
    letterheadSubtitle: 'واحد آموزش نوین و ارزیابی مستمر تحصیلی',
    signatureFooter: 'تایید دبیر مربوطه | تایید معاون آموزشی | مهر و امضای مدیریت متوسطه اول گلستان راه روشن',
    teachers: [
      { name: 'خانم مریم تهرانی', specialty: 'دبیر ریاضی و هندسه', mobile: '09122022201' },
      { name: 'خانم فاطمه نوری', specialty: 'دبیر علوم تجربی', mobile: '09122022202' },
      { name: 'خانم سارا امینی', specialty: 'دبیر کار و فناوری', mobile: '09122022203' },
      { name: 'خانم نرگس عباسی', specialty: 'دبیر مطالعات اجتماعی', mobile: '09122022204' },
      { name: 'خانم الهام صفری', specialty: 'دبیر زبان انگلیسی', mobile: '09122022205' },
      { name: 'خانم هانیه کاظمی', specialty: 'مربی هنر و جایگزین', mobile: '09122022206' },
      { name: 'خانم لیلا فرخی', specialty: 'دبیر فارسی و نگارش', mobile: '09122022207' },
    ],
    studentFirstNames: ['زهرا', 'فاطمه', 'آوا', 'باران', 'ستایش', 'نیلوفر', 'الینا', 'دیانا', 'هستی', 'سارینا', 'رها', 'یاسمن', 'ملیکا', 'آیناز', 'پرنیا', 'نیایش', 'مبینا', 'درسا', 'سوگند', 'مهسا', 'نازنین', 'آتنا', 'ترنم', 'ثنا', 'غزل'],
    studentLastNames: ['کاظمی', 'موسوی', 'امینی', 'شریفی', 'رستمی', 'سلیمانی', 'عباسی', 'نوری', 'رشیدی', 'یزدانی', 'هاشمی', 'منصوری', 'حیدری', 'اسدی', 'پناهی'],
    parentFirstNames: ['مریم', 'سمیه', 'زهره', 'لیلا', 'معصومه', 'اکرم', 'الهام', 'فرشته', 'آزاده', 'پریسا'],
  },
  {
    id: 'school-3',
    name: 'متوسطه دوم گلستان راه روشن',
    subtitle: 'دوره دوم متوسطه و پژوهش · مجموعه مدارس گلستان راه روشن',
    gradeLevel: 'high' as const,
    accent: 'violet' as const,
    principalName: 'جناب آقای مهندس بهزاد سلطانی',
    phone: '02188451203',
    address: 'تهران، سعادت‌آباد، بلوار سرو شرقی، پلاک ۴۵',
    letterheadTitle: 'سامانه هوشمند مدارس گلستان راه روشن — متوسطه دوم گلستان راه روشن',
    letterheadSubtitle: 'مرکز نوآوری آموزشی، پژوهش و آمادگی آزمون‌های سراسری',
    signatureFooter: 'تایید دبیر مربوطه | تایید معاون پرورشی | مهر و امضای مدیریت متوسطه دوم گلستان راه روشن',
    teachers: [
      { name: 'استاد آرش پارسایی', specialty: 'آموزگار پایه دوم', mobile: '09123033301' },
      { name: 'استاد ایمان شمس', specialty: 'آموزگار پایه سوم', mobile: '09123033302' },
      { name: 'خانم نسترن راد', specialty: 'دبیر علوم و پژوهش', mobile: '09123033303' },
      { name: 'استاد سینا وفایی', specialty: 'آموزگار پایه پنجم', mobile: '09123033304' },
      { name: 'خانم شبنم کیانی', specialty: 'آموزگار پایه ششم', mobile: '09123033305' },
      { name: 'استاد بهنام درویشی', specialty: 'مربی مهارت و جایگزین', mobile: '09123033306' },
      { name: 'خانم سحر یوسفی', specialty: 'دبیر ریاضیات', mobile: '09123033307' },
    ],
    studentFirstNames: ['آرشام', 'برسام', 'روشا', 'آترینا', 'کارن', 'ویهان', 'مهراد', 'آنیسا', 'پندار', 'تارا', 'رایان', 'نورا', 'سامین', 'هیربد', 'لیانا', 'رادمان', 'آیلین', 'سپنتا', 'دلارام', 'آرمان', 'سلین', 'نویان', 'روژان', 'شهراد', 'پانیذ'],
    studentLastNames: ['سلطانی', 'پارسا', 'شمس', 'وفایی', 'کیانی', 'رادمنش', 'تقی‌زاده', 'میری', 'بهشتی', 'دانش', 'صفایی', 'یزدی', 'تبریزی', 'شیرازی', 'اصفهانی'],
    parentFirstNames: ['بهروز', 'شهرام', 'سارا', 'ندا', 'فرهاد', 'پیمان', 'نگار', 'مینا', 'داریوش', 'سیامک'],
  },
];

const GRADE_LABELS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: 'پایه دوم',
  3: 'پایه سوم',
  4: 'پایه چهارم',
  5: 'پایه پنجم',
  6: 'پایه ششم',
};

export function generateSeedDataset(anchorTodayJalali?: string): SeedDataset {
  const nowIso = new Date().toISOString();
  const today = anchorTodayJalali ?? getTodayJalali();
  const activeDay = getNearestActiveWorkday(today, DEFAULT_WORKDAYS);
  const prevWorkday = getNearestActiveWorkday(addDaysToJalali(activeDay, -1), DEFAULT_WORKDAYS);
  const twoDaysAgoWorkday = getNearestActiveWorkday(addDaysToJalali(prevWorkday, -1), DEFAULT_WORKDAYS);
  const activeWeekday = getPersianWeekdayFromJalali(activeDay);

  const schools: School[] = [];
  const classes: ClassRoom[] = [];
  const students: Student[] = [];
  const teachers: Teacher[] = [];
  const schedules: ScheduleSlot[] = [];
  const student_attendance: StudentAttendanceRecord[] = [];
  const staff_attendance: StaffAttendanceRecord[] = [];
  const substitutions: SubstitutionRecord[] = [];
  const daily_logs: DailyLogEntry[] = [];
  const school_plugin_states: SchoolPluginState[] = [];

  SCHOOL_BLUEPRINTS.forEach((bp, schoolIdx) => {
    const schoolId = bp.id;
    schools.push({
      id: schoolId,
      schoolId,
      complexId: DEFAULT_COMPLEX_ID,
      gradeLevel: 'elementary',
      isActive: true,
      name: bp.name,
      subtitle: bp.subtitle,
      accent: bp.accent,
      principalName: bp.principalName,
      phone: bp.phone,
      address: bp.address,
      academicYear: '1405-1406',
      activeWorkdays: [...DEFAULT_WORKDAYS],
      holidays: [],
      letterheadTitle: bp.letterheadTitle,
      letterheadSubtitle: bp.letterheadSubtitle,
      signatureFooter: bp.signatureFooter,
      periodDurationMinutes: 75,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Seed plugin states (all 4 Phase 1 + 6 Phase 2 add-ons installed & enabled by default per school)
    for (const pluginId of DEFAULT_ENABLED_PLUGIN_IDS) {
      school_plugin_states.push({
        id: `${schoolId}:${pluginId}`,
        schoolId,
        pluginId,
        installed: true,
        enabled: true,
        updatedAt: nowIso,
        updatedBy: 'سیستم (راه‌اندازی اولیه)',
      });
    }

    // Seed 5 classes (grades 2..6)
    const schoolClasses: ClassRoom[] = [];
    const grades: Array<2 | 3 | 4 | 5 | 6> = [2, 3, 4, 5, 6];
    const schoolTeachers: Teacher[] = [];

    bp.teachers.forEach((t, tIdx) => {
      const teacherId = `${schoolId}-t-${tIdx + 1}`;
      const assignedClassIds = tIdx < 5 ? [`${schoolId}-c-${tIdx + 1}`] : [`${schoolId}-c-1`, `${schoolId}-c-2`];
      const teacher: Teacher = {
        id: teacherId,
        schoolId,
        fullName: t.name,
        nationalId: buildValidIranianNationalId(`00${schoolIdx + 1}4050${String(tIdx + 1).padStart(2, '0')}`),
        personnelCode: `${(schoolIdx + 1) * 1000 + tIdx + 11}`,
        mobile: t.mobile,
        specialty: t.specialty,
        assignedClassIds,
        weeklyQuotaPeriods: tIdx < 5 ? 16 : 8,
        active: true,
      };
      teachers.push(teacher);
      schoolTeachers.push(teacher);
    });

    grades.forEach((grade, cIdx) => {
      const classId = `${schoolId}-c-${cIdx + 1}`;
      const cls: ClassRoom = {
        id: classId,
        schoolId,
        name: `${GRADE_LABELS[grade]} - کلاس الف`,
        gradeLevel: grade,
        section: 'الف',
        homeroomTeacherId: schoolTeachers[cIdx].id,
        capacity: 24,
        roomCode: `${(schoolIdx + 1) * 100 + grade}`,
      };
      classes.push(cls);
      schoolClasses.push(cls);
    });

    // Seed 25 students per school (5 per class) with valid Iranian National IDs
    const schoolStudents: Student[] = [];
    for (let sIdx = 0; sIdx < 25; sIdx++) {
      const classIdx = Math.floor(sIdx / 5);
      const cls = schoolClasses[classIdx];
      const firstName = bp.studentFirstNames[sIdx % bp.studentFirstNames.length];
      const lastName = bp.studentLastNames[(sIdx * 3 + schoolIdx) % bp.studentLastNames.length];
      const parentFirst = bp.parentFirstNames[sIdx % bp.parentFirstNames.length];
      const studentId = `${schoolId}-s-${sIdx + 1}`;
      const student: Student = ensureStudentDualCredentials({
        id: studentId,
        schoolId,
        classId: cls.id,
        fullName: `${firstName} ${lastName}`,
        nationalId: buildValidIranianNationalId(
          `${schoolIdx + 1}28${String(classIdx + 2)}${String(sIdx + 10).padStart(5, '0')}`
        ),
        studentCode: `${(schoolIdx + 1) * 10000 + 4050 + sIdx + 1}`,
        parentName: `${parentFirst} ${lastName}`,
        parentMobile: `0912${schoolIdx + 1}${String(300000 + sIdx * 137).slice(0, 6)}`,
        active: true,
      });
      students.push(student);
      schoolStudents.push(student);
    }

    // Seed 4-period weekly schedules for active workdays (leaving teachers[5] & teachers[6] partially free for substitution!)
    for (const wd of DEFAULT_WORKDAYS) {
      for (let p = 1; p <= 4; p++) {
        const period = p as PeriodNumber;
        schoolClasses.forEach((cls, cIdx) => {
          // Rotate homeroom teachers cleanly so teachers[5] and teachers[6] are free during periods 1-2
          const teacherIdx = p === 4 && cIdx === 0 ? 5 : cIdx;
          schedules.push({
            id: `${schoolId}:sched:${wd}:${period}:${cls.id}`,
            schoolId,
            weekday: wd,
            period,
            classId: cls.id,
            teacherId: schoolTeachers[teacherIdx].id,
            subjectName: SUBJECTS_BY_PERIOD[period][cIdx] ?? 'فارسی و نگارش',
          });
        });
      }
    }

    // Seed realistic student attendance for activeDay and prevWorkday (including a 2-day consecutive absence for alert engine)
    const absentStudentA = schoolStudents[1]; // Class 1, student 2 (consecutive absence)
    const lateStudentB = schoolStudents[2]; // Class 1, student 3
    const excusedStudentC = schoolStudents[6]; // Class 2, student 2
    const absentStudentD = schoolStudents[11 + schoolIdx]; // Different class per school

    const seededStudentStatuses: Array<{
      date: string;
      student: Student;
      period: PeriodNumber;
      status: StudentAttendanceRecord['status'];
      note?: string;
    }> = [
      { date: twoDaysAgoWorkday, student: absentStudentA, period: 1, status: 'absent', note: 'سرماخوردگی' },
      { date: prevWorkday, student: absentStudentA, period: 1, status: 'absent', note: 'عدم حضور روز دوم' },
      { date: activeDay, student: absentStudentA, period: 1, status: 'absent', note: 'تماس با ولی جهت پیگیری' },
      { date: activeDay, student: lateStudentB, period: 1, status: 'late', note: 'ترافیک مسیر سرویس (۱۵ دقیقه)' },
      { date: activeDay, student: excusedStudentC, period: 1, status: 'excused', note: 'گواهی پزشکی ارائه شد' },
      { date: activeDay, student: absentStudentD, period: 1, status: 'absent', note: 'اطلاع‌رسانی به ولی' },
      // Extra period records for rich attendance analytics
      { date: activeDay, student: absentStudentA, period: 2, status: 'absent', note: 'غیبت مستمر' },
      { date: prevWorkday, student: lateStudentB, period: 2, status: 'late', note: 'تاخیر پس از زنگ تفریح' },
    ];

    for (const item of seededStudentStatuses) {
      student_attendance.push({
        id: `${schoolId}:${item.date}:${item.student.classId}:${item.period}:${item.student.id}`,
        schoolId,
        jalaliDate: item.date,
        classId: item.student.classId,
        period: item.period,
        studentId: item.student.id,
        status: item.status,
        note: item.note,
        recordedBy: 'deputy',
        updatedAt: nowIso,
      });
    }

    // Seed 4-period staff attendance for activeDay and prevWorkday
    const datesToSeedStaff = [prevWorkday, activeDay];
    for (const d of datesToSeedStaff) {
      const wd = getPersianWeekdayFromJalali(d);
      for (const teacher of schoolTeachers) {
        for (let p = 1; p <= 4; p++) {
          const period = p as PeriodNumber;
          let status: StaffAttendanceRecord['status'] = 'present';
          let note: string | undefined;

          // Make teacher[1] absent in period 1 & 2 on activeDay (triggers Smart Substitute Finder!)
          if (d === activeDay && teacher.id === schoolTeachers[1].id && (period === 1 || period === 2)) {
            status = 'absent';
            note = 'مرخصی استعلاجی اعلام‌شده';
          }
          // Make teacher[3] late in period 1 on activeDay (also triggers Substitute Finder!)
          if (d === activeDay && teacher.id === schoolTeachers[3].id && period === 1) {
            status = 'late';
            note = 'تاخیر ۲۰ دقیقه‌ای — نیاز به پوشش ابتدای زنگ';
          }
          // Vary school-2 & school-3 slightly for authentic comparison
          if (schoolIdx === 1 && d === activeDay && teacher.id === schoolTeachers[2].id && period === 3) {
            status = 'absent';
            note = 'ماموریت اداری آموزش و پرورش';
          }

          staff_attendance.push({
            id: `${schoolId}:${d}:${period}:${teacher.id}`,
            schoolId,
            jalaliDate: d,
            weekday: wd,
            period,
            teacherId: teacher.id,
            status,
            note,
            recordedBy: 'deputy',
            updatedAt: nowIso,
          });
        }
      }
    }

    // Pre-assign 1 substitution for period 2 so users see both "assigned" and "unassigned needing cover" states
    substitutions.push({
      id: `${schoolId}:${activeDay}:2:${schoolTeachers[1].id}`,
      schoolId,
      jalaliDate: activeDay,
      weekday: activeWeekday,
      period: 2,
      classId: schoolClasses[1].id,
      subjectName: SUBJECTS_BY_PERIOD[2][1],
      absentTeacherId: schoolTeachers[1].id,
      substituteTeacherId: schoolTeachers[5].id,
      reason: 'absent',
      note: 'تخصیص خودکار از برنامه همکاران آزاد',
      assignedBy: 'deputy',
      assignedAt: nowIso,
    });

    // Seed Daily Logs & Early Dismissals (4 realistic entries per school)
    daily_logs.push(
      {
        id: `${schoolId}-log-1`,
        schoolId,
        jalaliDate: activeDay,
        category: 'early_dismissal',
        title: `خروج زودهنگام ${schoolStudents[3].fullName}`,
        description: 'خروج با هماهنگی قبلی ولی برای مراجعه به دندان‌پزشکی و ثبت امضا در دفتر مدرسه.',
        studentId: schoolStudents[3].id,
        classId: schoolStudents[3].classId,
        pickupPersonName: schoolStudents[3].parentName,
        pickupRelation: schoolIdx === 1 ? 'مادر' : 'پدر',
        exitTime: '10:45',
        severity: 'normal',
        recordedBy: 'deputy',
        createdAt: nowIso,
      },
      {
        id: `${schoolId}-log-2`,
        schoolId,
        jalaliDate: activeDay,
        category: 'health',
        title: `مراجعه به اتاق بهداشت — ${schoolStudents[8].fullName}`,
        description: 'سردرد خفیف در زنگ دوم؛ پس از استراحت ۱۵ دقیقه‌ای و نوشیدن آب، با وضعیت مناسب به کلاس بازگشت.',
        studentId: schoolStudents[8].id,
        classId: schoolStudents[8].classId,
        severity: 'attention',
        recordedBy: 'deputy',
        createdAt: nowIso,
      },
      {
        id: `${schoolId}-log-3`,
        schoolId,
        jalaliDate: prevWorkday,
        category: 'administrative',
        title: 'بازدید دوره‌ای ایمنی و تجهیزات کلاس‌ها',
        description: 'تجهیزات هوشمند و سیستم گرمایشی تمامی کلاس‌های پایه دوم تا ششم بررسی و تایید شد.',
        severity: 'normal',
        recordedBy: 'principal',
        createdAt: nowIso,
      },
      {
        id: `${schoolId}-log-4`,
        schoolId,
        jalaliDate: prevWorkday,
        category: 'disciplinary',
        title: `تذکر انضباطی و گفت‌وگوی مشاوره‌ای — ${schoolStudents[14].fullName}`,
        description: 'رعایت نظم در صف صبحگاهی و تعامل محترمانه در زنگ تفریح با دانش‌آموز مرور شد.',
        studentId: schoolStudents[14].id,
        classId: schoolStudents[14].classId,
        severity: 'attention',
        recordedBy: 'deputy',
        createdAt: nowIso,
      }
    );
  });

  const phase2 = generatePhase2SeedData({
    schools,
    classes,
    students,
    teachers,
    activeDayJalali: activeDay,
  });

  const phase25 = generatePhase25SeedData({
    schools,
    classes,
    teachers,
    activeDayJalali: activeDay,
  });

  const phase3 = generatePhase3SeedData({
    schools,
    classes,
    students,
    teachers,
    activeDayJalali: activeDay,
  });

  const phase35 = generatePhase35SeedData({
    schools,
    classes,
    students,
    teachers,
  });

  const phase4 = generatePhase4SeedData({
    schools,
    classes,
    students,
    teachers,
  });

  const phase5 = generatePhase5SeedData({
    schools,
    classes,
    students,
    teachers,
    gradebookEntries: phase2.gradebook_entries,
    existingGradeAppeals: phase2.grade_appeals,
  });

  const phase6 = generatePhase6SeedData({
    schools,
    classes,
    students,
    teachers,
  });

  const phase7 = generatePhase7SeedData({
    schools,
    teachers,
    anchorTodayJalali: today,
  });

  const phase8A = generatePhase8ASeedData({
    schools,
  });

  const phase9A = generatePhase9ASeedData({
    schools,
    classes,
    students,
  });

  const phase9B = generatePhase9BSeedData({
    schools,
    classes,
    students,
  });

  const phase9C = generatePhase9CSeedData({
    schools,
    classes,
    students,
    teachers,
    todayJalali: today,
  });

  return {
    schools,
    classes,
    students,
    teachers,
    schedules,
    student_attendance,
    staff_attendance,
    substitutions,
    daily_logs,
    school_plugin_states,
    ...phase2,
    grade_appeals: [...phase5.extra_grade_appeals, ...phase2.grade_appeals],
    homework_assignments: [
      ...phase25.extra_homework_assignments,
      ...phase2.homework_assignments,
    ],
    question_bank: phase25.question_bank,
    class_chat_draft_queue: phase25.class_chat_draft_queue,
    exam_question_basket: phase25.exam_question_basket,
    ...phase3,
    ...phase35,
    ...phase4,
    sida_grade_audit_logs: phase5.sida_grade_audit_logs,
    in_person_exam_halls: phase5.in_person_exam_halls,
    in_person_exam_sessions: phase5.in_person_exam_sessions,
    exam_seating_charts: phase5.exam_seating_charts,
    student_profiles: phase5.student_profiles,
    staff_profiles: phase5.staff_profiles,
    sida_speed_entry_ticks: [],
    user_appearance_prefs: [],
    school_branding_configs: [],
    ...phase6,
    ...phase7,
    ...phase8A,
    ...phase9A,
    ...phase9B,
    ...phase9C,
    security_audit_logs: [],
    smart_content_archive: generateStep3InitialArchive({
      schools,
      classes,
      teachers,
      flippedLessons: phase3.flipped_lessons,
      mediaResources: phase2.media_resources,
      questionBank: phase25.question_bank,
      todayJalali: today,
    }),
    school_announcements: generateStep3InitialAnnouncements({
      schools,
      classes,
      todayJalali: today,
    }),
    student_transfer_logs: [],
    notification_read_receipts: [],
    recovery_snapshots: [],
    import_mapping_templates: [],
  };
}

export function generateStep3InitialArchive(params: {
  schools: School[];
  classes: ClassRoom[];
  teachers: Teacher[];
  flippedLessons: FlippedVideoLesson[];
  mediaResources: MediaResource[];
  questionBank: QuestionBankItem[];
  todayJalali: string;
}): SmartContentArchiveItem[] {
  const nowIso = new Date().toISOString();
  const schoolMap = new Map(params.schools.map((s) => [s.id, s]));
  const classMap = new Map(params.classes.map((c) => [c.id, c]));
  const items: SmartContentArchiveItem[] = [];

  for (const lesson of params.flippedLessons) {
    const cls = classMap.get(lesson.classId);
    const school = schoolMap.get(lesson.schoolId);
    const gradeNum = cls?.gradeLevel ?? 3;
    items.push({
      id: `arch-fv-${lesson.id}`,
      complexId: school?.complexId ?? DEFAULT_COMPLEX_ID,
      schoolId: lesson.schoolId,
      academicYearId: school?.academicYear ?? '1404-1405',
      createdAtIso: lesson.createdAt || nowIso,
      updatedAtIso: lesson.updatedAt || nowIso,
      createdByUserId: 'system-seed',
      title: lesson.title,
      contentType: 'video',
      subject: lesson.subject,
      gradeLevel: gradeNum,
      gradeLabel: cls?.customGradeLabel ?? `پایه ${gradeNum}`,
      teacherId: lesson.teacherId,
      teacherName: lesson.teacherName,
      description: lesson.description ?? 'ویدیوی آموزشی کلاس وارونه با آزمونک کوتاه',
      tags: [lesson.subject, 'ویدیو آموزشی', 'کلاس وارونه'],
      sourceClassId: lesson.classId,
      sourceEntityId: lesson.id,
      reuseCount: 0,
      reusedInClassIds: [],
      createdAtJalali: lesson.createdAtJalali || params.todayJalali,
    });
  }

  for (const media of params.mediaResources) {
    const school = schoolMap.get(media.schoolId);
    items.push({
      id: `arch-md-${media.id}`,
      complexId: school?.complexId ?? DEFAULT_COMPLEX_ID,
      schoolId: media.schoolId,
      academicYearId: school?.academicYear ?? '1404-1405',
      createdAtIso: media.createdAt || nowIso,
      updatedAtIso: media.createdAt || nowIso,
      createdByUserId: 'system-seed',
      title: media.title,
      contentType: 'handout',
      subject: media.subject,
      gradeLevel: media.gradeLevel,
      gradeLabel: `پایه ${media.gradeLevel}`,
      teacherId: 'staff',
      teacherName: media.uploadedByName,
      description: media.description,
      url: media.url,
      attachmentName: media.fileName,
      tags: [media.subject, 'جزوه و محتوا', media.kind],
      sourceEntityId: media.id,
      reuseCount: 0,
      reusedInClassIds: [],
      createdAtJalali: media.createdAtJalali || params.todayJalali,
    });
  }

  for (const q of params.questionBank.slice(0, 8)) {
    const school = schoolMap.get(q.schoolId);
    items.push({
      id: `arch-qb-${q.id}`,
      complexId: school?.complexId ?? DEFAULT_COMPLEX_ID,
      schoolId: q.schoolId,
      academicYearId: school?.academicYear ?? '1404-1405',
      createdAtIso: q.createdAt || nowIso,
      updatedAtIso: q.updatedAt || nowIso,
      createdByUserId: 'system-seed',
      title: `${q.subject} — ${q.chapter}`,
      contentType: 'question',
      subject: q.subject,
      gradeLevel: q.gradeLevel,
      gradeLabel: q.gradeLabel,
      teacherId: q.createdById,
      teacherName: q.createdByName,
      description: q.questionText,
      tags: [q.subject, q.chapter, 'سوال امتحانی'],
      sourceEntityId: q.id,
      reuseCount: 0,
      reusedInClassIds: [],
      createdAtJalali: q.createdAtJalali || params.todayJalali,
    });
  }

  return items;
}

export function generateStep3InitialAnnouncements(params: {
  schools: School[];
  classes: ClassRoom[];
  todayJalali: string;
}): SchoolAnnouncement[] {
  const nowIso = new Date().toISOString();
  const list: SchoolAnnouncement[] = [];
  for (const school of params.schools) {
    list.push({
      id: `ann-welcome-${school.id}`,
      complexId: school.complexId ?? DEFAULT_COMPLEX_ID,
      schoolId: school.id,
      academicYearId: school.academicYear || '1404-1405',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      createdByUserId: 'system-seed',
      title: `اطلاعیه آغاز نیمسال جدید — ${school.name}`,
      body: 'دانش‌آموزان و اولیای گرامی؛ برنامه هفتگی، تکالیف، ویدیوهای آموزشی و اطلاعیه‌های هر درس از بخش «دروس من» به‌صورت یکپارچه قابل پیگیری است.',
      scope: 'school',
      audienceRoles: ['teacher', 'parent', 'student', 'deputy', 'principal'],
      pinned: true,
      authorName: school.principalName,
      authorRole: 'principal',
      publishedAtJalali: params.todayJalali,
    });
    const firstClass = params.classes.find((c) => c.schoolId === school.id);
    if (firstClass) {
      list.push({
        id: `ann-math-${school.id}`,
        complexId: school.complexId ?? DEFAULT_COMPLEX_ID,
        schoolId: school.id,
        academicYearId: school.academicYear || '1404-1405',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        createdByUserId: 'system-seed',
        title: 'یادآوری تمرین و مرور فصل درس ریاضی',
        body: 'لطفاً پیش از جلسه آینده، ویدیوی آموزشی و تمرین ثبت‌شده در بخش درس ریاضی را مرور و ارسال نمایید.',
        scope: 'subject',
        classId: firstClass.id,
        subject: 'ریاضی',
        audienceRoles: ['student', 'parent', 'teacher'],
        pinned: false,
        authorName: school.principalName,
        authorRole: 'principal',
        publishedAtJalali: params.todayJalali,
      });
    }
  }
  return list;
}
