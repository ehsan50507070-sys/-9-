// Tab 1: Individual SIDA Student Registration & Quick-Edit («ثبت و ویرایش فردی دانش‌آموز — استاندارد سیدا»)
import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  RotateCcw,
  Search,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  createStudentWithInitialCredentials,
  ensureStudentDualCredentials,
} from '../../core/auth/authService';
import { useSchoolData } from '../../core/data/DataContext';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  SidaEnrollmentStatus,
  Student,
  StudentElectronicProfile,
} from '../../types/domain';
import {
  formatSingleStudentCredentialsMessenger,
  SIDA_ENROLLMENT_STATUSES,
  splitPersianFullName,
  validateSingleSidaStudentForm,
} from './sidaBridgeHelpers';

interface SidaIndividualTabProps {
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const SidaIndividualTab: React.FC<SidaIndividualTabProps> = ({
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    activeSchool,
    session,
    classes,
    students,
    studentProfiles,
    upsertSingleSidaStudent,
  } = useSchoolData();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | undefined>(undefined);
  const [nationalId, setNationalId] = useState('');
  const [sidaStudentCode, setSidaStudentCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [birthCertificateNumber, setBirthCertificateNumber] = useState('');
  const [birthDateJalali, setBirthDateJalali] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [classId, setClassId] = useState<string>(() => classes[0]?.id ?? '');
  const [enrollmentStatus, setEnrollmentStatus] = useState<SidaEnrollmentStatus>('عادی');
  const [parentName, setParentName] = useState('');
  const [parentMobile, setParentMobile] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedStudent, setSavedStudent] = useState<Student | null>(null);
  const [oneTimeCreds, setOneTimeCreds] = useState<{
    studentPassword?: string;
    parentPassword?: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const profileByStudent = useMemo(
    () => new Map(studentProfiles.map((p) => [p.studentId, p])),
    [studentProfiles]
  );

  const availableGrades = useMemo(() => {
    const set = new Set<number>(classes.map((c) => c.gradeLevel));
    return Array.from(set).sort((a, b) => a - b);
  }, [classes]);

  const filteredClasses = useMemo(
    () =>
      selectedGrade === 'all'
        ? classes
        : classes.filter((c) => c.gradeLevel === selectedGrade),
    [classes, selectedGrade]
  );

  const quickSearchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const asciiQ = toAsciiDigits(q);
    return students
      .filter((s) => s.active)
      .filter(
        (s) =>
          s.fullName.includes(q) ||
          toAsciiDigits(s.nationalId).includes(asciiQ) ||
          (s.sidaStudentCode && toAsciiDigits(s.sidaStudentCode).includes(asciiQ))
      )
      .slice(0, 6);
  }, [searchQuery, students]);

  const validation = useMemo(
    () =>
      validateSingleSidaStudentForm({
        input: {
          existingStudentId: editingStudentId,
          nationalId,
          sidaStudentCode,
          firstName,
          lastName,
          fatherName,
          birthCertificateNumber,
          birthDateJalali,
          classId,
          enrollmentStatus,
          parentName,
          parentMobile,
        },
        existingStudents: students,
      }),
    [
      editingStudentId,
      nationalId,
      sidaStudentCode,
      firstName,
      lastName,
      fatherName,
      birthCertificateNumber,
      birthDateJalali,
      classId,
      enrollmentStatus,
      parentName,
      parentMobile,
      students,
    ]
  );

  const resetForm = () => {
    setEditingStudentId(undefined);
    setNationalId('');
    setSidaStudentCode('');
    setFirstName('');
    setLastName('');
    setFatherName('');
    setBirthCertificateNumber('');
    setBirthDateJalali('');
    setSelectedGrade('all');
    setClassId(classes[0]?.id ?? '');
    setEnrollmentStatus('عادی');
    setParentName('');
    setParentMobile('');
    setSearchQuery('');
  };

  const loadStudentIntoForm = (st: Student) => {
    const split = splitPersianFullName(st.fullName);
    const prof = profileByStudent.get(st.id);
    const cls = classMap.get(st.classId);

    setEditingStudentId(st.id);
    setNationalId(st.nationalId);
    setSidaStudentCode(st.sidaStudentCode ?? '');
    setFirstName(st.firstName?.trim() || split.firstName);
    setLastName(st.lastName?.trim() || split.lastName);
    setFatherName(st.fatherName?.trim() || prof?.fatherName || '');
    setBirthCertificateNumber(st.birthCertificateNumber ?? '');
    setBirthDateJalali(st.birthDateJalali ?? '');
    setSelectedGrade(cls?.gradeLevel ?? 'all');
    setClassId(st.classId || classes[0]?.id || '');
    setEnrollmentStatus(st.enrollmentStatus ?? 'عادی');
    setParentName(st.parentName || '');
    setParentMobile(st.parentMobile || '');
    setSearchQuery('');
    setSavedStudent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.ok) {
      onErrorToast(validation.errorsFa[0] ?? 'لطفاً خطاهای فرم را برطرف کنید.');
      return;
    }

    setSaving(true);
    try {
      const existing = editingStudentId
        ? students.find((s) => s.id === editingStudentId)
        : undefined;
      const existingProfile = editingStudentId ? profileByStudent.get(editingStudentId) : undefined;
      const studentId = existing?.id ?? `${activeSchool.id}-s-sida-${Date.now()}`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const effectiveParentName =
        parentName.trim() || `${fatherName.trim()} ${lastName.trim()}`.trim();

      const baseStudent: Student = {
        id: studentId,
        schoolId: activeSchool.id,
        classId,
        fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fatherName: fatherName.trim(),
        nationalId: validation.normalizedNationalId,
        studentCode:
          existing?.studentCode ?? String(46000 + Math.floor(Math.random() * 4000)),
        sidaStudentCode: sidaStudentCode.trim()
          ? toAsciiDigits(sidaStudentCode).trim()
          : undefined,
        birthCertificateNumber: birthCertificateNumber.trim()
          ? toAsciiDigits(birthCertificateNumber).trim()
          : undefined,
        enrollmentStatus,
        parentName: effectiveParentName,
        parentMobile: validation.normalizedMobile,
        birthDateJalali: birthDateJalali.trim()
          ? toAsciiDigits(birthDateJalali).trim()
          : undefined,
        emergencyNotes: existing?.emergencyNotes,
        studentUsername: existing?.studentUsername,
        studentPasswordHash: existing?.studentPasswordHash,
        studentPasswordSalt: existing?.studentPasswordSalt,
        parentUsername: existing?.parentUsername,
        parentPasswordHash: existing?.parentPasswordHash,
        parentPasswordSalt: existing?.parentPasswordSalt,
        active: true,
      };

      const created = !existing
        ? await createStudentWithInitialCredentials(baseStudent)
        : null;
      const studentDraft: Student = created
        ? created.student
        : ensureStudentDualCredentials(baseStudent);

      const profileDraft: StudentElectronicProfile = {
        id: existingProfile?.id ?? `${activeSchool.id}:stprof:${studentDraft.id}`,
        schoolId: activeSchool.id,
        studentId: studentDraft.id,
        fatherName: fatherName.trim(),
        motherName: existingProfile?.motherName ?? '',
        motherMobile: existingProfile?.motherMobile,
        homeAddress: existingProfile?.homeAddress ?? '',
        guardianRelation: existingProfile?.guardianRelation ?? 'پدر',
        bloodGroup: existingProfile?.bloodGroup,
        allergiesOrConditions: existingProfile?.allergiesOrConditions,
        emergencyContactName: existingProfile?.emergencyContactName || effectiveParentName,
        emergencyContactPhone: existingProfile?.emergencyContactPhone || validation.normalizedMobile,
        specialEducationalNotes: existingProfile?.specialEducationalNotes,
        documents: existingProfile?.documents ?? [],
        confidentialAdminNotes: existingProfile?.confidentialAdminNotes,
        updatedByName: session?.displayName ?? activeSchool.principalName,
        updatedAt: new Date().toISOString(),
      };

      const res = await upsertSingleSidaStudent(studentDraft, profileDraft);
      if (!res.ok) {
        onErrorToast(res.errorFa ?? 'ذخیره اطلاعات دانش‌آموز ناموفق بود.');
        return;
      }

      const finalSaved = res.savedStudent ?? studentDraft;
      setSavedStudent(finalSaved);
      setOneTimeCreds(
        created
          ? {
              studentPassword: created.initialStudentPassword,
              parentPassword: created.initialParentPassword,
            }
          : null
      );
      onSuccessToast(
        existing
          ? `اطلاعات سیدا و پرونده الکترونیک «${finalSaved.fullName}» با موفقیت به‌روزرسانی شد.`
          : `دانش‌آموز «${finalSaved.fullName}» ثبت شد و رمز اولیه مجزای دانش‌آموز و ولی صادر گردید.`
      );
      if (!existing) {
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!savedStudent) return;
    const clsName = classMap.get(savedStudent.classId)?.name ?? 'کلاس';
    const msg = formatSingleStudentCredentialsMessenger({
      schoolName: activeSchool.name,
      className: clsName,
      student: savedStudent,
      initialStudentPassword: oneTimeCreds?.studentPassword,
      initialParentPassword: oneTimeCreds?.parentPassword,
    });
    await copyTextToClipboard(msg);
    setCopiedCreds(true);
    onSuccessToast('اطلاعات ورود مجزای دانش‌آموز و ولی کپی شد.');
    window.setTimeout(() => setCopiedCreds(false), 2000);
  };

  return (
    <div className="no-print space-y-4" data-testid="sida-individual-tab">
      {/* Quick Search Bar to Pick & Edit Existing Student */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              جستجوی سریع برای ویرایش یا تکمیل اطلاعات سیدا دانش‌آموزان موجود
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              بدون نیاز به فایل اکسل، نام یا کد ملی دانش‌آموز را وارد کرده و اطلاعات هویتی او را تکمیل کنید.
            </p>
          </div>
          {editingStudentId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ثبت دانش‌آموز جدید</span>
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="جستجوی دانش‌آموز موجود با نام یا کد ملی"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="نام، نام خانوادگی یا کد ملی دانش‌آموز را بنویسید..."
            className="w-full min-h-[44px] pr-10 pl-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        {quickSearchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {quickSearchResults.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => loadStudentIntoForm(st)}
                className="text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-indigo-400 p-2.5 transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {st.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    کد ملی: {toPersianDigits(st.nationalId || '—')} ·{' '}
                    {classMap.get(st.classId)?.name ?? 'بدون کلاس'}
                  </div>
                </div>
                <span className="text-[11px] font-bold brand-text shrink-0">ویرایش</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Auto-generated Dual Student & Parent Credentials Card (shown immediately above form after save) */}
      {savedStudent && (
        <div
          data-testid="sida-ind-credentials-card"
          className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800 p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold">
                  اطلاعات ورود مجزای دانش‌آموز و ولی — {savedStudent.fullName}
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  پرونده الکترونیک و هر دو حساب کاربری در مدرسه فعال ثبت و همگام‌سازی شد.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyCredentials()}
              className="min-h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedCreds ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>کپی تک‌ستونی اطلاعات ورود برای ایتا، بله و شاد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 p-3.5 space-y-1">
              <div className="font-extrabold text-slate-900 dark:text-slate-100">
                حساب اختصاصی دانش‌آموز
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                نام کاربری:{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {savedStudent.studentUsername}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                رمز عبور:{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {oneTimeCreds?.studentPassword ?? 'رمزگذاری‌شده (محرمانه)'}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 p-3.5 space-y-1">
              <div className="font-extrabold text-slate-900 dark:text-slate-100">
                حساب اختصاصی ولی (نظارت و گفت‌وگو)
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                نام کاربری:{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {savedStudent.parentUsername}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                رمز عبور:{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                  {oneTimeCreds?.parentPassword ?? 'رمزگذاری‌شده و مجزا (محرمانه)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual SIDA Registration / Edit Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {editingStudentId ? (
              <UserCheck className="w-5 h-5 brand-text" />
            ) : (
              <UserPlus className="w-5 h-5 brand-text" />
            )}
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {editingStudentId
                ? `ویرایش فردی پرونده سیدا — ${firstName} ${lastName}`
                : 'ثبت فردی دانش‌آموز جدید (مطابق فیلدهای سامانه سیدا)'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            همگام‌سازی خودکار با لیست کلاس، پرونده الکترونیک و حساب دانش‌آموز/ولی
          </span>
        </div>

        {/* Row 1: National ID with live mod-11 & duplicate indicator + SIDA code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="sida-ind-nid"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              کد ملی (۱۰ رقمی) <span className="text-rose-500">*</span>
            </label>
            <input
              id="sida-ind-nid"
              data-testid="sida-ind-nid"
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="مثال: 0024819204"
              className={`w-full min-h-[44px] rounded-xl border px-3.5 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                validation.nationalIdStatus === 'valid'
                  ? 'border-emerald-400 dark:border-emerald-700'
                  : validation.nationalIdStatus === 'empty'
                    ? 'border-slate-300 dark:border-slate-700'
                    : 'border-rose-400 dark:border-rose-700'
              }`}
            />
            {nationalId.trim().length > 0 && (
              <div
                data-testid="sida-ind-nid-feedback"
                className={`mt-1.5 flex items-center gap-1.5 text-xs font-bold ${
                  validation.nationalIdStatus === 'valid'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {validation.nationalIdStatus === 'valid' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{validation.nationalIdMessageFa}</span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="sida-ind-code"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              کد دانش‌آموزی سیدا (اختیاری)
            </label>
            <input
              id="sida-ind-code"
              type="text"
              value={sidaStudentCode}
              onChange={(e) => setSidaStudentCode(e.target.value)}
              placeholder="مثال: 140529841"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Row 2: First Name, Last Name, Father Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="sida-ind-fname"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              نام <span className="text-rose-500">*</span>
            </label>
            <input
              id="sida-ind-fname"
              data-testid="sida-ind-fname"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="مثال: آرمان"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="sida-ind-lname"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              نام خانوادگی <span className="text-rose-500">*</span>
            </label>
            <input
              id="sida-ind-lname"
              data-testid="sida-ind-lname"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="مثال: پاکدل"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="sida-ind-father"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              نام پدر <span className="text-rose-500">*</span>
            </label>
            <input
              id="sida-ind-father"
              data-testid="sida-ind-father"
              type="text"
              required
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              placeholder="مثال: مهدی"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Row 3: Birth Cert, Jalali Birth Date, Enrollment Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="sida-ind-bcert"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              شماره شناسنامه
            </label>
            <input
              id="sida-ind-bcert"
              type="text"
              value={birthCertificateNumber}
              onChange={(e) => setBirthCertificateNumber(e.target.value)}
              placeholder="مثال: 12456"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="sida-ind-bdate"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              تاریخ تولد (شمسی)
            </label>
            <input
              id="sida-ind-bdate"
              data-testid="sida-ind-bdate"
              type="text"
              value={birthDateJalali}
              onChange={(e) => setBirthDateJalali(e.target.value)}
              placeholder="مثال: 1396/04/15"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="sida-ind-status"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              وضعیت ثبت‌نام در سیدا
            </label>
            <select
              id="sida-ind-status"
              value={enrollmentStatus}
              onChange={(e) => setEnrollmentStatus(e.target.value as SidaEnrollmentStatus)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              {SIDA_ENROLLMENT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4: Grade, Class, Parent Name, Parent Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="sida-ind-grade"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              پایه تحصیلی
            </label>
            <select
              id="sida-ind-grade"
              value={selectedGrade}
              onChange={(e) => {
                const next = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedGrade(next);
                if (next !== 'all') {
                  const match = classes.find((c) => c.gradeLevel === next);
                  if (match) setClassId(match.id);
                }
              }}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              <option value="all">همه پایه‌ها</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  پایه {toPersianDigits(g)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="sida-ind-class"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              کلاس <span className="text-rose-500">*</span>
            </label>
            <select
              id="sida-ind-class"
              data-testid="sida-ind-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="sida-ind-parent-name"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              نام ولی (سرپرست)
            </label>
            <input
              id="sida-ind-parent-name"
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="پیشفرض: نام پدر + نام خانوادگی"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="sida-ind-parent-mobile"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              شماره همراه ولی <span className="text-rose-500">*</span>
            </label>
            <input
              id="sida-ind-parent-mobile"
              data-testid="sida-ind-parent-mobile"
              type="tel"
              required
              value={parentMobile}
              onChange={(e) => setParentMobile(e.target.value)}
              placeholder="مثال: 09123456789"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={resetForm}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            پاک‌سازی فرم
          </button>
          <button
            type="submit"
            data-testid="sida-ind-submit"
            disabled={saving || !validation.ok}
            className="min-h-[44px] px-5 rounded-xl brand-btn text-xs sm:text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>
              {editingStudentId ? 'ذخیره تغییرات و همگام‌سازی سیدا' : 'ثبت دانش‌آموز و صدور حساب‌های کاربری'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
