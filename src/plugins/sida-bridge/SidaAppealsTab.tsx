// Tab 6: Grade Objection Inbox, Immutable Audit Log & Printable Official SIDA Amendment Minutes («صورتجلسه اصلاح نمره سیدا»)
import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  History,
  ShieldAlert,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { triggerPrint } from '../../core/print/printService';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type { DescriptiveLevel, GradeAppeal } from '../../types/domain';
import {
  formatObjectionResolutionMessenger,
  getSidaAppealStatusMeta,
  scoreToDescriptiveLevel,
} from './sidaBridgeHelpers';

interface SidaAppealsTabProps {
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

const DESCRIPTIVE_OPTIONS: DescriptiveLevel[] = [
  'خیلی خوب',
  'خوب',
  'قابل قبول',
  'نیاز به تلاش بیشتر',
];

export const SidaAppealsTab: React.FC<SidaAppealsTabProps> = ({
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    activeSchool,
    roleDef,
    classes,
    students,
    gradeAppeals,
    sidaGradeAuditLogs,
    resolveSidaGradeAppeal,
  } = useSchoolData();

  const canFinalizeAppeal = roleDef.canApproveGradeAppeals;

  const [selectedAppealId, setSelectedAppealId] = useState<string>('');
  const [resolutionAction, setResolutionAction] = useState<
    'in_review' | 'teacher_reviewed' | 'principal_approved' | 'rejected'
  >(() => (canFinalizeAppeal ? 'principal_approved' : 'teacher_reviewed'));
  const [revisedScoreInput, setRevisedScoreInput] = useState<string>('');
  const [revisedDescInput, setRevisedDescInput] = useState<DescriptiveLevel>('خیلی خوب');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [copiedAppealId, setCopiedAppealId] = useState<string | null>(null);
  const [printAppealTarget, setPrintAppealTarget] = useState<GradeAppeal | null>(null);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const activeAppeal = useMemo(() => {
    if (selectedAppealId) {
      const found = gradeAppeals.find((a) => a.id === selectedAppealId);
      if (found) return found;
    }
    return gradeAppeals[0] ?? null;
  }, [gradeAppeals, selectedAppealId]);

  const handleSelectAppeal = (appeal: GradeAppeal) => {
    setSelectedAppealId(appeal.id);
    setRevisedScoreInput(
      appeal.revisedScore !== undefined
        ? String(appeal.revisedScore)
        : appeal.originalScore !== undefined
          ? String(appeal.originalScore)
          : ''
    );
    setRevisedDescInput(
      appeal.revisedDescriptiveLevel ?? appeal.originalDescriptiveLevel ?? 'خیلی خوب'
    );
    setResolutionNote(
      appeal.sidaResolutionNote ?? appeal.principalNote ?? appeal.teacherResponse ?? ''
    );
  };

  const handleSubmitAppealResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppeal) return;

    const parsedScore = revisedScoreInput.trim()
      ? Number(toAsciiDigits(revisedScoreInput).trim())
      : undefined;
    if (
      resolutionAction === 'principal_approved' &&
      parsedScore !== undefined &&
      (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 20)
    ) {
      onErrorToast('نمره اصلاح‌شده باید عددی بین ۰ تا ۲۰ باشد.');
      return;
    }

    const effectiveNextStatus =
      !canFinalizeAppeal && resolutionAction === 'principal_approved'
        ? 'teacher_reviewed'
        : resolutionAction;

    const res = resolveSidaGradeAppeal({
      appealId: activeAppeal.id,
      nextStatus: effectiveNextStatus,
      revisedScore:
        effectiveNextStatus === 'principal_approved' || effectiveNextStatus === 'teacher_reviewed'
          ? parsedScore
          : undefined,
      revisedDescriptiveLevel:
        effectiveNextStatus === 'principal_approved' || effectiveNextStatus === 'teacher_reviewed'
          ? parsedScore !== undefined
            ? scoreToDescriptiveLevel(parsedScore)
            : revisedDescInput
          : undefined,
      explanation: resolutionNote,
    });

    if (!res.ok) {
      onErrorToast(res.errorFa ?? 'ثبت نتیجه بررسی اعتراض ناموفق بود.');
      return;
    }

    onSuccessToast(
      effectiveNextStatus === 'principal_approved'
        ? 'اعتراض تایید شد؛ نمره در دفتر کلاسی به‌روزرسانی و در صورتجلسه اصلاح سیدا ثبت گردید.'
        : effectiveNextStatus === 'rejected'
          ? 'نتیجه بررسی (تایید نمره اولیه) ثبت و در تاریخچه سیدا بایگانی شد.'
          : 'وضعیت بررسی اعتراض و گزارش معلم با موفقیت ثبت شد.'
    );
  };

  const handleCopyAppealMessenger = async (appeal: GradeAppeal) => {
    const st = studentMap.get(appeal.studentId);
    const cls = classMap.get(appeal.classId);
    const text = formatObjectionResolutionMessenger({
      schoolName: activeSchool.name,
      studentName: st?.fullName ?? 'دانش‌آموز',
      className: cls?.name ?? 'کلاس',
      appeal,
    });
    await copyTextToClipboard(text);
    setCopiedAppealId(appeal.id);
    onSuccessToast('متن تک‌ستونی پاسخ نتیجه اعتراض برای ارسال در ایتا، بله و شاد کپی شد.');
    window.setTimeout(() => setCopiedAppealId(null), 1800);
  };

  const handlePrintAppealMinutes = (appeal: GradeAppeal, size: 'a4' | 'a5') => {
    setPrintAppealTarget(appeal);
    triggerPrint({
      size,
      orientation: 'portrait',
      onAfterPrint: () => setPrintAppealTarget(null),
    });
  };

  return (
    <div className="space-y-4" data-testid="sida-appeals-tab">
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Objections List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              درخواست‌های اعتراض نمره اولیا ({toPersianDigits(gradeAppeals.length)})
            </h2>
          </div>
          {gradeAppeals.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              هیچ اعتراض نمره‌ای در این مدرسه ثبت نشده است.
            </p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pl-1">
              {gradeAppeals.map((appeal) => {
                const st = studentMap.get(appeal.studentId);
                const cls = classMap.get(appeal.classId);
                const meta = getSidaAppealStatusMeta(appeal.status);
                const isSelected = activeAppeal?.id === appeal.id;
                return (
                  <button
                    key={appeal.id}
                    type="button"
                    onClick={() => handleSelectAppeal(appeal)}
                    className={`w-full text-right rounded-xl border p-3 transition-all space-y-1.5 ${
                      isSelected
                        ? 'border-[var(--brand-primary)] bg-slate-50 dark:bg-slate-800 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {st?.fullName ?? 'دانش‌آموز'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.badgeClass}`}>
                        {meta.labelFa}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {cls?.name ?? 'کلاس'} · درس {appeal.subject} (ماه {appeal.jalaliMonth}) · تاریخ ثبت:{' '}
                      {toPersianDigits(appeal.submittedAtJalali)}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                      {appeal.parentReason}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Objection Resolution Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          {!activeAppeal ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              یک درخواست اعتراض را از فهرست انتخاب کنید.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    رسیدگی و صورتجلسه اصلاح نمره سیدا — {studentMap.get(activeAppeal.studentId)?.fullName ?? 'دانش‌آموز'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {classMap.get(activeAppeal.classId)?.name} · درس {activeAppeal.subject} · ماه{' '}
                    {activeAppeal.jalaliMonth} · ثبت‌شده توسط ولی: {activeAppeal.submittedByName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyAppealMessenger(activeAppeal)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {copiedAppealId === activeAppeal.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی پاسخ برای ایتا/بله/شاد</span>
                      </>
                    )}
                  </button>
                  <PrintButtons
                    compact
                    documentLabel="صورتجلسه درخواست اصلاح نمره در سامانه سیدا"
                    onPrint={(sz) => handlePrintAppealMinutes(activeAppeal, sz)}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1.5 text-xs">
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  متن درخواست ولی:
                </div>
                <p className="text-slate-800 dark:text-slate-100 leading-relaxed">
                  {activeAppeal.parentReason}
                </p>
                <div className="pt-1 flex flex-wrap gap-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  <span>
                    نمره اولیه:{' '}
                    {activeAppeal.originalScore !== undefined
                      ? `${toPersianDigits(activeAppeal.originalScore)} از ۲۰`
                      : activeAppeal.originalDescriptiveLevel ?? 'ثبت نشده'}
                  </span>
                  {activeAppeal.revisedScore !== undefined && (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      نمره اصلاح‌شده: {toPersianDigits(activeAppeal.revisedScore)} از ۲۰ (
                      {activeAppeal.revisedDescriptiveLevel ??
                        scoreToDescriptiveLevel(activeAppeal.revisedScore)}
                      )
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmitAppealResolution} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تصمیم بررسی
                    </label>
                    <select
                      aria-label="تصمیم بررسی اعتراض"
                      value={resolutionAction}
                      onChange={(e) =>
                        setResolutionAction(
                          e.target.value as
                            | 'in_review'
                            | 'teacher_reviewed'
                            | 'principal_approved'
                            | 'rejected'
                        )
                      }
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold"
                    >
                      <option value="in_review">در حال بررسی</option>
                      {canFinalizeAppeal ? (
                        <option value="principal_approved">تایید اعتراض و اصلاح نمره</option>
                      ) : (
                        <option value="teacher_reviewed">پیشنهاد اصلاح نمره (ارجاع به مدیریت)</option>
                      )}
                      <option value="rejected">رد اعتراض (تایید نمره اولیه)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نمره جدید (۰ تا ۲۰)
                    </label>
                    <input
                      type="text"
                      aria-label="نمره اصلاح‌شده"
                      disabled={resolutionAction === 'rejected' || resolutionAction === 'in_review'}
                      value={revisedScoreInput}
                      onChange={(e) => setRevisedScoreInput(e.target.value)}
                      placeholder="مثال: 18.5"
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      سطح توصیفی جدید
                    </label>
                    <select
                      aria-label="سطح توصیفی جدید"
                      disabled={resolutionAction === 'rejected' || resolutionAction === 'in_review'}
                      value={revisedDescInput}
                      onChange={(e) => setRevisedDescInput(e.target.value as DescriptiveLevel)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold disabled:opacity-50"
                    >
                      {DESCRIPTIVE_OPTIONS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شرح بررسی برگه و توجیه رسمی جهت درج در صورتجلسه اصلاح نمره سیدا
                  </label>
                  <textarea
                    rows={3}
                    required
                    aria-label="شرح بررسی برگه"
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="نتیجه بازبینی برگه امتحان و دلیل اصلاح یا تایید نمره اولیه را بنویسید..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {canFinalizeAppeal
                      ? 'با تایید اعتراض، نمره دفتر کلاسی اصلاح و در صورتجلسه تغییرناپذیر سیدا قفل می‌شود.'
                      : 'پیشنهاد معلم ثبت و برای تایید نهایی و صدور صورتجلسه به مدیریت ارجاع می‌گردد.'}
                  </span>
                  <button
                    type="submit"
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold brand-btn whitespace-nowrap"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>ثبت نتیجه و صدور صورتجلسه</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Immutable SIDA Grade Audit Log */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 brand-text" />
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            تاریخچه تغییرناپذیر اصلاح نمره جهت ثبت در سامانه سیدا ({toPersianDigits(sidaGradeAuditLogs.length)})
          </h3>
        </div>
        {sidaGradeAuditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            هنوز هیچ تغییر نمره‌ای از طریق کارپوشه اعتراضات ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-bold">تاریخ شمسی</th>
                  <th className="px-3 py-2 font-bold">دانش‌آموز</th>
                  <th className="px-3 py-2 font-bold">درس / ماه</th>
                  <th className="px-3 py-2 font-bold">نمره قبلی → جدید</th>
                  <th className="px-3 py-2 font-bold">بررسی‌کننده</th>
                  <th className="px-3 py-2 font-bold">شرح بررسی برگه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sidaGradeAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 font-bold tabular-nums">
                      {toPersianDigits(log.jalaliDate)}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                      {studentMap.get(log.studentId)?.fullName ?? log.studentId}
                    </td>
                    <td className="px-3 py-2">
                      {log.subject} ({log.jalaliMonth})
                    </td>
                    <td className="px-3 py-2 font-extrabold tabular-nums">
                      {log.oldScore !== undefined
                        ? toPersianDigits(log.oldScore)
                        : log.oldDescriptiveLevel ?? '—'}
                      {' ← '}
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {log.newScore !== undefined
                          ? toPersianDigits(log.newScore)
                          : log.newDescriptiveLevel ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{log.reviewerName}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{log.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Official SIDA Grade Amendment Minutes («صورتجلسه درخواست اصلاح نمره در سامانه سیدا — A4 / A5») */}
      {(printAppealTarget || activeAppeal) && (
        <div className="print-only">
          {(() => {
            const target = printAppealTarget ?? activeAppeal!;
            const st = studentMap.get(target.studentId);
            const cls = classMap.get(target.classId);
            const statusMeta = getSidaAppealStatusMeta(target.status);
            return (
              <PrintShell
                school={activeSchool}
                documentTitle="صورتجلسه درخواست اصلاح نمره در سامانه سیدا"
                subtitle={`شماره پیگیری: ${toPersianDigits(target.id.slice(-6))} · تاریخ صورتجلسه: ${toPersianDigits(target.resolvedAtJalali ?? getTodayJalali())}`}
              >
                <div className="space-y-4 text-xs leading-relaxed">
                  <p className="text-justify leading-6">
                    بدین‌وسیله گواهی می‌شود برگه امتحانی و مستندات ارزشیابی دانش‌آموز مشروحه ذیل در
                    پی درخواست رسمی ولی و با حضور دبیر مربوطه و معاون آموزشی بررسی مجدد گردید و
                    نتیجه نهایی جهت اعمال و بایگانی در <strong>سامانه جامع سیدا</strong> به شرح زیر
                    صورتجلسه شد:
                  </p>
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <th className="w-1/4">نام و نام خانوادگی دانش‌آموز</th>
                        <td className="w-1/4 font-bold">{st?.fullName ?? '—'}</td>
                        <th className="w-1/4">کد ملی (۱۰ رقمی)</th>
                        <td className="w-1/4 font-mono font-bold">
                          {toPersianDigits(st?.nationalId ?? '—')}
                        </td>
                      </tr>
                      <tr>
                        <th>پایه و کلاس</th>
                        <td>{cls?.name ?? '—'}</td>
                        <th>نام درس و نوبت</th>
                        <td>
                          {target.subject} — ماه {target.jalaliMonth}
                        </td>
                      </tr>
                      <tr>
                        <th>نمره / سطح ثبت‌شده قبلی</th>
                        <td className="font-bold">
                          {target.originalScore !== undefined
                            ? `${toPersianDigits(target.originalScore)} از ۲۰`
                            : target.originalDescriptiveLevel ?? '—'}
                        </td>
                        <th>نمره / سطح اصلاح‌شده نهایی</th>
                        <td className="font-extrabold">
                          {target.revisedScore !== undefined
                            ? `${toPersianDigits(target.revisedScore)} از ۲۰`
                            : target.revisedDescriptiveLevel ??
                              (target.originalScore !== undefined
                                ? `${toPersianDigits(target.originalScore)} از ۲۰`
                                : '—')}
                        </td>
                      </tr>
                      <tr>
                        <th>نتیجه نهایی کارگروه</th>
                        <td colSpan={3} className="font-extrabold">
                          {statusMeta.labelFa}
                        </td>
                      </tr>
                      <tr>
                        <th>متن درخواست ولی</th>
                        <td colSpan={3}>{target.parentReason}</td>
                      </tr>
                      <tr>
                        <th>علت توجیهی و شرح بازبینی برگه</th>
                        <td colSpan={3}>
                          {target.sidaResolutionNote ??
                            target.principalNote ??
                            target.teacherResponse ??
                            '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <FileText className="w-3.5 h-3.5" />
                      محل مهر برجسته / ژلاتینی واحد آموزشی
                    </span>
                    <span>تاریخ تنظیم: {toPersianDigits(getTodayJalali())}</span>
                  </div>
                </div>
              </PrintShell>
            );
          })()}
        </div>
      )}
    </div>
  );
};
