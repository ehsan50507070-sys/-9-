// Dashboard Summary Widget for Private Parent-Staff Chat (Hidden from student role)
import React from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const ParentStaffChatWidget: React.FC = () => {
  const { activeRole, parentStaffMessages, unreadParentChatCount } = useSchoolData();
  const { navigate } = useRouter();

  if (activeRole === 'student') return null;

  const latest = parentStaffMessages[parentStaffMessages.length - 1];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              گفت‌وگوی اختصاصی اولیا
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {toPersianDigits(parentStaffMessages.length)} پیام ثبت‌شده
            </p>
          </div>
        </div>
        {unreadParentChatCount > 0 && (
          <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-bold tabular-nums">
            {toPersianDigits(unreadParentChatCount)} جدید
          </span>
        )}
      </div>

      {latest ? (
        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 line-clamp-2">
          <span className="font-bold text-slate-800 dark:text-slate-100">{latest.senderName}: </span>
          {latest.text}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          کانال ارتباطی مستقیم اولیا با معلم کلاس و مدیریت مدرسه آماده پاسخ‌گویی است.
        </p>
      )}

      <button
        type="button"
        onClick={() => navigate('/parent-staff-chat')}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold whitespace-nowrap transition-colors"
      >
        <span>ورود به صندوق گفت‌وگو</span>
        <ArrowLeft className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
};
