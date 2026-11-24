// Add-on 4: Daily Log & Early Dismissal («دفتر گزارش روزانه و خروج زودهنگام»)
import React, { useMemo, useState } from 'react';
import {
  ClipboardPlus,
  Copy,
  Download,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useToast } from '../../core/ui/ToastContext';
import { validateDailyLogInput } from '../../core/validation/validators';
import { buildUtf8BomCsv, downloadTextFile } from '../../lib/csv';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import { copyTextToClipboard, formatSingleColumnMessengerReport } from '../../lib/messenger';
import type { DailyLogCategory } from '../../types/domain';

const CATEGORY_META: Record<
  DailyLogCategory,
  { label: string; textClass: string }
> = {
  early_dismissal: {
    label: 'مرخصی ساعتی / خروج زودهنگام',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  health: {
    label: 'بهداشت و سلامت',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
  disciplinary: {
    label: 'انضباطی و مشاوره‌ای',
    textClass: 'text-rose-700 dark:text-rose-400',
  },
  administrative: {
    label: 'اداری و اجرایی',
    textClass: 'text-sky-700 dark:text-sky-400',
  },
};

export const DailyLogPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    defaultWorkdayJalali,
    classes,
    students,
    dailyLogs,
    addDailyLog,
    deleteDailyLog,
  } = useSchoolData();
  const { showToast } = useToast();

  const [filterCategory, setFilterCategory] = useState<'all' | DailyLogCategory>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showForm, setShowForm] = useState<boolean>(false);

  // Form state
  const [category, setCategory] = useState<DailyLogCategory>('early_dismissal');
  const [jalaliDate, setJalaliDate] = useState<string>(defaultWorkdayJalali);
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? '');
  const [studentId, setStudentId] = useState<string>(students[0]?.id ?? '');
  const [pickupPersonName, setPickupPersonName] = useState<string>('');
  const [pickupRelation, setPickupRelation] = useState<string>('پدر');
  const [exitTime, setExitTime] = useState<string>('10:30');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<'normal' | 'attention' | 'urgent'>('normal');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const studentsInSelectedClass = useMemo(
    () => students.filter((s) => !classId || s.classId === classId),
    [students, classId]
  );

  const isTeacher = activeRole === 'teacher';
  const canDeleteLogs =
    activeRole === 'complex_admin' || activeRole === 'principal' || activeRole === 'deputy';

  const filteredLogs = useMemo(() => {
    return dailyLogs.filter((entry) => {
      if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim();
        const stName = entry.studentId ? studentMap.get(entry.studentId)?.fullName ?? '' : '';
        return (
          entry.title.includes(q) ||
          entry.description.includes(q) ||
          stName.includes(q) ||
          (entry.pickupPersonName ?? '').includes(q)
        );
      }
      return true;
    });
  }, [dailyLogs, filterCategory, searchTerm, studentMap]);

  const handleClassChange = (nextClassId: string) => {
    setClassId(nextClassId);
    const firstInClass = students.find((s) => s.classId === nextClassId);
    setStudentId(firstInClass?.id ?? '');
    if (firstInClass && category === 'early_dismissal' && !pickupPersonName) {
      setPickupPersonName(firstInClass.parentName);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleDef.canCreateDailyLog) return;

    const normalizedDate = toAsciiDigits(jalaliDate).trim();
    const normalizedExitTime = toAsciiDigits(exitTime).trim();
    const selectedStudent = studentMap.get(studentId);
    const effectiveTitle =
      title.trim() ||
      (category === 'early_dismissal' && selectedStudent
        ? `خروج زودهنگام ${selectedStudent.fullName}`
        : '');

    const validation = validateDailyLogInput({
      jalaliDate: normalizedDate,
      category,
      title: effectiveTitle,
      description: description.trim(),
      studentId: category === 'administrative' ? undefined : studentId || undefined,
      classId: category === 'administrative' ? undefined : classId || undefined,
      pickupPersonName: category === 'early_dismissal' ? pickupPersonName.trim() : undefined,
      pickupRelation: category === 'early_dismissal' ? pickupRelation.trim() : undefined,
      exitTime: category === 'early_dismissal' ? normalizedExitTime : undefined,
      severity,
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    const res = addDailyLog({
      id: `${activeSchoolId}-log-${Date.now()}`,
      schoolId: activeSchoolId,
      jalaliDate: normalizedDate,
      category,
      title: effectiveTitle,
      description: description.trim(),
      studentId: category === 'administrative' ? undefined : studentId || undefined,
      classId: category === 'administrative' ? undefined : classId || undefined,
      pickupPersonName: category === 'early_dismissal' ? pickupPersonName.trim() : undefined,
      pickupRelation: category === 'early_dismissal' ? pickupRelation.trim() : undefined,
      exitTime: category === 'early_dismissal' ? normalizedExitTime : undefined,
      severity,
      recordedBy: activeRole,
      createdAt: new Date().toISOString(),
    });

    if (!res.ok) {
      showToast(res.errorFa ?? 'مجوز ثبت گزارش وجود ندارد.', 'warning');
      return;
    }

    setFormErrors([]);
    setTitle('');
    setDescription('');
    setPickupPersonName('');
    setShowForm(false);
    showToast('گزارش جدید با موفقیت در دفتر روزانه مدرسه ثبت شد.');
  };

  const handleCopyMessenger = async () => {
    const lines =
      filteredLogs.length === 0
        ? ['موردی برای نمایش در این فیلتر ثبت نشده است.']
        : filteredLogs.slice(0, 15).map((log, idx) => {
            const st = log.studentId ? studentMap.get(log.studentId) : undefined;
            const cls = log.classId ? classMap.get(log.classId) : undefined;
            const pickup =
              log.category === 'early_dismissal'
                ? ` | خروج ساعت ${toPersianDigits(log.exitTime ?? '')} با ${log.pickupPersonName ?? ''} (${log.pickupRelation ?? ''})`
                : '';
            return `${toPersianDigits(idx + 1)}. [${CATEGORY_META[log.category].label}] ${log.title}${st ? ` (${st.fullName}${cls ? ` - ${cls.name}` : ''})` : ''}${pickup} — تاریخ ${toPersianDigits(log.jalaliDate)}`;
          });

    const report = formatSingleColumnMessengerReport({
      schoolName: activeSchool.name,
      reportTitle: 'خلاصه دفتر گزارش روزانه و مرخصی ساعتی',
      jalaliDateDisplay: formatJalaliDisplay(defaultWorkdayJalali, true),
      sections: [{ heading: 'وقایع ثبت‌شده', lines }],
    });

    const ok = await copyTextToClipboard(report);
    showToast(
      ok ? 'خلاصه دفتر روزانه به‌صورت تک‌ستونه برای ایتا، بله و شاد کپی شد.' : 'خطا در کپی کردن.',
      ok ? 'success' : 'warning'
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'تاریخ',
      'دسته‌بندی',
      'عنوان',
      'دانش‌آموز',
      'کلاس',
      'تحویل‌گیرنده',
      'نسبت',
      'ساعت خروج',
      'شرح واقعه',
    ];
    const rows = filteredLogs.map((log) => [
      log.jalaliDate,
      CATEGORY_META[log.category].label,
      log.title,
      log.studentId ? (studentMap.get(log.studentId)?.fullName ?? '') : '',
      log.classId ? (classMap.get(log.classId)?.name ?? '') : '',
      log.pickupPersonName ?? '',
      log.pickupRelation ?? '',
      log.exitTime ?? '',
      log.description,
    ]);
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(`daily-logs-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فایل اکسل دفتر روزانه (CSV با UTF-8 BOM) دریافت شد.');
  };

  return (
    <PrintShell
      school={activeSchool}
      documentTitle="دفتر ثبت وقایع روزانه و مرخصی ساعتی دانش‌آموزان"
      subtitle={`تعداد موارد: ${toPersianDigits(filteredLogs.length)} رکورد`}
      landscape={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              دفتر روزانه و خروج زودهنگام
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ثبت دقیق مرخصی ساعتی با مشخصات تحویل‌گیرنده و ساعت خروج، همراه با گزارش‌های بهداشتی،
              انضباطی و اداری.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {roleDef.canCreateDailyLog && (
              <button
                type="button"
                onClick={() => {
                  setShowForm((prev) => !prev);
                  setFormErrors([]);
                }}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
              >
                <ClipboardPlus className="w-4 h-4 shrink-0" />
                {showForm ? 'بستن فرم ثبت' : 'ثبت واقعه / خروج جدید'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleCopyMessenger()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 py-2 transition-colors whitespace-nowrap"
            >
              <Copy className="w-4 h-4 shrink-0" />
              کپی برای پیام‌رسان‌ها
            </button>
            <PrintButtons compact documentLabel="دفتر گزارش روزانه" />
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              اکسل
            </button>
          </div>
        </div>

        {/* New Entry Validated Form */}
        {showForm && roleDef.canCreateDailyLog && (
          <form
            onSubmit={handleSubmit}
            className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ثبت رکورد جدید در دفتر روزانه ({activeSchool.name})
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="بستن فرم"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 text-sm text-rose-800 dark:text-rose-200 space-y-1"
              >
                {formErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="log-category" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  نوع گزارش
                </label>
                <select
                  id="log-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DailyLogCategory)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="early_dismissal">مرخصی ساعتی / خروج زودهنگام</option>
                  <option value="health">بهداشت و سلامت</option>
                  <option value="disciplinary">انضباطی و مشاوره‌ای</option>
                  {!isTeacher && <option value="administrative">اداری و اجرایی</option>}
                </select>
              </div>

              <div>
                <label htmlFor="log-date" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  تاریخ شمسی (YYYY/MM/DD)
                </label>
                <input
                  id="log-date"
                  type="text"
                  value={jalaliDate}
                  onChange={(e) => setJalaliDate(e.target.value)}
                  placeholder="1405/08/29"
                  dir="ltr"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="log-severity" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  سطح اهمیت
                </label>
                <select
                  id="log-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'normal' | 'attention' | 'urgent')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="normal">عادی</option>
                  <option value="attention">نیاز به پیگیری</option>
                  <option value="urgent">فوری / حساس</option>
                </select>
              </div>
            </div>

            {category !== 'administrative' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="log-class" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    کلاس
                  </label>
                  <select
                    id="log-class"
                    value={classId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="log-student" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    دانش‌آموز
                  </label>
                  <select
                    id="log-student"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      const st = studentMap.get(e.target.value);
                      if (st && category === 'early_dismissal') {
                        setPickupPersonName(st.parentName);
                      }
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {studentsInSelectedClass.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} (ولی: {st.parentName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {category === 'early_dismissal' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="log-pickup-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    نام تحویل‌گیرنده
                  </label>
                  <input
                    id="log-pickup-name"
                    type="text"
                    value={pickupPersonName}
                    onChange={(e) => setPickupPersonName(e.target.value)}
                    placeholder="نام کامل ولی یا نماینده"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="log-pickup-relation" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    نسبت با دانش‌آموز
                  </label>
                  <input
                    id="log-pickup-relation"
                    type="text"
                    value={pickupRelation}
                    onChange={(e) => setPickupRelation(e.target.value)}
                    placeholder="پدر / مادر / عمو..."
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="log-exit-time" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    ساعت دقیق خروج (HH:MM)
                  </label>
                  <input
                    id="log-exit-time"
                    type="text"
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    placeholder="10:30"
                    dir="ltr"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="log-title" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                عنوان گزارش
              </label>
              <input
                id="log-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'early_dismissal'
                    ? 'اختیاری (در صورت خالی بودن از نام دانش‌آموز ساخته می‌شود)'
                    : 'عنوان کوتاه و دقیق واقعه'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="log-description" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                شرح کامل و توضیحات
              </label>
              <textarea
                id="log-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="جزئیات کامل واقعه، هماهنگی با اولیا یا اقدامات انجام‌شده..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                ثبت نهایی در دفتر روزانه
              </button>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {(
              [
                ['all', 'همه موارد'],
                ['early_dismissal', 'خروج زودهنگام'],
                ['health', 'بهداشت'],
                ['disciplinary', 'انضباطی'],
                ['administrative', 'اداری'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterCategory(key)}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterCategory === key
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در دفتر روزانه..."
              aria-label="جستجو در دفتر روزانه"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pr-10 pl-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Logs List (Screen) */}
        <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              هیچ گزارشی مطابق فیلتر انتخاب‌شده یافت نشد.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map((entry) => {
                const meta = CATEGORY_META[entry.category];
                const st = entry.studentId ? studentMap.get(entry.studentId) : undefined;
                const cls = entry.classId ? classMap.get(entry.classId) : undefined;
                return (
                  <li key={entry.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className={`font-bold ${meta.textClass}`}>{meta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatJalaliDisplay(entry.jalaliDate, true)}</span>
                        {entry.exitTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              ساعت خروج: {toPersianDigits(entry.exitTime)}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {entry.title}
                      </h3>

                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {entry.description}
                      </p>

                      {(st || entry.pickupPersonName) && (
                        <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {st && (
                            <span>
                              دانش‌آموز: <strong className="text-slate-700 dark:text-slate-200">{st.fullName}</strong>
                              {cls ? ` (${cls.name})` : ''}
                            </span>
                          )}
                          {entry.pickupPersonName && (
                            <span>
                              تحویل‌گیرنده:{' '}
                              <strong className="text-slate-700 dark:text-slate-200">
                                {entry.pickupPersonName} ({entry.pickupRelation})
                              </strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {canDeleteLogs && (
                      <button
                        type="button"
                        onClick={() => {
                          const res = deleteDailyLog(entry.id);
                          if (!res.ok) {
                            showToast(res.errorFa ?? 'مجوز حذف گزارش وجود ندارد.', 'warning');
                            return;
                          }
                          showToast('گزارش از دفتر روزانه حذف شد.', 'info');
                        }}
                        aria-label={`حذف گزارش ${entry.title}`}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 self-end sm:self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Precision A4 Print Table */}
        <div className="print-only">
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>ردیف</th>
                <th style={{ width: '13%' }}>تاریخ</th>
                <th style={{ width: '15%' }}>نوع واقعه</th>
                <th style={{ width: '20%' }}>دانش‌آموز / تحویل‌گیرنده</th>
                <th style={{ width: '10%' }}>ساعت خروج</th>
                <th style={{ width: '37%' }}>عنوان و شرح واقعه</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => {
                const st = log.studentId ? studentMap.get(log.studentId) : undefined;
                return (
                  <tr key={log.id}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="text-center tabular-nums">{toPersianDigits(log.jalaliDate)}</td>
                    <td>{CATEGORY_META[log.category].label}</td>
                    <td>
                      {st ? st.fullName : 'عمومی / اداری'}
                      {log.pickupPersonName ? ` — ${log.pickupPersonName} (${log.pickupRelation})` : ''}
                    </td>
                    <td className="text-center tabular-nums">
                      {log.exitTime ? toPersianDigits(log.exitTime) : '—'}
                    </td>
                    <td>
                      <strong>{log.title}:</strong> {log.description}
                    </td>
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
