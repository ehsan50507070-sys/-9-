// Phase 4 & 8 Upgrade: Parent Portal («پنل اختصاصی خانواده»)
// All-subjects multi-timeframe report card (Monthly, Term 1, Term 2, Full Year),
// dedicated dynamic per-subject SVG progress charts, smart descriptive copy, A4/A5 print, and grade objections.
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileWarning,
  MessageSquareHeart,
  MessageSquareWarning,
  Send,
  Sparkles,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type { GradeAppeal, JalaliAcademicMonth } from '../../types/domain';
import {
  ComprehensiveReportCardView,
  type QuickAppealRequest,
} from './ComprehensiveReportCardView';
import { PARENT_APPEAL_STATUS_LABELS } from './parentPortalHelpers';
import {
  ALL_ACADEMIC_MONTHS,
  CORE_PARENT_SUBJECTS,
  getTimeframeDisplayLabel,
  type ReportTimeframe,
} from './parentReportCardHelpers';

type ParentPortalTab = 'report_card' | 'appeals';

export const ParentPortalPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const {
    activeSchool,
    activeRole,
    session,
    linkedStudent,
    students,
    classes,
    studentProfiles,
    studentAttendance,
    homeworkAssignments,
    homeworkSubmissions,
    gradebookEntries,
    gradebookWeights,
    onlineExams,
    onlineExamSubmissions,
    gradeAppeals,
    upsertGradeAppeal,
    unreadParentChatCount,
  } = useSchoolData();

  const isParent = activeRole === 'parent';
  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);

  const [activeTab, setActiveTab] = useState<ParentPortalTab>('report_card');
  const [previewStudentId, setPreviewStudentId] = useState<string>(
    () => linkedStudent?.id ?? activeStudents[0]?.id ?? ''
  );

  // Flexible Timeframe & All-Subjects Controls (Default: ALL subjects!)
  const [timeframe, setTimeframe] = useState<ReportTimeframe>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<JalaliAcademicMonth>('آذر');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  // Grade Objection Form State
  const [selectedAppealTarget, setSelectedAppealTarget] = useState<string>('');
  const [customAppealSubject, setCustomAppealSubject] = useState<string>('ریاضی');
  const [customAppealMonth, setCustomAppealMonth] = useState<JalaliAcademicMonth>('آذر');
  const [customAppealScore, setCustomAppealScore] = useState<number>(17);
  const [appealReason, setAppealReason] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Strictly lock parent to own child; allow staff preview of any student in allowed scope
  const targetStudent = useMemo(() => {
    if (isParent) return linkedStudent;
    return activeStudents.find((s) => s.id === previewStudentId) ?? activeStudents[0] ?? null;
  }, [isParent, linkedStudent, activeStudents, previewStudentId]);

  const targetClass = useMemo(
    () => classes.find((c) => c.id === targetStudent?.classId) ?? null,
    [classes, targetStudent]
  );

  const targetProfile = useMemo(
    () => studentProfiles.find((p) => p.studentId === targetStudent?.id),
    [studentProfiles, targetStudent]
  );

  // Published online exam results for appeal dropdown
  const publishedExamResults = useMemo(() => {
    if (!targetStudent) return [];
    const examById = new Map(onlineExams.map((e) => [e.id, e]));
    return onlineExamSubmissions
      .filter((s) => {
        if (s.studentId !== targetStudent.id) return false;
        const ex = examById.get(s.examId);
        return Boolean(ex && ex.status !== 'draft');
      })
      .map((sub) => ({
        sub,
        exam: examById.get(sub.examId)!,
      }));
  }, [targetStudent, onlineExams, onlineExamSubmissions]);

  // Selectable grade/exam items for formal grade objection (including all core subjects)
  const appealableItems = useMemo(() => {
    if (!targetStudent) return [];
    const items: Array<{
      key: string;
      gradeEntryId: string;
      subject: string;
      jalaliMonth: JalaliAcademicMonth;
      score: number;
      label: string;
    }> = [];
    const seenSubjectMonth = new Set<string>();

    gradebookEntries
      .filter((g) => g.studentId === targetStudent.id)
      .forEach((g) => {
        const sc = g.numericScore ?? 0;
        const smKey = `${g.subject}:${g.jalaliMonth}`;
        seenSubjectMonth.add(smKey);
        items.push({
          key: `gb:${g.subject}:${g.jalaliMonth}`,
          gradeEntryId: g.id,
          subject: g.subject,
          jalaliMonth: g.jalaliMonth,
          score: sc,
          label: `درس ${g.subject} — ماه ${g.jalaliMonth} (نمره: ${toPersianDigits(sc)} از ۲۰)`,
        });
      });

    // Ensure every core subject for the active selectedMonth is selectable even if derived
    CORE_PARENT_SUBJECTS.forEach((subj) => {
      const smKey = `${subj}:${selectedMonth}`;
      if (!seenSubjectMonth.has(smKey)) {
        seenSubjectMonth.add(smKey);
        items.push({
          key: `gb:${subj}:${selectedMonth}`,
          gradeEntryId: `${activeSchool.id}:gb:${targetStudent.classId}:${subj}:${selectedMonth}:${targetStudent.id}`,
          subject: subj,
          jalaliMonth: selectedMonth,
          score: customAppealSubject === subj ? customAppealScore : 17,
          label: `درس ${subj} — ماه ${selectedMonth}`,
        });
      }
    });

    // Ensure pre-filled subject/month from Quick Appeal button is always present
    const customKey = `${customAppealSubject}:${customAppealMonth}`;
    if (!seenSubjectMonth.has(customKey)) {
      items.unshift({
        key: `gb:${customAppealSubject}:${customAppealMonth}`,
        gradeEntryId: `${activeSchool.id}:gb:${targetStudent.classId}:${customAppealSubject}:${customAppealMonth}:${targetStudent.id}`,
        subject: customAppealSubject,
        jalaliMonth: customAppealMonth,
        score: customAppealScore,
        label: `درس ${customAppealSubject} — ماه ${customAppealMonth} (نمره: ${toPersianDigits(customAppealScore)} از ۲۰)`,
      });
    }

    publishedExamResults.forEach(({ exam, sub }) => {
      items.push({
        key: `ex:${sub.id}`,
        gradeEntryId: `exam-sub:${sub.id}`,
        subject: exam.subject,
        jalaliMonth: 'آبان',
        score: sub.finalScore20,
        label: `آزمون آنلاین «${exam.title}» (${exam.subject}) — نمره: ${toPersianDigits(sub.finalScore20)} از ۲۰`,
      });
    });

    return items;
  }, [
    targetStudent,
    gradebookEntries,
    publishedExamResults,
    selectedMonth,
    activeSchool.id,
    customAppealSubject,
    customAppealMonth,
    customAppealScore,
  ]);

  const studentAppeals = useMemo(() => {
    if (!targetStudent) return [];
    return gradeAppeals.filter((a) => a.studentId === targetStudent.id);
  }, [targetStudent, gradeAppeals]);

  const handleQuickAppealFromRow = (req: QuickAppealRequest) => {
    setCustomAppealSubject(req.subject);
    setCustomAppealMonth(req.jalaliMonth);
    setCustomAppealScore(req.score);
    setSelectedAppealTarget(`gb:${req.subject}:${req.jalaliMonth}`);
    setFeedbackBanner(null);
    setActiveTab('appeals');
  };

  const handleAppealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    if (!targetStudent || !session) return;
    if (!isParent) {
      setFeedbackBanner({
        type: 'err',
        text: 'در حالت «پیش‌نمایش نمای خانواده» امکان ثبت اعتراض به جای ولی وجود ندارد.',
      });
      return;
    }

    const chosen =
      appealableItems.find((i) => i.key === selectedAppealTarget) ?? appealableItems[0];
    if (!chosen) {
      setFeedbackBanner({ type: 'err', text: 'نمره‌ای برای ثبت اعتراض انتخاب نشده است.' });
      return;
    }
    const reason = appealReason.trim();
    if (reason.length < 6) {
      setFeedbackBanner({
        type: 'err',
        text: 'لطفاً توضیح محترمانه و دقیق اعتراض خود را (حداقل ۶ کاراکتر) بنویسید.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const appeal: GradeAppeal = {
      id: `${activeSchool.id}:appeal:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: activeSchool.id,
      gradeEntryId: chosen.gradeEntryId,
      studentId: targetStudent.id,
      classId: targetStudent.classId,
      subject: chosen.subject,
      jalaliMonth: chosen.jalaliMonth,
      originalScore: chosen.score,
      parentReason: reason,
      submittedByName: targetStudent.parentName || session.displayName,
      submittedAtJalali: getTodayJalali(),
      status: 'submitted',
      updatedAt: nowIso,
    };

    const res = upsertGradeAppeal(appeal);
    if (!res.ok) {
      setFeedbackBanner({ type: 'err', text: res.errorFa ?? 'خطا در ثبت اعتراض نمره.' });
      return;
    }

    setAppealReason('');
    setFeedbackBanner({
      type: 'ok',
      text: 'اعتراض نمره با موفقیت ثبت شد و مستقیماً در دفتر نمره برای معلم و مدیر مدرسه نمایش داده می‌شود.',
    });
    showToast('اعتراض نمره با موفقیت ثبت شد.');
  };

  if (!targetStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-slate-600 dark:text-slate-300 font-bold">
          دانش‌آموزی برای نمایش پنل خانواده در دامنه فعلی یافت نشد.
        </p>
      </div>
    );
  }

  const timeframeLabelFa = getTimeframeDisplayLabel(timeframe, selectedMonth);

  return (
    <div className="space-y-5">
      {/* Dynamic Header Toolbar */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              کارنامه توصیفی، نمودار پیشرفت و اعتراض نمره
            </h1>
            {!isParent && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>پیش‌نمایش نمای خانواده</span>
              </span>
            )}
          </div>
          <p
            data-testid="parent-portal-subtitle"
            className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
          >
            گزارش عملکرد جامع{' '}
            <strong className="text-slate-800 dark:text-slate-100">{targetStudent.fullName}</strong> در{' '}
            <strong className="text-slate-800 dark:text-slate-100">{timeframeLabelFa}</strong> —
            مشاهده کارنامه همه دروس، نمودار پیشرفت، چاپ A4/A5 و ثبت درخواست بازبینی نمره.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isParent && activeStudents.length > 0 && (
            <select
              aria-label="انتخاب دانش‌آموز برای پیش‌نمایش نمای خانواده"
              value={targetStudent.id}
              onChange={(e) => {
                setPreviewStudentId(e.target.value);
                setSelectedSubject('ALL');
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 min-h-[40px]"
            >
              {activeStudents.map((st) => {
                const clsName = classes.find((c) => c.id === st.classId)?.name ?? '';
                return (
                  <option key={st.id} value={st.id}>
                    {st.fullName} ({clsName})
                  </option>
                );
              })}
            </select>
          )}

          <button
            type="button"
            onClick={() => navigate('/parent-staff-chat')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0 min-h-[40px] transition-colors"
          >
            <MessageSquareHeart className="w-4 h-4 shrink-0" />
            <span>گفت‌وگو با معلم و مدیر</span>
            {unreadParentChatCount > 0 && (
              <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-white text-emerald-700 font-extrabold tabular-nums">
                {toPersianDigits(unreadParentChatCount)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Tabs: «کارنامه جامع و نمودار پیشرفت» | «اعتراضات نمره» */}
      <div
        role="tablist"
        aria-label="بخش‌های پنل خانواده"
        className="no-print flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          role="tab"
          data-testid="parent-tab-report-card"
          aria-selected={activeTab === 'report_card'}
          onClick={() => setActiveTab('report_card')}
          className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'report_card'
              ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>کارنامه جامع و نمودار پیشرفت</span>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="parent-tab-appeals"
          aria-selected={activeTab === 'appeals'}
          onClick={() => setActiveTab('appeals')}
          className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'appeals'
              ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <MessageSquareWarning className="w-4 h-4 shrink-0" />
          <span>اعتراضات نمره ({toPersianDigits(studentAppeals.length)})</span>
        </button>
      </div>

      {/* TAB 1: Comprehensive Multi-Timeframe All-Subjects Report Card & Dynamic Per-Subject SVG Charts */}
      {activeTab === 'report_card' && (
        <ComprehensiveReportCardView
          student={targetStudent}
          classRoom={targetClass}
          school={activeSchool}
          studentProfile={targetProfile}
          gradebookEntries={gradebookEntries}
          gradebookWeights={gradebookWeights}
          studentAttendance={studentAttendance}
          homeworkAssignments={homeworkAssignments}
          homeworkSubmissions={homeworkSubmissions}
          onlineExams={onlineExams}
          onlineExamSubmissions={onlineExamSubmissions}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          selectedMonth={selectedMonth}
          onSelectedMonthChange={setSelectedMonth}
          selectedSubject={selectedSubject}
          onSelectedSubjectChange={setSelectedSubject}
          onQuickAppeal={handleQuickAppealFromRow}
          isParent={isParent}
          onNotify={(msg, tone) => showToast(msg, tone)}
        />
      )}

      {/* TAB 2: Formal Grade Objection Submission & Live Tracking */}
      {activeTab === 'appeals' && (
        <section className="no-print grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileWarning className="w-5 h-5 text-amber-500 shrink-0" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                ثبت اعتراض رسمی نمره
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              در صورت وجود ابهام درباره هر نمره یا کارنامه آزمون، درخواست خود را با توضیح محترمانه ثبت
              کنید تا مستقیماً در دفتر نمره توسط معلم و مدیر مدرسه بررسی شود.
            </p>

            <form onSubmit={handleAppealSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="appeal-target-select"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  انتخاب درس / آزمون مورد اعتراض
                </label>
                <select
                  id="appeal-target-select"
                  data-testid="appeal-target-select"
                  value={selectedAppealTarget || appealableItems[0]?.key || ''}
                  onChange={(e) => setSelectedAppealTarget(e.target.value)}
                  disabled={appealableItems.length === 0}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                >
                  {appealableItems.length === 0 ? (
                    <option value="">نمره‌ای ثبت نشده است</option>
                  ) : (
                    appealableItems.map((it) => (
                      <option key={it.key} value={it.key}>
                        {it.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="appeal-month-fallback"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  ماه تحصیلی مربوطه
                </label>
                <select
                  id="appeal-month-fallback"
                  value={
                    appealableItems.find((i) => i.key === selectedAppealTarget)?.jalaliMonth ??
                    customAppealMonth
                  }
                  onChange={(e) => {
                    const nextM = e.target.value as JalaliAcademicMonth;
                    setCustomAppealMonth(nextM);
                    const cur = appealableItems.find((i) => i.key === selectedAppealTarget);
                    const subj = cur?.subject ?? customAppealSubject;
                    setCustomAppealSubject(subj);
                    setSelectedAppealTarget(`gb:${subj}:${nextM}`);
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                >
                  {ALL_ACADEMIC_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      ماه {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="appeal-reason-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  توضیح اعتراض ولی
                </label>
                <textarea
                  id="appeal-reason-input"
                  rows={3}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="مثال: با سلام، لطفاً برگه تمرین بخش دوم فرزندم مجدداً بررسی شود؛ به نظر می‌رسد نمره فعالیت کلاسی لحاظ نشده است."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              {feedbackBanner && (
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-bold border ${
                    feedbackBanner.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {feedbackBanner.text}
                </div>
              )}

              <button
                type="submit"
                disabled={!isParent || appealableItems.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white whitespace-nowrap min-h-[44px] transition-colors"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>{isParent ? 'ثبت رسمی اعتراض نمره' : 'فقط در حساب ولی فعال است'}</span>
              </button>
            </form>
          </div>

          {/* Live Objection Tracking List */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                پیگیری وضعیت اعتراضات نمره
              </h2>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                {toPersianDigits(studentAppeals.length)} مورد
              </span>
            </div>

            {studentAppeals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                تاکنون اعتراض نمره‌ای برای این دانش‌آموز ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {studentAppeals.map((ap) => {
                  const statusInfo = PARENT_APPEAL_STATUS_LABELS[ap.status];
                  return (
                    <div
                      key={ap.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          درس {ap.subject} (ماه {ap.jalaliMonth}) · نمره اولیه:{' '}
                          <span className="tabular-nums text-indigo-700 dark:text-indigo-300">
                            {ap.originalScore !== undefined ? toPersianDigits(ap.originalScore) : '—'}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${statusInfo.badgeClass}`}
                        >
                          {ap.status === 'principal_approved' && (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {statusInfo.labelFa}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-slate-100">توضیح ولی:</strong>{' '}
                        {ap.parentReason}
                      </p>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        تاریخ ثبت: {toPersianDigits(ap.submittedAtJalali)}
                      </div>
                      {ap.teacherResponse && (
                        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 text-xs text-slate-700 dark:text-slate-200">
                          <strong className="text-sky-700 dark:text-sky-300">پاسخ معلم:</strong>{' '}
                          {ap.teacherResponse}
                          {typeof ap.revisedScore === 'number' && (
                            <span className="mr-2 font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                              (نمره اصلاح‌شده: {toPersianDigits(ap.revisedScore)} از ۲۰)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
