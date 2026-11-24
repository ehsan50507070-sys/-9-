// Pure Responsive Custom SVG Progress Charts for Parent Portal (Zero External Chart Libraries)
import React from 'react';
import { toPersianDigits } from '../../lib/digits';
import {
  getShortDescriptiveLabel,
  type ReportTimeframe,
  type SubjectChartSeries,
} from './parentReportCardHelpers';

function buildSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  const parts: string[] = [`M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`];
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const midX = (prev.x + curr.x) / 2;
    parts.push(
      `C ${midX.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
    );
  }
  return parts.join(' ');
}

function getToneColors(tone: SubjectChartSeries['trendTone']): {
  stroke: string;
  areaTop: string;
  areaBottom: string;
  barFill: string;
  badgeTextClass: string;
} {
  if (tone === 'improving') {
    return {
      stroke: '#059669',
      areaTop: 'rgba(16, 185, 129, 0.24)',
      areaBottom: 'rgba(16, 185, 129, 0.02)',
      barFill: 'rgba(16, 185, 129, 0.14)',
      badgeTextClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }
  if (tone === 'declining') {
    return {
      stroke: '#d97706',
      areaTop: 'rgba(245, 158, 11, 0.24)',
      areaBottom: 'rgba(245, 158, 11, 0.02)',
      barFill: 'rgba(245, 158, 11, 0.16)',
      badgeTextClass: 'text-amber-700 dark:text-amber-400',
    };
  }
  return {
    stroke: '#4f46e5',
    areaTop: 'rgba(99, 102, 241, 0.22)',
    areaBottom: 'rgba(99, 102, 241, 0.02)',
    barFill: 'rgba(99, 102, 241, 0.14)',
    badgeTextClass: 'text-indigo-700 dark:text-indigo-400',
  };
}

interface CoreChartSvgProps {
  series: SubjectChartSeries;
  gradientId: string;
  compact?: boolean;
}

const CoreTrendSvg: React.FC<CoreChartSvgProps> = ({ series, gradientId, compact = false }) => {
  const { points, referenceScore, referenceLabelFa, termDividerAfterIndex, timeframe } = series;

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        داده‌ای برای ترسیم نمودار در این بازه ثبت نشده است.
      </div>
    );
  }

  const width = compact ? 480 : 720;
  const height = compact ? 190 : 230;
  const padTop = 28;
  const padBottom = compact ? 34 : 38;
  const padLeft = 22;
  const padRight = 38;
  const insetX = compact ? 22 : 28;
  const plotW = width - padLeft - padRight;
  const innerW = Math.max(40, plotW - insetX * 2);
  const plotH = height - padTop - padBottom;

  const allValues = [
    ...points.map((p) => p.score),
    ...(referenceScore !== null ? [referenceScore] : []),
  ];
  const minVal = Math.min(...allValues);
  const yMin = minVal >= 10 ? 8 : 0;
  const yMax = 20;
  const yTicks = yMin === 8 ? [8, 11, 14, 17, 20] : [0, 5, 10, 15, 20];

  const scoreToY = (score: number): number => {
    const clamped = Math.max(yMin, Math.min(yMax, score));
    return padTop + plotH - ((clamped - yMin) / (yMax - yMin)) * plotH;
  };

  // RTL chronological progression: oldest on the right, newest on the left (with clean inset away from Y-axis ticks)
  const stepX = points.length === 1 ? 0 : innerW / (points.length - 1);
  const coords = points.map((pt, idx) => {
    const x =
      points.length === 1
        ? padLeft + plotW / 2
        : width - padRight - insetX - idx * stepX;
    const y = scoreToY(pt.score);
    return { ...pt, x, y };
  });

  const smoothLine = buildSmoothPath(coords);
  const areaPath =
    coords.length >= 2
      ? `${smoothLine} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const palette = getToneColors(series.trendTone);
  const showBars = timeframe === 'monthly';
  const barWidth = compact ? 26 : 36;

  // Divider X between Term 1 (دی, idx 3) and Term 2 (بهمن, idx 4)
  const dividerX =
    termDividerAfterIndex !== null &&
    termDividerAfterIndex >= 0 &&
    termDividerAfterIndex + 1 < coords.length
      ? (coords[termDividerAfterIndex].x + coords[termDividerAfterIndex + 1].x) / 2
      : null;

  const refY = referenceScore !== null ? scoreToY(referenceScore) : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-auto select-none ${compact ? 'min-w-[300px]' : 'min-w-[440px]'}`}
        role="img"
        aria-label={`نمودار پیشرفت ${series.subject}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={palette.stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines & Y-axis ticks */}
        {yTicks.map((tick) => {
          const y = scoreToY(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                strokeDasharray={tick === yMin ? undefined : '3 4'}
                className="text-slate-200 dark:text-slate-700/80"
                strokeWidth={tick === yMin ? 1.2 : 1}
              />
              <text
                x={width - padRight + 8}
                y={y + 3.5}
                textAnchor="start"
                className="fill-slate-400 dark:fill-slate-500 text-[10px]"
              >
                {toPersianDigits(tick)}
              </text>
            </g>
          );
        })}

        {/* Full-year subtle vertical divider between Term 1 and Term 2 */}
        {dividerX !== null && (
          <g>
            <line
              x1={dividerX}
              y1={padTop - 8}
              x2={dividerX}
              y2={padTop + plotH}
              stroke="#6366f1"
              strokeOpacity="0.45"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <rect
              x={dividerX - 58}
              y={4}
              width={116}
              height={16}
              rx={4}
              fill="rgba(99, 102, 241, 0.1)"
            />
            <text
              x={dividerX}
              y={15}
              textAnchor="middle"
              className="fill-indigo-700 dark:fill-indigo-300 text-[9.5px] font-bold"
            >
              مرز نوبت اول / نوبت دوم
            </text>
          </g>
        )}

        {/* Monthly dashed previous-month reference line */}
        {refY !== null && referenceScore !== null && (
          <g>
            <line
              x1={padLeft}
              y1={refY}
              x2={width - padRight}
              y2={refY}
              stroke="#64748b"
              strokeWidth={1.4}
              strokeDasharray="5 4"
            />
            {referenceLabelFa && (
              <text
                x={padLeft + 4}
                y={Math.max(padTop + 10, refY - 5)}
                textAnchor="start"
                className="fill-slate-500 dark:fill-slate-400 text-[9.5px] font-semibold"
              >
                {referenceLabelFa}
              </text>
            )}
          </g>
        )}

        {/* Soft area fill under smooth trend curve */}
        {areaPath && !showBars && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {/* Monthly checkpoint bars */}
        {showBars &&
          coords.map((c) => {
            const barH = Math.max(6, padTop + plotH - c.y);
            return (
              <rect
                key={`bar-${c.id}`}
                x={c.x - barWidth / 2}
                y={c.y}
                width={barWidth}
                height={barH}
                rx={5}
                fill={palette.barFill}
              />
            );
          })}

        {/* Primary smooth trend line */}
        {coords.length >= 2 && (
          <path
            d={smoothLine}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={compact ? 2.5 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data point nodes, Persian score labels & X-axis labels */}
        {coords.map((c) => (
          <g key={c.id}>
            <circle
              cx={c.x}
              cy={c.y}
              r={compact ? 4.2 : 5}
              fill="#ffffff"
              stroke={palette.stroke}
              strokeWidth={2.5}
            />
            <text
              x={c.x}
              y={Math.max(14, c.y - 9)}
              textAnchor="middle"
              className="fill-slate-800 dark:fill-slate-100 text-[10.5px] font-bold"
            >
              {toPersianDigits(c.score.toFixed(1))}
            </text>
            <text
              x={c.x}
              y={padTop + plotH + 17}
              textAnchor="middle"
              className="fill-slate-600 dark:fill-slate-300 text-[10px] font-medium"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

interface OverallGpaTrendSvgChartProps {
  series: SubjectChartSeries;
  timeframeLabelFa: string;
}

export const OverallGpaTrendSvgChart: React.FC<OverallGpaTrendSvgChartProps> = ({
  series,
  timeframeLabelFa,
}) => {
  const palette = getToneColors(series.trendTone);
  return (
    <section
      data-testid="overall-gpa-chart"
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 break-inside-avoid"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            نمودار روند معدل کل
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            میانگین تجمیعی همه دروس در بازه {timeframeLabelFa}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          <span className="font-bold text-slate-700 dark:text-slate-200">
            معدل فعال: {toPersianDigits(series.activeScore.toFixed(1))} از ۲۰
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span className={`font-extrabold ${palette.badgeTextClass}`}>
            {series.trendBadgeText}
          </span>
        </div>
      </div>

      <CoreTrendSvg series={series} gradientId="overall-gpa-grad" />

      {series.timeframe === 'full_year' &&
        series.term1Average !== null &&
        series.term2Average !== null && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                میانگین نوبت اول:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {toPersianDigits(series.term1Average.toFixed(1))}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <span>
                میانگین نوبت دوم:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {toPersianDigits(series.term2Average.toFixed(1))}
                </strong>
              </span>
            </div>
            <span className={`font-bold ${palette.badgeTextClass}`}>{series.trendBadgeText}</span>
          </div>
        )}
    </section>
  );
};

interface PerSubjectProgressGridProps {
  charts: SubjectChartSeries[];
  timeframe: ReportTimeframe;
  timeframeLabelFa: string;
}

export const PerSubjectProgressGrid: React.FC<PerSubjectProgressGridProps> = ({
  charts,
  timeframe,
  timeframeLabelFa,
}) => {
  return (
    <section
      data-testid="per-subject-charts-section"
      aria-label="نمودار پیشرفت به تفکیک هر درس"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            نمودار پیشرفت به تفکیک هر درس
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {timeframe === 'monthly'
              ? `روند هفتگی و نمره مستمر هر درس در ${timeframeLabelFa} همراه با خط مرجع ماه قبل`
              : timeframe === 'full_year'
                ? 'تحلیل کامل مسیر ۹ ماهه هر درس از مهر تا خرداد با مقایسه نوبت اول و نوبت دوم'
                : `مسیر پیشرفت ماه‌به‌ماه هر درس در بازه ${timeframeLabelFa}`}
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
          {toPersianDigits(charts.length)} نمودار درسی
        </span>
      </div>

      <div
        className={`grid gap-4 ${
          charts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {charts.map((series, idx) => {
          const palette = getToneColors(series.trendTone);
          return (
            <article
              key={series.subject}
              data-testid={`subject-chart-card-${idx}`}
              data-subject-name={series.subject}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 break-inside-avoid"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {series.subject}
                  </h4>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    نمره فعال:{' '}
                    <strong className="text-slate-800 dark:text-slate-100">
                      {toPersianDigits(series.activeScore.toFixed(1))} از ۲۰
                    </strong>
                    {' · '}
                    <span>{getShortDescriptiveLabel(series.descriptiveLevel)}</span>
                  </div>
                </div>

                <div
                  className={`text-xs font-extrabold whitespace-nowrap shrink-0 tabular-nums ${palette.badgeTextClass}`}
                >
                  {series.trendBadgeText}
                </div>
              </div>

              <CoreTrendSvg
                series={series}
                gradientId={`subj-grad-${idx}-${timeframe}`}
                compact={charts.length > 1}
              />

              {series.timeframe === 'full_year' &&
                series.term1Average !== null &&
                series.term2Average !== null && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                    <span>
                      نوبت اول:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {toPersianDigits(series.term1Average.toFixed(1))}
                      </strong>
                    </span>
                    <span>
                      نوبت دوم:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {toPersianDigits(series.term2Average.toFixed(1))}
                      </strong>
                    </span>
                    <span className={`font-bold ${palette.badgeTextClass}`}>
                      {series.delta >= 0.4
                        ? `رشد +${toPersianDigits(series.delta.toFixed(1))}`
                        : series.delta <= -0.4
                          ? `افت ${toPersianDigits(Math.abs(series.delta).toFixed(1))}`
                          : 'پایدار'}
                    </span>
                  </div>
                )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
