// Step 3: Subject-Centric Hub («دروس من / کلاس‌های من»)
// Supports both `/subjects` (alphabetical Persian subject grid) and `/subjects/<slug>?tab=...`
// (5 structured tabs: Videos, Homework, Exams & Quizzes, Handouts & Questions, Announcements & Grades)
// plus embedded Teacher Direct Parent Messaging panel and full teacher/admin content creation forms.
import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Film,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import type {
  HomeworkAssignment,
  MediaResourceKind,
  QuestionDifficulty,
} from '../../types/domain';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import { useSchoolData } from '../data/DataContext';
import { PrintIconButton } from '../print/PrintIconButton';
import { useRouter } from '../router/RouterContext';
import { escapeHtml, generateUUID, sanitizeText, sanitizeUrl } from '../security/sanitize';
import { useToast } from '../ui/ToastContext';
import {
  buildSubjectRoute,
  collectSubjectsForContext,
  extractSubjectFromPath,
  normalizeFaSearch,
  parseSubjectTabParam,
  type SubjectDetailTab,
} from './subjectHelpers';

const TAB_DEFS: Array<{
  id: SubjectDetailTab;
  labelFa: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'videos', labelFa: 'ویدیوهای آموزشی', icon: Film },
  { id: 'homework', labelFa: 'تکالیف', icon: ClipboardCheck },
  { id: 'exams', labelFa: 'آزمون‌ها و تست‌ها', icon: Sparkles },
  { id: 'resources', labelFa: 'سوالات و جزوه‌ها', icon: FileText },
  { id: 'announcements', labelFa: 'اطلاعیه‌ها و نمرات', icon: Bell },
];

export const SubjectsHubPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    linkedStudent,
    linkedTeacher,
    classes,
    students,
    teachers,
    schedules,
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
    parentStaffMessages,
    virtualClassSessions,
    upsertHomeworkAssignment,
    upsertHomeworkSubmission,
    upsertFlippedLesson,
    upsertOnlineExam,
    addMediaResource,
    upsertQuestionItem,
    upsertSchoolAnnouncement,
    sendParentStaffMessage,
    markParentChatThreadRead,
  } = useSchoolData();
  const { isViewingArchivedYear, academicYearId } = useAcademicYear();
  const { path, searchParams, navigate } = useRouter();
  const { showToast } = useToast();

  const selectedSubject = extractSubjectFromPath(path);
  const activeTab = parseSubjectTabParam(searchParams.get('tab'));

  const [gridSearch, setGridSearch] = useState('');
  const [filterClassId, setFilterClassId] = useState<string>('all');

  // Student homework submission modal state
  const [submittingHw, setSubmittingHw] = useState<HomeworkAssignment | null>(null);
  const [hwResponseText, setHwResponseText] = useState('');
  const [hwAttachmentLabel, setHwAttachmentLabel] = useState('');

  // Teacher / Admin inline creation forms
  const [openCreateModal, setOpenCreateModal] = useState<
    null | 'video' | 'homework' | 'exam' | 'resource' | 'announcement'
  >(null);

  // Shared create form fields
  const [formClassId, setFormClassId] = useState<string>(classes[0]?.id ?? '');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDueDate, setFormDueDate] = useState(() => addDaysToJalali(getTodayJalali(), 3));
  const [formDurationMin, setFormDurationMin] = useState('15');
  const [formResourceType, setFormResourceType] = useState<MediaResourceKind>('pdf');
  const [formQuestionMode, setFormQuestionMode] = useState<'handout' | 'question'>('handout');
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>('medium');
  const [formPinned, setFormPinned] = useState(false);

  // Teacher Direct Parent Messaging quick drawer state
  const [parentChatOpen, setParentChatOpen] = useState(false);
  const [selectedChatStudentId, setSelectedChatStudentId] = useState<string>('');
  const [teacherReplyText, setTeacherReplyText] = useState('');

  const canCreateContent =
    !isViewingArchivedYear &&
    (activeRole === 'teacher' ||
      activeRole === 'principal' ||
      activeRole === 'deputy' ||
      activeRole === 'complex_admin' ||
      activeRole === 'super_admin');

  const teachersById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.fullName])),
    [teachers]
  );

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const subjectCards = useMemo(
    () =>
      collectSubjectsForContext({
        role: activeRole,
        linkedStudentId: linkedStudent?.id,
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
        virtualClassSessions,
        filterClassId: filterClassId === 'all' ? undefined : filterClassId,
      }),
    [
      activeRole,
      linkedStudent?.id,
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
      virtualClassSessions,
      filterClassId,
    ]
  );

  const filteredGridCards = useMemo(() => {
    const q = normalizeFaSearch(gridSearch);
    if (!q) return subjectCards;
    return subjectCards.filter(
      (c) =>
        normalizeFaSearch(c.subject).includes(q) ||
        c.teacherNames.some((t) => normalizeFaSearch(t).includes(q)) ||
        c.classNames.some((cn) => normalizeFaSearch(cn).includes(q))
    );
  }, [subjectCards, gridSearch]);

  // Teacher parent chat students list
  const teacherChatStudents = useMemo(() => {
    const visibleClassIds = new Set(classes.map((c) => c.id));
    return students
      .filter((s) => s.active && visibleClassIds.has(s.classId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
  }, [students, classes]);

  const activeChatStudentId =
    selectedChatStudentId && teacherChatStudents.some((s) => s.id === selectedChatStudentId)
      ? selectedChatStudentId
      : (teacherChatStudents[0]?.id ?? '');

  const activeChatStudent = teacherChatStudents.find((s) => s.id === activeChatStudentId);

  const activeChatMessages = useMemo(() => {
    if (!activeChatStudentId) return [];
    return parentStaffMessages
      .filter((m) => m.studentId === activeChatStudentId && m.channelType === 'teacher')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [parentStaffMessages, activeChatStudentId]);

  const unreadTeacherParentMessages = useMemo(
    () =>
      parentStaffMessages.filter(
        (m) => m.channelType === 'teacher' && m.senderRole === 'parent' && !m.readByStaff
      ).length,
    [parentStaffMessages]
  );

  const resetCreateForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormUrl('');
    setFormDueDate(addDaysToJalali(getTodayJalali(), 3));
    setFormDurationMin('15');
    setFormPinned(false);
    setFormClassId(classes[0]?.id ?? '');
  };

  // --- Detail View data for selectedSubject ---
  const detailData = useMemo(() => {
    if (!selectedSubject) return null;
    const normSubj = normalizeFaSearch(selectedSubject);
    const sameSubject = (candidate?: string) => normalizeFaSearch(candidate ?? '') === normSubj;

    const visibleClassIds = new Set(classes.map((c) => c.id));
    const visibleGradeLevels = new Set<number>(classes.map((c) => c.gradeLevel));

    const videos = flippedLessons.filter(
      (fv) => visibleClassIds.has(fv.classId) && sameSubject(fv.subject)
    );
    const archivedVideos = smartContentArchive.filter(
      (a) =>
        a.contentType === 'video' &&
        sameSubject(a.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(a.gradeLevel)) &&
        !videos.some((v) => v.id === a.sourceEntityId)
    );
    const homeworks = homeworkAssignments.filter(
      (h) => visibleClassIds.has(h.classId) && sameSubject(h.subject)
    );
    const exams = onlineExams.filter(
      (e) => visibleClassIds.has(e.classId) && sameSubject(e.subject)
    );
    const subjectMocks = mockExams.filter((m) =>
      m.subjects.some((s) => sameSubject(s.subjectName))
    );
    const handouts = mediaResources.filter(
      (m) =>
        sameSubject(m.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(m.gradeLevel))
    );
    const questions = questionBank.filter(
      (q) =>
        sameSubject(q.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(q.gradeLevel))
    );
    const archivedResources = smartContentArchive.filter(
      (a) =>
        a.contentType !== 'video' &&
        sameSubject(a.subject) &&
        (visibleGradeLevels.size === 0 || visibleGradeLevels.has(a.gradeLevel)) &&
        !handouts.some((h) => h.id === a.sourceEntityId) &&
        !questions.some((q) => q.id === a.sourceEntityId)
    );
    const announcements = schoolAnnouncements.filter(
      (ann) =>
        (ann.audienceRoles.length === 0 || ann.audienceRoles.includes(activeRole)) &&
        (!ann.classId || visibleClassIds.has(ann.classId)) &&
        (ann.scope === 'subject' ? sameSubject(ann.subject) : ann.scope === 'school')
    );
    const grades = gradebookEntries.filter((g) => {
      if (!sameSubject(g.subject)) return false;
      if (linkedStudent?.id) return g.studentId === linkedStudent.id;
      return visibleClassIds.has(g.classId);
    });

    const virtualRecordings = virtualClassSessions.filter(
      (vc) => visibleClassIds.has(vc.classId) && sameSubject(vc.subject) && Boolean(vc.recordingUrl)
    );
    const virtualHandouts = virtualClassSessions.filter(
      (vc) => visibleClassIds.has(vc.classId) && sameSubject(vc.subject) && Boolean(vc.handoutUrl)
    );

    return {
      videos,
      archivedVideos,
      virtualRecordings,
      homeworks,
      exams,
      subjectMocks,
      handouts,
      questions,
      archivedResources,
      virtualHandouts,
      announcements,
      grades,
    };
  }, [
    selectedSubject,
    classes,
    flippedLessons,
    smartContentArchive,
    homeworkAssignments,
    onlineExams,
    mockExams,
    mediaResources,
    questionBank,
    schoolAnnouncements,
    activeRole,
    gradebookEntries,
    linkedStudent?.id,
    virtualClassSessions,
  ]);

  const subjectPrintHtml = useMemo(() => {
    if (!selectedSubject || !detailData) return '';
    const hwRows = detailData.homeworks
      .map(
        (hw, i) => `
      <tr>
        <td style="text-align:center;">${toPersianDigits(i + 1)}</td>
        <td>${escapeHtml(hw.title)}</td>
        <td style="text-align:center;">${escapeHtml(classMap.get(hw.classId)?.name ?? '—')}</td>
        <td style="text-align:center;">${escapeHtml(toPersianDigits(hw.dueDateJalali))}</td>
        <td>${escapeHtml(hw.teacherName)}</td>
      </tr>`
      )
      .join('');

    const gradeRows = detailData.grades
      .slice(0, 20)
      .map(
        (g, i) => `
      <tr>
        <td style="text-align:center;">${toPersianDigits(i + 1)}</td>
        <td>ارزیابی ${escapeHtml(g.jalaliMonth)} (${escapeHtml(g.subject)})</td>
        <td style="text-align:center;">${escapeHtml(toPersianDigits(g.jalaliDate))}</td>
        <td style="text-align:center;font-weight:700;">${
          g.numericScore !== undefined
            ? toPersianDigits(g.numericScore)
            : escapeHtml(g.descriptiveLevel ?? '—')
        }</td>
      </tr>`
      )
      .join('');

    return `
      <div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;">
        <h2 style="margin:0 0 6px;font-size:16px;">گزارش جامع درس «${escapeHtml(selectedSubject)}» — ${escapeHtml(activeSchool.name)}</h2>
        <p style="margin:0 0 12px;font-size:12px;color:#475569;">
          تاریخ چاپ: ${escapeHtml(formatJalaliDisplay(getTodayJalali(), true))} |
          ویدیوها: ${toPersianDigits(detailData.videos.length + detailData.archivedVideos.length)} |
          تکالیف: ${toPersianDigits(detailData.homeworks.length)} |
          آزمون‌ها: ${toPersianDigits(detailData.exams.length + detailData.subjectMocks.length)} |
          جزوه‌ها و سوالات: ${toPersianDigits(detailData.handouts.length + detailData.questions.length)}
        </p>
        <h3 style="font-size:13px;margin:12px 0 6px;">فهرست تکالیف درس</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #cbd5e1;padding:6px;">ردیف</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">عنوان تکلیف</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">کلاس</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">مهلت</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">معلم</th>
            </tr>
          </thead>
          <tbody>
            ${hwRows || '<tr><td colspan="5" style="text-align:center;padding:8px;">تکلیفی ثبت نشده است.</td></tr>'}
          </tbody>
        </table>
        <h3 style="font-size:13px;margin:12px 0 6px;">خلاصه نمرات ثبت‌شده</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #cbd5e1;padding:6px;">ردیف</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">عنوان ارزیابی</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">تاریخ</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">نمره / سطح</th>
            </tr>
          </thead>
          <tbody>
            ${gradeRows || '<tr><td colspan="4" style="text-align:center;padding:8px;">نمره‌ای ثبت نشده است.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }, [selectedSubject, detailData, activeSchool.name, classMap]);

  const handleSubmitStudentHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingHw || !linkedStudent || isViewingArchivedYear) return;
    const cleanText = sanitizeText(hwResponseText, 1200);
    const cleanAttachment = sanitizeText(hwAttachmentLabel, 140);
    if (!cleanText && !cleanAttachment) {
      showToast('لطفاً پاسخ تکلیف یا عنوان فایل ارسالی را وارد کنید.', 'warning');
      return;
    }
    const nowIso = new Date().toISOString();
    const res = upsertHomeworkSubmission({
      id: `${activeSchoolId}:hwsub:${submittingHw.id}:${linkedStudent.id}`,
      schoolId: activeSchoolId,
      assignmentId: submittingHw.id,
      studentId: linkedStudent.id,
      classId: submittingHw.classId,
      submittedAtJalali: getTodayJalali(),
      submittedAtIso: nowIso,
      answerText: cleanText || 'پاسخ تکلیف با پیوست ارسال شد.',
      attachmentName: cleanAttachment || undefined,
      status: 'submitted',
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ثبت پاسخ نبود.', 'warning');
      return;
    }
    setSubmittingHw(null);
    setHwResponseText('');
    setHwAttachmentLabel('');
    showToast('پاسخ تکلیف با موفقیت ثبت شد و اعلان آن برای شما برطرف گردید.');
  };

  const handleCreateSubjectContent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject || !canCreateContent) return;
    const cleanTitle = sanitizeText(formTitle, 160);
    const cleanDesc = sanitizeText(formDescription, 1000);
    if (!cleanTitle) {
      showToast('وارد کردن عنوان الزامی است.', 'warning');
      return;
    }

    const targetCls = classMap.get(formClassId) ?? classes[0];
    if (!targetCls) {
      showToast('کلاس معتبری برای ثبت محتوا یافت نشد.', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const todayJalali = getTodayJalali();
    const authorName = linkedTeacher?.fullName ?? session?.displayName ?? 'کادر آموزشی';
    const teacherId = linkedTeacher?.id ?? teachers[0]?.id ?? 'teacher-default';

    if (openCreateModal === 'homework') {
      const res = upsertHomeworkAssignment({
        id: generateUUID(),
        schoolId: activeSchoolId,
        classId: targetCls.id,
        subject: selectedSubject,
        teacherId,
        teacherName: authorName,
        title: cleanTitle,
        description: cleanDesc || 'تکلیف جدید ثبت‌شده از صفحه اختصاصی درس',
        dueDateJalali: sanitizeText(formDueDate, 20) || addDaysToJalali(todayJalali, 3),
        createdAtJalali: todayJalali,
        maxScore: 20,
        createdAt: nowIso,
      });
      if (!res.ok) {
        showToast(res.errorFa ?? 'خطا در ثبت تکلیف.', 'warning');
        return;
      }
      showToast('تکلیف جدید ثبت شد و اعلان آن فوراً برای دانش‌آموزان و اولیا فعال گردید.');
    } else if (openCreateModal === 'video') {
      const safeUrl = sanitizeUrl(formUrl);
      const durMin = Math.max(2, Math.min(180, Number(formDurationMin) || 12));
      const fullDesc = safeUrl
        ? `${cleanDesc || 'ویدیوی آموزشی درس'} — پیوند ویدیو: ${safeUrl}`
        : (cleanDesc || 'ویدیوی آموزشی درس');
      const res = upsertFlippedLesson({
        id: generateUUID(),
        schoolId: activeSchoolId,
        classId: targetCls.id,
        subject: selectedSubject,
        teacherId,
        teacherName: authorName,
        title: cleanTitle,
        description: fullDesc,
        videoSource: 'demo_60s',
        durationSeconds: durMin * 60,
        deadlineJalali: sanitizeText(formDueDate, 20) || addDaysToJalali(todayJalali, 5),
        microQuiz: [],
        createdAtJalali: todayJalali,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      if (!res.ok) {
        showToast(res.errorFa ?? 'خطا در ثبت ویدیو.', 'warning');
        return;
      }
      showToast('ویدیوی آموزشی ثبت و به‌صورت خودکار در «آرشیو هوشمند محتوا» بایگانی شد.');
    } else if (openCreateModal === 'exam') {
      const res = upsertOnlineExam({
        id: generateUUID(),
        schoolId: activeSchoolId,
        classId: targetCls.id,
        subject: selectedSubject,
        teacherId,
        teacherName: authorName,
        title: cleanTitle,
        description: cleanDesc || 'آزمون کلاسی ثبت‌شده از صفحه درس',
        startDateJalali: todayJalali,
        endDateJalali: sanitizeText(formDueDate, 20) || addDaysToJalali(todayJalali, 4),
        durationMinutes: Math.max(5, Math.min(180, Number(formDurationMin) || 20)),
        randomizeOrder: true,
        showResultImmediately: true,
        status: 'published',
        totalPoints: 20,
        questions: [
          {
            id: generateUUID(),
            type: 'multiple_choice',
            questionText: `سوال نمونه برای ${cleanTitle} (قابل ویرایش در بخش آزمون آنلاین)`,
            points: 20,
            options: ['گزینه اول (پاسخ صحیح)', 'گزینه دوم', 'گزینه سوم', 'گزینه چهارم'],
            correctOptionIndex: 0,
          },
        ],
        createdAtJalali: todayJalali,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      if (!res.ok) {
        showToast(res.errorFa ?? 'خطا در ثبت آزمون.', 'warning');
        return;
      }
      showToast('آزمون درس منتشر شد و در پنل دانش‌آموزان نمایش داده می‌شود.');
    } else if (openCreateModal === 'resource') {
      if (formQuestionMode === 'question') {
        const res = upsertQuestionItem({
          id: generateUUID(),
          schoolId: activeSchoolId,
          gradeLevel: targetCls.gradeLevel,
          gradeLabel: targetCls.customGradeLabel ?? `پایه ${toPersianDigits(targetCls.gradeLevel)}`,
          subject: selectedSubject,
          chapter: cleanTitle,
          type: 'descriptive',
          difficulty: formDifficulty,
          questionText: cleanDesc || cleanTitle,
          modelAnswer: 'پاسخ تشریحی توسط معلم بررسی می‌شود.',
          createdById: session?.userId ?? teacherId,
          createdByName: authorName,
          createdByRole: activeRole,
          createdAtJalali: todayJalali,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        if (!res.ok) {
          showToast(res.errorFa ?? 'خطا در ثبت سوال.', 'warning');
          return;
        }
        showToast('سوال جدید ثبت و در «آرشیو هوشمند محتوا» ذخیره شد.');
      } else {
        const res = addMediaResource({
          id: generateUUID(),
          schoolId: activeSchoolId,
          title: cleanTitle,
          subject: selectedSubject,
          gradeLevel: targetCls.gradeLevel,
          weekNumber: 1,
          kind: formResourceType,
          url: sanitizeUrl(formUrl) || undefined,
          description: cleanDesc || 'جزوه و محتوای آموزشی درس',
          uploadedByName: authorName,
          uploadedByRole: activeRole,
          createdAtJalali: todayJalali,
          createdAt: nowIso,
        });
        if (!res.ok) {
          showToast(res.errorFa ?? 'خطا در ثبت جزوه.', 'warning');
          return;
        }
        showToast('جزوه آموزشی ثبت و به‌صورت خودکار در «آرشیو هوشمند محتوا» ذخیره شد.');
      }
    } else if (openCreateModal === 'announcement') {
      const res = upsertSchoolAnnouncement({
        id: generateUUID(),
        schoolId: activeSchoolId,
        complexId: activeSchool.complexId ?? 'complex-1',
        academicYearId,
        scope: 'subject',
        classId: targetCls.id,
        subject: selectedSubject,
        title: cleanTitle,
        body: cleanDesc || cleanTitle,
        authorName,
        authorRole: activeRole,
        audienceRoles: ['student', 'parent', 'teacher', 'principal', 'deputy'],
        pinned: formPinned,
        publishedAtJalali: todayJalali,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        createdByUserId: session?.userId ?? teacherId,
      });
      if (!res.ok) {
        showToast(res.errorFa ?? 'خطا در ثبت اطلاعیه.', 'warning');
        return;
      }
      showToast('اطلاعیه اختصاصی درس منتشر شد.');
    }

    resetCreateForm();
    setOpenCreateModal(null);
  };

  const handleSendTeacherParentMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatStudent || isViewingArchivedYear) return;
    const cleanText = sanitizeText(teacherReplyText, 800);
    if (!cleanText) return;
    const res = sendParentStaffMessage({
      studentId: activeChatStudent.id,
      classId: activeChatStudent.classId,
      channelType: 'teacher',
      targetTeacherId: linkedTeacher?.id,
      text: cleanText,
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ارسال پیام نبود.', 'warning');
      return;
    }
    setTeacherReplyText('');
    showToast(`پیام برای ولی ${activeChatStudent.fullName} ارسال شد.`);
  };

  // =========================================================================
  // VIEW A: SUBJECT DETAIL VIEW (`/subjects/:slug`)
  // =========================================================================
  if (selectedSubject && detailData) {
    const tabCounts: Record<SubjectDetailTab, number> = {
      videos: detailData.videos.length + detailData.archivedVideos.length,
      homework: detailData.homeworks.length,
      exams: detailData.exams.length + detailData.subjectMocks.length,
      resources:
        detailData.handouts.length +
        detailData.questions.length +
        detailData.archivedResources.length,
      announcements: detailData.announcements.length + detailData.grades.length,
    };

    const submittedByStudentMap = new Map(
      homeworkSubmissions
        .filter((s) => linkedStudent?.id && s.studentId === linkedStudent.id)
        .map((s) => [s.assignmentId, s])
    );

    return (
      <div className="space-y-6">
        {/* Top Breadcrumb & Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => navigate('/subjects')}
              className="inline-flex items-center gap-1.5 text-xs font-bold brand-text hover:underline"
            >
              <ArrowRight className="w-4 h-4" />
              بازگشت به فهرست دروس من
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                درس {selectedSubject}
              </h1>
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                {activeSchool.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              فضای یکپارچه ویدیوهای آموزشی، تکالیف، آزمون‌ها، جزوه‌ها، اطلاعیه‌ها و نمرات همین درس
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeRole === 'teacher' && (
              <button
                type="button"
                onClick={() => {
                  setParentChatOpen(true);
                  if (activeChatStudent) {
                    markParentChatThreadRead(activeChatStudent.id, 'teacher');
                  }
                }}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                <MessageSquare className="w-4 h-4 brand-text" />
                پیام‌های مستقیم اولیا
                {unreadTeacherParentMessages > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                    {toPersianDigits(unreadTeacherParentMessages)}
                  </span>
                )}
              </button>
            )}
            <PrintIconButton
              documentLabel={`گزارش درس ${selectedSubject}`}
              html={subjectPrintHtml}
            />
          </div>
        </div>

        {/* 5 Structured Subject Tabs */}
        <div
          role="tablist"
          aria-label="بخش‌های درس"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
        >
          {TAB_DEFS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => navigate(buildSubjectRoute(selectedSubject, tab.id))}
                className={`min-h-[44px] px-3.5 py-2 rounded-t-xl inline-flex items-center gap-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                  isSelected
                    ? 'border-[var(--brand-primary)] brand-text bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.labelFa}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] tabular-nums">
                  {toPersianDigits(tabCounts[tab.id])}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: EDUCATIONAL VIDEOS */}
        {activeTab === 'videos' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ویدیوهای آموزشی درس {selectedSubject}
              </h2>
              {canCreateContent && (
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setOpenCreateModal('video');
                  }}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 text-xs sm:text-sm font-bold"
                >
                  <Plus className="w-4 h-4" />
                  افزودن ویدیوی آموزشی (آرشیو خودکار)
                </button>
              )}
            </div>

            {detailData.videos.length === 0 &&
            detailData.archivedVideos.length === 0 &&
            detailData.virtualRecordings.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                هنوز ویدیویی برای درس «{selectedSubject}» بارگذاری نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {detailData.virtualRecordings.map((vc) => (
                  <div
                    key={`vc-rec-${vc.id}`}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {vc.recordingTitle || `فیلم ضبط‌شده: ${vc.title}`}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          معلم: {vc.teacherName} · کلاس {classMap.get(vc.classId)?.name ?? '—'} ·{' '}
                          <span className="tabular-nums">{toPersianDigits(vc.jalaliDate)}</span>
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold shrink-0">
                        ضبط کلاس مجازی
                      </span>
                    </div>
                    {vc.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-6">
                        {vc.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => navigate('/virtual-classes')}
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        مشاهده در هاب کلاس مجازی
                      </button>
                      {vc.recordingUrl && (
                        <a
                          href={vc.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold brand-text hover:underline"
                        >
                          تماشای ویدیوی ضبط‌شده ←
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {detailData.videos.map((vid) => (
                  <div
                    key={vid.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {vid.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          معلم: {vid.teacherName} · کلاس {classMap.get(vid.classId)?.name ?? '—'}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-[11px] font-bold tabular-nums shrink-0">
                        {toPersianDigits(Math.max(1, Math.round(vid.durationSeconds / 60)))} دقیقه
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-6">
                      {vid.description}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        مهلت مشاهده: {toPersianDigits(vid.deadlineJalali)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/flipped-video')}
                        className="font-bold brand-text hover:underline"
                      >
                        مشاهده در پخش‌کننده آموزشی ←
                      </button>
                    </div>
                  </div>
                ))}
                {detailData.archivedVideos.map((arch) => (
                  <div
                    key={arch.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-sky-300 dark:border-sky-800 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {arch.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-[11px] font-semibold">
                        آرشیو {toPersianDigits(arch.academicYearId)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{arch.description}</p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      معلم: {arch.teacherName} · {toPersianDigits(arch.gradeLabel)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HOMEWORK */}
        {activeTab === 'homework' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                تکالیف درس {selectedSubject}
              </h2>
              {canCreateContent && (
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setOpenCreateModal('homework');
                  }}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 text-xs sm:text-sm font-bold"
                >
                  <Plus className="w-4 h-4" />
                  تعریف تکلیف جدید
                </button>
              )}
            </div>

            {detailData.homeworks.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                تکلیفی برای درس «{selectedSubject}» ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {detailData.homeworks.map((hw) => {
                  const mySubmission = submittedByStudentMap.get(hw.id);
                  const classRoster = students.filter((s) => s.active && s.classId === hw.classId);
                  const hwSubs = homeworkSubmissions.filter((s) => s.assignmentId === hw.id);
                  const submittedStudentIds = new Set(hwSubs.map((s) => s.studentId));
                  const submittedList = classRoster.filter((s) => submittedStudentIds.has(s.id));
                  const missingList = classRoster.filter((s) => !submittedStudentIds.has(s.id));

                  return (
                    <div
                      key={hw.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              {hw.title}
                            </h3>
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                              {classMap.get(hw.classId)?.name ?? 'کلاس'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-6">
                            {hw.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              مهلت تحویل: {toPersianDigits(hw.dueDateJalali)}
                            </span>
                            <span>معلم: {hw.teacherName}</span>
                          </div>
                        </div>

                        {/* Student/Parent status & direct submit button */}
                        {(activeRole === 'student' || activeRole === 'parent') && (
                          <div className="flex items-center gap-2 shrink-0">
                            {mySubmission ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                تحویل داده‌شده ({toPersianDigits(mySubmission.submittedAtJalali)})
                              </span>
                            ) : activeRole === 'student' ? (
                              <button
                                type="button"
                                disabled={isViewingArchivedYear}
                                onClick={() => {
                                  setSubmittingHw(hw);
                                  setHwResponseText('');
                                  setHwAttachmentLabel('');
                                }}
                                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-4 text-xs sm:text-sm font-bold disabled:opacity-50"
                              >
                                <Send className="w-4 h-4" />
                                ارسال پاسخ تکلیف
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
                                ارسال‌نشده (در انتظار پاسخ فرزند)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Smart Teacher/Admin Submission Tracker */}
                      {(activeRole === 'teacher' ||
                        activeRole === 'principal' ||
                        activeRole === 'deputy' ||
                        activeRole === 'complex_admin' ||
                        activeRole === 'super_admin') && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 p-3 space-y-1.5">
                            <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                              <span>تحویل‌دادگان</span>
                              <span className="tabular-nums">
                                {toPersianDigits(submittedList.length)} از {toPersianDigits(classRoster.length)} نفر
                              </span>
                            </div>
                            {submittedList.length === 0 ? (
                              <div className="text-slate-500 dark:text-slate-400">
                                هنوز پاسخی ارسال نشده است.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {submittedList.map((st) => (
                                  <span
                                    key={st.id}
                                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-slate-700 dark:text-slate-200"
                                  >
                                    {st.fullName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 p-3 space-y-1.5">
                            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center justify-between">
                              <span>دانش‌آموزانی که هنوز ارسال نکرده‌اند</span>
                              <span className="tabular-nums">
                                {toPersianDigits(missingList.length)} نفر
                              </span>
                            </div>
                            {missingList.length === 0 ? (
                              <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                همه دانش‌آموزان این کلاس تکلیف را تحویل داده‌اند.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {missingList.map((st) => (
                                  <span
                                    key={st.id}
                                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                                  >
                                    {st.fullName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EXAMS & QUIZZES */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                آزمون‌ها و تست‌های درس {selectedSubject}
              </h2>
              {canCreateContent && (
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setOpenCreateModal('exam');
                  }}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 text-xs sm:text-sm font-bold"
                >
                  <Plus className="w-4 h-4" />
                  ایجاد آزمون سریع
                </button>
              )}
            </div>

            {detailData.exams.length === 0 && detailData.subjectMocks.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                آزمونی برای درس «{selectedSubject}» ثبت نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {detailData.exams.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {ex.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          کلاس {classMap.get(ex.classId)?.name ?? '—'} · معلم: {ex.teacherName}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 text-[11px] font-bold tabular-nums">
                        {toPersianDigits(ex.durationMinutes)} دقیقه
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{ex.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        بازه: {toPersianDigits(ex.startDateJalali)} تا {toPersianDigits(ex.endDateJalali)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/online-exams')}
                        className="font-bold brand-text hover:underline"
                      >
                        ورود به صفحه آزمون ←
                      </button>
                    </div>
                  </div>
                ))}
                {detailData.subjectMocks.map((mk) => (
                  <div
                    key={mk.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {mk.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                        آزمون آزمایشی جامع
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="tabular-nums">تاریخ: {toPersianDigits(mk.examDateJalali)}</span>
                      <button
                        type="button"
                        onClick={() => navigate('/mock-exams')}
                        className="font-bold brand-text hover:underline"
                      >
                        مشاهده کارنامه تراز ←
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HANDOUTS & QUESTIONS */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                سوالات و جزوه‌های درس {selectedSubject}
              </h2>
              {canCreateContent && (
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setOpenCreateModal('resource');
                  }}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3.5 text-xs sm:text-sm font-bold"
                >
                  <Plus className="w-4 h-4" />
                  افزودن جزوه یا سوال (آرشیو خودکار)
                </button>
              )}
            </div>

            {detailData.handouts.length === 0 &&
            detailData.questions.length === 0 &&
            detailData.archivedResources.length === 0 &&
            detailData.virtualHandouts.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                جزوه یا نمونه سوالی برای درس «{selectedSubject}» ثبت نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {detailData.virtualHandouts.map((vc) => (
                  <div
                    key={`vc-handout-${vc.id}`}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/70 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {vc.handoutTitle || `جزوه جلسه: ${vc.title}`}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold shrink-0">
                        جزوه کلاس مجازی
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums pt-1">
                      <span>
                        معلم: {vc.teacherName} · {toPersianDigits(vc.jalaliDate)}
                      </span>
                      {vc.handoutUrl && (
                        <a
                          href={vc.handoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold brand-text hover:underline"
                        >
                          دریافت جزوه ←
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {detailData.handouts.map((res) => (
                  <div
                    key={res.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {res.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                        جزوه ({res.kind.toUpperCase()})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{res.description}</p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      بارگذاری توسط {res.uploadedByName} · {toPersianDigits(res.createdAtJalali)}
                      {res.fileName ? ` · ${res.fileName}` : ''}
                    </div>
                  </div>
                ))}

                {detailData.questions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {q.chapter}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                        {q.difficulty === 'easy'
                          ? 'سطح آسان'
                          : q.difficulty === 'hard'
                            ? 'سطح پیشرفته'
                            : 'سطح متوسط'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-6">
                      {q.questionText}
                    </p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      طراح: {q.createdByName} · {toPersianDigits(q.createdAtJalali)}
                    </div>
                  </div>
                ))}

                {detailData.archivedResources.map((arch) => (
                  <div
                    key={arch.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {arch.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                        آرشیو {toPersianDigits(arch.academicYearId)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{arch.description}</p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      معلم: {arch.teacherName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ANNOUNCEMENTS & GRADES */}
        {activeTab === 'announcements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject Announcements */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  اطلاعیه‌های درس و مدرسه
                </h2>
                {canCreateContent && (
                  <button
                    type="button"
                    onClick={() => {
                      resetCreateForm();
                      setOpenCreateModal('announcement');
                    }}
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    اطلاعیه جدید درس
                  </button>
                )}
              </div>

              {detailData.announcements.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  اطلاعیه‌ای برای این درس ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-3">
                  {detailData.announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {ann.title}
                        </h3>
                        {ann.pinned && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            سنجاق‌شده
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-6">
                        {ann.body}
                      </p>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {ann.authorName} · {toPersianDigits(ann.publishedAtJalali)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject Grades */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Award className="w-4 h-4 brand-text" />
                  نمرات ثبت‌شده درس {selectedSubject}
                </h2>
              </div>

              {detailData.grades.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  هنوز نمره‌ای برای این درس ثبت نشده است.
                </div>
              ) : (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 px-3">عنوان ارزیابی</th>
                          {!linkedStudent && <th className="py-2.5 px-3">دانش‌آموز</th>}
                          <th className="py-2.5 px-3">تاریخ</th>
                          <th className="py-2.5 px-3">نمره / سطح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                        {detailData.grades.slice(0, 25).map((g) => {
                          const stName = students.find((s) => s.id === g.studentId)?.fullName;
                          return (
                            <tr key={g.id}>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                ارزیابی {g.jalaliMonth} ({g.subject})
                              </td>
                              {!linkedStudent && (
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                  {stName ?? '—'}
                                </td>
                              )}
                              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                {toPersianDigits(g.jalaliDate)}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-emerald-700 dark:text-emerald-400">
                                {g.numericScore !== undefined
                                  ? `${toPersianDigits(g.numericScore)} از ۲۰`
                                  : (g.descriptiveLevel ?? '—')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Homework Submission Modal */}
        {submittingHw && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ارسال پاسخ تکلیف: {submittingHw.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setSubmittingHw(null)}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmitStudentHomework} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    پاسخ یا توضیح تکلیف
                  </label>
                  <textarea
                    rows={4}
                    value={hwResponseText}
                    onChange={(e) => setHwResponseText(e.target.value)}
                    placeholder="پاسخ تکلیف یا یادداشت برای معلم را بنویسید..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    نام فایل یا تصویر پیوست (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={hwAttachmentLabel}
                    onChange={(e) => setHwAttachmentLabel(e.target.value)}
                    placeholder="مثلاً: تمرین-فصل-سوم.pdf"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubmittingHw(null)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="min-h-[42px] px-4 rounded-xl brand-btn text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    ثبت و تحویل تکلیف
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Teacher/Admin Create Content Modal */}
        {openCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {openCreateModal === 'video'
                    ? `افزودن ویدیوی آموزشی — ${selectedSubject}`
                    : openCreateModal === 'homework'
                      ? `تعریف تکلیف جدید — ${selectedSubject}`
                      : openCreateModal === 'exam'
                        ? `ایجاد آزمون سریع — ${selectedSubject}`
                        : openCreateModal === 'resource'
                          ? `افزودن جزوه یا سوال — ${selectedSubject}`
                          : `انتشار اطلاعیه درس — ${selectedSubject}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpenCreateModal(null)}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubjectContent} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    کلاس مقصد
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                {openCreateModal === 'resource' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormQuestionMode('handout')}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                        formQuestionMode === 'handout'
                          ? 'brand-nav-active border-transparent'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      جزوه / فایل آموزشی
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormQuestionMode('question')}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                        formQuestionMode === 'question'
                          ? 'brand-nav-active border-transparent'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      سوال و نمونه آزمون
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    عنوان
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="عنوان روشن و دقیق وارد کنید..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {openCreateModal === 'resource' && formQuestionMode === 'question'
                      ? 'متن سوال'
                      : 'توضیحات / متن'}
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="شرح محتوا، نکات آموزشی یا دستورالعمل..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                {(openCreateModal === 'homework' ||
                  openCreateModal === 'video' ||
                  openCreateModal === 'exam') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        مهلت شمسی (YYYY/MM/DD)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                      />
                    </div>
                    {(openCreateModal === 'video' || openCreateModal === 'exam') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          مدت زمان (دقیقه)
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={180}
                          value={formDurationMin}
                          onChange={(e) => setFormDurationMin(e.target.value)}
                          className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                )}

                {(openCreateModal === 'video' ||
                  (openCreateModal === 'resource' && formQuestionMode === 'handout')) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      لینک فایل یا ویدیو (اختیاری)
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                {openCreateModal === 'resource' && formQuestionMode === 'handout' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      قالب فایل
                    </label>
                    <select
                      value={formResourceType}
                      onChange={(e) => setFormResourceType(e.target.value as MediaResourceKind)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <option value="pdf">فایل PDF / جزوه</option>
                      <option value="pptx">اسلاید آموزشی (PowerPoint)</option>
                      <option value="image">تصویر و کاربرگ</option>
                      <option value="audio">فایل صوتی آموزشی</option>
                      <option value="link">پیوند آموزشی</option>
                    </select>
                  </div>
                )}

                {openCreateModal === 'resource' && formQuestionMode === 'question' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      سطح دشواری سوال
                    </label>
                    <select
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value as QuestionDifficulty)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <option value="easy">آسان</option>
                      <option value="medium">متوسط</option>
                      <option value="hard">چالشی</option>
                    </select>
                  </div>
                )}

                {openCreateModal === 'announcement' && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPinned}
                      onChange={(e) => setFormPinned(e.target.checked)}
                      className="rounded"
                    />
                    سنجاق کردن اطلاعیه در بالای درس و داشبورد
                  </label>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenCreateModal(null)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="min-h-[42px] px-4 rounded-xl brand-btn text-xs sm:text-sm font-bold"
                  >
                    ثبت و انتشار
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Teacher Direct Parent Messaging Slide-Over Drawer */}
        {parentChatOpen && activeRole === 'teacher' && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col border-r border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    ارتباط مستقیم با اولیای کلاس‌های من
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    پاسخ سریع بدون خروج از صفحه درس
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setParentChatOpen(false)}
                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  انتخاب دانش‌آموز / ولی
                </label>
                <select
                  value={activeChatStudentId}
                  onChange={(e) => {
                    setSelectedChatStudentId(e.target.value);
                    if (e.target.value) {
                      markParentChatThreadRead(e.target.value, 'teacher');
                    }
                  }}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {teacherChatStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} (ولی: {st.parentName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {activeChatMessages.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    هنوز پیامی با ولی این دانش‌آموز رد و بدل نشده است.
                  </div>
                ) : (
                  activeChatMessages.map((msg) => {
                    const isMine = msg.senderRole === 'teacher';
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-2xl p-3 text-xs sm:text-sm space-y-1 ${
                          isMine
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 mr-6'
                            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ml-6'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-bold">{msg.senderName}</span>
                          <span className="tabular-nums">{toPersianDigits(msg.jalaliDate)}</span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-100 leading-6">{msg.text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSendTeacherParentMessage}
                className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  disabled={isViewingArchivedYear || !activeChatStudent}
                  value={teacherReplyText}
                  onChange={(e) => setTeacherReplyText(e.target.value)}
                  placeholder={
                    isViewingArchivedYear
                      ? 'در سال آرشیو امکان ارسال پیام نیست'
                      : 'پاسخ خود را به ولی بنویسید...'
                  }
                  className="flex-1 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={isViewingArchivedYear || !teacherReplyText.trim()}
                  className="min-h-[42px] px-3.5 rounded-xl brand-btn text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  ارسال
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ALPHABETICAL SUBJECT CARDS GRID (`/subjects`)
  // =========================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {activeRole === 'teacher' ? 'کلاس‌ها و دروس تدریسی من' : 'دروس من'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            تمامی دروس به ترتیب حروف الفبای فارسی — روی هر درس کلیک کنید تا ویدیوها، تکالیف،
            آزمون‌ها، جزوه‌ها و نمرات آن یکجا نمایش داده شوند.
          </p>
        </div>

        {activeRole === 'teacher' && (
          <button
            type="button"
            onClick={() => navigate('/parent-staff-chat')}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 self-start"
          >
            <MessageSquare className="w-4 h-4 brand-text" />
            گفت‌وگوی مستقیم با اولیا
            {unreadTeacherParentMessages > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold tabular-nums">
                {toPersianDigits(unreadTeacherParentMessages)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={gridSearch}
            onChange={(e) => setGridSearch(e.target.value)}
            placeholder="جستجوی نام درس یا معلم..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        {classes.length > 1 && (
          <select
            aria-label="فیلتر بر اساس کلاس"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه کلاس‌ها ({toPersianDigits(classes.length)})</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isViewingArchivedYear && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>در حالت مشاهده سال تحصیلی آرشیو، محتوای دروس صرفاً قابل مطالعه و چاپ است.</span>
        </div>
      )}

      {/* Subject Grid */}
      {filteredGridCards.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          درسی با این جستجو یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGridCards.map((card) => (
            <button
              key={card.subject}
              type="button"
              onClick={() => navigate(card.route)}
              className="group text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[var(--brand-primary)] p-5 space-y-4 transition-all shadow-xs hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 group-hover:bg-[var(--brand-soft)] flex items-center justify-center brand-text shrink-0 transition-colors">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {card.subject}
                    </h2>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {card.teacherNames.length > 0
                        ? card.teacherNames.slice(0, 2).join('، ')
                        : 'کادر آموزشی مدرسه'}
                    </div>
                  </div>
                </div>
                {card.pendingHomeworkCount > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold tabular-nums shrink-0">
                    {toPersianDigits(card.pendingHomeworkCount)} تکلیف مانده
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">ویدیو</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {toPersianDigits(card.videosCount)}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">تکلیف</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {toPersianDigits(card.homeworkCount)}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">آزمون</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {toPersianDigits(card.examsCount)}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">جزوه و سوال</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {toPersianDigits(card.resourcesCount)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 truncate">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  {card.classNames.slice(0, 2).join('، ') || 'کلاس‌های فعال'}
                </span>
                <span className="font-bold brand-text shrink-0">ورود به درس ←</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
