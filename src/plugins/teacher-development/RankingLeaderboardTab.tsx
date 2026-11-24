// 5-Tier Teacher Ranking & Privacy Controls Tab (Respects public / top3_only / private modes strictly)
import React from 'react';
import { Award, EyeOff, Lock, Medal, ShieldCheck, Trophy } from 'lucide-react';
import { PrintButtons } from '../../core/print/PrintButtons';
import type { PrintPaperSize } from '../../core/print/printService';
import { toPersianDigits } from '../../lib/digits';
import type { TeacherDevRankingPrivacyMode } from '../../types/domain';
import {
  PRIVACY_MODE_LABELS,
  TEACHER_RANK_TIERS,
  type PrivacyFilteredLeaderboard,
  type TeacherStandingRow,
} from './teacherDevHelpers';

interface RankingLeaderboardTabProps {
  leaderboard: PrivacyFilteredLeaderboard;
  isManager: boolean;
  canConfigurePrivacy: boolean;
  currentTeacherId?: string | null;
  onChangePrivacyMode: (mode: TeacherDevRankingPrivacyMode) => void;
  onPrintTeacherTranscript: (teacherId: string, size: PrintPaperSize) => void;
}

export const RankingLeaderboardTab: React.FC<RankingLeaderboardTabProps> = ({
  leaderboard,
  isManager,
  canConfigurePrivacy,
  currentTeacherId,
  onChangePrivacyMode,
  onPrintTeacherTranscript,
}) => {
  const { privacyMode, visibleRows, ownStanding, totalTeachersCount } = leaderboard;

  const renderPersonalCard = (standing: TeacherStandingRow) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            وضعیت و سطح رتبه‌بندی شخصی شما
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {standing.tier.titleFa}
          </h3>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
            {standing.teacherName} · {toPersianDigits(standing.totalApprovedHours)} ساعت ضمن خدمت مصوب ·{' '}
            {toPersianDigits(standing.completedCertificatesCount)} گواهینامه صادرشده
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="text-xs text-slate-500 dark:text-slate-400">امتیاز کل</div>
            <div className="text-2xl font-extrabold tabular-nums text-indigo-700 dark:text-indigo-300">
              {toPersianDigits(standing.points)}
            </div>
          </div>
          <PrintButtons
            compact
            documentLabel="کارنامه ضمن خدمت"
            onPrint={(size) => onPrintTeacherTranscript(standing.teacherId, size)}
          />
        </div>
      </div>

      {/* Progress toward next tier */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs tabular-nums">
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {standing.nextTier
              ? `مسیر ارتقا به ${standing.nextTier.titleFa}`
              : 'شما به بالاترین سطح رتبه‌بندی (سطح ۵ — استاد راهبر) دست یافته‌اید!'}
          </span>
          <span className="font-bold text-indigo-700 dark:text-indigo-300">
            {standing.nextTier
              ? `${toPersianDigits(standing.pointsToNextTier)} امتیاز تا سطح بعدی (${toPersianDigits(standing.tierProgressPercent)}٪)`
              : '۱۰۰٪'}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${standing.tierProgressPercent}%`,
              backgroundColor: standing.tier.colorHex,
            }}
          />
        </div>
      </div>

      {/* Transparent Points Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs tabular-nums">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2.5">
          <div className="text-slate-500 dark:text-slate-400">ساعات الزامی</div>
          <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            +{toPersianDigits(standing.breakdown.mandatoryHoursPoints)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2.5">
          <div className="text-slate-500 dark:text-slate-400">ساعات اختیاری</div>
          <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            +{toPersianDigits(standing.breakdown.optionalHoursPoints)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2.5">
          <div className="text-slate-500 dark:text-slate-400">کیفیت آزمون</div>
          <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            +{toPersianDigits(standing.breakdown.qualityScoreBonus)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2.5">
          <div className="text-slate-500 dark:text-slate-400">تکمیل به‌موقع</div>
          <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            +{toPersianDigits(standing.breakdown.onTimeBonus)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2.5">
          <div className="text-slate-500 dark:text-slate-400">مطالعه فعال</div>
          <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            +{toPersianDigits(standing.breakdown.activeStudyPoints)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 5-Tier Official Scale Reference */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              ساختار ۵ سطح رتبه‌بندی دانش‌افزایی معلمین
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              امتیازدهی شفاف: هر ساعت الزامی ۲۰ امتیاز · هر ساعت اختیاری ۱۴ امتیاز · پاداش نمره ۹۰٪ به بالا ۴۵ امتیاز · تکمیل به‌موقع ۳۰ امتیاز
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {TEACHER_RANK_TIERS.map((tier) => {
            const rangeText =
              tier.maxPoints !== null
                ? `${toPersianDigits(tier.minPoints)} تا ${toPersianDigits(tier.maxPoints)} امتیاز`
                : `${toPersianDigits(tier.minPoints)} امتیاز و بیشتر`;
            return (
              <div
                key={tier.level}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 flex flex-col justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tier.colorHex }}
                  />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                    {tier.titleFa}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 tabular-nums">
                  {rangeText}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Privacy Mode Controls — complex_admin & principal ONLY */}
      {canConfigurePrivacy && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              تنظیمات محرمانگی نمایش رتبه‌بندی برای معلمان این مدرسه
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label="حالت محرمانگی رتبه‌بندی">
            {(['private', 'top3_only', 'public'] as TeacherDevRankingPrivacyMode[]).map((mode) => {
              const selected = privacyMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChangePrivacyMode(mode)}
                  className={`text-right rounded-xl border p-3.5 transition-colors ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {PRIVACY_MODE_LABELS[mode].title}
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected
                          ? 'border-indigo-600 bg-indigo-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {PRIVACY_MODE_LABELS[mode].description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher Personal Standing Card (for teacher role) */}
      {!isManager && ownStanding && renderPersonalCard(ownStanding)}

      {/* Privacy Notice for Teacher in Private Mode */}
      {!isManager && privacyMode === 'private' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5 flex items-start gap-3">
          <EyeOff className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              حالت محرمانه رتبه‌بندی فعال است
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              بر اساس سیاست محرمانگی مدرسه، رتبه و امتیاز سایر همکاران نمایش داده نمی‌شود و شما صرفاً سطح، امتیاز و روند رشد حرفه‌ای شخصی خود را مشاهده می‌کنید.
            </p>
          </div>
        </div>
      )}

      {/* Top 3 Podium (for Teacher in top3_only mode) */}
      {!isManager && privacyMode === 'top3_only' && visibleRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>سکوی افتخار ۳ همکار برتر مدرسه</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visibleRows.map((row) => {
              const isMe = row.teacherId === currentTeacherId;
              return (
                <div
                  key={row.teacherId}
                  className={`rounded-xl border p-4 ${
                    isMe
                      ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                      <Medal className="w-4 h-4" />
                      رتبه {toPersianDigits(row.rank)}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                      {toPersianDigits(row.points)} امتیاز
                    </span>
                  </div>
                  <div className="mt-2 font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    {row.teacherName} {isMe ? '(شما)' : ''}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {row.tier.titleFa} · {toPersianDigits(row.totalApprovedHours)} ساعت مصوب
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Leaderboard Table (Managers ALWAYS see full table; Teachers see it ONLY in 'public' mode) */}
      {(isManager || privacyMode === 'public') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                جدول رتبه‌بندی ۵سطحی همکاران مدرسه ({toPersianDigits(totalTeachersCount)} معلم)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isManager
                  ? `وضعیت فعلی دید معلمان: ${PRIVACY_MODE_LABELS[privacyMode].title}`
                  : 'جدول عمومی رتبه‌بندی مدرسه بر اساس امتیاز کل و ساعات ضمن خدمت'}
              </p>
            </div>
            {!isManager && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                <span>فقط همکاران همین مدرسه</span>
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-bold text-center w-14">رتبه</th>
                  <th className="px-4 py-3 font-bold">نام همکار</th>
                  <th className="px-3 py-3 font-bold">سطح ۵گانه</th>
                  <th className="px-3 py-3 font-bold text-center">امتیاز کل</th>
                  <th className="px-3 py-3 font-bold text-center">ساعات مصوب</th>
                  <th className="px-3 py-3 font-bold text-center">الزامی</th>
                  <th className="px-3 py-3 font-bold text-center">میانگین آزمون</th>
                  {isManager && <th className="px-3 py-3 font-bold text-center">کارنامه ضمن خدمت</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleRows.map((row) => {
                  const isMe = row.teacherId === currentTeacherId;
                  return (
                    <tr
                      key={row.teacherId}
                      className={
                        isMe
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="px-4 py-3 text-center font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                        {toPersianDigits(row.rank)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {row.teacherName} {isMe ? '(شما)' : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {row.specialty}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100">
                          <Award
                            className="w-4 h-4 shrink-0"
                            style={{ color: row.tier.colorHex }}
                          />
                          <span>{row.tier.titleFa}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-extrabold tabular-nums text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(row.points)}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums font-bold text-slate-800 dark:text-slate-200">
                        {toPersianDigits(row.totalApprovedHours)} ساعت
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-700 dark:text-slate-300">
                        {toPersianDigits(row.mandatoryCompletedCount)} از{' '}
                        {toPersianDigits(row.mandatoryTotalCount)}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums font-bold text-slate-700 dark:text-slate-300">
                        {row.completedCertificatesCount > 0
                          ? `${toPersianDigits(row.avgQuizScorePercent)}٪`
                          : '—'}
                      </td>
                      {isManager && (
                        <td className="px-3 py-3 text-center">
                          <PrintButtons
                            compact
                            documentLabel={`کارنامه ${row.teacherName}`}
                            onPrint={(size) => onPrintTeacherTranscript(row.teacherId, size)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
