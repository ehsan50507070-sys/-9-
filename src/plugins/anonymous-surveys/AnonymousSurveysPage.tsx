// Plugin 3: Privacy-First Anonymous Surveys & Satisfaction Measurement («سامانه نظرسنجی ناشناس و سنجش رضایت»)
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  Lock,
  MessageSquareQuote,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useSectionLabel } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { triggerPrint, type PrintPaperSize } from '../../core/print/printService';
import { SvgGroupedBarChart, SvgHorizontalBarChart } from '../../core/ui/SvgCharts';
import { downloadTextFile } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  AnonymousSurvey,
  SurveyAudienceRole,
  SurveyCommentReviewStatus,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyStatus,
} from '../../types/domain';
import {
  AUDIENCE_ROLE_LABELS,
  buildParticipantKey,
  buildSurveyReportMessenger,
  buildSurveyResultsCsv,
  COMMENT_REVIEW_LABELS,
  computeComplexSurveyComparison,
  evaluateSurveyResults,
  hasUserParticipatedInSurvey,
  LIKERT_5_OPTIONS,
  PERSIAN_SURVEY_TEMPLATES,
  QUESTION_TYPE_LABELS,
  SURVEY_STATUS_LABELS,
} from './anonymousSurveyHelpers';

type SurveyTabId = 'participate' | 'manage' | 'results' | 'builder' | 'complex';

export const AnonymousSurveysPage: React.FC = () => {
  const {
    session,
    activeRole,
    roleDef,
    activeSchool,
    activeSchoolId,
    students,
    teachers,
    anonymousSurveys,
    surveyParticipationReceipts,
    surveyAnonymousResponses,
    complexPhase6Dataset,
    upsertAnonymousSurvey,
    deleteAnonymousSurvey,
    submitAnonymousSurveyVote,
    updateSurveyResponseReview,
  } = useSchoolData();

  const { getSectionTitle } = useSectionLabel();
  const sectionLabel = getSectionTitle(
    'anonymous-surveys',
    'سامانه نظرسنجی ناشناس و سنجش رضایت'
  );
  const todayJalali = getTodayJalali();

  const canManage = roleDef.canManageSurveys;
  const canParticipate = roleDef.canParticipateSurveys;
  const canViewComplex = roleDef.canViewComplexComparison && Boolean(complexPhase6Dataset);

  const [activeTab, setActiveTab] = useState<SurveyTabId>(
    canManage ? 'results' : 'participate'
  );
  const [selectedResultsSurveyId, setSelectedResultsSurveyId] = useState<string>(
    anonymousSurveys[0]?.id ?? ''
  );
  const [votingSurveyId, setVotingSurveyId] = useState<string | null>(null);
  const [voteAnswers, setVoteAnswers] = useState<Record<string, string | number>>({});
  const [voteOpenComment, setVoteOpenComment] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Builder state
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderTargets, setBuilderTargets] = useState<SurveyAudienceRole[]>(['parent']);
  const [builderStartDate, setBuilderStartDate] = useState(todayJalali);
  const [builderEndDate, setBuilderEndDate] = useState('1405/12/29');
  const [builderThreshold, setBuilderThreshold] = useState<number>(3);
  const [builderStatus, setBuilderStatus] = useState<SurveyStatus>('active');
  const [builderPublishAll, setBuilderPublishAll] = useState<boolean>(false);
  const [builderQuestions, setBuilderQuestions] = useState<SurveyQuestion[]>([
    {
      id: 'bq-1',
      prompt: 'میزان رضایت کلی شما از کیفیت خدمات مدرسه چقدر است؟',
      type: 'likert_5',
      required: true,
    },
  ]);

  // Management comment note draft state
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const effectiveResultsSurvey = useMemo(
    () =>
      anonymousSurveys.find((s) => s.id === selectedResultsSurveyId) ??
      anonymousSurveys[0] ??
      null,
    [anonymousSurveys, selectedResultsSurveyId]
  );

  const estimatedEligible = useMemo(() => {
    if (!effectiveResultsSurvey) return 25;
    let total = 0;
    const activeStudentsCount = Math.max(1, students.filter((s) => s.active).length);
    const activeTeachersCount = Math.max(1, teachers.filter((t) => t.active).length);
    if (effectiveResultsSurvey.targetRoles.includes('parent')) total += activeStudentsCount;
    if (effectiveResultsSurvey.targetRoles.includes('student')) total += activeStudentsCount;
    if (effectiveResultsSurvey.targetRoles.includes('teacher')) total += activeTeachersCount;
    return Math.max(1, total);
  }, [effectiveResultsSurvey, students, teachers]);

  const evaluation = useMemo(() => {
    if (!effectiveResultsSurvey) return null;
    return evaluateSurveyResults({
      survey: effectiveResultsSurvey,
      responses: surveyAnonymousResponses,
      estimatedEligibleCount: estimatedEligible,
    });
  }, [effectiveResultsSurvey, surveyAnonymousResponses, estimatedEligible]);

  // Complex 3-school survey groupKeys
  const complexGroupKeys = useMemo(() => {
    if (!canViewComplex || !complexPhase6Dataset) return [];
    const map = new Map<string, string>();
    for (const s of complexPhase6Dataset.anonymousSurveys) {
      if (s.groupKey && !map.has(s.groupKey)) {
        map.set(s.groupKey, s.title);
      }
    }
    return Array.from(map.entries()).map(([groupKey, title]) => ({ groupKey, title }));
  }, [canViewComplex, complexPhase6Dataset]);

  const [selectedComplexGroupKey, setSelectedComplexGroupKey] = useState<string>('');
  const activeComplexGroupKey =
    selectedComplexGroupKey || complexGroupKeys[0]?.groupKey || '';

  const complexSurveyRows = useMemo(() => {
    if (!canViewComplex || !complexPhase6Dataset || !activeComplexGroupKey) return [];
    return computeComplexSurveyComparison({
      schools: complexPhase6Dataset.schools,
      surveys: complexPhase6Dataset.anonymousSurveys,
      responses: complexPhase6Dataset.surveyAnonymousResponses,
      groupKey: activeComplexGroupKey,
    });
  }, [canViewComplex, complexPhase6Dataset, activeComplexGroupKey]);

  const currentUserId = session?.userId ?? 'anon-session';

  const participantRole: SurveyAudienceRole | null =
    activeRole === 'parent' || activeRole === 'teacher' || activeRole === 'student'
      ? activeRole
      : null;

  const votingSurvey = anonymousSurveys.find((s) => s.id === votingSurveyId) ?? null;

  const handleOpenVotingForm = (survey: AnonymousSurvey) => {
    setVotingSurveyId(survey.id);
    setVoteAnswers({});
    setVoteOpenComment('');
    setNotice(null);
  };

  const handleSubmitVote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!votingSurvey || !participantRole) return;

    for (const q of votingSurvey.questions) {
      if (q.required) {
        const val = voteAnswers[q.id];
        if (val === undefined || String(val).trim() === '') {
          setNotice(`لطفاً به سوال «${q.prompt}» پاسخ دهید.`);
          return;
        }
      }
    }

    const participantKey = buildParticipantKey(currentUserId, votingSurvey.id);
    const res = submitAnonymousSurveyVote({
      surveyId: votingSurvey.id,
      participantKey,
      audienceRole: participantRole,
      answers: voteAnswers,
      openComment: voteOpenComment.trim() || undefined,
      submittedDayBucket: todayJalali,
    });

    if (!res.ok) {
      setNotice(res.errorFa ?? 'خطا در ثبت پاسخ نظرسنجی.');
      return;
    }

    setNotice(
      `پاسخ ناشناس شما برای «${votingSurvey.title}» با موفقیت ثبت شد. هیچ مشخصه هویتی ذخیره نگردید.`
    );
    setVotingSurveyId(null);
    setVoteAnswers({});
    setVoteOpenComment('');
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = PERSIAN_SURVEY_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setBuilderTitle(tpl.title);
    setBuilderDescription(tpl.description);
    setBuilderTargets([...tpl.targetRoles]);
    setBuilderQuestions(tpl.questions.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined })));
    setNotice(`قالب آماده «${tpl.title}» بارگذاری شد. می‌توانید سوالات را ویرایش و منتشر کنید.`);
  };

  const handleAddBuilderQuestion = () => {
    setBuilderQuestions((prev) => [
      ...prev,
      {
        id: `bq-${Date.now().toString(36)}`,
        prompt: '',
        type: 'likert_5',
        required: true,
      },
    ]);
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderTitle.trim() || builderTargets.length === 0) {
      setNotice('عنوان نظرسنجی و حداقل یک گروه مخاطب را مشخص کنید.');
      return;
    }
    const validQuestions = builderQuestions.filter((q) => q.prompt.trim().length > 0);
    if (validQuestions.length === 0) {
      setNotice('حداقل یک سوال معتبر وارد کنید.');
      return;
    }
    const nowIso = new Date().toISOString();
    const newSurvey: AnonymousSurvey = {
      id: `${activeSchoolId}:survey:${Date.now().toString(36)}`,
      schoolId: activeSchoolId,
      title: builderTitle.trim(),
      description: builderDescription.trim() || 'نظرسنجی ناشناس سنجش رضایت مدرسه',
      targetRoles: builderTargets,
      questions: validQuestions.map((q) => ({
        ...q,
        prompt: q.prompt.trim(),
        options:
          q.type === 'multiple_choice'
            ? (q.options ?? ['گزینه ۱', 'گزینه ۲']).filter((o) => o.trim().length > 0)
            : undefined,
      })),
      startDateJalali: builderStartDate.trim() || todayJalali,
      endDateJalali: builderEndDate.trim() || '1405/12/29',
      minAnonymityThreshold: Math.max(1, Math.min(20, builderThreshold)),
      status: builderStatus,
      createdByName: session?.displayName ?? 'مدیر مدرسه',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const res = await upsertAnonymousSurvey(newSurvey, builderPublishAll);
    if (res.ok) {
      setNotice(
        builderPublishAll && canViewComplex
          ? `نظرسنجی «${newSurvey.title}» به صورت همزمان در هر ۳ مدرسه منتشر شد.`
          : `نظرسنجی «${newSurvey.title}» با حد نصاب محرمانگی ${toPersianDigits(newSurvey.minAnonymityThreshold)} پاسخ ایجاد شد.`
      );
      setSelectedResultsSurveyId(newSurvey.id);
      setBuilderTitle('');
      setBuilderDescription('');
      setActiveTab('manage');
    } else {
      setNotice(res.errorFa ?? 'خطا در ذخیره نظرسنجی.');
    }
  };

  const handleToggleSurveyStatus = async (survey: AnonymousSurvey, nextStatus: SurveyStatus) => {
    await upsertAnonymousSurvey({ ...survey, status: nextStatus }, false);
    setNotice(`وضعیت نظرسنجی «${survey.title}» به «${SURVEY_STATUS_LABELS[nextStatus]}» تغییر یافت.`);
  };

  const handleCopyReport = async () => {
    if (!evaluation) return;
    const text = buildSurveyReportMessenger({
      schoolName: activeSchool.name,
      todayJalali,
      evaluation,
    });
    await copyTextToClipboard(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2200);
  };

  const handleExportCsv = () => {
    if (!evaluation) return;
    const csv = buildSurveyResultsCsv(evaluation);
    downloadTextFile(
      `anonymous-survey-results-${todayJalali.replace(/\//g, '-')}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  const handlePrint = (size: PrintPaperSize) => {
    triggerPrint({ size, orientation: 'portrait' });
  };

  const tabs: Array<{ id: SurveyTabId; label: string; icon: React.ReactNode }> = [
    ...(canParticipate
      ? [
          {
            id: 'participate' as const,
            label: 'شرکت در نظرسنجی‌های فعال',
            icon: <ClipboardCheck className="w-4 h-4" />,
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            id: 'results' as const,
            label: 'نتایج و تحلیل رضایت‌سنجی',
            icon: <BarChart3 className="w-4 h-4" />,
          },
          {
            id: 'manage' as const,
            label: `مدیریت نظرسنجی‌ها (${toPersianDigits(anonymousSurveys.length)})`,
            icon: <MessageSquareQuote className="w-4 h-4" />,
          },
          {
            id: 'builder' as const,
            label: 'ساخت نظرسنجی جدید',
            icon: <Plus className="w-4 h-4" />,
          },
        ]
      : []),
    ...(canViewComplex
      ? [
          {
            id: 'complex' as const,
            label: 'مقایسه رضایت ۳ مدرسه',
            icon: <Building2 className="w-4 h-4" />,
          },
        ]
      : []),
  ];

  const resolvedTab: SurveyTabId = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : tabs[0]?.id ?? 'participate';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/10 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-800/70 flex items-center justify-center text-teal-700 dark:text-teal-400">
            <MessageSquareQuote className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {sectionLabel}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              سنجش محرمانه و بی‌نام رضایت اولیا، معلمان و دانش‌آموزان با معماری دوگانه حفظ حریم خصوصی — {activeSchool.name}
            </p>
          </div>
        </div>

        {canManage && evaluation && resolvedTab === 'results' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {copiedReport ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedReport ? 'کپی شد (ایتا / بله / شاد)' : 'کپی گزارش تک‌ستونی'}</span>
            </button>
            {evaluation.thresholdMet && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>خروجی اکسل فارسی</span>
              </button>
            )}
            <PrintButtons compact documentLabel="گزارش نظرسنجی ناشناس" onPrint={handlePrint} />
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div
          className="no-print flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
          role="tablist"
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
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {notice && (
        <div className="no-print rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* ====================================================================
       * Participant View (parent / teacher / student)
       * ==================================================================== */}
      {resolvedTab === 'participate' && canParticipate && (
        <div className="no-print space-y-4">
          {/* Mandatory Reassuring Privacy Badge */}
          <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/30 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="text-xs text-teal-900 dark:text-teal-200 leading-6">
              <strong className="block text-sm mb-0.5">تضمین ۱۰۰٪ محرمانگی و ناشناس بودن پاسخ‌ها</strong>
              پاسخ شما کاملاً بی‌نام ثبت می‌شود؛ نام و مشخصات شما در هیچ گزارشی ذخیره نمی‌شود. سامانه تنها جهت جلوگیری از ثبت رأی تکراری، یک رسید کدگذاری‌شده جداگانه نگهداری می‌کند و نظرات متنی به‌صورت تصادفی (به‌هم‌ریخته) و پس از رسیدن به حد نصاب محرمانگی نمایش داده می‌شوند.
            </div>
          </div>

          {votingSurvey ? (
            <form
              onSubmit={handleSubmitVote}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {votingSurvey.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {votingSurvey.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVotingSurveyId(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  بازگشت به فهرست
                </button>
              </div>

              <div className="space-y-4">
                {votingSurvey.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {toPersianDigits(qIdx + 1)}. {q.prompt}
                      {q.required && <span className="text-rose-500 mr-1">*</span>}
                    </div>

                    {q.type === 'likert_5' && (
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {LIKERT_5_OPTIONS.map((opt) => {
                          const selected = voteAnswers[q.id] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setVoteAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                              }
                              className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                                selected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'yes_no' && (
                      <div className="flex items-center gap-3">
                        {['بله', 'خیر'].map((choice) => {
                          const selected = voteAnswers[q.id] === choice;
                          return (
                            <button
                              key={choice}
                              type="button"
                              onClick={() =>
                                setVoteAnswers((prev) => ({ ...prev, [q.id]: choice }))
                              }
                              className={`flex-1 max-w-[160px] rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${
                                selected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'multiple_choice' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(q.options ?? []).map((opt) => {
                          const selected = voteAnswers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setVoteAnswers((prev) => ({ ...prev, [q.id]: opt }))
                              }
                              className={`rounded-xl border px-3 py-2.5 text-xs font-bold text-right transition-colors ${
                                selected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'open_text' && (
                      <textarea
                        rows={3}
                        placeholder="دیدگاه ناشناس خود را با اطمینان بنویسید..."
                        value={String(voteAnswers[q.id] ?? '')}
                        onChange={(e) =>
                          setVoteAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                      />
                    )}
                  </div>
                ))}

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    پیشنهاد یا دیدگاه تکمیلی (اختیاری — کاملاً بی‌نام)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="هرگونه نظر یا پیشنهاد سازنده برای بهبود مدرسه..."
                    value={voteOpenComment}
                    onChange={(e) => setVoteOpenComment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVotingSurveyId(null)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 text-xs font-extrabold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>ثبت نهایی پاسخ کاملاً ناشناس</span>
                </button>
              </div>
            </form>
          ) : anonymousSurveys.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
              در حال حاضر نظرسنجی فعالی برای نقش کاربری شما در این مدرسه منتشر نشده است.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {anonymousSurveys.map((survey) => {
                const pKey = buildParticipantKey(currentUserId, survey.id);
                const alreadyVoted = hasUserParticipatedInSurvey({
                  receipts: surveyParticipationReceipts,
                  schoolId: activeSchoolId,
                  surveyId: survey.id,
                  participantKey: pKey,
                });

                return (
                  <div
                    key={survey.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-extrabold ${
                            alreadyVoted
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-indigo-700 dark:text-indigo-400'
                          }`}
                        >
                          {alreadyVoted
                            ? 'پاسخ ثبت شد (تشکر از مشارکت شما)'
                            : 'آماده پاسخ‌گویی'}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          مهلت: {toPersianDigits(survey.endDateJalali)}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {survey.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-5">
                        {survey.description}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1">
                        تعداد سوالات: {toPersianDigits(survey.questions.length)} سوال · کاملاً ناشناس
                      </div>
                    </div>

                    {alreadyVoted ? (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>پاسخ شما قبلاً به‌صورت بی‌نام ثبت شده است.</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenVotingForm(survey)}
                        className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-extrabold transition-colors"
                      >
                        شروع پاسخ‌گویی ناشناس
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
       * Management Results & Reporting View (complex_admin / principal / deputy)
       * ==================================================================== */}
      {resolvedTab === 'results' && canManage && (
        <div className="no-print space-y-5">
          {anonymousSurveys.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500">
              هنوز نظرسنجی‌ای ایجاد نشده است.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  انتخاب نظرسنجی برای مشاهده نتایج:
                </label>
                <select
                  aria-label="انتخاب نظرسنجی برای تحلیل"
                  value={effectiveResultsSurvey?.id ?? ''}
                  onChange={(e) => setSelectedResultsSurveyId(e.target.value)}
                  className="flex-1 min-w-[240px] max-w-xl rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {anonymousSurveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.title} (${SURVEY_STATUS_LABELS[s.status]})`}
                    </option>
                  ))}
                </select>
              </div>

              {evaluation && (
                <>
                  {/* Top Summary Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="text-xs text-slate-500">شاخص رضایت‌مندی</div>
                      <div className="text-2xl font-extrabold text-teal-700 dark:text-teal-400 tabular-nums mt-1">
                        {evaluation.thresholdMet && evaluation.satisfactionIndexOutOf100 !== null
                          ? `${toPersianDigits(evaluation.satisfactionIndexOutOf100)} از ۱۰۰`
                          : 'محرمانه'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="text-xs text-slate-500">تعداد پاسخ‌های ثبت‌شده</div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                        {toPersianDigits(evaluation.totalResponses)} پاسخ
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="text-xs text-slate-500">نرخ مشارکت تخمینی</div>
                      <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums mt-1">
                        {toPersianDigits(evaluation.participationRatePercent)}٪
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="text-xs text-slate-500">حد نصاب محرمانگی</div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                        {toPersianDigits(evaluation.minThreshold)} پاسخ
                      </div>
                    </div>
                  </div>

                  {/* Privacy Threshold Lock Gate */}
                  {!evaluation.thresholdMet ? (
                    <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6 text-center space-y-2">
                      <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
                      <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                        نتایج تفصیلی جهت حفظ محرمانگی پاسخ‌دهندگان قفل است
                      </h3>
                      <p className="text-xs text-amber-800 dark:text-amber-300 max-w-xl mx-auto leading-6">
                        برای جلوگیری از شناسایی هویت شرکت‌کنندگان، حد نصاب محرمانگی این نظرسنجی برابر{' '}
                        <strong>{toPersianDigits(evaluation.minThreshold)} پاسخ</strong> تنظیم شده است. تاکنون{' '}
                        <strong>{toPersianDigits(evaluation.totalResponses)} پاسخ</strong> ثبت شده و پس از دریافت{' '}
                        <strong>{toPersianDigits(evaluation.missingForThreshold)} پاسخ دیگر</strong>، نمودارها و نظرات متنی ناشناس به‌طور خودکار نمایش داده می‌شوند.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Per-Question Pure SVG Horizontal Percentage Bars */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {evaluation.questionSummaries
                          .filter((qs) => qs.bars.length > 0)
                          .map((qs, idx) => (
                            <SvgHorizontalBarChart
                              key={qs.question.id}
                              title={`${toPersianDigits(idx + 1)}. ${qs.question.prompt}`}
                              subtitle={
                                qs.averageLikert
                                  ? `میانگین امتیاز: ${toPersianDigits(qs.averageLikert)} از ۵ · ${toPersianDigits(qs.totalAnswered)} پاسخ`
                                  : `تعداد پاسخ: ${toPersianDigits(qs.totalAnswered)} نفر`
                              }
                              defaultMax={100}
                              items={qs.bars.map((b) => ({
                                id: `${qs.question.id}-${b.label}`,
                                label: b.label,
                                value: b.percent,
                                maxValue: 100,
                                displayValue: `${toPersianDigits(b.percent)}٪ (${toPersianDigits(b.count)} نفر)`,
                                color: b.color,
                              }))}
                            />
                          ))}
                      </div>

                      {/* Shuffled Anonymous Comments & Internal Management Follow-up */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                              نظرات و پیشنهادهای متنی کاملاً ناشناس (ترتیب تصادفی‌شده)
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              بدون نام، بدون شناسه کاربری و بدون ساعت دقیق ارسال — صرفاً با امکان علامت‌گذاری پیگیری مدیریتی
                            </p>
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                            {toPersianDigits(evaluation.shuffledComments.length)} دیدگاه
                          </span>
                        </div>

                        {evaluation.shuffledComments.length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 text-center">
                            دیدگاه متنی تشریحی ثبت نشده است.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {evaluation.shuffledComments.map((item) => {
                              const draft =
                                noteDrafts[item.responseId] ?? item.internalManagementNote ?? '';
                              return (
                                <div
                                  key={item.responseId}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 text-xs"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-teal-700 dark:text-teal-400">
                                      پاسخ ناشناس ({AUDIENCE_ROLE_LABELS[item.audienceRole]}) · روز{' '}
                                      {toPersianDigits(item.submittedDayBucket)}
                                    </span>
                                    <select
                                      aria-label="وضعیت پیگیری دیدگاه ناشناس"
                                      value={item.reviewStatus}
                                      onChange={(e) =>
                                        updateSurveyResponseReview({
                                          responseId: item.responseId,
                                          reviewStatus: e.target.value as SurveyCommentReviewStatus,
                                          internalManagementNote: draft,
                                        })
                                      }
                                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                    >
                                      {Object.entries(COMMENT_REVIEW_LABELS).map(([k, lbl]) => (
                                        <option key={k} value={k}>
                                          {lbl}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <p className="text-slate-800 dark:text-slate-200 leading-6 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                                    «{item.comment}»
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="یادداشت پیگیری داخلی مدیریت..."
                                      value={draft}
                                      onChange={(e) =>
                                        setNoteDrafts((prev) => ({
                                          ...prev,
                                          [item.responseId]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateSurveyResponseReview({
                                          responseId: item.responseId,
                                          reviewStatus:
                                            item.reviewStatus === 'new'
                                              ? 'reviewed'
                                              : item.reviewStatus,
                                          internalManagementNote: draft,
                                        });
                                        setNotice('یادداشت پیگیری مدیریتی ذخیره شد.');
                                      }}
                                      className="rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white px-3 py-1.5 font-bold"
                                    >
                                      ذخیره پیگیری
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ====================================================================
       * Manage Surveys List Tab
       * ==================================================================== */}
      {resolvedTab === 'manage' && canManage && (
        <div className="no-print space-y-3">
          {anonymousSurveys.map((survey) => {
            const count = surveyAnonymousResponses.filter((r) => r.surveyId === survey.id).length;
            return (
              <div
                key={survey.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {survey.title}
                    </h3>
                    <span className="text-indigo-700 dark:text-indigo-400 font-bold">
                      {SURVEY_STATUS_LABELS[survey.status]}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    مخاطبان: {survey.targetRoles.map((r) => AUDIENCE_ROLE_LABELS[r]).join('، ')} ·{' '}
                    بازه: {toPersianDigits(survey.startDateJalali)} تا {toPersianDigits(survey.endDateJalali)} ·{' '}
                    حد نصاب محرمانگی: {toPersianDigits(survey.minAnonymityThreshold)} پاسخ ·{' '}
                    دریافت‌شده: <strong>{toPersianDigits(count)} پاسخ</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedResultsSurveyId(survey.id);
                      setActiveTab('results');
                    }}
                    className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 px-3 py-1.5 font-bold"
                  >
                    مشاهده نتایج
                  </button>
                  <select
                    aria-label={`تغییر وضعیت ${survey.title}`}
                    value={survey.status}
                    onChange={(e) => handleToggleSurveyStatus(survey, e.target.value as SurveyStatus)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="active">فعال</option>
                    <option value="draft">پیش‌نویس</option>
                    <option value="closed">بسته‌شده</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => deleteAnonymousSurvey(survey.id)}
                    aria-label={`حذف نظرسنجی ${survey.title}`}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================================
       * Survey Builder Tab (with 4 One-Click Persian Templates)
       * ==================================================================== */}
      {resolvedTab === 'builder' && canManage && (
        <div className="no-print space-y-4">
          {/* 4 One-Click Templates */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              قالب‌های آماده نظرسنجی فارسی (انتخاب با یک کلیک)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {PERSIAN_SURVEY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.id)}
                  className="text-right rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/70 p-3 space-y-1 transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{tpl.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {tpl.targetRoles.map((r) => AUDIENCE_ROLE_LABELS[r]).join('، ')} ·{' '}
                    {toPersianDigits(tpl.questions.length)} سوال
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCreateSurvey}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 text-xs"
          >
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              تنظیمات و طراحی سوالات نظرسنجی جدید
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان نظرسنجی
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً رضایت‌سنجی اردوها و خدمات نیم‌سال دوم"
                  value={builderTitle}
                  onChange={(e) => setBuilderTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات برای شرکت‌کنندگان
                </label>
                <input
                  type="text"
                  placeholder="هدف از برگزاری نظرسنجی..."
                  value={builderDescription}
                  onChange={(e) => setBuilderDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تاریخ شروع (شمسی)
                </label>
                <input
                  type="text"
                  value={builderStartDate}
                  onChange={(e) => setBuilderStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تاریخ پایان (شمسی)
                </label>
                <input
                  type="text"
                  value={builderEndDate}
                  onChange={(e) => setBuilderEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  حد نصاب محرمانگی (حداقل پاسخ)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={builderThreshold}
                  onChange={(e) => setBuilderThreshold(Number(e.target.value) || 3)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  وضعیت انتشار
                </label>
                <select
                  value={builderStatus}
                  onChange={(e) => setBuilderStatus(e.target.value as SurveyStatus)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="active">فعال (انتشار فوری)</option>
                  <option value="draft">پیش‌نویس</option>
                  <option value="closed">بسته‌شده</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-slate-700 dark:text-slate-300">گروه‌های مخاطب:</span>
              {(['parent', 'teacher', 'student'] as SurveyAudienceRole[]).map((roleKey) => {
                const checked = builderTargets.includes(roleKey);
                return (
                  <label key={roleKey} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBuilderTargets((prev) => [...prev, roleKey]);
                        } else {
                          setBuilderTargets((prev) => prev.filter((r) => r !== roleKey));
                        }
                      }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {AUDIENCE_ROLE_LABELS[roleKey]}
                    </span>
                  </label>
                );
              })}

              {canViewComplex && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer mr-auto text-indigo-700 dark:text-indigo-300 font-bold">
                  <input
                    type="checkbox"
                    checked={builderPublishAll}
                    onChange={(e) => setBuilderPublishAll(e.target.checked)}
                  />
                  <span>انتشار همزمان در هر ۳ مدرسه</span>
                </label>
              )}
            </div>

            {/* Questions Editor */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  سوالات نظرسنجی ({toPersianDigits(builderQuestions.length)} سوال)
                </span>
                <button
                  type="button"
                  onClick={handleAddBuilderQuestion}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن سوال</span>
                </button>
              </div>

              {builderQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-500">{toPersianDigits(idx + 1)}.</span>
                    <input
                      type="text"
                      placeholder="متن سوال..."
                      value={q.prompt}
                      onChange={(e) =>
                        setBuilderQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ? { ...item, prompt: e.target.value } : item
                          )
                        )
                      }
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
                    />
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const nextType = e.target.value as SurveyQuestionType;
                        setBuilderQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id
                              ? {
                                  ...item,
                                  type: nextType,
                                  options:
                                    nextType === 'multiple_choice'
                                      ? item.options ?? ['گزینه اول', 'گزینه دوم', 'گزینه سوم']
                                      : undefined,
                                }
                              : item
                          )
                        );
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
                    >
                      {Object.entries(QUESTION_TYPE_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                    {builderQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setBuilderQuestions((prev) => prev.filter((item) => item.id !== q.id))
                        }
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {q.type === 'multiple_choice' && (
                    <input
                      type="text"
                      placeholder="گزینه‌ها را با ویرگول فارسی (،) جدا کنید"
                      value={(q.options ?? []).join('، ')}
                      onChange={(e) =>
                        setBuilderQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id
                              ? {
                                  ...item,
                                  options: e.target.value
                                    .split(/[،,]/)
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : item
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 font-extrabold"
              >
                ذخیره و انتشار نظرسنجی ناشناس
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
       * Complex 3-School Satisfaction Comparison (complex_admin ONLY)
       * ==================================================================== */}
      {resolvedTab === 'complex' && canViewComplex && (
        <div className="no-print space-y-4">
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0" />
              <strong>مقایسه شاخص رضایت ۳ مدرسه در نظرسنجی‌های مشترک مجموعه</strong>
            </div>
            {complexGroupKeys.length > 0 && (
              <select
                value={activeComplexGroupKey}
                onChange={(e) => setSelectedComplexGroupKey(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                {complexGroupKeys.map((g) => (
                  <option key={g.groupKey} value={g.groupKey}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {complexSurveyRows.length > 0 && (
            <>
              <SvgGroupedBarChart
                title="مقایسه شاخص رضایت‌مندی ۳ مدرسه (از ۱۰۰)"
                maxValue={100}
                data={complexSurveyRows.map((r) => ({
                  label: r.school.name,
                  values: { satisfaction: r.thresholdMet ? r.satisfactionIndexOutOf100 : 0 },
                }))}
                series={[{ key: 'satisfaction', label: 'شاخص رضایت (از ۱۰۰)', color: '#0d9488' }]}
                valueFormatter={(v) => `${toPersianDigits(v)} از ۱۰۰`}
                axisFormatter={(v) => toPersianDigits(v)}
              />

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-3 px-3 font-bold">واحد آموزشی</th>
                      <th className="py-3 px-3 font-bold">تعداد پاسخ بی‌نام</th>
                      <th className="py-3 px-3 font-bold">وضعیت حد نصاب محرمانگی</th>
                      <th className="py-3 px-3 font-bold">شاخص رضایت‌مندی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {complexSurveyRows.map((r) => (
                      <tr key={r.school.id}>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {r.school.name}
                        </td>
                        <td className="py-3 px-3 tabular-nums">
                          {toPersianDigits(r.responsesCount)} پاسخ
                        </td>
                        <td className="py-3 px-3">
                          {r.thresholdMet ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              حد نصاب تکمیل‌شده
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              زیر حد نصاب محرمانگی
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-teal-700 dark:text-teal-400 tabular-nums">
                          {r.thresholdMet
                            ? `${toPersianDigits(r.satisfactionIndexOutOf100)} از ۱۰۰`
                            : 'محرمانه'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Print-Only A4 & A5 Survey Report */}
      {evaluation && (
        <PrintShell
          school={activeSchool}
          documentTitle="گزارش رسمی نظرسنجی ناشناس و سنجش رضایت"
          subtitle={`${evaluation.survey.title} · تعداد پاسخ: ${toPersianDigits(evaluation.totalResponses)}`}
        >
          <div className="print-only space-y-4 text-xs text-black">
            <div className="grid grid-cols-3 gap-2 border border-slate-400 p-2.5 rounded">
              <div>
                <div className="text-slate-600">تعداد مشارکت‌کنندگان</div>
                <div className="font-extrabold">{toPersianDigits(evaluation.totalResponses)} نفر</div>
              </div>
              <div>
                <div className="text-slate-600">نرخ مشارکت تخمینی</div>
                <div className="font-extrabold">{toPersianDigits(evaluation.participationRatePercent)}٪</div>
              </div>
              <div>
                <div className="text-slate-600">شاخص رضایت‌مندی</div>
                <div className="font-extrabold">
                  {evaluation.thresholdMet && evaluation.satisfactionIndexOutOf100 !== null
                    ? `${toPersianDigits(evaluation.satisfactionIndexOutOf100)} از ۱۰۰`
                    : 'زیر حد نصاب محرمانگی'}
                </div>
              </div>
            </div>

            {evaluation.thresholdMet ? (
              <>
                <div className="space-y-2.5">
                  {evaluation.questionSummaries
                    .filter((qs) => qs.bars.length > 0)
                    .map((qs, idx) => (
                      <div key={qs.question.id} className="border border-slate-300 p-2.5 rounded">
                        <div className="font-bold mb-1">
                          {toPersianDigits(idx + 1)}. {qs.question.prompt}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          {qs.bars.map((b) => (
                            <div key={b.label} className="flex justify-between border-b border-slate-200 pb-0.5">
                              <span>{b.label}</span>
                              <span className="font-bold">
                                {toPersianDigits(b.percent)}٪ ({toPersianDigits(b.count)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {evaluation.shuffledComments.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-1">گزیده دیدگاه‌های ناشناس (تصادفی‌شده)</h3>
                    <ul className="list-disc list-inside space-y-1 text-[11px]">
                      {evaluation.shuffledComments.map((c) => (
                        <li key={c.responseId}>{c.comment}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs">
                به دلیل نرسیدن تعداد پاسخ‌ها به حد نصاب محرمانگی ({toPersianDigits(evaluation.minThreshold)} پاسخ)، جزئیات سوالات در گزارش چاپی نمایش داده نمی‌شود.
              </p>
            )}
          </div>
        </PrintShell>
      )}
    </div>
  );
};
