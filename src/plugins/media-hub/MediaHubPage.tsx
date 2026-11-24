// Add-on 7: Session Media Hub («بانک محتوای جلسه») with safe attachments, MediaRecorder voice notes, preview & Class Chat outbox
import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  FileAudio,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Link2,
  Mic,
  Plus,
  Presentation,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { useToast } from '../../core/ui/ToastContext';
import {
  MAX_ATTACHMENT_BYTES,
  validateAttachmentFile,
  validateSafeHttpUrl,
} from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import { copyTextToClipboard, formatSingleColumnMessengerReport } from '../../lib/messenger';
import type { MediaResource, MediaResourceKind } from '../../types/domain';

const KIND_META: Record<
  MediaResourceKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  pptx: {
    label: 'اسلاید پاورپوینت',
    icon: Presentation,
    colorClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
  },
  pdf: {
    label: 'کاربرگ PDF',
    icon: FileText,
    colorClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300',
  },
  image: {
    label: 'تصویر آموزشی',
    icon: ImageIcon,
    colorClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
  },
  link: {
    label: 'پیوند امن آموزشی',
    icon: Link2,
    colorClass: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300',
  },
  audio: {
    label: 'یادداشت صوتی / ویس',
    icon: FileAudio,
    colorClass: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300',
  },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  return `${toPersianDigits(Math.round(bytes / 1024))} کیلوبایت`;
}

export const MediaHubPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    session,
    defaultWorkdayJalali,
    classes,
    mediaResources,
    chatOutbox,
    addMediaResource,
    deleteMediaResource,
    sendMediaToClassChat,
  } = useSchoolData();
  const { showToast } = useToast();

  const canManage = roleDef.canManageMediaHub;
  const [gradeFilter, setGradeFilter] = useState<'all' | 2 | 3 | 4 | 5 | 6>('all');
  const [kindFilter, setKindFilter] = useState<'all' | MediaResourceKind>('all');
  const [previewItem, setPreviewItem] = useState<MediaResource | null>(null);
  const [chatTargetResource, setChatTargetResource] = useState<MediaResource | null>(null);
  const [chatClassId, setChatClassId] = useState<string>(classes[0]?.id ?? '');
  const [chatNote, setChatNote] = useState('');

  // Upload / Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [kind, setKind] = useState<MediaResourceKind>('pptx');
  const [gradeLevel, setGradeLevel] = useState<2 | 3 | 4 | 5 | 6>(classes[0]?.gradeLevel ?? 2);
  const [subject, setSubject] = useState('ریاضی');
  const [weekNumber, setWeekNumber] = useState(3);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [fileMime, setFileMime] = useState<string | undefined>(undefined);

  // Safe optional browser MediaRecorder for voice notes
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const filteredResources = useMemo(() => {
    return mediaResources.filter((r) => {
      if (gradeFilter !== 'all' && r.gradeLevel !== gradeFilter) return false;
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      return true;
    });
  }, [mediaResources, gradeFilter, kindFilter]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateAttachmentFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!validation.valid) {
      showToast(validation.errors[0], 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileDataUrl(reader.result);
        setFileName(file.name);
        setFileSize(file.size);
        setFileMime(file.type || 'application/octet-stream');
        showToast(`فایل «${file.name}» با موفقیت پیوست شد.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleVoiceRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      showToast(
        'ضبط زنده میکروفون در این مرورگر در دسترس نیست؛ لطفاً فایل صوتی (MP3/WAV/OGG) بارگذاری کنید.',
        'info'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          showToast('حجم صدای ضبط‌شده بیش از ۳۵۰ کیلوبایت است؛ لطفاً ضبط کوتاه‌تری انجام دهید.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setFileDataUrl(reader.result);
            setFileName(`voice-note-${Date.now()}.webm`);
            setFileSize(blob.size);
            setFileMime(blob.type || 'audio/webm');
            showToast('یادداشت صوتی با موفقیت ضبط و آماده ذخیره شد.');
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      showToast('دسترسی میکروفون تایید نشد؛ می‌توانید فایل صوتی آماده را بارگذاری کنید.', 'info');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setExternalUrl('');
    setFileDataUrl(undefined);
    setFileName(undefined);
    setFileSize(undefined);
    setFileMime(undefined);
  };

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (title.trim().length < 3) {
      showToast('عنوان محتوای آموزشی باید حداقل ۳ کاراکتر باشد.', 'error');
      return;
    }

    let safeUrl: string | undefined;
    if (kind === 'link') {
      const urlRes = validateSafeHttpUrl(externalUrl);
      if (!urlRes.valid) {
        showToast(urlRes.errors[0], 'error');
        return;
      }
      safeUrl = urlRes.data;
    }

    const resource: MediaResource = {
      id: `${activeSchoolId}:media:${Date.now()}`,
      schoolId: activeSchoolId,
      gradeLevel,
      subject: subject.trim() || 'عمومی',
      weekNumber,
      kind,
      title: title.trim(),
      description: description.trim() || 'محتوای آموزشی جلسه برای نمایش در کلاس و مرور منزل.',
      url: safeUrl,
      dataUrl: fileDataUrl,
      fileName,
      fileSizeBytes: fileSize,
      mimeType: fileMime,
      slideCount: kind === 'pptx' ? slideCount : undefined,
      uploadedByName: session?.displayName ?? roleDef.labelFa,
      uploadedByRole: activeRole,
      createdAtJalali: defaultWorkdayJalali,
      createdAt: new Date().toISOString(),
    };

    const res = addMediaResource(resource);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت محتوا.', 'error');
      return;
    }
    showToast(`محتوای «${resource.title}» در بانک محتوای جلسه ثبت شد.`);
    resetForm();
    setAddModalOpen(false);
  };

  const handleSendToClassChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatTargetResource || !chatClassId) return;
    const cls = classMap.get(chatClassId);
    const res = sendMediaToClassChat({
      id: `${activeSchoolId}:outbox:${Date.now()}`,
      schoolId: activeSchoolId,
      classId: chatClassId,
      resourceId: chatTargetResource.id,
      resourceTitle: chatTargetResource.title,
      resourceKind: chatTargetResource.kind,
      messageText:
        chatNote.trim() ||
        `محتوای «${chatTargetResource.title}» (${chatTargetResource.subject} — هفته ${toPersianDigits(chatTargetResource.weekNumber)}) برای کلاس ارسال شد.`,
      sentByName: session?.displayName ?? roleDef.labelFa,
      sentByRole: activeRole,
      sentAtJalali: defaultWorkdayJalali,
      sentAt: new Date().toISOString(),
      status: 'queued_for_class_chat',
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ارسال به چت کلاسی وجود نداشت.', 'error');
      return;
    }
    showToast(
      `محتوا به صف چت کلاسی «${cls?.name ?? ''}» ارسال شد (آماده اتصال خودکار به فاز ۴).`
    );
    setChatTargetResource(null);
    setChatNote('');
  };

  const handleCopyResourceForMessenger = async (item: MediaResource) => {
    const text = formatSingleColumnMessengerReport({
      schoolName: activeSchool.name,
      reportTitle: `محتوای آموزشی جلسه — ${item.subject}`,
      jalaliDateDisplay: formatJalaliDisplay(item.createdAtJalali, false),
      sections: [
        {
          heading: item.title,
          lines: [
            `پایه ${toPersianDigits(item.gradeLevel)} · هفته ${toPersianDigits(item.weekNumber)}`,
            `نوع محتوا: ${KIND_META[item.kind].label}`,
            item.description,
            ...(item.url ? [`پیوند مشاهده: ${item.url}`] : []),
          ],
        },
      ],
      footerNote: `بارگذاری‌شده توسط: ${item.uploadedByName}`,
    });
    const ok = await copyTextToClipboard(text);
    showToast(
      ok ? 'متن تک‌ستونه معرفی محتوا برای ایتا/بله/شاد کپی شد.' : 'کپی انجام نشد.',
      ok ? 'success' : 'error'
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            بانک محتوای جلسه و رسانه آموزشی
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            سازمان‌دهی اسلایدهای پاورپوینت، کاربرگ PDF، تصویر، پیوندهای امن آموزشی و یادداشت‌های
            صوتی هر جلسه با پیش‌نمایش کلاسی و ارسال مستقیم به چت کلاسی.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap self-start lg:self-auto"
          >
            <Plus className="w-4 h-4" />
            افزودن محتوای جدید
          </button>
        )}
      </div>

      {/* Filters + Outbox Status Bar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="فیلتر پایه تحصیلی"
            value={gradeFilter}
            onChange={(e) =>
              setGradeFilter(
                e.target.value === 'all' ? 'all' : (Number(e.target.value) as 2 | 3 | 4 | 5 | 6)
              )
            }
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه پایه‌ها</option>
            <option value="2">پایه دوم</option>
            <option value="3">پایه سوم</option>
            <option value="4">پایه چهارم</option>
            <option value="5">پایه پنجم</option>
            <option value="6">پایه ششم</option>
          </select>

          <select
            aria-label="فیلتر نوع محتوا"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as 'all' | MediaResourceKind)}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه فرمت‌ها</option>
            <option value="pptx">پاورپوینت (.pptx)</option>
            <option value="pdf">کاربرگ PDF</option>
            <option value="image">تصویر آموزشی</option>
            <option value="link">پیوند امن آموزشی</option>
            <option value="audio">یادداشت صوتی / ویس</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
          <span>
            تعداد محتوا: <strong>{toPersianDigits(filteredResources.length)}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-indigo-700 dark:text-indigo-400 font-semibold">
            ارسال‌شده به چت کلاسی: {toPersianDigits(chatOutbox.length)} مورد
          </span>
        </div>
      </div>

      {/* Resource Cards Grid */}
      {filteredResources.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <FolderKanban className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            محتوایی با این فیلتر یافت نشد
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            فیلترها را تغییر دهید یا از دکمه «افزودن محتوای جدید» منابع جلسه را بارگذاری کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <div>
                        پایه {toPersianDigits(item.gradeLevel)} · هفته {toPersianDigits(item.weekNumber)}
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {item.subject}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-6">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{meta.label}</span>
                    {item.slideCount && <span>{toPersianDigits(item.slideCount)} اسلاید</span>}
                    {item.fileSizeBytes && <span>{formatFileSize(item.fileSizeBytes)}</span>}
                    <span>{item.uploadedByName}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold px-3 transition-opacity whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    پیش‌نمایش کلاسی
                  </button>

                  {canManage && classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setChatTargetResource(item);
                        setChatClassId(classes[0]?.id ?? '');
                        setChatNote('');
                      }}
                      className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold px-3 transition-colors whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      ارسال به چت کلاسی
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleCopyResourceForMessenger(item)}
                    aria-label="کپی برای ایتا و بله"
                    className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = deleteMediaResource(item.id);
                        if (res.ok) showToast('محتوا حذف شد.', 'info');
                      }}
                      aria-label={`حذف ${item.title}`}
                      className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Class Chat Outbox Recent Activity (Phase 4 bridge) */}
      {chatOutbox.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              محتواهای ارسال‌شده به صف چت کلاسی ({toPersianDigits(chatOutbox.length)} مورد)
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              آماده همگام‌سازی خودکار با ماژول گفت‌وگوی کلاسی (فاز ۴)
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {chatOutbox.slice(0, 5).map((out) => (
              <div key={out.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {out.resourceTitle}
                  </span>
                  <span className="mx-2 text-slate-400">←</span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                    {classMap.get(out.classId)?.name ?? out.classId}
                  </span>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">{out.messageText}</p>
                </div>
                <span className="text-slate-400 tabular-nums whitespace-nowrap">
                  {formatJalaliDisplay(out.sentAtJalali, false)} · {out.sentByName}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* In-Class Preview Modal */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  حالت نمایش کلاسی · پایه {toPersianDigits(previewItem.gradeLevel)} · {previewItem.subject} (هفته{' '}
                  {toPersianDigits(previewItem.weekNumber)})
                </div>
                <h2
                  id="media-preview-title"
                  className="mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100"
                >
                  {previewItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                aria-label="بستن پیش‌نمایش"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {previewItem.description}
            </p>

            {/* Preview stage by kind */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-6">
              {previewItem.kind === 'image' && previewItem.dataUrl ? (
                <img
                  src={previewItem.dataUrl}
                  alt={previewItem.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[420px] mx-auto rounded-xl object-contain"
                />
              ) : previewItem.kind === 'audio' ? (
                <div className="space-y-3 text-center">
                  <FileAudio className="w-10 h-10 text-violet-600 dark:text-violet-400 mx-auto" />
                  {previewItem.dataUrl ? (
                    <audio controls src={previewItem.dataUrl} className="w-full" />
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      فایل صوتی نمونه: {previewItem.fileName ?? 'voice-note.mp3'} (مدت:{' '}
                      {toPersianDigits(previewItem.durationSeconds ?? 120)} ثانیه). برای پخش واقعی،
                      فایل صوتی یا ضبط زنده خود را بارگذاری کنید.
                    </div>
                  )}
                </div>
              ) : previewItem.kind === 'link' && previewItem.url ? (
                <div className="space-y-3 text-center">
                  <Link2 className="w-10 h-10 text-sky-600 dark:text-sky-400 mx-auto" />
                  <div className="text-xs text-slate-600 dark:text-slate-300 break-all" dir="ltr">
                    {previewItem.url}
                  </div>
                  <a
                    href={previewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    باز کردن منبع امن در تب جدید
                  </a>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  {previewItem.kind === 'pptx' ? (
                    <Presentation className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto" />
                  ) : (
                    <FileText className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
                  )}
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {previewItem.fileName ?? previewItem.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {previewItem.slideCount
                      ? `${toPersianDigits(previewItem.slideCount)} اسلاید آموزشی · `
                      : ''}
                    {formatFileSize(previewItem.fileSizeBytes)}
                  </div>
                  {previewItem.dataUrl && (
                    <a
                      href={previewItem.dataUrl}
                      download={previewItem.fileName ?? 'resource'}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5"
                    >
                      دریافت و نمایش فایل پیوست
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="min-h-[40px] px-5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Class Chat Modal */}
      {chatTargetResource && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <form
            onSubmit={handleSendToClassChat}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ارسال محتوا به چت کلاسی
              </h2>
              <button
                type="button"
                onClick={() => setChatTargetResource(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {chatTargetResource.title}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                انتخاب کلاس مقصد
              </label>
              <select
                value={chatClassId}
                onChange={(e) => setChatClassId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                توضیح همراه پیام (اختیاری)
              </label>
              <textarea
                rows={3}
                value={chatNote}
                onChange={(e) => setChatNote(e.target.value)}
                placeholder="مثال: دانش‌آموزان عزیز لطفاً پیش از جلسه پنج‌شنبه این فایل را مرور کنید."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChatTargetResource(null)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                ارسال به چت کلاسی
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Media Resource Modal */}
      {addModalOpen && canManage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <form
            onSubmit={handleCreateResource}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                افزودن محتوای جدید به بانک جلسه
              </h2>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نوع محتوا
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as MediaResourceKind)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="pptx">پاورپوینت (.pptx)</option>
                  <option value="pdf">کاربرگ PDF</option>
                  <option value="image">تصویر آموزشی (PNG/JPG)</option>
                  <option value="link">پیوند امن آموزشی (HTTPS)</option>
                  <option value="audio">یادداشت صوتی / ویس</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  پایه
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value) as 2 | 3 | 4 | 5 | 6)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {[2, 3, 4, 5, 6].map((g) => (
                    <option key={g} value={g}>
                      پایه {toPersianDigits(g)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  هفته
                </label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Number(e.target.value))}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  درس
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              {kind === 'pptx' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تعداد اسلاید
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                عنوان محتوا
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: کاربرگ تمرین کسرهای مساوی هفته سوم"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                توضیحات آموزشی
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            {kind === 'link' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نشانی امن آموزشی (فقط http/https)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  required
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://www.roshd.ir/..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  پیوست فایل (حداکثر ۳۵۰ کیلوبایت جهت پایداری آفلاین)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept={
                      kind === 'image'
                        ? 'image/png,image/jpeg,image/webp'
                        : kind === 'pdf'
                          ? 'application/pdf'
                          : kind === 'pptx'
                            ? '.pptx,.ppt'
                            : 'audio/*'
                    }
                    onChange={handleFileChange}
                    className="text-xs text-slate-600 dark:text-slate-300"
                  />
                  {kind === 'audio' && (
                    <button
                      type="button"
                      onClick={() => void toggleVoiceRecording()}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors ${
                        isRecording
                          ? 'bg-rose-600 text-white'
                          : 'border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          توقف ضبط صدا
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          ضبط ویس با میکروفون
                        </>
                      )}
                    </button>
                  )}
                </div>
                {fileName && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-400">
                    پیوست آماده: {fileName} ({formatFileSize(fileSize)})
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                ذخیره در بانک محتوا
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
