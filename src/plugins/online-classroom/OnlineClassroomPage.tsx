// Plugin 13 (Phase 3): Online Classroom Manager («مدیریت کلاس آنلاین»)
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Clock,
  ExternalLink,
  Film,
  KeyRound,
  Plus,
  Printer,
  Save,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useToast } from '../../core/ui/ToastContext';
import { validateOnlineClassSessionInput } from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  OnlineClassAttendanceRecord,
  OnlineClassAttendanceStatus,
  OnlineClassPlatform,
  OnlineClassSession,
  OnlineClassStatus,
} from '../../types/domain';
import {
  computeOnlineAttendanceSummary,
  formatClassroomInviteMessenger,
  getAttendanceStatusLabelFa,
  getCurrentTimeHHMM,
  getOnlineClassStatusMeta,
  getPlatformLabelFa,
  ONLINE_CLASS_PLATFORMS,
} from './onlineClassroomHelpers';

export const OnlineClassroomPage: React.FC = () => {
  const {
    activeRole,
    roleDef,
    activeSchool,
    activeSchoolId,
    classes,
    students,
    teachers,
    linkedTeacher,
    linkedStudent,
    onlineClassSessions,
    onlineClassAttendance,
    upsertOnlineClassSession,
    deleteOnlineClassSession,
    upsertOnlineClassAttendance,
    upsertStudent360Signal,
  } = useSchoolData();
  const { showToast } = useToast();

  const canManage = roleDef.canManageOnlineClassroom;
  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';

  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<OnlineClassSession | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [printAttendanceOpen, setPrintAttendanceOpen] = useState(false);

  // Archive draft fields per selected session
  const [recordingDraft, setRecordingDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  // Create / Edit modal state
  const defaultClassId = classes[0]?.id ?? '';
  const [formTitle, setFormTitle] = useState('');
  const [formClassId, setFormClassId] = useState(defaultClassId);
  const [formSubject, setFormSubject] = useState(linkedTeacher?.specialty ?? 'ریاضی');
  const [formTeacherId, setFormTeacherId] = useState(linkedTeacher?.id ?? teachers[0]?.id ?? '');
  const [formDate, setFormDate] = useState(getTodayJalali());
  const [formStartTime, setFormStartTime] = useState('16:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formPlatform, setFormPlatform] = useState<OnlineClassPlatform>('skyroom');
  const [formJoinUrl, setFormJoinUrl] = useState('https://www.skyroom.online/ch/school/live');
  const [formPassword, setFormPassword] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<OnlineClassStatus>('scheduled');

  const visibleSessions = useMemo(() => {
    const filtered =
      classFilter === 'all'
        ? onlineClassSessions
        : onlineClassSessions.filter((s) => s.classId === classFilter);
    const statusOrder: Record<OnlineClassStatus, number> = { live: 0, scheduled: 1, ended: 2 };
    return [...filtered].sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [onlineClassSessions, classFilter]);

  const activeSession = useMemo(() => {
    if (visibleSessions.length === 0) return null;
    return visibleSessions.find((s) => s.id === selectedSessionId) ?? visibleSessions[0];
  }, [visibleSessions, selectedSessionId]);

  const activeClass = useMemo(
    () => (activeSession ? classes.find((c) => c.id === activeSession.classId) : undefined),
    [classes, activeSession]
  );

  const sessionStudents = useMemo(() => {
    if (!activeSession) return [];
    return students.filter((s) => s.classId === activeSession.classId && s.active);
  }, [students, activeSession]);

  const sessionAttendance = useMemo(() => {
    if (!activeSession) return [];
    return onlineClassAttendance.filter((a) => a.sessionId === activeSession.id);
  }, [onlineClassAttendance, activeSession]);

  const attendanceSummary = useMemo(
    () => computeOnlineAttendanceSummary(sessionStudents, sessionAttendance),
    [sessionStudents, sessionAttendance]
  );

  const openCreateModal = () => {
    setEditingSession(null);
    setFormTitle('');
    setFormClassId(classes[0]?.id ?? '');
    setFormSubject(linkedTeacher?.specialty ?? 'ریاضی');
    setFormTeacherId(linkedTeacher?.id ?? teachers[0]?.id ?? '');
    setFormDate(getTodayJalali());
    setFormStartTime('16:00');
    setFormEndTime('17:00');
    setFormPlatform('skyroom');
    setFormJoinUrl('https://www.skyroom.online/ch/school/live');
    setFormPassword('');
    setFormDescription('');
    setFormStatus('scheduled');
    setModalOpen(true);
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateOnlineClassSessionInput({
      title: formTitle,
      classId: formClassId,
      subject: formSubject,
      jalaliDate: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      joinUrl: formJoinUrl,
    });
    if (!validation.valid) {
      showToast(validation.errors[0] ?? 'اطلاعات جلسه ناقص است.', 'error');
      return;
    }

    const teacherObj = teachers.find((t) => t.id === formTeacherId) ?? linkedTeacher;
    const nowIso = new Date().toISOString();
    const sessionRecord: OnlineClassSession = {
      id: editingSession?.id ?? `${activeSchoolId}:oc:${Date.now()}`,
      schoolId: activeSchoolId,
      classId: formClassId,
      teacherId: teacherObj?.id ?? 'teacher-admin',
      teacherName: teacherObj?.fullName ?? 'معلم کلاس',
      subject: formSubject.trim(),
      title: formTitle.trim(),
      jalaliDate: formDate.trim(),
      startTime: formStartTime.trim(),
      endTime: formEndTime.trim(),
      platform: formPlatform,
      joinUrl: formJoinUrl.trim(),
      accessPassword: formPassword.trim() || undefined,
      description: formDescription.trim() || undefined,
      status: formStatus,
      recordingUrl: editingSession?.recordingUrl,
      postSessionNote: editingSession?.postSessionNote,
      createdAt: editingSession?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    const res = upsertOnlineClassSession(sessionRecord);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ثبت جلسه انجام نشد.', 'error');
      return;
    }
    setSelectedSessionId(sessionRecord.id);
    setModalOpen(false);
    showToast('جلسه کلاس آنلاین با موفقیت ذخیره شد.');
  };

  const handleStudentJoinSession = (session: OnlineClassSession) => {
    if (!linkedStudent) return;
    const nowTime = getCurrentTimeHHMM();
    const todayJalali = getTodayJalali();
    const nowIso = new Date().toISOString();
    const rec: OnlineClassAttendanceRecord = {
      id: `${session.schoolId}:ocatt:${session.id}:${linkedStudent.id}`,
      schoolId: session.schoolId,
      sessionId: session.id,
      classId: session.classId,
      studentId: linkedStudent.id,
      status: 'present',
      joinedAtJalali: todayJalali,
      joinedAtTime: nowTime,
      joinedViaLink: true,
      note: 'ثبت حضور خودکار با کلیک ورود به کلاس آنلاین',
      updatedAt: nowIso,
    };

    const res = upsertOnlineClassAttendance(rec);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت حضور.', 'error');
      return;
    }

    upsertStudent360Signal({
      id: `${session.schoolId}:s360:online_classroom:${session.id}:${linkedStudent.id}`,
      schoolId: session.schoolId,
      studentId: linkedStudent.id,
      classId: session.classId,
      subject: session.subject,
      source: 'online_classroom',
      sourceEntityId: session.id,
      title: session.title,
      statusLabelFa: 'حاضر در کلاس آنلاین',
      summaryFa: `ورود به کلاس آنلاین «${session.title}» در ساعت ${toPersianDigits(nowTime)} (${getPlatformLabelFa(session.platform)})`,
      recordedAtJalali: todayJalali,
      updatedAt: nowIso,
    });

    showToast(
      `حضور ${linkedStudent.fullName} در ساعت ${toPersianDigits(nowTime)} با وضعیت «حاضر در کلاس آنلاین» ثبت شد.`
    );
  };

  const handleTeacherToggleAttendance = (
    studentId: string,
    status: OnlineClassAttendanceStatus
  ) => {
    if (!activeSession) return;
    const existing = sessionAttendance.find((a) => a.studentId === studentId);
    const rec: OnlineClassAttendanceRecord = {
      id: `${activeSession.schoolId}:ocatt:${activeSession.id}:${studentId}`,
      schoolId: activeSession.schoolId,
      sessionId: activeSession.id,
      classId: activeSession.classId,
      studentId,
      status,
      joinedAtJalali: existing?.joinedAtJalali ?? activeSession.jalaliDate,
      joinedAtTime:
        status === 'absent' ? undefined : existing?.joinedAtTime ?? getCurrentTimeHHMM(),
      joinedViaLink: existing?.joinedViaLink ?? false,
      note: existing?.note,
      updatedAt: new Date().toISOString(),
    };
    const res = upsertOnlineClassAttendance(rec);
    if (!res.ok) {
      showToast(res.errorFa ?? 'به‌روزرسانی حضور انجام نشد.', 'error');
    }
  };

  const handleUpdateSessionStatus = (session: OnlineClassSession, status: OnlineClassStatus) => {
    const res = upsertOnlineClassSession({
      ...session,
      status,
      updatedAt: new Date().toISOString(),
    });
    if (res.ok) {
      showToast(`وضعیت جلسه به «${getOnlineClassStatusMeta(status).labelFa}» تغییر یافت.`);
    }
  };

  const handleSaveArchive = () => {
    if (!activeSession) return;
    const recordingUrl = (recordingDraft[activeSession.id] ?? activeSession.recordingUrl ?? '').trim();
    const postSessionNote = (noteDraft[activeSession.id] ?? activeSession.postSessionNote ?? '').trim();
    const res = upsertOnlineClassSession({
      ...activeSession,
      recordingUrl: recordingUrl || undefined,
      postSessionNote: postSessionNote || undefined,
      updatedAt: new Date().toISOString(),
    });
    if (res.ok) {
      showToast('آرشیو فیلم ضبط‌شده و یادداشت پایان جلسه ذخیره شد.');
    } else {
      showToast(res.errorFa ?? 'ذخیره آرشیو انجام نشد.', 'error');
    }
  };

  const handleCopyInvite = async (session: OnlineClassSession) => {
    const cls = classes.find((c) => c.id === session.classId);
    const text = formatClassroomInviteMessenger({
      schoolName: activeSchool.name,
      className: cls?.name ?? 'کلاس',
      session,
    });
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showToast('دعوتنامه تک‌ستونی کلاس آنلاین کپی شد (آماده ارسال در ایتا، بله و شاد).');
    } else {
      showToast('کپی انجام نشد.', 'error');
    }
  };

  const handleCopyLink = async (url: string) => {
    const ok = await copyTextToClipboard(url);
    if (ok) showToast('لینک ورود به کلاس آنلاین کپی شد.');
  };

  const handleDeleteSession = (id: string) => {
    const res = deleteOnlineClassSession(id);
    setConfirmDeleteId(null);
    if (res.ok) showToast('جلسه کلاس آنلاین حذف شد.');
    else showToast(res.errorFa ?? 'حذف انجام نشد.', 'error');
  };

  // --- STUDENT (Interactive Join + Auto-Attendance) vs PARENT (Strictly Read-Only Report) ---
  if (isStudent || isParent) {
    return (
      <PrintShell
        school={activeSchool}
        documentTitle={`گزارش کلاس‌های آنلاین — ${linkedStudent?.fullName ?? ''}`}
        subtitle={`سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
      >
        <div
          className="space-y-6"
          data-testid={isParent ? 'online-classroom-parent-readonly' : 'online-classroom-student-view'}
        >
          <header className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {isParent
                  ? 'گزارش حضور در کلاس‌های آنلاین فرزند (فقط مشاهده)'
                  : 'کلاس‌های آنلاین و حضور خودکار'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isParent && linkedStudent
                  ? `مشاهده برنامه و وضعیت حضور آنلاین ${linkedStudent.fullName} — ورود به کلاس و ثبت حضور از حساب دانش‌آموز انجام می‌شود.`
                  : linkedStudent
                    ? `جلسات برخط ${linkedStudent.fullName} — با کلیک روی «ورود به کلاس آنلاین»، حضور شما به‌صورت خودکار ثبت می‌شود.`
                    : 'دانش‌آموز متصلی یافت نشد.'}
              </p>
            </div>
            <PrintButtons compact documentLabel="گزارش کلاس آنلاین" />
          </header>

          {visibleSessions.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <Video className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                در حال حاضر کلاس آنلاینی برای این کلاس زمان‌بندی نشده است.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleSessions.map((session) => {
                const statusMeta = getOnlineClassStatusMeta(session.status);
                const myAtt = linkedStudent
                  ? onlineClassAttendance.find(
                      (a) => a.sessionId === session.id && a.studentId === linkedStudent.id
                    )
                  : undefined;

                return (
                  <div
                    key={session.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4 break-inside-avoid"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.labelFa}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          بستر: {getPlatformLabelFa(session.platform)}
                        </span>
                      </div>

                      <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {session.title}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        درس {session.subject} · معلم: {session.teacherName} · تاریخ{' '}
                        {toPersianDigits(session.jalaliDate)} · ساعت{' '}
                        {toPersianDigits(session.startTime)} تا {toPersianDigits(session.endTime)}
                      </p>

                      {session.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-6">
                          {session.description}
                        </p>
                      )}

                      {isStudent && session.accessPassword && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                          <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                          <span>رمز ورود: {session.accessPassword}</span>
                        </div>
                      )}

                      {myAtt && myAtt.status !== 'absent' ? (
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {getAttendanceStatusLabelFa(myAtt.status)}
                            {myAtt.joinedAtTime
                              ? ` · ساعت ورود: ${toPersianDigits(myAtt.joinedAtTime)}`
                              : ''}
                          </span>
                        </div>
                      ) : isParent ? (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          وضعیت حضور فرزند:{' '}
                          {myAtt?.status === 'absent'
                            ? 'غایب'
                            : session.status === 'ended'
                              ? 'حضور ثبت نشده است'
                              : 'در انتظار ورود دانش‌آموز به کلاس'}
                        </div>
                      ) : null}
                    </div>

                    <div className="no-print flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {isStudent && (
                        <>
                          <a
                            href={session.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleStudentJoinSession(session)}
                            className="min-h-[44px] flex-1 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>ورود به کلاس آنلاین</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(session.joinUrl)}
                            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <ClipboardCopy className="w-4 h-4" />
                            <span>کپی لینک</span>
                          </button>
                        </>
                      )}
                      {session.recordingUrl && (
                        <a
                          href={session.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] w-full px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                        >
                          <Film className="w-4 h-4" />
                          <span>مشاهده فیلم ضبط‌شده جلسه</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PrintShell>
    );
  }

  // --- TEACHER / ADMIN VIEW ---
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            مدیریت کلاس آنلاین و حضور و غیاب برخط
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            زمان‌بندی جلسات در شاد، اسکایروم و ادوبی کانکت، ثبت خودکار حضور با لینک ورود، آرشیو فیلم ضبط‌شده و دعوتنامه تک‌ستونی
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف کلاس آنلاین جدید</span>
          </button>
        )}
      </header>

      {/* Filter & Session Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="فیلتر کلاس"
          className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه کلاس‌ها ({toPersianDigits(onlineClassSessions.length)})</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          {visibleSessions.map((session) => {
            const isSelected = activeSession?.id === session.id;
            const statusMeta = getOnlineClassStatusMeta(session.status);
            return (
              <div key={session.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`min-h-[42px] px-3.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Video className="w-4 h-4 shrink-0" />
                  <span>{session.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/20 text-white' : statusMeta.badgeClass
                    }`}
                  >
                    {statusMeta.labelFa}
                  </span>
                </button>
                {canManage && isSelected && (
                  confirmDeleteId === session.id ? (
                    <div className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                        className="text-[11px] font-bold text-rose-700 dark:text-rose-300 px-1.5 py-1"
                      >
                        تایید حذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[11px] text-slate-500 px-1 py-1"
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(session.id)}
                      aria-label="حذف جلسه"
                      className="min-h-[42px] w-10 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!activeSession ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <Video className="w-11 h-11 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            هیچ جلسه کلاس آنلاینی ثبت نشده است.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Session Overview + Actions */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      getOnlineClassStatusMeta(activeSession.status).badgeClass
                    }`}
                  >
                    {getOnlineClassStatusMeta(activeSession.status).labelFa}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    بستر: {getPlatformLabelFa(activeSession.platform)} · {activeClass?.name}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {activeSession.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  درس {activeSession.subject} · معلم: {activeSession.teacherName} · تاریخ{' '}
                  {toPersianDigits(activeSession.jalaliDate)} · ساعت{' '}
                  {toPersianDigits(activeSession.startTime)} تا {toPersianDigits(activeSession.endTime)}
                  {activeSession.accessPassword
                    ? ` · رمز ورود: ${activeSession.accessPassword}`
                    : ''}
                </p>
              </div>

              {/* Status Switcher */}
              {canManage && (
                <div
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
                  role="group"
                  aria-label="تغییر وضعیت جلسه"
                >
                  {(['live', 'scheduled', 'ended'] as OnlineClassStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateSessionStatus(activeSession, st)}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors ${
                        activeSession.status === st
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {getOnlineClassStatusMeta(st).labelFa}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href={activeSession.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>باز کردن اتاق کلاس ({getPlatformLabelFa(activeSession.platform)})</span>
              </a>

              <button
                type="button"
                onClick={() => handleCopyInvite(activeSession)}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ClipboardCopy className="w-4 h-4" />
                <span>کپی تک‌ستونی دعوتنامه کلاس برای ایتا، بله و شاد</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintAttendanceOpen(true)}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ A4 لیست حضور و غیاب کلاس آنلاین</span>
              </button>
            </div>
          </section>

          {/* Two-Column: Live Attendance Sheet + Post-Session Recording Archive */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Live Attendance Sheet */}
            <section className="xl:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    لیست حضور و غیاب زنده کلاس آنلاین
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    حاضر: {toPersianDigits(attendanceSummary.presentCount)}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    تاخیر: {toPersianDigits(attendanceSummary.lateCount)}
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    غایب: {toPersianDigits(attendanceSummary.absentCount)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    ({toPersianDigits(attendanceSummary.presentRatePercent)}٪ حضور)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-2 font-bold">دانش‌آموز</th>
                      <th className="py-2.5 px-2 font-bold">نحوه و ساعت ورود</th>
                      <th className="py-2.5 px-2 font-bold">ثبت / تغییر وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sessionStudents.map((stu) => {
                      const rec = sessionAttendance.find((a) => a.studentId === stu.id);
                      const status: OnlineClassAttendanceStatus = rec?.status ?? 'absent';
                      return (
                        <tr key={stu.id}>
                          <td className="py-3 px-2 font-bold text-slate-900 dark:text-slate-100">
                            {stu.fullName}
                          </td>
                          <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {rec?.joinedAtTime ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                {rec.joinedViaLink ? 'ورود خودکار با لینک' : 'ثبت دستی'} · ساعت{' '}
                                {toPersianDigits(rec.joinedAtTime)}
                              </span>
                            ) : (
                              <span>وارد نشده</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="inline-flex items-center gap-1">
                              {(
                                [
                                  { id: 'present', label: 'حاضر', activeCls: 'bg-emerald-600 text-white' },
                                  { id: 'late', label: 'تاخیر', activeCls: 'bg-amber-500 text-white' },
                                  { id: 'absent', label: 'غایب', activeCls: 'bg-rose-600 text-white' },
                                ] as const
                              ).map((btn) => (
                                <button
                                  key={btn.id}
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => handleTeacherToggleAttendance(stu.id, btn.id)}
                                  className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold transition-colors ${
                                    status === btn.id
                                      ? btn.activeCls
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recording Archive & Post-Session Teaching Note */}
            <section className="xl:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  آرشیو فیلم ضبط‌شده و یادداشت جلسه
                </h3>
              </div>

              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    لینک فیلم ضبط‌شده جلسه (قابل مشاهده برای اولیا و دانش‌آموزان)
                  </span>
                  <input
                    type="url"
                    dir="ltr"
                    value={recordingDraft[activeSession.id] ?? activeSession.recordingUrl ?? ''}
                    onChange={(e) =>
                      setRecordingDraft((prev) => ({
                        ...prev,
                        [activeSession.id]: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    خلاصه تدریس و یادداشت پایان جلسه
                  </span>
                  <textarea
                    rows={4}
                    value={noteDraft[activeSession.id] ?? activeSession.postSessionNote ?? ''}
                    onChange={(e) =>
                      setNoteDraft((prev) => ({
                        ...prev,
                        [activeSession.id]: e.target.value,
                      }))
                    }
                    placeholder="مباحث تدریس‌شده، تکالیف شفاهی و نکات پیگیری جلسه بعد..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </label>

                {canManage && (
                  <button
                    type="button"
                    onClick={handleSaveArchive}
                    className="w-full min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>ذخیره آرشیو و یادداشت جلسه</span>
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="تعریف کلاس آنلاین جدید"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl my-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                تعریف جلسه کلاس آنلاین جدید
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="بستن"
                className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان جلسه کلاس آنلاین *
                  </span>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثلاً: کلاس حل تمرین فصل ۴ ریاضی"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">کلاس *</span>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">نام درس *</span>
                  <input
                    type="text"
                    required
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">معلم برگزارکننده</span>
                  <select
                    value={formTeacherId}
                    onChange={(e) => setFormTeacherId(e.target.value)}
                    disabled={activeRole === 'teacher'}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">بستر برگزاری *</span>
                  <select
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value as OnlineClassPlatform)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {ONLINE_CLASS_PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.labelFa}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">تاریخ شمسی *</span>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="1404/08/25"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">شروع</span>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      placeholder="16:00"
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">پایان</span>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      placeholder="17:00"
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </label>
                </div>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    لینک ورود به جلسه (URL) *
                  </span>
                  <input
                    type="url"
                    dir="ltr"
                    required
                    value={formJoinUrl}
                    onChange={(e) => setFormJoinUrl(e.target.value)}
                    placeholder="https://www.skyroom.online/ch/..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    رمز ورود (اختیاری)
                  </span>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">وضعیت فعلی</span>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as OnlineClassStatus)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="live">در حال برگزاری</option>
                    <option value="scheduled">برنامه‌ریزی شده</option>
                    <option value="ended">پایان یافته</option>
                  </select>
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    توضیحات برای دانش‌آموزان (اختیاری)
                  </span>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  ذخیره جلسه کلاس آنلاین
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* A4 Print Attendance Sheet Modal */}
      {printAttendanceOpen && activeSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-4 print:p-0 print:bg-white print:static"
          role="dialog"
          aria-modal="true"
          aria-label="چاپ A4 لیست حضور و غیاب کلاس آنلاین"
        >
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">
            <div className="no-print flex items-center justify-between px-5 py-3.5 bg-slate-100 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900">
                پیش‌نمایش چاپ A4 — لیست حضور و غیاب کلاس آنلاین
              </span>
              <div className="flex items-center gap-2">
                <PrintButtons compact documentLabel="لیست حضور کلاس آنلاین" />
                <button
                  type="button"
                  onClick={() => setPrintAttendanceOpen(false)}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
                >
                  بستن
                </button>
              </div>
            </div>

            <div className="p-6 print:p-0">
              <PrintShell
                school={activeSchool}
                documentTitle={`لیست حضور و غیاب کلاس آنلاین — ${activeSession.title}`}
                subtitle={`${activeClass?.name ?? ''} · درس ${activeSession.subject} · معلم: ${activeSession.teacherName} · تاریخ ${toPersianDigits(activeSession.jalaliDate)} · بستر: ${getPlatformLabelFa(activeSession.platform)} (${toPersianDigits(activeSession.startTime)} تا ${toPersianDigits(activeSession.endTime)})`}
              >
                <div className="space-y-4 text-slate-900 text-xs">
                  <div className="grid grid-cols-4 gap-2 border border-slate-300 rounded-xl p-3 text-center tabular-nums">
                    <div>
                      <div className="text-slate-500">کل دانش‌آموزان</div>
                      <div className="font-extrabold text-sm">{toPersianDigits(attendanceSummary.totalStudents)} نفر</div>
                    </div>
                    <div>
                      <div className="text-slate-500">حاضر</div>
                      <div className="font-extrabold text-sm">{toPersianDigits(attendanceSummary.presentCount)} نفر</div>
                    </div>
                    <div>
                      <div className="text-slate-500">تاخیر</div>
                      <div className="font-extrabold text-sm">{toPersianDigits(attendanceSummary.lateCount)} نفر</div>
                    </div>
                    <div>
                      <div className="text-slate-500">غایب</div>
                      <div className="font-extrabold text-sm">{toPersianDigits(attendanceSummary.absentCount)} نفر</div>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-right">ردیف</th>
                        <th className="border border-slate-300 p-2 text-right">نام و نام خانوادگی</th>
                        <th className="border border-slate-300 p-2 text-right">وضعیت حضور</th>
                        <th className="border border-slate-300 p-2 text-right">ساعت ورود</th>
                        <th className="border border-slate-300 p-2 text-right">روش ثبت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionStudents.map((stu, idx) => {
                        const rec = sessionAttendance.find((a) => a.studentId === stu.id);
                        const st: OnlineClassAttendanceStatus = rec?.status ?? 'absent';
                        return (
                          <tr key={stu.id}>
                            <td className="border border-slate-300 p-2 tabular-nums">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="border border-slate-300 p-2 font-bold">{stu.fullName}</td>
                            <td className="border border-slate-300 p-2">
                              {getAttendanceStatusLabelFa(st)}
                            </td>
                            <td className="border border-slate-300 p-2 tabular-nums">
                              {rec?.joinedAtTime ? toPersianDigits(rec.joinedAtTime) : '—'}
                            </td>
                            <td className="border border-slate-300 p-2">
                              {rec?.joinedViaLink ? 'ورود خودکار با لینک' : rec ? 'ثبت معلم' : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </PrintShell>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
