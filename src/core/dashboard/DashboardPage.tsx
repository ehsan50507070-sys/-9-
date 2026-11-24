// Smart Dashboard: Dedicated Student Home, Comprehensive Parent Performance Overview, and Admin/Teacher KPIs
import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Blocks,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { formatPersianPercent, toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getPersianWeekdayFromJalali } from '../../lib/jalali';
import type { AttendanceStatus, PeriodNumber } from '../../types/domain';
import { useAppearance, useSectionLabel } from '../appearance/AppearanceContext';
import { canRoleAccessRoute } from '../auth/rbac';
import { useSchoolData } from '../data/DataContext';
import { PrintShell } from '../export/PrintShell';
import {
  computeStudentAttendanceSummary,
  computeSubstitutionNeeds,
} from '../plugins/pluginHelpers';
import { PrintButtons } from '../print/PrintButtons';
import { useRouter } from '../router/RouterContext';
import { PortalQuickSearchBar } from '../subjects/PortalQuickSearchBar';
import { buildSubjectRoute, collectSubjectsForContext } from '../subjects/subjectHelpers';

interface SmartAlert {
  id: string;
  tone: 'rose' | 'amber' | 'sky';
  title: string;
  detail: string;
  targetRoute?: string;
  actionLabel?: string;
}

const PARENT_STATUS_BADGE: Record<AttendanceStatus, { label: string; badgeClass: string }> = {
  present: {
    label: 'حاضر',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  absent: {
    label: 'غایب',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
  late: {
    label: 'تاخیر',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  excused: {
    label: 'غیبت موجه',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  },
};

export const DashboardPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    linkedStudent,
    linkedTeacher,
    defaultWorkdayJalali,
    classes,
    students,
    teachers,
    schedules,
    studentAttendance,
    staffAttendance,
    substitutions,
    dailyLogs,
    gradebookEntries,
    homeworkAssignments,
    homeworkSubmissions,
    studentRewards,
    flippedLessons,
    flippedTelemetry,
    onlineClassSessions,
    onlineClassAttendance,
    onlineExams,
    onlineExamSubmissions,
    mockExams,
    mediaResources,
    questionBank,
    schoolAnnouncements,
    smartContentArchive,
    notificationCenter,
    unreadParentChatCount,
    pluginStatuses,
    isPluginEnabled,
    complexComparison,
    setActiveSchoolId,
  } = useSchoolData();
  const { activeSchoolDisplayName } = useAppearance();
  const { getSectionTitle } = useSectionLabel();
  const { navigate } = useRouter();

  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);
  const activeTeachers = useMemo(() => teachers.filter((t) => t.active), [teachers]);

  // Compute daily attendance KPI (unified formula matching StudentAttendanceWidget & 3-school table)
  const attendanceStats = useMemo(() => {
    const todayP1 = studentAttendance.filter(
      (a) => a.jalaliDate === defaultWorkdayJalali && a.period === 1
    );
    return computeStudentAttendanceSummary({
      totalActiveStudents: activeStudents.length,
      recordsForSlot: todayP1,
    });
  }, [studentAttendance, defaultWorkdayJalali, activeStudents.length]);

  // Compute pending substitutions for active school (admins & deputy only)
  const substitutionNeeds = useMemo(
    () =>
      activeRole === 'parent' || activeRole === 'student' || activeRole === 'teacher'
        ? []
        : computeSubstitutionNeeds({
            schoolId: activeSchoolId,
            jalaliDate: defaultWorkdayJalali,
            weekday: getPersianWeekdayFromJalali(defaultWorkdayJalali),
            teachers,
            schedules,
            staffAttendance,
            substitutions,
          }),
    [
      activeRole,
      activeSchoolId,
      defaultWorkdayJalali,
      teachers,
      schedules,
      staffAttendance,
      substitutions,
    ]
  );

  const pendingSubstitutions = substitutionNeeds.filter((n) => !n.existingAssignment);

  // Detect students with >= 2 days of absences across recorded dates (consecutive absence alert)
  const consecutiveAbsentStudents = useMemo(() => {
    const datesByStudent = new Map<string, Set<string>>();
    for (const rec of studentAttendance) {
      if (rec.status !== 'absent') continue;
      const set = datesByStudent.get(rec.studentId) ?? new Set<string>();
      set.add(rec.jalaliDate);
      datesByStudent.set(rec.studentId, set);
    }
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const flagged: Array<{ studentName: string; days: number }> = [];
    for (const [sid, dateSet] of datesByStudent.entries()) {
      if (dateSet.size >= 2) {
        const st = studentMap.get(sid);
        if (st) flagged.push({ studentName: st.fullName, days: dateSet.size });
      }
    }
    return flagged;
  }, [studentAttendance, students]);

  // Automated Smart Alert Cards
  const alerts = useMemo<SmartAlert[]>(() => {
    if (activeRole === 'parent' || activeRole === 'student') return [];
    const list: SmartAlert[] = [];

    if (consecutiveAbsentStudents.length > 0 && isPluginEnabled('student-attendance')) {
      const names = consecutiveAbsentStudents
        .slice(0, 2)
        .map((x) => `${x.studentName} (${toPersianDigits(x.days)} روز)`)
        .join('، ');
      list.push({
        id: 'consecutive-absence',
        tone: 'rose',
        title: `هشدار غیبت مستمر (${toPersianDigits(consecutiveAbsentStudents.length)} دانش‌آموز)`,
        detail: `${names} — نیازمند تماس مشاوره‌ای یا پیگیری با اولیا.`,
        targetRoute: '/student-attendance',
        actionLabel: 'بررسی حضور و غیاب',
      });
    }

    if (
      pendingSubstitutions.length > 0 &&
      isPluginEnabled('substitution') &&
      canRoleAccessRoute(activeRole, ['complex_admin', 'principal', 'deputy'])
    ) {
      const first = pendingSubstitutions[0];
      list.push({
        id: 'pending-sub',
        tone: 'amber',
        title: `${toPersianDigits(pendingSubstitutions.length)} کلاس در انتظار معلم جایگزین`,
        detail: `زنگ ${toPersianDigits(first.period)} (${first.absentTeacher.fullName}) — ${toPersianDigits(first.suggestedFreeTeachers.length)} همکار آزاد آماده تخصیص هستند.`,
        targetRoute: '/substitution',
        actionLabel: 'تخصیص فوری جایگزین',
      });
    }

    const attentionLogs = dailyLogs.filter(
      (l) => l.severity === 'urgent' || l.severity === 'attention'
    );
    if (attentionLogs.length > 0 && isPluginEnabled('daily-log')) {
      list.push({
        id: 'daily-log-alert',
        tone: 'sky',
        title: `${toPersianDigits(attentionLogs.length)} گزارش نیازمند پیگیری در دفتر روزانه`,
        detail: `آخرین مورد: ${attentionLogs[0].title}`,
        targetRoute: '/daily-log',
        actionLabel: 'مشاهده دفتر روزانه',
      });
    }

    return list;
  }, [
    consecutiveAbsentStudents,
    pendingSubstitutions,
    dailyLogs,
    isPluginEnabled,
    activeRole,
  ]);

  // Dynamically injected plugin widgets (hiding cleanly when a plugin is disabled!)
  const activeWidgets = useMemo(() => {
    return pluginStatuses.filter(
      (p) =>
        p.installed &&
        p.enabled &&
        p.manifest.dashboardWidget &&
        canRoleAccessRoute(activeRole, p.manifest.allowedRoles)
    );
  }, [pluginStatuses, activeRole]);

  const accentBadgeText =
    activeSchool.accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : activeSchool.accent === 'violet'
        ? 'text-violet-700 dark:text-violet-400'
        : 'text-indigo-700 dark:text-indigo-400';

  const totalImplementedAddons = useMemo(
    () => pluginStatuses.filter((p) => !p.manifest.isCore && p.manifest.implemented).length,
    [pluginStatuses]
  );

  const teachersById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.fullName])),
    [teachers]
  );

  const dashboardSubjectCards = useMemo(
    () =>
      collectSubjectsForContext({
        role: activeRole,
        linkedStudentId: linkedStudent?.id,
        classes,
        schedules,
        teachersById,
        homeworkAssignments,
        homeworkSubmissions,
        flippedLessons,
        onlineExams,
        mockExams,
        mediaResources,
        questionBank,
        gradebookEntries,
        schoolAnnouncements,
        smartContentArchive,
      }),
    [
      activeRole,
      linkedStudent?.id,
      classes,
      schedules,
      teachersById,
      homeworkAssignments,
      homeworkSubmissions,
      flippedLessons,
      onlineExams,
      mockExams,
      mediaResources,
      questionBank,
      gradebookEntries,
      schoolAnnouncements,
      smartContentArchive,
    ]
  );

  const visibleAnnouncements = useMemo(
    () =>
      schoolAnnouncements
        .filter((a) => a.audienceRoles.length === 0 || a.audienceRoles.includes(activeRole))
        .slice(0, 3),
    [schoolAnnouncements, activeRole]
  );

  // ==================== 1. DEDICATED FRIENDLY STUDENT HOME DASHBOARD («پیشخوان دانش‌آموز») ====================
  if (activeRole === 'student') {
    const studentClass = classes.find((c) => c.id === linkedStudent?.classId) ?? classes[0];
    const submittedHwIds = new Set(homeworkSubmissions.map((s) => s.assignmentId));
    const pendingHomeworkCount = homeworkAssignments.filter((a) => !submittedHwIds.has(a.id)).length;
    const completedFlippedCount = flippedTelemetry.filter((t) => Boolean(t.microQuizAttempt)).length;
    const publishedExams = onlineExams.filter((e) => e.status === 'published');
    const submittedExamIds = new Set(onlineExamSubmissions.map((s) => s.examId));
    const pendingExamsCount = publishedExams.filter((e) => !submittedExamIds.has(e.id)).length;
    const liveOrUpcomingSessions = onlineClassSessions.filter((s) => s.status !== 'ended');

    return (
      <div className="space-y-6" data-testid="student-dashboard">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className={`text-xs font-bold ${accentBadgeText}`}>
              پیشخوان اختصاصی دانش‌آموز · {activeSchoolDisplayName}
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {linkedStudent ? `سلام ${linkedStudent.fullName}!` : 'پیشخوان دانش‌آموز'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
              کلاس: {studentClass?.name ?? 'تعیین‌نشده'} · سال تحصیلی{' '}
              {toPersianDigits(activeSchool.academicYear)} ·{' '}
              {formatJalaliDisplay(defaultWorkdayJalali, true)}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-3.5 py-2 text-xs font-semibold text-indigo-800 dark:text-indigo-300 self-start md:self-auto">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>میز یادگیری هوشمند شما</span>
          </div>
        </div>

        {/* Instant Quick Search Bar (Student Panel) */}
        <PortalQuickSearchBar placeholder="جستجوی فوری درس، تکلیف، ویدیو، آزمون یا جزوه..." />

        {/* Pinned School Announcements */}
        {visibleAnnouncements.length > 0 && (
          <section className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-4 space-y-2">
            <div className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
              اطلاعیه‌های مدرسه و دروس
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {visibleAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 p-3 space-y-1"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ann.title}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                    {ann.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick Subject Cards («دروس من») */}
        {dashboardSubjectCards.length > 0 && (
          <section aria-label="دروس من" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                دروس من (ورود یک‌کلیکی به ویدیوها، تکالیف و آزمون هر درس)
              </h2>
              <button
                type="button"
                onClick={() => navigate('/subjects')}
                className="text-xs font-bold brand-text hover:underline"
              >
                مشاهده همه دروس ←
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {dashboardSubjectCards.slice(0, 8).map((card) => (
                <button
                  key={card.subject}
                  type="button"
                  onClick={() => navigate(card.route)}
                  className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[var(--brand-primary)] p-4 space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {card.subject}
                    </span>
                    {card.pendingHomeworkCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tabular-nums shrink-0">
                        {toPersianDigits(card.pendingHomeworkCount)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {toPersianDigits(card.videosCount)} ویدیو · {toPersianDigits(card.homeworkCount)}{' '}
                    تکلیف · {toPersianDigits(card.examsCount)} آزمون
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 4 Student Activity Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">تکالیف و بازی آموزشی</span>
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {toPersianDigits(pendingHomeworkCount)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              تکلیف در انتظار انجام (از {toPersianDigits(homeworkAssignments.length)} تکلیف)
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">کلاس وارونه (ویدئو)</span>
              <PlayCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {toPersianDigits(flippedLessons.length)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              درس ویدئویی · {toPersianDigits(completedFlippedCount)} میکروآزمون تکمیل‌شده
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">آزمون‌های آنلاین فعال</span>
              <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {toPersianDigits(pendingExamsCount)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              آزمون آماده شرکت · {toPersianDigits(onlineExamSubmissions.length)} کارنامه ثبت‌شده
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">کلاس‌های آنلاین</span>
              <Video className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {toPersianDigits(liveOrUpcomingSessions.length)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              جلسه در حال برگزاری یا پیش‌رو
            </div>
          </div>
        </div>

        {/* 4 Core Interactive Student Modules */}
        <section aria-label="فعالیت‌های آموزشی دانش‌آموز" className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            فعالیت‌های درسی من
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isPluginEnabled('homework') && (
              <button
                type="button"
                onClick={() => navigate('/homework')}
                className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-700 p-5 transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>تکالیف آنلاین و بازی آموزشی</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    مشاهده تکالیف جدید، ارسال پاسخ متنی/عکس/صوت/ویدئو و شرکت در بازی‌های آموزشی کلاس.
                  </p>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
              </button>
            )}

            {isPluginEnabled('flipped-video') && (
              <button
                type="button"
                onClick={() => navigate('/flipped-video')}
                className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-700 p-5 transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                    <PlayCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    <span>کلاس وارونه (ویدئوی آموزشی)</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    تماشای کامل فیلم‌های درسی، ثبت «سوال دارم از این دقیقه» و پاسخ به میکروآزمون پایان درس.
                  </p>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
              </button>
            )}

            {isPluginEnabled('online-exams') && (
              <button
                type="button"
                onClick={() => navigate('/online-exams')}
                className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 p-5 transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>آزمون آنلاین و کارنامه آزمون</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    شرکت در آزمون‌های فعال کلاس با تایمر هوشمند و مشاهده کارنامه آزمون‌های انجام‌شده.
                  </p>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
              </button>
            )}

            {isPluginEnabled('online-classroom') && (
              <button
                type="button"
                onClick={() => navigate('/online-classroom')}
                className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-700 p-5 transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                    <Video className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    <span>کلاس آنلاین</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    مشاهده برنامه جلسات آنلاین کلاس و ورود با ثبت خودکار حضور.
                  </p>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
              </button>
            )}
          </div>
        </section>

        {/* Optional Read-Only Helper Links (Own Class Timetable & Media Hub) */}
        {(isPluginEnabled('timetable') || isPluginEnabled('media-hub')) && (
          <section aria-label="امکانات کمکی کلاس" className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              ابزارهای کمکی کلاس (فقط مشاهده)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isPluginEnabled('timetable') && (
                <button
                  type="button"
                  onClick={() => navigate('/timetable')}
                  className="text-right rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 p-4 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        برنامه هفتگی کلاس من
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        مشاهده برنامه زنگ‌های {studentClass?.name ?? 'کلاس'}
                      </div>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              )}

              {isPluginEnabled('media-hub') && (
                <button
                  type="button"
                  onClick={() => navigate('/media-hub')}
                  className="text-right rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 p-4 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        محتوای آموزشی جلسه
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        جزوه‌ها، فایل‌های PDF و منابع درسی کلاس
                      </div>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ==================== 2. DEDICATED PARENT PERFORMANCE OVERVIEW («گزارش جامع عملکرد فرزند») ====================
  if (activeRole === 'parent') {
    const childClass = classes[0];
    const todayByPeriod = new Map<PeriodNumber, AttendanceStatus>();
    let absentTotal = 0;
    let lateTotal = 0;
    let excusedTotal = 0;

    for (const rec of studentAttendance) {
      if (rec.jalaliDate === defaultWorkdayJalali) {
        todayByPeriod.set(rec.period, rec.status);
      }
      if (rec.status === 'absent') absentTotal++;
      else if (rec.status === 'late') lateTotal++;
      else if (rec.status === 'excused') excusedTotal++;
    }

    const todayP1Status: AttendanceStatus = todayByPeriod.get(1) ?? 'present';
    const todayMeta = PARENT_STATUS_BADGE[todayP1Status];

    // Child performance summaries across all 5 read-only monitoring domains
    const numericGrades = gradebookEntries
      .map((g) => g.numericScore)
      .filter((n): n is number => typeof n === 'number');
    const avgGrade20 =
      numericGrades.length > 0
        ? Math.round((numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length) * 10) / 10
        : null;
    const latestGrade = gradebookEntries[0];

    const avgExamScore20 =
      onlineExamSubmissions.length > 0
        ? Math.round(
            (onlineExamSubmissions.reduce((acc, s) => acc + s.finalScore20, 0) /
              onlineExamSubmissions.length) *
              10
          ) / 10
        : null;

    const onlinePresentCount = onlineClassAttendance.filter((a) => a.status === 'present').length;
    const hwSubmittedCount = homeworkSubmissions.length;
    const hwTotalCount = homeworkAssignments.length;
    const flippedCompletedCount = flippedTelemetry.filter((t) => Boolean(t.microQuizAttempt)).length;
    const avgFlippedWatchPct =
      flippedTelemetry.length > 0
        ? Math.round(
            flippedTelemetry.reduce((acc, t) => {
              const watched = Object.values(t.secondStates).filter((s) => s !== 'unwatched').length;
              return acc + Math.min(100, (watched / Math.max(1, t.durationSeconds)) * 100);
            }, 0) / flippedTelemetry.length
          )
        : 0;

    return (
      <PrintShell
        school={activeSchool}
        documentTitle={`گزارش جامع عملکرد تحصیلی — ${linkedStudent?.fullName ?? 'فرزند'}`}
        subtitle={`کلاس: ${childClass?.name ?? '—'} | سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
      >
        <div className="space-y-6" data-testid="parent-dashboard">
          <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <div className={`text-xs font-bold ${accentBadgeText}`}>
                گزارش جامع عملکرد فرزند · {activeSchoolDisplayName}
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {linkedStudent ? `گزارش عملکرد ${linkedStudent.fullName}` : 'پنل خانواده'}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                سال تحصیلی {toPersianDigits(activeSchool.academicYear)} · آخرین روز کاری:{' '}
                {formatJalaliDisplay(defaultWorkdayJalali, true)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>نظارت اختصاصی ولی (فقط مشاهده)</span>
              </div>
              <PrintButtons documentLabel="گزارش جامع عملکرد فرزند" compact />
            </div>
          </div>

          {linkedStudent ? (
            <>
              {/* Instant Quick Search Bar (Parent Panel) */}
              <PortalQuickSearchBar placeholder="جستجوی فوری در دروس فرزند، تکالیف، ویدیوها، آزمون‌ها، اطلاعیه‌ها و پیام‌ها..." />

              {/* Pinned School Announcements for Parents */}
              {visibleAnnouncements.length > 0 && (
                <section className="no-print rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-4 space-y-2">
                  <div className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
                    اطلاعیه‌های رسمی مدرسه
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {visibleAnnouncements.map((ann) => (
                      <div
                        key={ann.id}
                        className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 p-3 space-y-1"
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {ann.title}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                          {ann.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Child's Subject Hub Quick Strip */}
              {dashboardSubjectCards.length > 0 && (
                <section aria-label="دروس فرزند" className="no-print space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      دروس فرزند (نمای تفکیکی تکالیف، ویدیوها و نمرات هر درس)
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('/subjects')}
                      className="text-xs font-bold brand-text hover:underline"
                    >
                      مشاهده همه دروس ←
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dashboardSubjectCards.slice(0, 8).map((card) => (
                      <button
                        key={card.subject}
                        type="button"
                        onClick={() => navigate(card.route)}
                        className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[var(--brand-primary)] p-3.5 space-y-1.5 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {card.subject}
                          </span>
                          {card.pendingHomeworkCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tabular-nums shrink-0">
                              {toPersianDigits(card.pendingHomeworkCount)} مانده
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {toPersianDigits(card.homeworkCount)} تکلیف · {toPersianDigits(card.gradesCount)}{' '}
                          نمره
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Prominent Private Parent-Staff Chat CTA Banner */}
              {isPluginEnabled('parent-staff-chat') && (
                <section
                  aria-label="گفت‌وگوی اختصاصی با معلم و مدیر"
                  className="no-print rounded-2xl bg-gradient-to-l from-indigo-600 to-indigo-700 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-extrabold">
                          گفت‌وگوی اختصاصی با معلم کلاس و مدیر مدرسه
                        </h2>
                        {unreadParentChatCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500 text-white text-xs font-bold tabular-nums">
                            {toPersianDigits(unreadParentChatCount)} پیام خوانده‌نشده
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-indigo-100 leading-5">
                        پیام‌های محرمانه شما صرفاً میان شما و معلم/مدیر مدرسه تبادل می‌شود و در حساب
                        دانش‌آموز نمایش داده نمی‌شود.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/parent-staff-chat')}
                    className="min-h-[44px] px-4 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap transition-colors"
                  >
                    <span>ورود به گفت‌وگوی اختصاصی</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </section>
              )}

              {/* Child Identity & Today Summary Cards */}
              <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    مشخصات فرزند
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                    {linkedStudent.fullName}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    کلاس: {childClass?.name ?? 'تعیین‌نشده'} · کد ملی:{' '}
                    {toPersianDigits(linkedStudent.nationalId)}
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    حضور حضوری امروز (زنگ اول)
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-sm font-bold ${todayMeta.badgeClass}`}
                    >
                      {todayMeta.label}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    غیبت: {toPersianDigits(absentTotal)} · تاخیر: {toPersianDigits(lateTotal)} ·
                    موجه: {toPersianDigits(excusedTotal)}
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    عملکرد نمرات و آزمون‌های آنلاین
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {avgGrade20 !== null
                      ? `${toPersianDigits(avgGrade20)} از ۲۰`
                      : latestGrade?.descriptiveLevel ?? 'ثبت‌شده'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    آزمون آنلاین: {toPersianDigits(onlineExamSubmissions.length)} کارنامه
                    {avgExamScore20 !== null ? ` (میانگین ${toPersianDigits(avgExamScore20)})` : ''}
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    تکالیف، کلاس وارونه و تشویق‌ها
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    تکالیف: {toPersianDigits(hwSubmittedCount)} از {toPersianDigits(hwTotalCount)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    تماشای ویدئو: {formatPersianPercent(avgFlippedWatchPct)} · لوح تقدیر:{' '}
                    {toPersianDigits(studentRewards.length)} مورد
                  </div>
                </div>
              </div>

              {/* Today's 4-Period Read-Only Strip */}
              <section className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        وضعیت ۴ زنگ امروز ({formatJalaliDisplay(defaultWorkdayJalali, true)})
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        حضور آنلاین ثبت‌شده: {toPersianDigits(onlinePresentCount)} جلسه از{' '}
                        {toPersianDigits(onlineClassSessions.length)} جلسه کلاس.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isPluginEnabled('student-attendance') && (
                      <button
                        type="button"
                        onClick={() => navigate('/student-attendance')}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 transition-colors whitespace-nowrap"
                      >
                        <span>گزارش حضور حضوری</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    {isPluginEnabled('online-classroom') && (
                      <button
                        type="button"
                        onClick={() => navigate('/online-classroom')}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold px-3.5 py-2 transition-colors whitespace-nowrap"
                      >
                        <span>گزارش حضور آنلاین</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([1, 2, 3, 4] as PeriodNumber[]).map((p) => {
                    const st = todayByPeriod.get(p) ?? 'present';
                    const badge = PARENT_STATUS_BADGE[st];
                    return (
                      <div
                        key={p}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          زنگ {toPersianDigits(p)}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 5 Read-Only Parent Monitoring Cards */}
              <section
                aria-label="بخش‌های نظارت تحصیلی فرزند"
                className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
              >
                {isPluginEnabled('gradebook') && (
                  <button
                    type="button"
                    onClick={() => navigate('/gradebook')}
                    className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 p-4 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        نمرات و کارنامه توصیفی فرزند
                      </span>
                      <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(gradebookEntries.length)} رکورد ثبت‌شده · مشاهده روند ماهانه و
                      چاپ کارنامه (فقط مشاهده)
                    </p>
                  </button>
                )}

                {isPluginEnabled('online-exams') && (
                  <button
                    type="button"
                    onClick={() => navigate('/online-exams')}
                    className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 p-4 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        نتایج و کارنامه آزمون‌های آنلاین
                      </span>
                      <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(onlineExamSubmissions.length)} کارنامه آماده مشاهده · بدون
                      امکان شرکت به‌جای دانش‌آموز
                    </p>
                  </button>
                )}

                {isPluginEnabled('homework') && (
                  <button
                    type="button"
                    onClick={() => navigate('/homework')}
                    className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 p-4 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        گزارش انجام تکالیف فرزند
                      </span>
                      <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(hwSubmittedCount)} ارسال‌شده از {toPersianDigits(hwTotalCount)}{' '}
                      تکلیف · مشاهده بازخورد معلم (فقط مشاهده)
                    </p>
                  </button>
                )}

                {isPluginEnabled('flipped-video') && (
                  <button
                    type="button"
                    onClick={() => navigate('/flipped-video')}
                    className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 p-4 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        گزارش تماشای کلاس وارونه
                      </span>
                      <PlayCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      میانگین تماشا {formatPersianPercent(avgFlippedWatchPct)} ·{' '}
                      {toPersianDigits(flippedCompletedCount)} میکروآزمون انجام‌شده (فقط مشاهده)
                    </p>
                  </button>
                )}

                {isPluginEnabled('rewards') && (
                  <button
                    type="button"
                    onClick={() => navigate('/rewards')}
                    className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 p-4 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        تشویق‌ها و لوح‌های تقدیر فرزند
                      </span>
                      <Award className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(studentRewards.length)} نشان و لوح تقدیر · قابل چاپ در قطع A4 و
                      A5
                    </p>
                  </button>
                )}

                {isPluginEnabled('timetable') && (
                  <button
                    type="button"
                    onClick={() => navigate('/timetable')}
                    className="text-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 p-4 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        برنامه هفتگی کلاس فرزند
                      </span>
                      <CalendarDays className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      مشاهده و چاپ برنامه هفتگی {childClass?.name ?? 'کلاس'}
                    </p>
                  </button>
                )}
              </section>

              {/* Print-Only Comprehensive Child Performance Report (A4 & A5) */}
              <div className="print-only space-y-3">
                <table>
                  <thead>
                    <tr>
                      <th>بخش ارزیابی</th>
                      <th>خلاصه وضعیت ثبت‌شده</th>
                      <th>جزئیات تکمیلی</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-bold">مشخصات دانش‌آموز</td>
                      <td>{linkedStudent.fullName}</td>
                      <td>
                        کلاس {childClass?.name ?? '—'} · کد ملی{' '}
                        {toPersianDigits(linkedStudent.nationalId)}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold">حضور و غیاب حضوری</td>
                      <td>امروز زنگ اول: {todayMeta.label}</td>
                      <td>
                        کل سوابق: {toPersianDigits(absentTotal)} غیبت · {toPersianDigits(lateTotal)}{' '}
                        تاخیر · {toPersianDigits(excusedTotal)} موجه
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold">حضور در کلاس‌های آنلاین</td>
                      <td>
                        {toPersianDigits(onlinePresentCount)} از{' '}
                        {toPersianDigits(onlineClassSessions.length)} جلسه
                      </td>
                      <td>بر اساس گزارش رسمی ورود دانش‌آموز به کلاس آنلاین</td>
                    </tr>
                    <tr>
                      <td className="font-bold">نمرات و کارنامه توصیفی</td>
                      <td>
                        {avgGrade20 !== null
                          ? `میانگین ${toPersianDigits(avgGrade20)} از ۲۰`
                          : latestGrade?.descriptiveLevel ?? 'ثبت‌شده'}
                      </td>
                      <td>تعداد رکورد ارزشیابی: {toPersianDigits(gradebookEntries.length)}</td>
                    </tr>
                    <tr>
                      <td className="font-bold">آزمون‌های آنلاین</td>
                      <td>{toPersianDigits(onlineExamSubmissions.length)} کارنامه ثبت‌شده</td>
                      <td>
                        {avgExamScore20 !== null
                          ? `میانگین نمره آزمون‌ها: ${toPersianDigits(avgExamScore20)} از ۲۰`
                          : 'هنوز آزمونی ثبت نشده است'}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold">تکالیف آنلاین و کلاس وارونه</td>
                      <td>
                        تکالیف: {toPersianDigits(hwSubmittedCount)} از {toPersianDigits(hwTotalCount)}
                      </td>
                      <td>
                        میانگین تماشای ویدئو: {formatPersianPercent(avgFlippedWatchPct)} · میکروآزمون:{' '}
                        {toPersianDigits(flippedCompletedCount)} مورد
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold">تشویق‌ها و لوح‌های تقدیر</td>
                      <td>{toPersianDigits(studentRewards.length)} مورد</td>
                      <td>
                        {studentRewards.length > 0
                          ? studentRewards
                              .slice(0, 3)
                              .map((r) => r.badgeTitle)
                              .join('، ')
                          : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-600 dark:text-slate-300">
              اطلاعات دانش‌آموز متصل به این حساب یافت نشد. لطفاً با دفتر مدرسه تماس بگیرید.
            </div>
          )}
        </div>
      </PrintShell>
    );
  }

  // ==================== 3. ADMIN / PRINCIPAL / DEPUTY / TEACHER DASHBOARD ====================
  const isTeacher = activeRole === 'teacher';

  return (
    <PrintShell
      school={activeSchool}
      documentTitle={
        isTeacher
          ? `گزارش خلاصه کلاس‌های ${linkedTeacher?.fullName ?? 'معلم'}`
          : 'گزارش خلاصه مدیریتی داشبورد مدرسه'
      }
      subtitle={`آخرین روز کاری: ${formatJalaliDisplay(defaultWorkdayJalali, true)} | سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
    >
      <div className="space-y-6">
        {/* Hero Overview Strip */}
        <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className={`text-xs font-bold ${accentBadgeText}`}>
              {activeSchool.subtitle} · سال تحصیلی {toPersianDigits(activeSchool.academicYear)}
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {activeSchoolDisplayName}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
              {isTeacher && linkedTeacher
                ? `معلم: ${linkedTeacher.fullName} (${linkedTeacher.specialty}) · آخرین روز کاری فعال: ${formatJalaliDisplay(defaultWorkdayJalali, true)}`
                : `مدیر واحد: ${activeSchool.principalName} · آخرین روز کاری فعال: ${formatJalaliDisplay(defaultWorkdayJalali, true)}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <PrintButtons documentLabel="خلاصه داشبورد مدرسه" compact />
            {roleDef.canEditSchoolSettings && activeRole !== 'super_admin' && (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
              >
                <Building2 className="w-4 h-4 shrink-0 brand-text" />
                لوگو و سربرگ مدرسه
              </button>
            )}
            {roleDef.canManageDirectory && (
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
              >
                <GraduationCap className="w-4 h-4 shrink-0 brand-text" />
                {getSectionTitle('directory', 'مدیریت دانش‌آموزان و کادر')}
              </button>
            )}
            {roleDef.canManageAddons && (
              <button
                type="button"
                onClick={() => navigate('/addons')}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl brand-btn text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
              >
                <Blocks className="w-4 h-4 shrink-0" />
                {getSectionTitle('addons', 'مدیریت بسته‌های الحاقی')}
              </button>
            )}
          </div>
        </div>

        {/* 4 Active-School Daily KPI Cards */}
        <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">
                {isTeacher ? 'نرخ حضور کلاس‌های من' : 'نرخ حضور امروز'}
              </span>
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatPersianPercent(attendanceStats.attendanceRatePercent)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(attendanceStats.present)} حاضر · {toPersianDigits(attendanceStats.absent)}{' '}
              غایب · {toPersianDigits(attendanceStats.late)} تاخیر · {toPersianDigits(attendanceStats.excused)}{' '}
              موجه
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">
                {isTeacher ? 'دانش‌آموزان کلاس‌های من' : 'جمعیت دانش‌آموزی'}
              </span>
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {toPersianDigits(activeStudents.length)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {isTeacher
                ? `در ${toPersianDigits(classes.length)} کلاس تحت تدریس شما`
                : `در ${toPersianDigits(classes.length)} کلاس فعال`}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">
                {isTeacher ? 'زنگ‌های تدریس هفتگی من' : 'کادر و پوشش جایگزین'}
              </span>
              <UserPlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {isTeacher ? toPersianDigits(schedules.length) : toPersianDigits(activeTeachers.length)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {isTeacher
                ? `${toPersianDigits(activeSchool.activeWorkdays.length)} روز کاری در هفته`
                : pendingSubstitutions.length > 0
                  ? `${toPersianDigits(pendingSubstitutions.length)} زنگ در انتظار جایگزین`
                  : 'تمام کلاس‌ها تحت پوشش کامل'}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">
                {isTeacher ? 'دفتر وقایع کلاس‌های من' : 'دفتر وقایع روزانه'}
              </span>
              <ClipboardList className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {toPersianDigits(dailyLogs.length)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(dailyLogs.filter((l) => l.category === 'early_dismissal').length)}{' '}
              مورد مرخصی ساعتی ثبت‌شده
            </div>
          </div>
        </div>

        {/* Teacher Subject-Centric Hub & Live Homework Submission Tracker */}
        {isTeacher && (
          <section className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  کلاس‌ها و دروس تدریسی من
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/subjects')}
                  className="text-xs font-bold brand-text hover:underline"
                >
                  باز کردن میز درس‌محور ←
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {dashboardSubjectCards.slice(0, 6).map((card) => (
                  <button
                    key={card.subject}
                    type="button"
                    onClick={() => navigate(card.route)}
                    className="text-right rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-[var(--brand-primary)] p-3 space-y-1 transition-colors"
                  >
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {card.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(card.videosCount)} ویدیو · {toPersianDigits(card.homeworkCount)}{' '}
                      تکلیف
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  وضعیت لحظه‌ای تحویل تکالیف دانش‌آموزان
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/smart-archive')}
                  className="text-xs font-bold brand-text hover:underline"
                >
                  آرشیو هوشمند محتوا ←
                </button>
              </div>
              {notificationCenter.teacherHomeworkTrackers.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  تکلیف فعالی ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {notificationCenter.teacherHomeworkTrackers.slice(0, 4).map((tr) => (
                    <button
                      key={tr.assignmentId}
                      type="button"
                      onClick={() => navigate(buildSubjectRoute(tr.subject, 'homework'))}
                      className="w-full text-right rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 p-3 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {tr.title} ({tr.subject})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {tr.className} · مهلت {toPersianDigits(tr.dueDateJalali)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                          {toPersianDigits(tr.submittedStudents.length)} تحویل
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                          {toPersianDigits(tr.missingStudents.length)} مانده
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Automated Smart Alert Cards */}
        {alerts.length > 0 && (
          <section aria-label="هشدارهای هوشمند روزانه" className="no-print space-y-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              هشدارهای هوشمند و اقدامات فوری
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {alerts.map((alert) => {
                const cardStyle =
                  alert.tone === 'rose'
                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/70 text-rose-950 dark:text-rose-100'
                    : alert.tone === 'amber'
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/70 text-amber-950 dark:text-amber-100'
                      : 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/70 text-sky-950 dark:text-sky-100';

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${cardStyle}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-1" />
                      <div>
                        <div className="text-sm font-bold">{alert.title}</div>
                        <p className="mt-1 text-xs leading-5 opacity-90">{alert.detail}</p>
                      </div>
                    </div>
                    {alert.targetRoute && alert.actionLabel && (
                      <button
                        type="button"
                        onClick={() => navigate(alert.targetRoute!)}
                        className="self-start inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4 hover:opacity-80"
                      >
                        <span>{alert.actionLabel}</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Dynamically Injected Active Add-on Widgets */}
        <section aria-label="ابزارک‌های بسته‌های الحاقی فعال" className="no-print space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              ماژول‌های عملیاتی فعال ({toPersianDigits(activeWidgets.length)} بسته)
            </h2>
            {roleDef.canManageAddons && (
              <button
                type="button"
                onClick={() => navigate('/addons')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                شخصی‌سازی بسته‌ها
              </button>
            )}
          </div>

          {activeWidgets.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              هیچ بسته عملیاتی برای نقش فعلی در این مدرسه فعال نیست. تمامی رکوردهای پیشین شما محفوظ
              هستند.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeWidgets.map((status) => {
                const WidgetComponent = status.manifest.dashboardWidget;
                return WidgetComponent ? <WidgetComponent key={status.manifest.id} /> : null;
              })}
            </div>
          )}
        </section>

        {/* Complex-Admin Exclusive 3-School Comparison Widget («مقایسه ۳ مدرسه») */}
        {roleDef.canViewComplexComparison && complexComparison.length > 0 && (
          <section
            aria-label="مقایسه ۳ مدرسه مجموعه"
            className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    مقایسه ۳ مدرسه مجموعه
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    نمای تجمیعی ویژه مدیر کل مجموعه — داده‌های هر واحد کاملاً ایزوله نگهداری می‌شوند.
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 tabular-nums">
                <Users className="w-3.5 h-3.5" />
                مجموع دانش‌آموزان:{' '}
                {toPersianDigits(
                  complexComparison.reduce((acc, row) => acc + row.studentCount, 0)
                )}{' '}
                نفر
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">واحد آموزشی</th>
                    <th className="py-2.5 px-3 text-center">دانش‌آموز / کلاس</th>
                    <th className="py-2.5 px-3 text-center">نرخ حضور امروز</th>
                    <th className="py-2.5 px-3 text-center">نیاز جایگزین</th>
                    <th className="py-2.5 px-3 text-center">بسته‌های فعال</th>
                    <th className="py-2.5 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {complexComparison.map((row) => {
                    const isCurrent = row.school.id === activeSchoolId;
                    return (
                      <tr
                        key={row.school.id}
                        className={isCurrent ? 'bg-slate-50/90 dark:bg-slate-800/40' : ''}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {row.school.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            مدیر: {row.school.principalName}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {toPersianDigits(row.studentCount)} نفر · {toPersianDigits(row.classCount)}{' '}
                          کلاس
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700 dark:text-emerald-400">
                          {formatPersianPercent(row.presentRatePercent)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={
                              row.pendingSubstitutionsToday > 0
                                ? 'font-bold text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            {toPersianDigits(row.pendingSubstitutionsToday)} مورد
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {toPersianDigits(row.enabledAddonsCount)} از{' '}
                          {toPersianDigits(totalImplementedAddons)}
                        </td>
                        <td className="py-3 px-3 text-left">
                          {isCurrent ? (
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              واحد فعال
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveSchoolId(row.school.id)}
                              className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              ورود به پنل
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Print-Only Admin / Teacher Executive Summary (A4 & A5) */}
        <div className="print-only space-y-4">
          <table>
            <thead>
              <tr>
                <th>شاخص اجرایی</th>
                <th>مقدار</th>
                <th>توضیحات</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold">نرخ حضور امروز</td>
                <td>{formatPersianPercent(attendanceStats.attendanceRatePercent)}</td>
                <td>
                  {toPersianDigits(attendanceStats.present)} حاضر ·{' '}
                  {toPersianDigits(attendanceStats.absent)} غایب ·{' '}
                  {toPersianDigits(attendanceStats.late)} تاخیر ·{' '}
                  {toPersianDigits(attendanceStats.excused)} موجه
                </td>
              </tr>
              <tr>
                <td className="font-bold">جمعیت دانش‌آموزی و کلاس‌ها</td>
                <td>{toPersianDigits(activeStudents.length)} دانش‌آموز</td>
                <td>در {toPersianDigits(classes.length)} کلاس فعال</td>
              </tr>
              <tr>
                <td className="font-bold">کادر آموزشی و پوشش جایگزین</td>
                <td>{toPersianDigits(activeTeachers.length)} همکار</td>
                <td>
                  {pendingSubstitutions.length > 0
                    ? `${toPersianDigits(pendingSubstitutions.length)} زنگ نیازمند جایگزین`
                    : 'پوشش کامل کلاس‌ها'}
                </td>
              </tr>
              <tr>
                <td className="font-bold">دفتر وقایع روزانه</td>
                <td>{toPersianDigits(dailyLogs.length)} رکورد</td>
                <td>
                  {toPersianDigits(
                    dailyLogs.filter((l) => l.category === 'early_dismissal').length
                  )}{' '}
                  مرخصی ساعتی
                </td>
              </tr>
            </tbody>
          </table>

          {roleDef.canViewComplexComparison && complexComparison.length > 0 && (
            <div>
              <h3 className="font-bold text-sm mb-2">مقایسه مدارس مجموعه</h3>
              <table>
                <thead>
                  <tr>
                    <th>واحد آموزشی</th>
                    <th>دانش‌آموز / کلاس</th>
                    <th>نرخ حضور</th>
                    <th>نیاز جایگزین</th>
                  </tr>
                </thead>
                <tbody>
                  {complexComparison.map((row) => (
                    <tr key={row.school.id}>
                      <td className="font-semibold">{row.school.name}</td>
                      <td>
                        {toPersianDigits(row.studentCount)} نفر / {toPersianDigits(row.classCount)}{' '}
                        کلاس
                      </td>
                      <td>{formatPersianPercent(row.presentRatePercent)}</td>
                      <td>{toPersianDigits(row.pendingSubstitutionsToday)} مورد</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PrintShell>
  );
};

