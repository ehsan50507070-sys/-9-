// Pure Helper Functions for Private Parent-Staff Chat Plugin (Phase 3.5)
// Decoupled from React so all logic is unit-tested cleanly via node:test.
import { toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  ParentChatChannelType,
  ParentStaffMessage,
  RoleId,
  Student,
  Teacher,
} from '../../types/domain';

export interface ParentChatThreadSummary {
  threadKey: string; // `${studentId}:${channelType}`
  studentId: string;
  studentName: string;
  parentName: string;
  classId: string;
  className: string;
  channelType: ParentChatChannelType;
  channelLabelFa: string;
  counterpartName: string;
  targetTeacherId?: string;
  messages: ParentStaffMessage[];
  lastMessage?: ParentStaffMessage;
  unreadCount: number;
}

export const PARENT_CHAT_ROLE_LABELS: Record<Exclude<RoleId, 'student'>, string> = {
  super_admin: 'راهبر ارشد',
  parent: 'ولی',
  teacher: 'معلم',
  principal: 'مدیر مدرسه',
  deputy: 'معاون',
  counselor: 'مشاور مدرسه',
  complex_admin: 'مدیر کل',
};

export const PARENT_STARTER_PHRASES: readonly string[] = [
  'سلام و عرض ادب، درباره پیشرفت درسی و تکالیف فرزندم سوال داشتم.',
  'با سلام، لطفاً در صورت امکان درباره وضعیت حضور و غیاب یا آزمون اخیر راهنمایی بفرمایید.',
  'سلام و احترام، برای هماهنگی زمان ملاقات حضوری در مدرسه مزاحم شدم.',
  'با تشکر از زحمات شما، پیام قبلی دریافت و مطالعه شد.',
];

export const STAFF_STARTER_PHRASES: readonly string[] = [
  'سلام و عرض ادب، از پیگیری ارزشمند شما سپاسگزاریم. وضعیت دانش‌آموز بررسی شد و بسیار مطلوب است.',
  'با سلام، پیشنهاد می‌شود تمرین‌های فصل جاری با آرامش بیشتری در منزل مرور شود.',
  'سلام و احترام، در صورت تمایل روز چهارشنبه ساعت ۱۰ تا ۱۲ جهت گفت‌وگوی حضوری در خدمت هستیم.',
  'با سلام، یادداشت شما ثبت شد و در کلاس پیگیری خواهد شد.',
];

/**
 * Deterministic BroadcastChannel name per schoolId so live cross-tab sync stays isolated per school.
 */
export function getParentChatChannelName(schoolId: string): string {
  return `school_parent_chat_${schoolId}`;
}

export function getThreadKey(studentId: string, channelType: ParentChatChannelType): string {
  return `${studentId}:${channelType}`;
}

/**
 * Filters raw school messages strictly to what the active role is authorized to view.
 * - `student`: ALWAYS empty (strictly hidden!)
 * - `parent`: ONLY messages for own `linkedStudentId`
 * - `teacher`: ONLY `channelType === 'teacher'` messages for `teacherAssignedClassIds`
 * - `principal` / `deputy` / `complex_admin`: all `channelType === 'principal'` threads (and can optionally inspect management threads)
 */
export function filterMessagesForRole(params: {
  messages: ParentStaffMessage[];
  role: RoleId;
  linkedStudentId?: string;
  teacherAssignedClassIds?: string[];
}): ParentStaffMessage[] {
  const { messages, role, linkedStudentId, teacherAssignedClassIds = [] } = params;
  if (role === 'student') return [];
  if (role === 'parent') {
    if (!linkedStudentId) return [];
    return messages.filter((m) => m.studentId === linkedStudentId);
  }
  if (role === 'teacher') {
    return messages.filter(
      (m) => m.channelType === 'teacher' && teacherAssignedClassIds.includes(m.classId)
    );
  }
  // principal, deputy, complex_admin: management channel threads directed to school management
  return messages.filter((m) => m.channelType === 'principal');
}

/**
 * Computes unread message count for the active role's visible messages.
 */
export function computeUnreadParentChatCount(
  visibleMessages: ParentStaffMessage[],
  role: RoleId
): number {
  if (role === 'student') return 0;
  if (role === 'parent') {
    return visibleMessages.filter((m) => m.senderRole !== 'parent' && !m.readByParent).length;
  }
  return visibleMessages.filter((m) => m.senderRole === 'parent' && !m.readByStaff).length;
}

/**
 * Builds structured private 1-on-1 conversation threads for the active role.
 * - `parent`: always shows 2 private channels for their child: «گفت‌وگو با معلم کلاس» & «گفت‌وگو با مدیر مدرسه».
 * - `teacher`: shows threads for students in assigned classes (prioritizing active/unread threads, plus ability to start with any student in their class).
 * - `principal` / `deputy` / `complex_admin`: shows management threads (prioritizing active/unread threads, filterable by class/student).
 */
export function buildParentChatThreads(params: {
  role: RoleId;
  messages: ParentStaffMessage[];
  students: Student[];
  classes: ClassRoom[];
  teachers: Teacher[];
  teacherNameById: Record<string, string>;
  principalName: string;
  linkedStudent: Student | null;
}): ParentChatThreadSummary[] {
  const {
    role,
    messages,
    students,
    classes,
    teachers,
    teacherNameById,
    principalName,
    linkedStudent,
  } = params;

  if (role === 'student') return [];

  const classById = new Map(classes.map((c) => [c.id, c]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  const messagesByThread = new Map<string, ParentStaffMessage[]>();
  for (const msg of messages) {
    const key = getThreadKey(msg.studentId, msg.channelType);
    const list = messagesByThread.get(key) ?? [];
    list.push(msg);
    messagesByThread.set(key, list);
  }
  for (const list of messagesByThread.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const resolveTeacherForClass = (classId: string): { id?: string; name: string } => {
    const cls = classById.get(classId);
    if (cls?.homeroomTeacherId) {
      const tName =
        teacherById.get(cls.homeroomTeacherId)?.fullName ??
        teacherNameById[cls.homeroomTeacherId];
      if (tName) return { id: cls.homeroomTeacherId, name: tName };
    }
    const fallback = teachers.find((t) => t.assignedClassIds.includes(classId));
    if (fallback) return { id: fallback.id, name: fallback.fullName };
    return { name: 'معلم کلاس' };
  };

  if (role === 'parent') {
    if (!linkedStudent) return [];
    const cls = classById.get(linkedStudent.classId);
    const className = cls?.name ?? 'کلاس دانش‌آموز';
    const teacherInfo = resolveTeacherForClass(linkedStudent.classId);

    const channels: Array<{
      channelType: ParentChatChannelType;
      channelLabelFa: string;
      counterpartName: string;
      targetTeacherId?: string;
    }> = [
      {
        channelType: 'teacher',
        channelLabelFa: 'گفت‌وگو با معلم کلاس',
        counterpartName: teacherInfo.name,
        targetTeacherId: teacherInfo.id,
      },
      {
        channelType: 'principal',
        channelLabelFa: 'گفت‌وگو با مدیر مدرسه',
        counterpartName: principalName,
      },
    ];

    return channels.map((ch) => {
      const key = getThreadKey(linkedStudent.id, ch.channelType);
      const threadMsgs = messagesByThread.get(key) ?? [];
      const unreadCount = threadMsgs.filter(
        (m) => m.senderRole !== 'parent' && !m.readByParent
      ).length;
      return {
        threadKey: key,
        studentId: linkedStudent.id,
        studentName: linkedStudent.fullName,
        parentName: linkedStudent.parentName,
        classId: linkedStudent.classId,
        className,
        channelType: ch.channelType,
        channelLabelFa: ch.channelLabelFa,
        counterpartName: ch.counterpartName,
        targetTeacherId: ch.targetTeacherId,
        messages: threadMsgs,
        lastMessage: threadMsgs[threadMsgs.length - 1],
        unreadCount,
      };
    });
  }

  // Staff view (`teacher` -> 'teacher' channel; `principal`/`deputy`/`complex_admin` -> 'principal' channel)
  const targetChannel: ParentChatChannelType = role === 'teacher' ? 'teacher' : 'principal';
  const activeStudents = students.filter((s) => s.active);
  const threads: ParentChatThreadSummary[] = activeStudents.map((st) => {
    const cls = classById.get(st.classId);
    const key = getThreadKey(st.id, targetChannel);
    const threadMsgs = messagesByThread.get(key) ?? [];
    const unreadCount = threadMsgs.filter(
      (m) => m.senderRole === 'parent' && !m.readByStaff
    ).length;
    const teacherInfo = resolveTeacherForClass(st.classId);
    return {
      threadKey: key,
      studentId: st.id,
      studentName: st.fullName,
      parentName: st.parentName,
      classId: st.classId,
      className: cls?.name ?? 'کلاس',
      channelType: targetChannel,
      channelLabelFa:
        targetChannel === 'teacher' ? 'گفت‌وگوی اولیا با معلم کلاس' : 'گفت‌وگوی اولیا با مدیریت مدرسه',
      counterpartName: `ولی ${st.fullName} (${st.parentName})`,
      targetTeacherId: targetChannel === 'teacher' ? teacherInfo.id : undefined,
      messages: threadMsgs,
      lastMessage: threadMsgs[threadMsgs.length - 1],
      unreadCount,
    };
  });

  // Sort: unread first, then threads with messages by newest timestamp, then alphabetically
  return threads.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    const aTime = a.lastMessage?.createdAt ?? '';
    const bTime = b.lastMessage?.createdAt ?? '';
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    return a.studentName.localeCompare(b.studentName, 'fa');
  });
}

/**
 * Formats a private conversation thread into a crisp single-column summary ready for Eitaa, Bale, and Shad.
 */
export function formatChatSummaryMessenger(params: {
  schoolName: string;
  thread: ParentChatThreadSummary;
}): string {
  const { schoolName, thread } = params;
  const lines: string[] = [
    `📌 خلاصه مکالمه اختصاصی اولیا و مدرسه`,
    `🏫 ${schoolName}`,
    `👤 دانش‌آموز: ${thread.studentName} (${thread.className})`,
    `👨‍👩‍👧 ولی: ${thread.parentName}`,
    `💬 کانال: ${thread.channelLabelFa}`,
    `────────────────────`,
  ];

  if (thread.messages.length === 0) {
    lines.push('هنوز پیامی در این گفت‌وگو ثبت نشده است.');
  } else {
    for (const msg of thread.messages) {
      const roleLabel = PARENT_CHAT_ROLE_LABELS[msg.senderRole];
      lines.push(
        `• [${roleLabel} — ${msg.senderName}] (${toPersianDigits(msg.jalaliDate)} ساعت ${toPersianDigits(msg.timeText)}):`
      );
      lines.push(`  ${msg.text}`);
    }
  }

  lines.push(`────────────────────`);
  lines.push(`سامانه مدیریت هوشمند مدارس`);
  return lines.join('\n');
}
