// Phase 4 Plugin: Notification Templates Bank («بانک قالب‌های پیام آماده»)
// Staff-only dynamic Persian templates with clickable variable chips, Smart Instant Generator
// (single student / whole class / today's absentees from student_attendance), 1-click messenger copy, and A4/A5 formal notice print.
import React, { useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  Copy,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  Users,
  UserX,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay, getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type { NotificationTemplate, NotificationTemplateCategory, Student } from '../../types/domain';
import {
  getTodaysAbsentOrLateStudents,
  renderBatchNotificationMessages,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_VARIABLES,
} from './notificationTemplatesHelpers';

type TargetMode = 'single_student' | 'whole_class' | 'todays_absentees';

export const NotificationTemplatesPage: React.FC = () => {
  const {
    activeSchool,
    session,
    classes,
    students,
    studentAttendance,
    notificationTemplates,
    defaultWorkdayJalali,
    upsertNotificationTemplate,
    deleteNotificationTemplate,
  } = useSchoolData();

  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);

  const [categoryFilter, setCategoryFilter] = useState<NotificationTemplateCategory | 'ALL'>('ALL');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => notificationTemplates[0]?.id ?? ''
  );

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftCategory, setDraftCategory] = useState<NotificationTemplateCategory>('general');
  const [draftBody, setDraftBody] = useState<string>('');
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Smart Generator state
  const [targetMode, setTargetMode] = useState<TargetMode>('single_student');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    () => activeStudents[0]?.id ?? ''
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id ?? 'ALL');
  const [attendanceDate, setAttendanceDate] = useState<string>(
    () => defaultWorkdayJalali || getTodayJalali()
  );
  const [subjectName, setSubjectName] = useState<string>('ریاضی');
  const [customNotes, setCustomNotes] = useState<string>(
    'لطفاً در صورت نیاز با دفتر مدرسه یا معلم مربوطه هماهنگ فرمایید.'
  );
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'ALL') return notificationTemplates;
    return notificationTemplates.filter((t) => t.category === categoryFilter);
  }, [notificationTemplates, categoryFilter]);

  const activeTemplate = useMemo(
    () =>
      filteredTemplates.find((t) => t.id === selectedTemplateId) ??
      filteredTemplates[0] ??
      notificationTemplates[0] ??
      null,
    [filteredTemplates, selectedTemplateId, notificationTemplates]
  );

  // Resolve target students based on mode
  const todaysAbsentEntries = useMemo(
    () =>
      getTodaysAbsentOrLateStudents({
        jalaliDate: attendanceDate,
        students: activeStudents,
        attendanceRecords: studentAttendance,
        classIdFilter: selectedClassId,
      }),
    [attendanceDate, activeStudents, studentAttendance, selectedClassId]
  );

  const resolvedTargetStudents = useMemo<Student[]>(() => {
    if (targetMode === 'single_student') {
      const found =
        activeStudents.find((s) => s.id === selectedStudentId) ?? activeStudents[0];
      return found ? [found] : [];
    }
    if (targetMode === 'whole_class') {
      if (selectedClassId === 'ALL') return activeStudents;
      return activeStudents.filter((s) => s.classId === selectedClassId);
    }
    return todaysAbsentEntries.map((item) => item.student);
  }, [targetMode, activeStudents, selectedStudentId, selectedClassId, todaysAbsentEntries]);

  const renderedPreview = useMemo(() => {
    const body = isCreating || editingTemplate ? draftBody : activeTemplate?.body ?? '';
    if (!body.trim()) return '';
    return renderBatchNotificationMessages({
      body,
      students: resolvedTargetStudents,
      classes,
      schoolName: activeSchool.name,
      todayJalali: attendanceDate || getTodayJalali(),
      teacherName: session?.displayName ?? activeSchool.principalName,
      subjectName,
      notes: customNotes,
    });
  }, [
    isCreating,
    editingTemplate,
    draftBody,
    activeTemplate,
    resolvedTargetStudents,
    classes,
    activeSchool,
    attendanceDate,
    session,
    subjectName,
    customNotes,
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const openCreateEditor = () => {
    setEditingTemplate(null);
    setIsCreating(true);
    setDraftTitle('');
    setDraftCategory(categoryFilter === 'ALL' ? 'general' : categoryFilter);
    setDraftBody(
      'با سلام و احترام خدمت ولی گرامی {نام_دانشآموز} (کلاس {نام_کلاس})\nبه اطلاع می‌رساند {توضیحات}\nبا تشکر — {نام_معلم} ({نام_مدرسه})'
    );
  };

  const openEditEditor = (tpl: NotificationTemplate) => {
    setIsCreating(false);
    setEditingTemplate(tpl);
    setDraftTitle(tpl.title);
    setDraftCategory(tpl.category);
    setDraftBody(tpl.body);
  };

  const insertVariableChip = (token: string) => {
    const el = bodyTextareaRef.current;
    if (!el) {
      setDraftBody((prev) => `${prev} ${token}`);
      return;
    }
    const start = el.selectionStart ?? draftBody.length;
    const end = el.selectionEnd ?? draftBody.length;
    const next = `${draftBody.slice(0, start)}${token}${draftBody.slice(end)}`;
    setDraftBody(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim() || !draftBody.trim()) {
      showToast('لطفاً عنوان و متن قالب پیام را وارد کنید.');
      return;
    }
    const nowIso = new Date().toISOString();
    const tpl: NotificationTemplate = {
      id:
        editingTemplate?.id ??
        `${activeSchool.id}:ntpl:${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      schoolId: activeSchool.id,
      title: draftTitle.trim(),
      category: draftCategory,
      body: draftBody.trim(),
      createdByName: editingTemplate?.createdByName ?? session?.displayName ?? 'کادر مدرسه',
      updatedAt: nowIso,
    };
    const res = upsertNotificationTemplate(tpl);
    if (!res.ok) {
      showToast(res.errorFa ?? 'ذخیره قالب ناموفق بود.');
      return;
    }
    setSelectedTemplateId(tpl.id);
    setIsCreating(false);
    setEditingTemplate(null);
    showToast('قالب پیام با موفقیت ذخیره شد.');
  };

  const handleCopyPreview = async () => {
    if (!renderedPreview) return;
    await copyTextToClipboard(renderedPreview);
    setCopied(true);
    showToast('پیام آماده با فرمت تک‌ستونه استاندارد برای ایتا، بله و شاد کپی شد.');
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              بانک قالب‌های پیام آماده (ایتا، بله، شاد و چاپ رسمی)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            تولید فوری پیام‌های استاندارد با متغیرهای پویا برای تک‌دانش‌آموز، کل کلاس یا غایبین و
            تاخیری‌های امروز
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateEditor}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>قالب جدید</span>
          </button>
          <PrintButtons
            documentLabel="اطلاعیه رسمی مدرسه"
            disabled={!renderedPreview}
          />
        </div>
      </div>

      {toast && (
        <div className="no-print rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200">
          {toast}
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="no-print flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            categoryFilter === 'ALL'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          همه دسته‌ها ({toPersianDigits(notificationTemplates.length)})
        </button>
        {(Object.keys(TEMPLATE_CATEGORY_LABELS) as NotificationTemplateCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              categoryFilter === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            {TEMPLATE_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Main Grid: Template List / Editor + Smart Instant Generator & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Template Library & Custom Editor */}
        <div className="no-print lg:col-span-5 space-y-4">
          {(isCreating || editingTemplate) && (
            <form
              onSubmit={handleSaveTemplate}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-300 dark:border-indigo-700 p-4 space-y-3"
            >
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {editingTemplate ? 'ویرایش قالب پیام' : 'ساخت قالب پیام جدید'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="عنوان قالب (مثلاً اطلاعیه آزمون)"
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
                <select
                  value={draftCategory}
                  onChange={(e) =>
                    setDraftCategory(e.target.value as NotificationTemplateCategory)
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                >
                  {(Object.keys(TEMPLATE_CATEGORY_LABELS) as NotificationTemplateCategory[]).map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {TEMPLATE_CATEGORY_LABELS[cat]}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Clickable Dynamic Variable Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  برای درج متغیر پویا در متن پیام کلیک کنید:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariableChip(v.token)}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={bodyTextareaRef}
                rows={5}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTemplate(null);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  ذخیره قالب
                </button>
              </div>
            </form>
          )}

          {/* Templates List */}
          <div className="space-y-2.5">
            {filteredTemplates.map((tpl) => {
              const isSelected = activeTemplate?.id === tpl.id && !isCreating && !editingTemplate;
              return (
                <div
                  key={tpl.id}
                  className={`rounded-2xl border p-3.5 transition-all space-y-2 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingTemplate(null);
                        setSelectedTemplateId(tpl.id);
                      }}
                      className="text-right flex-1"
                    >
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {tpl.title}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {TEMPLATE_CATEGORY_LABELS[tpl.category]}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`ویرایش قالب ${tpl.title}`}
                        onClick={() => openEditEditor(tpl)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`حذف قالب ${tpl.title}`}
                        onClick={() => {
                          deleteNotificationTemplate(tpl.id);
                          showToast('قالب انتخاب‌شده حذف شد.');
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {tpl.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Smart Instant Generator + Live Single-Column Preview + Formal Notice Print */}
        <div className="lg:col-span-7 space-y-4">
          <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>تولیدگر هوشمند و فوری پیام</span>
            </div>

            {/* Target Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('single_student')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                  targetMode === 'single_student'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                تک‌دانش‌آموز
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('whole_class')}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                  targetMode === 'whole_class'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>کل کلاس</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('todays_absentees')}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                  targetMode === 'todays_absentees'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <UserX className="w-3.5 h-3.5 shrink-0" />
                <span>
                  غایبین و تاخیری‌های امروز ({toPersianDigits(todaysAbsentEntries.length)})
                </span>
              </button>
            </div>

            {/* Dynamic Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {targetMode === 'single_student' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    انتخاب دانش‌آموز
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                  >
                    {activeStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    فیلتر کلاس
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                  >
                    <option value="ALL">همه کلاس‌های مجاز</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  تاریخ (مبنای {'{تاریخ_امروز}'} و حضور و غیاب)
                </label>
                <input
                  type="text"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نام درس (مبنای {'{نام_درس}'})
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  توضیحات دلخواه (مبنای {'{توضیحات}'})
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Printable Formal Notice + Live Single-Column Preview */}
          <PrintShell
            school={activeSchool}
            documentTitle={activeTemplate?.title ?? 'اطلاعیه رسمی مدرسه'}
            subtitle={`تاریخ صدور: ${formatJalaliDisplay(attendanceDate || getTodayJalali(), true)} · مخاطبین: ${toPersianDigits(
              resolvedTargetStudents.length
            )} نفر`}
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 print:border-0 print:p-0">
              <div className="no-print flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  پیش‌نمایش زنده تک‌ستونه ({toPersianDigits(resolvedTargetStudents.length)} مخاطب)
                </div>
                <button
                  type="button"
                  disabled={!renderedPreview}
                  onClick={handleCopyPreview}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white whitespace-nowrap min-h-[40px]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {copied ? 'کپی شد!' : 'کپی آماده برای ایتا، بله و شاد'}
                  </span>
                </button>
              </div>

              {renderedPreview ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line font-medium print:bg-white print:border-slate-300">
                  {renderedPreview}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs sm:text-sm text-slate-500">
                  {targetMode === 'todays_absentees'
                    ? 'برای تاریخ انتخاب‌شده هیچ دانش‌آموز غایب یا تاخیری ثبت نشده است.'
                    : 'قالب یا دانش‌آموز هدف را انتخاب کنید تا پیش‌نمایش پیام نمایش داده شود.'}
                </div>
              )}
            </div>
          </PrintShell>
        </div>
      </div>
    </div>
  );
};
