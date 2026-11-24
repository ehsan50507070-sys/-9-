// Management Analytics, 3-School Comparison, Canvas-Style Item Analysis & Batch Class Report Card Printing (Phase 9A)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  FileSpreadsheet,
  Search,
  Trophy,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { StudentAvatar } from '../../core/components/StudentAvatar';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import type {
  ClassRoom,
  MockExam,
  MockExamAttempt,
  School,
} from '../../types/domain';
import {
  OptionDistributionMiniSvg,
  TarazHistogramSvgChart,
  ThreeSchoolComparisonSvgChart,
  type TarazStagePoint,
} from './MockExamCharts';
import { MockExamReportCard } from './MockExamReportCard';
import {
  buildMockExamCsv,
  getDifficultyLabelFa,
  type ExamCohortReport,
  type StudentExamAnalytics,
} from './statsEngine';

interface ManagementAnalyticsViewProps {
  exam: MockExam;
  cohort: ExamCohortReport;
  attempts: MockExamAttempt[];
  schools: School[];
  classes: ClassRoom[];
  activeSchoolId: string;
  canViewComplexComparison: boolean;
  canExport: boolean;
  getStudentTarazHistory: (studentId: string) => TarazStagePoint[];
  onSelectStudentReport: (studentId: string) => void;
}

export const ManagementAnalyticsView: React.FC<ManagementAnalyticsViewProps> = ({
  exam,
  cohort,
  attempts,
  schools,
  classes,
  activeSchoolId,
  canViewComplexComparison,
  canExport,
  getStudentTarazHistory,
  onSelectStudentReport,
}) => {
  const [schoolFilter, setSchoolFilter] = useState<string>(
    canViewComplexComparison && exam.scope === 'complex' ? 'all' : activeSchoolId
  );
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [itemSubjectFilter, setItemSubjectFilter] = useState<string>('all');
  const [onlyTraps, setOnlyTraps] = useState(false);

  const effectiveSchoolFilter =
    canViewComplexComparison && exam.scope === 'complex' ? schoolFilter : activeSchoolId;

  const visibleStudents = useMemo<StudentExamAnalytics[]>(() => {
    const q = searchText.trim().toLowerCase();
    return cohort.students.filter((st) => {
      if (effectiveSchoolFilter !== 'all' && st.schoolId !== effectiveSchoolFilter) return false;
      if (classFilter !== 'all' && st.classId !== classFilter) return false;
      if (q && !st.studentName.toLowerCase().includes(q) && !st.className.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [cohort.students, effectiveSchoolFilter, classFilter, searchText]);

  const availableClasses = useMemo(() => {
    if (effectiveSchoolFilter === 'all') return classes;
    return classes.filter((c) => c.schoolId === effectiveSchoolFilter);
  }, [classes, effectiveSchoolFilter]);

  const visibleItems = useMemo(() => {
    return cohort.itemAnalysis.filter((item) => {
      if (itemSubjectFilter !== 'all' && item.subjectId !== itemSubjectFilter) return false;
      if (onlyTraps && !item.isTrapQuestion) return false;
      return true;
    });
  }, [cohort.itemAnalysis, itemSubjectFilter, onlyTraps]);

  const attemptByStudentId = useMemo(
    () => new Map(attempts.map((a) => [a.studentId, a])),
    [attempts]
  );

  const top6500Count = useMemo(
    () => visibleStudents.filter((s) => s.totalTaraz >= 6500).length,
    [visibleStudents]
  );

  const visibleMeanTaraz = useMemo(() => {
    if (visibleStudents.length === 0) return 0;
    return Math.round(
      visibleStudents.reduce((sum, s) => sum + s.totalTaraz, 0) / visibleStudents.length
    );
  }, [visibleStudents]);

  const handleDownloadCohortCsv = () => {
    const csv = buildMockExamCsv({ ...cohort, students: visibleStudents });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock-exam-results-${exam.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Batch printable class cards (capped cleanly at 35 for instant DOM printing)
  const batchPrintStudents = useMemo(() => visibleStudents.slice(0, 35), [visibleStudents]);

  const showThreeSchoolPanel =
    canViewComplexComparison && exam.scope === 'complex' && cohort.schoolComparison.length > 1;

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">تعداد شرکت‌کنندگان</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(visibleStudents.length)} نفر
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {exam.scope === 'complex' ? 'آزمون هماهنگ مجموعه' : 'آزمون مستقل مدرسه'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">میانگین تراز</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-indigo-700 dark:text-indigo-400">
            {toPersianDigits(visibleMeanTaraz)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            بالاترین تراز: {toPersianDigits(visibleStudents[0]?.totalTaraz ?? 0)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">ترازهای برتر (۶۵۰۰+)</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
            {toPersianDigits(top6500Count)} نفر
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {visibleStudents.length > 0
              ? `${toPersianDigits(Math.round((top6500Count / visibleStudents.length) * 100))}٪ شرکت‌کنندگان`
              : '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">سوالات دامدار (≥۳۵٪ انحرافی)</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
            {toPersianDigits(cohort.trapQuestionsCount)} سوال
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            از مجموع {toPersianDigits(exam.questions.length)} سوال
          </div>
        </div>
      </div>

      {/* Filters & Export / Batch Print Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {canViewComplexComparison && exam.scope === 'complex' && (
            <select
              aria-label="فیلتر مدرسه"
              value={schoolFilter}
              onChange={(e) => {
                setSchoolFilter(e.target.value);
                setClassFilter('all');
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">کل مجموعه ({toPersianDigits(schools.length)} مدرسه)</option>
              {schools.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="فیلتر کلاس"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه کلاس‌ها</option>
            {availableClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="جستجوی نام دانش‌آموز یا کلاس..."
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {canExport && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCohortCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              خروجی اکسل فارسی (CSV)
            </button>

            {batchPrintStudents.length > 0 && (
              <PrintIconButton
                targetSelector="#batch-mock-karnameh-print"
                documentLabel={`چاپ گروهی کارنامه — ${exam.title} (${toPersianDigits(batchPrintStudents.length)} دانش‌آموز)`}
                includeHeader={false}
                includeFooter={false}
              />
            )}
          </div>
        )}
      </div>

      {/* Ranked Leaderboard Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              جدول رتبه‌بندی و تراز کل شرکت‌کنندگان
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            برای مشاهده کارنامه جامع روی هر ردیف کلیک کنید
          </span>
        </div>

        {visibleStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            هنوز پاسخ‌برگ ثبت‌شده‌ای مطابق با فیلتر انتخابی وجود ندارد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-bold text-center w-16">رتبه</th>
                  <th className="py-2.5 px-3 font-bold">دانش‌آموز</th>
                  <th className="py-2.5 px-3 font-bold text-center">تراز کل</th>
                  <th className="py-2.5 px-3 font-bold text-center">تغییر تراز</th>
                  <th className="py-2.5 px-3 font-bold text-center">میانگین ٪</th>
                  <th className="py-2.5 px-3 font-bold text-center">درست / غلط / نزده</th>
                  {exam.subjects.slice(0, 4).map((s) => (
                    <th key={s.id} className="py-2.5 px-2.5 font-bold text-center whitespace-nowrap">
                      {s.subjectName}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-bold text-center">کارنامه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleStudents.map((st) => {
                  const displayRank =
                    effectiveSchoolFilter === 'all' && st.complexRank !== null
                      ? st.complexRank
                      : st.schoolRank;
                  return (
                    <tr
                      key={st.attemptId}
                      onClick={() => onSelectStudentReport(st.studentId)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                        {toPersianDigits(displayRank)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar
                            studentId={st.studentId}
                            studentName={st.studentName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {st.studentName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {st.className}
                              {canViewComplexComparison && exam.scope === 'complex'
                                ? ` · ${st.schoolName}`
                                : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold tabular-nums text-indigo-700 dark:text-indigo-400">
                        {toPersianDigits(st.totalTaraz)}
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums">
                        {st.tarazDeltaFromPrev === null ? (
                          <span className="text-slate-400">—</span>
                        ) : st.tarazDeltaFromPrev >= 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                            <ArrowUpRight className="w-3.5 h-3.5" />+
                            {toPersianDigits(st.tarazDeltaFromPrev)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 font-bold text-rose-700 dark:text-rose-400">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {toPersianDigits(st.tarazDeltaFromPrev)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold tabular-nums text-slate-800 dark:text-slate-200">
                        {toPersianDigits(st.averagePercentage)}٪
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums whitespace-nowrap">
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {toPersianDigits(st.totalCorrect)}
                        </span>
                        <span className="mx-1 text-slate-400">/</span>
                        <span className="text-rose-700 dark:text-rose-400 font-semibold">
                          {toPersianDigits(st.totalWrong)}
                        </span>
                        <span className="mx-1 text-slate-400">/</span>
                        <span className="text-slate-500">{toPersianDigits(st.totalBlank)}</span>
                      </td>
                      {exam.subjects.slice(0, 4).map((subj) => {
                        const sm = st.subjectMetrics.find((m) => m.subjectId === subj.id);
                        return (
                          <td
                            key={subj.id}
                            className="py-2.5 px-2.5 text-center tabular-nums text-slate-700 dark:text-slate-300"
                          >
                            {sm ? `${toPersianDigits(sm.percentage)}٪` : '—'}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStudentReport(st.studentId);
                          }}
                          className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
                        >
                          مشاهده
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribution & 3-School Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <TarazHistogramSvgChart buckets={cohort.histogram} />
        </div>

        {showThreeSchoolPanel ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            <ThreeSchoolComparisonSvgChart
              schools={cohort.schoolComparison}
              subjects={exam.subjects}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              خلاصه میانگین درصد دروس در این آزمون
            </h3>
            <div className="space-y-2.5">
              {exam.subjects.map((subj) => {
                const avgPct =
                  visibleStudents.length > 0
                    ? Math.round(
                        (visibleStudents.reduce(
                          (s, st) =>
                            s +
                            (st.subjectMetrics.find((m) => m.subjectId === subj.id)?.percentage ??
                              0),
                          0
                        ) /
                          visibleStudents.length) *
                          10
                      ) / 10
                    : 0;
                return (
                  <div
                    key={subj.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {subj.subjectName}{' '}
                      <span className="font-normal text-slate-400">
                        · ضریب {toPersianDigits(subj.coefficient)}
                      </span>
                    </span>
                    <span className="font-extrabold tabular-nums text-indigo-700 dark:text-indigo-400">
                      {toPersianDigits(avgPct)}٪
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3-School Comparison Executive Table (strictly complex_admin & super_admin) */}
      {showThreeSchoolPanel && (
        <div
          data-testid="three-school-comparison-panel"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 brand-text" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              مقایسه تجمیعی عملکرد مدارس مجموعه در آزمون هماهنگ
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3 font-bold">واحد آموزشی</th>
                  <th className="py-2.5 px-3 font-bold text-center">شرکت‌کنندگان</th>
                  <th className="py-2.5 px-3 font-bold text-center">میانگین تراز</th>
                  <th className="py-2.5 px-3 font-bold text-center">ترازهای ۶۵۰۰+</th>
                  <th className="py-2.5 px-3 font-bold text-center">میانگین درصد</th>
                  {exam.subjects.map((s) => (
                    <th key={s.id} className="py-2.5 px-2.5 font-bold text-center whitespace-nowrap">
                      {s.subjectName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cohort.schoolComparison.map((row) => (
                  <tr key={row.schoolId}>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {row.schoolName}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums">
                      {toPersianDigits(row.participantCount)} نفر
                    </td>
                    <td className="py-2.5 px-3 text-center font-extrabold tabular-nums text-indigo-700 dark:text-indigo-400">
                      {toPersianDigits(row.averageTaraz)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {toPersianDigits(row.top6500Count)} نفر
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums font-semibold">
                      {toPersianDigits(row.averagePercentage)}٪
                    </td>
                    {exam.subjects.map((s) => (
                      <td key={s.id} className="py-2.5 px-2.5 text-center tabular-nums">
                        {toPersianDigits(row.subjectAverages[s.id] ?? 0)}٪
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Canvas-Style Item Analysis & Automatic Trap Question Detector */}
      <div
        data-testid="item-analysis-panel"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              تحلیل سوال‌شناسی و تشخیص هوشمند سوالات دامدار (Item Analysis)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              توزیع پاسخ دانش‌آموزان به ۴ گزینه هر سوال — هر گزینه انحرافی با جذب ۳۵٪ یا بیشتر به‌صورت خودکار «سوال دامدار» تشخیص داده می‌شود.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="فیلتر درس در تحلیل سوال"
              value={itemSubjectFilter}
              onChange={(e) => setItemSubjectFilter(e.target.value)}
              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold"
            >
              <option value="all">همه دروس</option>
              {exam.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subjectName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlyTraps((v) => !v)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                onlyTraps
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              فقط سوالات دامدار ({toPersianDigits(cohort.trapQuestionsCount)})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3 font-bold text-center w-14">سوال</th>
                <th className="py-2.5 px-3 font-bold">درس و مبحث</th>
                <th className="py-2.5 px-3 font-bold text-center">کلید</th>
                <th className="py-2.5 px-3 font-bold text-center">پاسخ صحیح واقعی</th>
                <th className="py-2.5 px-3 font-bold text-center">نزده</th>
                <th className="py-2.5 px-3 font-bold">توزیع گزینه‌های ۱ تا ۴</th>
                <th className="py-2.5 px-3 font-bold">هشدار سوال دامدار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleItems.map((item) => (
                <tr
                  key={item.questionNumber}
                  className={
                    item.isTrapQuestion ? 'bg-rose-50/40 dark:bg-rose-950/20' : undefined
                  }
                >
                  <td className="py-2.5 px-3 text-center font-extrabold tabular-nums">
                    {toPersianDigits(item.questionNumber)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {item.subjectName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.topic} · سطح {getDifficultyLabelFa(item.declaredDifficulty)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                    گزینه {toPersianDigits(item.correctOption)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                    {toPersianDigits(item.correctPercent)}٪
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-slate-500">
                    {toPersianDigits(item.blankPercent)}٪
                  </td>
                  <td className="py-2.5 px-3">
                    <OptionDistributionMiniSvg
                      distribution={item.optionDistribution}
                      correctOption={item.correctOption}
                      trapOption={item.trapOption}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    {item.isTrapQuestion && item.trapOption ? (
                      <div className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          سوال دامدار · گزینه {toPersianDigits(item.trapOption)} ({toPersianDigits(item.trapOptionPercent)}٪)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">عادی</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Off-screen Batch Printable Class Report Cards Container (for PrintIconButton A4/A5) */}
      <div className="hidden" aria-hidden="true">
        <div id="batch-mock-karnameh-print" className="space-y-6">
          {batchPrintStudents.map((st, idx) => {
            const att = attemptByStudentId.get(st.studentId);
            if (!att) return null;
            return (
              <div
                key={st.attemptId}
                style={{
                  pageBreakAfter: idx < batchPrintStudents.length - 1 ? 'always' : 'auto',
                }}
              >
                <MockExamReportCard
                  exam={exam}
                  analytics={st}
                  attempt={att}
                  tarazHistory={getStudentTarazHistory(st.studentId)}
                  canExport={false}
                  printBatchMode
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
