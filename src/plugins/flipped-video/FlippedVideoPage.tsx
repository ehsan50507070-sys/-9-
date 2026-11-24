// Plugin 12 (Phase 3): Flipped Video Classroom («کلاس وارونه هوشمند»)
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  Film,
  MessageCircleQuestion,
  PlayCircle,
  Plus,
  Printer,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  FlippedSecondWatchState,
  FlippedTimestampQuestion,
  FlippedVideoLesson,
} from '../../types/domain';
import { CreateFlippedLessonModal } from './CreateFlippedLessonModal';
import { FlippedTimelineBar } from './FlippedTimelineBar';
import { FlippedVideoPlayer } from './FlippedVideoPlayer';
import {
  buildClassHeatmap,
  buildRemedialAgenda,
  computeWatchMetrics,
  formatMmSs,
  formatRemedialAgendaMessenger,
} from './flippedVideoHelpers';

export const FlippedVideoPage: React.FC = () => {
  const {
    activeRole,
    roleDef,
    activeSchool,
    classes,
    students,
    linkedStudent,
    flippedLessons,
    flippedTelemetry,
    flippedQuestions,
    deleteFlippedLesson,
    upsertFlippedTelemetry,
    addFlippedQuestion,
    replyFlippedQuestion,
    recordFlippedMicroQuizOutcome,
  } = useSchoolData();
  const { showToast } = useToast();

  const canManage = roleDef.canManageFlippedVideo;
  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';

  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [teacherPreviewPlayer, setTeacherPreviewPlayer] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [printAgendaOpen, setPrintAgendaOpen] = useState(false);

  const visibleLessons = useMemo(() => {
    const filtered =
      classFilter === 'all'
        ? flippedLessons
        : flippedLessons.filter((l) => l.classId === classFilter);
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [flippedLessons, classFilter]);

  const activeLesson: FlippedVideoLesson | null = useMemo(() => {
    if (visibleLessons.length === 0) return null;
    const found = visibleLessons.find((l) => l.id === selectedLessonId);
    return found ?? visibleLessons[0];
  }, [visibleLessons, selectedLessonId]);

  const activeClass = useMemo(
    () => (activeLesson ? classes.find((c) => c.id === activeLesson.classId) : undefined),
    [classes, activeLesson]
  );

  const classStudents = useMemo(() => {
    if (!activeLesson) return [];
    return students.filter((s) => s.classId === activeLesson.classId && s.active);
  }, [students, activeLesson]);

  const lessonTelemetries = useMemo(() => {
    if (!activeLesson) return [];
    return flippedTelemetry.filter((t) => t.lessonId === activeLesson.id);
  }, [flippedTelemetry, activeLesson]);

  const lessonQuestions = useMemo(() => {
    if (!activeLesson) return [];
    return flippedQuestions
      .filter((q) => q.lessonId === activeLesson.id)
      .sort((a, b) => a.timestampSecond - b.timestampSecond);
  }, [flippedQuestions, activeLesson]);

  const heatmapSecondStates = useMemo<Record<string, FlippedSecondWatchState>>(() => {
    if (!activeLesson) return {};
    const cells = buildClassHeatmap(activeLesson.durationSeconds, lessonTelemetries);
    const map: Record<string, FlippedSecondWatchState> = {};
    for (const c of cells) {
      map[String(c.second)] = c.dominant;
    }
    return map;
  }, [activeLesson, lessonTelemetries]);

  const remedialAgenda = useMemo(() => {
    if (!activeLesson) return null;
    return buildRemedialAgenda({
      lesson: activeLesson,
      classStudents,
      telemetries: lessonTelemetries,
      questions: lessonQuestions,
    });
  }, [activeLesson, classStudents, lessonTelemetries, lessonQuestions]);

  const selectedQuestion: FlippedTimestampQuestion | null = useMemo(() => {
    if (!selectedQuestionId) return null;
    return lessonQuestions.find((q) => q.id === selectedQuestionId) ?? null;
  }, [lessonQuestions, selectedQuestionId]);

  const handleCopyRemedialAgenda = async () => {
    if (!activeLesson || !remedialAgenda) return;
    const text = formatRemedialAgendaMessenger({
      schoolName: activeSchool.name,
      className: activeClass?.name ?? 'کلاس',
      lesson: activeLesson,
      agenda: remedialAgenda,
      jalaliDate: getTodayJalali(),
    });
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showToast('گزارش تک‌ستونی دستور جلسه رفع اشکال کپی شد (آماده ارسال در ایتا، بله و شاد).');
    } else {
      showToast('کپی خودکار انجام نشد — دسترسی کلیپ‌بورد را بررسی کنید.', 'error');
    }
  };

  const handleSaveReply = (questionId: string) => {
    const text = (replyDrafts[questionId] ?? '').trim();
    if (text.length < 2) {
      showToast('متن پاسخ معلم را بنویسید.', 'error');
      return;
    }
    const res = replyFlippedQuestion(questionId, text);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت پاسخ.', 'error');
      return;
    }
    setReplyDrafts((prev) => ({ ...prev, [questionId]: '' }));
    showToast('پاسخ معلم برای دانش‌آموز ذخیره شد.');
  };

  const handleDeleteLesson = (id: string) => {
    const res = deleteFlippedLesson(id);
    setConfirmDeleteId(null);
    if (!res.ok) {
      showToast(res.errorFa ?? 'حذف درس انجام نشد.', 'error');
      return;
    }
    showToast('ویدیوی کلاس وارونه حذف شد.');
  };

  // --- 1. STUDENT INTERACTIVE VIEW (Anti-seek player, timestamp questions, Micro-Quiz) ---
  if (isStudent) {
    const student = linkedStudent;
    const myTelemetry =
      activeLesson && student
        ? flippedTelemetry.find((t) => t.lessonId === activeLesson.id && t.studentId === student.id)
        : undefined;
    const myQuestions =
      activeLesson && student
        ? lessonQuestions.filter((q) => q.studentId === student.id)
        : [];

    return (
      <div className="space-y-6" data-testid="flipped-student-view">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              کلاس وارونه هوشمند
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {student
                ? `ویدیوهای آموزشی اختصاصی ${student.fullName} — تماشای کامل، ثبت سوال دقیقه‌ای و تستک درک مطلب`
                : 'دانش‌آموز متصلی برای این حساب یافت نشد.'}
            </p>
          </div>
        </header>

        {visibleLessons.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
            <PlayCircle className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              هنوز ویدیوی کلاس وارونه‌ای برای کلاس شما منتشر نشده است.
            </p>
          </div>
        ) : (
          <>
            {visibleLessons.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {visibleLessons.map((lesson) => {
                  const isActive = activeLesson?.id === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`min-h-[42px] px-4 rounded-xl border text-xs sm:text-sm font-bold transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {lesson.title} ({lesson.subject})
                    </button>
                  );
                })}
              </div>
            )}

            {activeLesson && student && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {activeLesson.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      درس {activeLesson.subject} · معلم: {activeLesson.teacherName} · مهلت مشاهده:{' '}
                      {toPersianDigits(activeLesson.deadlineJalali)}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                    مدت ویدیو: {formatMmSs(activeLesson.durationSeconds)}
                  </div>
                </div>

                <FlippedVideoPlayer
                  key={activeLesson.id}
                  lesson={activeLesson}
                  student={student}
                  initialTelemetry={myTelemetry}
                  studentQuestions={myQuestions}
                  onPersistTelemetry={(tel) => {
                    upsertFlippedTelemetry(tel);
                  }}
                  onAddQuestion={(q) => {
                    const res = addFlippedQuestion(q);
                    if (!res.ok) {
                      showToast(res.errorFa ?? 'خطا در ثبت سوال.', 'error');
                    }
                  }}
                  onCompleteMicroQuiz={(params) => {
                    const res = recordFlippedMicroQuizOutcome(params);
                    if (!res.ok) {
                      showToast(res.errorFa ?? 'خطا در ثبت تستک.', 'error');
                    }
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // --- 2. PARENT STRICTLY READ-ONLY MONITORING VIEW ---
  if (isParent) {
    const student = linkedStudent;
    return (
      <PrintShell
        school={activeSchool}
        documentTitle={`گزارش تماشای کلاس وارونه — ${student?.fullName ?? 'فرزند'}`}
        subtitle={`سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
      >
        <div className="space-y-6" data-testid="flipped-parent-readonly">
          <header className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                گزارش کلاس وارونه فرزند (فقط مشاهده)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {student
                  ? `پایش درصد تماشا، سرعت مشاهده و نتیجه تستک درک مطلب ${student.fullName} — تماشای درس و پاسخ به تستک تنها از حساب دانش‌آموز انجام می‌شود.`
                  : 'دانش‌آموز متصلی برای این حساب یافت نشد.'}
              </p>
            </div>
            <PrintButtons compact documentLabel="گزارش کلاس وارونه فرزند" />
          </header>

          {visibleLessons.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <PlayCircle className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                هنوز ویدیوی کلاس وارونه‌ای برای کلاس فرزند شما منتشر نشده است.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleLessons.map((lesson) => {
                const tel = student
                  ? flippedTelemetry.find(
                      (t) => t.lessonId === lesson.id && t.studentId === student.id
                    )
                  : undefined;
                const metrics = computeWatchMetrics(tel?.secondStates ?? {}, lesson.durationSeconds);
                const myQs = student
                  ? flippedQuestions.filter(
                      (q) => q.lessonId === lesson.id && q.studentId === student.id
                    )
                  : [];

                return (
                  <article
                    key={lesson.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 break-inside-avoid"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          درس {lesson.subject} · معلم: {lesson.teacherName}
                        </div>
                        <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-slate-100">
                          {lesson.title}
                        </h2>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          مهلت مشاهده: {toPersianDigits(lesson.deadlineJalali)} · مدت:{' '}
                          {formatMmSs(lesson.durationSeconds)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          درصد تماشا: {toPersianDigits(metrics.watchedPercent)}٪
                        </span>
                        <span
                          className={`px-3 py-1 rounded-xl border text-xs font-bold ${
                            tel?.microQuizAttempt
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {tel?.microQuizAttempt
                            ? `تستک: ${tel.microQuizAttempt.descriptiveStatus} (${toPersianDigits(tel.microQuizAttempt.score20)} از ۲۰)`
                            : 'تستک درک مطلب هنوز انجام نشده'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>خط‌زمان تماشای ویدیو</span>
                        <span>
                          سرعت عادی: {toPersianDigits(metrics.normalPercent)}٪ · سرعت بالا:{' '}
                          {toPersianDigits(metrics.fastPercent)}٪
                        </span>
                      </div>
                      <FlippedTimelineBar
                        durationSeconds={lesson.durationSeconds}
                        secondStates={tel?.secondStates ?? {}}
                        questions={myQs}
                      />
                    </div>

                    {myQs.length > 0 && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          سوالات ثبت‌شده توسط فرزند شما ({toPersianDigits(myQs.length)})
                        </div>
                        {myQs.map((q) => (
                          <div key={q.id} className="text-xs space-y-1">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              دقیقه {formatMmSs(q.timestampSecond)}: {q.questionText}
                            </div>
                            {q.teacherReply && (
                              <div className="text-emerald-700 dark:text-emerald-400">
                                پاسخ معلم: {q.teacherReply}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </PrintShell>
    );
  }

  // --- TEACHER / PRINCIPAL / DEPUTY / COMPLEX ADMIN VIEW ---
  const previewStudent = classStudents[0] ?? students[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            کلاس وارونه هوشمند و تحلیل خط‌زمانی
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ارسال ویدیوی آفلاین یا درس تعاملی، پایش ثانیه‌به‌ثانیه سرعت تماشا، تستک خودکار و کارت دستور جلسه کلاس رفع اشکال
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeLesson && previewStudent && (
            <button
              type="button"
              onClick={() => setTeacherPreviewPlayer((v) => !v)}
              className={`min-h-[42px] px-3.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                teacherPreviewPlayer
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{teacherPreviewPlayer ? 'بازگشت به تحلیل معلم' : 'پیش‌نمایش پلیر دانش‌آموز'}</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>ارسال ویدیوی کلاس وارونه</span>
            </button>
          )}
        </div>
      </header>

      {/* Class Filter + Lesson Selector Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="فیلتر کلاس"
          className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه کلاس‌ها ({toPersianDigits(flippedLessons.length)})</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          {visibleLessons.map((lesson) => {
            const cls = classes.find((c) => c.id === lesson.classId);
            const selected = activeLesson?.id === lesson.id;
            return (
              <div key={lesson.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLessonId(lesson.id);
                    setSelectedQuestionId(null);
                  }}
                  className={`min-h-[42px] px-3.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Film className="w-4 h-4 shrink-0" />
                  <span>{lesson.title}</span>
                  {cls && (
                    <span className={`text-[11px] ${selected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      ({cls.name})
                    </span>
                  )}
                </button>
                {canManage && selected && (
                  confirmDeleteId === lesson.id ? (
                    <div className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteLesson(lesson.id)}
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
                      onClick={() => setConfirmDeleteId(lesson.id)}
                      aria-label="حذف ویدیوی کلاس وارونه"
                      className="min-h-[42px] w-10 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center"
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

      {!activeLesson || !remedialAgenda ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <PlayCircle className="w-11 h-11 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            هیچ ویدیوی کلاس وارونه‌ای برای فیلتر انتخاب‌شده وجود ندارد.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>ساخت اولین ویدیوی کلاس وارونه</span>
            </button>
          )}
        </div>
      ) : teacherPreviewPlayer && previewStudent ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-4 py-2.5 text-xs font-semibold text-indigo-800 dark:text-indigo-200">
            حالت پیش‌نمایش معلم — تست قفل جلو زدن، توقف خودکار تغییر تب، سرعت پخش و تستک درک مطلب بدون تغییر پرونده دانش‌آموزان.
          </div>
          <FlippedVideoPlayer
            key={`preview-${activeLesson.id}`}
            lesson={activeLesson}
            student={previewStudent}
            studentQuestions={[]}
            onPersistTelemetry={() => {}}
            onAddQuestion={() => {}}
            onCompleteMicroQuiz={() => {}}
            isPreviewMode
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Strip (Unboxed clean metrics row) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">مشارکت تماشای کلاس</div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {toPersianDigits(remedialAgenda.watchedCount)}{' '}
                <span className="text-sm font-medium text-slate-400">
                  از {toPersianDigits(remedialAgenda.totalStudents)} نفر
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                مهلت مشاهده: {toPersianDigits(activeLesson.deadlineJalali)}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">میانگین تستک درک مطلب</div>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {remedialAgenda.avgQuizScore20 !== null
                  ? `${toPersianDigits(remedialAgenda.avgQuizScore20)} / ۲۰`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {toPersianDigits(remedialAgenda.completedQuizCount)} نفر تستک را تکمیل کرده‌اند
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">سوالات دقیقه‌ای ثبت‌شده</div>
              <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {toPersianDigits(lessonQuestions.length)} سوال
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {toPersianDigits(lessonQuestions.filter((q) => !q.teacherReply).length)} مورد بی‌پاسخ
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">نیازمند پیگیری در کلاس</div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {toPersianDigits(
                  remedialAgenda.lowQuizStudents.length + remedialAgenda.notWatchedStudents.length
                )}{' '}
                نفر
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {toPersianDigits(remedialAgenda.notWatchedStudents.length)} تماشا نکرده ·{' '}
                {toPersianDigits(remedialAgenda.lowQuizStudents.length)} تستک ضعیف
              </div>
            </div>
          </div>

          {/* 1. Aggregated Class Heatmap + Pin Legend */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  نقشه حرارتی خط‌زمانی کلاس — {activeLesson.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  سبز = سرعت عادی (۱x) · نارنجی = سرعت بالا (&gt;۱x) · خاکستری = دیده‌نشده · پین‌های قرمز = سوالات دانش‌آموزان (قابل کلیک)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" /> سرعت عادی (۱x)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-600 inline-block" /> سرعت بالا (&gt;۱x)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-slate-300 dark:bg-slate-700 inline-block" /> دیده‌نشده
                </span>
              </div>
            </div>

            <FlippedTimelineBar
              durationSeconds={activeLesson.durationSeconds}
              secondStates={heatmapSecondStates}
              questions={lessonQuestions}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={(q) => setSelectedQuestionId(q.id)}
            />

            {/* Clickable Question Pin Detail Box */}
            {selectedQuestion && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                    <MessageCircleQuestion className="w-4 h-4" />
                    <span>
                      سوال {selectedQuestion.studentName} در دقیقه {formatMmSs(selectedQuestion.timestampSecond)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionId(null)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label="بستن جزئیات سوال"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-900 dark:text-slate-100 leading-6">
                  {selectedQuestion.questionText}
                </p>
                {selectedQuestion.teacherReply ? (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>پاسخ ثبت‌شده معلم:</strong> {selectedQuestion.teacherReply}
                  </div>
                ) : (
                  canManage && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={replyDrafts[selectedQuestion.id] ?? ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [selectedQuestion.id]: e.target.value,
                          }))
                        }
                        placeholder="پاسخ کوتاه معلم برای رفع اشکال دانش‌آموز..."
                        className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveReply(selectedQuestion.id)}
                        className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>ثبت پاسخ</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* 2. Two-Column Layout: Remedial Class Agenda Card + Per-Student Timeline Bars */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Remedial Class Agenda Card («کارت دستور جلسه کلاس رفع اشکال») */}
            <section className="xl:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    کارت دستور جلسه کلاس رفع اشکال
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    جمع‌بندی خودکار نقاط ابهام برای شروع هدفمند جلسه حضوری بعدی
                  </p>
                </div>
              </div>

              {/* Action Buttons: A4 Print & Messenger Copy */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPrintAgendaOpen(true)}
                  className="min-h-[40px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ A4 دستور جلسه رفع اشکال</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyRemedialAgenda}
                  className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <ClipboardCopy className="w-4 h-4" />
                  <span>کپی تک‌ستونی گزارش برای ایتا، بله و شاد</span>
                </button>
              </div>

              {/* Top Confusing Timestamps */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  دقایق پرتکرار و نیازمند توضیح مجدد
                </h3>
                {remedialAgenda.topConfusingHotspots.length === 0 ? (
                  <p className="text-xs text-slate-500">نقطه ابهام پرتکراری ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {remedialAgenda.topConfusingHotspots.map((h) => (
                      <div
                        key={h.bucketStartSecond}
                        className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 px-3 py-2 text-xs"
                      >
                        <span className="font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                          بازه {h.labelFa}
                        </span>
                        <span className="text-amber-800 dark:text-amber-300 tabular-nums">
                          {toPersianDigits(h.questionCount)} سوال · {toPersianDigits(h.fastWatchHits)} عبور سریع
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grouped Questions Sorted by Minute */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  سوالات ثبت‌شده دانش‌آموزان (مرتب‌شده بر اساس زمان)
                </h3>
                {remedialAgenda.groupedQuestions.length === 0 ? (
                  <p className="text-xs text-slate-500">سوالی ثبت نشده است.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {remedialAgenda.groupedQuestions.map((q) => (
                      <div key={q.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedQuestionId(q.id)}
                            className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline tabular-nums"
                          >
                            دقیقه {formatMmSs(q.timestampSecond)} · {q.studentName}
                          </button>
                          <span
                            className={`text-[11px] font-semibold ${
                              q.teacherReply
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {q.teacherReply ? 'پاسخ داده‌شده' : 'در انتظار پاسخ'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-5">
                          {q.questionText}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Micro-Quiz Students («نیازمند مرور در کلاس») */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  دانش‌آموزان نیازمند مرور در کلاس (نمره تستک پایین)
                </h3>
                {remedialAgenda.lowQuizStudents.length === 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> همه شرکت‌کنندگان به تسلط مطلوب رسیده‌اند.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {remedialAgenda.lowQuizStudents.map((item) => (
                      <div
                        key={item.student.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.student.fullName}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                          {toPersianDigits(item.score20)} / ۲۰ ({item.status})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students Who Haven't Watched Yet */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  دانش‌آموزانی که هنوز ویدیو را مشاهده نکرده‌اند ({toPersianDigits(remedialAgenda.notWatchedStudents.length)})
                </h3>
                {remedialAgenda.notWatchedStudents.length === 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    همه دانش‌آموزان کلاس ویدیو را مشاهده کرده‌اند.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {remedialAgenda.notWatchedStudents.map((s) => (
                      <span
                        key={s.id}
                        className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg"
                      >
                        {s.fullName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Per-Student Color-Coded Timeline Bars */}
            <section className="xl:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    نوار خط‌زمانی رنگی دانش‌آموزان ({toPersianDigits(classStudents.length)} نفر)
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {activeClass?.name}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {classStudents.map((stu) => {
                  const tel = lessonTelemetries.find((t) => t.studentId === stu.id);
                  const stuQuestions = lessonQuestions.filter((q) => q.studentId === stu.id);
                  const metrics = computeWatchMetrics(
                    tel?.secondStates ?? {},
                    activeLesson.durationSeconds
                  );

                  return (
                    <div key={stu.id} className="py-4 first:pt-1 last:pb-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {stu.fullName}
                          </span>
                          {tel && tel.tabSwitchCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                              <AlertTriangle className="w-3 h-3" />
                              {toPersianDigits(tel.tabSwitchCount)} خروج تب
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                          <span className="text-slate-600 dark:text-slate-300">
                            تماشا: <strong>{toPersianDigits(metrics.watchedPercent)}٪</strong>
                          </span>
                          {tel?.microQuizAttempt ? (
                            <span
                              className={`font-bold ${
                                tel.microQuizAttempt.score20 >= 16
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : tel.microQuizAttempt.score20 >= 11
                                  ? 'text-indigo-600 dark:text-indigo-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              تستک: {toPersianDigits(tel.microQuizAttempt.score20)} / ۲۰ (
                              {tel.microQuizAttempt.descriptiveStatus})
                            </span>
                          ) : (
                            <span className="text-slate-400">تستک انجام نشده</span>
                          )}
                        </div>
                      </div>

                      <FlippedTimelineBar
                        durationSeconds={activeLesson.durationSeconds}
                        secondStates={tel?.secondStates ?? {}}
                        questions={stuQuestions}
                        selectedQuestionId={selectedQuestionId}
                        onSelectQuestion={(q) => setSelectedQuestionId(q.id)}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Create Flipped Lesson Modal */}
      {createModalOpen && (
        <CreateFlippedLessonModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(created) => setSelectedLessonId(created.id)}
        />
      )}

      {/* A4 Print Remedial Class Agenda Modal */}
      {printAgendaOpen && activeLesson && remedialAgenda && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-4 print:p-0 print:bg-white print:static"
          role="dialog"
          aria-modal="true"
          aria-label="پیش‌نمایش چاپ A4 دستور جلسه رفع اشکال"
        >
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">
            <div className="no-print flex items-center justify-between px-5 py-3.5 bg-slate-100 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900">
                پیش‌نمایش چاپ A4 — کارت دستور جلسه کلاس رفع اشکال
              </span>
              <div className="flex items-center gap-2">
                <PrintButtons compact documentLabel="کارت دستور جلسه رفع اشکال" />
                <button
                  type="button"
                  onClick={() => setPrintAgendaOpen(false)}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
                >
                  بستن
                </button>
              </div>
            </div>

            <div className="p-6 print:p-0">
              <PrintShell
                school={activeSchool}
                documentTitle={`کارت دستور جلسه کلاس رفع اشکال — ${activeLesson.title}`}
                subtitle={`${activeClass?.name ?? ''} · درس ${activeLesson.subject} · معلم: ${activeLesson.teacherName}`}
              >
                <div className="space-y-5 text-slate-900 text-sm">
                  <div className="grid grid-cols-3 gap-3 border border-slate-300 rounded-xl p-3 text-center">
                    <div>
                      <div className="text-xs text-slate-500">مشارکت تماشا</div>
                      <div className="font-extrabold tabular-nums">
                        {toPersianDigits(remedialAgenda.watchedCount)} از {toPersianDigits(remedialAgenda.totalStudents)} نفر
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">میانگین تستک</div>
                      <div className="font-extrabold tabular-nums">
                        {remedialAgenda.avgQuizScore20 !== null
                          ? `${toPersianDigits(remedialAgenda.avgQuizScore20)} از ۲۰`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">سوالات دقیقه‌ای</div>
                      <div className="font-extrabold tabular-nums">
                        {toPersianDigits(remedialAgenda.groupedQuestions.length)} مورد
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-extrabold mb-2">۱. دقایق پرتکرار و نیازمند توضیح مجدد در کلاس</h3>
                    {remedialAgenda.topConfusingHotspots.length === 0 ? (
                      <p className="text-xs text-slate-600">نقطه ابهام پرتکراری ثبت نشده است.</p>
                    ) : (
                      <ul className="list-disc pr-5 space-y-1 text-xs">
                        {remedialAgenda.topConfusingHotspots.map((h) => (
                          <li key={h.bucketStartSecond}>
                            بازه {h.labelFa} — {toPersianDigits(h.questionCount)} سوال دانش‌آموز و{' '}
                            {toPersianDigits(h.fastWatchHits)} مورد تماشای سریع
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className="font-extrabold mb-2">۲. فهرست سوالات دانش‌آموزان به ترتیب زمان ویدیو</h3>
                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 p-2 text-right">زمان</th>
                          <th className="border border-slate-300 p-2 text-right">دانش‌آموز</th>
                          <th className="border border-slate-300 p-2 text-right">متن سوال</th>
                          <th className="border border-slate-300 p-2 text-right">پاسخ معلم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remedialAgenda.groupedQuestions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="border border-slate-300 p-2 text-center">
                              سوالی ثبت نشده است.
                            </td>
                          </tr>
                        ) : (
                          remedialAgenda.groupedQuestions.map((q) => (
                            <tr key={q.id}>
                              <td className="border border-slate-300 p-2 tabular-nums">
                                {formatMmSs(q.timestampSecond)}
                              </td>
                              <td className="border border-slate-300 p-2 font-semibold">
                                {q.studentName}
                              </td>
                              <td className="border border-slate-300 p-2">{q.questionText}</td>
                              <td className="border border-slate-300 p-2">{q.teacherReply ?? '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-300 rounded-xl p-3">
                      <h3 className="font-extrabold text-xs mb-1.5">
                        ۳. دانش‌آموزان نیازمند مرور (نمره تستک زیر ۱۴)
                      </h3>
                      {remedialAgenda.lowQuizStudents.length === 0 ? (
                        <p className="text-xs text-slate-600">موردی وجود ندارد.</p>
                      ) : (
                        <ul className="list-disc pr-4 text-xs space-y-1">
                          {remedialAgenda.lowQuizStudents.map((i) => (
                            <li key={i.student.id}>
                              {i.student.fullName} — {toPersianDigits(i.score20)} از ۲۰ ({i.status})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="border border-slate-300 rounded-xl p-3">
                      <h3 className="font-extrabold text-xs mb-1.5">
                        ۴. دانش‌آموزانی که ویدیو را مشاهده نکرده‌اند
                      </h3>
                      {remedialAgenda.notWatchedStudents.length === 0 ? (
                        <p className="text-xs text-slate-600">همه مشاهده کرده‌اند.</p>
                      ) : (
                        <ul className="list-disc pr-4 text-xs space-y-1">
                          {remedialAgenda.notWatchedStudents.map((s) => (
                            <li key={s.id}>{s.fullName}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </PrintShell>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
