// Tab 5: Login Page Background Studio — Offline SVG Presets, Compressed Custom Image, Blur/Overlay & Logo (Phase 8A)
import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Image as ImageIcon,
  ImagePlus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type { LoginBackgroundConfig } from '../../types/domain';
import { OFFICIAL_SYSTEM_NAME_FA, SystemBrandLogo } from '../branding/BrandLogo';
import { SchoolPrintBrandingManager } from '../branding/SchoolPrintBrandingManager';
import { useSchoolData } from '../data/DataContext';
import {
  compressImageFileToDataUrl,
  createDefaultLoginBackgroundConfig,
  LOGIN_BG_PRESETS,
} from './superAdminHelpers';

export const LoginBackgroundStudioTab: React.FC = () => {
  const { globalSystemConfig, updateLoginBackgroundConfig, updateSystemLogo } = useSchoolData();

  const [draft, setDraft] = useState<LoginBackgroundConfig>(
    () => globalSystemConfig?.loginBackground ?? createDefaultLoginBackgroundConfig()
  );
  const [customImgKb, setCustomImgKb] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (globalSystemConfig?.loginBackground) {
      setDraft(globalSystemConfig.loginBackground);
    }
  }, [globalSystemConfig?.loginBackground]);

  const activePreset =
    LOGIN_BG_PRESETS.find((p) => p.id === draft.presetId) ?? LOGIN_BG_PRESETS[0];

  const handleUploadBgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, { maxWidth: 1440, quality: 0.72 });
      if (!compressed.ok || !compressed.dataUrl) {
        setFeedback(compressed.errorFa ?? 'خطا در فشرده‌سازی تصویر پس‌زمینه.');
        return;
      }
      setCustomImgKb(compressed.sizeKb ?? null);
      setDraft((prev) => ({
        ...prev,
        mode: 'custom_image',
        customImageDataUrl: compressed.dataUrl,
        customImageFileName: file.name,
        customImageSizeKb: compressed.sizeKb,
      }));
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'خطا در فشرده‌سازی تصویر پس‌زمینه.');
    } finally {
      e.target.value = '';
    }
  };

  const handleUploadLoginLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, { maxWidth: 400, quality: 0.82 });
      if (!compressed.ok || !compressed.dataUrl) {
        setFeedback(compressed.errorFa ?? 'خطا در فشرده‌سازی لوگوی ورود.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        loginLogoDataUrl: compressed.dataUrl,
      }));
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'خطا در فشرده‌سازی لوگوی ورود.');
    } finally {
      e.target.value = '';
    }
  };

  const handleUploadSystemLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, {
        maxWidth: 256,
        quality: 0.9,
        outputMime: 'image/png',
      });
      if (!compressed.ok || !compressed.dataUrl) {
        setFeedback(compressed.errorFa ?? 'خطا در پردازش تصویر لوگو.');
        return;
      }
      const res = updateSystemLogo(compressed.dataUrl, file.name);
      if (res.ok) {
        setFeedback('آیکون و لوگوی اصلی سامانه با موفقیت ذخیره شد و Favicon مرورگر به‌روزرسانی گردید.');
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'خطا در آپلود لوگوی سامانه.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetSystemLogo = () => {
    const res = updateSystemLogo(undefined, undefined);
    if (res.ok) {
      setFeedback('آیکون پیش‌فرض سامانه هوشمند مدارس گلستان راه روشن فعال شد.');
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleSave = () => {
    const res = updateLoginBackgroundConfig(draft);
    if (res.ok) {
      setFeedback('تنظیمات پس‌زمینه و ظاهر صفحه ورود با موفقیت ذخیره و فعال شد.');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleReset = () => {
    const def = createDefaultLoginBackgroundConfig();
    setDraft(def);
    setCustomImgKb(null);
    updateLoginBackgroundConfig(def);
    setFeedback('پس‌زمینه صفحه ورود به حالت پیشفرض بازگردانی شد.');
    setTimeout(() => setFeedback(null), 3500);
  };

  const overlayColor =
    draft.overlayTone === 'dark'
      ? `rgba(15, 23, 42, ${draft.overlayOpacity / 100})`
      : `rgba(255, 255, 255, ${draft.overlayOpacity / 100})`;

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main System Brand Logo & Dynamic Favicon Uploader */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <SystemBrandLogo logoDataUrl={globalSystemConfig?.systemLogoDataUrl} size="lg" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                آیکون و لوگوی اصلی {OFFICIAL_SYSTEM_NAME_FA}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-5">
                این لوگو به‌صورت خودکار در صفحه ورود، نوار بالای سامانه (هدر)، سربرگ چاپی گزارش‌ها و آیکون تب مرورگر (Favicon) نمایش داده می‌شود.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="brand-btn min-h-[42px] inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold">
              <ImagePlus className="h-4 w-4" />
              <span>آپلود لوگو / آیکون</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadSystemLogo}
                className="hidden"
              />
            </label>
            {globalSystemConfig?.systemLogoDataUrl && (
              <button
                type="button"
                onClick={handleResetSystemLogo}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>بازگشت به پیش‌فرض</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Per-School Logo & Print Letterhead Manager (100% Dynamic Across All Complexes & Schools) */}
      <SchoolPrintBrandingManager mode="multi_school_admin" compact />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-4 lg:col-span-7">
          {/* Curated Offline Presets */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 brand-text" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  قالب‌های گرافیکی آماده (کاملاً آفلاین و سبک)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>پیشفرض</span>
                </button>
                <button
                  type="button"
                  data-testid="save-login-studio-btn"
                  onClick={handleSave}
                  className="brand-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>ذخیره پس‌زمینه ورود</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {LOGIN_BG_PRESETS.map((preset) => {
                const selected = draft.mode === 'preset' && draft.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-login-preset={preset.id}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        mode: 'preset',
                        presetId: preset.id,
                      }))
                    }
                    className={`group overflow-hidden rounded-xl border text-right transition-colors ${
                      selected
                        ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-ring)]'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <div
                      className="relative h-16 w-full"
                      style={{
                        backgroundImage: preset.cssBackground,
                        backgroundSize: 'auto, cover',
                        backgroundRepeat: 'repeat, no-repeat',
                      }}
                    >
                      {selected && (
                        <span className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-900 shadow-xs">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="bg-white p-2 dark:bg-slate-900">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {preset.titleFa}
                      </div>
                      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {preset.descriptionFa}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Image Upload + Logo + Sliders */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 brand-text" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                تصویر اختصاصی، لوگو و تنظیمات تاری / پوشش
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  تصویر پس‌زمینه اختصاصی (فشرده‌سازی خودکار)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span>بارگذاری تصویر</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleUploadBgImage}
                      className="hidden"
                    />
                  </label>
                  {draft.customImageDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          mode: 'preset',
                          customImageDataUrl: undefined,
                          customImageFileName: undefined,
                        }))
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline dark:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>حذف تصویر</span>
                    </button>
                  )}
                </div>
                {draft.customImageFileName && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    فایل فعال: {draft.customImageFileName}
                    {customImgKb !== null && ` (${toPersianDigits(customImgKb)} کیلوبایت)`}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  لوگوی اختصاصی صفحه ورود
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span>بارگذاری لوگو</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleUploadLoginLogo}
                      className="hidden"
                    />
                  </label>
                  {draft.loginLogoDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, loginLogoDataUrl: undefined }))
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline dark:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>حذف لوگو</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sliders */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>تاری پس‌زمینه</span>
                  <span className="tabular-nums">{toPersianDigits(draft.blurPx)} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  data-testid="login-studio-blur-slider"
                  value={draft.blurPx}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, blurPx: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--brand-primary)]"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>شفافیت لایه پوششی</span>
                  <span className="tabular-nums">{toPersianDigits(draft.overlayOpacity)}٪</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  data-testid="login-studio-opacity-slider"
                  value={draft.overlayOpacity}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, overlayOpacity: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--brand-primary)]"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                  رنگ لایه پوششی
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, overlayTone: 'dark' }))}
                    className={`rounded-xl border py-1.5 text-xs font-bold ${
                      draft.overlayTone === 'dark'
                        ? 'brand-btn border-transparent'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    لایه تیره
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, overlayTone: 'light' }))}
                    className={`rounded-xl border py-1.5 text-xs font-bold ${
                      draft.overlayTone === 'light'
                        ? 'brand-btn border-transparent'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    لایه روشن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Mini-Preview Column */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                پیش‌نمایش زنده صفحه ورود
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {draft.mode === 'custom_image' ? 'تصویر اختصاصی' : activePreset.titleFa}
              </span>
            </div>

            <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {/* Background Layer */}
              <div
                className="absolute inset-0 bg-center"
                style={{
                  backgroundImage:
                    draft.mode === 'custom_image' && draft.customImageDataUrl
                      ? `url(${draft.customImageDataUrl})`
                      : activePreset.cssBackground,
                  backgroundSize:
                    draft.mode === 'custom_image' && draft.customImageDataUrl
                      ? 'cover'
                      : 'auto, cover',
                  backgroundRepeat:
                    draft.mode === 'custom_image' && draft.customImageDataUrl
                      ? 'no-repeat'
                      : 'repeat, no-repeat',
                  transform: draft.blurPx > 0 ? 'scale(1.05)' : undefined,
                  filter: draft.blurPx > 0 ? `blur(${draft.blurPx}px)` : undefined,
                }}
              />
              {/* Scrim Overlay */}
              <div className="absolute inset-0" style={{ backgroundColor: overlayColor }} />

              {/* Mini Login Card Mock */}
              <div className="relative z-10 flex h-full items-center justify-center p-5">
                <div className="w-full max-w-[230px] rounded-2xl border border-white/40 bg-white/95 p-4 text-center shadow-lg backdrop-blur-sm">
                  {draft.loginLogoDataUrl ? (
                    <img
                      src={draft.loginLogoDataUrl}
                      alt="لوگوی ورود"
                      className="mx-auto mb-2 h-10 w-10 rounded-xl object-contain"
                    />
                  ) : (
                    <div className="brand-bg mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold">
                      م
                    </div>
                  )}
                  <div className="text-xs font-extrabold text-slate-900">
                    سامانه مدیریت هوشمند مدارس
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    ورود یکپارچه مدیران، معلمان، اولیا و دانش‌آموزان
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="h-6 rounded-lg bg-slate-100" />
                    <div className="h-6 rounded-lg bg-slate-100" />
                    <div className="brand-bg h-6 rounded-lg text-[10px] leading-6 font-bold">
                      ورود به سامانه
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
