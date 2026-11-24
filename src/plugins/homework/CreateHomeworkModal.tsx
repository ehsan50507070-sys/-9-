// Modular Create Homework Modal supporting Standard + Rich Media + Built-in/External Educational Games
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Gamepad2,
  Library,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import { useToast } from '../../core/ui/ToastContext';
import {
  validateHomeworkAssignmentInput,
  validateRichMediaFile,
  validateSafeHttpUrl,
} from '../../core/validation/validators';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { addDaysToJalali } from '../../lib/jalali';
import type {
  BuiltinGameTemplate,
  GamePairItem,
  GameQuizItem,
  HomeworkAssignment,
  HomeworkGameConfig,
  MediaAttachmentRef,
  QuestionBankItem,
} from '../../types/domain';
import { convertQuestionsToSpeedQuiz } from './homeworkHelpers';

interface CreateHomeworkModalProps {
  schoolId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  defaultWorkdayJalali: string;
  questionBank: QuestionBankItem[];
  onClose: () => void;
  onCreate: (assignment: HomeworkAssignment) => void;
}

const DEFAULT_PAIRS: GamePairItem[] = [
  { id: 'pair-1', term: '۶ × ۷', match: '۴۲' },
  { id: 'pair-2', term: '۸ × ۵', match: '۴۰' },
  { id: 'pair-3', term: '۹ × ۴', match: '۳۶' },
];

const DEFAULT_QUIZ: GameQuizItem[] = [
  {
    id: 'q-1',
    question: 'حاصل جمع ۴۵ + ۲۷ چند می‌شود؟',
    options: ['۶۲', '۷۲', '۷۱', '۶۸'],
    correctIndex: 1,
  },
  {
    id: 'q-2',
    question: 'کدام عدد بر ۵ بخش‌پذیر است؟',
    options: ['۲۳', '۳۴', '۴۵', '۵۲'],
    correctIndex: 2,
  },
  {
    id: 'q-3',
    question: 'محیط مربع با ضلع ۶ سانتی‌متر چند سانتی‌متر است؟',
    options: ['۱۲', '۱۸', '۲۴', '۳۶'],
    correctIndex: 2,
  },
];

export const CreateHomeworkModal: React.FC<CreateHomeworkModalProps> = ({
  schoolId,
  classId,
  teacherId,
  teacherName,
  defaultWorkdayJalali,
  questionBank,
  onClose,
  onCreate,
}) => {
  const { showToast } = useToast();

  const [mode, setMode] = useState<'standard' | 'game'>('standard');
  const [hwSubject, setHwSubject] = useState('ریاضی');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDescription, setHwDescription] = useState('');
  const [hwDueDate, setHwDueDate] = useState(addDaysToJalali(defaultWorkdayJalali, 4));
  const [hwLink, setHwLink] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachmentRef[]>([]);

  // Game Builder state
  const [gameSource, setGameSource] = useState<'builtin' | 'external'>('builtin');
  const [template, setTemplate] = useState<BuiltinGameTemplate>('matching');
  const [pairs, setPairs] = useState<GamePairItem[]>(DEFAULT_PAIRS);
  const [quizItems, setQuizItems] = useState<GameQuizItem[]>(DEFAULT_QUIZ);
  const [externalTitle, setExternalTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalInstructions, setExternalInstructions] = useState('');

  const mcqBankCount = useMemo(
    () => questionBank.filter((q) => q.type === 'multiple_choice').length,
    [questionBank]
  );

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateRichMediaFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      allowPdf: false,
    });
    if (!check.valid || !check.data) {
      showToast(check.errors[0] ?? 'فایل انتخاب‌شده معتبر نیست.', 'error');
      e.target.value = '';
      return;
    }
    const mediaId = `${schoolId}:blob:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await saveMediaBlob({
      mediaId,
      schoolId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    });
    setMediaAttachments((prev) => [
      ...prev,
      {
        mediaId,
        schoolId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        kind: check.data!,
        sizeBytes: file.size,
      },
    ]);
    e.target.value = '';
    showToast(`فایل «${file.name}» با موفقیت به تکلیف پیوست شد.`);
  };

  const handleImportFromQuestionBank = () => {
    const imported = convertQuestionsToSpeedQuiz(questionBank);
    if (imported.length === 0) {
      showToast('سوال چهارگزینه‌ای در بانک سوالات این مدرسه یافت نشد.', 'info');
      return;
    }
    setTemplate('speed_quiz');
    setQuizItems(imported);
    showToast(`${toPersianDigits(imported.length)} سوال چهارگزینه‌ای از بانک سوالات وارد بازی شد.`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDue = toAsciiDigits(hwDueDate).trim();
    const baseCheck = validateHomeworkAssignmentInput({
      classId,
      subject: hwSubject,
      title: hwTitle,
      description: hwDescription,
      dueDateJalali: cleanDue,
      attachmentUrl: hwLink,
    });
    if (!baseCheck.valid) {
      showToast(baseCheck.errors[0], 'error');
      return;
    }

    let gameConfig: HomeworkGameConfig | undefined;
    if (mode === 'game') {
      if (gameSource === 'external') {
        const urlCheck = validateSafeHttpUrl(externalUrl);
        if (!urlCheck.valid || !urlCheck.data) {
          showToast(urlCheck.errors[0] ?? 'نشانی لینک بازی آموزشی معتبر نیست.', 'error');
          return;
        }
        gameConfig = {
          source: 'external',
          externalTitle: externalTitle.trim() || hwTitle.trim(),
          externalUrl: urlCheck.data,
          externalInstructions:
            externalInstructions.trim() || 'روی دکمه شروع کلیک کنید و پس از پایان، دکمه انجام دادم را بزنید.',
        };
      } else if (template === 'speed_quiz') {
        const validQuiz = quizItems.filter(
          (q) => q.question.trim().length >= 3 && q.options.every((o) => o.trim().length > 0)
        );
        if (validQuiz.length < 3 || validQuiz.length > 10) {
          showToast('برای بازی مسابقه سرعتی باید بین ۳ تا ۱۰ سوال کامل وارد کنید.', 'error');
          return;
        }
        gameConfig = {
          source: 'builtin',
          template: 'speed_quiz',
          timeLimitSec: validQuiz.length * 30,
          quizItems: validQuiz,
        };
      } else {
        const validPairs = pairs.filter(
          (p) => p.term.trim().length > 0 && p.match.trim().length > 0
        );
        if (validPairs.length < 3 || validPairs.length > 10) {
          showToast('برای بازی جورچین یا کارت حافظه باید بین ۳ تا ۱۰ جفت کامل وارد کنید.', 'error');
          return;
        }
        gameConfig = {
          source: 'builtin',
          template,
          timeLimitSec: validPairs.length * 25,
          pairs: validPairs,
        };
      }
    }

    const newHw: HomeworkAssignment = {
      id: `${schoolId}:hw:${Date.now()}`,
      schoolId,
      classId,
      teacherId,
      teacherName,
      subject: hwSubject.trim(),
      title: hwTitle.trim(),
      description: hwDescription.trim(),
      dueDateJalali: cleanDue,
      createdAtJalali: defaultWorkdayJalali,
      maxScore: 20,
      mode,
      gameConfig,
      mediaAttachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,
      attachmentUrl: hwLink.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onCreate(newHw);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-hw-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 overflow-y-auto"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl my-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="create-hw-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            تعریف تکلیف آنلاین جدید
          </h2>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Assignment Mode Segmented Switch */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('standard')}
            className={`min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              mode === 'standard'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            تکلیف عادی
          </button>
          <button
            type="button"
            onClick={() => setMode('game')}
            className={`min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              mode === 'game'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            تکلیف بازی آموزشی
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              درس
            </label>
            <input
              type="text"
              required
              value={hwSubject}
              onChange={(e) => setHwSubject(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              مهلت تحویل (تاریخ شمسی)
            </label>
            <input
              type="text"
              dir="ltr"
              required
              value={hwDueDate}
              onChange={(e) => setHwDueDate(e.target.value)}
              placeholder="1405/09/10"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            عنوان تکلیف
          </label>
          <input
            type="text"
            required
            value={hwTitle}
            onChange={(e) => setHwTitle(e.target.value)}
            placeholder={
              mode === 'game'
                ? 'مثال: بازی آموزشی جورچین ضرب‌های پایه چهارم'
                : 'مثال: حل تمرین‌های صفحه ۴۵ ریاضی'
            }
            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            شرح و راهنمای انجام تکلیف
          </label>
          <textarea
            rows={2}
            required
            value={hwDescription}
            onChange={(e) => setHwDescription(e.target.value)}
            placeholder="توضیح کوتاه برای دانش‌آموزان و اولیا..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Rich Media Uploader (Teacher) */}
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                بارگذاری عکس، فیلم یا صوت از تکلیف
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                حداکثر ۵ مگابایت برای تصویر و ۱۵ مگابایت برای صوت/ویدیو (ذخیره ایمن در IndexedDB)
              </div>
            </div>
            <label className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              انتخاب فایل رسانه
              <input
                type="file"
                accept="image/*,audio/*,video/*"
                onChange={(e) => void handleMediaUpload(e)}
                className="sr-only"
              />
            </label>
          </div>
          {mediaAttachments.length > 0 && (
            <div className="space-y-2">
              {mediaAttachments.map((att) => (
                <MediaAttachmentPreview
                  key={att.mediaId}
                  attachment={att}
                  compact
                  onRemove={() =>
                    setMediaAttachments((prev) => prev.filter((x) => x.mediaId !== att.mediaId))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Educational Game Configuration */}
        {mode === 'game' && (
          <div className="rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                تنظیمات بازی آموزشی
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGameSource('builtin')}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold ${
                    gameSource === 'builtin'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  بازی آفلاین درون‌برنامه‌ای
                </button>
                <button
                  type="button"
                  onClick={() => setGameSource('external')}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold ${
                    gameSource === 'external'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  لینک بازی آموزشی
                </button>
              </div>
            </div>

            {gameSource === 'builtin' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'matching' as const, label: 'جورچین مفاهیم' },
                      { id: 'memory' as const, label: 'کارت حافظه آموزشی' },
                      { id: 'speed_quiz' as const, label: 'مسابقه سرعتی چهارگزینه‌ای' },
                    ].map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplate(tpl.id)}
                        className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                          template === tpl.id
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>

                  {mcqBankCount > 0 && (
                    <button
                      type="button"
                      onClick={handleImportFromQuestionBank}
                      className="min-h-[34px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                    >
                      <Library className="w-3.5 h-3.5" />
                      ورود مستقیم از بانک سوالات ({toPersianDigits(mcqBankCount)})
                    </button>
                  )}
                </div>

                {template === 'speed_quiz' ? (
                  <div className="space-y-3">
                    {quizItems.map((q, idx) => (
                      <div
                        key={q.id}
                        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                            سوال {toPersianDigits(idx + 1)}
                          </span>
                          {quizItems.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setQuizItems((prev) => prev.filter((x) => x.id !== q.id))}
                              className="text-rose-600 p-1"
                              aria-label="حذف سوال"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) =>
                            setQuizItems((prev) =>
                              prev.map((x) => (x.id === q.id ? { ...x, question: e.target.value } : x))
                            )
                          }
                          placeholder="متن سوال..."
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctIndex === optIdx}
                                onChange={() =>
                                  setQuizItems((prev) =>
                                    prev.map((x) =>
                                      x.id === q.id ? { ...x, correctIndex: optIdx } : x
                                    )
                                  )
                                }
                                aria-label={`گزینه ${optIdx + 1} صحیح است`}
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) =>
                                  setQuizItems((prev) =>
                                    prev.map((x) => {
                                      if (x.id !== q.id) return x;
                                      const nextOpts = [...x.options] as [string, string, string, string];
                                      nextOpts[optIdx] = e.target.value;
                                      return { ...x, options: nextOpts };
                                    })
                                  )
                                }
                                placeholder={`گزینه ${toPersianDigits(optIdx + 1)}`}
                                className="flex-1 min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-slate-100"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {quizItems.length < 10 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuizItems((prev) => [
                            ...prev,
                            {
                              id: `q-${Date.now()}`,
                              question: '',
                              options: ['', '', '', ''],
                              correctIndex: 0,
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        افزودن سوال جدید (حداکثر ۱۰ مورد)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pairs.map((p, idx) => (
                      <div key={p.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={p.term}
                          onChange={(e) =>
                            setPairs((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, term: e.target.value } : x))
                            )
                          }
                          placeholder={`مفهوم / عبارت ${toPersianDigits(idx + 1)}`}
                          className="sm:col-span-5 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          value={p.match}
                          onChange={(e) =>
                            setPairs((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, match: e.target.value } : x))
                            )
                          }
                          placeholder={`پاسخ / معادل ${toPersianDigits(idx + 1)}`}
                          className="sm:col-span-6 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                        />
                        <div className="sm:col-span-1 flex justify-end">
                          {pairs.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setPairs((prev) => prev.filter((x) => x.id !== p.id))}
                              className="p-1.5 text-rose-600"
                              aria-label="حذف جفت"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {pairs.length < 10 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPairs((prev) => [
                            ...prev,
                            { id: `pair-${Date.now()}`, term: '', match: '' },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        افزودن جفت جدید (۳ تا ۱۰ مورد)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان بازی آموزشی
                  </label>
                  <input
                    type="text"
                    value={externalTitle}
                    onChange={(e) => setExternalTitle(e.target.value)}
                    placeholder="مثال: بازی تعاملی کسرها در Wordwall"
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    لینک بازی آموزشی (فقط https یا http)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    required
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://wordwall.net/..."
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    راهنمای انجام بازی
                  </label>
                  <input
                    type="text"
                    value={externalInstructions}
                    onChange={(e) => setExternalInstructions(e.target.value)}
                    placeholder="مثال: پس از رسیدن به مرحله سوم از صفحه امتیاز عکس بگیرید و بارگذاری کنید."
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'standard' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              پیوند راهنما یا کاربرگ امن (اختیاری — فقط https)
            </label>
            <input
              type="url"
              dir="ltr"
              value={hwLink}
              onChange={(e) => setHwLink(e.target.value)}
              placeholder="https://..."
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
          >
            انتشار تکلیف
          </button>
        </div>
      </form>
    </div>
  );
};
