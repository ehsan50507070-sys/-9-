// Strictly complex_admin-ONLY 3-School Comparison Tab with Pure Custom Responsive SVG Charts
import React, { useMemo, useState } from 'react';
import { Award, Building2, CheckCircle2, Clock } from 'lucide-react';
import type { ComplexPhase7Dataset } from '../../core/data/DataContext';
import { SvgGroupedBarChart, SvgHorizontalBarChart } from '../../core/ui/SvgCharts';
import { toPersianDigits } from '../../lib/digits';
import {
  TEACHER_RANK_TIERS,
  buildComplexTeacherDevComparison,
} from './teacherDevHelpers';

interface ComplexComparisonTabProps {
  dataset: ComplexPhase7Dataset;
  activeSchoolId: string;
  onSwitchSchool: (schoolId: string) => void;
}

export const ComplexComparisonTab: React.FC<ComplexComparisonTabProps> = ({
  dataset,
  activeSchoolId,
  onSwitchSchool,
}) => {
  const [hoveredTierCell, setHoveredTierCell] = useState<{
    schoolId: string;
    level: number;
  } | null>(null);

  const metrics = useMemo(
    () =>
      buildComplexTeacherDevComparison({
        schools: dataset.schools,
        teachers: dataset.teachers,
        courses: dataset.tdCourses,
        progressList: dataset.tdProgress,
        certificates: dataset.tdCertificates,
      }),
    [dataset]
  );

  const totalComplexCerts = useMemo(
    () => metrics.reduce((sum, m) => sum + m.totalCertificatesIssued, 0),
    [metrics]
  );
  const avgComplexHours = useMemo(() => {
    if (metrics.length === 0) return 0;
    return (
      Math.round(
        (metrics.reduce((sum, m) => sum + m.avgApprovedHoursPerTeacher, 0) / metrics.length) * 10
      ) / 10
    );
  }, [metrics]);
  const avgMandatoryPct = useMemo(() => {
    if (metrics.length === 0) return 0;
    return Math.round(
      metrics.reduce((sum, m) => sum + m.mandatoryCompletionPercent, 0) / metrics.length
    );
  }, [metrics]);

  const groupedRateData = useMemo(
    () =>
      metrics.map((m) => ({
        label: m.school.name.replace(/^دبستان\s*/, ''),
        values: {
          mandatory: m.mandatoryCompletionPercent,
          quizAvg: m.avgQuizScorePercent,
        },
      })),
    [metrics]
  );

  const avgHoursBarItems = useMemo(
    () =>
      metrics.map((m, idx) => ({
        id: m.school.id,
        label: m.school.name,
        value: m.avgApprovedHoursPerTeacher,
        displayValue: `${toPersianDigits(m.avgApprovedHoursPerTeacher)} ساعت`,
        subLabel: `${toPersianDigits(m.teacherCount)} معلم | ${toPersianDigits(m.totalCertificatesIssued)} گواهی`,
        color: idx === 0 ? '#4f46e5' : idx === 1 ? '#059669' : '#0284c7',
      })),
    [metrics]
  );

  return (
    <div className="space-y-6">
      {/* Complex KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>میانگین ساعات ضمن خدمت کل مجموعه</span>
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(avgComplexHours)} <span className="text-sm font-medium">ساعت / معلم</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>میانگین تکمیل دوره‌های الزامی</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(avgMandatoryPct)}٪
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>کل گواهینامه‌های صادرشده در ۳ مدرسه</span>
            <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(totalComplexCerts)} <span className="text-sm font-medium">گواهینامه</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side 3-School Comparison Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              جدول مقایسه جامع ۳ مدرسه مجموعه
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              شاخص‌های تفکیک‌شده هر واحد آموزشی با حفظ ایزولاسیون کامل داده‌ها
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-bold">واحد آموزشی</th>
                <th className="px-3 py-3 font-bold text-center">معلمان فعال</th>
                <th className="px-3 py-3 font-bold text-center">میانگین ساعت / معلم</th>
                <th className="px-3 py-3 font-bold text-center">تکمیل دوره‌های الزامی</th>
                <th className="px-3 py-3 font-bold text-center">میانگین نمره آزمون</th>
                <th className="px-3 py-3 font-bold text-center">گواهینامه‌ها</th>
                <th className="px-3 py-3 font-bold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {metrics.map((m) => {
                const isActive = m.school.id === activeSchoolId;
                return (
                  <tr
                    key={m.school.id}
                    className={
                      isActive
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{m.school.name}</span>
                        {isActive && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            (فعال)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-slate-700 dark:text-slate-300">
                      {toPersianDigits(m.teacherCount)}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {toPersianDigits(m.avgApprovedHoursPerTeacher)} ساعت
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">
                      <span
                        className={`font-bold ${
                          m.mandatoryCompletionPercent >= 75
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : m.mandatoryCompletionPercent >= 50
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {toPersianDigits(m.mandatoryCompletionPercent)}٪
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-bold text-slate-800 dark:text-slate-200">
                      {toPersianDigits(m.avgQuizScorePercent)}٪
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-bold text-indigo-700 dark:text-indigo-300">
                      {toPersianDigits(m.totalCertificatesIssued)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSwitchSchool(m.school.id)}
                        disabled={isActive}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        {isActive ? 'مدرسه جاری' : 'ورود به مدرسه'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pure Custom Responsive SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SvgGroupedBarChart
          title="نرخ تکمیل الزامی و میانگین نمره آزمون ۳ مدرسه"
          subtitle="مقایسه درصدی عملکرد آموزشی همکاران در واحدهای مجموعه"
          data={groupedRateData}
          series={[
            { key: 'mandatory', label: 'تکمیل دوره‌های الزامی (٪)', color: '#059669' },
            { key: 'quizAvg', label: 'میانگین نمره آزمون (٪)', color: '#4f46e5' },
          ]}
          maxValue={100}
          valueFormatter={(v) => `${toPersianDigits(v)}٪`}
          axisFormatter={(v) => `${toPersianDigits(v)}٪`}
        />

        <SvgHorizontalBarChart
          title="میانگین ساعات ضمن خدمت مصوب به ازای هر معلم"
          subtitle="مجموع ساعات گواهینامه‌های صادرشده تقسیم بر تعداد معلمان فعال هر مدرسه"
          items={avgHoursBarItems}
          defaultMax={30}
        />
      </div>

      {/* Pure Custom Responsive SVG 5-Tier Distribution Stacked Chart per School */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              توزیع معلمان در ۵ سطح رتبه‌بندی به تفکیک هر مدرسه
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              نمای گرافیکی SVG ترکیب سطوح حرفه‌ای کادر آموزشی در ۳ واحد مجموعه
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {TEACHER_RANK_TIERS.map((tier) => (
              <span
                key={tier.level}
                className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: tier.colorHex }}
                />
                <span>
                  سطح {toPersianDigits(tier.level)} ({tier.shortTitleFa})
                </span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="space-y-4"
          role="img"
          aria-label="نمودار توزیع ۵ سطح رتبه‌بندی معلمان در ۳ مدرسه"
        >
          {metrics.map((m) => {
            const total = Math.max(1, m.teacherCount);
            const barMaxW = 500;
            let cursorX = 0;

            return (
              <div
                key={m.school.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                {/* Unclipped Native RTL Persian School Label */}
                <div className="sm:w-48 shrink-0 text-right">
                  <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {m.school.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {toPersianDigits(m.teacherCount)} معلم فعال
                  </div>
                </div>

                {/* Pure Custom Responsive SVG Stacked Bar */}
                <div className="flex-1 min-w-0">
                  <svg
                    viewBox={`0 0 ${barMaxW} 30`}
                    preserveAspectRatio="none"
                    className="w-full h-8 block"
                  >
                    <rect
                      x={0}
                      y={2}
                      width={barMaxW}
                      height={26}
                      rx={6}
                      className="fill-slate-100 dark:fill-slate-800"
                    />
                    {TEACHER_RANK_TIERS.map((tier) => {
                      const count = m.tierDistribution[tier.level] ?? 0;
                      if (count <= 0) return null;
                      const segW = (count / total) * barMaxW;
                      const segX = cursorX;
                      cursorX += segW;
                      const isHovered =
                        hoveredTierCell?.schoolId === m.school.id &&
                        hoveredTierCell?.level === tier.level;

                      return (
                        <g
                          key={tier.level}
                          onMouseEnter={() =>
                            setHoveredTierCell({ schoolId: m.school.id, level: tier.level })
                          }
                          onMouseLeave={() => setHoveredTierCell(null)}
                          className="cursor-pointer"
                        >
                          <title>
                            {`${m.school.name} — سطح ${toPersianDigits(tier.level)} (${tier.shortTitleFa}): ${toPersianDigits(count)} معلم`}
                          </title>
                          <rect
                            x={segX + 1}
                            y={2}
                            width={Math.max(4, segW - 2)}
                            height={26}
                            rx={4}
                            fill={tier.colorHex}
                            opacity={isHovered ? 1 : 0.92}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  {/* Crisp non-distorted count indicators aligned beneath/over bar */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
                    {TEACHER_RANK_TIERS.filter((t) => (m.tierDistribution[t.level] ?? 0) > 0).map(
                      (t) => (
                        <span key={t.level} className="inline-flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: t.colorHex }}
                          />
                          <span>
                            سطح {toPersianDigits(t.level)}: {toPersianDigits(m.tierDistribution[t.level])} نفر
                          </span>
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
