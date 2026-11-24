// Phase 9-C: Hourly/Daily Leave & Official Student Exit Pass Service
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { escapeHtml } from '../../core/security/sanitize';
import type {
  School,
  StaffLeaveRequest,
  StudentExitPass,
  StudentExitReason,
  StudentExitStatus,
} from '../../types/domain';

export const EXIT_REASON_LABELS: Record<StudentExitReason, string> = {
  medical: 'پزشکی و درمانی',
  administrative: 'اداری و رسمی',
  family: 'خانوادگی و شخصی',
};

export const EXIT_STATUS_LABELS: Record<StudentExitStatus, string> = {
  requested: 'در انتظار تایید مدیریت',
  approved: 'تایید شده (آماده خروج)',
  exited: 'خروج نهایی انجام شد',
  returned: 'بازگشت به مدرسه ثبت شد',
  rejected: 'رد شده',
};

export const PICKUP_RELATIONS_FA: Array<StudentExitPass['pickupRelation']> = [
  'پدر',
  'مادر',
  'سرویس',
  'سایر',
];

export function generateExitTrackingCode(jalaliDate: string, seedNum?: number): string {
  const year = toAsciiDigits(jalaliDate).split('/')[0] || '1405';
  const rand =
    typeof seedNum === 'number'
      ? String(1000 + (seedNum % 8999))
      : String(1000 + Math.floor(Math.random() * 8999));
  return `EX-${year}-${rand}`;
}

export function computeDurationHoursFromRange(startTimeHm: string, endTimeHm: string): number {
  const parseHm = (raw: string): number | null => {
    const clean = toAsciiDigits(raw).trim();
    const parts = clean.split(':');
    if (parts.length !== 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return null;
    }
    return h * 60 + m;
  };
  const s = parseHm(startTimeHm);
  const e = parseHm(endTimeHm);
  if (s === null || e === null || e <= s) return 0;
  return Number(((e - s) / 60).toFixed(2));
}

export interface StaffLeaveCumulativeSummary {
  staffUserId: string;
  approvedHourlyHours: number;
  approvedDailyDays: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
}

export function computeStaffLeaveSummary(
  requests: StaffLeaveRequest[],
  staffUserId: string,
  academicYearId?: string
): StaffLeaveCumulativeSummary {
  let approvedHourlyHours = 0;
  let approvedDailyDays = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  for (const r of requests) {
    if (r.staffUserId !== staffUserId) continue;
    if (academicYearId && r.academicYearId && r.academicYearId !== academicYearId) continue;
    if (r.status === 'approved') {
      approvedCount += 1;
      if (r.leaveType === 'hourly') {
        const hrs =
          typeof r.durationHours === 'number' && r.durationHours > 0
            ? r.durationHours
            : r.startTimeHm && r.endTimeHm
              ? computeDurationHoursFromRange(r.startTimeHm, r.endTimeHm)
              : 1;
        approvedHourlyHours += hrs;
      } else {
        approvedDailyDays += 1;
      }
    } else if (r.status === 'pending') {
      pendingCount += 1;
    } else if (r.status === 'rejected') {
      rejectedCount += 1;
    }
  }

  return {
    staffUserId,
    approvedHourlyHours: Number(approvedHourlyHours.toFixed(2)),
    approvedDailyDays,
    approvedCount,
    pendingCount,
    rejectedCount,
  };
}

export function buildExitPassA5PrintHtml(params: {
  pass: StudentExitPass;
  studentName: string;
  studentNationalId: string;
  className: string;
  school: School;
}): string {
  const { pass, studentName, studentNationalId, className, school } = params;
  return `
    <div style="font-family: Vazirmatn, Tahoma, sans-serif; color:#0f172a; line-height: 1.75; font-size: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px;">
        <div>
          <div style="font-size:15px; font-weight:800;">برگه رسمی مجوز خروج دانش‌آموز (تحویل به نگهبانی)</div>
          <div style="font-size:11px; color:#475569;">${escapeHtml(school.name)}</div>
        </div>
        <div style="text-align:left; border:1px solid #0f172a; border-radius:6px; padding:4px 10px;">
          <div style="font-size:10px; color:#475569;">کد رهگیری خروج</div>
          <div style="font-size:13px; font-weight:800; direction:ltr;">${escapeHtml(toPersianDigits(pass.trackingCode))}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700; width:24%;">نام دانش‌آموز</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; width:26%; font-weight:700;">${escapeHtml(studentName)}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700; width:24%;">کد ملی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; width:26%;">${escapeHtml(toPersianDigits(studentNationalId))}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">کلاس / پایه</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(className)}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">تاریخ شمسی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(toPersianDigits(pass.jalaliDate))}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">علت خروج</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(EXIT_REASON_LABELS[pass.reasonCategory])}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">تایید ولی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${pass.parentVerified ? 'تایید و هماهنگ‌شده با ولی' : 'نیازمند استعلام تلفنی'}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">ساعت خروج برنامه‌ریزی‌شده</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">${escapeHtml(toPersianDigits(pass.plannedExitTimeHm))}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">بازگشت احتمالی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(pass.expectedReturnTimeHm ? toPersianDigits(pass.expectedReturnTimeHm) : 'بازگشت در همان روز ندارد')}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">تحویل‌گیرنده</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">${escapeHtml(pass.pickupPersonName)} (${escapeHtml(pass.pickupRelation)})</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">کد ملی تحویل‌گیرنده</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(pass.pickupNationalId ? toPersianDigits(pass.pickupNationalId) : 'ثبت نشده')}</td>
          </tr>
          ${
            pass.reasonDetail
              ? `<tr>
                  <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">توضیحات تکمیلی</td>
                  <td style="border:1px solid #cbd5e1; padding:5px 8px;" colspan="3">${escapeHtml(pass.reasonDetail)}</td>
                </tr>`
              : ''
          }
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">وضعیت ثبت‌شده</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;" colspan="3">
              ${escapeHtml(EXIT_STATUS_LABELS[pass.status])}
              ${pass.actualExitTimeHm ? ` &nbsp;|&nbsp; خروج واقعی: ${escapeHtml(toPersianDigits(pass.actualExitTimeHm))}` : ''}
              ${pass.actualReturnTimeHm ? ` &nbsp;|&nbsp; بازگشت واقعی: ${escapeHtml(toPersianDigits(pass.actualReturnTimeHm))}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%; border-collapse:collapse; text-align:center; margin-top:16px;">
        <tbody>
          <tr>
            <td style="width:33%; border:1px solid #cbd5e1; padding:10px; height:72px; vertical-align:top;">
              <div style="font-weight:700;">تایید معاونت / مدیریت</div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">${escapeHtml(pass.approvedByName ?? school.principalName)}</div>
            </td>
            <td style="width:33%; border:1px solid #cbd5e1; padding:10px; height:72px; vertical-align:top;">
              <div style="font-weight:700;">امضای تحویل‌گیرنده</div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">${escapeHtml(pass.pickupPersonName)}</div>
            </td>
            <td style="width:34%; border:1px solid #cbd5e1; padding:10px; height:72px; vertical-align:top;">
              <div style="font-weight:700;">مهر و ثبت ساعت نگهبانی</div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">کنترل کارت شناسایی</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export function buildStaffLeaveA5PrintHtml(params: {
  request: StaffLeaveRequest;
  summary: StaffLeaveCumulativeSummary;
  school: School;
}): string {
  const { request, summary, school } = params;
  const statusFa =
    request.status === 'approved'
      ? 'موافقت و تایید شد'
      : request.status === 'rejected'
        ? 'عدم موافقت / رد شد'
        : 'در انتظار بررسی مدیر مدرسه';

  return `
    <div style="font-family: Vazirmatn, Tahoma, sans-serif; color:#0f172a; line-height: 1.75; font-size: 12px;">
      <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px;">
        <div style="font-size:15px; font-weight:800;">برگ رسمی مرخصی ${request.leaveType === 'hourly' ? 'ساعتی' : 'روزانه'} کادر آموزشی و اداری</div>
        <div style="font-size:11px; color:#475569;">${escapeHtml(school.name)} — سال تحصیلی ${escapeHtml(toPersianDigits(school.academicYear))}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700; width:26%;">نام و نام خانوادگی همکار</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; width:24%; font-weight:700;">${escapeHtml(request.staffName)}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700; width:26%;">نوع مرخصی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; width:24%;">${request.leaveType === 'hourly' ? 'مرخصی ساعتی' : 'مرخصی روزانه'}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">تاریخ شمسی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(toPersianDigits(request.jalaliDate))}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">بازه زمانی / مدت</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">
              ${
                request.leaveType === 'hourly'
                  ? `از ${escapeHtml(toPersianDigits(request.startTimeHm ?? ''))} تا ${escapeHtml(toPersianDigits(request.endTimeHm ?? ''))} (${toPersianDigits(request.durationHours ?? 0)} ساعت)`
                  : 'یک روز کامل کاری'
              }
            </td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">علت درخواست</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;" colspan="3">${escapeHtml(request.reason)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">همکار جایگزین پیشنهادی</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${escapeHtml(request.suggestedSubstituteTeacherName ?? 'اعلام نشده')}</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">جمع مرخصی‌های سال جاری</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px;">${toPersianDigits(summary.approvedDailyDays)} روز و ${toPersianDigits(summary.approvedHourlyHours)} ساعت</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; background:#f8fafc; font-weight:700;">نتیجه بررسی مدیریت</td>
            <td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;" colspan="3">
              ${escapeHtml(statusFa)}
              ${request.principalReviewNote ? ` — یادداشت مدیر: ${escapeHtml(request.principalReviewNote)}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%; border-collapse:collapse; text-align:center; margin-top:16px;">
        <tbody>
          <tr>
            <td style="width:50%; border:1px solid #cbd5e1; padding:10px; height:70px; vertical-align:top;">
              <div style="font-weight:700;">امضای متقاضی</div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">${escapeHtml(request.staffName)}</div>
            </td>
            <td style="width:50%; border:1px solid #cbd5e1; padding:10px; height:70px; vertical-align:top;">
              <div style="font-weight:700;">مهر و امضای مدیر مدرسه</div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">${escapeHtml(request.reviewedByName ?? school.principalName)}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
