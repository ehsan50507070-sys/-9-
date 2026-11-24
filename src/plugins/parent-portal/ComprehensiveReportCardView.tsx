// Comprehensive Multi-Timeframe All-Subjects Report Card & Progress Analytics View
// Shared by Parent Portal (/parent-portal) and Parent Report Card view in Gradebook (/gradebook).
import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Copy,
  FileWarning,
  GraduationCap,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { getMediaBlob } from '../../core/data/mediaBlobStore';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  ClassRoom,
  DescriptiveLevel,
  GradebookEntry,
  GradebookWeightConfig,
  HomeworkAssignment,
  HomeworkSubmission,
  JalaliAcademicMonth,
  OnlineExam,
  OnlineExamSubmission,
  School,
  Student,
  StudentAttendanceRecord,
  StudentElectronicProfile,
} from '../../types/domain';
import {
  ALL_ACADEMIC_MONTHS,
  buildComprehensiveParentReport,
  formatSingleColumnReportForMessenger,
  getShortDescriptiveLabel,
  TERM1_MONTHS,
  TERM2_MONTHS,
  TIMEFRAME_OPTIONS,
  type ComprehensiveSubjectRow,
  type FullYearTableMode,
  type GradeDisplayMode,
  type ReportTimeframe,
} from './parentReportCardHelpers';
import { OverallGpaTrendSvgChart, PerSubjectProgressGrid } from './SubjectProgressCharts';

export interface QuickAppealRequest {
  subject: string;
  jalaliMonth: JalaliAcademicMonth;
  gradeEntryId: string;
  score: number;
}

export interface ComprehensiveReportCardViewProps {
  student: Student;
  classRoom: ClassRoom | null;
  school: School;
  studentProfile?: StudentElectronicProfile;
  gradebookEntries: GradebookEntry[];
  gradebookWeights: GradebookWeightConfig[];
  studentAttendance: StudentAttendanceRecord[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  timeframe: ReportTimeframe;
  onTimeframeChange: (tf: ReportTimeframe) => void;
  selectedMonth: JalaliAcademicMonth;
  onSelectedMonthChange: (m: JalaliAcademicMonth) => void;
  selectedSubject: string;
  onSelectedSubjectChange: (subj: string) => void;
  onQuickAppeal?: (req: QuickAppealRequest) => void;
  isParent: boolean;
  onNotify?: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

function getDescriptiveLevelBadgeClass(level: DescriptiveLevel): string {
  switch (level) {
    case 'خیلی خوب':
      return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'خوب':
      return 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    case 'قابل قبول':
      return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    default:
      return 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  }
}

function getStudentInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'د';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0][0] ?? ''}‌.${parts[parts.length - 1][0] ?? ''}`;
}

export const ComprehensiveReportCardView: React.FC<ComprehensiveReportCardViewProps> = ({
  student,
  classRoom,
  school,
  studentProfile,
  gradebookEntries,
  gradebookWeights,
  studentAttendance,
  homeworkAssignments,
  homeworkSubmissions,
  onlineExams,
  onlineExamSubmissions,
  timeframe,
  onTimeframeChange,
  selectedMonth,
  onSelectedMonthChange,
  selectedSubject,
  onSelectedSubjectChange,
  onQuickAppeal,
  isParent,
  onNotify,
}) => {
  const [displayMode, setDisplayMode] = useState<GradeDisplayMode>('combined');
  const [fullYearTableMode, setFullYearTableMode] = useState<FullYearTableMode>('summary');
  const [copiedInline, setCopiedInline] = useState(false);
  const [studentPhotoDataUrl, setStudentPhotoDataUrl] = useState<string | null>(null);

  // Resolve student's personal photo as a print-safe DataURL (works reliably inside PrintPreviewPortal iframe)
  useEffect(() => {
    let cancelled = false;
    const photoDoc = studentProfile?.documents.find(
      (d) => d.docCategory === 'photo' && d.kind === 'image'
    );
    if (!photoDoc) {
      setStudentPhotoDataUrl(null);
      return;
    }

    void getMediaBlob(photoDoc.mediaId, school.id).then((rec) => {
      if (cancelled || !rec?.blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled && typeof reader.result === 'string') {
          setStudentPhotoDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(rec.blob);
    });

    return () => {
      cancelled = true;
    };
  }, [studentProfile, school.id]);

  const report = useMemo(
    () =>
      buildComprehensiveParentReport({
        studentId: student.id,
        studentName: student.fullName,
        classId: student.classId,
        schoolId: school.id,
        timeframe,
        selectedMonth,
        selectedSubject,
        gradebookEntries,
        gradebookWeights,
        studentAttendance,
        homeworkAssignments,
        homeworkSubmissions,
        onlineExams,
        onlineExamSubmissions,
      }),
    [
      student.id,
      student.fullName,
      student.classId,
      school.id,
      timeframe,
      selectedMonth,
      selectedSubject,
      gradebookEntries,
      gradebookWeights,
      studentAttendance,
      homeworkAssignments,
      homeworkSubmissions,
      onlineExams,
      onlineExamSubmissions,
    ]
  );

  // Published online exams for reference below report card
  const publishedExamResults = useMemo(() => {
    const examById = new Map(onlineExams.map((e) => [e.id, e]));
    return onlineExamSubmissions
      .filter((s) => {
        if (s.studentId !== student.id) return false;
        const ex = examById.get(s.examId);
        if (!ex || ex.status === 'draft') return false;
        if (selectedSubject !== 'ALL' && ex.subject !== selectedSubject) return false;
        return true;
      })
      .map((sub) => ({ sub, exam: examById.get(sub.examId)! }));
  }, [student.id, onlineExams, onlineExamSubmissions, selectedSubject]);

  const handleCopyReport = async () => {
    const text = formatSingleColumnReportForMessenger({
      schoolName: school.name,
      studentName: student.fullName,
      className: classRoom?.name ?? '',
      academicYear: school.academicYear,
      todayJalali: getTodayJalali(),
      report,
      displayMode,
    });
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedInline(true);
      window.setTimeout(() => setCopiedInline(false), 2400);
      onNotify?.('متن کارنامه توصیفی (تک‌ستونه ویژه ایتا، بله و شاد) کپی شد.', 'success');
    } else {
      onNotify?.('امکان کپی در کلیپ‌بورد وجود نداشت.', 'error');
    }
  };

  const renderScoreCell = (score: number, level?: DescriptiveLevel) => {
    const resolvedLevel = level ?? (score >= 17 ? 'خیلی خوب' : score >= 14 ? 'خوب' : score >= 11 ? 'قابل قبول' : 'نیاز به تلاش بیشتر');
    if (displayMode === 'descriptive') {
      return (
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
          {getShortDescriptiveLabel(resolvedLevel)}
        </span>
      );
    }
    if (displayMode === 'numeric') {
      return (
        <span className="font-extrabold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
          {toPersianDigits(score.toFixed(1))}
        </span>
      );
    }
    return (
      <div className="tabular-nums whitespace-nowrap">
        <span className="font-extrabold text-slate-900 dark:text-white">
          {toPersianDigits(score.toFixed(1))}
        </span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400">
          {getShortDescriptiveLabel(resolvedLevel)}
        </span>
      </div>
    );
  };

  const renderDeltaCell = (delta: number, tone: ComprehensiveSubjectRow['activeTrendTone']) => {
    const absFa = toPersianDigits(Math.abs(delta).toFixed(1));
    if (tone === 'improving' || delta >= 0.4) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
          <span>▲</span>
          <span>+{absFa} رشد</span>
        </span>
      );
    }
    if (tone === 'declining' || delta <= -0.4) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums whitespace-nowrap">
          <span>▼</span>
          <span>-{absFa} افت</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
        <span>●</span>
        <span>پایدار</span>
      </span>
    );
  };

  const renderAppealAction = (row: ComprehensiveSubjectRow) => {
    if (!onQuickAppeal) return null;
    return (
      <td className="no-print py-2.5 px-2.5 text-center whitespace-nowrap">
        <button
          type="button"
          onClick={() =>
            onQuickAppeal({
              subject: row.subject,
              jalaliMonth: row.appealMonth,
              gradeEntryId: row.appealGradeEntryId,
              score: row.appealScore,
            })
          }
          title={
            isParent
              ? `ثبت درخواست بازبینی نمره درس ${row.subject}`
              : `مشاهده بخش اعتراض نمره برای درس ${row.subject}`
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300 transition-colors whitespace-nowrap"
        >
          <FileWarning className="w-3.5 h-3.5 shrink-0" />
          <span>اعتراض نمره</span>
        </button>
      </td>
    );
  };

  const printDocTitle = `کارنامه جامع تحصیلی (${report.timeframeLabelFa}) — ${student.fullName}`;
  const isWideLandscapePrint =
    timeframe === 'full_year' && fullYearTableMode === 'full_9months';

  return (
    <div className="space-y-4">
      {/* Interactive Timeframe, Subject, Display Mode & Action Toolbar (no-print) */}
      <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Segmented Timeframe Pills (2x2 balanced grid on mobile, single row on sm+) */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <div
              role="group"
              aria-label="انتخاب بازه زمانی کارنامه"
              className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700"
            >
              {TIMEFRAME_OPTIONS.map((opt) => {
                const active = timeframe === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`timeframe-btn-${opt.id}`}
                    aria-pressed={active}
                    onClick={() => onTimeframeChange(opt.id)}
                    className={`min-h-[36px] px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 text-center ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.labelFa}
                  </button>
                );
              })}
            </div>

            {/* Conditional Jalali Month Dropdown in Monthly Mode */}
            {timeframe === 'monthly' && (
              <select
                aria-label="انتخاب ماه تحصیلی"
                data-testid="monthly-jalali-select"
                value={selectedMonth}
                onChange={(e) => onSelectedMonthChange(e.target.value as JalaliAcademicMonth)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100"
              >
                {ALL_ACADEMIC_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    ماه {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject Filter Dropdown + Paired Copy/Print Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="فیلتر درس کارنامه"
              data-testid="subject-filter-select"
              value={selectedSubject}
              onChange={(e) => onSelectedSubjectChange(e.target.value)}
              className="flex-1 sm:flex-initial min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">همه دروس (کارنامه کامل)</option>
              {report.availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  درس: {subj}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="copy-descriptive-btn"
                onClick={() => void handleCopyReport()}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
              >
                {copiedInline ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 shrink-0" />
                )}
                <span>{copiedInline ? 'کپی شد' : 'کپی متن توصیفی'}</span>
              </button>

              <PrintIconButton
                landscape={isWideLandscapePrint}
                documentLabel={`کارنامه ${report.timeframeLabelFa}`}
              />
            </div>
          </div>
        </div>

        {/* Second Utility Row: Display Mode (عددی / توصیفی / ترکیبی) + Full-Year View Switch */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              قالب نمایش کارنامه:
            </span>
            <div
              role="group"
              aria-label="قالب نمایش نمرات"
              className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700"
            >
              {(
                [
                  { id: 'combined', label: 'ترکیبی' },
                  { id: 'numeric', label: 'عددی' },
                  { id: 'descriptive', label: 'توصیفی' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`display-mode-${m.id}`}
                  aria-pressed={displayMode === m.id}
                  onClick={() => setDisplayMode(m.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    displayMode === m.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {timeframe === 'full_year' && (
            <div
              role="group"
              aria-label="نمای جدول کل سال"
              className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700"
            >
              <button
                type="button"
                data-testid="fullyear-mode-summary"
                aria-pressed={fullYearTableMode === 'summary'}
                onClick={() => setFullYearTableMode('summary')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  fullYearTableMode === 'summary'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                نمای خلاصه دو ترم
              </button>
              <button
                type="button"
                data-testid="fullyear-mode-9months"
                aria-pressed={fullYearTableMode === 'full_9months'}
                onClick={() => setFullYearTableMode('full_9months')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  fullYearTableMode === 'full_9months'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                نمای کامل ۹ ماهه (مهر تا خرداد)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Printable Official Report Card Container */}
      <PrintShell
        school={school}
        documentTitle={printDocTitle}
        subtitle={`کلاس ${classRoom?.name ?? '—'} · ${selectedSubject === 'ALL' ? 'همه دروس (کارنامه کامل)' : `درس ${selectedSubject}`} · تاریخ استعلام: ${formatJalaliDisplay(getTodayJalali(), true)}`}
        landscape={isWideLandscapePrint}
      >
        <div className="space-y-5">
          {/* Student Identity & Photo Banner (Visible on Screen & A4/A5 Printout) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 break-inside-avoid">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/50 overflow-hidden flex items-center justify-center shrink-0">
                {studentPhotoDataUrl ? (
                  <img
                    src={studentPhotoDataUrl}
                    alt={`عکس ${student.fullName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                    {getStudentInitials(student.fullName)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {student.fullName}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>کلاس: {classRoom?.name ?? '—'}</span>
                  <span aria-hidden="true">·</span>
                  <span>کد دانش‌آموزی: {toPersianDigits(student.studentCode)}</span>
                  <span aria-hidden="true">·</span>
                  <span>سال تحصیلی: {toPersianDigits(school.academicYear)}</span>
                </div>
              </div>
            </div>

            <div className="text-right sm:text-left text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <div className="font-bold text-slate-800 dark:text-slate-100">
                بازه کارنامه: {report.timeframeLabelFa}
              </div>
              <div>
                محدوده دروس:{' '}
                {selectedSubject === 'ALL'
                  ? `همه دروس (${toPersianDigits(report.visibleSubjectRows.length)} درس)`
                  : `درس ${selectedSubject}`}
              </div>
            </div>
          </div>

          {/* Top 4 Timeframe-Aware KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{report.kpis.primaryGpaLabel}</span>
                <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
                {toPersianDigits(report.kpis.primaryGpaValue.toFixed(2))}{' '}
                <span className="text-xs font-bold text-slate-400">/ ۲۰</span>
              </div>
              <div className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                سطح: {report.kpis.primaryGpaLevel}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {timeframe === 'monthly'
                    ? 'نرخ حضور در این ماه'
                    : timeframe === 'full_year'
                      ? 'نرخ حضور کل سال'
                      : 'نرخ حضور در این نوبت'}
                </span>
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
                {toPersianDigits(report.kpis.attendanceRatePercent)}٪
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {report.kpis.attendanceRatePercent >= 95
                  ? 'نظم و حضور درخشان'
                  : 'مبتنی بر حضور کلاسی ثبت‌شده'}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {timeframe === 'full_year' ? 'نرخ تحویل تکالیف کل سال' : 'نرخ تحویل تکالیف'}
                </span>
                <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
                {toPersianDigits(report.kpis.homeworkCompletionPercent)}٪
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                مشارکت در تکالیف و تمرین‌ها
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{report.kpis.secondaryMetricLabel}</span>
                {timeframe === 'full_year' && report.kpis.termComparisonDelta < -0.25 ? (
                  <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </div>
              <div
                className={`mt-2 text-xl sm:text-2xl font-extrabold ${
                  report.kpis.secondaryMetricTone === 'emerald'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : report.kpis.secondaryMetricTone === 'amber'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {report.kpis.secondaryMetricValueFa}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {report.kpis.secondaryMetricHintFa}
              </div>
            </div>
          </div>

          {/* All-Subjects Adaptive Report Card Table */}
          <section
            data-testid="all-subjects-report-table"
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedSubject === 'ALL'
                    ? `کارنامه جامع همه دروس — ${report.timeframeLabelFa}`
                    : `کارنامه تحلیلی درس ${selectedSubject} — ${report.timeframeLabelFa}`}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  نمایش هم‌زمان دروس با تفکیک وضعیت توصیفی و روند پیشرفت
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {toPersianDigits(report.visibleSubjectRows.length)} درس فعال
              </span>
            </div>

            <div className="overflow-x-auto">
              {/* MODE 1: MONTHLY TABLE */}
              {timeframe === 'monthly' && (
                <table className="w-full text-right text-xs sm:text-sm border-collapse tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-3 whitespace-nowrap">نام درس</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">نمره مستمر هوشمند</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">
                        نمره ارزشیابی {selectedMonth}
                      </th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">وضعیت توصیفی</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">
                        تغییر نسبت به ماه قبل
                      </th>
                      {onQuickAppeal && (
                        <th className="no-print py-3 px-2.5 text-center whitespace-nowrap">
                          اعتراض نمره
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.visibleSubjectRows.map((row) => (
                      <tr
                        key={row.subject}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {row.subject}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-700 dark:text-slate-200">
                          {renderScoreCell(row.continuousScore)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderScoreCell(row.monthlyScore, row.activeLevel)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${getDescriptiveLevelBadgeClass(
                              row.activeLevel
                            )}`}
                          >
                            {getShortDescriptiveLabel(row.activeLevel)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {row.previousMonthScore !== null ? (
                            renderDeltaCell(row.monthlyDelta, row.monthlyTrendTone)
                          ) : (
                            <span className="text-xs text-slate-400">شروع سال</span>
                          )}
                        </td>
                        {renderAppealAction(row)}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white">
                      <td className="py-3 px-3 whitespace-nowrap">معدل و جمع‌بندی ماه {selectedMonth}</td>
                      <td className="py-3 px-3 text-center">
                        {toPersianDigits(
                          (
                            report.visibleSubjectRows.reduce((s, r) => s + r.continuousScore, 0) /
                            Math.max(1, report.visibleSubjectRows.length)
                          ).toFixed(2)
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(report.kpis.primaryGpaValue.toFixed(2))} از ۲۰
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getShortDescriptiveLabel(report.kpis.primaryGpaLevel)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderDeltaCell(
                          report.overallTrendSeries.delta,
                          report.overallTrendSeries.trendTone
                        )}
                      </td>
                      {onQuickAppeal && <td className="no-print" />}
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* MODE 2: TERM 1 OR TERM 2 TABLE */}
              {(timeframe === 'term1' || timeframe === 'term2') && (
                <table className="w-full text-right text-xs sm:text-sm border-collapse tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-3 whitespace-nowrap">نام درس</th>
                      {(timeframe === 'term1' ? TERM1_MONTHS : TERM2_MONTHS).map((m) => (
                        <th key={m} className="py-3 px-2.5 text-center whitespace-nowrap">
                          {m}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-center whitespace-nowrap">
                        میانگین {timeframe === 'term1' ? 'نوبت اول' : 'نوبت دوم'}
                      </th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">وضعیت توصیفی</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">روند ترم</th>
                      {onQuickAppeal && (
                        <th className="no-print py-3 px-2.5 text-center whitespace-nowrap">
                          اعتراض نمره
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.visibleSubjectRows.map((row) => {
                      const termMonths = timeframe === 'term1' ? TERM1_MONTHS : TERM2_MONTHS;
                      return (
                        <tr
                          key={row.subject}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                            {row.subject}
                          </td>
                          {termMonths.map((m) => (
                            <td key={m} className="py-3 px-2.5 text-center">
                              {renderScoreCell(row.monthScores[m])}
                            </td>
                          ))}
                          <td className="py-3 px-3 text-center font-extrabold text-indigo-700 dark:text-indigo-300">
                            {renderScoreCell(row.activeScore, row.activeLevel)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${getDescriptiveLevelBadgeClass(
                                row.activeLevel
                              )}`}
                            >
                              {getShortDescriptiveLabel(row.activeLevel)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {renderDeltaCell(row.activeDelta, row.activeTrendTone)}
                          </td>
                          {renderAppealAction(row)}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white">
                      <td className="py-3 px-3 whitespace-nowrap">
                        معدل کل {timeframe === 'term1' ? 'نوبت اول' : 'نوبت دوم'}
                      </td>
                      {(timeframe === 'term1' ? TERM1_MONTHS : TERM2_MONTHS).map((m) => {
                        const avg =
                          report.visibleSubjectRows.reduce((s, r) => s + r.monthScores[m], 0) /
                          Math.max(1, report.visibleSubjectRows.length);
                        return (
                          <td key={m} className="py-3 px-2.5 text-center">
                            {toPersianDigits(avg.toFixed(1))}
                          </td>
                        );
                      })}
                      <td className="py-3 px-3 text-center text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(report.kpis.primaryGpaValue.toFixed(2))} از ۲۰
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getShortDescriptiveLabel(report.kpis.primaryGpaLevel)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderDeltaCell(
                          report.overallTrendSeries.delta,
                          report.overallTrendSeries.trendTone
                        )}
                      </td>
                      {onQuickAppeal && <td className="no-print" />}
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* MODE 3A: FULL-YEAR SUMMARY VIEW (BOTH TERMS) */}
              {timeframe === 'full_year' && fullYearTableMode === 'summary' && (
                <table className="w-full text-right text-xs sm:text-sm border-collapse tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-3 whitespace-nowrap">نام درس</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">نوبت اول (ترم ۱)</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">نوبت دوم (ترم ۲)</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">میانگین کل سال</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">
                        مقایسه ترم ۲ نسبت به ترم ۱
                      </th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">
                        وضعیت نهایی توصیفی
                      </th>
                      {onQuickAppeal && (
                        <th className="no-print py-3 px-2.5 text-center whitespace-nowrap">
                          اعتراض نمره
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.visibleSubjectRows.map((row) => (
                      <tr
                        key={row.subject}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {row.subject}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderScoreCell(row.term1Average)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderScoreCell(row.term2Average)}
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-indigo-700 dark:text-indigo-300">
                          {renderScoreCell(row.fullYearAverage, row.activeLevel)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderDeltaCell(row.termComparisonDelta, row.activeTrendTone)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${getDescriptiveLevelBadgeClass(
                              row.activeLevel
                            )}`}
                          >
                            {getShortDescriptiveLabel(row.activeLevel)}
                          </span>
                        </td>
                        {renderAppealAction(row)}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white">
                      <td className="py-3 px-3 whitespace-nowrap">معدل کل سال تحصیلی</td>
                      <td className="py-3 px-3 text-center">
                        {toPersianDigits(report.kpis.term1Gpa.toFixed(2))}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {toPersianDigits(report.kpis.term2Gpa.toFixed(2))}
                      </td>
                      <td className="py-3 px-3 text-center text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(report.kpis.primaryGpaValue.toFixed(2))} از ۲۰
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderDeltaCell(
                          report.kpis.termComparisonDelta,
                          report.overallTrendSeries.trendTone
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getShortDescriptiveLabel(report.kpis.primaryGpaLevel)}
                      </td>
                      {onQuickAppeal && <td className="no-print" />}
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* MODE 3B: FULL-YEAR 9-MONTH MATRIX VIEW (مهر تا خرداد + هر دو ترم) */}
              {timeframe === 'full_year' && fullYearTableMode === 'full_9months' && (
                <table className="w-full text-right text-xs border-collapse tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 px-2.5 whitespace-nowrap">نام درس</th>
                      {TERM1_MONTHS.map((m) => (
                        <th key={m} className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 whitespace-nowrap">
                        ترم ۱
                      </th>
                      {TERM2_MONTHS.map((m) => (
                        <th key={m} className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                        ترم ۲
                      </th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">سالانه</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.visibleSubjectRows.map((row) => (
                      <tr
                        key={row.subject}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-2.5 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {row.subject}
                        </td>
                        {TERM1_MONTHS.map((m) => (
                          <td key={m} className="py-2.5 px-1.5 text-center text-slate-700 dark:text-slate-200">
                            {displayMode === 'descriptive'
                              ? getShortDescriptiveLabel(
                                  row.monthScores[m] >= 17
                                    ? 'خیلی خوب'
                                    : row.monthScores[m] >= 14
                                      ? 'خوب'
                                      : 'قابل قبول'
                                )
                              : toPersianDigits(row.monthScores[m].toFixed(1))}
                          </td>
                        ))}
                        <td className="py-2.5 px-2 text-center font-extrabold bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300">
                          {toPersianDigits(row.term1Average.toFixed(1))}
                        </td>
                        {TERM2_MONTHS.map((m) => (
                          <td key={m} className="py-2.5 px-1.5 text-center text-slate-700 dark:text-slate-200">
                            {displayMode === 'descriptive'
                              ? getShortDescriptiveLabel(
                                  row.monthScores[m] >= 17
                                    ? 'خیلی خوب'
                                    : row.monthScores[m] >= 14
                                      ? 'خوب'
                                      : 'قابل قبول'
                                )
                              : toPersianDigits(row.monthScores[m].toFixed(1))}
                          </td>
                        ))}
                        <td className="py-2.5 px-2 text-center font-extrabold bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300">
                          {toPersianDigits(row.term2Average.toFixed(1))}
                        </td>
                        <td className="py-2.5 px-2 text-center font-extrabold text-slate-900 dark:text-white">
                          {toPersianDigits(row.fullYearAverage.toFixed(1))}
                        </td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-bold ${getDescriptiveLevelBadgeClass(
                              row.activeLevel
                            )}`}
                          >
                            {getShortDescriptiveLabel(row.activeLevel)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white">
                      <td className="py-2.5 px-2.5 whitespace-nowrap">معدل کل</td>
                      {TERM1_MONTHS.map((m) => {
                        const avg =
                          report.visibleSubjectRows.reduce((s, r) => s + r.monthScores[m], 0) /
                          Math.max(1, report.visibleSubjectRows.length);
                        return (
                          <td key={m} className="py-2.5 px-1.5 text-center">
                            {toPersianDigits(avg.toFixed(1))}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2 text-center text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(report.kpis.term1Gpa.toFixed(2))}
                      </td>
                      {TERM2_MONTHS.map((m) => {
                        const avg =
                          report.visibleSubjectRows.reduce((s, r) => s + r.monthScores[m], 0) /
                          Math.max(1, report.visibleSubjectRows.length);
                        return (
                          <td key={m} className="py-2.5 px-1.5 text-center">
                            {toPersianDigits(avg.toFixed(1))}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2 text-center text-emerald-700 dark:text-emerald-300">
                        {toPersianDigits(report.kpis.term2Gpa.toFixed(2))}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {toPersianDigits(report.kpis.primaryGpaValue.toFixed(2))}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {getShortDescriptiveLabel(report.kpis.primaryGpaLevel)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </section>

          {/* Overall GPA Trend Chart (shown when ALL subjects are active) */}
          {selectedSubject === 'ALL' && (
            <OverallGpaTrendSvgChart
              series={report.overallTrendSeries}
              timeframeLabelFa={report.timeframeLabelFa}
            />
          )}

          {/* Dedicated Per-Subject Dynamic SVG Progress Charts Grid */}
          <PerSubjectProgressGrid
            charts={report.subjectCharts}
            timeframe={timeframe}
            timeframeLabelFa={report.timeframeLabelFa}
          />

          {/* Smart Descriptive Summary Assistant */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-2 break-inside-avoid">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  دستیار هوشمند متن توصیفی ({report.timeframeLabelFa})
                </h3>
              </div>
              <span className="no-print text-[11px] text-slate-400 dark:text-slate-500">
                قابل کپی تک‌ستونه ویژه ایتا، بله و شاد
              </span>
            </div>
            <p className="text-xs sm:text-sm leading-7 text-slate-700 dark:text-slate-200">
              {report.descriptiveSummaryFa}
            </p>
          </section>

          {/* Published Online Exam Results (when available) */}
          {publishedExamResults.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 break-inside-avoid">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                ریزنتایج آزمون‌های آنلاین منتشرشده
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publishedExamResults.map(({ exam, sub }) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {exam.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        درس {exam.subject} · تاریخ: {toPersianDigits(exam.startDateJalali)}
                      </div>
                    </div>
                    <div className="text-left shrink-0 tabular-nums">
                      <div className="text-sm sm:text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(sub.finalScore20)} از ۲۰
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {sub.gradingStatus === 'finalized' ? 'تصحیح کامل' : 'ثبت سیستمی'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </PrintShell>
    </div>
  );
};
