// Tab 4: SIDA Speed-Entry Assistant («دستیار ورود سریع نمرات در سایت سیدا»)
import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  RotateCcw,
  Sliders,
  Zap,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { copyTextToClipboard } from '../../lib/messenger';
import {
  buildSidaSpeedEntryRows,
  DEFAULT_SIDA_THRESHOLDS,
  type SidaDescriptiveThresholds,
  type SidaSpeedEntryTerm,
  type SidaSpeedSortBy,
} from './sidaBridgeHelpers';

interface SidaSpeedEntryTabProps {
  initialClassId?: string;
  initialSubject?: string;
  availableSubjects: string[];
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

const SPEED_TERMS: SidaSpeedEntryTerm[] = ['نوبت اول', 'نوبت دوم', 'مستمر', 'سالانه'];

export const SidaSpeedEntryTab: React.FC<SidaSpeedEntryTabProps> = ({
  initialClassId,
  initialSubject,
  availableSubjects,
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    activeSchool,
    session,
    classes,
    students,
    studentProfiles,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    sidaSpeedEntryTicks,
    upsertSidaSpeedEntryRecord,
  } = useSchoolData();

  const [classId, setClassId] = useState<string>(() => initialClassId || classes[0]?.id || '');
  const [subject, setSubject] = useState<string>(
    () => initialSubject || availableSubjects[0] || 'ریاضی'
  );
  const [term, setTerm] = useState<SidaSpeedEntryTerm>('نوبت اول');
  const [sortBy, setSortBy] = useState<SidaSpeedSortBy>('lastName');
  const [thresholds, setThresholds] = useState<SidaDescriptiveThresholds>(DEFAULT_SIDA_THRESHOLDS);
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialClassId && classes.some((c) => c.id === initialClassId)) {
      setClassId(initialClassId);
    } else if (!classes.some((c) => c.id === classId) && classes[0]) {
      setClassId(classes[0].id);
    }
  }, [initialClassId, classes, classId]);

  useEffect(() => {
    if (initialSubject) {
      setSubject(initialSubject);
    }
  }, [initialSubject]);

  const rows = useMemo(
    () =>
      buildSidaSpeedEntryRows({
        students,
        studentProfiles,
        gradebookEntries,
        onlineExams,
        onlineExamSubmissions,
        classId,
        subject,
        term,
        sortBy,
        thresholds,
      }),
    [
      students,
      studentProfiles,
      gradebookEntries,
      onlineExams,
      onlineExamSubmissions,
      classId,
      subject,
      term,
      sortBy,
      thresholds,
    ]
  );

  const tickRecordId = `${activeSchool.id}:sidatick:${classId}:${subject}:${term}`;
  const activeTickRecord = useMemo(
    () => sidaSpeedEntryTicks.find((r) => r.id === tickRecordId),
    [sidaSpeedEntryTicks, tickRecordId]
  );

  const checkedSet = useMemo(
    () => new Set(activeTickRecord?.checkedStudentIds ?? []),
    [activeTickRecord]
  );

  const completedCount = useMemo(
    () => rows.filter((r) => checkedSet.has(r.studentId)).length,
    [rows, checkedSet]
  );
  const progressPct = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

  const persistCheckedIds = (nextIds: string[]) => {
    const res = upsertSidaSpeedEntryRecord({
      id: tickRecordId,
      schoolId: activeSchool.id,
      classId,
      subject,
      term,
      checkedStudentIds: nextIds,
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    });
    if (!res.ok) {
      onErrorToast(res.errorFa ?? 'ذخیره وضعیت تیک سیدا ناموفق بود.');
    }
  };

  const handleToggleStudentTick = (studentId: string) => {
    const next = new Set(checkedSet);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    persistCheckedIds(Array.from(next));
  };

  const handleResetTicks = () => {
    persistCheckedIds([]);
    onSuccessToast('تیک‌های «ثبت شد در سیدا» برای این کلاس و درس بازنشانی شد.');
  };

  const handleCopyCell = async (key: string, textToCopy: string, labelFa: string) => {
    await copyTextToClipboard(textToCopy);
    setCopiedKey(key);
    onSuccessToast(`${labelFa} کپی شد (آماده پیست مستقیم در سایت سیدا).`);
    window.setTimeout(() => setCopiedKey(null), 1500);
  };

  const updateThreshold = (field: keyof SidaDescriptiveThresholds, raw: string) => {
    const num = Number(toAsciiDigits(raw));
    if (!Number.isFinite(num) || num < 0 || num > 20) return;
    setThresholds((prev) => ({ ...prev, [field]: num }));
  };

  return (
    <div className="no-print space-y-4" data-testid="sida-speed-entry-tab">
      {/* Control Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 brand-text shrink-0" />
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                دستیار ورود سریع نمرات در سایت سیدا (SIDA Speed-Entry)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                همگام با ترتیب سیدا (الفبا یا کد ملی) — کپی یک‌کلیکی کد ملی و نمره/توصیفی + ذخیره خودکار تیک‌های ثبت‌شده
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowThresholdConfig((v) => !v)}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4 brand-text" />
            <span>تنظیم بازه تبدیل نمره به توصیفی</span>
          </button>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              کلاس
            </label>
            <select
              aria-label="انتخاب کلاس ورود سریع سیدا"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              نام درس
            </label>
            <select
              aria-label="انتخاب درس ورود سریع سیدا"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              نوبت ارزشیابی
            </label>
            <select
              aria-label="انتخاب نوبت ورود سریع سیدا"
              value={term}
              onChange={(e) => setTerm(e.target.value as SidaSpeedEntryTerm)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              {SPEED_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              مرتب‌سازی منطبق با لیست سیدا
            </label>
            <select
              aria-label="مرتب‌سازی لیست ورود سریع"
              data-testid="speed-entry-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SidaSpeedSortBy)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold"
            >
              <option value="lastName">مرتب‌سازی بر اساس حروف الفبا (نام خانوادگی)</option>
              <option value="nationalId">مرتب‌سازی بر اساس کد ملی</option>
            </select>
          </div>
        </div>

        {/* Configurable Numeric <-> Descriptive Scale Converter */}
        {showThresholdConfig && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                تبدیل هوشمند نمره عددی به مقیاس توصیفی سیدا (قابل تنظیم)
              </div>
              <button
                type="button"
                onClick={() => setThresholds(DEFAULT_SIDA_THRESHOLDS)}
                className="text-xs font-bold brand-text hover:underline"
              >
                بازگشت به آستانه پیشفرض (۱۸ / ۱۵ / ۱۲)
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  حداقل نمره «خیلی خوب»
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={20}
                  value={thresholds.veryGood}
                  onChange={(e) => updateThreshold('veryGood', e.target.value)}
                  className="w-full min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 font-mono font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-sky-700 dark:text-sky-400 mb-1">
                  حداقل نمره «خوب»
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={20}
                  value={thresholds.good}
                  onChange={(e) => updateThreshold('good', e.target.value)}
                  className="w-full min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 font-mono font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-amber-700 dark:text-amber-400 mb-1">
                  حداقل نمره «قابل قبول»
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={20}
                  value={thresholds.acceptable}
                  onChange={(e) => updateThreshold('acceptable', e.target.value)}
                  className="w-full min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 font-mono font-bold tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <div className="w-full rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2.5 py-2 text-rose-800 dark:text-rose-200 font-bold tabular-nums">
                  کمتر از {toPersianDigits(thresholds.acceptable)} = نیاز به تلاش بیشتر
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Progress Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 tabular-nums">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span data-testid="speed-entry-progress-label">
                ثبت‌شده در سیدا: {toPersianDigits(completedCount)} از {toPersianDigits(rows.length)}{' '}
                نفر ({toPersianDigits(progressPct)}٪)
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetTicks}
              disabled={completedCount === 0}
              className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پاک کردن تیک‌های ثبت</span>
            </button>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Speed-Entry Checklist Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs">
              <tr>
                <th className="px-3 py-3 font-bold w-14">ردیف</th>
                <th className="px-3 py-3 font-bold">نام خانوادگی و نام</th>
                <th className="px-3 py-3 font-bold">کد ملی (کپی سریع)</th>
                <th className="px-3 py-3 font-bold">نمره عددی (از ۲۰)</th>
                <th className="px-3 py-3 font-bold">معادل توصیفی سیدا</th>
                <th className="px-3 py-3 font-bold text-center">ثبت شد در سیدا ✅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                    دانش‌آموزی در کلاس انتخاب‌شده یافت نشد.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const isChecked = checkedSet.has(row.studentId);
                  const nidCopyKey = `nid-${row.studentId}`;
                  const scoreCopyKey = `score-${row.studentId}`;
                  const descCopyKey = `desc-${row.studentId}`;
                  return (
                    <tr
                      key={row.studentId}
                      className={
                        isChecked
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="px-3 py-2.5 font-bold tabular-nums text-slate-500">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {row.lastName}، {row.firstName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          فرزند {row.fatherName} · {row.sourceLabel}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyCell(
                              nidCopyKey,
                              toAsciiDigits(row.nationalId),
                              `کد ملی ${row.fullName}`
                            )
                          }
                          className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-indigo-400 font-mono text-xs font-bold tabular-nums inline-flex items-center gap-1.5"
                        >
                          <span>{toPersianDigits(row.nationalId || '—')}</span>
                          {copiedKey === nidCopyKey ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.numericScore !== undefined ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyCell(
                                scoreCopyKey,
                                String(row.numericScore),
                                `نمره ${row.fullName}`
                              )
                            }
                            className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 font-extrabold tabular-nums inline-flex items-center gap-1.5 text-slate-900 dark:text-white"
                          >
                            <span>{toPersianDigits(row.numericScore)}</span>
                            {copiedKey === scoreCopyKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                            ثبت نشده
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.descriptiveLevel ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyCell(
                                descCopyKey,
                                row.descriptiveLevel!,
                                `مقیاس توصیفی ${row.fullName}`
                              )
                            }
                            className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-bold inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-100"
                          >
                            <span>{row.descriptiveLevel}</span>
                            {copiedKey === descCopyKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <label className="min-h-[40px] inline-flex items-center justify-center gap-2 cursor-pointer select-none px-2">
                          <input
                            type="checkbox"
                            data-testid={`speed-tick-${row.studentId}`}
                            checked={isChecked}
                            onChange={() => handleToggleStudentTick(row.studentId)}
                            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                          />
                          <span
                            className={`text-xs font-bold ${
                              isChecked
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {isChecked ? 'ثبت شد' : 'در انتظار'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
