// Main Enterprise Mock & Konkur Exam System Page (Phase 9A — Role-Aware & Academic-Year Scoped)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BarChart3,
  CheckCircle2,
  ClipboardEdit,
  Clock,
  FileCheck2,
  Play,
  Plus,
  Settings2,
  Target,
  Trash2,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useAcademicYear } from '../../core/academic-year/AcademicYearContext';
import { useSectionLabel } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { useModulePermissions } from '../../core/super-admin/usePermission';
import { DEFAULT_COMPLEX_ID } from '../../core/super-admin/superAdminHelpers';
import { ErrorBoundary } from '../../core/ui/ErrorBoundary';
import { useToast } from '../../core/ui/ToastContext';
import type { MockExam, MockExamAttempt, MockExamStatus } from '../../types/domain';
import { ExamBuilderModal } from './ExamBuilderModal';
import { ManagementAnalyticsView } from './ManagementAnalyticsView';
import type { TarazStagePoint } from './MockExamCharts';
import { MockExamReportCard } from './MockExamReportCard';
import { PaperAnswerEntryTab } from './PaperAnswerEntryTab';
import {
  buildExamCohortReport,
  getNegativeMarkingLabelFa,
  TRACK_PRESETS,
  type ExamCohortReport,
} from './statsEngine';
import { StudentExamSimulator } from './StudentExamSimulator';

type StaffTabId = 'analytics' | 'report_card' | 'paper_entry' | 'manage';

const STATUS_LABELS: Record<MockExamStatus, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال (در حال برگزاری)',
  published: 'منتشر شده (کارنامه آماده)',
};

const MockExamsInner: React.FC = () => {
  const {
    session,
    activeRole,
    activeSchoolId,
    activeSchool,
    schools,
    allSchools,
    classes,
    students,
    allMockExamsForSchool,
    allMockAttemptsForComplex,
    upsertMockExam,
    deleteMockExam,
    upsertMockExamAttempt,
    upsertMockExamAttemptsBatch,
    searchFocusTarget,
    clearSearchFocusTarget,
  } = useSchoolData();

  const { selectedAcademicYearId, selectedAcademicYear, isViewingArchivedYear } =
    useAcademicYear();
  const { getSectionTitle } = useSectionLabel();
  const perms = useModulePermissions('mock-exams');
  const { showToast } = useToast();

  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';
  const isStaff = !isStudent && !isParent;
  const canViewComplexComparison =
    activeRole === 'super_admin' || activeRole === 'complex_admin';

  // Scope exams strictly to active academicYearId + role visibility
  const yearExams = useMemo(() => {
    return allMockExamsForSchool
      .filter((ex) => ex.academicYearId === selectedAcademicYearId)
      .filter((ex) => {
        if ((isStudent || isParent) && ex.status === 'draft') return false;
        return true;
      })
      .sort((a, b) => a.examDateJalali.localeCompare(b.examDateJalali));
  }, [allMockExamsForSchool, selectedAcademicYearId, isStudent, isParent]);

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [staffTab, setStaffTab] = useState<StaffTabId>('analytics');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<MockExam | null>(null);
  const [takingExam, setTakingExam] = useState<MockExam | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Consume Command Palette intent or searchFocusTarget handoff
  useEffect(() => {
    try {
      const rawIntent = window.sessionStorage.getItem('mock_exam_intent');
      if (rawIntent) {
        window.sessionStorage.removeItem('mock_exam_intent');
        if (rawIntent === 'create' && isStaff && perms.create && !isViewingArchivedYear) {
          setEditingExam(null);
          setBuilderOpen(true);
        } else if (rawIntent.startsWith('exam:')) {
          const eid = rawIntent.slice('exam:'.length);
          if (yearExams.some((e) => e.id === eid)) {
            setSelectedExamId(eid);
          }
        } else if (rawIntent === 'print_report' && isStaff) {
          setStaffTab('report_card');
        }
      }
    } catch {
      // ignore storage access issues
    }
  }, [isStaff, perms.create, isViewingArchivedYear, yearExams]);

  useEffect(() => {
    if (searchFocusTarget?.studentId && isStaff) {
      setSelectedStudentId(searchFocusTarget.studentId);
      setStaffTab('report_card');
      clearSearchFocusTarget();
    }
  }, [searchFocusTarget, isStaff, clearSearchFocusTarget]);

  // Keep selectedExamId valid across academic-year / school switches
  const resolvedExam = useMemo(() => {
    const found = yearExams.find((e) => e.id === selectedExamId);
    if (found) return found;
    // Default to latest published exam, or latest exam overall
    const published = [...yearExams].reverse().find((e) => e.status === 'published');
    return published ?? yearExams[yearExams.length - 1] ?? null;
  }, [yearExams, selectedExamId]);

  // Compute cohort reports across all stages of the selected academic year in chronological order
  // so previous-stage Taraz delta (▲ +240) and multi-stage Taraz history work seamlessly!
  const cohortReportsByExamId = useMemo(() => {
    const map = new Map<string, ExamCohortReport>();
    let prevTarazByStudent: Record<string, number> = {};

    for (const ex of yearExams) {
      const examAttempts = allMockAttemptsForComplex.filter((a) => a.examId === ex.id);
      const report = buildExamCohortReport({
        exam: ex,
        attempts: examAttempts,
        schools: allSchools,
        previousStageTarazByStudent: prevTarazByStudent,
      });
      map.set(ex.id, report);

      if (report.students.length > 0) {
        const nextPrev: Record<string, number> = { ...prevTarazByStudent };
        for (const st of report.students) {
          nextPrev[st.studentId] = st.totalTaraz;
        }
        prevTarazByStudent = nextPrev;
      }
    }
    return map;
  }, [yearExams, allMockAttemptsForComplex, allSchools]);

  const getStudentTarazHistory = useCallback(
    (studentId: string): TarazStagePoint[] => {
      const pts: TarazStagePoint[] = [];
      for (const ex of yearExams) {
        const rep = cohortReportsByExamId.get(ex.id);
        const st = rep?.students.find((s) => s.studentId === studentId);
        if (st) {
          pts.push({
            examId: ex.id,
            stageLabelFa: ex.stageLabelFa,
            taraz: st.totalTaraz,
            isCurrent: ex.id === resolvedExam?.id,
          });
        }
      }
      return pts;
    },
    [yearExams, cohortReportsByExamId, resolvedExam?.id]
  );

  const activeCohort = resolvedExam ? cohortReportsByExamId.get(resolvedExam.id) ?? null : null;
  const activeExamAttempts = useMemo(
    () =>
      resolvedExam
        ? allMockAttemptsForComplex.filter((a) => a.examId === resolvedExam.id)
        : [],
    [resolvedExam, allMockAttemptsForComplex]
  );

  // Resolve current student for student/parent roles
  const linkedStudent = useMemo(() => {
    if (!session?.linkedStudentId) return students[0] ?? null;
    return students.find((s) => s.id === session.linkedStudentId) ?? students[0] ?? null;
  }, [session?.linkedStudentId, students]);

  const linkedClassName = useMemo(() => {
    if (!linkedStudent) return '';
    return classes.find((c) => c.id === linkedStudent.classId)?.name ?? '';
  }, [linkedStudent, classes]);

  const handleExamStatusChange = async (exam: MockExam, nextStatus: MockExamStatus) => {
    if (isViewingArchivedYear || !perms.edit) return;
    const res = await upsertMockExam({
      ...exam,
      status: nextStatus,
      updatedAtIso: new Date().toISOString(),
    });
    if (res.ok) {
      showToast(`وضعیت آزمون به «${STATUS_LABELS[nextStatus]}» تغییر یافت.`, 'success');
    } else {
      showToast(res.errorFa ?? 'تغییر وضعیت ناموفق بود.', 'error');
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (isViewingArchivedYear || !perms.delete) return;
    const res = await deleteMockExam(examId);
    setConfirmDeleteId(null);
    if (res.ok) {
      showToast('آزمون آزمایشی با موفقیت حذف شد.', 'success');
    } else {
      showToast(res.errorFa ?? 'حذف آزمون مجاز نیست.', 'error');
    }
  };

  const handleStudentSubmitAttempt = async (attempt: MockExamAttempt) => {
    const res = await upsertMockExamAttempt(attempt);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ثبت پاسخبرگ با خطا مواجه شد.', 'error');
      return;
    }
    const finishedId = attempt.examId;
    setTakingExam(null);
    setSelectedExamId(finishedId);
    showToast('پاسخبرگ شما با موفقیت ثبت شد و کارنامه تراز محاسبه گردید.', 'success');
  };

  // Full-screen Student Exam Simulator mode
  if (isStudent && takingExam && linkedStudent) {
    return (
      <StudentExamSimulator
        exam={takingExam}
        student={linkedStudent}
        className={linkedClassName}
        onSubmitAttempt={handleStudentSubmitAttempt}
        onCancel={() => setTakingExam(null)}
      />
    );
  }

  const pageTitle = getSectionTitle('mock-exams', 'آزمون تستی و آزمایشی (کنکوری)');

  // ==================== STUDENT & PARENT EXPERIENCE ====================
  if (isStudent || isParent) {
    const targetStudentId = linkedStudent?.id ?? '';
    const activeOnlineExams = isStudent
      ? yearExams.filter((ex) => {
          if (ex.status !== 'active') return false;
          const alreadyDone = allMockAttemptsForComplex.some(
            (a) => a.examId === ex.id && a.studentId === targetStudentId && a.status === 'submitted'
          );
          return !alreadyDone;
        })
      : [];

    const completedExams = yearExams.filter((ex) =>
      allMockAttemptsForComplex.some(
        (a) => a.examId === ex.id && a.studentId === targetStudentId && a.status === 'submitted'
      )
    );

    const activeReportExam =
      completedExams.find((e) => e.id === selectedExamId) ??
      completedExams[completedExams.length - 1] ??
      null;

    const studentAnalytics =
      activeReportExam && targetStudentId
        ? cohortReportsByExamId
            .get(activeReportExam.id)
            ?.students.find((s) => s.studentId === targetStudentId) ?? null
        : null;

    const studentAttempt =
      activeReportExam && targetStudentId
        ? allMockAttemptsForComplex.find(
            (a) => a.examId === activeReportExam.id && a.studentId === targetStudentId
          ) ?? null
        : null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {pageTitle}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isParent
                ? `کارنامه تراز، نمودار رشد چندمرحله‌ای و پاسخنامه تشریحی ${linkedStudent?.fullName ?? 'فرزند شما'} · سال تحصیلی ${toPersianDigits(selectedAcademicYear?.label ?? '')}`
                : `شرکت در آزمون‌های آزمایشی زمان‌دار، مشاهده تراز کل و کارنامه تحلیلی · سال تحصیلی ${toPersianDigits(selectedAcademicYear?.label ?? '')}`}
            </p>
          </div>
        </div>

        {/* Active Exams Ready to Take (Student Only, Not Archived Year) */}
        {isStudent && !isViewingArchivedYear && activeOnlineExams.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              آزمون‌های آزمایشی فعال آماده شرکت
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeOnlineExams.map((ex) => {
                const totalMins = ex.booklets.reduce((s, b) => s + b.durationMinutes, 0);
                return (
                  <div
                    key={ex.id}
                    data-testid={`active-mock-exam-card-${ex.id}`}
                    className="rounded-2xl border border-indigo-200 dark:border-indigo-900/70 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {ex.stageLabelFa} · {toPersianDigits(ex.examDateJalali)}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {ex.title}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {toPersianDigits(ex.booklets.length)} دفترچه · {toPersianDigits(ex.questions.length)} سوال ·{' '}
                        {toPersianDigits(totalMins)} دقیقه · {getNegativeMarkingLabelFa(ex.negativeMarking)}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`start-mock-exam-${ex.id}`}
                      onClick={() => setTakingExam(ex)}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl brand-btn text-sm font-bold px-4"
                    >
                      <Play className="w-4 h-4" />
                      شروع آزمون آزمایشی
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Exams Report Card Viewer */}
        {completedExams.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
            <Target className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              هنوز کارنامه آزمون آزمایشی ثبت نشده است
            </h3>
            <p className="text-xs text-slate-500">
              در سال تحصیلی {toPersianDigits(selectedAcademicYear?.label ?? '')} هنوز آزمونی برای این دانش‌آموز تصحیح یا ثبت نشده است.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                انتخاب مرحله آزمون جهت مشاهده کارنامه:
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {completedExams.map((ex) => {
                  const active = activeReportExam?.id === ex.id;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setSelectedExamId(ex.id)}
                      className={`min-h-[38px] rounded-xl px-3.5 text-xs font-bold transition-colors ${
                        active
                          ? 'brand-btn'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {ex.stageLabelFa}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeReportExam && studentAnalytics && studentAttempt && (
              <MockExamReportCard
                exam={activeReportExam}
                analytics={studentAnalytics}
                attempt={studentAttempt}
                tarazHistory={getStudentTarazHistory(targetStudentId)}
                canExport={perms.export}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // ==================== STAFF / MANAGEMENT EXPERIENCE ====================
  const visibleStaffStudents = activeCohort
    ? canViewComplexComparison && resolvedExam?.scope === 'complex'
      ? activeCohort.students
      : activeCohort.students.filter((s) => s.schoolId === activeSchoolId)
    : [];

  const resolvedStaffStudent =
    visibleStaffStudents.find((s) => s.studentId === selectedStudentId) ??
    visibleStaffStudents[0] ??
    null;

  const resolvedStaffAttempt = resolvedStaffStudent
    ? activeExamAttempts.find((a) => a.studentId === resolvedStaffStudent.studentId) ?? null
    : null;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {pageTitle}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            محاسبه تراز علمی، چند از ۱۰ همترازان، تحلیل سوال‌شناسی (سوالات دامدار)، ورود سریع پاسخبرگ و چاپ کارنامه A4/A5 · سال تحصیلی{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {toPersianDigits(selectedAcademicYear?.label ?? '')}
            </span>
          </p>
        </div>

        {perms.create && !isViewingArchivedYear && (
          <button
            type="button"
            data-testid="new-mock-exam-btn"
            onClick={() => {
              setEditingExam(null);
              setBuilderOpen(true);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl brand-btn px-4 text-xs sm:text-sm font-bold shrink-0"
          >
            <Plus className="w-4 h-4" />
            ثبت آزمون آزمایشی جدید
          </button>
        )}
      </div>

      {/* Archived Year Notice */}
      {isViewingArchivedYear && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Archive className="w-4 h-4 shrink-0" />
          <span>
            در حال مشاهده آرشیو آزمون‌های سال تحصیلی {toPersianDigits(selectedAcademicYear?.label ?? '')} هستید. ایجاد آزمون جدید، ویرایش کلید و ثبت پاسخبرگ غیرفعال است.
          </span>
        </div>
      )}

      {/* Exam Selector & 4-Tab Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            <label
              htmlFor="mock-exam-selector"
              className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0"
            >
              آزمون فعال:
            </label>
            <select
              id="mock-exam-selector"
              data-testid="mock-exam-selector"
              value={resolvedExam?.id ?? ''}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="flex-1 min-w-[220px] max-w-xl min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              {yearExams.length === 0 ? (
                <option value="">آزمونی در این سال تحصیلی ثبت نشده است</option>
              ) : (
                yearExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.stageLabelFa} — {ex.title} ({STATUS_LABELS[ex.status]})
                  </option>
                ))
              )}
            </select>
          </div>

          {resolvedExam && (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 tabular-nums">
              <span>{TRACK_PRESETS[resolvedExam.track].labelFa}</span>
              <span aria-hidden="true">·</span>
              <span>{toPersianDigits(resolvedExam.questions.length)} سوال</span>
              <span aria-hidden="true">·</span>
              <span>{getNegativeMarkingLabelFa(resolvedExam.negativeMarking)}</span>
            </div>
          )}
        </div>

        {/* Sub-navigation Tabs */}
        <div
          role="tablist"
          aria-label="بخش‌های آزمون آزمایشی"
          className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3"
        >
          {(
            [
              { id: 'analytics', label: 'تحلیل آماری، تراز و سوال‌شناسی', icon: BarChart3 },
              { id: 'report_card', label: 'کارنامه فردی دانش‌آموز', icon: FileCheck2 },
              { id: 'paper_entry', label: 'ورود سریع پاسخبرگ حضوری و CSV', icon: ClipboardEdit },
              { id: 'manage', label: 'مدیریت آزمون‌ها و انتشار', icon: Settings2 },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = staffTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-mock-tab={t.id}
                onClick={() => setStaffTab(t.id)}
                className={`min-h-[42px] inline-flex items-center justify-center sm:justify-start gap-1.5 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold transition-colors text-center sm:text-right ${
                  active
                    ? 'brand-btn'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      {!resolvedExam ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
            هیچ آزمون آزمایشی در سال تحصیلی {toPersianDigits(selectedAcademicYear?.label ?? '')} وجود ندارد
          </div>
          {perms.create && !isViewingArchivedYear && (
            <button
              type="button"
              onClick={() => {
                setEditingExam(null);
                setBuilderOpen(true);
              }}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-4 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              ساخت اولین آزمون آزمایشی
            </button>
          )}
        </div>
      ) : (
        <>
          {staffTab === 'analytics' && activeCohort && (
            <ManagementAnalyticsView
              exam={resolvedExam}
              cohort={activeCohort}
              attempts={activeExamAttempts}
              schools={schools}
              classes={classes}
              activeSchoolId={activeSchoolId}
              canViewComplexComparison={canViewComplexComparison}
              canExport={perms.export}
              getStudentTarazHistory={getStudentTarazHistory}
              onSelectStudentReport={(sid) => {
                setSelectedStudentId(sid);
                setStaffTab('report_card');
              }}
            />
          )}

          {staffTab === 'report_card' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                  <label
                    htmlFor="karnameh-student-select"
                    className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0"
                  >
                    انتخاب دانش‌آموز:
                  </label>
                  <select
                    id="karnameh-student-select"
                    value={resolvedStaffStudent?.studentId ?? ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="flex-1 max-w-md min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold"
                  >
                    {visibleStaffStudents.map((st) => (
                      <option key={st.studentId} value={st.studentId}>
                        رتبه {toPersianDigits(st.schoolRank)} — {st.studentName} ({st.className}) · تراز{' '}
                        {toPersianDigits(st.totalTaraz)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {toPersianDigits(visibleStaffStudents.length)} کارنامه آماده
                </span>
              </div>

              {resolvedStaffStudent && resolvedStaffAttempt ? (
                <MockExamReportCard
                  exam={resolvedExam}
                  analytics={resolvedStaffStudent}
                  attempt={resolvedStaffAttempt}
                  tarazHistory={getStudentTarazHistory(resolvedStaffStudent.studentId)}
                  canExport={perms.export}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  برای این آزمون هنوز پاسخبرگی ثبت نشده است. از تب «ورود سریع پاسخبرگ حضوری و CSV» نتایج را ثبت کنید.
                </div>
              )}
            </div>
          )}

          {staffTab === 'paper_entry' && (
            <PaperAnswerEntryTab
              exam={resolvedExam}
              students={students.filter((s) => s.active)}
              classes={classes}
              existingAttempts={activeExamAttempts.filter((a) => a.schoolId === activeSchoolId)}
              currentUserId={session?.userId ?? 'staff'}
              readOnly={isViewingArchivedYear || !perms.create}
              onSaveAttempt={upsertMockExamAttempt}
              onSaveBatch={upsertMockExamAttemptsBatch}
            />
          )}

          {staffTab === 'manage' && (
            <div className="space-y-3">
              {yearExams.map((ex) => {
                const count = allMockAttemptsForComplex.filter((a) => a.examId === ex.id).length;
                const canEditThis =
                  !isViewingArchivedYear &&
                  perms.edit &&
                  (ex.scope === 'school' || canViewComplexComparison);
                const canDeleteThis =
                  !isViewingArchivedYear &&
                  perms.delete &&
                  (ex.scope === 'school' || canViewComplexComparison);

                return (
                  <div
                    key={ex.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {ex.title}
                        </span>
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                          · {STATUS_LABELS[ex.status]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {ex.stageLabelFa} · تاریخ {toPersianDigits(ex.examDateJalali)} ·{' '}
                        {toPersianDigits(ex.questions.length)} سوال ·{' '}
                        {toPersianDigits(count)} شرکت‌کننده ·{' '}
                        {ex.scope === 'complex' ? 'هماهنگ کل مجموعه' : 'مستقل مدرسه'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canEditThis && (
                        <>
                          <select
                            aria-label="تغییر وضعیت آزمون"
                            value={ex.status}
                            onChange={(e) =>
                              void handleExamStatusChange(ex, e.target.value as MockExamStatus)
                            }
                            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold"
                          >
                            <option value="draft">پیش‌نویس</option>
                            <option value="active">فعال (قابل شرکت)</option>
                            <option value="published">منتشر شده</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingExam(ex);
                              setBuilderOpen(true);
                            }}
                            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            ویرایش ساختار و کلید
                          </button>
                        </>
                      )}

                      {canDeleteThis &&
                        (confirmDeleteId === ex.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDeleteExam(ex.id)}
                              className="min-h-[38px] rounded-xl bg-rose-600 text-white px-3 text-xs font-bold"
                            >
                              تأیید حذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
                            >
                              انصراف
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(ex.id)}
                            aria-label="حذف آزمون"
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Exam Builder Modal */}
      {builderOpen && (
        <ExamBuilderModal
          initialExam={editingExam}
          activeSchoolId={activeSchoolId}
          activeComplexId={activeSchool.complexId ?? DEFAULT_COMPLEX_ID}
          academicYearId={selectedAcademicYearId}
          currentUserId={session?.userId ?? 'staff'}
          canCreateComplexScope={canViewComplexComparison}
          onSave={async (examPayload) => {
            const res = await upsertMockExam(examPayload);
            if (res.ok) {
              setSelectedExamId(examPayload.id);
              showToast(
                editingExam
                  ? 'تغییرات آزمون آزمایشی ذخیره شد.'
                  : 'آزمون آزمایشی جدید با موفقیت ایجاد شد.',
                'success'
              );
            }
            return res;
          }}
          onClose={() => {
            setBuilderOpen(false);
            setEditingExam(null);
          }}
        />
      )}
    </div>
  );
};

export const MockExamsPage: React.FC = () => (
  <ErrorBoundary>
    <MockExamsInner />
  </ErrorBoundary>
);
