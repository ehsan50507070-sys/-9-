// Pure Business Logic for Plugin: Online Classroom Manager («مدیریت کلاس آنلاین»)
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  OnlineClassAttendanceRecord,
  OnlineClassAttendanceStatus,
  OnlineClassPlatform,
  OnlineClassSession,
  OnlineClassStatus,
  Student,
} from '../../types/domain';

export const ONLINE_CLASS_PLATFORMS: Array<{ id: OnlineClassPlatform; labelFa: string }> = [
  { id: 'shad', labelFa: 'شاد' },
  { id: 'skyroom', labelFa: 'اسکایروم' },
  { id: 'adobe_connect', labelFa: 'ادوبی کانکت' },
  { id: 'bigbluebutton', labelFa: 'بیگ‌بلوباتن' },
  { id: 'google_meet', labelFa: 'گوگل میت' },
  { id: 'other', labelFa: 'سایر' },
];

export function getPlatformLabelFa(platform: OnlineClassPlatform): string {
  return ONLINE_CLASS_PLATFORMS.find((p) => p.id === platform)?.labelFa ?? 'سایر';
}

export function getOnlineClassStatusMeta(status: OnlineClassStatus): {
  labelFa: string;
  badgeClass: string;
} {
  switch (status) {
    case 'live':
      return {
        labelFa: 'در حال برگزاری',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'scheduled':
      return {
        labelFa: 'برنامه‌ریزی شده',
        badgeClass:
          'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      };
    case 'ended':
      return {
        labelFa: 'پایان یافته',
        badgeClass:
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}

export function getAttendanceStatusLabelFa(status: OnlineClassAttendanceStatus): string {
  switch (status) {
    case 'present':
      return 'حاضر در کلاس آنلاین';
    case 'late':
      return 'با تاخیر';
    case 'absent':
      return 'غایب';
  }
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface OnlineAttendanceSummary {
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  joinedViaLinkCount: number;
  presentRatePercent: number;
}

export function computeOnlineAttendanceSummary(
  classStudents: Student[],
  records: OnlineClassAttendanceRecord[]
): OnlineAttendanceSummary {
  const activeStudents = classStudents.filter((s) => s.active);
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let joinedViaLinkCount = 0;

  for (const stu of activeStudents) {
    const rec = byStudent.get(stu.id);
    if (!rec || rec.status === 'absent') {
      absentCount++;
    } else if (rec.status === 'late') {
      lateCount++;
      if (rec.joinedViaLink) joinedViaLinkCount++;
    } else {
      presentCount++;
      if (rec.joinedViaLink) joinedViaLinkCount++;
    }
  }

  const totalStudents = activeStudents.length;
  const attended = presentCount + lateCount;
  const presentRatePercent =
    totalStudents > 0 ? Math.round((attended / totalStudents) * 100) : 0;

  return {
    totalStudents,
    presentCount,
    lateCount,
    absentCount,
    joinedViaLinkCount,
    presentRatePercent,
  };
}

export function formatClassroomInviteMessenger(params: {
  schoolName: string;
  className: string;
  session: OnlineClassSession;
}): string {
  const { schoolName, className, session } = params;
  const statusMeta = getOnlineClassStatusMeta(session.status);
  const detailsLines = [
    `کلاس: ${className} — درس ${session.subject}`,
    `معلم: ${session.teacherName}`,
    `تاریخ: ${toPersianDigits(session.jalaliDate)} · ساعت ${toPersianDigits(session.startTime)} تا ${toPersianDigits(session.endTime)}`,
    `بستر برگزاری: ${getPlatformLabelFa(session.platform)} (${statusMeta.labelFa})`,
    `لینک ورود مستقیم: ${session.joinUrl}`,
  ];
  if (session.accessPassword?.trim()) {
    detailsLines.push(`رمز ورود جلسه: ${session.accessPassword.trim()}`);
  }
  if (session.description?.trim()) {
    detailsLines.push(`توضیحات معلم: ${session.description.trim()}`);
  }
  if (session.recordingUrl?.trim()) {
    detailsLines.push(`لینک فیلم ضبط‌شده جلسه: ${session.recordingUrl.trim()}`);
  }

  return formatSingleColumnMessengerReport({
    schoolName,
    reportTitle: `دعوتنامه کلاس آنلاین — ${session.title}`,
    jalaliDateDisplay: session.jalaliDate,
    sections: [
      {
        heading: 'مشخصات و لینک ورود به جلسه',
        lines: detailsLines,
      },
    ],
    footerNote:
      'دانش‌آموزان گرامی لطفاً با کلیک روی «ورود به کلاس آنلاین» در سامانه مدرسه وارد شوید تا حضور شما به‌صورت خودکار ثبت شود.',
  });
}
