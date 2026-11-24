// Standalone Non-Destructive Plugin: Question Bank («بانک سوالات» - Phase 2.5)
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckSquare,
  ClipboardCheck,
  Copy,
  Edit3,
  FileCheck2,
  FilePlus2,
  Gamepad2,
  Library,
  MessageSquareShare,
  Printer,
  Search,
  Send,
  ShieldAlert,
  ShoppingBasket,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { canManageQuestionBank } from '../../core/auth/rbac';
import { useSchoolData } from '../../core/data/DataContext';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import {
  validateJalaliDate,
  validateQuestionBankInput,
  validateRichMediaFile,
} from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, formatJalaliDisplay } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  ClassChatDraftItem,
  ExamBasketItem,
  MediaAttachmentRef,
  QuestionBankItem,
  QuestionDifficulty,
  QuestionType,
} from '../../types/domain';
import { convertQuestionsToSpeedQuiz } from '../homework/homeworkHelpers';
import { QuestionPrintModal } from './QuestionPrintModal';
import {
  buildHomeworkFromQuestions,
  DIFFICULTY_LABELS,
  filterQuestions,
  formatQuestionsForMessenger,
  OPTION_LETTERS_FA,
  PRESET_GRADES,
  QUESTION_TYPE_LABELS,
} from './questionBankHelpers';

const DIFFICULTY_BADGE_STYLES: Record<QuestionDifficulty, string> = {
  easy: 'text-emerald-700 dark:text-emerald-300',
  medium: 'text-amber-700 dark:text-amber-300',
  hard: 'text-rose-700 dark:text-rose-300',
};

interface QuestionFormState {
  editingId: string | null;
  gradeSelect: string; // preset label or '__custom__'
  customGradeLabel: string;
  subject: string;
  chapter: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  trueFalseAnswer: boolean;
  modelAnswer: string;
  mediaAttachment: MediaAttachmentRef | undefined;
}

function createInitialFormState(): QuestionFormState {
  return {
    editingId: null,
    gradeSelect: 'پایه پنجم',
    customGradeLabel: '',
    subject: 'ریاضی',
    chapter: '',
    difficulty: 'medium',
    type: 'multiple_choice',
    questionText: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    trueFalseAnswer: true,
    modelAnswer: '',
    mediaAttachment: undefined,
  };
}

export const QuestionBankPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    classes,
    defaultWorkdayJalali,
    questionBank,
    classChatDraftQueue,
    examQuestionBasket,
    upsertQuestionItem,
    deleteQuestionItem,
    upsertHomeworkAssignment,
    addClassChatDraft,
    addToExamBasket,
    removeFromExamBasket,
    clearExamBasket,
  } = useSchoolData();

  const canManage = canManageQuestionBank(activeRole);

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | QuestionType>('');
  const [difficultyFilter, setDifficultyFilter] = useState<'' | QuestionDifficulty>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Feedback Toast
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<QuestionFormState>(createInitialFormState);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Dispatch Modal 1: Send to Online Homework
  const [homeworkModalItems, setHomeworkModalItems] = useState<QuestionBankItem[] | null>(null);
  const [hwClassId, setHwClassId] = useState<string>(() => classes[0]?.id ?? '');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDueDate, setHwDueDate] = useState(() => addDaysToJalali(defaultWorkdayJalali, 3));
  const [hwConvertToGame, setHwConvertToGame] = useState(true);
  const [hwError, setHwError] = useState<string | null>(null);

  // Dispatch Modal 2: Send to Class Chat Draft Queue
  const [chatModalItems, setChatModalItems] = useState<QuestionBankItem[] | null>(null);
  const [chatClassId, setChatClassId] = useState<string>(() => classes[0]?.id ?? '');
  const [chatIncludeAnswers, setChatIncludeAnswers] = useState(false);
  const [chatSavedDraftText, setChatSavedDraftText] = useState<string | null>(null);
  const [chatCopied, setChatCopied] = useState(false);

  // Exam Basket & Print Preview Modals
  const [basketOpen, setBasketOpen] = useState(false);
  const [printQuestions, setPrintQuestions] = useState<QuestionBankItem[] | null>(null);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Distinct dropdown options derived from current school's bank
  const gradeOptions = useMemo(() => {
    const preset = PRESET_GRADES.map((g) => g.label);
    const dynamic = questionBank.map((q) => q.gradeLabel);
    return Array.from(new Set([...preset, ...dynamic]));
  }, [questionBank]);

  const subjectOptions = useMemo(() => {
    return Array.from(new Set(questionBank.map((q) => q.subject))).sort((a, b) =>
      a.localeCompare(b, 'fa')
    );
  }, [questionBank]);

  const filteredQuestions = useMemo(
    () =>
      filterQuestions(questionBank, {
        query: searchQuery,
        gradeLabel: gradeFilter,
        subject: subjectFilter,
        type: typeFilter,
        difficulty: difficultyFilter,
      }),
    [questionBank, searchQuery, gradeFilter, subjectFilter, typeFilter, difficultyFilter]
  );

  const selectedQuestions = useMemo(
    () => questionBank.filter((q) => selectedIds.includes(q.id)),
    [questionBank, selectedIds]
  );

  const basketQuestions = useMemo(() => {
    const byId = new Map(questionBank.map((q) => [q.id, q]));
    return examQuestionBasket
      .map((b) => ({ basket: b, question: byId.get(b.questionId) }))
      .filter((x): x is { basket: ExamBasketItem; question: QuestionBankItem } => Boolean(x.question));
  }, [examQuestionBasket, questionBank]);

  const basketQuestionIdSet = useMemo(
    () => new Set(examQuestionBasket.map((b) => b.questionId)),
    [examQuestionBasket]
  );

  if (!canManage) {
    return (
      <div
        className="rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 p-8 text-center space-y-3"
        dir="rtl"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          عدم دسترسی به بانک سوالات
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-6">
          این بسته الحاقی ویژه مدیر کل، مدیر مدرسه، معاون و معلمان است و برای حساب اولیا و
          دانش‌آموزان در دسترس نیست.
        </p>
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredQuestions.map((q) => q.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const openCreateModal = () => {
    setForm(createInitialFormState());
    setFormErrors([]);
    setEditorOpen(true);
  };

  const openEditModal = (item: QuestionBankItem) => {
    const isPreset = PRESET_GRADES.some((g) => g.label === item.gradeLabel);
    setForm({
      editingId: item.id,
      gradeSelect: isPreset ? item.gradeLabel : '__custom__',
      customGradeLabel: isPreset ? '' : item.gradeLabel,
      subject: item.subject,
      chapter: item.chapter,
      difficulty: item.difficulty,
      type: item.type,
      questionText: item.questionText,
      options: item.options ? [...item.options] as [string, string, string, string] : ['', '', '', ''],
      correctOptionIndex: item.correctOptionIndex ?? 0,
      trueFalseAnswer: item.trueFalseAnswer ?? true,
      modelAnswer: item.modelAnswer ?? '',
      mediaAttachment: item.mediaAttachment,
    });
    setFormErrors([]);
    setEditorOpen(true);
  };

  const handleSampleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validation = validateRichMediaFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      allowPdf: true,
    });

    if (!validation.valid || !validation.data) {
      setFormErrors(validation.errors);
      return;
    }

    setUploadingMedia(true);
    setFormErrors([]);
    try {
      const mediaId = `${activeSchoolId}:qb-media:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const ref: MediaAttachmentRef = {
        mediaId,
        schoolId: activeSchoolId,
        fileName: file.name,
        mimeType: file.type || (validation.data === 'pdf' ? 'application/pdf' : 'image/png'),
        sizeBytes: file.size,
        kind: validation.data,
      };
      await saveMediaBlob({
        mediaId,
        schoolId: activeSchoolId,
        fileName: ref.fileName,
        mimeType: ref.mimeType,
        sizeBytes: ref.sizeBytes,
        blob: file,
        createdAt: nowIso,
      });
      setForm((prev) => ({ ...prev, mediaAttachment: ref }));
    } catch {
      setFormErrors(['خطا در ذخیره‌سازی امن فایل در حافظه آفلاین.']);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedGradeLabel =
      form.gradeSelect === '__custom__' ? form.customGradeLabel.trim() : form.gradeSelect;
    const presetMatch = PRESET_GRADES.find((g) => g.label === resolvedGradeLabel);
    const gradeLevel = presetMatch?.level ?? 5;

    const check = validateQuestionBankInput({
      gradeLabel: resolvedGradeLabel,
      subject: form.subject,
      chapter: form.chapter,
      type: form.type,
      questionText: form.questionText,
      options: form.type === 'multiple_choice' ? form.options : undefined,
      correctOptionIndex: form.type === 'multiple_choice' ? form.correctOptionIndex : undefined,
      hasMedia: Boolean(form.mediaAttachment),
    });

    if (!check.valid) {
      setFormErrors(check.errors);
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = form.editingId
      ? questionBank.find((q) => q.id === form.editingId)
      : undefined;

    const record: QuestionBankItem = {
      id: form.editingId ?? `${activeSchoolId}:qb:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: activeSchoolId,
      gradeLevel,
      gradeLabel: resolvedGradeLabel,
      subject: form.subject.trim(),
      chapter: form.chapter.trim(),
      difficulty: form.difficulty,
      type: form.type,
      questionText:
        form.questionText.trim() ||
        (form.mediaAttachment ? `نمونه سوال پیوست‌شده (${form.mediaAttachment.fileName})` : ''),
      options:
        form.type === 'multiple_choice'
          ? (form.options.map((o) => o.trim()) as [string, string, string, string])
          : undefined,
      correctOptionIndex: form.type === 'multiple_choice' ? form.correctOptionIndex : undefined,
      trueFalseAnswer: form.type === 'true_false' ? form.trueFalseAnswer : undefined,
      modelAnswer: form.modelAnswer.trim() || undefined,
      mediaAttachment: form.mediaAttachment,
      createdById: existing?.createdById ?? session?.userId ?? 'staff',
      createdByName: existing?.createdByName ?? session?.displayName ?? 'کادر آموزشی',
      createdByRole: existing?.createdByRole ?? activeRole,
      createdAtJalali: existing?.createdAtJalali ?? defaultWorkdayJalali,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    const res = upsertQuestionItem(record);
    if (!res.ok) {
      setFormErrors([res.errorFa ?? 'ذخیره سوال با خطا مواجه شد.']);
      return;
    }

    setEditorOpen(false);
    showToast(
      'success',
      form.editingId ? 'تغییرات سوال با موفقیت ذخیره شد.' : 'سوال جدید به بانک سوالات اضافه شد.'
    );
  };

  const handleDeleteQuestion = (item: QuestionBankItem) => {
    const res = deleteQuestionItem(item.id);
    if (!res.ok) {
      showToast('error', res.errorFa ?? 'خطا در حذف سوال.');
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    showToast('success', 'سوال از بانک سوالات حذف شد.');
  };

  // --- Dispatch 1: Online Homework ---
  const openHomeworkDispatch = (items: QuestionBankItem[]) => {
    if (items.length === 0) return;
    const defaultClass = classes[0]?.id ?? '';
    const mcqCount = convertQuestionsToSpeedQuiz(items).length;
    setHomeworkModalItems(items);
    setHwClassId(defaultClass);
    setHwTitle(
      items.length === 1
        ? `تمرین ${items[0].subject} — ${items[0].chapter}`
        : `بسته تمرینی ${items[0].subject} (${toPersianDigits(items.length)} سوال)`
    );
    setHwDueDate(addDaysToJalali(defaultWorkdayJalali, 3));
    setHwConvertToGame(mcqCount > 0);
    setHwError(null);
  };

  const handleConfirmHomeworkDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeworkModalItems || homeworkModalItems.length === 0) return;
    if (!hwClassId) {
      setHwError('لطفاً کلاس مقصد را انتخاب کنید.');
      return;
    }
    if (hwTitle.trim().length < 3) {
      setHwError('عنوان تکلیف باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (!validateJalaliDate(hwDueDate)) {
      setHwError('تاریخ مهلت تحویل شمسی معتبر نیست (مثال: ۱۴۰۵/۰۹/۱۰).');
      return;
    }

    const assignment = buildHomeworkFromQuestions({
      id: `${activeSchoolId}:hw:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: activeSchoolId,
      classId: hwClassId,
      teacherId: session?.linkedTeacherId ?? session?.userId ?? 'staff',
      teacherName: session?.displayName ?? 'معلم',
      title: hwTitle,
      dueDateJalali: hwDueDate,
      createdAtJalali: defaultWorkdayJalali,
      questions: homeworkModalItems,
      convertToSpeedQuiz: hwConvertToGame,
    });

    const res = upsertHomeworkAssignment(assignment);
    if (!res.ok) {
      setHwError(res.errorFa ?? 'خطا در ارسال به تکالیف آنلاین.');
      return;
    }

    const targetClassName = classes.find((c) => c.id === hwClassId)?.name ?? 'کلاس';
    setHomeworkModalItems(null);
    setSelectedIds([]);
    showToast(
      'success',
      assignment.mode === 'game'
        ? `بازی آموزشی چهارگزینه‌ای در تکالیف «${targetClassName}» ثبت شد.`
        : `تکلیف جدید با ${toPersianDigits(homeworkModalItems.length)} سوال برای «${targetClassName}» ثبت شد.`
    );
  };

  // --- Dispatch 2: Class Chat Draft Queue + Single-Column Copy ---
  const openChatDispatch = (items: QuestionBankItem[]) => {
    if (items.length === 0) return;
    setChatModalItems(items);
    setChatClassId(classes[0]?.id ?? '');
    setChatIncludeAnswers(false);
    setChatSavedDraftText(null);
    setChatCopied(false);
  };

  const chatPreviewText = useMemo(() => {
    if (!chatModalItems || chatModalItems.length === 0) return '';
    const clsName = classes.find((c) => c.id === chatClassId)?.name ?? 'کلاس';
    return formatQuestionsForMessenger({
      schoolName: activeSchool.name,
      className: clsName,
      questions: chatModalItems,
      jalaliDate: defaultWorkdayJalali,
      senderName: session?.displayName ?? 'معلم',
      includeAnswers: chatIncludeAnswers,
    });
  }, [
    chatModalItems,
    chatClassId,
    classes,
    activeSchool.name,
    defaultWorkdayJalali,
    session?.displayName,
    chatIncludeAnswers,
  ]);

  const handleSaveChatDraft = () => {
    if (!chatModalItems || chatModalItems.length === 0 || !chatClassId) return;
    const clsName = classes.find((c) => c.id === chatClassId)?.name ?? 'کلاس';
    const draft: ClassChatDraftItem = {
      id: `${activeSchoolId}:chatdraft:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: activeSchoolId,
      classId: chatClassId,
      sourceType: 'question_bank',
      title: `سوالات ${chatModalItems[0].subject} — ${clsName} (${toPersianDigits(chatModalItems.length)} سوال)`,
      formattedText: chatPreviewText,
      questionIds: chatModalItems.map((q) => q.id),
      createdByName: session?.displayName ?? 'معلم',
      createdByRole: activeRole,
      createdAtJalali: defaultWorkdayJalali,
      createdAt: new Date().toISOString(),
    };

    const res = addClassChatDraft(draft);
    if (!res.ok) {
      showToast('error', res.errorFa ?? 'خطا در ذخیره پیش‌نویس چت کلاسی.');
      return;
    }

    setChatSavedDraftText(chatPreviewText);
    setSelectedIds([]);
    showToast('success', `پیش‌نویس در صف چت «${clsName}» ذخیره شد و آماده کپی است.`);
  };

  const handleCopyText = async (text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setChatCopied(true);
      showToast('success', 'متن تک‌ستونی آماده ارسال در ایتا، بله و شاد کپی شد.');
      window.setTimeout(() => setChatCopied(false), 2500);
    } else {
      showToast('error', 'دسترسی به کلیپ‌بورد مسدود است؛ متن را به صورت دستی کپی کنید.');
    }
  };

  // --- Dispatch 3: Online Exam Basket ---
  const handleAddQuestionsToBasket = (items: QuestionBankItem[]) => {
    if (items.length === 0) return;
    const nowIso = new Date().toISOString();
    const basketEntries: ExamBasketItem[] = items.map((q) => ({
      id: `${activeSchoolId}:exambasket:${q.id}`,
      schoolId: activeSchoolId,
      questionId: q.id,
      addedByName: session?.displayName ?? 'معلم',
      addedAt: nowIso,
    }));

    const res = addToExamBasket(basketEntries);
    if (!res.ok) {
      showToast('error', res.errorFa ?? 'خطا در افزودن به سبد آزمون.');
      return;
    }
    setSelectedIds([]);
    showToast(
      'success',
      `${toPersianDigits(items.length)} سوال به سبد طراحی آزمون آنلاین اضافه شد.`
    );
  };

  const mcqCountInHomeworkModal = homeworkModalItems
    ? convertQuestionsToSpeedQuiz(homeworkModalItems).length
    : 0;

  return (
    <>
      <div className={printQuestions ? 'space-y-5 no-print' : 'space-y-5'} dir="rtl">
        {/* Toast Banner */}
        {toast && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between border ${
              toast.kind === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 hover:opacity-75"
              aria-label="بستن پیام"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Library className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  بانک سوالات آموزشی — {activeSchool.name}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {toPersianDigits(questionBank.length)} سوال ذخیره شده ·{' '}
                  {toPersianDigits(classChatDraftQueue.length)} پیش‌نویس در صف چت کلاسی · ارسال
                  مستقیم به تکالیف، بازی آموزشی و برگه چاپ A4
                </p>
              </div>
            </div>

            <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDraftsDrawer((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors tabular-nums whitespace-nowrap"
              >
                <MessageSquareShare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>صف چت کلاسی ({toPersianDigits(classChatDraftQueue.length)})</span>
              </button>

              <button
                type="button"
                onClick={() => setBasketOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/70 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 transition-colors tabular-nums whitespace-nowrap"
              >
                <ShoppingBasket className="w-4 h-4" />
                <span>سبد آزمون: {toPersianDigits(basketQuestions.length)} سوال</span>
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>افزودن / بارگذاری سوال جدید</span>
              </button>
            </div>
          </div>

          {/* Search & Multi-Filters */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در متن سوال، فصل، مبحث یا گزینه‌ها..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <select
              aria-label="فیلتر پایه تحصیلی"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="">همه پایه‌های تحصیلی</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              aria-label="فیلتر نام درس"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="">همه درس‌ها</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="فیلتر نوع سوال"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as '' | QuestionType)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="">همه انواع</option>
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>

              <select
                aria-label="فیلتر سطح دشواری"
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(e.target.value as '' | QuestionDifficulty)
                }
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="">همه سطوح</option>
                {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk Selection Toolbar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {filteredQuestions.length > 0 &&
                filteredQuestions.every((q) => selectedIds.includes(q.id)) ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>انتخاب همه ({toPersianDigits(filteredQuestions.length)} مورد)</span>
              </button>

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  لغو انتخاب ({toPersianDigits(selectedIds.length)})
                </button>
              )}
            </div>

            {selectedQuestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openHomeworkDispatch(selectedQuestions)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال به تکالیف آنلاین ({toPersianDigits(selectedQuestions.length)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => openChatDispatch(selectedQuestions)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <MessageSquareShare className="w-3.5 h-3.5" />
                  <span>ارسال به چت کلاسی</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestionsToBasket(selectedQuestions)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <ShoppingBasket className="w-3.5 h-3.5" />
                  <span>ارسال به طراحی آزمون آنلاین</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Optional Collapsible Class Chat Draft Queue Panel */}
        {showDraftsDrawer && (
          <section className="rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                صف پیش‌نویس‌های آماده برای چت کلاسی ({toPersianDigits(classChatDraftQueue.length)})
              </h2>
              <button
                type="button"
                onClick={() => setShowDraftsDrawer(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                بستن
              </button>
            </div>
            {classChatDraftQueue.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                هنوز سوالی به صف چت کلاسی ارسال نشده است. با دکمه «ارسال به چت کلاسی» روی هر سوال،
                نسخه تک‌ستونی آن اینجا ذخیره می‌شود.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {classChatDraftQueue.slice(0, 6).map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {draft.title}
                      </span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {formatJalaliDisplay(draft.createdAtJalali, false)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap">
                      {draft.formattedText}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyText(draft.formattedText)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی تک‌ستونی برای ایتا، بله و شاد</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Question List */}
        {filteredQuestions.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              سوالی مطابق با فیلتر فعلی یافت نشد
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              فیلترها را تغییر دهید یا نخستین سوال جدید این مدرسه را ثبت کنید.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const inBasket = basketQuestionIdSet.has(item.id);

              return (
                <article
                  key={item.id}
                  className={`rounded-2xl bg-white dark:bg-slate-900 border transition-colors p-4 sm:p-5 space-y-3 ${
                    isSelected
                      ? 'border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-200 dark:ring-indigo-900'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Top Row: Selection Checkbox + Unboxed Metadata + Edit/Delete */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        aria-label={`انتخاب سوال ${item.subject}`}
                        className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {item.gradeLabel}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                            {item.subject}
                          </span>
                          <span>·</span>
                          <span>{item.chapter}</span>
                          <span>·</span>
                          <span>{QUESTION_TYPE_LABELS[item.type]}</span>
                          <span>·</span>
                          <span className={`font-semibold ${DIFFICULTY_BADGE_STYLES[item.difficulty]}`}>
                            سطح {DIFFICULTY_LABELS[item.difficulty]}
                          </span>
                          {inBasket && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                در سبد آزمون
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-7 whitespace-pre-wrap">
                          {item.questionText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="ویرایش سوال"
                        aria-label="ویرایش سوال"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(item)}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="حذف سوال"
                        aria-label="حذف سوال"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Options / True-False / Media Preview */}
                  {item.type === 'multiple_choice' && item.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-8">
                      {item.options.map((opt, idx) => {
                        const isCorrect = item.correctOptionIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl px-3 py-2 text-xs flex items-center gap-2 border ${
                              isCorrect
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-bold">{OPTION_LETTERS_FA[idx]})</span>
                            <span>{opt}</span>
                            {isCorrect && <Check className="w-3.5 h-3.5 mr-auto shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {item.type === 'true_false' && item.trueFalseAnswer !== undefined && (
                    <p className="pr-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      پاسخ صحیح: {item.trueFalseAnswer ? 'صحیح' : 'غلط'}
                    </p>
                  )}

                  {item.mediaAttachment && (
                    <div className="pr-8 max-w-md">
                      <MediaAttachmentPreview attachment={item.mediaAttachment} compact />
                    </div>
                  )}

                  {item.modelAnswer && (
                    <div className="pr-8">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 leading-6">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          راهنمای پاسخ:{' '}
                        </span>
                        {item.modelAnswer}
                      </div>
                    </div>
                  )}

                  {/* 3 Direct Dispatch Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 pr-0 sm:pr-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openHomeworkDispatch([item])}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>ارسال به تکالیف آنلاین</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openChatDispatch([item])}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-950/70 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 transition-colors"
                      >
                        <MessageSquareShare className="w-3.5 h-3.5" />
                        <span>ارسال به چت کلاسی</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddQuestionsToBasket([item])}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/70 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-colors"
                      >
                        <ShoppingBasket className="w-3.5 h-3.5" />
                        <span>
                          {inBasket ? 'موجود در سبد آزمون' : 'ارسال به طراحی آزمون آنلاین'}
                        </span>
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-400 tabular-nums">
                      ثبت توسط {item.createdByName} · {formatJalaliDisplay(item.createdAtJalali, false)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-print"
          dir="rtl"
        >
          <form
            onSubmit={handleSaveQuestion}
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {form.editingId ? 'ویرایش سوال بانک سوالات' : 'افزودن / بارگذاری سوال جدید'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formErrors.length > 0 && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 space-y-1">
                  {formErrors.map((err, i) => (
                    <p key={i} className="text-xs font-medium text-rose-700 dark:text-rose-300">
                      • {err}
                    </p>
                  ))}
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    پایه تحصیلی
                  </span>
                  <select
                    value={form.gradeSelect}
                    onChange={(e) => setForm((prev) => ({ ...prev, gradeSelect: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {PRESET_GRADES.map((g) => (
                      <option key={g.level} value={g.label}>
                        {g.label}
                      </option>
                    ))}
                    <option value="__custom__">پایه دلخواه...</option>
                  </select>
                </label>

                {form.gradeSelect === '__custom__' && (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      عنوان پایه دلخواه
                    </span>
                    <input
                      type="text"
                      value={form.customGradeLabel}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, customGradeLabel: e.target.value }))
                      }
                      placeholder="مثلاً پایه هفتم یا پیش‌دبستانی"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </label>
                )}

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    نام درس
                  </span>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="مثلاً ریاضی، فارسی، علوم تجربی"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    فصل / مبحث
                  </span>
                  <input
                    type="text"
                    value={form.chapter}
                    onChange={(e) => setForm((prev) => ({ ...prev, chapter: e.target.value }))}
                    placeholder="مثلاً فصل ۲: کسرها"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    نوع سوال
                  </span>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, type: e.target.value as QuestionType }))
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                      <option key={t} value={t}>
                        {QUESTION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    سطح دشواری
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['easy', 'medium', 'hard'] as QuestionDifficulty[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, difficulty: level }))}
                        className={`rounded-xl py-2 text-xs font-semibold border transition-colors ${
                          form.difficulty === level
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {DIFFICULTY_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              {/* Question Text */}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  متن سوال
                </span>
                <textarea
                  rows={3}
                  value={form.questionText}
                  onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))}
                  placeholder={
                    form.type === 'fill_blank'
                      ? 'متن سوال را با جای خالی (........) بنویسید...'
                      : 'متن کامل سوال را وارد کنید...'
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 leading-6"
                />
              </label>

              {/* Multiple Choice Options */}
              {form.type === 'multiple_choice' && (
                <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    گزینه‌های چهارگزینه‌ای (گزینه صحیح را انتخاب کنید)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={form.correctOptionIndex === idx}
                          onChange={() =>
                            setForm((prev) => ({ ...prev, correctOptionIndex: idx }))
                          }
                          aria-label={`گزینه ${OPTION_LETTERS_FA[idx]} صحیح است`}
                          className="accent-indigo-600"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-5">
                          {OPTION_LETTERS_FA[idx]})
                        </span>
                        <input
                          type="text"
                          value={form.options[idx]}
                          onChange={(e) => {
                            const next = [...form.options] as [string, string, string, string];
                            next[idx] = e.target.value;
                            setForm((prev) => ({ ...prev, options: next }));
                          }}
                          placeholder={`متن گزینه ${OPTION_LETTERS_FA[idx]}`}
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* True / False Answer */}
              {form.type === 'true_false' && (
                <div className="flex items-center gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    پاسخ صحیح:
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.trueFalseAnswer === true}
                      onChange={() => setForm((prev) => ({ ...prev, trueFalseAnswer: true }))}
                      className="accent-emerald-600"
                    />
                    <span>صحیح</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.trueFalseAnswer === false}
                      onChange={() => setForm((prev) => ({ ...prev, trueFalseAnswer: false }))}
                      className="accent-rose-600"
                    />
                    <span>غلط</span>
                  </label>
                </div>
              )}

              {/* File / Image Upload (available for file_sample and optionally any question) */}
              <div className="space-y-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      بارگذاری تصویر یا فایل PDF نمونه سوال (حداکثر ۵ مگابایت)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      ذخیره ایمن در حافظه IndexedDB بدون اشغال localStorage
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingMedia ? 'در حال بارگذاری...' : 'انتخاب فایل تصویر / PDF'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleSampleFileUpload}
                      className="hidden"
                      disabled={uploadingMedia}
                    />
                  </label>
                </div>

                {form.mediaAttachment && (
                  <div className="space-y-2 pt-1">
                    <MediaAttachmentPreview attachment={form.mediaAttachment} compact />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, mediaAttachment: undefined }))}
                      className="text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      حذف فایل پیوست
                    </button>
                  </div>
                )}
              </div>

              {/* Model Answer & Rubric */}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  راهنمای پاسخ / کلید تصحیح (اختیاری)
                </span>
                <textarea
                  rows={2}
                  value={form.modelAnswer}
                  onChange={(e) => setForm((prev) => ({ ...prev, modelAnswer: e.target.value }))}
                  placeholder="توضیح پاسخ تشریحی یا نکته آموزشی برای چاپ در پاسخنامه..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={uploadingMedia}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 text-xs font-bold"
              >
                {form.editingId ? 'ذخیره تغییرات' : 'ثبت سوال در بانک'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dispatch Modal 1: Send to Online Homework */}
      {homeworkModalItems && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          dir="rtl"
        >
          <form
            onSubmit={handleConfirmHomeworkDispatch}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ارسال به تکالیف آنلاین ({toPersianDigits(homeworkModalItems.length)} سوال)
              </h2>
              <button
                type="button"
                onClick={() => setHomeworkModalItems(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {hwError && (
                <p className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                  {hwError}
                </p>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  کلاس مقصد
                </span>
                <select
                  value={hwClassId}
                  onChange={(e) => setHwClassId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  عنوان تکلیف
                </span>
                <input
                  type="text"
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  مهلت تحویل (شمسی)
                </span>
                <input
                  type="text"
                  value={hwDueDate}
                  onChange={(e) => setHwDueDate(e.target.value)}
                  placeholder="1405/09/10"
                  dir="ltr"
                  className="w-full text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </label>

              {mcqCountInHomeworkModal > 0 && (
                <label className="flex items-start gap-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hwConvertToGame}
                    onChange={(e) => setHwConvertToGame(e.target.checked)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 inline-flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4" />
                      <span>تبدیل خودکار به بازی آموزشی چهارگزینه‌ای</span>
                    </span>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-5">
                      {toPersianDigits(mcqCountInHomeworkModal)} سوال چهارگزینه‌ای انتخاب‌شده به
                      مسابقه سرعتی تعاملی با ثبت خودکار امتیاز و ستاره تبدیل می‌شود.
                    </p>
                  </div>
                </label>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setHomeworkModalItems(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold"
              >
                ثبت در تکالیف کلاس
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dispatch Modal 2: Send to Class Chat Draft Queue */}
      {chatModalItems && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          dir="rtl"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ارسال به چت کلاسی و پیام‌رسان‌های ایتا، بله و شاد
              </h2>
              <button
                type="button"
                onClick={() => setChatModalItems(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    کلاس مقصد
                  </span>
                  <select
                    value={chatClassId}
                    onChange={(e) => setChatClassId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chatIncludeAnswers}
                    onChange={(e) => setChatIncludeAnswers(e.target.checked)}
                    className="accent-sky-600"
                  />
                  <span>درج پاسخنامه در متن پیام</span>
                </label>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  پیش‌نمایش قالب تک‌ستونی آماده ارسال:
                </span>
                <pre className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto font-sans leading-6">
                  {chatPreviewText}
                </pre>
              </div>

              {chatSavedDraftText && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    در صف پیش‌نویس چت کلاسی ذخیره شد!
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(chatSavedDraftText)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold"
                  >
                    {chatCopied ? (
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>کپی تک‌ستونی برای ایتا، بله و شاد</span>
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyText(chatPreviewText)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>کپی تک‌ستونی برای ایتا، بله و شاد</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChatModalItems(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={handleSaveChatDraft}
                  className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold"
                >
                  ذخیره در صف چت کلاسی
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exam Basket Modal */}
      {basketOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          dir="rtl"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                  سبد طراحی آزمون آنلاین ({toPersianDigits(basketQuestions.length)} سوال)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBasketOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {basketQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">
                  سبد آزمون خالی است. از لیست بانک سوالات روی «ارسال به طراحی آزمون آنلاین» کلیک
                  کنید.
                </p>
              ) : (
                basketQuestions.map(({ basket, question }, idx) => (
                  <div
                    key={basket.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {toPersianDigits(idx + 1)}. {question.gradeLabel} · {question.subject} ·{' '}
                        {QUESTION_TYPE_LABELS[question.type]}
                      </p>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-6">
                        {question.questionText}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromExamBasket(basket.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                      aria-label="حذف از سبد آزمون"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              {basketQuestions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    clearExamBasket();
                    showToast('success', 'سبد آزمون خالی شد.');
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  پاک‌سازی کامل سبد آزمون
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBasketOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  بستن
                </button>
                <button
                  type="button"
                  disabled={basketQuestions.length === 0}
                  onClick={() => {
                    setPrintQuestions(basketQuestions.map((b) => b.question));
                    setBasketOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2 text-xs font-bold"
                >
                  <Printer className="w-4 h-4" />
                  <span>پیش‌نمایش و چاپ A4 برگه سوال</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 Question Sheet Print Preview Modal */}
      {printQuestions && (
        <QuestionPrintModal
          school={activeSchool}
          questions={printQuestions}
          jalaliDate={defaultWorkdayJalali}
          onClose={() => setPrintQuestions(null)}
        />
      )}
    </>
  );
};
