// Dashboard Widget for Phase 3 Plugin: Online Classroom Manager («مدیریت کلاس آنلاین»)
import React from 'react';
import { ArrowLeft, Video } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';

export const OnlineClassroomWidget: React.FC = () => {
  const { onlineClassSessions, onlineClassAttendance } = useSchoolData();
  const { navigate } = useRouter();

  const liveCount = onlineClassSessions.filter((s) => s.status === 'live').length;
  const presentRecords = onlineClassAttendance.filter((a) => a.status !== 'absent').length;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              مدیریت کلاس آنلاین
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(onlineClassSessions.length)} جلسه · {toPersianDigits(presentRecords)} حضور ثبت‌شده
            </p>
          </div>
        </div>
        {liveCount > 0 && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {toPersianDigits(liveCount)} در حال برگزاری
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>شاد، اسکایروم و ادوبی کانکت با ثبت حضور خودکار</span>
        <button
          type="button"
          onClick={() => navigate('/online-classroom')}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>مدیریت جلسات</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
