// Participation Matrix Tab (complex_admin, principal, deputy) — 5-status cells, Messenger reminders, CSV & A4/A5 Print
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileSpreadsheet,
  MinusCircle,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import { PrintButtons, PrintIconButton } from '../../core/print/PrintButtons';
import type { PrintPaperSize } from '../../core/print/printService';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  Teacher,
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevProgress,
} from '../../types/domain';
import {
  REQUIREMENT_LABELS,
  buildParticipationMatrixCsv,
  buildSchoolMatrixSummaryMessage,
  buildTeacherReminderMessage,
  computeParticipationMatrix,
  type MatrixCellData,
  type ParticipationMatrixResult,
} from './teacherDevHelpers';

interface ParticipationMatrixTabProps {
  schoolId: string;
  schoolName: string;
  teachers: Teacher[];
  courses: TeacherDevCourse[];
  progressList: TeacherDevProgress[];
  certificates: TeacherDevCertificate[];
  onPrintMatrix: (matrix: ParticipationMatrixResult, filterLabel: string, size: PrintPaperSize) => void;
  onPrintCertificate: (cert: TeacherDevCertificate, size: PrintPaperSize) => void;
  onPrintTeacherTranscript: (teacherId: string, size: PrintPaperSize) => void;
  onNotify: (msg: string, tone?: 'success' | 'info' | 'error') => void;
}

const FILTER_LABELS: Record<'all' | 'mandatory' | 'optional', string> = {
  all: 'همه دوره‌ها و کتاب‌ها',
  mandatory: 'فقط دوره‌های الزامی',
  optional: 'فقط دوره‌های اختیاری',
};

export const ParticipationMatrixTab: React.FC<ParticipationMatrixTabProps> = ({
  schoolId,
  schoolName,
  teachers,
  courses,
  progressList,
  certificates,
  onPrintMatrix,
  onPrintCertificate,
  onPrintTeacherTranscript,
  onNotify,
}) => {
  const [reqFilter, setReqFilter] = useState<'all' | 'mandatory' | 'optional'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const todayJalali = useMemo(() => getTodayJalali(), []);

  const matrix = useMemo(
    () =>
      computeParticipationMatrix({
        schoolId,
        teachers,
        courses,
        progressList,
        certificates,
        todayJalali,
        requirementFilter: reqFilter,
      }),
    [schoolId, teachers, courses, progressList, certificates, todayJalali, reqFilter]
  );

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return matrix.rows;
    return matrix.rows.filter(
      (r) =>
        r.teacher.fullName.includes(q) ||
        r.teacher.specialty.includes(q) ||
        r.teacher.personnelCode.includes(q)
    );
  }, [matrix.rows, searchQuery]);

  const overdueCount = useMemo(
    () =>
      matrix.rows.reduce(
        (sum, r) => sum + r.cells.filter((c) => c.status === 'overdue').length,
        0
      ),
    [matrix.rows]
  );

  const handleCopySummary = async () => {
    const text = buildSchoolMatrixSummaryMessage({
      schoolName,
      matrix,
      todayJalali,
    });
    const ok = await copyTextToClipboard(text);
    onNotify(
      ok
        ? 'خلاصه وضعیت دانش‌افزایی مدرسه (تک‌ستونه ویژه ایتا، بله و شاد) کپی شد.'
        : 'کپی به حافظه موقت ناموفق بود.',
      ok ? 'success' : 'error'
    );
  };

  const handleCopyTeacherReminder = async (
    teacherName: string,
    pendingMandatoryCourses: TeacherDevCourse[]
  ) => {
    const text = buildTeacherReminderMessage({
      schoolName,
      teacherName,
      pendingMandatoryCourses,
      todayJalali,
    });
    const ok = await copyTextToClipboard(text);
    onNotify(
      ok
        ? `پیام یادآوری برای «${teacherName}» با فرمت استاندارد ایتا، بله و شاد کپی شد.`
        : 'کپی پیام یادآوری ناموفق بود.',
      ok ? 'success' : 'error'
    );
  };

  const handleExportCsv = () => {
    const csv = buildParticipationMatrixCsv(matrix);
    downloadTextFile(
      `teacher-dev-matrix-${schoolId}-${todayJalali.replace(/\//g, '-')}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    onNotify('فایل اکسل فارسی (CSV UTF-8 BOM) ماتریس مشارکت دانلود شد.');
  };

  const renderCell = (cell: MatrixCellData) => {
    if (cell.status === 'completed') {
      return (
        <div className="inline-flex flex-col items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1.5 text-emerald-800 dark:text-emerald-300">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>تکمیل و گواهی</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] tabular-nums">
            <span>نمره {toPersianDigits(cell.scorePercent ?? 100)}٪</span>
            {cell.certificate && (
              <PrintIconButton
                compact
                documentLabel="گواهینامه پایان دوره"
                onPrint={(size) => onPrintCertificate(cell.certificate!, size)}
                className="!h-7 !w-7 !rounded-lg"
              />
            )}
          </div>
        </div>
      );
    }

    if (cell.status === 'in_progress') {
      return (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 dark:text-sky-300 whitespace-nowrap tabular-nums">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{cell.labelFa}</span>
        </div>
      );
    }

    if (cell.status === 'quiz_failed') {
      return (
        <div className="inline-flex flex-col items-center gap-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 px-2.5 py-1.5 text-amber-800 dark:text-amber-300">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>آزمون ناموفق</span>
          </div>
          <span className="text-[10px] tabular-nums">
            {toPersianDigits(cell.attemptsUsed)} تلاش · بهترین {toPersianDigits(cell.scorePercent ?? 0)}٪
          </span>
        </div>
      );
    }

    if (cell.status === 'overdue') {
      return (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 px-2.5 py-1.5 text-[11px] font-bold text-rose-800 dark:text-rose-300 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>تأخیر در مهلت</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
        <MinusCircle className="w-3.5 h-3.5 shrink-0" />
        <span>شروع‌نشده</span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            نرخ تکمیل کل مدرسه
          </div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(matrix.overallCompletionRatePercent)}٪
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            مجموع ساعات ضمن خدمت کسب‌شده
          </div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(matrix.totalSchoolApprovedHours)}{' '}
            <span className="text-xs font-medium">ساعت</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            تعداد معلمان فعال
          </div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {toPersianDigits(matrix.rows.length)} <span className="text-xs font-medium">نفر</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            موارد تأخیر در مهلت الزامی
          </div>
          <div
            className={`mt-1.5 text-2xl font-extrabold tabular-nums ${
              overdueCount > 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {toPersianDigits(overdueCount)} <span className="text-xs font-medium">مورد</span>
          </div>
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'mandatory', 'optional'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setReqFilter(key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                reqFilter === key
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام معلم..."
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 w-44 sm:w-52"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>کپی خلاصه ایتا / بله / شاد</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>اکسل فارسی CSV</span>
          </button>
          <PrintButtons
            landscape
            compact
            documentLabel="ماتریس مشارکت"
            onPrint={(size) => onPrintMatrix(matrix, FILTER_LABELS[reqFilter], size)}
          />
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {matrix.courses.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            هیچ دوره فعالی در این فیلتر یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-bold min-w-[170px] sticky right-0 bg-slate-50 dark:bg-slate-950 z-10">
                    نام همکار و تخصص
                  </th>
                  {matrix.courses.map((course) => (
                    <th key={course.id} className="px-3 py-3 font-bold text-center min-w-[155px]">
                      <div className="text-slate-900 dark:text-slate-100 line-clamp-2">
                        {course.title}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {REQUIREMENT_LABELS[course.requirement]} ·{' '}
                        {toPersianDigits(course.inServiceHours)} ساعت · مهلت{' '}
                        {toPersianDigits(course.deadlineJalali)}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-bold text-center min-w-[105px]">تکمیل / ساعت</th>
                  <th className="px-3 py-3 font-bold text-center min-w-[155px]">اقدامات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleRows.map((row) => (
                  <tr
                    key={row.teacher.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 sticky right-0 bg-white dark:bg-slate-900 z-10">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {row.teacher.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {row.teacher.specialty}
                      </div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.courseId} className="px-2.5 py-3 text-center">
                        {renderCell(cell)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center tabular-nums">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">
                        {toPersianDigits(row.completedCount)} از{' '}
                        {toPersianDigits(matrix.courses.length)}
                      </div>
                      <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium mt-0.5">
                        {toPersianDigits(row.totalApprovedHours)} ساعت مصوب
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyTeacherReminder(
                              row.teacher.fullName,
                              row.pendingMandatoryCourses
                            )
                          }
                          title="کپی پیام یادآوری دوره برای ایتا / بله / شاد"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                        >
                          <Copy className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          <span>یادآوری</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintTeacherTranscript(row.teacher.id, 'a4')}
                          title="چاپ کارنامه جامع ضمن خدمت همکار"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                        >
                          <Printer className="w-3 h-3" />
                          <span>کارنامه</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">
                <tr>
                  <td className="px-4 py-3 sticky right-0 bg-slate-50 dark:bg-slate-950 z-10">
                    خلاصه تکمیل هر دوره
                  </td>
                  {matrix.courseSummaries.map((s) => (
                    <td key={s.courseId} className="px-3 py-3 text-center tabular-nums">
                      <div>
                        {toPersianDigits(s.completedCount)} از {toPersianDigits(s.totalTeachers)}
                      </div>
                      <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        ({toPersianDigits(s.completionRatePercent)}٪)
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center tabular-nums">
                    {toPersianDigits(matrix.overallCompletionRatePercent)}٪
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
                    کل {toPersianDigits(matrix.totalSchoolApprovedHours)} ساعت
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
