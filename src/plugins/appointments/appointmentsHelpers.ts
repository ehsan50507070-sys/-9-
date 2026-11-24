// Pure Helper Functions for Phase 4 Appointments & Student 360° Summary Sheet
// Decoupled from React so time-slot splitting, conflict guards, and 360° aggregation are unit-tested via node:test.
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  AppointmentMeetingType,
  AppointmentSlot,
  ClassRoom,
  DailyLogEntry,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
  FlippedVideoTelemetry,
  GradebookEntry,
  HomeworkAssignment,
  HomeworkSubmission,
  OnlineClassAttendanceRecord,
  OnlineExam,
  OnlineExamSubmission,
  Student,
  Student360Signal,
  StudentAttendanceRecord,
  StudentReward,
} from '../../types/domain';
import { computeWatchMetrics } from '../flipped-video/flippedVideoHelpers';

export const MEETING_TYPE_LABELS: Record<AppointmentMeetingType, string> = {
  in_person: 'حضوری در مدرسه',
  phone: 'تلفنی',
  online: 'آنلاین',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentSlot['status'], string> = {
  open: 'آزاد برای رزرو',
  booked: 'رزرو شده',
  completed: 'برگزار شد',
  cancelled: 'لغو شده',
};

function parseTimeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function formatMinutesToHhmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Auto-splits a time window (e.g., 10:00 to 11:20 with 20-minute duration) into individual bookable slots.
 */
export function generateSplitTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number
): Array<{ startTime: string; endTime: string; durationMinutes: number }> {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || durationMinutes < 5 || end <= start) {
    return [];
  }
  const result: Array<{ startTime: string; endTime: string; durationMinutes: number }> = [];
  let cursor = start;
  while (cursor + durationMinutes <= end && result.length < 30) {
    result.push({
      startTime: formatMinutesToHhmm(cursor),
      endTime: formatMinutesToHhmm(cursor + durationMinutes),
      durationMinutes,
    });
    cursor += durationMinutes;
  }
  return result;
}

/**
 * Strict conflict prevention guard: ensures no two parents can ever book the same slot.
 */
export function canBookAppointmentSlot(slot: AppointmentSlot): {
  allowed: boolean;
  reasonFa?: string;
} {
  if (slot.status !== 'open' || slot.bookedStudentId) {
    return {
      allowed: false,
      reasonFa: 'این بازه زمانی قبلاً رزرو شده یا در دسترس نیست. لطفاً زمان دیگری انتخاب کنید.',
    };
  }
  return { allowed: true };
}

export interface Student360Summary {
  student: Student;
  className: string;
  attendance: {
    physicalPresent: number;
    physicalAbsent: number;
    physicalLate: number;
    physicalExcused: number;
    onlinePresent: number;
    onlineLate: number;
    onlineAbsent: number;
  };
  academics: {
    overallGradeAverage: number | null;
    subjectAverages: Array<{
      subject: string;
      average: number | null;
      latestDescriptive?: string;
      latestFeedback?: string;
    }>;
    onlineExamCount: number;
    onlineExamAverage: number | null;
    totalTabSwitchFlags: number;
  };
  homeworkAndFlipped: {
    assignedHomeworkCount: number;
    submittedHomeworkCount: number;
    homeworkCompletionPercent: number;
    gameSubmissionsCount: number;
    averageGameScore: number | null;
    flippedLessonsCount: number;
    avgFlippedWatchPercent: number | null;
    fastWatchAlertsCount: number;
    flippedQuestions: Array<{ lessonTitle: string; second: number; text: string; reply?: string }>;
    microQuizSummaries: Array<{ lessonTitle: string; score20: number; status: string }>;
    recentSignals: Student360Signal[];
  };
  disciplineAndRewards: {
    rewardsCount: number;
    totalStars: number;
    certificatesCount: number;
    recentRewards: StudentReward[];
    dailyLogNotes: DailyLogEntry[];
  };
}

/**
 * Aggregates real-time 360-degree summary for a single student across ALL active-school stores.
 */
export function buildStudent360Summary(params: {
  student: Student;
  classes: ClassRoom[];
  studentAttendance: StudentAttendanceRecord[];
  onlineClassAttendance: OnlineClassAttendanceRecord[];
  gradebookEntries: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  homeworkAssignments: HomeworkAssignment[];
  homeworkSubmissions: HomeworkSubmission[];
  flippedLessons: FlippedVideoLesson[];
  flippedTelemetry: FlippedVideoTelemetry[];
  flippedQuestions: FlippedTimestampQuestion[];
  student360Signals: Student360Signal[];
  studentRewards: StudentReward[];
  dailyLogs: DailyLogEntry[];
}): Student360Summary {
  const {
    student,
    classes,
    studentAttendance,
    onlineClassAttendance,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    homeworkAssignments,
    homeworkSubmissions,
    flippedLessons,
    flippedTelemetry,
    flippedQuestions,
    student360Signals,
    studentRewards,
    dailyLogs,
  } = params;

  const cls = classes.find((c) => c.id === student.classId);
  const className = cls?.name ?? 'کلاس دانش‌آموز';

  // 1. Attendance (Physical + Online)
  const myPhysAtt = studentAttendance.filter((a) => a.studentId === student.id);
  const myOnlineAtt = onlineClassAttendance.filter((a) => a.studentId === student.id);
  const attendance = {
    physicalPresent: myPhysAtt.filter((a) => a.status === 'present').length,
    physicalAbsent: myPhysAtt.filter((a) => a.status === 'absent').length,
    physicalLate: myPhysAtt.filter((a) => a.status === 'late').length,
    physicalExcused: myPhysAtt.filter((a) => a.status === 'excused').length,
    onlinePresent: myOnlineAtt.filter((a) => a.status === 'present').length,
    onlineLate: myOnlineAtt.filter((a) => a.status === 'late').length,
    onlineAbsent: myOnlineAtt.filter((a) => a.status === 'absent').length,
  };

  // 2. Academics (Gradebook + Online Exams)
  const myGrades = gradebookEntries.filter((g) => g.studentId === student.id);
  const bySubject = new Map<string, GradebookEntry[]>();
  for (const g of myGrades) {
    const arr = bySubject.get(g.subject) ?? [];
    arr.push(g);
    bySubject.set(g.subject, arr);
  }
  const subjectAverages = Array.from(bySubject.entries()).map(([subject, entries]) => {
    const nums = entries
      .map((e) => e.numericScore)
      .filter((n): n is number => typeof n === 'number');
    const latest = entries[entries.length - 1];
    return {
      subject,
      average:
        nums.length > 0
          ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
          : null,
      latestDescriptive: latest?.descriptiveLevel,
      latestFeedback: latest?.disciplinaryNote,
    };
  });

  const allNumericGrades = myGrades
    .map((g) => g.numericScore)
    .filter((n): n is number => typeof n === 'number');
  const overallGradeAverage =
    allNumericGrades.length > 0
      ? Math.round((allNumericGrades.reduce((a, b) => a + b, 0) / allNumericGrades.length) * 10) / 10
      : null;

  const myExamSubs = onlineExamSubmissions.filter((s) => s.studentId === student.id);
  const onlineExamAverage =
    myExamSubs.length > 0
      ? Math.round(
          (myExamSubs.reduce((sum, s) => sum + s.finalScore20, 0) / myExamSubs.length) * 10
        ) / 10
      : null;
  const totalTabSwitchFlags = myExamSubs.reduce((sum, s) => sum + (s.tabSwitchCount ?? 0), 0);
  void onlineExams;

  // 3. Homework, Educational Games, Flipped Video & Student 360 Signals
  const classHw = homeworkAssignments.filter((h) => h.classId === student.classId);
  const myHwSubs = homeworkSubmissions.filter((s) => s.studentId === student.id);
  const submittedIds = new Set(myHwSubs.map((s) => s.assignmentId));
  const submittedCount = classHw.filter((h) => submittedIds.has(h.id)).length;
  const homeworkCompletionPercent =
    classHw.length > 0 ? Math.round((submittedCount / classHw.length) * 100) : 100;

  const gameSubs = myHwSubs.filter((s) => s.gameResult);
  const averageGameScore =
    gameSubs.length > 0
      ? Math.round(
          gameSubs.reduce((sum, s) => sum + (s.gameResult?.score ?? 0), 0) / gameSubs.length
        )
      : null;

  const classFlipped = flippedLessons.filter((l) => l.classId === student.classId);
  const lessonById = new Map(flippedLessons.map((l) => [l.id, l]));
  const myTel = flippedTelemetry.filter((t) => t.studentId === student.id);

  let totalWatchPct = 0;
  let watchCount = 0;
  let fastWatchAlertsCount = 0;
  const microQuizSummaries: Array<{ lessonTitle: string; score20: number; status: string }> = [];

  for (const tel of myTel) {
    const lesson = lessonById.get(tel.lessonId);
    if (!lesson) continue;
    const metrics = computeWatchMetrics(tel.secondStates, lesson.durationSeconds);
    totalWatchPct += metrics.watchedPercent;
    watchCount += 1;
    if (metrics.fastPercent >= 35) {
      fastWatchAlertsCount += 1;
    }
    if (tel.microQuizAttempt) {
      microQuizSummaries.push({
        lessonTitle: lesson.title,
        score20: tel.microQuizAttempt.score20,
        status: tel.microQuizAttempt.descriptiveStatus,
      });
    }
  }

  const myFlippedQs = flippedQuestions
    .filter((q) => q.studentId === student.id)
    .map((q) => ({
      lessonTitle: lessonById.get(q.lessonId)?.title ?? 'ویدیوی آموزشی',
      second: q.timestampSecond,
      text: q.questionText,
      reply: q.teacherReply,
    }));

  const recentSignals = student360Signals.filter((sig) => sig.studentId === student.id);

  // 4. Discipline & Rewards
  const myRewards = studentRewards.filter((r) => r.studentId === student.id);
  const totalStars = myRewards.length;
  const certificatesCount = myRewards.filter((r) => Boolean(r.certificateSerial)).length;
  const myLogs = dailyLogs.filter((l) => l.studentId === student.id);

  return {
    student,
    className,
    attendance,
    academics: {
      overallGradeAverage,
      subjectAverages,
      onlineExamCount: myExamSubs.length,
      onlineExamAverage,
      totalTabSwitchFlags,
    },
    homeworkAndFlipped: {
      assignedHomeworkCount: classHw.length,
      submittedHomeworkCount: submittedCount,
      homeworkCompletionPercent,
      gameSubmissionsCount: gameSubs.length,
      averageGameScore,
      flippedLessonsCount: classFlipped.length,
      avgFlippedWatchPercent: watchCount > 0 ? Math.round(totalWatchPct / watchCount) : null,
      fastWatchAlertsCount,
      flippedQuestions: myFlippedQs,
      microQuizSummaries,
      recentSignals,
    },
    disciplineAndRewards: {
      rewardsCount: myRewards.length,
      totalStars,
      certificatesCount,
      recentRewards: myRewards.slice(0, 6),
      dailyLogNotes: myLogs.slice(0, 6),
    },
  };
}

/**
 * Formats the Student 360° Summary Sheet into crisp single-column text for Eitaa, Bale, and Shad.
 */
export function formatStudent360Messenger(params: {
  schoolName: string;
  jalaliDate: string;
  summary: Student360Summary;
  meetingNotes?: string;
}): string {
  const { schoolName, jalaliDate, summary, meetingNotes } = params;
  const att = summary.attendance;
  const acad = summary.academics;
  const hwf = summary.homeworkAndFlipped;
  const dr = summary.disciplineAndRewards;

  return formatSingleColumnMessengerReport({
    schoolName,
    reportTitle: `خلاصه وضعیت ۳۶۰ درجه — ${summary.student.fullName} (${summary.className})`,
    jalaliDateDisplay: jalaliDate,
    sections: [
      {
        heading: 'حضور و غیاب (حضوری و آنلاین)',
        lines: [
          `حضوری: غیبت ${toPersianDigits(att.physicalAbsent)} | تاخیر ${toPersianDigits(att.physicalLate)} | موجه ${toPersianDigits(att.physicalExcused)}`,
          `کلاس آنلاین: حضور ${toPersianDigits(att.onlinePresent)} | تاخیر ${toPersianDigits(att.onlineLate)} | غیبت ${toPersianDigits(att.onlineAbsent)}`,
        ],
      },
      {
        heading: 'وضعیت درسی و آزمون‌ها',
        lines: [
          `میانگین دفتر نمره: ${acad.overallGradeAverage !== null ? `${toPersianDigits(acad.overallGradeAverage)} از ۲۰` : 'ثبت نشده'}`,
          `میانگین آزمون‌های آنلاین: ${acad.onlineExamAverage !== null ? `${toPersianDigits(acad.onlineExamAverage)} از ۲۰ (${toPersianDigits(acad.onlineExamCount)} آزمون)` : 'بدون آزمون ثبت‌شده'}`,
          ...acad.subjectAverages.slice(0, 5).map(
            (s) =>
              `• ${s.subject}: ${s.average !== null ? toPersianDigits(s.average) : '—'}${s.latestDescriptive ? ` (${s.latestDescriptive})` : ''}`
          ),
        ],
      },
      {
        heading: 'تکالیف، بازی آموزشی و کلاس وارونه',
        lines: [
          `نرخ تحویل تکالیف: ${toPersianDigits(hwf.homeworkCompletionPercent)}٪ (${toPersianDigits(hwf.submittedHomeworkCount)} از ${toPersianDigits(hwf.assignedHomeworkCount)})`,
          `میانگین تماشای کلاس وارونه: ${hwf.avgFlippedWatchPercent !== null ? `${toPersianDigits(hwf.avgFlippedWatchPercent)}٪` : 'بدون سابقه'}`,
          ...(hwf.averageGameScore !== null
            ? [`میانگین امتیاز بازی‌های آموزشی: ${toPersianDigits(hwf.averageGameScore)} از ۱۰۰`]
            : []),
        ],
      },
      {
        heading: 'تشویق‌ها و نکات انضباطی',
        lines: [
          `تشویق‌ها: ${toPersianDigits(dr.rewardsCount)} مورد (${toPersianDigits(dr.totalStars)} امتیاز · ${toPersianDigits(dr.certificatesCount)} لوح تقدیر)`,
          `یادداشت‌های دفتر روزانه: ${toPersianDigits(dr.dailyLogNotes.length)} مورد`,
          ...(meetingNotes ? [`توافقات جلسه اولیا: ${meetingNotes}`] : []),
        ],
      },
    ],
    footerNote: 'سامانه مدیریت هوشمند مدارس',
  });
}
