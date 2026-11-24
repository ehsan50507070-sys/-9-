// Top-Left Quick Appearance Popover — Minimal Eye-Friendly Light / Dark Mode Switch Only
// (No standalone appearance page; calm slate-navy branding & standard readable typography are built-in)
import React, { useEffect, useRef, useState } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { useAppearance } from './AppearanceContext';

export const QuickAppearancePopover: React.FC = () => {
  const { appearance, updateAppearance } = useAppearance();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const isDark = appearance.themeMode === 'dark';

  const handleModeChange = (mode: 'light' | 'dark') => {
    updateAppearance({ themeMode: mode });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="quick-appearance-btn"
        aria-label="تنظیمات ظاهر (روشن / شب)"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="تنظیمات ظاهر (روشن / شب)"
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
          open
            ? 'brand-soft-badge border-current'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="تنظیمات حالت نمایش"
          data-testid="quick-appearance-popover"
          className="absolute left-0 top-full z-50 mt-2 w-[236px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
              حالت نمایش سامانه
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن پنجره ظاهر"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              data-appearance-mode="light"
              onClick={() => handleModeChange('light')}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold transition-colors ${
                !isDark
                  ? 'brand-btn border-transparent shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Sun className="h-4 w-4 shrink-0" />
              <span>حالت روشن</span>
            </button>

            <button
              type="button"
              data-appearance-mode="dark"
              onClick={() => handleModeChange('dark')}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold transition-colors ${
                isDark
                  ? 'brand-btn border-transparent shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Moon className="h-4 w-4 shrink-0" />
              <span>حالت شب</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
