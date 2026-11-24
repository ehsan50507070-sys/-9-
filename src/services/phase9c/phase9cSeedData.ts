// Phase 9-C: Deterministic Multi-School Seed Data for Discipline, Leave/Exit, Counseling & Virtual Class Hub
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import { DEFAULT_COMPLEX_ID } from '../../core/super-admin/superAdminHelpers';
import type {
  ClassRoom,
  CounselingClinicalNote,
  CounselingSession,
  DisciplinePledge,
  DisciplineRecord,
  School,
  StaffLeaveRequest,
  Student,
  StudentExitPass,
  Teacher,
  VirtualClassAttendance,
  VirtualClassSession,
} from '../../types/domain';
import { buildDefaultPledgeTextFa } from './disciplineService';

export const PHASE9C_PLUGIN_IDS = [
  'discipline',
  'leave-exit',
  'counseling',
  'virtual-classes',
] as const;

export interface Phase9CSeedBundle {
  discipline_records: DisciplineRecord[];
  discipline_pledges: DisciplinePledge[];
  student_exit_passes: StudentExitPass[];
  staff_leave_requests: StaffLeaveRequest[];
  counseling_sessions: CounselingSession[];
  counseling_clinical_notes: CounselingClinicalNote[];
  virtual_class_sessions: VirtualClassSession[];
  virtual_class_attendance: VirtualClassAttendance[];
}

export function generatePhase9CSeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  todayJalali?: string;
}): Phase9CSeedBundle {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = params.todayJalali ?? getTodayJalali();
  const twoDaysAgo = addDaysToJalali(today, -2);
  const fiveDaysAgo = addDaysToJalali(today, -5);
  const tomorrow = addDaysToJalali(today, 1);

  // Format current start time 10 minutes earlier so the seeded live virtual class is LIVE right now
  const liveStartDate = new Date(now.getTime() - 10 * 60 * 1000);
  const liveStartHm = `${String(liveStartDate.getHours()).padStart(2, '0')}:${String(liveStartDate.getMinutes()).padStart(2, '0')}`;
  const soonStartDate = new Date(now.getTime() + 18 * 60 * 1000);
  const soonStartHm = `${String(soonStartDate.getHours()).padStart(2, '0')}:${String(soonStartDate.getMinutes()).padStart(2, '0')}`;

  const discipline_records: DisciplineRecord[] = [];
  const discipline_pledges: DisciplinePledge[] = [];
  const student_exit_passes: StudentExitPass[] = [];
  const staff_leave_requests: StaffLeaveRequest[] = [];
  const counseling_sessions: CounselingSession[] = [];
  const counseling_clinical_notes: CounselingClinicalNote[] = [];
  const virtual_class_sessions: VirtualClassSession[] = [];
  const virtual_class_attendance: VirtualClassAttendance[] = [];

  params.schools.forEach((school, sIdx) => {
    const complexId = school.complexId ?? DEFAULT_COMPLEX_ID;
    const academicYearId = school.academicYear || '1405-1406';
    const schoolClasses = params.classes.filter((c) => c.schoolId === school.id);
    const schoolStudents = params.students.filter((s) => s.schoolId === school.id);
    const schoolTeachers = params.teachers.filter((t) => t.schoolId === school.id);

    if (schoolClasses.length === 0 || schoolStudents.length < 4 || schoolTeachers.length < 2) {
      return;
    }

    const st0 = schoolStudents[0];
    const st1 = schoolStudents[1];
    const st2 = schoolStudents[2];
    const st3 = schoolStudents[3];
    const cls0 = schoolClasses.find((c) => c.id === st0.classId) ?? schoolClasses[0];
    const cls1 = schoolClasses.find((c) => c.id === st1.classId) ?? schoolClasses[0];
    const t0 = schoolTeachers[0];
    const t1 = schoolTeachers[1];

    // 1. Discipline Records (Rewards + Minor/Critical Infractions)
    discipline_records.push(
      {
        id: `disc-${school.id}-1`,
        complexId,
        schoolId: school.id,
        academicYearId,
        studentId: st0.id,
        classId: st0.classId,
        kind: 'reward',
        severity: 'minor',
        category: 'نظم و انضباط نمونه',
        title: 'همکاری منظم در اداره کتابخانه کلاسی و حضور به‌موقع',
        description: 'طی دو هفته متوالی نظم و مسئولیت‌پذیری مثال‌زدنی داشته است.',
        jalaliDate: fiveDaysAgo,
        pointsDelta: 1,
        visibleToParentStudent: true,
        recordedByUserId: `user-teacher-${t0.id}`,
        recordedByName: t0.fullName,
        recordedByRole: 'teacher',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `disc-${school.id}-2`,
        complexId,
        schoolId: school.id,
        academicYearId,
        studentId: st1.id,
        classId: st1.classId,
        kind: 'infraction',
        severity: 'moderate',
        category: 'تاخیر مکرر در ورود به مدرسه',
        title: 'تاخیر بیش از ۱۵ دقیقه در سه نوبت صبحگاهی',
        description: 'تذکر شفاهی داده شد و جهت هماهنگی زمان حرکت سرویس با ولی تماس گرفته شد.',
        jalaliDate: fiveDaysAgo,
        pointsDelta: 1,
        visibleToParentStudent: true,
        recordedByUserId: `user-deputy-${school.id}`,
        recordedByName: 'معاون اجرایی مدرسه',
        recordedByRole: 'deputy',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `disc-${school.id}-3`,
        complexId,
        schoolId: school.id,
        academicYearId,
        studentId: st1.id,
        classId: st1.classId,
        kind: 'infraction',
        severity: 'critical',
        category: 'بی‌نظمی در محیط کلاس',
        title: 'ایجاد اختلال جدی در روند تدریس زنگ دوم و عدم توجه به تذکر',
        description: 'موضوع به معاونت پرورشی ارجاع شد و صدور تعهدنامه رسمی با اطلاع ولی در دستور کار قرار گرفت.',
        jalaliDate: twoDaysAgo,
        pointsDelta: 2,
        visibleToParentStudent: true,
        recordedByUserId: `user-deputy-${school.id}`,
        recordedByName: 'معاون اجرایی مدرسه',
        recordedByRole: 'deputy',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `disc-${school.id}-4`,
        complexId,
        schoolId: school.id,
        academicYearId,
        studentId: st1.id,
        classId: st1.classId,
        kind: 'reward',
        severity: 'minor',
        category: 'ادب و احترام به همکلاسی‌ها',
        title: 'عذرخواهی محترمانه و مشارکت فعال در تمرین گروهی',
        description: 'رفتار اصلاحی بسیار مثبت در روز بعد مشاهده شد.',
        jalaliDate: today,
        pointsDelta: 0.5,
        visibleToParentStudent: true,
        recordedByUserId: `user-teacher-${t0.id}`,
        recordedByName: t0.fullName,
        recordedByRole: 'teacher',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
    );

    // Discipline Pledge linked to critical infraction
    discipline_pledges.push({
      id: `pledge-${school.id}-1`,
      complexId,
      schoolId: school.id,
      academicYearId,
      studentId: st1.id,
      classId: st1.classId,
      relatedRecordId: `disc-${school.id}-3`,
      title: 'تعهدنامه رعایت نظم کلاسی و مقررات انضباطی',
      bodyText: buildDefaultPledgeTextFa({
        studentName: st1.fullName,
        className: cls1.name,
        schoolName: school.name,
        reasonTitle: 'ایجاد اختلال جدی در روند تدریس زنگ دوم',
        jalaliDate: twoDaysAgo,
      }),
      issuedAtJalali: twoDaysAgo,
      issuedByUserId: `user-deputy-${school.id}`,
      issuedByName: 'معاون اجرایی مدرسه',
      status: 'pending_parent',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    });

    // 2. Student Exit Passes & Staff Leave Requests
    student_exit_passes.push(
      {
        id: `exit-${school.id}-1`,
        complexId,
        schoolId: school.id,
        academicYearId,
        trackingCode: `EX-1405-${(sIdx + 1) * 1000 + 214}`,
        studentId: st2.id,
        classId: st2.classId,
        jalaliDate: today,
        reasonCategory: 'medical',
        reasonDetail: 'نوبت معاینه دندان‌پزشکی با اطلاع قبلی ولی',
        plannedExitTimeHm: '10:30',
        expectedReturnTimeHm: '12:15',
        pickupPersonName: st2.parentName,
        pickupRelation: sIdx === 1 ? 'مادر' : 'پدر',
        pickupNationalId: '0074521893',
        parentVerified: true,
        requestedByRole: 'deputy',
        requestedByName: 'معاون اجرایی مدرسه',
        approvedByName: school.principalName,
        status: 'approved',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `exit-${school.id}-2`,
        complexId,
        schoolId: school.id,
        academicYearId,
        trackingCode: `EX-1405-${(sIdx + 1) * 1000 + 219}`,
        studentId: st0.id,
        classId: st0.classId,
        jalaliDate: today,
        reasonCategory: 'family',
        reasonDetail: 'مراسم خانوادگی — درخواست ثبت‌شده توسط ولی',
        plannedExitTimeHm: '11:45',
        pickupPersonName: st0.parentName,
        pickupRelation: 'پدر',
        parentVerified: true,
        requestedByRole: 'parent',
        requestedByName: st0.parentName,
        status: 'requested',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
    );

    staff_leave_requests.push(
      {
        id: `leave-${school.id}-1`,
        complexId,
        schoolId: school.id,
        academicYearId,
        staffUserId: `user-teacher-${t0.id}`,
        staffName: t0.fullName,
        staffRole: 'teacher',
        linkedTeacherId: t0.id,
        leaveType: 'hourly',
        jalaliDate: today,
        startTimeHm: '10:30',
        endTimeHm: '12:30',
        durationHours: 2,
        reason: 'مراجعه به اداره آموزش و پرورش جهت پیگیری پرونده ضمن‌خدمت',
        suggestedSubstituteTeacherId: t1.id,
        suggestedSubstituteTeacherName: t1.fullName,
        status: 'pending',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `leave-${school.id}-2`,
        complexId,
        schoolId: school.id,
        academicYearId,
        staffUserId: `user-teacher-${t1.id}`,
        staffName: t1.fullName,
        staffRole: 'teacher',
        linkedTeacherId: t1.id,
        leaveType: 'daily',
        jalaliDate: fiveDaysAgo,
        reason: 'مرخصی استحقاقی روزانه با هماهنگی قبلی',
        status: 'approved',
        reviewedByName: school.principalName,
        reviewedAtJalali: fiveDaysAgo,
        principalReviewNote: 'با پوشش کلاس توسط همکار جایگزین موافقت شد.',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
    );

    // 3. Confidential Counseling Sessions (Layer 2) & Clinical Notes (Layer 1)
    const sessionId1 = `cns-sess-${school.id}-1`;
    const sessionId2 = `cns-sess-${school.id}-2`;

    counseling_sessions.push(
      {
        id: sessionId1,
        complexId,
        schoolId: school.id,
        academicYearId,
        studentId: st1.id,
        classId: st1.classId,
        jalaliDate: twoDaysAgo,
        timeHm: '09:30',
        mode: 'in_person',
        status: 'completed',
        requestedByRole: 'teacher',
        requestedByName: t0.fullName,
        isReferral: true,
        referredByUserId: `user-teacher-${t0.id}`,
        referralReason: 'کاهش تمرکز در زنگ‌های ریاضی و اضطراب پیش از پرسش شفاهی',
        counselorUserId: `user-counselor-${school.id}`,
        counselorName:
          school.id === 'school-1'
            ? 'دکتر مریم کاظمی (مشاور مدرسه)'
            : school.id === 'school-2'
              ? 'خانم سارا نادری (مشاور مدرسه)'
              : 'دکتر محمدرضا حسینی (مشاور مدرسه)',
        followUpDateJalali: today, // Triggers counselor follow-up alert dot right away!
        sharedAdviceText:
          'توصیه می‌شود در دو هفته آینده به جای پرسش شفاهی ناگهانی، فرصت آمادگی ۵ دقیقه‌ای به دانش‌آموز داده شود و در منزل برنامه خواب منظم ساعت ۲۱:۳۰ رعایت گردد.',
        shareWithParent: true,
        shareWithTeacher: true,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: sessionId2,
        complexId,
        schoolId: school.id,
        academicYearId,
        studentId: st3.id,
        classId: st3.classId,
        jalaliDate: tomorrow,
        timeHm: '10:45',
        mode: 'phone',
        status: 'requested',
        requestedByRole: 'parent',
        requestedByName: st3.parentName,
        isReferral: false,
        referralReason: 'درخواست راهنمایی جهت برنامه‌ریزی مطالعاتی نیمسال دوم',
        counselorUserId: `user-counselor-${school.id}`,
        counselorName:
          school.id === 'school-1'
            ? 'دکتر مریم کاظمی (مشاور مدرسه)'
            : school.id === 'school-2'
              ? 'خانم سارا نادری (مشاور مدرسه)'
              : 'دکتر محمدرضا حسینی (مشاور مدرسه)',
        shareWithParent: false,
        shareWithTeacher: false,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
    );

    counseling_clinical_notes.push({
      id: `cns-clin-${school.id}-1`,
      complexId,
      schoolId: school.id,
      academicYearId,
      sessionId: sessionId1,
      studentId: st1.id,
      counselorUserId: `user-counselor-${school.id}`,
      counselorName:
        school.id === 'school-1'
          ? 'دکتر مریم کاظمی (مشاور مدرسه)'
          : school.id === 'school-2'
            ? 'خانم سارا نادری (مشاور مدرسه)'
            : 'دکتر محمدرضا حسینی (مشاور مدرسه)',
      clinicalSummary:
        'ارزیابی اولیه نشان‌دهنده اضطراب عملکردی خفیف ناشی از کمال‌گرایی و مقایسه با خواهر/برادر بزرگ‌تر است. ارتباط درمانی مطلوب شکل گرفت و تکنیک تنفس آرام‌بخش آموزش داده شد.',
      riskLevel: 'low',
      privateActionPlan:
        'برگزاری جلسه پیگیری ۱۵ دقیقه‌ای امروز و دعوت از ولی برای گفت‌وگوی حمایتی بدون برچسب‌زنی.',
      lastUpdatedAtJalali: twoDaysAgo,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    });

    // 4. Virtual Class Hub Sessions & Attendance (1 LIVE, 1 SOON, 1 ENDED with Recording + Handout synced to SubjectsHub)
    const liveVcId = `vc-${school.id}-live`;
    const soonVcId = `vc-${school.id}-soon`;
    const archivedVcId = `vc-${school.id}-archived`;

    virtual_class_sessions.push(
      {
        id: liveVcId,
        complexId,
        schoolId: school.id,
        academicYearId,
        title: 'کلاس زنده حل تمرین و رفع اشکال فصل کسرها',
        classId: cls0.id,
        subject: 'ریاضی',
        teacherId: t0.id,
        teacherName: t0.fullName,
        platform: 'skyroom',
        joinUrl: `https://www.skyroom.online/ch/golestan/${school.id}-math-live`,
        jalaliDate: today,
        startTimeHm: liveStartHm,
        durationMinutes: 60,
        description: 'ورود دانش‌آموزان همراه با دفتر تمرین الزامی است. حضور هوشمند با کلیک ثبت می‌شود.',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: soonVcId,
        complexId,
        schoolId: school.id,
        academicYearId,
        title: 'کارگاه آزمایشگاه مجازی علوم تجربی',
        classId: cls0.id,
        subject: 'علوم تجربی',
        teacherId: t1.id,
        teacherName: t1.fullName,
        platform: 'bigbluebutton',
        joinUrl: `https://bbb.golestan-edu.ir/rooms/${school.id}-science`,
        jalaliDate: today,
        startTimeHm: soonStartHm,
        durationMinutes: 45,
        description: 'بررسی شبیه‌سازی چرخه آب و پرسش و پاسخ زنده.',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: archivedVcId,
        complexId,
        schoolId: school.id,
        academicYearId,
        title: 'مرور جامع جمع‌بندی فصل اعداد و الگوها',
        classId: cls0.id,
        subject: 'ریاضی',
        teacherId: t0.id,
        teacherName: t0.fullName,
        platform: 'adobe_connect',
        joinUrl: `https://connect.golestan-edu.ir/${school.id}-math-review`,
        jalaliDate: twoDaysAgo,
        startTimeHm: '16:00',
        durationMinutes: 50,
        description: 'جلسه ضبط‌شده همراه با جزوه جمع‌بندی PDF در صفحه درس ریاضی آرشیو شده است.',
        recordingUrl: `https://archive.golestan-edu.ir/videos/${school.id}-math-review.mp4`,
        recordingTitle: 'فیلم کامل کلاس مجازی مرور فصل اعداد و الگوها',
        handoutUrl: `https://archive.golestan-edu.ir/handouts/${school.id}-math-review.pdf`,
        handoutTitle: 'جزوه نکات کلیدی و تمرین‌های تکمیلی ریاضی (PDF)',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
    );

    // Seed click-to-join attendance for live & archived sessions
    virtual_class_attendance.push(
      {
        id: `vcatt-${liveVcId}-${st0.id}`,
        complexId,
        schoolId: school.id,
        academicYearId,
        sessionId: liveVcId,
        classId: cls0.id,
        studentId: st0.id,
        studentName: st0.fullName,
        joinedAtIso: nowIso,
        joinedAtJalali: today,
        joinedAtTimeHm: liveStartHm,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `vcatt-${archivedVcId}-${st0.id}`,
        complexId,
        schoolId: school.id,
        academicYearId,
        sessionId: archivedVcId,
        classId: cls0.id,
        studentId: st0.id,
        studentName: st0.fullName,
        joinedAtIso: nowIso,
        joinedAtJalali: twoDaysAgo,
        joinedAtTimeHm: '16:02',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: `vcatt-${archivedVcId}-${st1.id}`,
        complexId,
        schoolId: school.id,
        academicYearId,
        sessionId: archivedVcId,
        classId: cls0.id,
        studentId: st1.id,
        studentName: st1.fullName,
        joinedAtIso: nowIso,
        joinedAtJalali: twoDaysAgo,
        joinedAtTimeHm: '16:04',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
    );
  });

  return {
    discipline_records,
    discipline_pledges,
    student_exit_passes,
    staff_leave_requests,
    counseling_sessions,
    counseling_clinical_notes,
    virtual_class_sessions,
    virtual_class_attendance,
  };
}
