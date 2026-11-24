// Modal: Create Flipped Video Lesson («ارسال ویدیوی کلاس وارونه») with 40MB Blob Upload OR 60s Built-in Demo Mode + Mandatory 2–3 Question Micro-Quiz
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Film,
  Library,
  Plus,
  PlaySquare,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { useToast } from '../../core/ui/ToastContext';
import {
  validateFlippedVideoFile,
  validateJalaliDate,
} from '../../core/validation/validators';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import type {
  FlippedMicroQuizQuestion,
  FlippedVideoLesson,
  FlippedVideoSource,
  MediaAttachmentRef,
} from '../../types/domain';

interface CreateFlippedLessonModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (lesson: FlippedVideoLesson) => void;
}

function createEmptyQuizQuestion(index: number): FlippedMicroQuizQuestion {
  return {
    id: `mq-${Date.now()}-${index}`,
    questionText: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
  };
}

export const CreateFlippedLessonModal: React.FC<CreateFlippedLessonModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const {
    activeSchoolId,
    classes,
    teachers,
    linkedTeacher,
    session,
    questionBank,
    upsertFlippedLesson,
  } = useSchoolData();
  const { showToast } = useToast();

  const [classId, setClassId] = useState<string>(classes[0]?.id ?? '');
  const [subject, setSubject] = useState<string>('ریاضی');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [deadlineJalali, setDeadlineJalali] = useState<string>(
    addDaysToJalali(getTodayJalali(), 5)
  );
  const [videoSource, setVideoSource] = useState<FlippedVideoSource>('demo_60s');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDuration, setUploadedDuration] = useState<number>(60);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [microQuiz, setMicroQuiz] = useState<FlippedMicroQuizQuestion[]>([
    createEmptyQuizQuestion(1),
    createEmptyQuizQuestion(2),
  ]);
  const [showBankPicker, setShowBankPicker] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  const mcqBankItems = useMemo(
    () =>
      questionBank.filter(
        (q) =>
          q.type === 'multiple_choice' &&
          Array.isArray(q.options) &&
          q.options.length === 4
      ),
    [questionBank]
  );

  if (!open) return null;

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setVideoError(null);
    if (!file) {
      setUploadedFile(null);
      return;
    }

    const res = validateFlippedVideoFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!res.valid) {
      setVideoError(res.errors[0]);
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    // Probe duration safely via temporary video element
    const probeUrl = URL.createObjectURL(file);
    const probeVideo = document.createElement('video');
    probeVideo.preload = 'metadata';
    probeVideo.onloadedmetadata = () => {
      if (Number.isFinite(probeVideo.duration) && probeVideo.duration > 3) {
        setUploadedDuration(Math.round(probeVideo.duration));
      }
      URL.revokeObjectURL(probeUrl);
    };
    probeVideo.onerror = () => {
      setUploadedDuration(60);
      URL.revokeObjectURL(probeUrl);
    };
    probeVideo.src = probeUrl;
  };

  const handleImportFromBank = (bankId: string) => {
    const item = mcqBankItems.find((q) => q.id === bankId);
    if (!item || !item.options) return;

    const imported: FlippedMicroQuizQuestion = {
      id: `mq-qb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionText: item.questionText,
      options: [...item.options] as [string, string, string, string],
      correctOptionIndex: item.correctOptionIndex ?? 0,
      sourceQuestionBankId: item.id,
    };

    setMicroQuiz((prev) => {
      // Fill first blank slot if exists, else append up to 3 questions
      const emptyIdx = prev.findIndex((q) => q.questionText.trim().length === 0);
      if (emptyIdx >= 0) {
        const copy = [...prev];
        copy[emptyIdx] = imported;
        return copy;
      }
      if (prev.length < 3) return [...prev, imported];
      const copy = [...prev];
      copy[2] = imported;
      return copy;
    });
    showToast('سوال از بانک سوالات به تستک درک مطلب اضافه شد.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    const resolvedClassId = classId || classes[0]?.id || '';
    const cleanDeadline = toAsciiDigits(deadlineJalali).trim();

    if (!resolvedClassId) errors.push('انتخاب کلاس الزامی است.');
    if (!subject.trim()) errors.push('نام درس الزامی است.');
    if (title.trim().length < 3) errors.push('عنوان درس ویدیویی باید حداقل ۳ کاراکتر باشد.');
    if (!validateJalaliDate(cleanDeadline)) {
      errors.push('تاریخ مهلت تماشا باید تاریخ شمسی معتبر باشد (مثال: ۱۴۰۵/۰۹/۰۵).');
    }
    if (videoSource === 'uploaded_blob' && !uploadedFile) {
      errors.push('لطفاً فایل ویدیویی (حداکثر ۴۰ مگابایت) انتخاب کنید یا حالت نمایشی ۶۰ ثانیه‌ای را برگزینید.');
    }
    if (microQuiz.length < 2 || microQuiz.length > 3) {
      errors.push('تستک درک مطلب باید شامل ۲ تا ۳ سوال چهارگزینه‌ای باشد.');
    } else {
      microQuiz.forEach((q, idx) => {
        if (q.questionText.trim().length < 4) {
          errors.push(`متن سوال ${toPersianDigits(idx + 1)} تستک درک مطلب ناقص است.`);
        }
        if (q.options.some((opt) => opt.trim().length === 0)) {
          errors.push(`هر ۴ گزینه سوال ${toPersianDigits(idx + 1)} تستک درک مطلب باید تکمیل شوند.`);
        }
      });
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    setFormErrors([]);

    try {
      let videoMediaRef: MediaAttachmentRef | undefined;
      if (videoSource === 'uploaded_blob' && uploadedFile) {
        const mediaId = `${activeSchoolId}:fvvideo:${Date.now()}`;
        await saveMediaBlob({
          mediaId,
          schoolId: activeSchoolId,
          fileName: uploadedFile.name,
          mimeType: uploadedFile.type || 'video/mp4',
          sizeBytes: uploadedFile.size,
          blob: uploadedFile,
          createdAt: new Date().toISOString(),
        });
        videoMediaRef = {
          mediaId,
          schoolId: activeSchoolId,
          fileName: uploadedFile.name,
          mimeType: uploadedFile.type || 'video/mp4',
          kind: 'video',
          sizeBytes: uploadedFile.size,
        };
      }

      const targetClass = classes.find((c) => c.id === resolvedClassId);
      const teacher =
        linkedTeacher ??
        teachers.find((t) => t.id === targetClass?.homeroomTeacherId) ??
        teachers[0];

      const nowIso = new Date().toISOString();
      const lesson: FlippedVideoLesson = {
        id: `${activeSchoolId}:fvlesson:${Date.now()}`,
        schoolId: activeSchoolId,
        classId: resolvedClassId,
        teacherId: teacher?.id ?? 'staff',
        teacherName: teacher?.fullName ?? session?.displayName ?? 'معلم درس',
        subject: subject.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        deadlineJalali: cleanDeadline,
        videoSource,
        videoMediaRef,
        durationSeconds: videoSource === 'demo_60s' ? 60 : Math.max(15, uploadedDuration),
        microQuiz: microQuiz.map((q) => ({
          ...q,
          questionText: q.questionText.trim(),
          options: q.options.map((o) => o.trim()) as [string, string, string, string],
        })),
        createdAtJalali: getTodayJalali(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const res = upsertFlippedLesson(lesson);
      if (!res.ok) {
        setFormErrors([res.errorFa ?? 'خطا در ذخیره درس کلاس وارونه']);
        setSaving(false);
        return;
      }

      showToast(`ویدیوی کلاس وارونه «${lesson.title}» با موفقیت منتشر شد.`);
      onCreated?.(lesson);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-flipped-lesson-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl my-6 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2
              id="create-flipped-lesson-title"
              className="text-base font-extrabold text-slate-900 dark:text-slate-100"
            >
              ارسال ویدیوی کلاس وارونه
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              بارگذاری ویدیوی آفلاین (تا ۴۰ مگابایت) یا حالت نمایشی ۶۰ ثانیه‌ای همراه با تستک درک مطلب
            </p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {formErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {formErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {/* Basic Lesson Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                کلاس هدف
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نام درس
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثلاً: ریاضی، علوم تجربی، فارسی"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                مهلت تماشا (تاریخ شمسی)
              </label>
              <input
                type="text"
                dir="ltr"
                value={deadlineJalali}
                onChange={(e) => setDeadlineJalali(e.target.value)}
                placeholder="1405/09/10"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-left tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                عنوان ویدیوی آموزشی
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: آموزش جمع و تفریق کسرهای هم‌مخرج"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضیحات راهنما برای دانش‌آموز (اختیاری)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="نکات کلیدی پیش از تماشا و شرکت در تستک"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Video Source Selector */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              منبع ویدیوی آموزشی
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVideoSource('demo_60s')}
                className={`p-3.5 rounded-xl border text-right transition-colors flex items-start gap-3 ${
                  videoSource === 'demo_60s'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <PlaySquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    حالت نمایشی / ویدیوی آزمایشی ۶۰ ثانیه‌ای
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    پلیر تعاملی بدون نیاز به فایل MP4 با پشتیبانی کامل از قفل جلو زدن و سنجش سرعت
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVideoSource('uploaded_blob')}
                className={`p-3.5 rounded-xl border text-right transition-colors flex items-start gap-3 ${
                  videoSource === 'uploaded_blob'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Film className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    بارگذاری فایل ویدیویی آفلاین (حداکثر ۴۰ مگابایت)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ذخیره‌سازی امن درون IndexedDB اختصاصی مدرسه بدون اشغال localStorage
                  </div>
                </div>
              </button>
            </div>

            {videoSource === 'uploaded_blob' && (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-950/60">
                <label className="flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {uploadedFile
                          ? `${uploadedFile.name} (${toPersianDigits((uploadedFile.size / (1024 * 1024)).toFixed(1))} مگابایت)`
                          : 'انتخاب فایل ویدیویی MP4 / WebM (سقف ۴۰ مگابایت)'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        مدت تخمینی: {toPersianDigits(uploadedDuration)} ثانیه
                      </div>
                    </div>
                  </div>
                  <span className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold whitespace-nowrap">
                    انتخاب ویدیو
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileChange}
                    className="sr-only"
                  />
                </label>
                {videoError && (
                  <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {videoError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Mandatory 2-3 Question Micro-Quiz */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  تستک درک مطلب (الزامی — ۲ تا ۳ سوال چهارگزینه‌ای)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  پس از تماشای حداقل ۸۵٪ ویدیو به‌صورت خودکار برای دانش‌آموز باز می‌شود
                </p>
              </div>
              <div className="flex items-center gap-2">
                {mcqBankItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBankPicker((v) => !v)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-3 text-xs font-bold whitespace-nowrap"
                  >
                    <Library className="w-3.5 h-3.5" />
                    <span>ورود از بانک سوالات ({toPersianDigits(mcqBankItems.length)})</span>
                  </button>
                )}
                {microQuiz.length < 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      setMicroQuiz((prev) => [...prev, createEmptyQuizQuestion(prev.length + 1)])
                    }
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن سوال سوم</span>
                  </button>
                )}
              </div>
            </div>

            {showBankPicker && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 space-y-2 max-h-44 overflow-y-auto">
                <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  انتخاب سریع سوال چهارگزینه‌ای از بانک سوالات:
                </div>
                {mcqBankItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.questionText}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.gradeLabel} · {item.subject}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportFromBank(item.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                    >
                      افزودن
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {microQuiz.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/60 dark:bg-slate-950/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      سوال {toPersianDigits(qIdx + 1)} تستک درک مطلب
                    </span>
                    {microQuiz.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMicroQuiz((prev) => prev.filter((_, i) => i !== qIdx))
                        }
                        aria-label={`حذف سوال ${qIdx + 1}`}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={q.questionText}
                    onChange={(e) =>
                      setMicroQuiz((prev) =>
                        prev.map((item, i) =>
                          i === qIdx ? { ...item, questionText: e.target.value } : item
                        )
                      )
                    }
                    placeholder="متن سوال درک مطلب را بنویسید..."
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctOptionIndex === optIdx;
                      return (
                        <div key={optIdx} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setMicroQuiz((prev) =>
                                prev.map((item, i) =>
                                  i === qIdx ? { ...item, correctOptionIndex: optIdx } : item
                                )
                              )
                            }
                            aria-label={`تعیین گزینه ${optIdx + 1} به عنوان پاسخ صحیح`}
                            className={`min-h-[36px] min-w-[36px] rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                              isCorrect
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              setMicroQuiz((prev) =>
                                prev.map((item, i) => {
                                  if (i !== qIdx) return item;
                                  const nextOpts = [...item.options] as [
                                    string,
                                    string,
                                    string,
                                    string,
                                  ];
                                  nextOpts[optIdx] = e.target.value;
                                  return { ...item, options: nextOpts };
                                })
                              )
                            }
                            placeholder={`گزینه ${toPersianDigits(optIdx + 1)}`}
                            className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              {saving ? 'در حال ذخیره ویدیو...' : 'انتشار ویدیوی کلاس وارونه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
