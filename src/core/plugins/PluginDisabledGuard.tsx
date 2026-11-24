// Non-Destructive Guard Screen when a user visits a disabled or soft-uninstalled add-on route
import React from 'react';
import { ShieldCheck, Power, ArrowRight } from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import { useToast } from '../ui/ToastContext';
import type { PluginRuntimeStatus } from './types';

export const PluginDisabledGuard: React.FC<{ status: PluginRuntimeStatus }> = ({ status }) => {
  const { activeSchool, roleDef, updatePluginState } = useSchoolData();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const handleReEnable = async () => {
    await updatePluginState(status.manifest.id, status.installed ? 'enable' : 'install', false);
    showToast(`بسته الحاقی «${status.manifest.nameFa}» مجدداً فعال شد و تمام اطلاعات بازیابی گردید.`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-right">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
          بسته الحاقی «{status.manifest.nameFa}» غیرفعال است
        </h1>

        <p className="mt-3 text-sm sm:text-base leading-7 text-slate-600 dark:text-slate-300">
          بسته الحاقی {status.manifest.nameFa} در این مدرسه غیرفعال است؛ تمام اطلاعات ثبت‌شده شما
          به‌صورت کامل محفوظ است و پس از فعال‌سازی مجدد دوباره در دسترس خواهد بود.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
          <span>مدرسه فعال: {activeSchool.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {toPersianDigits(status.preservedRecordCount)} رکورد محفوظ در حافظه
          </span>
          <span aria-hidden="true">·</span>
          <span>وضعیت: {status.installed ? 'غیرفعال‌شده' : 'حذف‌شده از پنل مدرسه (با حفظ داده‌ها)'}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {roleDef.canManageAddons && (
            <button
              type="button"
              onClick={() => void handleReEnable()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
            >
              <Power className="w-4 h-4" />
              فعالسازی مجدد
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/addons')}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium px-4 py-2.5 transition-colors"
          >
            مدیریت بسته‌های الحاقی
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به داشبورد
          </button>
        </div>
      </div>
    </div>
  );
};
