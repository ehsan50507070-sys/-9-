// Phase 9-B: Advanced SIDA Analytics Page (/sida-analytics)
// Responsive across 360px+ mobile, tablet, and desktop with custom SVG charts, horizontally scrollable matrix,
// remedial/at-risk list, YoY comparison, appeal windows, and A4/A5 printing via <PrintIconButton />.
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Layers,
  Table2,
  TrendingUp,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { useAcademicYear } from '../../core/academic-year/AcademicYearContext';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { EmptyStateSvg } from '../../core/ui/EmptyStateSvg';
import {
  SidaBoxPlotSvgChart,
  SidaDistributionHistogramSvgChart,
  SidaYearlyGroupedBarSvgChart,
} from './SidaAnalyticsCharts';
import {
  APPEAL_TERM_LABELS,
  buildMatrixReport,
  computeBoxPlotStats,
  computeFailingAndBorderlineStudents,
  computeGradeDistribution,
  computeYearlyComparison,
  evaluateAppealWindow,
  getScoreCellColorClass,
} from './sidaAnalyticsHelpers';

type AnalyticsTab = 'charts' | 'matrix' | 'remedial' | 'appeals';

export const SidaAnalyticsPage: React.FC = () => {
  const { activeSchool, classes, sidaAnalyticsGrades, sidaAppealWindows } = useSchoolData();
  const { selectedAcademicYear, academicYears } = useAcademicYear();

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('charts');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  const currentYearId = selectedAcademicYear?.id ?? academicYears[0]?.id ?? 'ay-1404-1405';

  const yearScopedGrades = useMemo(() => {
    const byYear = sidaAnalyticsGrades.filter((g) => g.academicYearId === currentYearId);
    const list = byYear.length > 0 ? byYear : sidaAnalyticsGrades;
    if (selectedClassId === 'all') return list;
    return list.filter((g) => g.classId === selectedClassId);
  }, [sidaAnalyticsGrades, currentYearId, selectedClassId]);

  const previousYearGrades = useMemo(() => {
    const prevYear = academicYears.find((y) => y.id !== currentYearId);
    if (!prevYear) return [];
    const list = sidaAnalyticsGrades.filter((g) => g.academicYearId === prevYear.id);
    if (selectedClassId === 'all') return list;
    return list.filter((g) => g.classId === selectedClassId);
  }, [sidaAnalyticsGrades, academicYears, currentYearId, selectedClassId]);

  const boxPlotBySubject = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of yearScopedGrades) {
      const arr = map.get(r.subject) ?? [];
      arr.push(r.score);
      map.set(r.subject, arr);
    }
    return computeBoxPlotStats(
      Array.from(map.entries()).map(([label, scores]) => ({
        key: label,
        label,
        scores,
      }))
    );
  }, [yearScopedGrades]);

  const distribution = useMemo(
    () => computeGradeDistribution(yearScopedGrades.map((g) => g.score)),
    [yearScopedGrades]
  );

  const matrixReport = useMemo(() => buildMatrixReport(yearScopedGrades, 10), [yearScopedGrades]);

  const atRiskStudents = useMemo(
    () =>
      computeFailingAndBorderlineStudents(yearScopedGrades, {
        passingThreshold: 10,
        borderlineUpper: 12,
        includeBorderline: true,
      }),
    [yearScopedGrades]
  );

  const yoySummary = useMemo(
    () =>
      computeYearlyComparison(
        previousYearGrades,
        yearScopedGrades,
        '۱۴۰۳-۱۴۰۴',
        selectedAcademicYear?.code ?? '۱۴۰۴-۱۴۰۵'
      ),
    [previousYearGrades, yearScopedGrades, selectedAcademicYear?.code]
  );

  const avgScore = useMemo(() => {
    if (yearScopedGrades.length === 0) return 0;
    const sum = yearScopedGrades.reduce((acc, g) => acc + g.score, 0);
    return Math.round((sum / yearScopedGrades.length) * 100) / 100;
  }, [yearScopedGrades]);

  const tabs: Array<{ id: AnalyticsTab; labelFa: string; Icon: React.FC<{ className?: string }> }> = [
    { id: 'charts', labelFa: 'نمودارهای تحلیلی و توزیع', Icon: BarChart3 },
    { id: 'matrix', labelFa: 'ماتریس نمرات و رتبه‌بندی', Icon: Table2 },
    { id: 'remedial', labelFa: 'دانش‌آموزان مرزی و جبرانی', Icon: AlertTriangle },
    { id: 'appeals', labelFa: 'بازه زمانی اعتراض نمره', Icon: CalendarClock },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#2B5B84] dark:text-sky-400">
            تحلیل پیشرفته سیدا · {activeSchool.name}
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            سامانه تحلیل آماری و پایش نمرات سیدا
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            نمودار جعبه‌ای (Box Plot)، هیستوگرام ۵‌بندی، مقایسه سالانه، ماتریس کلاسی و شناسایی دانش‌آموزان مرزی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه کلاس‌های مدرسه</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <PrintIconButton
            documentLabel={`گزارش تحلیلی سیدا — ${activeSchool.name}`}
            targetSelector="#sida-analytics-print-area"
            landscape
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">میانگین کل نمرات</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {toPersianDigits(avgScore)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">تعداد دانش‌آموز تحلیل‌شده</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {toPersianDigits(matrixReport.rows.length)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">دانش‌آموزان مرزی / جبرانی</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
            {toPersianDigits(atRiskStudents.length)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400">تعداد دروس بررسی‌شده</div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-[#2B5B84] dark:text-sky-400">
            {toPersianDigits(matrixReport.subjects.length)}
          </div>
        </div>
      </div>

      {/* Responsive Horizontally-Scrollable Tab Bar */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full sm:min-w-0 items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5">
          {tabs.map(({ id, labelFa, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                  active
                    ? 'brand-btn shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{labelFa}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {yearScopedGrades.length === 0 ? (
        <EmptyStateSvg
          variant="analytics"
          titleFa="داده تحلیلی سیدا برای این فیلتر یافت نشد"
          descriptionFa="کلاس یا سال تحصیلی دیگری انتخاب نمایید یا نمرات سیدا را در سامانه ثبت کنید."
        />
      ) : activeTab === 'charts' ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs overflow-x-auto">
            <SidaBoxPlotSvgChart
              data={boxPlotBySubject}
              titleFa="نمودار جعبه‌ای پراکندگی نمرات به تفکیک درس (Box Plot)"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs overflow-x-auto">
            <SidaDistributionHistogramSvgChart
              summary={distribution}
              titleFa="هیستوگرام ۵‌بندی توزیع فراوانی نمرات"
            />
          </div>

          {yoySummary.subjectRows.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs overflow-x-auto">
              <div className="flex items-center gap-2 mb-3 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                <TrendingUp className="w-4 h-4 text-[#2B5B84] dark:text-sky-400" />
                <span>مقایسه میانگین دروس نسبت به سال تحصیلی قبل</span>
              </div>
              <SidaYearlyGroupedBarSvgChart
                rows={yoySummary.subjectRows}
                prevYearCode={yoySummary.prevYearCode}
                currYearCode={yoySummary.currYearCode}
              />
            </div>
          )}
        </div>
      ) : activeTab === 'matrix' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="px-3 py-3 font-extrabold whitespace-nowrap">رتبه پایه</th>
                  <th className="px-3 py-3 font-extrabold whitespace-nowrap">دانش‌آموز</th>
                  <th className="px-3 py-3 font-extrabold whitespace-nowrap">کلاس</th>
                  {matrixReport.subjects.map((subj) => (
                    <th key={subj} className="px-2.5 py-3 text-center font-extrabold whitespace-nowrap">
                      {subj}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">معدل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {matrixReport.rows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                      {toPersianDigits(row.gradeRank)}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {row.studentName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {row.className}
                    </td>
                    {matrixReport.subjects.map((subj) => {
                      const val = row.subjectScores[subj];
                      return (
                        <td key={subj} className="px-2 py-2 text-center tabular-nums">
                          <span
                            className={`inline-block min-w-[42px] rounded-lg px-2 py-0.5 font-bold ${getScoreCellColorClass(val)}`}
                          >
                            {val !== undefined ? toPersianDigits(val) : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-extrabold tabular-nums text-[#2B5B84] dark:text-sky-300">
                      {toPersianDigits(row.weightedGpa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'remedial' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          {atRiskStudents.length === 0 ? (
            <div className="p-4">
              <EmptyStateSvg
                variant="analytics"
                titleFa="هیچ دانش‌آموز مرزی یا نیازمند کلاس جبرانی شناسایی نشد"
                descriptionFa="عملکرد تمام دانش‌آموزان در بازه مطلوب ارزیابی شده است."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <th className="px-4 py-3 font-extrabold">دانش‌آموز</th>
                    <th className="px-3 py-3 font-extrabold">کلاس</th>
                    <th className="px-3 py-3 font-extrabold">وضعیت</th>
                    <th className="px-3 py-3 font-extrabold text-center">معدل</th>
                    <th className="px-4 py-3 font-extrabold">دروس نیازمند توجه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {atRiskStudents.map((st) => {
                    const isFailing = st.failingCount > 0;
                    const weakSubjects = [...st.failingSubjects, ...st.borderlineSubjects];
                    return (
                      <tr key={st.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {st.studentName}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {st.className}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                              isFailing
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {isFailing ? 'نیازمند مداخله فوری' : 'مرزی'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-extrabold tabular-nums">
                          {toPersianDigits(st.overallAverage)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {weakSubjects
                            .map((w) => `${w.subject} (${toPersianDigits(w.score)})`)
                            .join('، ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sidaAppealWindows.length === 0 ? (
            <div className="md:col-span-2">
              <EmptyStateSvg
                variant="records"
                titleFa="بازه زمانی اعتراض نمره‌ای ثبت نشده است"
                descriptionFa="بازه زمانی ثبت اعتراض نمرات برای این مدرسه در تنظیمات سیدا قابل تعریف است."
              />
            </div>
          ) : (
            sidaAppealWindows.map((win) => {
              const evalRes = evaluateAppealWindow(win);
              return (
                <div
                  key={win.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                      <Layers className="w-4 h-4 text-[#2B5B84] dark:text-sky-400" />
                      <span>{win.termLabelFa || APPEAL_TERM_LABELS[win.term]}</span>
                    </div>
                    <span
                      className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-bold ${evalRes.badgeClass}`}
                    >
                      {evalRes.labelFa}
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                    {evalRes.parentMessageFa}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Hidden Print-Ready Area for PrintPreviewPortal */}
      <div id="sida-analytics-print-area" className="hidden print:block space-y-4 text-right text-xs">
        <div className="text-xs text-slate-600">
          سال تحصیلی: {toPersianDigits(selectedAcademicYear?.title ?? '۱۴۰۴-۱۴۰۵')} · تاریخ گزارش:{' '}
          {toPersianDigits(getTodayJalali())} · میانگین کل: {toPersianDigits(avgScore)}
        </div>
        <table className="w-full border-collapse text-right text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1">رتبه</th>
              <th className="border border-slate-300 px-2 py-1">نام دانش‌آموز</th>
              <th className="border border-slate-300 px-2 py-1">کلاس</th>
              <th className="border border-slate-300 px-2 py-1">معدل کل</th>
            </tr>
          </thead>
          <tbody>
            {matrixReport.rows.slice(0, 60).map((row) => (
              <tr key={row.studentId}>
                <td className="border border-slate-300 px-2 py-1 tabular-nums">
                  {toPersianDigits(row.gradeRank)}
                </td>
                <td className="border border-slate-300 px-2 py-1 font-bold">{row.studentName}</td>
                <td className="border border-slate-300 px-2 py-1">{row.className}</td>
                <td className="border border-slate-300 px-2 py-1 tabular-nums font-bold">
                  {toPersianDigits(row.weightedGpa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
