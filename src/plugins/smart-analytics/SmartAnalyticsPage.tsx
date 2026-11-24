// Plugin 2: Smart Academic Analytics & Progress Tracking Dashboard («داشبورد تحلیل هوشمند و رصد پیشرفت»)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  Check,
  Copy,
  FileSpreadsheet,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useSectionLabel } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { triggerPrint, type PrintPaperSize } from '../../core/print/printService';
import {
  SvgGroupedBarChart,
  SvgHorizontalBarChart,
  SvgTrendLineChart,
} from '../../core/ui/SvgCharts';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type { RemedialPlanRecord, RemedialPlanStatus } from '../../types/domain';
import {
  buildRemedialRecommendationsCsv,
  buildSmartAnalyticsMessengerReport,
  computeComplexAnalyticsComparison,
  computeSmartAnalyticsReport,
  INSIGHT_SEVERITY_LABELS,
  REMEDIAL_STATUS_LABELS,
  type RemedialRecommendation,
} from './smartAnalyticsHelpers';

type AnalyticsTabId = 'overview' | 'remedial' | 'teachers' | 'complex';
type AnalyticsPrintKind = 'executive' | 'remedial';

export const SmartAnalyticsPage: React.FC = () => {
  const {
    session,
    activeRole,
    roleDef,
    activeSchool,
    activeSchoolId,
    students,
    classes,
    teachers,
    gradebookEntries,
    studentAttendance,
    homeworkAssignments,
    homeworkSubmissions,
    onlineExams,
    onlineExamSubmissions,
    flippedTelemetry,
    studentRewards,
    remedialPlans,
    complexPhase6Dataset,
    upsertRemedialPlan,
    deleteRemedialPlan,
  } = useSchoolData();

  const { getSectionTitle } = useSectionLabel();
  const sectionLabel = getSectionTitle('smart-analytics', 'داشبورد تحلیل هوشمند و رصد پیشرفت');
  const todayJalali = getTodayJalali();

  const canViewTeacherAnalytics = roleDef.canViewTeacherAnalytics;
  const canViewComplex = roleDef.canViewComplexComparison && Boolean(complexPhase6Dataset);
  const canDeleteRemedial = activeRole !== 'teacher';

  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('overview');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [printKind, setPrintKind] = useState<AnalyticsPrintKind>('executive');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const report = useMemo(
    () =>
      computeSmartAnalyticsReport({
        students,
        classes,
        teachers,
        gradebookEntries,
        studentAttendance,
        homeworkAssignments,
        homeworkSubmissions,
        onlineExams,
        onlineExamSubmissions,
        flippedTelemetry,
        studentRewards,
        remedialPlans,
      }),
    [
      students,
      classes,
      teachers,
      gradebookEntries,
      studentAttendance,
      homeworkAssignments,
      homeworkSubmissions,
      onlineExams,
      onlineExamSubmissions,
      flippedTelemetry,
      studentRewards,
      remedialPlans,
    ]
  );

  const complexRows = useMemo(() => {
    if (!canViewComplex || !complexPhase6Dataset) return [];
    return computeComplexAnalyticsComparison({
      schools: complexPhase6Dataset.schools,
      classes: complexPhase6Dataset.classes,
      students: complexPhase6Dataset.students,
      teachers: complexPhase6Dataset.teachers,
      gradebookEntries: complexPhase6Dataset.gradebookEntries,
      studentAttendance: complexPhase6Dataset.studentAttendance,
      homeworkAssignments: complexPhase6Dataset.homeworkAssignments,
      homeworkSubmissions: complexPhase6Dataset.homeworkSubmissions,
      onlineExams: complexPhase6Dataset.onlineExams,
      onlineExamSubmissions: complexPhase6Dataset.onlineExamSubmissions,
      flippedTelemetry: complexPhase6Dataset.flippedTelemetry,
      remedialPlans: complexPhase6Dataset.remedialPlans,
    });
  }, [canViewComplex, complexPhase6Dataset]);

  const studentNameMap = useMemo(
    () => new Map(students.map((s) => [s.id, s.fullName])),
    [students]
  );
  const classNameMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    report.remedialRecommendations.forEach((r) => set.add(r.subject));
    return Array.from(set);
  }, [report.remedialRecommendations]);

  const filteredRecommendations = useMemo(
    () =>
      subjectFilter === 'all'
        ? report.remedialRecommendations
        : report.remedialRecommendations.filter((r) => r.subject === subjectFilter),
    [report.remedialRecommendations, subjectFilter]
  );

  // Strict RBAC guard: parent & student blocked completely
  if (!roleDef.canAccessSmartAnalytics) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-6 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-extrabold text-rose-900 dark:text-rose-200">
          عدم دسترسی به داشبورد تحلیل هوشمند
        </h2>
        <p className="text-xs text-rose-700 dark:text-rose-300">
          این بخش ویژه کادر مدیریت و معلمان مدرسه است و برای نقش کاربری فعلی غیرفعال است.
        </p>
      </div>
    );
  }

  const handlePrint = (kind: AnalyticsPrintKind, size: PrintPaperSize) => {
    setPrintKind(kind);
    setTimeout(() => {
      triggerPrint({ size, orientation: 'portrait' });
    }, 60);
  };

  const handleCopyExecutive = async () => {
    const text = buildSmartAnalyticsMessengerReport({
      schoolName: activeSchool.name,
      todayJalali,
      report,
    });
    await copyTextToClipboard(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2200);
  };

  const handleExportRemedialCsv = () => {
    const csv = buildRemedialRecommendationsCsv(filteredRecommendations);
    downloadTextFile(
      `remedial-recommendations-${todayJalali.replace(/\//g, '-')}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  const handleAddToRemedialPlan = (rec: RemedialRecommendation) => {
    const alreadyExists = remedialPlans.some(
      (p) => p.studentId === rec.studentId && p.subject === rec.subject
    );
    if (alreadyExists) {
      setActionNotice(`برنامه تقویتی درس ${rec.subject} برای ${rec.studentName} قبلاً ثبت شده است.`);
      return;
    }
    const nowIso = new Date().toISOString();
    const newPlan: RemedialPlanRecord = {
      id: `rem-${Date.now().toString(36)}-${rec.studentId}`,
      schoolId: activeSchoolId,
      studentId: rec.studentId,
      classId: rec.classId,
      subject: rec.subject,
      teacherId: rec.suggestedTeacherId,
      teacherName: rec.suggestedTeacherName,
      reasons: rec.reasons,
      status: 'planned',
      notes: 'افزوده‌شده از موتور پیشنهاد هوشمند تقویتی',
      createdBy: session?.displayName ?? 'مدیر مدرسه',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const res = upsertRemedialPlan(newPlan);
    if (res.ok) {
      setActionNotice(
        `«${rec.studentName}» برای درس ${rec.subject} به فهرست گروه‌های تقویتی مصوب اضافه شد.`
      );
    } else {
      setActionNotice(res.errorFa ?? 'خطا در ثبت برنامه تقویتی.');
    }
  };

  const handleUpdatePlanStatus = (plan: RemedialPlanRecord, nextStatus: RemedialPlanStatus) => {
    const res = upsertRemedialPlan({
      ...plan,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    if (res.ok) {
      setActionNotice(
        `وضعیت برنامه تقویتی به «${REMEDIAL_STATUS_LABELS[nextStatus]}» به‌روزرسانی شد.`
      );
    }
  };

  const tabs: Array<{ id: AnalyticsTabId; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'یافته‌های هوشمند و نمودارها', icon: <BarChart3 className="w-4 h-4" /> },
    {
      id: 'remedial',
      label: `کلاس‌های تقویتی هوشمند (${toPersianDigits(remedialPlans.length)})`,
      icon: <BookOpenCheck className="w-4 h-4" />,
    },
    ...(canViewTeacherAnalytics
      ? [{ id: 'teachers' as const, label: 'ارزیابی سازنده معلمان', icon: <Users className="w-4 h-4" /> }]
      : []),
    ...(canViewComplex
      ? [{ id: 'complex' as const, label: 'مقایسه هوشمند ۳ مدرسه', icon: <Building2 className="w-4 h-4" /> }]
      : []),
  ];

  const resolvedTab: AnalyticsTabId = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : 'overview';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {sectionLabel}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeRole === 'teacher'
                ? `تحلیل عملکرد کلاس‌ها و دروس اختصاصی شما — ${activeSchool.name}`
                : `تحلیل یکپارچه نمرات، حضور، تکالیف، کلاس معکوس و پیشنهاد کلاس‌های تقویتی — ${activeSchool.name}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyExecutive}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {copiedSummary ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedSummary ? 'کپی شد (ایتا / بله / شاد)' : 'کپی خلاصه مدیریتی'}</span>
          </button>
          <PrintButtons
            compact
            documentLabel={
              resolvedTab === 'remedial' ? 'فهرست کلاس‌های تقویتی' : 'گزارش تحلیل هوشمند آموزشی'
            }
            onPrint={(size) =>
              handlePrint(resolvedTab === 'remedial' ? 'remedial' : 'executive', size)
            }
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        className="no-print flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = resolvedTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {actionNotice && (
        <div className="no-print rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {actionNotice}
        </div>
      )}

      {/* Tab 1: Executive Insights & Multi-Dimensional Pure SVG Charts */}
      {resolvedTab === 'overview' && (
        <div className="no-print space-y-5">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">میانگین علمی مدرسه</div>
              <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums mt-1">
                {toPersianDigits(report.overallAvgGradeOutOf20)} <span className="text-xs font-normal text-slate-500">از ۲۰</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">نرخ حضور دانش‌آموزان</div>
              <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {toPersianDigits(report.overallAttendanceRatePercent)}٪
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">تحویل به‌موقع تکالیف</div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {toPersianDigits(report.overallHomeworkRatePercent)}٪
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">پیشنهاد کلاس تقویتی</div>
              <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                {toPersianDigits(report.remedialRecommendations.length)} <span className="text-xs font-normal text-slate-500">مورد</span>
              </div>
            </div>
          </div>

          {/* Executive Smart Insights */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                یافته‌های هوشمند و هشدارهای تحلیلی
              </h3>
              <span className="text-[11px] text-slate-500">موتور تحلیل آفلاین (داده‌های واقعی سامانه)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.insights.map((ins) => {
                const borderStyle =
                  ins.severity === 'urgent'
                    ? 'border-rose-200 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/20'
                    : ins.severity === 'attention'
                      ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20';
                const labelColor =
                  ins.severity === 'urgent'
                    ? 'text-rose-700 dark:text-rose-400'
                    : ins.severity === 'attention'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400';

                return (
                  <div key={ins.id} className={`rounded-xl border p-3.5 space-y-1.5 ${borderStyle}`}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-extrabold flex items-center gap-1 ${labelColor}`}>
                        {ins.severity === 'urgent' ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : ins.severity === 'strength' ? (
                          <Award className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5" />
                        )}
                        {INSIGHT_SEVERITY_LABELS[ins.severity]}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        {ins.metricBadge}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {ins.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-5">
                      {ins.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multi-Dimensional Pure SVG Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <SvgGroupedBarChart
                title="مقایسه عملکرد کلاس‌ها (حضور، تکالیف و میانگین نمره مقیاس ۱۰۰)"
                subtitle="میانگین نمره هر کلاس جهت مقایسه هم‌مقیاس در ۵ ضرب شده است"
                maxValue={100}
                data={report.classMetrics.map((c) => ({
                  label: c.className,
                  values: {
                    gradePct: Math.round((c.avgGradeOutOf20 / 20) * 100),
                    attendance: c.attendanceRatePercent,
                    homework: c.homeworkRatePercent,
                  },
                }))}
                series={[
                  { key: 'gradePct', label: 'شاخص علمی (٪)', color: '#4f46e5' },
                  { key: 'attendance', label: 'نرخ حضور (٪)', color: '#10b981' },
                  { key: 'homework', label: 'تحویل تکالیف (٪)', color: '#f59e0b' },
                ]}
                valueFormatter={(v) => `${toPersianDigits(v)}٪`}
                axisFormatter={(v) => `${toPersianDigits(v)}٪`}
              />
            </div>

            <div className="lg:col-span-5">
              <SvgHorizontalBarChart
                title="میانگین نمرات به تفکیک دروس (از ۲۰)"
                subtitle="مرتب‌شده از کمترین به بیشترین میانگین برای اولویت‌بندی حمایتی"
                defaultMax={20}
                items={report.subjectMetrics.map((sub) => ({
                  id: sub.subject,
                  label: sub.subject,
                  value: sub.avgGradeOutOf20,
                  maxValue: 20,
                  displayValue: `${toPersianDigits(sub.avgGradeOutOf20)} از ۲۰`,
                  subLabel: `${toPersianDigits(sub.entriesCount)} نمره`,
                  color:
                    sub.avgGradeOutOf20 < 15
                      ? '#f43f5e'
                      : sub.avgGradeOutOf20 < 17
                        ? '#f59e0b'
                        : '#10b981',
                }))}
              />
            </div>
          </div>

          {/* Monthly Jalali Academic Progress Trend */}
          <SvgTrendLineChart
            title="روند پیشرفت تحصیلی ماهانه مدرسه (ماه‌های شمسی سال تحصیلی)"
            subtitle="میانگین نمرات ثبت‌شده در دفتر نمره و آزمون‌ها در طول ماه‌های تحصیلی"
            primaryLabel="میانگین علمی (از ۲۰)"
            primaryColor="#4f46e5"
            minValue={10}
            maxValue={20}
            points={report.monthlyTrend.map((pt) => ({
              label: pt.month,
              value: pt.avgGradeOutOf20,
            }))}
            valueFormatter={(v) => toPersianDigits(v)}
          />
        </div>
      )}

      {/* Tab 2: Smart Remedial & Tutoring Recommendations + Persistent Remedial Plans */}
      {resolvedTab === 'remedial' && (
        <div className="no-print space-y-5">
          {/* Approved / Persistent Remedial Plans */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  فهرست گروه‌های تقویتی مصوب و در حال پیگیری
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ذخیره‌شده در پایگاه داده مدرسه با امکان تغییر وضعیت پیگیری
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                {toPersianDigits(remedialPlans.length)} برنامه ثبت‌شده
              </span>
            </div>

            {remedialPlans.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                هنوز دانش‌آموزی به برنامه تقویتی مصوب اضافه نشده است. از فهرست پیشنهادهای هوشمند زیر اقدام کنید.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {remedialPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {studentNameMap.get(plan.studentId) ?? plan.studentId} — درس {plan.subject}
                        <span className="text-slate-500 font-normal mr-2">
                          ({classNameMap.get(plan.classId) ?? '—'} · مدرس: {plan.teacherName})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {plan.reasons.join(' · ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`وضعیت برنامه تقویتی ${plan.subject}`}
                        value={plan.status}
                        onChange={(e) =>
                          handleUpdatePlanStatus(plan, e.target.value as RemedialPlanStatus)
                        }
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                      >
                        <option value="planned">برنامه‌ریزی‌شده</option>
                        <option value="in_progress">در حال اجرا</option>
                        <option value="improved">بهبودیافته</option>
                      </select>
                      {canDeleteRemedial && (
                        <button
                          type="button"
                          onClick={() => deleteRemedialPlan(plan.id)}
                          aria-label="حذف برنامه تقویتی"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI/Deterministic Recommendations grouped/filterable by Subject */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  پیشنهادهای هوشمند کلاس تقویتی و جبرانی (اولویت‌بندی‌شده)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  شناسایی شفاف بر اساس افت نمره، غیبت، تکالیف و عملکرد کوییزک ویدیویی
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="فیلتر درس تقویتی"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="all">همه دروس ({toPersianDigits(report.remedialRecommendations.length)})</option>
                  {availableSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleExportRemedialCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>خروجی اکسل فارسی</span>
                </button>
              </div>
            </div>

            {filteredRecommendations.length === 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 py-6 text-center font-semibold">
                در حال حاضر موردی با نیاز فوری به کلاس تقویتی در این فیلتر شناسایی نشده است.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecommendations.map((rec) => {
                  const isPlanned = remedialPlans.some(
                    (p) => p.studentId === rec.studentId && p.subject === rec.subject
                  );
                  return (
                    <div
                      key={rec.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-slate-100">
                            {rec.studentName}
                          </span>
                          <span className="text-slate-500">· {rec.className}</span>
                          <span className="font-bold text-indigo-700 dark:text-indigo-400">
                            درس {rec.subject}
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                            میانگین: {toPersianDigits(rec.avgScore)}
                          </span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                          {rec.reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={isPlanned}
                        onClick={() => handleAddToRemedialPlan(rec)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                          isPlanned
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {isPlanned ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>در برنامه تقویتی ثبت شده</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>افزودن به برنامه تقویتی</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Constructive Teacher Performance View (complex_admin & principal ONLY) */}
      {resolvedTab === 'teachers' && canViewTeacherAnalytics && (
        <div className="no-print space-y-4">
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 text-xs text-indigo-900 dark:text-indigo-200">
            <strong>نمای ارزیابی سازنده و حمایتی معلمان (اختصاصی مدیر مدرسه و مدیر کل):</strong> این گزارش صرفاً جهت شناسایی فرصت‌های هم‌افزایی، پشتیبانی آموزشی و تجلیل از شیوه‌های موفق تدریس طراحی شده و برای سایر نقش‌ها قابل مشاهده نیست.
          </div>

          <SvgHorizontalBarChart
            title="مقایسه میانگین پیشرفت کلاسی و آموزشی معلمان (از ۲۰)"
            defaultMax={20}
            items={report.teacherMetrics.map((t) => ({
              id: t.teacherId,
              label: t.teacherName,
              subLabel: t.subjects.slice(0, 2).join('، '),
              value: t.avgGradeOutOf20,
              maxValue: 20,
              displayValue: `${toPersianDigits(t.avgGradeOutOf20)} از ۲۰`,
              color: t.avgGradeOutOf20 >= 17 ? '#10b981' : '#4f46e5',
            }))}
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-bold">نام معلم</th>
                    <th className="py-3 px-3 font-bold">دروس تخصصی</th>
                    <th className="py-3 px-3 font-bold">میانگین کلاس‌ها</th>
                    <th className="py-3 px-3 font-bold">تفاوت با میانگین مدرسه</th>
                    <th className="py-3 px-3 font-bold">بازخورد تکالیف</th>
                    <th className="py-3 px-3 font-bold">مشارکت آزمون آنلاین</th>
                    <th className="py-3 px-3 font-bold">برنامه تقویتی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.teacherMetrics.map((tm) => (
                    <tr key={tm.teacherId}>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {tm.teacherName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {tm.subjects.join('، ')}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
                        {toPersianDigits(tm.avgGradeOutOf20)}
                      </td>
                      <td
                        className={`py-3 px-3 font-bold tabular-nums ${
                          tm.progressDelta >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {tm.progressDelta >= 0 ? '+' : ''}
                        {toPersianDigits(tm.progressDelta)}
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {toPersianDigits(tm.homeworkReviewRatePercent)}٪
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {toPersianDigits(tm.examParticipationRatePercent)}٪
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {toPersianDigits(tm.remedialPlansCount)} مورد
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Complex 3-School Smart Comparison (complex_admin ONLY) */}
      {resolvedTab === 'complex' && canViewComplex && (
        <div className="no-print space-y-5">
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
            <Building2 className="w-4 h-4 shrink-0" />
            <span>
              <strong>مقایسه هوشمند ۳ مدرسه مجموعه (اختصاصی مدیر کل):</strong> ارزیابی هم‌زمان شاخص‌های علمی، حضور، تکالیف و پوشش برنامه‌های تقویتی در تمام واحدها.
            </span>
          </div>

          <SvgGroupedBarChart
            title="مقایسه شاخص‌های کلیدی ۳ مدرسه (در مقیاس ۱۰۰)"
            maxValue={100}
            data={complexRows.map((row) => ({
              label: row.school.name,
              values: {
                academic: Math.round((row.avgGradeOutOf20 / 20) * 100),
                attendance: row.attendanceRatePercent,
                homework: row.homeworkRatePercent,
              },
            }))}
            series={[
              { key: 'academic', label: 'میانگین علمی (٪)', color: '#4f46e5' },
              { key: 'attendance', label: 'نرخ حضور (٪)', color: '#10b981' },
              { key: 'homework', label: 'تحویل تکالیف (٪)', color: '#f59e0b' },
            ]}
            valueFormatter={(v) => `${toPersianDigits(v)}٪`}
            axisFormatter={(v) => `${toPersianDigits(v)}٪`}
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-bold">واحد آموزشی</th>
                    <th className="py-3 px-3 font-bold">دانش‌آموزان</th>
                    <th className="py-3 px-3 font-bold">میانگین علمی</th>
                    <th className="py-3 px-3 font-bold">نرخ حضور</th>
                    <th className="py-3 px-3 font-bold">تحویل تکالیف</th>
                    <th className="py-3 px-3 font-bold">نیازمند حمایت</th>
                    <th className="py-3 px-3 font-bold">برنامه تقویتی فعال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {complexRows.map((row) => (
                    <tr key={row.school.id}>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {row.school.name}
                      </td>
                      <td className="py-3 px-3 tabular-nums">{toPersianDigits(row.studentCount)} نفر</td>
                      <td className="py-3 px-3 font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
                        {toPersianDigits(row.avgGradeOutOf20)} از ۲۰
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {toPersianDigits(row.attendanceRatePercent)}٪
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {toPersianDigits(row.homeworkRatePercent)}٪
                      </td>
                      <td className="py-3 px-3 text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                        {toPersianDigits(row.atRiskStudentsCount)} نفر
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {toPersianDigits(row.activeRemedialCount)} برنامه
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Print-Only A4 & A5 Executive / Remedial Document */}
      <PrintShell
        school={activeSchool}
        documentTitle={
          printKind === 'remedial'
            ? 'فهرست پیشنهادی و مصوب کلاس‌های تقویتی'
            : 'گزارش تحلیل هوشمند آموزشی و رصد پیشرفت'
        }
        subtitle={`میانگین مدرسه: ${toPersianDigits(report.overallAvgGradeOutOf20)} · نرخ حضور: ${toPersianDigits(report.overallAttendanceRatePercent)}٪`}
      >
        <div className="print-only space-y-4 text-xs text-black">
          {printKind === 'executive' ? (
            <>
              <div className="grid grid-cols-4 gap-2 border border-slate-400 p-2.5 rounded">
                <div>
                  <div className="text-slate-600">میانگین علمی</div>
                  <div className="font-extrabold">{toPersianDigits(report.overallAvgGradeOutOf20)} از ۲۰</div>
                </div>
                <div>
                  <div className="text-slate-600">نرخ حضور</div>
                  <div className="font-extrabold">{toPersianDigits(report.overallAttendanceRatePercent)}٪</div>
                </div>
                <div>
                  <div className="text-slate-600">تحویل تکالیف</div>
                  <div className="font-extrabold">{toPersianDigits(report.overallHomeworkRatePercent)}٪</div>
                </div>
                <div>
                  <div className="text-slate-600">پیشنهاد تقویتی</div>
                  <div className="font-extrabold">{toPersianDigits(report.remedialRecommendations.length)} مورد</div>
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-1.5">خلاصه یافته‌های هوشمند</h3>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  {report.insights.map((i) => (
                    <li key={i.id}>
                      <strong>[{INSIGHT_SEVERITY_LABELS[i.severity]}] {i.title}: </strong>
                      {i.detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-1.5">مقایسه عملکرد کلاس‌ها</h3>
                <table className="w-full border-collapse border border-slate-400 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-400 p-1.5 text-right">کلاس</th>
                      <th className="border border-slate-400 p-1.5 text-right">تعداد دانش‌آموز</th>
                      <th className="border border-slate-400 p-1.5 text-right">میانگین نمره</th>
                      <th className="border border-slate-400 p-1.5 text-right">نرخ حضور</th>
                      <th className="border border-slate-400 p-1.5 text-right">تحویل تکالیف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.classMetrics.map((c) => (
                      <tr key={c.classId}>
                        <td className="border border-slate-400 p-1.5 font-semibold">{c.className}</td>
                        <td className="border border-slate-400 p-1.5">{toPersianDigits(c.studentCount)}</td>
                        <td className="border border-slate-400 p-1.5">{toPersianDigits(c.avgGradeOutOf20)}</td>
                        <td className="border border-slate-400 p-1.5">{toPersianDigits(c.attendanceRatePercent)}٪</td>
                        <td className="border border-slate-400 p-1.5">{toPersianDigits(c.homeworkRatePercent)}٪</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div>
              <h3 className="font-bold mb-1.5">فهرست دانش‌آموزان پیشنهادی کلاس‌های تقویتی</h3>
              <table className="w-full border-collapse border border-slate-400 text-[11px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 p-1.5 text-right">ردیف</th>
                    <th className="border border-slate-400 p-1.5 text-right">نام دانش‌آموز</th>
                    <th className="border border-slate-400 p-1.5 text-right">کلاس</th>
                    <th className="border border-slate-400 p-1.5 text-right">درس</th>
                    <th className="border border-slate-400 p-1.5 text-right">میانگین</th>
                    <th className="border border-slate-400 p-1.5 text-right">دلیل شناسایی</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecommendations.map((r, idx) => (
                    <tr key={r.id}>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(idx + 1)}</td>
                      <td className="border border-slate-400 p-1.5 font-semibold">{r.studentName}</td>
                      <td className="border border-slate-400 p-1.5">{r.className}</td>
                      <td className="border border-slate-400 p-1.5">{r.subject}</td>
                      <td className="border border-slate-400 p-1.5">{toPersianDigits(r.avgScore)}</td>
                      <td className="border border-slate-400 p-1.5">{r.reasons.join('؛ ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PrintShell>
    </div>
  );
};
