// Plugin 14 (Phase 3): Online Exams («سامانه آزمون آنلاین»)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Edit3,
  FileSpreadsheet,
  Play,
  Plus,
  Printer,
  Send,
  ShoppingBasket,
  Trash2,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  OnlineExam,
  OnlineExamSubmission,
  Student360Signal,
} from '../../types/domain';
import { ExamAnalyticsChart } from './ExamAnalyticsChart';
import { ExamBuilderModal } from './ExamBuilderModal';
import { StudentExamRunner } from './StudentExamRunner';
import {
  computeExamClassAnalytics,
  formatExamMessengerAnnouncement,
  getExamQuestionTypeLabelFa,
  getExamStatusMeta,
  getGradingStatusLabelFa,
  recalculateSubmissionAfterManualGrading,
} from './onlineExamHelpers';

type TeacherExamTab = 'manage' | 'grading' | 'analytics';
type PrintMode = 'none' | 'exam_sheet' | 'class_results';

export const OnlineExamsPage: React.FC = () => {
  const {
    activeRole,
    roleDef,
    activeSchool,
    classes,
    students,
    linkedStudent,
    onlineExams,
    onlineExamSubmissions,
    examQuestionBasket,
    deleteOnlineExam,
    upsertOnlineExamSubmission,
    syncExamGradesToGradebook,
  } = useSchoolData();
  const { showToast } = useToast();

  const canManage = roleDef.canManageOnlineExams;
  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';

  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [teacherTab, setTeacherTab] = useState<TeacherExamTab>('manage');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<OnlineExam | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Parent active exam runner
  const [takingExamId, setTakingExamId] = useState<string | null>(null);

  // Teacher descriptive grading drafts: submissionId -> { scores: { qId: number }, feedbacks: { qId: string }, overall: string }
  const [gradingDrafts, setGradingDrafts] = useState<
    Record<
      string,
      {
        scores: Record<string, string>;
        feedbacks: Record<string, string>;
        overall: string;
      }
    >
  >({});

  // Print modals
  const [printMode, setPrintMode] = useState<PrintMode>('none');
  const [printWithAnswerKey, setPrintWithAnswerKey] = useState<boolean>(false);

  const visibleExams = useMemo(() => {
    const filtered =
      classFilter === 'all'
        ? onlineExams
        : onlineExams.filter((e) => e.classId === classFilter);
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [onlineExams, classFilter]);

  const activeExam = useMemo(() => {
    if (visibleExams.length === 0) return null;
    return visibleExams.find((e) => e.id === selectedExamId) ?? visibleExams[0];
  }, [visibleExams, selectedExamId]);

  const activeClass = useMemo(
    () => (activeExam ? classes.find((c) => c.id === activeExam.classId) : undefined),
    [classes, activeExam]
  );

  const examSubmissions = useMemo(() => {
    if (!activeExam) return [];
    return onlineExamSubmissions.filter((s) => s.examId === activeExam.id);
  }, [onlineExamSubmissions, activeExam]);

  const pendingDescriptiveSubmissions = useMemo(
    () => examSubmissions.filter((s) => s.gradingStatus === 'pending_descriptive'),
    [examSubmissions]
  );

  const analytics = useMemo(() => {
    if (!activeExam) return null;
    return computeExamClassAnalytics(activeExam, examSubmissions);
  }, [activeExam, examSubmissions]);

  const studentNameById = useMemo(
    () => new Map(students.map((s) => [s.id, s.fullName])),
    [students]
  );

  const handleFinalizeSubmissionGrading = (sub: OnlineExamSubmission) => {
    if (!activeExam) return;
    const draft = gradingDrafts[sub.id];
    const overrides: Record<string, { score: number; feedback?: string }> = {};
    activeExam.questions.forEach((q) => {
      if (q.type === 'descriptive') {
        const ans = sub.answers.find((a) => a.questionId === q.id);
        const rawScore = draft?.scores[q.id];
        const parsedScore =
          rawScore !== undefined && rawScore !== ''
            ? Number(rawScore)
            : ans?.manualScore ?? 0;
        overrides[q.id] = {
          score: Number.isFinite(parsedScore) ? parsedScore : 0,
          feedback: draft?.feedbacks[q.id] ?? ans?.teacherFeedback,
        };
      }
    });

    const updatedSub = recalculateSubmissionAfterManualGrading(
      activeExam,
      sub,
      overrides,
      draft?.overall ?? sub.teacherOverallFeedback
    );

    const signal: Student360Signal = {
      id: `${activeExam.schoolId}:s360:online_exam:${activeExam.id}:${sub.studentId}`,
      schoolId: activeExam.schoolId,
      studentId: sub.studentId,
      classId: activeExam.classId,
      subject: activeExam.subject,
      source: 'online_exam',
      sourceEntityId: activeExam.id,
      title: activeExam.title,
      score20: updatedSub.finalScore20,
      statusLabelFa:
        updatedSub.finalScore20 >= 17
          ? 'خیلی خوب'
          : updatedSub.finalScore20 >= 14
          ? 'خوب'
          : 'نیاز به تلاش بیشتر',
      summaryFa: `نمره نهایی تاییدشده در آزمون «${activeExam.title}»: ${toPersianDigits(updatedSub.finalScore20)} از ۲۰`,
      metrics: {
        score20: updatedSub.finalScore20,
        tabSwitchCount: updatedSub.tabSwitchCount,
      },
      recordedAtJalali: getTodayJalali(),
      updatedAt: new Date().toISOString(),
    };

    const res = upsertOnlineExamSubmission(updatedSub, signal);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ثبت نمره نهایی انجام نشد.', 'error');
      return;
    }
    showToast(
      `نمره نهایی ${studentNameById.get(sub.studentId) ?? 'دانش‌آموز'} (${toPersianDigits(updatedSub.finalScore20)} از ۲۰) تایید شد.`
    );
  };

  const handleSyncToGradebook = () => {
    if (!activeExam) return;
    const res = syncExamGradesToGradebook(activeExam.id);
    if (!res.ok) {
      showToast(res.errorFa ?? 'انتقال نمرات به دفتر کلاسی انجام نشد.', 'error');
      return;
    }
    showToast('نمرات تاییدشده آزمون با موفقیت به دفتر کلاسی و برگه ۳۶۰ درجه منتقل شدند.');
  };

  const handleCopyMessenger = async () => {
    if (!activeExam || !analytics) return;
    const text = formatExamMessengerAnnouncement({
      schoolName: activeSchool.name,
      className: activeClass?.name ?? 'کلاس',
      exam: activeExam,
      analytics,
    });
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showToast('گزارش تک‌ستونی آزمون آنلاین کپی شد (آماده ارسال در ایتا، بله و شاد).');
    } else {
      showToast('کپی انجام نشد.', 'error');
    }
  };

  const handleDeleteExam = (id: string) => {
    const res = deleteOnlineExam(id);
    setConfirmDeleteId(null);
    if (res.ok) showToast('آزمون آنلاین حذف شد.');
    else showToast(res.errorFa ?? 'حذف انجام نشد.', 'error');
  };

  // --- 1. STUDENT VIEW (Take Active Exams + View Own Scorecard) ---
  // --- 2. PARENT VIEW (Strictly Read-Only Scorecards — MUST NOT see «شروع آزمون»!) ---
  if (isStudent || isParent) {
    const activeTakingExam =
      isStudent && takingExamId
        ? onlineExams.find((e) => e.id === takingExamId) ?? null
        : null;

    if (isStudent && activeTakingExam && linkedStudent) {
      return (
        <StudentExamRunner
          exam={activeTakingExam}
          student={linkedStudent}
          onSubmit={(sub, signal) => {
            const res = upsertOnlineExamSubmission(sub, signal);
            if (!res.ok) {
              showToast(res.errorFa ?? 'ثبت پاسخ‌نامه انجام نشد.', 'error');
              return;
            }
            setTakingExamId(null);
          }}
          onCancel={() => setTakingExamId(null)}
        />
      );
    }

    const learnerExams = visibleExams.filter((e) => e.status !== 'draft');

    return (
      <PrintShell
        school={activeSchool}
        documentTitle={`کارنامه آزمون‌های آنلاین — ${linkedStudent?.fullName ?? ''}`}
        subtitle={`سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
      >
        <div
          className="space-y-6"
          data-testid={isParent ? 'online-exams-parent-readonly' : 'online-exams-student-view'}
        >
          <header className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {isParent
                  ? 'نتایج و کارنامه آزمون‌های آنلاین فرزند (فقط مشاهده)'
                  : 'آزمون‌های آنلاین و کارنامه آزمون'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isParent && linkedStudent
                  ? `مشاهده نتایج و کارنامه آزمون‌های ${linkedStudent.fullName} — شرکت در آزمون تنها از حساب کاربری دانش‌آموز مجاز است.`
                  : linkedStudent
                    ? `آزمون‌های فعال و کارنامه آزمون‌های ${linkedStudent.fullName}`
                    : 'دانش‌آموز متصلی برای این حساب یافت نشد.'}
              </p>
            </div>
            <PrintButtons compact documentLabel="کارنامه آزمون آنلاین" />
          </header>

          {learnerExams.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                در حال حاضر آزمون آنلاین فعالی برای این کلاس منتشر نشده است.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {learnerExams.map((exam) => {
                const mySub = linkedStudent
                  ? onlineExamSubmissions.find(
                      (s) => s.examId === exam.id && s.studentId === linkedStudent.id
                    )
                  : undefined;
                const statusMeta = getExamStatusMeta(exam.status);

                return (
                  <div
                    key={exam.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4 break-inside-avoid"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.labelFa}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          مدت: {toPersianDigits(exam.durationMinutes)} دقیقه ·{' '}
                          {toPersianDigits(exam.questions.length)} سوال
                        </span>
                      </div>

                      <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {exam.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        درس {exam.subject} · معلم: {exam.teacherName} · بازه:{' '}
                        {toPersianDigits(exam.startDateJalali)} تا{' '}
                        {toPersianDigits(exam.endDateJalali)}
                      </p>
                      {exam.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-6">
                          {exam.description}
                        </p>
                      )}

                      {mySub && (
                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              {getGradingStatusLabelFa(mySub.gradingStatus)}
                            </span>
                            {(exam.showResultImmediately ||
                              mySub.gradingStatus === 'finalized') && (
                              <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                {toPersianDigits(mySub.finalScore20)} / ۲۰
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 tabular-nums">
                            تاریخ ارسال: {toPersianDigits(mySub.submittedAtJalali)} · امتیاز بخش
                            تستی: {toPersianDigits(mySub.autoGradedPoints)}
                            {mySub.gradingStatus === 'finalized'
                              ? ` · نمره تشریحی: ${toPersianDigits(mySub.manualGradedPoints)}`
                              : ''}
                          </div>
                          {mySub.teacherOverallFeedback && (
                            <div className="text-xs text-slate-700 dark:text-slate-200 pt-1">
                              <strong>بازخورد معلم:</strong> {mySub.teacherOverallFeedback}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="no-print pt-3 border-t border-slate-100 dark:border-slate-800">
                      {isStudent && !mySub && exam.status === 'published' && linkedStudent ? (
                        <button
                          type="button"
                          onClick={() => setTakingExamId(exam.id)}
                          className="w-full min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          <span>شروع آزمون آنلاین</span>
                        </button>
                      ) : mySub ? (
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">
                          {isParent
                            ? 'کارنامه آزمون فرزند شما ثبت و آماده بررسی است.'
                            : 'پاسخ‌نامه شما با موفقیت ثبت شده است.'}
                        </div>
                      ) : isParent ? (
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 text-center">
                          {exam.status === 'published'
                            ? 'در انتظار شرکت دانش‌آموز (ورود به آزمون صرفاً از حساب دانش‌آموز مجاز است)'
                            : 'دانش‌آموز در این آزمون شرکت نکرده است.'}
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-slate-400 text-center">
                          مهلت شرکت در این آزمون به پایان رسیده است.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PrintShell>
    );
  }

  // --- TEACHER / ADMIN VIEW ---
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            سامانه آزمون آنلاین و تصحیح هوشمند
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            متصل به سبد آزمون و بانک سوالات · تصحیح خودکار تستی، صف تصحیح تشریحی با عکس دست‌نویس، انتقال یک‌کلیکی به دفتر کلاسی
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setEditingExam(null);
              setBuilderOpen(true);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>ساخت آزمون آنلاین جدید</span>
            {examQuestionBasket.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[11px] tabular-nums inline-flex items-center gap-1">
                <ShoppingBasket className="w-3 h-3" />
                {toPersianDigits(examQuestionBasket.length)}
              </span>
            )}
          </button>
        )}
      </header>

      {/* Filter + Exam Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="فیلتر کلاس"
          className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه کلاس‌ها ({toPersianDigits(onlineExams.length)})</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          {visibleExams.map((exam) => {
            const selected = activeExam?.id === exam.id;
            return (
              <div key={exam.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`min-h-[42px] px-3.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>{exam.title}</span>
                </button>
                {canManage && selected && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExam(exam);
                        setBuilderOpen(true);
                      }}
                      aria-label="ویرایش آزمون"
                      className="min-h-[42px] w-10 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 flex items-center justify-center"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {confirmDeleteId === exam.id ? (
                      <div className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl px-2 py-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(exam.id)}
                          className="text-[11px] font-bold text-rose-700 dark:text-rose-300 px-1.5 py-1"
                        >
                          تایید حذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] text-slate-500 px-1 py-1"
                        >
                          انصراف
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(exam.id)}
                        aria-label="حذف آزمون"
                        className="min-h-[42px] w-10 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!activeExam || !analytics ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <FileSpreadsheet className="w-11 h-11 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            هیچ آزمون آنلاینی برای نمایش وجود ندارد.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Sub-Navigation Tabs for Selected Exam */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setTeacherTab('manage')}
                className={`min-h-[44px] px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 ${
                  teacherTab === 'manage'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>سوالات و تنظیمات آزمون ({toPersianDigits(activeExam.questions.length)})</span>
              </button>

              <button
                type="button"
                onClick={() => setTeacherTab('grading')}
                className={`min-h-[44px] px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 ${
                  teacherTab === 'grading'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>صف تصحیح تشریحی و پاسخ‌نامه‌ها</span>
                {pendingDescriptiveSubmissions.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[11px] tabular-nums">
                    {toPersianDigits(pendingDescriptiveSubmissions.length)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTeacherTab('analytics')}
                className={`min-h-[44px] px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 ${
                  teacherTab === 'analytics'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>تحلیل، کارنامه و دفتر کلاسی</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-2">
              <button
                type="button"
                onClick={() => setPrintMode('exam_sheet')}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ A4 برگه سوالات</span>
              </button>
              <button
                type="button"
                onClick={handleCopyMessenger}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span>کپی برای ایتا، بله و شاد</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Exam Overview & Questions */}
          {teacherTab === 'manage' && (
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                        getExamStatusMeta(activeExam.status).badgeClass
                      }`}
                    >
                      {getExamStatusMeta(activeExam.status).labelFa}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {activeClass?.name} · درس {activeExam.subject}
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                    {activeExam.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    بازه برگزاری: {toPersianDigits(activeExam.startDateJalali)} تا{' '}
                    {toPersianDigits(activeExam.endDateJalali)} · مدت:{' '}
                    {toPersianDigits(activeExam.durationMinutes)} دقیقه · جمع بارم:{' '}
                    {toPersianDigits(activeExam.totalPoints)} نمره
                  </p>
                </div>

                {activeExam.gradebookSyncedAt && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    نمرات منتقل‌شده به دفتر کلاسی
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                {activeExam.questions.map((q, idx) => (
                  <div key={q.id} className="py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        سوال {toPersianDigits(idx + 1)} · {getExamQuestionTypeLabelFa(q.type)}
                      </span>
                      <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        {toPersianDigits(q.points)} نمره
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {q.questionText}
                    </p>
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-slate-600 dark:text-slate-300">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={
                              optIdx === q.correctOptionIndex
                                ? 'font-bold text-emerald-700 dark:text-emerald-400'
                                : ''
                            }
                          >
                            {toPersianDigits(optIdx + 1)}) {opt}
                            {optIdx === q.correctOptionIndex ? ' ✓' : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'true_false' && (
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                        پاسخ صحیح: {q.trueFalseAnswer ? 'صحیح' : 'غلط'}
                      </div>
                    )}
                    {q.type === 'fill_blank' && q.acceptedAnswers && (
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                        پاسخ‌های قابل قبول: {q.acceptedAnswers.join(' ، ')}
                      </div>
                    )}
                    {q.type === 'descriptive' && q.modelAnswer && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        پاسخ نمونه: {q.modelAnswer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB 2: Descriptive Grading Queue («صف تصحیح تشریحی») */}
          {teacherTab === 'grading' && (
            <section className="space-y-4">
              {examSubmissions.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
                  هنوز هیچ دانش‌آموزی در این آزمون شرکت نکرده است.
                </div>
              ) : (
                examSubmissions.map((sub) => {
                  const stuName = studentNameById.get(sub.studentId) ?? 'دانش‌آموز';
                  const descriptiveQuestions = activeExam.questions.filter(
                    (q) => q.type === 'descriptive'
                  );
                  const draft = gradingDrafts[sub.id] ?? {
                    scores: {},
                    feedbacks: {},
                    overall: sub.teacherOverallFeedback ?? '',
                  };

                  return (
                    <div
                      key={sub.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                              {stuName}
                            </h3>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                sub.gradingStatus === 'pending_descriptive'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {getGradingStatusLabelFa(sub.gradingStatus)}
                            </span>
                            {sub.tabSwitchCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {toPersianDigits(sub.tabSwitchCount)} بار خروج از صفحه
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            ارسال: {toPersianDigits(sub.submittedAtJalali)} · بخش خودکار:{' '}
                            {toPersianDigits(sub.autoGradedPoints)} نمره · نمره کل فعلی:{' '}
                            <strong>{toPersianDigits(sub.finalScore20)} از ۲۰</strong>
                          </p>
                        </div>
                      </div>

                      {descriptiveQuestions.length === 0 ? (
                        <div className="text-xs text-emerald-700 dark:text-emerald-400">
                          این آزمون فاقد سوال تشریحی است و به‌طور کامل به‌صورت خودکار تصحیح شده است.
                        </div>
                      ) : (
                        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {descriptiveQuestions.map((q) => {
                            const ans = sub.answers.find((a) => a.questionId === q.id);
                            const scoreVal =
                              draft.scores[q.id] ??
                              (ans?.manualScore !== undefined ? String(ans.manualScore) : '');
                            const fbVal = draft.feedbacks[q.id] ?? ans?.teacherFeedback ?? '';

                            return (
                              <div
                                key={q.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-bold text-slate-900 dark:text-slate-100">
                                    {q.questionText}
                                  </span>
                                  <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 tabular-nums">
                                    حداکثر بارم: {toPersianDigits(q.points)}
                                  </span>
                                </div>

                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-6">
                                  {ans?.textAnswer?.trim()
                                    ? ans.textAnswer
                                    : 'پاسخ متنی ثبت نشده است.'}
                                </div>

                                {ans?.handwrittenMediaRef && (
                                  <MediaAttachmentPreview attachment={ans.handwrittenMediaRef} />
                                )}

                                {canManage && (
                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                                    <label className="sm:col-span-3 block space-y-1">
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                        نمره تشریحی (۰ تا {toPersianDigits(q.points)})
                                      </span>
                                      <input
                                        type="number"
                                        step={0.25}
                                        min={0}
                                        max={q.points}
                                        value={scoreVal}
                                        onChange={(e) =>
                                          setGradingDrafts((prev) => ({
                                            ...prev,
                                            [sub.id]: {
                                              scores: {
                                                ...(prev[sub.id]?.scores ?? {}),
                                                [q.id]: e.target.value,
                                              },
                                              feedbacks: prev[sub.id]?.feedbacks ?? {},
                                              overall:
                                                prev[sub.id]?.overall ??
                                                sub.teacherOverallFeedback ??
                                                '',
                                            },
                                          }))
                                        }
                                        className="w-full min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold tabular-nums"
                                      />
                                    </label>
                                    <label className="sm:col-span-9 block space-y-1">
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                        بازخورد معلم روی این سوال
                                      </span>
                                      <input
                                        type="text"
                                        value={fbVal}
                                        onChange={(e) =>
                                          setGradingDrafts((prev) => ({
                                            ...prev,
                                            [sub.id]: {
                                              scores: prev[sub.id]?.scores ?? {},
                                              feedbacks: {
                                                ...(prev[sub.id]?.feedbacks ?? {}),
                                                [q.id]: e.target.value,
                                              },
                                              overall:
                                                prev[sub.id]?.overall ??
                                                sub.teacherOverallFeedback ??
                                                '',
                                            },
                                          }))
                                        }
                                        placeholder="توضیح یا نکته اصلاحی برای دانش‌آموز..."
                                        className="w-full min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {canManage && (
                            <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
                              <label className="flex-1 min-w-[220px] block space-y-1">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  بازخورد کلی معلم برای کارنامه دانش‌آموز
                                </span>
                                <input
                                  type="text"
                                  value={draft.overall}
                                  onChange={(e) =>
                                    setGradingDrafts((prev) => ({
                                      ...prev,
                                      [sub.id]: {
                                        scores: prev[sub.id]?.scores ?? {},
                                        feedbacks: prev[sub.id]?.feedbacks ?? {},
                                        overall: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="آفرین به دقت شما / لطفاً مبحث کسرها را مرور کنید..."
                                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleFinalizeSubmissionGrading(sub)}
                                className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>تایید نمره نهایی</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          )}

          {/* TAB 3: Class Analytics, Gradebook Sync & A4 Reports */}
          {teacherTab === 'analytics' && (
            <div className="space-y-5">
              <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      تحلیل آماری نتایج کلاس — {activeExam.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      نمودار توزیع نمرات، سوالات پرتکرار اشتباه و انتقال مستقیم به دفتر کلاسی
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canManage && (
                      <button
                        type="button"
                        onClick={handleSyncToGradebook}
                        className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Send className="w-4 h-4" />
                        <span>انتقال نمرات تاییدشده به دفتر کلاسی</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPrintMode('class_results')}
                      className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      <span>چاپ A4 کارنامه و نتایج کلاس</span>
                    </button>
                  </div>
                </div>

                <ExamAnalyticsChart analytics={analytics} />
              </section>

              {/* Results Table */}
              <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    جدول نتایج شرکت‌کنندگان ({toPersianDigits(examSubmissions.length)} نفر)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-2 font-bold">دانش‌آموز</th>
                        <th className="py-2.5 px-2 font-bold">وضعیت تصحیح</th>
                        <th className="py-2.5 px-2 font-bold">نمره نهایی (از ۲۰)</th>
                        <th className="py-2.5 px-2 font-bold">خروج از صفحه</th>
                        <th className="py-2.5 px-2 font-bold">دفتر کلاسی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {examSubmissions.map((sub) => (
                        <tr key={sub.id}>
                          <td className="py-3 px-2 font-bold text-slate-900 dark:text-slate-100">
                            {studentNameById.get(sub.studentId) ?? 'دانش‌آموز'}
                          </td>
                          <td className="py-3 px-2 text-xs">
                            {getGradingStatusLabelFa(sub.gradingStatus)}
                          </td>
                          <td className="py-3 px-2 font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {toPersianDigits(sub.finalScore20)} / ۲۰
                          </td>
                          <td className="py-3 px-2 text-xs tabular-nums">
                            {sub.tabSwitchCount > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                {toPersianDigits(sub.tabSwitchCount)} بار
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">بدون خروج</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-xs">
                            {sub.syncedToGradebook ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                منتقل‌شده
                              </span>
                            ) : (
                              <span className="text-slate-400">در انتظار انتقال</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {/* Exam Builder Modal */}
      {builderOpen && (
        <ExamBuilderModal
          initialExam={editingExam}
          onClose={() => {
            setBuilderOpen(false);
            setEditingExam(null);
          }}
          onSaved={(id) => setSelectedExamId(id)}
        />
      )}

      {/* A4 Print Preview Modal (Exam Question Sheet OR Class Results) */}
      {printMode !== 'none' && activeExam && analytics && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-4 print:p-0 print:bg-white print:static"
          role="dialog"
          aria-modal="true"
          aria-label="پیش‌نمایش چاپ A4 آزمون آنلاین"
        >
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">
            <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-100 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-900">
                  {printMode === 'exam_sheet'
                    ? 'چاپ A4 برگه سوالات آزمون'
                    : 'چاپ A4 کارنامه و نتایج کلاس'}
                </span>
                {printMode === 'exam_sheet' && (
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printWithAnswerKey}
                      onChange={(e) => setPrintWithAnswerKey(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span>چاپ همراه با پاسخنامه (کلید معلم)</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                <PrintButtons
                  compact
                  documentLabel={
                    printMode === 'exam_sheet' ? 'برگه سوالات آزمون' : 'کارنامه و نتایج کلاس'
                  }
                />
                <button
                  type="button"
                  onClick={() => setPrintMode('none')}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
                >
                  بستن
                </button>
              </div>
            </div>

            <div className="p-6 print:p-0">
              {printMode === 'exam_sheet' ? (
                <PrintShell
                  school={activeSchool}
                  documentTitle={`${activeExam.title}${printWithAnswerKey ? ' (نسخه کلید پاسخنامه)' : ''}`}
                  subtitle={`${activeClass?.name ?? ''} · درس ${activeExam.subject} · معلم: ${activeExam.teacherName} · تاریخ ${toPersianDigits(activeExam.startDateJalali)} · مدت: ${toPersianDigits(activeExam.durationMinutes)} دقیقه · بارم کل: ${toPersianDigits(activeExam.totalPoints)} نمره`}
                >
                  <div className="space-y-4 text-slate-900 text-sm">
                    <div className="grid grid-cols-2 gap-3 border border-slate-300 rounded-xl p-3 text-xs">
                      <div>نام و نام خانوادگی دانش‌آموز: .............................................</div>
                      <div>نمره کسب‌شده: ............... از {toPersianDigits(activeExam.totalPoints)}</div>
                    </div>

                    <div className="space-y-4">
                      {activeExam.questions.map((q, idx) => (
                        <div key={q.id} className="border-b border-slate-200 pb-3 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-bold">
                              {toPersianDigits(idx + 1)}. {q.questionText}
                            </div>
                            <span className="text-xs font-bold shrink-0 tabular-nums">
                              ({toPersianDigits(q.points)} نمره)
                            </span>
                          </div>

                          {q.type === 'multiple_choice' && q.options && (
                            <div className="grid grid-cols-2 gap-2 pr-4 text-xs">
                              {q.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className={
                                    printWithAnswerKey && optIdx === q.correctOptionIndex
                                      ? 'font-extrabold underline'
                                      : ''
                                  }
                                >
                                  {toPersianDigits(optIdx + 1)}) {opt}
                                  {printWithAnswerKey && optIdx === q.correctOptionIndex
                                    ? ' (پاسخ صحیح)'
                                    : ''}
                                </div>
                              ))}
                            </div>
                          )}

                          {q.type === 'true_false' && (
                            <div className="pr-4 text-xs">
                              ☐ صحیح &nbsp;&nbsp;&nbsp; ☐ غلط
                              {printWithAnswerKey && (
                                <span className="font-bold mr-4">
                                  [کلید: {q.trueFalseAnswer ? 'صحیح' : 'غلط'}]
                                </span>
                              )}
                            </div>
                          )}

                          {q.type === 'fill_blank' && (
                            <div className="pr-4 text-xs">
                              پاسخ: .....................................................
                              {printWithAnswerKey && q.acceptedAnswers && (
                                <span className="font-bold mr-3">
                                  [کلید: {q.acceptedAnswers.join(' / ')}]
                                </span>
                              )}
                            </div>
                          )}

                          {q.type === 'descriptive' && (
                            <div className="pr-4 pt-2 space-y-2 text-xs">
                              <div className="border-b border-dotted border-slate-400 h-5" />
                              <div className="border-b border-dotted border-slate-400 h-5" />
                              {printWithAnswerKey && q.modelAnswer && (
                                <div className="font-bold text-slate-700">
                                  پاسخ نمونه: {q.modelAnswer}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </PrintShell>
              ) : (
                <PrintShell
                  school={activeSchool}
                  documentTitle={`کارنامه و تحلیل نتایج آزمون — ${activeExam.title}`}
                  subtitle={`${activeClass?.name ?? ''} · درس ${activeExam.subject} · معلم: ${activeExam.teacherName}`}
                >
                  <div className="space-y-4 text-slate-900 text-xs">
                    <div className="grid grid-cols-4 gap-2 border border-slate-300 rounded-xl p-3 text-center tabular-nums">
                      <div>
                        <div className="text-slate-500">شرکت‌کنندگان</div>
                        <div className="font-extrabold text-sm">
                          {toPersianDigits(analytics.submissionCount)} نفر
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">میانگین کلاس</div>
                        <div className="font-extrabold text-sm">
                          {analytics.averageScore20 !== null
                            ? `${toPersianDigits(analytics.averageScore20)} از ۲۰`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">بالاترین نمره</div>
                        <div className="font-extrabold text-sm">
                          {analytics.highestScore20 !== null
                            ? toPersianDigits(analytics.highestScore20)
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">پایین‌ترین نمره</div>
                        <div className="font-extrabold text-sm">
                          {analytics.lowestScore20 !== null
                            ? toPersianDigits(analytics.lowestScore20)
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 p-2 text-right">ردیف</th>
                          <th className="border border-slate-300 p-2 text-right">نام دانش‌آموز</th>
                          <th className="border border-slate-300 p-2 text-right">بخش خودکار</th>
                          <th className="border border-slate-300 p-2 text-right">بخش تشریحی</th>
                          <th className="border border-slate-300 p-2 text-right">نمره نهایی (از ۲۰)</th>
                          <th className="border border-slate-300 p-2 text-right">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {examSubmissions.map((sub, idx) => (
                          <tr key={sub.id}>
                            <td className="border border-slate-300 p-2 tabular-nums">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="border border-slate-300 p-2 font-bold">
                              {studentNameById.get(sub.studentId) ?? 'دانش‌آموز'}
                            </td>
                            <td className="border border-slate-300 p-2 tabular-nums">
                              {toPersianDigits(sub.autoGradedPoints)}
                            </td>
                            <td className="border border-slate-300 p-2 tabular-nums">
                              {toPersianDigits(sub.manualGradedPoints)}
                            </td>
                            <td className="border border-slate-300 p-2 font-extrabold tabular-nums">
                              {toPersianDigits(sub.finalScore20)}
                            </td>
                            <td className="border border-slate-300 p-2">
                              {getGradingStatusLabelFa(sub.gradingStatus)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </PrintShell>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
