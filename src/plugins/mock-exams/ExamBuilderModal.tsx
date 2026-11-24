// Enterprise Mock & Konkur Exam & Multi-Booklet Builder Modal (Phase 9A)
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  MockAnswerOption,
  MockExam,
  MockExamBooklet,
  MockExamMode,
  MockExamQuestion,
  MockExamScope,
  MockExamStatus,
  MockExamSubject,
  MockExamTrack,
  MockQuestionDifficulty,
  NegativeMarkingRule,
} from '../../types/domain';
import { DEFAULT_COMPLEX_ID, GLOBAL_TENANT_ID } from '../../core/super-admin/superAdminHelpers';
import { TRACK_PRESETS } from './statsEngine';

interface ExamBuilderModalProps {
  initialExam?: MockExam | null;
  activeSchoolId: string;
  activeComplexId: string;
  academicYearId: string;
  currentUserId: string;
  canCreateComplexScope: boolean;
  onSave: (exam: MockExam) => Promise<{ ok: boolean; errorFa?: string }>;
  onClose: () => void;
}

interface EditableBooklet {
  id: string;
  title: string;
  durationMinutes: number;
}

interface EditableSubject {
  id: string;
  bookletId: string;
  subjectName: string;
  coefficient: number;
  questionCount: number;
  defaultTopics: string[];
}

function buildFromTrackPreset(
  track: MockExamTrack,
  examIdPrefix: string
): {
  booklets: EditableBooklet[];
  subjects: EditableSubject[];
  questions: MockExamQuestion[];
} {
  const preset = TRACK_PRESETS[track];
  const booklets: EditableBooklet[] = preset.booklets.map((b, idx) => ({
    id: `${examIdPrefix}-b${idx + 1}`,
    title: b.title,
    durationMinutes: b.durationMinutes,
  }));

  const subjects: EditableSubject[] = preset.subjects.map((s, idx) => ({
    id: `${examIdPrefix}-s${idx + 1}`,
    bookletId: booklets[s.bookletIndex]?.id ?? booklets[0].id,
    subjectName: s.subjectName,
    coefficient: s.coefficient,
    questionCount: s.questionCount,
    defaultTopics: s.defaultTopics,
  }));

  const questions: MockExamQuestion[] = [];
  let qNum = 1;
  const diffs: MockQuestionDifficulty[] = ['easy', 'medium', 'medium', 'hard'];
  for (const subj of subjects) {
    for (let i = 0; i < subj.questionCount; i++) {
      const topic = subj.defaultTopics[i % subj.defaultTopics.length] ?? 'مبحث عمومی';
      const correctOption = (((qNum * 3 + i) % 4) + 1) as MockAnswerOption;
      questions.push({
        questionNumber: qNum,
        subjectId: subj.id,
        correctOption,
        topic,
        difficulty: diffs[i % diffs.length],
        questionText: '',
        options: undefined,
        solutionText: '',
      });
      qNum++;
    }
  }

  return { booklets, subjects, questions };
}

function syncQuestionsToSubjects(
  subjects: EditableSubject[],
  existingQuestions: MockExamQuestion[]
): MockExamQuestion[] {
  const bySubject = new Map<string, MockExamQuestion[]>();
  for (const q of existingQuestions) {
    const arr = bySubject.get(q.subjectId) ?? [];
    arr.push(q);
    bySubject.set(q.subjectId, arr);
  }

  const next: MockExamQuestion[] = [];
  let qNum = 1;
  for (const subj of subjects) {
    const prevList = bySubject.get(subj.id) ?? [];
    const count = Math.max(1, Math.min(60, subj.questionCount));
    for (let i = 0; i < count; i++) {
      const prev = prevList[i];
      if (prev) {
        next.push({
          ...prev,
          questionNumber: qNum,
          subjectId: subj.id,
        });
      } else {
        const topic = subj.defaultTopics[i % Math.max(1, subj.defaultTopics.length)] ?? 'مبحث اصلی';
        next.push({
          questionNumber: qNum,
          subjectId: subj.id,
          correctOption: (((qNum % 4) + 1) as MockAnswerOption),
          topic,
          difficulty: 'medium',
        });
      }
      qNum++;
    }
  }
  return next;
}

export const ExamBuilderModal: React.FC<ExamBuilderModalProps> = ({
  initialExam,
  activeSchoolId,
  activeComplexId,
  academicYearId,
  currentUserId,
  canCreateComplexScope,
  onSave,
  onClose,
}) => {
  const isEditing = Boolean(initialExam);
  const examId = useMemo(
    () => initialExam?.id ?? `mock-exam-${Date.now()}`,
    [initialExam?.id]
  );

  const initialPreset = useMemo(() => {
    if (initialExam) {
      const booklets: EditableBooklet[] = initialExam.booklets.map((b) => ({
        id: b.id,
        title: b.title,
        durationMinutes: b.durationMinutes,
      }));
      const subjects: EditableSubject[] = initialExam.subjects.map((s) => ({
        id: s.id,
        bookletId: s.bookletId,
        subjectName: s.subjectName,
        coefficient: s.coefficient,
        questionCount: Math.max(1, s.questionEnd - s.questionStart + 1),
        defaultTopics: ['مبحث ۱', 'مبحث ۲'],
      }));
      return {
        booklets,
        subjects,
        questions: [...initialExam.questions].sort((a, b) => a.questionNumber - b.questionNumber),
      };
    }
    return buildFromTrackPreset('experimental_sciences', examId);
  }, [initialExam, examId]);

  const [title, setTitle] = useState(
    initialExam?.title ?? 'آزمون آزمایشی جامع مرحله جدید'
  );
  const [stageLabelFa, setStageLabelFa] = useState(
    initialExam?.stageLabelFa ?? 'مرحله ۵ — فروردین'
  );
  const [examDateJalali, setExamDateJalali] = useState(
    initialExam?.examDateJalali ?? getTodayJalali()
  );
  const [scope, setScope] = useState<MockExamScope>(
    initialExam?.scope ?? (canCreateComplexScope ? 'complex' : 'school')
  );
  const [track, setTrack] = useState<MockExamTrack>(
    initialExam?.track ?? 'experimental_sciences'
  );
  const [negativeMarking, setNegativeMarking] = useState<NegativeMarkingRule>(
    initialExam?.negativeMarking ?? 'three_to_one'
  );
  const [mode, setMode] = useState<MockExamMode>(initialExam?.mode ?? 'online_full');
  const [status, setStatus] = useState<MockExamStatus>(initialExam?.status ?? 'active');
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(
    initialExam?.shuffleOptions ?? false
  );
  const [booklets, setBooklets] = useState<EditableBooklet[]>(initialPreset.booklets);
  const [subjects, setSubjects] = useState<EditableSubject[]>(initialPreset.subjects);
  const [questions, setQuestions] = useState<MockExamQuestion[]>(initialPreset.questions);
  const [quickKeyString, setQuickKeyString] = useState('');
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [questionFilterSubjectId, setQuestionFilterSubjectId] = useState<string>('all');
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTrackChange = (nextTrack: MockExamTrack) => {
    setTrack(nextTrack);
    const built = buildFromTrackPreset(nextTrack, examId);
    setBooklets(built.booklets);
    setSubjects(built.subjects);
    setQuestions(built.questions);
  };

  const handleModeChange = (nextMode: MockExamMode) => {
    setMode(nextMode);
    if (nextMode === 'answer_key_only') {
      setShuffleOptions(false);
    }
  };

  const handleAddBooklet = () => {
    const nextIdx = booklets.length + 1;
    setBooklets((prev) => [
      ...prev,
      {
        id: `${examId}-b${Date.now()}`,
        title: `دفترچه شماره ${toPersianDigits(nextIdx)}`,
        durationMinutes: 40,
      },
    ]);
  };

  const handleRemoveBooklet = (bookletId: string) => {
    if (booklets.length <= 1) return;
    const remaining = booklets.filter((b) => b.id !== bookletId);
    const fallbackBookletId = remaining[0].id;
    setBooklets(remaining);
    setSubjects((prev) =>
      prev.map((s) => (s.bookletId === bookletId ? { ...s, bookletId: fallbackBookletId } : s))
    );
  };

  const handleAddSubject = () => {
    const newSubj: EditableSubject = {
      id: `${examId}-s${Date.now()}`,
      bookletId: booklets[0]?.id ?? '',
      subjectName: `درس جدید ${toPersianDigits(subjects.length + 1)}`,
      coefficient: 2,
      questionCount: 5,
      defaultTopics: ['مبحث اصلی'],
    };
    const nextSubjects = [...subjects, newSubj];
    setSubjects(nextSubjects);
    setQuestions((prev) => syncQuestionsToSubjects(nextSubjects, prev));
  };

  const handleUpdateSubject = (id: string, patch: Partial<EditableSubject>) => {
    const nextSubjects = subjects.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setSubjects(nextSubjects);
    if (patch.questionCount !== undefined) {
      setQuestions((prev) => syncQuestionsToSubjects(nextSubjects, prev));
    }
  };

  const handleRemoveSubject = (id: string) => {
    if (subjects.length <= 1) return;
    const nextSubjects = subjects.filter((s) => s.id !== id);
    setSubjects(nextSubjects);
    setQuestions((prev) => syncQuestionsToSubjects(nextSubjects, prev));
  };

  const handleApplyQuickKey = () => {
    const digits = toAsciiDigits(quickKeyString).replace(/[^1-4]/g, '');
    if (!digits) {
      setErrorFa('رشته کلید معتبر نیست. فقط اعداد ۱ تا ۴ را پشت سر هم وارد کنید.');
      return;
    }
    setErrorFa(null);
    setQuestions((prev) =>
      prev.map((q, idx) => {
        const ch = digits[idx];
        if (!ch) return q;
        return { ...q, correctOption: Number(ch) as MockAnswerOption };
      })
    );
    setQuickKeyString('');
  };

  const updateQuestion = (qNum: number, patch: Partial<MockExamQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.questionNumber === qNum ? { ...q, ...patch } : q))
    );
  };

  const visibleQuestions = useMemo(() => {
    if (questionFilterSubjectId === 'all') return questions;
    return questions.filter((q) => q.subjectId === questionFilterSubjectId);
  }, [questions, questionFilterSubjectId]);

  const subjectNameMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.subjectName])),
    [subjects]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFa(null);

    if (title.trim().length < 3) {
      setErrorFa('عنوان آزمون باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (booklets.length === 0 || subjects.length === 0) {
      setErrorFa('حداقل یک دفترچه و یک درس برای آزمون الزامی است.');
      return;
    }

    const effectiveScope: MockExamScope = canCreateComplexScope ? scope : 'school';
    const syncedQuestions = syncQuestionsToSubjects(subjects, questions);

    // Build subject question ranges
    let cursor = 1;
    const finalSubjects: MockExamSubject[] = subjects.map((s) => {
      const count = Math.max(1, Math.min(60, s.questionCount));
      const questionStart = cursor;
      const questionEnd = cursor + count - 1;
      cursor = questionEnd + 1;
      return {
        id: s.id,
        bookletId: s.bookletId,
        subjectName: s.subjectName.trim() || 'درس',
        coefficient: Math.max(1, Math.min(12, Math.round(s.coefficient))),
        questionStart,
        questionEnd,
      };
    });

    const finalBooklets: MockExamBooklet[] = booklets.map((b, idx) => ({
      id: b.id,
      title: b.title.trim() || `دفترچه ${toPersianDigits(idx + 1)}`,
      durationMinutes: Math.max(5, Math.min(240, Math.round(b.durationMinutes))),
      orderIndex: idx,
    }));

    const parsedStageMatch = toAsciiDigits(stageLabelFa).match(/\d+/);
    const stageNumber = initialExam?.stageNumber ?? (parsedStageMatch ? Number(parsedStageMatch[0]) : 5);

    const nowIso = new Date().toISOString();
    const payload: MockExam = {
      id: examId,
      complexId: activeComplexId || DEFAULT_COMPLEX_ID,
      schoolId: effectiveScope === 'complex' ? GLOBAL_TENANT_ID : activeSchoolId,
      academicYearId,
      createdByUserId: initialExam?.createdByUserId ?? currentUserId,
      createdAtIso: initialExam?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso,
      title: title.trim(),
      stageNumber,
      stageLabelFa: stageLabelFa.trim() || 'مرحله آزمون',
      examDateJalali: toAsciiDigits(examDateJalali).trim() || getTodayJalali(),
      scope: effectiveScope,
      track,
      negativeMarking,
      mode,
      status,
      shuffleOptions: mode === 'online_full' ? shuffleOptions : false,
      booklets: finalBooklets,
      subjects: finalSubjects,
      questions: syncedQuestions,
    };

    setSaving(true);
    const res = await onSave(payload);
    setSaving(false);
    if (!res.ok) {
      setErrorFa(res.errorFa ?? 'ذخیره آزمون با خطا مواجه شد.');
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'ویرایش آزمون آزمایشی' : 'طراحی آزمون آزمایشی جدید'}
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 brand-text shrink-0" />
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {isEditing ? 'ویرایش ساختار و کلید آزمون آزمایشی' : 'ثبت و طراحی آزمون آزمایشی / کنکوری جدید'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تنظیم دفترچه‌ها، ضرایب دروس کنکوری، نمره منفی و کلید پاسخ‌نامه ({toPersianDigits(questions.length)} سوال)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-6">
          {errorFa && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {errorFa}
            </div>
          )}

          {/* Section 1: Core Exam Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                عنوان آزمون
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: آزمون جامع مرحله ۴ — هماهنگ مجموعه"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                برچسب مرحله / نوبت
              </label>
              <input
                type="text"
                value={stageLabelFa}
                onChange={(e) => setStageLabelFa(e.target.value)}
                placeholder="مثلاً: مرحله ۴ — اسفند"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                تاریخ برگزاری (شمسی)
              </label>
              <input
                type="text"
                dir="ltr"
                value={examDateJalali}
                onChange={(e) => setExamDateJalali(e.target.value)}
                placeholder="1404/12/15"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                گروه آزمایشی / الگو
              </label>
              <select
                value={track}
                onChange={(e) => handleTrackChange(e.target.value as MockExamTrack)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {(Object.keys(TRACK_PRESETS) as MockExamTrack[]).map((t) => (
                  <option key={t} value={t}>
                    {TRACK_PRESETS[t].labelFa}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                قانون نمره منفی
              </label>
              <select
                value={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.value as NegativeMarkingRule)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="three_to_one">استاندارد کنکور (۳ غلط = ۱ درست منفی)</option>
                <option value="four_to_one">سبک (۴ غلط = ۱ درست منفی)</option>
                <option value="none">بدون نمره منفی</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                نحوه برگزاری و نمایش سوال
              </label>
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as MockExamMode)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="online_full">آزمون آنلاین کامل (متن سوال + پاسخبرگ)</option>
                <option value="answer_key_only">پاسخبرگ و کلید (دفترچه کاغذی / PDF)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                وضعیت آزمون
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MockExamStatus)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="draft">پیش‌نویس (مخفی از دانش‌آموز)</option>
                <option value="active">فعال (قابل شرکت برای دانش‌آموزان)</option>
                <option value="published">منتشر شده (کارنامه و تراز قابل مشاهده)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                گستره برگزاری
              </label>
              <select
                value={canCreateComplexScope ? scope : 'school'}
                disabled={!canCreateComplexScope}
                onChange={(e) => setScope(e.target.value as MockExamScope)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="school">آزمون مستقل مدرسه فعال</option>
                {canCreateComplexScope && (
                  <option value="complex">آزمون هماهنگ سراسری (تراز و رتبه کل مجموعه)</option>
                )}
              </select>
            </div>
          </div>

          {/* Option Shuffling toggle */}
          <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              disabled={mode === 'answer_key_only'}
              checked={mode === 'online_full' && shuffleOptions}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <span>
              بهم‌ریزی قطعی ترتیب گزینه‌ها برای هر دانش‌آموز در آزمون آنلاین (در حالت دفترچه کاغذی به‌طور خودکار غیرفعال است)
            </span>
          </label>

          {/* Section 2: Booklets */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                دفترچه‌ها و زمان‌بندی مستقل هر دفترچه
              </h3>
              <button
                type="button"
                onClick={handleAddBooklet}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                افزودن دفترچه
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {booklets.map((b, idx) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center gap-2.5"
                >
                  <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">
                    #{toPersianDigits(idx + 1)}
                  </span>
                  <input
                    type="text"
                    value={b.title}
                    onChange={(e) =>
                      setBooklets((prev) =>
                        prev.map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x))
                      )
                    }
                    className="flex-1 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={b.durationMinutes}
                      onChange={(e) =>
                        setBooklets((prev) =>
                          prev.map((x) =>
                            x.id === b.id ? { ...x, durationMinutes: Number(e.target.value) } : x
                          )
                        )
                      }
                      className="w-16 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-center tabular-nums"
                    />
                    <span className="text-[11px] text-slate-500">دقیقه</span>
                  </div>
                  {booklets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBooklet(b.id)}
                      aria-label="حذف دفترچه"
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Subjects & Coefficients */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                دروس آزمون، ضرایب کنکوری و تعداد سوالات
              </h3>
              <button
                type="button"
                onClick={handleAddSubject}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                افزودن درس
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">نام درس</th>
                    <th className="py-2.5 px-3 font-bold">دفترچه</th>
                    <th className="py-2.5 px-3 font-bold w-24">ضریب</th>
                    <th className="py-2.5 px-3 font-bold w-28">تعداد سوال</th>
                    <th className="py-2.5 px-3 font-bold w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2">
                        <input
                          type="text"
                          value={s.subjectName}
                          onChange={(e) =>
                            handleUpdateSubject(s.id, { subjectName: e.target.value })
                          }
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={s.bookletId}
                          onChange={(e) => handleUpdateSubject(s.id, { bookletId: e.target.value })}
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                        >
                          {booklets.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={s.coefficient}
                          onChange={(e) =>
                            handleUpdateSubject(s.id, { coefficient: Number(e.target.value) })
                          }
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-center tabular-nums"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={s.questionCount}
                          onChange={(e) =>
                            handleUpdateSubject(s.id, { questionCount: Number(e.target.value) })
                          }
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-center tabular-nums"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {subjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(s.id)}
                            aria-label="حذف درس"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Quick Answer Key String + Collapsible Per-Question Editor */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                کلید سوالات، مباحث درسی و سطح دشواری ({toPersianDigits(questions.length)} سوال)
              </h3>
              <button
                type="button"
                onClick={() => setShowQuestionEditor((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {showQuestionEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showQuestionEditor ? 'بستن جدول ویرایش تک‌تک سوالات' : 'ویرایش کلید، مبحث و متن سوالات'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <input
                type="text"
                dir="ltr"
                value={quickKeyString}
                onChange={(e) => setQuickKeyString(e.target.value)}
                placeholder="ورود سریع کلید پشت سر هم (مثال: 132412344123...)"
                className="flex-1 min-w-[200px] min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-left tabular-nums"
              />
              <button
                type="button"
                onClick={handleApplyQuickKey}
                className="min-h-[38px] rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3.5 text-xs font-bold"
              >
                اعمال سریع کلید
              </button>
            </div>

            {showQuestionEditor && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">فیلتر درس:</span>
                  <select
                    value={questionFilterSubjectId}
                    onChange={(e) => setQuestionFilterSubjectId(e.target.value)}
                    className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs"
                  >
                    <option value="all">همه دروس ({toPersianDigits(questions.length)} سوال)</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subjectName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-right">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2 px-2.5 font-bold w-14">سوال</th>
                        <th className="py-2 px-2.5 font-bold">درس</th>
                        <th className="py-2 px-2.5 font-bold w-24">گزینه صحیح</th>
                        <th className="py-2 px-2.5 font-bold">مبحث</th>
                        <th className="py-2 px-2.5 font-bold w-28">سطح دشواری</th>
                        <th className="py-2 px-2.5 font-bold">پاسخ تشریحی کوتاه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleQuestions.map((q) => (
                        <tr key={q.questionNumber}>
                          <td className="p-2 font-bold tabular-nums text-center">
                            {toPersianDigits(q.questionNumber)}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {subjectNameMap.get(q.subjectId) ?? '—'}
                          </td>
                          <td className="p-2">
                            <select
                              value={q.correctOption}
                              onChange={(e) =>
                                updateQuestion(q.questionNumber, {
                                  correctOption: Number(e.target.value) as MockAnswerOption,
                                })
                              }
                              className="w-full min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-center font-bold tabular-nums"
                            >
                              {[1, 2, 3, 4].map((opt) => (
                                <option key={opt} value={opt}>
                                  گزینه {toPersianDigits(opt)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={q.topic}
                              onChange={(e) =>
                                updateQuestion(q.questionNumber, { topic: e.target.value })
                              }
                              className="w-full min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={q.difficulty}
                              onChange={(e) =>
                                updateQuestion(q.questionNumber, {
                                  difficulty: e.target.value as MockQuestionDifficulty,
                                })
                              }
                              className="w-full min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                            >
                              <option value="easy">ساده</option>
                              <option value="medium">متوسط</option>
                              <option value="hard">دشوار</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={q.solutionText ?? ''}
                              onChange={(e) =>
                                updateQuestion(q.questionNumber, { solutionText: e.target.value })
                              }
                              placeholder="نکته یا پاسخ تشریحی..."
                              className="w-full min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-5 text-xs font-bold disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'در حال ذخیره...' : isEditing ? 'ذخیره تغییرات آزمون' : 'ثبت و ایجاد آزمون آزمایشی'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
