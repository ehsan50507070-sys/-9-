// Add-on 8: Teacher Electronic Worksheet & Smart Gradebook («کاربرگ الکترونیک دبیر و دفتر کلاسی»)
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  GraduationCap,
  Lock,
  MessageSquareWarning,
  Printer,
  Save,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useRouter } from '../../core/router/RouterContext';
import { useToast } from '../../core/ui/ToastContext';
import { validateGradeScore, validateJalaliDate } from '../../core/validation/validators';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  DescriptiveLevel,
  GradeAppeal,
  GradebookEntry,
  JalaliAcademicMonth,
  LessonPlanRecord,
  PeriodNumber,
} from '../../types/domain';
import {
  ACADEMIC_MONTHS,
  buildMonthlyTrendPoints,
  computeSmartContinuousScore,
  DEFAULT_GRADEBOOK_WEIGHTS,
  generatePersianDescriptiveReport,
  scoreToDescriptiveLevel,
} from './gradebookHelpers';
import { MonthlyTrendSvgChart } from './MonthlyTrendSvgChart';
import {
  ComprehensiveReportCardView,
  type QuickAppealRequest,
} from '../parent-portal/ComprehensiveReportCardView';
import {
  getTimeframeDisplayLabel,
  type ReportTimeframe,
} from '../parent-portal/parentReportCardHelpers';

type GradebookTab = 'grading' | 'lesson_plan' | 'continuous' | 'report_card' | 'appeals';

const SUBJECT_LIST = ['ریاضی', 'فارسی', 'علوم تجربی', 'مطالعات اجتماعی', 'قرآن و هدیه‌ها'];
const DESCRIPTIVE_LEVELS: DescriptiveLevel[] = [
  'خیلی خوب',
  'خوب',
  'قابل قبول',
  'نیاز به تلاش بیشتر',
];

const APPEAL_STATUS_META: Record<
  GradeAppeal['status'],
  { label: string; className: string }
> = {
  submitted: {
    label: 'ثبت شده (در انتظار بررسی دبیر)',
    className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
  },
  in_review: {
    label: 'در حال بررسی سیدا',
    className: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300',
  },
  teacher_reviewed: {
    label: 'پاسخ دبیر (در انتظار تایید مدیر)',
    className: 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300',
  },
  principal_approved: {
    label: 'تایید نهایی و اصلاح نمره',
    className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
  },
  rejected: {
    label: 'رد اعتراض (تایید نمره اولیه)',
    className: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
  },
};

export const GradebookPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    session,
    linkedStudent,
    linkedTeacher,
    defaultWorkdayJalali,
    classes,
    students,
    studentProfiles,
    studentAttendance,
    homeworkAssignments,
    homeworkSubmissions,
    gradebookEntries,
    lessonPlans,
    gradebookWeights,
    onlineExams,
    onlineExamSubmissions,
    gradeAppeals,
    upsertGradebookEntry,
    upsertLessonPlan,
    deleteLessonPlan,
    upsertGradebookWeights,
    upsertGradeAppeal,
  } = useSchoolData();
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const isParent = activeRole === 'parent';
  const canManage = roleDef.canManageGradebook;
  const canApproveAppeals = roleDef.canApproveGradeAppeals;

  const [activeTab, setActiveTab] = useState<GradebookTab>(isParent ? 'report_card' : 'grading');
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
  const [selectedSubject, setSelectedSubject] = useState<string>('ریاضی');
  const [selectedMonth, setSelectedMonth] = useState<JalaliAcademicMonth>('آذر');
  // Parent-mode flexible timeframe & all-subjects state (default: ALL subjects)
  const [parentTimeframe, setParentTimeframe] = useState<ReportTimeframe>('monthly');
  const [parentSubjectFilter, setParentSubjectFilter] = useState<string>('ALL');

  const effectiveClassId = classes.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : classes[0]?.id ?? '';

  const classStudents = useMemo(
    () => students.filter((s) => s.active && s.classId === effectiveClassId),
    [students, effectiveClassId]
  );

  const [reportStudentId, setReportStudentId] = useState<string>(
    linkedStudent?.id ?? classStudents[0]?.id ?? ''
  );
  const effectiveReportStudent =
    classStudents.find((s) => s.id === reportStudentId) ?? linkedStudent ?? classStudents[0] ?? null;

  // Editable descriptive report paragraph overrides keyed by studentId+subject+month
  const [customReportTextMap, setCustomReportTextMap] = useState<Record<string, string>>({});

  // Lesson Plan Form State (Tab B)
  const [lpDate, setLpDate] = useState(defaultWorkdayJalali);
  const [lpPeriod, setLpPeriod] = useState<PeriodNumber>(1);
  const [lpTopic, setLpTopic] = useState('');
  const [lpGoals, setLpGoals] = useState('');
  const [lpTools, setLpTools] = useState('');
  const [lpActivities, setLpActivities] = useState('');
  const [lpReport, setLpReport] = useState('');
  const [lpRemarks, setLpRemarks] = useState('');

  // Parent Appeal submission state (Tab E)
  const [appealMonth, setAppealMonth] = useState<JalaliAcademicMonth>('آذر');
  const [appealReason, setAppealReason] = useState('');

  // Teacher / Principal appeal review inline draft state
  const [teacherRespDraft, setTeacherRespDraft] = useState<Record<string, string>>({});
  const [teacherRevScoreDraft, setTeacherRevScoreDraft] = useState<Record<string, string>>({});
  const [principalNoteDraft, setPrincipalNoteDraft] = useState<Record<string, string>>({});

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  // Active weight configuration for selected class + subject
  const activeWeights = useMemo(() => {
    const found = gradebookWeights.find(
      (w) => w.classId === effectiveClassId && w.subject === selectedSubject
    );
    if (found) return found;
    return {
      id: `${activeSchoolId}:weights:${effectiveClassId}:${selectedSubject}`,
      schoolId: activeSchoolId,
      classId: effectiveClassId,
      subject: selectedSubject,
      ...DEFAULT_GRADEBOOK_WEIGHTS,
      updatedAt: new Date().toISOString(),
    };
  }, [gradebookWeights, activeSchoolId, effectiveClassId, selectedSubject]);

  const weightSum =
    activeWeights.attendanceWeight +
    activeWeights.homeworkWeight +
    activeWeights.oralQuizWeight +
    activeWeights.classActivityWeight +
    activeWeights.microQuizWeight;

  // Helper to get or build a student's grade entry for current class/subject/month
  const getEntryForStudent = (studentId: string, month: JalaliAcademicMonth = selectedMonth) => {
    return gradebookEntries.find(
      (g) =>
        g.studentId === studentId &&
        g.classId === effectiveClassId &&
        g.subject === selectedSubject &&
        g.jalaliMonth === month
    );
  };

  const handleUpdateGradeField = (
    studentId: string,
    patch: Partial<GradebookEntry>
  ) => {
    if (!canManage || !effectiveClassId) return;
    const existing = getEntryForStudent(studentId);
    const entryId =
      existing?.id ??
      `${activeSchoolId}:gb:${effectiveClassId}:${selectedSubject}:${selectedMonth}:${studentId}`;

    const nextEntry: GradebookEntry = {
      id: entryId,
      schoolId: activeSchoolId,
      studentId,
      classId: effectiveClassId,
      subject: selectedSubject,
      jalaliMonth: selectedMonth,
      jalaliDate: existing?.jalaliDate ?? defaultWorkdayJalali,
      numericScore: existing?.numericScore,
      descriptiveLevel: existing?.descriptiveLevel,
      oralQuizScore: existing?.oralQuizScore,
      classActivityScore: existing?.classActivityScore,
      microQuizScore: existing?.microQuizScore,
      disciplinaryNote: existing?.disciplinaryNote,
      privateTeacherNote: existing?.privateTeacherNote,
      recordedBy: activeRole,
      updatedAt: new Date().toISOString(),
      ...patch,
    };

    if (
      patch.numericScore !== undefined &&
      !validateGradeScore(patch.numericScore)
    ) {
      showToast('نمره باید عددی بین ۰ تا ۲۰ باشد.', 'error');
      return;
    }

    const res = upsertGradebookEntry(nextEntry);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت نمره.', 'error');
    }
  };

  // Live Smart Continuous Breakdown per student in selected class
  const continuousRows = useMemo(() => {
    return classStudents.map((st) => {
      const entry = getEntryForStudent(st.id);
      const breakdown = computeSmartContinuousScore({
        studentId: st.id,
        classId: effectiveClassId,
        subject: selectedSubject,
        weights: activeWeights,
        attendanceRecords: studentAttendance,
        assignments: homeworkAssignments,
        submissions: homeworkSubmissions,
        gradeEntry: entry,
      });
      return { student: st, entry, breakdown };
    });
  }, [
    classStudents,
    effectiveClassId,
    selectedSubject,
    activeWeights,
    studentAttendance,
    homeworkAssignments,
    homeworkSubmissions,
    gradebookEntries,
    selectedMonth,
  ]);

  const handleWeightChange = (
    key:
      | 'attendanceWeight'
      | 'homeworkWeight'
      | 'oralQuizWeight'
      | 'classActivityWeight'
      | 'microQuizWeight',
    val: number
  ) => {
    if (!canManage || !effectiveClassId) return;
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    upsertGradebookWeights({
      ...activeWeights,
      [key]: clamped,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleApplyContinuousToGradebook = (studentId: string, finalScore: number) => {
    handleUpdateGradeField(studentId, {
      numericScore: finalScore,
      descriptiveLevel: scoreToDescriptiveLevel(finalScore),
    });
    showToast('نمره مستمر محاسبه‌شده با موفقیت در دفتر نمره ماه جاری ثبت شد.');
  };

  const handleSaveLessonPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !effectiveClassId) return;
    const cleanDate = toAsciiDigits(lpDate).trim();
    if (!validateJalaliDate(cleanDate)) {
      showToast('تاریخ شمسی طرح درس معتبر نیست.', 'error');
      return;
    }
    if (lpTopic.trim().length < 3) {
      showToast('عنوان مبحث طرح درس الزامی است.', 'error');
      return;
    }
    const plan: LessonPlanRecord = {
      id: `${activeSchoolId}:lp:${Date.now()}`,
      schoolId: activeSchoolId,
      classId: effectiveClassId,
      teacherId: linkedTeacher?.id ?? session?.userId ?? 'staff',
      teacherName: session?.displayName ?? roleDef.labelFa,
      subject: selectedSubject,
      jalaliDate: cleanDate,
      period: lpPeriod,
      topicTitle: lpTopic.trim(),
      goals: lpGoals.trim() || 'تحقق اهداف آموزشی جلسه',
      tools: lpTools.trim() || 'تخته هوشمند و کتاب درسی',
      activities: lpActivities.trim() || 'تدریس تعاملی و حل تمرین گروهی',
      teachingReport: lpReport.trim() || 'تدریس مطابق بودجه‌بندی انجام شد.',
      educationalRemarks: lpRemarks.trim(),
      updatedAt: new Date().toISOString(),
    };
    const res = upsertLessonPlan(plan);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت طرح درس.', 'error');
      return;
    }
    showToast('طرح درس و گزارش تدریس ثبت شد (قابل مشاهده جهت نظارت مدیر و معاون).');
    setLpTopic('');
    setLpGoals('');
    setLpTools('');
    setLpActivities('');
    setLpReport('');
    setLpRemarks('');
  };

  // Report Card & SVG Trend data for selected student (Tab D)
  const reportStudentRow = useMemo(() => {
    if (!effectiveReportStudent) return null;
    return continuousRows.find((r) => r.student.id === effectiveReportStudent.id) ?? null;
  }, [continuousRows, effectiveReportStudent]);

  const reportTrendPoints = useMemo(() => {
    if (!effectiveReportStudent) return [];
    return buildMonthlyTrendPoints({
      entries: gradebookEntries,
      studentId: effectiveReportStudent.id,
      subject: selectedSubject,
    });
  }, [gradebookEntries, effectiveReportStudent, selectedSubject]);

  const reportDraftKey = effectiveReportStudent
    ? `${effectiveReportStudent.id}:${selectedSubject}:${selectedMonth}`
    : '';

  const autoGeneratedReportText = useMemo(() => {
    if (!effectiveReportStudent || !reportStudentRow) return '';
    return generatePersianDescriptiveReport({
      studentName: effectiveReportStudent.fullName,
      subject: selectedSubject,
      month: selectedMonth,
      breakdown: reportStudentRow.breakdown,
      disciplinaryNote: reportStudentRow.entry?.disciplinaryNote,
    });
  }, [effectiveReportStudent, reportStudentRow, selectedSubject, selectedMonth]);

  const displayedReportText =
    customReportTextMap[reportDraftKey] ?? autoGeneratedReportText;

  // Submit formal Grade Appeal (Parent ONLY)
  const handleParentSubmitAppeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isParent || !linkedStudent) return;
    if (appealReason.trim().length < 5) {
      showToast('لطفاً علت درخواست بازبینی نمره را با جزئیات کافی (حداقل ۵ کاراکتر) بنویسید.', 'error');
      return;
    }

    const targetEntry = getEntryForStudent(linkedStudent.id, appealMonth);
    const appeal: GradeAppeal = {
      id: `${activeSchoolId}:appeal:${Date.now()}`,
      schoolId: activeSchoolId,
      studentId: linkedStudent.id,
      classId: linkedStudent.classId,
      subject: selectedSubject,
      jalaliMonth: appealMonth,
      gradeEntryId:
        targetEntry?.id ??
        `${activeSchoolId}:gb:${linkedStudent.classId}:${selectedSubject}:${appealMonth}:${linkedStudent.id}`,
      originalScore: targetEntry?.numericScore,
      originalDescriptiveLevel: targetEntry?.descriptiveLevel,
      parentReason: appealReason.trim(),
      submittedByName: session?.displayName ?? linkedStudent.parentName,
      submittedAtJalali: defaultWorkdayJalali,
      status: 'submitted',
      updatedAt: new Date().toISOString(),
    };

    const res = upsertGradeAppeal(appeal);
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ثبت اعتراض نمره وجود نداشت.', 'error');
      return;
    }
    showToast('درخواست بازبینی (اعتراض نمره) با موفقیت ثبت و به دبیر مربوطه ارجاع شد.');
    setAppealReason('');
  };

  // Teacher responds to appeal
  const handleTeacherReviewAppeal = (appeal: GradeAppeal) => {
    if (!canManage) return;
    const responseText =
      (teacherRespDraft[appeal.id] ?? '').trim() || 'برگه و سوابق ارزشیابی دانش‌آموز مجدداً بررسی شد.';
    const rawRev = teacherRevScoreDraft[appeal.id];
    let revisedScore = appeal.originalScore;
    if (rawRev !== undefined && rawRev.trim() !== '') {
      const parsed = Number(toAsciiDigits(rawRev));
      if (!validateGradeScore(parsed)) {
        showToast('نمره اصلاحی باید بین ۰ تا ۲۰ باشد.', 'error');
        return;
      }
      revisedScore = parsed;
    }

    const updated: GradeAppeal = {
      ...appeal,
      status: 'teacher_reviewed',
      teacherResponse: responseText,
      teacherReviewedByName: session?.displayName ?? roleDef.labelFa,
      revisedScore,
      revisedDescriptiveLevel:
        revisedScore !== undefined ? scoreToDescriptiveLevel(revisedScore) : appeal.originalDescriptiveLevel,
      updatedAt: new Date().toISOString(),
    };

    const res = upsertGradeAppeal(updated);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت پاسخ دبیر.', 'error');
      return;
    }
    showToast('پاسخ دبیر ثبت و جهت تایید نهایی به مدیر مدرسه ارسال شد.');
  };

  // Principal gives final approval and syncs revised grade into Gradebook
  const handlePrincipalApproveAppeal = (appeal: GradeAppeal) => {
    if (!canApproveAppeals) return;
    const note =
      (principalNoteDraft[appeal.id] ?? '').trim() || 'بررسی دبیر تایید و نمره نهایی در دفتر کلاسی اعمال شد.';
    const updated: GradeAppeal = {
      ...appeal,
      status: 'principal_approved',
      principalNote: note,
      principalApprovedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };

    const res = upsertGradeAppeal(updated);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در تایید نهایی مدیر.', 'error');
      return;
    }

    // Automatically synchronize approved revised score into gradebook_entries
    if (appeal.revisedScore !== undefined) {
      const existing = gradebookEntries.find((g) => g.id === appeal.gradeEntryId);
      upsertGradebookEntry({
        id: appeal.gradeEntryId,
        schoolId: appeal.schoolId,
        studentId: appeal.studentId,
        classId: appeal.classId,
        subject: appeal.subject,
        jalaliMonth: appeal.jalaliMonth,
        jalaliDate: existing?.jalaliDate ?? defaultWorkdayJalali,
        ...existing,
        numericScore: appeal.revisedScore,
        descriptiveLevel:
          appeal.revisedDescriptiveLevel ?? scoreToDescriptiveLevel(appeal.revisedScore),
        recordedBy: activeRole,
        updatedAt: new Date().toISOString(),
      });
    }

    showToast('اعتراض نمره با تایید نهایی مدیر مختومه و نمره نهایی در کارنامه ثبت شد.');
  };

  const tabs: Array<{ id: GradebookTab; label: string; icon: React.ComponentType<{ className?: string }>; hidden?: boolean }> = [
    { id: 'grading', label: 'نمره‌دهی و ارزشیابی', icon: ClipboardCheck, hidden: isParent },
    { id: 'lesson_plan', label: 'طرح درس و گزارش تدریس', icon: BookOpen, hidden: isParent },
    { id: 'continuous', label: 'محاسبه هوشمند نمره مستمر', icon: Calculator, hidden: isParent },
    { id: 'report_card', label: 'کارنامه جامع و نمودار پیشرفت', icon: Sparkles },
    {
      id: 'appeals',
      label: `اعتراضات نمره (${toPersianDigits(gradeAppeals.length)})`,
      icon: MessageSquareWarning,
    },
  ];

  const handleParentQuickAppeal = (req: QuickAppealRequest) => {
    setSelectedSubject(req.subject);
    setAppealMonth(req.jalaliMonth);
    setActiveTab('appeals');
  };

  const parentTimeframeLabel = getTimeframeDisplayLabel(parentTimeframe, selectedMonth);

  const classLessonPlans = useMemo(
    () => lessonPlans.filter((lp) => lp.classId === effectiveClassId),
    [lessonPlans, effectiveClassId]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isParent
              ? 'کارنامه توصیفی، نمودار پیشرفت و اعتراض نمره'
              : 'کاربرگ الکترونیک دبیر و دفتر کلاسی هوشمند'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isParent && linkedStudent
              ? `گزارش عملکرد جامع ${linkedStudent.fullName} در ${parentTimeframeLabel} — مشاهده کارنامه همه دروس، نمودار پیشرفت، چاپ A4/A5 و ثبت درخواست بازبینی نمره.`
              : 'ارزشیابی توصیفی و عددی، طرح درس، محاسبه هوشمند نمره مستمر، دستیار کارنامه و چرخه اعتراض نمره.'}
          </p>
        </div>

        {/* Scope Selectors (Staff only; parents use the flexible multi-timeframe & all-subjects controls below) */}
        {!isParent && (
          <div className="flex flex-wrap items-center gap-2">
            {classes.length > 0 && (
              <select
                aria-label="انتخاب کلاس"
                value={effectiveClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="انتخاب درس"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {SUBJECT_LIST.map((subj) => (
                <option key={subj} value={subj}>
                  درس: {subj}
                </option>
              ))}
            </select>

            <select
              aria-label="انتخاب ماه تحصیلی"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as JalaliAcademicMonth)}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {ACADEMIC_MONTHS.map((m) => (
                <option key={m} value={m}>
                  ماه {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div
        role="tablist"
        aria-label="بخش‌های دفتر کلاسی هوشمند"
        className="no-print flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        {tabs
          .filter((t) => !t.hidden)
          .map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
      </div>

      {/* TAB A: Dual Grading (Descriptive + Numeric 0-20) & Private Teacher Notes */}
      {activeTab === 'grading' && !isParent && (
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              دفتر نمره {classMap.get(effectiveClassId)?.name} — {selectedSubject} (ماه {selectedMonth})
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>یادداشت محرمانه دبیر هرگز در پنل اولیا نمایش داده نمی‌شود</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-3">دانش‌آموز</th>
                  <th className="py-3 px-2 text-center w-24">نمره (۰-۲۰)</th>
                  <th className="py-3 px-2 w-40">ارزشیابی توصیفی</th>
                  <th className="py-3 px-2 text-center w-24">شفاهی</th>
                  <th className="py-3 px-2 text-center w-24">فعالیت</th>
                  <th className="py-3 px-2">ملاحظه انضباطی (کارنامه)</th>
                  <th className="py-3 px-3">یادداشت محرمانه دبیر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {classStudents.map((st) => {
                  const entry = getEntryForStudent(st.id);
                  return (
                    <tr key={st.id} className="align-middle">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {st.fullName}
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          step="0.25"
                          min={0}
                          max={20}
                          aria-label={`نمره عددی ${st.fullName}`}
                          value={entry?.numericScore ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            if (val === undefined) return;
                            handleUpdateGradeField(st.id, {
                              numericScore: val,
                              descriptiveLevel: scoreToDescriptiveLevel(val),
                            });
                          }}
                          className="w-20 min-h-[36px] text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 font-bold tabular-nums text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          aria-label={`سطح توصیفی ${st.fullName}`}
                          value={entry?.descriptiveLevel ?? 'خیلی خوب'}
                          onChange={(e) =>
                            handleUpdateGradeField(st.id, {
                              descriptiveLevel: e.target.value as DescriptiveLevel,
                            })
                          }
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                        >
                          {DESCRIPTIVE_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={20}
                          aria-label={`پرسش شفاهی ${st.fullName}`}
                          value={entry?.oralQuizScore ?? ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (validateGradeScore(val)) {
                              handleUpdateGradeField(st.id, { oralQuizScore: val });
                            }
                          }}
                          className="w-20 min-h-[36px] text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 tabular-nums text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={20}
                          aria-label={`فعالیت کلاسی ${st.fullName}`}
                          value={entry?.classActivityScore ?? ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (validateGradeScore(val)) {
                              handleUpdateGradeField(st.id, { classActivityScore: val });
                            }
                          }}
                          className="w-20 min-h-[36px] text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 tabular-nums text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-2 min-w-[180px]">
                        <input
                          type="text"
                          value={entry?.disciplinaryNote ?? ''}
                          onChange={(e) =>
                            handleUpdateGradeField(st.id, { disciplinaryNote: e.target.value })
                          }
                          placeholder="تذکر یا تشویق کلاسی..."
                          className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <input
                          type="text"
                          value={entry?.privateTeacherNote ?? ''}
                          onChange={(e) =>
                            handleUpdateGradeField(st.id, { privateTeacherNote: e.target.value })
                          }
                          placeholder="یادداشت خصوصی معلم..."
                          className="w-full min-h-[36px] rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB B: Lesson Plan & Teaching Report (Supervision for Principal/Deputy, hidden from Parent) */}
      {activeTab === 'lesson_plan' && !isParent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleSaveLessonPlan}
            className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                ثبت طرح درس و گزارش تدریس جلسه
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تاریخ شمسی جلسه
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={lpDate}
                  onChange={(e) => setLpDate(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  زنگ تدریس
                </label>
                <select
                  value={lpPeriod}
                  onChange={(e) => setLpPeriod(Number(e.target.value) as PeriodNumber)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {[1, 2, 3, 4].map((p) => (
                    <option key={p} value={p}>
                      زنگ {toPersianDigits(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                عنوان مبحث تدریسی
              </label>
              <input
                type="text"
                required
                value={lpTopic}
                onChange={(e) => setLpTopic(e.target.value)}
                placeholder="مثال: جمع و تفریق کسرها با مخرج نامساوی"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                اهداف آموزشی طرح درس
              </label>
              <textarea
                rows={2}
                value={lpGoals}
                onChange={(e) => setLpGoals(e.target.value)}
                placeholder="اهداف رفتاری و مهارتی جلسه..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ابزار و رسانه آموزشی
                </label>
                <input
                  type="text"
                  value={lpTools}
                  onChange={(e) => setLpTools(e.target.value)}
                  placeholder="تخته هوشمند، کاربرگ..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  فعالیت‌های یادگیری
                </label>
                <input
                  type="text"
                  value={lpActivities}
                  onChange={(e) => setLpActivities(e.target.value)}
                  placeholder="کار گروهی، پرسش و پاسخ..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                گزارش اجرای تدریس (پس از زنگ)
              </label>
              <textarea
                rows={2}
                value={lpReport}
                onChange={(e) => setLpReport(e.target.value)}
                placeholder="میزان یادگیری کلاس، چالش‌ها و میزان پیشروی..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ملاحظات تربیتی و نظارتی (برای مدیر / معاون)
              </label>
              <input
                type="text"
                value={lpRemarks}
                onChange={(e) => setLpRemarks(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              ثبت طرح درس و گزارش تدریس
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              سوابق طرح درس و گزارش تدریس ثبت‌شده ({toPersianDigits(classLessonPlans.length)} مورد)
            </h2>
            {classLessonPlans.map((lp) => (
              <article
                key={lp.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {lp.subject} · {formatJalaliDisplay(lp.jalaliDate, false)} · زنگ{' '}
                      {toPersianDigits(lp.period)} · {lp.teacherName}
                    </div>
                    <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                      {lp.topicTitle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = deleteLessonPlan(lp.id);
                      if (res.ok) showToast('طرح درس حذف شد.', 'info');
                    }}
                    aria-label="حذف طرح درس"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-5">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div className="font-bold text-slate-700 dark:text-slate-200">اهداف و ابزار:</div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{lp.goals}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">ابزار: {lp.tools}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/25 p-3">
                    <div className="font-bold text-emerald-800 dark:text-emerald-300">گزارش اجرای تدریس:</div>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">{lp.teachingReport}</p>
                    {lp.educationalRemarks && (
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        ملاحظات: {lp.educationalRemarks}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB C: Smart Continuous Assessment (Configurable Weights + Phase 3 Micro-Quiz Pre-Wired) */}
      {activeTab === 'continuous' && !isParent && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  تنظیم فرمول وزن‌دهی نمره مستمر ({selectedSubject})
                </h2>
              </div>
              <span
                className={`text-xs font-bold tabular-nums ${
                  weightSum === 100
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                مجموع ضرایب: {toPersianDigits(weightSum)}٪
                {weightSum !== 100 && ' (به‌صورت خودکار نرمال‌سازی می‌شود)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 tabular-nums">
              {(
                [
                  { key: 'attendanceWeight', label: 'حضور و نظم (%)' },
                  { key: 'homeworkWeight', label: 'تکالیف آنلاین (%)' },
                  { key: 'oralQuizWeight', label: 'پرسش شفاهی (%)' },
                  { key: 'classActivityWeight', label: 'فعالیت کلاسی (%)' },
                  { key: 'microQuizWeight', label: 'کوییز ویدیو (فاز ۳) (%)' },
                ] as const
              ).map((item) => (
                <div key={item.key} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {item.label}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={activeWeights[item.key]}
                    onChange={(e) => handleWeightChange(item.key, Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="text-sm font-extrabold text-indigo-700 dark:text-indigo-400">
                    {toPersianDigits(activeWeights[item.key])}٪
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm border-collapse tabular-nums">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">دانش‌آموز</th>
                    <th className="py-3 px-3 text-center">حضور زنده</th>
                    <th className="py-3 px-3 text-center">میانگین تکالیف</th>
                    <th className="py-3 px-3 text-center">شفاهی</th>
                    <th className="py-3 px-3 text-center">فعالیت</th>
                    <th className="py-3 px-3 text-center">نمره مستمر هوشمند</th>
                    <th className="py-3 px-4 text-left">اعمال در کارنامه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {continuousRows.map(({ student, breakdown }) => (
                    <tr key={student.id}>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {student.fullName}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {toPersianDigits(breakdown.attendanceRatePercent)}٪ (
                        {toPersianDigits(breakdown.attendanceScore20.toFixed(1))})
                      </td>
                      <td className="py-3 px-3 text-center">
                        {breakdown.homeworkAverage20 !== null
                          ? toPersianDigits(breakdown.homeworkAverage20.toFixed(1))
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {breakdown.oralQuizScore20 !== null
                          ? toPersianDigits(breakdown.oralQuizScore20.toFixed(1))
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {breakdown.classActivityScore20 !== null
                          ? toPersianDigits(breakdown.classActivityScore20.toFixed(1))
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-extrabold text-indigo-700 dark:text-indigo-400">
                          {toPersianDigits(breakdown.finalScore.toFixed(2))} / ۲۰
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {breakdown.descriptiveLevel}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-left">
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyContinuousToGradebook(student.id, breakdown.finalScore)
                          }
                          className="min-h-[34px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          ثبت در ماه {selectedMonth}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB D (Parent Mode): Upgraded Multi-Timeframe All-Subjects Report Card & Per-Subject SVG Charts */}
      {activeTab === 'report_card' && isParent && linkedStudent && (
        <ComprehensiveReportCardView
          student={linkedStudent}
          classRoom={classMap.get(linkedStudent.classId) ?? null}
          school={activeSchool}
          studentProfile={studentProfiles.find((p) => p.studentId === linkedStudent.id)}
          gradebookEntries={gradebookEntries}
          gradebookWeights={gradebookWeights}
          studentAttendance={studentAttendance}
          homeworkAssignments={homeworkAssignments}
          homeworkSubmissions={homeworkSubmissions}
          onlineExams={onlineExams}
          onlineExamSubmissions={onlineExamSubmissions}
          timeframe={parentTimeframe}
          onTimeframeChange={setParentTimeframe}
          selectedMonth={selectedMonth}
          onSelectedMonthChange={setSelectedMonth}
          selectedSubject={parentSubjectFilter}
          onSelectedSubjectChange={setParentSubjectFilter}
          onQuickAppeal={handleParentQuickAppeal}
          isParent
          onNotify={(msg, tone) => showToast(msg, tone)}
        />
      )}

      {/* TAB D (Staff Mode): Auto Descriptive Report Assistant + Native SVG Monthly Trend Chart + Printable Report Card */}
      {activeTab === 'report_card' && !isParent && effectiveReportStudent && reportStudentRow && (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {!isParent && (
                <select
                  aria-label="انتخاب دانش‌آموز جهت صدور کارنامه"
                  value={effectiveReportStudent.id}
                  onChange={(e) => setReportStudentId(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-semibold text-slate-800 dark:text-slate-100"
                >
                  {classStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                دستیار هوشمند متن توصیفی را از حضور، تکالیف و نمرات زنده تولید می‌کند.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void copyTextToClipboard(displayedReportText).then((ok) =>
                    showToast(
                      ok ? 'متن کارنامه توصیفی کپی شد.' : 'امکان کپی وجود نداشت.',
                      ok ? 'success' : 'error'
                    )
                  );
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Copy className="w-4 h-4" />
                کپی متن توصیفی
              </button>
              <PrintButtons compact documentLabel="کارنامه ماهانه" />
            </div>
          </div>

          <PrintShell
            school={activeSchool}
            documentTitle={`کارنامه ماهانه و تحلیل پیشرفت تحصیلی — ${effectiveReportStudent.fullName}`}
            subtitle={`کلاس: ${classMap.get(effectiveReportStudent.classId)?.name ?? ''} · درس: ${selectedSubject} · ماه ${selectedMonth}`}
          >
            <div className="space-y-4">
              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">نمره ماه {selectedMonth}</div>
                  <div className="mt-1 text-2xl font-extrabold text-indigo-700 dark:text-indigo-400">
                    {toPersianDigits(
                      (reportStudentRow.entry?.numericScore ?? reportStudentRow.breakdown.finalScore).toFixed(1)
                    )}{' '}
                    / ۲۰
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {reportStudentRow.entry?.descriptiveLevel ?? reportStudentRow.breakdown.descriptiveLevel}
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">نمره مستمر هوشمند</div>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                    {toPersianDigits(reportStudentRow.breakdown.finalScore.toFixed(2))}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    مبتنی بر حضور و تکالیف
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">نرخ حضور کلاسی</div>
                  <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    {toPersianDigits(reportStudentRow.breakdown.attendanceRatePercent)}٪
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">تحویل تکالیف آنلاین</div>
                  <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    {toPersianDigits(reportStudentRow.breakdown.homeworkCompletionPercent)}٪
                  </div>
                </div>
              </div>

              {/* Native SVG Monthly Trend Chart */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                <MonthlyTrendSvgChart
                  points={reportTrendPoints}
                  studentName={effectiveReportStudent.fullName}
                  subject={selectedSubject}
                />
              </div>

              {/* Auto Descriptive Report Card Text (Editable by Teacher/Admin, Read-Only for Parent) */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    ارزیابی توصیفی ماهانه (دستیار کارنامه)
                  </h2>
                  {!isParent && customReportTextMap[reportDraftKey] !== undefined && (
                    <button
                      type="button"
                      onClick={() =>
                        setCustomReportTextMap((prev) => {
                          const next = { ...prev };
                          delete next[reportDraftKey];
                          return next;
                        })
                      }
                      className="no-print text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      بازتولید خودکار متن
                    </button>
                  )}
                </div>

                {!isParent ? (
                  <>
                    <textarea
                      rows={4}
                      value={displayedReportText}
                      onChange={(e) =>
                        setCustomReportTextMap((prev) => ({
                          ...prev,
                          [reportDraftKey]: e.target.value,
                        }))
                      }
                      className="no-print w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5 text-sm leading-7 text-slate-800 dark:text-slate-100"
                    />
                    <p className="print-only text-sm leading-7 text-black">{displayedReportText}</p>
                  </>
                ) : (
                  <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                    {displayedReportText}
                  </p>
                )}
              </div>
            </div>
          </PrintShell>
        </div>
      )}

      {/* TAB E: Grade Appeals Workflow («ثبت شده» -> «پاسخ دبیر» -> «تایید نهایی مدیر») */}
      {activeTab === 'appeals' && (
        <div className="space-y-5">
          {/* Parent Formal Objection Form + Shortcut to Private Parent-Staff Chat */}
          {isParent && linkedStudent && (
            <div className="space-y-4">
              <form
                onSubmit={handleParentSubmitAppeal}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquareWarning className="w-5 h-5 text-amber-500 shrink-0" />
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      ثبت درخواست بازبینی (اعتراض نمره) برای {linkedStudent.fullName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/parent-staff-chat')}
                    className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    گفت‌وگوی اختصاصی با معلم / مدیر
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="gb-parent-appeal-subject"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      درس مورد اعتراض
                    </label>
                    <select
                      id="gb-parent-appeal-subject"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {SUBJECT_LIST.map((subj) => (
                        <option key={subj} value={subj}>
                          درس: {subj}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="gb-parent-appeal-month"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      ماه تحصیلی
                    </label>
                    <select
                      id="gb-parent-appeal-month"
                      value={appealMonth}
                      onChange={(e) => setAppealMonth(e.target.value as JalaliAcademicMonth)}
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {ACADEMIC_MONTHS.map((m) => (
                        <option key={m} value={m}>
                          ماه {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="gb-parent-appeal-reason"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    توضیح درخواست بازبینی نمره
                  </label>
                  <textarea
                    id="gb-parent-appeal-reason"
                    rows={2}
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="توضیح محترمانه خود درباره نمره این درس را بنویسید..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold whitespace-nowrap"
                  >
                    ثبت رسمی اعتراض نمره
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Appeals Workflow List */}
          <div className="space-y-3">
            {gradeAppeals.map((ap) => {
              const stName = studentMap.get(ap.studentId)?.fullName ?? 'دانش‌آموز';
              const statusMeta = APPEAL_STATUS_META[ap.status];
              return (
                <article
                  key={ap.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        {stName} · درس {ap.subject} (ماه {ap.jalaliMonth}) · ثبت:{' '}
                        {formatJalaliDisplay(ap.submittedAtJalali, false)}
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        نمره اولیه:{' '}
                        {ap.originalScore !== undefined ? toPersianDigits(ap.originalScore) : '—'}
                        {ap.revisedScore !== undefined && (
                          <span className="mr-3 text-emerald-700 dark:text-emerald-400">
                            ← نمره پیشنهادی / اصلاح‌شده: {toPersianDigits(ap.revisedScore)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs leading-6 text-slate-700 dark:text-slate-200">
                    <strong>درخواست ولی ({ap.submittedByName}):</strong> {ap.parentReason}
                  </div>

                  {ap.teacherResponse && (
                    <div className="rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 p-3 text-xs leading-6 text-sky-950 dark:text-sky-200">
                      <strong>پاسخ دبیر ({ap.teacherReviewedByName}):</strong> {ap.teacherResponse}
                    </div>
                  )}

                  {ap.principalNote && (
                    <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 p-3 text-xs leading-6 text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        <strong>تایید نهایی مدیر ({ap.principalApprovedByName}):</strong>{' '}
                        {ap.principalNote}
                      </span>
                    </div>
                  )}

                  {/* Stage 2 Action: Teacher review */}
                  {ap.status === 'submitted' && canManage && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        placeholder="نمره جدید (اختیاری)"
                        value={teacherRevScoreDraft[ap.id] ?? ''}
                        onChange={(e) =>
                          setTeacherRevScoreDraft((prev) => ({ ...prev, [ap.id]: e.target.value }))
                        }
                        className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs tabular-nums text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="پاسخ و نتیجه بررسی دبیر..."
                        value={teacherRespDraft[ap.id] ?? ''}
                        onChange={(e) =>
                          setTeacherRespDraft((prev) => ({ ...prev, [ap.id]: e.target.value }))
                        }
                        className="sm:col-span-6 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleTeacherReviewAppeal(ap)}
                        className="sm:col-span-3 min-h-[38px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3"
                      >
                        ثبت پاسخ دبیر
                      </button>
                    </div>
                  )}

                  {/* Stage 3 Action: Principal final approval */}
                  {ap.status === 'teacher_reviewed' && canApproveAppeals && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="دستور یا یادداشت تایید نهایی مدیر..."
                        value={principalNoteDraft[ap.id] ?? ''}
                        onChange={(e) =>
                          setPrincipalNoteDraft((prev) => ({ ...prev, [ap.id]: e.target.value }))
                        }
                        className="flex-1 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handlePrincipalApproveAppeal(ap)}
                        className="min-h-[38px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
                      >
                        تایید نهایی مدیر و اعمال نمره
                      </button>
                    </div>
                  )}
                </article>
              );
            })}

            {gradeAppeals.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <GraduationCap className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                هیچ اعتراض نمره‌ای در حال حاضر ثبت نشده است.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
