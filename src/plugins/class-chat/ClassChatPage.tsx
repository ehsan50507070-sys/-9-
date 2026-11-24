// Phase 4 Plugin: Dedicated Class Group Chat («چت اختصاصی هر کلاس»)
// Group class channel (distinct from private parent-staff-chat) with room mode toggle,
// live polls, Phase 2.5 Question Bank draft queue integration, BroadcastChannel sync, messenger copy, and A4/A5 print.
import React, { useMemo, useState } from 'react';
import {
  BarChart2,
  BookOpenCheck,
  Check,
  Lock,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { EmptyStateSvg } from '../../core/ui/EmptyStateSvg';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import type { ClassChatPoll, ClassChatRoomMode } from '../../types/domain';
import {
  canUserPostInClassRoom,
  CLASS_CHAT_ROLE_BADGES,
  computePollStats,
  formatDraftQuestionForChat,
  isStaffClassChatRole,
} from './classChatHelpers';

export const ClassChatPage: React.FC = () => {
  const {
    activeSchool,
    activeRole,
    session,
    classes,
    classChatRooms,
    classChatMessages,
    classChatDraftQueue,
    setClassChatRoomMode,
    sendClassChatMessage,
    voteClassChatPoll,
    deleteClassChatDraft,
  } = useSchoolData();

  const isStaff = isStaffClassChatRole(activeRole);

  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id ?? '');
  const activeClassId = useMemo(() => {
    if (classes.some((c) => c.id === selectedClassId)) return selectedClassId;
    return classes[0]?.id ?? '';
  }, [classes, selectedClassId]);

  const activeClass = useMemo(
    () => classes.find((c) => c.id === activeClassId) ?? null,
    [classes, activeClassId]
  );

  const roomConfig = useMemo(
    () => classChatRooms.find((r) => r.classId === activeClassId),
    [classChatRooms, activeClassId]
  );
  const roomMode: ClassChatRoomMode = roomConfig?.mode ?? 'open';
  const canPostHere = canUserPostInClassRoom(activeRole, roomMode);

  const roomMessages = useMemo(
    () => classChatMessages.filter((m) => m.classId === activeClassId),
    [classChatMessages, activeClassId]
  );

  // Phase 2.5 Question Bank queued drafts for this class (or all visible classes for staff)
  const queuedDraftsForClass = useMemo(
    () =>
      classChatDraftQueue.filter(
        (d) => d.classId === activeClassId || !classes.some((c) => c.id === d.classId)
      ),
    [classChatDraftQueue, activeClassId, classes]
  );

  const [composerText, setComposerText] = useState('');
  const [showPollForm, setShowPollForm] = useState(false);
  const [showDraftDrawer, setShowDraftDrawer] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleToggleMode = (nextMode: ClassChatRoomMode) => {
    if (!activeClassId || !isStaff) return;
    setErrorMsg(null);
    const res = setClassChatRoomMode(activeClassId, nextMode);
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'تغییر حالت گروه امکان‌پذیر نبود.');
      return;
    }
    showToast(
      nextMode === 'announcement_only'
        ? 'گروه در «حالت اطلاع‌رسانی (فقط معلم و مدیریت)» قرار گرفت.'
        : 'گروه به «حالت گفت‌وگوی آزاد» تغییر یافت.'
    );
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId) return;
    setErrorMsg(null);
    const res = sendClassChatMessage({
      classId: activeClassId,
      kind: 'text',
      text: composerText,
    });
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ارسال پیام ناموفق بود.');
      return;
    }
    setComposerText('');
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId || !isStaff) return;
    setErrorMsg(null);
    const cleanQ = pollQuestion.trim();
    const cleanOpts = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleanQ.length < 4) {
      setErrorMsg('لطفاً متن پرسش نظرسنجی را وارد کنید.');
      return;
    }
    if (cleanOpts.length < 2 || cleanOpts.length > 5) {
      setErrorMsg('نظرسنجی باید بین ۲ تا ۵ گزینه معتبر داشته باشد.');
      return;
    }

    const poll: ClassChatPoll = {
      question: cleanQ,
      options: cleanOpts.map((text, idx) => ({
        id: `opt-${Date.now()}-${idx}`,
        text,
        voterUserIds: [],
      })),
      closed: false,
    };

    const res = sendClassChatMessage({
      classId: activeClassId,
      kind: 'poll',
      text: `نظرسنجی کلاسی: ${cleanQ}`,
      poll,
    });
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ایجاد نظرسنجی ناموفق بود.');
      return;
    }

    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollForm(false);
    showToast('نظرسنجی کلاسی با موفقیت منتشر شد.');
  };

  const handleVote = (messageId: string, optionId: string) => {
    setErrorMsg(null);
    const res = voteClassChatPoll(messageId, optionId);
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ثبت رأی امکان‌پذیر نبود.');
      return;
    }
    showToast('رأی شما در نظرسنجی ثبت شد.');
  };

  const handlePublishDraft = (draftId: string) => {
    const draft = queuedDraftsForClass.find((d) => d.id === draftId);
    if (!draft || !activeClassId) return;
    setErrorMsg(null);
    const res = sendClassChatMessage({
      classId: activeClassId,
      kind: 'question_bank',
      text: formatDraftQuestionForChat(draft),
    });
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'انتشار سوال در چت کلاس ناموفق بود.');
      return;
    }
    deleteClassChatDraft(draft.id);
    showToast('سوال بانک سوالات در چت کلاس منتشر و از صف انتظار خارج شد.');
  };

  if (classes.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-slate-600 dark:text-slate-300 font-bold">
          کلاسی برای چت گروهی در دامنه حساب کاربری شما تعریف نشده است.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                چت اختصاصی هر کلاس
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <Users className="w-3.5 h-3.5" />
                کانال گروهی کلاس {activeClass?.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              فضای تعامل جمعی کلاس با نشان نقش فرستنده، نظرسنجی زنده و همگام‌سازی لحظه‌ای بین تب‌ها
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {classes.length > 1 && (
              <select
                aria-label="انتخاب کلاس"
                value={activeClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 min-h-[40px]"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.gradeLevel})
                  </option>
                ))}
              </select>
            )}

            <PrintButtons documentLabel="آرشیو پیام‌ها و اطلاعیه‌های کلاس" />
          </div>
        </div>

        {/* Staff Room Mode Toggle + Poll + Question Bank Queue */}
        {isStaff && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-1 gap-1">
              <button
                type="button"
                onClick={() => handleToggleMode('open')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  roomMode === 'open'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                <Unlock className="w-3.5 h-3.5 shrink-0" />
                <span>حالت گفت‌وگوی آزاد</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode('announcement_only')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  roomMode === 'announcement_only'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>حالت اطلاع‌رسانی (فقط معلم و مدیریت)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPollForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap min-h-[38px]"
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                <span>ایجاد نظرسنجی کلاسی</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDraftDrawer((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 whitespace-nowrap min-h-[38px]"
              >
                <BookOpenCheck className="w-4 h-4 shrink-0" />
                <span>
                  دریافت سوالات ارسالی از بانک سوالات ({toPersianDigits(queuedDraftsForClass.length)})
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast & Error Notices */}
      {toast && (
        <div className="no-print rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200">
          {toast}
        </div>
      )}
      {errorMsg && (
        <div className="no-print rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Question Bank Draft Queue Drawer (Staff Only) */}
      {isStaff && showDraftDrawer && (
        <section className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              صف سوالات آماده از بانک سوالات (فاز ۲.۵)
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {toPersianDigits(queuedDraftsForClass.length)} سوال در صف
            </span>
          </div>
          {queuedDraftsForClass.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              سوالی در صف ارسال از بانک سوالات وجود ندارد. می‌توانید از ماژول «بانک سوالات» سوالات
              تمرینی را به صف چت کلاس ارسال کنید.
            </p>
          ) : (
            <div className="space-y-2.5">
              {queuedDraftsForClass.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                      {draft.title} · ارسالی توسط {draft.createdByName} ({toPersianDigits(draft.createdAtJalali)})
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                      {draft.formattedText}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePublishDraft(draft.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0 min-h-[38px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>انتشار در چت کلاس</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Poll Creator Form (Staff Only) */}
      {isStaff && showPollForm && (
        <form
          onSubmit={handleCreatePoll}
          className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 space-y-3"
        >
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            ساخت نظرسنجی جدید در کلاس {activeClass?.name}
          </h2>
          <div>
            <label
              htmlFor="poll-question-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              متن پرسش نظرسنجی
            </label>
            <input
              id="poll-question-input"
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="مثال: بهترین زمان برگزاری کلاس رفع اشکال ریاضی کدام روز است؟"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              گزینه‌ها (۲ تا ۵ گزینه):
            </div>
            {pollOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) =>
                    setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                  }
                  placeholder={`گزینه ${toPersianDigits(idx + 1)}`}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    aria-label="حذف گزینه"
                    onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 5 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن گزینه جدید</span>
              </button>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPollForm(false)}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
            >
              <BarChart2 className="w-4 h-4" />
              <span>انتشار نظرسنجی</span>
            </button>
          </div>
        </form>
      )}

      {/* Printable Chat & Announcements Feed */}
      <PrintShell
        school={activeSchool}
        documentTitle={`آرشیو پیام‌ها، اطلاعیه‌ها و نظرسنجی‌های کلاس ${activeClass?.name ?? ''}`}
        subtitle={`وضعیت گروه: ${roomMode === 'open' ? 'گفت‌وگوی آزاد' : 'حالت اطلاع‌رسانی'} · تاریخ: ${formatJalaliDisplay(getTodayJalali(), true)}`}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Room Mode Indicator Banner */}
          <div
            className={`px-4 py-2.5 border-b text-xs font-bold flex items-center justify-between gap-2 ${
              roomMode === 'announcement_only'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {roomMode === 'announcement_only' ? (
                <>
                  <Megaphone className="w-4 h-4 shrink-0" />
                  <span>حالت اطلاع‌رسانی فعال است — ارسال پیام فقط برای معلم و مدیریت مجاز است.</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>حالت گفت‌وگوی آزاد فعال است — همه اعضای کلاس می‌توانند پیام ارسال کنند.</span>
                </>
              )}
            </div>
            <span className="tabular-nums shrink-0">{toPersianDigits(roomMessages.length)} پیام</span>
          </div>

          {/* Messages Stream */}
          <div className="p-4 sm:p-5 space-y-3.5 max-h-[520px] overflow-y-auto print:max-h-none">
            {roomMessages.length === 0 ? (
              <EmptyStateSvg
                variant="messages"
                titleFa="هنوز پیامی در گروه این کلاس ثبت نشده است"
                descriptionFa="پیام‌ها، اطلاعیه‌های آموزشی و نظرسنجی‌های کلاسی در این بخش نمایش داده می‌شوند."
              />
            ) : (
              roomMessages.map((msg) => {
                const isMine = session?.userId === msg.senderUserId;
                const badge = CLASS_CHAT_ROLE_BADGES[msg.senderRole];
                const pollStats = msg.kind === 'poll' && msg.poll ? computePollStats(msg.poll, session?.userId) : null;

                return (
                  <article
                    key={msg.id}
                    className={`rounded-2xl border p-3.5 sm:p-4 space-y-2.5 ${
                      msg.kind === 'poll'
                        ? 'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20'
                        : msg.kind === 'question_bank'
                          ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : isMine
                            ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {msg.senderName}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}
                        >
                          {badge.labelFa}
                        </span>
                        {msg.kind === 'question_bank' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            بانک سوالات
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {toPersianDigits(msg.jalaliDate)} · {toPersianDigits(msg.timeText)}
                        </span>
                      </div>
                    </div>

                    {msg.kind !== 'poll' && (
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line">
                        {toPersianDigits(msg.text)}
                      </p>
                    )}

                    {/* Interactive Poll Card */}
                    {msg.kind === 'poll' && msg.poll && pollStats && (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                          <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>{toPersianDigits(msg.poll.question)}</span>
                        </div>
                        <div className="space-y-2">
                          {pollStats.options.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={pollStats.hasVoted || msg.poll?.closed}
                              onClick={() => handleVote(msg.id, opt.id)}
                              className={`w-full text-right rounded-xl border p-2.5 transition-all relative overflow-hidden ${
                                opt.votedByMe
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60'
                                  : pollStats.hasVoted
                                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-default'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 cursor-pointer'
                              }`}
                            >
                              <div
                                className="absolute inset-y-0 right-0 bg-indigo-500/15 dark:bg-indigo-400/20 transition-all"
                                style={{ width: `${opt.percent}%` }}
                              />
                              <div className="relative flex items-center justify-between gap-2 text-xs sm:text-sm">
                                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  {opt.votedByMe && (
                                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  )}
                                  {toPersianDigits(opt.text)}
                                </span>
                                <span className="font-extrabold text-indigo-700 dark:text-indigo-300 tabular-nums shrink-0">
                                  {toPersianDigits(opt.percent)}٪ ({toPersianDigits(opt.votes)} رأی)
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>مجموع آرا: {toPersianDigits(pollStats.totalVotes)} نفر</span>
                          <span>
                            {pollStats.hasVoted
                              ? 'رأی شما ثبت شده است'
                              : 'برای ثبت رأی روی یک گزینه کلیک کنید'}
                          </span>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {/* Composer Bar (Locked cleanly when announcement_only for parent & student) */}
          <div className="no-print border-t border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-900">
            {!canPostHere ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  این گروه در «حالت اطلاع‌رسانی» است؛ در حال حاضر فقط معلم و مدیریت امکان ارسال پیام
                  دارند.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSendText} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="متن پیام کلاسی"
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder={`پیام یا اطلاعیه جدید در کلاس ${activeClass?.name ?? ''} بنویسید...`}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white min-h-[44px]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[44px] transition-colors"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>ارسال</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </PrintShell>
    </div>
  );
};
