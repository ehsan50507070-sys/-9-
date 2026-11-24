// Pure Custom Responsive SVG Charts for Phase 9A Enterprise Mock & Konkur Exam System
// Zero external charting libraries; all numbers formatted with toPersianDigits and tabular-nums.
import React, { useId } from 'react';
import { toPersianDigits } from '../../lib/digits';
import type { MockAnswerOption } from '../../types/domain';
import type {
  SchoolMockComparisonRow,
  SubjectScoreMetrics,
  TarazHistogramBucket,
  TopicAnalysisRow,
} from './statsEngine';

/**
 * 1. Subject Comparison Grouped Bar Chart: Student % vs School Average % vs Top 10% Average %
 */
export const SubjectComparisonSvgChart: React.FC<{
  subjects: SubjectScoreMetrics[];
}> = ({ subjects }) => {
  if (subjects.length === 0) return null;

  const width = 680;
  const height = 248;
  const padTop = 26;
  const padRight = 34;
  const padLeft = 44;
  const padBottom = 46;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minVal = Math.min(0, ...subjects.map((s) => Math.min(s.percentage, s.cohortAvgPct)));
  const yMin = minVal < 0 ? Math.floor(minVal / 20) * 20 : 0;
  const yMax = 100;
  const yRange = Math.max(100, yMax - yMin);

  const yPos = (v: number) => padTop + ((yMax - v) / yRange) * plotH;
  const zeroY = yPos(0);

  const groupW = plotW / Math.max(1, subjects.length);
  const barW = Math.min(20, Math.max(10, (groupW - 22) / 3));

  const yTicks = yMin < 0 ? [yMin, 0, 25, 50, 75, 100] : [0, 25, 50, 75, 100];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          مقایسه درصد دانش‌آموز با میانگین و ۱۰٪ برتر
        </h3>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
            درصد دانش‌آموز
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
            میانگین شرکت‌کنندگان
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            میانگین ۱۰٪ برتر
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="نمودار میله‌ای مقایسه درصد دانش‌آموز با میانگین مدرسه و ۱۰ درصد برتر"
        className="w-full h-auto max-h-[250px] overflow-visible"
      >
        {/* Horizontal grid lines */}
        {yTicks.map((t) => {
          const y = yPos(t);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke={t === 0 ? '#94a3b8' : '#e2e8f0'}
                strokeWidth={t === 0 ? 1.2 : 1}
                strokeDasharray={t === 0 ? undefined : '3 3'}
                className="dark:stroke-slate-800"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                className="fill-slate-500 dark:fill-slate-400"
              >
                {toPersianDigits(t)}٪
              </text>
            </g>
          );
        })}

        {/* Grouped bars (RTL right-to-left order) */}
        {subjects.map((subj, i) => {
          const rtlIdx = subjects.length - 1 - i;
          const centerX = padLeft + rtlIdx * groupW + groupW / 2;
          const bars = [
            { val: subj.percentage, fill: '#4f46e5', dx: barW + 3 },
            { val: subj.cohortAvgPct, fill: '#94a3b8', dx: 0 },
            { val: subj.topTenPercentAvgPct, fill: '#059669', dx: -(barW + 3) },
          ];

          return (
            <g key={subj.subjectId}>
              {bars.map((b, bIdx) => {
                const topY = b.val >= 0 ? yPos(b.val) : zeroY;
                const barH = Math.max(2, Math.abs(yPos(b.val) - zeroY));
                const bx = centerX + b.dx - barW / 2;
                return (
                  <g key={bIdx}>
                    <rect
                      x={bx}
                      y={topY}
                      width={barW}
                      height={barH}
                      rx={3}
                      fill={b.fill}
                    />
                    {bIdx === 0 && (
                      <text
                        x={bx + barW / 2}
                        y={b.val >= 0 ? topY - 5 : topY + barH + 12}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        className="fill-indigo-700 dark:fill-indigo-300"
                      >
                        {toPersianDigits(subj.percentage)}٪
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={centerX}
                y={height - 14}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                className="fill-slate-700 dark:fill-slate-300"
              >
                {subj.subjectName.length > 14 ? `${subj.subjectName.slice(0, 13)}…` : subj.subjectName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 2. Sequential Multi-Stage Taraz Trend Line Chart (Stage 1 -> Current Stage)
 */
export interface TarazStagePoint {
  examId: string;
  stageLabelFa: string;
  taraz: number;
  isCurrent?: boolean;
}

export const TarazTrendSvgChart: React.FC<{
  points: TarazStagePoint[];
}> = ({ points }) => {
  const gradId = useId();
  if (points.length === 0) return null;

  const width = 620;
  const height = 225;
  const padTop = 28;
  const padBottom = 38;
  const padLeft = 48;
  const padRight = 34;
  const insetX = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minVal = Math.min(...points.map((p) => p.taraz), 4500);
  const maxVal = Math.max(...points.map((p) => p.taraz), 7500);
  const yMin = Math.max(1000, Math.floor((minVal - 400) / 500) * 500);
  const yMax = Math.min(11000, Math.ceil((maxVal + 400) / 500) * 500);
  const ySpan = Math.max(1000, yMax - yMin);

  const yPos = (val: number) => padTop + ((yMax - val) / ySpan) * plotH;
  // RTL chronological progression: Stage 1 on the right, latest stage on the left
  const xPos = (idx: number) => {
    if (points.length === 1) return padLeft + plotW / 2;
    const usableW = Math.max(40, plotW - insetX * 2);
    return width - padRight - insetX - (idx / (points.length - 1)) * usableW;
  };

  const coords = points.map((p, idx) => ({ ...p, x: xPos(idx), y: yPos(p.taraz) }));
  const polylinePts = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `M ${coords[0].x} ${height - padBottom} ` +
        coords.map((c) => `L ${c.x} ${c.y}`).join(' ') +
        ` L ${coords[coords.length - 1].x} ${height - padBottom} Z`
      : '';

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(yMin + (i / tickCount) * ySpan)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          روند تراز در آزمون‌های آزمایشی متوالی
        </h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {toPersianDigits(points.length)} مرحله ثبت‌شده
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="نمودار خطی روند تراز دانش‌آموز در آزمون‌های متوالی"
        className="w-full h-auto max-h-[235px] overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((t) => {
          const y = yPos(t);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                className="dark:stroke-slate-800"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                className="fill-slate-500 dark:fill-slate-400"
              >
                {toPersianDigits(t)}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

        {coords.length > 1 && (
          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylinePts}
          />
        )}

        {coords.map((c) => (
          <g key={c.examId}>
            <circle
              cx={c.x}
              cy={c.y}
              r={c.isCurrent ? 6 : 4.5}
              fill={c.isCurrent ? '#0284c7' : '#ffffff'}
              stroke="#0284c7"
              strokeWidth={2.5}
            />
            <text
              x={c.x}
              y={c.y - 12}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              className="fill-slate-900 dark:fill-slate-100"
            >
              {toPersianDigits(c.taraz)}
            </text>
            <text
              x={c.x}
              y={height - 12}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={c.isCurrent ? '700' : '500'}
              className={
                c.isCurrent
                  ? 'fill-sky-700 dark:fill-sky-300'
                  : 'fill-slate-600 dark:fill-slate-400'
              }
            >
              {c.stageLabelFa}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/**
 * 3. Topic Strength & Weakness Horizontal SVG Bars
 */
export const TopicStrengthSvgBars: React.FC<{
  topics: TopicAnalysisRow[];
}> = ({ topics }) => {
  if (topics.length === 0) return null;

  const statusMeta = {
    strength: {
      label: 'نقطه قوت پایدار',
      barColor: '#16a34a',
      textColor: 'text-emerald-700 dark:text-emerald-400',
    },
    consolidation: {
      label: 'نیازمند تثبیت',
      barColor: '#d97706',
      textColor: 'text-amber-700 dark:text-amber-400',
    },
    weakness: {
      label: 'اولویت مرور',
      barColor: '#dc2626',
      textColor: 'text-rose-700 dark:text-rose-400',
    },
  } as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          نقشه تحلیل مبحثی (نقاط قوت، تثبیت و اولویت مرور)
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>قوت پایدار (≥ ۷۰٪)</span>
          <span aria-hidden="true">·</span>
          <span>نیازمند تثبیت (۴۰ تا ۶۹٪)</span>
          <span aria-hidden="true">·</span>
          <span>نقطه ضعف (&lt; ۴۰٪)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {topics.map((t) => {
          const meta = statusMeta[t.status];
          return (
            <div
              key={`${t.subjectId}-${t.topic}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t.topic}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400">{t.subjectName}</span>
                </div>
                <span className={`font-bold shrink-0 tabular-nums ${meta.textColor}`}>
                  {toPersianDigits(t.accuracyPercent)}٪ · {meta.label}
                </span>
              </div>

              <svg
                viewBox="0 0 260 12"
                role="img"
                aria-label={`${t.topic}: ${t.accuracyPercent} درصد`}
                className="w-full h-3"
              >
                <rect
                  x={0}
                  y={2}
                  width={260}
                  height={8}
                  rx={4}
                  fill="#e2e8f0"
                  className="dark:fill-slate-800"
                />
                <rect
                  x={260 - Math.max(4, (t.accuracyPercent / 100) * 260)}
                  y={2}
                  width={Math.max(4, (t.accuracyPercent / 100) * 260)}
                  height={8}
                  rx={4}
                  fill={meta.barColor}
                />
              </svg>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{toPersianDigits(t.correct)} درست</span>
                <span aria-hidden="true">·</span>
                <span>{toPersianDigits(t.wrong)} غلط</span>
                <span aria-hidden="true">·</span>
                <span>{toPersianDigits(t.blank)} نزده</span>
                <span aria-hidden="true">·</span>
                <span>از {toPersianDigits(t.totalQuestions)} سوال</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 4. Taraz Distribution Histogram SVG Chart (Management Dashboard)
 */
export const TarazHistogramSvgChart: React.FC<{
  buckets: TarazHistogramBucket[];
}> = ({ buckets }) => {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const width = 580;
  const height = 210;
  const padTop = 26;
  const padBottom = 38;
  const padX = 24;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const colW = plotW / Math.max(1, buckets.length);
  const barW = Math.min(54, colW * 0.56);

  const colors = ['#dc2626', '#d97706', '#0284c7', '#4f46e5', '#16a34a'];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
        نمودار توزیع تراز شرکت‌کنندگان
      </h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="نمودار هیستوگرام توزیع تراز شرکت‌کنندگان"
        className="w-full h-auto max-h-[220px]"
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={height - padBottom}
          y2={height - padBottom}
          stroke="#cbd5e1"
          className="dark:stroke-slate-700"
        />
        {buckets.map((b, i) => {
          const rtlIdx = buckets.length - 1 - i;
          const cx = padX + rtlIdx * colW + colW / 2;
          const h = (b.count / maxCount) * plotH;
          const y = height - padBottom - h;
          return (
            <g key={b.id}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(3, h)}
                rx={6}
                fill={colors[i % colors.length]}
              />
              <text
                x={cx}
                y={y - 7}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                className="fill-slate-900 dark:fill-slate-100"
              >
                {toPersianDigits(b.count)} نفر ({toPersianDigits(b.percent)}٪)
              </text>
              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fontSize="10.5"
                className="fill-slate-600 dark:fill-slate-400"
              >
                {b.labelFa}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 5. Three-School Subject Comparison SVG Chart (complex_admin & super_admin ONLY)
 */
export const ThreeSchoolComparisonSvgChart: React.FC<{
  schools: SchoolMockComparisonRow[];
  subjects: Array<{ id: string; subjectName: string }>;
}> = ({ schools, subjects }) => {
  if (schools.length === 0 || subjects.length === 0) return null;

  const palette = ['#4f46e5', '#059669', '#7c3aed', '#0284c7'];
  const width = 680;
  const height = 240;
  const padTop = 24;
  const padBottom = 42;
  const padLeft = 42;
  const padRight = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const groupW = plotW / subjects.length;
  const barW = Math.min(18, Math.max(10, (groupW - 20) / Math.max(1, schools.length)));
  const yPos = (val: number) => padTop + ((100 - Math.max(0, Math.min(100, val))) / 100) * plotH;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          مقایسه میانگین درصد مدارس به تفکیک هر درس
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          {schools.map((sc, idx) => (
            <span key={sc.schoolId} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{ backgroundColor: palette[idx % palette.length] }}
              />
              {sc.schoolName}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="نمودار مقایسه عملکرد مدارس در هر درس"
        className="w-full h-auto max-h-[240px]"
      >
        {[0, 25, 50, 75, 100].map((t) => {
          const y = yPos(t);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                className="dark:stroke-slate-800"
              />
              <text
                x={padLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                className="fill-slate-500 dark:fill-slate-400"
              >
                {toPersianDigits(t)}٪
              </text>
            </g>
          );
        })}

        {subjects.map((subj, sIdx) => {
          const rtlIdx = subjects.length - 1 - sIdx;
          const cx = padLeft + rtlIdx * groupW + groupW / 2;
          const totalGroupBarsW = schools.length * (barW + 3);

          return (
            <g key={subj.id}>
              {schools.map((sc, scIdx) => {
                const val = Math.max(0, sc.subjectAverages[subj.id] ?? 0);
                const bx = cx - totalGroupBarsW / 2 + scIdx * (barW + 3);
                const by = yPos(val);
                const bh = Math.max(2, height - padBottom - by);
                return (
                  <g key={sc.schoolId}>
                    <rect
                      x={bx}
                      y={by}
                      width={barW}
                      height={bh}
                      rx={3}
                      fill={palette[scIdx % palette.length]}
                    />
                    <text
                      x={bx + barW / 2}
                      y={by - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      className="fill-slate-700 dark:fill-slate-300"
                    >
                      {toPersianDigits(Math.round(val))}
                    </text>
                  </g>
                );
              })}
              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                className="fill-slate-700 dark:fill-slate-300"
              >
                {subj.subjectName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 6. Inline 4-Option Distribution Mini SVG Bar for Canvas-Style Item Analysis
 */
export const OptionDistributionMiniSvg: React.FC<{
  distribution: Record<MockAnswerOption, { count: number; percent: number }>;
  correctOption: MockAnswerOption;
  trapOption: MockAnswerOption | null;
}> = ({ distribution, correctOption, trapOption }) => {
  const options: MockAnswerOption[] = [1, 2, 3, 4];

  return (
    <div className="space-y-1 min-w-[168px]">
      {options.map((opt) => {
        const pct = distribution[opt]?.percent ?? 0;
        const isCorrect = opt === correctOption;
        const isTrap = opt === trapOption;
        const fill = isCorrect ? '#16a34a' : isTrap ? '#dc2626' : '#64748b';

        return (
          <div key={opt} className="flex items-center gap-1.5 text-[11px] tabular-nums">
            <span
              className={`w-4 text-center font-bold ${
                isCorrect
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : isTrap
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {toPersianDigits(opt)}
            </span>
            <svg viewBox="0 0 110 8" className="w-[104px] h-2 shrink-0">
              <rect
                x={0}
                y={0}
                width={110}
                height={8}
                rx={4}
                fill="#e2e8f0"
                className="dark:fill-slate-800"
              />
              {pct > 0 && (
                <rect
                  x={110 - Math.max(3, (pct / 100) * 110)}
                  y={0}
                  width={Math.max(3, (pct / 100) * 110)}
                  height={8}
                  rx={4}
                  fill={fill}
                />
              )}
            </svg>
            <span
              className={`w-8 text-left ${
                isTrap ? 'font-bold text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {toPersianDigits(pct)}٪
            </span>
          </div>
        );
      })}
    </div>
  );
};
