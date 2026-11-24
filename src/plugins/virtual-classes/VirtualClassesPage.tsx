// Phase 9-C: Virtual Class Hub (Live Status Engine, Click-to-Join Attendance & Subject Archive Sync)
import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Film,
  Plus,
  Radio,
  Trash2,
  Users,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import {
  buildVirtualAttendancePrintHtml,
  computeVirtualClassLiveStatus,
  validateVirtualClassUrl,
  VIRTUAL_CLASS_PLATFORMS,
  VIRTUAL_STATUS_LABELS,
  type VirtualClassLiveStatus,
} from '../../services/phase9c/virtualClassService';
import type { VirtualClassPlatform, VirtualClassSession } from '../../types/domain';

const STATUS_SORT_ORDER: Record<VirtualClassLiveStatus, number> = {
  live: 0,
  soon: 1,
  scheduled: 2,
  ended: 3,
};

const DEFAULT_SUBJECTS = [
  'ریاضی',
  'علوم تجربی',
  'فارسی و نگارش',
  'زبان انگلیسی',
  'مطالعات اجتماعی',
  'قرآن و پیام‌های آسمانی',
  'فیزیک',
  'شیمی',
];

export const VirtualClassesPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    linkedStudent,
    linkedTeacher,
    teacherAssignedClassIds,
    defaultWorkdayJalali,
    classes,
    students,
    schedules,
    virtualClassSessions,
    virtualClassAttendance,
    upsertVirtualClassSession,
    softDeleteVirtualClassSession,
    recordVirtualClassJoinAttendance,
  } = useSchoolData();

  const { navigate } = useRouter();

  const isAdminOrDeputy =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal' ||
    activeRole === 'deputy';
  const canScheduleOrArchive = isAdminOrDeputy || activeRole === 'teacher';
  const isParentOrStudent = activeRole === 'parent' || activeRole === 'student';

  // Live clock tick every 30s so status transitions automatically
  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | VirtualClassLiveStatus>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  // Schedule Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState<string>(classes[0]?.id || '');
  const [subject, setSubject] = useState<string>('ریاضی');
  const [platform, setPlatform] = useState<VirtualClassPlatform>('skyroom');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [jalaliDate, setJalaliDate] = useState<string>(defaultWorkdayJalali || getTodayJalali());
  const [startTimeHm, setStartTimeHm] = useState<string>('10:00');
  const [durationMinutes, setDurationMinutes] = useState<string>('45');
  const [description, setDescription] = useState<string>('');

  // Attendee drawer & Archive drawer state (per sessionId)
  const [openAttendanceId, setOpenAttendanceId] = useState<string | null>(null);
  const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
  const [recUrlDraft, setRecUrlDraft] = useState<string>('');
  const [recTitleDraft, setRecTitleDraft] = useState<string>('');
  const [handoutUrlDraft, setHandoutUrlDraft] = useState<string>('');
  const [handoutTitleDraft, setHandoutTitleDraft] = useState<string>('');

  const availableClasses = useMemo(() => {
    if (activeRole === 'teacher' && teacherAssignedClassIds.length > 0) {
      const set = new Set(teacherAssignedClassIds);
      return classes.filter((c) => set.has(c.id));
    }
    return classes;
  }, [activeRole, classes, teacherAssignedClassIds]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>(DEFAULT_SUBJECTS);
    for (const sch of schedules) {
      if (sch.subjectName?.trim()) set.add(sch.subjectName.trim());
    }
    return Array.from(set);
  }, [schedules]);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const enrichedSessions = useMemo(() => {
    const teacherSet = new Set(teacherAssignedClassIds);
    const scoped = virtualClassSessions.filter((vc) => {
      if (isParentOrStudent) {
        return linkedStudent ? vc.classId === linkedStudent.classId : false;
      }
      if (activeRole === 'teacher' && teacherSet.size > 0) {
        return teacherSet.has(vc.classId) || vc.teacherId === linkedTeacher?.id;
      }
      return true;
    });

    return scoped
      .map((vc) => ({
        session: vc,
        liveStatus: computeVirtualClassLiveStatus(vc, nowTick),
      }))
      .sort((a, b) => {
        const orderDiff = STATUS_SORT_ORDER[a.liveStatus] - STATUS_SORT_ORDER[b.liveStatus];
        if (orderDiff !== 0) return orderDiff;
        const dateCmp = b.session.jalaliDate.localeCompare(a.session.jalaliDate);
        if (dateCmp !== 0) return dateCmp;
        return a.session.startTimeHm.localeCompare(b.session.startTimeHm);
      });
  }, [
    virtualClassSessions,
    isParentOrStudent,
    linkedStudent,
    activeRole,
    teacherAssignedClassIds,
    linkedTeacher?.id,
    nowTick,
  ]);

  const filteredSessions = useMemo(
    () =>
      enrichedSessions.filter((item) => {
        if (statusFilter !== 'all' && item.liveStatus !== statusFilter) return false;
        if (classFilter !== 'all' && item.session.classId !== classFilter) return false;
        return true;
      }),
    [enrichedSessions, statusFilter, classFilter]
  );

  const attendanceBySessionId = useMemo(() => {
    const map = new Map<string, typeof virtualClassAttendance>();
    for (const att of virtualClassAttendance) {
      const list = map.get(att.sessionId) ?? [];
      list.push(att);
      map.set(att.sessionId, list);
    }
    return map;
  }, [virtualClassAttendance]);

  const kpis = useMemo(() => {
    let liveCount = 0;
    let soonCount = 0;
    let archivedCount = 0;
    for (const item of enrichedSessions) {
      if (item.liveStatus === 'live') liveCount += 1;
      if (item.liveStatus === 'soon') soonCount += 1;
      if (item.session.recordingUrl || item.session.handoutUrl) archivedCount += 1;
    }
    return {
      liveCount,
      soonCount,
      archivedCount,
      totalAttendance: virtualClassAttendance.length,
    };
  }, [enrichedSessions, virtualClassAttendance.length]);

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!title.trim()) {
      setFeedback({ type: 'err', text: 'لطفاً عنوان جلسه کلاس مجازی را وارد کنید.' });
      return;
    }
    const urlCheck = validateVirtualClassUrl(joinUrl);
    if (!urlCheck.valid || !urlCheck.normalized) {
      setFeedback({ type: 'err', text: urlCheck.errorFa || 'لینک کلاس معتبر نیست.' });
      return;
    }
    const targetClassId = classId || availableClasses[0]?.id || '';
    if (!targetClassId) {
      setFeedback({ type: 'err', text: 'لطفاً کلاس هدف را انتخاب کنید.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const vc: VirtualClassSession = {
      id: '',
      complexId: activeSchool.complexId || 'complex-1',
      schoolId: activeSchoolId,
      academicYearId: activeSchool.academicYear || '1405-1406',
      title: title.trim(),
      classId: targetClassId,
      subject: subject.trim() || 'عمومی',
      teacherId: linkedTeacher?.id,
      teacherName: linkedTeacher?.fullName || session.displayName,
      platform,
      joinUrl: urlCheck.normalized,
      jalaliDate: jalaliDate.trim() || getTodayJalali(),
      startTimeHm: startTimeHm.trim() || '10:00',
      durationMinutes: Math.max(15, Math.min(240, Number(durationMinutes) || 45)),
      description: description.trim() || undefined,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await upsertVirtualClassSession(vc);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در زمان‌بندی کلاس مجازی.' });
      return;
    }
    setShowForm(false);
    setTitle('');
    setJoinUrl('');
    setDescription('');
    setFeedback({
      type: 'ok',
      text: 'جلسه کلاس مجازی با موفقیت زمان‌بندی و در هاب کلاس منتشر شد.',
    });
  };

  const openArchiveEditor = (vc: VirtualClassSession) => {
    setEditingArchiveId(vc.id);
    setRecUrlDraft(vc.recordingUrl ?? '');
    setRecTitleDraft(vc.recordingTitle ?? `فیلم ضبط‌شده: ${vc.title}`);
    setHandoutUrlDraft(vc.handoutUrl ?? '');
    setHandoutTitleDraft(vc.handoutTitle ?? `جزوه جلسه: ${vc.title}`);
  };

  const handleSaveArchive = async (vc: VirtualClassSession) => {
    let normalizedRec: string | undefined;
    let normalizedHandout: string | undefined;

    if (recUrlDraft.trim()) {
      const check = validateVirtualClassUrl(recUrlDraft);
      if (!check.valid) {
        setFeedback({ type: 'err', text: `لینک فیلم ضبط‌شده معتبر نیست: ${check.errorFa}` });
        return;
      }
      normalizedRec = check.normalized;
    }

    if (handoutUrlDraft.trim()) {
      const check = validateVirtualClassUrl(handoutUrlDraft);
      if (!check.valid) {
        setFeedback({ type: 'err', text: `لینک جزوه جلسه معتبر نیست: ${check.errorFa}` });
        return;
      }
      normalizedHandout = check.normalized;
    }

    const res = await upsertVirtualClassSession({
      ...vc,
      recordingUrl: normalizedRec,
      recordingTitle: normalizedRec ? recTitleDraft.trim() || vc.title : undefined,
      handoutUrl: normalizedHandout,
      handoutTitle: normalizedHandout ? handoutTitleDraft.trim() || vc.title : undefined,
    });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.errorFa || 'خطا در ذخیره آرشیو جلسه.' });
      return;
    }
    setEditingArchiveId(null);
    setFeedback({
      type: 'ok',
      text: `آرشیو ویدیو و جزوه ذخیره شد و به‌صورت خودکار در صفحه درس «${vc.subject}» نیز در دسترس دانش‌آموزان قرار گرفت.`,
    });
  };

  const handleStudentJoinClick = (vc: VirtualClassSession) => {
    if (activeRole === 'student') {
      void recordVirtualClassJoinAttendance(vc.id).then((res) => {
        if (res.ok) {
          setFeedback({
            type: 'ok',
            text: `حضور هوشمند شما در کلاس «${vc.title}» با ساعت دقیق ثبت شد.`,
          });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
              هاب کلاس‌های مجازی و حضور هوشمند
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeSchool.name} · اتصال مستقیم به بسترهای آنلاین و آرشیو خودکار در داشبورد دروس
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/subjects')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <BookOpen className="h-4 w-4" />
            آرشیو دروس من
          </button>
          {canScheduleOrArchive && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              زمان‌بندی کلاس مجازی جدید
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {kpis.liveCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            )}
            در حال برگزاری (زنده)
          </div>
          <div className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-400">
            {toPersianDigits(kpis.liveCount)} کلاس
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">شروع تا ۳۰ دقیقه آینده</div>
          <div className="mt-1 text-xl font-black text-amber-700 dark:text-amber-400">
            {toPersianDigits(kpis.soonCount)} کلاس
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">دارای فیلم / جزوه آرشیو</div>
          <div className="mt-1 text-xl font-black text-sky-700 dark:text-sky-400">
            {toPersianDigits(kpis.archivedCount)} جلسه
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 tabular-nums dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">ثبت ورود هوشمند</div>
          <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
            {toPersianDigits(kpis.totalAttendance)} حضور
          </div>
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

      {/* Schedule Virtual Class Form */}
      {showForm && canScheduleOrArchive && (
        <form
          onSubmit={handleScheduleSession}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              زمان‌بندی جلسه کلاس مجازی جدید
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                عنوان جلسه
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: حل تمرین زنده فصل معادلات خطی"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                کلاس هدف
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                نام درس (جهت اتصال به آرشیو درس)
              </label>
              <input
                type="text"
                list="vc-subjects-list"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <datalist id="vc-subjects-list">
                {availableSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                بستر کلاس آنلاین
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as VirtualClassPlatform)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(Object.keys(VIRTUAL_CLASS_PLATFORMS) as VirtualClassPlatform[]).map((p) => (
                  <option key={p} value={p}>
                    {VIRTUAL_CLASS_PLATFORMS[p].labelFa}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                لینک امن ورود به کلاس (https://)
              </label>
              <input
                type="url"
                required
                dir="ltr"
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                placeholder="https://www.skyroom.online/ch/..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                تاریخ شمسی
              </label>
              <input
                type="text"
                dir="ltr"
                value={jalaliDate}
                onChange={(e) => setJalaliDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  ساعت شروع
                </label>
                <input
                  type="time"
                  value={startTimeHm}
                  onChange={(e) => setStartTimeHm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  مدت (دقیقه)
                </label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              توضیحات و پیش‌نیازهای جلسه (اختیاری)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلاً: همراه داشتن کتاب کار و دفتر تمرین..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              انتشار جلسه در هاب کلاس مجازی
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'live', 'soon', 'scheduled', 'ended'] as const).map((st) => (
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
              {st === 'all' ? 'همه جلسات' : VIRTUAL_STATUS_LABELS[st]}
            </button>
          ))}
        </div>

        {!isParentOrStudent && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">همه کلاس‌ها</option>
            {availableClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          کلاس مجازی در این فیلتر یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map(({ session: vc, liveStatus }) => {
            const clsName = classById.get(vc.classId)?.name ?? 'کلاس نامشخص';
            const classStudents = students.filter((s) => s.classId === vc.classId);
            const sessAttendance = attendanceBySessionId.get(vc.id) ?? [];
            const attMap = new Map(sessAttendance.map((a) => [a.studentId, a]));
            const myAtt = linkedStudent ? attMap.get(linkedStudent.id) : undefined;
            const isAttOpen = openAttendanceId === vc.id;
            const isArchEditing = editingArchiveId === vc.id;

            const attendancePrintHtml = buildVirtualAttendancePrintHtml({
              session: vc,
              className: clsName,
              classStudents,
              attendanceRecords: sessAttendance,
              school: activeSchool,
            });

            return (
              <div
                key={vc.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Live Status Indicator — Pulsing green dot STRICTLY for active LIVE classes */}
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-extrabold ${
                          liveStatus === 'live'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : liveStatus === 'soon'
                              ? 'text-amber-700 dark:text-amber-400'
                              : liveStatus === 'scheduled'
                                ? 'text-sky-700 dark:text-sky-400'
                                : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {liveStatus === 'live' && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        {VIRTUAL_STATUS_LABELS[liveStatus]}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {vc.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        درس: <strong>{vc.subject}</strong>
                      </span>
                      <span>کلاس: {clsName}</span>
                      <span>معلم: {vc.teacherName}</span>
                      <span>بستر: {VIRTUAL_CLASS_PLATFORMS[vc.platform].shortLabelFa}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                        {toPersianDigits(vc.jalaliDate)} · ساعت {toPersianDigits(vc.startTimeHm)} (
                        {toPersianDigits(vc.durationMinutes)} دقیقه)
                      </span>
                    </div>

                    {vc.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{vc.description}</p>
                    )}

                    {/* Student/Parent Attendance Confirmation Line */}
                    {isParentOrStudent && myAtt && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        حضور آنلاین در ساعت {toPersianDigits(myAtt.joinedAtTimeHm)} ثبت شده است
                      </div>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Click-to-Join Safe External Anchor (NEVER window.open) */}
                    {liveStatus !== 'ended' && (
                      <a
                        href={vc.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleStudentJoinClick(vc)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition ${
                          liveStatus === 'live'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500'
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        ورود به کلاس مجازی
                      </a>
                    )}

                    {canScheduleOrArchive && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenAttendanceId(isAttOpen ? null : vc.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Users className="h-3.5 w-3.5" />
                          حضور هوشمند ({toPersianDigits(sessAttendance.length)}/
                          {toPersianDigits(classStudents.length)})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            isArchEditing ? setEditingArchiveId(null) : openArchiveEditor(vc)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          آرشیو فیلم / جزوه
                        </button>
                        <PrintIconButton
                          compact
                          documentLabel={`حضور و غیاب کلاس مجازی ${vc.title}`}
                          html={attendancePrintHtml}
                        />
                      </>
                    )}

                    {isAdminOrDeputy && (
                      <button
                        type="button"
                        onClick={() => {
                          void softDeleteVirtualClassSession(vc.id).then((res) => {
                            if (res.ok) {
                              setFeedback({
                                type: 'ok',
                                text: 'جلسه کلاس مجازی به سطل بازیابی امن منتقل شد.',
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

                {/* Archived Recording & Handout Links (Visible to All Roles + Synced to SubjectsHub) */}
                {(vc.recordingUrl || vc.handoutUrl) && !isArchEditing && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {vc.recordingUrl && (
                      <a
                        href={vc.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                      >
                        <Film className="h-3.5 w-3.5" />
                        {vc.recordingTitle || 'مشاهده فیلم ضبط‌شده جلسه'}
                      </a>
                    )}
                    {vc.handoutUrl && (
                      <a
                        href={vc.handoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {vc.handoutTitle || 'دانلود جزوه جلسه'}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/subjects')}
                      className="text-[11px] font-semibold text-slate-500 underline decoration-dotted hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      همگام با بخش «دروس من» ({vc.subject})
                    </button>
                  </div>
                )}

                {/* Archive Editor (Teacher / Admin) */}
                {isArchEditing && canScheduleOrArchive && (
                  <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      ثبت لینک فیلم ضبط‌شده و جزوه جلسه (انتشار خودکار در صفحه درس «{vc.subject}»)
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          لینک ویدیو ضبط‌شده (https://)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={recUrlDraft}
                          onChange={(e) => setRecUrlDraft(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          عنوان ویدیو
                        </label>
                        <input
                          type="text"
                          value={recTitleDraft}
                          onChange={(e) => setRecTitleDraft(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          لینک جزوه / فایل PDF (https://)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={handoutUrlDraft}
                          onChange={(e) => setHandoutUrlDraft(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          عنوان جزوه
                        </label>
                        <input
                          type="text"
                          value={handoutTitleDraft}
                          onChange={(e) => setHandoutTitleDraft(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingArchiveId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveArchive(vc)}
                        className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-sky-600"
                      >
                        ذخیره در آرشیو و همگام‌سازی با درس
                      </button>
                    </div>
                  </div>
                )}

                {/* Smart Click-to-Join Attendance Table (Teacher / Admin) */}
                {isAttOpen && canScheduleOrArchive && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                        لیست حضور هوشمند دانش‌آموزان ({clsName})
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                        حاضر: {toPersianDigits(sessAttendance.length)} نفر · غایب:{' '}
                        {toPersianDigits(Math.max(0, classStudents.length - sessAttendance.length))}{' '}
                        نفر
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {classStudents.map((st) => {
                        const att = attMap.get(st.id);
                        return (
                          <div
                            key={st.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {st.fullName}
                            </span>
                            {att ? (
                              <span className="font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                                ✓ {toPersianDigits(att.joinedAtTimeHm)}
                              </span>
                            ) : (
                              <span className="text-slate-400">غایب</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
