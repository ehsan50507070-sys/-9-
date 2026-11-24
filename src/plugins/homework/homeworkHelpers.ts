// Pure Logic Helpers for Phase 2.5 Homework Live Tracking, Educational Games & Messenger Export
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  GameQuizItem,
  HomeworkAssignment,
  HomeworkSubmission,
  QuestionBankItem,
  Student,
} from '../../types/domain';

export function isAssignmentActive(dueDateJalali: string, currentDateJalali: string): boolean {
  return dueDateJalali >= currentDateJalali;
}

export interface ClassHomeworkPartition {
  submittedRows: Array<{ student: Student; submission: HomeworkSubmission }>;
  pendingStudents: Student[];
  submittedCount: number;
  totalCount: number;
  progressPercent: number;
}

export function partitionClassHomeworkStatus(
  classStudents: Student[],
  assignmentId: string,
  submissions: HomeworkSubmission[]
): ClassHomeworkPartition {
  const subByStudentId = new Map<string, HomeworkSubmission>();
  for (const sub of submissions) {
    if (sub.assignmentId === assignmentId) {
      subByStudentId.set(sub.studentId, sub);
    }
  }

  const submittedRows: Array<{ student: Student; submission: HomeworkSubmission }> = [];
  const pendingStudents: Student[] = [];

  for (const student of classStudents) {
    const sub = subByStudentId.get(student.id);
    if (sub) {
      submittedRows.push({ student, submission: sub });
    } else {
      pendingStudents.push(student);
    }
  }

  const totalCount = classStudents.length;
  const submittedCount = submittedRows.length;
  const progressPercent = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  return {
    submittedRows,
    pendingStudents,
    submittedCount,
    totalCount,
    progressPercent,
  };
}

export function calculateGameScore(params: {
  correctCount: number;
  totalCount: number;
  durationSec: number;
}): { score: number; maxScore: 100; stars: 1 | 2 | 3; suggestedGrade20: number } {
  const safeTotal = Math.max(1, params.totalCount);
  const clampedCorrect = Math.max(0, Math.min(safeTotal, params.correctCount));
  const score = Math.round((clampedCorrect / safeTotal) * 100);
  const stars: 1 | 2 | 3 = score >= 85 ? 3 : score >= 55 ? 2 : 1;
  const suggestedGrade20 = Math.round(((score / 100) * 20) * 4) / 4;
  return { score, maxScore: 100, stars, suggestedGrade20 };
}

export function convertQuestionsToSpeedQuiz(questions: QuestionBankItem[]): GameQuizItem[] {
  return questions
    .filter(
      (q) =>
        q.type === 'multiple_choice' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.correctOptionIndex !== undefined
    )
    .slice(0, 10)
    .map((q) => ({
      id: `quiz-${q.id}`,
      question: q.questionText,
      options: q.options as [string, string, string, string],
      correctIndex: q.correctOptionIndex ?? 0,
    }));
}

export function formatPendingStudentsMessengerList(params: {
  schoolName: string;
  className: string;
  assignment: HomeworkAssignment;
  pendingStudents: Student[];
  submittedCount: number;
  totalCount: number;
  currentDateJalali: string;
}): string {
  const lines =
    params.pendingStudents.length === 0
      ? ['خوشبختانه تمامی دانش‌آموزان کلاس این تکلیف را تحویل داده‌اند.']
      : params.pendingStudents.map(
          (st, idx) => `${toPersianDigits(idx + 1)}. ${st.fullName}`
        );

  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: `پیگیری تحویل تکلیف — ${params.assignment.title}`,
    jalaliDateDisplay: formatJalaliDisplay(params.currentDateJalali, false),
    sections: [
      {
        heading: `${params.className} (${params.assignment.subject})`,
        lines: [
          `وضعیت تحویل تا این لحظه: ${toPersianDigits(params.submittedCount)} از ${toPersianDigits(params.totalCount)} نفر`,
          `مهلت تحویل: ${formatJalaliDisplay(params.assignment.dueDateJalali, false)}`,
        ],
      },
      {
        heading: `دانش‌آموزان در انتظار تحویل (${toPersianDigits(params.pendingStudents.length)} نفر)`,
        lines,
      },
    ],
    footerNote: `دبیر: ${params.assignment.teacherName} · لطفاً تکلیف را در سامانه ارسال نمایید.`,
  });
}
