// Realistic Multi-Stage Seed Data for Phase 9A: Academic Years & Enterprise Mock / Konkur Exams
// Seeds 3 progressive published stages (Stage 1 Mehr, Stage 2 Azar, Stage 3 Dey — 3-School Coordinated)
// + 1 active live online Konkur exam (Stage 4 Bahman) in 1404-1405
// + 1 archived historical exam in 1403-1404 so switching academic years shows real archived records.
import type {
  AcademicYear,
  ClassRoom,
  MockAnswerOption,
  MockExam,
  MockExamAttempt,
  MockExamBooklet,
  MockExamQuestion,
  MockExamSubject,
  MockQuestionDifficulty,
  School,
  Student,
} from '../../types/domain';
import {
  ARCHIVED_ACADEMIC_YEAR_ID,
  DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
  generateSeedAcademicYears,
} from '../../core/academic-year/academicYearHelpers';
import { DEFAULT_COMPLEX_ID, GLOBAL_TENANT_ID } from '../../core/super-admin/superAdminHelpers';

export const PHASE9A_PLUGIN_IDS = ['mock-exams'] as const;

export interface Phase9ASeedOutput {
  academic_years: AcademicYear[];
  mock_exams: MockExam[];
  mock_exam_attempts: MockExamAttempt[];
}

function deterministicHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

interface QuestionTemplate {
  topic: string;
  difficulty: MockQuestionDifficulty;
  correctOption: MockAnswerOption;
  trapOption?: MockAnswerOption;
  questionText: string;
  options: [string, string, string, string];
  solutionText: string;
}

const SUBJECT_QUESTION_BANK: Record<string, QuestionTemplate[]> = {
  math: [
    {
      topic: 'الگوها و معادله',
      difficulty: 'easy',
      correctOption: 2,
      questionText: 'در الگوی عددی ۴، ۹، ۱۶، ۲۵، ... جمله دهم کدام عدد است؟',
      options: ['۱۰۰', '۱۲۱', '۱۴۴', '۸۱'],
      solutionText: 'جمله nام برابر (n+1)² است؛ بنابراین جمله دهم برابر (10+1)² = 121 می‌شود.',
    },
    {
      topic: 'کسر و اعشار',
      difficulty: 'medium',
      correctOption: 3,
      trapOption: 1, // Deliberate distractor trap
      questionText: 'حاصل عبارت (۳/۴ + ۲/۵) ÷ ۲۳/۱۰ کدام است؟',
      options: ['۲', '۲۳/۲۰', '۱/۲', '۳/۵'],
      solutionText: 'مخرج مشترک ۳/۴ و ۲/۵ برابر ۲۰ است: ۱۵/۲۰ + ۸/۲۰ = ۲۳/۲۰. تقسیم بر ۲۳/۱۰ برابر ۱/۲ است. دام آموزشی: بسیاری از دانش‌آموزان کسر دوم را برعکس ضرب کرده و عدد ۲ را انتخاب می‌کنند.',
    },
    {
      topic: 'هندسه و مساحت',
      difficulty: 'medium',
      correctOption: 1,
      questionText: 'اگر محیط مربعی ۳۶ سانتی‌متر باشد، مساحت آن چند سانتی‌متر مربع است؟',
      options: ['۸۱', '۷۲', '۳۶', '۶۴'],
      solutionText: 'طول هر ضلع مربع برابر ۳۶ ÷ ۴ = ۹ سانتی‌متر است و مساحت برابر ۹ × ۹ = ۸۱ می‌شود.',
    },
    {
      topic: 'مشتق و کاربرد آن',
      difficulty: 'hard',
      correctOption: 4,
      trapOption: 2,
      questionText: 'اگر سرعت رشد خطی یک متحرک در هر ثانیه ۳ متر افزایش یابد و سرعت اولیه ۴ باشد، پس از ۵ ثانیه سرعت آن چقدر است؟',
      options: ['۱۵', '۱۷', '۲۱', '۱۹'],
      solutionText: 'با رابطه v = v0 + at داریم: 4 + (3 × 5) = 19 متر بر ثانیه.',
    },
    {
      topic: 'هندسه و مساحت',
      difficulty: 'easy',
      correctOption: 2,
      questionText: 'مجموع زاویه‌های داخلی یک چهارضلعی محدب چند درجه است؟',
      options: ['۱۸۰ درجه', '۳۶۰ درجه', '۲۷۰ درجه', '۵۴۰ درجه'],
      solutionText: 'هر چهارضلعی به دو مثلث تقسیم می‌شود و مجموع زاویه‌ها برابر ۲ × ۱۸۰ = ۳۶۰ درجه است.',
    },
  ],
  science: [
    {
      topic: 'انرژی و نیرو',
      difficulty: 'easy',
      correctOption: 1,
      questionText: 'در یک باتری قلمی کدام تبدیل انرژی هنگام روشن شدن چراغ قوه رخ می‌دهد؟',
      options: ['شیمیایی به الکتریکی و نوری', 'گرمایی به حرکتی', 'الکتریکی به شیمیایی', 'نوری به هسته‌ای'],
      solutionText: 'انرژی شیمیایی ذخیره شده در باتری ابتدا به انرژی الکتریکی و سپس در لامپ به نور و گرما تبدیل می‌شود.',
    },
    {
      topic: 'زیست‌شناسی و ژنتیک',
      difficulty: 'medium',
      correctOption: 4,
      trapOption: 3, // Deliberate distractor trap
      questionText: 'کدام اندامک سلولی نقش اصلی در آزادسازی انرژی از قند (تنفس سلولی) را بر عهده دارد؟',
      options: ['ریبوزوم', 'دستگاه گلژی', 'کلروپلاست', 'میتوکندری'],
      solutionText: 'میتوکندری نیروگاه سلول است. دام آموزشی: کلروپلاست وظیفه فتوسنتز (ساخت غذا) را دارد نه آزادسازی انرژی در تنفس سلولی.',
    },
    {
      topic: 'زمین و فضا',
      difficulty: 'medium',
      correctOption: 2,
      questionText: 'علت اصلی پیدایش فصل‌های مختلف روی کره زمین چیست؟',
      options: ['تغییر فاصله زمین تا خورشید', 'انحراف محور چرخش زمین هنگام گردش به دور خورشید', 'چرخش ماه به دور زمین', 'سرعت بادهای خورشیدی'],
      solutionText: 'انحراف ۲۳/۵ درجه‌ای محور زمین باعث تغییر زاویه تابش نور خورشید در نیم‌کره‌ها و ایجاد فصل‌ها می‌شود.',
    },
    {
      topic: 'انرژی و نیرو',
      difficulty: 'hard',
      correctOption: 3,
      questionText: 'اگر جسمی با نیروی ۲۰ نیوتن به اندازه ۴ متر در راستای نیرو جابه‌جا شود، کار انجام‌شده چند ژول است؟',
      options: ['۵ ژول', '۲۴ ژول', '۸۰ ژول', '۴۰ ژول'],
      solutionText: 'کار برابر حاصل‌ضرب نیرو در جابه‌جایی هم‌راستا است: W = 20 × 4 = 80 ژول.',
    },
    {
      topic: 'زیست‌شناسی و ژنتیک',
      difficulty: 'easy',
      correctOption: 1,
      questionText: 'واحد اصلی ساختار و عمل در همه موجودات زنده چیست؟',
      options: ['سلول (یاخته)', 'بافت', 'اندام', 'مولکول آب'],
      solutionText: 'سلول کوچک‌ترین واحد ساختاری و عملکردی پیکر همه جانداران است.',
    },
  ],
  persian: [
    {
      topic: 'آرایه‌های ادبی',
      difficulty: 'medium',
      correctOption: 3,
      trapOption: 2,
      questionText: 'در بیت «ابر و باد و مه و خورشید و فلک در کارند / تا تو نانی به کف آری و به غفلت نخوری» کدام آرایه شاخص‌تر است؟',
      options: ['تضاد', 'جناس تام', 'مراعات نظیر (تناسب)', 'اسلوب معادله'],
      solutionText: 'واژگان ابر، باد، مه، خورشید و فلک با یکدیگر تناسب و مراعات نظیر دارند.',
    },
    {
      topic: 'دستور زبان',
      difficulty: 'easy',
      correctOption: 2,
      questionText: 'در جمله «دانش‌آموزان پرتلاش، کتاب‌های مفید را با دقت مطالعه کردند» نهاد جمله کدام است؟',
      options: ['کتاب‌های مفید', 'دانش‌آموزان پرتلاش', 'با دقت', 'مطالعه کردند'],
      solutionText: 'نهاد کننده کار در جمله است که در اینجا گروه اسمی «دانش‌آموزان پرتلاش» می‌باشد.',
    },
    {
      topic: 'درک مطلب',
      difficulty: 'medium',
      correctOption: 1,
      questionText: 'مفهوم ضرب‌المثل «قطره قطره جمع گردد وانگهی دریا شود» به کدام ویژگی اشاره دارد؟',
      options: ['استمرار و پشتکار تدریجی', 'عجله در کارها', 'تکیه بر شانس', 'انزوا و دوری از جمع'],
      solutionText: 'این مثل بر ارزش تلاش مستمر و جمع‌شدن پیشرفت‌های کوچک در طول زمان تاکید دارد.',
    },
    {
      topic: 'آرایه‌های ادبی',
      difficulty: 'hard',
      correctOption: 4,
      questionText: 'در عبارت «چشمه‌های کوهستان با صدای دلنشین می‌خندیدند» کدام آرایه به کار رفته است؟',
      options: ['تلمیح', 'مبالغه', 'تکرار', 'تشخیص (جان‌بخشی)'],
      solutionText: 'نسبت دادن خندیدن (ویژگی انسانی) به چشمه‌های کوهستان آرایه تشخیص است.',
    },
    {
      topic: 'دستور زبان',
      difficulty: 'easy',
      correctOption: 3,
      questionText: 'کدام واژه از نظر املایی کاملاً صحیح نوشته شده است؟',
      options: ['مسولیت', 'اضطراب و دغدغه', 'استعداد و پشتکار', 'توجیه و تذکره'],
      solutionText: 'گزینه «استعداد و پشتکار» کاملاً صحیح و دقیق‌ترین انتخاب معیار در ساختار آزمون است.',
    },
  ],
  reasoning: [
    {
      topic: 'هوش تحلیلی',
      difficulty: 'medium',
      correctOption: 2,
      questionText: 'اگر هر دو ساعت یک‌بار دمای اتاق ۳ درجه کاهش یابد و ساعت ۸ صبح دما ۲۴ درجه باشد، ساعت ۱۴ دما چند درجه است؟',
      options: ['۱۸ درجه', '۱۵ درجه', '۱۲ درجه', '۲۱ درجه'],
      solutionText: 'از ساعت ۸ تا ۱۴ معادل ۶ ساعت (۳ بازه دوساعته) است؛ کاهش دما ۳ × ۳ = ۹ درجه، پس ۲۴ - ۹ = ۱۵ درجه می‌شود.',
    },
    {
      topic: 'استدلال منطقی',
      difficulty: 'hard',
      correctOption: 4,
      trapOption: 1, // Deliberate distractor trap
      questionText: 'سه دوست (آراد، کیان، پارسا) رتبه‌های اول تا سوم شدند. آراد اول نشده و پارسا از کیان جلوتر است و کیان دوم نیست. نفر اول کیست؟',
      options: ['آراد', 'کیان', 'قابل تعیین نیست', 'پارسا'],
      solutionText: 'چون پارسا از کیان جلوتر است، کیان اول نیست و به فرض سوال دوم هم نیست؛ پس کیان سوم است. آراد اول نشده پس آراد دوم و پارسا اول است.',
    },
    {
      topic: 'تاریخ و جغرافیا',
      difficulty: 'easy',
      correctOption: 1,
      questionText: 'کدام رشته کوه در غرب ایران از شمال‌غرب تا جنوب‌غرب امتداد دارد؟',
      options: ['زاگرس', 'البرز', 'بینالود', 'سبلان'],
      solutionText: 'رشته‌کوه زاگرس بزرگ‌ترین رشته‌کوه غرب و جنوب‌غرب فلات ایران است.',
    },
    {
      topic: 'هوش تحلیلی',
      difficulty: 'medium',
      correctOption: 3,
      questionText: 'در یک صف ۱۵ نفره، نفر هفتم از ابتدا، چندمین نفر از انتهای صف است؟',
      options: ['هفتم', 'هشتم', 'نهم', 'دهم'],
      solutionText: 'فرمول موقعیت از انتها برابر (کل - رتبه از ابتدا + ۱) است: 15 - 7 + 1 = 9.',
    },
    {
      topic: 'استدلال منطقی',
      difficulty: 'easy',
      correctOption: 2,
      questionText: 'کدام عدد با بقیه اعداد رابطه متفاوتی دارد؟ (۹، ۱۶، ۲۴، ۳۶)',
      options: ['۹', '۲۴', '۱۶', '۳۶'],
      solutionText: 'اعداد ۹، ۱۶ و ۳۶ مربع کامل هستند اما ۲۴ مربع کامل نیست.',
    },
  ],
};

function buildExamStructure(
  examIdPrefix: string,
  stageShift: number
): {
  booklets: MockExamBooklet[];
  subjects: MockExamSubject[];
  questions: MockExamQuestion[];
} {
  const b1Id = `${examIdPrefix}-b1`;
  const b2Id = `${examIdPrefix}-b2`;
  const booklets: MockExamBooklet[] = [
    {
      id: b1Id,
      title: 'دفترچه اول — دروس تحلیلی (ریاضی و علوم)',
      durationMinutes: 40,
      orderIndex: 0,
    },
    {
      id: b2Id,
      title: 'دفترچه دوم — دروس مهارتی (فارسی و هوش تحلیلی)',
      durationMinutes: 35,
      orderIndex: 1,
    },
  ];

  const subjDefs = [
    { key: 'math', id: `${examIdPrefix}-s-math`, name: 'ریاضی', bookletId: b1Id, coeff: 4 },
    { key: 'science', id: `${examIdPrefix}-s-sci`, name: 'علوم تجربی', bookletId: b1Id, coeff: 3 },
    { key: 'persian', id: `${examIdPrefix}-s-fa`, name: 'فارسی و نگارش', bookletId: b2Id, coeff: 3 },
    { key: 'reasoning', id: `${examIdPrefix}-s-iq`, name: 'هوش و استدلال تحلیلی', bookletId: b2Id, coeff: 2 },
  ];

  const subjects: MockExamSubject[] = [];
  const questions: MockExamQuestion[] = [];
  let qCounter = 1;

  for (const def of subjDefs) {
    const bank = SUBJECT_QUESTION_BANK[def.key];
    const start = qCounter;
    bank.forEach((tpl, idx) => {
      // Shift options slightly per stage for realistic variety while preserving trap markers
      const qNum = qCounter++;
      const rot = (stageShift + idx) % 4;
      const rotateOpt = (opt: MockAnswerOption): MockAnswerOption =>
        ((((opt - 1 + rot) % 4) + 1) as MockAnswerOption);

      const rotatedOptions: [string, string, string, string] = ['', '', '', ''];
      tpl.options.forEach((text, oIdx) => {
        const targetIdx = (oIdx + rot) % 4;
        rotatedOptions[targetIdx] = text;
      });

      questions.push({
        questionNumber: qNum,
        subjectId: def.id,
        correctOption: stageShift === 0 ? tpl.correctOption : rotateOpt(tpl.correctOption),
        topic: tpl.topic,
        difficulty: tpl.difficulty,
        questionText: tpl.questionText,
        options: stageShift === 0 ? tpl.options : rotatedOptions,
        solutionText: tpl.solutionText,
      });
    });

    subjects.push({
      id: def.id,
      bookletId: def.bookletId,
      subjectName: def.name,
      questionStart: start,
      questionEnd: qCounter - 1,
      coefficient: def.coeff,
    });
  }

  return { booklets, subjects, questions };
}

function generateStudentAttemptForExam(params: {
  exam: MockExam;
  student: Student;
  className: string;
  stageSkillBoost: number;
  nowIso: string;
}): MockExamAttempt {
  const { exam, student, className, stageSkillBoost, nowIso } = params;
  const baseHash = deterministicHash(`${student.id}:${exam.id}`);
  // Student innate skill 0.38..0.92 with subtle school/stage progression
  const schoolBonus = student.schoolId === 'school-1' ? 0.03 : student.schoolId === 'school-2' ? 0.05 : 0.01;
  const studentSkill = Math.min(
    0.94,
    Math.max(0.28, 0.42 + ((deterministicHash(student.id) % 45) / 100) + schoolBonus + stageSkillBoost)
  );

  const answers: Record<number, MockAnswerOption | null> = {};

  exam.questions.forEach((q, idx) => {
    const qHash = deterministicHash(`${student.id}:${exam.id}:q${q.questionNumber}`);
    const roll = (qHash % 100) / 100;

    // Deliberately create 3 realistic Trap Questions (questions #2, #7, #17) where wrong option attracts ≥40%
    const isIntentionalTrap =
      q.questionNumber === 2 || q.questionNumber === 7 || q.questionNumber === 17;
    if (isIntentionalTrap) {
      const trapOpt = (((q.correctOption) % 4) + 1) as MockAnswerOption;
      if (roll < 0.28 + studentSkill * 0.22) {
        answers[q.questionNumber] = q.correctOption;
      } else if (roll < 0.88) {
        answers[q.questionNumber] = trapOpt; // strong distractor (>42% of cohort!)
      } else {
        answers[q.questionNumber] = null;
      }
      return;
    }

    const diffPenalty = q.difficulty === 'hard' ? 0.16 : q.difficulty === 'medium' ? 0.05 : -0.08;
    const correctProb = Math.min(0.95, Math.max(0.18, studentSkill - diffPenalty));
    const blankProb = q.difficulty === 'hard' ? 0.18 : 0.1;

    if (roll < correctProb) {
      answers[q.questionNumber] = q.correctOption;
    } else if (roll < correctProb + blankProb) {
      answers[q.questionNumber] = null;
    } else {
      const wrongChoices = ([1, 2, 3, 4] as const).filter((o) => o !== q.correctOption);
      answers[q.questionNumber] = wrongChoices[(qHash + idx) % wrongChoices.length];
    }
  });

  const entryMethod: MockExamAttempt['entryMethod'] =
    baseHash % 3 === 0 ? 'paper_keyboard' : 'online';

  return {
    id: `attempt-${exam.id}-${student.id}`,
    complexId: DEFAULT_COMPLEX_ID,
    schoolId: student.schoolId,
    academicYearId: exam.academicYearId,
    examId: exam.id,
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    className,
    entryMethod,
    status: 'submitted',
    answers,
    flaggedQuestions: [],
    eliminatedOptions: {},
    tabSwitchCount: entryMethod === 'online' ? (baseHash % 7 === 0 ? 2 : 0) : 0,
    activeBookletIndex: exam.booklets.length - 1,
    startedAtIso: nowIso,
    submittedAtJalali: exam.examDateJalali,
    createdByUserId: student.id,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
}

export function generatePhase9ASeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
}): Phase9ASeedOutput {
  const { schools, classes, students } = params;
  const nowIso = '2025-12-20T09:00:00.000Z';
  const academic_years: AcademicYear[] = generateSeedAcademicYears(nowIso);

  const classMap = new Map<string, string>(classes.map((c) => [c.id, c.name]));

  // Select representative cohort of students per school (up to 14 per school = ~42 total across 3 schools)
  // Always include the first 4 students of every school so default demo student & parent accounts have rich 3-stage data!
  const cohortStudents: Student[] = [];
  for (const school of schools) {
    const scStudents = students.filter((s) => s.schoolId === school.id && s.active);
    cohortStudents.push(...scStudents.slice(0, 14));
  }

  const s1Struct = buildExamStructure('mock-1404-s1', 0);
  const s2Struct = buildExamStructure('mock-1404-s2', 1);
  const s3Struct = buildExamStructure('mock-1404-s3', 2);
  const s4Struct = buildExamStructure('mock-1404-s4', 3);
  const archStruct = buildExamStructure('mock-1403-arch', 1);

  const examStage1: MockExam = {
    id: 'mock-exam-stage-1',
    complexId: DEFAULT_COMPLEX_ID,
    schoolId: GLOBAL_TENANT_ID,
    academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
    title: 'آزمون آزمایشی جامع مرحله ۱ — سنجش آغازین مهر',
    stageNumber: 1,
    stageLabelFa: 'مرحله ۱ - مهر',
    examDateJalali: '1404/07/25',
    scope: 'complex',
    track: 'general_elementary',
    negativeMarking: 'three_to_one',
    mode: 'online_full',
    shuffleOptions: false,
    status: 'published',
    ...s1Struct,
    createdByUserId: 'user-complex-admin',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  const examStage2: MockExam = {
    id: 'mock-exam-stage-2',
    complexId: DEFAULT_COMPLEX_ID,
    schoolId: GLOBAL_TENANT_ID,
    academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
    title: 'آزمون آزمایشی جامع مرحله ۲ — پایش میان‌ترم آذر',
    stageNumber: 2,
    stageLabelFa: 'مرحله ۲ - آذر',
    examDateJalali: '1404/09/14',
    scope: 'complex',
    track: 'general_elementary',
    negativeMarking: 'three_to_one',
    mode: 'online_full',
    shuffleOptions: false,
    status: 'published',
    ...s2Struct,
    createdByUserId: 'user-complex-admin',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  const examStage3: MockExam = {
    id: 'mock-exam-stage-3',
    complexId: DEFAULT_COMPLEX_ID,
    schoolId: GLOBAL_TENANT_ID,
    academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
    title: 'آزمون آزمایشی جامع مرحله ۳ — آزمون هماهنگ ۳ مدرسه (ویژه دی)',
    stageNumber: 3,
    stageLabelFa: 'مرحله ۳ - دی',
    examDateJalali: '1404/10/19',
    scope: 'complex',
    track: 'general_elementary',
    negativeMarking: 'three_to_one',
    mode: 'online_full',
    shuffleOptions: false,
    status: 'published',
    ...s3Struct,
    createdByUserId: 'user-complex-admin',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  // Stage 4: Active online Konkur exam ready for students to take live right now!
  const examStage4Active: MockExam = {
    id: 'mock-exam-stage-4-active',
    complexId: DEFAULT_COMPLEX_ID,
    schoolId: GLOBAL_TENANT_ID,
    academicYearId: DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
    title: 'آزمون آزمایشی آنلاین مرحله ۴ — شبیه‌ساز کنکور بهمن (در حال برگزاری)',
    stageNumber: 4,
    stageLabelFa: 'مرحله ۴ - بهمن',
    examDateJalali: '1404/11/17',
    scope: 'complex',
    track: 'general_elementary',
    negativeMarking: 'three_to_one',
    mode: 'online_full',
    shuffleOptions: true,
    status: 'active',
    ...s4Struct,
    createdByUserId: 'user-complex-admin',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  // Archived 1403-1404 exam to verify Multi-Academic-Year read-only isolation
  const examArchived1403: MockExam = {
    id: 'mock-exam-1403-final',
    complexId: DEFAULT_COMPLEX_ID,
    schoolId: GLOBAL_TENANT_ID,
    academicYearId: ARCHIVED_ACADEMIC_YEAR_ID,
    title: 'آزمون آزمایشی جامع پایانی — آرشیو سال تحصیلی ۱۴۰۳-۱۴۰۴',
    stageNumber: 1,
    stageLabelFa: 'آرشیو خرداد ۱۴۰۴',
    examDateJalali: '1404/03/10',
    scope: 'complex',
    track: 'general_elementary',
    negativeMarking: 'three_to_one',
    mode: 'answer_key_only',
    shuffleOptions: false,
    status: 'published',
    ...archStruct,
    createdByUserId: 'user-complex-admin',
    createdAtIso: '2025-05-31T08:00:00.000Z',
    updatedAtIso: '2025-05-31T08:00:00.000Z',
  };

  const mock_exams: MockExam[] = [
    examStage1,
    examStage2,
    examStage3,
    examStage4Active,
    examArchived1403,
  ];

  const mock_exam_attempts: MockExamAttempt[] = [];

  for (const student of cohortStudents) {
    const className = classMap.get(student.classId) ?? 'کلاس';
    // Stage 1 -> Stage 2 -> Stage 3 progressive growth
    mock_exam_attempts.push(
      generateStudentAttemptForExam({
        exam: examStage1,
        student,
        className,
        stageSkillBoost: -0.05,
        nowIso,
      })
    );
    mock_exam_attempts.push(
      generateStudentAttemptForExam({
        exam: examStage2,
        student,
        className,
        stageSkillBoost: 0.01,
        nowIso,
      })
    );
    mock_exam_attempts.push(
      generateStudentAttemptForExam({
        exam: examStage3,
        student,
        className,
        stageSkillBoost: 0.06,
        nowIso,
      })
    );
    // Archived year attempts (first 8 per school)
    if (deterministicHash(student.id) % 2 === 0 || student.id.endsWith('-1')) {
      mock_exam_attempts.push(
        generateStudentAttemptForExam({
          exam: examArchived1403,
          student,
          className,
          stageSkillBoost: -0.02,
          nowIso: '2025-05-31T10:00:00.000Z',
        })
      );
    }
  }

  return {
    academic_years,
    mock_exams,
    mock_exam_attempts,
  };
}
