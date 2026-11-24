// Phase 9-C: Hourly/Daily Leave (Staff) & Official Student Exit Pass Module
import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import {
  buildExitPassA5PrintHtml,
  buildStaffLeaveA5PrintHtml,
  computeDurationHoursFromRange,
  computeStaffLeaveSummary,
  EXIT_REASON_LABELS,
  EXIT_STATUS_LABELS,
  generateExitTrackingCode,
  PICKUP_RELATIONS_FA,
} from '../../services/phase9c/leaveExitService';
import type {
  StaffLeaveRequest,
  StaffLeaveType,
  StudentExitPass,
  StudentExitReason,
} from '../../types/domain';

type LeaveExitTab = 'student_exit' | 'staff_leave';

export const LeaveExitPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    linkedStudent,
    linkedTeacher,
    defaultWorkdayJalali,
    classes,
    students,
    teachers,
    studentExitPasses,
    staffLeaveRequests,
    upsertStudentExitPass,
    softDeleteStudentExitPass,
    updateStudentExitStatus,
    upsertStaffLeaveRequest,
    softDeleteStaffLeaveRequest,
    reviewStaffLeaveRequest,
  } = useSchoolData();

  const isParent = activeRole === 'parent';
  const isAdminOrDeputy =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal' ||
    activeRole === 'deputy';
  const canReviewStaffLeave =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal';
  const canSeeStudentExitTab = isAdminOrDeputy || isParent;
  const canSeeStaffLeaveTab = !isParent;

  const [activeTab, setActiveTab] = useState<LeaveExitTab>(
    canSeeStudentExitTab ? 'student_exit' : 'staff_leave'
  );
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // --- Student Exit Pass Form State ---
  const [showExitForm, setShowExitForm] = useState(false);
  const [exitStudentId, setExitStudentId] = useState<string>(
    linkedStudent?.id || students[0]?.id || ''
  );
  const [exitDate, setExitDate] = useState<string>(defaultWorkdayJalali || getTodayJalali());
  const [exitReasonCat, setExitReasonCat] = useState<StudentExitReason>('medical');
  const [exitReasonDetail, setExitReasonDetail] = useState<string>('');
  const [exitPlannedTime, setExitPlannedTime] = useState<string>('10:30');
  const [exitReturnTime, setExitReturnTime] = useState<string>('');
  const [pickupName, setPickupName] = useState<string>(
    isParent ? session?.displayName || linkedStudent?.parentName || '' : ''
  );
  const [pickupRelation, setPickupRelation] =
    useState<StudentExitPass['pickupRelation']>('پدر');
  const [pickupNationalId, setPickupNationalId] = useState<string>('');
  const [parentVerified, setParentVerified] = useState<boolean>(true);
  const [exitStatusFilter, setExitStatusFilter] = useState<'all' | StudentExitPass['status']>(
    'all'
  );

  // --- Staff Leave Form State ---
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<StaffLeaveType>('hourly');
  const [leaveDate, setLeaveDate] = useState<string>(defaultWorkdayJalali || getTodayJalali());
  const [leaveStartHm, setLeaveStartHm] = useState<string>('10:00');
  const [leaveEndHm, setLeaveEndHm] = useState<string>('12:00');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [leaveSubTeacherId, setLeaveSubTeacherId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );
  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const scopedExitPasses = useMemo(() => {
    const base = isParent
      ? studentExitPasses.filter((p) => p.studentId === linkedStudent?.id)
      : studentExitPasses;
    return base
      .filter((p) => exitStatusFilter === 'all' || p.status === exitStatusFilter)
      .sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? ''));
  }, [studentExitPasses, isParent, linkedStudent?.id, exitStatusFilter]);

  const scopedStaffLeaves = useMemo(() => {
    const base = canReviewStaffLeave
      ? staffLeaveRequests
      : staffLeaveRequests.filter((r) => r.staffUserId === session?.userId);
    return [...base].sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? ''));
  }, [staffLeaveRequests, canReviewStaffLeave, session?.userId]);

  const myLeaveSummary = useMemo(() => {
    if (!session) return null;
    return computeStaffLeaveSummary(
      staffLeaveRequests,
      session.userId,
      activeSchool.academicYear
    );
  }, [staffLeaveRequests, session, activeSchool.academicYear]);

  const allStaffSummaries = useMemo(() => {
    if (!canReviewStaffLeave) return [];
    const uniqueStaff = new Map<string, { userId: string; name: string }>();
    for (const r of staffLeaveRequests) {
      if (!uniqueStaff.has(r.staffUserId)) {
        uniqueStaff.set(r.staffUserId, { userId: r.staffUserId, name: r.staffName });
      }
    }
    return Array.from(uniqueStaff.values()).map((st) => ({
      ...st,
      summary: computeStaffLeaveSummary(
        staffLeaveRequests,
        st.userId,
        activeSchool.academicYear
      ),
    }));
  }, [canReviewStaffLeave, staffLeaveRequests, activeSchool.academicYear]);

  const computedHourlyDuration = useMemo(
    () => computeDurationHoursFromRange(leaveStartHm, leaveEndHm),
    [leaveStartHm, leaveEndHm]
  );

  const handleSubmitExitPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const targetStudentId = isParent ? linkedStudent?.id : exitStudentId;
    const targetStudent = students.find((s) => s.id === targetStudentId);
    if (!targetStudent) {
      setFeedback({ type: 'err', text: 'لطفاً دانش‌آموز مورد نظر را انتخاب کنید.' });
      return;
    }
    const finalPickupName = pickupName.trim() || targetStudent.parentName;
    if (!finalPickupName) {
      setFeedback({ type: 'err', text: 'لطفاً نام فرد تحویل‌گیرنده را وارد کنید.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const pass: StudentExitPass = {
      id: '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      trackingCode: generateExitTrackingCode(exitDate || getTodayJalali()),
      studentId: targetStudent.id,
      classId: targetStudent.classId,
      jalaliDate: exitDate.trim() || getTodayJalali(),
      reasonCategory: exitReasonCat,
      reasonDetail: exitReasonDetail.trim() || undefined,
      plannedExitTimeHm: exitPlannedTime.trim() || '10:30',
      expectedReturnTimeHm: exitReturnTime.trim() || undefined,
      pickupPersonName: finalPickupName,
      pickupRelation,
      pickupNationalId: pickupNationalId.trim() || undefined,
      parentVerified: isParent ? true : parentVerified,
      requestedByRole: activeRole,
      requestedByName: session.displayName,
      approvedByName: isAdminOrDeputy ? session.displayName : undefined,
      status: isAdminOrDeputy ? 'approved' : 'requested',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertStudentExitPass(pass);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ثبت مجوز خروج.' });
      return;
    }
    setShowExitForm(false);
    setExitReasonDetail('');
    setPickupNationalId('');
    setFeedback({
      type: 'ok',
      text: isParent
        ? 'درخواست خروج دانش‌آموز ثبت شد و جهت تایید مدیریت مدرسه ارسال گردید.'
        : 'برگه خروج رسمی صادر شد و آماده تحویل و چاپ A5 برای نگهبانی است.',
    });
  };

  const handleExitTransition = async (
    passId: string,
    nextStatus: StudentExitPass['status']
  ) => {
    setFeedback(null);
    const res = await updateStudentExitStatus(passId, nextStatus);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در تغییر وضعیت برگه خروج.' });
      return;
    }
    const msgMap: Record<StudentExitPass['status'], string> = {
      requested: 'درخواست در حالت انتظار قرار گرفت.',
      approved: 'درخواست خروج تایید شد و برگه A5 آماده چاپ است.',
      exited: 'خروج نهایی دانش‌آموز با ساعت دقیق در زنجیره امنیتی SHA-256 ثبت شد.',
      returned: 'بازگشت دانش‌آموز به مدرسه با ساعت دقیق ثبت شد.',
      rejected: 'درخواست خروج رد شد.',
    };
    setFeedback({ type: 'ok', text: msgMap[nextStatus] });
  };

  const handleSubmitStaffLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!leaveReason.trim()) {
      setFeedback({ type: 'err', text: 'لطفاً علت درخواست مرخصی را بنویسید.' });
      return;
    }
    if (leaveType === 'hourly' && computedHourlyDuration <= 0) {
      setFeedback({ type: 'err', text: 'ساعت پایان مرخصی ساعتی باید پس از ساعت شروع باشد.' });
      return;
    }
    const subTeacher = teachers.find((t) => t.id === leaveSubTeacherId);
    const nowIso = new Date().toISOString();
    const req: StaffLeaveRequest = {
      id: '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      staffUserId: session.userId,
      staffName: session.displayName,
      staffRole: activeRole,
      linkedTeacherId: linkedTeacher?.id,
      leaveType,
      jalaliDate: leaveDate.trim() || getTodayJalali(),
      startTimeHm: leaveType === 'hourly' ? leaveStartHm : undefined,
      endTimeHm: leaveType === 'hourly' ? leaveEndHm : undefined,
      durationHours: leaveType === 'hourly' ? computedHourlyDuration : undefined,
      reason: leaveReason.trim(),
      suggestedSubstituteTeacherId: subTeacher?.id,
      suggestedSubstituteTeacherName: subTeacher?.fullName,
      status: 'pending',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertStaffLeaveRequest(req);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ثبت درخواست مرخصی.' });
      return;
    }
    setShowLeaveForm(false);
    setLeaveReason('');
    setLeaveSubTeacherId('');
    setFeedback({
      type: 'ok',
      text: 'درخواست مرخصی ثبت شد و در کارتابل بررسی مدیر مدرسه قرار گرفت.',
    });
  };

  const handleReviewLeave = async (reqId: string, decision: 'approved' | 'rejected') => {
    setFeedback(null);
    const res = await reviewStaffLeaveRequest(reqId, decision, reviewNotes[reqId]?.trim());
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در بررسی درخواست مرخصی.' });
      return;
    }
    setFeedback({
      type: 'ok',
      text:
        decision === 'approved'
          ? 'درخواست مرخصی تایید شد و شمارنده سالانه همکار به‌روزرسانی گردید.'
          : 'درخواست مرخصی رد شد.',
    });
  };

  const pendingExitCount = studentExitPasses.filter((p) => p.status === 'requested').length;
  const pendingLeaveCount = staffLeaveRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <DoorOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
              مرخصی کادر و برگه خروج رسمی دانش‌آموز
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeSchool.name} · سال تحصیلی {toPersianDigits(activeSchool.academicYear)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'student_exit' && canSeeStudentExitTab && (
            <button
              type="button"
              onClick={() => setShowExitForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              {isParent ? 'ثبت درخواست خروج فرزند' : 'صدور برگه خروج دانش‌آموز'}
            </button>
          )}
          {activeTab === 'staff_leave' && canSeeStaffLeaveTab && (
            <button
              type="button"
              onClick={() => setShowLeaveForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              ثبت درخواست مرخصی جدید
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

      {/* Main Module Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {canSeeStudentExitTab && (
          <button
            type="button"
            onClick={() => setActiveTab('student_exit')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'student_exit'
                ? 'border-slate-900 text-slate-900 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <LogOut className="h-4 w-4" />
            برگه خروج دانش‌آموز (نگهبانی)
            {isAdminOrDeputy && pendingExitCount > 0 && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 tabular-nums dark:bg-amber-950 dark:text-amber-300">
                {toPersianDigits(pendingExitCount)}
              </span>
            )}
          </button>
        )}

        {canSeeStaffLeaveTab && (
          <button
            type="button"
            onClick={() => setActiveTab('staff_leave')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'staff_leave'
                ? 'border-slate-900 text-slate-900 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            مرخصی ساعتی و روزانه کادر
            {canReviewStaffLeave && pendingLeaveCount > 0 && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 tabular-nums dark:bg-amber-950 dark:text-amber-300">
                {toPersianDigits(pendingLeaveCount)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: STUDENT EXIT PASSES                                          */}
      {/* =================================================================== */}
      {activeTab === 'student_exit' && canSeeStudentExitTab && (
        <div className="space-y-4">
          {showExitForm && (
            <form
              onSubmit={handleSubmitExitPass}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isParent
                    ? `درخواست مجوز خروج برای ${linkedStudent?.fullName ?? ''}`
                    : 'صدور برگه خروج رسمی دانش‌آموز'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExitForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  بستن
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {!isParent && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      دانش‌آموز
                    </label>
                    <select
                      value={exitStudentId}
                      onChange={(e) => {
                        setExitStudentId(e.target.value);
                        const st = studentById.get(e.target.value);
                        if (st && !pickupName) setPickupName(st.parentName);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.fullName} ({classById.get(st.classId)?.name ?? ''})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    علت خروج
                  </label>
                  <select
                    value={exitReasonCat}
                    onChange={(e) => setExitReasonCat(e.target.value as StudentExitReason)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {(Object.keys(EXIT_REASON_LABELS) as StudentExitReason[]).map((k) => (
                      <option key={k} value={k}>
                        {EXIT_REASON_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    تاریخ شمسی
                  </label>
                  <input
                    type="text"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      ساعت خروج
                    </label>
                    <input
                      type="time"
                      value={exitPlannedTime}
                      onChange={(e) => setExitPlannedTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      بازگشت احتمالی
                    </label>
                    <input
                      type="time"
                      value={exitReturnTime}
                      onChange={(e) => setExitReturnTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    نام فرد تحویل‌گیرنده
                  </label>
                  <input
                    type="text"
                    required
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                    placeholder="نام و نام خانوادگی تحویل‌گیرنده"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    نسبت تحویل‌گیرنده
                  </label>
                  <select
                    value={pickupRelation}
                    onChange={(e) =>
                      setPickupRelation(e.target.value as StudentExitPass['pickupRelation'])
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {PICKUP_RELATIONS_FA.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    کد ملی تحویل‌گیرنده (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={pickupNationalId}
                    onChange={(e) => setPickupNationalId(e.target.value)}
                    dir="ltr"
                    placeholder="0012345678"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  توضیحات تکمیلی علت خروج
                </label>
                <input
                  type="text"
                  value={exitReasonDetail}
                  onChange={(e) => setExitReasonDetail(e.target.value)}
                  placeholder="مثلاً: نوبت پزشک متخصص یا پیگیری اداری..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {!isParent ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={parentVerified}
                      onChange={(e) => setParentVerified(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    هماهنگی و احراز هویت ولی انجام شده است
                  </label>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    درخواست پس از تایید مدیر/معاون به صورت رسمی صادر خواهد شد.
                  </span>
                )}

                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  {isParent ? 'ارسال درخواست خروج' : 'صدور رسمی برگه خروج'}
                </button>
              </div>
            </form>
          )}

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'requested', 'approved', 'exited', 'returned', 'rejected'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setExitStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    exitStatusFilter === st
                      ? 'bg-slate-900 text-white dark:bg-sky-600'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {st === 'all' ? 'همه برگه‌ها' : EXIT_STATUS_LABELS[st]}
                </button>
              )
            )}
          </div>

          {/* Exit Passes List */}
          {scopedExitPasses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              هیچ برگه خروجی در این فیلتر ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-3">
              {scopedExitPasses.map((pass) => {
                const st = studentById.get(pass.studentId);
                const clsName = classById.get(pass.classId)?.name ?? 'کلاس نامشخص';
                const printHtml = buildExitPassA5PrintHtml({
                  pass,
                  studentName: st?.fullName ?? pass.studentId,
                  studentNationalId: st?.nationalId ?? '—',
                  className: clsName,
                  school: activeSchool,
                });

                const statusTone =
                  pass.status === 'exited'
                    ? 'text-sky-700 dark:text-sky-400'
                    : pass.status === 'returned'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : pass.status === 'approved'
                        ? 'text-indigo-700 dark:text-indigo-400'
                        : pass.status === 'rejected'
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400';

                return (
                  <div
                    key={pass.id}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                            {st?.fullName ?? 'دانش‌آموز'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({clsName})
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 tabular-nums dark:bg-slate-800 dark:text-slate-200">
                            {toPersianDigits(pass.trackingCode)}
                          </span>
                          <span className={`text-xs font-bold ${statusTone}`}>
                            · {EXIT_STATUS_LABELS[pass.status]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <span>تاریخ: {toPersianDigits(pass.jalaliDate)}</span>
                          <span>
                            ساعت خروج: {toPersianDigits(pass.plannedExitTimeHm)}
                            {pass.expectedReturnTimeHm
                              ? ` (بازگشت: ${toPersianDigits(pass.expectedReturnTimeHm)})`
                              : ''}
                          </span>
                          <span>علت: {EXIT_REASON_LABELS[pass.reasonCategory]}</span>
                          <span>
                            تحویل‌گیرنده: <strong>{pass.pickupPersonName}</strong> (
                            {pass.pickupRelation})
                          </span>
                          {pass.parentVerified && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <ShieldCheck className="h-3.5 w-3.5" /> تایید ولی
                            </span>
                          )}
                        </div>

                        {pass.reasonDetail && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            توضیح: {pass.reasonDetail}
                          </p>
                        )}

                        {(pass.actualExitTimeHm || pass.actualReturnTimeHm) && (
                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-sky-700 tabular-nums dark:text-sky-400">
                            {pass.actualExitTimeHm && (
                              <span>
                                ساعت دقیق خروج نهایی: {toPersianDigits(pass.actualExitTimeHm)}
                              </span>
                            )}
                            {pass.actualReturnTimeHm && (
                              <span>
                                ساعت بازگشت به مدرسه: {toPersianDigits(pass.actualReturnTimeHm)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {pass.status !== 'rejected' && (
                          <PrintIconButton
                            compact
                            documentLabel={`برگه خروج A5 (${st?.fullName ?? ''})`}
                            html={printHtml}
                          />
                        )}

                        {isAdminOrDeputy && pass.status === 'requested' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleExitTransition(pass.id, 'approved')}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              تایید و صدور
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExitTransition(pass.id, 'rejected')}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              رد درخواست
                            </button>
                          </>
                        )}

                        {isAdminOrDeputy && pass.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleExitTransition(pass.id, 'exited')}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            ثبت خروج نهایی انجام شد
                          </button>
                        )}

                        {isAdminOrDeputy && pass.status === 'exited' && (
                          <button
                            type="button"
                            onClick={() => handleExitTransition(pass.id, 'returned')}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            ثبت بازگشت به مدرسه
                          </button>
                        )}

                        {isAdminOrDeputy && (
                          <button
                            type="button"
                            onClick={() => {
                              void softDeleteStudentExitPass(pass.id).then((res) => {
                                if (res.ok) {
                                  setFeedback({
                                    type: 'ok',
                                    text: 'برگه خروج به سطل بازیابی امن منتقل شد.',
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: STAFF HOURLY / DAILY LEAVE                                   */}
      {/* =================================================================== */}
      {activeTab === 'staff_leave' && canSeeStaffLeaveTab && (
        <div className="space-y-4">
          {/* Cumulative Counter Strip */}
          {myLeaveSummary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  مرخصی روزانه تاییدشده من (امسال)
                </div>
                <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                  {toPersianDigits(myLeaveSummary.approvedDailyDays)} روز
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  مرخصی ساعتی تاییدشده من (امسال)
                </div>
                <div className="mt-1 text-xl font-black text-sky-700 dark:text-sky-400">
                  {toPersianDigits(myLeaveSummary.approvedHourlyHours)} ساعت
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">در انتظار بررسی</div>
                <div className="mt-1 text-xl font-black text-amber-700 dark:text-amber-400">
                  {toPersianDigits(
                    canReviewStaffLeave ? pendingLeaveCount : myLeaveSummary.pendingCount
                  )}{' '}
                  مورد
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">کل درخواست‌های ثبت‌شده</div>
                <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                  {toPersianDigits(scopedStaffLeaves.length)} مورد
                </div>
              </div>
            </div>
          )}

          {/* New Staff Leave Form */}
          {showLeaveForm && (
            <form
              onSubmit={handleSubmitStaffLeave}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ثبت درخواست مرخصی ({session?.displayName})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  بستن
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    نوع مرخصی
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLeaveType('hourly')}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        leaveType === 'hourly'
                          ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      ساعتی
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveType('daily')}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        leaveType === 'daily'
                          ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      روزانه
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    تاریخ شمسی
                  </label>
                  <input
                    type="text"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {leaveType === 'hourly' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        از ساعت
                      </label>
                      <input
                        type="time"
                        value={leaveStartHm}
                        onChange={(e) => setLeaveStartHm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        تا ساعت ({toPersianDigits(computedHourlyDuration)} س)
                      </label>
                      <input
                        type="time"
                        value={leaveEndHm}
                        onChange={(e) => setLeaveEndHm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    پیشنهاد همکار جایگزین (اختیاری)
                  </label>
                  <select
                    value={leaveSubTeacherId}
                    onChange={(e) => setLeaveSubTeacherId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">انتخاب نشده</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  علت درخواست مرخصی
                </label>
                <input
                  type="text"
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="شرح مختصر علت مرخصی..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  ارسال درخواست به کارتابل مدیریت
                </button>
              </div>
            </form>
          )}

          {/* Staff Leave Requests List */}
          {scopedStaffLeaves.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              درخواست مرخصی ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-3">
              {scopedStaffLeaves.map((req) => {
                const staffSum = computeStaffLeaveSummary(
                  staffLeaveRequests,
                  req.staffUserId,
                  activeSchool.academicYear
                );
                const printHtml = buildStaffLeaveA5PrintHtml({
                  request: req,
                  summary: staffSum,
                  school: activeSchool,
                });

                return (
                  <div
                    key={req.id}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                            {req.staffName}
                          </span>
                          <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                            {req.leaveType === 'hourly'
                              ? `مرخصی ساعتی (${toPersianDigits(req.startTimeHm ?? '')} تا ${toPersianDigits(req.endTimeHm ?? '')} · ${toPersianDigits(req.durationHours ?? 0)} ساعت)`
                              : 'مرخصی روزانه (۱ روز کاری)'}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              req.status === 'approved'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : req.status === 'rejected'
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            ·{' '}
                            {req.status === 'approved'
                              ? 'تایید شد'
                              : req.status === 'rejected'
                                ? 'رد شد'
                                : 'در انتظار بررسی مدیر'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300">{req.reason}</p>

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> تاریخ: {toPersianDigits(req.jalaliDate)}
                          </span>
                          {req.suggestedSubstituteTeacherName && (
                            <span>همکار جایگزین پیشنهادی: {req.suggestedSubstituteTeacherName}</span>
                          )}
                          <span className="tabular-nums">
                            مجموع سالانه تاییدشده: {toPersianDigits(staffSum.approvedDailyDays)} روز و{' '}
                            {toPersianDigits(staffSum.approvedHourlyHours)} ساعت
                          </span>
                        </div>

                        {req.principalReviewNote && (
                          <div className="text-xs text-slate-700 dark:text-slate-200">
                            <span className="font-bold">یادداشت مدیر ({req.reviewedByName}): </span>
                            {req.principalReviewNote}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <PrintIconButton
                          compact
                          documentLabel={`برگ مرخصی A5 (${req.staffName})`}
                          html={printHtml}
                        />
                        {canReviewStaffLeave && (
                          <button
                            type="button"
                            onClick={() => {
                              void softDeleteStaffLeaveRequest(req.id).then((res) => {
                                if (res.ok) {
                                  setFeedback({
                                    type: 'ok',
                                    text: 'درخواست مرخصی به سطل بازیابی امن منتقل شد.',
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

                    {canReviewStaffLeave && req.status === 'pending' && (
                      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center dark:border-slate-800">
                        <input
                          type="text"
                          value={reviewNotes[req.id] ?? ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="یادداشت مدیر مدرسه (اختیاری)..."
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleReviewLeave(req.id, 'approved')}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          تایید مرخصی
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewLeave(req.id, 'rejected')}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رد درخواست
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Principal Cumulative Staff Leave Summary Table */}
          {canReviewStaffLeave && allStaffSummaries.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                کارنامه تجمعی مرخصی کادر در سال تحصیلی {toPersianDigits(activeSchool.academicYear)}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2 pl-3 font-semibold">نام همکار</th>
                      <th className="py-2 px-3 font-semibold">روزانه تاییدشده</th>
                      <th className="py-2 px-3 font-semibold">ساعتی تاییدشده</th>
                      <th className="py-2 px-3 font-semibold">در انتظار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800/70">
                    {allStaffSummaries.map((row) => (
                      <tr key={row.userId}>
                        <td className="py-2.5 pl-3 font-bold text-slate-900 dark:text-slate-100">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                          {toPersianDigits(row.summary.approvedDailyDays)} روز
                        </td>
                        <td className="py-2.5 px-3 text-sky-700 dark:text-sky-400">
                          {toPersianDigits(row.summary.approvedHourlyHours)} ساعت
                        </td>
                        <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400">
                          {toPersianDigits(row.summary.pendingCount)} مورد
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
