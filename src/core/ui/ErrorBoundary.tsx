// React ErrorBoundary with 1-click recovery & safe storage reset
import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { sharedRepository } from '../data/LocalIndexedDBAdapter';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'خطای غیرمنتظره در اجرای سامانه رخ داد.',
    };
  }

  public componentDidCatch(error: Error): void {
    // Keep console diagnostic clean and informative
    console.error('[SmartSchool ErrorBoundary]', error);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.hash = '#/';
    window.location.reload();
  };

  private handleFactoryReset = async (): Promise<void> => {
    try {
      await sharedRepository.resetToSeed();
      window.localStorage.removeItem('smart_school_ui_prefs_v1');
    } catch {
      // ignore storage errors
    }
    this.setState({ hasError: false, errorMessage: '' });
    window.location.hash = '#/';
    window.location.reload();
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6"
      >
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-right">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              بازیابی خودکار سامانه
            </h1>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            مشکلی در نمایش این بخش پیش آمد. داده‌های ذخیره‌شده شما محفوظ است و می‌توانید با یک کلیک
            سامانه را بازیابی کنید.
          </p>
          <div className="mt-3 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 font-mono dir-ltr text-left break-words">
            {this.state.errorMessage}
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              تلاش مجدد و بازگشت به داشبورد
            </button>
            <button
              type="button"
              onClick={() => void this.handleFactoryReset()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium px-4 py-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              بازنشانی داده‌های نمونه
            </button>
          </div>
        </div>
      </div>
    );
  }
}
