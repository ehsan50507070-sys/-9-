// Official Appreciation Certificate View (Student & Parent variants)
// Custom Minimal Geometric/Tazhib SVG Frame in Navy (#1E3A5F) & Muted Gold (#B8922E)
// Pure-white print surface supporting A4 Portrait, A5 Half-Page, and 2-Up A5 on A4
import React from 'react';
import { Award } from 'lucide-react';
import {
  DEFAULT_BRAND_LOGO_DATA_URL,
  OFFICIAL_SYSTEM_NAME_FA,
} from '../../core/branding/BrandLogo';
import { toPersianDigits } from '../../lib/digits';
import type { School, StudentReward } from '../../types/domain';

export type CertificatePaperSize = 'a4' | 'a5' | 'a5_2up';
export type CertificateRecipientType = 'student' | 'parent';

interface CertificatePrintViewProps {
  reward: StudentReward;
  studentName: string;
  parentName?: string;
  className: string;
  school: School;
  logoUrl?: string | null;
  paperSize?: CertificatePaperSize;
  recipientType?: CertificateRecipientType;
}

/**
 * Custom Geometric / Tazhib Corner Ornament SVG (Navy & Muted Gold)
 */
const CornerOrnamentSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 60V12C4 7.58172 7.58172 4 12 4H60"
      stroke="#1E3A5F"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M11 54V17C11 13.6863 13.6863 11 17 11H54"
      stroke="#B8922E"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M18 18L26 18L18 26Z"
      fill="#D4AF37"
      fillOpacity="0.45"
      stroke="#B8922E"
      strokeWidth="1"
    />
    <polygon
      points="11,11 15,7 19,11 15,15"
      fill="#1E3A5F"
      stroke="#D4AF37"
      strokeWidth="0.9"
    />
    <circle cx="32" cy="11" r="1.8" fill="#B8922E" />
    <circle cx="11" cy="32" r="1.8" fill="#B8922E" />
  </svg>
);

const TopHeaderMedallionSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 220 26"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <line x1="8" y1="13" x2="80" y2="13" stroke="#B8922E" strokeWidth="1.2" />
    <line x1="140" y1="13" x2="212" y2="13" stroke="#B8922E" strokeWidth="1.2" />
    <polygon
      points="110,3 128,13 110,23 92,13"
      fill="#FBF7EB"
      stroke="#1E3A5F"
      strokeWidth="1.5"
    />
    <polygon points="110,7 120,13 110,19 100,13" fill="#B8922E" fillOpacity="0.35" />
    <circle cx="110" cy="13" r="2.2" fill="#1E3A5F" />
    <circle cx="84" cy="13" r="2" fill="#B8922E" />
    <circle cx="136" cy="13" r="2" fill="#B8922E" />
  </svg>
);

const SingleCertificateCard: React.FC<{
  reward: StudentReward;
  studentName: string;
  parentName?: string;
  className: string;
  school: School;
  logoUrl?: string | null;
  recipientType: CertificateRecipientType;
  compact: 'none' | 'a5' | 'a5_2up';
}> = ({
  reward,
  studentName,
  parentName,
  className,
  school,
  logoUrl,
  recipientType,
  compact,
}) => {
  const is2Up = compact === 'a5_2up';
  const isA5 = compact === 'a5';
  const isParentCert = recipientType === 'parent';
  const effectiveLogo = logoUrl || school.logoDataUrl || DEFAULT_BRAND_LOGO_DATA_URL;
  const cornerSize = is2Up ? 'w-8 h-8' : isA5 ? 'w-11 h-11' : 'w-14 h-14';

  return (
    <div
      dir="rtl"
      className={`certificate-print-sheet relative bg-white text-slate-900 rounded-md shadow-sm overflow-hidden ${
        is2Up ? 'p-3 sm:p-4' : isA5 ? 'p-4 sm:p-6 max-w-xl mx-auto' : 'p-5 sm:p-8'
      }`}
      style={{
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        border: '2.5px solid #1E3A5F',
      }}
    >
      {/* Subtle Inner Gold Border Frame */}
      <div
        className={`certificate-print-inner relative flex flex-col justify-between ${
          is2Up
            ? 'p-4 sm:p-5 min-h-[300px] gap-2.5'
            : isA5
              ? 'p-5 sm:p-7 min-h-[440px] gap-4'
              : 'p-6 sm:p-10 min-h-[580px] gap-7'
        }`}
        style={{
          border: '1.5px solid #B8922E',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Four Symmetrical Tazhib/Geometric SVG Corners */}
        <CornerOrnamentSvg className={`pointer-events-none absolute top-1.5 left-1.5 ${cornerSize}`} />
        <CornerOrnamentSvg
          className={`pointer-events-none absolute top-1.5 right-1.5 -scale-x-100 ${cornerSize}`}
        />
        <CornerOrnamentSvg
          className={`pointer-events-none absolute bottom-1.5 left-1.5 -scale-y-100 ${cornerSize}`}
        />
        <CornerOrnamentSvg
          className={`pointer-events-none absolute bottom-1.5 right-1.5 -scale-x-100 -scale-y-100 ${cornerSize}`}
        />

        {/* Top Official Letterhead with School / System Logo */}
        <header className={is2Up ? 'space-y-1.5 relative z-10' : 'space-y-2.5 relative z-10'}>
          <div
            className={`text-center font-bold tracking-wide ${
              is2Up ? 'text-[11px]' : 'text-xs sm:text-sm'
            }`}
            style={{ color: '#1E3A5F' }}
          >
            به نام خداوند جان و خرد
          </div>

          <div
            className={`flex flex-col sm:flex-row items-center justify-between gap-2.5 border-b ${
              is2Up ? 'pb-2 text-[11px]' : 'pb-3 text-xs sm:text-sm'
            }`}
            style={{ borderColor: '#D4AF37' }}
          >
            <div className="flex items-center gap-2.5 text-center sm:text-right">
              <img
                src={effectiveLogo}
                alt={school.name}
                className={`object-contain rounded-lg border bg-white p-0.5 shrink-0 ${
                  is2Up ? 'w-9 h-9' : isA5 ? 'w-11 h-11' : 'w-14 h-14'
                }`}
                style={{ borderColor: '#E2E8F0' }}
              />
              <div>
                <div
                  className={`font-extrabold ${
                    is2Up ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                  }`}
                  style={{ color: '#1E3A5F' }}
                >
                  {school.letterheadTitle || school.name}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {OFFICIAL_SYSTEM_NAME_FA} · سال تحصیلی {toPersianDigits(school.academicYear)}
                </div>
              </div>
            </div>

            <div className="text-center sm:text-left space-y-0.5 text-[11px] text-slate-700 tabular-nums shrink-0">
              <div>
                شماره سند:{' '}
                <strong className="font-bold text-slate-900">
                  {toPersianDigits(reward.certificateSerial)}
                </strong>
              </div>
              <div>
                تاریخ صدور:{' '}
                <strong className="font-bold text-slate-900">
                  {toPersianDigits(reward.jalaliDate)}
                </strong>
              </div>
            </div>
          </div>
        </header>

        {/* Formal Certificate Body */}
        <section
          className={`relative z-10 text-center my-auto ${
            is2Up ? 'space-y-2 py-1' : isA5 ? 'space-y-3 py-2' : 'space-y-4 py-2'
          }`}
        >
          <div className={`flex flex-col items-center ${is2Up ? 'gap-1' : 'gap-2'}`}>
            <div
              className={`rounded-full border-2 flex items-center justify-center ${
                is2Up ? 'w-9 h-9' : isA5 ? 'w-11 h-11' : 'w-14 h-14'
              }`}
              style={{
                borderColor: '#B8922E',
                backgroundColor: '#FBF7EB',
                color: '#1E3A5F',
              }}
            >
              <Award className={is2Up ? 'w-4 h-4' : isA5 ? 'w-6 h-6' : 'w-7 h-7'} />
            </div>

            <h2
              className={`font-extrabold tracking-tight ${
                is2Up ? 'text-lg sm:text-xl' : isA5 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
              }`}
              style={{ color: '#1E3A5F' }}
            >
              {isParentCert ? 'لوح سپاس و تقدیر از ولی گرامی' : 'لوح تقدیر و سپاس'}
            </h2>

            <TopHeaderMedallionSvg className={is2Up ? 'w-36 h-4' : 'w-48 h-5'} />
          </div>

          <div className="flex justify-center">
            <div
              className={`inline-block rounded-lg border font-extrabold ${
                is2Up
                  ? 'px-4 py-1 text-xs'
                  : isA5
                    ? 'px-5 py-1.5 text-xs sm:text-sm'
                    : 'px-6 py-2 text-sm sm:text-base'
              }`}
              style={{
                borderColor: '#B8922E',
                backgroundColor: '#FBF7EB',
                color: '#1E3A5F',
              }}
            >
              {isParentCert
                ? `سپاس از همراهی سازنده · محور ${reward.category}`
                : `نشان افتخار: ${reward.badgeTitle}`}
            </div>
          </div>

          <div
            className={`max-w-xl mx-auto text-slate-800 ${
              is2Up
                ? 'space-y-1.5 text-xs leading-5'
                : isA5
                  ? 'space-y-2.5 text-xs sm:text-sm leading-7'
                  : 'space-y-3.5 text-sm sm:text-base leading-9'
            }`}
          >
            {isParentCert ? (
              <>
                <p
                  className={`font-bold ${is2Up ? 'text-sm' : isA5 ? 'text-base' : 'text-lg'}`}
                  style={{ color: '#1E3A5F' }}
                >
                  ولی محترم و ارجمند دانش‌آموز{' '}
                  <span
                    className="underline decoration-2 underline-offset-4"
                    style={{ textDecorationColor: '#B8922E' }}
                  >
                    {studentName}
                  </span>
                  {parentName ? ` (${parentName})` : ''}
                </p>
                <p>
                  بدین‌وسیله به پاس همراهی ارزشمند، حمایت دلسوزانه و نقش مؤثر جناب‌عالی در موفقیت و
                  درخشش فرزند عزیزتان در کلاس <strong>«{className}»</strong> و کسب نشان{' '}
                  <strong>«{reward.badgeTitle}»</strong>، این لوح سپاس با کمال احترام تقدیم حضور
                  می‌گردد.
                </p>
              </>
            ) : (
              <>
                <p
                  className={`font-bold ${is2Up ? 'text-sm' : isA5 ? 'text-base' : 'text-lg'}`}
                  style={{ color: '#1E3A5F' }}
                >
                  دانش‌آموز گرامی و پرتلاش،{' '}
                  <span
                    className="underline decoration-2 underline-offset-4"
                    style={{ textDecorationColor: '#B8922E' }}
                  >
                    {studentName}
                  </span>
                </p>
                <p>
                  دانش‌آموز عزیز کلاس <strong>«{className}»</strong>؛ این لوح تقدیر به پاس کوشش
                  ارزشمند شما در محور <strong>«{reward.category}»</strong> و کسب نشان{' '}
                  <strong>«{reward.badgeTitle}»</strong> تقدیم حضور می‌گردد.
                </p>
              </>
            )}

            <div
              className={`rounded-lg border text-slate-700 ${
                is2Up
                  ? 'px-3 py-1.5 text-[11px] leading-5'
                  : 'px-5 py-2.5 text-xs sm:text-sm leading-6'
              }`}
              style={{
                backgroundColor: '#F8FAFC',
                borderColor: '#CBD5E1',
              }}
            >
              <span className="font-bold text-slate-900">شرح تقدیر: </span>
              {reward.reason}
            </div>

            {!is2Up && (
              <p className="text-slate-700">
                {isParentCert
                  ? 'بی‌تردید همدلی خانه و مدرسه روشن‌ترین چراغ راه شکوفایی فرزندان این سرزمین است. توفیق و سربلندی روزافزون خانواده محترم را از درگاه ایزد منان خواستاریم.'
                  : 'امید است در سایه توکل، پشتکار و همراهی خانواده محترم، همواره در مسیر علم‌آموزی و موفقیت‌های روزافزون سرافراز باشید.'}
              </p>
            )}
          </div>
        </section>

        {/* Official Signatures & Dedicated School Seal Slot */}
        <footer
          className={`relative z-10 grid grid-cols-3 gap-3 border-t text-center items-end ${
            is2Up ? 'pt-2.5 text-[10px]' : 'pt-4 text-xs sm:text-sm'
          }`}
          style={{ borderColor: '#D4AF37' }}
        >
          <div className={is2Up ? 'space-y-3' : 'space-y-7'}>
            <div>
              <div className="font-bold text-slate-900">امضای معلم / اهداکننده</div>
              <div className="text-slate-600 mt-0.5 text-[11px]">{reward.awardedByName}</div>
            </div>
            <div className="border-t border-dashed border-slate-400 w-24 sm:w-28 mx-auto pt-0.5 text-[10px] text-slate-500">
              محل امضا
            </div>
          </div>

          {/* Official Seal Slot */}
          <div className="flex flex-col items-center justify-center">
            <div
              className={`rounded-full border border-dashed flex flex-col items-center justify-center text-center px-2 ${
                is2Up ? 'w-14 h-14 text-[8px]' : isA5 ? 'w-16 h-16 text-[9px]' : 'w-20 h-20 text-[10px]'
              }`}
              style={{ borderColor: '#94A3B8', color: '#64748B' }}
            >
              <span className="font-bold leading-tight">محل مهر رسمی</span>
              <span className="leading-tight mt-0.5">واحد آموزشی</span>
            </div>
          </div>

          <div className={is2Up ? 'space-y-3' : 'space-y-7'}>
            <div>
              <div className="font-bold text-slate-900">مدیریت واحد آموزشی</div>
              <div className="text-slate-600 mt-0.5 text-[11px]">{school.principalName}</div>
            </div>
            <div className="border-t border-dashed border-slate-400 w-24 sm:w-28 mx-auto pt-0.5 text-[10px] text-slate-500">
              مهر و امضای مدیریت
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export const CertificatePrintView: React.FC<CertificatePrintViewProps> = ({
  reward,
  studentName,
  parentName,
  className,
  school,
  logoUrl,
  paperSize = 'a4',
  recipientType = 'student',
}) => {
  if (paperSize === 'a5_2up') {
    return (
      <div className="certificate-print-2up space-y-4 print:space-y-0">
        <SingleCertificateCard
          reward={reward}
          studentName={studentName}
          parentName={parentName}
          className={className}
          school={school}
          logoUrl={logoUrl}
          recipientType={recipientType}
          compact="a5_2up"
        />

        {/* Dashed Cut Line («خط برش») */}
        <div
          aria-label="خط برش بین دو لوح تقدیر A5"
          className="certificate-cut-line relative flex items-center justify-center py-1"
        >
          <div className="w-full border-t-2 border-dashed border-slate-400" />
          <span className="absolute bg-slate-100 print:bg-white px-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">
            خط برش (۲ عدد A5 در یک برگه A4)
          </span>
        </div>

        <SingleCertificateCard
          reward={reward}
          studentName={studentName}
          parentName={parentName}
          className={className}
          school={school}
          logoUrl={logoUrl}
          recipientType={recipientType}
          compact="a5_2up"
        />
      </div>
    );
  }

  if (paperSize === 'a5') {
    return (
      <div className="certificate-print-a5">
        <SingleCertificateCard
          reward={reward}
          studentName={studentName}
          parentName={parentName}
          className={className}
          school={school}
          logoUrl={logoUrl}
          recipientType={recipientType}
          compact="a5"
        />
      </div>
    );
  }

  return (
    <SingleCertificateCard
      reward={reward}
      studentName={studentName}
      parentName={parentName}
      className={className}
      school={school}
      logoUrl={logoUrl}
      recipientType={recipientType}
      compact="none"
    />
  );
};
