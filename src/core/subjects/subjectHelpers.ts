// Step 3: Subject-Centric Hub («دروس من / کلاس‌های من») & Instant Student/Parent Quick Search Helpers
// Zero external dependencies — pure TypeScript (strict: true).
import { toAsciiDigits } from '../../lib/digits';
import type {
  ClassChatMessage,
  ClassRoom,
  FlippedVideoLesson,
  GradebookEntry,
  HomeworkAssignment,
  HomeworkSubmission,
  MediaResource,
  MockExam,
  OnlineExam,
  ParentStaffMessage,
  QuestionBankItem,
  RoleId,
  ScheduleSlot,
  SchoolAnnouncement,
  SmartContentArchiveItem,
  VirtualClassSession,
} from '../../types/domain';

export type SubjectDetailTab = 'videos' | 'homework' | 'exams' | 'resources' | 'announcements';

export interface SubjectSummaryCard {
  subject: string;
  encodedSlug: string;
  route: string;
  classIds: string[];
  classNames: string[];
  teacherNames: string[];
  videosCount: number;
  homeworkCount: number;
  pendingHomeworkCount: number;
  examsCount: number;
  resourcesCount: number;
  announcementsCount: number;
  gradesCount: number;
  latestGradeLabel?: string;
}

export interface QuickSearchResultItem {
  id: string;
  kind: 'subject' | 'homework' | 'video' | 'exam' | 'resource' | 'announcement' | 'message';
  kindLabelFa: string;
  title: string;
  subtitle: string;
  route: string;
  badgeFa?: string;
}

export function normalizeFaSearch(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function encodeSubjectSlug(subject: string): string {
  return encodeURIComponent(subject.trim());
}

export function buildSubjectRoute(subject: string, tab?: SubjectDetailTab): string {
  const base = `/subjects/${encodeSubjectSlug(subject)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export function extractSubjectFromPath(path: string): string | null {
  if (!path.startsWith('/subjects/')) return null;
  const rawSegment = path.slice('/subjects/'.length).split('/')[0];
  if (!rawSegment) return null;
  try {
    const decoded = decodeURIComponent(rawSegment).trim();
    return decoded || null;
  } catch {
    return rawSegment.trim() || null;
  }
}

export function parseSubjectTabParam(raw: string | null): SubjectDetailTab {
  if (
    raw === 'videos' ||
    raw === 'homework' ||
    raw === 'exams' ||
    raw === 'resources' ||
    raw === 'announcements'
  ) {
    return raw;
  }
  return 'homework';
}

export function collectSubjectsForContext(params: {
  role: RoleId;
  linkedStudentId?: string;
  classes: ClassRoom[];
  schedules: ScheduleSlot[];
  teachersById: Map<string, string>;
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  flippedLessons: FlippedVideoLesson[];
  onlineExams: OnlineExam[];
  mockExams: MockExam[];
  mediaResources: MediaResource[];
  questionBank: QuestionBankItem[];
  gradebookEntries: GradebookEntry[];
  schoolAnnouncements: SchoolAnnouncement[];
  smartContentArchive: SmartContentArchiveItem[];
  virtualClassSessions?: VirtualClassSession[];
  filterClassId?: string;
}): SubjectSummaryCard[] {
  const {
    role,
    linkedStudentId,
    classes,
    schedules,
    teachersById,
    homeworkAssignments,
    homeworkSubmissions,
    flippedLessons,
    onlineExams,
    mockExams,
    mediaResources,
    questionBank,
    gradebookEntries,
    schoolAnnouncements,
    smartContentArchive,
    virtualClassSessions = [],
    filterClassId,
  } = params;

  const visibleClasses = filterClassId
    ? classes.filter((c) => c.id === filterClassId)
    : classes;
  const visibleClassIds = new Set(visibleClasses.map((c) => c.id));
  const visibleGradeLevels = new Set<number>(visibleClasses.map((c) => c.gradeLevel));
  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

  const subjectSet = new Set<string>();
  const addSubject = (raw?: string) => {
    const trimmed = (raw ?? '').trim();
    if (trimmed) subjectSet.add(trimmed);
  };

  for (const s of schedules) {
    if (visibleClassIds.has(s.classId)) addSubject(s.subjectName);
  }
  for (const h of homeworkAssignments) {
    if (visibleClassIds.has(h.classId)) addSubject(h.subject);
  }
  for (const fv of flippedLessons) {
    if (visibleClassIds.has(fv.classId)) addSubject(fv.subject);
  }
  for (const ex of onlineExams) {
    if (visibleClassIds.has(ex.classId)) addSubject(ex.subject);
  }
  for (const gb of gradebookEntries) {
    if (visibleClassIds.has(gb.classId)) addSubject(gb.subject);
  }
  for (const ann of schoolAnnouncements) {
    if (ann.subject && (!ann.classId || visibleClassIds.has(ann.classId))) {
      addSubject(ann.subject);
    }
  }
  for (const m of mediaResources) {
    if (visibleGradeLevels.size === 0 || visibleGradeLevels.has(m.gradeLevel)) {
      addSubject(m.subject);
    }
  }
  for (const q of questionBank) {
    if (visibleGradeLevels.size === 0 || visibleGradeLevels.has(q.gradeLevel)) {
      addSubject(q.subject);
    }
  }
  for (const arch of smartContentArchive) {
    if (visibleGradeLevels.size === 0 || visibleGradeLevels.has(arch.gradeLevel)) {
      addSubject(arch.subject);
    }
  }
  for (const vc of virtualClassSessions) {
    if (visibleClassIds.has(vc.classId)) {
      addSubject(vc.subject);
    }
  }

  // Fallback core subjects if school has no schedules yet
  if (subjectSet.size === 0) {
    subjectSet.add('ریاضی');
    subjectSet.add('فارسی و نگارش');
    subjectSet.add('علوم تجربی');
  }

  const submittedAssignmentIds = new Set<string>();
  if (linkedStudentId) {
    for (const sub of homeworkSubmissions) {
      if (sub.studentId === linkedStudentId) {
        submittedAssignmentIds.add(sub.assignmentId);
      }
    }
  }

  const sortedSubjects = Array.from(subjectSet).sort((a, b) => a.localeCompare(b, 'fa'));

  return sortedSubjects.map((subject) => {
    const normSubj = normalizeFaSearch(subject);
    const sameSubject = (candidate?: string) => normalizeFaSearch(candidate ?? '') === normSubj;

    const classIdsForSubj = new Set<string>();
    const teacherNamesSet = new Set<string>();

    for (const slot of schedules) {
      if (visibleClassIds.has(slot.classId) && sameSubject(slot.subjectName)) {
        classIdsForSubj.add(slot.classId);
        const tName = teachersById.get(slot.teacherId);
        if (tName) teacherNamesSet.add(tName);
      }
    }

    const subjHomework = homeworkAssignments.filter(
      (h) => visibleClassIds.has(h.classId) && sameSubject(h.subject)
    );
    for (const h of subjHomework) {
      classIdsForSubj.add(h.classId);
      if (h.teacherName) teacherNamesSet.add(h.teacherName);
    }

    const subjFlipped = flippedLessons.filter(
      (fv) => visibleClassIds.has(fv.classId) && sameSubject(fv.subject)
    );
    for (const fv of subjFlipped) {
      classIdsForSubj.add(fv.classId);
      if (fv.teacherName) teacherNamesSet.add(fv.teacherName);
    }

    const subjArchivedVideos = smartContentArchive.filter(
      (item) =>
        item.contentType === 'video' &&
        sameSubject(item.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(item.gradeLevel)) &&
        !subjFlipped.some((fv) => fv.id === item.sourceEntityId)
    );

    const subjOnlineExams = onlineExams.filter(
      (ex) => visibleClassIds.has(ex.classId) && sameSubject(ex.subject)
    );
    const subjMockExams = mockExams.filter((m) =>
      m.subjects.some((ms) => sameSubject(ms.subjectName))
    );

    const subjMedia = mediaResources.filter(
      (m) =>
        sameSubject(m.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(m.gradeLevel))
    );
    const subjQuestions = questionBank.filter(
      (q) =>
        sameSubject(q.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(q.gradeLevel))
    );
    const subjArchivedResources = smartContentArchive.filter(
      (item) =>
        item.contentType !== 'video' &&
        sameSubject(item.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(item.gradeLevel)) &&
        !subjMedia.some((m) => m.id === item.sourceEntityId) &&
        !subjQuestions.some((q) => q.id === item.sourceEntityId)
    );

    const subjAnnouncements = schoolAnnouncements.filter(
      (ann) =>
        (ann.audienceRoles.length === 0 || ann.audienceRoles.includes(role)) &&
        (!ann.classId || visibleClassIds.has(ann.classId)) &&
        (ann.scope === 'subject' ? sameSubject(ann.subject) : false)
    );

    const subjGrades = gradebookEntries.filter((g) => {
      if (!sameSubject(g.subject)) return false;
      if (linkedStudentId) return g.studentId === linkedStudentId;
      return visibleClassIds.has(g.classId);
    });

    const pendingHomeworkCount = linkedStudentId
      ? subjHomework.filter((h) => !submittedAssignmentIds.has(h.id)).length
      : 0;

    const latestGrade = subjGrades[0];
    const latestGradeLabel = latestGrade
      ? latestGrade.numericScore !== undefined
        ? `${latestGrade.numericScore}`
        : latestGrade.descriptiveLevel
      : undefined;

    const resolvedClassIds =
      classIdsForSubj.size > 0 ? Array.from(classIdsForSubj) : Array.from(visibleClassIds);

    const subjVirtualRecordings = virtualClassSessions.filter(
      (vc) => visibleClassIds.has(vc.classId) && sameSubject(vc.subject) && Boolean(vc.recordingUrl)
    );
    const subjVirtualHandouts = virtualClassSessions.filter(
      (vc) => visibleClassIds.has(vc.classId) && sameSubject(vc.subject) && Boolean(vc.handoutUrl)
    );
    for (const vc of [...subjVirtualRecordings, ...subjVirtualHandouts]) {
      classIdsForSubj.add(vc.classId);
      if (vc.teacherName) teacherNamesSet.add(vc.teacherName);
    }

    return {
      subject,
      encodedSlug: encodeSubjectSlug(subject),
      route: buildSubjectRoute(subject),
      classIds: resolvedClassIds,
      classNames: resolvedClassIds
        .map((id) => classNameMap.get(id))
        .filter((n): n is string => Boolean(n)),
      teacherNames: Array.from(teacherNamesSet),
      videosCount: subjFlipped.length + subjArchivedVideos.length + subjVirtualRecordings.length,
      homeworkCount: subjHomework.length,
      pendingHomeworkCount,
      examsCount: subjOnlineExams.length + subjMockExams.length,
      resourcesCount:
        subjMedia.length +
        subjQuestions.length +
        subjArchivedResources.length +
        subjVirtualHandouts.length,
      announcementsCount: subjAnnouncements.length,
      gradesCount: subjGrades.length,
      latestGradeLabel,
    };
  });
}

export function runQuickPortalSearch(params: {
  query: string;
  role: RoleId;
  subjects: SubjectSummaryCard[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  linkedStudentId?: string;
  flippedLessons: FlippedVideoLesson[];
  onlineExams: OnlineExam[];
  mediaResources: MediaResource[];
  schoolAnnouncements: SchoolAnnouncement[];
  parentStaffMessages: ParentStaffMessage[];
  classChatMessages: ClassChatMessage[];
  limit?: number;
}): QuickSearchResultItem[] {
  const normQ = normalizeFaSearch(params.query);
  if (!normQ) return [];
  const limit = params.limit ?? 14;
  const results: QuickSearchResultItem[] = [];

  const matches = (...fields: Array<string | undefined>) =>
    fields.some((f) => normalizeFaSearch(f ?? '').includes(normQ));

  // 1. Subjects
  for (const subj of params.subjects) {
    if (matches(subj.subject, subj.teacherNames.join(' '), subj.classNames.join(' '))) {
      results.push({
        id: `subj-${subj.subject}`,
        kind: 'subject',
        kindLabelFa: 'درس',
        title: subj.subject,
        subtitle: subj.teacherNames.length > 0 ? `معلم: ${subj.teacherNames.join('، ')}` : 'مشاهده ویدیوها، تکالیف و آزمون‌ها',
        route: subj.route,
        badgeFa: subj.pendingHomeworkCount > 0 ? `${subj.pendingHomeworkCount} تکلیف مانده` : undefined,
      });
    }
  }

  // 2. Homework
  const submittedIds = new Set(
    params.linkedStudentId
      ? params.homeworkSubmissions
          .filter((s) => s.studentId === params.linkedStudentId)
          .map((s) => s.assignmentId)
      : []
  );
  for (const hw of params.homeworkAssignments) {
    if (matches(hw.title, hw.subject, hw.description, hw.teacherName)) {
      const done = params.linkedStudentId ? submittedIds.has(hw.id) : false;
      results.push({
        id: `hw-${hw.id}`,
        kind: 'homework',
        kindLabelFa: 'تکلیف',
        title: hw.title,
        subtitle: `درس ${hw.subject} · مهلت: ${hw.dueDateJalali}`,
        route: buildSubjectRoute(hw.subject, 'homework'),
        badgeFa: params.linkedStudentId ? (done ? 'ارسال‌شده' : 'ارسال‌نشده') : undefined,
      });
    }
  }

  // 3. Videos
  for (const vid of params.flippedLessons) {
    if (matches(vid.title, vid.subject, vid.description, vid.teacherName)) {
      results.push({
        id: `vid-${vid.id}`,
        kind: 'video',
        kindLabelFa: 'ویدیو آموزشی',
        title: vid.title,
        subtitle: `درس ${vid.subject} · ${vid.teacherName}`,
        route: buildSubjectRoute(vid.subject, 'videos'),
      });
    }
  }

  // 4. Exams
  for (const ex of params.onlineExams) {
    if (matches(ex.title, ex.subject, ex.description, ex.teacherName)) {
      results.push({
        id: `ex-${ex.id}`,
        kind: 'exam',
        kindLabelFa: 'آزمون',
        title: ex.title,
        subtitle: `درس ${ex.subject} · تاریخ: ${ex.startDateJalali}`,
        route: buildSubjectRoute(ex.subject, 'exams'),
      });
    }
  }

  // 5. Handouts & Media
  for (const res of params.mediaResources) {
    if (matches(res.title, res.subject, res.description)) {
      results.push({
        id: `res-${res.id}`,
        kind: 'resource',
        kindLabelFa: 'جزوه و محتوا',
        title: res.title,
        subtitle: `درس ${res.subject} · ${res.uploadedByName}`,
        route: buildSubjectRoute(res.subject, 'resources'),
      });
    }
  }

  // 6. Announcements
  for (const ann of params.schoolAnnouncements) {
    if (matches(ann.title, ann.body, ann.subject, ann.authorName)) {
      results.push({
        id: `ann-${ann.id}`,
        kind: 'announcement',
        kindLabelFa: 'اطلاعیه',
        title: ann.title,
        subtitle: `${ann.authorName} · ${ann.publishedAtJalali}`,
        route: ann.subject ? buildSubjectRoute(ann.subject, 'announcements') : '/dashboard',
      });
    }
  }

  // 7. Messages (Parent direct chat + Class chat)
  if (params.role !== 'student') {
    for (const msg of params.parentStaffMessages) {
      if (matches(msg.text, msg.senderName)) {
        results.push({
          id: `pmsg-${msg.id}`,
          kind: 'message',
          kindLabelFa: 'پیام مستقیم',
          title: msg.text.slice(0, 72),
          subtitle: `${msg.senderName} · ${msg.jalaliDate}`,
          route: '/parent-staff-chat',
        });
      }
    }
  }
  for (const cmsg of params.classChatMessages) {
    if (matches(cmsg.text, cmsg.senderName)) {
      results.push({
        id: `cmsg-${cmsg.id}`,
        kind: 'message',
        kindLabelFa: 'پیام کلاسی',
        title: cmsg.text.slice(0, 72),
        subtitle: `${cmsg.senderName} · ${cmsg.jalaliDate}`,
        route: '/class-chat',
      });
    }
  }

  return results.slice(0, limit);
}
