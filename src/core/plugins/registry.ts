// Central Drop-in Plugin Registry (Core + Phase 1 Active Add-ons + Phase 2-6 Roadmap Catalog)
// Adding future add-ons requires ONLY creating src/plugins/<new-id>/ and appending its manifest here.
import { anonymousSurveysManifest } from '../../plugins/anonymous-surveys/manifest';
import { appointmentsManifest } from '../../plugins/appointments/manifest';
import { classChatManifest } from '../../plugins/class-chat/manifest';
import { counselingManifest } from '../../plugins/counseling/manifest';
import { curriculumManifest } from '../../plugins/curriculum/manifest';
import { dailyLogManifest } from '../../plugins/daily-log/manifest';
import { disciplineManifest } from '../../plugins/discipline/manifest';
import { electronicFormsManifest } from '../../plugins/electronic-forms/manifest';
import { electronicProfilesManifest } from '../../plugins/electronic-profiles/manifest';
import { examsManagementManifest } from '../../plugins/exams-management/manifest';
import { financeManifest } from '../../plugins/finance/manifest';
import { flippedVideoManifest } from '../../plugins/flipped-video/manifest';
import { gradebookManifest } from '../../plugins/gradebook/manifest';
import { homeworkManifest } from '../../plugins/homework/manifest';
import { mediaHubManifest } from '../../plugins/media-hub/manifest';
import { mockExamsManifest } from '../../plugins/mock-exams/manifest';
import { notificationTemplatesManifest } from '../../plugins/notification-templates/manifest';
import { onlineClassroomManifest } from '../../plugins/online-classroom/manifest';
import { onlineExamsManifest } from '../../plugins/online-exams/manifest';
import { parentPortalManifest } from '../../plugins/parent-portal/manifest';
import { parentStaffChatManifest } from '../../plugins/parent-staff-chat/manifest';
import { questionBankManifest } from '../../plugins/question-bank/manifest';
import { rewardsManifest } from '../../plugins/rewards/manifest';
import { sidaAnalyticsManifest } from '../../plugins/sida-analytics/manifest';
import { sidaBridgeManifest } from '../../plugins/sida-bridge/manifest';
import { smartAnalyticsManifest } from '../../plugins/smart-analytics/manifest';
import { staffAttendanceManifest } from '../../plugins/staff-attendance/manifest';
import { studentAttendanceManifest } from '../../plugins/student-attendance/manifest';
import { substitutionManifest } from '../../plugins/substitution/manifest';
import { leaveExitManifest } from '../../plugins/leave-exit/manifest';
import { teacherDevelopmentManifest } from '../../plugins/teacher-development/manifest';
import { timetableManifest } from '../../plugins/timetable/manifest';
import { virtualClassesManifest } from '../../plugins/virtual-classes/manifest';
import { SmartArchivePage } from '../archive/SmartArchivePage';
import { DashboardPage } from '../dashboard/DashboardPage';
import { SchoolDirectoryPage } from '../directory/SchoolDirectoryPage';
import { BackupExportPage } from '../export/BackupExportPage';
import { SecurityLogsPage } from '../security/SecurityLogsPage';
import { DataHealthMigrationPage } from '../../modules/admin/DataHealthMigrationPage';
import { SmartImportWizardPage } from '../../modules/smart-import/SmartImportWizardPage';
import { SchoolSettingsPage } from '../settings/SchoolSettingsPage';
import { RecycleBinPage } from '../storage/RecycleBinPage';
import { SubjectsHubPage } from '../subjects/SubjectsHubPage';
import { SuperAdminPage } from '../super-admin/SuperAdminPage';
import { AddonsManagerPage } from './AddonsManagerPage';
import type { PluginManifest } from './types';

// Core platform capabilities (isCore: true — cannot be disabled)
const CORE_MANIFESTS: PluginManifest[] = [
  {
    id: 'super-admin',
    nameFa: 'کنسول راهبر ارشد سامانه',
    shortNameFa: 'راهبر ارشد',
    descriptionFa:
      'حاکمیت کلان سامانه، ماتریس دسترسی نقش‌ها، سفارشی‌سازی واژگان، مدیریت مجموعه‌ها و مدارس و استودیو صفحه ورود.',
    version: '8.0.0',
    phase: 8,
    category: 'core',
    categoryLabelFa: 'حاکمیت کلان سامانه',
    iconName: 'ShieldCheck',
    isCore: true,
    defaultEnabled: true,
    route: '/super-admin',
    allowedRoles: ['super_admin'],
    dataStores: [
      'educational_complexes',
      'managed_admin_accounts',
      'role_governance_configs',
      'global_system_configs',
      'super_admin_audit_logs',
    ],
    implemented: true,
    component: SuperAdminPage,
  },
  {
    id: 'dashboard',
    nameFa: 'داشبورد هوشمند مدرسه',
    shortNameFa: 'داشبورد',
    descriptionFa:
      'نمای یکپارچه شاخص‌های روزانه مدرسه، هشدارهای هوشمند، ابزارک‌های بسته‌های فعال و مقایسه مدارس برای مدیر کل.',
    version: '1.0.0',
    phase: 1,
    category: 'core',
    categoryLabelFa: 'هسته مرکزی سامانه',
    iconName: 'LayoutDashboard',
    isCore: true,
    defaultEnabled: true,
    route: '/dashboard',
    allowedRoles: [
      'super_admin',
      'complex_admin',
      'principal',
      'deputy',
      'counselor',
      'teacher',
      'parent',
      'student',
    ],
    dataStores: ['schools', 'classes', 'students', 'teachers'],
    implemented: true,
    component: DashboardPage,
  },
  {
    id: 'data-vault',
    nameFa: 'مرکز سلامت داده و مهاجرت',
    shortNameFa: 'مرکز سلامت داده و مهاجرت',
    descriptionFa:
      'آزمون سلامت ارتباط جداول، خروجی بسته استاندارد مهاجرت (SHA-256)، بازگردانی ایمن با پیش‌نمایش، نقاط بازیابی خودکار و قفل اضطراری سامانه.',
    version: '3.2.0',
    phase: 9,
    category: 'core',
    categoryLabelFa: 'امنیت و ممیزی',
    iconName: 'Database',
    isCore: true,
    defaultEnabled: true,
    route: '/data-health-migration',
    allowedRoles: ['super_admin'],
    dataStores: ['schools', 'recovery_snapshots'],
    implemented: true,
    component: DataHealthMigrationPage,
  },
  {
    id: 'smart-import-wizard',
    nameFa: 'ویزارد ورود هوشمند و نگاشت جدول‌ها',
    shortNameFa: 'ورود هوشمند اکسل/سیدا',
    descriptionFa:
      'ویزارد ۵ مرحله‌ای نگاشت هوشمند جدول‌های اکسل و سیدا، تشخیص خودکار سرستون، تطبیق دولایه ستون‌ها، ادغام دو فایل با کد ملی، قرنطینه و ثبت امن.',
    version: '3.3.0',
    phase: 9,
    category: 'core',
    categoryLabelFa: 'داده و مهاجرت',
    iconName: 'FileSpreadsheet',
    isCore: true,
    defaultEnabled: true,
    route: '/smart-import-wizard',
    allowedRoles: ['super_admin', 'principal'],
    dataStores: [
      'import_mapping_templates',
      'students',
      'teachers',
      'classes',
      'gradebook_entries',
      'sida_analytics_grades',
    ],
    implemented: true,
    component: SmartImportWizardPage,
  },
  {
    id: 'recycle-bin',
    nameFa: 'سطل بازیابی امن (حذف نرم)',
    shortNameFa: 'سطل بازیابی امن',
    descriptionFa:
      'مشاهده و بازیابی فوری تمامی رکوردهای حذف‌شده بدون حذف فیزیکی، به تفکیک نوع داده، حذف‌کننده و تاریخ شمسی.',
    version: '3.2.0',
    phase: 9,
    category: 'core',
    categoryLabelFa: 'امنیت و ممیزی',
    iconName: 'RotateCcw',
    isCore: true,
    defaultEnabled: true,
    route: '/recycle-bin',
    allowedRoles: ['super_admin', 'principal'],
    dataStores: ['schools'],
    implemented: true,
    component: RecycleBinPage,
  },
  {
    id: 'security-logs',
    nameFa: 'گزارش امنیتی و ورودها',
    shortNameFa: 'گزارش امنیتی و ورودها',
    descriptionFa:
      'ثبت و پایش ورودهای موفق و ناموفق، قفل حساب، تغییر رمز عبور، قفل اضطراری و بررسی اصالت زنجیره رمزنگاری SHA-256.',
    version: '10.0.0',
    phase: 9,
    category: 'core',
    categoryLabelFa: 'امنیت و ممیزی',
    iconName: 'ShieldAlert',
    isCore: true,
    defaultEnabled: true,
    route: '/security-logs',
    allowedRoles: ['super_admin', 'principal'],
    dataStores: ['security_audit_logs'],
    implemented: true,
    component: SecurityLogsPage,
  },
  {
    id: 'subjects',
    nameFa: 'دروس من و کلاس‌های درس‌محور',
    shortNameFa: 'دروس من',
    descriptionFa:
      'ساختار یکپارچه درس‌محور (ویدیوهای آموزشی، تکالیف، آزمون‌ها، سوالات و جزوه‌ها، اطلاعیه‌ها و نمرات هر درس به تفکیک).',
    version: '3.0.0',
    phase: 3,
    category: 'core',
    categoryLabelFa: 'آموزش درس‌محور',
    iconName: 'BookOpenCheck',
    isCore: true,
    defaultEnabled: true,
    route: '/subjects',
    allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'],
    dataStores: [
      'homework_assignments',
      'homework_submissions',
      'flipped_lessons',
      'online_exams',
      'media_resources',
      'question_bank',
      'school_announcements',
    ],
    implemented: true,
    component: SubjectsHubPage,
  },
  {
    id: 'smart-archive',
    nameFa: 'آرشیو هوشمند محتوا و ویدیوها',
    shortNameFa: 'آرشیو هوشمند',
    descriptionFa:
      'بایگانی خودکار ویدیوهای آموزشی، جزوه‌ها و سوالات به تفکیک سال تحصیلی، پایه، درس و معلم با قابلیت بازاستفاده فوری در کلاس‌های جدید.',
    version: '3.0.0',
    phase: 3,
    category: 'core',
    categoryLabelFa: 'آرشیو و منابع آموزشی',
    iconName: 'Library',
    isCore: true,
    defaultEnabled: true,
    route: '/smart-archive',
    allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy', 'teacher'],
    dataStores: ['smart_content_archive'],
    implemented: true,
    component: SmartArchivePage,
  },
  {
    id: 'directory',
    nameFa: 'مدیریت دانش‌آموزان، کلاس‌ها و کادر',
    shortNameFa: 'دانش‌آموزان و کادر',
    descriptionFa:
      'ثبت، ویرایش و بایگانی دانش‌آموزان (با صدور خودکار رمز ورود ولی)، مدیریت کلاس‌ها و تنظیم برنامه ۴ زنگه معلمان هر مدرسه.',
    version: '1.5.0',
    phase: 1,
    category: 'core',
    categoryLabelFa: 'هسته مرکزی سامانه',
    iconName: 'GraduationCap',
    isCore: true,
    defaultEnabled: true,
    route: '/directory',
    allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy'],
    dataStores: ['students', 'classes', 'teachers', 'schedules', 'student_transfer_logs'],
    implemented: true,
    component: SchoolDirectoryPage,
  },
  {
    id: 'addons',
    nameFa: 'مدیریت بسته‌های الحاقی',
    shortNameFa: 'بسته‌های الحاقی',
    descriptionFa:
      'فعال‌سازی، غیرفعال‌سازی یا حذف نرم بسته‌های الحاقی برای هر مدرسه با تضمین ۱۰۰٪ حفظ داده‌ها.',
    version: '1.0.0',
    phase: 1,
    category: 'core',
    categoryLabelFa: 'هسته مرکزی سامانه',
    iconName: 'Blocks',
    isCore: true,
    defaultEnabled: true,
    route: '/plugins',
    allowedRoles: ['super_admin'],
    dataStores: ['school_plugin_states'],
    implemented: true,
    component: AddonsManagerPage,
  },
  {
    id: 'backup',
    nameFa: 'پشتیبان‌گیری و اکسل فارسی',
    shortNameFa: 'پشتیبان و اکسل',
    descriptionFa:
      'پشتیبان‌گیری JSON تک‌مدرسه و کل مجموعه (شامل داده‌های بسته‌های غیرفعال) و ورود/خروجی CSV اکسل فارسی.',
    version: '1.0.0',
    phase: 1,
    category: 'core',
    categoryLabelFa: 'هسته مرکزی سامانه',
    iconName: 'Database',
    isCore: true,
    defaultEnabled: true,
    route: '/backup',
    allowedRoles: ['complex_admin', 'principal', 'deputy'],
    dataStores: ['schools'],
    implemented: true,
    component: BackupExportPage,
  },
  {
    id: 'settings',
    nameFa: 'تنظیمات مستقل مدرسه',
    shortNameFa: 'تنظیمات مدرسه',
    descriptionFa:
      'پیکربندی نام، مدیر، سال تحصیلی، روزهای کاری هفتگی، مدت زنگ‌ها و سربرگ چاپی A4 اختصاصی هر واحد.',
    version: '1.0.0',
    phase: 1,
    category: 'core',
    categoryLabelFa: 'هسته مرکزی سامانه',
    iconName: 'Settings',
    isCore: true,
    defaultEnabled: true,
    route: '/settings',
    allowedRoles: ['super_admin', 'complex_admin', 'principal'],
    dataStores: ['schools', 'school_announcements', 'recovery_snapshots'],
    implemented: true,
    component: SchoolSettingsPage,
  },
];

// Phase 1 Operational Toggleable / Soft-Uninstallable Add-ons
const PHASE1_ADDONS: PluginManifest[] = [
  studentAttendanceManifest,
  staffAttendanceManifest,
  substitutionManifest,
  dailyLogManifest,
];

// Phase 2 Academic, Assessment & Engagement Add-ons
const PHASE2_ADDONS: PluginManifest[] = [
  timetableManifest,
  curriculumManifest,
  mediaHubManifest,
  gradebookManifest,
  homeworkManifest,
  rewardsManifest,
  questionBankManifest,
];

// Phase 3 & 3.5 Digital Learning, Online Assessment & Private Parent-Staff Communication Add-ons
const PHASE3_ADDONS: PluginManifest[] = [
  flippedVideoManifest,
  onlineClassroomManifest,
  onlineExamsManifest,
  parentStaffChatManifest,
];

// Phase 4 Parent Portal, Class Group Chat, Appointments + 360° Sheet, Electronic Forms & Notification Templates
const PHASE4_ADDONS: PluginManifest[] = [
  parentPortalManifest,
  classChatManifest,
  appointmentsManifest,
  electronicFormsManifest,
  notificationTemplatesManifest,
];

// Phase 5 SIDA Smart Bridge, In-Person Exams Management & Electronic Profiles
const PHASE5_ADDONS: PluginManifest[] = [
  sidaBridgeManifest,
  examsManagementManifest,
  electronicProfilesManifest,
];

// Phase 6 Integrated Finance, Smart Academic Analytics & Privacy-First Anonymous Surveys
const PHASE6_ADDONS: PluginManifest[] = [
  financeManifest,
  smartAnalyticsManifest,
  anonymousSurveysManifest,
];

// Phase 7 Teacher Professional Development, Anti-Cheat Quizzes, Auto-Certificates & 5-Tier Ranking
const PHASE7_ADDONS: PluginManifest[] = [
  teacherDevelopmentManifest,
];

// Phase 9A & 9B Enterprise Mock Exams + Advanced SIDA Analytics (Non-Destructive Add-ons)
const PHASE9A_ADDONS: PluginManifest[] = [
  mockExamsManifest,
  sidaAnalyticsManifest,
];

// Phase 9C Executive, Disciplinary, Confidential Counseling & Virtual Class Hub Add-ons
const PHASE9C_ADDONS: PluginManifest[] = [
  disciplineManifest,
  leaveExitManifest,
  counselingManifest,
  virtualClassesManifest,
];

export const PLUGIN_REGISTRY: PluginManifest[] = [
  ...CORE_MANIFESTS,
  ...PHASE1_ADDONS,
  ...PHASE2_ADDONS,
  ...PHASE3_ADDONS,
  ...PHASE4_ADDONS,
  ...PHASE5_ADDONS,
  ...PHASE6_ADDONS,
  ...PHASE7_ADDONS,
  ...PHASE9A_ADDONS,
  ...PHASE9C_ADDONS,
];
