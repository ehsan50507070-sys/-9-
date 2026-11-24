// Phase 7 Plugin: Teacher Professional Development, Anti-Cheat Quizzes, Auto-Certificates & 5-Tier Ranking
import React, { useMemo, useState } from 'react';
import {
  Archive,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Edit3,
  Eye,
  Globe,
  Grid2x2Check,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useSectionLabel } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { triggerPrint, type PrintPaperSize } from '../../core/print/printService';
import { ErrorBoundary } from '../../core/ui/ErrorBoundary';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import type {
  TeacherDevCertificate,
  TeacherDevCourse,
  TeacherDevRankingPrivacyMode,
} from '../../types/domain';
import { ComplexComparisonTab } from './ComplexComparisonTab';
import { CourseBuilderModal } from './CourseBuilderModal';
import { ParticipationMatrixTab } from './ParticipationMatrixTab';
import { RankingLeaderboardTab } from './RankingLeaderboardTab';
import { TeacherDevPrintView, type TeacherDevPrintJob } from './TeacherDevPrintView';
import { TeacherLearningWorkspace } from './TeacherLearningWorkspace';
import {
  CONTENT_TYPE_LABELS,
  REQUIREMENT_LABELS,
  type ParticipationMatrixResult,
} from './teacherDevHelpers';

type PageTabId = 'courses' | 'learning' | 'matrix' | 'ranking' | 'complex';

const TeacherDevelopmentInner: React.FC = () => {
  const {
    session,
    activeSchool,
    activeSchoolId,
    setActiveSchoolId,
    activeRole,
    roleDef,
    linkedTeacher,
    teachers,
    tdCourses,
    tdProgress,
    tdCertificates,
    tdLeaderboard,
    complexPhase7Dataset,
    upsertTeacherDevCourse,
    archiveTeacherDevCourse,
    deleteTeacherDevCourse,
    completeTeacherDevChapter,
    submitTeacherDevQuizAttempt,
    saveTeacherDevPrivacySettings,
  } = useSchoolData();

  const { getSectionTitle } = useSectionLabel();
  const { showToast } = useToast();

  const isTeacher = activeRole === 'teacher';
  const isManager = roleDef.canViewTeacherDevMatrix; // complex_admin, principal, deputy
  const canManageCourses = roleDef.canManageTeacherDevCourses; // complex_admin, principal
  const canPublishAll = roleDef.canPublishAllSchoolsCourses; // complex_admin ONLY
  const canConfigurePrivacy = roleDef.canConfigureTeacherDevPrivacy; // complex_admin, principal
  const canViewComplex = Boolean(complexPhase7Dataset && roleDef.canViewComplexComparison);

  const defaultTab: PageTabId = isTeacher ? 'learning' : 'courses';
  const [activeTab, setActiveTab] = useState<PageTabId>(defaultTab);
  const [courseFilter, setCourseFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TeacherDevCourse | null>(null);
  const [printJob, setPrintJob] = useState<TeacherDevPrintJob | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Strict RBAC guard: parent & student have zero access
  if (!session || !roleDef.canAccessTeacherDev) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
        <Lock className="w-8 h-8 mx-auto text-slate-400" />
        <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
          عدم دسترسی به بخش دانش‌افزایی معلمین
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          این سامانه اختصاصاً برای کادر آموزشی و مدیریت مدرسه طراحی شده است.
        </p>
      </div>
    );
  }

  const pageTitle = getSectionTitle('teacher-development', 'دانش‌افزایی و رتبه‌بندی معلمین');

  // Ensure activeTab is valid for current role
  const resolvedTab: PageTabId = useMemo(() => {
    if (isTeacher && (activeTab === 'courses' || activeTab === 'matrix' || activeTab === 'complex')) {
      return 'learning';
    }
    if (!canViewComplex && activeTab === 'complex') {
      return 'courses';
    }
    if (!canManageCourses && !isTeacher && activeTab === 'learning') {
      return 'courses';
    }
    return activeTab;
  }, [activeTab, isTeacher, canViewComplex, canManageCourses]);

  const filteredManagedCourses = useMemo(() => {
    return tdCourses.filter((c) => {
      if (courseFilter === 'all') return true;
      return c.status === courseFilter;
    });
  }, [tdCourses, courseFilter]);

  const runPrintJob = (job: TeacherDevPrintJob) => {
    setPrintJob(job);
    const orientation =
      job.kind === 'matrix' || (job.kind === 'certificate' && job.size === 'a5')
        ? 'landscape'
        : 'portrait';
    setTimeout(() => {
      triggerPrint({
        size: job.size,
        orientation,
      });
    }, 60);
  };

  const handlePrintCertificate = (cert: TeacherDevCertificate, size: PrintPaperSize) => {
    runPrintJob({ kind: 'certificate', size, certificate: cert });
  };

  const handlePrintTeacherTranscript = (targetTeacherId: string, size: PrintPaperSize) => {
    const standing =
      tdLeaderboard.visibleRows.find((r) => r.teacherId === targetTeacherId) ??
      (tdLeaderboard.ownStanding?.teacherId === targetTeacherId
        ? tdLeaderboard.ownStanding
        : null);
    if (!standing) {
      showToast('اطلاعات کارنامه این همکار یافت نشد.', 'error');
      return;
    }
    const certs = tdCertificates.filter((c) => c.teacherId === targetTeacherId);
    runPrintJob({ kind: 'transcript', size, standing, certificates: certs });
  };

  const handlePrintMatrix = (
    matrix: ParticipationMatrixResult,
    filterLabel: string,
    size: PrintPaperSize
  ) => {
    runPrintJob({ kind: 'matrix', size, matrix, filterLabel });
  };

  const handleSaveCourse = async (course: TeacherDevCourse, publishAll: boolean) => {
    const res = await upsertTeacherDevCourse(course, publishAll);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ذخیره دوره ناموفق بود.', 'error');
      return;
    }
    setBuilderOpen(false);
    setEditingCourse(null);
    showToast(
      publishAll
        ? `دوره «${course.title}» با موفقیت در هر ۳ مدرسه منتشر شد.`
        : `دوره «${course.title}» با موفقیت برای ${activeSchool.name} ذخیره شد.`
    );
  };

  const handleToggleArchive = async (course: TeacherDevCourse) => {
    const applyAll = course.scope === 'all' && canPublishAll;
    const res = await archiveTeacherDevCourse(course.id, applyAll);
    if (!res.ok) {
      showToast(res.errorFa ?? 'تغییر وضعیت دوره ناموفق بود.', 'error');
      return;
    }
    showToast(
      course.status === 'active'
        ? `دوره «${course.title}» بایگانی شد (سوابق و گواهینامه‌های صادرشده محفوظ ماند).`
        : `دوره «${course.title}» مجدداً فعال شد.`,
      'info'
    );
  };

  const handleDeleteCourse = async (course: TeacherDevCourse) => {
    const applyAll = course.scope === 'all' && canPublishAll;
    const res = await deleteTeacherDevCourse(course.id, applyAll);
    setDeleteConfirmId(null);
    if (!res.ok) {
      showToast(res.errorFa ?? 'حذف دوره مجاز نیست.', 'error');
      return;
    }
    showToast(`دوره «${course.title}» حذف شد.`, 'info');
  };

  const handleChangePrivacy = (mode: TeacherDevRankingPrivacyMode) => {
    const res = saveTeacherDevPrivacySettings(mode);
    if (!res.ok) {
      showToast(res.errorFa ?? 'تغییر تنظیمات محرمانگی ناموفق بود.', 'error');
      return;
    }
    showToast('سیاست محرمانگی رتبه‌بندی معلمین این مدرسه با موفقیت به‌روزرسانی شد.');
  };

  const handleCompleteChapter = (courseId: string, chapterId: string) => {
    const res = completeTeacherDevChapter(courseId, chapterId);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ثبت مطالعه فصل ناموفق بود.', 'error');
      return;
    }
    showToast('تکمیل مطالعه فصل با موفقیت ثبت شد.');
  };

  const handleSubmitQuiz = (params: {
    courseId: string;
    seed: string;
    answers: Record<string, string>;
  }) => {
    const res = submitTeacherDevQuizAttempt(params);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ثبت آزمون ناموفق بود.', 'error');
    } else if (res.passed && res.certificate) {
      showToast(
        `تبریک! نمره ${toPersianDigits(res.scorePercent ?? 100)}٪ کسب شد و گواهینامه شماره ${toPersianDigits(res.certificate.serialNumber)} صادر گردید.`
      );
    } else {
      showToast(
        `نمره کسب‌شده: ${toPersianDigits(res.scorePercent ?? 0)}٪. می‌توانید پس از مرور فصل‌ها مجدداً تلاش کنید.`,
        'info'
      );
    }
    return res;
  };

  // Preview teacher identity for admins/principals
  const previewTeacher = teachers[0];

  const tabs: Array<{ id: PageTabId; label: string; icon: React.ReactNode }> = isTeacher
    ? [
        {
          id: 'learning',
          label: 'دوره‌ها، مطالعه و گواهینامه‌ها',
          icon: <BookOpen className="w-4 h-4" />,
        },
        {
          id: 'ranking',
          label: 'سطح ۵گانه و مسیر رشد من',
          icon: <Award className="w-4 h-4" />,
        },
      ]
    : [
        {
          id: 'courses',
          label: canManageCourses ? 'مدیریت دوره‌ها و کتاب‌ها' : 'دوره‌ها و کتاب‌های فعال',
          icon: <BookOpen className="w-4 h-4" />,
        },
        {
          id: 'matrix',
          label: 'ماتریس مشارکت مدرسه',
          icon: <Grid2x2Check className="w-4 h-4" />,
        },
        {
          id: 'ranking',
          label: canConfigurePrivacy ? 'رتبه‌بندی ۵سطحی و محرمانگی' : 'رتبه‌بندی ۵سطحی مدرسه',
          icon: <Award className="w-4 h-4" />,
        },
        ...(canViewComplex
          ? [
              {
                id: 'complex' as PageTabId,
                label: 'مقایسه ۳ مدرسه',
                icon: <BarChart3 className="w-4 h-4" />,
              },
            ]
          : []),
        ...(canManageCourses
          ? [
              {
                id: 'learning' as PageTabId,
                label: 'پیش‌نمایش نمای معلم',
                icon: <Eye className="w-4 h-4" />,
              },
            ]
          : []),
      ];

  return (
    <div className="space-y-6">
      {/* Screen UI (hidden when printing official certificate/transcript/matrix) */}
      <div className="no-print space-y-6">
        {/* Top Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {pageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isTeacher
                ? `${activeSchool.name} · مطالعه گام‌به‌گام، آزمون کوتاه ضدتقلب و صدور آنی گواهینامه ضمن خدمت`
                : `${activeSchool.name} · مدیریت دوره‌های ضمن خدمت، ماتریس مشارکت کادر و نظام رتبه‌بندی ۵سطحی`}
            </p>
          </div>

          {canManageCourses && (
            <button
              type="button"
              onClick={() => {
                setEditingCourse(null);
                setBuilderOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف دوره یا کتاب جدید</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto"
          role="tablist"
          aria-label="بخش‌های دانش‌افزایی معلمین"
        >
          {tabs.map((tab) => {
            const active = resolvedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Course & Book Management (complex_admin, principal, deputy read-only) */}
        {resolvedTab === 'courses' && isManager && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'active', label: 'دوره‌های فعال' },
                    { id: 'archived', label: 'بایگانی‌شده' },
                    { id: 'all', label: 'همه' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCourseFilter(f.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      courseFilter === f.id
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {toPersianDigits(filteredManagedCourses.length)} دوره / کتاب در {activeSchool.name}
              </div>
            </div>

            {filteredManagedCourses.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                دوره‌ای در این وضعیت ثبت نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredManagedCourses.map((course) => {
                  const completedCertsCount = tdCertificates.filter(
                    (c) => c.courseId === course.id
                  ).length;
                  const activeTeachersCount = teachers.filter((t) => t.active).length;
                  const completionPct =
                    activeTeachersCount > 0
                      ? Math.round((completedCertsCount / activeTeachersCount) * 100)
                      : 0;
                  const canEditThisCourse =
                    canManageCourses && (course.scope !== 'all' || canPublishAll);

                  return (
                    <div
                      key={course.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            {CONTENT_TYPE_LABELS[course.contentType]} ·{' '}
                            <strong
                              className={
                                course.requirement === 'mandatory'
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-indigo-700 dark:text-indigo-300'
                              }
                            >
                              {REQUIREMENT_LABELS[course.requirement]}
                            </strong>{' '}
                            · {toPersianDigits(course.inServiceHours)} ساعت
                          </span>

                          {course.scope === 'all' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                              <Globe className="w-3.5 h-3.5" />
                              <span>منتشرشده در هر ۳ مدرسه</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>اختصاصی همین مدرسه</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {course.description}
                        </p>

                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {toPersianDigits(course.chapters.length)} فصل ·{' '}
                          {toPersianDigits(course.quizQuestions.length)} سوال آزمون (حد نصاب{' '}
                          {toPersianDigits(course.passingScorePercent)}٪) · مهلت{' '}
                          {toPersianDigits(course.deadlineJalali)}
                        </div>

                        {/* School Completion Progress */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] tabular-nums">
                            <span className="text-slate-600 dark:text-slate-300">
                              تکمیل در {activeSchool.name}: {toPersianDigits(completedCertsCount)}{' '}
                              از {toPersianDigits(activeTeachersCount)} همکار
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {toPersianDigits(completionPct)}٪
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${completionPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          ایجادکننده: {course.createdByName}
                        </span>

                        {canEditThisCourse ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCourse(course);
                                setBuilderOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>ویرایش</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleArchive(course)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {course.status === 'active' ? (
                                <>
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>بایگانی</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>فعال‌سازی</span>
                                </>
                              )}
                            </button>
                            {deleteConfirmId === course.id ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteCourse(course)}
                                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 text-xs font-bold"
                              >
                                تایید حذف؟
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(course.id)}
                                aria-label="حذف دوره"
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {course.scope === 'all' && !canPublishAll
                              ? 'مدیریت توسط مدیر کل مجموعه'
                              : 'فقط مشاهده'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Teacher Learning & Quiz Workspace (or Manager Preview) */}
        {resolvedTab === 'learning' && (
          <TeacherLearningWorkspace
            schoolId={activeSchoolId}
            teacherId={isTeacher ? linkedTeacher?.id ?? '' : previewTeacher?.id ?? ''}
            teacherName={
              isTeacher
                ? linkedTeacher?.fullName ?? session.displayName
                : previewTeacher?.fullName ?? 'معلم نمونه'
            }
            isPreviewMode={!isTeacher}
            courses={tdCourses}
            progressList={tdProgress}
            certificates={tdCertificates}
            ownStanding={
              isTeacher
                ? tdLeaderboard.ownStanding
                : tdLeaderboard.visibleRows.find((r) => r.teacherId === previewTeacher?.id) ?? null
            }
            onCompleteChapter={handleCompleteChapter}
            onSubmitQuiz={handleSubmitQuiz}
            onPrintCertificate={handlePrintCertificate}
            onPrintTranscript={handlePrintTeacherTranscript}
          />
        )}

        {/* Tab 3: Participation Matrix */}
        {resolvedTab === 'matrix' && isManager && (
          <ParticipationMatrixTab
            schoolId={activeSchoolId}
            schoolName={activeSchool.name}
            teachers={teachers}
            courses={tdCourses}
            progressList={tdProgress}
            certificates={tdCertificates}
            onPrintMatrix={handlePrintMatrix}
            onPrintCertificate={handlePrintCertificate}
            onPrintTeacherTranscript={handlePrintTeacherTranscript}
            onNotify={(msg, tone) => showToast(msg, tone)}
          />
        )}

        {/* Tab 4: 5-Tier Ranking & Privacy Controls */}
        {resolvedTab === 'ranking' && (
          <RankingLeaderboardTab
            leaderboard={tdLeaderboard}
            isManager={isManager}
            canConfigurePrivacy={canConfigurePrivacy}
            currentTeacherId={linkedTeacher?.id ?? null}
            onChangePrivacyMode={handleChangePrivacy}
            onPrintTeacherTranscript={handlePrintTeacherTranscript}
          />
        )}

        {/* Tab 5: 3-School Complex Comparison (complex_admin ONLY) */}
        {resolvedTab === 'complex' && canViewComplex && complexPhase7Dataset && (
          <ComplexComparisonTab
            dataset={complexPhase7Dataset}
            activeSchoolId={activeSchoolId}
            onSwitchSchool={(nextId) => {
              setActiveSchoolId(nextId);
              showToast('مدرسه فعال تغییر کرد.');
            }}
          />
        )}
      </div>

      {/* Create / Edit Course Modal */}
      {builderOpen && canManageCourses && (
        <CourseBuilderModal
          schoolId={activeSchoolId}
          schoolName={activeSchool.name}
          creatorName={session.displayName}
          creatorRole={activeRole}
          canPublishAllSchools={canPublishAll}
          editingCourse={editingCourse}
          onClose={() => {
            setBuilderOpen(false);
            setEditingCourse(null);
          }}
          onSave={handleSaveCourse}
        />
      )}

      {/* Official Print-Only View (A4 & A5 Certificates, Transcripts & Matrix Reports) */}
      <TeacherDevPrintView school={activeSchool} job={printJob} />
    </div>
  );
};

export const TeacherDevelopmentPage: React.FC = () => (
  <ErrorBoundary>
    <TeacherDevelopmentInner />
  </ErrorBoundary>
);
