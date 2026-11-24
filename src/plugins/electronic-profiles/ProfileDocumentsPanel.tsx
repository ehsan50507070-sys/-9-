// Modular Digital Document Uploader & Previewer for Electronic Profiles
// Stores real image (<=5MB) and PDF (<=10MB) blobs in IndexedDB `mediaBlobs` keyed by `schoolId` + `mediaId`.
import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileImage,
  FileText,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteMediaBlob,
  getMediaBlob,
  saveMediaBlob,
} from '../../core/data/mediaBlobStore';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type { ProfileDocumentCategory, ProfileDocumentItem } from '../../types/domain';
import {
  PROFILE_DOC_CATEGORY_LABELS,
  validateProfileDocumentFile,
} from './electronicProfilesHelpers';

interface ProfileDocumentsPanelProps {
  schoolId: string;
  ownerPrefix: string; // e.g., `st:${studentId}` or `sf:${teacherId}`
  uploaderName: string;
  documents: ProfileDocumentItem[];
  allowedCategories: ProfileDocumentCategory[];
  canManage: boolean;
  onAddDocument: (doc: ProfileDocumentItem) => void;
  onDeleteDocument: (docId: string) => void;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

function formatFileSizeFa(bytes: number): string {
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) {
    return `${toPersianDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
  }
  return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(2))} مگابایت`;
}

export const ProfileDocumentsPanel: React.FC<ProfileDocumentsPanelProps> = ({
  schoolId,
  ownerPrefix,
  uploaderName,
  documents,
  allowedCategories,
  canManage,
  onAddDocument,
  onDeleteDocument,
  onToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProfileDocumentCategory>(
    allowedCategories[0] ?? 'other'
  );
  const [customTitle, setCustomTitle] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<{
    doc: ProfileDocumentItem;
    url: string | null;
    loading: boolean;
  } | null>(null);

  // Clean up object URL when preview closes or component unmounts
  useEffect(() => {
    const currentUrl = previewDoc?.url ?? null;
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [previewDoc?.url]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const check = validateProfileDocumentFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!check.valid || !check.kind) {
      onToast(check.errorFa ?? 'فایل انتخاب‌شده معتبر نیست.', 'error');
      return;
    }

    setUploading(true);
    try {
      const nowIso = new Date().toISOString();
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const mediaId = `${schoolId}:pdoc:${ownerPrefix}:${uid}`;

      await saveMediaBlob({
        mediaId,
        schoolId,
        fileName: file.name,
        mimeType: file.type || (check.kind === 'pdf' ? 'application/pdf' : 'image/png'),
        sizeBytes: file.size,
        blob: file,
        createdAt: nowIso,
      });

      const docItem: ProfileDocumentItem = {
        id: `doc-${uid}`,
        mediaId,
        schoolId,
        title: customTitle.trim() || PROFILE_DOC_CATEGORY_LABELS[selectedCategory],
        docCategory: selectedCategory,
        fileName: file.name,
        mimeType: file.type || (check.kind === 'pdf' ? 'application/pdf' : 'image/png'),
        kind: check.kind,
        sizeBytes: file.size,
        uploadedByName: uploaderName,
        uploadedAtJalali: getTodayJalali(),
        uploadedAtIso: nowIso,
      };

      onAddDocument(docItem);
      setCustomTitle('');
      onToast(`مدرک «${docItem.title}» با موفقیت در بایگانی دیجیتال ذخیره شد.`);
    } catch {
      onToast('خطا در ذخیره فایل در حافظه مرورگر.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = async (doc: ProfileDocumentItem) => {
    setPreviewDoc({ doc, url: null, loading: true });
    try {
      const stored = await getMediaBlob(doc.mediaId, schoolId);
      if (!stored) {
        setPreviewDoc({ doc, url: null, loading: false });
        return;
      }
      const objectUrl = URL.createObjectURL(stored.blob);
      setPreviewDoc({ doc, url: objectUrl, loading: false });
    } catch {
      setPreviewDoc({ doc, url: null, loading: false });
    }
  };

  const handleDownload = async (doc: ProfileDocumentItem) => {
    const stored = await getMediaBlob(doc.mediaId, schoolId);
    if (!stored) {
      onToast('فایل اصلی این مدرک در حافظه محلی این دستگاه موجود نیست.', 'info');
      return;
    }
    const url = URL.createObjectURL(stored.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRemove = async (doc: ProfileDocumentItem) => {
    if (!canManage) return;
    await deleteMediaBlob(doc.mediaId);
    onDeleteDocument(doc.id);
    if (previewDoc?.doc.id === doc.id) {
      setPreviewDoc(null);
    }
    onToast(`مدرک «${doc.title}» از پرونده حذف شد.`, 'info');
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              بارگذاری مدرک جدید در بایگانی الکترونیک
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              تصویر (حداکثر ۵ مگابایت) یا PDF (حداکثر ۱۰ مگابایت) — ذخیره امن در IndexedDB
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                نوع مدرک
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as ProfileDocumentCategory)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
              >
                {allowedCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {PROFILE_DOC_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                عنوان نمایشی (اختیاری)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={PROFILE_DOC_CATEGORY_LABELS[selectedCategory]}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileChange}
                className="hidden"
                aria-label="انتخاب فایل مدرک"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold px-4 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'در حال ذخیره‌سازی...' : 'انتخاب و بارگذاری فایل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          هنوز مدرک دیجیتالی برای این پرونده ثبت نشده است.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    doc.kind === 'pdf'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {doc.kind === 'pdf' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <FileImage className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {doc.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {PROFILE_DOC_CATEGORY_LABELS[doc.docCategory]} · {doc.fileName}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                    {formatFileSizeFa(doc.sizeBytes)} · ثبت در {toPersianDigits(doc.uploadedAtJalali)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleOpenPreview(doc)}
                  aria-label={`پیش‌نمایش ${doc.title}`}
                  title="پیش‌نمایش"
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload(doc)}
                  aria-label={`دانلود ${doc.title}`}
                  title="دانلود"
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(doc)}
                    aria-label={`حذف ${doc.title}`}
                    title="حذف مدرک"
                    className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline Document Preview Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`پیش‌نمایش مدرک ${previewDoc.doc.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {previewDoc.doc.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {previewDoc.doc.fileName} · {formatFileSizeFa(previewDoc.doc.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="بستن پیش‌نمایش"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[320px]">
              {previewDoc.loading ? (
                <div className="text-sm text-slate-500">در حال بارگذاری مدرک...</div>
              ) : !previewDoc.url ? (
                <div className="text-center space-y-2 max-w-sm">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    فایل باینری این مدرک در این مرورگر یافت نشد
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    این رکورد از طریق نسخه پشتیبان JSON یا داده نمونه بارگذاری شده است. در صورت نیاز
                    می‌توانید فایل اصلی را مجدداً بارگذاری کنید.
                  </p>
                </div>
              ) : previewDoc.doc.kind === 'image' ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.doc.title}
                  className="max-w-full max-h-[68vh] rounded-lg object-contain shadow"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.doc.title}
                  className="w-full h-[68vh] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
