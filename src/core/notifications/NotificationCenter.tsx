// Step 3: Internal Notification Center Popover (Header Bell + Functional Pulsing Red Dot + Teacher Homework Tracker)
import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  MessageSquare,
  Megaphone,
  Users,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import { buildSubjectRoute } from '../subjects/subjectHelpers';
import type { InternalNotificationItem } from './notificationHelpers';

export const NotificationCenter: React.FC = () => {
  const {
    activeRole,
    notificationCenter,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSchoolData();
  const { navigate } = useRouter();

  const [open, setOpen] = useState(false);
  const [expandedTrackerId, setExpandedTrackerId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const count = notificationCenter.totalUnreadCount;
  const hasUnread = count > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleItemClick = (item: InternalNotificationItem) => {
    if (item.canDismissByRead && item.readReceiptKey) {
      markNotificationRead(item.readReceiptKey);
    }
    setOpen(false);
    navigate(item.route);
  };

  const renderIcon = (kind: InternalNotificationItem['kind']) => {
    if (kind === 'homework_pending' || kind === 'teacher_homework_progress') {
      return <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
    }
    if (kind === 'parent_message' || kind === 'class_message') {
      return <MessageSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />;
    }
    return <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />;
  };

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          hasUnread
            ? `اعلان‌های داخلی (${toPersianDigits(count)} مورد خوانده‌نشده)`
            : 'اعلان‌های داخلی'
        }
        aria-expanded={open}
        title="مرکز اعلان‌های داخلی"
        className="relative min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {/* Functional Pulsing Red Dot ONLY when real unread/unsubmitted notifications exist */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex items-center justify-center rounded-full bg-rose-600 px-1 h-4 min-w-[16px] text-[10px] font-bold text-white tabular-nums">
              {toPersianDigits(count > 99 ? '99+' : count)}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="مرکز اعلان‌های داخلی"
          className="fixed sm:absolute left-2 right-2 sm:right-auto sm:left-0 top-16 sm:top-full sm:mt-2 sm:w-[400px] max-h-[80vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden"
        >
          {/* Popover Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>مرکز اعلان‌های داخلی</span>
                {hasUnread && (
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                    {toPersianDigits(count)} فعال
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                تکالیف ارسال‌نشده تا زمان تحویل فعال می‌مانند
              </div>
            </div>

            {notificationCenter.items.some((i) => i.canDismissByRead && i.readReceiptKey) && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold brand-text hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                خواندم
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notificationCenter.items.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                همه اعلان‌ها و تکالیف شما به‌روز است؛ مورد خوانده‌نشده‌ای وجود ندارد.
              </div>
            ) : (
              notificationCenter.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="w-full px-4 py-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3"
                >
                  <div className="mt-0.5 relative">
                    {renderIcon(item.kind)}
                    {item.urgent && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-5">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-5">
                      {item.detail}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {toPersianDigits(item.jalaliDate)}
                    </div>
                  </div>
                </button>
              ))
            )}

            {/* Smart Teacher Homework Submission Tracker */}
            {(activeRole === 'teacher' || activeRole === 'principal' || activeRole === 'deputy') &&
              notificationCenter.teacherHomeworkTrackers.length > 0 && (
                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 px-1">
                    <Users className="w-3.5 h-3.5 brand-text" />
                    پیگیری هوشمند تحویل تکالیف کلاس‌ها
                  </div>
                  {notificationCenter.teacherHomeworkTrackers.slice(0, 5).map((tracker) => {
                    const isExpanded = expandedTrackerId === tracker.assignmentId;
                    return (
                      <div
                        key={tracker.assignmentId}
                        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 space-y-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTrackerId(isExpanded ? null : tracker.assignmentId)
                          }
                          className="w-full flex items-center justify-between gap-2 text-right"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {tracker.title} ({tracker.subject})
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {tracker.className} · تحویل:{' '}
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                {toPersianDigits(tracker.submittedStudents.length)}
                              </span>{' '}
                              · باقی‌مانده:{' '}
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                {toPersianDigits(tracker.missingStudents.length)}
                              </span>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <div>
                              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                                تحویل‌دادگان ({toPersianDigits(tracker.submittedStudents.length)}):
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-5">
                                {tracker.submittedStudents.length > 0
                                  ? tracker.submittedStudents.map((s) => s.fullName).join('، ')
                                  : 'هنوز موردی ثبت نشده است.'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1">
                                ارسال‌نکرده‌اند ({toPersianDigits(tracker.missingStudents.length)}):
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-5">
                                {tracker.missingStudents.length > 0
                                  ? tracker.missingStudents.map((s) => s.fullName).join('، ')
                                  : 'همه دانش‌آموزان ارسال کرده‌اند.'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                navigate(buildSubjectRoute(tracker.subject, 'homework'));
                              }}
                              className="text-[11px] font-bold brand-text hover:underline"
                            >
                              مشاهده صفحه درس {tracker.subject} ←
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
