// Deterministic realistic Persian seed data for Phase 6 across all 3 isolated schools:
// 1. Integrated Finance & Tuition (Fee plans, student ledgers, installments, trips, payments, expenses)
// 2. Smart Analytics (Approved Remedial Plans)
// 3. Privacy-First Anonymous Surveys (Active & Completed surveys + strictly anonymous responses)
import { toPersianDigits } from '../../lib/digits';
import type {
  AnonymousSurvey,
  ClassRoom,
  FinanceDiscountItem,
  FinanceExpenseCategory,
  FinanceExpenseRecord,
  FinanceFeeExtraItem,
  FinanceFeePlan,
  FinanceInstallmentItem,
  FinancePaymentMethod,
  FinancePaymentRecord,
  FinanceStudentLedger,
  FinanceTripFeeItem,
  RemedialPlanRecord,
  School,
  Student,
  SurveyAnonymousResponse,
  SurveyParticipationReceipt,
  Teacher,
} from '../../types/domain';

export const PHASE6_PLUGIN_IDS = ['finance', 'smart-analytics', 'anonymous-surveys'] as const;

export interface Phase6SeedBundle {
  finance_fee_plans: FinanceFeePlan[];
  finance_student_ledgers: FinanceStudentLedger[];
  finance_payments: FinancePaymentRecord[];
  finance_expenses: FinanceExpenseRecord[];
  remedial_plans: RemedialPlanRecord[];
  anonymous_surveys: AnonymousSurvey[];
  survey_participation_receipts: SurveyParticipationReceipt[];
  survey_anonymous_responses: SurveyAnonymousResponse[];
}

const INSTALLMENT_MONTHS: Array<{ title: string; dueDate: string }> = [
  { title: 'قسط اول - مهر', dueDate: '1405/07/10' },
  { title: 'قسط دوم - آبان', dueDate: '1405/08/10' },
  { title: 'قسط سوم - آذر', dueDate: '1405/09/15' },
  { title: 'قسط چهارم - دی', dueDate: '1405/10/15' },
  { title: 'قسط پنجم - بهمن', dueDate: '1405/11/15' },
  { title: 'قسط ششم - اسفند', dueDate: '1405/12/15' },
];

const BASE_TUITION_BY_GRADE: Record<2 | 3 | 4 | 5 | 6, number> = {
  2: 24_000_000,
  3: 25_500_000,
  4: 27_000_000,
  5: 28_500_000,
  6: 30_000_000,
};

const SCHOOL_TUITION_OFFSET: Record<string, number> = {
  'school-1': 0,
  'school-2': 1_500_000,
  'school-3': 3_000_000,
};

const PAYMENT_METHODS_CYCLE: FinancePaymentMethod[] = [
  'pos',
  'card_to_card',
  'online_sim',
  'cheque',
  'cash',
];

const EXPENSE_TEMPLATES: Array<{
  category: FinanceExpenseCategory;
  title: string;
  baseAmount: number;
  jalaliDate: string;
  description: string;
}> = [
  {
    category: 'salary',
    title: 'حقوق و حق‌التدریس کادر آموزشی (مهر)',
    baseAmount: 92_000_000,
    jalaliDate: '1405/07/28',
    description: 'پرداخت حقوق ماهانه معلمان رسمی، حق‌التدریس و کادر اجرایی واحد.',
  },
  {
    category: 'salary',
    title: 'حقوق و حق‌التدریس کادر آموزشی (آبان)',
    baseAmount: 95_000_000,
    jalaliDate: '1405/08/28',
    description: 'تسویه لیست حقوق آبان‌ماه و پاداش حضور کامل.',
  },
  {
    category: 'rent_utilities',
    title: 'اجاره ساختمان و قبوض آب، برق و گاز (پاییز)',
    baseAmount: 42_000_000,
    jalaliDate: '1405/08/20',
    description: 'هزینه نگهداری فضای آموزشی، اینترنت فیبر نوری و قبوض انرژی.',
  },
  {
    category: 'equipment_repairs',
    title: 'تعمیر ویدئوپروژکتورها و به‌روزرسانی تخته هوشمند',
    baseAmount: 19_500_000,
    jalaliDate: '1405/09/12',
    description: 'سرویس دوره‌ای تجهیزات هوشمند کلاس‌های پایه سوم تا ششم.',
  },
  {
    category: 'trips_catering',
    title: 'ایاب‌وذهاب و پذیرایی اردوی علمی دانش‌آموزان',
    baseAmount: 14_000_000,
    jalaliDate: '1405/09/22',
    description: 'کرایه اتوبوس‌های استاندارد و بسته میان‌وعده سلامت.',
  },
  {
    category: 'office_supplies',
    title: 'خرید کاغذ A4/A5، تونر چاپگر و ملزومات امتحانات',
    baseAmount: 11_200_000,
    jalaliDate: '1405/10/10',
    description: 'تامین ملزومات چاپی کارنامه‌ها، برگه‌های آزمون حضوری و دفتر کلاسی.',
  },
  {
    category: 'salary',
    title: 'پاداش و حق‌الزحمه فعالیت‌های فوق‌برنامه (پاییز)',
    baseAmount: 48_000_000,
    jalaliDate: '1405/10/25',
    description: 'حق‌التدریس کلاس‌های فوق‌برنامه و کارگاه‌های مهارتی نیمسال اول.',
  },
  {
    category: 'other',
    title: 'بیمه حوادث دانش‌آموزی و جعبه کمک‌های اولیه',
    baseAmount: 9_500_000,
    jalaliDate: '1405/11/05',
    description: 'تمدید پوشش بیمه حوادث تحصیلی و شارژ اقلام اتاق بهداشت.',
  },
];

const ANONYMOUS_COMMENTS_BY_SCHOOL: Record<string, string[]> = {
  'school-1': [
    'اطلاع‌رسانی منظم معلم پایه دوم در چت کلاسی و پیگیری تکالیف بسیار ارزشمند است.',
    'پیشنهاد می‌شود ساعت زنگ ورزش و فعالیت‌های آزمایشگاهی در نیمسال دوم کمی بیشتر شود.',
    'استفاده از ویدیوهای کلاس وارونه قبل از تدریس ریاضی به درک بهتر فرزندم کمک زیادی کرد.',
    'نوبت‌دهی آنلاین جلسات اولیا و مربیان باعث صرفه‌جویی عالی در زمان خانواده‌ها شد.',
    'درخواست داریم منوی تغذیه سالم بوفه مدرسه تنوع بیشتری داشته باشد.',
    'برخورد محترمانه کادر اجرایی و نظم هنگام تعطیلی مدرسه واقعاً قابل تحسین است.',
  ],
  'school-2': [
    'کیفیت تدریس دروس فارسی و علوم در این واحد آموزشی بسیار بالاست.',
    'پیشنهاد می‌کنیم کارگاه‌های مهارت‌آموزی و نقاشی خلاق در فوق‌برنامه اضافه شود.',
    'شفافیت گزارش‌های کارنامه مستمر در پنل خانواده آرامش خاطر خوبی ایجاد کرده است.',
    'سرعت پاسخ‌گویی معلمان در گفت‌وگوی اختصاصی اولیا عالی است.',
    'لطفا اطلاع‌رسانی تاریخ اردوهای علمی حداقل یک هفته زودتر انجام شود.',
    'فضای صمیمی و ایمن مدرسه باعث علاقه زیاد فرزندم به حضور در کلاس شده است.',
  ],
  'school-3': [
    'رویکرد پژوهش‌محور و پروژه‌های عملی علوم تجربی انگیزه یادگیری دانش‌آموزان را دوچندان کرده است.',
    'تجهیزات کارگاه فناوری عالی است؛ پیشنهاد می‌شود زمان تمرین عملی بیشتر شود.',
    'هماهنگی سرویس مدرسه در روزهای بارانی نیاز به اطلاع‌رسانی دقیق‌تر دارد.',
    'آزمون‌های آنلاین تمرینی استرس امتحانات حضوری را به‌شدت کاهش داده است.',
    'از تلاش مدیریت و معلمان برای برگزاری کارگاه‌های مهارت زندگی سپاسگزاریم.',
    'پیشنهاد می‌شود جلسات مشاوره تحصیلی فردی در پایان هر فصل برگزار شود.',
  ],
};

export function generatePhase6SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
}): Phase6SeedBundle {
  const { schools, classes, students, teachers } = params;
  const nowIso = new Date().toISOString();

  const finance_fee_plans: FinanceFeePlan[] = [];
  const finance_student_ledgers: FinanceStudentLedger[] = [];
  const finance_payments: FinancePaymentRecord[] = [];
  const finance_expenses: FinanceExpenseRecord[] = [];
  const remedial_plans: RemedialPlanRecord[] = [];
  const anonymous_surveys: AnonymousSurvey[] = [];
  const survey_participation_receipts: SurveyParticipationReceipt[] = [];
  const survey_anonymous_responses: SurveyAnonymousResponse[] = [];

  schools.forEach((school, schoolIdx) => {
    const schoolId = school.id;
    const schoolClasses = classes.filter((c) => c.schoolId === schoolId);
    const schoolStudents = students.filter((s) => s.schoolId === schoolId && s.active);
    const schoolTeachers = teachers.filter((t) => t.schoolId === schoolId && t.active);
    const classById = new Map(schoolClasses.map((c) => [c.id, c]));
    const tuitionOffset = SCHOOL_TUITION_OFFSET[schoolId] ?? 0;

    // 1. Seed Base Fee Plans per grade (grades 2..6)
    const grades: Array<2 | 3 | 4 | 5 | 6> = [2, 3, 4, 5, 6];
    const planByGrade = new Map<number, FinanceFeePlan>();

    grades.forEach((grade) => {
      const extraItems: FinanceFeeExtraItem[] = [
        {
          id: `${schoolId}-ext-${grade}-1`,
          type: 'extracurricular',
          title: 'فوق‌برنامه زبان و مهارت‌های هوشمند',
          amountToman: 4_200_000,
          optional: true,
        },
        {
          id: `${schoolId}-ext-${grade}-2`,
          type: 'books',
          title: 'کتاب‌های کار و جزوات کمک‌آموزشی',
          amountToman: 1_800_000,
          optional: false,
        },
        {
          id: `${schoolId}-ext-${grade}-3`,
          type: 'transport',
          title: 'سرویس ایاب‌وذهاب رفت‌وبرگشت',
          amountToman: 9_000_000,
          optional: true,
        },
        {
          id: `${schoolId}-ext-${grade}-4`,
          type: 'trip_activity',
          title: 'بسته فعالیت‌های پژوهشی و اردوهای فصلی',
          amountToman: 1_500_000,
          optional: true,
        },
      ];

      const plan: FinanceFeePlan = {
        id: `${schoolId}:feeplan:grade-${grade}`,
        schoolId,
        academicYear: school.academicYear,
        gradeLevel: grade,
        title: `تعرفه شهریه پایه ${toPersianDigits(grade)} (${toPersianDigits(school.academicYear)})`,
        baseTuitionToman: BASE_TUITION_BY_GRADE[grade] + tuitionOffset,
        extraItems,
        defaultInstallmentsCount: 6,
        updatedByName: school.principalName,
        updatedAt: nowIso,
      };
      finance_fee_plans.push(plan);
      planByGrade.set(grade, plan);
    });

    // 2. Seed Student Ledgers & Payments across all 25 students in each school
    // Vary collection profiles across the 3 schools so complex_admin comparison is realistic:
    // school-1 ~74% collected, school-2 ~83% collected, school-3 ~67% collected
    let receiptSeq = 1001 + schoolIdx * 500;

    schoolStudents.forEach((student, sIdx) => {
      const cls = classById.get(student.classId);
      const grade = (cls?.gradeLevel ?? 2) as 2 | 3 | 4 | 5 | 6;
      const plan = planByGrade.get(grade)!;

      // Mandatory books + extracurricular for most, transport for ~40%
      const selectedExtras: FinanceFeeExtraItem[] = [
        plan.extraItems[1], // books
        ...(sIdx % 3 !== 2 ? [plan.extraItems[0]] : []), // extracurricular
        ...(sIdx % 5 === 0 || sIdx % 5 === 2 ? [plan.extraItems[2]] : []), // transport
      ];

      // Realistic discounts for ~30% of students
      const discounts: FinanceDiscountItem[] = [];
      if (sIdx % 7 === 1) {
        discounts.push({
          id: `${schoolId}-disc-${student.id}-1`,
          type: 'sibling',
          title: 'تخفیف چندفرزندی (۱۰٪)',
          mode: 'percent',
          value: 10,
        });
      } else if (sIdx % 9 === 3) {
        discounts.push({
          id: `${schoolId}-disc-${student.id}-2`,
          type: 'talented',
          title: 'تخفیف استعداد درخشان (۱۵٪)',
          mode: 'percent',
          value: 15,
        });
      } else if (sIdx % 11 === 5) {
        discounts.push({
          id: `${schoolId}-disc-${student.id}-3`,
          type: 'staff_special',
          title: 'تخفیف پرسنلی / موردی',
          mode: 'fixed',
          value: 3_000_000,
        });
      }

      const extrasTotal = selectedExtras.reduce((acc, ex) => acc + ex.amountToman, 0);
      const grossTotal = plan.baseTuitionToman + extrasTotal;
      const discountTotal = discounts.reduce((acc, d) => {
        if (d.mode === 'percent') return acc + Math.round((plan.baseTuitionToman * d.value) / 100);
        return acc + d.value;
      }, 0);
      const netTotal = Math.max(0, grossTotal - discountTotal);

      // Split into 6 clean installments
      const count = 6;
      const baseShare = Math.floor(netTotal / count / 100_000) * 100_000;
      const remainder = netTotal - baseShare * count;

      // Determine how many installments are paid/partial/overdue based on schoolIdx & sIdx
      // Always give student[0] (امیرعلی احمدی — demo parent1!) 1 paid (مهر), qest 2 (آبان - 1405/08/10) overdue, qest 3..6 upcoming + open trip fee!
      let paidCount = 4;
      let hasPartial = false;
      let hasOverdue = false;

      if (sIdx === 0) {
        paidCount = 1;
        hasPartial = false;
        hasOverdue = true; // قسط دوم (آبان - 1405/08/10) معوق -> great for Debtors & Parent Online Payment Simulator!
      } else if (schoolIdx === 1) {
        // School 2 has highest collection rate (~75%) and fewest overdue accounts
        paidCount = sIdx % 6 === 0 ? 1 : sIdx % 3 === 0 ? 6 : 5;
        hasOverdue = paidCount < 2;
        hasPartial = sIdx % 9 === 2 && paidCount < 6;
      } else if (schoolIdx === 2) {
        // School 3 has more overdue receivables (~52% collected)
        paidCount = sIdx % 3 === 0 ? 1 : sIdx % 4 === 0 ? 6 : 3;
        hasOverdue = paidCount < 2;
        hasPartial = sIdx % 5 === 1 && paidCount < 6;
      } else {
        // School 1 balanced realistic mix (~62% collected, ~8 overdue debtors)
        paidCount = sIdx % 3 === 0 ? 1 : sIdx % 5 === 0 ? 6 : 4;
        hasOverdue = paidCount < 2;
        hasPartial = sIdx % 7 === 2 && paidCount < 6;
      }

      const installments: FinanceInstallmentItem[] = INSTALLMENT_MONTHS.map((m, i) => {
        const amountToman = i === count - 1 ? baseShare + remainder : baseShare;
        const instId = `${schoolId}-inst-${student.id}-${i + 1}`;

        if (i < paidCount) {
          const payDate = m.dueDate.replace(/\/(10|15)$/, `/${String(10 + ((sIdx + i) % 12)).padStart(2, '0')}`);
          const method = PAYMENT_METHODS_CYCLE[(sIdx + i) % PAYMENT_METHODS_CYCLE.length];
          const rNum = `F-${schoolIdx + 1}-${receiptSeq++}`;
          finance_payments.push({
            id: `${schoolId}-pay-${student.id}-${i + 1}`,
            schoolId,
            receiptNumber: rNum,
            studentId: student.id,
            classId: student.classId,
            ledgerId: `${schoolId}:ledger:${student.id}`,
            targetType: 'tuition',
            installmentId: instId,
            targetTitle: m.title,
            amountToman,
            jalaliDate: payDate,
            method,
            chequeDueDateJalali: method === 'cheque' ? m.dueDate : undefined,
            chequeStatus: method === 'cheque' ? (i < paidCount - 1 ? 'cleared' : 'in_progress') : undefined,
            trackingCode: `${(schoolIdx + 1) * 100000 + receiptSeq * 13}`,
            notes: method === 'online_sim' ? 'پرداخت از طریق درگاه آنلاین اولیا' : 'ثبت توسط امور مالی مدرسه',
            recordedBy: method === 'online_sim' ? student.parentName : school.principalName,
            recordedByRole: method === 'online_sim' ? 'parent' : 'principal',
            createdAt: nowIso,
          });
          return {
            id: instId,
            order: i + 1,
            title: m.title,
            dueDateJalali: m.dueDate,
            amountToman,
            paidAmountToman: amountToman,
            status: 'paid',
            paidDateJalali: payDate,
          };
        }

        if (i === paidCount && hasPartial) {
          const partialAmt = Math.round((amountToman * 0.5) / 100_000) * 100_000;
          const rNum = `F-${schoolIdx + 1}-${receiptSeq++}`;
          finance_payments.push({
            id: `${schoolId}-pay-${student.id}-part-${i + 1}`,
            schoolId,
            receiptNumber: rNum,
            studentId: student.id,
            classId: student.classId,
            ledgerId: `${schoolId}:ledger:${student.id}`,
            targetType: 'tuition',
            installmentId: instId,
            targetTitle: `${m.title} (علی‌الحساب)`,
            amountToman: partialAmt,
            jalaliDate: m.dueDate,
            method: 'card_to_card',
            trackingCode: `${(schoolIdx + 1) * 100000 + receiptSeq * 17}`,
            notes: 'پرداخت جزئی قسط',
            recordedBy: school.principalName,
            recordedByRole: 'principal',
            createdAt: nowIso,
          });
          return {
            id: instId,
            order: i + 1,
            title: m.title,
            dueDateJalali: m.dueDate,
            amountToman,
            paidAmountToman: partialAmt,
            status: 'partial',
          };
        }

        // Overdue if due date is on or before 1405/08/10 and unpaid
        const isPastDue = i <= 1 && (hasOverdue || i < 2);
        return {
          id: instId,
          order: i + 1,
          title: m.title,
          dueDateJalali: m.dueDate,
          amountToman,
          paidAmountToman: 0,
          status: isPastDue ? 'overdue' : 'pending',
        };
      });

      // Trip / Activity Fees for online payment simulation
      const tripFees: FinanceTripFeeItem[] = [
        {
          id: `${schoolId}-trip-${student.id}-1`,
          title: 'اردوی علمی و تفریحی باغ کتاب (بهمن ۱۴۰۵)',
          dueDateJalali: '1405/11/20',
          amountToman: 650_000,
          paidAmountToman: sIdx > 0 && sIdx % 3 === 0 ? 650_000 : 0,
          status: sIdx > 0 && sIdx % 3 === 0 ? 'paid' : 'pending',
          paidDateJalali: sIdx > 0 && sIdx % 3 === 0 ? '1405/11/02' : undefined,
          trackingCode: sIdx > 0 && sIdx % 3 === 0 ? `TR-${(schoolIdx + 1) * 1000 + sIdx}` : undefined,
        },
        {
          id: `${schoolId}-trip-${student.id}-2`,
          title: 'کارگاه عملی رباتیک و آزمایشگاه خلاق',
          dueDateJalali: '1405/12/05',
          amountToman: 850_000,
          paidAmountToman: sIdx % 4 === 1 ? 850_000 : 0,
          status: sIdx % 4 === 1 ? 'paid' : 'pending',
          paidDateJalali: sIdx % 4 === 1 ? '1405/11/06' : undefined,
          trackingCode: sIdx % 4 === 1 ? `RB-${(schoolIdx + 1) * 1000 + sIdx}` : undefined,
        },
      ];

      finance_student_ledgers.push({
        id: `${schoolId}:ledger:${student.id}`,
        schoolId,
        studentId: student.id,
        classId: student.classId,
        academicYear: school.academicYear,
        baseTuitionToman: plan.baseTuitionToman,
        selectedExtras,
        discounts,
        installments,
        tripFees,
        updatedAt: nowIso,
      });
    });

    // 3. Seed School Operational Expenses across Jalali months
    const expenseScale = schoolIdx === 0 ? 1 : schoolIdx === 1 ? 1.06 : 1.12;
    EXPENSE_TEMPLATES.forEach((tpl, eIdx) => {
      finance_expenses.push({
        id: `${schoolId}-exp-${eIdx + 1}`,
        schoolId,
        category: tpl.category,
        title: tpl.title,
        amountToman: Math.round((tpl.baseAmount * expenseScale) / 100_000) * 100_000,
        jalaliDate: tpl.jalaliDate,
        voucherNumber: `S-${schoolIdx + 1}-${140501 + eIdx}`,
        description: tpl.description,
        recordedBy: school.principalName,
        createdAt: nowIso,
      });
    });

    // 4. Seed Initial Approved Remedial Plans for Smart Analytics
    if (schoolStudents.length >= 6 && schoolTeachers.length >= 3) {
      remedial_plans.push(
        {
          id: `${schoolId}-rem-1`,
          schoolId,
          studentId: schoolStudents[1].id,
          classId: schoolStudents[1].classId,
          subject: 'ریاضی',
          teacherId: schoolTeachers[0].id,
          teacherName: schoolTeachers[0].fullName,
          reasons: [
            '۳ غیبت متوالی و افت ۲٫۵ نمره‌ای در ارزشیابی اخیر',
            'نیاز به مرور تمرین‌های فصل کسر و اندازه‌گیری',
          ],
          status: 'in_progress',
          notes: 'برگزاری ۲ جلسه ۳۰ دقیقه‌ای تقویتی در زنگ آخر سه‌شنبه و پنج‌شنبه',
          createdBy: school.principalName,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: `${schoolId}-rem-2`,
          schoolId,
          studentId: schoolStudents[6]?.id ?? schoolStudents[2].id,
          classId: schoolStudents[6]?.classId ?? schoolStudents[2].classId,
          subject: 'علوم تجربی',
          teacherId: schoolTeachers[1].id,
          teacherName: schoolTeachers[1].fullName,
          reasons: ['امتیاز پایین در آزمونک کلاس وارونه و ۲ تکلیف تحویل‌نشده'],
          status: 'planned',
          notes: 'هماهنگی با ولی جهت تکمیل تمرین‌های تعاملی در منزل',
          createdBy: school.principalName,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      );
    }

    // 5. Seed Privacy-First Anonymous Surveys (1 Completed Cross-School + 1 Active Multi-Role)
    const closedSurveyId = `${schoolId}-survey-parent-sat-1405`;
    const activeSurveyId = `${schoolId}-survey-active-1405`;

    const closedSurvey: AnonymousSurvey = {
      id: closedSurveyId,
      schoolId,
      groupKey: 'complex-parent-sat-1405',
      title: 'سنجش رضایت اولیا از کیفیت آموزش و ارتباط با مدرسه (نیمسال اول)',
      description:
        'این نظرسنجی به‌صورت کاملاً بی‌نام جهت ارتقای کیفیت تدریس، ارتباط اولیا و امکانات آموزشی در هر ۳ واحد مجموعه برگزار شده است.',
      targetRoles: ['parent'],
      questions: [
        {
          id: 'q1',
          prompt: 'میزان رضایت شما از کیفیت تدریس و پیگیری تحصیلی معلمان چقدر است؟',
          type: 'likert_5',
          required: true,
        },
        {
          id: 'q2',
          prompt: 'اطلاع‌رسانی مدرسه و پاسخ‌گویی در گفت‌وگوی اختصاصی اولیا را چگونه ارزیابی می‌کنید؟',
          type: 'likert_5',
          required: true,
        },
        {
          id: 'q3',
          prompt: 'کدام بخش سامانه بیشترین کمک را به پیگیری وضعیت فرزند شما کرده است؟',
          type: 'multiple_choice',
          required: true,
          options: [
            'پنل خانواده و کارنامه مستمر',
            'گفت‌وگوی اختصاصی با معلم و مدیر',
            'کلاس وارونه و تکالیف آنلاین',
            'رزرو آنلاین جلسات اولیا',
          ],
        },
        {
          id: 'q4',
          prompt: 'آیا برگزاری جلسات مشاوره تحصیلی ماهانه را مفید می‌دانید؟',
          type: 'yes_no',
          required: true,
        },
        {
          id: 'q5',
          prompt: 'پیشنهاد یا انتقاد سازنده شما برای نیمسال دوم چیست؟ (کاملاً ناشناس)',
          type: 'open_text',
          required: false,
        },
      ],
      startDateJalali: '1405/09/20',
      endDateJalali: '1405/10/10',
      minAnonymityThreshold: 3,
      status: 'closed',
      createdByName: 'دکتر محمدرضا کریمی (دفتر مرکزی)',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const activeSurvey: AnonymousSurvey = {
      id: activeSurveyId,
      schoolId,
      groupKey: 'complex-climate-1405',
      title: 'نظرسنجی ناشناس ارزیابی برنامه‌ها، فضای آموزشی و امکانات نیمسال دوم',
      description:
        'پاسخ‌های شما بدون ثبت هیچ‌گونه نام یا شناسه شخصی برای بهبود برنامه‌های فوق‌برنامه، اردوها و محیط کلاس‌ها بررسی می‌شود.',
      targetRoles: ['parent', 'teacher', 'student'],
      questions: [
        {
          id: 'aq1',
          prompt: 'کیفیت فضای آموزشی، نظم و آرامش کلاس‌ها را چگونه ارزیابی می‌کنید؟',
          type: 'likert_5',
          required: true,
        },
        {
          id: 'aq2',
          prompt: 'رضایت شما از تنوع فعالیت‌های فوق‌برنامه و اردوهای علمی چقدر است؟',
          type: 'likert_5',
          required: true,
        },
        {
          id: 'aq3',
          prompt: 'اولویت اصلی مدرسه در نیمسال دوم کدام مورد باشد؟',
          type: 'multiple_choice',
          required: true,
          options: [
            'افزایش کارگاه‌های عملی و آزمایشگاهی',
            'تقویت کلاس‌های حل تمرین و رفع اشکال',
            'گسترش فعالیت‌های ورزشی و هنری',
            'برگزاری اردوهای علمی و فرهنگی بیشتر',
          ],
        },
        {
          id: 'aq4',
          prompt: 'آیا با تداوم آزمونک‌های آنلاین تمرینی موافق هستید؟',
          type: 'yes_no',
          required: true,
        },
        {
          id: 'aq5',
          prompt: 'دیدگاه یا پیشنهاد ناشناس خود را بنویسید:',
          type: 'open_text',
          required: false,
        },
      ],
      startDateJalali: '1405/11/01',
      endDateJalali: '1405/12/20',
      minAnonymityThreshold: 3,
      status: 'active',
      createdByName: school.principalName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    anonymous_surveys.push(closedSurvey, activeSurvey);

    // Seed 6 strictly anonymous responses per school for the completed cross-school survey
    // Slightly different score distributions across schools so 3-school SVG chart looks authentic!
    const comments = ANONYMOUS_COMMENTS_BY_SCHOOL[schoolId] ?? ANONYMOUS_COMMENTS_BY_SCHOOL['school-1'];
    const q3Options = closedSurvey.questions[2].options!;
    const ratingMatrix =
      schoolIdx === 0
        ? [
            [5, 5],
            [4, 5],
            [5, 4],
            [4, 4],
            [5, 4],
            [3, 4],
          ]
        : schoolIdx === 1
          ? [
              [5, 5],
              [5, 5],
              [5, 4],
              [4, 5],
              [5, 5],
              [4, 4],
            ]
          : [
              [4, 4],
              [4, 3],
              [5, 4],
              [3, 4],
              [4, 4],
              [5, 3],
            ];

    ratingMatrix.forEach(([r1, r2], idx) => {
      survey_anonymous_responses.push({
        id: `anon-${schoolId}-closed-${idx + 1}`,
        schoolId,
        surveyId: closedSurveyId,
        audienceRole: 'parent',
        answers: {
          q1: r1,
          q2: r2,
          q3: q3Options[idx % q3Options.length],
          q4: idx === 5 ? 'خیر' : 'بله',
          q5: comments[idx] ?? '',
        },
        openComment: comments[idx],
        submittedDayBucket: `1405/09/${String(22 + (idx % 7)).padStart(2, '0')}`,
        reviewStatus: idx === 0 ? 'reviewed' : idx === 1 ? 'in_followup' : 'new',
        internalManagementNote:
          idx === 1 ? 'در جلسه شورای مدرسه جهت بررسی زمان ورزش مطرح شد.' : undefined,
      });
    });

    // Seed 3 strictly anonymous responses for the active survey (from non-demo opaque keys so demo parent1/student1/teacher1 can still vote!)
    const activeRoles: Array<'parent' | 'teacher' | 'student'> = ['parent', 'teacher', 'student'];
    const activeComments = [
      'برگزاری کلاس‌های حل تمرین ریاضی قبل از امتحانات بسیار کمک‌کننده است.',
      'هماهنگی برنامه هفتگی و پشتیبانی فنی کلاس‌های هوشمند مطلوب است.',
      'دوست داریم زنگ کارگاه رباتیک و بازی‌های آموزشی بیشتر شود.',
    ];
    activeRoles.forEach((role, idx) => {
      survey_anonymous_responses.push({
        id: `anon-${schoolId}-active-${idx + 1}`,
        schoolId,
        surveyId: activeSurveyId,
        audienceRole: role,
        answers: {
          aq1: 4 + (idx % 2),
          aq2: 4 + ((idx + schoolIdx) % 2),
          aq3: activeSurvey.questions[2].options![idx % 4],
          aq4: 'بله',
          aq5: activeComments[idx],
        },
        openComment: activeComments[idx],
        submittedDayBucket: `1405/11/0${idx + 2}`,
        reviewStatus: 'new',
      });
      // Receipt uses opaque seeded participant keys unrelated to demo logins
      survey_participation_receipts.push({
        id: `${schoolId}:receipt:${activeSurveyId}:seeded-anon-${idx + 1}`,
        schoolId,
        surveyId: activeSurveyId,
        participantKey: `seeded-anon-${idx + 1}`,
        submittedDateJalali: `1405/11/0${idx + 2}`,
      });
    });
  });

  return {
    finance_fee_plans,
    finance_student_ledgers,
    finance_payments,
    finance_expenses,
    remedial_plans,
    anonymous_surveys,
    survey_participation_receipts,
    survey_anonymous_responses,
  };
}
