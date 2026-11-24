// Modular Batch Admission Cards & Official Exam Forms (A4 4-up, A5 2-up, A5 1-up, Attendance Sheet, Envelope Protocol)
import React from 'react';
import { Printer, User } from 'lucide-react';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { triggerPrint } from '../../core/print/printService';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  ClassRoom,
  ExamSeatingChart,
  InPersonExamHall,
  InPersonExamSession,
  School,
  Student,
  StudentElectronicProfile,
  Teacher,
} from '../../types/domain';
import { chunkArray } from './examsManagementHelpers';

export type AdmissionCardLayoutMode = 'a4-4up' | 'a5-2up' | 'a5-1up';
export type ExamPrintSubView = 'cards' | 'hall_attendance' | 'envelope_protocol';

interface ExamAdmissionCardsPrintProps {
  school: School;
  students: Student[];
  classes: ClassRoom[];
  halls: InPersonExamHall[];
  teachers: Teacher[];
  sessions: InPersonExamSession[];
  seatingCharts: ExamSeatingChart[];
  studentProfiles: StudentElectronicProfile[];
  layoutMode: AdmissionCardLayoutMode;
  onLayoutModeChange: (mode: AdmissionCardLayoutMode) => void;
  printSubView: ExamPrintSubView;
  onPrintSubViewChange: (view: ExamPrintSubView) => void;
  selectedHallId: string;
  selectedSessionId: string;
  compactSingleStudentMode?: boolean;
}

export const ExamAdmissionCardsPrint: React.FC<ExamAdmissionCardsPrintProps> = ({
  school,
  students,
  classes,
  halls,
  teachers,
  sessions,
  seatingCharts,
  studentProfiles,
  layoutMode,
  onLayoutModeChange,
  printSubView,
  onPrintSubViewChange,
  selectedHallId,
  selectedSessionId,
  compactSingleStudentMode = false,
}) => {
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const hallMap = new Map(halls.map((h) => [h.id, h]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const profileMap = new Map(studentProfiles.map((p) => [p.studentId, p]));

  const findStudentSeatInfo = (studentId: string) => {
    for (const chart of seatingCharts) {
      if (selectedHallId !== 'all' && chart.hallId !== selectedHallId) continue;
      const found = chart.assignments.find((a) => a.studentId === studentId);
      if (found) {
        return {
          seatNumber: found.seatNumber,
          hallName: hallMap.get(chart.hallId)?.name ?? 'حوزه امتحانی',
          chartTitle: chart.title,
        };
      }
    }
    for (const chart of seatingCharts) {
      const found = chart.assignments.find((a) => a.studentId === studentId);
      if (found) {
        return {
          seatNumber: found.seatNumber,
          hallName: hallMap.get(chart.hallId)?.name ?? 'حوزه امتحانی',
          chartTitle: chart.title,
        };
      }
    }
    return null;
  };

  const handlePrintBatchCards = () => {
    triggerPrint({
      size: layoutMode === 'a4-4up' ? 'a4' : 'a5',
      orientation: 'portrait',
    });
  };

  const cardsPerPage = layoutMode === 'a4-4up' ? 4 : layoutMode === 'a5-2up' ? 2 : 1;
  const studentPages = chunkArray(students, cardsPerPage);
  const sheetGridClass =
    layoutMode === 'a4-4up'
      ? 'admission-sheet-a4-4up'
      : layoutMode === 'a5-2up'
        ? 'admission-sheet-a5-2up'
        : 'admission-sheet-a5-1up';

  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) ?? sessions[0] ?? null;
  const activeHall =
    (selectedHallId !== 'all' ? hallMap.get(selectedHallId) : undefined) ??
    (activeSession ? hallMap.get(activeSession.hallId) : undefined) ??
    halls[0] ??
    null;

  const hallChart =
    seatingCharts.find((c) => activeHall && c.hallId === activeHall.id) ?? seatingCharts[0] ?? null;
  const seatedRoster = (hallChart?.assignments ?? [])
    .filter((a) => a.studentId !== null)
    .sort((a, b) => a.seatNumber - b.seatNumber);

  return (
    <div className="space-y-4">
      {/* Sub-view Switcher & Print Controls */}
      {!compactSingleStudentMode && (
        <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onPrintSubViewChange('cards')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  printSubView === 'cards'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                کارت ورود به جلسه ({toPersianDigits(students.length)})
              </button>
              <button
                type="button"
                onClick={() => onPrintSubViewChange('hall_attendance')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  printSubView === 'hall_attendance'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                لیست حضور و غیاب حوزه امتحانی
              </button>
              <button
                type="button"
                onClick={() => onPrintSubViewChange('envelope_protocol')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  printSubView === 'envelope_protocol'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                برچسب روی پاکت و صورتجلسه آزمون
              </button>
            </div>

            {printSubView === 'cards' ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="چیدمان چاپ کارت ورود به جلسه"
                  value={layoutMode}
                  onChange={(e) => onLayoutModeChange(e.target.value as AdmissionCardLayoutMode)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                >
                  <option value="a4-4up">چاپ گروهی A4 (۴ کارت در هر برگ با خط برش)</option>
                  <option value="a5-2up">چاپ گروهی A5 (۲ کارت در هر برگ با خط برش)</option>
                  <option value="a5-1up">چاپ تکی A5 (۱ کارت بزرگ در هر برگ)</option>
                </select>
                <button
                  type="button"
                  disabled={students.length === 0}
                  onClick={handlePrintBatchCards}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>چاپ کارت‌ها ({layoutMode === 'a4-4up' ? 'A4' : 'A5'})</span>
                </button>
              </div>
            ) : (
              <PrintButtons
                documentLabel={
                  printSubView === 'hall_attendance'
                    ? 'لیست حضور و غیاب حوزه امتحانی'
                    : 'برچسب روی پاکت و صورتجلسه آزمون'
                }
              />
            )}
          </div>
        </div>
      )}

      {/* 1. BATCH / SINGLE ADMISSION CARDS */}
      {printSubView === 'cards' && (
        <div className="space-y-4">
          {students.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              دانش‌آموزی برای صدور کارت ورود به جلسه با این فیلتر یافت نشد.
            </div>
          ) : (
            studentPages.map((pageStudents, pageIdx) => (
              <div
                key={`card-page-${pageIdx}`}
                className={`admission-page-break ${sheetGridClass}`}
              >
                {pageStudents.map((st) => {
                  const cls = classMap.get(st.classId);
                  const prof = profileMap.get(st.id);
                  const seatInfo = findStudentSeatInfo(st.id);
                  const studentExams = sessions.filter((s) => s.classIds.includes(st.classId));
                  const fatherName = prof?.fatherName || st.parentName.split(' ')[0] || '—';

                  return (
                    <article
                      key={st.id}
                      className="admission-card-box rounded-2xl border-2 border-dashed border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 print:rounded-none"
                    >
                      <div className="admission-cut-hint text-[10px] text-slate-400 text-center mb-1">
                        ✂ محل برش کارت ورود به جلسه
                      </div>
                      <div className="admission-card-inner rounded-xl border-2 border-slate-800 dark:border-slate-500 p-3 space-y-2.5">
                        {/* Card School Header */}
                        <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-300 dark:border-slate-700">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {school.letterheadTitle || school.name}
                            </div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">
                              کارت ورود به جلسه امتحانات
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              سال تحصیلی {toPersianDigits(school.academicYear)}
                            </div>
                          </div>
                          {/* Photo / Avatar Box */}
                          <div className="w-14 h-16 rounded-lg border border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 shrink-0">
                            <User className="w-6 h-6" />
                            <span className="text-[9px] font-bold mt-0.5">محل عکس</span>
                          </div>
                        </div>

                        {/* Identity & Bold Seat Number */}
                        <div className="grid grid-cols-12 gap-2 items-center text-[11px]">
                          <div className="col-span-8 space-y-1">
                            <div>
                              <span className="text-slate-500">نام و نام خانوادگی: </span>
                              <span className="font-extrabold text-slate-900 dark:text-white">
                                {st.fullName}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">نام پدر: </span>
                              <span className="font-bold">{fatherName}</span>
                              <span className="mx-1.5 text-slate-300">|</span>
                              <span className="text-slate-500">کد ملی: </span>
                              <span className="font-mono font-bold tabular-nums">
                                {toPersianDigits(st.nationalId)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">پایه / کلاس: </span>
                              <span className="font-bold">{cls?.name ?? '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">حوزه امتحانی: </span>
                              <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                {seatInfo?.hallName ?? activeHall?.name ?? 'تعیین نشده'}
                              </span>
                            </div>
                          </div>

                          <div className="col-span-4 rounded-xl border-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 text-center">
                            <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                              شماره صندلی
                            </div>
                            <div className="text-xl font-black text-indigo-900 dark:text-white tabular-nums mt-0.5">
                              {seatInfo ? toPersianDigits(seatInfo.seatNumber) : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Mini Exam Schedule Table */}
                        {studentExams.length > 0 && (
                          <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                            <table className="w-full text-right text-[10px]">
                              <thead className="bg-slate-100 dark:bg-slate-800">
                                <tr>
                                  <th className="px-2 py-1 font-bold">درس</th>
                                  <th className="px-2 py-1 font-bold">تاریخ</th>
                                  <th className="px-2 py-1 font-bold">ساعت</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {studentExams.slice(0, 4).map((ex) => (
                                  <tr key={ex.id}>
                                    <td className="px-2 py-1 font-bold">{ex.subject}</td>
                                    <td className="px-2 py-1 tabular-nums">
                                      {toPersianDigits(ex.jalaliDate)}
                                    </td>
                                    <td className="px-2 py-1 tabular-nums">
                                      {toPersianDigits(ex.startTime)} تا {toPersianDigits(ex.endTime)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Principal Stamp & Signature Footer */}
                        <div className="flex items-end justify-between pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300">
                          <span>حضور ۱۵ دقیقه قبل از امتحان الزامی است.</span>
                          <div className="text-center">
                            <div className="font-bold">مهر و امضای مدیر مدرسه</div>
                            <div className="mt-3 text-[9px] text-slate-400">
                              {school.principalName}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. OFFICIAL HALL ATTENDANCE SHEET */}
      {printSubView === 'hall_attendance' && (
        <PrintShell
          school={school}
          documentTitle={`لیست رسمی حضور و غیاب حوزه امتحانی — ${activeHall?.name ?? 'حوزه امتحانی'}`}
          subtitle={
            activeSession
              ? `درس: ${activeSession.subject} · تاریخ: ${toPersianDigits(activeSession.jalaliDate)} · ساعت ${toPersianDigits(activeSession.startTime)} تا ${toPersianDigits(activeSession.endTime)}`
              : `تاریخ چاپ: ${toPersianDigits(getTodayJalali())}`
          }
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden print:border-0 print:rounded-none">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2.5 font-bold w-16">شماره صندلی</th>
                  <th className="px-3 py-2.5 font-bold">نام و نام خانوادگی دانش‌آموز</th>
                  <th className="px-3 py-2.5 font-bold">کد ملی</th>
                  <th className="px-3 py-2.5 font-bold">کلاس</th>
                  <th className="px-3 py-2.5 font-bold text-center w-20">حاضر</th>
                  <th className="px-3 py-2.5 font-bold text-center w-20">غایب</th>
                  <th className="px-3 py-2.5 font-bold w-36">امضای دانش‌آموز / تحویل برگه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {seatedRoster.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      هنوز چیدمان صندلی برای این حوزه ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  seatedRoster.map((seat) => {
                    const st = students.find((s) => s.id === seat.studentId);
                    const cls = seat.classId ? classMap.get(seat.classId) : undefined;
                    return (
                      <tr key={seat.seatNumber}>
                        <td className="px-3 py-2 font-black text-center tabular-nums">
                          {toPersianDigits(seat.seatNumber)}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                          {st?.fullName ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums">
                          {toPersianDigits(st?.nationalId ?? '—')}
                        </td>
                        <td className="px-3 py-2">{cls?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="print-checkbox" aria-label="حاضر" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="print-checkbox" aria-label="غایب" />
                        </td>
                        <td className="px-3 py-2" />
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="print-signature-grid p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-center">
              <div>
                <div className="font-bold">
                  نام و امضای مراقب حوزه ({activeSession ? teacherMap.get(activeSession.proctorTeacherId)?.fullName ?? '—' : '—'})
                </div>
                <div className="print-sig-space mt-8 border-b border-dashed border-slate-400 mx-6" />
              </div>
              <div>
                <div className="font-bold">تعداد کل: {toPersianDigits(seatedRoster.length)} | حاضر: ........ | غایب: ........</div>
                <div className="print-sig-space mt-8 border-b border-dashed border-slate-400 mx-6" />
              </div>
              <div>
                <div className="font-bold">تایید مدیر حوزه ({school.principalName})</div>
                <div className="print-sig-space mt-8 border-b border-dashed border-slate-400 mx-6" />
              </div>
            </div>
          </div>
        </PrintShell>
      )}

      {/* 3. ENVELOPE LABEL & EXAM PROTOCOL */}
      {printSubView === 'envelope_protocol' && (
        <PrintShell
          school={school}
          documentTitle="برچسب روی پاکت سوالات و صورتجلسه برگزاری آزمون حضوری"
          subtitle={`تاریخ چاپ: ${toPersianDigits(getTodayJalali())}`}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-800 dark:border-slate-600 p-5 space-y-5 print:rounded-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-3 space-y-1.5">
                <div>
                  <span className="text-slate-500">عنوان نوبت آزمون: </span>
                  <span className="font-extrabold">{activeSession?.termTitle ?? 'امتحانات حضوری'}</span>
                </div>
                <div>
                  <span className="text-slate-500">نام درس: </span>
                  <span className="font-extrabold text-sm">{activeSession?.subject ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">تاریخ و ساعت برگزاری: </span>
                  <span className="font-bold tabular-nums">
                    {activeSession
                      ? `${toPersianDigits(activeSession.jalaliDate)} · ساعت ${toPersianDigits(activeSession.startTime)} تا ${toPersianDigits(activeSession.endTime)}`
                      : '—'}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-3 space-y-1.5">
                <div>
                  <span className="text-slate-500">حوزه / سالن امتحانی: </span>
                  <span className="font-extrabold">{activeHall?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">مراقب مسئول حوزه: </span>
                  <span className="font-bold">
                    {activeSession ? teacherMap.get(activeSession.proctorTeacherId)?.fullName ?? '—' : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">تعداد کل ثبت‌نام‌شده حوزه: </span>
                  <span className="font-black text-sm tabular-nums">
                    {toPersianDigits(seatedRoster.length || students.length)} نفر
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-xl border border-slate-400 p-3">
                <div className="font-bold text-slate-600">تعداد کل دانش‌آموزان</div>
                <div className="text-lg font-black mt-1 tabular-nums">
                  {toPersianDigits(seatedRoster.length || students.length)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-400 p-3">
                <div className="font-bold text-slate-600">تعداد حاضران (برگه تحویلی)</div>
                <div className="mt-3 border-b border-dashed border-slate-500 mx-6" />
              </div>
              <div className="rounded-xl border border-slate-400 p-3">
                <div className="font-bold text-slate-600">تعداد غایبان</div>
                <div className="mt-3 border-b border-dashed border-slate-500 mx-6" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-3.5 space-y-2 text-xs">
              <div className="font-extrabold">چک‌لیست بازگشایی و پلمپ پاکت آزمون:</div>
              <div className="flex items-center gap-2">
                <span className="print-checkbox" />
                <span>پلمپ پاکت سوالات در حضور مراقب و نمایندگان دانش‌آموزان در راس ساعت مقرر بازگشایی شد.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="print-checkbox" />
                <span>کلیه برگه‌های پاسخ‌نامه حاضران شمارش و با لیست حضور و غیاب حوزه مطابقت داده شد.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="print-checkbox" />
                <span>اسامی غایبان در صورتجلسه قید و برگه‌های سفید مازاد جداگانه داخل پاکت قرار گرفت.</span>
              </div>
              <div className="pt-2">
                <div className="font-bold mb-1">ملاحظات و گزارش وقایع احتمالی حوزه:</div>
                <div className="h-12 border border-dashed border-slate-400 rounded-lg" />
              </div>
            </div>

            <div className="print-signature-grid grid grid-cols-3 gap-4 pt-3 text-center text-xs">
              <div>
                <div className="font-bold">امضای مراقب حوزه</div>
                <div className="print-sig-space mt-10 border-b border-dashed border-slate-400 mx-4" />
              </div>
              <div>
                <div className="font-bold">امضای تحویل‌گیرنده (معاون / دبیر)</div>
                <div className="print-sig-space mt-10 border-b border-dashed border-slate-400 mx-4" />
              </div>
              <div>
                <div className="font-bold">مهر و امضای مدیر مدرسه ({school.principalName})</div>
                <div className="print-sig-space mt-10 border-b border-dashed border-slate-400 mx-4" />
              </div>
            </div>
          </div>
        </PrintShell>
      )}
    </div>
  );
};
