// Pure Logic Helpers for Standalone Question Bank Plugin (Phase 2.5)
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  HomeworkAssignment,
  MediaAttachmentRef,
  QuestionBankItem,
  QuestionDifficulty,
  QuestionType,
} from '../../types/domain';
import { convertQuestionsToSpeedQuiz } from '../homework/homeworkHelpers';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'چهارگزینه‌ای (تستی)',
  descriptive: 'تشریحی',
  true_false: 'صحیح و غلط',
  fill_blank: 'جایخالی',
  file_sample: 'فایل یا تصویر نمونه سوال',
};

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'آسان',
  medium: 'متوسط',
  hard: 'سخت',
};

export const PRESET_GRADES: Array<{ level: number; label: string }> = [
  { level: 2, label: 'پایه دوم' },
  { level: 3, label: 'پایه سوم' },
  { level: 4, label: 'پایه چهارم' },
  { level: 5, label: 'پایه پنجم' },
  { level: 6, label: 'پایه ششم' },
];

export const OPTION_LETTERS_FA = ['الف', 'ب', 'ج', 'د'] as const;

export interface QuestionBankFilters {
  query: string;
  gradeLabel: string;
  subject: string;
  type: '' | QuestionType;
  difficulty: '' | QuestionDifficulty;
}

export function normalizeFaSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

export function filterQuestions(
  items: QuestionBankItem[],
  filters: QuestionBankFilters
): QuestionBankItem[] {
  const q = normalizeFaSearch(filters.query);

  return items.filter((item) => {
    if (filters.gradeLabel && item.gradeLabel !== filters.gradeLabel) return false;
    if (filters.subject && item.subject !== filters.subject) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.difficulty && item.difficulty !== filters.difficulty) return false;

    if (q) {
      const haystack = normalizeFaSearch(
        [
          item.questionText,
          item.subject,
          item.chapter,
          item.gradeLabel,
          item.modelAnswer ?? '',
          ...(item.options ?? []),
        ].join(' ')
      );
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function formatSingleQuestionText(item: QuestionBankItem, indexNumber: number): string[] {
  const lines: string[] = [];
  lines.push(
    `${toPersianDigits(indexNumber)}. [${item.subject} - ${item.chapter} | ${DIFFICULTY_LABELS[item.difficulty]}] ${item.questionText}`
  );

  if (item.type === 'multiple_choice' && item.options) {
    item.options.forEach((opt, i) => {
      lines.push(`   ${OPTION_LETTERS_FA[i]}) ${opt}`);
    });
  } else if (item.type === 'true_false') {
    lines.push('   ○ صحیح      ○ غلط');
  } else if (item.type === 'file_sample' && item.mediaAttachment) {
    lines.push(`   [فایل پیوست: ${item.mediaAttachment.fileName}]`);
  }

  return lines;
}

export function formatQuestionsForMessenger(params: {
  schoolName: string;
  className: string;
  questions: QuestionBankItem[];
  jalaliDate: string;
  senderName: string;
  includeAnswers?: boolean;
}): string {
  const sections = params.questions.map((q, idx) => {
    const lines = formatSingleQuestionText(q, idx + 1);
    if (params.includeAnswers) {
      if (q.type === 'multiple_choice' && q.options && q.correctOptionIndex !== undefined) {
        lines.push(
          `پاسخ صحیح: گزینه ${OPTION_LETTERS_FA[q.correctOptionIndex]} (${q.options[q.correctOptionIndex]})`
        );
      } else if (q.type === 'true_false' && q.trueFalseAnswer !== undefined) {
        lines.push(`پاسخ صحیح: ${q.trueFalseAnswer ? 'صحیح' : 'غلط'}`);
      }
      if (q.modelAnswer) {
        lines.push(`راهنمای پاسخ: ${q.modelAnswer}`);
      }
    }
    return {
      heading: `سوال ${toPersianDigits(idx + 1)} (${QUESTION_TYPE_LABELS[q.type]})`,
      lines,
    };
  });

  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: `بسته تمرینی و نمونه سوال — ${params.className}`,
    jalaliDateDisplay: formatJalaliDisplay(params.jalaliDate, false),
    sections,
    footerNote: `ارسال از بانک سوالات توسط ${params.senderName}`,
  });
}

export function buildHomeworkFromQuestions(params: {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  title: string;
  dueDateJalali: string;
  createdAtJalali: string;
  questions: QuestionBankItem[];
  convertToSpeedQuiz: boolean;
}): HomeworkAssignment {
  const mcqQuizItems = convertQuestionsToSpeedQuiz(params.questions);
  const useGameMode = params.convertToSpeedQuiz && mcqQuizItems.length > 0;
  const primarySubject = params.questions[0]?.subject || 'عمومی';

  const mediaAttachments: MediaAttachmentRef[] = params.questions
    .map((q) => q.mediaAttachment)
    .filter((m): m is MediaAttachmentRef => Boolean(m));

  const formattedQuestionsText = params.questions
    .map((q, idx) => formatSingleQuestionText(q, idx + 1).join('\n'))
    .join('\n\n');

  const description = useGameMode
    ? `مسابقه سرعتی چهارگزینه‌ای ساخته‌شده از ${toPersianDigits(mcqQuizItems.length)} سوال بانک سوالات (${primarySubject}). پس از پایان بازی، امتیاز و ستاره‌های شما به صورت خودکار ثبت می‌شود.`
    : `لطفاً به ${toPersianDigits(params.questions.length)} سوال زیر پاسخ دهید:\n\n${formattedQuestionsText}`;

  const nowIso = new Date().toISOString();

  return {
    id: params.id,
    schoolId: params.schoolId,
    classId: params.classId,
    teacherId: params.teacherId,
    teacherName: params.teacherName,
    subject: primarySubject,
    title: params.title.trim(),
    description,
    dueDateJalali: params.dueDateJalali,
    createdAtJalali: params.createdAtJalali,
    maxScore: 20,
    mode: useGameMode ? 'game' : 'standard',
    gameConfig: useGameMode
      ? {
          source: 'builtin',
          template: 'speed_quiz',
          timeLimitSec: Math.max(45, mcqQuizItems.length * 25),
          quizItems: mcqQuizItems,
        }
      : undefined,
    mediaAttachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,
    createdAt: nowIso,
  };
}
