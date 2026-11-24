// Tab 3: Pre-Submission SIDA Readiness Health-Check Scanner («عیب‌یاب و پایش آمادگی سیدا»)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Copy,
  FileWarning,
  ShieldCheck,
  UserX,
  Wrench,
  X,
} from 'lucide-react';
import { ensureStudentDualCredentials } from '../../core/auth/authService';
import { useSchoolData } from '../../core/data/DataContext';
import { validateIranianNationalId } from '../../core/validation/validators';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type { Student, StudentElectronicProfile } from '../../types/domain';
import { runSidaReadinessAudit } from './sidaBridgeHelpers';

interface SidaReadinessTabProps {
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
  onJumpToSpeedEntry: (classId: string, subject: string) => void;
}

export const SidaReadinessTab: React.FC<SidaReadinessTabProps> = ({
  onSuccessToast,
  onErrorToast,
  onJumpToSpeedEntry,
}) => {
  const {
    activeSchool,
    session,
    roleDef,
    classes,
    students,
    studentProfiles,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    upsertSingleSidaStudent,
  } = useSchoolData();

  const canQuickEditStudent = roleDef.canImportSidaStudents;

  const audit = useMemo(
    () =>
      runSidaReadinessAudit({
        students,
        classes,
        studentProfiles,
        gradebookEntries,
        onlineExams,
        onlineExamSubmissions,
      }),
    [students, classes, studentProfiles, gradebookEntries, onlineExams, onlineExamSubmissions]
  );

  const profileByStudent = useMemo(
    () => new Map(studentProfiles.map((p) => [p.studentId, p])),
    [studentProfiles]
  );

  // Quick-Fix Mini Modal State
  const [quickFixStudent, setQuickFixStudent] = useState<Student | null>(null);
  const [qfNationalId, setQfNationalId] = useState('');
  const [qfFatherName, setQfFatherName] = useState('');
  const [qfBirthDate, setQfBirthDate] = useState('');
  const [qfClassId, setQfClassId] = useState('');
  const [qfSaving, setQfSaving] = useState(false);

  const openQuickFix = (st: Student) => {
    const prof = profileByStudent.get(st.id);
    setQuickFixStudent(st);
    setQfNationalId(st.nationalId || '');
    setQfFatherName(st.fatherName?.trim() || prof?.fatherName || '');
    setQfBirthDate(st.birthDateJalali || '');
    setQfClassId(st.classId || classes[0]?.id || '');
  };

  const handleSaveQuickFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFixStudent) return;
    const normNid = toAsciiDigits(qfNationalId).replace(/[\s-]/g, '');
    if (!validateIranianNationalId(normNid)) {
      onErrorToast('کد ملی واردشده معتبر نیست (باید ۱۰ رقم و مطابق رقم کنترلی ۱۱ باشد).');
      return;
    }
    const dup = students.find(
      (s) =>
        s.id !== quickFixStudent.id &&
        toAsciiDigits(s.nationalId).replace(/\D/g, '') === normNid
    );
    if (dup) {
      onErrorToast(`این کد ملی قبلاً برای «${dup.fullName}» ثبت شده است.`);
      return;
    }

    setQfSaving(true);
    try {
      const existingProf = profileByStudent.get(quickFixStudent.id);
      const updatedStudent: Student = ensureStudentDualCredentials({
        ...quickFixStudent,
        nationalId: normNid,
        fatherName: qfFatherName.trim() || quickFixStudent.fatherName,
        birthDateJalali: qfBirthDate.trim() ? toAsciiDigits(qfBirthDate).trim() : undefined,
        classId: qfClassId || quickFixStudent.classId,
      });

      const updatedProfile: StudentElectronicProfile = {
        id: existingProf?.id ?? `${activeSchool.id}:stprof:${updatedStudent.id}`,
        schoolId: activeSchool.id,
        studentId: updatedStudent.id,
        fatherName: qfFatherName.trim() || existingProf?.fatherName || '',
        motherName: existingProf?.motherName ?? '',
        motherMobile: existingProf?.motherMobile,
        homeAddress: existingProf?.homeAddress ?? '',
        guardianRelation: existingProf?.guardianRelation ?? 'پدر',
        bloodGroup: existingProf?.bloodGroup,
        allergiesOrConditions: existingProf?.allergiesOrConditions,
        emergencyContactName: existingProf?.emergencyContactName ?? updatedStudent.parentName,
        emergencyContactPhone: existingProf?.emergencyContactPhone ?? updatedStudent.parentMobile,
        specialEducationalNotes: existingProf?.specialEducationalNotes,
        documents: existingProf?.documents ?? [],
        confidentialAdminNotes: existingProf?.confidentialAdminNotes,
        updatedByName: session?.displayName ?? activeSchool.principalName,
        updatedAt: new Date().toISOString(),
      };

      const res = await upsertSingleSidaStudent(updatedStudent, updatedProfile);
      if (!res.ok) {
        onErrorToast(res.errorFa ?? 'ذخیره اصلاح سریع ناموفق بود.');
        return;
      }
      setQuickFixStudent(null);
      onSuccessToast(`اطلاعات «${updatedStudent.fullName}» اصلاح شد و پایش آمادگی سیدا به‌روزرسانی گردید.`);
    } finally {
      setQfSaving(false);
    }
  };

  const readinessTone =
    audit.readinessPercent >= 90
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500'
      : audit.readinessPercent >= 70
        ? 'text-amber-700 dark:text-amber-400 bg-amber-500'
        : 'text-rose-700 dark:text-rose-400 bg-rose-500';

  const [scoreTextClass, barBgClass] = readinessTone.split(' bg-');

  return (
    <div className="no-print space-y-4" data-testid="sida-readiness-tab">
      {/* Readiness Score Meter Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl brand-bg flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                آمادگی داده‌های مدرسه برای سیدا:{' '}
                <span className={`tabular-nums ${scoreTextClass}`} data-testid="sida-readiness-score">
                  {toPersianDigits(audit.readinessPercent)}٪
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                پایش خودکار {toPersianDigits(audit.totalActiveStudents)} دانش‌آموز فعال در{' '}
                {toPersianDigits(classes.length)} کلاس ({activeSchool.name})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs tabular-nums">
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2">
              <div className="font-extrabold text-rose-700 dark:text-rose-300">
                {toPersianDigits(audit.invalidNationalIds.length)}
              </div>
              <div className="text-[11px] text-rose-800/80 dark:text-rose-200/80">کد ملی نامعتبر</div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-3 py-2">
              <div className="font-extrabold text-amber-800 dark:text-amber-300">
                {toPersianDigits(audit.duplicateNationalIds.length)}
              </div>
              <div className="text-[11px] text-amber-900/80 dark:text-amber-200/80">کد ملی تکراری</div>
            </div>
            <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 px-3 py-2">
              <div className="font-extrabold text-sky-800 dark:text-sky-300">
                {toPersianDigits(audit.incompleteIdentity.length)}
              </div>
              <div className="text-[11px] text-sky-900/80 dark:text-sky-200/80">نقص هویتی</div>
            </div>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/60 px-3 py-2">
              <div className="font-extrabold text-violet-800 dark:text-violet-300">
                {toPersianDigits(audit.missingGrades.length)}
              </div>
              <div className="text-[11px] text-violet-900/80 dark:text-violet-200/80">نمره ثبت‌نشده</div>
            </div>
          </div>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 bg-${barBgClass}`}
            style={{ width: `${audit.readinessPercent}%` }}
          />
        </div>
      </div>

      {/* 4 Categorized Issue Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Invalid / Missing National IDs */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <UserX className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-extrabold">
                ۱. دانش‌آموزان بدون کد ملی یا با کد ملی نامعتبر ({toPersianDigits(audit.invalidNationalIds.length)})
              </h3>
            </div>
          </div>

          {audit.invalidNationalIds.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>کد ملی تمام دانش‌آموزان این مدرسه معتبر و استاندارد سیدا است.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
              {audit.invalidNationalIds.map((item) => (
                <div
                  key={item.student.id}
                  className="rounded-xl bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/50 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {item.student.fullName} ({item.className})
                    </div>
                    <div className="text-rose-700 dark:text-rose-300 mt-0.5 tabular-nums">
                      کد فعلی: {toPersianDigits(item.student.nationalId || 'خالی')} — {item.reasonFa}
                    </div>
                  </div>
                  {canQuickEditStudent && (
                    <button
                      type="button"
                      onClick={() => openQuickFix(item.student)}
                      className="min-h-[36px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>اصلاح سریع</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Card 2: Duplicate National IDs */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Copy className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-extrabold">
                ۲. کدهای ملی تکراری ({toPersianDigits(audit.duplicateNationalIds.length)})
              </h3>
            </div>
          </div>

          {audit.duplicateNationalIds.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>هیچ کد ملی تکراری در مدرسه شناسایی نشد.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
              {audit.duplicateNationalIds.map((dup) => (
                <div
                  key={dup.nationalId}
                  className="rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 p-3 space-y-2 text-xs"
                >
                  <div className="font-mono font-extrabold text-amber-900 dark:text-amber-200 tabular-nums">
                    کد ملی تکراری: {toPersianDigits(dup.nationalId)}
                  </div>
                  {dup.students.map((entry) => (
                    <div key={entry.student.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        • {entry.student.fullName} ({entry.className})
                      </span>
                      {canQuickEditStudent && (
                        <button
                          type="button"
                          onClick={() => openQuickFix(entry.student)}
                          className="min-h-[32px] px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1 shrink-0"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>اصلاح سریع</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Card 3: Incomplete Identity Fields */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
              <FileWarning className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-extrabold">
                ۳. نقص اطلاعات هویتی — نام پدر / تاریخ تولد / کلاس ({toPersianDigits(audit.incompleteIdentity.length)})
              </h3>
            </div>
          </div>

          {audit.incompleteIdentity.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>مشخصات هویتی تمام دانش‌آموزان (نام پدر، تاریخ تولد و کلاس) تکمیل است.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
              {audit.incompleteIdentity.map((item) => (
                <div
                  key={item.student.id}
                  className="rounded-xl bg-sky-50/60 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-900/50 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {item.student.fullName} ({item.className})
                    </div>
                    <div className="text-sky-800 dark:text-sky-300 mt-0.5">
                      موارد ناقص: {item.missingFieldsFa.join('، ')}
                    </div>
                  </div>
                  {canQuickEditStudent && (
                    <button
                      type="button"
                      data-testid={`quickfix-btn-${item.student.id}`}
                      onClick={() => openQuickFix(item.student)}
                      className="min-h-[36px] px-3 rounded-lg brand-btn font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>اصلاح سریع</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Card 4: Classes/Subjects with Unrecorded Grades */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
              <BookOpen className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-extrabold">
                ۴. کلاس‌ها و دروس دارای نمره ثبت‌نشده ({toPersianDigits(audit.missingGrades.length)})
              </h3>
            </div>
          </div>

          {audit.missingGrades.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>نمرات تمام کلاس‌ها و دروس بررسی‌شده ثبت شده است.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
              {audit.missingGrades.map((item) => (
                <div
                  key={`${item.classId}-${item.subject}`}
                  className="rounded-xl bg-violet-50/60 dark:bg-violet-950/25 border border-violet-200 dark:border-violet-900/50 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {item.className} — درس {item.subject}
                    </div>
                    <div className="text-violet-800 dark:text-violet-300 mt-0.5 tabular-nums">
                      {toPersianDigits(item.missingCount)} نفر از {toPersianDigits(item.totalStudents)}{' '}
                      دانش‌آموز بدون نمره ثبت‌شده
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJumpToSpeedEntry(item.classId, item.subject)}
                    className="min-h-[36px] px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>اصلاح سریع</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Inline Quick-Fix Mini Modal */}
      {quickFixStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sida-quickfix-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <form
            onSubmit={(e) => void handleSaveQuickFix(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 id="sida-quickfix-title" className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                اصلاح سریع اطلاعات سیدا — {quickFixStudent.fullName}
              </h3>
              <button
                type="button"
                aria-label="بستن پنجره اصلاح سریع"
                onClick={() => setQuickFixStudent(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  کد ملی (۱۰ رقمی)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={qfNationalId}
                  onChange={(e) => setQfNationalId(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نام پدر
                </label>
                <input
                  type="text"
                  data-testid="quickfix-father-input"
                  value={qfFatherName}
                  onChange={(e) => setQfFatherName(e.target.value)}
                  placeholder="مثال: محمدرضا"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تاریخ تولد (شمسی)
                </label>
                <input
                  type="text"
                  data-testid="quickfix-bdate-input"
                  value={qfBirthDate}
                  onChange={(e) => setQfBirthDate(e.target.value)}
                  placeholder="مثال: 1396/05/12"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  کلاس
                </label>
                <select
                  value={qfClassId}
                  onChange={(e) => setQfClassId(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-bold"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickFixStudent(null)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="submit"
                data-testid="quickfix-save-btn"
                disabled={qfSaving}
                className="min-h-[42px] px-4 rounded-xl brand-btn text-xs font-bold disabled:opacity-50"
              >
                ذخیره و پایش مجدد
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
