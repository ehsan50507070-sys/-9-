// Phase 9-C: Custom Pure-SVG Discipline Score Trend Chart (Zero External Libraries)
import React, { useMemo, useState } from 'react';
import { toPersianDigits } from '../../lib/digits';
import type { DisciplineTrendPoint } from '../../services/phase9c/disciplineService';

interface DisciplineTrendChartSvgProps {
  points: DisciplineTrendPoint[];
}

export const DisciplineTrendChartSvg: React.FC<DisciplineTrendChartSvgProps> = ({ points }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const width = 560;
  const height = 210;
  const padLeft = 42;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const coords = useMemo(() => {
    const count = Math.max(points.length, 1);
    return points.map((pt, idx) => {
      // RTL chronological flow: oldest on right -> newest on left, or left-to-right?
      // Standard chronological chart in Persian UI: oldest on right (padLeft + plotW) to newest on left (padLeft),
      // OR left-to-right with clear labels. Left-to-right is universally intuitive on X-axis charts; let's render clean left-to-right.
      const x =
        count === 1
          ? padLeft + plotW / 2
          : padLeft + (idx / (count - 1)) * plotW;
      const clampedScore = Math.max(0, Math.min(20, pt.score));
      const y = padTop + ((20 - clampedScore) / 20) * plotH;
      return { pt, x, y, idx };
    });
  }, [points, plotW, plotH]);

  const polylinePoints = useMemo(
    () => coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
    [coords]
  );

  const areaPath = useMemo(() => {
    if (coords.length === 0) return '';
    const first = coords[0];
    const last = coords[coords.length - 1];
    const baseY = padTop + plotH;
    const linePart = coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    return `M ${first.x.toFixed(1)} ${baseY} ${linePart} L ${last.x.toFixed(1)} ${baseY} Z`;
  }, [coords, plotH]);

  const gridTicks = [20, 17, 14, 10, 0];
  const activeCoord = activeIdx !== null ? coords[activeIdx] : coords[coords.length - 1] ?? null;

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[320px] select-none"
          role="img"
          aria-label="نمودار روند نمره انضباط در طول سال تحصیلی"
        >
          <defs>
            <linearGradient id="discTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {gridTicks.map((tick) => {
            const y = padTop + ((20 - tick) / 20) * plotH;
            const isThreshold = tick === 14;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={isThreshold ? '#f43f5e' : 'currentColor'}
                  strokeOpacity={isThreshold ? 0.35 : 0.14}
                  strokeDasharray={isThreshold ? '4 4' : tick === 0 ? undefined : '2 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
                >
                  {toPersianDigits(tick)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {coords.length > 1 && <path d={areaPath} fill="url(#discTrendFill)" />}

          {/* Trend Line */}
          {coords.length > 1 && (
            <polyline
              fill="none"
              stroke="#0284c7"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />
          )}

          {/* Data Points */}
          {coords.map((c) => {
            const fill =
              c.pt.kind === 'reward'
                ? '#10b981'
                : c.pt.kind === 'infraction'
                  ? '#e11d48'
                  : '#0284c7';
            const isSelected = activeCoord?.idx === c.idx;
            const showLabel =
              coords.length <= 6 ||
              c.idx === 0 ||
              c.idx === coords.length - 1 ||
              c.idx % Math.ceil(coords.length / 5) === 0;

            return (
              <g
                key={c.pt.id}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIdx(c.idx)}
                onClick={() => setActiveIdx(c.idx)}
              >
                {isSelected && (
                  <circle cx={c.x} cy={c.y} r={9} fill={fill} fillOpacity={0.18} />
                )}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 5.2 : 4}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={1.8}
                />
                {showLabel && (
                  <text
                    x={c.x}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-slate-500 text-[9.5px] dark:fill-slate-400"
                  >
                    {toPersianDigits(
                      c.pt.jalaliDate.length > 8 ? c.pt.jalaliDate.slice(5) : c.pt.jalaliDate
                    )}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Point Detail Strip */}
      {activeCoord && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {activeCoord.pt.title}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              ({toPersianDigits(activeCoord.pt.jalaliDate)})
            </span>
          </div>
          <div className="flex items-center gap-3 tabular-nums">
            {activeCoord.pt.kind !== 'base' && (
              <span
                className={
                  activeCoord.pt.kind === 'reward'
                    ? 'font-bold text-emerald-700 dark:text-emerald-400'
                    : 'font-bold text-rose-700 dark:text-rose-400'
                }
              >
                {activeCoord.pt.kind === 'reward' ? '+' : '−'}
                {toPersianDigits(Math.abs(activeCoord.pt.delta))}
              </span>
            )}
            <span className="font-bold text-slate-900 dark:text-slate-100">
              نمره: {toPersianDigits(activeCoord.pt.score)} از ۲۰
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
