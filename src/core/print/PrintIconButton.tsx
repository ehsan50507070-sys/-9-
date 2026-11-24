// Unified Compact Printer Icon Button (Opens A4/A5 Paper Size Chooser -> PrintPreviewPortal)
import React from 'react';
import { Printer } from 'lucide-react';
import { usePrintEngine } from './PrintPreviewPortal';
import type { PrintPaperSize } from './printService';

export interface PrintIconButtonProps {
  /** Use landscape orientation by default for wide tables like Timetable or Staff Attendance. */
  landscape?: boolean;
  /** Compact icon button sizing for dense table rows or modal toolbars. */
  compact?: boolean;
  /** Optional Persian document title shown in the chooser, preview header, and tooltip. */
  documentLabel?: string;
  /** Optional custom handler; called after user chooses A4 or A5 in the paper-size modal. */
  onPrint?: (size: PrintPaperSize) => void;
  /** Optional hook executed right before capturing printable content. */
  onBeforePrint?: (size: PrintPaperSize) => void;
  /** Optional explicit HTML string to print instead of active DOM capture. */
  html?: string;
  /** Optional CSS selector to capture a specific element. */
  targetSelector?: string;
  /** Override automatic school header inclusion. */
  includeHeader?: boolean;
  /** Override automatic signature footer inclusion. */
  includeFooter?: boolean;
  /** Disable button when nothing printable is available. */
  disabled?: boolean;
  className?: string;
}

export const PrintIconButton: React.FC<PrintIconButtonProps> = ({
  landscape = false,
  compact = false,
  documentLabel,
  onPrint,
  onBeforePrint,
  html,
  targetSelector,
  includeHeader,
  includeFooter,
  disabled = false,
  className = '',
}) => {
  const { openSizeChooser } = usePrintEngine();

  const tooltip = documentLabel ? `چاپ ${documentLabel}` : 'چاپ';

  const handleClick = () => {
    if (disabled) return;
    openSizeChooser({
      documentLabel,
      landscape,
      html,
      targetSelector,
      includeHeader,
      includeFooter,
      onPrint,
      onBeforePrint,
    });
  };

  const sizeClass = compact ? 'h-9 w-9 rounded-xl' : 'h-10 w-10 rounded-xl';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title={tooltip}
      aria-label={tooltip}
      data-print-trigger="true"
      className={`no-print inline-flex shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-300 ${sizeClass} ${className}`}
    >
      <Printer className={compact ? 'h-4 w-4 shrink-0' : 'h-4.5 w-4.5 shrink-0'} />
    </button>
  );
};

export default PrintIconButton;
