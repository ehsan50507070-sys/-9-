// Modal: Exam Builder («ساخت و ویرایش آزمون آنلاین») with 3 Seamless Question Sources
// 1) Auto-Import from Question Bank Exam Basket  2) Direct Question Bank Picker  3) Manual Entry (+ optional Save to Question Bank)
import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Database,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useToast } from '../../core/ui/ToastContext';
import { validateOnlineExamInput } from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  OnlineExam,
  OnlineExamQuestion,
  OnlineExamQuestionType,
  OnlineExamStatus,
  QuestionBankItem,
} from '../../types/domain';
import {
  computeTotalExamPoints,
  convertQuestionBankToExamQuestion,
  getExamQuestionTypeLabelFa,
} from './onlineExamHelpers';

interface ExamBuilderModalProps {
  initialExam?: OnlineExam | null;
  onClose: () => void;
  onSaved?: (examId: string) => void;
}

export const ExamBuilderModal: React.FC<ExamBuilderModalProps> = ({
  initialExam,
  onClose,
  onSaved,
}) => {
  const {
    activeSchoolId,
    activeRole,
    classes,
    teachers,
    linkedTeacher,
    session,
    questionBank,
    examQuestionBasket,
    clearExamBasket,
    upsertQuestionItem,
    upsertOnlineExam,
  } = useSchoolData();
  const { showToast } = useToast();

  const [title, setTitle] = useState(initialExam?.title ?? '');
  const [classId, setClassId] = useState(initialExam?.classId ?? classes[0]?.id ?? '');
  const [subject, setSubject] = useState(
    initialExam?.subject ?? linkedTeacher?.specialty ?? 'ریاضی'
  );
  const [startDateJalali, setStartDateJalali] = useState(
    initialExam?.startDateJalali ?? getTodayJalali()
  );
  const [endDateJalali, setEndDateJalali] = useState(
    initialExam?.endDateJalali ?? getTodayJalali()
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialExam?.durationMinutes ?? 20
  );
  const [randomizeOrder, setRandomizeOrder] = useState<boolean>(
    initialExam?.randomizeOrder ?? false
  );
  const [showResultImmediately, setShowResultImmediately] = useState<boolean>(
    initialExam?.showResultImmediately ?? true
  );
  const [status, setStatus] = useState<OnlineExamStatus>(initialExam?.status ?? 'published');
  const [description, setDescription] = useState(initialExam?.description ?? '');

  const [questions, setQuestions] = useState<OnlineExamQuestion[]>(
    initialExam?.questions ?? []
  );

  // Source Panel Tabs: 'basket' | 'picker' | 'manual'
  const [sourceTab, setSourceTab] = useState<'basket' | 'picker' | 'manual'>(
    examQuestionBasket.length > 0 ? 'basket' : 'picker'
  );
  const [clearBasketOnImport, setClearBasketOnImport] = useState(true);

  // Direct Question Bank Picker filters
  const [qbSearch, setQbSearch] = useState('');
  const [qbSubjectFilter, setQbSubjectFilter] = useState('all');

  // Manual Question Draft State
  const [manualType, setManualType] = useState<OnlineExamQuestionType>('multiple_choice');
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState<number>(2);
  const [manualOptions, setManualOptions] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [manualCorrectIdx, setManualCorrectIdx] = useState<number>(0);
  const [manualTrueFalse, setManualTrueFalse] = useState<boolean>(true);
  const [manualAcceptedAnswers, setManualAcceptedAnswers] = useState('');
  const [manualModelAnswer, setManualModelAnswer] = useState('');
  const [saveAlsoToQuestionBank, setSaveAlsoToQuestionBank] = useState<boolean>(true);

  const basketQuestions = useMemo(() => {
    const qMap = new Map(questionBank.map((q) => [q.id, q]));
    return examQuestionBasket
      .map((item) => qMap.get(item.questionId))
      .filter((q): q is QuestionBankItem => Boolean(q));
  }, [examQuestionBasket, questionBank]);

  const qbSubjects = useMemo(() => {
    return Array.from(new Set(questionBank.map((q) => q.subject)));
  }, [questionBank]);

  const filteredQuestionBank = useMemo(() => {
    return questionBank.filter((q) => {
      if (qbSubjectFilter !== 'all' && q.subject !== qbSubjectFilter) return false;
      if (qbSearch.trim()) {
        const needle = qbSearch.trim().toLowerCase();
        return (
          q.questionText.toLowerCase().includes(needle) ||
          q.chapter.toLowerCase().includes(needle) ||
          q.subject.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [questionBank, qbSearch, qbSubjectFilter]);

  const totalPoints = useMemo(() => computeTotalExamPoints(questions), [questions]);

  const handleImportFromBasket = () => {
    if (basketQuestions.length === 0) {
      showToast('سبد آزمون بانک سوالات خالی است.', 'error');
      return;
    }
    const existingSourceIds = new Set(
      questions.map((q) => q.sourceQuestionBankId).filter(Boolean)
    );
    const toAdd = basketQuestions
      .filter((qb) => !existingSourceIds.has(qb.id))
      .map((qb) => convertQuestionBankToExamQuestion(qb, 2));

    if (toAdd.length === 0) {
      showToast('همه سوالات سبد آزمون قبلاً به این آزمون اضافه شده‌اند.');
      return;
    }
    setQuestions((prev) => [...prev, ...toAdd]);
    if (clearBasketOnImport) {
      clearExamBasket();
    }
    showToast(`${toPersianDigits(toAdd.length)} سوال از سبد آزمون بانک سوالات وارد شد.`);
  };

  const handlePickQuestionBankItem = (qb: QuestionBankItem) => {
    if (questions.some((q) => q.sourceQuestionBankId === qb.id)) {
      showToast('این سوال قبلاً در لیست سوالات آزمون وجود دارد.');
      return;
    }
    setQuestions((prev) => [...prev, convertQuestionBankToExamQuestion(qb, 2)]);
    showToast('سوال از بانک سوالات به آزمون اضافه شد.');
  };

  const handleAddManualQuestion = () => {
    if (manualText.trim().length < 5) {
      showToast('متن سوال جدید باید حداقل ۵ کاراکتر باشد.', 'error');
      return;
    }
    if (manualType === 'multiple_choice' && manualOptions.some((o) => !o.trim())) {
      showToast('برای سوال چهارگزینه‌ای هر ۴ گزینه را کامل وارد کنید.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    let qbId: string | undefined;

    if (saveAlsoToQuestionBank) {
      const selectedClass = classes.find((c) => c.id === classId);
      qbId = `${activeSchoolId}:qb:${Date.now()}`;
      const qbItem: QuestionBankItem = {
        id: qbId,
        schoolId: activeSchoolId,
        gradeLevel: selectedClass?.gradeLevel ?? 4,
        gradeLabel: selectedClass?.customGradeLabel ?? selectedClass?.name ?? 'عمومی',
        subject: subject.trim() || 'عمومی',
        chapter: title.trim() || 'آزمون آنلاین',
        difficulty: 'medium',
        type: manualType,
        questionText: manualText.trim(),
        options:
          manualType === 'multiple_choice'
            ? [
                manualOptions[0].trim(),
                manualOptions[1].trim(),
                manualOptions[2].trim(),
                manualOptions[3].trim(),
              ]
            : undefined,
        correctOptionIndex: manualType === 'multiple_choice' ? manualCorrectIdx : undefined,
        trueFalseAnswer: manualType === 'true_false' ? manualTrueFalse : undefined,
        modelAnswer:
          manualType === 'fill_blank'
            ? manualAcceptedAnswers.trim()
            : manualModelAnswer.trim() || undefined,
        createdById: linkedTeacher?.id ?? session?.userId ?? 'teacher-1',
        createdByName: linkedTeacher?.fullName ?? session?.displayName ?? 'معلم',
        createdByRole: activeRole,
        createdAtJalali: getTodayJalali(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      upsertQuestionItem(qbItem);
    }

    const newExamQ: OnlineExamQuestion = {
      id: `exq-manual-${Date.now()}`,
      type: manualType,
      questionText: manualText.trim(),
      points: Math.max(0.25, Number(manualPoints) || 1),
      options:
        manualType === 'multiple_choice'
          ? [
              manualOptions[0].trim(),
              manualOptions[1].trim(),
              manualOptions[2].trim(),
              manualOptions[3].trim(),
            ]
          : undefined,
      correctOptionIndex: manualType === 'multiple_choice' ? manualCorrectIdx : undefined,
      trueFalseAnswer: manualType === 'true_false' ? manualTrueFalse : undefined,
      acceptedAnswers:
        manualType === 'fill_blank'
          ? manualAcceptedAnswers
              .split(/[،,/|]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      modelAnswer: manualModelAnswer.trim() || undefined,
      sourceQuestionBankId: qbId,
    };

    setQuestions((prev) => [...prev, newExamQ]);
    setManualText('');
    setManualOptions(['', '', '', '']);
    setManualAcceptedAnswers('');
    setManualModelAnswer('');
    showToast(
      saveAlsoToQuestionBank
        ? 'سوال جدید به آزمون اضافه شد و همزمان در بانک سوالات ذخیره گردید.'
        : 'سوال جدید به آزمون اضافه شد.'
    );
  };

  const handleUpdateQuestionPoints = (qId: string, pts: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, points: Math.max(0.25, pts || 0.25) } : q))
    );
  };

  const handleRemoveQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateOnlineExamInput({
      title,
      classId,
      subject,
      startDateJalali,
      endDateJalali,
      durationMinutes,
      questionCount: questions.length,
    });
    if (!validation.valid) {
      showToast(validation.errors[0] ?? 'اطلاعات آزمون ناقص است.', 'error');
      return;
    }

    const teacherObj = linkedTeacher ?? teachers[0];
    const nowIso = new Date().toISOString();
    const examRecord: OnlineExam = {
      id: initialExam?.id ?? `${activeSchoolId}:exam:${Date.now()}`,
      schoolId: activeSchoolId,
      classId,
      teacherId: teacherObj?.id ?? 'teacher-admin',
      teacherName: teacherObj?.fullName ?? session?.displayName ?? 'معلم',
      subject: subject.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      startDateJalali: startDateJalali.trim(),
      endDateJalali: endDateJalali.trim(),
      durationMinutes: Math.max(3, Math.floor(durationMinutes)),
      randomizeOrder,
      showResultImmediately,
      status,
      questions,
      totalPoints: computeTotalExamPoints(questions),
      gradebookSyncedAt: initialExam?.gradebookSyncedAt,
      createdAtJalali: initialExam?.createdAtJalali ?? getTodayJalali(),
      createdAt: initialExam?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    const res = upsertOnlineExam(examRecord);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ذخیره آزمون انجام نشد.', 'error');
      return;
    }
    showToast(`آزمون آنلاین «${examRecord.title}» با موفقیت ذخیره شد.`);
    onSaved?.(examRecord.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="ساخت و ویرایش آزمون آنلاین"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {initialExam ? 'ویرایش آزمون آنلاین' : 'ساخت آزمون آنلاین جدید'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {toPersianDigits(questions.length)} سوال انتخاب‌شده · جمع بارم:{' '}
              <strong>{toPersianDigits(totalPoints)} نمره</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveExam} className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Exam Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">عنوان آزمون *</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: آزمون فصل ۴ ریاضی (کسرها)"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">وضعیت انتشار</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OnlineExamStatus)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="published">منتشرشده (فعال برای دانش‌آموز)</option>
                <option value="draft">پیش‌نویس</option>
                <option value="ended">پایان‌یافته</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">کلاس *</span>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">نام درس *</span>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">مدت زمان (دقیقه) *</span>
              <input
                type="number"
                min={3}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">تاریخ شروع (شمسی)</span>
              <input
                type="text"
                dir="ltr"
                value={startDateJalali}
                onChange={(e) => setStartDateJalali(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">تاریخ پایان (شمسی)</span>
              <input
                type="text"
                dir="ltr"
                value={endDateJalali}
                onChange={(e) => setEndDateJalali(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">توضیحات راهنما</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="نکات قبل از شروع آزمون..."
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-700 dark:text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeOrder}
                onChange={(e) => setRandomizeOrder(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="font-semibold">چیدمان تصادفی سوالات برای هر دانش‌آموز</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResultImmediately}
                onChange={(e) => setShowResultImmediately(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="font-semibold">نمایش فوری نتیجه سوالات تستی پس از ثبت آزمون</span>
            </label>
          </div>

          {/* 3 Seamless Question Sources */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={() => setSourceTab('basket')}
                className={`min-h-[44px] px-4 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition-colors ${
                  sourceTab === 'basket'
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400'
                }`}
              >
                <ShoppingBasket className="w-4 h-4" />
                <span>ورود خودکار از سبد آزمون بانک سوالات</span>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {toPersianDigits(basketQuestions.length)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSourceTab('picker')}
                className={`min-h-[44px] px-4 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition-colors ${
                  sourceTab === 'picker'
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>انتخاب مستقیم از بانک سوالات ({toPersianDigits(questionBank.length)})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceTab('manual')}
                className={`min-h-[44px] px-4 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition-colors ${
                  sourceTab === 'manual'
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>افزودن سوال جدید دستی</span>
              </button>
            </div>

            <div className="p-4">
              {/* Tab 1: Auto-Import from Question Bank Exam Basket */}
              {sourceTab === 'basket' && (
                <div className="space-y-3">
                  {basketQuestions.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      در حال حاضر سوالی در سبد آزمون بانک سوالات («question-bank») قرار ندارد. می‌توانید از تب «انتخاب مستقیم از بانک سوالات» یا «افزودن سوال جدید دستی» استفاده کنید.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearBasketOnImport}
                            onChange={(e) => setClearBasketOnImport(e.target.checked)}
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span>پاک‌سازی سبد آزمون پس از ورود خودکار سوالات</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleImportFromBasket}
                          className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <ShoppingBasket className="w-4 h-4" />
                          <span>
                            ورود همه {toPersianDigits(basketQuestions.length)} سوال سبد به آزمون
                          </span>
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
                        {basketQuestions.map((qb) => (
                          <div key={qb.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-800 dark:text-slate-200 truncate">
                              <strong>{qb.subject}:</strong> {qb.questionText}
                            </span>
                            <span className="text-slate-400 shrink-0">{qb.chapter}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab 2: Direct Inline Question Bank Picker */}
              {sourceTab === 'picker' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={qbSearch}
                        onChange={(e) => setQbSearch(e.target.value)}
                        placeholder="جستجو در متن سوال یا فصل..."
                        className="w-full min-h-[38px] pr-9 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <select
                      value={qbSubjectFilter}
                      onChange={(e) => setQbSubjectFilter(e.target.value)}
                      aria-label="فیلتر درس بانک سوالات"
                      className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="all">همه دروس</option>
                      {qbSubjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                    {filteredQuestionBank.length === 0 ? (
                      <p className="py-3 text-xs text-slate-500">سوالی با این فیلتر یافت نشد.</p>
                    ) : (
                      filteredQuestionBank.map((qb) => {
                        const alreadyAdded = questions.some(
                          (q) => q.sourceQuestionBankId === qb.id
                        );
                        return (
                          <div
                            key={qb.id}
                            className="py-2.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {qb.questionText}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {qb.subject} · {qb.chapter} · {qb.gradeLabel}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handlePickQuestionBankItem(qb)}
                              className={`min-h-[34px] px-3 rounded-lg font-bold shrink-0 ${
                                alreadyAdded
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                              }`}
                            >
                              {alreadyAdded ? 'اضافه شد' : '+ افزودن'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Manual Question Entry + Optional Save to Question Bank */}
              {sourceTab === 'manual' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1 sm:col-span-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">نوع سوال</span>
                      <select
                        value={manualType}
                        onChange={(e) => setManualType(e.target.value as OnlineExamQuestionType)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="multiple_choice">چهارگزینه‌ای (تصحیح خودکار)</option>
                        <option value="true_false">صحیح / غلط (تصحیح خودکار)</option>
                        <option value="fill_blank">جای خالی (تصحیح خودکار هوشمند)</option>
                        <option value="descriptive">تشریحی (پاسخ متنی + عکس دست‌نویس)</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">بارم سوال</span>
                      <input
                        type="number"
                        step={0.25}
                        min={0.25}
                        max={20}
                        value={manualPoints}
                        onChange={(e) => setManualPoints(Number(e.target.value))}
                        className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                      />
                    </label>
                  </div>

                  <textarea
                    rows={2}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="صورت سوال را بنویسید..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100"
                  />

                  {manualType === 'multiple_choice' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {manualOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="manual-correct-opt"
                            checked={manualCorrectIdx === idx}
                            onChange={() => setManualCorrectIdx(idx)}
                            aria-label={`گزینه صحیح ${idx + 1}`}
                            className="accent-emerald-600"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              setManualOptions((prev) => {
                                const next = [...prev] as [string, string, string, string];
                                next[idx] = e.target.value;
                                return next;
                              })
                            }
                            placeholder={`گزینه ${toPersianDigits(idx + 1)}`}
                            className="flex-1 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {manualType === 'true_false' && (
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">پاسخ صحیح:</span>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={manualTrueFalse === true}
                          onChange={() => setManualTrueFalse(true)}
                          className="accent-emerald-600"
                        />
                        <span>صحیح</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={manualTrueFalse === false}
                          onChange={() => setManualTrueFalse(false)}
                          className="accent-rose-600"
                        />
                        <span>غلط</span>
                      </label>
                    </div>
                  )}

                  {manualType === 'fill_blank' && (
                    <input
                      type="text"
                      value={manualAcceptedAnswers}
                      onChange={(e) => setManualAcceptedAnswers(e.target.value)}
                      placeholder="پاسخ‌های صحیح قابل قبول (با کاما جدا کنید، مثلاً: ۱/۲، نصف، 0.5)"
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100"
                    />
                  )}

                  {manualType === 'descriptive' && (
                    <input
                      type="text"
                      value={manualModelAnswer}
                      onChange={(e) => setManualModelAnswer(e.target.value)}
                      placeholder="پاسخ تشریحی نمونه برای راهنمای تصحیح (اختیاری)..."
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100"
                    />
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAlsoToQuestionBank}
                        onChange={(e) => setSaveAlsoToQuestionBank(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="font-semibold">ذخیره همزمان در بانک سوالات مدرسه</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddManualQuestion}
                      className="min-h-[38px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن سوال به آزمون</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Current Exam Questions List with Per-Question Points */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                <BookOpenCheck className="w-4 h-4 text-indigo-600" />
                <span>سوالات فعلی آزمون ({toPersianDigits(questions.length)} سوال)</span>
              </div>
              <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                مجموع بارم: {toPersianDigits(totalPoints)} نمره
              </span>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-xs text-slate-500">
                هنوز سوالی به آزمون اضافه نشده است. از سبد آزمون، بانک سوالات یا فرم دستی سوال اضافه کنید.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 px-3">
                {questions.map((q, idx) => (
                  <div key={q.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {toPersianDigits(idx + 1)}. {q.questionText}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {getExamQuestionTypeLabelFa(q.type)}
                        {q.sourceQuestionBankId ? ' · متصل به بانک سوالات' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span>بارم:</span>
                        <input
                          type="number"
                          step={0.25}
                          min={0.25}
                          max={20}
                          value={q.points}
                          onChange={(e) => handleUpdateQuestionPoints(q.id, Number(e.target.value))}
                          className="w-16 min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-center text-xs font-bold tabular-nums"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(q.id)}
                        aria-label="حذف سوال"
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold"
            >
              ذخیره و انتشار آزمون آنلاین
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
