// Pure SVG Score Distribution Chart & Most-Missed Question Analytics for Online Exams
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type { ExamClassAnalytics } from './onlineExamHelpers';

interface ExamAnalyticsChartProps {
  analytics: ExamClassAnalytics;
}

export const ExamAnalyticsChart: React.FC<ExamAnalyticsChartProps> = ({ analytics }) => {
  const maxCount = Math.max(1, ...analytics.buckets.map((b) => b.count));

  return (
    <div className="space-y-5">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">میانگین کلاس (از ۲۰)</div>
          <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {analytics.averageScore20 !== null ? toPersianDigits(analytics.averageScore20) : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">بالاترین نمره</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {analytics.highestScore20 !== null ? toPersianDigits(analytics.highestScore20) : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">پایین‌ترین نمره</div>
          <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {analytics.lowestScore20 !== null ? toPersianDigits(analytics.lowestScore20) : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">تعداد شرکت‌کنندگان</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {toPersianDigits(analytics.submissionCount)} نفر
          </div>
        </div>
      </div>

      {/* Pure SVG Bar Chart of Score Distribution */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            توزیع فراوانی نمرات کلاس (بازه ۰ تا ۲۰)
          </span>
          {analytics.tabSwitchFlaggedCount > 0 && (
            <span className="text-amber-700 dark:text-amber-400 font-bold tabular-nums">
              {toPersianDigits(analytics.tabSwitchFlaggedCount)} مورد هشدار خروج از تب
            </span>
          )}
        </div>

        <svg
          viewBox="0 0 400 150"
          className="w-full h-44 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800"
          role="img"
          aria-label="نمودار توزیع نمرات کلاس در آزمون آنلاین"
        >
          {/* Horizontal grid lines */}
          {[30, 65, 100].map((y) => (
            <line
              key={y}
              x1={24}
              x2={376}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="3 3"
            />
          ))}

          {analytics.buckets.map((bucket, idx) => {
            const barWidth = 54;
            const gap = 36;
            const startX = 38 + idx * (barWidth + gap);
            const maxBarHeight = 82;
            const barHeight = bucket.count > 0 ? Math.max(12, Math.round((bucket.count / maxCount) * maxBarHeight)) : 4;
            const y = 114 - barHeight;

            return (
              <g key={bucket.labelFa}>
                <rect
                  x={startX}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={6}
                  fill={bucket.count > 0 ? bucket.colorHex : '#cbd5e1'}
                />
                <text
                  x={startX + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="currentColor"
                  className="text-slate-700 dark:text-slate-200"
                >
                  {toPersianDigits(bucket.count)} نفر
                </text>
                <text
                  x={startX + barWidth / 2}
                  y={134}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="currentColor"
                  className="text-slate-500 dark:text-slate-400"
                >
                  {bucket.labelFa}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Most-Missed Questions */}
      {analytics.mostMissedQuestions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>سوالات با بیشترین درصد خطا (پیشنهاد مرور در کلاس)</span>
          </div>
          <div className="space-y-2">
            {analytics.mostMissedQuestions.map((row) => (
              <div
                key={row.questionId}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs"
              >
                <span className="text-slate-700 dark:text-slate-200 truncate">
                  <strong>سوال {toPersianDigits(row.questionIndex)}:</strong> {row.questionText}
                </span>
                <span className="shrink-0 font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {toPersianDigits(row.missRatePercent)}٪ خطا
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
