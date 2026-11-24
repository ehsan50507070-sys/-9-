// Private Parent-Staff Chat Page (Phase 3.5 Non-Destructive Plugin)
// Strictly hidden from `student` role. Private 1-on-1 channels linked to studentId.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Copy,
  Filter,
  Lock,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { copyTextToClipboard } from '../../lib/messenger';
import { toPersianDigits } from '../../lib/digits';
import {
  buildParentChatThreads,
  formatChatSummaryMessenger,
  PARENT_CHAT_ROLE_LABELS,
  PARENT_STARTER_PHRASES,
  STAFF_STARTER_PHRASES,
  type ParentChatThreadSummary,
} from './parentChatHelpers';

export const ParentStaffChatPage: React.FC = () => {
  const {
    session,
    activeRole,
    activeSchool,
    classes,
    students,
    teachers,
    teacherNameById,
    linkedStudent,
    parentStaffMessages,
    sendParentStaffMessage,
    markParentChatThreadRead,
  } = useSchoolData();

  const [selectedThreadKey, setSelectedThreadKey] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draftText, setDraftText] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isParent = activeRole === 'parent';
  const isTeacher = activeRole === 'teacher';
  const isManagement =
    activeRole === 'principal' || activeRole === 'deputy' || activeRole === 'complex_admin';

  const allThreads = useMemo(
    () =>
      buildParentChatThreads({
        role: activeRole,
        messages: parentStaffMessages,
        students,
        classes,
        teachers,
        teacherNameById,
        principalName: activeSchool.principalName,
        linkedStudent,
      }),
    [
      activeRole,
      parentStaffMessages,
      students,
      classes,
      teachers,
      teacherNameById,
      activeSchool.principalName,
      linkedStudent,
    ]
  );

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allThreads.filter((th) => {
      if (classFilter !== 'all' && th.classId !== classFilter) return false;
      if (!q) return true;
      return (
        th.studentName.toLowerCase().includes(q) ||
        th.parentName.toLowerCase().includes(q) ||
        th.className.toLowerCase().includes(q) ||
        th.counterpartName.toLowerCase().includes(q)
      );
    });
  }, [allThreads, classFilter, searchQuery]);

  // Keep a valid active thread selected
  const activeThread: ParentChatThreadSummary | null = useMemo(() => {
    if (filteredThreads.length === 0) return null;
    return filteredThreads.find((t) => t.threadKey === selectedThreadKey) ?? filteredThreads[0];
  }, [filteredThreads, selectedThreadKey]);

  useEffect(() => {
    if (activeThread && activeThread.threadKey !== selectedThreadKey) {
      setSelectedThreadKey(activeThread.threadKey);
    }
  }, [activeThread, selectedThreadKey]);

  // Mark active thread messages as read automatically when viewed
  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    markParentChatThreadRead(activeThread.studentId, activeThread.channelType);
  }, [activeThread, markParentChatThreadRead]);

  // Scroll smoothly to latest message when thread changes or new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeThread?.threadKey, activeThread?.messages.length]);

  // Strict hard guard: never render anything for `student` role
  if (!session || activeRole === 'student') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center">
        <Lock className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          دسترسی غیرمجاز
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          این بخش ویژه ارتباط خصوصی اولیا با معلم و مدیر مدرسه است و برای حساب دانش‌آموز در دسترس نیست.
        </p>
      </div>
    );
  }

  const starterPhrases = isParent ? PARENT_STARTER_PHRASES : STAFF_STARTER_PHRASES;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);
    if (!activeThread) return;

    const res = sendParentStaffMessage({
      studentId: activeThread.studentId,
      classId: activeThread.classId,
      channelType: activeThread.channelType,
      targetTeacherId: activeThread.targetTeacherId,
      text: draftText,
    });

    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ارسال پیام با خطا مواجه شد.');
      return;
    }

    setDraftText('');
    setFeedbackMsg('پیام شما با موفقیت ارسال و ذخیره شد.');
    setTimeout(() => setFeedbackMsg(null), 2600);
  };

  const handleCopySummary = async () => {
    if (!activeThread) return;
    const summary = formatChatSummaryMessenger({
      schoolName: activeSchool.name,
      thread: activeThread,
    });
    const ok = await copyTextToClipboard(summary);
    if (ok) {
      setCopiedId(activeThread.threadKey);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const roleBadgeClass = (role: Exclude<typeof activeRole, 'student'>) => {
    switch (role) {
      case 'parent':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
      case 'teacher':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
      case 'principal':
      case 'complex_admin':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
      case 'deputy':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
    }
  };

  const totalUnread = allThreads.reduce((acc, t) => acc + t.unreadCount, 0);

  return (
    <PrintShell
      school={activeSchool}
      documentTitle="سوابق گفت‌وگوی اختصاصی اولیا با معلم و مدیر"
      subtitle={
        activeThread
          ? `${activeThread.channelLabelFa} · دانش‌آموز: ${activeThread.studentName} (${activeThread.className})`
          : activeSchool.name
      }
    >
      <div className="space-y-4">
        {/* Top Page Header */}
        <section className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  گفت‌وگوی اختصاصی اولیا با معلم و مدیر
                </h1>
                {totalUnread > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 tabular-nums">
                    {toPersianDigits(totalUnread)} پیام خوانده‌نشده
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isParent
                  ? `ارتباط مستقیم، خصوصی و مستند ولی ${linkedStudent?.fullName ?? ''} با معلم کلاس و مدیر مدرسه (محرمانه و پنهان از حساب دانش‌آموز)`
                  : isTeacher
                  ? 'صندوق پیام‌های خصوصی اولیای کلاس‌های محول‌شده به شما — هر گفت‌وگو اختصاصی همان دانش‌آموز است.'
                  : 'صندوق پیام‌های خصوصی اولیا خطاب به مدیریت مدرسه با قابلیت فیلتر کلاس، کپی تک‌ستونی و چاپ A4 / A5'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!activeThread}
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
              >
                {copiedId === activeThread?.threadKey ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>خلاصه مکالمه کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>کپی برای ایتا / بله / شاد</span>
                  </>
                )}
              </button>
              <PrintButtons
                disabled={!activeThread}
                documentLabel="مکالمه اختصاصی اولیا"
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
            <div className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>محرمانگی کامل: پیام‌ها کاملاً ایزوله به مدرسه و دانش‌آموز بوده و برای حساب دانش‌آموز قابل مشاهده نیستند.</span>
            </div>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              همگام‌سازی زنده بین زبانه‌های مرورگر فعال است
            </span>
          </div>
        </section>

        {/* Main Split-Pane Messenger Workspace (Screen View) */}
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Threads Sidebar */}
          <aside className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isParent ? 'کانال‌های ارتباطی شما' : 'صندوق گفت‌وگوهای اولیا'}</span>
                </h2>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {toPersianDigits(filteredThreads.length)} مورد
                </span>
              </div>

              {!isParent && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="جستجوی نام دانش‌آموز یا ولی..."
                      className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {(isManagement || classes.length > 1) && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                      <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        aria-label="فیلتر کلاس"
                        className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
                      >
                        <option value="all">همه کلاس‌ها ({toPersianDigits(classes.length)})</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
              {filteredThreads.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  گفت‌وگویی با این فیلتر یافت نشد.
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = activeThread?.threadKey === thread.threadKey;
                  return (
                    <button
                      key={thread.threadKey}
                      type="button"
                      onClick={() => setSelectedThreadKey(thread.threadKey)}
                      className={`w-full text-right p-3.5 transition-colors flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/50'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {isParent ? thread.channelLabelFa : thread.studentName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {isParent
                              ? thread.counterpartName
                              : `ولی: ${thread.parentName}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {thread.unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold tabular-nums">
                              {toPersianDigits(thread.unreadCount)} جدید
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate">
                          {thread.className}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                          {thread.lastMessage
                            ? `${toPersianDigits(thread.lastMessage.jalaliDate)} · ${toPersianDigits(
                                thread.lastMessage.timeText
                              )}`
                            : 'بدون پیام'}
                        </span>
                      </div>

                      {thread.lastMessage && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                          {thread.lastMessage.text}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Active Conversation Window */}
          <section className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-[540px]">
            {!activeThread ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  یک گفت‌وگو را از فهرست انتخاب کنید
                </p>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {isParent
                          ? `${activeThread.channelLabelFa} (${activeThread.counterpartName})`
                          : `${activeThread.studentName} — ${activeThread.counterpartName}`}
                      </h2>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200">
                        {activeThread.className}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeThread.channelType === 'teacher'
                        ? 'کانال اختصاصی ولی و معلم کلاس'
                        : 'کانال اختصاصی ولی و مدیریت مدرسه'}
                      {' · '}
                      {toPersianDigits(activeThread.messages.length)} پیام ثبت‌شده
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50">
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>مکالمه اختصاصی ۱ به ۱</span>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px] bg-slate-50/70 dark:bg-slate-950/40">
                  {activeThread.messages.length === 0 ? (
                    <div className="py-12 text-center">
                      <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        هنوز پیامی در این گفت‌وگو ثبت نشده است.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        می‌توانید از جملات آماده محترمانه زیر برای شروع مکالمه استفاده کنید.
                      </p>
                    </div>
                  ) : (
                    activeThread.messages.map((msg) => {
                      const isMine =
                        (isParent && msg.senderRole === 'parent') ||
                        (!isParent && msg.senderRole !== 'parent');
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                        >
                          <div
                            className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 border ${
                              isMine
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold">{msg.senderName}</span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    isMine
                                      ? 'bg-white/20 text-white'
                                      : roleBadgeClass(msg.senderRole)
                                  }`}
                                >
                                  {PARENT_CHAT_ROLE_LABELS[msg.senderRole]}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                            </p>
                            <div
                              className={`mt-2 flex items-center justify-end gap-1.5 text-[11px] tabular-nums ${
                                isMine ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              <span>{toPersianDigits(msg.jalaliDate)}</span>
                              <span>·</span>
                              <span>ساعت {toPersianDigits(msg.timeText)}</span>
                              {isMine && (
                                <CheckCheck
                                  className={`w-3.5 h-3.5 ${
                                    (isParent ? msg.readByStaff : msg.readByParent)
                                      ? 'text-emerald-300'
                                      : 'text-indigo-200/70'
                                  }`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Starter Phrases */}
                <div className="px-4 pt-3 pb-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>جملات آماده محترمانه (انتخاب با یک کلیک):</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {starterPhrases.map((phrase, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDraftText(phrase)}
                        className="text-right text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 transition-colors"
                      >
                        {phrase.length > 52 ? `${phrase.slice(0, 52)}…` : phrase}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Composer */}
                <form
                  onSubmit={handleSend}
                  className="p-4 pt-2 bg-white dark:bg-slate-900 rounded-b-2xl space-y-2"
                >
                  {errorMsg && (
                    <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2">
                      {errorMsg}
                    </div>
                  )}
                  {feedbackMsg && (
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
                      {feedbackMsg}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      data-testid="parent-chat-input"
                      rows={2}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (draftText.trim()) {
                            void handleSend(e as unknown as React.FormEvent);
                          }
                        }
                      }}
                      placeholder="پیام محترمانه خود را بنویسید..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <button
                      type="submit"
                      data-testid="parent-chat-send"
                      disabled={!draftText.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold whitespace-nowrap transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4 shrink-0" />
                      <span>ارسال پیام</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>

        {/* Dedicated Print-Only Official Conversation Log (crisp on both A4 and A5) */}
        {activeThread && (
          <section className="print-only space-y-3">
            <div className="border border-slate-900 rounded-lg p-2.5 text-xs space-y-1">
              <div>
                <strong>دانش‌آموز:</strong> {activeThread.studentName} ({activeThread.className})
              </div>
              <div>
                <strong>ولی:</strong> {activeThread.parentName}
              </div>
              <div>
                <strong>کانال گفت‌وگو:</strong> {activeThread.channelLabelFa} —{' '}
                {activeThread.counterpartName}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>تاریخ و ساعت</th>
                  <th style={{ width: '24%' }}>فرستنده و نقش</th>
                  <th>متن پیام</th>
                </tr>
              </thead>
              <tbody>
                {activeThread.messages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center">
                      پیامی در این پرونده ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  activeThread.messages.map((msg) => (
                    <tr key={msg.id}>
                      <td className="tabular-nums">
                        {toPersianDigits(msg.jalaliDate)}
                        <br />
                        ساعت {toPersianDigits(msg.timeText)}
                      </td>
                      <td>
                        <strong>{msg.senderName}</strong>
                        <br />({PARENT_CHAT_ROLE_LABELS[msg.senderRole]})
                      </td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </PrintShell>
  );
};
