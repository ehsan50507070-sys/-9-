// Reusable Minimal Custom SVG Empty State Illustrations & Refined Visual Helpers
// Zero external dependencies; designed for Light & Dark modes with calm slate-navy & muted gold palette.
import React from 'react';

export type EmptyStateVariant = 'records' | 'security' | 'analytics' | 'messages' | 'search';

export interface EmptyStateSvgProps {
  variant?: EmptyStateVariant;
  titleFa: string;
  descriptionFa?: string;
  action?: React.ReactNode;
  className?: string;
}

const Illustration: React.FC<{ variant: EmptyStateVariant }> = ({ variant }) => {
  if (variant === 'security') {
    return (
      <svg viewBox="0 0 96 96" className="w-20 h-20 mx-auto" aria-hidden="true">
        <circle cx="48" cy="48" r="40" className="fill-slate-100 dark:fill-slate-800/80" />
        <path
          d="M48 18 L70 27 V46 C70 61 60.5 72.5 48 77 C35.5 72.5 26 61 26 46 V27 Z"
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="2.5"
        />
        <path
          d="M39 48 L45 54 L58 41"
          fill="none"
          stroke="#2B5B84"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === 'analytics') {
    return (
      <svg viewBox="0 0 96 96" className="w-20 h-20 mx-auto" aria-hidden="true">
        <circle cx="48" cy="48" r="40" className="fill-slate-100 dark:fill-slate-800/80" />
        <rect x="24" y="54" width="10" height="18" rx="3" fill="#94A3B8" fillOpacity="0.6" />
        <rect x="43" y="42" width="10" height="30" rx="3" fill="#2B5B84" fillOpacity="0.8" />
        <rect x="62" y="30" width="10" height="42" rx="3" fill="#B8922E" fillOpacity="0.85" />
        <path
          d="M22 72 H74"
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === 'messages') {
    return (
      <svg viewBox="0 0 96 96" className="w-20 h-20 mx-auto" aria-hidden="true">
        <circle cx="48" cy="48" r="40" className="fill-slate-100 dark:fill-slate-800/80" />
        <rect
          x="22"
          y="28"
          width="52"
          height="36"
          rx="10"
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="2.4"
        />
        <path
          d="M32 42 H64 M32 51 H52"
          stroke="#2B5B84"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M38 64 L32 73 L46 64"
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === 'search') {
    return (
      <svg viewBox="0 0 96 96" className="w-20 h-20 mx-auto" aria-hidden="true">
        <circle cx="48" cy="48" r="40" className="fill-slate-100 dark:fill-slate-800/80" />
        <circle
          cx="44"
          cy="44"
          r="16"
          className="fill-white dark:fill-slate-900 stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="3"
        />
        <path
          d="M56 56 L69 69"
          stroke="#2B5B84"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 96" className="w-20 h-20 mx-auto" aria-hidden="true">
      <circle cx="48" cy="48" r="40" className="fill-slate-100 dark:fill-slate-800/80" />
      <rect
        x="26"
        y="22"
        width="44"
        height="52"
        rx="8"
        className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="2.4"
      />
      <path
        d="M35 37 H61 M35 47 H61 M35 57 H50"
        stroke="#2B5B84"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="62" cy="60" r="5" fill="#D4AF37" fillOpacity="0.85" />
    </svg>
  );
};

export const EmptyStateSvg: React.FC<EmptyStateSvgProps> = ({
  variant = 'records',
  titleFa,
  descriptionFa,
  action,
  className = '',
}) => (
  <div
    className={`rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50 px-5 py-8 text-center transition-colors duration-150 ${className}`}
  >
    <Illustration variant={variant} />
    <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">{titleFa}</h3>
    {descriptionFa && (
      <p className="mt-1.5 max-w-md mx-auto text-xs leading-6 text-slate-500 dark:text-slate-400">
        {descriptionFa}
      </p>
    )}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);
