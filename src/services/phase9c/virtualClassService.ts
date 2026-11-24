// Phase 9-C: Virtual Class Hub Service (Live Status Engine, Safe URL Validation & A4 Attendance Print)
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { dateToJalaliString } from '../../lib/jalali';
import { escapeHtml } from '../../core/security/sanitize';
import type {
  School,
  Student,
  VirtualClassAttendance,
  VirtualClassPlatform,
  VirtualClassSession,
} from '../../types/domain';

export const VIRTUAL_CLASS_PLATFORMS: Record<
  VirtualClassPlatform,
  { labelFa: string; shortLabelFa: string }
> = {
  skyroom: { labelFa: 'اسکای‌روم (Skyroom)', shortLabelFa: 'اسکای‌روم' },
  adobe_connect: { labelFa: 'ادوبی کانکت (Adobe Connect)', shortLabelFa: 'ادوبی کانکت' },
  bigbluebutton: { labelFa: 'بیگ‌بلوباتن (BigBlueButton)', shortLabelFa: 'بیگ‌بلوباتن' },
  shad: { labelFa: 'شبکه آموزشی شاد', shortLabelFa: 'شاد' },
  google_meet: { labelFa: 'گوگل میت (Google Meet)', shortLabelFa: 'گوگل میت' },
  custom: { labelFa: 'لینک اختصاصی سامانه', shortLabelFa: 'لینک اختصاصی' },
};

export type VirtualClassLiveStatus = 'live' | 'soon' | 'scheduled' | 'ended';

export const VIRTUAL_STATUS_LABELS: Record<VirtualClassLiveStatus, string> = {
  live: 'در حال برگزاری',
  soon: 'به‌زودی',
  scheduled: 'برنامه‌ریزی‌شده',
  ended: 'پایان‌یافته',
};

export function validateVirtualClassUrl(rawUrl: string): {
  valid: boolean;
  normalized?: string;
  errorFa?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, errorFa: 'لطفاً لینک ورود به کلاس مجازی را وارد کنید.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        errorFa: 'لینک کلاس مجازی باید صرفاً با پیشوند امن https:// یا http:// آغاز شود.',
      };
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return {
      valid: false,
      errorFa: 'قالب لینک واردشده معتبر نیست (نمونه معتبر: https://www.skyroom.online/ch/...).',
    };
  }
}

function parseTimeHmToMinutes(timeHm: string): number {
  const clean = toAsciiDigits(timeHm).trim();
  const [hStr, mStr] = clean.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Computes real-time session status relative to current local Jalali date & time:
 * - 'live': today and currentMinute in [start, start + duration]
 * - 'soon': today and starts within next 30 minutes
 * - 'scheduled': future date or later today (>30 mins away)
 * - 'ended': past date or past end time today
 */
export function computeVirtualClassLiveStatus(
  session: Pick<VirtualClassSession, 'jalaliDate' | 'startTimeHm' | 'durationMinutes'>,
  now: Date = new Date()
): VirtualClassLiveStatus {
  const todayJalali = dateToJalaliString(now);
  const sessionDate = toAsciiDigits(session.jalaliDate).trim();

  if (sessionDate < todayJalali) return 'ended';
  if (sessionDate > todayJalali) return 'scheduled';

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = parseTimeHmToMinutes(session.startTimeHm);
  const duration = Math.max(10, Number(session.durationMinutes) || 45);
  const endMin = startMin + duration;

  if (nowMin >= startMin && nowMin <= endMin) {
    return 'live';
  }
  if (nowMin < startMin && startMin - nowMin <= 30) {
    return 'soon';
  }
  if (nowMin < startMin) {
    return 'scheduled';
  }
  return 'ended';
}

export function buildVirtualAttendancePrintHtml(params: {
  session: VirtualClassSession;
  className: string;
  classStudents: Student[];
  attendanceRecords: VirtualClassAttendance[];
  school: School;
}): string {
  const { session, className, classStudents, attendanceRecords, school } = params;
  const attMap = new Map(attendanceRecords.map((a) => [a.studentId, a]));

  const presentCount = classStudents.filter((s) => attMap.has(s.id)).length;
  const rowsHtml = classStudents
    .map((student, idx) => {
      const att = attMap.get(student.id);
      return `<tr>
        <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${toPersianDigits(idx + 1)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px 8px; font-weight:700;">${escapeHtml(student.fullName)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${escapeHtml(toPersianDigits(student.studentCode))}</td>
        <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-weight:700; color:${att ? '#047857' : '#be123c'};">
          ${att ? 'حاضر (ورود آنلاین)' : 'غایب'}
        </td>
        <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">
          ${att ? escapeHtml(toPersianDigits(att.joinedAtTimeHm)) : '—'}
        </td>
      </tr>`;
    })
    .join('');

  return `
    <div style="font-family: Vazirmatn, Tahoma, sans-serif; color:#0f172a; line-height: 1.75; font-size: 12px;">
      <div style="text-align:center; margin-bottom:14px;">
        <h2 style="margin:0; font-size:16px; font-weight:800;">گزارش رسمی حضور و غیاب کلاس مجازی</h2>
        <div style="font-size:12px; color:#475569; margin-top:4px;">
          ${escapeHtml(school.name)} &nbsp;|&nbsp; ${escapeHtml(session.title)}
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">کلاس</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(className)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">درس</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(session.subject)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">معلم</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(session.teacherName)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">تاریخ و ساعت</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(toPersianDigits(session.jalaliDate))} · ساعت ${escapeHtml(toPersianDigits(session.startTimeHm))} (${toPersianDigits(session.durationMinutes)} دقیقه)</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">بستر برگزاری</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(VIRTUAL_CLASS_PLATFORMS[session.platform].labelFa)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">آمار حضور</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; font-weight:700;">${toPersianDigits(presentCount)} از ${toPersianDigits(classStudents.length)} نفر</td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:46px;">ردیف</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px;">نام و نام خانوادگی دانش‌آموز</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:110px;">کد دانش‌آموزی</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:130px;">وضعیت حضور</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:110px;">ساعت کلیک ورود</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
