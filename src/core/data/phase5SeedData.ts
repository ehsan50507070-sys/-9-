// Phase 5 Deterministic Seed Data Generator (school-1 ONLY when each new plugin store is empty)
// Covers:
// - sida-bridge: 1 ready-to-review pending grade objection (if school-1 has no pending objection) + 1 audit sample
// - exams-management: 2 exam halls (4x4 & 3x4), 2 conflict-free scheduled exams, 1 pre-generated checkerboard seating chart
// - electronic-profiles: realistic linked profiles for seeded students & teachers without duplicating records
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import { generateCheckerboardSeating } from '../../plugins/exams-management/examsManagementHelpers';
import type {
  ClassRoom,
  ExamSeatingChart,
  GradeAppeal,
  GradebookEntry,
  InPersonExamHall,
  InPersonExamSession,
  School,
  SidaGradeAuditLog,
  StaffElectronicProfile,
  StaffEmploymentType,
  Student,
  StudentElectronicProfile,
  Teacher,
} from '../../types/domain';

export const PHASE5_PLUGIN_IDS = [
  'sida-bridge',
  'exams-management',
  'electronic-profiles',
] as const;

export interface Phase5SeedSlice {
  sida_grade_audit_logs: SidaGradeAuditLog[];
  extra_grade_appeals: GradeAppeal[];
  in_person_exam_halls: InPersonExamHall[];
  in_person_exam_sessions: InPersonExamSession[];
  exam_seating_charts: ExamSeatingChart[];
  student_profiles: StudentElectronicProfile[];
  staff_profiles: StaffElectronicProfile[];
}

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-'] as const;
const MOTHER_FIRST_NAMES = [
  'مریم',
  'فاطمه',
  'زهرا',
  'سارا',
  'نرگس',
  'الهام',
  'شیما',
  'مهدیه',
  'سمیرا',
  'پریسا',
];
const SAMPLE_STREETS = [
  'خیابان شریعتی، کوچه بهار، پلاک ۱۲',
  'بلوار کشاورز، کوچه گلستان، پلاک ۲۴',
  'خیابان ولیعصر، کوچه نیلوفر، پلاک ۸',
  'شهرک غرب، بلوار فرحزادی، پلاک ۱۹',
  'خیابان پیروزی، کوچه شکوفه، پلاک ۳۱',
];
const STAFF_DEGREES = [
  { degree: 'کارشناسی ارشد', major: 'آموزش ابتدایی', years: 11, type: 'رسمی' as StaffEmploymentType },
  { degree: 'کارشناسی', major: 'علوم تربیتی', years: 7, type: 'پیمانی' as StaffEmploymentType },
  { degree: 'کارشناسی ارشد', major: 'آموزش ریاضی', years: 9, type: 'رسمی' as StaffEmploymentType },
  { degree: 'کارشناسی', major: 'زبان و ادبیات فارسی', years: 5, type: 'غیردولتی' as StaffEmploymentType },
  { degree: 'کارشناسی ارشد', major: 'روان‌شناسی تربیتی', years: 14, type: 'رسمی' as StaffEmploymentType },
  { degree: 'کارشناسی', major: 'فیزیک و علوم تجربی', years: 4, type: 'حق‌التدریس' as StaffEmploymentType },
  { degree: 'کارشناسی', major: 'تربیت بدنی و علوم ورزشی', years: 6, type: 'پیمانی' as StaffEmploymentType },
];

export function generatePhase5SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  gradebookEntries: GradebookEntry[];
  existingGradeAppeals: GradeAppeal[];
}): Phase5SeedSlice {
  const { schools, classes, students, teachers, gradebookEntries, existingGradeAppeals } = params;

  const sida_grade_audit_logs: SidaGradeAuditLog[] = [];
  const extra_grade_appeals: GradeAppeal[] = [];
  const in_person_exam_halls: InPersonExamHall[] = [];
  const in_person_exam_sessions: InPersonExamSession[] = [];
  const exam_seating_charts: ExamSeatingChart[] = [];
  const student_profiles: StudentElectronicProfile[] = [];
  const staff_profiles: StaffElectronicProfile[] = [];

  const school1 = schools.find((s) => s.id === 'school-1') ?? schools[0];
  if (!school1) {
    return {
      sida_grade_audit_logs,
      extra_grade_appeals,
      in_person_exam_halls,
      in_person_exam_sessions,
      exam_seating_charts,
      student_profiles,
      staff_profiles,
    };
  }

  const today = getTodayJalali();
  const examDate1 = addDaysToJalali(today, 3);
  const examDate2 = addDaysToJalali(today, 5);
  const nowIso = new Date().toISOString();

  const s1Classes = classes.filter((c) => c.schoolId === school1.id);
  const s1Students = students.filter((s) => s.schoolId === school1.id && s.active);
  const s1Teachers = teachers.filter((t) => t.schoolId === school1.id && t.active);

  const classA = s1Classes[0];
  const classB = s1Classes[1];
  const classC = s1Classes[2];

  // 1. SIDA Bridge: ensure school-1 has at least 1 fresh pending grade objection ready for SIDA review
  const hasPendingS1Appeal = existingGradeAppeals.some(
    (a) => a.schoolId === school1.id && (a.status === 'submitted' || a.status === 'in_review')
  );
  if (!hasPendingS1Appeal && classA && s1Students[0]) {
    const targetStudent = s1Students[0];
    const targetGrade = gradebookEntries.find(
      (g) => g.schoolId === school1.id && g.studentId === targetStudent.id
    );
    extra_grade_appeals.push({
      id: `${school1.id}:appeal:sida-seed-1`,
      schoolId: school1.id,
      studentId: targetStudent.id,
      classId: targetStudent.classId,
      subject: targetGrade?.subject ?? 'ریاضی',
      jalaliMonth: targetGrade?.jalaliMonth ?? 'آبان',
      gradeEntryId:
        targetGrade?.id ?? `${school1.id}:gb:${targetStudent.classId}:ریاضی:آبان:${targetStudent.id}`,
      originalScore: targetGrade?.numericScore ?? 17.5,
      originalDescriptiveLevel: targetGrade?.descriptiveLevel ?? 'خوب',
      parentReason:
        'با سلام و احترام، در سوال بخش کسرها پاسخ دانش‌آموز صحیح نوشته شده اما نیم نمره کسر گردیده است. تقاضای بازبینی مجدد برگه پیش از ثبت نهایی سیدا را داریم.',
      submittedByName: targetStudent.parentName,
      submittedAtJalali: today,
      status: 'submitted',
      updatedAt: nowIso,
    });
  }

  // 2. In-Person Exams Management: 2 exam halls, 2 conflict-free sessions, 1 pre-generated checkerboard seating chart
  if (classA && classB && s1Teachers.length >= 2) {
    const hall1: InPersonExamHall = {
      id: `${school1.id}:hall:1`,
      schoolId: school1.id,
      name: 'سالن اجتماعات — حوزه ۱',
      roomCode: 'H-101',
      rows: 4,
      cols: 4,
      startSeatNumber: 101,
      description: 'سالن اصلی طبقه همکف با نورگیری استاندارد و فاصله ایمن صندلی‌ها',
      updatedAt: nowIso,
    };
    const hall2: InPersonExamHall = {
      id: `${school1.id}:hall:2`,
      schoolId: school1.id,
      name: 'کلاس ۱۰۲ — حوزه ۲',
      roomCode: 'H-102',
      rows: 3,
      cols: 4,
      startSeatNumber: 201,
      description: 'کلاس بزرگ طبقه اول ویژه آزمون‌های پایه‌های چهارم و پنجم',
      updatedAt: nowIso,
    };
    in_person_exam_halls.push(hall1, hall2);

    const session1: InPersonExamSession = {
      id: `${school1.id}:ipexam:1`,
      schoolId: school1.id,
      termTitle: `امتحانات نوبت اول ${school1.academicYear}`,
      subject: 'ریاضی',
      classIds: [classA.id, classB.id],
      hallId: hall1.id,
      proctorTeacherId: s1Teachers[0].id,
      jalaliDate: examDate1,
      startTime: '08:30',
      endTime: '09:45',
      notes: 'حضور دانش‌آموزان ۱۵ دقیقه پیش از شروع آزمون الزامی است.',
      createdByName: school1.principalName,
      updatedAt: nowIso,
    };

    const session2: InPersonExamSession = {
      id: `${school1.id}:ipexam:2`,
      schoolId: school1.id,
      termTitle: `امتحانات نوبت اول ${school1.academicYear}`,
      subject: 'فارسی و نگارش',
      classIds: classC ? [classA.id, classC.id] : [classA.id, classB.id],
      hallId: hall2.id,
      proctorTeacherId: s1Teachers[1].id,
      jalaliDate: examDate2,
      startTime: '10:00',
      endTime: '11:15',
      notes: 'همراه داشتن مداد مشکی، پاک‌کن و کارت ورود به جلسه الزامی است.',
      createdByName: school1.principalName,
      updatedAt: nowIso,
    };
    in_person_exam_sessions.push(session1, session2);

    // Pre-generate anti-cheating checkerboard seating for Hall 1 combining Class A + Class B
    const hall1Students = s1Students.filter(
      (st) => st.classId === classA.id || st.classId === classB.id
    );
    const seatingResult = generateCheckerboardSeating({
      rows: hall1.rows,
      cols: hall1.cols,
      startSeatNumber: hall1.startSeatNumber,
      students: hall1Students,
    });

    exam_seating_charts.push({
      id: `${school1.id}:seating:hall1`,
      schoolId: school1.id,
      title: `چیدمان شطرنجی ${hall1.name} — ${session1.subject}`,
      hallId: hall1.id,
      examSessionId: session1.id,
      classIds: [classA.id, classB.id],
      rows: hall1.rows,
      cols: hall1.cols,
      startSeatNumber: hall1.startSeatNumber,
      assignments: seatingResult.assignments,
      adjacencyWarningCount: seatingResult.adjacencyWarningCount,
      updatedByName: school1.principalName,
      updatedAt: nowIso,
    });
  }

  // 3. Electronic Profiles: pre-populate realistic linked profiles for seeded school-1 students & teachers
  s1Students.forEach((st, idx) => {
    const fatherFirst = st.parentName.split(' ')[0] || 'مهدی';
    const lastName = st.fullName.split(' ').slice(1).join(' ') || 'احمدی';
    const motherFirst = MOTHER_FIRST_NAMES[idx % MOTHER_FIRST_NAMES.length];
    const hasMedicalAlert = idx === 0 || idx === 3;
    student_profiles.push({
      id: `${school1.id}:stprof:${st.id}`,
      schoolId: school1.id,
      studentId: st.id,
      fatherName: fatherFirst,
      motherName: `${motherFirst} ${lastName}`,
      motherMobile: `0919${String(4100000 + idx * 173).slice(0, 7)}`,
      homeAddress: SAMPLE_STREETS[idx % SAMPLE_STREETS.length],
      guardianRelation: 'پدر',
      bloodGroup: BLOOD_GROUPS[idx % BLOOD_GROUPS.length],
      allergiesOrConditions:
        idx === 0
          ? 'حساسیت خفیف فصلی به گرده گل — همراه داشتن اسپری در فصل بهار'
          : idx === 3
            ? 'حساسیت غذایی به بادام‌زمینی و مغزها'
            : undefined,
      emergencyContactName: `${fatherFirst} ${lastName} (پدر)`,
      emergencyContactPhone: st.parentMobile,
      specialEducationalNotes:
        idx === 0
          ? 'علاقه‌مند به ریاضی و حل معما؛ پیشنهاد نشستن در ردیف جلو جهت تمرکز بیشتر.'
          : undefined,
      documents: [],
      confidentialAdminNotes:
        idx === 0
          ? 'پرونده ثبت‌نام کامل و تاییدشده؛ اولیا همکاری بسیار منظم با مدرسه دارند.'
          : undefined,
      updatedByName: school1.principalName,
      updatedAt: nowIso,
    });
  });

  s1Teachers.forEach((t, idx) => {
    const meta = STAFF_DEGREES[idx % STAFF_DEGREES.length];
    staff_profiles.push({
      id: `${school1.id}:sfprof:${t.id}`,
      schoolId: school1.id,
      teacherId: t.id,
      roleTitle: t.specialty,
      academicDegree: meta.degree,
      academicMajor: meta.major,
      yearsOfExperience: meta.years,
      employmentType: meta.type,
      homeAddress: SAMPLE_STREETS[(idx + 2) % SAMPLE_STREETS.length],
      emergencyPhone: t.mobile,
      documents: [],
      confidentialEvaluationNotes:
        idx === 0
          ? 'ارزیابی مدیریتی ممتاز: تدریس خلاقانه، تسلط بالا بر کلاس وارونه و تعامل محترمانه با اولیا.'
          : 'عملکرد منظم و قابل تقدیر در نیمسال اول.',
      updatedByName: school1.principalName,
      updatedAt: nowIso,
    });
  });

  return {
    sida_grade_audit_logs,
    extra_grade_appeals,
    in_person_exam_halls,
    in_person_exam_sessions,
    exam_seating_charts,
    student_profiles,
    staff_profiles,
  };
}
