// Precision A4 Print Letterhead & Official School Signature Footer Wrapper
import React from 'react';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import type { School } from '../../types/domain';
import { useAppearance } from '../appearance/AppearanceContext';
import { DEFAULT_BRAND_LOGO_DATA_URL } from '../branding/BrandLogo';
import { useSchoolData } from '../data/DataContext';

interface PrintShellProps {
  school: School;
  documentTitle: string;
  subtitle?: string;
  landscape?: boolean;
  children: React.ReactNode;
}

export const PrintShell: React.FC<PrintShellProps> = ({
  school,
  documentTitle,
  subtitle,
  landscape = false,
  children,
}) => {
  const todayDisplay = formatJalaliDisplay(getTodayJalali(), true);
  const { globalSystemConfig } = useSchoolData();
  const { schoolLogoUrl, activeSchoolDisplayName, activePrintSubtitle, branding } = useAppearance();
  const effectiveLogo =
    schoolLogoUrl ||
    school.logoDataUrl ||
    globalSystemConfig?.systemLogoDataUrl ||
    DEFAULT_BRAND_LOGO_DATA_URL;
  const letterheadTitle =
    branding?.schoolDisplayName?.trim() || school.letterheadTitle || school.name;

  return (
    <div className={`print-container ${landscape ? 'print-landscape' : ''}`}>
      {/* Official A4 / A5 Letterhead (visible strictly in @media print) */}
      <header className="print-only print-letterhead mb-4 pb-3 border-b-2 border-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 text-right">
            <img
              src={effectiveLogo}
              alt={activeSchoolDisplayName}
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <h1 className="print-letterhead-title text-base font-extrabold text-black">
                {letterheadTitle}
              </h1>
              <p className="print-letterhead-sub text-xs text-slate-700 mt-0.5">
                {activePrintSubtitle}
              </p>
              <p className="print-letterhead-sub text-xs text-slate-700 mt-0.5">
                نشانی: {school.address} · تلفن: {toPersianDigits(school.phone)}
              </p>
            </div>
          </div>
          <div className="print-letterhead-meta text-left text-xs text-slate-800 space-y-0.5 shrink-0">
            <div>سال تحصیلی: {toPersianDigits(school.academicYear)}</div>
            <div>تاریخ چاپ: {todayDisplay}</div>
            <div>مدیر واحد: {school.principalName}</div>
          </div>
        </div>
        <div className="print-letterhead-doc mt-3 pt-2 border-t border-slate-300 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-black">{documentTitle}</h2>
          {subtitle && <span className="text-xs text-slate-700">{toPersianDigits(subtitle)}</span>}
        </div>
      </header>

      {children}

      {/* Official Signature Footer (visible strictly in @media print) */}
      <footer className="print-only print-footer">
        <div className="print-signature-grid text-center text-xs text-black">
          <div>
            <div className="font-bold">تایید معلم مربوطه</div>
            <div className="print-sig-space mt-8 text-slate-500">نام و امضا</div>
          </div>
          <div>
            <div className="font-bold">تایید معاون اجرایی / آموزشی</div>
            <div className="print-sig-space mt-8 text-slate-500">نام و امضا</div>
          </div>
          <div>
            <div className="font-bold">مهر و تایید مدیر مدرسه</div>
            <div className="mt-1 text-slate-700">{school.principalName}</div>
            <div className="print-sig-space mt-6 text-slate-500">امضا و مهر واحد</div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-slate-600 text-center">
          {school.signatureFooter}
        </div>
      </footer>
    </div>
  );
};
