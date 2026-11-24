// Course & Book Builder Modal (complex_admin & principal) — Study -> Short Quiz -> Instant Certificate
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileUp,
  Globe,
  HelpCircle,
  Layers,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, getTodayJalali, parseJalaliString } from '../../lib/jalali';
import type {
  MediaAttachmentRef,
  RoleId,
  TeacherDevChapter,
  TeacherDevContentType,
  TeacherDevCourse,
  TeacherDevQuizQuestion,
  TeacherDevRequirement,
} from '../../types/domain';
import { CONTENT_TYPE_LABELS } from './teacherDevHelpers';

interface CourseBuilderModalProps {
  schoolId: string;
  schoolName: string;
  creatorName: string;
  creatorRole: RoleId;
  canPublishAllSchools: boolean;
  editingCourse?: TeacherDevCourse | null;
  onClose: () => void;
  onSave: (course: TeacherDevCourse, publishAllSchools: boolean) => Promise<void>;
}

function makeEmptyChapter(index: number): TeacherDevChapter {
  return {
    id: `ch-${Date.now().toString(36)}-${index}`,
    order: index + 1,
    title: '',
    content: '',
    estimatedMinutes: 15,
  };
}

function makeEmptyQuestion(index: number): TeacherDevQuizQuestion {
  const base = `q-${Date.now().toString(36)}-${index}`;
  return {
    id: base,
    prompt: '',
    options: [
      { id: `${base}-o1`, text: '' },
      { id: `${base}-o2`, text: '' },
      { id: `${base}-o3`, text: '' },
      { id: `${base}-o4`, text: '' },
    ],
    correctOptionId: `${base}-o1`,
  };
}

export const CourseBuilderModal: React.FC<CourseBuilderModalProps> = ({
  schoolId,
  schoolName,
  creatorName,
  creatorRole,
  canPublishAllSchools,
  editingCourse,
  onClose,
  onSave,
}) => {
  const today = useMemo(() => getTodayJalali(), []);

  const [title, setTitle] = useState(editingCourse?.title ?? '');
  const [description, setDescription] = useState(editingCourse?.description ?? '');
  const [contentType, setContentType] = useState<TeacherDevContentType>(
    editingCourse?.contentType ?? 'course'
  );
  const [requirement, setRequirement] = useState<TeacherDevRequirement>(
    editingCourse?.requirement ?? 'mandatory'
  );
  const [inServiceHours, setInServiceHours] = useState<number>(
    editingCourse?.inServiceHours ?? 6
  );
  const [deadlineJalali, setDeadlineJalali] = useState<string>(
    editingCourse?.deadlineJalali ?? addDaysToJalali(today, 21)
  );
  const [passingScorePercent, setPassingScorePercent] = useState<number>(
    editingCourse?.passingScorePercent ?? 70
  );
  const [maxAttempts, setMaxAttempts] = useState<number>(editingCourse?.maxAttempts ?? 3);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(
    editingCourse?.shuffleOptions ?? true
  );
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(
    editingCourse?.shuffleQuestions ?? true
  );
  const [publishAllSchools, setPublishAllSchools] = useState<boolean>(
    canPublishAllSchools && editingCourse?.scope === 'all'
  );

  const [chapters, setChapters] = useState<TeacherDevChapter[]>(
    editingCourse?.chapters.length
      ? editingCourse.chapters.map((ch) => ({ ...ch }))
      : [makeEmptyChapter(0)]
  );
  const [quizQuestions, setQuizQuestions] = useState<TeacherDevQuizQuestion[]>(
    editingCourse?.quizQuestions.length
      ? editingCourse.quizQuestions.map((q) => ({
          ...q,
          options: q.options.map((o) => ({ ...o })),
        }))
      : [makeEmptyQuestion(0), makeEmptyQuestion(1)]
  );

  const [activeSection, setActiveSection] = useState<'info' | 'chapters' | 'quiz'>('info');
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChapterFileUpload = async (chapterId: string, file: File | null) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setErrorFa('حجم فایل پیوست هر فصل نباید از ۱۲ مگابایت بیشتر باشد.');
      return;
    }
    const mediaId = `td-ch-media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await saveMediaBlob({
      mediaId,
      schoolId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    });
    const attachmentKind: MediaAttachmentRef['kind'] = file.type.startsWith('image/')
      ? 'image'
      : 'pdf';
    setChapters((prev) =>
      prev.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              mediaAttachment: {
                mediaId,
                schoolId,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
                kind: attachmentKind,
              },
            }
          : ch
      )
    );
    setErrorFa(null);
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFa(null);

    if (title.trim().length < 3) {
      setActiveSection('info');
      setErrorFa('عنوان دوره یا کتاب باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (description.trim().length < 10) {
      setActiveSection('info');
      setErrorFa('توضیحات آموزشی دوره را به‌صورت کامل‌تر (حداقل ۱۰ کاراکتر) وارد کنید.');
      return;
    }
    const asciiDeadline = toAsciiDigits(deadlineJalali).trim();
    if (!parseJalaliString(asciiDeadline)) {
      setActiveSection('info');
      setErrorFa('تاریخ مهلت شمسی معتبر نیست (مثال صحیح: 1405/09/20).');
      return;
    }
    if (inServiceHours < 1 || inServiceHours > 120) {
      setActiveSection('info');
      setErrorFa('ساعات ضمن خدمت مصوب باید بین ۱ تا ۱۲۰ ساعت باشد.');
      return;
    }
    if (passingScorePercent < 40 || passingScorePercent > 100) {
      setActiveSection('info');
      setErrorFa('حد نصاب قبولی آزمون باید بین ۴۰ تا ۱۰۰ درصد باشد.');
      return;
    }

    if (chapters.length === 0) {
      setActiveSection('chapters');
      setErrorFa('هر دوره باید حداقل ۱ فصل مطالعاتی داشته باشد.');
      return;
    }
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch.title.trim() || ch.content.trim().length < 15) {
        setActiveSection('chapters');
        setErrorFa(
          `لطفاً عنوان و متن آموزشی فصل ${toPersianDigits(i + 1)} را کامل وارد کنید (حداقل ۱۵ کاراکتر).`
        );
        return;
      }
    }

    if (quizQuestions.length < 2) {
      setActiveSection('quiz');
      setErrorFa('آزمون کوتاه پایانی باید حداقل ۲ سوال چندگزینه‌ای داشته باشد.');
      return;
    }
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      if (!q.prompt.trim()) {
        setActiveSection('quiz');
        setErrorFa(`متن سوال ${toPersianDigits(i + 1)} خالی است.`);
        return;
      }
      const validOpts = q.options.filter((o) => o.text.trim().length > 0);
      if (validOpts.length < 2) {
        setActiveSection('quiz');
        setErrorFa(`سوال ${toPersianDigits(i + 1)} باید حداقل ۲ گزینه غیرخالی داشته باشد.`);
        return;
      }
      if (!validOpts.some((o) => o.id === q.correctOptionId)) {
        setActiveSection('quiz');
        setErrorFa(`گزینه صحیح برای سوال ${toPersianDigits(i + 1)} مشخص نشده است.`);
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const cleanedChapters: TeacherDevChapter[] = chapters.map((ch, idx) => ({
      ...ch,
      order: idx + 1,
      title: ch.title.trim(),
      content: ch.content.trim(),
      estimatedMinutes: Math.max(5, Math.min(180, Number(ch.estimatedMinutes) || 15)),
      externalUrl: ch.externalUrl?.trim() || undefined,
    }));

    const cleanedQuestions: TeacherDevQuizQuestion[] = quizQuestions.map((q) => {
      const validOpts = q.options
        .filter((o) => o.text.trim().length > 0)
        .map((o) => ({ id: o.id, text: o.text.trim() }));
      return {
        id: q.id,
        prompt: q.prompt.trim(),
        options: validOpts,
        correctOptionId: q.correctOptionId,
      };
    });

    const course: TeacherDevCourse = {
      id: editingCourse?.id ?? `${schoolId}:tdc:${Date.now().toString(36)}`,
      schoolId,
      scope: publishAllSchools && canPublishAllSchools ? 'all' : 'school',
      groupKey: editingCourse?.groupKey,
      title: title.trim(),
      description: description.trim(),
      contentType,
      requirement,
      inServiceHours: Math.round(inServiceHours),
      deadlineJalali: asciiDeadline,
      passingScorePercent: Math.round(passingScorePercent),
      maxAttempts: Math.max(1, Math.min(10, Math.round(maxAttempts))),
      shuffleOptions,
      shuffleQuestions,
      status: editingCourse?.status ?? 'active',
      chapters: cleanedChapters,
      quizQuestions: cleanedQuestions,
      createdByName: editingCourse?.createdByName ?? creatorName,
      createdByRole: editingCourse?.createdByRole ?? creatorRole,
      createdAtJalali: editingCourse?.createdAtJalali ?? today,
      createdAt: editingCourse?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    setSaving(true);
    try {
      await onSave(course, publishAllSchools && canPublishAllSchools);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={editingCourse ? 'ویرایش دوره یا کتاب ضمن خدمت' : 'تعریف دوره یا کتاب جدید'}
    >
      <form
        onSubmit={validateAndSubmit}
        className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {editingCourse ? 'ویرایش دوره / کتاب مطالعاتی' : 'ایجاد دوره یا کتاب ضمن خدمت جدید'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              گردش کار استاندارد: مطالعه فصل‌به‌فصل ← آزمون کوتاه ضدتقلب ← صدور آنی گواهینامه
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('info')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeSection === 'info'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>۱. مشخصات و تنظیمات</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('chapters')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeSection === 'chapters'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>۲. فصل‌های مطالعاتی ({toPersianDigits(chapters.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('quiz')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeSection === 'quiz'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>۳. آزمون کوتاه پایانی ({toPersianDigits(quizQuestions.length)} سوال)</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorFa && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs sm:text-sm font-medium text-rose-800 dark:text-rose-200"
            >
              {errorFa}
            </div>
          )}

          {activeSection === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  عنوان دوره یا کتاب مطالعاتی
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: طراحی آزمون‌های استاندارد و ارزشیابی توصیفی"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  توضیحات و اهداف یادگیری
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="شرح کوتاه اهداف، مخاطبان و دستاوردهای حرفه‌ای این دوره برای همکاران..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    نوع محتوا
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as TeacherDevContentType)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {(Object.keys(CONTENT_TYPE_LABELS) as TeacherDevContentType[]).map((key) => (
                      <option key={key} value={key}>
                        {CONTENT_TYPE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    سطح الزام
                  </label>
                  <select
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value as TeacherDevRequirement)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="mandatory">الزامی (تأثیر مستقیم در تکلیف مدرسه)</option>
                    <option value="optional">اختیاری (امتیاز تشویقی و ارتقای سطح)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    ساعت ضمن خدمت مصوب
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={inServiceHours}
                    onChange={(e) => setInServiceHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    مهلت تکمیل (شمسی)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={deadlineJalali}
                    onChange={(e) => setDeadlineJalali(e.target.value)}
                    placeholder="1405/09/25"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-left text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    حد نصاب قبولی آزمون پایانی (درصد)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={100}
                    value={passingScorePercent}
                    onChange={(e) => setPassingScorePercent(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    حداکثر دفعات مجاز شرکت در آزمون
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Anti-cheat controls */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>تنظیمات ضدتقلب و تصادفی‌سازی آزمون</span>
                </div>
                <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    به‌هم‌ریختن تصادفی ترتیب گزینه‌های هر سوال برای هر معلم و هر تلاش مجدد (تصحیح بر اساس شناسه یکتا)
                  </span>
                </label>
                <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>به‌هم‌ریختن تصادفی ترتیب نمایش سوالات در هر نوبت آزمون</span>
                </label>
              </div>

              {/* Publish scope: Complex Admin only */}
              {canPublishAllSchools ? (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publishAllSchools}
                      onChange={(e) => setPublishAllSchools(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-900 dark:text-indigo-200">
                        <Globe className="w-4 h-4" />
                        <span>انتشار همزمان در هر ۳ مدرسه مجموعه (منتشرشده در هر ۳ مدرسه)</span>
                      </div>
                      <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 mt-1">
                        در صورت غیرفعال بودن، این دوره صرفاً برای معلمان «{schoolName}» منتشر می‌شود.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  محدوده انتشار: اختصاصی برای کادر آموزشی <strong className="text-slate-700 dark:text-slate-200">{schoolName}</strong>
                </div>
              )}
            </div>
          )}

          {activeSection === 'chapters' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  معلمان فصل‌ها را گام‌به‌گام مطالعه می‌کنند. آزمون پایانی تا زمان تکمیل ۱۰۰٪ فصل‌ها قفل می‌ماند.
                </p>
                <button
                  type="button"
                  onClick={() => setChapters((prev) => [...prev, makeEmptyChapter(prev.length)])}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-bold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن فصل</span>
                </button>
              </div>

              {chapters.map((ch, idx) => (
                <div
                  key={ch.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                      فصل {toPersianDigits(idx + 1)}
                    </span>
                    {chapters.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setChapters((prev) => prev.filter((item) => item.id !== ch.id))
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف فصل</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        عنوان فصل
                      </label>
                      <input
                        type="text"
                        value={ch.title}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((item) =>
                              item.id === ch.id ? { ...item, title: e.target.value } : item
                            )
                          )
                        }
                        placeholder="مثلاً: اصول طراحی پرسش‌های سطح بالای یادگیری"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        زمان مطالعه (دقیقه)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={ch.estimatedMinutes}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((item) =>
                              item.id === ch.id
                                ? { ...item, estimatedMinutes: Number(e.target.value) }
                                : item
                            )
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      متن آموزشی فصل
                    </label>
                    <textarea
                      rows={4}
                      value={ch.content}
                      onChange={(e) =>
                        setChapters((prev) =>
                          prev.map((item) =>
                            item.id === ch.id ? { ...item, content: e.target.value } : item
                          )
                        )
                      }
                      placeholder="محتوای درسی، نکات کلیدی یا خلاصه فصل کتاب را اینجا وارد کنید..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        لینک منبع تکمیلی یا ویدیو (اختیاری)
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        value={ch.externalUrl ?? ''}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((item) =>
                              item.id === ch.id ? { ...item, externalUrl: e.target.value } : item
                            )
                          )
                        }
                        placeholder="https://..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-left text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        پیوست فایل PDF یا تصویر جزوه (اختیاری)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                          <FileUp className="w-3.5 h-3.5" />
                          <span>بارگذاری فایل</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            onChange={(e) =>
                              void handleChapterFileUpload(ch.id, e.target.files?.[0] ?? null)
                            }
                          />
                        </label>
                        {ch.mediaAttachment?.fileName && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 truncate max-w-[180px]">
                            {ch.mediaAttachment.fileName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'quiz' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  برای هر سوال گزینه صحیح را علامت بزنید. هر گزینه دارای شناسه پایدار است و در آزمون به‌صورت تصادفی چیده می‌شود.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setQuizQuestions((prev) => [...prev, makeEmptyQuestion(prev.length)])
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-bold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن سوال</span>
                </button>
              </div>

              {quizQuestions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                      سوال {toPersianDigits(qIdx + 1)}
                    </span>
                    {quizQuestions.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuizQuestions((prev) => prev.filter((item) => item.id !== q.id))
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف سوال</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={q.prompt}
                    onChange={(e) =>
                      setQuizQuestions((prev) =>
                        prev.map((item) =>
                          item.id === q.id ? { ...item, prompt: e.target.value } : item
                        )
                      )
                    }
                    placeholder="متن پرسش چهارگزینه‌ای را وارد کنید..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctOptionId === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                            isCorrect
                              ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={isCorrect}
                            onChange={() =>
                              setQuizQuestions((prev) =>
                                prev.map((item) =>
                                  item.id === q.id ? { ...item, correctOptionId: opt.id } : item
                                )
                              )
                            }
                            aria-label={`انتخاب گزینه ${toPersianDigits(optIdx + 1)} به عنوان پاسخ صحیح`}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) =>
                              setQuizQuestions((prev) =>
                                prev.map((item) =>
                                  item.id === q.id
                                    ? {
                                        ...item,
                                        options: item.options.map((o) =>
                                          o.id === opt.id ? { ...o, text: e.target.value } : o
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder={`متن گزینه ${toPersianDigits(optIdx + 1)}`}
                            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                          {isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 rounded-b-2xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {toPersianDigits(chapters.length)} فصل · {toPersianDigits(quizQuestions.length)} سوال ·{' '}
            {toPersianDigits(inServiceHours)} ساعت ضمن خدمت
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 text-xs sm:text-sm font-bold"
            >
              {saving
                ? 'در حال ذخیره...'
                : editingCourse
                  ? 'ذخیره تغییرات دوره'
                  : publishAllSchools && canPublishAllSchools
                    ? 'انتشار در هر ۳ مدرسه'
                    : 'ثبت و انتشار دوره'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
