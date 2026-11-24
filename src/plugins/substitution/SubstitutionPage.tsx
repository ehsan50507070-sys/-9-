// Add-on 3: Smart Substitute Finder («یافتن هوشمند معلم جایگزین»)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { computeSubstitutionNeeds } from '../../core/plugins/pluginHelpers';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useRouter } from '../../core/router/RouterContext';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import {
  addDaysToJalali,
  formatJalaliDisplay,
  getPersianWeekdayFromJalali,
} from '../../lib/jalali';
import { copyTextToClipboard, formatSingleColumnMessengerReport } from '../../lib/messenger';

export const SubstitutionPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    defaultWorkdayJalali,
    classes,
    teachers,
    schedules,
    staffAttendance,
    substitutions,
    upsertSubstitution,
    deleteSubstitution,
    isPluginEnabled,
  } = useSchoolData();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(defaultWorkdayJalali);
  const staffAddonEnabled = isPluginEnabled('staff-attendance');

  const weekday = useMemo(() => getPersianWeekdayFromJalali(selectedDate), [selectedDate]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const needs = useMemo(
    () =>
      computeSubstitutionNeeds({
        schoolId: activeSchoolId,
        jalaliDate: selectedDate,
        weekday,
        teachers,
        schedules,
        staffAttendance,
        substitutions,
      }),
    [activeSchoolId, selectedDate, weekday, teachers, schedules, staffAttendance, substitutions]
  );

  const pendingCount = needs.filter((n) => !n.existingAssignment).length;
  const assignedCount = needs.filter((n) => Boolean(n.existingAssignment)).length;

  const handleAssign = (need: (typeof needs)[number], substituteTeacherId: string) => {
    if (!roleDef.canAssignSubstitution) return;
    const subTeacher = teacherMap.get(substituteTeacherId);
    upsertSubstitution({
      id: need.key,
      schoolId: activeSchoolId,
      jalaliDate: need.jalaliDate,
      weekday: need.weekday,
      period: need.period,
      classId: need.classId,
      subjectName: need.subjectName,
      absentTeacherId: need.absentTeacher.id,
      substituteTeacherId,
      reason: need.reason,
      assignedBy: activeRole,
      assignedAt: new Date().toISOString(),
    });
    showToast(
      `«${subTeacher?.fullName ?? 'همکار جایگزین'}» برای زنگ ${toPersianDigits(need.period)} تخصیص داده شد.`
    );
  };

  const handleRemoveAssignment = (id: string) => {
    if (!roleDef.canAssignSubstitution) return;
    deleteSubstitution(id);
    showToast('تخصیص جایگزین لغو شد.', 'info');
  };

  const handleCopyMessenger = async () => {
    const lines =
      needs.length === 0
        ? ['در این تاریخ هیچ غیبت یا تاخیر کادر نیازمند جایگزین ثبت نشده است.']
        : needs.map((n, idx) => {
            const clsName = classMap.get(n.classId)?.name ?? '';
            const subName = n.existingAssignment
              ? teacherMap.get(n.existingAssignment.substituteTeacherId)?.fullName ?? 'تعیین‌شده'
              : 'در انتظار تخصیص';
            return `${toPersianDigits(idx + 1)}. زنگ ${toPersianDigits(n.period)} — ${clsName} (${n.subjectName}) | همکار ${n.reason === 'absent' ? 'غایب' : 'دارای تاخیر'}: ${n.absentTeacher.fullName} | جایگزین: ${subName}`;
          });

    const report = formatSingleColumnMessengerReport({
      schoolName: activeSchool.name,
      reportTitle: 'برنامه معلمان جایگزین روزانه',
      jalaliDateDisplay: formatJalaliDisplay(selectedDate, true),
      sections: [{ heading: 'فهرست کلاس‌های دارای پوشش جایگزین', lines }],
      footerNote: 'هماهنگی اجرایی مدرسه — قابل ارسال در ایتا، بله و شاد',
    });

    const ok = await copyTextToClipboard(report);
    showToast(
      ok ? 'برنامه تک‌ستونه جایگزینی برای پیام‌رسان‌ها کپی شد.' : 'خطا در کپی متن.',
      ok ? 'success' : 'warning'
    );
  };

  return (
    <PrintShell
      school={activeSchool}
      documentTitle="برگه ابلاغ و برنامه معلمان جایگزین"
      subtitle={`تاریخ: ${formatJalaliDisplay(selectedDate, true)}`}
      landscape={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              یافتن هوشمند معلم جایگزین
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              به‌محض ثبت «غایب» یا «تاخیر» برای هر معلم در حضور و غیاب کادر، همکاران آزاد همان زنگ
              در این مدرسه پیشنهاد می‌شوند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyMessenger()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors whitespace-nowrap"
            >
              <Copy className="w-4 h-4 shrink-0" />
              کپی هوشمند برای پیام‌رسان‌ها
            </button>
            <PrintButtons compact documentLabel="ابلاغیه معلم جایگزین" />
          </div>
        </div>

        {/* Graceful Dependency Warning if staff-attendance is disabled */}
        {!staffAddonEnabled && (
          <div className="no-print rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                بسته وابسته «حضور و غیاب کادر (۴ زنگه)» در حال حاضر در این مدرسه غیرفعال است.
                رکوردهای قبلی کادر محفوظ بوده و در محاسبه نمایش داده می‌شوند، اما برای ثبت غیبت
                جدید لازم است آن را مجدداً فعال کنید.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/addons')}
              className="min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 whitespace-nowrap shrink-0"
            >
              مدیریت بسته‌های الحاقی
            </button>
          </div>
        )}

        {/* Date Stepper & Summary */}
        <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDaysToJalali(d, -1))}
              aria-label="روز قبل"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="min-h-[44px] px-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatJalaliDisplay(selectedDate, true)}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDaysToJalali(d, 1))}
              aria-label="روز بعد"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm tabular-nums">
            <span className="text-rose-700 dark:text-rose-400 font-semibold">
              در انتظار جایگزین: {toPersianDigits(pendingCount)}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              تخصیص داده‌شده: {toPersianDigits(assignedCount)}
            </span>
          </div>
        </div>

        {/* Needs Cards (Screen View) */}
        <div className="no-print space-y-4">
          {needs.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                همه کلاس‌های این روز دارای معلم حاضر هستند
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                برای آزمایش این بخش، در صفحه «حضور و غیاب کادر (۴ زنگه)» وضعیت یکی از معلمان را روی
                «غایب» یا «تاخیر» قرار دهید.
              </p>
              {staffAddonEnabled && (
                <button
                  type="button"
                  onClick={() => navigate('/staff-attendance')}
                  className="mt-4 min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  رفتن به حضور و غیاب کادر
                </button>
              )}
            </div>
          ) : (
            needs.map((need) => {
              const cls = classMap.get(need.classId);
              const assignedTeacher = need.existingAssignment
                ? teacherMap.get(need.existingAssignment.substituteTeacherId)
                : undefined;

              return (
                <article
                  key={need.key}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          زنگ {toPersianDigits(need.period)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{cls?.name ?? need.classId}</span>
                        <span aria-hidden="true">·</span>
                        <span>درس: {need.subjectName}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            need.reason === 'absent'
                              ? 'font-semibold text-rose-600 dark:text-rose-400'
                              : 'font-semibold text-amber-600 dark:text-amber-400'
                          }
                        >
                          {need.reason === 'absent' ? 'غیبت معلم' : 'تاخیر معلم'}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                        معلم اصلی: {need.absentTeacher.fullName}
                      </h2>
                    </div>

                    {assignedTeacher ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          جایگزین: {assignedTeacher.fullName}
                        </span>
                        {roleDef.canAssignSubstitution && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignment(need.existingAssignment!.id)}
                            aria-label={`لغو جایگزینی ${assignedTeacher.fullName}`}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        نیازمند تخصیص فوری
                      </span>
                    )}
                  </div>

                  {/* Suggested Free Colleagues */}
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">
                      همکاران آزاد در زنگ {toPersianDigits(need.period)} ({activeSchool.name}):
                    </div>
                    {need.suggestedFreeTeachers.length === 0 ? (
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        همکار آزادی در این زنگ طبق برنامه یافت نشد؛ لطفاً از طریق مدیریت ادغام کلاس
                        انجام دهید.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {need.suggestedFreeTeachers.map((candidate) => {
                          const isSelected =
                            need.existingAssignment?.substituteTeacherId === candidate.id;
                          return (
                            <div
                              key={candidate.id}
                              className={`rounded-xl border p-3 flex items-center justify-between gap-2 transition-colors ${
                                isSelected
                                  ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/40'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {candidate.fullName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {candidate.specialty}
                                </div>
                              </div>
                              {roleDef.canAssignSubstitution && (
                                <button
                                  type="button"
                                  disabled={isSelected}
                                  onClick={() => handleAssign(need, candidate.id)}
                                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white cursor-default'
                                      : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90'
                                  }`}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  {isSelected ? 'تخصیص یافت' : 'تخصیص جایگزین'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Precision A4 Print Table */}
        <div className="print-only">
          <table>
            <thead>
              <tr>
                <th>ردیف</th>
                <th>زنگ</th>
                <th>کلاس و درس</th>
                <th>معلم اصلی (علت)</th>
                <th>معلم جایگزین ابلاغی</th>
                <th>امضای جایگزین</th>
              </tr>
            </thead>
            <tbody>
              {needs.map((n, idx) => {
                const cls = classMap.get(n.classId);
                const sub = n.existingAssignment
                  ? teacherMap.get(n.existingAssignment.substituteTeacherId)
                  : undefined;
                return (
                  <tr key={n.key}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="text-center tabular-nums">زنگ {toPersianDigits(n.period)}</td>
                    <td>
                      {cls?.name} ({n.subjectName})
                    </td>
                    <td>
                      {n.absentTeacher.fullName} ({n.reason === 'absent' ? 'غایب' : 'تاخیر'})
                    </td>
                    <td className="font-semibold">{sub?.fullName ?? 'تعیین نشده'}</td>
                    <td style={{ height: '28px' }} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PrintShell>
  );
};
