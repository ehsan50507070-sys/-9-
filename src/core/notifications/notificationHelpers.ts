// Step 3: Internal Notification Center Computation Engine
// Computes reactive unread messages, pending unsubmitted homework (persisting until submitted),
// unread school/subject announcements, and smart Teacher Homework Submission Trackers.
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { getDueCounselingFollowUps } from '../../services/phase9c/counselingService';
import type {
  ClassChatMessage,
  ClassRoom,
  CounselingSession,
  HomeworkAssignment,
  HomeworkSubmission,
  NotificationReadReceipt,
  ParentStaffMessage,
  RoleId,
  SchoolAnnouncement,
  Student,
} from '../../types/domain';
import { buildSubjectRoute } from '../subjects/subjectHelpers';

export type InternalNotificationKind =
  | 'homework_pending'
  | 'teacher_homework_progress'
  | 'parent_message'
  | 'class_message'
  | 'announcement'
  | 'counseling_followup';

export interface InternalNotificationItem {
  id: string;
  readReceiptKey?: string; // If omitted (e.g., pending student homework), clears ONLY when underlying action completes
  kind: InternalNotificationKind;
  title: string;
  detail: string;
  route: string;
  jalaliDate: string;
  urgent: boolean;
  canDismissByRead: boolean;
}

export interface TeacherHomeworkTracker {
  assignmentId: string;
  title: string;
  subject: string;
  classId: string;
  className: string;
  dueDateJalali: string;
  submittedStudents: Array<{ id: string; fullName: string; submittedAtJalali: string }>;
  missingStudents: Array<{ id: string; fullName: string }>;
}

export interface ComputedNotificationCenterState {
  items: InternalNotificationItem[];
  totalUnreadCount: number;
  homeworkAlertCount: number;
  messagesAlertCount: number;
  announcementsAlertCount: number;
  sidebarBadges: Record<string, number>;
  teacherHomeworkTrackers: TeacherHomeworkTracker[];
}

export function computeInternalNotifications(params: {
  role: RoleId;
  userId: string;
  linkedStudentId?: string;
  linkedTeacherId?: string;
  classes: ClassRoom[];
  students: Student[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  parentStaffMessages: ParentStaffMessage[];
  classChatMessages: ClassChatMessage[];
  schoolAnnouncements: SchoolAnnouncement[];
  readReceipts: NotificationReadReceipt[];
  counselingSessions?: CounselingSession[];
}): ComputedNotificationCenterState {
  const {
    role,
    userId,
    linkedStudentId,
    linkedTeacherId,
    classes,
    students,
    homeworkAssignments,
    homeworkSubmissions,
    parentStaffMessages,
    classChatMessages,
    schoolAnnouncements,
    readReceipts,
    counselingSessions = [],
  } = params;

  const readKeys = new Set(
    readReceipts.filter((r) => r.userId === userId).map((r) => r.notificationKey)
  );
  const visibleClassIds = new Set(classes.map((c) => c.id));
  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

  const items: InternalNotificationItem[] = [];
  let homeworkAlertCount = 0;
  let parentMessagesUnread = 0;
  let classMessagesUnread = 0;
  let announcementsAlertCount = 0;
  const teacherHomeworkTrackers: TeacherHomeworkTracker[] = [];

  // 1. Homework notifications for Student & Parent (persists until student submits!)
  if ((role === 'student' || role === 'parent') && linkedStudentId) {
    const submittedIds = new Set(
      homeworkSubmissions
        .filter((s) => s.studentId === linkedStudentId)
        .map((s) => s.assignmentId)
    );
    const pendingAssignments = homeworkAssignments.filter(
      (hw) => visibleClassIds.has(hw.classId) && !submittedIds.has(hw.id)
    );
    homeworkAlertCount = pendingAssignments.length;

    for (const hw of pendingAssignments) {
      items.push({
        id: `notif-hw-${hw.id}`,
        kind: 'homework_pending',
        title:
          role === 'student'
            ? `تکلیف جدید درس ${hw.subject}: ${hw.title}`
            : `تکلیف ارسال‌نشده فرزندتان (${hw.subject}): ${hw.title}`,
        detail: `مهلت تحویل: ${toPersianDigits(hw.dueDateJalali)} · معلم: ${hw.teacherName} (تا زمان ارسال فعال می‌ماند)`,
        route: buildSubjectRoute(hw.subject, 'homework'),
        jalaliDate: hw.createdAtJalali,
        urgent: true,
        canDismissByRead: false,
      });
    }
  }

  // 2. Smart Homework Submission Trackers for Teachers (and Admins viewing school)
  if (role === 'teacher' || role === 'principal' || role === 'deputy') {
    const relevantAssignments =
      role === 'teacher' && linkedTeacherId
        ? homeworkAssignments.filter(
            (hw) => hw.teacherId === linkedTeacherId || visibleClassIds.has(hw.classId)
          )
        : homeworkAssignments.slice(0, 6);

    for (const hw of relevantAssignments) {
      const classStudents = students.filter((s) => s.active && s.classId === hw.classId);
      const subMap = new Map(
        homeworkSubmissions
          .filter((sub) => sub.assignmentId === hw.id)
          .map((sub) => [sub.studentId, sub])
      );

      const submittedStudents = classStudents
        .filter((s) => subMap.has(s.id))
        .map((s) => ({
          id: s.id,
          fullName: s.fullName,
          submittedAtJalali: subMap.get(s.id)?.submittedAtJalali ?? '',
        }));
      const missingStudents = classStudents
        .filter((s) => !subMap.has(s.id))
        .map((s) => ({ id: s.id, fullName: s.fullName }));

      teacherHomeworkTrackers.push({
        assignmentId: hw.id,
        title: hw.title,
        subject: hw.subject,
        classId: hw.classId,
        className: classNameMap.get(hw.classId) ?? 'کلاس',
        dueDateJalali: hw.dueDateJalali,
        submittedStudents,
        missingStudents,
      });

      if (role === 'teacher' && missingStudents.length > 0) {
        const key = `teacher-hw-track:${hw.id}:${submittedStudents.length}`;
        const isRead = readKeys.has(key);
        if (!isRead) {
          homeworkAlertCount += 1;
          items.push({
            id: `notif-thw-${hw.id}`,
            readReceiptKey: key,
            kind: 'teacher_homework_progress',
            title: `پیگیری تکلیف «${hw.title}» (${hw.subject})`,
            detail: `${toPersianDigits(submittedStudents.length)} تحویل داده‌اند · ${toPersianDigits(missingStudents.length)} نفر هنوز ارسال نکرده‌اند.`,
            route: buildSubjectRoute(hw.subject, 'homework'),
            jalaliDate: hw.dueDateJalali,
            urgent: missingStudents.length > 0,
            canDismissByRead: true,
          });
        }
      }
    }
  }

  // 3. Direct Parent-Staff Messages (persists until read/replied)
  if (role === 'parent' && linkedStudentId) {
    const unreadStaffReplies = parentStaffMessages.filter(
      (m) => m.studentId === linkedStudentId && m.senderRole !== 'parent' && !m.readByParent
    );
    parentMessagesUnread = unreadStaffReplies.length;
    for (const msg of unreadStaffReplies.slice(0, 6)) {
      items.push({
        id: `notif-pmsg-${msg.id}`,
        kind: 'parent_message',
        title: `پیام جدید از ${msg.senderName}`,
        detail: msg.text.slice(0, 90),
        route: '/parent-staff-chat',
        jalaliDate: msg.jalaliDate,
        urgent: true,
        canDismissByRead: false,
      });
    }
  } else if (role === 'teacher') {
    const unreadFromParents = parentStaffMessages.filter(
      (m) =>
        m.channelType === 'teacher' &&
        m.senderRole === 'parent' &&
        !m.readByStaff &&
        (visibleClassIds.has(m.classId) || (linkedTeacherId && m.targetTeacherId === linkedTeacherId))
    );
    parentMessagesUnread = unreadFromParents.length;
    for (const msg of unreadFromParents.slice(0, 6)) {
      items.push({
        id: `notif-tmsg-${msg.id}`,
        kind: 'parent_message',
        title: `پیام جدید از ولی (${msg.senderName})`,
        detail: msg.text.slice(0, 90),
        route: '/parent-staff-chat',
        jalaliDate: msg.jalaliDate,
        urgent: true,
        canDismissByRead: false,
      });
    }
  } else if (role === 'principal' || role === 'deputy' || role === 'complex_admin' || role === 'super_admin') {
    const unreadPrincipalMsgs = parentStaffMessages.filter(
      (m) => m.senderRole === 'parent' && !m.readByStaff && m.channelType === 'principal'
    );
    parentMessagesUnread = unreadPrincipalMsgs.length;
    for (const msg of unreadPrincipalMsgs.slice(0, 6)) {
      items.push({
        id: `notif-amsg-${msg.id}`,
        kind: 'parent_message',
        title: `پیام اولیا خطاب به مدیریت (${msg.senderName})`,
        detail: msg.text.slice(0, 90),
        route: '/parent-staff-chat',
        jalaliDate: msg.jalaliDate,
        urgent: true,
        canDismissByRead: false,
      });
    }
  }

  // 4. Class Chat unread messages (authored by others, not yet read by current user)
  const unreadClassMsgs = classChatMessages.filter((m) => {
    if (!visibleClassIds.has(m.classId)) return false;
    if (m.senderUserId === userId) return false;
    return !readKeys.has(`cmsg:${m.id}`);
  });
  classMessagesUnread = unreadClassMsgs.length;
  for (const cmsg of unreadClassMsgs.slice(0, 5)) {
    items.push({
      id: `notif-cmsg-${cmsg.id}`,
      readReceiptKey: `cmsg:${cmsg.id}`,
      kind: 'class_message',
      title: `پیام جدید در گفت‌وگوی ${classNameMap.get(cmsg.classId) ?? 'کلاس'}`,
      detail: `${cmsg.senderName}: ${cmsg.text.slice(0, 80)}`,
      route: '/class-chat',
      jalaliDate: cmsg.jalaliDate,
      urgent: false,
      canDismissByRead: true,
    });
  }

  // 5. School & Subject Announcements
  const unreadAnnouncements = schoolAnnouncements.filter((ann) => {
    if (ann.audienceRoles.length > 0 && !ann.audienceRoles.includes(role)) return false;
    if (ann.classId && !visibleClassIds.has(ann.classId)) return false;
    return !readKeys.has(`ann:${ann.id}`);
  });
  announcementsAlertCount = unreadAnnouncements.length;
  for (const ann of unreadAnnouncements.slice(0, 5)) {
    items.push({
      id: `notif-ann-${ann.id}`,
      readReceiptKey: `ann:${ann.id}`,
      kind: 'announcement',
      title: ann.title,
      detail: ann.body.slice(0, 90),
      route: ann.subject ? buildSubjectRoute(ann.subject, 'announcements') : '/dashboard',
      jalaliDate: ann.publishedAtJalali,
      urgent: Boolean(ann.pinned),
      canDismissByRead: true,
    });
  }

  // 6. Phase 9-C: Counseling Follow-up Date Reminders (Counselor & Super Admin)
  let counselingAlertCount = 0;
  if (role === 'counselor' || role === 'super_admin') {
    const todayJalali = getTodayJalali();
    const studentNameMap = new Map(students.map((s) => [s.id, s.fullName]));
    const dueFollowUps = getDueCounselingFollowUps(counselingSessions, todayJalali);
    for (const item of dueFollowUps) {
      const receiptKey = `cns-followup:${item.session.id}:${item.followUpDateJalali}`;
      if (readKeys.has(receiptKey)) continue;
      counselingAlertCount += 1;
      const stName = studentNameMap.get(item.session.studentId) ?? 'دانش‌آموز';
      items.push({
        id: `notif-cns-${item.session.id}`,
        readReceiptKey: receiptKey,
        kind: 'counseling_followup',
        title: item.isOverdue
          ? `پیگیری معوقه مشاوره: ${stName}`
          : item.isToday
            ? `یادآور پیگیری امروز مشاوره: ${stName}`
            : `نوبت پیگیری نزدیک مشاوره: ${stName}`,
        detail: `تاریخ پیگیری: ${toPersianDigits(item.followUpDateJalali)} · ${item.session.referralReason ?? 'جلسه پیگیری دفتر مشاوره'}`,
        route: '/counseling',
        jalaliDate: item.followUpDateJalali,
        urgent: item.isOverdue || item.isToday,
        canDismissByRead: true,
      });
    }
  }

  const messagesAlertCount = parentMessagesUnread + classMessagesUnread;
  const totalUnreadCount =
    homeworkAlertCount + messagesAlertCount + announcementsAlertCount + counselingAlertCount;

  const sidebarBadges: Record<string, number> = {};
  if (homeworkAlertCount > 0) {
    sidebarBadges.homework = homeworkAlertCount;
    sidebarBadges.subjects = homeworkAlertCount;
  }
  if (parentMessagesUnread > 0) {
    sidebarBadges['parent-staff-chat'] = parentMessagesUnread;
  }
  if (classMessagesUnread > 0) {
    sidebarBadges['class-chat'] = classMessagesUnread;
  }
  if (counselingAlertCount > 0) {
    sidebarBadges.counseling = counselingAlertCount;
  }

  return {
    items,
    totalUnreadCount,
    homeworkAlertCount,
    messagesAlertCount,
    announcementsAlertCount,
    sidebarBadges,
    teacherHomeworkTrackers,
  };
}
