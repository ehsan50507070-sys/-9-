// Phase 5 Plugin: Electronic Profiles («پرونده الکترونیک جامع دانش‌آموزان و همکاران»)
// Section A: Comprehensive Student Profiles (Identity, Medical/Emergency Alert, Digital Documents, Auto Timeline, Admin Confidential Notes)
// Section B: Staff & Teacher Profiles (Job & Academic Info, Auto 4-Period Attendance/Leave Summary, Digital Documents, Principal-only Evaluation Notes)
// Strict 6-Role RBAC + Global A4/A5 Print Engine + UTF-8 BOM Persian CSV Exports.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FolderOpen,
  HeartPulse,
  IdCard,
  Lock,
  Save,
  Search,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { triggerPrint, type PrintPaperSize } from '../../core/print/printService';
import { useToast } from '../../core/ui/ToastContext';
import { validateIranianNationalId } from '../../core/validation/validators';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import type {
  ProfileDocumentCategory,
  ProfileDocumentItem,
  StaffElectronicProfile,
  StaffEmploymentType,
  StudentElectronicProfile,
} from '../../types/domain';
import {
  aggregateStaffAttendanceSummary,
  aggregateStudentTimeline,
  buildStaffProfilesCsv,
  buildStudentProfilesCsv,
  computeStaffProfileCompleteness,
  computeStudentProfileCompleteness,
} from './electronicProfilesHelpers';
import { ProfileDocumentsPanel } from './ProfileDocumentsPanel';

type TopSection = 'students' | 'staff';
type StudentDetailTab = 'identity' | 'health' | 'documents' | 'timeline' | 'confidential';
type StaffDetailTab = 'job' | 'attendance' | 'documents' | 'evaluation';

const STUDENT_DOC_CATEGORIES: ProfileDocumentCategory[] = [
  'photo',
  'birth_certificate',
  'previous_report_card',
  'medical_certificate',
  'other',
];

const STAFF_DOC_CATEGORIES: ProfileDocumentCategory[] = [
  'photo',
  'teaching_decree',
  'academic_degree',
  'in_service_cert',
  'other',
];

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPLOYMENT_TYPES: StaffEmploymentType[] = ['رسمی', 'پیمانی', 'حق‌التدریس', 'غیردولتی'];

export const ElectronicProfilesPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    session,
    classes,
    students,
    teachers,
    linkedStudent,
    linkedTeacher,
    studentProfiles,
    staffProfiles,
    studentAttendance,
    staffAttendance,
    substitutions,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    studentRewards,
    electronicForms,
    electronicFormResponses,
    dailyLogs,
    upsertStudentProfile,
    upsertStaffProfile,
  } = useSchoolData();
  const { showToast } = useToast();

  const isParentOrStudent = activeRole === 'parent' || activeRole === 'student';
  const canManage = roleDef.canManageElectronicProfiles;
  const canViewConfidentialStudent = roleDef.canViewConfidentialStudentNotes;
  const canViewConfidentialStaff = roleDef.canViewConfidentialStaffEvaluation;
  const canSeeStaffSection = !isParentOrStudent;

  const [section, setSection] = useState<TopSection>('students');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [studentTab, setStudentTab] = useState<StudentDetailTab>('identity');
  const [staffTab, setStaffTab] = useState<StaffDetailTab>('job');

  // Force parent/student back to students section if role changes
  useEffect(() => {
    if (!canSeeStaffSection && section === 'staff') {
      setSection('students');
    }
  }, [canSeeStaffSection, section]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const studentProfileMap = useMemo(
    () => new Map(studentProfiles.map((p) => [p.studentId, p])),
    [studentProfiles]
  );

  const staffProfileMap = useMemo(
    () => new Map(staffProfiles.map((p) => [p.teacherId, p])),
    [staffProfiles]
  );

  // Scoped student list
  const visibleStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((st) => {
      if (!st.active) return false;
      if (classFilter !== 'all' && st.classId !== classFilter) return false;
      if (!q) return true;
      return (
        st.fullName.toLowerCase().includes(q) ||
        st.nationalId.includes(q) ||
        st.studentCode.toLowerCase().includes(q)
      );
    });
  }, [students, classFilter, searchQuery]);

  // Scoped staff list: Teacher strictly sees only their own profile; Admins see all active staff
  const visibleTeachers = useMemo(() => {
    if (isParentOrStudent) return [];
    const base =
      activeRole === 'teacher' && linkedTeacher
        ? teachers.filter((t) => t.id === linkedTeacher.id)
        : teachers.filter((t) => t.active);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.personnelCode.includes(q) ||
        t.specialty.toLowerCase().includes(q)
    );
  }, [isParentOrStudent, activeRole, linkedTeacher, teachers, searchQuery]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // Keep selected student valid
  useEffect(() => {
    if (isParentOrStudent && linkedStudent) {
      setSelectedStudentId(linkedStudent.id);
      return;
    }
    if (!visibleStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(visibleStudents[0]?.id ?? '');
    }
  }, [isParentOrStudent, linkedStudent, visibleStudents, selectedStudentId]);

  // Keep selected teacher valid
  useEffect(() => {
    if (activeRole === 'teacher' && linkedTeacher) {
      setSelectedTeacherId(linkedTeacher.id);
      return;
    }
    if (!visibleTeachers.some((t) => t.id === selectedTeacherId)) {
      setSelectedTeacherId(visibleTeachers[0]?.id ?? '');
    }
  }, [activeRole, linkedTeacher, visibleTeachers, selectedTeacherId]);

  const activeStudent = useMemo(
    () => visibleStudents.find((s) => s.id === selectedStudentId) ?? visibleStudents[0] ?? null,
    [visibleStudents, selectedStudentId]
  );

  const activeTeacher = useMemo(
    () => visibleTeachers.find((t) => t.id === selectedTeacherId) ?? visibleTeachers[0] ?? null,
    [visibleTeachers, selectedTeacherId]
  );

  // Editable Student Profile Form State
  const [stForm, setStForm] = useState<StudentElectronicProfile | null>(null);
  useEffect(() => {
    if (!activeStudent) {
      setStForm(null);
      return;
    }
    const existing = studentProfileMap.get(activeStudent.id);
    setStForm(
      existing
        ? { ...existing, documents: [...existing.documents] }
        : {
            id: `${activeSchoolId}:stprof:${activeStudent.id}`,
            schoolId: activeSchoolId,
            studentId: activeStudent.id,
            fatherName: '',
            motherName: '',
            motherMobile: '',
            homeAddress: '',
            guardianRelation: 'پدر',
            bloodGroup: '',
            allergiesOrConditions: '',
            emergencyContactName: activeStudent.parentName || '',
            emergencyContactPhone: activeStudent.parentMobile || '',
            specialEducationalNotes: '',
            documents: [],
            confidentialAdminNotes: '',
            updatedByName: session?.displayName ?? 'مدیر',
            updatedAt: new Date().toISOString(),
          }
    );
  }, [activeStudent, studentProfileMap, activeSchoolId, session?.displayName]);

  // Editable Staff Profile Form State
  const [sfForm, setSfForm] = useState<StaffElectronicProfile | null>(null);
  useEffect(() => {
    if (!activeTeacher) {
      setSfForm(null);
      return;
    }
    const existing = staffProfileMap.get(activeTeacher.id);
    setSfForm(
      existing
        ? { ...existing, documents: [...existing.documents] }
        : {
            id: `${activeSchoolId}:sfprof:${activeTeacher.id}`,
            schoolId: activeSchoolId,
            teacherId: activeTeacher.id,
            roleTitle: activeTeacher.specialty || 'معلم',
            academicDegree: 'کارشناسی',
            academicMajor: '',
            yearsOfExperience: 0,
            employmentType: 'رسمی',
            homeAddress: '',
            emergencyPhone: activeTeacher.mobile || '',
            documents: [],
            confidentialEvaluationNotes: '',
            updatedByName: session?.displayName ?? 'مدیر',
            updatedAt: new Date().toISOString(),
          }
    );
  }, [activeTeacher, staffProfileMap, activeSchoolId, session?.displayName]);

  const activeStudentCompleteness = useMemo(() => {
    if (!activeStudent) return null;
    return computeStudentProfileCompleteness(activeStudent, stForm ?? undefined);
  }, [activeStudent, stForm]);

  const activeStaffCompleteness = useMemo(() => {
    if (!activeTeacher) return null;
    return computeStaffProfileCompleteness(activeTeacher, sfForm ?? undefined);
  }, [activeTeacher, sfForm]);

  const studentTimeline = useMemo(() => {
    if (!activeStudent) return [];
    return aggregateStudentTimeline({
      studentId: activeStudent.id,
      attendance: studentAttendance,
      gradebook: gradebookEntries,
      onlineExams,
      onlineExamSubmissions,
      rewards: studentRewards,
      electronicForms,
      electronicFormResponses,
      dailyLogs,
    });
  }, [
    activeStudent,
    studentAttendance,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    studentRewards,
    electronicForms,
    electronicFormResponses,
    dailyLogs,
  ]);

  const staffAttendanceSummary = useMemo(() => {
    if (!activeTeacher) return null;
    return aggregateStaffAttendanceSummary({
      teacherId: activeTeacher.id,
      teacherName: activeTeacher.fullName,
      staffAttendance,
      substitutions,
      dailyLogs,
    });
  }, [activeTeacher, staffAttendance, substitutions, dailyLogs]);

  const recentStaffAttendanceRows = useMemo(() => {
    if (!activeTeacher) return [];
    return staffAttendance
      .filter((r) => r.teacherId === activeTeacher.id)
      .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate) || a.period - b.period)
      .slice(0, 12);
  }, [activeTeacher, staffAttendance]);

  const handleSaveStudentProfile = (override?: StudentElectronicProfile) => {
    const target = override ?? stForm;
    if (!target || !canManage) return;
    const payload: StudentElectronicProfile = {
      ...target,
      updatedByName: session?.displayName ?? 'مدیر',
      updatedAt: new Date().toISOString(),
    };
    const res = upsertStudentProfile(payload);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ذخیره پرونده دانش‌آموز.', 'error');
      return;
    }
    setStForm(payload);
    if (!override) {
      showToast('تغییرات پرونده الکترونیک دانش‌آموز با موفقیت ذخیره شد.');
    }
  };

  const handleSaveStaffProfile = (override?: StaffElectronicProfile) => {
    const target = override ?? sfForm;
    if (!target || !canManage) return;
    const payload: StaffElectronicProfile = {
      ...target,
      updatedByName: session?.displayName ?? 'مدیر',
      updatedAt: new Date().toISOString(),
    };
    const res = upsertStaffProfile(payload);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ذخیره پرونده همکار.', 'error');
      return;
    }
    setSfForm(payload);
    if (!override) {
      showToast('تغییرات پرونده الکترونیک همکار با موفقیت ذخیره شد.');
    }
  };

  const handleAddStudentDoc = (doc: ProfileDocumentItem) => {
    if (!stForm) return;
    const updated: StudentElectronicProfile = {
      ...stForm,
      documents: [doc, ...stForm.documents],
    };
    handleSaveStudentProfile(updated);
  };

  const handleDeleteStudentDoc = (docId: string) => {
    if (!stForm) return;
    const updated: StudentElectronicProfile = {
      ...stForm,
      documents: stForm.documents.filter((d) => d.id !== docId),
    };
    handleSaveStudentProfile(updated);
  };

  const handleAddStaffDoc = (doc: ProfileDocumentItem) => {
    if (!sfForm) return;
    const updated: StaffElectronicProfile = {
      ...sfForm,
      documents: [doc, ...sfForm.documents],
    };
    handleSaveStaffProfile(updated);
  };

  const handleDeleteStaffDoc = (docId: string) => {
    if (!sfForm) return;
    const updated: StaffElectronicProfile = {
      ...sfForm,
      documents: sfForm.documents.filter((d) => d.id !== docId),
    };
    handleSaveStaffProfile(updated);
  };

  const handleExportStudentsCsv = () => {
    const csv = buildStudentProfilesCsv({
      students: students.filter((s) => s.active),
      classes,
      profiles: studentProfiles,
    });
    downloadTextFile(`student-profiles-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فایل اکسل فارسی (CSV) فهرست پرونده دانش‌آموزان دانلود شد.');
  };

  const handleExportStaffCsv = () => {
    const csv = buildStaffProfilesCsv({
      teachers: teachers.filter((t) => t.active),
      classes,
      profiles: staffProfiles,
    });
    downloadTextFile(`staff-profiles-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فایل اکسل فارسی (CSV) فهرست پرونده کادر و همکاران دانلود شد.');
  };

  const handlePrintProfile = (size: PrintPaperSize) => {
    triggerPrint({ size, orientation: 'portrait' });
  };

  const totalMedicalAlerts = useMemo(
    () =>
      visibleStudents.filter((st) =>
        Boolean(studentProfileMap.get(st.id)?.allergiesOrConditions?.trim())
      ).length,
    [visibleStudents, studentProfileMap]
  );

  return (
    <div className="space-y-6">
      {/* Screen Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                پرونده الکترونیک جامع دانش‌آموزان و همکاران
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                بایگانی ساختاریافته هویتی، پزشکی، مدارک دیجیتال و سوابق خودکار در{' '}
                <strong>{activeSchool.name}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && section === 'students' && (
            <button
              type="button"
              onClick={handleExportStudentsCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              خروجی اکسل دانش‌آموزان (CSV)
            </button>
          )}
          {canManage && section === 'staff' && (
            <button
              type="button"
              onClick={handleExportStaffCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              خروجی اکسل همکاران (CSV)
            </button>
          )}
          <PrintButtons
            documentLabel={section === 'students' ? 'پرونده دانش‌آموز' : 'پرونده همکار'}
            onPrint={handlePrintProfile}
            disabled={section === 'students' ? !activeStudent : !activeTeacher}
          />
        </div>
      </div>

      {/* Section Switcher (Hidden for Parent/Student who only see own Student Profile) */}
      {canSeeStaffSection && (
        <div
          role="tablist"
          aria-label="بخش‌های پرونده الکترونیک"
          className="no-print flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={section === 'students'}
              onClick={() => {
                setSection('students');
                setSearchQuery('');
              }}
              className={`min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                section === 'students'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>پرونده دانش‌آموزان ({toPersianDigits(visibleStudents.length)})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={section === 'staff'}
              onClick={() => {
                setSection('staff');
                setSearchQuery('');
              }}
              className={`min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                section === 'staff'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>
                {activeRole === 'teacher'
                  ? 'پرونده پرسنلی من'
                  : `پرونده کادر و همکاران (${toPersianDigits(visibleTeachers.length)})`}
              </span>
            </button>
          </div>

          {section === 'students' && totalMedicalAlerts > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <HeartPulse className="w-4 h-4 shrink-0" />
              <span>
                {toPersianDigits(totalMedicalAlerts)} دانش‌آموز دارای هشدار پزشکی / حساسیت ثبت‌شده
              </span>
            </div>
          )}
        </div>
      )}

      {/* ==================== SECTION A: STUDENT ELECTRONIC PROFILES ==================== */}
      {section === 'students' && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Student Selector List (Hidden for Parent/Student locked to 1 child) */}
          {!isParentOrStudent && (
            <aside className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی نام، کد ملی یا کد دانش‌آموزی..."
                    className="w-full min-h-[40px] pr-9 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  aria-label="فیلتر کلاس"
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200"
                >
                  <option value="all">همه کلاس‌های مجاز ({toPersianDigits(classes.length)})</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} — {cls.gradeLevel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-[540px] overflow-y-auto space-y-2 pl-1">
                {visibleStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    دانش‌آموزی با این فیلتر یافت نشد.
                  </p>
                ) : (
                  visibleStudents.map((st) => {
                    const prof = studentProfileMap.get(st.id);
                    const comp = computeStudentProfileCompleteness(st, prof);
                    const hasMedicalAlert = Boolean(prof?.allergiesOrConditions?.trim());
                    const isSelected = activeStudent?.id === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStudentId(st.id)}
                        className={`w-full text-right rounded-xl border p-3 transition-colors space-y-2 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {st.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {classMap.get(st.classId)?.name ?? 'کلاس نامشخص'} · کد ملی:{' '}
                              {toPersianDigits(st.nationalId)}
                            </div>
                          </div>
                          {hasMedicalAlert && (
                            <span
                              title={prof?.allergiesOrConditions}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-bold shrink-0"
                            >
                              <HeartPulse className="w-3 h-3" />
                              پزشکی
                            </span>
                          )}
                        </div>

                        {/* Completeness progress bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            <span>تکمیل پرونده: {toPersianDigits(comp.percent)}٪</span>
                            <span>
                              {toPersianDigits(comp.completedCount)} از{' '}
                              {toPersianDigits(comp.totalCount)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                comp.percent >= 80
                                  ? 'bg-emerald-500'
                                  : comp.percent >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              }`}
                              style={{ width: `${comp.percent}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          )}

          {/* Student Detail Workspace */}
          <section
            className={`${
              isParentOrStudent ? 'lg:col-span-12' : 'lg:col-span-8'
            } rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5`}
          >
            {!activeStudent || !stForm ? (
              <div className="py-12 text-center text-sm text-slate-500">
                پرونده دانش‌آموزی برای نمایش انتخاب نشده است.
              </div>
            ) : (
              <>
                {/* Profile Hero Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-lg shrink-0">
                      {activeStudent.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {activeStudent.fullName}
                        </h2>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {classMap.get(activeStudent.classId)?.name ?? 'نامشخص'}
                        </span>
                        {validateIranianNationalId(activeStudent.nationalId) ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            کد ملی معتبر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            نیاز به اصلاح کد ملی
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        کد ملی: {toPersianDigits(activeStudent.nationalId)} · کد دانش‌آموزی:{' '}
                        {toPersianDigits(activeStudent.studentCode)} · تاریخ تولد:{' '}
                        {activeStudent.birthDateJalali
                          ? toPersianDigits(activeStudent.birthDateJalali)
                          : 'ثبت‌نشده'}
                      </p>
                    </div>
                  </div>

                  {activeStudentCompleteness && (
                    <div className="min-w-[170px] space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        <span>تکمیل پرونده:</span>
                        <span>{toPersianDigits(activeStudentCompleteness.percent)}٪</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            activeStudentCompleteness.percent >= 80
                              ? 'bg-emerald-500'
                              : activeStudentCompleteness.percent >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          }`}
                          style={{ width: `${activeStudentCompleteness.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Prominent Medical Alert Banner (visible to Admins, Teachers, Parent/Student) */}
                {stForm.allergiesOrConditions?.trim() && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3.5 flex items-start gap-3">
                    <HeartPulse className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-rose-900 dark:text-rose-200 leading-6">
                      <strong className="font-bold">هشدار پزشکی و حساسیت مهم:</strong>{' '}
                      {stForm.allergiesOrConditions}
                      {stForm.emergencyContactPhone && (
                        <span className="block mt-1 text-xs font-semibold tabular-nums">
                          تماس اضطراری: {stForm.emergencyContactName || 'ولی'} —{' '}
                          {toPersianDigits(stForm.emergencyContactPhone)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tabs */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setStudentTab('identity')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      studentTab === 'identity'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    هویت و خانواده
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentTab('health')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      studentTab === 'health'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <HeartPulse className="w-3.5 h-3.5" />
                    سلامت و اضطراری
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentTab('documents')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      studentTab === 'documents'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    مدارک ({toPersianDigits(stForm.documents.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentTab('timeline')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      studentTab === 'timeline'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    سوابق خودکار ({toPersianDigits(studentTimeline.length)})
                  </button>

                  {/* Strictly Admin-Only Confidential Notes Tab */}
                  {canViewConfidentialStudent && (
                    <button
                      type="button"
                      onClick={() => setStudentTab('confidential')}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        studentTab === 'confidential'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      یادداشت محرمانه مدیریت
                    </button>
                  )}
                </div>

                {/* Tab 1: Identity & Family */}
                {studentTab === 'identity' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          نام پدر
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={stForm.fatherName}
                          onChange={(e) => setStForm({ ...stForm, fatherName: e.target.value })}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          نام مادر
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={stForm.motherName}
                          onChange={(e) => setStForm({ ...stForm, motherName: e.target.value })}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          نسبت سرپرست اصلی
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={stForm.guardianRelation}
                          onChange={(e) =>
                            setStForm({ ...stForm, guardianRelation: e.target.value })
                          }
                          placeholder="پدر / مادر / سرپرست قانونی"
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          تلفن همراه مادر / سرپرست دوم
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          readOnly={!canManage}
                          value={stForm.motherMobile ?? ''}
                          onChange={(e) => setStForm({ ...stForm, motherMobile: e.target.value })}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-right text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          نشانی دقیق منزل
                        </label>
                        <textarea
                          rows={2}
                          readOnly={!canManage}
                          value={stForm.homeAddress}
                          onChange={(e) => setStForm({ ...stForm, homeAddress: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveStudentProfile()}
                          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 text-sm font-semibold transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          ذخیره مشخصات هویتی
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Health, Medical & Emergency */}
                {studentTab === 'health' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          گروه خونی
                        </label>
                        <select
                          disabled={!canManage}
                          value={stForm.bloodGroup ?? ''}
                          onChange={(e) => setStForm({ ...stForm, bloodGroup: e.target.value })}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        >
                          {BLOOD_GROUPS.map((bg) => (
                            <option key={bg || 'empty'} value={bg}>
                              {bg || 'نامشخص'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          نام فرد تماس اضطراری
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={stForm.emergencyContactName}
                          onChange={(e) =>
                            setStForm({ ...stForm, emergencyContactName: e.target.value })
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          شماره تماس اضطراری
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          readOnly={!canManage}
                          value={stForm.emergencyContactPhone}
                          onChange={(e) =>
                            setStForm({ ...stForm, emergencyContactPhone: e.target.value })
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-right text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                          حساسیت‌ها، بیماری‌های زمینه‌ای یا نیازهای دارویی (با نشان هشدار برای معلمان نمایش داده می‌شود)
                        </label>
                        <textarea
                          rows={2}
                          readOnly={!canManage}
                          value={stForm.allergiesOrConditions ?? ''}
                          onChange={(e) =>
                            setStForm({ ...stForm, allergiesOrConditions: e.target.value })
                          }
                          placeholder="مثال: حساسیت شدید به بادام‌زمینی یا آسم خفیف ورزشی"
                          className="w-full rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          توصیه‌های آموزشی و مراقبتی ویژه (قابل مشاهده توسط معلم)
                        </label>
                        <textarea
                          rows={2}
                          readOnly={!canManage}
                          value={stForm.specialEducationalNotes ?? ''}
                          onChange={(e) =>
                            setStForm({ ...stForm, specialEducationalNotes: e.target.value })
                          }
                          placeholder="مثال: ترجیحاً در ردیف اول کلاس بنشیند (عینک طبی)"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveStudentProfile()}
                          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 text-sm font-semibold transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          ذخیره اطلاعات سلامت و اضطراری
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Digital Documents */}
                {studentTab === 'documents' && (
                  <ProfileDocumentsPanel
                    schoolId={activeSchoolId}
                    ownerPrefix={`st:${activeStudent.id}`}
                    uploaderName={session?.displayName ?? 'کاربر'}
                    documents={stForm.documents}
                    allowedCategories={STUDENT_DOC_CATEGORIES}
                    canManage={canManage}
                    onAddDocument={handleAddStudentDoc}
                    onDeleteDocument={handleDeleteStudentDoc}
                    onToast={showToast}
                  />
                )}

                {/* Tab 4: Auto Academic & Disciplinary Timeline */}
                {studentTab === 'timeline' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      این خط زمانی به‌صورت زنده از حضور و غیاب، دفتر نمره، آزمون‌های آنلاین،
                      تشویق‌ها، رضایت‌نامه‌های دیجیتال امضاشده و دفتر روزانه تجمیع می‌شود.
                    </p>
                    {studentTimeline.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                        هنوز رویداد تحصیلی یا انضباطی برای این دانش‌آموز ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pl-1">
                        {studentTimeline.map((item) => {
                          const badgeTone =
                            item.tone === 'emerald'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : item.tone === 'rose'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                : item.tone === 'amber'
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                  : item.tone === 'indigo'
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';

                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${badgeTone}`}
                                  >
                                    {item.categoryLabelFa}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {item.title}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-5">
                                  {item.detail}
                                </p>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums shrink-0">
                                {item.dateJalali ? toPersianDigits(item.dateJalali) : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Admin-Only Confidential Notes */}
                {studentTab === 'confidential' && canViewConfidentialStudent && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        این یادداشت کاملاً محرمانه است و هرگز در پنل معلم، ولی یا دانش‌آموز نمایش
                        داده نمی‌شود (در لایه دسترسی سامانه فیلتر می‌گردد).
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={stForm.confidentialAdminNotes ?? ''}
                      onChange={(e) =>
                        setStForm({ ...stForm, confidentialAdminNotes: e.target.value })
                      }
                      placeholder="یادداشت‌های مشاوره‌ای، خانوادگی یا انضباطی ویژه مدیر و معاون..."
                      className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveStudentProfile()}
                        className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 text-sm font-semibold transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        ذخیره یادداشت محرمانه
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* ==================== SECTION B: STAFF & TEACHER ELECTRONIC PROFILES ==================== */}
      {section === 'staff' && canSeeStaffSection && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Staff Selector List (Hidden for Teacher locked to own profile) */}
          {activeRole !== 'teacher' && (
            <aside className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام، کد پرسنلی یا تخصص..."
                  className="w-full min-h-[40px] pr-9 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="max-h-[540px] overflow-y-auto space-y-2 pl-1">
                {visibleTeachers.map((t) => {
                  const prof = staffProfileMap.get(t.id);
                  const comp = computeStaffProfileCompleteness(t, prof);
                  const isSelected = activeTeacher?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTeacherId(t.id)}
                      className={`w-full text-right rounded-xl border p-3 transition-colors space-y-2 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {t.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {prof?.roleTitle || t.specialty} · کد پرسنلی:{' '}
                            {toPersianDigits(t.personnelCode)}
                          </div>
                        </div>
                        {prof?.employmentType && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                            {prof.employmentType}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>تکمیل پرونده: {toPersianDigits(comp.percent)}٪</span>
                          <span>
                            {toPersianDigits(comp.completedCount)} از{' '}
                            {toPersianDigits(comp.totalCount)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              comp.percent >= 80
                                ? 'bg-emerald-500'
                                : comp.percent >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }`}
                            style={{ width: `${comp.percent}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Staff Detail Workspace */}
          <section
            className={`${
              activeRole === 'teacher' ? 'lg:col-span-12' : 'lg:col-span-8'
            } rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5`}
          >
            {!activeTeacher || !sfForm ? (
              <div className="py-12 text-center text-sm text-slate-500">
                پرونده همکاری برای نمایش انتخاب نشده است.
              </div>
            ) : (
              <>
                {/* Staff Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg shrink-0">
                      {activeTeacher.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {activeTeacher.fullName}
                        </h2>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                          {sfForm.roleTitle || activeTeacher.specialty}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        کد پرسنلی: {toPersianDigits(activeTeacher.personnelCode)} · کد ملی:{' '}
                        {toPersianDigits(activeTeacher.nationalId)} · تلفن همراه:{' '}
                        {toPersianDigits(activeTeacher.mobile)}
                      </p>
                    </div>
                  </div>

                  {activeStaffCompleteness && (
                    <div className="min-w-[170px] space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        <span>تکمیل پرونده:</span>
                        <span>{toPersianDigits(activeStaffCompleteness.percent)}٪</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            activeStaffCompleteness.percent >= 80
                              ? 'bg-emerald-500'
                              : activeStaffCompleteness.percent >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          }`}
                          style={{ width: `${activeStaffCompleteness.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Staff Sub-tabs */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setStaffTab('job')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                      staffTab === 'job'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    مشخصات فردی و شغلی
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffTab('attendance')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                      staffTab === 'attendance'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    خلاصه حضور و مرخصی (خودکار)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffTab('documents')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                      staffTab === 'documents'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4" />
                    مدارک پرسنلی ({toPersianDigits(sfForm.documents.length)})
                  </button>

                  {/* Strictly Principal / Complex Admin ONLY */}
                  {canViewConfidentialStaff && (
                    <button
                      type="button"
                      onClick={() => setStaffTab('evaluation')}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                        staffTab === 'evaluation'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      ارزیابی محرمانه مدیر
                    </button>
                  )}
                </div>

                {/* Staff Tab 1: Personal & Job Details */}
                {staffTab === 'job' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          سمت / عنوان شغلی
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={sfForm.roleTitle}
                          onChange={(e) => setSfForm({ ...sfForm, roleTitle: e.target.value })}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          نوع استخدام
                        </label>
                        <select
                          disabled={!canManage}
                          value={sfForm.employmentType}
                          onChange={(e) =>
                            setSfForm({
                              ...sfForm,
                              employmentType: e.target.value as StaffEmploymentType,
                            })
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        >
                          {EMPLOYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          مدرک تحصیلی
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={sfForm.academicDegree}
                          onChange={(e) => setSfForm({ ...sfForm, academicDegree: e.target.value })}
                          placeholder="کارشناسی / کارشناسی ارشد / دکتری"
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          رشته تحصیلی
                        </label>
                        <input
                          type="text"
                          readOnly={!canManage}
                          value={sfForm.academicMajor}
                          onChange={(e) => setSfForm({ ...sfForm, academicMajor: e.target.value })}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          سنوات خدمت (سال)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={45}
                          readOnly={!canManage}
                          value={sfForm.yearsOfExperience}
                          onChange={(e) =>
                            setSfForm({
                              ...sfForm,
                              yearsOfExperience: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          شماره تماس اضطراری همکار
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          readOnly={!canManage}
                          value={sfForm.emergencyPhone ?? ''}
                          onChange={(e) =>
                            setSfForm({ ...sfForm, emergencyPhone: e.target.value })
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-right text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          کلاس‌های تخصیص‌یافته
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {activeTeacher.assignedClassIds.length === 0 ? (
                            <span className="text-xs text-slate-400">کلاسی تخصیص داده نشده</span>
                          ) : (
                            activeTeacher.assignedClassIds.map((cid) => (
                              <span
                                key={cid}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold"
                              >
                                {classMap.get(cid)?.name ?? cid}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveStaffProfile()}
                          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 text-sm font-semibold transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          ذخیره مشخصات شغلی
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Staff Tab 2: Auto Attendance & Leave Summary */}
                {staffTab === 'attendance' && staffAttendanceSummary && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      آمار زیر به‌صورت خودکار از سامانه حضور و غیاب ۴ زنگه کادر (فاز ۱)، جایگزینی
                      معلم و دفتر وقایع روزانه استخراج شده است.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
                        <div className="text-xs text-emerald-700 dark:text-emerald-300">
                          زنگ‌های حضور ثبت‌شده
                        </div>
                        <div className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">
                          {toPersianDigits(staffAttendanceSummary.presentPeriods)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 p-3">
                        <div className="text-xs text-rose-700 dark:text-rose-300">
                          غیبت / مرخصی (زنگ)
                        </div>
                        <div className="mt-1 text-xl font-bold text-rose-800 dark:text-rose-200 tabular-nums">
                          {toPersianDigits(
                            staffAttendanceSummary.absentPeriods +
                              staffAttendanceSummary.excusedPeriods
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-3">
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          تاخیر ثبت‌شده
                        </div>
                        <div className="mt-1 text-xl font-bold text-amber-800 dark:text-amber-200 tabular-nums">
                          {toPersianDigits(staffAttendanceSummary.latePeriods)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
                        <div className="text-xs text-indigo-700 dark:text-indigo-300">
                          همکاری در جایگزینی
                        </div>
                        <div className="mt-1 text-xl font-bold text-indigo-800 dark:text-indigo-200 tabular-nums">
                          {toPersianDigits(staffAttendanceSummary.substitutionsCoveredCount)} زنگ
                        </div>
                      </div>
                    </div>

                    {recentStaffAttendanceRows.length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs text-right">
                          <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold">تاریخ</th>
                              <th className="py-2.5 px-3 font-semibold">زنگ</th>
                              <th className="py-2.5 px-3 font-semibold">وضعیت</th>
                              <th className="py-2.5 px-3 font-semibold">توضیحات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {recentStaffAttendanceRows.map((row) => (
                              <tr key={row.id}>
                                <td className="py-2 px-3 tabular-nums">
                                  {toPersianDigits(row.jalaliDate)}
                                </td>
                                <td className="py-2 px-3 tabular-nums">
                                  زنگ {toPersianDigits(row.period)}
                                </td>
                                <td className="py-2 px-3 font-semibold">
                                  {row.status === 'present'
                                    ? 'حاضر'
                                    : row.status === 'absent'
                                      ? 'غایب'
                                      : row.status === 'late'
                                        ? 'تاخیر'
                                        : 'مرخصی / موجه'}
                                </td>
                                <td className="py-2 px-3 text-slate-500">{row.note ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Staff Tab 3: Digital Documents */}
                {staffTab === 'documents' && (
                  <ProfileDocumentsPanel
                    schoolId={activeSchoolId}
                    ownerPrefix={`sf:${activeTeacher.id}`}
                    uploaderName={session?.displayName ?? 'کاربر'}
                    documents={sfForm.documents}
                    allowedCategories={STAFF_DOC_CATEGORIES}
                    canManage={canManage}
                    onAddDocument={handleAddStaffDoc}
                    onDeleteDocument={handleDeleteStaffDoc}
                    onToast={showToast}
                  />
                )}

                {/* Staff Tab 4: Principal / Complex Admin Confidential Evaluation Notes */}
                {staffTab === 'evaluation' && canViewConfidentialStaff && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <Award className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        بخش ارزیابی عملکرد همکاران منحصراً در اختیار مدیر مدرسه و مدیر کل مجموعه است
                        و برای معاون، معلم، اولیا و دانش‌آموزان غیرقابل مشاهده و غیرقابل ویرایش
                        می‌باشد.
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={sfForm.confidentialEvaluationNotes ?? ''}
                      onChange={(e) =>
                        setSfForm({ ...sfForm, confidentialEvaluationNotes: e.target.value })
                      }
                      placeholder="ارزیابی دوره‌ای تدریس، نظم، تعامل با اولیا و پیشنهاد تشویق..."
                      className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveStaffProfile()}
                        className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 text-sm font-semibold transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        ذخیره ارزیابی محرمانه
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* ==================== OFFICIAL PRINTABLE SUMMARY (A4 + A5 Engine) ==================== */}
      <PrintShell
        school={activeSchool}
        documentTitle={
          section === 'students'
            ? `خلاصه رسمی پرونده الکترونیک دانش‌آموز — ${activeStudent?.fullName ?? ''}`
            : `خلاصه رسمی پرونده الکترونیک همکار — ${activeTeacher?.fullName ?? ''}`
        }
        subtitle={
          section === 'students'
            ? `کلاس: ${activeStudent ? classMap.get(activeStudent.classId)?.name ?? 'نامشخص' : ''} · کد ملی: ${toPersianDigits(activeStudent?.nationalId ?? '')}`
            : `کد پرسنلی: ${toPersianDigits(activeTeacher?.personnelCode ?? '')} · سمت: ${sfForm?.roleTitle ?? ''}`
        }
      >
        {section === 'students' && activeStudent && stForm && (
          <div className="space-y-4 text-xs">
            <table className="w-full border-collapse border border-slate-400">
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100 w-1/4">
                    نام و نام خانوادگی
                  </td>
                  <td className="border border-slate-400 p-2">{activeStudent.fullName}</td>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100 w-1/4">
                    کد ملی
                  </td>
                  <td className="border border-slate-400 p-2 tabular-nums">
                    {toPersianDigits(activeStudent.nationalId)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">نام پدر / مادر</td>
                  <td className="border border-slate-400 p-2">
                    {stForm.fatherName || '—'} / {stForm.motherName || '—'}
                  </td>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">تاریخ تولد</td>
                  <td className="border border-slate-400 p-2 tabular-nums">
                    {activeStudent.birthDateJalali
                      ? toPersianDigits(activeStudent.birthDateJalali)
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">گروه خونی</td>
                  <td className="border border-slate-400 p-2">{stForm.bloodGroup || 'ثبت‌نشده'}</td>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">تماس اضطراری</td>
                  <td className="border border-slate-400 p-2 tabular-nums">
                    {stForm.emergencyContactName} ({toPersianDigits(stForm.emergencyContactPhone)})
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">نشانی منزل</td>
                  <td colSpan={3} className="border border-slate-400 p-2">
                    {stForm.homeAddress || '—'}
                  </td>
                </tr>
                {stForm.allergiesOrConditions?.trim() && (
                  <tr>
                    <td className="border border-slate-400 p-2 font-bold bg-rose-50">
                      هشدار پزشکی / حساسیت
                    </td>
                    <td colSpan={3} className="border border-slate-400 p-2 font-semibold">
                      {stForm.allergiesOrConditions}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {studentTimeline.length > 0 && (
              <div>
                <h3 className="font-bold mb-1.5">خلاصه آخرین سوابق تحصیلی و انضباطی:</h3>
                <table className="w-full border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-400 p-1.5 text-right">تاریخ</th>
                      <th className="border border-slate-400 p-1.5 text-right">بخش</th>
                      <th className="border border-slate-400 p-1.5 text-right">شرح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentTimeline.slice(0, 10).map((item) => (
                      <tr key={item.id}>
                        <td className="border border-slate-400 p-1.5 tabular-nums">
                          {toPersianDigits(item.dateJalali)}
                        </td>
                        <td className="border border-slate-400 p-1.5">{item.categoryLabelFa}</td>
                        <td className="border border-slate-400 p-1.5">
                          {item.title} — {item.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-6 flex items-center justify-between text-xs">
              <span>مهر و امضای معاون اجرایی: ................................</span>
              <span>مهر و امضای مدیر مدرسه ({activeSchool.principalName}): ................................</span>
            </div>
          </div>
        )}

        {section === 'staff' && activeTeacher && sfForm && staffAttendanceSummary && (
          <div className="space-y-4 text-xs">
            <table className="w-full border-collapse border border-slate-400">
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100 w-1/4">
                    نام و نام خانوادگی
                  </td>
                  <td className="border border-slate-400 p-2">{activeTeacher.fullName}</td>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100 w-1/4">
                    کد پرسنلی
                  </td>
                  <td className="border border-slate-400 p-2 tabular-nums">
                    {toPersianDigits(activeTeacher.personnelCode)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">مدرک و رشته</td>
                  <td className="border border-slate-400 p-2">
                    {sfForm.academicDegree} — {sfForm.academicMajor || '—'}
                  </td>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">
                    نوع استخدام / سنوات
                  </td>
                  <td className="border border-slate-400 p-2 tabular-nums">
                    {sfForm.employmentType} ({toPersianDigits(sfForm.yearsOfExperience)} سال)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-2 font-bold bg-slate-100">
                    آمار حضور و مرخصی
                  </td>
                  <td colSpan={3} className="border border-slate-400 p-2 tabular-nums">
                    حضور: {toPersianDigits(staffAttendanceSummary.presentPeriods)} زنگ · غیبت/مرخصی:{' '}
                    {toPersianDigits(
                      staffAttendanceSummary.absentPeriods + staffAttendanceSummary.excusedPeriods
                    )}{' '}
                    زنگ · تاخیر: {toPersianDigits(staffAttendanceSummary.latePeriods)} زنگ · جایگزینی
                    انجام‌شده: {toPersianDigits(staffAttendanceSummary.substitutionsCoveredCount)} زنگ
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="pt-8 flex items-center justify-between text-xs">
              <span>تایید کارگزینی / معاونت: ................................</span>
              <span>مهر و امضای مدیر مدرسه ({activeSchool.principalName}): ................................</span>
            </div>
          </div>
        )}
      </PrintShell>
    </div>
  );
};
