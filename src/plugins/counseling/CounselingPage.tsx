// Phase 9-C: Confidential Two-Layer Counseling Office & Scheduling Module
import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Eye,
  HeartHandshake,
  Lock,
  Plus,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import {
  canEditClinicalLayer1,
  canViewClinicalLayer1,
  COUNSELING_MODE_LABELS,
  COUNSELING_STATUS_LABELS,
  filterCounselingSessionsForRole,
  getDueCounselingFollowUps,
} from '../../services/phase9c/counselingService';
import type {
  ClinicalRiskLevel,
  CounselingClinicalNote,
  CounselingSession,
  CounselingSessionMode,
  CounselingSessionStatus,
} from '../../types/domain';

const RISK_LABELS_FA: Record<ClinicalRiskLevel, string> = {
  low: 'کم (پایش عادی)',
  medium: 'متوسط (نیازمند پیگیری منظم)',
  high: 'حساس / اولویت بالا',
};

export const CounselingPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    linkedStudent,
    teacherAssignedClassIds,
    globalSystemConfig,
    defaultWorkdayJalali,
    classes,
    students,
    counselingSessions,
    counselingClinicalNotes,
    upsertCounselingSession,
    softDeleteCounselingSession,
    upsertCounselingClinicalNote,
    logCounselingClinicalViewed,
    togglePrincipalCounselingAuditAccess,
  } = useSchoolData();

  const todayJalali = getTodayJalali();
  const isCounselorOrSuper = activeRole === 'counselor' || activeRole === 'super_admin';
  const isParentOrStudent = activeRole === 'parent' || activeRole === 'student';

  const clinicalAccess = useMemo(
    () =>
      canViewClinicalLayer1(
        activeRole,
        activeSchoolId,
        globalSystemConfig.counselingPrincipalAuditSchoolIds
      ),
    [activeRole, activeSchoolId, globalSystemConfig.counselingPrincipalAuditSchoolIds]
  );
  const canEditClinical = canEditClinicalLayer1(activeRole);

  const isPrincipalAuditEnabledForSchool = Boolean(
    globalSystemConfig.counselingPrincipalAuditSchoolIds?.includes(activeSchoolId)
  );

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CounselingSessionStatus>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // New Appointment / Referral Form
  const [showForm, setShowForm] = useState(false);
  const [formStudentId, setFormStudentId] = useState<string>(
    linkedStudent?.id || students[0]?.id || ''
  );
  const [formDate, setFormDate] = useState<string>(defaultWorkdayJalali || todayJalali);
  const [formTime, setFormTime] = useState<string>('10:00');
  const [formMode, setFormMode] = useState<CounselingSessionMode>('in_person');
  const [formReason, setFormReason] = useState<string>('');
  const [formFollowUp, setFormFollowUp] = useState<string>('');

  // Layer 2 Shared Advice Editor (per sessionId)
  const [editingAdviceSessionId, setEditingAdviceSessionId] = useState<string | null>(null);
  const [adviceDraft, setAdviceDraft] = useState<string>('');
  const [shareParentDraft, setShareParentDraft] = useState<boolean>(false);
  const [shareTeacherDraft, setShareTeacherDraft] = useState<boolean>(false);
  const [followUpDraft, setFollowUpDraft] = useState<string>('');

  // Layer 1 Confidential Clinical Note Drawer State (per sessionId)
  const [openClinicalSessionId, setOpenClinicalSessionId] = useState<string | null>(null);
  const [auditModalSessionId, setAuditModalSessionId] = useState<string | null>(null);
  const [auditReasonInput, setAuditReasonInput] = useState<string>('');
  const [clinicalSummaryDraft, setClinicalSummaryDraft] = useState<string>('');
  const [clinicalRiskDraft, setClinicalRiskDraft] = useState<ClinicalRiskLevel>('low');
  const [clinicalPlanDraft, setClinicalPlanDraft] = useState<string>('');

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );
  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const visibleStudentsForSelect = useMemo(() => {
    if (isParentOrStudent) return linkedStudent ? [linkedStudent] : [];
    if (activeRole === 'teacher' && teacherAssignedClassIds.length > 0) {
      const set = new Set(teacherAssignedClassIds);
      return students.filter((s) => set.has(s.classId));
    }
    return students;
  }, [isParentOrStudent, linkedStudent, activeRole, teacherAssignedClassIds, students]);

  const scopedSessions = useMemo(() => {
    const base = filterCounselingSessionsForRole({
      sessions: counselingSessions,
      role: activeRole,
      userId: session?.userId || '',
      linkedStudentId: linkedStudent?.id,
      teacherAssignedClassIds,
    });
    return base
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;
        if (dateFilter.trim() && !s.jalaliDate.includes(dateFilter.trim())) return false;
        return true;
      })
      .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate));
  }, [
    counselingSessions,
    activeRole,
    session?.userId,
    linkedStudent?.id,
    teacherAssignedClassIds,
    statusFilter,
    dateFilter,
  ]);

  const dueFollowUps = useMemo(() => {
    if (!isCounselorOrSuper) return [];
    return getDueCounselingFollowUps(counselingSessions, todayJalali);
  }, [isCounselorOrSuper, counselingSessions, todayJalali]);

  const clinicalBySessionId = useMemo(
    () => new Map(counselingClinicalNotes.map((n) => [n.sessionId, n])),
    [counselingClinicalNotes]
  );

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const stId = isParentOrStudent ? linkedStudent?.id : formStudentId;
    const st = students.find((s) => s.id === stId);
    if (!st) {
      setFeedback({ type: 'err', text: 'لطفاً دانش‌آموز را انتخاب کنید.' });
      return;
    }
    const isReferral =
      activeRole === 'teacher' ||
      activeRole === 'deputy' ||
      activeRole === 'principal' ||
      activeRole === 'complex_admin';
    const nowIso = new Date().toISOString();
    const rec: CounselingSession = {
      id: '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      studentId: st.id,
      classId: st.classId,
      jalaliDate: formDate.trim() || todayJalali,
      timeHm: formTime.trim() || '10:00',
      mode: formMode,
      status: isCounselorOrSuper ? 'scheduled' : 'requested',
      requestedByRole: activeRole,
      requestedByName: session.displayName,
      isReferral,
      referredByUserId: isReferral ? session.userId : undefined,
      referralReason: formReason.trim() || undefined,
      counselorUserId: isCounselorOrSuper ? session.userId : `user-counselor-${activeSchoolId}`,
      counselorName: isCounselorOrSuper ? session.displayName : 'مشاور مدرسه',
      followUpDateJalali: isCounselorOrSuper && formFollowUp.trim() ? formFollowUp.trim() : undefined,
      shareWithParent: false,
      shareWithTeacher: false,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertCounselingSession(rec);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ثبت نوبت مشاوره.' });
      return;
    }
    setShowForm(false);
    setFormReason('');
    setFormFollowUp('');
    setFeedback({
      type: 'ok',
      text: isReferral
        ? 'ارجاع دانش‌آموز به دفتر مشاوره با موفقیت ثبت شد.'
        : isCounselorOrSuper
          ? 'جلسه مشاوره در تقویم دفتر مشاوره ثبت و زمان‌بندی شد.'
          : 'درخواست نوبت مشاوره ثبت شد و در انتظار تایید مشاور مدرسه است.',
    });
  };

  const handleUpdateSessionStatus = async (
    sess: CounselingSession,
    nextStatus: CounselingSessionStatus
  ) => {
    const res = await upsertCounselingSession({ ...sess, status: nextStatus });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در تغییر وضعیت جلسه.' });
      return;
    }
    setFeedback({ type: 'ok', text: `وضعیت جلسه به «${COUNSELING_STATUS_LABELS[nextStatus]}» تغییر یافت.` });
  };

  const openAdviceEditor = (sess: CounselingSession) => {
    setEditingAdviceSessionId(sess.id);
    setAdviceDraft(sess.sharedAdviceText ?? '');
    setShareParentDraft(sess.shareWithParent);
    setShareTeacherDraft(sess.shareWithTeacher);
    setFollowUpDraft(sess.followUpDateJalali ?? '');
  };

  const handleSaveLayer2Advice = async (sess: CounselingSession) => {
    const res = await upsertCounselingSession({
      ...sess,
      sharedAdviceText: adviceDraft.trim() || undefined,
      shareWithParent: shareParentDraft,
      shareWithTeacher: shareTeacherDraft,
      followUpDateJalali: followUpDraft.trim() || undefined,
    });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ذخیره توصیه‌های اشتراک‌گذاری‌شده.' });
      return;
    }
    setEditingAdviceSessionId(null);
    setFeedback({
      type: 'ok',
      text: 'توصیه‌های لایه ۲ و تاریخ پیگیری با موفقیت ذخیره شد.',
    });
  };

  const handleRequestOpenClinicalNote = (sess: CounselingSession) => {
    if (!clinicalAccess.allowed) return;
    const stName = studentById.get(sess.studentId)?.fullName ?? sess.studentId;
    const existing = clinicalBySessionId.get(sess.id);

    if (clinicalAccess.mode === 'principal_audit') {
      setAuditModalSessionId(sess.id);
      setAuditReasonInput('');
      return;
    }

    // Counselor or Super Admin: immediately log SHA-256 clinical view and open editor
    logCounselingClinicalViewed({ sessionId: sess.id, studentName: stName });
    setClinicalSummaryDraft(existing?.clinicalSummary ?? '');
    setClinicalRiskDraft(existing?.riskLevel ?? 'low');
    setClinicalPlanDraft(existing?.privateActionPlan ?? '');
    setOpenClinicalSessionId(sess.id);
  };

  const handleConfirmPrincipalAuditView = (sess: CounselingSession) => {
    if (auditReasonInput.trim().length < 8) {
      setFeedback({
        type: 'err',
        text: 'ثبت علت دقیق ممیزی (حداقل ۸ کاراکتر) جهت ثبت در زنجیره امنیتی SHA-256 الزامی است.',
      });
      return;
    }
    const stName = studentById.get(sess.studentId)?.fullName ?? sess.studentId;
    logCounselingClinicalViewed({
      sessionId: sess.id,
      studentName: stName,
      auditReasonFa: auditReasonInput.trim(),
    });
    setAuditModalSessionId(null);
    setOpenClinicalSessionId(sess.id);
    setFeedback({
      type: 'ok',
      text: 'دسترسی ممیزی فقط‌خواندنی در گزارش امنیتی SHA-256 ثبت شد.',
    });
  };

  const handleSaveClinicalNote = async (sess: CounselingSession) => {
    if (!session || !canEditClinical) return;
    if (!clinicalSummaryDraft.trim()) {
      setFeedback({ type: 'err', text: 'متن یادداشت بالینی نمی‌تواند خالی باشد.' });
      return;
    }
    const existing = clinicalBySessionId.get(sess.id);
    const nowIso = new Date().toISOString();
    const note: CounselingClinicalNote = {
      id: existing?.id || '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      sessionId: sess.id,
      studentId: sess.studentId,
      counselorUserId: session.userId,
      counselorName: session.displayName,
      clinicalSummary: clinicalSummaryDraft.trim(),
      riskLevel: clinicalRiskDraft,
      privateActionPlan: clinicalPlanDraft.trim() || undefined,
      lastUpdatedAtJalali: todayJalali,
      createdAtIso: existing?.createdAtIso || nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertCounselingClinicalNote(note);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ذخیره یادداشت بالینی محرمانه.' });
      return;
    }
    setFeedback({
      type: 'ok',
      text: 'یادداشت بالینی محرمانه (لایه ۱) ذخیره و عملیات در زنجیره SHA-256 ممیزی شد.',
    });
  };

  const handleTogglePrincipalAudit = async () => {
    const res = await togglePrincipalCounselingAuditAccess(
      activeSchoolId,
      !isPrincipalAuditEnabledForSchool
    );
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در تغییر سطح دسترسی ممیزی.' });
      return;
    }
    setFeedback({
      type: 'ok',
      text: !isPrincipalAuditEnabledForSchool
        ? `دسترسی ویژه ممیزی (فقط‌خواندنی) لایه محرمانه برای مدیر «${activeSchool.name}» فعال شد.`
        : `دسترسی ممیزی مدیر «${activeSchool.name}» لغو و لایه بالینی مجدداً انحصاری مشاور شد.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
              دفتر مشاوره محرمانه و نوبت‌دهی
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeSchool.name} · معماری دولایه تفکیک محرمانگی بالینی و توصیه‌های تربیتی
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          {isCounselorOrSuper
            ? 'ثبت نوبت جدید در تقویم مشاوره'
            : isParentOrStudent
              ? 'درخواست نوبت مشاوره'
              : 'ارجاع دانش‌آموز به مشاور'}
        </button>
      </div>

      {/* Confidentiality Architecture Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
          <Lock className="h-4 w-4 shrink-0 text-slate-900 dark:text-sky-400" />
          <span>{clinicalAccess.reasonFa}</span>
        </div>
        <span className="font-semibold text-slate-500 dark:text-slate-400">
          تمامی مشاهدات لایه ۱ در زنجیره ضددستکاری SHA-256 ثبت می‌شود
        </span>
      </div>

      {/* Super Admin Exclusive Per-School Principal Audit Toggle */}
      {activeRole === 'super_admin' && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <div className="text-xs font-extrabold text-amber-950 dark:text-amber-200">
                حاکمیت امنیتی راهبر ارشد: دسترسی ویژه ممیزی مدیر مدرسه ({activeSchool.name})
              </div>
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                به‌صورت پیش‌فرض هیچ فردی جز مشاور مدرسه به یادداشت‌های بالینی (لایه ۱) دسترسی ندارد. در صورت نیاز نظارتی، می‌توانید دسترسی «فقط‌خواندنی با ثبت علت در لاگ SHA-256» را برای مدیر این واحد فعال یا لغو کنید.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTogglePrincipalAudit}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
              isPrincipalAuditEnabledForSchool
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500'
            }`}
          >
            {isPrincipalAuditEnabledForSchool
              ? 'لغو دسترسی ممیزی مدیر این مدرسه'
              : 'فعال‌سازی دسترسی ممیزی برای مدیر'}
          </button>
        </div>
      )}

      {/* Counselor Due Follow-ups Alert Strip */}
      {isCounselorOrSuper && dueFollowUps.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-rose-800 dark:text-rose-200">
            <BellRing className="h-4 w-4" />
            یادآور پیگیری‌های سررسیدشده و نزدیک ({toPersianDigits(dueFollowUps.length)} مورد)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dueFollowUps.map((item) => {
              const st = studentById.get(item.session.studentId);
              return (
                <div
                  key={item.session.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-rose-200/80 bg-white px-3 py-2 text-xs dark:border-rose-900/60 dark:bg-slate-900"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {st?.fullName ?? 'دانش‌آموز'}
                    </div>
                    <div className="text-[11px] text-rose-700 dark:text-rose-400">
                      {item.isOverdue
                        ? `عقب‌افتاده (${toPersianDigits(item.followUpDateJalali)})`
                        : item.isToday
                          ? `سررسید امروز (${toPersianDigits(item.followUpDateJalali)})`
                          : `نزدیک (${toPersianDigits(item.followUpDateJalali)})`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestOpenClinicalNote(item.session)}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                  >
                    باز کردن پرونده
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Request / Referral / Schedule Form */}
      {showForm && (
        <form
          onSubmit={handleCreateSession}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isCounselorOrSuper
                ? 'ثبت جلسه جدید در دفتر مشاوره'
                : isParentOrStudent
                  ? 'درخواست وقت مشاوره محرمانه'
                  : 'ارجاع دانش‌آموز به مشاور مدرسه'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              بستن
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!isParentOrStudent && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  دانش‌آموز
                </label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {visibleStudentsForSelect.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({classById.get(st.classId)?.name ?? ''})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                شیوه برگزاری
              </label>
              <select
                value={formMode}
                onChange={(e) => setFormMode(e.target.value as CounselingSessionMode)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(Object.keys(COUNSELING_MODE_LABELS) as CounselingSessionMode[]).map((m) => (
                  <option key={m} value={m}>
                    {COUNSELING_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                تاریخ پیشنهادی / جلسه
              </label>
              <input
                type="text"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                ساعت جلسه
              </label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={isCounselorOrSuper ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                موضوع درخواست یا علت ارجاع
              </label>
              <input
                type="text"
                required
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="مثلاً: برنامه‌ریزی تحصیلی، اضطراب امتحان یا هماهنگی رفتاری..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            {isCounselorOrSuper && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  تاریخ پیگیری بعدی (اختیاری)
                </label>
                <input
                  type="text"
                  value={formFollowUp}
                  onChange={(e) => setFormFollowUp(e.target.value)}
                  placeholder="1405/08/25"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              ثبت در دفتر مشاوره
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'requested', 'scheduled', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white dark:bg-sky-600'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {st === 'all' ? 'همه جلسات' : COUNSELING_STATUS_LABELS[st]}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="فیلتر تاریخ (مثلاً 1405/08)"
          dir="ltr"
          className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-center text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Sessions List */}
      {scopedSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          جلسه یا ارجاع مشاوره‌ای در این بازه ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-4">
          {scopedSessions.map((sess) => {
            const st = studentById.get(sess.studentId);
            const clsName = classById.get(sess.classId)?.name ?? '';
            const clinicalNote = clinicalAccess.allowed
              ? clinicalBySessionId.get(sess.id)
              : undefined;
            const isClinicalOpen = openClinicalSessionId === sess.id;
            const isAuditPromptOpen = auditModalSessionId === sess.id;
            const isAdviceEditing = editingAdviceSessionId === sess.id;

            return (
              <div
                key={sess.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Top Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {st?.fullName ?? 'دانش‌آموز'}
                      </span>
                      {clsName && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({clsName})
                        </span>
                      )}
                      <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
                        · {COUNSELING_STATUS_LABELS[sess.status]}
                      </span>
                      {sess.isReferral && (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          (ارجاع توسط {sess.requestedByName})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                        {toPersianDigits(sess.jalaliDate)} · ساعت {toPersianDigits(sess.timeHm)}
                      </span>
                      <span>شیوه: {COUNSELING_MODE_LABELS[sess.mode]}</span>
                      {sess.counselorName && <span>مشاور: {sess.counselorName}</span>}
                      {sess.followUpDateJalali && isCounselorOrSuper && (
                        <span className="font-semibold text-rose-700 dark:text-rose-400">
                          پیگیری بعدی: {toPersianDigits(sess.followUpDateJalali)}
                        </span>
                      )}
                    </div>

                    {sess.referralReason && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          موضوع / علت:{' '}
                        </span>
                        {sess.referralReason}
                      </p>
                    )}
                  </div>

                  {/* Counselor Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isCounselorOrSuper && sess.status === 'requested' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateSessionStatus(sess, 'scheduled')}
                        className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        تایید و زمان‌بندی
                      </button>
                    )}
                    {isCounselorOrSuper && sess.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateSessionStatus(sess, 'completed')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        ثبت برگزاری جلسه
                      </button>
                    )}
                    {isCounselorOrSuper && (
                      <button
                        type="button"
                        onClick={() => openAdviceEditor(sess)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        توصیه لایه ۲ و پیگیری
                      </button>
                    )}
                    {clinicalAccess.allowed && (
                      <button
                        type="button"
                        onClick={() =>
                          isClinicalOpen
                            ? setOpenClinicalSessionId(null)
                            : handleRequestOpenClinicalNote(sess)
                        }
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                      >
                        {isClinicalOpen ? (
                          <>بستن لایه محرمانه</>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            {clinicalAccess.mode === 'principal_audit'
                              ? 'مشاهده ممیزی لایه ۱'
                              : 'یادداشت بالینی محرمانه (لایه ۱)'}
                          </>
                        )}
                      </button>
                    )}
                    {isCounselorOrSuper && (
                      <button
                        type="button"
                        onClick={() => {
                          void softDeleteCounselingSession(sess.id).then((res) => {
                            if (res.ok) {
                              setFeedback({
                                type: 'ok',
                                text: 'نوبت مشاوره به سطل بازیابی امن منتقل شد.',
                              });
                            }
                          });
                        }}
                        title="انتقال به سطل بازیابی"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* LAYER 2: SHARED NON-CONFIDENTIAL RECOMMENDATIONS */}
                {sess.canSeeSharedAdvice && sess.sharedAdviceText && !isAdviceEditing && (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        توصیه‌های تربیتی و آموزشی مشاور (لایه ۲ اشتراک‌گذاری‌شده)
                      </span>
                      {isCounselorOrSuper && (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          اشتراک با: {sess.shareWithParent ? 'ولی ' : ''}
                          {sess.shareWithParent && sess.shareWithTeacher ? 'و ' : ''}
                          {sess.shareWithTeacher ? 'معلم/کادر' : ''}
                          {!sess.shareWithParent && !sess.shareWithTeacher ? 'هنوز اشتراک‌گذاری نشده' : ''}
                        </span>
                      )}
                    </div>
                    <p className="leading-6 text-slate-700 dark:text-slate-200">
                      {sess.sharedAdviceText}
                    </p>
                  </div>
                )}

                {/* LAYER 2 EDITOR (COUNSELOR / SUPER ADMIN ONLY) */}
                {isAdviceEditing && isCounselorOrSuper && (
                  <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      تنظیم توصیه‌های غیرمحرمانه (لایه ۲) و تاریخ پیگیری
                    </div>
                    <textarea
                      rows={3}
                      value={adviceDraft}
                      onChange={(e) => setAdviceDraft(e.target.value)}
                      placeholder="توصیه‌های کاربردی غیرمحرمانه برای همراهی ولی یا معلم در کلاس..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={shareParentDraft}
                            onChange={(e) => setShareParentDraft(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                          />
                          نمایش برای ولی و دانش‌آموز
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={shareTeacherDraft}
                            onChange={(e) => setShareTeacherDraft(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                          />
                          نمایش برای معلم و کادر اجرایی
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 dark:text-slate-300">پیگیری بعدی:</span>
                          <input
                            type="text"
                            value={followUpDraft}
                            onChange={(e) => setFollowUpDraft(e.target.value)}
                            placeholder="1405/08/28"
                            dir="ltr"
                            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingAdviceSessionId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 dark:text-slate-300"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveLayer2Advice(sess)}
                          className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-sky-600"
                        >
                          ذخیره لایه ۲
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PRINCIPAL MANDATORY AUDIT REASON PROMPT */}
                {isAuditPromptOpen && clinicalAccess.mode === 'principal_audit' && (
                  <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950 dark:text-amber-200">
                      <Eye className="h-4 w-4" />
                      احراز علت مشاهده ممیزی (فقط‌خواندنی) لایه محرمانه
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      نام شما، زمان دقیق و علت اعلام‌شده به‌صورت غیرقابل‌تغییر در زنجیره ممیزی امنیتی SHA-256 ثبت خواهد شد.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={auditReasonInput}
                        onChange={(e) => setAuditReasonInput(e.target.value)}
                        placeholder="علت رسمی بررسی پرونده بالینی (حداقل ۸ کاراکتر)..."
                        className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmPrincipalAuditView(sess)}
                        className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
                      >
                        تایید و مشاهده ممیزی‌شده
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditModalSessionId(null)}
                        className="rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                )}

                {/* LAYER 1: STRICTLY CONFIDENTIAL CLINICAL NOTES PANEL */}
                {isClinicalOpen && clinicalAccess.allowed && (
                  <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-950 dark:text-indigo-200">
                        <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        لایه ۱ — یادداشت بالینی کاملاً محرمانه
                        {!canEditClinical && (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            (حالت ممیزی فقط‌خواندنی)
                          </span>
                        )}
                      </div>
                      {clinicalNote && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          آخرین بروزرسانی: {toPersianDigits(clinicalNote.lastUpdatedAtJalali)} ·{' '}
                          {clinicalNote.counselorName}
                        </span>
                      )}
                    </div>

                    {canEditClinical ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                              شرح ارزیابی و یادداشت بالینی محرمانه
                            </label>
                            <textarea
                              rows={4}
                              value={clinicalSummaryDraft}
                              onChange={(e) => setClinicalSummaryDraft(e.target.value)}
                              placeholder="یادداشت تخصصی محرمانه جلسه مشاوره (صرفاً قابل رویت برای مشاور مدرسه)..."
                              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                                سطح ریسک / حساسیت
                              </label>
                              <select
                                value={clinicalRiskDraft}
                                onChange={(e) =>
                                  setClinicalRiskDraft(e.target.value as ClinicalRiskLevel)
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              >
                                {(Object.keys(RISK_LABELS_FA) as ClinicalRiskLevel[]).map((rl) => (
                                  <option key={rl} value={rl}>
                                    {RISK_LABELS_FA[rl]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                                برنامه اقدام خصوصی مشاور
                              </label>
                              <textarea
                                rows={2}
                                value={clinicalPlanDraft}
                                onChange={(e) => setClinicalPlanDraft(e.target.value)}
                                placeholder="گام بعدی پیگیری تخصصی..."
                                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveClinicalNote(sess)}
                            className="rounded-xl bg-indigo-700 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-800"
                          >
                            ذخیره امن یادداشت بالینی (ثبت در لاگ SHA-256)
                          </button>
                        </div>
                      </div>
                    ) : clinicalNote ? (
                      <div className="space-y-2 text-xs text-slate-800 dark:text-slate-200">
                        <div>
                          <span className="font-bold">سطح حساسیت: </span>
                          {RISK_LABELS_FA[clinicalNote.riskLevel]}
                        </div>
                        <p className="rounded-lg bg-white p-3 leading-6 dark:bg-slate-900">
                          {clinicalNote.clinicalSummary}
                        </p>
                        {clinicalNote.privateActionPlan && (
                          <p className="text-slate-600 dark:text-slate-300">
                            <strong>برنامه اقدام: </strong>
                            {clinicalNote.privateActionPlan}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        هنوز یادداشت بالینی برای این جلسه ثبت نشده است.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
