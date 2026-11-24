// Phase 2.5 Seed Data: 6 Persian elementary sample questions for school-1 + 1 built-in Educational Game Homework
import { addDaysToJalali } from '../../lib/jalali';
import type {
  ClassChatDraftItem,
  ClassRoom,
  ExamBasketItem,
  HomeworkAssignment,
  QuestionBankItem,
  School,
  Teacher,
} from '../../types/domain';

export const PHASE25_PLUGIN_IDS = ['question-bank'] as const;

export interface Phase25SeedBundle {
  question_bank: QuestionBankItem[];
  class_chat_draft_queue: ClassChatDraftItem[];
  exam_question_basket: ExamBasketItem[];
  extra_homework_assignments: HomeworkAssignment[];
}

export function generatePhase25SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  teachers: Teacher[];
  activeDayJalali: string;
}): Phase25SeedBundle {
  const { schools, classes, teachers, activeDayJalali } = params;
  const nowIso = new Date().toISOString();

  const question_bank: QuestionBankItem[] = [];
  const class_chat_draft_queue: ClassChatDraftItem[] = [];
  const exam_question_basket: ExamBasketItem[] = [];
  const extra_homework_assignments: HomeworkAssignment[] = [];

  const school1 = schools.find((s) => s.id === 'school-1') ?? schools[0];
  if (!school1) {
    return {
      question_bank,
      class_chat_draft_queue,
      exam_question_basket,
      extra_homework_assignments,
    };
  }

  const s1Id = school1.id;
  const s1Teachers = teachers.filter((t) => t.schoolId === s1Id);
  const s1Classes = classes.filter((c) => c.schoolId === s1Id);
  const leadTeacher = s1Teachers[0];
  const mathTeacher = s1Teachers[2] ?? leadTeacher;
  const litTeacher = s1Teachers[1] ?? leadTeacher;

  // 6 Realistic Persian Elementary Sample Questions (Math & Persian, Grades 2–6) for school-1 ONLY
  question_bank.push(
    {
      id: `${s1Id}:qb:1`,
      schoolId: s1Id,
      gradeLevel: 2,
      gradeLabel: 'پایه دوم',
      subject: 'ریاضی',
      chapter: 'فصل ۲ — جمع و تفریق دو رقمی',
      difficulty: 'easy',
      type: 'multiple_choice',
      questionText: 'حاصل جمع «۳۷ + ۲۵» کدام گزینه است؟',
      options: ['۵۲', '۶۲', '۶۱', '۵۷'],
      correctOptionIndex: 1,
      modelAnswer: 'جمع یکان‌ها: ۷ + ۵ = ۱۲ (۲ را می‌نویسیم و ۱ دهگان نگه می‌داریم)؛ جمع دهگان‌ها: ۳ + ۲ + ۱ = ۶، پس حاصل ۶۲ است.',
      createdById: leadTeacher?.id ?? 'staff',
      createdByName: leadTeacher?.fullName ?? 'آموزگار پایه دوم',
      createdByRole: 'teacher',
      createdAtJalali: addDaysToJalali(activeDayJalali, -4),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${s1Id}:qb:2`,
      schoolId: s1Id,
      gradeLevel: 3,
      gradeLabel: 'پایه سوم',
      subject: 'ریاضی',
      chapter: 'فصل ۳ — کسرها و عددهای مخلوط',
      difficulty: 'medium',
      type: 'multiple_choice',
      questionText: 'کدام کسر با کسر «یک‌دوم (۱/۲)» برابر است؟',
      options: ['۲/۳', '۳/۶', '۲/۵', '۴/۶'],
      correctOptionIndex: 1,
      modelAnswer: 'اگر صورت و مخرج ۱/۲ را در ۳ ضرب کنیم کسر مساوی ۳/۶ به دست می‌آید.',
      createdById: mathTeacher?.id ?? 'staff',
      createdByName: mathTeacher?.fullName ?? 'دبیر ریاضی',
      createdByRole: 'teacher',
      createdAtJalali: addDaysToJalali(activeDayJalali, -3),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${s1Id}:qb:3`,
      schoolId: s1Id,
      gradeLevel: 4,
      gradeLabel: 'پایه چهارم',
      subject: 'فارسی',
      chapter: 'درس ۴ — ارزش علم و دانش',
      difficulty: 'easy',
      type: 'multiple_choice',
      questionText: 'مترادف (هم‌معنی) واژه «کوشش» کدام گزینه است؟',
      options: ['تنبلی', 'تلاش و سعی', 'سکوت', 'آرامش'],
      correctOptionIndex: 1,
      modelAnswer: 'واژه «کوشش» به معنای تلاش، سعی و پشتکار است.',
      createdById: litTeacher?.id ?? 'staff',
      createdByName: litTeacher?.fullName ?? 'دبیر فارسی',
      createdByRole: 'teacher',
      createdAtJalali: addDaysToJalali(activeDayJalali, -2),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${s1Id}:qb:4`,
      schoolId: s1Id,
      gradeLevel: 5,
      gradeLabel: 'پایه پنجم',
      subject: 'ریاضی',
      chapter: 'فصل ۴ — محیط و مساحت شکل‌های هندسی',
      difficulty: 'hard',
      type: 'descriptive',
      questionText: 'باغچه‌ای مستطیل‌شکل به طول ۱۲ متر و عرض ۷ متر داریم. محیط و مساحت این باغچه را با نوشتن فرمول و راه‌حل کامل حساب کنید.',
      modelAnswer: 'محیط مستطیل = (طول + عرض) × ۲ = (۱۲ + ۷) × ۲ = ۳۸ متر.\nمساحت مستطیل = طول × عرض = ۱۲ × ۷ = ۸۴ متر مربع.',
      createdById: mathTeacher?.id ?? 'staff',
      createdByName: mathTeacher?.fullName ?? 'دبیر ریاضی',
      createdByRole: 'teacher',
      createdAtJalali: addDaysToJalali(activeDayJalali, -2),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${s1Id}:qb:5`,
      schoolId: s1Id,
      gradeLevel: 6,
      gradeLabel: 'پایه ششم',
      subject: 'فارسی',
      chapter: 'درس ۳ — هوشیاری و خردمندی',
      difficulty: 'medium',
      type: 'true_false',
      questionText: 'در جمله «دانش‌آموزانِ کوشا کتاب‌های مفید می‌خوانند»، واژه «کوشا» صفت برای «دانش‌آموزان» است.',
      trueFalseAnswer: true,
      modelAnswer: 'صحیح است؛ واژه «کوشا» ویژگی اسم «دانش‌آموزان» را بیان می‌کند و صفت آن محسوب می‌شود.',
      createdById: litTeacher?.id ?? 'staff',
      createdByName: litTeacher?.fullName ?? 'دبیر فارسی',
      createdByRole: 'teacher',
      createdAtJalali: addDaysToJalali(activeDayJalali, -1),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${s1Id}:qb:6`,
      schoolId: s1Id,
      gradeLevel: 5,
      gradeLabel: 'پایه پنجم',
      subject: 'فارسی',
      chapter: 'درس ۵ — نگارش و نشانه‌گذاری',
      difficulty: 'easy',
      type: 'fill_blank',
      questionText: 'در پایان جمله‌های پرسشی از نشانه «.........» و در پایان جمله‌های خبری از نشانه «.........» استفاده می‌کنیم.',
      modelAnswer: 'علامت سوال (؟) — نقطه (.)',
      createdById: litTeacher?.id ?? 'staff',
      createdByName: litTeacher?.fullName ?? 'دبیر فارسی',
      createdByRole: 'teacher',
      createdAtJalali: activeDayJalali,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  );

  // Seed 1 interactive Built-In Educational Game Homework in Class 1 of school-1 so teachers & parents can play immediately
  const firstClass = s1Classes[0];
  if (firstClass) {
    extra_homework_assignments.push({
      id: `${s1Id}:hw:${firstClass.id}:game-1`,
      schoolId: s1Id,
      classId: firstClass.id,
      teacherId: leadTeacher?.id ?? `${s1Id}-t-1`,
      teacherName: leadTeacher?.fullName ?? 'آموزگار کلاس',
      subject: 'ریاضی',
      title: 'بازی آموزشی: جورچین ضرب و جمع سریع',
      description: 'عبارت‌های ریاضی را به پاسخ درست آن‌ها وصل کنید تا امتیاز و ستاره کامل تکلیف را دریافت نمایید!',
      dueDateJalali: addDaysToJalali(activeDayJalali, 6),
      createdAtJalali: activeDayJalali,
      maxScore: 20,
      mode: 'game',
      gameConfig: {
        source: 'builtin',
        template: 'matching',
        timeLimitSec: 120,
        pairs: [
          { id: 'p1', term: '۳۷ + ۲۵', match: '۶۲' },
          { id: 'p2', term: '۹ × ۴', match: '۳۶' },
          { id: 'p3', term: '۵۰ − ۱۸', match: '۳۲' },
          { id: 'p4', term: '۷ × ۶', match: '۴۲' },
        ],
      },
      createdAt: nowIso,
    });
  }

  return {
    question_bank,
    class_chat_draft_queue,
    exam_question_basket,
    extra_homework_assignments,
  };
}
