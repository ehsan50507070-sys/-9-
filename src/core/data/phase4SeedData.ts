// Phase 4 Deterministic Seed Data Generator (school-1 ONLY when each respective store is empty)
// Covers: class-chat (welcome announcement + active poll), appointments (4 slots: 1 booked + 3 open),
// electronic-forms (1 active field-trip consent form), notification-templates (6 polished Persian templates).
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import type {
  AppointmentSlot,
  ClassChatMessage,
  ClassChatRoomConfig,
  ClassRoom,
  ElectronicForm,
  ElectronicFormResponse,
  NotificationTemplate,
  School,
  Student,
  Teacher,
} from '../../types/domain';

export const PHASE4_PLUGIN_IDS = [
  'parent-portal',
  'class-chat',
  'appointments',
  'electronic-forms',
  'notification-templates',
] as const;

export interface Phase4SeedSlice {
  class_chat_rooms: ClassChatRoomConfig[];
  class_chat_messages: ClassChatMessage[];
  appointment_slots: AppointmentSlot[];
  electronic_forms: ElectronicForm[];
  electronic_form_responses: ElectronicFormResponse[];
  notification_templates: NotificationTemplate[];
}

export function generatePhase4SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
}): Phase4SeedSlice {
  const { schools, classes, students, teachers } = params;
  const class_chat_rooms: ClassChatRoomConfig[] = [];
  const class_chat_messages: ClassChatMessage[] = [];
  const appointment_slots: AppointmentSlot[] = [];
  const electronic_forms: ElectronicForm[] = [];
  const electronic_form_responses: ElectronicFormResponse[] = [];
  const notification_templates: NotificationTemplate[] = [];

  const school1 = schools.find((s) => s.id === 'school-1') ?? schools[0];
  if (!school1) {
    return {
      class_chat_rooms,
      class_chat_messages,
      appointment_slots,
      electronic_forms,
      electronic_form_responses,
      notification_templates,
    };
  }

  const s1Classes = classes.filter((c) => c.schoolId === school1.id);
  const firstClass = s1Classes[0];
  const firstStudent =
    students.find((s) => s.schoolId === school1.id && (!firstClass || s.classId === firstClass.id)) ??
    students.find((s) => s.schoolId === school1.id);
  const secondStudent = students.find(
    (s) => s.schoolId === school1.id && firstClass && s.classId === firstClass.id && s.id !== firstStudent?.id
  );
  const homeroomTeacher =
    teachers.find((t) => t.id === firstClass?.homeroomTeacherId) ??
    teachers.find((t) => t.schoolId === school1.id && firstClass && t.assignedClassIds.includes(firstClass.id)) ??
    teachers.find((t) => t.schoolId === school1.id);

  const today = getTodayJalali();
  const tomorrow = addDaysToJalali(today, 1);
  const nextWeek = addDaysToJalali(today, 5);
  const nowIso = new Date().toISOString();
  const baseMs = Date.now() - 1000 * 60 * 60 * 6;

  // 1. Class Chat: 1 welcome announcement + 1 active class poll in the main seeded class of school-1
  if (firstClass && homeroomTeacher) {
    class_chat_rooms.push({
      id: `${school1.id}:room:${firstClass.id}`,
      schoolId: school1.id,
      classId: firstClass.id,
      mode: 'open',
      updatedBy: homeroomTeacher.fullName,
      updatedAt: nowIso,
    });

    class_chat_messages.push(
      {
        id: `${school1.id}:cchat:seed-welcome`,
        schoolId: school1.id,
        classId: firstClass.id,
        kind: 'announcement',
        senderRole: 'teacher',
        senderUserId: `user-teacher-${homeroomTeacher.id}`,
        senderName: homeroomTeacher.fullName,
        text: `سلام و خوش‌آمدگویی به دانش‌آموزان عزیز و اولیای گرامی ${firstClass.name} 🌷\nاین کانال برای هماهنگی‌های آموزشی، تمرین‌های هفتگی و اطلاعیه‌های فوری کلاس ایجاد شده است. لطفاً تمرین‌های این هفته را با آرامش و برنامه‌ریزی منظم دنبال بفرمایید.`,
        jalaliDate: today,
        timeText: '08:15',
        createdAt: new Date(baseMs).toISOString(),
      },
      {
        id: `${school1.id}:cchat:seed-poll`,
        schoolId: school1.id,
        classId: firstClass.id,
        kind: 'poll',
        senderRole: 'teacher',
        senderUserId: `user-teacher-${homeroomTeacher.id}`,
        senderName: homeroomTeacher.fullName,
        text: 'نظرسنجی انتخاب زمان جلسه رفع اشکال ریاضی این هفته',
        poll: {
          question: 'بهترین زمان برای برگزاری جلسه آنلاین رفع اشکال فصل کسرها چه ساعتی است؟',
          options: [
            {
              id: 'opt-1',
              text: 'سه‌شنبه ساعت ۱۶:۳۰ تا ۱۷:۱۵',
              voterUserIds: secondStudent ? [`user-parent-${secondStudent.id}`] : [],
            },
            {
              id: 'opt-2',
              text: 'چهارشنبه ساعت ۱۷:۰۰ تا ۱۷:۴۵',
              voterUserIds: [],
            },
            {
              id: 'opt-3',
              text: 'پنج‌شنبه ساعت ۱۰:۳۰ صبح',
              voterUserIds: [],
            },
          ],
          closed: false,
        },
        jalaliDate: today,
        timeText: '09:05',
        createdAt: new Date(baseMs + 1000 * 60 * 50).toISOString(),
      }
    );
  }

  // 2. Appointments: 4 time slots for seeded teacher (1 already booked for seeded student + 3 open)
  if (homeroomTeacher && firstClass) {
    const slotDefs: Array<{
      idx: number;
      startTime: string;
      endTime: string;
      meetingType: AppointmentSlot['meetingType'];
      booked: boolean;
    }> = [
      { idx: 1, startTime: '10:00', endTime: '10:20', meetingType: 'in_person', booked: true },
      { idx: 2, startTime: '10:20', endTime: '10:40', meetingType: 'in_person', booked: false },
      { idx: 3, startTime: '10:40', endTime: '11:00', meetingType: 'online', booked: false },
      { idx: 4, startTime: '11:00', endTime: '11:20', meetingType: 'phone', booked: false },
    ];

    for (const def of slotDefs) {
      const isBooked = def.booked && Boolean(firstStudent);
      appointment_slots.push({
        id: `${school1.id}:appt:seed-${def.idx}`,
        schoolId: school1.id,
        staffUserId: `user-teacher-${homeroomTeacher.id}`,
        staffName: homeroomTeacher.fullName,
        staffRole: 'teacher',
        linkedTeacherId: homeroomTeacher.id,
        targetClassIds: [firstClass.id],
        jalaliDate: tomorrow,
        startTime: def.startTime,
        endTime: def.endTime,
        durationMinutes: 20,
        meetingType: def.meetingType,
        staffNote: 'جلسه فردی بررسی روند پیشرفت تحصیلی و مهارتی دانش‌آموز',
        status: isBooked ? 'booked' : 'open',
        bookedByParentUserId: isBooked && firstStudent ? `user-parent-${firstStudent.id}` : undefined,
        bookedStudentId: isBooked && firstStudent ? firstStudent.id : undefined,
        bookedClassId: isBooked && firstStudent ? firstStudent.classId : undefined,
        bookedParentName: isBooked && firstStudent ? firstStudent.parentName : undefined,
        bookingTopic: isBooked
          ? 'بررسی پیشرفت ریاضی، نتیجه کلاس وارونه و برنامه‌ریزی تمرین‌های منزل'
          : undefined,
        bookedAtIso: isBooked ? new Date(baseMs + 1000 * 60 * 90).toISOString() : undefined,
        updatedAt: nowIso,
      });
    }
  }

  // 3. Electronic Forms: 1 active field trip consent form targeting the seeded class in school-1
  if (firstClass) {
    electronic_forms.push({
      id: `${school1.id}:eform:seed-bagh-ketab`,
      schoolId: school1.id,
      presetType: 'field_trip',
      title: 'رضایت‌نامه اردوی علمی باغ کتاب',
      bodyText:
        'ولی گرامی، بدین‌وسیله به اطلاع می‌رساند اردوی علمی و فرهنگی بازدید از «باغ کتاب تهران» همراه با کارگاه خلاقیت و آزمایشگاه علوم ویژه دانش‌آموزان کلاس در تاریخ مقرر با حضور مربیان و سرویس ایمن مدرسه برگزار می‌گردد. خواهشمند است در صورت موافقت با شرکت فرزندتان، پرسش‌های زیر را تکمیل و رضایت‌نامه را به‌صورت دیجیتال امضا فرمایید.',
      targetAudience: 'specific_classes',
      targetClassIds: [firstClass.id],
      deadlineJalali: nextWeek,
      requireSignature: true,
      fields: [
        {
          id: 'fld-allergy',
          label: 'آیا دانش‌آموز حساسیت غذایی یا دارویی خاصی دارد؟ (در صورت وجود ذکر فرمایید)',
          type: 'short_text',
          required: false,
        },
        {
          id: 'fld-transport',
          label: 'نحوه بازگشت دانش‌آموز پس از پایان اردو',
          type: 'single_choice',
          required: true,
          options: ['با سرویس رسمی مدرسه', 'تحویل حضوری توسط ولی در مدرسه'],
        },
        {
          id: 'fld-confirm',
          label: 'موافقت کامل با شرایط ایمنی و حضور دانش‌آموز در اردوی علمی باغ کتاب',
          type: 'yes_no',
          required: true,
        },
      ],
      active: true,
      createdByName: school1.principalName,
      createdByRole: 'principal',
      createdAt: new Date(baseMs).toISOString(),
      updatedAt: nowIso,
    });
  }

  // 4. Notification Templates: 6 polished, respectful Persian templates for school-1
  const templateBlueprints: Array<{
    key: string;
    category: NotificationTemplate['category'];
    title: string;
    body: string;
  }> = [
    {
      key: 'absence',
      category: 'absence_late',
      title: 'اطلاع‌رسانی غیبت روزانه دانش‌آموز',
      body: `سلام و عرض ادب ولی گرامی {نام_دانشآموز}\n🏫 {نام_مدرسه} — {نام_کلاس}\n📅 تاریخ: {تاریخ_امروز}\n\nبدین‌وسیله به اطلاع می‌رساند فرزند عزیز شما امروز در کلاس حضور نداشته‌اند. لطفاً در صورت موجه بودن غیبت یا نیاز به هماهنگی، از طریق سامانه یا تماس با دفتر مدرسه اطلاع دهید.\n📝 توضیحات: {توضیحات}\n\nبا احترام — {نام_معلم}`,
    },
    {
      key: 'late',
      category: 'absence_late',
      title: 'یادآوری محترمانه تاخیر ورود به مدرسه',
      body: `سلام و احترام خدمت ولی گرامی {نام_دانشآموز}\n🏫 {نام_مدرسه} — {نام_کلاس}\n📅 تاریخ: {تاریخ_امروز}\n\nفرزند گرامی شما امروز با تاخیر در آغاز زنگ اول حضور یافتند. با توجه به اهمیت آغاز منظم کلاس برای تمرکز دانش‌آموزان، از همکاری شما جهت حضور به‌موقع سپاسگزاریم.\n📝 توضیحات: {توضیحات}`,
    },
    {
      key: 'praise',
      category: 'praise',
      title: 'پیام تشویق و قدردانی از پیشرفت درسی',
      body: `🌟 پیام تبریک و تشویق آموزشی\nسلام و عرض ادب ولی گرامی {نام_دانشآموز}\n🏫 {نام_مدرسه} — {نام_کلاس}\n\nباعث افتخار است اعلام کنیم {نام_دانشآموز} در درس «{نام_درس}» تلاش بسیار ارزشمند و پیشرفت چشمگیری داشته است. از همراهی صمیمانه خانواده گرامی سپاسگزاریم.\n💬 یادداشت معلم: {توضیحات}\n\nبا احترام — {نام_معلم}`,
    },
    {
      key: 'homework',
      category: 'homework_exam',
      title: 'یادآوری تکلیف و آمادگی آزمون کلاسی',
      body: `📚 یادآوری تکلیف و آزمون کلاسی\n🏫 {نام_مدرسه} — {نام_کلاس}\n📅 تاریخ: {تاریخ_امروز}\n\nولی گرامی {نام_دانشآموز}، لطفاً پیگیری فرمایید تمرین‌های درس «{نام_درس}» تا موعد مقرر در سامانه ثبت یا در دفتر تمرین تکمیل شود.\n📌 جزئیات: {توضیحات}\n\nارادتمند — {نام_معلم}`,
    },
    {
      key: 'meeting',
      category: 'meeting_trip',
      title: 'دعوت‌نامه جلسه اولیا و مربیان / اردو',
      body: `🤝 دعوت‌نامه رسمی جلسه اولیا و مربیان\n🏫 {نام_مدرسه} — {نام_کلاس}\n📅 تاریخ ثبت: {تاریخ_امروز}\n\nولی گرامی {نام_دانشآموز}، از جنابعالی دعوت می‌شود جهت گفت‌وگو درباره روند پیشرفت تحصیلی و تربیتی فرزندتان در جلسه هماهنگ‌شده حضور به هم رسانید.\n📍 زمان و جزئیات: {توضیحات}\n\nمدیریت و کادر آموزشی {نام_مدرسه}`,
    },
    {
      key: 'general',
      category: 'general',
      title: 'اطلاعیه عمومی و برنامه‌های مدرسه',
      body: `📢 اطلاعیه مهم مدرسه\n🏫 {نام_مدرسه} — {نام_کلاس}\n📅 تاریخ: {تاریخ_امروز}\n\nاولیای گرامی و دانش‌آموزان عزیز، ضمن آرزوی سلامتی به استحضار می‌رساند:\n{توضیحات}\n\nبا تشکر از همراهی شما — {نام_مدرسه}`,
    },
  ];

  for (const tpl of templateBlueprints) {
    notification_templates.push({
      id: `${school1.id}:ntpl:seed-${tpl.key}`,
      schoolId: school1.id,
      category: tpl.category,
      title: tpl.title,
      body: tpl.body,
      isSystemPreset: true,
      createdByName: school1.principalName,
      updatedAt: nowIso,
    });
  }

  return {
    class_chat_rooms,
    class_chat_messages,
    appointment_slots,
    electronic_forms,
    electronic_form_responses,
    notification_templates,
  };
}
