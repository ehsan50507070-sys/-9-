// Official A4 & A5 Print Templates for Phase 7: Certificate, Teacher Transcript & School Participation Matrix
import React from 'react';
import { useAppearance } from '../../core/appearance/AppearanceContext';
import { PrintShell } from '../../core/export/PrintShell';
import type { PrintPaperSize } from '../../core/print/printService';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import type {
  School,
  TeacherDevCertificate,
} from '../../types/domain';
import {
  CONTENT_TYPE_LABELS,
  REQUIREMENT_LABELS,
  type ParticipationMatrixResult,
  type TeacherStandingRow,
} from './teacherDevHelpers';

export type TeacherDevPrintJob =
  | {
      kind: 'certificate';
      size: PrintPaperSize;
      certificate: TeacherDevCertificate;
    }
  | {
      kind: 'transcript';
      size: PrintPaperSize;
      standing: TeacherStandingRow;
      certificates: TeacherDevCertificate[];
    }
  | {
      kind: 'matrix';
      size: PrintPaperSize;
      matrix: ParticipationMatrixResult;
      filterLabel: string;
    };

interface TeacherDevPrintViewProps {
  school: School;
  job: TeacherDevPrintJob | null;
}

export const TeacherDevPrintView: React.FC<TeacherDevPrintViewProps> = ({ school, job }) => {
  const { schoolLogoUrl, activeSchoolDisplayName } = useAppearance();

  if (!job) return null;

  if (job.kind === 'certificate') {
    const { certificate, size } = job;
    const isA5 = size === 'a5';
    return (
      <div className="hidden print:block print-container" dir="rtl">
        <div
          className={`certificate-print-sheet ${isA5 ? 'certificate-print-a5' : ''}`}
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
          <div className="certificate-print-inner">
            {/* Top Header */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                {schoolLogoUrl && (
                  <img
                    src={schoolLogoUrl}
                    alt={activeSchoolDisplayName}
                    className={isA5 ? 'w-10 h-10 object-contain' : 'w-14 h-14 object-contain'}
                  />
                )}
                <div className="text-right">
                  <div className={isA5 ? 'text-xs font-extrabold' : 'text-sm font-extrabold'}>
                    {school.letterheadTitle}
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5">
                    واحد توسعه حرفه‌ای و دانش‌افزایی کادر آموزشی · سال تحصیلی{' '}
                    {toPersianDigits(school.academicYear)}
                  </div>
                </div>
              </div>
              <div className="text-left text-[11px] space-y-1 shrink-0">
                <div>
                  شماره گواهینامه:{' '}
                  <strong dir="ltr" className="inline-block font-mono">
                    {toPersianDigits(certificate.serialNumber)}
                  </strong>
                </div>
                <div>تاریخ صدور: {formatJalaliDisplay(certificate.issuedDateJalali, false)}</div>
              </div>
            </div>

            {/* Center Formal Body */}
            <div className={`text-center ${isA5 ? 'my-4 space-y-3' : 'my-8 space-y-5'}`}>
              <div>
                <div className="text-xs font-bold tracking-wide text-slate-700">
                  به‌نام خالق دانایی
                </div>
                <h1
                  className={`font-extrabold mt-2 ${
                    isA5 ? 'text-lg' : 'text-2xl'
                  } text-black`}
                >
                  گواهینامه پایان دوره ضمن خدمت
                </h1>
              </div>

              <p
                className={`leading-9 mx-auto max-w-2xl text-black ${
                  isA5 ? 'text-xs leading-7' : 'text-base leading-10'
                }`}
              >
                بدین‌وسیله گواهی می‌شود همکار ارجمند جناب آقای / سرکار خانم{' '}
                <strong className="underline underline-offset-4 px-1">
                  {certificate.teacherName}
                </strong>{' '}
                {CONTENT_TYPE_LABELS[certificate.contentType]}{' '}
                <strong>«{certificate.courseTitle}»</strong> ({REQUIREMENT_LABELS[certificate.requirement]})
                را به مدت{' '}
                <strong>{toPersianDigits(certificate.inServiceHours)} ساعت ضمن خدمت مصوب</strong>{' '}
                با موفقیت به پایان رسانده و در آزمون ارزیابی پایانی امتیاز{' '}
                <strong>{toPersianDigits(certificate.scorePercent)} درصد</strong> را کسب نموده است.
              </p>

              {/* Metadata Box */}
              <div className="grid grid-cols-3 gap-2 border border-slate-800 rounded-lg p-3 text-xs">
                <div>
                  <div className="text-slate-600">ساعت مصوب</div>
                  <div className="font-extrabold mt-0.5">
                    {toPersianDigits(certificate.inServiceHours)} ساعت
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">نمره آزمون پایانی</div>
                  <div className="font-extrabold mt-0.5">
                    {toPersianDigits(certificate.scorePercent)}٪
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">وضعیت زمان‌بندی</div>
                  <div className="font-extrabold mt-0.5">
                    {certificate.onTime ? 'تکمیل به‌موقع در مهلت مقرر' : 'تکمیل‌شده'}
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Lines */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-700 text-center text-xs">
              <div>
                <div className="font-bold">مدیر مدرسه</div>
                <div className="mt-1">{school.principalName}</div>
                <div className="mt-8 text-slate-600">مهر و امضا</div>
              </div>
              <div>
                <div className="font-bold">مدیر کل مجموعه مدارس</div>
                <div className="mt-1">مدیریت ارشد آموزشی مجموعه</div>
                <div className="mt-8 text-slate-600">مهر و امضا</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (job.kind === 'transcript') {
    const { standing, certificates } = job;
    return (
      <div className="hidden print:block" dir="rtl">
        <PrintShell
          school={school}
          documentTitle="کارنامه جامع ضمن خدمت همکار"
          subtitle={`${standing.teacherName} (${standing.specialty})`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-4 gap-2 border border-slate-800 rounded p-3">
              <div>
                <div className="text-slate-600">نام همکار</div>
                <div className="font-bold mt-0.5">{standing.teacherName}</div>
              </div>
              <div>
                <div className="text-slate-600">سطح رتبه‌بندی ۵گانه</div>
                <div className="font-bold mt-0.5">{standing.tier.titleFa}</div>
              </div>
              <div>
                <div className="text-slate-600">مجموع ساعات مصوب</div>
                <div className="font-bold mt-0.5">
                  {toPersianDigits(standing.totalApprovedHours)} ساعت
                </div>
              </div>
              <div>
                <div className="text-slate-600">امتیاز کل</div>
                <div className="font-bold mt-0.5">{toPersianDigits(standing.points)} امتیاز</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>عنوان دوره / کتاب</th>
                  <th>نوع</th>
                  <th>الزام</th>
                  <th>ساعت</th>
                  <th>نمره آزمون</th>
                  <th>شماره گواهی</th>
                  <th>تاریخ صدور</th>
                </tr>
              </thead>
              <tbody>
                {certificates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      تاکنون گواهینامه‌ای برای این همکار صادر نشده است.
                    </td>
                  </tr>
                ) : (
                  certificates.map((cert, idx) => (
                    <tr key={cert.id}>
                      <td className="text-center">{toPersianDigits(idx + 1)}</td>
                      <td>{cert.courseTitle}</td>
                      <td className="text-center">{CONTENT_TYPE_LABELS[cert.contentType]}</td>
                      <td className="text-center">{REQUIREMENT_LABELS[cert.requirement]}</td>
                      <td className="text-center">{toPersianDigits(cert.inServiceHours)}</td>
                      <td className="text-center">{toPersianDigits(cert.scorePercent)}٪</td>
                      <td className="text-center font-mono">
                        {toPersianDigits(cert.serialNumber)}
                      </td>
                      <td className="text-center">
                        {formatJalaliDisplay(cert.issuedDateJalali, false)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="border border-slate-700 rounded p-2.5 text-[11px]">
              تفکیک امتیاز: دوره‌های الزامی ({toPersianDigits(standing.breakdown.mandatoryHoursPoints)}) ·
              دوره‌های اختیاری ({toPersianDigits(standing.breakdown.optionalHoursPoints)}) ·
              پاداش کیفیت آزمون ({toPersianDigits(standing.breakdown.qualityScoreBonus)}) ·
              پاداش تکمیل به‌موقع ({toPersianDigits(standing.breakdown.onTimeBonus)}) ·
              مطالعه فعال ({toPersianDigits(standing.breakdown.activeStudyPoints)})
            </div>
          </div>
        </PrintShell>
      </div>
    );
  }

  // Matrix printout
  const { matrix, filterLabel } = job;
  return (
    <div className="hidden print:block" dir="rtl">
      <PrintShell
        school={school}
        documentTitle="گزارش ماتریس مشارکت و وضعیت دانش‌افزایی مدرسه"
        subtitle={`فیلتر: ${filterLabel} · نرخ تکمیل کل: ${toPersianDigits(matrix.overallCompletionRatePercent)}٪`}
        landscape
      >
        <div className="space-y-3 text-xs">
          <table>
            <thead>
              <tr>
                <th>نام معلم</th>
                {matrix.courses.map((c) => (
                  <th key={c.id}>
                    {c.title} ({toPersianDigits(c.inServiceHours)} ساعت)
                  </th>
                ))}
                <th>تکمیل‌شده</th>
                <th>مجموع ساعت</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.teacher.id}>
                  <td className="font-bold">{row.teacher.fullName}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.courseId} className="text-center">
                      {cell.labelFa}
                    </td>
                  ))}
                  <td className="text-center font-bold">
                    {toPersianDigits(row.completedCount)} از {toPersianDigits(matrix.courses.length)}
                  </td>
                  <td className="text-center font-bold">
                    {toPersianDigits(row.totalApprovedHours)} ساعت
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="font-bold">جمع کل تکمیل‌شده</td>
                {matrix.courseSummaries.map((s) => (
                  <td key={s.courseId} className="text-center font-bold">
                    {toPersianDigits(s.completedCount)} از {toPersianDigits(matrix.rows.length)} (
                    {toPersianDigits(s.completionRatePercent)}٪)
                  </td>
                ))}
                <td className="text-center font-bold">
                  {toPersianDigits(matrix.overallCompletionRatePercent)}٪
                </td>
                <td className="text-center font-bold">
                  {toPersianDigits(matrix.totalSchoolApprovedHours)} ساعت
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </PrintShell>
    </div>
  );
};
