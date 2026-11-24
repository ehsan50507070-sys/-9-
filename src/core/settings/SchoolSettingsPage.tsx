// Independent School Settings («تنظیمات مدرسه») scoped strictly to activeSchool
// Step 3 Upgrade: Added School/Class/Subject Announcements CRUD, Section Title Editor,
// Restore Last State («بازگردانی به وضعیت قبل») and 2-Step Selective Safe Reset («ریست امن بخش انتخابی»).
import React, { useEffect, useState } from 'react';
import {
  Building2,
  History,
  Lock,
  Megaphone,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Tag,
  Trash2,
} from 'lucide-react';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { getTodayJalali, PERSIAN_WEEKDAY_NAMES } from '../../lib/jalali';
import type {
  PersianWeekdayIndex,
  SchoolAnnouncementScope,
  SelectiveResetModuleKey,
} from '../../types/domain';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import { AcademicYearManagerPanel } from '../academic-year/AcademicYearManagerPanel';
import { SchoolPrintBrandingManager } from '../branding/SchoolPrintBrandingManager';
import { useSchoolData } from '../data/DataContext';
import { generateUUID, sanitizeText } from '../security/sanitize';
import { SensitiveActionModal } from '../security/SensitiveActionModal';
import { useToast } from '../ui/ToastContext';
import { validateSchoolSettings } from '../validation/validators';
import { SELECTIVE_RESET_MODULES } from './recoveryHelpers';

const ALL_WEEKDAYS: PersianWeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];

type SettingsTab = 'general' | 'announcements_labels' | 'recovery_reset';

const EDITABLE_SECTION_LABELS: Array<{ id: string; defaultTitle: string }> = [
  { id: 'dashboard', defaultTitle: 'داشبورد' },
  { id: 'subjects', defaultTitle: 'دروس من' },
  { id: 'smart-archive', defaultTitle: 'آرشیو هوشمند' },
  { id: 'directory', defaultTitle: 'دانش‌آموزان و کادر' },
  { id: 'student-attendance', defaultTitle: 'حضور و غیاب دانش‌آموزان' },
  { id: 'homework', defaultTitle: 'تکالیف آنلاین' },
  { id: 'gradebook', defaultTitle: 'دفتر نمره و کارنامه' },
  { id: 'parent-staff-chat', defaultTitle: 'گفت‌وگوی اختصاصی اولیا' },
];

export const SchoolSettingsPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    session,
    classes,
    schoolBrandingConfig,
    schoolAnnouncements,
    recoverySnapshots,
    isActiveSchoolPanicLocked,
    updateActiveSchool,
    saveSchoolBrandingConfig,
    upsertSchoolAnnouncement,
    deleteSchoolAnnouncement,
    createRecoverySnapshot,
    executeSelectiveSafeReset,
    restoreRecoverySnapshot,
    verifyCurrentUserPassword,
  } = useSchoolData();
  const { isViewingArchivedYear, canManageAcademicYears, academicYearId } = useAcademicYear();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // --- General School Profile State ---
  const [name, setName] = useState(activeSchool.name);
  const [subtitle, setSubtitle] = useState(activeSchool.subtitle);
  const [principalName, setPrincipalName] = useState(activeSchool.principalName);
  const [phone, setPhone] = useState(activeSchool.phone);
  const [address, setAddress] = useState(activeSchool.address);
  const [academicYear, setAcademicYear] = useState(activeSchool.academicYear);
  const [activeWorkdays, setActiveWorkdays] = useState<PersianWeekdayIndex[]>(
    activeSchool.activeWorkdays
  );
  const [periodDurationMinutes, setPeriodDurationMinutes] = useState(
    activeSchool.periodDurationMinutes
  );
  const [letterheadTitle, setLetterheadTitle] = useState(activeSchool.letterheadTitle);
  const [letterheadSubtitle, setLetterheadSubtitle] = useState(activeSchool.letterheadSubtitle);
  const [signatureFooter, setSignatureFooter] = useState(activeSchool.signatureFooter);
  const [errors, setErrors] = useState<string[]>([]);

  // --- Announcements CRUD State ---
  const [annScope, setAnnScope] = useState<SchoolAnnouncementScope>('school');
  const [annClassId, setAnnClassId] = useState<string>(classes[0]?.id ?? '');
  const [annSubject, setAnnSubject] = useState<string>('');
  const [annTitle, setAnnTitle] = useState<string>('');
  const [annBody, setAnnBody] = useState<string>('');
  const [annPinned, setAnnPinned] = useState<boolean>(true);

  // --- Quick Section Label Editor State ---
  const [sectionLabelsDraft, setSectionLabelsDraft] = useState<Record<string, string>>(
    () => schoolBrandingConfig?.sectionLabels ?? {}
  );

  // --- 2-Step Safe Reset Confirmation Modal State ---
  const [resetModalModule, setResetModalModule] = useState<SelectiveResetModuleKey | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Reset form cleanly whenever the user switches schools
  useEffect(() => {
    setName(activeSchool.name);
    setSubtitle(activeSchool.subtitle);
    setPrincipalName(activeSchool.principalName);
    setPhone(activeSchool.phone);
    setAddress(activeSchool.address);
    setAcademicYear(activeSchool.academicYear);
    setActiveWorkdays(activeSchool.activeWorkdays);
    setPeriodDurationMinutes(activeSchool.periodDurationMinutes);
    setLetterheadTitle(activeSchool.letterheadTitle);
    setLetterheadSubtitle(activeSchool.letterheadSubtitle);
    setSignatureFooter(activeSchool.signatureFooter);
    setErrors([]);
  }, [activeSchool]);

  useEffect(() => {
    setSectionLabelsDraft(schoolBrandingConfig?.sectionLabels ?? {});
  }, [schoolBrandingConfig]);

  const readOnly =
    (!roleDef.canEditSchoolSettings && activeRole !== 'super_admin') ||
    isViewingArchivedYear ||
    isActiveSchoolPanicLocked;

  const toggleWorkday = (day: PersianWeekdayIndex) => {
    if (readOnly) return;
    setActiveWorkdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    const payload = {
      name: sanitizeText(name, 140),
      subtitle: sanitizeText(subtitle, 140),
      principalName: sanitizeText(principalName, 120),
      phone: toAsciiDigits(phone).trim(),
      address: sanitizeText(address, 260),
      academicYear: toAsciiDigits(academicYear).trim(),
      activeWorkdays,
      letterheadTitle: sanitizeText(letterheadTitle, 160),
      letterheadSubtitle: sanitizeText(letterheadSubtitle, 180),
      signatureFooter: sanitizeText(signatureFooter, 180),
      periodDurationMinutes: Number(periodDurationMinutes),
    };

    const result = validateSchoolSettings(payload);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    setErrors([]);
    await updateActiveSchool({
      ...activeSchool,
      ...payload,
      updatedAt: new Date().toISOString(),
    });
    showToast(`تنظیمات «${payload.name}» با موفقیت ذخیره شد.`);
  };

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const cleanTitle = sanitizeText(annTitle, 160);
    const cleanBody = sanitizeText(annBody, 1200);
    if (!cleanTitle || !cleanBody) {
      showToast('وارد کردن عنوان و متن اطلاعیه الزامی است.', 'warning');
      return;
    }
    const nowIso = new Date().toISOString();
    const res = upsertSchoolAnnouncement({
      id: generateUUID(),
      schoolId: activeSchoolId,
      complexId: activeSchool.complexId ?? 'complex-1',
      academicYearId,
      scope: annScope,
      classId: annScope === 'class' || annScope === 'subject' ? annClassId || undefined : undefined,
      subject: annScope === 'subject' ? sanitizeText(annSubject, 80) || 'عمومی' : undefined,
      title: cleanTitle,
      body: cleanBody,
      authorName: session?.displayName ?? activeSchool.principalName,
      authorRole: activeRole,
      audienceRoles: ['student', 'parent', 'teacher', 'principal', 'deputy'],
      pinned: annPinned,
      publishedAtJalali: getTodayJalali(),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      createdByUserId: session?.userId ?? 'admin',
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ثبت اطلاعیه نبود.', 'warning');
      return;
    }
    setAnnTitle('');
    setAnnBody('');
    setAnnSubject('');
    showToast('اطلاعیه جدید با موفقیت منتشر شد و در پنل مخاطبان نمایش داده می‌شود.');
  };

  const handleSaveSectionLabels = async () => {
    if (readOnly) return;
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(sectionLabelsDraft)) {
      const val = sanitizeText(v, 60);
      if (val) cleaned[k] = val;
    }
    const res = await saveSchoolBrandingConfig({
      id: schoolBrandingConfig?.id ?? generateUUID(),
      complexId: activeSchool.complexId ?? schoolBrandingConfig?.complexId ?? 'complex-1',
      schoolId: activeSchoolId,
      appTitle: schoolBrandingConfig?.appTitle,
      schoolDisplayName: schoolBrandingConfig?.schoolDisplayName,
      printSubtitle: schoolBrandingConfig?.printSubtitle,
      logoDataUrl: schoolBrandingConfig?.logoDataUrl,
      logoMediaId: schoolBrandingConfig?.logoMediaId,
      sectionLabels: cleaned,
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedByRole: activeRole,
      createdAtIso: schoolBrandingConfig?.createdAtIso,
      updatedAt: new Date().toISOString(),
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ذخیره عناوین بخش‌ها.', 'warning');
      return;
    }
    showToast('عناوین سفارشی منوها و بخش‌های مدرسه ذخیره و به‌صورت زنده اعمال شد.');
  };

  const handleManualSnapshot = async () => {
    if (readOnly) return;
    const res = await createRecoverySnapshot('full_school', 'نقطه بازیابی دستی مدیر مدرسه');
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ثبت نقطه بازیابی نبود.', 'warning');
      return;
    }
    showToast('نقطه بازیابی کامل وضعیت فعلی مدرسه با موفقیت ذخیره شد.');
  };

  const handleRestoreSnapshot = async (snapshotId: string, reasonFa: string) => {
    if (readOnly) return;
    setResetBusy(true);
    try {
      const res = await restoreRecoverySnapshot(snapshotId);
      if (!res.ok) {
        showToast(res.errorFa ?? 'امکان بازگردانی وجود نداشت.', 'warning');
        return;
      }
      showToast(`بازگردانی به «${reasonFa}» با موفقیت انجام شد.`);
    } finally {
      setResetBusy(false);
    }
  };

  const handleExecuteSafeReset = async (
    passwordPlain: string,
    confirmPhrase: string
  ): Promise<{ ok: boolean; errorFa?: string }> => {
    if (!resetModalModule || readOnly) {
      return { ok: false, errorFa: 'امکان اجرای ریست امن در وضعیت فقط‌خواندنی وجود ندارد.' };
    }
    if (confirmPhrase.trim() !== 'تایید ریست') {
      return { ok: false, errorFa: 'لطفاً عبارت دقیق «تایید ریست» را وارد کنید.' };
    }
    const pwOk = await verifyCurrentUserPassword(passwordPlain);
    if (!pwOk) {
      return { ok: false, errorFa: 'رمز عبور حساب کاربری واردشده صحیح نیست.' };
    }
    setResetBusy(true);
    try {
      const res = await executeSelectiveSafeReset(
        resetModalModule,
        `ریست امن انتخابی با تایید دومرحله‌ای توسط ${session?.displayName ?? 'مدیر'}`
      );
      if (!res.ok) {
        return { ok: false, errorFa: res.errorFa ?? 'خطا در اجرای ریست امن.' };
      }
      setResetModalModule(null);
      showToast(
        `بکاپ اضطراری به‌صورت خودکار ذخیره شد و ${toPersianDigits(res.clearedCount ?? 0)} رکورد به‌صورت نرم آرشیو گردید.`
      );
      return { ok: true };
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            تنظیمات مستقل و مدیریت پیشرفته مدرسه
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            پیکربندی مشخصات، اطلاعیه‌ها، عناوین بخش‌ها، بازگردانی به وضعیت قبل و ریست امن انتخابی برای{' '}
            <strong>{activeSchool.name}</strong>.
          </p>
        </div>

        {/* 3 Clean Tabs */}
        <div
          role="tablist"
          aria-label="بخش‌های تنظیمات مدرسه"
          className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
            className={`min-h-[40px] px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-white dark:bg-slate-800 brand-text shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            مشخصات مدرسه
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'announcements_labels'}
            onClick={() => setActiveTab('announcements_labels')}
            className={`min-h-[40px] px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === 'announcements_labels'
                ? 'bg-white dark:bg-slate-800 brand-text shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            اطلاعیه‌ها و عناوین
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recovery_reset'}
            onClick={() => setActiveTab('recovery_reset')}
            className={`min-h-[40px] px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === 'recovery_reset'
                ? 'bg-white dark:bg-slate-800 brand-text shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            بازگردانی و ریست امن
          </button>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            {isActiveSchoolPanicLocked
              ? 'قفل اضطراری سامانه برای این مدرسه فعال است — تمام تنظیمات تا زمان رفع قفل فقط‌خواندنی می‌باشد.'
              : isViewingArchivedYear
                ? 'در حالت مشاهده سال تحصیلی آرشیو، تنظیمات مدرسه فقط‌خواندنی است.'
                : `شما در حال مشاهده تنظیمات با نقش «${roleDef.labelFa}» هستید. ویرایش تنها توسط مدیر مدرسه، مدیر کل یا راهبر ارشد امکان‌پذیر است.`}
          </span>
        </div>
      )}

      {/* ==================== TAB 1: GENERAL SCHOOL SETTINGS ==================== */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Dedicated School Logo & Official Print Letterhead Manager (strictly scoped to active school) */}
          <SchoolPrintBrandingManager mode="single_school" />

          <form
            onSubmit={(e) => void handleSave(e)}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6"
          >
            {errors.length > 0 && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 text-sm text-rose-800 dark:text-rose-200 space-y-1"
              >
                {errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="school-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  نام مدرسه
                </label>
                <input
                  id="school-name"
                  type="text"
                  disabled={readOnly}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="school-subtitle" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  زیرعنوان / مقطع
                </label>
                <input
                  id="school-subtitle"
                  type="text"
                  disabled={readOnly}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="school-principal" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  نام مدیر مدرسه
                </label>
                <input
                  id="school-principal"
                  type="text"
                  disabled={readOnly}
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="school-phone" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  شماره تماس واحد
                </label>
                <input
                  id="school-phone"
                  type="text"
                  dir="ltr"
                  disabled={readOnly}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="school-year" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  سال تحصیلی (مثال: ۱۴۰۵-۱۴۰۶)
                </label>
                <input
                  id="school-year"
                  type="text"
                  dir="ltr"
                  disabled={readOnly}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="school-period-mins" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  مدت هر زنگ درسی (دقیقه)
                </label>
                <input
                  id="school-period-mins"
                  type="number"
                  min={30}
                  max={120}
                  disabled={readOnly}
                  value={periodDurationMinutes}
                  onChange={(e) => setPeriodDurationMinutes(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="school-address" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                نشانی کامل مدرسه
              </label>
              <input
                id="school-address"
                type="text"
                disabled={readOnly}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </div>

            {/* Configurable Active Workdays */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                روزهای کاری فعال هفته (مبنای جدول حضور ۴ زنگه کادر):
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_WEEKDAYS.map((dayIdx) => {
                  const selected = activeWorkdays.includes(dayIdx);
                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleWorkday(dayIdx)}
                      className={`min-h-[42px] px-4 rounded-xl border text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      } disabled:opacity-60`}
                    >
                      {PERSIAN_WEEKDAY_NAMES[dayIdx]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                روزهای انتخاب‌شده ({toPersianDigits(activeWorkdays.length)} روز):{' '}
                {activeWorkdays.map((d) => PERSIAN_WEEKDAY_NAMES[d]).join('، ')}
              </p>
            </div>

            {/* A4 Letterhead & Signature Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Building2 className="w-4 h-4" />
                <span>سربرگ رسمی و پاورقی امضا در چاپ‌های A4 و A5</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="school-lh-title" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    عنوان اصلی سربرگ چاپ
                  </label>
                  <input
                    id="school-lh-title"
                    type="text"
                    disabled={readOnly}
                    value={letterheadTitle}
                    onChange={(e) => setLetterheadTitle(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label htmlFor="school-lh-sub" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    زیرعنوان سربرگ چاپ
                  </label>
                  <input
                    id="school-lh-sub"
                    type="text"
                    disabled={readOnly}
                    value={letterheadSubtitle}
                    onChange={(e) => setLetterheadSubtitle(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="school-sig-footer" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  متن پاورقی امضا و تاییدیه
                </label>
                <input
                  id="school-sig-footer"
                  type="text"
                  disabled={readOnly}
                  value={signatureFooter}
                  onChange={(e) => setSignatureFooter(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>
            </div>

            {!readOnly && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  ذخیره تنظیمات مدرسه
                </button>
              </div>
            )}
          </form>

          {canManageAcademicYears && <AcademicYearManagerPanel />}
        </div>
      )}

      {/* ==================== TAB 2: ANNOUNCEMENTS & SECTION LABELS ==================== */}
      {activeTab === 'announcements_labels' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* School / Class / Subject Announcements CRUD */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 brand-text" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  مدیریت اطلاعیه‌های مدرسه و دروس
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  به‌صورت زنده در داشبورد و مرکز اعلان دانش‌آموزان، اولیا و معلمان نمایش داده می‌شود.
                </p>
              </div>
            </div>

            {!readOnly && (
              <form onSubmit={handleAddAnnouncement} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    aria-label="دامنه اطلاعیه"
                    value={annScope}
                    onChange={(e) => setAnnScope(e.target.value as SchoolAnnouncementScope)}
                    className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold"
                  >
                    <option value="school">اطلاعیه عمومی کل مدرسه</option>
                    <option value="class">اطلاعیه اختصاصی یک کلاس</option>
                    <option value="subject">اطلاعیه اختصاصی یک درس</option>
                  </select>

                  {(annScope === 'class' || annScope === 'subject') && (
                    <select
                      aria-label="کلاس مخاطب"
                      value={annClassId}
                      onChange={(e) => setAnnClassId(e.target.value)}
                      className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {annScope === 'subject' && (
                  <input
                    type="text"
                    value={annSubject}
                    onChange={(e) => setAnnSubject(e.target.value)}
                    placeholder="نام درس (مثلاً: ریاضی)"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                )}

                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="عنوان اطلاعیه..."
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                />
                <textarea
                  rows={3}
                  required
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="متن کامل اطلاعیه..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annPinned}
                      onChange={(e) => setAnnPinned(e.target.checked)}
                    />
                    سنجاق در بالای داشبورد
                  </label>
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-xl brand-btn text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    انتشار اطلاعیه
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              {schoolAnnouncements.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">اطلاعیه‌ای ثبت نشده است.</div>
              ) : (
                schoolAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        {ann.title}
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            deleteSchoolAnnouncement(ann.id);
                            showToast('اطلاعیه حذف شد.', 'info');
                          }}
                          aria-label={`حذف ${ann.title}`}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-5">{ann.body}</p>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {ann.authorName} · {toPersianDigits(ann.publishedAtJalali)}
                      {ann.subject ? ` · درس ${ann.subject}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Section Label / Menu Title Editor */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 brand-text" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ویرایش سریع عناوین بخش‌ها و منوها
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  عناوین منوهای این مدرسه را دلخواه تغییر دهید (خالی گذاشتن برابر عنوان پیش‌فرض است).
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              {EDITABLE_SECTION_LABELS.map((item) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2">
                  <label
                    htmlFor={`sec-lbl-${item.id}`}
                    className="sm:col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {item.defaultTitle}
                  </label>
                  <input
                    id={`sec-lbl-${item.id}`}
                    type="text"
                    disabled={readOnly}
                    value={sectionLabelsDraft[item.id] ?? ''}
                    onChange={(e) =>
                      setSectionLabelsDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder={item.defaultTitle}
                    className="sm:col-span-3 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm disabled:opacity-60"
                  />
                </div>
              ))}
            </div>

            {!readOnly && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => void handleSaveSectionLabels()}
                  className="min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-5 text-xs sm:text-sm font-bold"
                >
                  <Save className="w-4 h-4" />
                  ذخیره عناوین بخش‌ها
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: RESTORE LAST STATE & SELECTIVE SAFE RESET ==================== */}
      {activeTab === 'recovery_reset' && (
        <div className="space-y-6">
          {/* Restore Last State Panel */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    بازگردانی به وضعیت قبل (نقاط بازیابی امن)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    پیش از هر ریست امن، سامانه به‌صورت خودکار یک نقطه بازیابی اضطراری ذخیره می‌کند تا هر زمان بتوانید داده‌ها را برگردانید.
                  </p>
                </div>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void handleManualSnapshot()}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3.5 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <Save className="w-4 h-4" />
                  ذخیره نقطه بازیابی جدید
                </button>
              )}
            </div>

            {recoverySnapshots.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                هنوز نقطه بازیابی برای این مدرسه ثبت نشده است. با دکمه «ذخیره نقطه بازیابی جدید» یا پیش از ریست امن ایجاد می‌شود.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recoverySnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 text-xs">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {snap.reasonFa}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                        تاریخ: {toPersianDigits(snap.createdAtJalali)} · ثبت‌کننده: {snap.createdByName} · تعداد رکوردهای محافظت‌شده:{' '}
                        <strong>{toPersianDigits(snap.affectedCount)}</strong>
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        disabled={resetBusy}
                        onClick={() => void handleRestoreSnapshot(snap.id, snap.reasonFa)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 text-xs font-bold shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        بازگردانی به این وضعیت
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selective Safe Reset (5 Independent Modules) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ریست امن بخش انتخابی (تأیید دومرحله‌ای + بکاپ خودکار)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تنها بخش انتخاب‌شده در مدرسه «{activeSchool.name}» پاک‌سازی می‌شود و داده‌های دانش‌آموزان، کلاس‌ها و سایر مدارس کاملاً دست‌نخورده باقی می‌مانند.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {SELECTIVE_RESET_MODULES.map((mod) => (
                <div
                  key={mod.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {mod.labelFa}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-5">
                      {mod.descriptionFa}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      setResetModalModule(mod.key);
                    }}
                    className="min-h-[40px] w-full rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 disabled:opacity-50 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors"
                  >
                    ریست امن این بخش
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3-B: Two-Step Verification Modal (Password + Phrase «تایید ریست») */}
      <SensitiveActionModal
        open={Boolean(resetModalModule)}
        titleFa={`ریست امن بخش «${SELECTIVE_RESET_MODULES.find((m) => m.key === resetModalModule)?.labelFa ?? ''}»`}
        descriptionFa={`پیش از پاک‌سازی این بخش در مدرسه «${activeSchool.name}»، یک نقطه بازیابی اضطراری ذخیره می‌شود و رکوردها به‌صورت نرم (قابل بازیابی) آرشیو می‌گردند.`}
        requiredPhrase="تایید ریست"
        confirmButtonLabelFa="ذخیره بکاپ اضطراری و اجرای ریست امن"
        tone="danger"
        onClose={() => setResetModalModule(null)}
        onConfirm={handleExecuteSafeReset}
      />
    </div>
  );
};

