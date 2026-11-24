// Deterministic, realistic Persian Phase 2 Seed Data across all 3 isolated schools
import { addDaysToJalali } from '../../lib/jalali';
import type {
  ChatOutboxItem,
  ClassRoom,
  CurriculumTopic,
  DescriptiveLevel,
  GradeAppeal,
  GradebookEntry,
  GradebookWeightConfig,
  HomeworkAssignment,
  HomeworkSubmission,
  JalaliAcademicMonth,
  LessonPlanRecord,
  MediaResource,
  School,
  Student,
  StudentReward,
  Teacher,
} from '../../types/domain';

export interface Phase2SeedSlice {
  curriculum_topics: CurriculumTopic[];
  media_resources: MediaResource[];
  chat_outbox: ChatOutboxItem[];
  gradebook_entries: GradebookEntry[];
  lesson_plans: LessonPlanRecord[];
  gradebook_weights: GradebookWeightConfig[];
  grade_appeals: GradeAppeal[];
  homework_assignments: HomeworkAssignment[];
  homework_submissions: HomeworkSubmission[];
  student_rewards: StudentReward[];
}

export const PHASE2_PLUGIN_IDS = [
  'timetable',
  'curriculum',
  'media-hub',
  'gradebook',
  'homework',
  'rewards',
] as const;

interface TopicBlueprint {
  week: number;
  topic: string;
  pagesRef: string;
  objectives: string;
}

// Authentic Iranian elementary curriculum pacing for فارسی & ریاضی (Grades 2..6)
const PERSIAN_TOPICS_BY_GRADE: Record<2 | 3 | 4 | 5 | 6, TopicBlueprint[]> = {
  2: [
    { week: 1, topic: 'فصل اول: کتابخانه کلاس ما (روان‌خوانی و واژه‌آموزی)', pagesRef: 'ص ۲ تا ۱۰', objectives: 'آشنایی با آداب کتاب‌خوانی و درک مطلب ساده' },
    { week: 2, topic: 'مسجد محله ما + نگارش جمله با نشانه‌های نگارشی', pagesRef: 'ص ۱۱ تا ۱۸', objectives: 'تشخیص جمله کامل و کاربرد نقطه و علامت سوال' },
    { week: 3, topic: 'خرس کوچولو و دوستی (هم‌خانواده‌های ساده)', pagesRef: 'ص ۱۹ تا ۲۶', objectives: 'تقویت درک شنیداری و بیان شفاهی داستان' },
    { week: 4, topic: 'مدرسه خرگوش‌ها (جمع بستن با «ها» و املای کلمات جدید)', pagesRef: 'ص ۲۷ تا ۳۵', objectives: 'تسلط بر املای واژه‌های کلیدی و روان‌نویسی' },
    { week: 5, topic: 'چوپان درستکار (صفت‌های ساده و بازنویسی داستان)', pagesRef: 'ص ۳۶ تا ۴۴', objectives: 'پرورش صداقت و نگارش بند کوتاه سه جمله‌ای' },
    { week: 6, topic: 'کوشا و نوشا (ارزشیابی خوانداری و املای تقریری)', pagesRef: 'ص ۴۵ تا ۵۴', objectives: 'ارزیابی دقت خواندن و املای پایانی فصل دوم' },
  ],
  3: [
    { week: 1, topic: 'محله ما و زنگ ورزش (بازخوانی و خلاصه‌گویی)', pagesRef: 'ص ۴ تا ۱۴', objectives: 'درک مفهوم متن و پاسخ به پرسش‌های درک مطلب' },
    { week: 2, topic: 'آسمان آبی، طبیعت پاک (واژه‌های متضاد و هم‌معنی)', pagesRef: 'ص ۱۵ تا ۲۳', objectives: 'گسترش دایره واژگان و نگارش توصیفی طبیعت' },
    { week: 3, topic: 'آواز گنجشک (شناخت فعل و زمان حال و گذشته ساده)', pagesRef: 'ص ۲۴ تا ۳۳', objectives: 'تشخیص فعل در پایان جمله و کاربرد صحیح آن' },
    { week: 4, topic: 'بلدرچین و برزگر (ضرب‌المثل و داستان‌نویسی)', pagesRef: 'ص ۳۴ تا ۴۳', objectives: 'درک پیام اخلاقی داستان و بازآفرینی متن' },
    { week: 5, topic: 'فداکاران و ریزعلی خواجوی (انشا درباره ایثار)', pagesRef: 'ص ۴۴ تا ۵۲', objectives: 'نگارش بند منسجم با مقدمه و نتیجه‌گیری' },
    { week: 6, topic: 'ایران آباد (خوانش شعر و حفظ سرود میهنی)', pagesRef: 'ص ۵۳ تا ۶۲', objectives: 'لحن مناسب در شعرخوانی و املای تقریری' },
  ],
  4: [
    { week: 1, topic: 'آفریدگار زیبایی و کوچ پرستوها (آرایه تشبیه ساده)', pagesRef: 'ص ۴ تا ۱۶', objectives: 'درک تشبیه در نثر و شعر و نگارش توصیفی' },
    { week: 2, topic: 'راز نشانه و ارزش علم (واژه‌های هم‌خانواده)', pagesRef: 'ص ۱۷ تا ۲۸', objectives: 'یافتن ریشه مشترک واژه‌ها و نگارش صحیح همزه' },
    { week: 3, topic: 'رهایی از قفس (داستان‌های مثنوی و پیام آن)', pagesRef: 'ص ۲۹ تا ۴۰', objectives: 'درک داستان‌های کهن و بازنویسی به زبان ساده' },
    { week: 4, topic: 'آرش کمانگیر (حماسه‌خوانی و ساختار جمله)', pagesRef: 'ص ۴۱ تا ۵۲', objectives: 'تشخیص نهاد و گزاره در جمله‌های ساده' },
    { week: 5, topic: 'مهمان شهر ما (گزارش‌نویسی و نامه‌نگاری)', pagesRef: 'ص ۵۳ تا ۶۴', objectives: 'آشنایی با اجزای نامه دوستانه و گزارش رویداد' },
    { week: 6, topic: 'باغچه اطفال (مرور دستور و ارزشیابی نگارش)', pagesRef: 'ص ۶۵ تا ۷۶', objectives: 'تثبیت مهارت املا، ویرایش متن و خوانش روان' },
  ],
  5: [
    { week: 1, topic: 'تماشاخانه و فضل خدا (تشخیص و جان‌بخشی در شعر)', pagesRef: 'ص ۴ تا ۱۶', objectives: 'شناخت آرایه تشخیص و نگارش بند خلاقانه' },
    { week: 2, topic: 'رازی و ساخت بیمارستان (پژوهش‌نویسی کوتاه)', pagesRef: 'ص ۱۷ تا ۲۹', objectives: 'خلاصه‌برداری از زندگینامه دانشمندان ایرانی' },
    { week: 3, topic: 'بازرگان و پسران (ضرب‌المثل و صفت و موصوف)', pagesRef: 'ص ۳۰ تا ۴۲', objectives: 'تشخیص ترکیب وصفی و اضافی در متن' },
    { week: 4, topic: 'سرود ملی و نام‌آوران دیروز و امروز', pagesRef: 'ص ۴۳ تا ۵۵', objectives: 'تقویت سخنوری کلاسی و لحن حماسی' },
    { week: 5, topic: 'نقش خردمندان و حکایت‌های گلستان سعدی', pagesRef: 'ص ۵۶ تا ۶۸', objectives: 'بازگردانی حکایت کوتاه کهن به فارسی امروز' },
    { week: 6, topic: 'وقتی بوعلی کودک بود (کارگاه انشا و ویراستاری)', pagesRef: 'ص ۶۹ تا ۸۰', objectives: 'ویرایش املایی و نگارشی متن دانش‌آموزی' },
  ],
  6: [
    { week: 1, topic: 'معرفت آفریدگار و پنجره‌های شناخت (قالب‌های شعر)', pagesRef: 'ص ۴ تا ۱۸', objectives: 'آشنایی با مثنوی، رباعی و مفهوم بیت‌ها' },
    { week: 2, topic: 'هوشیاری و داستان من و شما (انواع جمله و مفعول)', pagesRef: 'ص ۱۹ تا ۳۱', objectives: 'تشخیص مفعول، نشانه «را» و نقش‌های اصلی جمله' },
    { week: 3, topic: 'هفت‌خوان رستم (تحلیل داستان حماسی شاهنامه)', pagesRef: 'ص ۳۲ تا ۴۵', objectives: 'درک واژگان حماسی و بازنویسی خلاقانه داستان' },
    { week: 4, topic: 'ای وطن و دریاقلی (مقاله‌نویسی دانش‌آموزی)', pagesRef: 'ص ۴۶ تا ۵۸', objectives: 'تدوین انشای ساختاری با استدلال و مثال' },
    { week: 5, topic: 'عطار و جلال‌الدین (حکایت‌پردازی و کنایه)', pagesRef: 'ص ۵۹ تا ۷۲', objectives: 'درک کنایه‌های پرکاربرد و کاربرد آن‌ها در نگارش' },
    { week: 6, topic: 'ستاره روشن و مرور جامع دستور و املا', pagesRef: 'ص ۷۳ تا ۸۶', objectives: 'جمع‌بندی نکات املایی، نگارشی و درک مطلب' },
  ],
};

const MATH_TOPICS_BY_GRADE: Record<2 | 3 | 4 | 5 | 6, TopicBlueprint[]> = {
  2: [
    { week: 1, topic: 'فصل ۱: عدد و رقم، الگوهای عددی و جدول شگفت‌انگیز', pagesRef: 'ص ۲ تا ۱۸', objectives: 'تشخیص الگوهای ۲تایی و ۵تایی و شمارش رو به جلو' },
    { week: 2, topic: 'جمع و تفریق اعداد دو رقمی با چوب‌خط و محور', pagesRef: 'ص ۱۹ تا ۳۴', objectives: 'محاسبه ذهنی و فرایندی جمع و تفریق دو رقمی' },
    { week: 3, topic: 'جمع و تفریق تکنیکی (انتقالی و قرضی) تا ۱۰۰', pagesRef: 'ص ۳۵ تا ۵۰', objectives: 'تسلط بر ارزش مکانی یکان و دهگان' },
    { week: 4, topic: 'اشکال هندسی، خط، پاره‌خط و تقارن روی کاغذ شطرنجی', pagesRef: 'ص ۵۱ تا ۶۶', objectives: 'رسم شکل‌های متقارن و شناخت ضلع و گوشه' },
    { week: 5, topic: 'اندازه‌گیری طول با سانتی‌متر و خواندن ساعت', pagesRef: 'ص ۶۷ تا ۸۲', objectives: 'کاربرد خط‌کش و خواندن ساعت و نیم‌ساعت' },
    { week: 6, topic: 'آشنایی با اعداد سه‌رقمی (صدگان، دهگان، یکان)', pagesRef: 'ص ۸۳ تا ۹۸', objectives: 'خواندن، نوشتن و مقایسه اعداد سه‌رقمی' },
  ],
  3: [
    { week: 1, topic: 'فصل ۱: الگوها، شمارش چندتاچندتا و ساعت دیجیتال', pagesRef: 'ص ۲ تا ۲۰', objectives: 'حل مسئله با رسم شکل و کشف الگوی عددی' },
    { week: 2, topic: 'اعداد چهاررقمی (هزارگان) و تقریب عددی', pagesRef: 'ص ۲۱ تا ۳۸', objectives: 'جدول ارزش مکانی تا طبقه هزار و مقایسه اعداد' },
    { week: 3, topic: 'مفهوم کسر، کسرهای مساوی و مقایسه کسرها با شکل', pagesRef: 'ص ۳۹ تا ۵۶', objectives: 'نمایش کسر روی محور و تشخیص کسر واحد' },
    { week: 4, topic: 'مفهوم ضرب و جدول ضرب ۲ تا ۹ (حل مسائل کاربردی)', pagesRef: 'ص ۵۷ تا ۷۶', objectives: 'تسلط بر ضرب‌های اساسی و خاصیت جابه‌جایی' },
    { week: 5, topic: 'محیط و مساحت شکل‌های هندسی روی صفحه شطرنجی', pagesRef: 'ص ۷۷ تا ۹۴', objectives: 'تمایز میان محیط و مساحت مستطیل و مربع' },
    { week: 6, topic: 'مفهوم تقسیم و تقسیم باقیمانده‌دار ساده', pagesRef: 'ص ۹۵ تا ۱۱۲', objectives: 'ارتباط ضرب و تقسیم و بررسی درستی تقسیم' },
  ],
  4: [
    { week: 1, topic: 'فصل ۱: اعداد تا میلیون، ارزش مکانی و الگوها', pagesRef: 'ص ۲ تا ۲۲', objectives: 'خواندن و نوشتن اعداد تا طبقه میلیون و الگویابی' },
    { week: 2, topic: 'کسرهای مساوی، عدد مخلوط و جمع و تفریق کسرها', pagesRef: 'ص ۲۳ تا ۴۴', objectives: 'تبدیل عدد مخلوط و انجام عملیات کسر با مخرج برابر' },
    { week: 3, topic: 'ضرب اعداد دورقمی در دورقمی و تقسیم بر عدد یک‌رقمی', pagesRef: 'ص ۴۵ تا ۶۶', objectives: 'انجام ضرب مساحتی و تقسیم فرایندی دقیق' },
    { week: 4, topic: 'زاویه، نیم‌خط، نقاله و انواع مثلث و چهارضلعی', pagesRef: 'ص ۶۷ تا ۸۸', objectives: 'اندازه‌گیری زاویه با نقاله و شناخت عمود و موازی' },
    { week: 5, topic: 'آشنایی با اعداد اعشاری (دهم و صدم) و جمع اعشار', pagesRef: 'ص ۸۹ تا ۱۱۰', objectives: 'تبدیل کسر دهدهی به اعشار و نمایش روی محور' },
    { week: 6, topic: 'محیط، مساحت متوازی‌الاضلاع و نمودار ستونی', pagesRef: 'ص ۱۱۱ تا ۱۲۸', objectives: 'تفسیر داده‌های آماری و محاسبه مساحت' },
  ],
  5: [
    { week: 1, topic: 'فصل ۱: عددنویسی تا میلیارد و الگوهای ترکیبی', pagesRef: 'ص ۲ تا ۲۲', objectives: 'طبقه‌بندی اعداد تا میلیارد و حل مسئله الگو' },
    { week: 2, topic: 'جمع، تفریق و ضرب کسرها با مخرج نامساوی', pagesRef: 'ص ۲۳ تا ۴۶', objectives: 'مخرج مشترک‌گیری و ساده کردن کسرها' },
    { week: 3, topic: 'نسبت، تناسب و درصد در مسائل روزمره', pagesRef: 'ص ۴۷ تا ۶۸', objectives: 'تنظیم جدول تناسب و محاسبه تخفیف و درصد' },
    { week: 4, topic: 'تقارن محوری، تقارن مرکزی و مساحت مثلث و ذوزنقه', pagesRef: 'ص ۶۹ تا ۹۲', objectives: 'محاسبه ارتفاع و مساحت چندضلعی‌ها' },
    { week: 5, topic: 'عملیات کامل اعداد اعشاری (ضرب و تقسیم اعشاری)', pagesRef: 'ص ۹۳ تا ۱۱۴', objectives: 'دقت در جایگاه ممیز در ضرب و تقسیم اعشار' },
    { week: 6, topic: 'اندازه‌گیری حجم، گنجایش و میانگین آماری', pagesRef: 'ص ۱۱۵ تا ۱۳۴', objectives: 'محاسبه میانگین نمرات و تبدیل واحدهای حجم' },
  ],
  6: [
    { week: 1, topic: 'فصل ۱: عدد و الگوهای عددی، بخش‌پذیری و اعداد اول', pagesRef: 'ص ۲ تا ۲۴', objectives: 'تشخیص بخش‌پذیری بر ۲، ۳، ۵، ۹ و الگوهای مربعی' },
    { week: 2, topic: 'ضرب و تقسیم کسرها و عددهای مخلوط', pagesRef: 'ص ۲۵ تا ۴۶', objectives: 'کاربرد معکوس کسر در تقسیم و مسائل ترکیبی' },
    { week: 3, topic: 'اعداد اعشاری، تقریب و تقسیم اعشاری', pagesRef: 'ص ۴۷ تا ۶۸', objectives: 'گرد کردن و قطع کردن اعداد اعشاری' },
    { week: 4, topic: 'تقارن، مختصات در صفحه و دوران اشکال هندسی', pagesRef: 'ص ۶۹ تا ۹۰', objectives: 'کار با دستگاه مختصات و تبدیل‌های هندسی' },
    { week: 5, topic: 'محیط و مساحت دایره، حجم استوانه و منشور', pagesRef: 'ص ۹۱ تا ۱۱۲', objectives: 'آشنایی با عدد پی و حل مسائل حجمی' },
    { week: 6, topic: 'تناسب، درصد، احتمال و نمودار دایره‌ای', pagesRef: 'ص ۱۱۳ تا ۱۳۶', objectives: 'تحلیل نمودار دایره‌ای و محاسبه احتمال ساده' },
  ],
};

function scoreToDesc(score: number): DescriptiveLevel {
  if (score >= 17) return 'خیلی خوب';
  if (score >= 14) return 'خوب';
  if (score >= 11) return 'قابل قبول';
  return 'نیاز به تلاش بیشتر';
}

export function generatePhase2SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  activeDayJalali: string;
}): Phase2SeedSlice {
  const { schools, classes, students, teachers, activeDayJalali } = params;
  const nowIso = new Date().toISOString();

  const curriculum_topics: CurriculumTopic[] = [];
  const media_resources: MediaResource[] = [];
  const chat_outbox: ChatOutboxItem[] = [];
  const gradebook_entries: GradebookEntry[] = [];
  const lesson_plans: LessonPlanRecord[] = [];
  const gradebook_weights: GradebookWeightConfig[] = [];
  const grade_appeals: GradeAppeal[] = [];
  const homework_assignments: HomeworkAssignment[] = [];
  const homework_submissions: HomeworkSubmission[] = [];
  const student_rewards: StudentReward[] = [];

  const months: JalaliAcademicMonth[] = ['مهر', 'آبان', 'آذر', 'دی'];
  const monthDates: Record<JalaliAcademicMonth, string> = {
    مهر: '1405/07/25',
    آبان: '1405/08/25',
    آذر: '1405/09/25',
    دی: '1405/10/20',
    بهمن: '1405/11/20',
    اسفند: '1405/12/20',
    فروردین: '1406/01/25',
    اردیبهشت: '1406/02/25',
    خرداد: '1406/03/20',
  };

  const presetBadges: Array<{
    badgeId: string;
    badgeTitle: string;
    badgeColor: StudentReward['badgeColor'];
    category: string;
    reason: string;
  }> = [
    {
      badgeId: 'top-student',
      badgeTitle: 'شاگرد ممتاز هفته',
      badgeColor: 'amber',
      category: 'پیشرفت درسی',
      reason: 'مشارکت درخشان در پرسش‌های کلاسی و کسب عالی در ارزشیابی هفتگی ریاضی و فارسی.',
    },
    {
      badgeId: 'big-progress',
      badgeTitle: 'پیشرفت چشمگیر',
      badgeColor: 'emerald',
      category: 'تلاش و پشتکار',
      reason: 'رشد مستمر در حل تمرین‌های کسر و بهبود چشمگیر در دقت املا و نگارش.',
    },
    {
      badgeId: 'discipline-star',
      badgeTitle: 'نظم و ادب برتر',
      badgeColor: 'indigo',
      category: 'اخلاق و انضباط',
      reason: 'حضور به‌موقع در تمامی زنگ‌ها، رعایت کامل نظم کلاسی و برخورد محترمانه با همکلاسی‌ها.',
    },
    {
      badgeId: 'homework-hero',
      badgeTitle: 'قهرمان تکالیف',
      badgeColor: 'violet',
      category: 'مسئولیت‌پذیری',
      reason: 'تحویل منظم، تمیز و کامل تمامی تکالیف آنلاین پیش از موعد مقرر.',
    },
    {
      badgeId: 'teamwork',
      badgeTitle: 'همکاری گروهی',
      badgeColor: 'sky',
      category: 'مهارت اجتماعی',
      reason: 'همراهی سازنده در فعالیت‌های گروهی آزمایشگاه علوم و کمک به همکلاسی‌ها.',
    },
  ];

  schools.forEach((school, schoolIdx) => {
    const schoolId = school.id;
    const schoolClasses = classes.filter((c) => c.schoolId === schoolId);
    const schoolStudents = students.filter((s) => s.schoolId === schoolId);
    const schoolTeachers = teachers.filter((t) => t.schoolId === schoolId);

    // 1. Seed Curriculum Topics (فارسی & ریاضی for Grades 2..6)
    const grades: Array<2 | 3 | 4 | 5 | 6> = [2, 3, 4, 5, 6];
    for (const grade of grades) {
      const gradeClassIds = schoolClasses
        .filter((c) => c.gradeLevel === grade)
        .map((c) => c.id);

      const persianTopics = PERSIAN_TOPICS_BY_GRADE[grade];
      persianTopics.forEach((t, idx) => {
        // Mark first 3 or 4 weeks completed depending on school so progress bars differ realistically per school
        const completedCutoff = 3 + ((schoolIdx + grade) % 2);
        curriculum_topics.push({
          id: `${schoolId}:curr:fa:g${grade}:w${t.week}`,
          schoolId,
          gradeLevel: grade,
          subject: 'فارسی',
          weekNumber: t.week,
          topic: t.topic,
          pagesRef: t.pagesRef,
          objectives: t.objectives,
          completedClassIds: idx < completedCutoff ? [...gradeClassIds] : [],
          updatedAt: nowIso,
        });
      });

      const mathTopics = MATH_TOPICS_BY_GRADE[grade];
      mathTopics.forEach((t, idx) => {
        const completedCutoff = 2 + ((schoolIdx + grade + 1) % 3);
        curriculum_topics.push({
          id: `${schoolId}:curr:math:g${grade}:w${t.week}`,
          schoolId,
          gradeLevel: grade,
          subject: 'ریاضی',
          weekNumber: t.week,
          topic: t.topic,
          pagesRef: t.pagesRef,
          objectives: t.objectives,
          completedClassIds: idx < completedCutoff ? [...gradeClassIds] : [],
          updatedAt: nowIso,
        });
      });
    }

    // 2. Seed Media Hub Resources (PPTX, PDF, Image, Safe HTTPS Link, Audio) per school
    const primaryTeacher = schoolTeachers[0];
    const mathTeacher = schoolTeachers[2] ?? schoolTeachers[0];
    const litTeacher = schoolTeachers[6] ?? schoolTeachers[1] ?? schoolTeachers[0];

    const mediaSeeds: Array<Omit<MediaResource, 'id' | 'schoolId' | 'createdAt'>> = [
      {
        gradeLevel: 2,
        subject: 'فارسی',
        weekNumber: 2,
        kind: 'pptx',
        title: 'اسلاید آموزشی نشانه‌های نگارشی و جمله‌سازی پایه دوم',
        description: 'ارائه تصویری ۱۲ اسلایدی با تمرین‌های تعاملی کلاسی برای تشخیص نقطه و علامت سوال.',
        fileName: 'persian-grade2-week2.pptx',
        fileSizeBytes: 184000,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        slideCount: 12,
        uploadedByName: primaryTeacher?.fullName ?? 'آموزگار پایه دوم',
        uploadedByRole: 'teacher',
        createdAtJalali: addDaysToJalali(activeDayJalali, -4),
      },
      {
        gradeLevel: 2,
        subject: 'ریاضی',
        weekNumber: 2,
        kind: 'pdf',
        title: 'کاربرگ تمرینی جمع و تفریق دو رقمی روی محور',
        description: 'مجموعه ۱۵ مسئله تصویری و جدول ارزش مکانی آماده چاپ یا نمایش در تخته هوشمند.',
        fileName: 'math-g2-worksheet-w2.pdf',
        fileSizeBytes: 142000,
        mimeType: 'application/pdf',
        uploadedByName: primaryTeacher?.fullName ?? 'آموزگار پایه دوم',
        uploadedByRole: 'teacher',
        createdAtJalali: addDaysToJalali(activeDayJalali, -3),
      },
      {
        gradeLevel: 3,
        subject: 'ریاضی',
        weekNumber: 3,
        kind: 'link',
        title: 'شبیه‌ساز تعاملی کسرها و مقایسه شکل‌های کسری',
        description: 'پیوند امن آزمایشگاه دیجیتال جهت نمایش کسرهای مساوی روی تخته هوشمند کلاس.',
        url: 'https://phet.colorado.edu/fa/simulations/fractions-intro',
        uploadedByName: mathTeacher?.fullName ?? 'دبیر ریاضی',
        uploadedByRole: 'teacher',
        createdAtJalali: addDaysToJalali(activeDayJalali, -2),
      },
      {
        gradeLevel: 4,
        subject: 'فارسی',
        weekNumber: 3,
        kind: 'audio',
        title: 'ویس روان‌خوانی و توضیح حکایت «رهایی از قفس»',
        description: 'یادداشت صوتی معلم برای تمرین لحن خوانش صحیح و درک واژگان دشوار در منزل.',
        fileName: 'persian-g4-reading-note.mp3',
        fileSizeBytes: 98000,
        mimeType: 'audio/mpeg',
        durationSeconds: 145,
        uploadedByName: litTeacher?.fullName ?? 'دبیر فارسی',
        uploadedByRole: 'teacher',
        createdAtJalali: addDaysToJalali(activeDayJalali, -1),
      },
      {
        gradeLevel: 5,
        subject: 'ریاضی',
        weekNumber: 3,
        kind: 'pptx',
        title: 'اسلاید کاربردی نسبت، تناسب و جدول درصد',
        description: '۱۶ اسلاید همراه با مثال‌های فروشگاه و خرید روزمره برای تثبیت مفهوم تناسب.',
        fileName: 'math-g5-ratio-percent.pptx',
        fileSizeBytes: 224000,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        slideCount: 16,
        uploadedByName: mathTeacher?.fullName ?? 'دبیر ریاضی',
        uploadedByRole: 'teacher',
        createdAtJalali: activeDayJalali,
      },
      {
        gradeLevel: 6,
        subject: 'فارسی',
        weekNumber: 3,
        kind: 'link',
        title: 'کتابخانه دیجیتال داستان‌های برگزیده شاهنامه کودک و نوجوان',
        description: 'منبع امن و معتبر برای آشنایی با هفت‌خوان رستم و واژگان حماسی پایه ششم.',
        url: 'https://www.roshd.ir',
        uploadedByName: litTeacher?.fullName ?? 'دبیر ادبیات',
        uploadedByRole: 'teacher',
        createdAtJalali: activeDayJalali,
      },
    ];

    mediaSeeds.forEach((m, idx) => {
      const resourceId = `${schoolId}:media:${idx + 1}`;
      media_resources.push({
        id: resourceId,
        schoolId,
        ...m,
        createdAt: nowIso,
      });

      // Seed 1 initial chat outbox item per school so users see how Media -> Class Chat works
      if (idx === 0 && schoolClasses[0]) {
        chat_outbox.push({
          id: `${schoolId}:outbox:1`,
          schoolId,
          classId: schoolClasses[0].id,
          resourceId,
          resourceTitle: m.title,
          resourceKind: m.kind,
          messageText: `محتوای جلسه «${m.title}» برای مرور دانش‌آموزان در منزل ارسال شد.`,
          sentByName: m.uploadedByName,
          sentByRole: 'teacher',
          sentAtJalali: activeDayJalali,
          sentAt: nowIso,
          status: 'queued_for_class_chat',
        });
      }
    });

    // 3. Seed Gradebook Weights, Multi-Month Entries, Lesson Plans & Grade Appeals
    const coreSubjects = ['ریاضی', 'فارسی'];
    schoolClasses.forEach((cls, cIdx) => {
      const classTeacher = schoolTeachers[cIdx] ?? schoolTeachers[0];
      const classStudents = schoolStudents.filter((s) => s.classId === cls.id);

      for (const subject of coreSubjects) {
        gradebook_weights.push({
          id: `${schoolId}:weights:${cls.id}:${subject}`,
          schoolId,
          classId: cls.id,
          subject,
          attendanceWeight: 15,
          homeworkWeight: 30,
          oralQuizWeight: 25,
          classActivityWeight: 20,
          microQuizWeight: 10, // Pre-wired for Phase 3 Flipped Video Micro-Quiz
          updatedAt: nowIso,
        });

        // Multi-month grades (مهر، آبان، آذر، دی) for every student in this class
        classStudents.forEach((st, stIdx) => {
          const baseScore = 15.5 + ((stIdx * 1.1 + cIdx * 0.4 + schoolIdx * 0.3) % 4.0);
          months.forEach((month, mIdx) => {
            const delta = mIdx === 0 ? -0.75 : mIdx === 1 ? 0 : mIdx === 2 ? 0.5 : 0.75;
            const score = Math.min(20, Math.max(10, Math.round((baseScore + delta) * 4) / 4));
            const oral = Math.min(20, Math.max(10, Math.round((score - 0.5 + (stIdx % 2) * 0.5) * 4) / 4));
            const activity = Math.min(20, Math.max(11, Math.round((score + 0.25) * 4) / 4));

            gradebook_entries.push({
              id: `${schoolId}:gb:${cls.id}:${subject}:${month}:${st.id}`,
              schoolId,
              studentId: st.id,
              classId: cls.id,
              subject,
              jalaliMonth: month,
              jalaliDate: monthDates[month],
              numericScore: score,
              descriptiveLevel: scoreToDesc(score),
              oralQuizScore: oral,
              classActivityScore: activity,
              disciplinaryNote:
                stIdx === 1 && month === 'آذر'
                  ? 'نیاز به تمرکز بیشتر هنگام حل تمرین‌های کلاسی'
                  : 'مشارکت منظم و رفتار بسیار مناسب در کلاس',
              privateTeacherNote:
                stIdx === 0
                  ? 'یادداشت محرمانه دبیر: آمادگی عالی برای المپیاد ریاضی مدرسه — پیشنهاد معرفی به کارگاه پژوهش.'
                  : stIdx === 1
                    ? 'یادداشت محرمانه دبیر: در صورت تکرار غیبت، جلسه مشاوره اختصاصی با اولیا برگزار شود.'
                    : 'یادداشت محرمانه دبیر: روند یادگیری پایدار است.',
              recordedBy: 'teacher',
              updatedAt: nowIso,
            });
          });
        });
      }

      // Seed 1 structured Lesson Plan & Teaching Report per class
      lesson_plans.push({
        id: `${schoolId}:lp:${cls.id}:1`,
        schoolId,
        classId: cls.id,
        teacherId: classTeacher?.id ?? `${schoolId}-t-1`,
        teacherName: classTeacher?.fullName ?? 'آموزگار کلاس',
        subject: cIdx % 2 === 0 ? 'ریاضی' : 'فارسی',
        jalaliDate: activeDayJalali,
        period: ((cIdx % 4) + 1) as 1 | 2 | 3 | 4,
        topicTitle:
          cIdx % 2 === 0
            ? MATH_TOPICS_BY_GRADE[cls.gradeLevel][2].topic
            : PERSIAN_TOPICS_BY_GRADE[cls.gradeLevel][2].topic,
        goals: 'درک مفهومی مبحث هفته، مشارکت فعال تمام دانش‌آموزان در حل نمونه تمرین و رفع اشکال فردی.',
        tools: 'تخته هوشمند، کارت‌های آموزشی، کاربرگ تمرینی چاپی و خط‌کش آموزشی.',
        activities: 'پیش‌آزمون کوتاه ۵ دقیقه‌ای، تدریس اکتشافی با مشارکت گروهی، حل ۳ تمرین پای تخته و جمع‌بندی.',
        teachingReport:
          '۸۵ درصد دانش‌آموزان به تسلط کامل رسیدند؛ برای ۳ دانش‌آموز تمرین تقویتی هدفمند در کارپوشه تکالیف قرار داده شد.',
        educationalRemarks: 'فضای کلاس پویا و منظم بود؛ پیگیری تکلیف جلسه آینده در ابتدای زنگ بعدی انجام می‌شود.',
        updatedAt: nowIso,
      });
    });

    // Seed 2 Grade Appeals per school (1 submitted for review, 1 teacher_reviewed awaiting principal approval)
    if (schoolStudents[0] && schoolClasses[0]) {
      const targetEntryId = `${schoolId}:gb:${schoolClasses[0].id}:ریاضی:آذر:${schoolStudents[0].id}`;
      grade_appeals.push({
        id: `${schoolId}:appeal:1`,
        schoolId,
        studentId: schoolStudents[0].id,
        classId: schoolClasses[0].id,
        subject: 'ریاضی',
        jalaliMonth: 'آذر',
        gradeEntryId: targetEntryId,
        originalScore: 17.5,
        originalDescriptiveLevel: 'خیلی خوب',
        parentReason: 'با سلام، لطفاً برگه ارزشیابی آذرماه مجدداً بررسی شود؛ امتیاز تمرین اضافی صفحه ۴۲ در نمره لحاظ نشده است.',
        submittedByName: schoolStudents[0].parentName,
        submittedAtJalali: addDaysToJalali(activeDayJalali, -2),
        status: 'submitted',
        updatedAt: nowIso,
      });
    }
    if (schoolStudents[5] && schoolClasses[1]) {
      const targetEntryId2 = `${schoolId}:gb:${schoolClasses[1].id}:فارسی:آبان:${schoolStudents[5].id}`;
      grade_appeals.push({
        id: `${schoolId}:appeal:2`,
        schoolId,
        studentId: schoolStudents[5].id,
        classId: schoolClasses[1].id,
        subject: 'فارسی',
        jalaliMonth: 'آبان',
        gradeEntryId: targetEntryId2,
        originalScore: 16,
        originalDescriptiveLevel: 'خوب',
        parentReason: 'درخواست بازبینی نمره املای تقریری آبان‌ماه با توجه به تصحیح مجدد دفتر.',
        submittedByName: schoolStudents[5].parentName,
        submittedAtJalali: addDaysToJalali(activeDayJalali, -5),
        status: 'teacher_reviewed',
        teacherResponse: 'برگه مجدداً بررسی شد؛ یک امتیاز در بخش نگارش اضافه و نمره به ۱۷ ارتقا یافت.',
        teacherReviewedByName: schoolTeachers[1]?.fullName ?? 'آموزگار کلاس',
        revisedScore: 17,
        revisedDescriptiveLevel: 'خیلی خوب',
        updatedAt: nowIso,
      });
    }

    // 4. Seed Online Homework Assignments & Submissions (feeding directly into Gradebook Continuous Assessment!)
    schoolClasses.forEach((cls, cIdx) => {
      const classTeacher = schoolTeachers[cIdx] ?? schoolTeachers[0];
      const classStudents = schoolStudents.filter((s) => s.classId === cls.id);

      const hwMathId = `${schoolId}:hw:${cls.id}:1`;
      const hwPersianId = `${schoolId}:hw:${cls.id}:2`;

      homework_assignments.push(
        {
          id: hwMathId,
          schoolId,
          classId: cls.id,
          teacherId: classTeacher?.id ?? `${schoolId}-t-1`,
          teacherName: classTeacher?.fullName ?? 'آموزگار کلاس',
          subject: 'ریاضی',
          title: `تمرین هفتگی ریاضی — ${MATH_TOPICS_BY_GRADE[cls.gradeLevel][2].topic.slice(0, 38)}`,
          description: 'لطفاً ۵ تمرین منتخب کاربرگ کلاسی را به‌صورت مرتب در دفتر حل کرده و پاسخ نهایی یا تصویر برگه را ارسال نمایید.',
          dueDateJalali: addDaysToJalali(activeDayJalali, 3),
          createdAtJalali: addDaysToJalali(activeDayJalali, -2),
          maxScore: 20,
          createdAt: nowIso,
        },
        {
          id: hwPersianId,
          schoolId,
          classId: cls.id,
          teacherId: classTeacher?.id ?? `${schoolId}-t-1`,
          teacherName: classTeacher?.fullName ?? 'آموزگار کلاس',
          subject: 'فارسی',
          title: `نگارش و درک مطلب — ${PERSIAN_TOPICS_BY_GRADE[cls.gradeLevel][2].topic.slice(0, 38)}`,
          description: 'یک بند ۵ جمله‌ای با استفاده از واژه‌های جدید درس بنویسید و خلاصه داستان را با بیان خودتان ثبت کنید.',
          dueDateJalali: addDaysToJalali(activeDayJalali, 5),
          createdAtJalali: addDaysToJalali(activeDayJalali, -1),
          maxScore: 20,
          createdAt: nowIso,
        }
      );

      // Seed realistic submissions for students (some reviewed with scores, some awaiting review, some pending for parent demo!)
      classStudents.forEach((st, stIdx) => {
        // Leave student 0's Persian homework pending so parent demo account can immediately submit it!
        if (stIdx < 4) {
          const isReviewed = stIdx < 3;
          const score = isReviewed ? Math.min(20, 17 + (stIdx % 3) + (schoolIdx % 2 === 0 ? 0.5 : 0)) : undefined;
          homework_submissions.push({
            id: `${schoolId}:hwsub:${hwMathId}:${st.id}`,
            schoolId,
            assignmentId: hwMathId,
            studentId: st.id,
            classId: cls.id,
            answerText:
              'تمامی ۵ تمرین ریاضی با راه‌حل کامل و بررسی درستی پاسخ در دفتر حل شد. در سوال ۴ از روش رسم محور استفاده کردم.',
            submittedAtJalali: addDaysToJalali(activeDayJalali, -1),
            submittedAtIso: nowIso,
            status: isReviewed ? 'reviewed' : 'submitted',
            score,
            qualityLevel: score !== undefined ? scoreToDesc(score) : undefined,
            teacherFeedback: isReviewed
              ? 'آفرین! راه‌حل‌ها بسیار منظم و دقیق نوشته شده‌اند.'
              : undefined,
            reviewedAt: isReviewed ? nowIso : undefined,
          });
        }

        if (stIdx >= 1 && stIdx < 3) {
          const pScore = 18.5 - (stIdx % 2);
          homework_submissions.push({
            id: `${schoolId}:hwsub:${hwPersianId}:${st.id}`,
            schoolId,
            assignmentId: hwPersianId,
            studentId: st.id,
            classId: cls.id,
            answerText:
              'بند نگارش با رعایت کامل نشانه‌های نگارشی و استفاده از ۶ واژه جدید درس نوشته و بازخوانی شد.',
            submittedAtJalali: activeDayJalali,
            submittedAtIso: nowIso,
            status: 'reviewed',
            score: pScore,
            qualityLevel: scoreToDesc(pScore),
            teacherFeedback: 'نگارش روان و خوش‌خط بود؛ بسیار عالی.',
            reviewedAt: nowIso,
          });
        }
      });
    });

    // 5. Seed Student Rewards & A4 Certificate Records across all 3 schools
    const rewardTargets = [
      { student: schoolStudents[0], badgeIdx: 0, dayOffset: -1 },
      { student: schoolStudents[0], badgeIdx: 3, dayOffset: -4 },
      { student: schoolStudents[2], badgeIdx: 2, dayOffset: -2 },
      { student: schoolStudents[5], badgeIdx: 1, dayOffset: -1 },
      { student: schoolStudents[10], badgeIdx: 4, dayOffset: -3 },
      { student: schoolStudents[15], badgeIdx: 0, dayOffset: 0 },
    ];

    rewardTargets.forEach((item, rIdx) => {
      if (!item.student) return;
      const badge = presetBadges[item.badgeIdx % presetBadges.length];
      const clsTeacher =
        schoolTeachers.find((t) => t.assignedClassIds.includes(item.student.classId)) ??
        schoolTeachers[0];
      student_rewards.push({
        id: `${schoolId}:reward:${rIdx + 1}`,
        schoolId,
        studentId: item.student.id,
        classId: item.student.classId,
        badgeId: badge.badgeId,
        badgeTitle: badge.badgeTitle,
        badgeColor: badge.badgeColor,
        category: badge.category,
        reason: badge.reason,
        jalaliDate: addDaysToJalali(activeDayJalali, item.dayOffset),
        awardedByName: clsTeacher?.fullName ?? school.principalName,
        awardedByRole: 'teacher',
        certificateSerial: `1405-${schoolIdx + 1}0${rIdx + 11}`,
        createdAt: nowIso,
      });
    });
  });

  return {
    curriculum_topics,
    media_resources,
    chat_outbox,
    gradebook_entries,
    lesson_plans,
    gradebook_weights,
    grade_appeals,
    homework_assignments,
    homework_submissions,
    student_rewards,
  };
}
