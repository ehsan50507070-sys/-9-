// Dashboard Widget for Add-on 7: Session Media Hub
import React from 'react';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const MediaHubWidget: React.FC = () => {
  const { mediaResources, chatOutbox } = useSchoolData();
  const { navigate } = useRouter();

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              بانک محتوای جلسه
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(mediaResources.length)} منبع آماده نمایش در کلاس
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
          {toPersianDigits(chatOutbox.length)} ارسال کلاسی
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>پاورپوینت، PDF، تصویر، ویس و پیوند امن</span>
        <button
          type="button"
          onClick={() => navigate('/media-hub')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>ورود به بانک محتوا</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
