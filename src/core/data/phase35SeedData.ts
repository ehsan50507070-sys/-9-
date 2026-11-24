// Phase 3.5 Deterministic Seed Data Generator: Private Parent-Staff Chat Demo Conversations
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import type {
  ClassRoom,
  ParentStaffMessage,
  School,
  Student,
  Teacher,
} from '../../types/domain';

export const PHASE35_PLUGIN_IDS = ['parent-staff-chat'] as const;

export interface Phase35SeedSlice {
  parent_staff_messages: ParentStaffMessage[];
}

export function generatePhase35SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
}): Phase35SeedSlice {
  const { schools, classes, students, teachers } = params;
  const parent_staff_messages: ParentStaffMessage[] = [];

  const school1 = schools.find((s) => s.id === 'school-1') ?? schools[0];
  if (!school1) {
    return { parent_staff_messages };
  }

  const s1Classes = classes.filter((c) => c.schoolId === school1.id);
  const firstClass = s1Classes[0];
  const firstStudent = students.find((s) => s.schoolId === school1.id && (!firstClass || s.classId === firstClass.id))
    ?? students.find((s) => s.schoolId === school1.id);
  const secondStudent = students.find(
    (s) => s.schoolId === school1.id && firstStudent && s.id !== firstStudent.id
  );

  if (!firstStudent) {
    return { parent_staff_messages };
  }

  const studentClass = classes.find((c) => c.id === firstStudent.classId) ?? firstClass;
  const homeroomTeacher =
    teachers.find((t) => t.id === studentClass?.homeroomTeacherId) ??
    teachers.find((t) => t.schoolId === school1.id && t.assignedClassIds.includes(firstStudent.classId)) ??
    teachers.find((t) => t.schoolId === school1.id);

  const today = getTodayJalali();
  const yesterday = addDaysToJalali(today, -1);
  const twoDaysAgo = addDaysToJalali(today, -2);
  const baseTime = Date.now() - 1000 * 60 * 60 * 30;

  // Conversation 1 (school-1): Parent <-> Homeroom Teacher (Math Progress)
  parent_staff_messages.push(
    {
      id: `${school1.id}:pchat:seed-1`,
      schoolId: school1.id,
      studentId: firstStudent.id,
      classId: firstStudent.classId,
      channelType: 'teacher',
      targetTeacherId: homeroomTeacher?.id,
      senderRole: 'parent',
      senderUserId: `user-parent-${firstStudent.id}`,
      senderName: `ولی ${firstStudent.fullName} (${firstStudent.parentName})`,
      text: `سلام و عرض ادب استاد گرامی. درباره پیشرفت ${firstStudent.fullName} در فصل کسرها و تمرین‌های ریاضی این هفته سوال داشتم؛ آیا نیاز به تمرین اضافه در منزل دارد؟`,
      jalaliDate: twoDaysAgo,
      timeText: '16:20',
      createdAt: new Date(baseTime).toISOString(),
      readByParent: true,
      readByStaff: true,
    },
    {
      id: `${school1.id}:pchat:seed-2`,
      schoolId: school1.id,
      studentId: firstStudent.id,
      classId: firstStudent.classId,
      channelType: 'teacher',
      targetTeacherId: homeroomTeacher?.id,
      senderRole: 'teacher',
      senderUserId: homeroomTeacher ? `user-teacher-${homeroomTeacher.id}` : 'user-teacher-default',
      senderName: homeroomTeacher?.fullName ?? 'معلم کلاس',
      text: `سلام و احترام. خوشبختانه ${firstStudent.fullName} ویدیوی کلاس وارونه را با دقت تماشا کرده و در آزمونک نمره بسیار خوبی گرفته است. فقط مرور ۳ مسئله صفحه‌ی ۴۲ کتاب در منزل کمک می‌کند تسلط کامل‌تری پیدا کند.`,
      jalaliDate: yesterday,
      timeText: '09:45',
      createdAt: new Date(baseTime + 1000 * 60 * 60 * 16).toISOString(),
      readByParent: false,
      readByStaff: true,
    }
  );

  // Conversation 2 (school-1): Parent <-> School Principal (School Inquiry)
  parent_staff_messages.push(
    {
      id: `${school1.id}:pchat:seed-3`,
      schoolId: school1.id,
      studentId: firstStudent.id,
      classId: firstStudent.classId,
      channelType: 'principal',
      senderRole: 'parent',
      senderUserId: `user-parent-${firstStudent.id}`,
      senderName: `ولی ${firstStudent.fullName} (${firstStudent.parentName})`,
      text: 'سلام جناب مدیر محترم. درباره ساعت دقیق برگزاری جلسه اولیا و مربیان هفته آینده و نحوه دریافت کارنامه ماهانه سوال داشتم.',
      jalaliDate: yesterday,
      timeText: '11:15',
      createdAt: new Date(baseTime + 1000 * 60 * 60 * 18).toISOString(),
      readByParent: true,
      readByStaff: true,
    },
    {
      id: `${school1.id}:pchat:seed-4`,
      schoolId: school1.id,
      studentId: firstStudent.id,
      classId: firstStudent.classId,
      channelType: 'principal',
      senderRole: 'principal',
      senderUserId: `user-principal-${school1.id}`,
      senderName: school1.principalName,
      text: 'با سلام و تشکر از پیگیری ارزشمند شما. جلسه اولیا روز چهارشنبه ساعت ۱۰:۳۰ در سالن اجتماعات برگزار می‌شود و کارنامه توصیفی نیز از همین سامانه قابل مشاهده و چاپ (A4 و A5) است.',
      jalaliDate: today,
      timeText: '08:30',
      createdAt: new Date(baseTime + 1000 * 60 * 60 * 27).toISOString(),
      readByParent: false,
      readByStaff: true,
    }
  );

  // Additional unread parent inquiry for teacher/principal inbox realism (2nd student in school-1)
  if (secondStudent) {
    const secondClass = classes.find((c) => c.id === secondStudent.classId);
    const secondTeacher =
      teachers.find((t) => t.id === secondClass?.homeroomTeacherId) ?? homeroomTeacher;
    parent_staff_messages.push({
      id: `${school1.id}:pchat:seed-5`,
      schoolId: school1.id,
      studentId: secondStudent.id,
      classId: secondStudent.classId,
      channelType: 'teacher',
      targetTeacherId: secondTeacher?.id,
      senderRole: 'parent',
      senderUserId: `user-parent-${secondStudent.id}`,
      senderName: `ولی ${secondStudent.fullName} (${secondStudent.parentName})`,
      text: `با سلام استاد گرامی، لطفاً زمان تحویل پروژه عملی علوم این هفته را برای ${secondStudent.fullName} بفرمایید.`,
      jalaliDate: today,
      timeText: '09:10',
      createdAt: new Date(baseTime + 1000 * 60 * 60 * 28).toISOString(),
      readByParent: true,
      readByStaff: false,
    });
  }

  return { parent_staff_messages };
}
