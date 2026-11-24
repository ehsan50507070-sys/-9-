// Pure Custom Responsive SVG Charts with Interactive Persian Tooltips for Phase 9-B Advanced SIDA Analytics
// Zero external chart libraries — compatible with Light, Dark, Reading, and Pure-White Print modes.
import React, { useState } from 'react';
import { toPersianDigits } from '../../lib/digits';
import type {
  BoxPlotGroupStat,
  GradeDistributionSummary,
  SubjectYearlyComparisonRow,
} from './sidaAnalyticsHelpers';

// ============================================================================
// 1. CUSTOM SVG BOX PLOT (Min, Q1, Median, Q3, Max, Outliers + Persian Tooltip)
// ============================================================================

export const SidaBoxPlotSvgChart: React.FC<{
  data: BoxPlotGroupStat[];
  titleFa: string;
}> = ({ data, titleFa }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
        داده‌ای برای رسم نمودار جعبه‌ای وجود ندارد.
      </div>
    );
  }

  const width = Math.max(640, data.length * 112 + 90);
  const height = 340;
  const padTop = 28;
  const padBottom = 64;
  const padLeft = 48;
  const padRight = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yOf = (score: number) => padTop + plotH - (Math.max(0, Math.min(20, score)) / 20) * plotH;
  const slotW = plotW / data.length;
  const boxW = Math.min(44, Math.max(22, slotW * 0.42));

  const yTicks = [0, 5, 10, 12, 15, 18, 20];
  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{titleFa}</div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-2.5 rounded-xs bg-sky-500/25 border border-sky-600" />
            بازه میان‌چارکی (Q1 تا Q3)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
            میانه (Median)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-600" />
            نقاط پرت (Outliers)
          </span>
        </div>
      </div>

      {/* Interactive Persian Tooltip Strip (zero overlap, crisp on mobile & desktop) */}
      <div
        data-testid="boxplot-tooltip-panel"
        className="min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs transition-colors"
      >
        {hovered ? (
          <>
            <span className="font-extrabold text-slate-900 dark:text-white">
              {hovered.label} ({toPersianDigits(hovered.count)} نمره)
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-slate-700 dark:text-slate-200">
              <span>کمینه: <strong>{toPersianDigits(hovered.rawMin)}</strong></span>
              <span>·</span>
              <span>چارک اول (Q1): <strong>{toPersianDigits(hovered.q1)}</strong></span>
              <span>·</span>
              <span className="text-indigo-700 dark:text-indigo-300">
                میانه: <strong>{toPersianDigits(hovered.median)}</strong>
              </span>
              <span>·</span>
              <span>چارک سوم (Q3): <strong>{toPersianDigits(hovered.q3)}</strong></span>
              <span>·</span>
              <span>بیشینه: <strong>{toPersianDigits(hovered.rawMax)}</strong></span>
              <span>·</span>
              <span>میانگین: <strong>{toPersianDigits(hovered.mean)}</strong></span>
              {hovered.outliers.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    پرت: {hovered.outliers.map((o) => toPersianDigits(o)).join('، ')}
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            برای مشاهده دقیق کمینه، چارک اول، میانه، چارک سوم، بیشینه و نقاط پرت، موس را روی هر جعبه
            ببرید یا روی آن کلیک کنید.
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={titleFa}
          data-testid="sida-boxplot-svg"
          className="w-full h-auto min-w-[560px] select-none"
        >
          {/* Horizontal gridlines & Y-axis labels */}
          {yTicks.map((tick) => {
            const y = yOf(tick);
            const isPassLine = tick === 10;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke={isPassLine ? '#e11d48' : 'currentColor'}
                  strokeOpacity={isPassLine ? 0.45 : 0.12}
                  strokeDasharray={isPassLine ? '5 4' : undefined}
                  strokeWidth={isPassLine ? 1.5 : 1}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[11px] font-bold"
                >
                  {toPersianDigits(tick)}
                </text>
              </g>
            );
          })}

          {/* Pass line label */}
          <text
            x={width - padRight - 4}
            y={yOf(10) - 5}
            textAnchor="end"
            className="fill-rose-600 dark:fill-rose-400 text-[10px] font-bold"
          >
            حد نصاب قبولی (۱۰)
          </text>

          {/* Box Plot Groups */}
          {data.map((item, idx) => {
            const cx = padLeft + slotW * idx + slotW / 2;
            const yWhiskerMin = yOf(item.whiskerMin);
            const yWhiskerMax = yOf(item.whiskerMax);
            const yQ1 = yOf(item.q1);
            const yQ3 = yOf(item.q3);
            const yMed = yOf(item.median);
            const yMean = yOf(item.mean);
            const isHovered = hoveredIdx === idx;
            const boxHeight = Math.max(4, yQ1 - yQ3);

            return (
              <g
                key={item.key}
                tabIndex={0}
                role="button"
                aria-label={`${item.label}، میانه ${toPersianDigits(item.median)}، چارک اول ${toPersianDigits(item.q1)}، چارک سوم ${toPersianDigits(item.q3)}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onClick={() => setHoveredIdx((prev) => (prev === idx ? null : idx))}
                className="cursor-pointer outline-none"
              >
                {/* Hover Column Highlight */}
                <rect
                  x={padLeft + slotW * idx + 6}
                  y={padTop}
                  width={slotW - 12}
                  height={plotH}
                  rx={8}
                  fill="#0284c7"
                  fillOpacity={isHovered ? 0.08 : 0}
                />

                {/* Vertical Whisker Line */}
                <line
                  x1={cx}
                  x2={cx}
                  y1={yWhiskerMax}
                  y2={yWhiskerMin}
                  stroke="#0284c7"
                  strokeWidth={2}
                />

                {/* Top & Bottom Whisker Caps */}
                <line
                  x1={cx - boxW * 0.34}
                  x2={cx + boxW * 0.34}
                  y1={yWhiskerMax}
                  y2={yWhiskerMax}
                  stroke="#0284c7"
                  strokeWidth={2}
                />
                <line
                  x1={cx - boxW * 0.34}
                  x2={cx + boxW * 0.34}
                  y1={yWhiskerMin}
                  y2={yWhiskerMin}
                  stroke="#0284c7"
                  strokeWidth={2}
                />

                {/* IQR Box (Q1 to Q3) */}
                <rect
                  x={cx - boxW / 2}
                  y={yQ3}
                  width={boxW}
                  height={boxHeight}
                  rx={6}
                  fill={isHovered ? '#0284c7' : '#38bdf8'}
                  fillOpacity={isHovered ? 0.38 : 0.24}
                  stroke="#0284c7"
                  strokeWidth={isHovered ? 2.5 : 2}
                />

                {/* Median Horizontal Line */}
                <line
                  x1={cx - boxW / 2}
                  x2={cx + boxW / 2}
                  y1={yMed}
                  y2={yMed}
                  stroke="#4338ca"
                  strokeWidth={3}
                />

                {/* Mean Diamond Marker */}
                <polygon
                  points={`${cx},${yMean - 4} ${cx + 4},${yMean} ${cx},${yMean + 4} ${cx - 4},${yMean}`}
                  fill="#059669"
                />

                {/* Outliers */}
                {item.outliers.map((outVal, oIdx) => (
                  <circle
                    key={`${item.key}-out-${oIdx}`}
                    cx={cx + ((oIdx % 3) - 1) * 5}
                    cy={yOf(outVal)}
                    r={4}
                    fill="#e11d48"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                ))}

                {/* Median Value Callout */}
                <text
                  x={cx}
                  y={yWhiskerMax - 8}
                  textAnchor="middle"
                  className="fill-slate-700 dark:fill-slate-200 text-[10px] font-extrabold"
                >
                  {toPersianDigits(item.median)}
                </text>

                {/* X-Axis Group Label */}
                <text
                  x={cx}
                  y={height - padBottom + 20}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-100 text-[11px] font-bold"
                >
                  {item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label}
                </text>
                <text
                  x={cx}
                  y={height - padBottom + 36}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px]"
                >
                  ({toPersianDigits(item.count)} نمره)
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// ============================================================================
// 2. CUSTOM SVG 5-BAND HISTOGRAM + TREND CURVE + VERTICAL MEAN & MEDIAN LINES
// ============================================================================

export const SidaDistributionHistogramSvgChart: React.FC<{
  summary: GradeDistributionSummary;
  titleFa: string;
}> = ({ summary, titleFa }) => {
  const [hoveredBandId, setHoveredBandId] = useState<string | null>(null);

  if (summary.totalCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
        نمره‌ای برای نمایش توزیع فراوانی وجود ندارد.
      </div>
    );
  }

  const width = 680;
  const height = 310;
  const padTop = 34;
  const padBottom = 56;
  const padLeft = 48;
  const padRight = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxCount = Math.max(1, ...summary.bands.map((b) => b.count));
  const yMax = Math.ceil(maxCount * 1.18);
  const slotW = plotW / summary.bands.length;
  const barW = Math.min(72, slotW * 0.56);

  const yOfCount = (c: number) => padTop + plotH - (c / yMax) * plotH;

  // Map a 0..20 score smoothly across the 5 uneven bands so Mean & Median vertical lines land in their exact visual band
  const xOfScore = (score: number) => {
    const s = Math.max(0, Math.min(20, score));
    const idx = summary.bands.findIndex(
      (b, i) => s >= b.rangeMin && (s < b.rangeMax || i === summary.bands.length - 1)
    );
    const bandIndex = Math.max(0, idx);
    const band = summary.bands[bandIndex];
    const ratio =
      band.rangeMax > band.rangeMin ? (s - band.rangeMin) / (band.rangeMax - band.rangeMin) : 0.5;
    return padLeft + bandIndex * slotW + ratio * slotW;
  };

  // Smooth cubic spline path connecting bar centers for the trend curve
  const points = summary.bands.map((b, i) => ({
    x: padLeft + i * slotW + slotW / 2,
    y: yOfCount(b.count),
  }));

  const trendPath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const meanX = xOfScore(summary.mean);
  const medianX = xOfScore(summary.median);
  const hoveredBand = summary.bands.find((b) => b.id === hoveredBandId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{titleFa}</div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
            <span className="inline-block w-3 h-0.5 bg-indigo-600" />
            میانگین: {toPersianDigits(summary.mean)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
            <span className="inline-block w-3 h-0.5 bg-emerald-600" />
            میانه: {toPersianDigits(summary.median)}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            انحراف معیار: {toPersianDigits(summary.stdDev)}
          </span>
        </div>
      </div>

      {/* Tooltip Banner */}
      <div className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 px-3.5 py-2 flex items-center justify-between text-xs">
        {hoveredBand ? (
          <div className="flex flex-wrap items-center gap-3 tabular-nums">
            <span className="font-extrabold text-slate-900 dark:text-white">
              بازه نمره {hoveredBand.labelFa}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              فراوانی: <strong>{toPersianDigits(hoveredBand.count)}</strong> مورد
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              سهم از کل: <strong>{toPersianDigits(hoveredBand.percent)}٪</strong>
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            مجموع {toPersianDigits(summary.totalCount)} نمره در ۵ بازه تحلیلی دسته‌بندی شده است — برای
            جزئیات روی هر ستون بروید.
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={titleFa}
          data-testid="sida-histogram-svg"
          className="w-full h-auto min-w-[520px] select-none"
        >
          {/* Y-Axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
            const val = Math.round(yMax * frac);
            const y = yOfCount(val);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-bold"
                >
                  {toPersianDigits(val)}
                </text>
              </g>
            );
          })}

          {/* Histogram Bars */}
          {summary.bands.map((band, i) => {
            const cx = padLeft + i * slotW + slotW / 2;
            const barTop = yOfCount(band.count);
            const barH = Math.max(2, padTop + plotH - barTop);
            const isHovered = hoveredBandId === band.id;
            return (
              <g
                key={band.id}
                onMouseEnter={() => setHoveredBandId(band.id)}
                onMouseLeave={() => setHoveredBandId(null)}
                className="cursor-pointer"
              >
                <rect
                  x={cx - barW / 2}
                  y={barTop}
                  width={barW}
                  height={barH}
                  rx={7}
                  fill={band.colorHex}
                  fillOpacity={isHovered ? 0.92 : 0.75}
                />
                <text
                  x={cx}
                  y={barTop - 8}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-100 text-[11px] font-extrabold"
                >
                  {toPersianDigits(band.count)} ({toPersianDigits(band.percent)}٪)
                </text>
                <text
                  x={cx}
                  y={height - padBottom + 20}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-100 text-[11px] font-bold"
                >
                  {band.labelFa}
                </text>
              </g>
            );
          })}

          {/* Smooth Trend Curve Overlay */}
          <path
            d={trendPath}
            fill="none"
            stroke="#0f172a"
            strokeOpacity={0.65}
            strokeWidth={2.5}
            className="dark:stroke-slate-100"
          />
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth={2}
            />
          ))}

          {/* Vertical Mean Indicator Line */}
          <line
            x1={meanX}
            x2={meanX}
            y1={padTop - 8}
            y2={padTop + plotH}
            stroke="#4f46e5"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          <rect x={meanX - 30} y={4} width={60} height={18} rx={5} fill="#4f46e5" />
          <text x={meanX} y={16} textAnchor="middle" className="fill-white text-[9.5px] font-bold">
            میانگین {toPersianDigits(summary.mean)}
          </text>

          {/* Vertical Median Indicator Line */}
          <line
            x1={medianX}
            x2={medianX}
            y1={padTop + 14}
            y2={padTop + plotH}
            stroke="#059669"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
          <rect
            x={medianX - 30}
            y={padTop + plotH + 34}
            width={60}
            height={18}
            rx={5}
            fill="#059669"
          />
          <text
            x={medianX}
            y={padTop + plotH + 46}
            textAnchor="middle"
            className="fill-white text-[9.5px] font-bold"
          >
            میانه {toPersianDigits(summary.median)}
          </text>
        </svg>
      </div>
    </div>
  );
};

// ============================================================================
// 3. CUSTOM SVG GROUPED BAR CHART (Year-over-Year: 1403-1404 vs 1404-1405)
// ============================================================================

export const SidaYearlyGroupedBarSvgChart: React.FC<{
  rows: SubjectYearlyComparisonRow[];
  prevYearCode: string;
  currYearCode: string;
}> = ({ rows, prevYearCode, currYearCode }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
        داده‌ای برای مقایسه سالانه در دسترس نیست.
      </div>
    );
  }

  const width = Math.max(640, rows.length * 108 + 90);
  const height = 320;
  const padTop = 32;
  const padBottom = 64;
  const padLeft = 46;
  const padRight = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const slotW = plotW / rows.length;
  const barW = Math.min(26, slotW * 0.28);

  const yOf = (score: number) => padTop + plotH - (Math.max(0, Math.min(20, score)) / 20) * plotH;
  const hovered = hoveredIdx !== null ? rows[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          مقایسه میانگین دروس بین سال {toPersianDigits(prevYearCode)} و {toPersianDigits(currYearCode)}
        </div>
        <div className="flex items-center gap-4 text-[11px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold">
            <span className="inline-block w-3 h-3 rounded-xs bg-amber-500/80" />
            سال آرشیو ({toPersianDigits(prevYearCode)})
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-bold">
            <span className="inline-block w-3 h-3 rounded-xs bg-sky-600" />
            سال فعال ({toPersianDigits(currYearCode)})
          </span>
        </div>
      </div>

      {/* Tooltip Strip */}
      <div className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {hovered ? (
          <>
            <span className="font-extrabold text-slate-900 dark:text-white">
              درس {hovered.subject}
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
              <span>
                سال {toPersianDigits(prevYearCode)}: <strong>{toPersianDigits(hovered.prevYearAvg)}</strong> (قبولی {toPersianDigits(hovered.prevPassRate)}٪)
              </span>
              <span>·</span>
              <span>
                سال {toPersianDigits(currYearCode)}: <strong>{toPersianDigits(hovered.currYearAvg)}</strong> (قبولی {toPersianDigits(hovered.currPassRate)}٪)
              </span>
              <span>·</span>
              <span
                className={`font-extrabold ${
                  hovered.deltaAvg >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                تغییر: {hovered.deltaAvg >= 0 ? '+' : ''}
                {toPersianDigits(hovered.deltaAvg)} نمره
              </span>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            برای مشاهده جزئیات رشد یا افت هر درس، روی جفت ستون‌ها بروید.
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="نمودار ستونی گروهی مقایسه سالانه دروس"
          data-testid="sida-yoy-grouped-bar-svg"
          className="w-full h-auto min-w-[540px] select-none"
        >
          {[0, 5, 10, 15, 20].map((tick) => {
            const y = yOf(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-bold"
                >
                  {toPersianDigits(tick)}
                </text>
              </g>
            );
          })}

          {rows.map((row, idx) => {
            const cx = padLeft + idx * slotW + slotW / 2;
            const prevY = yOf(row.prevYearAvg);
            const currY = yOf(row.currYearAvg);
            const prevH = Math.max(2, padTop + plotH - prevY);
            const currH = Math.max(2, padTop + plotH - currY);
            const isGrowth = row.deltaAvg >= 0;

            return (
              <g
                key={row.subject}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Previous Year Bar */}
                <rect
                  x={cx - barW - 3}
                  y={prevY}
                  width={barW}
                  height={prevH}
                  rx={5}
                  fill="#f59e0b"
                  fillOpacity={hoveredIdx === idx ? 0.95 : 0.78}
                />
                {/* Current Year Bar */}
                <rect
                  x={cx + 3}
                  y={currY}
                  width={barW}
                  height={currH}
                  rx={5}
                  fill="#0284c7"
                  fillOpacity={hoveredIdx === idx ? 1 : 0.88}
                />

                {/* Delta Callout above taller bar */}
                <text
                  x={cx}
                  y={Math.min(prevY, currY) - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-extrabold ${
                    isGrowth
                      ? 'fill-emerald-700 dark:fill-emerald-400'
                      : 'fill-rose-700 dark:fill-rose-400'
                  }`}
                >
                  {isGrowth ? '+' : ''}
                  {toPersianDigits(row.deltaAvg)}
                </text>

                {/* Subject Label */}
                <text
                  x={cx}
                  y={height - padBottom + 20}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-100 text-[11px] font-bold"
                >
                  {row.subject.length > 13 ? `${row.subject.slice(0, 12)}…` : row.subject}
                </text>
                <text
                  x={cx}
                  y={height - padBottom + 36}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px]"
                >
                  {toPersianDigits(row.prevYearAvg)} ← {toPersianDigits(row.currYearAvg)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
