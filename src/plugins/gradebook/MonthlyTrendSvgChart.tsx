// Pure Native SVG Monthly Grade Trend Chart (Zero external chart libraries)
import React from 'react';
import { toPersianDigits } from '../../lib/digits';
import type { MonthlyTrendPoint } from './gradebookHelpers';

interface MonthlyTrendSvgChartProps {
  points: MonthlyTrendPoint[];
  studentName: string;
  subject: string;
}

export const MonthlyTrendSvgChart: React.FC<MonthlyTrendSvgChartProps> = ({
  points,
  studentName,
  subject,
}) => {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
        هنوز نمره عددی ماهانه‌ای برای ترسیم نمودار روند پیشرفت {studentName} در درس {subject} ثبت
        نشده است.
      </div>
    );
  }

  const width = 560;
  const height = 220;
  const padLeft = 42;
  const padRight = 28;
  const padTop = 24;
  const padBottom = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yLevels = [0, 5, 10, 15, 20];
  const scoreToY = (score: number) => {
    const clamped = Math.max(0, Math.min(20, score));
    return padTop + plotH - (clamped / 20) * plotH;
  };

  const coords = points.map((pt, idx) => {
    const x =
      points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (points.length - 1)) * plotW;
    const y = scoreToY(pt.score);
    return { ...pt, x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const delta =
    points.length >= 2
      ? Math.round((points[points.length - 1].score - points[0].score) * 100) / 100
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-800 dark:text-slate-200">
          نمودار روند ماهانه نمره ({subject}) — {studentName}
        </span>
        {points.length >= 2 && (
          <span
            className={`font-bold tabular-nums ${
              delta >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {delta > 0
              ? `▲ رشد ${toPersianDigits(delta.toFixed(2))} نمره نسبت به ماه اول`
              : delta < 0
                ? `▼ افت ${toPersianDigits(Math.abs(delta).toFixed(2))} نمره نسبت به ماه اول`
                : '● روند پایدار'}
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`نمودار روند ماهانه نمرات ${studentName} در درس ${subject}`}
          className="w-full h-auto min-w-[320px] max-h-[240px]"
        >
          <defs>
            <linearGradient id="gradeTrendAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Y-axis gridlines & labels */}
          {yLevels.map((lvl) => {
            const y = scoreToY(lvl);
            return (
              <g key={lvl}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray={lvl === 0 ? undefined : '4 4'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="currentColor"
                  className="text-slate-400 dark:text-slate-500"
                >
                  {toPersianDigits(lvl)}
                </text>
              </g>
            );
          })}

          {/* Shaded area under curve */}
          {areaPath && <path d={areaPath} fill="url(#gradeTrendAreaFill)" />}

          {/* Primary trend line */}
          {coords.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data point nodes + value labels + month axis labels */}
          {coords.map((c) => (
            <g key={c.month}>
              <circle
                cx={c.x}
                cy={c.y}
                r={5.5}
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth={3}
              />
              <text
                x={c.x}
                y={c.y - 11}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="currentColor"
                className="text-slate-800 dark:text-slate-100"
              >
                {toPersianDigits(c.score)}
              </text>
              <text
                x={c.x}
                y={height - 12}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="currentColor"
                className="text-slate-600 dark:text-slate-300"
              >
                {c.month}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
