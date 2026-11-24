// Phase 9-C: Discipline, Rewards & Formal Pledges Module Page
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSignature,
  Plus,
  Scale,
  Search,
  Trash2,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import {
  buildDefaultPledgeTextFa,
  buildDisciplineReportPrintHtml,
  buildDisciplineTrendPoints,
  buildPledgePrintHtml,
  calculateStudentDisciplineScore,
  DISCIPLINE_SEVERITY_META,
  filterVisibleDisciplineRecords,
  INFRACTION_CATEGORIES_FA,
  REWARD_CATEGORIES_FA,
} from '../../services/phase9c/disciplineService';
import type {
  DisciplinePledge,
  DisciplineRecord,
  DisciplineRecordKind,
  DisciplineSeverity,
} from '../../types/domain';
import { DisciplineTrendChartSvg } from './DisciplineTrendChartSvg';

type ActiveTab = 'records' | 'pledges';

export const DisciplinePage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    linkedStudent,
    teacherAssignedClassIds,
    defaultWorkdayJalali,
    classes,
    students,
    disciplineRecords,
    disciplinePledges,
    upsertDisciplineRecord,
    softDeleteDisciplineRecord,
    upsertDisciplinePledge,
    softDeleteDisciplinePledge,
    signDisciplinePledge,
  } = useSchoolData();

  const isParentOrStudent = activeRole === 'parent' || activeRole === 'student';
  const isAdminOrDeputy =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal' ||
    activeRole === 'deputy';
  const canCreateRecord = isAdminOrDeputy || activeRole === 'teacher';

  const visibleClasses = useMemo(() => {
    if (activeRole === 'teacher' && teacherAssignedClassIds.length > 0) {
      const set = new Set(teacherAssignedClassIds);
      return classes.filter((c) => set.has(c.id));
    }
    return classes;
  }, [activeRole, classes, teacherAssignedClassIds]);

  const visibleStudents = useMemo(() => {
    if (isParentOrStudent) {
      return linkedStudent ? [linkedStudent] : [];
    }
    if (activeRole === 'teacher' && teacherAssignedClassIds.length > 0) {
      const set = new Set(teacherAssignedClassIds);
      return students.filter((s) => set.has(s.classId));
    }
    return students;
  }, [isParentOrStudent, linkedStudent, activeRole, teacherAssignedClassIds, students]);

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');
  const [kindFilter, setKindFilter] = useState<'all' | DisciplineRecordKind>('all');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // New Record Form State
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recKind, setRecKind] = useState<DisciplineRecordKind>('reward');
  const [recSeverity, setRecSeverity] = useState<DisciplineSeverity>('minor');
  const [recCategory, setRecCategory] = useState<string>(REWARD_CATEGORIES_FA[0]);
  const [recTitle, setRecTitle] = useState<string>('');
  const [recDescription, setRecDescription] = useState<string>('');
  const [recPoints, setRecPoints] = useState<string>('0.5');
  const [recDate, setRecDate] = useState<string>(defaultWorkdayJalali || getTodayJalali());
  const [recVisibleToFamily, setRecVisibleToFamily] = useState<boolean>(true);
  const [submittingRecord, setSubmittingRecord] = useState(false);

  // New Pledge Modal/Form State
  const [showPledgeForm, setShowPledgeForm] = useState(false);
  const [pledgeTitle, setPledgeTitle] = useState<string>('');
  const [pledgeBody, setPledgeBody] = useState<string>('');
  const [pledgeRelatedRecordId, setPledgeRelatedRecordId] = useState<string | undefined>(undefined);
  const [submittingPledge, setSubmittingPledge] = useState(false);

  // Parent Digital Signature Note State (per pledgeId)
  const [signNotesByPledge, setSignNotesByPledge] = useState<Record<string, string>>({});

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleStudents.filter((s) => {
      if (selectedClassId !== 'all' && s.classId !== selectedClassId) return false;
      if (q && !s.fullName.toLowerCase().includes(q) && !s.studentCode.includes(q)) return false;
      return true;
    });
  }, [visibleStudents, selectedClassId, searchQuery]);

  // Keep selected student valid
  useEffect(() => {
    if (isParentOrStudent && linkedStudent) {
      setSelectedStudentId(linkedStudent.id);
      return;
    }
    if (
      filteredStudents.length > 0 &&
      !filteredStudents.some((s) => s.id === selectedStudentId)
    ) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [isParentOrStudent, linkedStudent, filteredStudents, selectedStudentId]);

  const selectedStudent = useMemo(
    () => visibleStudents.find((s) => s.id === selectedStudentId) ?? null,
    [visibleStudents, selectedStudentId]
  );

  const selectedClassName = useMemo(() => {
    if (!selectedStudent) return '—';
    return classes.find((c) => c.id === selectedStudent.classId)?.name ?? 'کلاس نامشخص';
  }, [selectedStudent, classes]);

  const scopedRecords = useMemo(
    () =>
      filterVisibleDisciplineRecords({
        records: disciplineRecords,
        role: activeRole,
        linkedStudentId: linkedStudent?.id,
        teacherAssignedClassIds,
      }),
    [disciplineRecords, activeRole, linkedStudent?.id, teacherAssignedClassIds]
  );

  const studentRecords = useMemo(() => {
    if (!selectedStudent) return [];
    return scopedRecords
      .filter((r) => r.studentId === selectedStudent.id)
      .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate));
  }, [scopedRecords, selectedStudent]);

  const filteredStudentRecords = useMemo(() => {
    if (kindFilter === 'all') return studentRecords;
    return studentRecords.filter((r) => r.kind === kindFilter);
  }, [studentRecords, kindFilter]);

  const scoreSummary = useMemo(() => {
    if (!selectedStudent) return null;
    return calculateStudentDisciplineScore(scopedRecords, selectedStudent.id);
  }, [scopedRecords, selectedStudent]);

  const trendPoints = useMemo(() => {
    if (!selectedStudent) return [];
    return buildDisciplineTrendPoints(scopedRecords, selectedStudent.id);
  }, [scopedRecords, selectedStudent]);

  const studentPledges = useMemo(() => {
    if (!selectedStudent) return [];
    return disciplinePledges
      .filter((p) => p.studentId === selectedStudent.id)
      .sort((a, b) => b.issuedAtJalali.localeCompare(a.issuedAtJalali));
  }, [disciplinePledges, selectedStudent]);

  const reportPrintHtml = useMemo(() => {
    if (!selectedStudent || !scoreSummary) return '';
    return buildDisciplineReportPrintHtml({
      student: selectedStudent,
      className: selectedClassName,
      summary: scoreSummary,
      records: studentRecords,
      school: activeSchool,
      todayJalali: getTodayJalali(),
    });
  }, [selectedStudent, selectedClassName, scoreSummary, studentRecords, activeSchool]);

  const handleKindChange = (nextKind: DisciplineRecordKind) => {
    setRecKind(nextKind);
    setRecCategory(nextKind === 'reward' ? REWARD_CATEGORIES_FA[0] : INFRACTION_CATEGORIES_FA[0]);
  };

  const handleSeverityChange = (nextSev: DisciplineSeverity) => {
    setRecSeverity(nextSev);
    setRecPoints(String(DISCIPLINE_SEVERITY_META[nextSev].defaultPoints));
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !session) return;
    if (!recTitle.trim()) {
      setFeedback({ type: 'err', text: 'لطفاً عنوان مورد تشویقی یا انضباطی را وارد کنید.' });
      return;
    }
    setSubmittingRecord(true);
    setFeedback(null);
    const nowIso = new Date().toISOString();
    const record: DisciplineRecord = {
      id: '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      studentId: selectedStudent.id,
      classId: selectedStudent.classId,
      kind: recKind,
      severity: recKind === 'reward' ? 'minor' : recSeverity,
      category: recCategory,
      title: recTitle.trim(),
      description: recDescription.trim(),
      jalaliDate: recDate.trim() || getTodayJalali(),
      pointsDelta: Math.max(0.25, Math.min(20, Number(recPoints) || 0.5)),
      visibleToParentStudent: recVisibleToFamily,
      recordedByUserId: session.userId,
      recordedByName: session.displayName,
      recordedByRole: activeRole,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertDisciplineRecord(record);
    setSubmittingRecord(false);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ثبت رکورد.' });
      return;
    }
    setRecTitle('');
    setRecDescription('');
    setShowRecordForm(false);
    setFeedback({
      type: 'ok',
      text:
        recKind === 'reward'
          ? 'تشویق انضباطی با موفقیت ثبت و نمره انضباط به‌روزرسانی شد.'
          : 'تذکر/مورد انضباطی با موفقیت ثبت شد.',
    });
  };

  const openPledgeComposer = (relatedRecord?: DisciplineRecord) => {
    if (!selectedStudent) return;
    const reasonTitle = relatedRecord?.title || 'عدم رعایت مقررات انضباطی مدرسه';
    const jalaliDate = relatedRecord?.jalaliDate || getTodayJalali();
    setPledgeRelatedRecordId(relatedRecord?.id);
    setPledgeTitle(`تعهدنامه انضباطی: ${reasonTitle}`);
    setPledgeBody(
      buildDefaultPledgeTextFa({
        studentName: selectedStudent.fullName,
        className: selectedClassName,
        schoolName: activeSchool.name,
        reasonTitle,
        jalaliDate,
      })
    );
    setActiveTab('pledges');
    setShowPledgeForm(true);
  };

  const handleCreatePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !session) return;
    if (!pledgeTitle.trim() || !pledgeBody.trim()) {
      setFeedback({ type: 'err', text: 'عنوان و متن تعهدنامه نمی‌تواند خالی باشد.' });
      return;
    }
    setSubmittingPledge(true);
    setFeedback(null);
    const nowIso = new Date().toISOString();
    const pledge: DisciplinePledge = {
      id: '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      studentId: selectedStudent.id,
      classId: selectedStudent.classId,
      relatedRecordId: pledgeRelatedRecordId,
      title: pledgeTitle.trim(),
      bodyText: pledgeBody.trim(),
      issuedAtJalali: getTodayJalali(),
      issuedByUserId: session.userId,
      issuedByName: session.displayName,
      status: 'pending_parent',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertDisciplinePledge(pledge);
    setSubmittingPledge(false);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در صدور تعهدنامه.' });
      return;
    }
    setShowPledgeForm(false);
    setPledgeTitle('');
    setPledgeBody('');
    setPledgeRelatedRecordId(undefined);
    setFeedback({
      type: 'ok',
      text: 'تعهدنامه انضباطی صادر شد و جهت تایید دیجیتال در پنل ولی و چاپ رسمی آماده است.',
    });
  };

  const handleSignPledge = async (
    pledgeId: string,
    mode: 'signed_digital' | 'signed_in_person'
  ) => {
    setFeedback(null);
    const note = signNotesByPledge[pledgeId]?.trim();
    const res = await signDisciplinePledge(pledgeId, mode, note);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ثبت امضای تعهدنامه.' });
      return;
    }
    setFeedback({
      type: 'ok',
      text:
        mode === 'signed_digital'
          ? 'تایید و امضای دیجیتال ولی با ثبت در زنجیره ممیزی SHA-256 انجام شد.'
          : 'امضای حضوری ولی در پرونده انضباطی ثبت گردید.',
    });
  };

  const handleSoftDeleteRecord = async (id: string) => {
    const res = await softDeleteDisciplineRecord(id);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در انتقال به سطل بازیابی.' });
      return;
    }
    setFeedback({ type: 'ok', text: 'رکورد به سطل بازیابی امن منتقل شد (قابل بازگردانی).' });
  };

  const handleSoftDeletePledge = async (id: string) => {
    const res = await softDeleteDisciplinePledge(id);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در انتقال تعهدنامه.' });
      return;
    }
    setFeedback({ type: 'ok', text: 'تعهدنامه به سطل بازیابی امن منتقل شد.' });
  };

  const scoreToneClass =
    !scoreSummary || scoreSummary.band === 'excellent'
      ? 'text-emerald-700 dark:text-emerald-400'
      : scoreSummary.band === 'good'
        ? 'text-sky-700 dark:text-sky-400'
        : scoreSummary.band === 'attention'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-rose-700 dark:text-rose-400';

  const scoreBarClass =
    !scoreSummary || scoreSummary.band === 'excellent'
      ? 'bg-emerald-500'
      : scoreSummary.band === 'good'
        ? 'bg-sky-500'
        : scoreSummary.band === 'attention'
          ? 'bg-amber-500'
          : 'bg-rose-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
              پرونده انضباطی، تشویق و تعهدنامه
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeSchool.name} · سال تحصیلی {toPersianDigits(activeSchool.academicYear)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedStudent && (
            <PrintIconButton
              documentLabel={`کارنامه انضباطی ${selectedStudent.fullName}`}
              html={reportPrintHtml}
            />
          )}
          {canCreateRecord && selectedStudent && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('records');
                setShowRecordForm((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              ثبت تشویق / مورد انضباطی
            </button>
          )}
          {isAdminOrDeputy && selectedStudent && (
            <button
              type="button"
              onClick={() => openPledgeComposer()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <FileSignature className="h-4 w-4" />
              صدور تعهدنامه
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Student Selector Bar (Hidden for Parent/Student whose child is auto-selected) */}
      {!isParentOrStudent && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              فیلتر کلاس
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">همه کلاس‌ها ({toPersianDigits(visibleClasses.length)})</option>
              {visibleClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              جستجوی دانش‌آموز
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="نام یا کد دانش‌آموزی..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-8 pl-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              انتخاب پرونده دانش‌آموز
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {filteredStudents.length === 0 ? (
                <option value="">دانش‌آموزی یافت نشد</option>
              ) : (
                filteredStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} — {classes.find((c) => c.id === st.classId)?.name ?? ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      )}

      {/* Selected Student Score Overview & SVG Trend Chart */}
      {selectedStudent && scoreSummary ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Score Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    پرونده انضباطی فعال
                  </div>
                  <h2 className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-slate-50">
                    {selectedStudent.fullName}
                  </h2>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    کلاس {selectedClassName} · کد {toPersianDigits(selectedStudent.studentCode)}
                  </div>
                </div>
                <div className="text-left tabular-nums">
                  <div className={`text-3xl font-black ${scoreToneClass}`}>
                    {toPersianDigits(scoreSummary.finalScore)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">از ۲۰ نمره</div>
                </div>
              </div>

              {/* Minimal Progress Bar */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {scoreSummary.bandLabelFa}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {toPersianDigits(Math.round((scoreSummary.finalScore / 20) * 100))}٪
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${scoreBarClass}`}
                    style={{ width: `${Math.max(2, (scoreSummary.finalScore / 20) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* KPI Mini Strip */}
            <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-slate-100 pt-4 text-center tabular-nums dark:border-slate-800">
              <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">تشویق</div>
                <div className="mt-0.5 text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  {toPersianDigits(scoreSummary.rewardCount)}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  +{toPersianDigits(scoreSummary.totalRewardPoints)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">تذکر</div>
                <div className="mt-0.5 text-base font-extrabold text-rose-700 dark:text-rose-400">
                  {toPersianDigits(scoreSummary.infractionCount)}
                </div>
                <div className="text-[11px] text-rose-600 dark:text-rose-400">
                  −{toPersianDigits(scoreSummary.totalInfractionPoints)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">تعهدنامه</div>
                <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {toPersianDigits(studentPledges.length)}
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  {toPersianDigits(
                    studentPledges.filter((p) => p.status === 'pending_parent').length
                  )}{' '}
                  در انتظار
                </div>
              </div>
            </div>
          </div>

          {/* Trend Chart Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  نمودار روند تغییرات نمره انضباط در سال تحصیلی
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  محاسبه خودکار از پایه ۲۰ با اعمال امتیاز تشویق‌ها و کسر تذکرات (بازه ۰ تا ۲۰)
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> تشویق
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-600" /> مورد انضباطی
                </span>
              </div>
            </div>
            <DisciplineTrendChartSvg points={trendPoints} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          دانش‌آموزی برای نمایش پرونده انضباطی انتخاب نشده است.
        </div>
      )}

      {/* Tabs Navigation */}
      {selectedStudent && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'records'
                    ? 'border-slate-900 text-slate-900 dark:border-sky-400 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                سوابق تشویق و انضباطی ({toPersianDigits(studentRecords.length)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pledges')}
                className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'pledges'
                    ? 'border-slate-900 text-slate-900 dark:border-sky-400 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                تعهدنامه‌های انضباطی ({toPersianDigits(studentPledges.length)})
              </button>
            </div>

            {activeTab === 'records' && (
              <div className="flex items-center gap-1.5 pb-2">
                {(['all', 'reward', 'infraction'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      kindFilter === k
                        ? 'bg-slate-900 text-white dark:bg-sky-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {k === 'all' ? 'همه' : k === 'reward' ? 'تشویق‌ها' : 'موارد انضباطی'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TAB 1: RECORDS */}
          {activeTab === 'records' && (
            <div className="space-y-4">
              {/* Record Composer */}
              {showRecordForm && canCreateRecord && (
                <form
                  onSubmit={handleCreateRecord}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      ثبت مورد جدید برای {selectedStudent.fullName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRecordForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      بستن فرم
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        نوع رکورد
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleKindChange('reward')}
                          className={`rounded-xl border py-2 text-xs font-bold transition ${
                            recKind === 'reward'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          تشویق (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKindChange('infraction')}
                          className={`rounded-xl border py-2 text-xs font-bold transition ${
                            recKind === 'infraction'
                              ? 'border-rose-600 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-200'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          تذکر (−)
                        </button>
                      </div>
                    </div>

                    {recKind === 'infraction' && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          سطح اهمیت
                        </label>
                        <select
                          value={recSeverity}
                          onChange={(e) =>
                            handleSeverityChange(e.target.value as DisciplineSeverity)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {(Object.keys(DISCIPLINE_SEVERITY_META) as DisciplineSeverity[]).map(
                            (sev) => (
                              <option key={sev} value={sev}>
                                {DISCIPLINE_SEVERITY_META[sev].labelFa}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        دسته‌بندی
                      </label>
                      <select
                        value={recCategory}
                        onChange={(e) => setRecCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {(recKind === 'reward'
                          ? REWARD_CATEGORIES_FA
                          : INFRACTION_CATEGORIES_FA
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          ضریب امتیاز
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.25"
                          max="10"
                          value={recPoints}
                          onChange={(e) => setRecPoints(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          تاریخ شمسی
                        </label>
                        <input
                          type="text"
                          value={recDate}
                          onChange={(e) => setRecDate(e.target.value)}
                          placeholder="1405/08/15"
                          dir="ltr"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        عنوان دقیق مورد
                      </label>
                      <input
                        type="text"
                        required
                        value={recTitle}
                        onChange={(e) => setRecTitle(e.target.value)}
                        placeholder="مثلاً: همکاری نمونه در کار گروهی آزمایشگاه"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        توضیحات تکمیلی
                      </label>
                      <input
                        type="text"
                        value={recDescription}
                        onChange={(e) => setRecDescription(e.target.value)}
                        placeholder="شرح کوتاه مشاهده معلم یا معاون..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={recVisibleToFamily}
                        onChange={(e) => setRecVisibleToFamily(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                      قابل مشاهده در کارنامه انضباطی ولی و دانش‌آموز
                    </label>

                    <button
                      type="submit"
                      disabled={submittingRecord}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                    >
                      {submittingRecord ? 'در حال ثبت...' : 'ذخیره در پرونده انضباطی'}
                    </button>
                  </div>
                </form>
              )}

              {/* Records List */}
              {filteredStudentRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  هیچ رکوردی در این بخش ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudentRecords.map((rec) => {
                    const isReward = rec.kind === 'reward';
                    return (
                      <div
                        key={rec.id}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              isReward
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : rec.severity === 'critical'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            {isReward ? (
                              <Award className="h-4.5 w-4.5" />
                            ) : (
                              <AlertTriangle className="h-4.5 w-4.5" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {rec.title}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                · {rec.category}
                              </span>
                              {!isReward && (
                                <span
                                  className={`text-[11px] font-semibold ${
                                    rec.severity === 'critical'
                                      ? 'text-rose-700 dark:text-rose-400'
                                      : 'text-amber-700 dark:text-amber-400'
                                  }`}
                                >
                                  ({DISCIPLINE_SEVERITY_META[rec.severity].labelFa})
                                </span>
                              )}
                            </div>

                            {rec.description && (
                              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                {rec.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>تاریخ: {toPersianDigits(rec.jalaliDate)}</span>
                              <span>ثبت‌کننده: {rec.recordedByName}</span>
                              {!isParentOrStudent && (
                                <span className="inline-flex items-center gap-1">
                                  {rec.visibleToParentStudent ? (
                                    <>
                                      <Eye className="h-3 w-3 text-emerald-600" />
                                      نمایان برای ولی
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-3 w-3 text-slate-400" />
                                      صرفاً داخلی کادر
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums ${
                              isReward
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}
                          >
                            {isReward ? '+' : '−'}
                            {toPersianDigits(rec.pointsDelta)}
                          </span>

                          {isAdminOrDeputy && !isReward && rec.severity === 'critical' && (
                            <button
                              type="button"
                              onClick={() => openPledgeComposer(rec)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              صدور تعهدنامه
                            </button>
                          )}

                          {isAdminOrDeputy && (
                            <button
                              type="button"
                              onClick={() => handleSoftDeleteRecord(rec.id)}
                              title="انتقال به سطل بازیابی"
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLEDGES */}
          {activeTab === 'pledges' && (
            <div className="space-y-4">
              {showPledgeForm && isAdminOrDeputy && (
                <form
                  onSubmit={handleCreatePledge}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      تنظیم و صدور تعهدنامه رسمی انضباطی برای {selectedStudent.fullName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowPledgeForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      انصراف
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      موضوع تعهدنامه
                    </label>
                    <input
                      type="text"
                      required
                      value={pledgeTitle}
                      onChange={(e) => setPledgeTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      متن رسمی تعهدنامه (قابل ویرایش پیش از صدور و چاپ)
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={pledgeBody}
                      onChange={(e) => setPledgeBody(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-7 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingPledge}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                    >
                      {submittingPledge ? 'در حال صدور...' : 'صدور و ثبت تعهدنامه'}
                    </button>
                  </div>
                </form>
              )}

              {studentPledges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  هیچ تعهدنامه انضباطی برای این دانش‌آموز ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-4">
                  {studentPledges.map((pledge) => {
                    const pledgeHtml = buildPledgePrintHtml({
                      pledge,
                      studentName: selectedStudent.fullName,
                      studentNationalId: selectedStudent.nationalId,
                      parentName: selectedStudent.parentName,
                      className: selectedClassName,
                      school: activeSchool,
                    });
                    const isSigned = pledge.status !== 'pending_parent';
                    return (
                      <div
                        key={pledge.id}
                        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                {pledge.title}
                              </h4>
                              <span
                                className={`text-xs font-bold ${
                                  isSigned
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {pledge.status === 'signed_digital'
                                  ? `✓ امضای دیجیتال ولی (${toPersianDigits(pledge.parentSignedAtJalali ?? '')})`
                                  : pledge.status === 'signed_in_person'
                                    ? `✓ امضای حضوری در دفتر (${toPersianDigits(pledge.parentSignedAtJalali ?? '')})`
                                    : '• در انتظار تایید و امضای ولی'}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              تاریخ صدور: {toPersianDigits(pledge.issuedAtJalali)} · صادرکننده:{' '}
                              {pledge.issuedByName}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <PrintIconButton
                              compact
                              documentLabel={`تعهدنامه ${selectedStudent.fullName}`}
                              html={pledgeHtml}
                            />
                            {isAdminOrDeputy && (
                              <button
                                type="button"
                                onClick={() => handleSoftDeletePledge(pledge.id)}
                                title="انتقال به سطل بازیابی"
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                          {pledge.bodyText}
                        </p>

                        {pledge.parentSignatureNote && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                            <span className="font-bold">تاییدیه ثبت‌شده ({pledge.parentSignedByName}): </span>
                            {pledge.parentSignatureNote}
                          </div>
                        )}

                        {!isSigned && (activeRole === 'parent' || isAdminOrDeputy) && (
                          <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3 sm:flex-row sm:items-center dark:border-slate-800">
                            <input
                              type="text"
                              value={signNotesByPledge[pledge.id] ?? ''}
                              onChange={(e) =>
                                setSignNotesByPledge((prev) => ({
                                  ...prev,
                                  [pledge.id]: e.target.value,
                                }))
                              }
                              placeholder={
                                activeRole === 'parent'
                                  ? 'توضیح یا تعهد تکمیلی ولی (اختیاری)...'
                                  : 'توضیح ثبت امضای حضوری (اختیاری)...'
                              }
                              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            {activeRole === 'parent' && (
                              <button
                                type="button"
                                onClick={() => handleSignPledge(pledge.id, 'signed_digital')}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                تایید و امضای دیجیتال ولی
                              </button>
                            )}
                            {isAdminOrDeputy && (
                              <button
                                type="button"
                                onClick={() => handleSignPledge(pledge.id, 'signed_in_person')}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                ثبت امضای حضوری در دفتر
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
