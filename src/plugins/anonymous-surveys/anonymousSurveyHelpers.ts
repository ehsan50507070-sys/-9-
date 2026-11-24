// Privacy-First Anonymous Surveys Engine (Strict Zero-PII Split, Threshold Gate, Shuffling & Aggregations)
import { buildUtf8BomCsv } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  AnonymousSurvey,
  School,
  SurveyAnonymousResponse,
  SurveyAudienceRole,
  SurveyCommentReviewStatus,
  SurveyParticipationReceipt,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyStatus,
} from '../../types/domain';

export const AUDIENCE_ROLE_LABELS: Record<SurveyAudienceRole, string> = {
  parent: 'اولیای گرامی',
  teacher: 'معلمان و همکاران',
  student: 'دانش‌آموزان',
};

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  active: 'فعال (در حال دریافت پاسخ)',
  draft: 'پیش‌نویس',
  closed: 'بسته‌شده (تکمیل‌شده)',
};

export const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  likert_5: 'طیف ۵ درجه‌ای لیکرت',
  multiple_choice: 'چندگزینه‌ای',
  yes_no: 'بله / خیر',
  open_text: 'پاسخ تشریحی ناشناس',
};

export const LIKERT_5_OPTIONS: Array<{ value: number; label: string; color: string }> = [
  { value: 5, label: 'بسیار زیاد (عالی)', color: '#10b981' },
  { value: 4, label: 'زیاد (خوب)', color: '#22c55e' },
  { value: 3, label: 'متوسط', color: '#f59e0b' },
  { value: 2, label: 'کم', color: '#f97316' },
  { value: 1, label: 'بسیار کم', color: '#f43f5e' },
];

export const COMMENT_REVIEW_LABELS: Record<SurveyCommentReviewStatus, string> = {
  new: 'جدید',
  reviewed: 'بررسی‌شده',
  in_followup: 'در دستور کار پیگیری',
};

export interface SurveyTemplateDefinition {
  id: string;
  title: string;
  description: string;
  targetRoles: SurveyAudienceRole[];
  questions: SurveyQuestion[];
}

export const PERSIAN_SURVEY_TEMPLATES: SurveyTemplateDefinition[] = [
  {
    id: 'tpl-parent-term',
    title: 'رضایت‌سنجی نیم‌سال اول اولیا',
    description:
      'ارزیابی میزان رضایت اولیا از کیفیت آموزش، اطلاع‌رسانی سامانه، انضباط محیطی و پاسخگویی کادر مدرسه.',
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
        prompt: 'کیفیت اطلاع‌رسانی و ارتباط مدرسه با اولیا را چگونه ارزیابی می‌کنید؟',
        type: 'likert_5',
        required: true,
      },
      {
        id: 'q3',
        prompt: 'آیا امکانات و نظم محیط مدرسه پاسخگوی نیاز فرزند شما است؟',
        type: 'yes_no',
        required: true,
      },
      {
        id: 'q4',
        prompt: 'کدام بخش مدرسه بیشترین نیاز به بهبود در نیم‌سال دوم را دارد؟',
        type: 'multiple_choice',
        required: true,
        options: ['کلاس‌های تقویتی', 'فوق‌برنامه و اردو', 'ارتباط با اولیا', 'امکانات رفاهی و ورزشی'],
      },
      {
        id: 'q5',
        prompt: 'پیشنهاد یا دیدگاه سازنده شما برای ارتقای کیفیت مدرسه (کاملاً ناشناس):',
        type: 'open_text',
        required: false,
      },
    ],
  },
  {
    id: 'tpl-teacher-climate',
    title: 'سنجش کیفیت فضای آموزشی و رفاهی معلمان',
    description:
      'بررسی دیدگاه همکاران درباره تجهیزات کلاس‌ها، هماهنگی مدیریتی، پشتیبانی آموزشی و فضای تعاملی مدرسه.',
    targetRoles: ['teacher'],
    questions: [
      {
        id: 'q1',
        prompt: 'سطح پشتیبانی مدیریت و معاونت در حل مسائل روزمره کلاس‌ها را چگونه ارزیابی می‌کنید؟',
        type: 'likert_5',
        required: true,
      },
      {
        id: 'q2',
        prompt: 'تجهیزات آموزشی، کمک‌درسی و امکانات دیجیتال کلاس‌ها تا چه حد رضایت‌بخش است؟',
        type: 'likert_5',
        required: true,
      },
      {
        id: 'q3',
        prompt: 'آیا برنامه‌ریزی جلسات شورای معلمان و زمان‌بندی امتحانات منظم و کارآمد است؟',
        type: 'yes_no',
        required: true,
      },
      {
        id: 'q4',
        prompt: 'پیشنهاد ناشناس شما برای بهبود محیط کار و کیفیت تدریس:',
        type: 'open_text',
        required: false,
      },
    ],
  },
  {
    id: 'tpl-student-voice',
    title: 'نظرسنجی کیفیت تدریس و محیط مدرسه از دانش‌آموزان',
    description:
      'شنیدن مستقیم و محرمانه صدای دانش‌آموزان درباره جذابیت کلاس‌ها، زنگ تفریح، مسابقات و فضای دوستانه مدرسه.',
    targetRoles: ['student'],
    questions: [
      {
        id: 'q1',
        prompt: 'چقدر از حضور در کلاس‌های درس و شیوه تدریس معلمان احساس رضایت و انگیزه داری؟',
        type: 'likert_5',
        required: true,
      },
      {
        id: 'q2',
        prompt: 'کدام فعالیت مدرسه برای تو جذاب‌تر است؟',
        type: 'multiple_choice',
        required: true,
        options: ['آزمایشگاه و کارگاه علمی', 'ورزش و مسابقات', 'اردوهای علمی و تفریحی', 'کارهای گروهی و هنری'],
      },
      {
        id: 'q3',
        prompt: 'آیا احساس می‌کنی در صورت داشتن سوال یا مشکل می‌توانی با معلم یا معاون صحبت کنی؟',
        type: 'yes_no',
        required: true,
      },
      {
        id: 'q4',
        prompt: 'اگر یک پیشنهاد برای بهتر شدن مدرسه داری اینجا بنویس (بدون نام):',
        type: 'open_text',
        required: false,
      },
    ],
  },
  {
    id: 'tpl-extras-services',
    title: 'ارزیابی خدمات فوق‌برنامه، اردو و سرویس مدرسه',
    description:
      'سنجش رضایت اولیا و دانش‌آموزان از کلاس‌های فوق‌برنامه، اردوهای علمی، کتاب‌های کمک‌درسی و سرویس ایاب‌وذهاب.',
    targetRoles: ['parent', 'student'],
    questions: [
      {
        id: 'q1',
        prompt: 'رضایت شما از کیفیت برگزاری کلاس‌های فوق‌برنامه و مهارتی چقدر است؟',
        type: 'likert_5',
        required: true,
      },
      {
        id: 'q2',
        prompt: 'میزان رضایت از نظم و ایمنی سرویس ایاب‌وذهاب و اردوهای مدرسه چقدر است؟',
        type: 'likert_5',
        required: true,
      },
      {
        id: 'q3',
        prompt: 'آیا تنوع فعالیت‌های فوق‌برنامه مدرسه را کافی می‌دانید؟',
        type: 'yes_no',
        required: true,
      },
      {
        id: 'q4',
        prompt: 'پیشنهاد شما برای اردو یا دوره فوق‌برنامه جدید:',
        type: 'open_text',
        required: false,
      },
    ],
  },
];

/**
 * Deterministic opaque participant hash (FNV-1a 32-bit) used strictly for duplicate-vote guard.
 * Never stored on SurveyAnonymousResponse.
 */
export function buildParticipantKey(userId: string, surveyId: string): string {
  const input = `anon-v6::${userId}::${surveyId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `pk-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Builds a strictly PII-free anonymous response payload.
 * Guarantees ZERO identity keys (`userId`, `studentId`, `fullName`, `phone`, exact timestamp).
 */
export function buildAnonymousResponsePayload(params: {
  schoolId: string;
  surveyId: string;
  audienceRole: SurveyAudienceRole;
  answers: Record<string, string | number>;
  openComment?: string;
  submittedDayBucket: string;
}): SurveyAnonymousResponse {
  const cleanAnswers: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params.answers)) {
    if (typeof v === 'number' || typeof v === 'string') {
      cleanAnswers[k] = v;
    }
  }
  const token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: `anon-${token}`,
    schoolId: params.schoolId,
    surveyId: params.surveyId,
    audienceRole: params.audienceRole,
    answers: cleanAnswers,
    ...(params.openComment?.trim() ? { openComment: params.openComment.trim() } : {}),
    submittedDayBucket: params.submittedDayBucket.slice(0, 10),
    reviewStatus: 'new',
  };
}

/**
 * Deterministically shuffles anonymous responses/comments so they are NEVER shown in exact submission order.
 */
export function shuffleAnonymousItems<T extends { id: string }>(items: T[], seedKey: string): T[] {
  const arr = [...items];
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface QuestionBreakdownBar {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface QuestionResultSummary {
  question: SurveyQuestion;
  totalAnswered: number;
  averageLikert?: number;
  bars: QuestionBreakdownBar[];
  anonymousTexts: string[];
}

export interface ShuffledAnonymousCommentItem {
  responseId: string;
  audienceRole: SurveyAudienceRole;
  comment: string;
  submittedDayBucket: string;
  reviewStatus: SurveyCommentReviewStatus;
  internalManagementNote?: string;
}

export interface SurveyEvaluationResult {
  survey: AnonymousSurvey;
  totalResponses: number;
  minThreshold: number;
  thresholdMet: boolean;
  missingForThreshold: number;
  estimatedEligibleCount: number;
  participationRatePercent: number;
  satisfactionIndexOutOf100: number | null;
  questionSummaries: QuestionResultSummary[];
  shuffledComments: ShuffledAnonymousCommentItem[];
}

export function evaluateSurveyResults(params: {
  survey: AnonymousSurvey;
  responses: SurveyAnonymousResponse[];
  estimatedEligibleCount: number;
}): SurveyEvaluationResult {
  const { survey, estimatedEligibleCount } = params;
  const surveyResponses = params.responses.filter(
    (r) => r.surveyId === survey.id && r.schoolId === survey.schoolId
  );
  const totalResponses = surveyResponses.length;
  const minThreshold = Math.max(1, survey.minAnonymityThreshold || 3);
  const thresholdMet = totalResponses >= minThreshold;
  const missingForThreshold = Math.max(0, minThreshold - totalResponses);
  const participationRatePercent =
    estimatedEligibleCount > 0
      ? Math.min(100, Math.round((totalResponses / estimatedEligibleCount) * 100))
      : 0;

  if (!thresholdMet) {
    return {
      survey,
      totalResponses,
      minThreshold,
      thresholdMet: false,
      missingForThreshold,
      estimatedEligibleCount,
      participationRatePercent,
      satisfactionIndexOutOf100: null,
      questionSummaries: [],
      shuffledComments: [],
    };
  }

  let satisfactionScoreSum = 0;
  let satisfactionScoreCount = 0;

  const questionSummaries: QuestionResultSummary[] = survey.questions.map((q) => {
    const rawValues = surveyResponses
      .map((r) => r.answers[q.id])
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
    const totalAnswered = rawValues.length;

    if (q.type === 'likert_5') {
      const numericVals = rawValues.map((v) => Number(v)).filter((n) => n >= 1 && n <= 5);
      const avg =
        numericVals.length > 0
          ? Number((numericVals.reduce((a, b) => a + b, 0) / numericVals.length).toFixed(2))
          : 0;
      for (const n of numericVals) {
        satisfactionScoreSum += ((n - 1) / 4) * 100;
        satisfactionScoreCount += 1;
      }

      const bars: QuestionBreakdownBar[] = LIKERT_5_OPTIONS.map((opt) => {
        const count = numericVals.filter((n) => n === opt.value).length;
        return {
          label: opt.label,
          count,
          percent: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
          color: opt.color,
        };
      });

      return { question: q, totalAnswered, averageLikert: avg, bars, anonymousTexts: [] };
    }

    if (q.type === 'yes_no') {
      const yesCount = rawValues.filter((v) => String(v) === 'بله').length;
      const noCount = rawValues.filter((v) => String(v) === 'خیر').length;
      satisfactionScoreSum += yesCount * 100;
      satisfactionScoreCount += yesCount + noCount;

      return {
        question: q,
        totalAnswered,
        bars: [
          {
            label: 'بله',
            count: yesCount,
            percent: totalAnswered > 0 ? Math.round((yesCount / totalAnswered) * 100) : 0,
            color: '#10b981',
          },
          {
            label: 'خیر',
            count: noCount,
            percent: totalAnswered > 0 ? Math.round((noCount / totalAnswered) * 100) : 0,
            color: '#f43f5e',
          },
        ],
        anonymousTexts: [],
      };
    }

    if (q.type === 'multiple_choice') {
      const opts = q.options && q.options.length > 0 ? q.options : Array.from(new Set(rawValues.map(String)));
      const palette = ['#4f46e5', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899'];
      const bars: QuestionBreakdownBar[] = opts.map((opt, idx) => {
        const count = rawValues.filter((v) => String(v) === opt).length;
        return {
          label: opt,
          count,
          percent: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
          color: palette[idx % palette.length],
        };
      });
      return { question: q, totalAnswered, bars, anonymousTexts: [] };
    }

    // open_text
    const shuffledTexts = shuffleAnonymousItems(
      surveyResponses
        .filter((r) => typeof r.answers[q.id] === 'string' && String(r.answers[q.id]).trim().length > 0)
        .map((r) => ({ id: r.id, text: String(r.answers[q.id]).trim() })),
      `${survey.id}:${q.id}:${totalResponses}`
    ).map((x) => x.text);

    return {
      question: q,
      totalAnswered,
      bars: [],
      anonymousTexts: shuffledTexts,
    };
  });

  const satisfactionIndexOutOf100 =
    satisfactionScoreCount > 0 ? Math.round(satisfactionScoreSum / satisfactionScoreCount) : null;

  // Gather open comments + any open_text answers, then shuffle
  const rawCommentItems: Array<{ id: string } & ShuffledAnonymousCommentItem> = [];
  for (const r of surveyResponses) {
    const openQuestionTexts = survey.questions
      .filter((q) => q.type === 'open_text')
      .map((q) => (typeof r.answers[q.id] === 'string' ? String(r.answers[q.id]).trim() : ''))
      .filter(Boolean);
    const combined = [r.openComment?.trim(), ...openQuestionTexts]
      .filter(Boolean)
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .join(' — ');
    if (combined) {
      rawCommentItems.push({
        id: r.id,
        responseId: r.id,
        audienceRole: r.audienceRole,
        comment: combined,
        submittedDayBucket: r.submittedDayBucket,
        reviewStatus: r.reviewStatus ?? 'new',
        internalManagementNote: r.internalManagementNote,
      });
    }
  }

  const shuffledComments = shuffleAnonymousItems(
    rawCommentItems,
    `${survey.id}:comments:${totalResponses}`
  );

  return {
    survey,
    totalResponses,
    minThreshold,
    thresholdMet: true,
    missingForThreshold: 0,
    estimatedEligibleCount,
    participationRatePercent,
    satisfactionIndexOutOf100,
    questionSummaries,
    shuffledComments,
  };
}

export interface ComplexSurveyComparisonRow {
  school: School;
  surveyTitle: string;
  responsesCount: number;
  thresholdMet: boolean;
  satisfactionIndexOutOf100: number;
}

export function computeComplexSurveyComparison(params: {
  schools: School[];
  surveys: AnonymousSurvey[];
  responses: SurveyAnonymousResponse[];
  groupKey: string;
}): ComplexSurveyComparisonRow[] {
  return params.schools.map((school) => {
    const survey = params.surveys.find(
      (s) => s.schoolId === school.id && s.groupKey === params.groupKey
    );
    if (!survey) {
      return {
        school,
        surveyTitle: '—',
        responsesCount: 0,
        thresholdMet: false,
        satisfactionIndexOutOf100: 0,
      };
    }
    const evalRes = evaluateSurveyResults({
      survey,
      responses: params.responses,
      estimatedEligibleCount: 25,
    });
    return {
      school,
      surveyTitle: survey.title,
      responsesCount: evalRes.totalResponses,
      thresholdMet: evalRes.thresholdMet,
      satisfactionIndexOutOf100: evalRes.satisfactionIndexOutOf100 ?? 0,
    };
  });
}

export function hasUserParticipatedInSurvey(params: {
  receipts: SurveyParticipationReceipt[];
  schoolId: string;
  surveyId: string;
  participantKey: string;
}): boolean {
  return params.receipts.some(
    (r) =>
      r.schoolId === params.schoolId &&
      r.surveyId === params.surveyId &&
      r.participantKey === params.participantKey
  );
}

export function buildSurveyReportMessenger(params: {
  schoolName: string;
  todayJalali: string;
  evaluation: SurveyEvaluationResult;
}): string {
  const { evaluation } = params;
  const lines: string[] = [
    `عنوان نظرسنجی: ${evaluation.survey.title}`,
    `تعداد کل مشارکت‌کنندگان: ${toPersianDigits(evaluation.totalResponses)} نفر (${toPersianDigits(evaluation.participationRatePercent)}٪)`,
  ];
  if (evaluation.thresholdMet && evaluation.satisfactionIndexOutOf100 !== null) {
    lines.push(
      `شاخص کل رضایت‌مندی: ${toPersianDigits(evaluation.satisfactionIndexOutOf100)} از ۱۰۰`
    );
  } else {
    lines.push(
      `به دلیل حفظ محرمانگی (حد نصاب ${toPersianDigits(evaluation.minThreshold)} پاسخ)، تفکیک جزئیات پس از تکمیل حد نصاب منتشر می‌شود.`
    );
  }

  return formatSingleColumnMessengerReport({
    schoolName: params.schoolName,
    reportTitle: 'خلاصه نتایج نظرسنجی ناشناس و سنجش رضایت',
    jalaliDateDisplay: params.todayJalali,
    sections: [
      { heading: 'آمار کلی', lines },
      ...(evaluation.thresholdMet
        ? [
            {
              heading: 'خلاصه شاخص سوالات',
              lines: evaluation.questionSummaries
                .filter((qs) => qs.bars.length > 0)
                .map((qs) => {
                  const topBar = [...qs.bars].sort((a, b) => b.percent - a.percent)[0];
                  return `• ${qs.question.prompt} ← بیشترین پاسخ: ${topBar?.label ?? '—'} (${toPersianDigits(topBar?.percent ?? 0)}٪)`;
                }),
            },
          ]
        : []),
    ],
    footerNote: 'گزارش کاملاً بی‌نام — بدون ذخیره هیچ‌گونه مشخصات هویتی پاسخ‌دهندگان',
  });
}

export function buildSurveyResultsCsv(evaluation: SurveyEvaluationResult): string {
  const headers = ['سوال', 'نوع سوال', 'گزینه / شاخص', 'تعداد پاسخ', 'درصد'];
  const rows: Array<Array<string | number>> = [];
  if (evaluation.thresholdMet) {
    for (const qs of evaluation.questionSummaries) {
      for (const bar of qs.bars) {
        rows.push([
          qs.question.prompt,
          QUESTION_TYPE_LABELS[qs.question.type],
          bar.label,
          bar.count,
          `${bar.percent}%`,
        ]);
      }
    }
  }
  return buildUtf8BomCsv(headers, rows);
}
