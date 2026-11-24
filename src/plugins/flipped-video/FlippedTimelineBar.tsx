// Pure SVG/CSS Color-Coded Timeline Bar («نوار خط‌زمانی رنگی») with Clickable Question Pins
import React from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type { FlippedSecondWatchState, FlippedTimestampQuestion } from '../../types/domain';
import { formatMmSs } from './flippedVideoHelpers';

interface FlippedTimelineBarProps {
  durationSeconds: number;
  secondStates: Record<string, FlippedSecondWatchState>;
  questions: FlippedTimestampQuestion[];
  selectedQuestionId?: string | null;
  onSelectQuestion?: (question: FlippedTimestampQuestion) => void;
  compact?: boolean;
  label?: string;
}

const STATE_COLOR: Record<FlippedSecondWatchState, string> = {
  normal: '#16a34a', // Green = سرعت عادی (1x)
  fast: '#d97706', // Amber/Orange = سرعت بالا (>1x)
  unwatched: '#cbd5e1', // Gray = دیده‌نشده
};

export const FlippedTimelineBar: React.FC<FlippedTimelineBarProps> = ({
  durationSeconds,
  secondStates,
  questions,
  selectedQuestionId,
  onSelectQuestion,
  compact = false,
  label,
}) => {
  const safeDuration = Math.max(1, Math.floor(durationSeconds));

  // Compress contiguous identical seconds into SVG <rect> runs for ultra-crisp rendering even on long videos
  const segments: Array<{ start: number; length: number; state: FlippedSecondWatchState }> = [];
  for (let s = 0; s < safeDuration; s++) {
    const st: FlippedSecondWatchState = secondStates[String(s)] ?? 'unwatched';
    const last = segments[segments.length - 1];
    if (last && last.state === st) {
      last.length++;
    } else {
      segments.push({ start: s, length: 1, state: st });
    }
  }

  return (
    <div className="space-y-1.5" dir="ltr">
      {label && (
        <div dir="rtl" className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold">{label}</span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            ۰۰:۰۰ تا {formatMmSs(safeDuration)}
          </span>
        </div>
      )}

      <div className="relative pt-5 pb-1">
        {/* Clickable Question Pins positioned over exact timestamp */}
        {questions.map((q) => {
          const pct = Math.min(98, Math.max(2, (q.timestampSecond / safeDuration) * 100));
          const isSelected = selectedQuestionId === q.id;
          const isResolved = Boolean(q.teacherReply);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQuestion?.(q)}
              style={{ left: `${pct}%` }}
              title={`${formatMmSs(q.timestampSecond)} — ${q.studentName}: ${q.questionText}`}
              aria-label={`سوال ${q.studentName} در زمان ${formatMmSs(q.timestampSecond)}`}
              className={`absolute top-0 -translate-x-1/2 z-10 inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isSelected
                  ? 'bg-indigo-600 text-white scale-125'
                  : isResolved
                  ? 'bg-sky-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              <MessageCircleQuestion className="w-3 h-3" />
            </button>
          );
        })}

        {/* Pure SVG Second-by-Second Color Bar */}
        <svg
          viewBox={`0 0 ${safeDuration} ${compact ? 10 : 14}`}
          preserveAspectRatio="none"
          className={`w-full ${compact ? 'h-3' : 'h-4'} rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800`}
          role="img"
          aria-label="نوار خط‌زمانی رنگی وضعیت تماشای ویدیو"
        >
          {segments.map((seg) => (
            <rect
              key={`${seg.start}-${seg.state}`}
              x={seg.start}
              y={0}
              width={seg.length + 0.08}
              height={compact ? 10 : 14}
              fill={STATE_COLOR[seg.state]}
            />
          ))}
        </svg>

        {/* Time ticks */}
        {!compact && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-1">
            <span>{toPersianDigits('00:00')}</span>
            <span>{formatMmSs(Math.floor(safeDuration * 0.25))}</span>
            <span>{formatMmSs(Math.floor(safeDuration * 0.5))}</span>
            <span>{formatMmSs(Math.floor(safeDuration * 0.75))}</span>
            <span>{formatMmSs(safeDuration)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
