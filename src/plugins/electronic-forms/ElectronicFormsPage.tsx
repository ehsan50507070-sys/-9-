// Phase 4 Plugin: Electronic Forms & Digital Consent («فرم‌ساز الکترونیک و رضایت‌نامه دیجیتال»)
// 4 starter presets, custom fields, HTML5 canvas digital signature + fallback confirmation,
// live completion tracking, messenger copy of pending parents, UTF-8 BOM CSV export, and A4/A5 individual signed consent slip print.
import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSignature,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  ElectronicForm,
  ElectronicFormField,
  ElectronicFormFieldType,
  ElectronicFormPresetType,
  ElectronicFormResponse,
  Student,
} from '../../types/domain';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import {
  buildFormResponsesCsv,
  FORM_STARTER_PRESETS,
  formatPendingParentsMessenger,
  partitionFormResponses,
} from './electronicFormsHelpers';

export const ElectronicFormsPage: React.FC = () => {
  const {
    activeSchool,
    activeRole,
    session,
    linkedStudent,
    classes,
    students,
    electronicForms,
    electronicFormResponses,
    upsertElectronicForm,
    deleteElectronicForm,
    submitElectronicFormResponse,
  } = useSchoolData();

  const isParent = activeRole === 'parent';
  const isStaff = !isParent && activeRole !== 'student';

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const [selectedFormId, setSelectedFormId] = useState<string>(
    () => electronicForms[0]?.id ?? ''
  );
  const activeForm = useMemo(
    () => electronicForms.find((f) => f.id === selectedFormId) ?? electronicForms[0] ?? null,
    [electronicForms, selectedFormId]
  );

  const [showBuilder, setShowBuilder] = useState<boolean>(false);
  const [trackingTab, setTrackingTab] = useState<'signed' | 'pending'>('signed');
  const [printSlipTarget, setPrintSlipTarget] = useState<{
    form: ElectronicForm;
    student: Student;
    response: ElectronicFormResponse;
  } | null>(null);

  // Builder State
  const [presetType, setPresetType] = useState<ElectronicFormPresetType>('field_trip');
  const [formTitle, setFormTitle] = useState<string>(FORM_STARTER_PRESETS[0].defaultTitle);
  const [formBody, setFormBody] = useState<string>(FORM_STARTER_PRESETS[0].defaultBody);
  const [targetAudience, setTargetAudience] = useState<'all_school' | 'specific_classes'>(
    'all_school'
  );
  const [selectedTargetClasses, setSelectedTargetClasses] = useState<string[]>([]);
  const [deadlineJalali, setDeadlineJalali] = useState<string>(() => getTodayJalali());
  const [requireSignature, setRequireSignature] = useState<boolean>(true);
  const [fields, setFields] = useState<ElectronicFormField[]>(
    () => FORM_STARTER_PRESETS[0].defaultFields
  );

  // Parent Signing Form State
  const [parentAnswers, setParentAnswers] = useState<Record<string, string>>({});
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [fallbackConfirmed, setFallbackConfirmed] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedPending, setCopiedPending] = useState<boolean>(false);

  const applyPreset = (type: ElectronicFormPresetType) => {
    const preset = FORM_STARTER_PRESETS.find((p) => p.type === type) ?? FORM_STARTER_PRESETS[0];
    setPresetType(preset.type);
    setFormTitle(preset.defaultTitle);
    setFormBody(preset.defaultBody);
    setRequireSignature(preset.requireSignature);
    setFields(preset.defaultFields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })));
  };

  const addCustomField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: `fld-${Date.now()}-${prev.length + 1}`,
        label: 'سوال یا فیلد جدید',
        type: 'short_text',
        required: false,
      },
    ]);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isStaff) return;
    setNotice(null);
    if (formTitle.trim().length < 4 || formBody.trim().length < 8) {
      setNotice({ type: 'err', text: 'لطفاً عنوان و متن کامل رضایت‌نامه یا فرم را وارد کنید.' });
      return;
    }
    if (targetAudience === 'specific_classes' && selectedTargetClasses.length === 0) {
      setNotice({ type: 'err', text: 'حداقل یک کلاس هدف را انتخاب کنید.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const form: ElectronicForm = {
      id: `${activeSchool.id}:eform:${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      schoolId: activeSchool.id,
      presetType,
      title: formTitle.trim(),
      bodyText: formBody.trim(),
      targetAudience,
      targetClassIds: targetAudience === 'all_school' ? [] : selectedTargetClasses,
      deadlineJalali: deadlineJalali.trim() || getTodayJalali(),
      requireSignature,
      fields: fields.filter((f) => f.label.trim().length > 0),
      active: true,
      createdByName: session.displayName,
      createdByRole: activeRole,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const res = upsertElectronicForm(form);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.errorFa ?? 'ثبت فرم ناموفق بود.' });
      return;
    }
    setSelectedFormId(form.id);
    setShowBuilder(false);
    setNotice({ type: 'ok', text: 'فرم و رضایت‌نامه دیجیتال با موفقیت ایجاد و منتشر شد.' });
  };

  // Parent Pending Forms Count
  const parentPendingFormsCount = useMemo(() => {
    if (!isParent || !linkedStudent) return 0;
    const signedFormIds = new Set(
      electronicFormResponses
        .filter((r) => r.studentId === linkedStudent.id)
        .map((r) => r.formId)
    );
    return electronicForms.filter((f) => f.active && !signedFormIds.has(f.id)).length;
  }, [isParent, linkedStudent, electronicForms, electronicFormResponses]);

  const activeParentResponse = useMemo(() => {
    if (!isParent || !linkedStudent || !activeForm) return null;
    return (
      electronicFormResponses.find(
        (r) => r.formId === activeForm.id && r.studentId === linkedStudent.id
      ) ?? null
    );
  }, [isParent, linkedStudent, activeForm, electronicFormResponses]);

  // Staff Tracking Partition
  const partition = useMemo(() => {
    if (!activeForm) return null;
    return partitionFormResponses(activeForm, students, electronicFormResponses);
  }, [activeForm, students, electronicFormResponses]);

  const handleParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isParent || !linkedStudent || !activeForm || !session) return;
    setNotice(null);

    for (const fld of activeForm.fields) {
      if (fld.required && !(parentAnswers[fld.id] ?? '').trim()) {
        setNotice({ type: 'err', text: `لطفاً پاسخ فیلد الزامی «${fld.label}» را تکمیل کنید.` });
        return;
      }
    }

    if (activeForm.requireSignature && !signatureDataUrl && !fallbackConfirmed) {
      setNotice({
        type: 'err',
        text: 'لطفاً در کادر امضای دیجیتال امضا بکشید یا تیک «تایید نهایی توسط ولی» را فعال کنید.',
      });
      return;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    const code = `OK-${String(Date.now()).slice(-4)}`;

    const response: ElectronicFormResponse = {
      id: `${activeSchool.id}:efresp:${activeForm.id}:${linkedStudent.id}`,
      schoolId: activeSchool.id,
      formId: activeForm.id,
      studentId: linkedStudent.id,
      classId: linkedStudent.classId,
      parentUserId: session.userId,
      parentName: linkedStudent.parentName || session.displayName,
      answers: { ...parentAnswers },
      signatureDataUrl,
      fallbackConfirmed: fallbackConfirmed || !signatureDataUrl,
      fallbackConfirmationCode: code,
      submittedAtJalali: getTodayJalali(),
      submittedAtTime: timeStr,
      submittedAtIso: now.toISOString(),
    };

    const res = submitElectronicFormResponse(response);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.errorFa ?? 'ثبت پاسخ و امضا ناموفق بود.' });
      return;
    }

    setNotice({
      type: 'ok',
      text: 'رضایت‌نامه با موفقیت تکمیل و امضا شد. اکنون می‌توانید برگه امضاشده را در قطع A4 یا A5 چاپ کنید.',
    });
  };

  const handleCopyPendingList = async () => {
    if (!activeForm || !partition) return;
    const text = formatPendingParentsMessenger({
      schoolName: activeSchool.name,
      form: activeForm,
      pendingStudents: partition.pendingStudents,
      classes,
      jalaliDate: getTodayJalali(),
    });
    await copyTextToClipboard(text);
    setCopiedPending(true);
    setNotice({ type: 'ok', text: 'فهرست اولیای در انتظار امضا برای ایتا، بله و شاد کپی شد.' });
    window.setTimeout(() => setCopiedPending(false), 1800);
  };

  const handleExportCsv = () => {
    if (!activeForm || !partition) return;
    const csv = buildFormResponsesCsv({
      form: activeForm,
      partition,
      classes,
    });
    downloadTextFile(
      `electronic-form-${activeForm.id.slice(-6)}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  // Printable Individual Signed Consent Slip View (A4 & A5)
  if (printSlipTarget) {
    const { form, student, response } = printSlipTarget;
    const clsName = classById.get(student.classId)?.name ?? '';
    return (
      <div className="space-y-4">
        <div className="no-print bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              برگه رضایت‌نامه امضاشده — {student.fullName}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              آماده چاپ رسمی با امضای دیجیتال ولی در قطع A4 و A5
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PrintButtons documentLabel="برگه رضایت‌نامه امضاشده" />
            <button
              type="button"
              onClick={() => setPrintSlipTarget(null)}
              aria-label="بازگشت به فهرست فرم‌ها"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 min-h-[40px]"
            >
              <X className="w-4 h-4" />
              <span>بازگشت</span>
            </button>
          </div>
        </div>

        <PrintShell
          school={activeSchool}
          documentTitle={form.title}
          subtitle={`دانش‌آموز: ${student.fullName} (${clsName}) · تاریخ ثبت: ${formatJalaliDisplay(
            response.submittedAtJalali,
            true
          )}`}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 print:border-0 print:p-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 text-xs sm:text-sm">
              <div>
                <span className="text-slate-500">دانش‌آموز: </span>
                <strong className="text-slate-900 dark:text-white">{student.fullName}</strong>
              </div>
              <div>
                <span className="text-slate-500">کلاس: </span>
                <strong className="text-slate-900 dark:text-white">{clsName}</strong>
              </div>
              <div>
                <span className="text-slate-500">ولی محترم: </span>
                <strong className="text-slate-900 dark:text-white">{response.parentName}</strong>
              </div>
              <div>
                <span className="text-slate-500">زمان تایید: </span>
                <strong className="text-slate-900 dark:text-white tabular-nums">
                  {toPersianDigits(response.submittedAtJalali)} ·{' '}
                  {toPersianDigits(response.submittedAtTime)}
                </strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-line">
              {toPersianDigits(form.bodyText)}
            </div>

            {form.fields.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  پاسخ‌های ثبت‌شده توسط ولی:
                </h3>
                <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {form.fields.map((fld) => (
                    <div
                      key={fld.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm bg-white dark:bg-slate-900"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {fld.label}
                      </span>
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                        {response.answers[fld.id] ? toPersianDigits(response.answers[fld.id]) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Signature Box */}
            <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="inline-flex items-center gap-1.5 font-extrabold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تایید و امضای دیجیتال ولی محترم</span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  نام و نام خانوادگی ولی: <strong>{response.parentName}</strong>
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  کد تایید دیجیتال: {toPersianDigits(response.fallbackConfirmationCode ?? 'VERIFIED')} ·
                  تاریخ: {toPersianDigits(response.submittedAtJalali)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-2 flex items-center justify-center min-w-[220px] min-h-[84px]">
                {response.signatureDataUrl ? (
                  <img
                    src={response.signatureDataUrl}
                    alt={`امضای دیجیتال ${response.parentName}`}
                    className="max-h-[80px] max-w-[240px] object-contain"
                  />
                ) : (
                  <span className="text-xs font-extrabold text-emerald-700 px-3 py-2">
                    تایید الکترونیک ثبت‌شده توسط {response.parentName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </PrintShell>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileSignature className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              فرم‌ساز الکترونیک و رضایت‌نامه دیجیتال
            </h1>
            {isParent && parentPendingFormsCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <AlertCircle className="w-3.5 h-3.5" />
                در انتظار تکمیل و امضا ({toPersianDigits(parentPendingFormsCount)})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isParent
              ? 'مشاهده، تکمیل و امضای دیجیتال رضایت‌نامه‌های اردو و فعالیت‌های مدرسه همراه با چاپ رسید امضاشده'
              : 'طراحی رضایت‌نامه با الگوهای آماده، دریافت امضای دیجیتال اولیا، پیگیری زنده و خروجی اکسل فارسی'}
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => setShowBuilder((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[42px] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{showBuilder ? 'بستن فرم‌ساز' : 'ایجاد فرم / رضایت‌نامه جدید'}</span>
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`no-print rounded-xl px-4 py-3 text-xs sm:text-sm font-bold border ${
            notice.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Staff Form Builder */}
      {isStaff && showBuilder && (
        <form
          onSubmit={handleSaveForm}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 sm:p-5 space-y-4"
        >
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
              انتخاب الگوی آماده شروع سریع:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {FORM_STARTER_PRESETS.map((pr) => (
                <button
                  key={pr.type}
                  type="button"
                  onClick={() => applyPreset(pr.type)}
                  className={`p-3 rounded-xl border text-right text-xs font-bold transition-colors ${
                    presetType === pr.type
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  {pr.labelFa}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                عنوان فرم / رضایت‌نامه
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                مهلت تکمیل (تاریخ شمسی)
              </label>
              <input
                type="text"
                value={deadlineJalali}
                onChange={(e) => setDeadlineJalali(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              متن رسمی رضایت‌نامه یا توضیحات فرم
            </label>
            <textarea
              rows={3}
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">مخاطبین هدف:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTargetAudience('all_school')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    targetAudience === 'all_school'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  کل مدرسه
                </button>
                <button
                  type="button"
                  onClick={() => setTargetAudience('specific_classes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    targetAudience === 'specific_classes'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  کلاس‌های مشخص
                </button>
              </div>
              {targetAudience === 'specific_classes' && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {classes.map((cls) => {
                    const checked = selectedTargetClasses.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() =>
                          setSelectedTargetClasses((prev) =>
                            checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          checked
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={requireSignature}
                onChange={(e) => setRequireSignature(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                نیاز به امضای دیجیتال ولی (کادر امضای لمسی + کد تایید)
              </span>
            </label>
          </div>

          {/* Custom Fields Builder */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                فیلدها و پرسش‌های فرم ({toPersianDigits(fields.length)})
              </span>
              <button
                type="button"
                onClick={addCustomField}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن فیلد جدید</span>
              </button>
            </div>

            {fields.map((fld, idx) => (
              <div
                key={fld.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-2.5"
              >
                <input
                  type="text"
                  value={fld.label}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f))
                    )
                  }
                  placeholder="عنوان سوال"
                  className="md:col-span-6 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                />
                <select
                  value={fld.type}
                  onChange={(e) => {
                    const nextType = e.target.value as ElectronicFormFieldType;
                    setFields((prev) =>
                      prev.map((f, i) =>
                        i === idx
                          ? {
                              ...f,
                              type: nextType,
                              options:
                                nextType === 'single_choice'
                                  ? f.options && f.options.length > 0
                                    ? f.options
                                    : ['گزینه اول', 'گزینه دوم']
                                  : undefined,
                            }
                          : f
                      )
                    );
                  }}
                  className="md:col-span-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="short_text">پاسخ کوتاه</option>
                  <option value="single_choice">انتخاب یک گزینه</option>
                  <option value="yes_no">بله / خیر</option>
                </select>
                <label className="md:col-span-2 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={fld.required}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((f, i) => (i === idx ? { ...f, required: e.target.checked } : f))
                      )
                    }
                  />
                  <span>الزامی</span>
                </label>
                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    aria-label="حذف فیلد"
                    onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {fld.type === 'single_choice' && (
                  <input
                    type="text"
                    value={(fld.options ?? []).join('، ')}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((f, i) =>
                          i === idx
                            ? {
                                ...f,
                                options: e.target.value
                                  .split(/[،,]/)
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : f
                        )
                      )
                    }
                    placeholder="گزینه‌ها را با ویرگول فارسی (،) جدا کنید"
                    className="md:col-span-12 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>انتشار فرم و رضایت‌نامه</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Split View: Forms List + Active Form Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Forms Sidebar */}
        <aside className="lg:col-span-4 space-y-2.5">
          <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 px-1">
            فرم‌ها و رضایت‌نامه‌های فعال ({toPersianDigits(electronicForms.length)})
          </div>
          {electronicForms.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
              هنوز فرم یا رضایت‌نامه‌ای ثبت نشده است.
            </div>
          ) : (
            electronicForms.map((form) => {
              const isSelected = activeForm?.id === form.id;
              const mySigned =
                isParent && linkedStudent
                  ? electronicFormResponses.some(
                      (r) => r.formId === form.id && r.studentId === linkedStudent.id
                    )
                  : false;
              const stats = isStaff
                ? partitionFormResponses(form, students, electronicFormResponses)
                : null;

              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => {
                    setSelectedFormId(form.id);
                    setParentAnswers({});
                    setSignatureDataUrl(undefined);
                    setFallbackConfirmed(false);
                    setNotice(null);
                  }}
                  className={`w-full text-right rounded-2xl border p-3.5 transition-all space-y-2 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                      {form.title}
                    </span>
                    {isParent && (
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          mySigned
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {mySigned ? 'امضاشده' : 'در انتظار امضا'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      مهلت: {toPersianDigits(form.deadlineJalali)}
                    </span>
                    {stats && (
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {toPersianDigits(stats.signedCount)} از {toPersianDigits(stats.totalCount)} نفر
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </aside>

        {/* Active Form Detail: Parent Signing OR Staff Live Tracking */}
        <div className="lg:col-span-8">
          {!activeForm ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
              یک فرم را از ستون سمت راست انتخاب کنید.
            </div>
          ) : isParent && linkedStudent ? (
            /* PARENT VIEW */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
              <div className="space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    {activeForm.title}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    مهلت تکمیل: {toPersianDigits(activeForm.deadlineJalali)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {toPersianDigits(activeForm.bodyText)}
                </p>
              </div>

              {activeParentResponse ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-extrabold text-sm text-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span>این رضایت‌نامه توسط شما تکمیل و امضا شده است</span>
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 tabular-nums">
                        ثبت‌شده در {toPersianDigits(activeParentResponse.submittedAtJalali)} ساعت{' '}
                        {toPersianDigits(activeParentResponse.submittedAtTime)} · کد تایید:{' '}
                        {toPersianDigits(activeParentResponse.fallbackConfirmationCode ?? 'OK')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPrintSlipTarget({
                          form: activeForm,
                          student: linkedStudent,
                          response: activeParentResponse,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap min-h-[40px]"
                    >
                      <Printer className="w-4 h-4 shrink-0" />
                      <span>مشاهده و چاپ برگه امضاشده (A4 / A5)</span>
                    </button>
                  </div>

                  {activeParentResponse.signatureDataUrl && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        امضای دیجیتال ثبت‌شده شما:
                      </span>
                      <img
                        src={activeParentResponse.signatureDataUrl}
                        alt="امضای دیجیتال ثبت‌شده"
                        className="h-14 bg-white rounded-lg border border-slate-200 px-2"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleParentSubmit} className="space-y-4">
                  {activeForm.fields.map((fld) => (
                    <div key={fld.id} className="space-y-1.5">
                      <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                        {fld.label}
                        {fld.required && <span className="text-rose-500 mr-1">*</span>}
                      </label>

                      {fld.type === 'short_text' && (
                        <input
                          type="text"
                          value={parentAnswers[fld.id] ?? ''}
                          onChange={(e) =>
                            setParentAnswers((prev) => ({ ...prev, [fld.id]: e.target.value }))
                          }
                          placeholder="پاسخ خود را بنویسید..."
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
                        />
                      )}

                      {fld.type === 'single_choice' && (
                        <div className="flex flex-wrap gap-2">
                          {(fld.options ?? []).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setParentAnswers((prev) => ({ ...prev, [fld.id]: opt }))
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                parentAnswers[fld.id] === opt
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {fld.type === 'yes_no' && (
                        <div className="flex items-center gap-2">
                          {['بله، موافقم', 'خیر'].map((choice) => (
                            <button
                              key={choice}
                              type="button"
                              onClick={() =>
                                setParentAnswers((prev) => ({ ...prev, [fld.id]: choice }))
                              }
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                parentAnswers[fld.id] === choice
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {activeForm.requireSignature && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <DigitalSignaturePad
                        value={signatureDataUrl}
                        onChange={setSignatureDataUrl}
                      />
                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fallbackConfirmed}
                          onChange={(e) => setFallbackConfirmed(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          تایید نهایی توسط ولی ({linkedStudent.parentName}) — ثبت نام و کد تایید
                          الکترونیک
                        </span>
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[46px]"
                  >
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span>ثبت نهایی و ارسال امضای دیجیتال ولی</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* STAFF LIVE TRACKING VIEW */
            partition && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      {activeForm.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      مهلت: {toPersianDigits(activeForm.deadlineJalali)} · ایجاد توسط:{' '}
                      {activeForm.createdByName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPendingList}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap min-h-[38px]"
                    >
                      {copiedPending ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>کپی فهرست در انتظار پاسخ</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 whitespace-nowrap min-h-[38px]"
                    >
                      <Download className="w-4 h-4" />
                      <span>خروجی اکسل فارسی (CSV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteElectronicForm(activeForm.id);
                        setNotice({ type: 'ok', text: 'فرم انتخاب‌شده حذف شد.' });
                      }}
                      aria-label="حذف این فرم"
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[38px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live Progress Bar */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold">
                    <span className="text-slate-800 dark:text-slate-100">
                      تایید و امضا کرده‌اند: {toPersianDigits(partition.signedCount)} از{' '}
                      {toPersianDigits(partition.totalCount)} نفر
                    </span>
                    <span className="text-indigo-700 dark:text-indigo-300 tabular-nums">
                      {toPersianDigits(partition.completionPercent)}٪
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${partition.completionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Signed vs Pending Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setTrackingTab('signed')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                      trackingTab === 'signed'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    تکمیل‌کرده‌ها ({toPersianDigits(partition.signedCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingTab('pending')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                      trackingTab === 'pending'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    در انتظار پاسخ ({toPersianDigits(partition.pendingStudents.length)})
                  </button>
                </div>

                {trackingTab === 'signed' ? (
                  partition.signedRows.length === 0 ? (
                    <div className="py-8 text-center text-xs sm:text-sm text-slate-500">
                      هنوز هیچ ولی‌ای این فرم را تکمیل و امضا نکرده است.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {partition.signedRows.map(({ student, response }) => (
                        <div
                          key={response.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {student.fullName}{' '}
                              <span className="text-xs font-bold text-slate-500">
                                ({classById.get(student.classId)?.name ?? ''})
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                              ولی: {response.parentName} · ثبت: {toPersianDigits(response.submittedAtJalali)}{' '}
                              ساعت {toPersianDigits(response.submittedAtTime)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {response.signatureDataUrl && (
                              <img
                                src={response.signatureDataUrl}
                                alt={`امضای ${response.parentName}`}
                                className="h-10 max-w-[110px] object-contain rounded border border-slate-200 bg-white px-1.5"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPrintSlipTarget({ form: activeForm, student, response })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[38px]"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>چاپ برگه امضاشده (A4 / A5)</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : partition.pendingStudents.length === 0 ? (
                  <div className="py-8 text-center text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    تمامی اولیای هدف این رضایت‌نامه را تکمیل کرده‌اند!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {partition.pendingStudents.map((st) => (
                      <div
                        key={st.id}
                        className="rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {st.fullName}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            {classById.get(st.classId)?.name ?? ''} · ولی: {st.parentName}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                          {toPersianDigits(st.parentMobile)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
