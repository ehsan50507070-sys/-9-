// Pure Custom Responsive SVG Chart Components (Zero External Libraries, RTL Persian Digits & Dark/Reading Support)
import React, { useState } from 'react';
import { toPersianDigits } from '../../lib/digits';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export interface GroupedBarDatum {
  label: string;
  values: Record<string, number>;
}

interface SvgGroupedBarChartProps {
  title?: string;
  subtitle?: string;
  data: GroupedBarDatum[];
  series: BarSeries[];
  valueFormatter?: (val: number) => string;
  axisFormatter?: (val: number) => string;
  maxValue?: number;
  height?: number;
  emptyText?: string;
}

export const SvgGroupedBarChart: React.FC<SvgGroupedBarChartProps> = ({
  title,
  subtitle,
  data,
  series,
  valueFormatter = (v) => toPersianDigits(v),
  axisFormatter = (v) => toPersianDigits(v),
  maxValue,
  height = 240,
  emptyText = 'داده‌ای برای نمایش نمودار ثبت نشده است.',
}) => {
  const [hovered, setHovered] = useState<{ idx: number; seriesKey: string } | null>(null);

  if (data.length === 0 || series.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyText}
      </div>
    );
  }

  const rawMax = Math.max(
    1,
    maxValue ??
      Math.max(
        ...data.flatMap((d) => series.map((s) => Math.max(0, d.values[s.key] ?? 0)))
      )
  );
  // Nice rounded upper bound
  const niceMax = maxValue ?? Math.ceil((rawMax * 1.12) / Math.pow(10, Math.max(0, Math.floor(Math.log10(rawMax)) - 1))) * Math.pow(10, Math.max(0, Math.floor(Math.log10(rawMax)) - 1));

  const viewWidth = Math.max(520, data.length * 92 + 90);
  const viewHeight = height;
  const padTop = 22;
  const padBottom = 40;
  const padLeft = 18;
  const padRight = 64; // RTL Y-axis labels on right
  const plotWidth = viewWidth - padLeft - padRight;
  const plotHeight = viewHeight - padTop - padBottom;

  const groupWidth = plotWidth / data.length;
  const innerGroupPad = Math.min(18, groupWidth * 0.18);
  const availBarSpace = Math.max(12, groupWidth - innerGroupPad * 2);
  const barGap = series.length > 1 ? 4 : 0;
  const barWidth = Math.min(28, Math.max(8, (availBarSpace - barGap * (series.length - 1)) / series.length));

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      {(title || series.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            {title && (
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="w-full h-auto min-w-[340px]"
          role="img"
          aria-label={title || 'نمودار ستونی'}
        >
          {/* Horizontal grid lines & right-aligned Persian Y-axis labels */}
          {gridTicks.map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio);
            const val = Math.round(niceMax * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={viewWidth - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-700/70"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={viewWidth - padRight + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px]"
                >
                  {axisFormatter(val)}
                </text>
              </g>
            );
          })}

          {/* Grouped Bars (RTL order: first datum on right or left; left-to-right chronological feels natural for Jalali charts) */}
          {data.map((datum, idx) => {
            const gx = padLeft + idx * groupWidth;
            const totalBarsWidth = barWidth * series.length + barGap * (series.length - 1);
            const startX = gx + (groupWidth - totalBarsWidth) / 2;

            return (
              <g key={`${datum.label}-${idx}`}>
                {series.map((s, sIdx) => {
                  const val = Math.max(0, datum.values[s.key] ?? 0);
                  const ratio = niceMax > 0 ? Math.min(1, val / niceMax) : 0;
                  const h = Math.max(val > 0 ? 3 : 0, ratio * plotHeight);
                  const x = startX + sIdx * (barWidth + barGap);
                  const y = padTop + plotHeight - h;
                  const isActive = hovered?.idx === idx && hovered?.seriesKey === s.key;

                  return (
                    <g
                      key={s.key}
                      onMouseEnter={() => setHovered({ idx, seriesKey: s.key })}
                      onMouseLeave={() => setHovered(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={h}
                        rx={4}
                        fill={s.color}
                        opacity={hovered && !isActive ? 0.65 : 1}
                      >
                        <title>{`${datum.label} — ${s.label}: ${valueFormatter(val)}`}</title>
                      </rect>
                      {isActive && (
                        <text
                          x={x + barWidth / 2}
                          y={Math.max(12, y - 5)}
                          textAnchor="middle"
                          className="fill-slate-900 dark:fill-slate-100 text-[10px] font-bold"
                        >
                          {valueFormatter(val)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={gx + groupWidth / 2}
                  y={padTop + plotHeight + 18}
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-300 text-[11px] font-medium"
                >
                  {datum.label.length > 14 ? `${datum.label.slice(0, 13)}…` : datum.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hovered && data[hovered.idx] && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {data[hovered.idx].label}
          </span>
          <div className="flex flex-wrap items-center gap-3 tabular-nums">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span>{s.label}:</span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {valueFormatter(data[hovered.idx].values[s.key] ?? 0)}
                </strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface SvgDonutChartProps {
  title?: string;
  subtitle?: string;
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  valueFormatter?: (v: number) => string;
}

export const SvgDonutChart: React.FC<SvgDonutChartProps> = ({
  title,
  subtitle,
  slices,
  centerLabel,
  centerValue,
  valueFormatter = (v) => toPersianDigits(v),
}) => {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const size = 176;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between">
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title || 'نمودار دایره‌ای'}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            {total > 0 &&
              slices.map((slice) => {
                const val = Math.max(0, slice.value);
                if (val <= 0) return null;
                const percent = val / total;
                const dashArray = `${percent * circumference} ${circumference}`;
                const dashOffset = -cumulativePercent * circumference;
                cumulativePercent += percent;
                return (
                  <circle
                    key={slice.id}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  >
                    <title>{`${slice.label}: ${valueFormatter(val)} (${toPersianDigits(Math.round(percent * 100))}٪)`}</title>
                  </circle>
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {centerValue}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{centerLabel}</span>
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 space-y-2.5">
          {slices.map((slice) => {
            const pct = total > 0 ? Math.round((Math.max(0, slice.value) / total) * 100) : 0;
            return (
              <div
                key={slice.id}
                className="flex flex-col gap-0.5 text-xs border-b border-slate-100 dark:border-slate-800/80 pb-2 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium truncate">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="truncate">{slice.label}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                    {toPersianDigits(pct)}٪
                  </span>
                </div>
                <div className="tabular-nums font-bold text-slate-900 dark:text-slate-100 text-[12px] pr-4.5 whitespace-nowrap">
                  {valueFormatter(slice.value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface HorizontalBarItem {
  id: string;
  label: string;
  value: number;
  maxValue?: number;
  displayValue?: string;
  subLabel?: string;
  color: string;
}

interface SvgHorizontalBarChartProps {
  title?: string;
  subtitle?: string;
  items: HorizontalBarItem[];
  defaultMax?: number;
  emptyText?: string;
}

export const SvgHorizontalBarChart: React.FC<SvgHorizontalBarChartProps> = ({
  title,
  subtitle,
  items,
  defaultMax = 100,
  emptyText = 'داده‌ای برای نمایش وجود ندارد.',
}) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyText}
      </div>
    );
  }

  const computedMax = Math.max(1, defaultMax, ...items.map((i) => i.maxValue ?? i.value));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const maxForItem = item.maxValue ?? computedMax;
          const pct = Math.max(0, Math.min(100, (item.value / Math.max(1, maxForItem)) * 100));
          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.label}
                  {item.subLabel && (
                    <span className="text-slate-500 dark:text-slate-400 font-normal mr-1.5">
                      · {item.subLabel}
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                  {item.displayValue ?? toPersianDigits(item.value)}
                </span>
              </div>
              <svg
                viewBox="0 0 400 12"
                className="w-full h-3 block"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${item.label}: ${item.displayValue ?? toPersianDigits(item.value)}`}
              >
                <rect
                  x={0}
                  y={0}
                  width={400}
                  height={12}
                  rx={6}
                  className="fill-slate-100 dark:fill-slate-800"
                />
                {/* RTL fill anchored from right edge */}
                <rect
                  x={400 - pct * 4}
                  y={0}
                  width={Math.max(pct > 0 ? 6 : 0, pct * 4)}
                  height={12}
                  rx={6}
                  fill={item.color}
                />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface TrendPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface SvgTrendLineChartProps {
  title?: string;
  subtitle?: string;
  points: TrendPoint[];
  primaryLabel: string;
  primaryColor?: string;
  secondaryLabel?: string;
  secondaryColor?: string;
  minValue?: number;
  maxValue?: number;
  valueFormatter?: (v: number) => string;
  height?: number;
}

export const SvgTrendLineChart: React.FC<SvgTrendLineChartProps> = ({
  title,
  subtitle,
  points,
  primaryLabel,
  primaryColor = '#4f46e5',
  secondaryLabel,
  secondaryColor = '#10b981',
  minValue = 0,
  maxValue = 20,
  valueFormatter = (v) => toPersianDigits(v),
  height = 220,
}) => {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        داده‌ای برای نمایش روند ماهانه موجود نیست.
      </div>
    );
  }

  const viewWidth = 540;
  const viewHeight = height;
  const padTop = 22;
  const padBottom = 36;
  const padLeft = 24;
  const padRight = 46;
  const plotW = viewWidth - padLeft - padRight;
  const plotH = viewHeight - padTop - padBottom;
  const range = Math.max(1, maxValue - minValue);

  const toX = (idx: number) =>
    points.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (points.length - 1)) * plotW;
  const toY = (val: number) =>
    padTop + plotH - ((Math.max(minValue, Math.min(maxValue, val)) - minValue) / range) * plotH;

  const primaryPath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${primaryPath} L ${toX(points.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const hasSecondary = Boolean(secondaryLabel && points.some((p) => typeof p.secondaryValue === 'number'));
  const secondaryPath = hasSecondary
    ? points
        .map(
          (p, idx) =>
            `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(1)} ${toY(p.secondaryValue ?? 0).toFixed(1)}`
        )
        .join(' ')
    : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          {title && (
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
            {primaryLabel}
          </span>
          {hasSecondary && secondaryLabel && (
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-1 rounded-full" style={{ backgroundColor: secondaryColor }} />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="w-full h-auto min-w-[320px]" role="img" aria-label={title || 'نمودار روند'}>
          {yTicks.map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            const val = minValue + range * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={viewWidth - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-700/70"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={viewWidth - padRight + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px]"
                >
                  {valueFormatter(Number(val.toFixed(1)))}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill={primaryColor} opacity={0.1} />}
          <path d={primaryPath} fill="none" stroke={primaryColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {hasSecondary && secondaryPath && (
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={2}
              strokeDasharray="5 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p, idx) => {
            const cx = toX(idx);
            const cy = toY(p.value);
            return (
              <g key={`${p.label}-${idx}`}>
                <circle cx={cx} cy={cy} r={4.5} fill={primaryColor} className="stroke-white dark:stroke-slate-900" strokeWidth={2}>
                  <title>{`${p.label}: ${valueFormatter(p.value)}`}</title>
                </circle>
                <text
                  x={cx}
                  y={cy - 9}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-200 text-[10px] font-bold"
                >
                  {valueFormatter(p.value)}
                </text>
                <text
                  x={cx}
                  y={padTop + plotH + 18}
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-300 text-[11px]"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
