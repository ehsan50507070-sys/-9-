// Tab 4: Dynamic Multi-Complex & Multi-School Manager (Phase 8A Super Admin Governance)
import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Building,
  Building2,
  CheckCircle2,
  ImagePlus,
  Layers,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import type { SchoolGradeLevel } from '../../types/domain';
import { useSchoolData } from '../data/DataContext';
import {
  compressImageFileToDataUrl,
  DEFAULT_COMPLEX_ID,
  GRADE_LEVEL_LABELS,
} from './superAdminHelpers';

interface InitialSchoolDraft {
  name: string;
  gradeLevel: SchoolGradeLevel;
  principalName: string;
  createPrincipalAccount: boolean;
  principalUsername: string;
  principalPassword: string;
}

export const ComplexSchoolManagerTab: React.FC = () => {
  const {
    educationalComplexes,
    allSchools,
    managedAdminAccounts,
    activeSchoolId,
    setActiveSchoolId,
    createNewSchool,
    createNewComplex,
  } = useSchoolData();

  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Add School Modal
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [schoolComplexId, setSchoolComplexId] = useState<string>(
    educationalComplexes[0]?.id ?? DEFAULT_COMPLEX_ID
  );
  const [schoolName, setSchoolName] = useState('');
  const [schoolSubtitle, setSchoolSubtitle] = useState('');
  const [schoolGrade, setSchoolGrade] = useState<SchoolGradeLevel>('elementary');
  const [schoolPrincipal, setSchoolPrincipal] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | undefined>(undefined);
  const [createPrincipalAcct, setCreatePrincipalAcct] = useState(true);
  const [principalUsername, setPrincipalUsername] = useState('');
  const [principalPassword, setPrincipalPassword] = useState('123456');

  // Add Complex Modal
  const [complexModalOpen, setComplexModalOpen] = useState(false);
  const [complexName, setComplexName] = useState('');
  const [complexDesc, setComplexDesc] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [initialSchools, setInitialSchools] = useState<InitialSchoolDraft[]>([
    {
      name: '',
      gradeLevel: 'elementary',
      principalName: '',
      createPrincipalAccount: true,
      principalUsername: '',
      principalPassword: '123456',
    },
  ]);

  const handleSchoolLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, { maxWidth: 400, quality: 0.8 });
      if (compressed.ok && compressed.dataUrl) {
        setSchoolLogoUrl(compressed.dataUrl);
      } else {
        setFeedback({
          ok: false,
          text: compressed.errorFa ?? 'خطا در فشرده‌سازی لوگوی مدرسه.',
        });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'خطا در فشرده‌سازی لوگوی مدرسه.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createNewSchool({
      complexId: schoolComplexId,
      name: schoolName,
      subtitle: schoolSubtitle,
      gradeLevel: schoolGrade,
      principalName: schoolPrincipal,
      phone: schoolPhone,
      address: schoolAddress,
      logoDataUrl: schoolLogoUrl,
      createPrincipalAccount: createPrincipalAcct,
      principalUsername: principalUsername || undefined,
      principalPassword: principalPassword || undefined,
    });
    if (res.ok && res.school) {
      setSchoolModalOpen(false);
      setSchoolName('');
      setSchoolSubtitle('');
      setSchoolPrincipal('');
      setSchoolPhone('');
      setSchoolAddress('');
      setSchoolLogoUrl(undefined);
      setPrincipalUsername('');
      setFeedback({
        ok: true,
        text: `مدرسه جدید «${res.school.name}» با شناسه ایزوله ${res.school.id} ایجاد و به مجموعه اضافه شد.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ ok: false, text: res.errorFa ?? 'خطا در ایجاد مدرسه جدید.' });
    }
  };

  const handleCreateComplex = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSchools = initialSchools.filter((s) => s.name.trim().length >= 3);
    if (validSchools.length === 0) {
      setFeedback({ ok: false, text: 'حداقل یک مدرسه با نام معتبر (حداقل ۳ کاراکتر) وارد کنید.' });
      return;
    }
    const res = await createNewComplex({
      name: complexName,
      description: complexDesc,
      adminFullName,
      adminUsername,
      adminPassword,
      initialSchools: validSchools.map((s) => ({
        name: s.name,
        gradeLevel: s.gradeLevel,
        principalName: s.principalName || 'مدیر مدرسه',
        createPrincipalAccount: s.createPrincipalAccount,
        principalUsername: s.principalUsername || undefined,
        principalPassword: s.principalPassword || undefined,
      })),
    });
    if (res.ok && res.complex) {
      setComplexModalOpen(false);
      setComplexName('');
      setComplexDesc('');
      setAdminFullName('');
      setAdminUsername('');
      setInitialSchools([
        {
          name: '',
          gradeLevel: 'elementary',
          principalName: '',
          createPrincipalAccount: true,
          principalUsername: '',
          principalPassword: '123456',
        },
      ]);
      setFeedback({
        ok: true,
        text: `مجموعه آموزشی جدید «${res.complex.name}» به همراه مدیر کل اختصاصی و مدارس اولیه راه‌اندازی شد.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ ok: false, text: res.errorFa ?? 'خطا در ایجاد مجموعه مدارس جدید.' });
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 brand-text" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              مدیریت پویا و چندسازمانی مجموعه‌ها و مدارس
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {toPersianDigits(educationalComplexes.length)} مجموعه آموزشی و{' '}
              {toPersianDigits(allSchools.length)} واحد آموزشی ایزوله در سامانه فعال است.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-add-school-modal-btn"
            onClick={() => {
              setSchoolComplexId(educationalComplexes[0]?.id ?? DEFAULT_COMPLEX_ID);
              setSchoolModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>افزودن مدرسه جدید</span>
          </button>
          <button
            type="button"
            data-testid="open-add-complex-modal-btn"
            onClick={() => setComplexModalOpen(true)}
            className="brand-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
          >
            <Building className="h-3.5 w-3.5" />
            <span>افزودن مجموعه مدارس جدید</span>
          </button>
        </div>
      </div>

      {/* Complexes & Their Isolated Schools */}
      <div className="space-y-4">
        {educationalComplexes.map((complex) => {
          const memberSchools = allSchools.filter(
            (s) => (s.complexId ?? DEFAULT_COMPLEX_ID) === complex.id
          );
          const complexAdmin = managedAdminAccounts.find(
            (a) => a.role === 'complex_admin' && a.complexId === complex.id
          );

          return (
            <div
              key={complex.id}
              data-complex-card={complex.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 brand-text" />
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {complex.name}
                    </h4>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {toPersianDigits(memberSchools.length)} مدرسه
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {complex.description || 'مجموعه آموزشی چندواحدی ایزوله'}
                    {complexAdmin && (
                      <span className="mr-2 font-semibold text-slate-700 dark:text-slate-200">
                        | مدیر کل: {complexAdmin.fullName} (
                        <span className="font-mono" dir="ltr">
                          {complexAdmin.username}
                        </span>
                        )
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSchoolComplexId(complex.id);
                    setSchoolModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>افزودن مدرسه به این مجموعه</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {memberSchools.map((school) => {
                  const isCurrent = school.id === activeSchoolId;
                  const principalAcct = managedAdminAccounts.find(
                    (a) => a.role === 'principal' && a.schoolId === school.id
                  );
                  return (
                    <div
                      key={school.id}
                      data-school-unit-card={school.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                        isCurrent
                          ? 'border-[var(--brand-primary)] bg-slate-50/70 dark:bg-slate-800/50'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                          {school.logoDataUrl ? (
                            <img
                              src={school.logoDataUrl}
                              alt={school.name}
                              className="h-full w-full object-contain p-0.5"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                            {school.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {GRADE_LEVEL_LABELS[school.gradeLevel ?? 'elementary']} • مدیر:{' '}
                            {school.principalName}
                          </div>
                          {principalAcct && (
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              نام کاربری مدیر:{' '}
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-200" dir="ltr">
                                {principalAcct.username}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <span className="font-mono text-[10px] text-slate-400" dir="ltr">
                          {school.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSchoolId(school.id)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            isCurrent
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                          <span>{isCurrent ? 'مدرسه فعال فعلی' : 'انتخاب این مدرسه'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1: Add New School */}
      {schoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                افزودن مدرسه جدید (واحد آموزشی ایزوله)
              </h4>
              <button
                type="button"
                onClick={() => setSchoolModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchool} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    مجموعه آموزشی والد
                  </label>
                  <select
                    value={schoolComplexId}
                    onChange={(e) => setSchoolComplexId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {educationalComplexes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    مقطع تحصیلی
                  </label>
                  <select
                    value={schoolGrade}
                    onChange={(e) => setSchoolGrade(e.target.value as SchoolGradeLevel)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {Object.entries(GRADE_LEVEL_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  نام رسمی مدرسه جدید
                </label>
                <input
                  type="text"
                  required
                  data-testid="new-school-name-input"
                  placeholder="مثال: مدرسه شماره ۴ - واحد د (اندیشه)"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    نام مدیر مدرسه
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="new-school-principal-input"
                    placeholder="مثال: استاد مهدی رحیمی"
                    value={schoolPrincipal}
                    onChange={(e) => setSchoolPrincipal(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    تلفن (اختیاری)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    placeholder="02188004400"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  توضیح یا شعار مدرسه (اختیاری)
                </label>
                <input
                  type="text"
                  value={schoolSubtitle}
                  onChange={(e) => setSchoolSubtitle(e.target.value)}
                  placeholder="مثال: دبستان هوشمند و خلاقیت‌محور"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Optional Logo Upload */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>بارگذاری لوگو (اختیاری)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSchoolLogoChange}
                    className="hidden"
                  />
                </label>
                {schoolLogoUrl && (
                  <img
                    src={schoolLogoUrl}
                    alt="لوگوی پیش‌نمایش"
                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
                  />
                )}
              </div>

              {/* Optional Instant Principal Account */}
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <input
                    type="checkbox"
                    checked={createPrincipalAcct}
                    onChange={(e) => setCreatePrincipalAcct(e.target.checked)}
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  <span>ایجاد فوری حساب کاربری «مدیر مدرسه» برای این واحد</span>
                </label>
                {createPrincipalAcct && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        نام کاربری مدیر
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        data-testid="new-school-principal-user-input"
                        placeholder="principal4"
                        value={principalUsername}
                        onChange={(e) => setPrincipalUsername(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        رمز عبور اولیه
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={principalPassword}
                        onChange={(e) => setPrincipalPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSchoolModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  data-testid="submit-new-school-btn"
                  className="brand-btn rounded-xl px-4 py-2 font-bold"
                >
                  ثبت و راه‌اندازی مدرسه جدید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add New Complex */}
      {complexModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                راه‌اندازی مجموعه مدارس جدید (سازمان ایزوله)
              </h4>
              <button
                type="button"
                onClick={() => setComplexModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateComplex} className="space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  نام مجموعه مدارس جدید
                </label>
                <input
                  type="text"
                  required
                  data-testid="new-complex-name-input"
                  placeholder="مثال: مجموعه مدارس اندیشه نو"
                  value={complexName}
                  onChange={(e) => setComplexName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  توضیح مجموعه (اختیاری)
                </label>
                <input
                  type="text"
                  value={complexDesc}
                  onChange={(e) => setComplexDesc(e.target.value)}
                  placeholder="مثال: مجتمع آموزشی چندمقطعی منطقه ۲"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Dedicated Complex Admin Credentials */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="mb-2 font-extrabold text-slate-800 dark:text-slate-100">
                  حساب «مدیر کل» اختصاصی این مجموعه (فقط مدارس همین مجموعه را می‌بیند)
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      نام مدیر کل
                    </label>
                    <input
                      type="text"
                      required
                      data-testid="new-complex-admin-name-input"
                      placeholder="دکتر سارا نادری"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      نام کاربری
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      data-testid="new-complex-admin-user-input"
                      placeholder="complex2"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      رمز عبور
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      data-testid="new-complex-admin-pass-input"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Schools List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">
                    مدارس اولیه مجموعه ({toPersianDigits(initialSchools.length)})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setInitialSchools((prev) => [
                        ...prev,
                        {
                          name: '',
                          gradeLevel: 'elementary',
                          principalName: '',
                          createPrincipalAccount: true,
                          principalUsername: '',
                          principalPassword: '123456',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Plus className="h-3 w-3" />
                    <span>مدرسه دیگر</span>
                  </button>
                </div>

                {initialSchools.map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        مدرسه شماره {toPersianDigits(idx + 1)}
                      </span>
                      {initialSchools.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setInitialSchools((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        required
                        data-testid={`new-complex-school-name-${idx}`}
                        placeholder="نام مدرسه (مثال: واحد ۱ اندیشه)"
                        value={s.name}
                        onChange={(e) =>
                          setInitialSchools((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, name: e.target.value } : row
                            )
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <select
                        value={s.gradeLevel}
                        onChange={(e) =>
                          setInitialSchools((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, gradeLevel: e.target.value as SchoolGradeLevel }
                                : row
                            )
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {Object.entries(GRADE_LEVEL_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        data-testid={`new-complex-school-principal-${idx}`}
                        placeholder="نام مدیر مدرسه"
                        value={s.principalName}
                        onChange={(e) =>
                          setInitialSchools((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, principalName: e.target.value } : row
                            )
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComplexModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  data-testid="submit-new-complex-btn"
                  className="brand-btn rounded-xl px-4 py-2 font-bold"
                >
                  ایجاد مجموعه مدارس جدید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
