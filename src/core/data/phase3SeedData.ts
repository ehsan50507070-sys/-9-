// Phase 3 Seed Data: 1 realistic demo record per plugin for school-1 ONLY
// (flipped-video with 60s demo player + 2 telemetry logs + timestamped questions,
//  online-classroom with attendance records, online-exams with 2 submissions & student_360_signals)
import { addDaysToJalali } from '../../lib/jalali';
import type {
  ClassRoom,
  FlippedSecondWatchState,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
  FlippedVideoTelemetry,
  OnlineClassAttendanceRecord,
  OnlineClassSession,
  OnlineExam,
  OnlineExamSubmission,
  School,
  Student,
  Student360Signal,
  Teacher,
} from '../../types/domain';

export const PHASE3_PLUGIN_IDS = [
  'flipped-video',
  'online-classroom',
  'online-exams',
] as const;

export interface Phase3SeedBundle {
  flipped_lessons: FlippedVideoLesson[];
  flipped_telemetry: FlippedVideoTelemetry[];
  flipped_questions: FlippedTimestampQuestion[];
  online_class_sessions: OnlineClassSession[];
  online_class_attendance: OnlineClassAttendanceRecord[];
  online_exams: OnlineExam[];
  online_exam_submissions: OnlineExamSubmission[];
  student_360_signals: Student360Signal[];
}

function buildSecondStates(
  duration: number,
  segments: Array<{ start: number; end: number; state: FlippedSecondWatchState }>
): Record<string, FlippedSecondWatchState> {
  const map: Record<string, FlippedSecondWatchState> = {};
  for (let s = 0; s < duration; s++) {
    map[String(s)] = 'unwatched';
  }
  for (const seg of segments) {
    for (let s = Math.max(0, seg.start); s < Math.min(duration, seg.end); s++) {
      map[String(s)] = seg.state;
    }
  }
  return map;
}

export function generatePhase3SeedData(params: {
  schools: School[];
  classes: ClassRoom[];
  students: Student[];
  teachers: Teacher[];
  activeDayJalali: string;
}): Phase3SeedBundle {
  const { schools, classes, students, teachers, activeDayJalali } = params;
  const nowIso = new Date().toISOString();

  const empty: Phase3SeedBundle = {
    flipped_lessons: [],
    flipped_telemetry: [],
    flipped_questions: [],
    online_class_sessions: [],
    online_class_attendance: [],
    online_exams: [],
    online_exam_submissions: [],
    student_360_signals: [],
  };

  const school1 = schools.find((s) => s.id === 'school-1') ?? schools[0];
  if (!school1) return empty;

  const s1Id = school1.id;
  const s1Classes = classes.filter((c) => c.schoolId === s1Id);
  const firstClass = s1Classes[0];
  if (!firstClass) return empty;

  const classStudents = students.filter(
    (s) => s.schoolId === s1Id && s.classId === firstClass.id && s.active
  );
  const s1Teachers = teachers.filter((t) => t.schoolId === s1Id && t.active);
  const leadTeacher =
    s1Teachers.find((t) => t.id === firstClass.homeroomTeacherId) ?? s1Teachers[0];

  const teacherId = leadTeacher?.id ?? `${s1Id}-t-1`;
  const teacherName = leadTeacher?.fullName ?? 'استاد علی اکبری';

  // Use students[1] and students[2] for seeded telemetry/submissions so students[0] (parent1 demo account)
  // can immediately experience watching the lesson, joining the live class, and taking the online exam fresh!
  const stuB = classStudents[1] ?? classStudents[0];
  const stuC = classStudents[2] ?? classStudents[1] ?? classStudents[0];
  const stuD = classStudents[3] ?? stuC;

  // 1. Flipped Video Seed (1 lesson + 2 telemetry logs + 3 timestamped questions)
  const lessonId = `${s1Id}:fvlesson:demo-fractions-1`;
  const flippedLesson: FlippedVideoLesson = {
    id: lessonId,
    schoolId: s1Id,
    classId: firstClass.id,
    teacherId,
    teacherName,
    subject: 'ریاضی',
    title: 'آموزش کسرهای مساوی — ریاضی چهارم',
    description:
      'در این ویدیوی ۶۰ ثانیه‌ای، مفهوم کسرهای مساوی را با رسم شکل، محور اعداد و ضرب صورت و مخرج می‌آموزیم. پس از تماشای کامل، تستک درک مطلب ۳ سوالی فعال می‌شود.',
    deadlineJalali: addDaysToJalali(activeDayJalali, 5),
    videoSource: 'demo_60s',
    durationSeconds: 60,
    microQuiz: [
      {
        id: 'mq-1',
        questionText: 'کدام کسر با کسر «۱/۲» (یک‌دوم) مساوی است؟',
        options: ['۲/۳', '۳/۶', '۲/۵', '۴/۶'],
        correctOptionIndex: 1,
        sourceQuestionBankId: `${s1Id}:qb:2`,
      },
      {
        id: 'mq-2',
        questionText: 'برای ساختن کسر مساوی با ۲/۳ چه کاری انجام می‌دهیم؟',
        options: [
          'فقط صورت را در ۲ ضرب می‌کنیم',
          'فقط مخرج را با ۲ جمع می‌کنیم',
          'صورت و مخرج را در یک عدد غیرصفر (مثل ۲ یا ۳) ضرب می‌کنیم',
          'صورت را از مخرج کم می‌کنیم',
        ],
        correctOptionIndex: 2,
      },
      {
        id: 'mq-3',
        questionText: 'ساده‌ترین شکل کسر «۴/۸» کدام گزینه است؟',
        options: ['۱/۲', '۲/۳', '۳/۴', '۱/۴'],
        correctOptionIndex: 0,
      },
    ],
    createdAtJalali: addDaysToJalali(activeDayJalali, -1),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  empty.flipped_lessons.push(flippedLesson);

  if (stuB) {
    empty.flipped_telemetry.push({
      id: `${s1Id}:fvtel:${lessonId}:${stuB.id}`,
      schoolId: s1Id,
      lessonId,
      classId: firstClass.id,
      studentId: stuB.id,
      durationSeconds: 60,
      maxWatchedSecond: 59,
      lastPositionSecond: 59,
      secondStates: buildSecondStates(60, [
        { start: 0, end: 42, state: 'normal' },
        { start: 42, end: 52, state: 'fast' },
        { start: 52, end: 60, state: 'normal' },
      ]),
      tabSwitchCount: 0,
      microQuizUnlocked: true,
      microQuizAttempt: {
        selectedOptionIndices: [1, 2, 0],
        correctCount: 3,
        totalCount: 3,
        score20: 20,
        descriptiveStatus: 'تسلط کامل',
        completedAtIso: nowIso,
        completedAtJalali: activeDayJalali,
        syncedToGradebook: true,
      },
      updatedAt: nowIso,
    });

    empty.flipped_questions.push({
      id: `${s1Id}:fvq:${lessonId}:1`,
      schoolId: s1Id,
      lessonId,
      classId: firstClass.id,
      studentId: stuB.id,
      studentName: stuB.fullName,
      timestampSecond: 19,
      questionText: 'آقا اجازه! اگر صورت و مخرج را بر یک عدد تقسیم کنیم هم کسر مساوی به دست می‌آید؟',
      createdAtJalali: activeDayJalali,
      createdAt: nowIso,
    });

    empty.student_360_signals.push({
      id: `${s1Id}:s360:flipped_video:${lessonId}:${stuB.id}`,
      schoolId: s1Id,
      studentId: stuB.id,
      classId: firstClass.id,
      subject: 'ریاضی',
      source: 'flipped_video',
      sourceEntityId: lessonId,
      title: flippedLesson.title,
      score20: 20,
      statusLabelFa: 'تسلط کامل',
      summaryFa: 'تماشای ۱۰۰٪ ویدیو (۸۳٪ سرعت عادی) و کسب نمره ۲۰ در تستک درک مطلب',
      metrics: { watchedPercent: 100, normalSeconds: 50, fastSeconds: 10, tabSwitchCount: 0 },
      recordedAtJalali: activeDayJalali,
      updatedAt: nowIso,
    });
  }

  if (stuC && stuC.id !== stuB?.id) {
    empty.flipped_telemetry.push({
      id: `${s1Id}:fvtel:${lessonId}:${stuC.id}`,
      schoolId: s1Id,
      lessonId,
      classId: firstClass.id,
      studentId: stuC.id,
      durationSeconds: 60,
      maxWatchedSecond: 54,
      lastPositionSecond: 54,
      secondStates: buildSecondStates(60, [
        { start: 0, end: 18, state: 'normal' },
        { start: 18, end: 46, state: 'fast' },
        { start: 46, end: 54, state: 'normal' },
      ]),
      tabSwitchCount: 2,
      microQuizUnlocked: true,
      microQuizAttempt: {
        selectedOptionIndices: [0, 2, 3],
        correctCount: 1,
        totalCount: 3,
        score20: 6.7,
        descriptiveStatus: 'نیاز به مرور و تمرین',
        completedAtIso: nowIso,
        completedAtJalali: activeDayJalali,
        syncedToGradebook: true,
      },
      updatedAt: nowIso,
    });

    empty.flipped_questions.push(
      {
        id: `${s1Id}:fvq:${lessonId}:2`,
        schoolId: s1Id,
        lessonId,
        classId: firstClass.id,
        studentId: stuC.id,
        studentName: stuC.fullName,
        timestampSecond: 22,
        questionText: 'چرا وقتی شکل را به ۶ قسمت تقسیم کردیم، ۳ قسمت رنگ‌شده با ۱/۲ برابر شد؟',
        createdAtJalali: activeDayJalali,
        createdAt: nowIso,
      },
      {
        id: `${s1Id}:fvq:${lessonId}:3`,
        schoolId: s1Id,
        lessonId,
        classId: firstClass.id,
        studentId: stuC.id,
        studentName: stuC.fullName,
        timestampSecond: 43,
        questionText: 'در مثال ساده‌کردن کسر ۴/۸ از کجا بفهمیم باید بر ۴ تقسیم کنیم؟',
        createdAtJalali: activeDayJalali,
        createdAt: nowIso,
      }
    );

    empty.student_360_signals.push({
      id: `${s1Id}:s360:flipped_video:${lessonId}:${stuC.id}`,
      schoolId: s1Id,
      studentId: stuC.id,
      classId: firstClass.id,
      subject: 'ریاضی',
      source: 'flipped_video',
      sourceEntityId: lessonId,
      title: flippedLesson.title,
      score20: 6.7,
      statusLabelFa: 'نیاز به مرور و تمرین',
      summaryFa: 'تماشای ۹۰٪ ویدیو (بخش میانی با سرعت بالا) و نیاز به مرور مجدد در کلاس رفع اشکال',
      metrics: { watchedPercent: 90, normalSeconds: 26, fastSeconds: 28, tabSwitchCount: 2 },
      recordedAtJalali: activeDayJalali,
      updatedAt: nowIso,
    });
  }

  // 2. Online Classroom Seed (1 live session + sample attendance records)
  const sessionId = `${s1Id}:ocsession:demo-live-1`;
  const onlineSession: OnlineClassSession = {
    id: sessionId,
    schoolId: s1Id,
    classId: firstClass.id,
    teacherId,
    teacherName,
    subject: 'ریاضی',
    title: 'جلسه زنده رفع اشکال فصل کسرها و تمرین‌های کتاب کار',
    jalaliDate: activeDayJalali,
    startTime: '10:30',
    endTime: '11:30',
    platform: 'skyroom',
    joinUrl: 'https://www.skyroom.online/ch/smart-school/math-live',
    accessPassword: '۴۰۵۲',
    description:
      'پاسخ به سوالات ثبت‌شده دانش‌آموزان در ویدیوی کلاس وارونه و حل ۳ نمونه سوال امتحانی.',
    status: 'live',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  empty.online_class_sessions.push(onlineSession);

  if (stuB) {
    empty.online_class_attendance.push({
      id: `${s1Id}:ocatt:${sessionId}:${stuB.id}`,
      schoolId: s1Id,
      sessionId,
      classId: firstClass.id,
      studentId: stuB.id,
      status: 'present',
      joinedAtJalali: activeDayJalali,
      joinedAtTime: '10:29',
      joinedViaLink: true,
      note: 'ورود به‌موقع از طریق لینک کلاس',
      updatedAt: nowIso,
    });
  }
  if (stuC && stuC.id !== stuB?.id) {
    empty.online_class_attendance.push({
      id: `${s1Id}:ocatt:${sessionId}:${stuC.id}`,
      schoolId: s1Id,
      sessionId,
      classId: firstClass.id,
      studentId: stuC.id,
      status: 'late',
      joinedAtJalali: activeDayJalali,
      joinedAtTime: '10:42',
      joinedViaLink: true,
      note: 'ورود با ۱۲ دقیقه تاخیر',
      updatedAt: nowIso,
    });
  }
  if (stuD && stuD.id !== stuC?.id && stuD.id !== stuB?.id) {
    empty.online_class_attendance.push({
      id: `${s1Id}:ocatt:${sessionId}:${stuD.id}`,
      schoolId: s1Id,
      sessionId,
      classId: firstClass.id,
      studentId: stuD.id,
      status: 'absent',
      joinedViaLink: false,
      note: 'عدم حضور در جلسه آنلاین',
      updatedAt: nowIso,
    });
  }

  // 3. Online Exams Seed (1 published mixed exam + 2 sample student submissions)
  const examId = `${s1Id}:oexam:demo-midterm-1`;
  const onlineExam: OnlineExam = {
    id: examId,
    schoolId: s1Id,
    classId: firstClass.id,
    teacherId,
    teacherName,
    subject: 'ریاضی',
    title: 'آزمون آنلاین ارزشیابی میان‌ترم ریاضی (تستی + تشریحی)',
    description:
      'شامل سوالات چهارگزینه‌ای، صحیح و غلط، جایخالی و تشریحی. پاسخ تشریحی را می‌توانید تایپ کنید یا تصویر برگه را بارگذاری نمایید.',
    startDateJalali: addDaysToJalali(activeDayJalali, -1),
    endDateJalali: addDaysToJalali(activeDayJalali, 7),
    durationMinutes: 20,
    randomizeOrder: false,
    showResultImmediately: true,
    status: 'published',
    questions: [
      {
        id: 'exq-1',
        type: 'multiple_choice',
        questionText: 'حاصل جمع «۳۷ + ۲۵» کدام گزینه است؟',
        points: 4,
        options: ['۵۲', '۶۲', '۶۱', '۵۷'],
        correctOptionIndex: 1,
        modelAnswer: 'جمع یکان‌ها ۱۲ و جمع دهگان‌ها ۶ دهگان؛ پاسخ ۶۲ است.',
        sourceQuestionBankId: `${s1Id}:qb:1`,
      },
      {
        id: 'exq-2',
        type: 'multiple_choice',
        questionText: 'کدام کسر با کسر «یک‌دوم (۱/۲)» برابر است؟',
        points: 4,
        options: ['۲/۳', '۳/۶', '۲/۵', '۴/۶'],
        correctOptionIndex: 1,
        modelAnswer: 'ضرب صورت و مخرج ۱/۲ در ۳ برابر با ۳/۶ می‌شود.',
        sourceQuestionBankId: `${s1Id}:qb:2`,
      },
      {
        id: 'exq-3',
        type: 'true_false',
        questionText: 'درستی یا نادرستی این عبارت را مشخص کنید: «کسر ۴/۸ از کسر ۱/۲ بزرگ‌تر است.»',
        points: 4,
        trueFalseAnswer: false,
        modelAnswer: 'نادرست؛ کسر ۴/۸ دقیقاً با کسر ۱/۲ مساوی است.',
      },
      {
        id: 'exq-4',
        type: 'fill_blank',
        questionText: 'برای محاسبه مساحت مستطیل، طول را در ........ ضرب می‌کنیم.',
        points: 4,
        acceptedAnswers: ['عرض', 'عرض آن', 'عرض مستطیل'],
        modelAnswer: 'عرض',
      },
      {
        id: 'exq-5',
        type: 'descriptive',
        questionText:
          'باغچه‌ای مستطیل‌شکل به طول ۱۲ متر و عرض ۷ متر داریم. محیط و مساحت این باغچه را با نوشتن راه‌حل کامل حساب کنید.',
        points: 4,
        modelAnswer: 'محیط = (۱۲ + ۷) × ۲ = ۳۸ متر · مساحت = ۱۲ × ۷ = ۸۴ متر مربع.',
        sourceQuestionBankId: `${s1Id}:qb:4`,
      },
    ],
    totalPoints: 20,
    createdAtJalali: addDaysToJalali(activeDayJalali, -1),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  empty.online_exams.push(onlineExam);

  if (stuB) {
    empty.online_exam_submissions.push({
      id: `${s1Id}:exsub:${examId}:${stuB.id}`,
      schoolId: s1Id,
      examId,
      classId: firstClass.id,
      studentId: stuB.id,
      answers: [
        { questionId: 'exq-1', selectedOptionIndex: 1, autoScore: 4 },
        { questionId: 'exq-2', selectedOptionIndex: 1, autoScore: 4 },
        { questionId: 'exq-3', trueFalseValue: false, autoScore: 4 },
        { questionId: 'exq-4', textAnswer: 'عرض', autoScore: 4 },
        {
          questionId: 'exq-5',
          textAnswer: 'محیط = (۱۲ + ۷) × ۲ = ۳۸ متر و مساحت = ۱۲ × ۷ = ۸۴ متر مربع.',
          manualScore: 4,
          teacherFeedback: 'راه‌حل کامل و بسیار دقیق نوشته شده است. آفرین!',
        },
      ],
      startedAtIso: nowIso,
      submittedAtIso: nowIso,
      submittedAtJalali: activeDayJalali,
      elapsedSeconds: 615,
      tabSwitchCount: 0,
      autoGradedPoints: 16,
      manualGradedPoints: 4,
      finalPoints: 20,
      finalScore20: 20,
      gradingStatus: 'finalized',
      syncedToGradebook: false,
      teacherOverallFeedback: 'عملکرد عالی و تسلط کامل روی مباحث.',
      updatedAt: nowIso,
    });

    empty.student_360_signals.push({
      id: `${s1Id}:s360:online_exam:${examId}:${stuB.id}`,
      schoolId: s1Id,
      studentId: stuB.id,
      classId: firstClass.id,
      subject: 'ریاضی',
      source: 'online_exam',
      sourceEntityId: examId,
      title: onlineExam.title,
      score20: 20,
      statusLabelFa: 'خیلی خوب',
      summaryFa: 'کسب نمره ۲۰ از ۲۰ در آزمون میان‌ترم ریاضی بدون خروج از صفحه آزمون',
      metrics: { finalScore20: 20, tabSwitchCount: 0 },
      recordedAtJalali: activeDayJalali,
      updatedAt: nowIso,
    });
  }

  if (stuC && stuC.id !== stuB?.id) {
    empty.online_exam_submissions.push({
      id: `${s1Id}:exsub:${examId}:${stuC.id}`,
      schoolId: s1Id,
      examId,
      classId: firstClass.id,
      studentId: stuC.id,
      answers: [
        { questionId: 'exq-1', selectedOptionIndex: 1, autoScore: 4 },
        { questionId: 'exq-2', selectedOptionIndex: 0, autoScore: 0 },
        { questionId: 'exq-3', trueFalseValue: false, autoScore: 4 },
        { questionId: 'exq-4', textAnswer: 'عرض', autoScore: 4 },
        {
          questionId: 'exq-5',
          textAnswer: 'محیط می‌شود ۱۲+۷=۱۹ و ضربدر ۲ برابر ۳۸ متر. مساحت ۱۲×۷=۸۴ متر.',
        },
      ],
      startedAtIso: nowIso,
      submittedAtIso: nowIso,
      submittedAtJalali: activeDayJalali,
      elapsedSeconds: 840,
      tabSwitchCount: 1,
      autoGradedPoints: 12,
      manualGradedPoints: 0,
      finalPoints: 12,
      finalScore20: 12,
      gradingStatus: 'pending_descriptive',
      syncedToGradebook: false,
      updatedAt: nowIso,
    });
  }

  return empty;
}
