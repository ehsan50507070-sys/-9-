// Pure TypeScript Helpers for Phase 5 Plugin: Electronic Profiles («پرونده الکترونیک جامع دانش‌آموزان و همکاران»)
// Profile completeness calculation, strict image/PDF size & MIME validator, automatic live timelines,
// staff 4-period attendance/leave aggregation, and UTF-8 BOM Persian CSV exporters.
import { validateIranianNationalId } from '../../core/validation/validators';
import { buildUtf8BomCsv } from '../../lib/csv';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  DailyLogEntry,
  ElectronicForm,
  ElectronicFormResponse,
  GradebookEntry,
  OnlineExam,
  OnlineExamSubmission,
  ProfileDocumentCategory,
  StaffAttendanceRecord,
  StaffElectronicProfile,
  Student,
  StudentAttendanceRecord,
  StudentElectronicProfile,
  StudentReward,
  SubstitutionRecord,
  Teacher,
} from '../../types/domain';

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PROFILE_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_PROFILE_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
export const ALLOWED_PROFILE_PDF_MIMES = new Set(['application/pdf']);

export const PROFILE_DOC_CATEGORY_LABELS: Record<ProfileDocumentCategory, string> = {
  photo: 'عکس پرسنلی',
  birth_certificate: 'صفحه اول شناسنامه',
  previous_report_card: 'کارنامه سال قبل',
  medical_certificate: 'گواهی پزشکی / سلامت',
  teaching_decree: 'ابلاغ تدریس',
  academic_degree: 'مدرک تحصیلی',
  in_service_cert: 'گواهی دوره ضمن خدمت',
  other: 'سایر مدارک',
};

export interface ProfileDocumentValidationResult {
  valid: boolean;
  kind?: 'image' | 'pdf';
  errorFa?: string;
}

/**
 * Validates digital documents uploaded to Student/Staff Electronic Profiles:
 * - Images (JPEG/PNG/WebP): max 5 MB
 * - PDFs (`application/pdf`): max 10 MB
 * - Rejects unsafe files (SVG, HTML, JS, executables)
 */
export function validateProfileDocumentFile(file: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): ProfileDocumentValidationResult {
  const lowerName = file.fileName.toLowerCase();
  const mime = (file.mimeType || '').toLowerCase();

  if (
    lowerName.endsWith('.svg') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.js') ||
    mime.includes('svg') ||
    mime.includes('html') ||
    mime.includes('javascript')
  ) {
    return {
      valid: false,
      errorFa: 'بارگذاری فایل‌های SVG، HTML یا اسکریپت به دلایل امنیتی مجاز نیست.',
    };
  }

  const isPdf = ALLOWED_PROFILE_PDF_MIMES.has(mime) || lowerName.endsWith('.pdf');
  const isImage =
    ALLOWED_PROFILE_IMAGE_MIMES.has(mime) ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');

  if (!isPdf && !isImage) {
    return {
      valid: false,
      errorFa: 'تنها فایل‌های تصویری (JPG، PNG، WebP) یا سند PDF قابل بارگذاری هستند.',
    };
  }

  if (isImage && file.sizeBytes > MAX_PROFILE_IMAGE_BYTES) {
    return {
      valid: false,
      errorFa: 'حجم فایل تصویر نباید بیشتر از ۵ مگابایت باشد.',
    };
  }

  if (isPdf && file.sizeBytes > MAX_PROFILE_PDF_BYTES) {
    return {
      valid: false,
      errorFa: 'حجم فایل PDF نباید بیشتر از ۱۰ مگابایت باشد.',
    };
  }

  return {
    valid: true,
    kind: isPdf ? 'pdf' : 'image',
  };
}

export interface ProfileCompletenessSummary {
  percent: number;
  completedCount: number;
  totalCount: number;
  missingFieldsFa: string[];
}

export function computeStudentProfileCompleteness(
  student: Student,
  profile?: StudentElectronicProfile
): ProfileCompletenessSummary {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: validateIranianNationalId(student.nationalId), label: 'کد ملی معتبر ۱۰ رقمی' },
    { ok: Boolean(student.birthDateJalali && student.birthDateJalali.trim().length >= 8), label: 'تاریخ تولد شمسی' },
    { ok: Boolean(profile?.fatherName?.trim()), label: 'نام پدر' },
    { ok: Boolean(profile?.motherName?.trim()), label: 'نام مادر' },
    { ok: Boolean(profile?.homeAddress?.trim()), label: 'نشانی منزل' },
    { ok: Boolean(profile?.guardianRelation?.trim()), label: 'نسبت سرپرست' },
    { ok: Boolean(profile?.bloodGroup?.trim()), label: 'گروه خونی' },
    {
      ok: Boolean(profile?.emergencyContactName?.trim() && profile?.emergencyContactPhone?.trim()),
      label: 'تماس اضطراری',
    },
    { ok: Boolean(profile && profile.documents.length > 0), label: 'بارگذاری حداقل یک مدرک دیجیتال' },
  ];

  const completedCount = checks.filter((c) => c.ok).length;
  const totalCount = checks.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  return {
    percent,
    completedCount,
    totalCount,
    missingFieldsFa: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export function computeStaffProfileCompleteness(
  teacher: Teacher,
  profile?: StaffElectronicProfile
): ProfileCompletenessSummary {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: validateIranianNationalId(teacher.nationalId), label: 'کد ملی معتبر' },
    { ok: Boolean(teacher.personnelCode?.trim()), label: 'کد پرسنلی' },
    { ok: Boolean(profile?.academicDegree?.trim()), label: 'مدرک تحصیلی' },
    { ok: Boolean(profile?.academicMajor?.trim()), label: 'رشته تحصیلی' },
    { ok: typeof profile?.yearsOfExperience === 'number' && profile.yearsOfExperience >= 0, label: 'سنوات خدمت' },
    { ok: Boolean(profile?.employmentType), label: 'نوع استخدام' },
    { ok: Boolean(profile?.emergencyPhone?.trim() || teacher.mobile?.trim()), label: 'شماره تماس' },
    { ok: Boolean(profile && profile.documents.length > 0), label: 'بارگذاری مدارک / ابلاغ' },
  ];

  const completedCount = checks.filter((c) => c.ok).length;
  const totalCount = checks.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  return {
    percent,
    completedCount,
    totalCount,
    missingFieldsFa: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export interface StudentTimelineItem {
  id: string;
  dateJalali: string;
  category: 'attendance' | 'gradebook' | 'exam' | 'reward' | 'consent' | 'daily_log';
  categoryLabelFa: string;
  title: string;
  detail: string;
  tone: 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate';
}

/**
 * Live read-only aggregator for a student's academic, disciplinary, reward & consent history.
 */
export function aggregateStudentTimeline(params: {
  studentId: string;
  attendance: StudentAttendanceRecord[];
  gradebook: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  rewards: StudentReward[];
  electronicForms: ElectronicForm[];
  electronicFormResponses: ElectronicFormResponse[];
  dailyLogs: DailyLogEntry[];
}): StudentTimelineItem[] {
  const {
    studentId,
    attendance,
    gradebook,
    onlineExams,
    onlineExamSubmissions,
    rewards,
    electronicForms,
    electronicFormResponses,
    dailyLogs,
  } = params;

  const items: StudentTimelineItem[] = [];
  const examMap = new Map(onlineExams.map((e) => [e.id, e]));
  const formMap = new Map(electronicForms.map((f) => [f.id, f]));

  // Attendance exceptions (absent / late / excused)
  for (const att of attendance) {
    if (att.studentId !== studentId || att.status === 'present') continue;
    const statusLabel =
      att.status === 'absent' ? 'غیبت' : att.status === 'late' ? 'تاخیر' : 'غیبت موجه';
    items.push({
      id: `att-${att.id}`,
      dateJalali: att.jalaliDate,
      category: 'attendance',
      categoryLabelFa: 'حضور و غیاب',
      title: `${statusLabel} در زنگ ${toPersianDigits(att.period)}`,
      detail: att.note ?? 'ثبت‌شده در دفتر حضور و غیاب مدرسه',
      tone: att.status === 'absent' ? 'rose' : 'amber',
    });
  }

  // Gradebook entries
  for (const gb of gradebook) {
    if (gb.studentId !== studentId) continue;
    const scorePart =
      gb.numericScore !== undefined ? `نمره ${toPersianDigits(gb.numericScore)} از ۲۰` : '';
    const descPart = gb.descriptiveLevel ? `سطح «${gb.descriptiveLevel}»` : '';
    items.push({
      id: `gb-${gb.id}`,
      dateJalali: gb.jalaliDate,
      category: 'gradebook',
      categoryLabelFa: 'دفتر نمره',
      title: `${gb.subject} — ماه ${gb.jalaliMonth}`,
      detail: [scorePart, descPart, gb.disciplinaryNote].filter(Boolean).join(' · ') || 'ثبت ارزیابی',
      tone: 'indigo',
    });
  }

  // Online exams
  for (const sub of onlineExamSubmissions) {
    if (sub.studentId !== studentId) continue;
    const exam = examMap.get(sub.examId);
    items.push({
      id: `ex-${sub.id}`,
      dateJalali: sub.submittedAtJalali || exam?.startDateJalali || '',
      category: 'exam',
      categoryLabelFa: 'آزمون آنلاین',
      title: exam?.title ?? 'آزمون آنلاین',
      detail: `نمره کسب‌شده: ${toPersianDigits(sub.finalScore20)} از ۲۰`,
      tone: 'indigo',
    });
  }

  // Rewards & certificates
  for (const rw of rewards) {
    if (rw.studentId !== studentId) continue;
    items.push({
      id: `rw-${rw.id}`,
      dateJalali: rw.jalaliDate,
      category: 'reward',
      categoryLabelFa: 'تشویق و تقدیر',
      title: rw.badgeTitle,
      detail: `${rw.category} · ${rw.reason}`,
      tone: 'emerald',
    });
  }

  // Signed electronic forms / consents
  for (const resp of electronicFormResponses) {
    if (resp.studentId !== studentId) continue;
    const form = formMap.get(resp.formId);
    items.push({
      id: `ef-${resp.id}`,
      dateJalali: resp.submittedAtJalali,
      category: 'consent',
      categoryLabelFa: 'رضایت‌نامه دیجیتال',
      title: form?.title ?? 'رضایت‌نامه امضاشده',
      detail: `تکمیل و امضا توسط ${resp.parentName} در ساعت ${toPersianDigits(resp.submittedAtTime)}`,
      tone: 'emerald',
    });
  }

  // Daily logs
  for (const log of dailyLogs) {
    if (log.studentId !== studentId) continue;
    items.push({
      id: `dl-${log.id}`,
      dateJalali: log.jalaliDate,
      category: 'daily_log',
      categoryLabelFa: 'دفتر روزانه',
      title: log.title,
      detail: log.description,
      tone: log.severity === 'urgent' ? 'rose' : log.severity === 'attention' ? 'amber' : 'slate',
    });
  }

  return items.sort((a, b) => b.dateJalali.localeCompare(a.dateJalali));
}

export interface StaffAttendanceSummary {
  totalRecordedPeriods: number;
  presentPeriods: number;
  absentPeriods: number;
  latePeriods: number;
  excusedPeriods: number;
  substitutionsCoveredCount: number;
  substitutionsNeededCount: number;
  leaveLogCount: number;
}

/**
 * Pulls live 4-period Staff Attendance, Substitution coverage & Daily Logs leave summary for a staff member.
 */
export function aggregateStaffAttendanceSummary(params: {
  teacherId: string;
  teacherName: string;
  staffAttendance: StaffAttendanceRecord[];
  substitutions: SubstitutionRecord[];
  dailyLogs: DailyLogEntry[];
}): StaffAttendanceSummary {
  const { teacherId, teacherName, staffAttendance, substitutions, dailyLogs } = params;
  const mine = staffAttendance.filter((r) => r.teacherId === teacherId);

  const presentPeriods = mine.filter((r) => r.status === 'present').length;
  const absentPeriods = mine.filter((r) => r.status === 'absent').length;
  const latePeriods = mine.filter((r) => r.status === 'late').length;
  const excusedPeriods = mine.filter((r) => r.status === 'excused').length;

  const substitutionsCoveredCount = substitutions.filter(
    (s) => s.substituteTeacherId === teacherId
  ).length;
  const substitutionsNeededCount = substitutions.filter(
    (s) => s.absentTeacherId === teacherId
  ).length;

  const leaveLogCount = dailyLogs.filter(
    (log) =>
      (log.category === 'early_dismissal' || log.category === 'administrative') &&
      (log.title.includes(teacherName) || log.description.includes(teacherName))
  ).length;

  return {
    totalRecordedPeriods: mine.length,
    presentPeriods,
    absentPeriods,
    latePeriods,
    excusedPeriods,
    substitutionsCoveredCount,
    substitutionsNeededCount,
    leaveLogCount,
  };
}

export function buildStudentProfilesCsv(params: {
  students: Student[];
  classes: ClassRoom[];
  profiles: StudentElectronicProfile[];
}): string {
  const { students, classes, profiles } = params;
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const profileMap = new Map(profiles.map((p) => [p.studentId, p]));

  const headers = [
    'کد دانش‌آموزی',
    'کد ملی',
    'نام و نام خانوادگی',
    'کلاس',
    'تاریخ تولد',
    'نام پدر',
    'نام مادر',
    'شماره تماس ولی',
    'گروه خونی',
    'هشدار پزشکی / حساسیت',
    'تماس اضطراری',
    'نشانی منزل',
    'درصد تکمیل پرونده',
  ];

  return buildUtf8BomCsv(
    headers,
    students.map((st) => {
      const p = profileMap.get(st.id);
      const comp = computeStudentProfileCompleteness(st, p);
      return [
        st.studentCode,
        toAsciiDigits(st.nationalId),
        st.fullName,
        classMap.get(st.classId) ?? 'نامشخص',
        st.birthDateJalali ?? '',
        p?.fatherName ?? '',
        p?.motherName ?? '',
        st.parentMobile,
        p?.bloodGroup ?? '',
        p?.allergiesOrConditions ?? '',
        p ? `${p.emergencyContactName} (${p.emergencyContactPhone})` : '',
        p?.homeAddress ?? '',
        `${comp.percent}%`,
      ];
    })
  );
}

export function buildStaffProfilesCsv(params: {
  teachers: Teacher[];
  classes: ClassRoom[];
  profiles: StaffElectronicProfile[];
}): string {
  const { teachers, classes, profiles } = params;
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const profileMap = new Map(profiles.map((p) => [p.teacherId, p]));

  const headers = [
    'کد پرسنلی',
    'کد ملی',
    'نام و نام خانوادگی',
    'سمت / تخصص',
    'مدرک تحصیلی',
    'رشته تحصیلی',
    'سنوات خدمت (سال)',
    'نوع استخدام',
    'تلفن همراه',
    'کلاس‌های تدریس',
    'درصد تکمیل پرونده',
  ];

  return buildUtf8BomCsv(
    headers,
    teachers.map((t) => {
      const p = profileMap.get(t.id);
      const comp = computeStaffProfileCompleteness(t, p);
      const classNames = t.assignedClassIds.map((cid) => classMap.get(cid) ?? cid).join('، ');
      return [
        t.personnelCode,
        toAsciiDigits(t.nationalId),
        t.fullName,
        p?.roleTitle || t.specialty,
        p?.academicDegree ?? '',
        p?.academicMajor ?? '',
        p ? String(p.yearsOfExperience) : '',
        p?.employmentType ?? '',
        t.mobile,
        classNames,
        `${comp.percent}%`,
      ];
    })
  );
}
