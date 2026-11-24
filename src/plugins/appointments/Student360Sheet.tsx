// Signature Phase 4 Component: Student 360° Summary Sheet («برگه خلاصه وضعیت ۳۶۰ درجه دانش‌آموز»)
// Aggregates live data across all modules with A4/A5 print support and single-column messenger copy.
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Film,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type { Student } from '../../types/domain';
import { buildStudent360Summary, formatStudent360Messenger } from './appointmentsHelpers';

interface Student360SheetProps {
  student: Student;
  appointmentInfo?: {
    jalaliDate: string;
    startTime: string;
    endTime: string;
    staffName: string;
    bookingTopic?: string;
    meetingOutcomeNotes?: string;
  };
  onClose?: () => void;
}

export const Student360Sheet: React.FC<Student360SheetProps> = ({
  student,
  appointmentInfo,
  onClose,
}) => {
  const {
    activeSchool,
    activeRole,
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
  } = useSchoolData();

  const [copied, setCopied] = useState(false);

  const summary = useMemo(
    () =>
      buildStudent360Summary({
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
      }),
    [
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
    ]
  );

  const handleCopyMessenger = async () => {
    const text = formatStudent360Messenger({
      schoolName: activeSchool.name,
      jalaliDate: appointmentInfo?.jalaliDate ?? getTodayJalali(),
      summary,
      meetingNotes: activeRole !== 'parent' ? appointmentInfo?.meetingOutcomeNotes : undefined,
    });
    await copyTextToClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const att = summary.attendance;
  const acad = summary.academics;
  const hwf = summary.homeworkAndFlipped;
  const dr = summary.disciplineAndRewards;

  return (
    <div className="space-y-4">
      {/* Toolbar (hidden on print) */}
      <div className="no-print bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              برگه خلاصه وضعیت ۳۶۰ درجه دانش‌آموز — {student.fullName}
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            تجمیع خودکار حضور و غیاب، دفتر نمره، آزمون آنلاین، تکالیف، کلاس وارونه و تشویق‌ها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMessenger}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 whitespace-nowrap min-h-[40px]"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'کپی شد (ایتا/بله/شاد)' : 'کپی خلاصه برای پیام‌رسان'}</span>
          </button>

          <PrintButtons documentLabel="برگه خلاصه ۳۶۰ درجه دانش‌آموز" />

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن برگه خلاصه ۳۶۰ درجه"
              className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 min-h-[40px] min-w-[40px]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Printable 360° Sheet */}
      <PrintShell
        school={activeSchool}
        documentTitle={`برگه خلاصه وضعیت ۳۶۰ درجه دانش‌آموز — ${student.fullName}`}
        subtitle={`کلاس ${summary.className} · ولی: ${student.parentName} · تاریخ: ${formatJalaliDisplay(
          appointmentInfo?.jalaliDate ?? getTodayJalali(),
          true
        )}`}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-5 print:border-0 print:p-0">
          {/* Student & Meeting Identity Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 text-xs sm:text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">نام دانش‌آموز: </span>
              <strong className="text-slate-900 dark:text-white">{student.fullName}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">کلاس: </span>
              <strong className="text-slate-900 dark:text-white">{summary.className}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">ولی محترم: </span>
              <strong className="text-slate-900 dark:text-white">{student.parentName}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">شماره تماس: </span>
              <strong className="text-slate-900 dark:text-white tabular-nums">
                {toPersianDigits(student.parentMobile)}
              </strong>
            </div>
            {appointmentInfo && (
              <>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">جلسه با: </span>
                  <strong className="text-indigo-700 dark:text-indigo-300">
                    {appointmentInfo.staffName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">زمان جلسه: </span>
                  <strong className="text-slate-900 dark:text-white tabular-nums">
                    {toPersianDigits(appointmentInfo.jalaliDate)} ·{' '}
                    {toPersianDigits(appointmentInfo.startTime)} تا{' '}
                    {toPersianDigits(appointmentInfo.endTime)}
                  </strong>
                </div>
                {appointmentInfo.bookingTopic && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">موضوع مطرح‌شده: </span>
                    <strong className="text-slate-900 dark:text-white">
                      {appointmentInfo.bookingTopic}
                    </strong>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 4-Domain Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Attendance */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>۱. حضور و غیاب (حضوری و کلاس آنلاین)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <div className="text-slate-500 dark:text-slate-400">حضوری (ثبت‌شده)</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                    حاضر: {toPersianDigits(att.physicalPresent)} · غیبت:{' '}
                    {toPersianDigits(att.physicalAbsent)} · تاخیر:{' '}
                    {toPersianDigits(att.physicalLate)} · موجه:{' '}
                    {toPersianDigits(att.physicalExcused)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <div className="text-slate-500 dark:text-slate-400">کلاس آنلاین</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                    حاضر: {toPersianDigits(att.onlinePresent)} · تاخیر:{' '}
                    {toPersianDigits(att.onlineLate)} · غیبت: {toPersianDigits(att.onlineAbsent)}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Academics & Online Exams */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>۲. وضعیت درسی، دفتر نمره و آزمون آنلاین</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 font-bold tabular-nums">
                  میانگین دفتر نمره:{' '}
                  {acad.overallGradeAverage !== null
                    ? `${toPersianDigits(acad.overallGradeAverage)} از ۲۰`
                    : 'ثبت نشده'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 font-bold tabular-nums">
                  آزمون آنلاین ({toPersianDigits(acad.onlineExamCount)}):{' '}
                  {acad.onlineExamAverage !== null
                    ? `${toPersianDigits(acad.onlineExamAverage)} از ۲۰`
                    : '—'}
                </span>
                {acad.totalTabSwitchFlags > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold tabular-nums">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    خروج از تب آزمون: {toPersianDigits(acad.totalTabSwitchFlags)} بار
                  </span>
                )}
              </div>
              {acad.subjectAverages.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {acad.subjectAverages.map((s) => (
                    <div key={s.subject} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {s.subject}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                        {s.average !== null ? `${toPersianDigits(s.average)} از ۲۰` : '—'}
                        {s.latestDescriptive ? ` · ${s.latestDescriptive}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Homework, Games & Flipped Classroom */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <Film className="w-4 h-4 text-violet-600 shrink-0" />
                <span>۳. تکالیف، بازی آموزشی و کلاس وارونه</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <div className="text-slate-500 dark:text-slate-400">نرخ تحویل تکالیف</div>
                  <div className="font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {toPersianDigits(hwf.homeworkCompletionPercent)}٪ (
                    {toPersianDigits(hwf.submittedHomeworkCount)} از{' '}
                    {toPersianDigits(hwf.assignedHomeworkCount)})
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <div className="text-slate-500 dark:text-slate-400">تماشای کلاس وارونه</div>
                  <div className="font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {hwf.avgFlippedWatchPercent !== null
                      ? `${toPersianDigits(hwf.avgFlippedWatchPercent)}٪`
                      : 'بدون سابقه'}
                    {hwf.fastWatchAlertsCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 mr-1">
                        (هشدار سرعت بالا: {toPersianDigits(hwf.fastWatchAlertsCount)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {hwf.averageGameScore !== null && (
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  میانگین امتیاز بازی‌های آموزشی ({toPersianDigits(hwf.gameSubmissionsCount)} نوبت):{' '}
                  <strong className="tabular-nums">{toPersianDigits(hwf.averageGameScore)} از ۱۰۰</strong>
                </div>
              )}

              {hwf.microQuizSummaries.length > 0 && (
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    نتایج مینی‌آزمون کلاس وارونه:
                  </div>
                  {hwf.microQuizSummaries.map((mq, i) => (
                    <div key={i} className="text-slate-600 dark:text-slate-300">
                      • {mq.lessonTitle}:{' '}
                      <strong className="tabular-nums">{toPersianDigits(mq.score20)} از ۲۰</strong> (
                      {mq.status})
                    </div>
                  ))}
                </div>
              )}

              {hwf.flippedQuestions.length > 0 && (
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    سوالات دقیقه‌ای ثبت‌شده در ویدیو ({toPersianDigits(hwf.flippedQuestions.length)}):
                  </div>
                  {hwf.flippedQuestions.slice(0, 3).map((q, idx) => (
                    <div key={idx} className="text-slate-600 dark:text-slate-300">
                      • [{toPersianDigits(Math.floor(q.second / 60))}:
                      {toPersianDigits(String(q.second % 60).padStart(2, '0'))}] {q.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Rewards, Certificates & Daily Logs */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                <span>۴. تشویق‌ها، لوح‌های تقدیر و نکات روزانه</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold tabular-nums">
                  {toPersianDigits(dr.rewardsCount)} مورد تشویق ({toPersianDigits(dr.totalStars)} امتیاز)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold tabular-nums">
                  {toPersianDigits(dr.certificatesCount)} لوح تقدیر
                </span>
              </div>

              {dr.recentRewards.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {dr.recentRewards.slice(0, 4).map((rw) => (
                    <li key={rw.id} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>
                        {rw.badgeTitle} ({toPersianDigits(rw.jalaliDate)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {dr.dailyLogNotes.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    یادداشت‌های دفتر روزانه:
                  </div>
                  {dr.dailyLogNotes.slice(0, 3).map((lg) => (
                    <div key={lg.id} className="text-slate-600 dark:text-slate-300">
                      • [{toPersianDigits(lg.jalaliDate)}] {lg.title}: {lg.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Smart 360 Signals Strip */}
          {hwf.recentSignals.length > 0 && (
            <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 space-y-1.5">
              <div className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4" />
                <span>سیگنال‌های هوشمند ثبت‌شده در پرونده ۳۶۰ درجه</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {hwf.recentSignals.slice(0, 4).map((sig) => (
                  <div
                    key={sig.id}
                    className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-700 dark:text-slate-200"
                  >
                    <strong>{sig.title}</strong>: {sig.summaryFa}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meeting Agreements / Blank Handwritten Lines for Print */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-4 space-y-2.5">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              خلاصه توافقات، توصیه‌ها و برنامه پیگیری جلسه اولیا و مربیان
            </div>
            {activeRole !== 'parent' && appointmentInfo?.meetingOutcomeNotes ? (
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {appointmentInfo.meetingOutcomeNotes}
              </p>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="border-b border-dashed border-slate-400 dark:border-slate-600 h-5" />
                <div className="border-b border-dashed border-slate-400 dark:border-slate-600 h-5" />
                <div className="border-b border-dashed border-slate-400 dark:border-slate-600 h-5" />
              </div>
            )}
          </div>
        </div>
      </PrintShell>
    </div>
  );
};
