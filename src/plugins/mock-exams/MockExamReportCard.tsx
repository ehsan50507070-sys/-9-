// Authentic Iranian Konkur Mock Exam Report Card («کارنامه جامع آزمون آزمایشی کنکوری»)
// Visible to Student, Parent (linkedStudentId only), and Management — Printable A4 & A5 via PrintIconButton.
import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useAppearance } from '../../core/appearance/AppearanceContext';
import { StudentAvatar } from '../../core/components/StudentAvatar';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { useToast } from '../../core/ui/ToastContext';
import type { MockExam, MockExamAttempt } from '../../types/domain';
import {
  SubjectComparisonSvgChart,
  TarazTrendSvgChart,
  TopicStrengthSvgBars,
  type TarazStagePoint,
} from './MockExamCharts';
import {
  formatMockReportCardForMessenger,
  getDifficultyLabelFa,
  getNegativeMarkingLabelFa,
  type StudentExamAnalytics,
} from './statsEngine';

interface MockExamReportCardProps {
  exam: MockExam;
  analytics: StudentExamAnalytics;
  attempt: MockExamAttempt;
  tarazHistory: TarazStagePoint[];
  canExport?: boolean;
  /** Render purely for batch printing (suppresses interactive tabs & toolbar buttons). */
  printBatchMode?: boolean;
}

export const MockExamReportCard: React.FC<MockExamReportCardProps> = ({
  exam,
  analytics,
  attempt,
  tarazHistory,
  canExport = true,
  printBatchMode = false,
}) => {
  const { activeSchoolDisplayName, schoolLogoUrl } = useAppearance();
  const { showToast } = useToast();
  const [subView, setSubView] = useState<'karnameh' | 'solutions'>('karnameh');
  const [copied, setCopied] = useState(false);

  const printSheetId = `mock-karnameh-${exam.id}-${analytics.studentId}`;

  const subjectNameById = useMemo(
    () => new Map(exam.subjects.map((s) => [s.id, s.subjectName])),
    [exam.subjects]
  );

  const handleCopyMessenger = async () => {
    const text = formatMockReportCardForMessenger(
      analytics,
      exam,
      analytics.schoolName || activeSchoolDisplayName
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('متن خلاصه کارنامه (مناسب ایتا، بله و شاد) کپی شد.', 'success');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      showToast('دسترسی به حافظه کلیپ‌بورد در این مرورگر محدود است.', 'info');
    }
  };

  const handleDownloadStudentCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = [
      'نام درس',
      'ضریب',
      'کل سوال',
      'درست',
      'غلط',
      'نزده',
      'درصد',
      'چند از ۱۰',
      'همتراز',
      'تراز درس',
      'میانگین',
      'بالاترین درصد',
      'رتبه در درس',
    ];
    const rows = analytics.subjectMetrics.map((sm) => [
      sm.subjectName,
      toPersianDigits(sm.coefficient),
      toPersianDigits(sm.totalQuestions),
      toPersianDigits(sm.correct),
      toPersianDigits(sm.wrong),
      toPersianDigits(sm.blank),
      toPersianDigits(sm.percentage),
      toPersianDigits(sm.outOfTen),
      toPersianDigits(sm.peerOutOfTen),
      toPersianDigits(sm.taraz),
      toPersianDigits(sm.cohortAvgPct),
      toPersianDigits(sm.highestPct),
      toPersianDigits(sm.subjectRank),
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karnameh-${analytics.studentName.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('فایل اکسل فارسی (CSV) کارنامه دانلود شد.', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Interactive Toolbar (hidden in batch print) */}
      {!printBatchMode && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div
            role="tablist"
            aria-label="بخش‌های کارنامه آزمون آزمایشی"
            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'karnameh'}
              onClick={() => setSubView('karnameh')}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                subView === 'karnameh'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              کارنامه و نمودار تراز
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'solutions'}
              onClick={() => setSubView('solutions')}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                subView === 'solutions'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpenCheck className="w-3.5 h-3.5" />
              کلید و پاسخنامه تشریحی ({toPersianDigits(exam.questions.length)})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyMessenger()}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'کپی شد' : 'کپی برای ایتا / بله / شاد'}</span>
            </button>

            {canExport && (
              <button
                type="button"
                onClick={handleDownloadStudentCsv}
                title="خروجی اکسل فارسی (CSV)"
                aria-label="خروجی اکسل فارسی کارنامه"
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">اکسل فارسی</span>
              </button>
            )}

            {canExport && (
              <PrintIconButton
                documentLabel={`کارنامه آزمون آزمایشی ${analytics.studentName}`}
                targetSelector={`#${printSheetId}`}
                includeHeader={false}
                includeFooter={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Karnameh Sheet (Printable A4 / A5) */}
      {(subView === 'karnameh' || printBatchMode) && (
        <article
          id={printSheetId}
          data-testid="mock-exam-karnameh-sheet"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-6"
          style={printBatchMode ? { pageBreakAfter: 'always' } : undefined}
        >
          {/* Official School & Student Karnameh Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <StudentAvatar
                studentId={analytics.studentId}
                studentName={analytics.studentName}
                size="lg"
              />
              <div className="min-w-0 space-y-1">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {analytics.schoolName || activeSchoolDisplayName} · {exam.stageLabelFa} ·{' '}
                  <span className="tabular-nums">{toPersianDigits(exam.examDateJalali)}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                  {analytics.studentName}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <span>{analytics.className}</span>
                  <span aria-hidden="true">·</span>
                  <span>{exam.title}</span>
                  <span aria-hidden="true">·</span>
                  <span>{getNegativeMarkingLabelFa(exam.negativeMarking)}</span>
                </div>
              </div>
            </div>

            {schoolLogoUrl && (
              <img
                src={schoolLogoUrl}
                alt={activeSchoolDisplayName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
              />
            )}
          </div>

          {/* 4 Golden KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: Total Taraz + Delta */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">تراز کل علمی</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {toPersianDigits(analytics.totalTaraz)}
                </span>
                {analytics.tarazDeltaFromPrev !== null && (
                  <span
                    className={`inline-flex items-center text-xs font-bold tabular-nums ${
                      analytics.tarazDeltaFromPrev >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {analytics.tarazDeltaFromPrev >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {analytics.tarazDeltaFromPrev >= 0 ? '+' : ''}
                    {toPersianDigits(analytics.tarazDeltaFromPrev)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                نسبت به آزمون مرحله قبل
              </div>
            </div>

            {/* KPI 2: Class / School / Complex Rank */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                رتبه در مدرسه و کلاس
              </div>
              <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {toPersianDigits(analytics.schoolRank)}{' '}
                <span className="text-xs font-medium text-slate-500">
                  از {toPersianDigits(analytics.schoolTotal)}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                رتبه کلاس: {toPersianDigits(analytics.classRank)} از {toPersianDigits(analytics.classTotal)}
                {analytics.complexRank !== null && analytics.complexTotal !== null && (
                  <>
                    {' '}· کل مجموعه: <strong>{toPersianDigits(analytics.complexRank)}</strong> از{' '}
                    {toPersianDigits(analytics.complexTotal)}
                  </>
                )}
              </div>
            </div>

            {/* KPI 3: Weighted Avg Percentage */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                میانگین درصد وزنی
              </div>
              <div
                className={`text-2xl font-extrabold tabular-nums ${
                  analytics.averagePercentage >= 60
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : analytics.averagePercentage >= 35
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {toPersianDigits(analytics.averagePercentage)}٪
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                با احتساب ضرایب دروس
              </div>
            </div>

            {/* KPI 4: Total Correct / Wrong / Blank */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                توزیع پاسخ‌های کل ({toPersianDigits(analytics.totalQuestions)} سوال)
              </div>
              <div className="flex items-center gap-2.5 text-sm font-extrabold tabular-nums pt-0.5">
                <span className="text-emerald-700 dark:text-emerald-400">
                  {toPersianDigits(analytics.totalCorrect)} درست
                </span>
                <span className="text-rose-700 dark:text-rose-400">
                  {toPersianDigits(analytics.totalWrong)} غلط
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {toPersianDigits(analytics.totalBlank)} نزده
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                شیوه ثبت: {analytics.entryMethod === 'online' ? 'آزمون آنلاین' : 'پاسخبرگ حضوری'}
              </div>
            </div>
          </div>

          {/* Complete 12-Column Subject Performance Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              جدول جامع نمرات، تراز و شاخص «چند از ۱۰» به تفکیک هر درس
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">نام درس</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">ضریب</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">کل</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">درست</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">غلط</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">نزده</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">درصد</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">چند از ۱۰ (همتراز)</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">تراز درس</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">میانگین</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">بالاترین</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">رتبه درس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {analytics.subjectMetrics.map((sm) => {
                    const outDiff = sm.outOfTen - sm.peerOutOfTen;
                    return (
                      <tr
                        key={sm.subjectId}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {sm.subjectName}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-400">
                          {toPersianDigits(sm.coefficient)}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-400">
                          {toPersianDigits(sm.totalQuestions)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold text-emerald-700 dark:text-emerald-400">
                          {toPersianDigits(sm.correct)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold text-rose-700 dark:text-rose-400">
                          {toPersianDigits(sm.wrong)}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500">
                          {toPersianDigits(sm.blank)}
                        </td>
                        <td
                          dir="ltr"
                          className={`py-2.5 px-2.5 text-center font-extrabold ${
                            sm.percentage < 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : sm.percentage >= 65
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {toPersianDigits(sm.percentage)}٪
                        </td>
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {toPersianDigits(sm.outOfTen)} از ۱۰
                          </span>
                          <span
                            className={`mr-1.5 text-[11px] font-semibold ${
                              outDiff > 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : outDiff < 0
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-slate-500'
                            }`}
                          >
                            (همتراز: {toPersianDigits(sm.peerOutOfTen)})
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-extrabold text-indigo-700 dark:text-indigo-300">
                          {toPersianDigits(sm.taraz)}
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-slate-600 dark:text-slate-400">
                          {toPersianDigits(sm.cohortAvgPct)}٪
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-slate-600 dark:text-slate-400">
                          {toPersianDigits(sm.highestPct)}٪
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                          {toPersianDigits(sm.subjectRank)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dual SVG Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 pt-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <SubjectComparisonSvgChart subjects={analytics.subjectMetrics} />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <TarazTrendSvgChart points={tarazHistory} />
            </div>
          </div>

          {/* Topic Strength & Weakness Map */}
          <div className="pt-2">
            <TopicStrengthSvgBars topics={analytics.topicAnalysis} />
          </div>
        </article>
      )}

      {/* Personalized Answer Key & Explanatory Solutions Review */}
      {!printBatchMode && subView === 'solutions' && (
        <section
          aria-label="کلید و پاسخنامه تشریحی شخصی‌سازی‌شده"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                کلید و پاسخنامه تشریحی شخصی‌سازی‌شده — {analytics.studentName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مقایسه پاسخ ثبت‌شده شما با کلید صحیح، مبحث، سطح دشواری و تحلیل تشریحی هر سوال
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {exam.questions
              .slice()
              .sort((a, b) => a.questionNumber - b.questionNumber)
              .map((q) => {
                const chosen = attempt.answers[q.questionNumber] ?? null;
                const isCorrect = chosen === q.correctOption;
                const isBlank = chosen === null;
                const subjName = subjectNameById.get(q.subjectId) ?? 'درس';

                return (
                  <div
                    key={q.questionNumber}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                          سوال {toPersianDigits(q.questionNumber)}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {subjName}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{q.topic}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          دشواری: {getDifficultyLabelFa(q.difficulty)}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 font-bold">
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            پاسخ صحیح (گزینه {toPersianDigits(q.correctOption)})
                          </span>
                        ) : isBlank ? (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <MinusCircle className="w-4 h-4" />
                            نزده · کلید صحیح: گزینه {toPersianDigits(q.correctOption)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                            <XCircle className="w-4 h-4" />
                            پاسخ شما: گزینه {toPersianDigits(chosen)} · کلید صحیح: گزینه{' '}
                            {toPersianDigits(q.correctOption)}
                          </span>
                        )}
                      </div>
                    </div>

                    {q.questionText && (
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-6">
                        {q.questionText}
                      </p>
                    )}

                    {q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {q.options.map((optText, idx) => {
                          const optNum = (idx + 1) as 1 | 2 | 3 | 4;
                          const isKey = optNum === q.correctOption;
                          const isWrongChosen = chosen === optNum && !isKey;
                          return (
                            <div
                              key={optNum}
                              className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${
                                isKey
                                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold'
                                  : isWrongChosen
                                    ? 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="font-bold tabular-nums">{toPersianDigits(optNum)})</span>
                              <span>{optText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.solutionText && (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 p-3 text-xs leading-6 text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-white">پاسخ تشریحی: </span>
                        {q.solutionText}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
};
