// Pure Helper Functions for Phase 4 Class Group Chat («چت اختصاصی هر کلاس»)
// Decoupled from React for direct unit testing via node:test.
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  ClassChatDraftItem,
  ClassChatMessage,
  ClassChatPoll,
  ClassChatRoomMode,
  RoleId,
} from '../../types/domain';

export const CLASS_CHAT_ROLE_BADGES: Record<
  RoleId,
  { labelFa: string; className: string }
> = {
  super_admin: {
    labelFa: 'راهبر ارشد',
    className:
      'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  complex_admin: {
    labelFa: 'مدیر کل',
    className:
      'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  },
  principal: {
    labelFa: 'مدیر مدرسه',
    className:
      'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  deputy: {
    labelFa: 'معاون',
    className:
      'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  },
  counselor: {
    labelFa: 'مشاور مدرسه',
    className:
      'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  teacher: {
    labelFa: 'معلم',
    className:
      'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  parent: {
    labelFa: 'ولی',
    className:
      'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  student: {
    labelFa: 'دانش‌آموز',
    className:
      'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
};

/**
 * Deterministic BroadcastChannel name per schoolId for real-time cross-tab class chat sync.
 */
export function getClassChatChannelName(schoolId: string): string {
  return `school_class_chat_${schoolId}`;
}

export function isStaffClassChatRole(role: RoleId): boolean {
  return role === 'complex_admin' || role === 'principal' || role === 'deputy' || role === 'teacher';
}

/**
 * Checks whether a role can post regular text messages under the current class room mode.
 * - `'open'`: all class members (staff, parent, student) can post.
 * - `'announcement_only'`: ONLY teacher & school management can post; parents & students are locked.
 */
export function canUserPostInClassRoom(role: RoleId, mode: ClassChatRoomMode): boolean {
  if (isStaffClassChatRole(role)) return true;
  return mode === 'open';
}

/**
 * Applies a single vote per user to a class chat poll.
 * Strictly prevents duplicate voting by the same userId.
 */
export function applyPollVote(
  poll: ClassChatPoll,
  optionId: string,
  userId: string
): { ok: boolean; updatedPoll?: ClassChatPoll; errorFa?: string } {
  if (poll.closed) {
    return { ok: false, errorFa: 'این نظرسنجی بسته شده است.' };
  }
  const alreadyVoted = poll.options.some((opt) => opt.voterUserIds.includes(userId));
  if (alreadyVoted) {
    return { ok: false, errorFa: 'شما قبلاً در این نظرسنجی رأی خود را ثبت کرده‌اید.' };
  }
  const targetExists = poll.options.some((opt) => opt.id === optionId);
  if (!targetExists) {
    return { ok: false, errorFa: 'گزینه انتخاب‌شده در نظرسنجی معتبر نیست.' };
  }

  return {
    ok: true,
    updatedPoll: {
      ...poll,
      options: poll.options.map((opt) =>
        opt.id === optionId
          ? { ...opt, voterUserIds: [...opt.voterUserIds, userId] }
          : opt
      ),
    },
  };
}

export interface PollOptionStat {
  id: string;
  text: string;
  votes: number;
  percent: number;
  votedByMe: boolean;
}

export function computePollStats(
  poll: ClassChatPoll,
  currentUserId?: string
): { totalVotes: number; hasVoted: boolean; options: PollOptionStat[] } {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voterUserIds.length, 0);
  const hasVoted = currentUserId
    ? poll.options.some((opt) => opt.voterUserIds.includes(currentUserId))
    : false;
  const options = poll.options.map((opt) => ({
    id: opt.id,
    text: opt.text,
    votes: opt.voterUserIds.length,
    percent: totalVotes > 0 ? Math.round((opt.voterUserIds.length / totalVotes) * 100) : 0,
    votedByMe: currentUserId ? opt.voterUserIds.includes(currentUserId) : false,
  }));

  return { totalVotes, hasVoted, options };
}

/**
 * Formats a teacher/admin announcement or class message in strict single-column messenger style (Eitaa / Bale / Shad).
 */
export function formatClassAnnouncementMessenger(params: {
  schoolName: string;
  className: string;
  message: ClassChatMessage;
}): string {
  const { schoolName, className, message } = params;
  const roleLabel = CLASS_CHAT_ROLE_BADGES[message.senderRole].labelFa;
  const lines = [
    `کلاس: ${className}`,
    `فرستنده: ${message.senderName} (${roleLabel})`,
    `ساعت ارسال: ${toPersianDigits(message.timeText)}`,
    '',
    ...message.text.split('\n'),
  ];

  if (message.kind === 'poll' && message.poll) {
    const stats = computePollStats(message.poll);
    lines.push('', `📊 نظرسنجی: ${message.poll.question}`);
    stats.options.forEach((opt, i) => {
      lines.push(
        `${toPersianDigits(i + 1)}. ${opt.text} — ${toPersianDigits(opt.votes)} رأی (${toPersianDigits(opt.percent)}٪)`
      );
    });
  }

  return formatSingleColumnMessengerReport({
    schoolName,
    reportTitle: message.kind === 'poll' ? 'نظرسنجی کلاسی' : 'اطلاعیه و پیام کلاسی',
    jalaliDateDisplay: message.jalaliDate,
    sections: [{ lines }],
    footerNote: 'سامانه مدیریت هوشمند مدارس',
  });
}

/**
 * Formats a Phase 2.5 Question Bank queued draft item into clean Persian chat text.
 */
export function formatDraftQuestionForChat(draft: ClassChatDraftItem): string {
  return [
    `📚 سوال تمرینی ارسالی از بانک سوالات — ${draft.title}`,
    draft.formattedText.trim(),
  ].join('\n\n');
}
