// Safe Inline Preview Component for IndexedDB Media Blobs (Images, Audio, Video, PDF)
import React, { useEffect, useState } from 'react';
import {
  FileText,
  Film,
  Image as ImageIcon,
  Maximize2,
  Volume2,
  X,
} from 'lucide-react';
import { getMediaBlob } from '../data/mediaBlobStore';
import { toPersianDigits } from '../../lib/digits';
import type { MediaAttachmentRef } from '../../types/domain';

interface MediaAttachmentPreviewProps {
  attachment: MediaAttachmentRef;
  compact?: boolean;
  onRemove?: () => void;
}

function formatBytesFa(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
  }
  return `${toPersianDigits(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
}

export const MediaAttachmentPreview: React.FC<MediaAttachmentPreviewProps> = ({
  attachment,
  compact = false,
  onRemove,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    void getMediaBlob(attachment.mediaId, attachment.schoolId).then((rec) => {
      if (!active) return;
      if (!rec) {
        setMissing(true);
        return;
      }
      createdUrl = URL.createObjectURL(rec.blob);
      setObjectUrl(createdUrl);
      setMissing(false);
    });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [attachment.mediaId, attachment.schoolId]);

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {attachment.kind === 'image' && (
              <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            {attachment.kind === 'audio' && (
              <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            {attachment.kind === 'video' && (
              <Film className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            {attachment.kind === 'pdf' && (
              <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {attachment.fileName}
            </span>
            <span className="text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
              ({formatBytesFa(attachment.sizeBytes)})
            </span>
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`حذف پیوست ${attachment.fileName}`}
              className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {missing ? (
          <div className="text-xs text-amber-700 dark:text-amber-400">
            فایل رسانه‌ای روی این دستگاه موجود نیست (ذخیره‌شده در حافظه محلی دستگاه ارسال‌کننده).
          </div>
        ) : !objectUrl ? (
          <div className="text-xs text-slate-400">در حال بارگذاری پیش‌نمایش...</div>
        ) : (
          <div>
            {attachment.kind === 'image' && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0"
                  aria-label={`مشاهده تصویر ${attachment.fileName}`}
                >
                  <img
                    src={objectUrl}
                    alt={attachment.fileName}
                    className={
                      compact
                        ? 'w-16 h-16 object-cover'
                        : 'w-28 h-20 object-cover group-hover:scale-105 transition-transform'
                    }
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  مشاهده تصویر
                </button>
              </div>
            )}

            {attachment.kind === 'audio' && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  پخش صوت
                </div>
                <audio controls src={objectUrl} className="w-full h-9" />
              </div>
            )}

            {attachment.kind === 'video' && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  پخش ویدیو
                </div>
                <video
                  controls
                  src={objectUrl}
                  className={
                    compact
                      ? 'w-full max-w-xs max-h-40 rounded-lg bg-slate-950'
                      : 'w-full max-w-md max-h-60 rounded-lg bg-slate-950'
                  }
                />
              </div>
            )}

            {attachment.kind === 'pdf' && (
              <div className="flex items-center gap-3">
                <a
                  href={objectUrl}
                  download={attachment.fileName}
                  className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  دریافت / مشاهده فایل PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clickable Full Image Lightbox Modal */}
      {lightboxOpen && objectUrl && attachment.kind === 'image' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`مشاهده تصویر ${attachment.fileName}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="max-w-3xl w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {attachment.fileName}
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="min-h-[36px] inline-flex items-center gap-1 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <X className="w-4 h-4" />
                بستن
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-950 rounded-xl p-2 max-h-[75vh] overflow-auto">
              <img
                src={objectUrl}
                alt={attachment.fileName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
