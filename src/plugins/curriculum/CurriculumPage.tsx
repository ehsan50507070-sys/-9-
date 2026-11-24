// Add-on 6: Weekly Curriculum Pacing («بودجه‌بندی هفتگی») with 1-tap completion & A4 B&W checkbox printout
import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckSquare,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useToast } from '../../core/ui/ToastContext';
import { validateCurriculumTopicInput } from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import type { CurriculumTopic } from '../../types/domain';

const GRADES: Array<2 | 3 | 4 | 5 | 6> = [2, 3, 4, 5, 6];
const GRADE_NAMES: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: 'پایه دوم',
  3: 'پایه سوم',
  4: 'پایه چهارم',
  5: 'پایه پنجم',
  6: 'پایه ششم',
};

export const CurriculumPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    classes,
    curriculumTopics,
    toggleCurriculumClassCompletion,
    upsertCurriculumTopic,
    deleteCurriculumTopic,
  } = useSchoolData();
  const { showToast } = useToast();

  const availableGrades = useMemo(() => {
    const classGrades = new Set(classes.map((c) => c.gradeLevel));
    const list = GRADES.filter((g) => classGrades.has(g));
    return list.length > 0 ? list : GRADES;
  }, [classes]);

  const [selectedGrade, setSelectedGrade] = useState<2 | 3 | 4 | 5 | 6>(availableGrades[0] ?? 2);
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'فارسی' | 'ریاضی'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  // Add/Edit Topic form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubject, setFormSubject] = useState<'فارسی' | 'ریاضی'>('فارسی');
  const [formWeek, setFormWeek] = useState<number>(7);
  const [formTopic, setFormTopic] = useState('');
  const [formPages, setFormPages] = useState('');
  const [formObjectives, setFormObjectives] = useState('');

  const effectiveGrade = availableGrades.includes(selectedGrade)
    ? selectedGrade
    : availableGrades[0] ?? 2;

  const gradeClasses = useMemo(
    () => classes.filter((c) => c.gradeLevel === effectiveGrade),
    [classes, effectiveGrade]
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(gradeClasses[0]?.id ?? '');
  const effectiveClassId = gradeClasses.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : gradeClasses[0]?.id ?? '';

  const filteredTopics = useMemo(() => {
    return curriculumTopics
      .filter(
        (t) =>
          t.gradeLevel === effectiveGrade &&
          (subjectFilter === 'all' || t.subject === subjectFilter)
      )
      .sort((a, b) => a.weekNumber - b.weekNumber || a.subject.localeCompare(b.subject, 'fa'));
  }, [curriculumTopics, effectiveGrade, subjectFilter]);

  const progressStats = useMemo(() => {
    const bySubject = (subj: string) => {
      const items = curriculumTopics.filter(
        (t) => t.gradeLevel === effectiveGrade && t.subject === subj
      );
      const done = effectiveClassId
        ? items.filter((t) => t.completedClassIds.includes(effectiveClassId)).length
        : 0;
      const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
      return { total: items.length, done, pct };
    };
    const persian = bySubject('فارسی');
    const math = bySubject('ریاضی');
    const total = persian.total + math.total;
    const done = persian.done + math.done;
    return {
      persian,
      math,
      overallPct: total > 0 ? Math.round((done / total) * 100) : 0,
      overallDone: done,
      overallTotal: total,
    };
  }, [curriculumTopics, effectiveGrade, effectiveClassId]);

  const handleToggle = (topic: CurriculumTopic) => {
    if (!effectiveClassId || !roleDef.canManageCurriculum) return;
    const res = toggleCurriculumClassCompletion(topic.id, effectiveClassId);
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان تغییر وضعیت وجود ندارد.', 'error');
      return;
    }
    const nowDone = !topic.completedClassIds.includes(effectiveClassId);
    showToast(
      nowDone
        ? `مبحث هفته ${toPersianDigits(topic.weekNumber)} (${topic.subject}) تکمیل شد.`
        : `تیک تکمیل هفته ${toPersianDigits(topic.weekNumber)} برداشته شد.`,
      'info'
    );
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormSubject(subjectFilter === 'ریاضی' ? 'ریاضی' : 'فارسی');
    const maxWeek = filteredTopics.reduce((m, t) => Math.max(m, t.weekNumber), 0);
    setFormWeek(Math.min(36, maxWeek + 1));
    setFormTopic('');
    setFormPages('');
    setFormObjectives('');
    setModalOpen(true);
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateCurriculumTopicInput({
      subject: formSubject,
      weekNumber: formWeek,
      topic: formTopic,
    });
    if (!val.valid) {
      showToast(val.errors[0], 'error');
      return;
    }

    const existing = editingId ? curriculumTopics.find((t) => t.id === editingId) : undefined;
    const payload: CurriculumTopic = {
      id: editingId ?? `${activeSchoolId}:curr:${Date.now()}`,
      schoolId: activeSchoolId,
      gradeLevel: effectiveGrade,
      subject: formSubject,
      weekNumber: formWeek,
      topic: formTopic.trim(),
      pagesRef: formPages.trim() || undefined,
      objectives: formObjectives.trim() || undefined,
      completedClassIds: existing?.completedClassIds ?? [],
      updatedAt: new Date().toISOString(),
    };

    const res = upsertCurriculumTopic(payload);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت سرفصل.', 'error');
      return;
    }
    showToast('سرفصل بودجه‌بندی هفتگی ذخیره شد.');
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const res = deleteCurriculumTopic(id);
    if (!res.ok) {
      showToast(res.errorFa ?? 'عدم دسترسی جهت حذف.', 'error');
      return;
    }
    showToast('سرفصل از بودجه‌بندی حذف شد.', 'info');
  };

  const selectedClass = gradeClasses.find((c) => c.id === effectiveClassId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            بودجه‌بندی هفتگی فارسی و ریاضی (پایه دوم تا ششم)
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            پایش پیشرفت هفتگی کلاس‌ها با یک کلیک و چاپ فرم چک‌لیست A4 عمودی با مربع‌های تیک‌زنی دستی.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {roleDef.canManageCurriculum && (
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              افزودن سرفصل هفته
            </button>
          )}
          <PrintButtons documentLabel="برگه تیک‌دار بودجه‌بندی هفتگی" />
        </div>
      </div>

      {/* Filters & Live Progress Bars */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {availableGrades.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGrade(g)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  effectiveGrade === g
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {GRADE_NAMES[g]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              {(['all', 'فارسی', 'ریاضی'] as const).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSubjectFilter(subj)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                    subjectFilter === subj
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {subj === 'all' ? 'هر دو درس (فارسی و ریاضی)' : subj}
                </button>
              ))}
            </div>

            {gradeClasses.length > 0 && (
              <select
                aria-label="انتخاب کلاس جهت ثبت پیشرفت"
                value={effectiveClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {gradeClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Live Progress Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              درصد پیشرفت بودجه‌بندی ({GRADE_NAMES[effectiveGrade]})
            </span>
            <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
              {toPersianDigits(progressStats.overallPct)}٪
            </span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>فارسی</span>
                <span>
                  {toPersianDigits(progressStats.persian.done)} از{' '}
                  {toPersianDigits(progressStats.persian.total)} ({toPersianDigits(progressStats.persian.pct)}٪)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all"
                  style={{ width: `${progressStats.persian.pct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>ریاضی</span>
                <span>
                  {toPersianDigits(progressStats.math.done)} از{' '}
                  {toPersianDigits(progressStats.math.total)} ({toPersianDigits(progressStats.math.pct)}٪)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${progressStats.math.pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable A4 Portrait Pacing Sheet with crisp 14x14 B&W .print-checkbox squares */}
      <PrintShell
        school={activeSchool}
        documentTitle={`فرم بودجه‌بندی هفتگی فارسی و ریاضی — ${GRADE_NAMES[effectiveGrade]}`}
        subtitle={selectedClass ? `کلاس: ${selectedClass.name}` : undefined}
      >
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-3 text-center w-20">هفته</th>
                  <th className="py-3 px-3 w-24">درس</th>
                  <th className="py-3 px-4">مبحث و سرفصل آموزشی</th>
                  <th className="py-3 px-3 w-28">صفحات کتاب</th>
                  <th className="py-3 px-3 text-center w-28">وضعیت تدریس</th>
                  {activeRole !== 'teacher' && (
                    <th className="no-print py-3 px-3 text-center w-16">حذف</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredTopics.map((topic) => {
                  const isDone = effectiveClassId
                    ? topic.completedClassIds.includes(effectiveClassId)
                    : false;
                  return (
                    <tr
                      key={topic.id}
                      className={
                        isDone
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }
                    >
                      <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        هفته {toPersianDigits(topic.weekNumber)}
                      </td>
                      <td className="py-3 px-3 font-bold whitespace-nowrap">
                        <span
                          className={
                            topic.subject === 'ریاضی'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-indigo-700 dark:text-indigo-400'
                          }
                        >
                          {topic.subject}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {topic.topic}
                        </div>
                        {topic.objectives && (
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            هدف آموزشی: {topic.objectives}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {topic.pagesRef ? toPersianDigits(topic.pagesRef) : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {/* Interactive 1-tap toggle on screen */}
                        <button
                          type="button"
                          onClick={() => handleToggle(topic)}
                          aria-pressed={isDone}
                          aria-label={`تغییر وضعیت تکمیل ${topic.topic}`}
                          className={`no-print min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap ${
                            isDone
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              تدریس شد
                            </>
                          ) : (
                            <>
                              <Square className="w-4 h-4 text-slate-400" />
                              در برنامه
                            </>
                          )}
                        </button>

                        {/* Crisp 14x14 B&W empty pen-checkbox for A4 print */}
                        <span className="print-only">
                          <span className="print-checkbox" aria-hidden="true" />
                        </span>
                      </td>
                      {activeRole !== 'teacher' && (
                        <td className="no-print py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDelete(topic.id)}
                            aria-label={`حذف ${topic.topic}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredTopics.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      هنوز سرفصلی برای این فیلتر ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PrintShell>

      {/* Add Topic Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="curr-modal-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <form
            onSubmit={handleSaveTopic}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 id="curr-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                  افزودن سرفصل بودجه‌بندی ({GRADE_NAMES[effectiveGrade]})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  درس
                </label>
                <select
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value as 'فارسی' | 'ریاضی')}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="فارسی">فارسی</option>
                  <option value="ریاضی">ریاضی</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  شماره هفته (۱ تا ۳۶)
                </label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={formWeek}
                  onChange={(e) => setFormWeek(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                عنوان مبحث هفتگی
              </label>
              <input
                type="text"
                required
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="مثال: فصل سوم — جمع و تفریق کسرهای مساوی"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  صفحات کتاب درسی
                </label>
                <input
                  type="text"
                  value={formPages}
                  onChange={(e) => setFormPages(e.target.value)}
                  placeholder="مثال: ص ۵۵ تا ۶۴"
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  هدف آموزشی کوتاه
                </label>
                <input
                  type="text"
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                  placeholder="مثال: تسلط بر حل مسئله با رسم شکل"
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                ثبت سرفصل
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
