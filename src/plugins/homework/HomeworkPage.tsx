// Add-on 9 (Upgraded Phase 2.5): Online Homework Portfolio — Rich Media Attachments + Live Active Tracking + Educational Games
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  FileCheck2,
  Gamepad2,
  Paperclip,
  Plus,
  Send,
  Star,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import { useToast } from '../../core/ui/ToastContext';
import {
  validateGradeScore,
  validateRichMediaFile,
} from '../../core/validation/validators';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import { copyTextToClipboard, formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  DescriptiveLevel,
  HomeworkAssignment,
  HomeworkSubmission,
  MediaAttachmentRef,
  Student,
} from '../../types/domain';
import { scoreToDescriptiveLevel } from '../gradebook/gradebookHelpers';
import { CreateHomeworkModal } from './CreateHomeworkModal';
import { EducationalGamePlayer } from './EducationalGamePlayer';
import {
  formatPendingStudentsMessengerList,
  isAssignmentActive,
  partitionClassHomeworkStatus,
} from './homeworkHelpers';

const DESCRIPTIVE_OPTIONS: DescriptiveLevel[] = [
  'خیلی خوب',
  'خوب',
  'قابل قبول',
  'نیاز به تلاش بیشتر',
];

export const HomeworkPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    session,
    linkedStudent,
    linkedTeacher,
    defaultWorkdayJalali,
    classes,
    students,
    homeworkAssignments,
    homeworkSubmissions,
    questionBank,
    upsertHomeworkAssignment,
    deleteHomeworkAssignment,
    upsertHomeworkSubmission,
  } = useSchoolData();
  const { showToast } = useToast();

  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';
  const isStudentOrParent = isStudent || isParent;
  const canManage = roleDef.canManageHomework;

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
  const effectiveClassId = classes.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : classes[0]?.id ?? '';

  const classAssignments = useMemo(
    () =>
      isStudentOrParent
        ? homeworkAssignments
        : homeworkAssignments.filter((h) => h.classId === effectiveClassId),
    [homeworkAssignments, isStudentOrParent, effectiveClassId]
  );

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    classAssignments[0]?.id ?? ''
  );
  const activeAssignment =
    classAssignments.find((h) => h.id === selectedAssignmentId) ?? classAssignments[0] ?? null;

  // Teacher Details Tab: Submitted vs Pending
  const [detailTab, setDetailTab] = useState<'submitted' | 'pending'>('submitted');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);

  // Parent standard submission modal state
  const [submitModalHw, setSubmitModalHw] = useState<HomeworkAssignment | null>(null);
  const [parentAnswerText, setParentAnswerText] = useState('');
  const [parentMediaAttachments, setParentMediaAttachments] = useState<MediaAttachmentRef[]>([]);

  // Teacher review modal state
  const [reviewSub, setReviewSub] = useState<HomeworkSubmission | null>(null);
  const [reviewScore, setReviewScore] = useState<string>('19');
  const [reviewQuality, setReviewQuality] = useState<DescriptiveLevel>('خیلی خوب');
  const [reviewFeedback, setReviewFeedback] = useState('');

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const studentsByClassId = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const s of students) {
      if (!s.active) continue;
      const arr = map.get(s.classId) ?? [];
      arr.push(s);
      map.set(s.classId, arr);
    }
    return map;
  }, [students]);

  const activePartition = useMemo(() => {
    if (!activeAssignment) {
      return {
        submittedRows: [],
        pendingStudents: [],
        submittedCount: 0,
        totalCount: 0,
        progressPercent: 0,
      };
    }
    const clsStudents = studentsByClassId.get(activeAssignment.classId) ?? [];
    return partitionClassHomeworkStatus(clsStudents, activeAssignment.id, homeworkSubmissions);
  }, [activeAssignment, studentsByClassId, homeworkSubmissions]);

  const handleCopyHomeworkMessenger = async (hw: HomeworkAssignment) => {
    const clsName = classMap.get(hw.classId)?.name ?? '';
    const text = formatSingleColumnMessengerReport({
      schoolName: activeSchool.name,
      reportTitle:
        hw.mode === 'game'
          ? `اعلام تکلیف بازی آموزشی — ${hw.subject}`
          : `اعلام تکلیف آنلاین — ${hw.subject}`,
      jalaliDateDisplay: formatJalaliDisplay(hw.createdAtJalali, false),
      sections: [
        {
          heading: `${clsName} — ${hw.title}`,
          lines: [
            hw.description,
            `مهلت تحویل: ${formatJalaliDisplay(hw.dueDateJalali, false)}`,
            ...(hw.attachmentUrl ? [`پیوند کمکی: ${hw.attachmentUrl}`] : []),
          ],
        },
      ],
      footerNote: `دبیر: ${hw.teacherName} · لطفاً پاسخ تکلیف را در سامانه بارگذاری نمایید.`,
    });
    const ok = await copyTextToClipboard(text);
    showToast(
      ok ? 'متن تک‌ستونه اعلام تکلیف برای ایتا/بله/شاد کپی شد.' : 'خطا در کپی کردن متن.',
      ok ? 'success' : 'error'
    );
  };

  const handleCopyPendingMessenger = async () => {
    if (!activeAssignment) return;
    const clsName = classMap.get(activeAssignment.classId)?.name ?? '';
    const text = formatPendingStudentsMessengerList({
      schoolName: activeSchool.name,
      className: clsName,
      assignment: activeAssignment,
      pendingStudents: activePartition.pendingStudents,
      submittedCount: activePartition.submittedCount,
      totalCount: activePartition.totalCount,
      currentDateJalali: defaultWorkdayJalali,
    });
    const ok = await copyTextToClipboard(text);
    showToast(
      ok
        ? 'لیست تک‌ستونی دانش‌آموزان ارسال‌نکرده برای ایتا، بله و شاد کپی شد.'
        : 'خطا در کپی لیست.',
      ok ? 'success' : 'error'
    );
  };

  const handleManualInPersonCheck = (student: Student) => {
    if (!canManage || !activeAssignment) return;
    const isLate = defaultWorkdayJalali > activeAssignment.dueDateJalali;
    const sub: HomeworkSubmission = {
      id: `${activeSchoolId}:hwsub:${activeAssignment.id}:${student.id}`,
      schoolId: activeSchoolId,
      assignmentId: activeAssignment.id,
      studentId: student.id,
      classId: student.classId,
      answerText: 'تحویل حضوری در کلاس توسط دبیر ثبت و تایید شد.',
      manualInPerson: true,
      submittedAtJalali: defaultWorkdayJalali,
      submittedAtIso: new Date().toISOString(),
      status: isLate ? 'late' : 'submitted',
    };
    const res = upsertHomeworkSubmission(sub);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت تحویل حضوری.', 'error');
      return;
    }
    showToast(`تحویل حضوری تکلیف برای ${student.fullName} ثبت شد.`);
  };

  const handleParentRichMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateRichMediaFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      allowPdf: false,
    });
    if (!check.valid || !check.data) {
      showToast(check.errors[0] ?? 'فایل انتخاب‌شده معتبر نیست.', 'error');
      e.target.value = '';
      return;
    }
    const mediaId = `${activeSchoolId}:blob:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await saveMediaBlob({
      mediaId,
      schoolId: activeSchoolId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    });
    setParentMediaAttachments((prev) => [
      ...prev,
      {
        mediaId,
        schoolId: activeSchoolId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        kind: check.data!,
        sizeBytes: file.size,
      },
    ]);
    e.target.value = '';
    showToast(`فایل «${file.name}» به پاسخ تکلیف پیوست شد.`);
  };

  const handleParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStudent || !linkedStudent || !submitModalHw) return;
    if (parentAnswerText.trim().length < 3 && parentMediaAttachments.length === 0) {
      showToast('لطفاً متن پاسخ را بنویسید یا عکس/فیلم/صوت تکلیف را بارگذاری کنید.', 'error');
      return;
    }

    const isLate = defaultWorkdayJalali > submitModalHw.dueDateJalali;
    const submission: HomeworkSubmission = {
      id: `${activeSchoolId}:hwsub:${submitModalHw.id}:${linkedStudent.id}`,
      schoolId: activeSchoolId,
      assignmentId: submitModalHw.id,
      studentId: linkedStudent.id,
      classId: linkedStudent.classId,
      answerText:
        parentAnswerText.trim() ||
        `پاسخ تکلیف همراه با ${toPersianDigits(parentMediaAttachments.length)} فایل پیوست ارسال شد.`,
      mediaAttachments: parentMediaAttachments.length > 0 ? parentMediaAttachments : undefined,
      submittedAtJalali: defaultWorkdayJalali,
      submittedAtIso: new Date().toISOString(),
      status: isLate ? 'late' : 'submitted',
    };

    const res = upsertHomeworkSubmission(submission);
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ثبت پاسخ تکلیف وجود نداشت.', 'error');
      return;
    }
    showToast('پاسخ تکلیف با موفقیت ثبت و برای بررسی معلم ارسال شد.');
    setSubmitModalHw(null);
    setParentAnswerText('');
    setParentMediaAttachments([]);
  };

  const openReviewModal = (sub: HomeworkSubmission) => {
    setReviewSub(sub);
    const defaultNum =
      sub.score !== undefined
        ? sub.score
        : sub.gameResult
          ? Math.round(((sub.gameResult.score / sub.gameResult.maxScore) * 20) * 4) / 4
          : 19;
    setReviewScore(String(defaultNum));
    setReviewQuality(sub.qualityLevel ?? scoreToDescriptiveLevel(defaultNum));
    setReviewFeedback(
      sub.teacherFeedback ??
        (sub.gameResult
          ? `آفرین! عملکرد عالی در بازی آموزشی با امتیاز ${toPersianDigits(sub.gameResult.score)} از ۱۰۰.`
          : 'آفرین! پاسخ منظم و کامل بود.')
    );
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !reviewSub) return;
    const numeric = Number(toAsciiDigits(reviewScore));
    if (!validateGradeScore(numeric)) {
      showToast('نمره تکلیف باید عددی بین ۰ تا ۲۰ باشد.', 'error');
      return;
    }

    const updated: HomeworkSubmission = {
      ...reviewSub,
      status: 'reviewed',
      score: numeric,
      qualityLevel: reviewQuality,
      teacherFeedback: reviewFeedback.trim(),
      reviewedAt: new Date().toISOString(),
    };

    const res = upsertHomeworkSubmission(updated);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ذخیره نمره تکلیف.', 'error');
      return;
    }
    showToast('بازخورد و نمره تکلیف ثبت شد و به‌صورت خودکار در محاسبه نمره مستمر اعمال گردید.');
    setReviewSub(null);
  };

  return (
    <PrintShell
      school={activeSchool}
      documentTitle={
        isStudentOrParent && linkedStudent
          ? `گزارش تکالیف آنلاین — ${linkedStudent.fullName}`
          : `گزارش تکالیف آنلاین — ${activeAssignment?.title ?? classes.find((c) => c.id === effectiveClassId)?.name ?? ''}`
      }
      subtitle={`سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isParent
                ? 'گزارش انجام تکالیف فرزند (فقط مشاهده)'
                : isStudent
                  ? 'تکالیف آنلاین و بازی آموزشی من'
                  : 'کارپوشه تکالیف آنلاین و بازخورد معلم'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isStudent && linkedStudent
                ? `تکالیف و بازی‌های آموزشی ${linkedStudent.fullName} — بارگذاری عکس، فیلم یا صوت و انجام بازی‌های تعاملی.`
                : isParent && linkedStudent
                  ? `پایش وضعیت تحویل، امتیاز بازی‌های آموزشی و بازخورد معلم برای ${linkedStudent.fullName} (ارسال پاسخ تنها از حساب دانش‌آموز مجاز است).`
                  : 'تعریف تکلیف رسانه‌ای و بازی آموزشی، پایش زنده تحویل‌های فعال و نمره‌دهی متصل به دفتر نمره مستمر.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isStudentOrParent && classes.length > 0 && (
              <select
                aria-label="انتخاب کلاس"
                value={effectiveClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <PrintButtons compact documentLabel="گزارش تکالیف آنلاین" />
            {canManage && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                تعریف تکلیف جدید
              </button>
            )}
          </div>
        </div>

        {/* Student Interactive View OR Parent Strictly Read-Only Monitoring View */}
        {isStudentOrParent && linkedStudent ? (
          <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
          {classAssignments.map((hw) => {
            const sub = homeworkSubmissions.find(
              (s) => s.assignmentId === hw.id && s.studentId === linkedStudent.id
            );
            const active = isAssignmentActive(hw.dueDateJalali, defaultWorkdayJalali);
            const isOverdue = !sub && !active;

            return (
              <article
                key={hw.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <span>{hw.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>دبیر: {hw.teacherName}</span>
                        {hw.mode === 'game' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <Gamepad2 className="w-3.5 h-3.5" />
                              بازی آموزشی
                            </span>
                          </>
                        )}
                      </div>
                      <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                        {hw.title}
                      </h2>
                    </div>

                    <div className="text-left text-xs font-bold shrink-0">
                      {sub?.status === 'reviewed' ? (
                        <span className="text-emerald-700 dark:text-emerald-400">بررسی‌شده</span>
                      ) : sub ? (
                        <span className="text-sky-700 dark:text-sky-400">
                          {sub.status === 'late' ? 'تحویل با تاخیر' : 'تحویل شده'}
                        </span>
                      ) : isOverdue ? (
                        <span className="text-rose-700 dark:text-rose-400">پایان مهلت</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          در حال انجام — مهلت باقیمانده
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {hw.description}
                  </p>

                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    مهلت تحویل: <strong>{formatJalaliDisplay(hw.dueDateJalali, false)}</strong>
                  </div>

                  {/* Teacher attached media previews */}
                  {hw.mediaAttachments && hw.mediaAttachments.length > 0 && (
                    <div className="space-y-2">
                      {hw.mediaAttachments.map((att) => (
                        <MediaAttachmentPreview key={att.mediaId} attachment={att} compact />
                      ))}
                    </div>
                  )}

                  {/* Interactive Educational Game ONLY for Student role; Parent gets read-only status */}
                  {hw.mode === 'game' && hw.gameConfig && isStudent && (
                    <EducationalGamePlayer
                      assignment={hw}
                      schoolId={activeSchoolId}
                      existingResult={sub?.gameResult}
                      onComplete={({ result, answerSummary, attachments }) => {
                        const isLate = defaultWorkdayJalali > hw.dueDateJalali;
                        const submission: HomeworkSubmission = {
                          id: `${activeSchoolId}:hwsub:${hw.id}:${linkedStudent.id}`,
                          schoolId: activeSchoolId,
                          assignmentId: hw.id,
                          studentId: linkedStudent.id,
                          classId: linkedStudent.classId,
                          answerText: answerSummary,
                          mediaAttachments: attachments,
                          gameResult: result,
                          submittedAtJalali: defaultWorkdayJalali,
                          submittedAtIso: new Date().toISOString(),
                          status: isLate ? 'late' : 'submitted',
                        };
                        const res = upsertHomeworkSubmission(submission);
                        if (res.ok) {
                          showToast(
                            `امتیاز ${toPersianDigits(result.score)} از ۱۰۰ در بازی آموزشی به‌عنوان تحویل تکلیف ذخیره شد!`
                          );
                        } else {
                          showToast(res.errorFa ?? 'خطا در ذخیره نتیجه بازی.', 'error');
                        }
                      }}
                    />
                  )}
                  {hw.mode === 'game' && isParent && !sub && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      این تکلیف یک بازی آموزشی تعاملی است و دانش‌آموز هنوز آن را تکمیل نکرده است.
                    </div>
                  )}

                  {/* Submitted summary & media previews */}
                  {sub && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span>پاسخ ثبت‌شده ({formatJalaliDisplay(sub.submittedAtJalali, false)})</span>
                        {sub.gameResult && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 tabular-nums">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            امتیاز: {toPersianDigits(sub.gameResult.score)} از ۱۰۰
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-5">{sub.answerText}</p>
                      {sub.mediaAttachments && sub.mediaAttachments.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {sub.mediaAttachments.map((att) => (
                            <MediaAttachmentPreview key={att.mediaId} attachment={att} compact />
                          ))}
                        </div>
                      )}
                      {sub.attachmentName && !sub.mediaAttachments?.length && (
                        <div className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{sub.attachmentName}</span>
                        </div>
                      )}
                      {sub.status === 'reviewed' && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            نمره معلم: {toPersianDigits(sub.score ?? 0)} از ۲۰ ({sub.qualityLevel})
                          </div>
                          {sub.teacherFeedback && (
                            <p className="text-slate-700 dark:text-slate-300">
                              بازخورد معلم: {sub.teacherFeedback}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isStudent && hw.mode !== 'game' && sub?.status !== 'reviewed' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitModalHw(hw);
                      setParentAnswerText(sub?.answerText ?? '');
                      setParentMediaAttachments(sub?.mediaAttachments ?? []);
                    }}
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {sub ? 'ویرایش پاسخ / افزودن رسانه' : 'ارسال پاسخ تکلیف'}
                  </button>
                )}
                {isParent && (
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    نمای نظارتی ولی (فقط مشاهده) · ارسال تکلیف از حساب دانش‌آموز انجام می‌شود.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        /* Teacher / Admin Split Layout with Live Active Progress Bars & Submitted/Pending Tabs */
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Assignments List with Live Progress Bars */}
          <div className="lg:col-span-4 space-y-3">
            {classAssignments.map((hw) => {
              const clsStudents = studentsByClassId.get(hw.classId) ?? [];
              const part = partitionClassHomeworkStatus(clsStudents, hw.id, homeworkSubmissions);
              const active = isAssignmentActive(hw.dueDateJalali, defaultWorkdayJalali);
              const isSelected = activeAssignment?.id === hw.id;

              return (
                <div
                  key={hw.id}
                  onClick={() => setSelectedAssignmentId(hw.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAssignmentId(hw.id);
                    }
                  }}
                  className={`rounded-2xl border p-4 cursor-pointer transition-colors space-y-2.5 ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold">
                        <span className="text-indigo-700 dark:text-indigo-400">{hw.subject}</span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        {active ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            در حال انجام — مهلت باقیمانده
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">پایان مهلت</span>
                        )}
                      </div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-1.5">
                        {hw.mode === 'game' && (
                          <Gamepad2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                        <span className="truncate">{hw.title}</span>
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCopyHomeworkMessenger(hw);
                      }}
                      aria-label="کپی اعلام تکلیف برای ایتا و بله"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Live Submission Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        تحویل داده‌اند: {toPersianDigits(part.submittedCount)} از{' '}
                        {toPersianDigits(part.totalCount)} نفر
                      </span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(part.progressPercent)}٪
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all"
                        style={{ width: `${part.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>مهلت: {formatJalaliDisplay(hw.dueDateJalali, false)}</span>
                    {hw.mediaAttachments && hw.mediaAttachments.length > 0 && (
                      <span>{toPersianDigits(hw.mediaAttachments.length)} پیوست رسانه‌ای</span>
                    )}
                  </div>
                </div>
              );
            })}
            {classAssignments.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                هنوز تکلیفی برای این کلاس ثبت نشده است.
              </div>
            )}
          </div>

          {/* Active Assignment Details + Two-Tab Live Tracking Panel */}
          <div className="lg:col-span-8">
            {activeAssignment ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        <span>{activeAssignment.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          مهلت تحویل: {formatJalaliDisplay(activeAssignment.dueDateJalali, false)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isAssignmentActive(activeAssignment.dueDateJalali, defaultWorkdayJalali)
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500'
                          }
                        >
                          {isAssignmentActive(activeAssignment.dueDateJalali, defaultWorkdayJalali)
                            ? 'در حال انجام — مهلت باقیمانده'
                            : 'پایان مهلت'}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                        {activeAssignment.title}
                      </h2>
                      <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
                        {activeAssignment.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyHomeworkMessenger(activeAssignment)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        اعلام تکلیف (ایتا/بله)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const res = deleteHomeworkAssignment(activeAssignment.id);
                          if (res.ok) showToast('تکلیف حذف شد.', 'info');
                        }}
                        aria-label="حذف تکلیف"
                        className="min-h-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Attached media preview for the assignment */}
                  {activeAssignment.mediaAttachments &&
                    activeAssignment.mediaAttachments.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activeAssignment.mediaAttachments.map((att) => (
                          <MediaAttachmentPreview key={att.mediaId} attachment={att} compact />
                        ))}
                      </div>
                    )}

                  {/* Live progress summary + Two Tabs */}
                  <div className="flex flex-col gap-3 pt-2">
                    <div
                      role="tablist"
                      aria-label="تب‌های پیگیری تحویل تکلیف"
                      className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit max-w-full"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === 'submitted'}
                        onClick={() => setDetailTab('submitted')}
                        className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap tabular-nums ${
                          detailTab === 'submitted'
                            ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        انجام داده‌اند (تحویل داده شده) ({toPersianDigits(activePartition.submittedCount)})
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === 'pending'}
                        onClick={() => setDetailTab('pending')}
                        className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap tabular-nums ${
                          detailTab === 'pending'
                            ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        هنوز انجام نداده‌اند (در انتظار تحویل) ({toPersianDigits(activePartition.pendingStudents.length)})
                      </button>
                    </div>

                    {detailTab === 'pending' && (
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 px-3.5 py-2">
                        <span className="text-xs font-medium text-amber-800 dark:text-amber-300 tabular-nums">
                          {toPersianDigits(activePartition.pendingStudents.length)} دانش‌آموز هنوز تکلیف را ارسال نکرده‌اند
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyPendingMessenger()}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          کپی تک‌ستونی لیست ارسال‌نکرده‌ها برای ایتا، بله و شاد
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab 1: Submitted Students */}
                {detailTab === 'submitted' ? (
                  activePartition.submittedRows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      هنوز هیچ دانش‌آموزی این تکلیف را تحویل نداده است.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activePartition.submittedRows.map(({ student, submission }) => (
                        <div key={student.id} className="p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                                <span>{student.fullName}</span>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                                  {formatJalaliDisplay(submission.submittedAtJalali, false)}
                                </span>
                                {submission.manualInPerson && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-300">·</span>
                                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                      تحویل حضوری
                                    </span>
                                  </>
                                )}
                                {submission.gameResult && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-300">·</span>
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                                      امتیاز بازی: {toPersianDigits(submission.gameResult.score)} از ۱۰۰
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                                {submission.answerText}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-left tabular-nums">
                                {submission.status === 'reviewed' ? (
                                  <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {toPersianDigits(submission.score ?? 0)} / ۲۰
                                  </div>
                                ) : (
                                  <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1">
                                    <FileCheck2 className="w-3.5 h-3.5" />
                                    در انتظار نمره‌دهی
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => openReviewModal(submission)}
                                className="min-h-[36px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap"
                              >
                                {submission.status === 'reviewed' ? 'ویرایش نمره' : 'بررسی و نمره‌دهی'}
                              </button>
                            </div>
                          </div>

                          {submission.mediaAttachments && submission.mediaAttachments.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {submission.mediaAttachments.map((att) => (
                                <MediaAttachmentPreview key={att.mediaId} attachment={att} compact />
                              ))}
                            </div>
                          )}

                          {submission.teacherFeedback && (
                            <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
                              بازخورد ثبت‌شده معلم: {submission.teacherFeedback}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : /* Tab 2: Pending / Not Yet Submitted Students */
                activePartition.pendingStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    عالی! تمام دانش‌آموزان این کلاس تکلیف را تحویل داده‌اند.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activePartition.pendingStudents.map((st, idx) => (
                      <div
                        key={st.id}
                        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center tabular-nums">
                            {toPersianDigits(idx + 1)}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {st.fullName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" />
                              هنوز تحویل نداده است
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleManualInPersonCheck(st)}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3.5 text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <UserCheck className="w-4 h-4" />
                          ثبت تحویل حضوری
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                یک تکلیف را برای مشاهده وضعیت زنده تحویل دانش‌آموزان انتخاب کنید.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Homework Modal */}
      {createOpen && canManage && effectiveClassId && (
        <CreateHomeworkModal
          schoolId={activeSchoolId}
          classId={effectiveClassId}
          teacherId={linkedTeacher?.id ?? session?.userId ?? 'staff'}
          teacherName={session?.displayName ?? roleDef.labelFa}
          defaultWorkdayJalali={defaultWorkdayJalali}
          questionBank={questionBank}
          onClose={() => setCreateOpen(false)}
          onCreate={(newHw) => {
            const res = upsertHomeworkAssignment(newHw);
            if (!res.ok) {
              showToast(res.errorFa ?? 'خطا در ثبت تکلیف.', 'error');
              return;
            }
            showToast(`تکلیف «${newHw.title}» برای کلاس منتشر شد.`);
            setSelectedAssignmentId(newHw.id);
            setCreateOpen(false);
          }}
        />
      )}

      {/* Student Rich Media Submission Modal (Strictly Student Only) */}
      {submitModalHw && isStudent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleParentSubmit}
            className="w-full max-w-lg my-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ارسال پاسخ تکلیف: {submitModalHw.title}
              </h2>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setSubmitModalHw(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                متن پاسخ یا توضیح دانش‌آموز
              </label>
              <textarea
                rows={3}
                value={parentAnswerText}
                onChange={(e) => setParentAnswerText(e.target.value)}
                placeholder="پاسخ تمرین یا توضیح انجام تکلیف را اینجا بنویسید..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    بارگذاری عکس، فیلم یا صوت از تکلیف
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    تصویر تا ۵ مگابایت · صوت و ویدیو تا ۱۵ مگابایت
                  </div>
                </div>
                <label className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  انتخاب فایل
                  <input
                    type="file"
                    accept="image/*,audio/*,video/*"
                    onChange={(e) => void handleParentRichMediaUpload(e)}
                    className="sr-only"
                  />
                </label>
              </div>

              {parentMediaAttachments.length > 0 && (
                <div className="space-y-2">
                  {parentMediaAttachments.map((att) => (
                    <MediaAttachmentPreview
                      key={att.mediaId}
                      attachment={att}
                      compact
                      onRemove={() =>
                        setParentMediaAttachments((prev) =>
                          prev.filter((x) => x.mediaId !== att.mediaId)
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitModalHw(null)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[42px] inline-flex items-center gap-1.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                ثبت و ارسال به معلم
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teacher Review & Grading Modal */}
      {reviewSub && canManage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleSaveReview}
            className="w-full max-w-lg my-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                بررسی و نمره‌دهی تکلیف — {studentMap.get(reviewSub.studentId)?.fullName ?? ''}
              </h2>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setReviewSub(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm leading-6 text-slate-700 dark:text-slate-200 space-y-2">
              <div>{reviewSub.answerText}</div>
              {reviewSub.mediaAttachments && reviewSub.mediaAttachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  {reviewSub.mediaAttachments.map((att) => (
                    <MediaAttachmentPreview key={att.mediaId} attachment={att} compact />
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نمره عددی (۰ تا ۲۰)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  max={20}
                  required
                  value={reviewScore}
                  onChange={(e) => {
                    setReviewScore(e.target.value);
                    const val = Number(e.target.value);
                    if (Number.isFinite(val)) setReviewQuality(scoreToDescriptiveLevel(val));
                  }}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سطح کیفی
                </label>
                <select
                  value={reviewQuality}
                  onChange={(e) => setReviewQuality(e.target.value as DescriptiveLevel)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {DESCRIPTIVE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                بازخورد آموزشی معلم
              </label>
              <textarea
                rows={3}
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewSub(null)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                ثبت نمره و ارسال به دفتر مستمر
              </button>
            </div>
          </form>
        </div>
      )}

        {/* Print-Only Homework Report Table (A4 & A5) */}
        <div className="print-only">
          <table>
            <thead>
              <tr>
                <th>ردیف</th>
                <th>درس</th>
                <th>عنوان تکلیف</th>
                <th>مهلت تحویل</th>
                <th>وضعیت / نمره</th>
              </tr>
            </thead>
            <tbody>
              {classAssignments.map((hw, idx) => {
                if (isStudentOrParent && linkedStudent) {
                  const sub = homeworkSubmissions.find(
                    (s) => s.assignmentId === hw.id && s.studentId === linkedStudent.id
                  );
                  return (
                    <tr key={hw.id}>
                      <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                      <td>{hw.subject}</td>
                      <td className="font-semibold">{hw.title}</td>
                      <td className="text-center tabular-nums">
                        {formatJalaliDisplay(hw.dueDateJalali, false)}
                      </td>
                      <td>
                        {sub?.status === 'reviewed'
                          ? `بررسی‌شده (${toPersianDigits(sub.score ?? 0)} از ۲۰)`
                          : sub
                            ? 'تحویل شده'
                            : 'در انتظار انجام'}
                      </td>
                    </tr>
                  );
                }
                const clsStudents = students.filter((s) => s.classId === hw.classId && s.active);
                const part = partitionClassHomeworkStatus(clsStudents, hw.id, homeworkSubmissions);
                const completionPct =
                  clsStudents.length > 0
                    ? Math.round((part.submittedRows.length / clsStudents.length) * 100)
                    : 0;
                return (
                  <tr key={hw.id}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td>{hw.subject}</td>
                    <td className="font-semibold">{hw.title}</td>
                    <td className="text-center tabular-nums">
                      {formatJalaliDisplay(hw.dueDateJalali, false)}
                    </td>
                    <td className="tabular-nums">
                      {toPersianDigits(part.submittedRows.length)} تحویل از{' '}
                      {toPersianDigits(clsStudents.length)} نفر ({toPersianDigits(completionPct)}٪)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PrintShell>
  );
};
