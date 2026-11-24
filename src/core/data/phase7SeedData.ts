// Realistic Deterministic Seed Data for Phase 7: Teacher Professional Development & 5-Tier Ranking across all 3 schools
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import {
  buildQuizAttemptSeed,
  generateCertificateSerial,
  isOnTimeCompletion,
} from '../../plugins/teacher-development/teacherDevHelpers';
import type {
  School,
  Teacher,
  TeacherDevCertificate,
  TeacherDevChapter,
  TeacherDevCourse,
  TeacherDevProgress,
  TeacherDevQuizQuestion,
  TeacherDevRankingPrivacyMode,
  TeacherDevSchoolSettings,
} from '../../types/domain';

export const PHASE7_PLUGIN_IDS = ['teacher-development'] as const;

export interface Phase7SeedBundle {
  td_courses: TeacherDevCourse[];
  td_progress: TeacherDevProgress[];
  td_certificates: TeacherDevCertificate[];
  td_school_settings: TeacherDevSchoolSettings[];
}

interface CourseBlueprint {
  slug: string;
  groupKey?: string;
  scope: 'all' | 'school';
  title: string;
  description: string;
  contentType: TeacherDevCourse['contentType'];
  requirement: TeacherDevCourse['requirement'];
  inServiceHours: number;
  deadlineOffsetDays: number;
  passingScorePercent: number;
  maxAttempts: number;
  chapters: TeacherDevChapter[];
  quizQuestions: TeacherDevQuizQuestion[];
}

const COURSE_BLUEPRINTS: CourseBlueprint[] = [
  {
    slug: 'flipped-active',
    groupKey: 'td-global-flipped-1405',
    scope: 'all',
    title: 'طراحی کلاس وارونه و یادگیری فعال',
    description:
      'آشنایی کاربردی با مدل کلاس وارونه (Flipped Classroom)، طراحی ویدیوهای کوتاه پیش‌مطالعه و تبدیل زمان کلاس به کارگاه حل مسئله و مشارکت فعال دانش‌آموزان.',
    contentType: 'course',
    requirement: 'mandatory',
    inServiceHours: 8,
    deadlineOffsetDays: 18,
    passingScorePercent: 70,
    maxAttempts: 3,
    chapters: [
      {
        id: 'ch-1',
        order: 1,
        title: 'فصل اول: مبانی کلاس وارونه و نقش جدید معلم',
        estimatedMinutes: 15,
        externalUrl: 'https://edu.example.ir/flipped-guide',
        content:
          'در الگوی کلاس وارونه، انتقال مفاهیم پایه پیش از حضور در کلاس و از طریق ویدیوهای کوتاه ۵ تا ۸ دقیقه‌ای یا جزوه‌های هدفمند انجام می‌شود. به این ترتیب، زمان ارزشمند کلاس حضوری به جای سخنرانی یک‌طرفه، صرف رفع اشکال فردی، فعالیت‌های گروهی و تعمیق یادگیری می‌شود. معلم در این الگو از «انتقال‌دهنده صرف اطلاعات» به «راهبر و تسهیل‌گر یادگیری» تبدیل می‌گردد.',
      },
      {
        id: 'ch-2',
        order: 2,
        title: 'فصل دوم: اصول تولید میکروویدیو و آزمونک سنجش پیش‌مطالعه',
        estimatedMinutes: 20,
        content:
          'تحقیقات آموزشی نشان می‌دهد تمرکز دانش‌آموزان در ویدیوهای آموزشی پس از دقیقه هفتم به شکل محسوسی کاهش می‌یابد. بنابراین هر درس باید به قطعات کوچک با یک هدف یادگیری مشخص تقسیم شود. قرار دادن ۲ تا ۳ سوال کوتاه در پایان ویدیو باعث می‌شود دانش‌آموز با دقت بیشتری محتوا را دنبال کند و معلم پیش از شروع زنگ کلاس، تصویر دقیقی از نقاط ضعف کلاس داشته باشد.',
      },
      {
        id: 'ch-3',
        order: 3,
        title: 'فصل سوم: راهبردهای یادگیری فعال و ایستگاه‌های تمرین در کلاس',
        estimatedMinutes: 20,
        content:
          'پس از اطمینان از پیش‌مطالعه، کلاس حضوری می‌تواند در قالب ایستگاه‌های یادگیری، روش «بیندیش — با همکار بگو — به اشتراک بگذار» (Think-Pair-Share) و حل مسئله تیمی اداره شود. دانش‌آموزانی که سریع‌تر به تسلط می‌رسند، در قالب همیار آموزشی به همکلاسی‌ها کمک می‌کنند و معلم فرصت کافی برای حمایت مستقیم از دانش‌آموزان نیازمند تمرین بیشتر خواهد داشت.',
      },
    ],
    quizQuestions: [
      {
        id: 'q-fl-1',
        prompt: 'مهم‌ترین مزیت اجرای الگوی کلاس وارونه در زمان کلاس حضوری چیست؟',
        options: [
          { id: 'opt-1', text: 'آزاد شدن زمان کلاس برای حل مسئله، کار گروهی و رفع اشکال فردی' },
          { id: 'opt-2', text: 'حذف کامل نیاز به حضور معلم در کلاس درس' },
          { id: 'opt-3', text: 'افزایش حجم تکالیف نوشتاری شبانه دانش‌آموزان' },
          { id: 'opt-4', text: 'جایگزینی تمام آزمون‌های کلاسی با سخنرانی‌های طولانی' },
        ],
        correctOptionId: 'opt-1',
      },
      {
        id: 'q-fl-2',
        prompt: 'مدت زمان استاندارد و پیشنهادی برای هر میکروویدیوی پیش‌مطالعه چقدر است؟',
        options: [
          { id: 'opt-1', text: 'حدود ۴۵ دقیقه معادل یک زنگ کامل' },
          { id: 'opt-2', text: 'بین ۵ تا ۸ دقیقه با تمرکز بر یک هدف آموزشی مشخص' },
          { id: 'opt-3', text: 'حداقل ۳۰ دقیقه بدون توقف' },
          { id: 'opt-4', text: 'تنها متن کتاب بدون توضیح یا مثال' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        id: 'q-fl-3',
        prompt: 'هدف اصلی از قرار دادن آزمونک کوتاه پس از ویدیوی پیش‌مطالعه چیست؟',
        options: [
          { id: 'opt-1', text: 'تنبیه دانش‌آموزانی که نمره پایین می‌گیرند' },
          { id: 'opt-2', text: 'جایگزینی نمره نهایی پایان ترم' },
          { id: 'opt-3', text: 'سنجش میزان درک اولیه و شناسایی نقاط ابهام پیش از شروع کلاس' },
          { id: 'opt-4', text: 'کاهش تعامل میان دانش‌آموز و معلم' },
        ],
        correctOptionId: 'opt-3',
      },
      {
        id: 'q-fl-4',
        prompt: 'در راهبرد «بیندیش — با همکار بگو — به اشتراک بگذار»، گام اول چیست؟',
        options: [
          { id: 'opt-1', text: 'ارائه فوری پاسخ توسط معلم روی تخته' },
          { id: 'opt-2', text: 'تشکیل گروه ۱۰ نفره بدون زمان تفکر' },
          { id: 'opt-3', text: 'حذف پرسش و پاسخ کلاسی' },
          { id: 'opt-4', text: 'فرصت کوتاه تفکر فردی برای هر دانش‌آموز پیش از گفت‌وگوی دونفره' },
        ],
        correctOptionId: 'opt-4',
      },
      {
        id: 'q-fl-5',
        prompt: 'نقش اصلی معلم در کلاس وارونه کدام مورد است؟',
        options: [
          { id: 'opt-1', text: 'راهبر، مربی و تسهیل‌گر یادگیری فعال دانش‌آموزان' },
          { id: 'opt-2', text: 'سخنران یک‌طرفه در تمام طول زنگ' },
          { id: 'opt-3', text: 'صرفاً تصحیح‌کننده برگه‌های امتحانی' },
          { id: 'opt-4', text: 'تکرار کامل همان ویدیو بدون تمرین عملی' },
        ],
        correctOptionId: 'opt-1',
      },
    ],
  },
  {
    slug: 'classroom-communication',
    groupKey: 'td-global-classroom-mgmt-1405',
    scope: 'all',
    title: 'مدیریت کلاس و ارتباط مؤثر با دانش‌آموزان و نوجوانان',
    description:
      'کتابچه مطالعاتی راهبردهای ایجاد فضای امن و منظم در کلاس، گوش‌دادن فعال، مدیریت رفتار بدون تنش و ایجاد انگیزه درونی در یادگیرندگان.',
    contentType: 'book',
    requirement: 'mandatory',
    inServiceHours: 6,
    deadlineOffsetDays: -4, // Past deadline to demonstrate overdue alert in participation matrix for incomplete teachers
    passingScorePercent: 75,
    maxAttempts: 3,
    chapters: [
      {
        id: 'ch-1',
        order: 1,
        title: 'فصل اول: قواعد شفاف کلاسی و مشارکت دانش‌آموزان در تدوین قوانین',
        estimatedMinutes: 15,
        content:
          'کلاسی که قواعد آن در هفته اول سال تحصیلی با گفت‌وگو و مشارکت خود دانش‌آموزان نوشته می‌شود، تعهد و پذیرش بسیار بالاتری ایجاد می‌کند. قوانین مؤثر باید کوتاه، با بیان مثبت (به‌جای «شلوغ نکنید» بگوییم «هنگام صحبت دیگران با دقت گوش دهیم») و دارای پیامدهای منطقی و قابل پیش‌بینی باشند.',
      },
      {
        id: 'ch-2',
        order: 2,
        title: 'فصل دوم: گوش‌دادن فعال و بازخورد رشدگرا',
        estimatedMinutes: 15,
        content:
          'در برخورد با چالش‌های رفتاری یا افت تحصیلی، استفاده از «پیام‌های من» (I-Messages) و تمرکز بر رفتار به جای برچسب زدن به شخصیت دانش‌آموز، مقاومت دفاعی او را کاهش می‌دهد. تشویق تلاش، پشتکار و راهبرد صحیح (به‌جای تحسین صرف هوش ذاتی) ذهنیت رشد را در دانش‌آموزان تقویت می‌کند.',
      },
      {
        id: 'ch-3',
        order: 3,
        title: 'فصل سوم: همکاری سازنده با اولیا در مدیریت رفتار',
        estimatedMinutes: 15,
        content:
          'ارتباط مستمر و مثبت با اولیا پیش از بروز بحران، پایه اعتماد متقابل است. زمانی که اولین تماس معلم با خانواده حاوی یک نکته مثبت و امیدبخش درباره فرزندشان باشد، در مواقع نیاز به پیگیری انضباطی یا آموزشی، والدین با همدلی بسیار بیشتری کنار مدرسه قرار می‌گیرند.',
      },
    ],
    quizQuestions: [
      {
        id: 'q-cm-1',
        prompt: 'کدام ویژگی باعث اثربخشی بیشتر قوانین کلاسی می‌شود؟',
        options: [
          { id: 'opt-1', text: 'تدوین بیش از ۳۰ قانون طولانی و سخت‌گیرانه' },
          { id: 'opt-2', text: 'بیان مثبت، شفاف و مشارکت دادن دانش‌آموزان در توافق بر سر قوانین' },
          { id: 'opt-3', text: 'تغییر روزانه قوانین بسته به شرایط' },
          { id: 'opt-4', text: 'اعلام نکردن قوانین تا زمان وقوع خطا' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        id: 'q-cm-2',
        prompt: 'در ارائه بازخورد رشدگرا (Growth Mindset) معلم باید بر چه چیزی تمرکز کند؟',
        options: [
          { id: 'opt-1', text: 'مقایسه علنی دانش‌آموز با نفر اول کلاس' },
          { id: 'opt-2', text: 'تحسین صرف هوش ذاتی بدون اشاره به تلاش' },
          { id: 'opt-3', text: 'تحسین تلاش، روش حل مسئله و پیشرفت مرحله‌به‌مرحله دانش‌آموز' },
          { id: 'opt-4', text: 'بیان تنها نمره عددی بدون توضیح' },
        ],
        correctOptionId: 'opt-3',
      },
      {
        id: 'q-cm-3',
        prompt: 'بهترین رویکرد هنگام تذکر رفتاری در کلاس کدام است؟',
        options: [
          { id: 'opt-1', text: 'تمرکز بر اصلاح رفتار مشخص با حفظ احترام و کرامت دانش‌آموز' },
          { id: 'opt-2', text: 'برچسب زدن به شخصیت دانش‌آموز در جمع' },
          { id: 'opt-3', text: 'نادیده گرفتن همیشگی بی‌نظمی‌های تکرارشونده' },
          { id: 'opt-4', text: 'قطع کامل تدریس به مدت طولانی برای مشاجره' },
        ],
        correctOptionId: 'opt-1',
      },
      {
        id: 'q-cm-4',
        prompt: 'چه اقدامی همکاری اولیا را در حل مسائل تربیتی افزایش می‌دهد؟',
        options: [
          { id: 'opt-1', text: 'تماس با اولیا صرفاً در زمان بروز مشکل جدی' },
          { id: 'opt-2', text: 'ارسال پیام‌های کوتاه بدون شرح راهکار' },
          { id: 'opt-3', text: 'ممنوع کردن گفت‌وگوی مستقیم ولی با معلم' },
          { id: 'opt-4', text: 'شروع ارتباط با نکات مثبت و ارائه برنامه همکاری مشترک با خانواده' },
        ],
        correctOptionId: 'opt-4',
      },
    ],
  },
  {
    slug: 'formative-assessment',
    scope: 'school',
    title: 'سنجش تکوینی و طراحی سوال استاندارد',
    description:
      'کارگاه تخصصی طراحی سوالات مفهومی بر اساس طبقه‌بندی بلوم، تدوین جدول بارم‌بندی و استفاده از ارزشیابی تکوینی برای بهبود مستمر یادگیری.',
    contentType: 'video_workshop',
    requirement: 'optional',
    inServiceHours: 4,
    deadlineOffsetDays: 30,
    passingScorePercent: 70,
    maxAttempts: 3,
    chapters: [
      {
        id: 'ch-1',
        order: 1,
        title: 'فصل اول: تفاوت سنجش تکوینی و سنجش پایانی',
        estimatedMinutes: 12,
        externalUrl: 'https://edu.example.ir/formative-workshop',
        content:
          'سنجش پایانی برای نمره‌دهی و قضاوت نهایی در پایان فصل انجام می‌شود، اما سنجش تکوینی در میانه فرآیند یادگیری اجرا می‌گردد تا هم معلم و هم دانش‌آموز متوجه شوند کدام مفهوم هنوز تثبیت نشده و چه اصلاحی در روش تدریس لازم است.',
      },
      {
        id: 'ch-2',
        order: 2,
        title: 'فصل دوم: اصول طراحی سوالات چهارگزینه‌ای و تشریحی استاندارد',
        estimatedMinutes: 15,
        content:
          'در طراحی سوال چهارگزینه‌ای استاندارد، تنه سوال باید شفاف و بدون ابهام باشد، گزینه‌های انحرافی هم‌وزن و منطقی باشند و از کاربرد عبارات منفی دوگانه پرهیز شود. همچنین سوالات باید علاوه بر سطح دانش، سطوح درک، کاربرد و تحلیل را نیز بسنجند.',
      },
      {
        id: 'ch-3',
        order: 3,
        title: 'فصل سوم: تحلیل آزمون و طراحی تمرین‌های جبرانی هدفمند',
        estimatedMinutes: 15,
        content:
          'پس از برگزاری هر آزمون کوتاه، بررسی سوالاتی که بیش از ۴۰ درصد کلاس به آن‌ها پاسخ نادرست داده‌اند، ارزشمندترین داده برای برنامه‌ریزی جلسه مرور بعدی و طراحی تمرین‌های تقویتی هدفمند است.',
      },
    ],
    quizQuestions: [
      {
        id: 'q-fa-1',
        prompt: 'هدف اصلی سنجش تکوینی در فرآیند آموزش چیست؟',
        options: [
          { id: 'opt-1', text: 'تشخیص به‌موقع نقاط ضعف یادگیری و اصلاح فرآیند تدریس پیش از امتحان پایانی' },
          { id: 'opt-2', text: 'رتبه‌بندی نهایی دانش‌آموزان در پایان سال' },
          { id: 'opt-3', text: 'افزایش اضطراب امتحان در کلاس' },
          { id: 'opt-4', text: 'حذف بازخورد توصیفی معلم' },
        ],
        correctOptionId: 'opt-1',
      },
      {
        id: 'q-fa-2',
        prompt: 'در طراحی یک سوال چهارگزینه‌ای استاندارد، کدام نکته باید رعایت شود؟',
        options: [
          { id: 'opt-1', text: 'گزینه صحیح همیشه طولانی‌تر از سایر گزینه‌ها باشد' },
          { id: 'opt-2', text: 'تنه سوال شفاف باشد و گزینه‌های انحرافی منطقی و هم‌وزن نوشته شوند' },
          { id: 'opt-3', text: 'استفاده مداوم از افعال منفی دوگانه در تنه سوال' },
          { id: 'opt-4', text: 'طراحی تمام سوالات صرفاً در سطح حفظ طوطی‌وار' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        id: 'q-fa-3',
        prompt: 'اگر بیش از ۴۰ درصد کلاس به یک سوال آزمون پاسخ اشتباه دهند، بهترین اقدام معلم چیست؟',
        options: [
          { id: 'opt-1', text: 'عبور سریع به فصل بعدی کتاب' },
          { id: 'opt-2', text: 'تکرار همان امتحان بدون توضیح مجدد' },
          { id: 'opt-3', text: 'بازآموزش آن مفهوم با مثال‌های ملموس‌تر و بررسی ابهام سوال' },
          { id: 'opt-4', text: 'نادیده گرفتن نتیجه تحلیل آزمون' },
        ],
        correctOptionId: 'opt-3',
      },
      {
        id: 'q-fa-4',
        prompt: 'کدام سطح از طبقه‌بندی بلوم نسبت به حفظ کردن در سطح بالاتری قرار دارد؟',
        options: [
          { id: 'opt-1', text: 'تکرار عین جمله کتاب' },
          { id: 'opt-2', text: 'یادآوری تاریخ‌ها' },
          { id: 'opt-3', text: 'رونویسی متن' },
          { id: 'opt-4', text: 'کاربرد و تحلیل در موقعیت‌های جدید' },
        ],
        correctOptionId: 'opt-4',
      },
    ],
  },
  {
    slug: 'smart-edtech',
    scope: 'school',
    title: 'کاربرد هوشمند فناوری و سواد رسانه‌ای در تدریس',
    description:
      'دوره عملی به‌کارگیری ابزارهای دیجیتال آموزشی، حفظ ایمنی دانش‌آموزان در فضای مجازی و تولید محتوای تعاملی برای کلاس‌های هوشمند.',
    contentType: 'course',
    requirement: 'mandatory',
    inServiceHours: 10,
    deadlineOffsetDays: 25,
    passingScorePercent: 70,
    maxAttempts: 3,
    chapters: [
      {
        id: 'ch-1',
        order: 1,
        title: 'فصل اول: چارچوب TPACK و انتخاب ابزار متناسب با هدف درسی',
        estimatedMinutes: 15,
        content:
          'فناوری زمانی یادگیری را ارتقا می‌دهد که در خدمت هدف آموزشی باشد نه جایگزین آن. الگوی TPACK بر پیوند متعادل دانش محتوایی، دانش روش تدریس و دانش فناوری تأکید دارد.',
      },
      {
        id: 'ch-2',
        order: 2,
        title: 'فصل دوم: ایمنی دیجیتال و تربیت شهروند مسئول فضای مجازی',
        estimatedMinutes: 15,
        content:
          'آموزش حفظ حریم خصوصی، تشخیص اخبار نادرست و رعایت ادب در پیام‌رسان‌های آموزشی (مانند شاد، ایتا و بله) بخشی جدایی‌ناپذیر از سواد رسانه‌ای معلمان و دانش‌آموزان است.',
      },
      {
        id: 'ch-3',
        order: 3,
        title: 'فصل سوم: شخصی‌سازی یادگیری با تحلیل داده‌های کلاسی',
        estimatedMinutes: 15,
        content:
          'استفاده از گزارش‌های حضور و غیاب، تکالیف و روند ماهانه نمرات به معلم کمک می‌کند پیش از افت تحصیلی، برنامه‌های تقویتی فردی طراحی کرده و مسیر یادگیری هر دانش‌آموز را هوشمندانه هدایت کند.',
      },
    ],
    quizQuestions: [
      {
        id: 'q-et-1',
        prompt: 'معیار اصلی انتخاب یک ابزار فناوری برای کلاس درس چیست؟',
        options: [
          { id: 'opt-1', text: 'تناسب مستقیم با هدف آموزشی و تسهیل درک مفهوم درسی' },
          { id: 'opt-2', text: 'پیچیدگی فنی بیشتر ابزار' },
          { id: 'opt-3', text: 'حذف تعامل چهره‌به‌چهره کلاس' },
          { id: 'opt-4', text: 'استفاده از همه ابزارها در یک جلسه' },
        ],
        correctOptionId: 'opt-1',
      },
      {
        id: 'q-et-2',
        prompt: 'مدل TPACK بر ترکیب متعادل کدام سه دانش تأکید دارد؟',
        options: [
          { id: 'opt-1', text: 'فقط سخت‌افزار، شبکه و برنامه‌نویسی' },
          { id: 'opt-2', text: 'دانش محتوا، دانش روش تدریس و دانش فناوری' },
          { id: 'opt-3', text: 'حسابداری، اداری و بایگانی' },
          { id: 'opt-4', text: 'طراحی گرافیک، چاپ و ویراستاری' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        id: 'q-et-3',
        prompt: 'کدام مورد بخشی از آموزش سواد رسانه‌ای و ایمنی دیجیتال به دانش‌آموزان است؟',
        options: [
          { id: 'opt-1', text: 'اشتراک‌گذاری رمز عبور حساب کاربری با دوستان' },
          { id: 'opt-2', text: 'بازنشر سریع هر پیام بدون بررسی منبع' },
          { id: 'opt-3', text: 'حفظ حریم خصوصی، راستی‌آزمایی منابع و رعایت ادب در فضای مجازی' },
          { id: 'opt-4', text: 'نادیده گرفتن امنیت اطلاعات شخصی' },
        ],
        correctOptionId: 'opt-3',
      },
      {
        id: 'q-et-4',
        prompt: 'مهم‌ترین کاربرد تحلیل داده‌های آموزشی برای معلم چیست؟',
        options: [
          { id: 'opt-1', text: 'تشخیص زودهنگام افت تحصیلی و طراحی حمایت هدفمند برای دانش‌آموز' },
          { id: 'opt-2', text: 'افزایش کاغذبازی بدون اقدام اصلاحی' },
          { id: 'opt-3', text: 'انتشار عمومی نمرات ضعیف در گروه کلاس' },
          { id: 'opt-4', text: 'کاهش ارتباط با اولیا' },
        ],
        correctOptionId: 'opt-1',
      },
    ],
  },
];

export function generatePhase7SeedData(params: {
  schools: School[];
  teachers: Teacher[];
  anchorTodayJalali?: string;
}): Phase7SeedBundle {
  const today = params.anchorTodayJalali ?? getTodayJalali();
  const nowIso = new Date().toISOString();

  const td_courses: TeacherDevCourse[] = [];
  const td_progress: TeacherDevProgress[] = [];
  const td_certificates: TeacherDevCertificate[] = [];
  const td_school_settings: TeacherDevSchoolSettings[] = [];

  const defaultPrivacyBySchool: Record<string, TeacherDevRankingPrivacyMode> = {
    'school-1': 'private',
    'school-2': 'top3_only',
    'school-3': 'public',
  };

  params.schools.forEach((school, sIdx) => {
    td_school_settings.push({
      id: `${school.id}:tdsettings`,
      schoolId: school.id,
      rankingPrivacyMode: defaultPrivacyBySchool[school.id] ?? 'private',
      updatedByName: school.principalName,
      updatedAt: nowIso,
    });

    const schoolCourses: TeacherDevCourse[] = COURSE_BLUEPRINTS.map((bp) => {
      const courseId = `${school.id}:tdc:${bp.slug}`;
      const deadlineJalali = addDaysToJalali(today, bp.deadlineOffsetDays);
      const course: TeacherDevCourse = {
        id: courseId,
        schoolId: school.id,
        scope: bp.scope,
        groupKey: bp.groupKey,
        title: bp.title,
        description: bp.description,
        contentType: bp.contentType,
        requirement: bp.requirement,
        inServiceHours: bp.inServiceHours,
        deadlineJalali,
        passingScorePercent: bp.passingScorePercent,
        maxAttempts: bp.maxAttempts,
        shuffleOptions: true,
        shuffleQuestions: true,
        status: 'active',
        chapters: bp.chapters.map((ch) => ({ ...ch })),
        quizQuestions: bp.quizQuestions.map((q) => ({
          ...q,
          options: q.options.map((o) => ({ ...o })),
        })),
        createdByName: bp.scope === 'all' ? 'مدیریت کل مجموعه مدارس' : school.principalName,
        createdByRole: bp.scope === 'all' ? 'complex_admin' : 'principal',
        createdAtJalali: addDaysToJalali(today, -20),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      td_courses.push(course);
      return course;
    });

    const schoolTeachers = params.teachers.filter((t) => t.schoolId === school.id && t.active);

    const recordCompleted = (
      teacher: Teacher,
      course: TeacherDevCourse,
      scorePercent: number,
      completedOffsetDays: number
    ) => {
      const completedDate = addDaysToJalali(today, completedOffsetDays);
      const totalQ = course.quizQuestions.length;
      const correctCount = Math.max(1, Math.min(totalQ, Math.round((scorePercent / 100) * totalQ)));
      const answers: Record<string, string> = {};
      course.quizQuestions.forEach((q, qIdx) => {
        answers[q.id] = qIdx < correctCount ? q.correctOptionId : q.options.find((o) => o.id !== q.correctOptionId)?.id ?? q.correctOptionId;
      });

      const certId = `${school.id}:tdcert:${course.id}:${teacher.id}`;
      const onTime = isOnTimeCompletion(completedDate, course.deadlineJalali);
      const cert: TeacherDevCertificate = {
        id: certId,
        schoolId: school.id,
        courseId: course.id,
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        courseTitle: course.title,
        contentType: course.contentType,
        requirement: course.requirement,
        inServiceHours: course.inServiceHours,
        scorePercent,
        issuedDateJalali: completedDate,
        serialNumber: generateCertificateSerial({
          schoolId: school.id,
          teacherId: teacher.id,
          courseId: course.id,
          issuedDateJalali: completedDate,
        }),
        onTime,
        createdAt: nowIso,
      };
      td_certificates.push(cert);

      td_progress.push({
        id: `${school.id}:tdprog:${course.id}:${teacher.id}`,
        schoolId: school.id,
        courseId: course.id,
        teacherId: teacher.id,
        completedChapterIds: course.chapters.map((ch) => ch.id),
        attempts: [
          {
            attemptNumber: 1,
            seed: buildQuizAttemptSeed(teacher.id, course.id, 1),
            answers,
            correctCount,
            totalQuestions: totalQ,
            scorePercent,
            passed: true,
            submittedAtJalali: completedDate,
            submittedAtIso: nowIso,
          },
        ],
        bestScorePercent: scorePercent,
        status: 'completed',
        completedAtJalali: completedDate,
        completedAtIso: nowIso,
        certificateId: certId,
        updatedAt: nowIso,
      });
    };

    const recordInProgress = (
      teacher: Teacher,
      course: TeacherDevCourse,
      completedChapterCount: number
    ) => {
      td_progress.push({
        id: `${school.id}:tdprog:${course.id}:${teacher.id}`,
        schoolId: school.id,
        courseId: course.id,
        teacherId: teacher.id,
        completedChapterIds: course.chapters.slice(0, completedChapterCount).map((ch) => ch.id),
        attempts: [],
        status: 'in_progress',
        updatedAt: nowIso,
      });
    };

    const recordQuizFailed = (
      teacher: Teacher,
      course: TeacherDevCourse,
      scorePercent: number
    ) => {
      const totalQ = course.quizQuestions.length;
      const correctCount = Math.max(0, Math.min(totalQ - 1, Math.round((scorePercent / 100) * totalQ)));
      const answers: Record<string, string> = {};
      course.quizQuestions.forEach((q, qIdx) => {
        answers[q.id] = qIdx < correctCount ? q.correctOptionId : q.options.find((o) => o.id !== q.correctOptionId)?.id ?? q.correctOptionId;
      });
      td_progress.push({
        id: `${school.id}:tdprog:${course.id}:${teacher.id}`,
        schoolId: school.id,
        courseId: course.id,
        teacherId: teacher.id,
        completedChapterIds: course.chapters.map((ch) => ch.id),
        attempts: [
          {
            attemptNumber: 1,
            seed: buildQuizAttemptSeed(teacher.id, course.id, 1),
            answers,
            correctCount,
            totalQuestions: totalQ,
            scorePercent,
            passed: false,
            submittedAtJalali: addDaysToJalali(today, -1),
            submittedAtIso: nowIso,
          },
        ],
        bestScorePercent: scorePercent,
        status: 'quiz_failed',
        updatedAt: nowIso,
      });
    };

    const [cFlipped, cBook, cWorkshop, cEdtech] = schoolCourses;

    schoolTeachers.forEach((teacher, tIdx) => {
      // Teacher 0 (e.g., school-1-t-1, demo login account):
      // Mid-study on cFlipped (2/3 chapters -> quiz locked, ready to test!), completed cBook & cEdtech, not started cWorkshop
      if (tIdx === 0) {
        recordInProgress(teacher, cFlipped, 2);
        recordCompleted(teacher, cBook, 100, -7);
        recordCompleted(teacher, cEdtech, 88, -3);
        return;
      }

      // Teacher 1: Star teacher -> Tier 5 (استاد راهبر, 700+ pts) with all 4 completed
      if (tIdx === 1) {
        recordCompleted(teacher, cFlipped, 100, -5);
        recordCompleted(teacher, cBook, 100, -8);
        recordCompleted(teacher, cWorkshop, 100, -2);
        recordCompleted(teacher, cEdtech, 100, -4);
        return;
      }

      // Teacher 2: Tier 4 (معلم خبره) -> 3 completed (school-2 slightly higher avg for vivid 3-school comparison)
      if (tIdx === 2) {
        recordCompleted(teacher, cFlipped, sIdx === 1 ? 100 : 80, -3);
        recordCompleted(teacher, cBook, 75, -6);
        recordCompleted(teacher, cEdtech, sIdx === 1 ? 100 : 75, -2);
        if (sIdx === 1) {
          recordCompleted(teacher, cWorkshop, 100, -1);
        } else {
          recordInProgress(teacher, cWorkshop, 1);
        }
        return;
      }

      // Teacher 3: Tier 3 (معلم پیشرو) -> cFlipped completed, cBook completed (school-2) or overdue (school-1/3), cEdtech quiz_failed
      if (tIdx === 3) {
        recordCompleted(teacher, cFlipped, 80, -4);
        if (sIdx === 1) {
          recordCompleted(teacher, cBook, 100, -6);
        } else {
          recordInProgress(teacher, cBook, 1); // Overdue mandatory!
        }
        recordQuizFailed(teacher, cEdtech, 50);
        return;
      }

      // Teacher 4: Tier 2 (معلم کوشا) -> cBook completed, cFlipped in-progress
      if (tIdx === 4) {
        recordCompleted(teacher, cBook, 75, -5);
        recordInProgress(teacher, cFlipped, 1);
        if (sIdx === 2) {
          recordCompleted(teacher, cWorkshop, 75, -2);
        }
        return;
      }

      // Teacher 5: Tier 2 / Tier 1 -> cWorkshop completed (optional) or quiz_failed on cFlipped
      if (tIdx === 5) {
        recordCompleted(teacher, cWorkshop, 100, -6);
        recordQuizFailed(teacher, cFlipped, 40);
        // cBook left not_started -> overdue mandatory
        return;
      }

      // Teacher 6: Tier 1 (همکار تازه‌مسیر) -> fresh/not started (or 1 chapter read in school-2)
      if (sIdx === 1) {
        recordCompleted(teacher, cBook, 75, -6);
        recordInProgress(teacher, cFlipped, 2);
      } else {
        recordInProgress(teacher, cFlipped, 1);
      }
    });
  });

  return {
    td_courses,
    td_progress,
    td_certificates,
    td_school_settings,
  };
}
