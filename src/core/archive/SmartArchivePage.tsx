// Step 3: Smart Categorized Content & Video Archive («آرشیو هوشمند محتوا»)
// Auto-captures videos, handouts & questions across academic years with multi-faceted search/filtering,
// 1-click Reuse in New Class («استفاده مجدد در کلاس جدید»), and printable catalog via PrintIconButton.
import React, { useMemo, useState } from 'react';
import {
  Archive,
  CopyCheck,
  Filter,
  Lock,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import type { SmartArchiveContentType, SmartContentArchiveItem } from '../../types/domain';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import { useSchoolData } from '../data/DataContext';
import { PrintIconButton } from '../print/PrintIconButton';
import { generateUUID, sanitizeText, sanitizeUrl } from '../security/sanitize';
import { useToast } from '../ui/ToastContext';
import {
  buildArchiveCatalogPrintHtml,
  CONTENT_TYPE_META,
  filterSmartArchiveItems,
} from './archiveHelpers';

export const SmartArchivePage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    session,
    linkedTeacher,
    classes,
    smartContentArchive,
    upsertSmartArchiveItem,
    deleteSmartArchiveItem,
    reuseArchiveItemInClass,
  } = useSchoolData();
  const { isViewingArchivedYear, academicYearId, academicYears } = useAcademicYear();
  const { showToast } = useToast();

  // Filter states
  const [query, setQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterType, setFilterType] = useState<'all' | SmartArchiveContentType>('all');
  const [filterTag, setFilterTag] = useState('all');

  // Add item modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<SmartArchiveContentType>('video');
  const [newSubject, setNewSubject] = useState('ریاضی');
  const [newGradeLevel, setNewGradeLevel] = useState<number>(classes[0]?.gradeLevel ?? 5);
  const [newTags, setNewTags] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Reuse in new class modal state
  const [reusingItem, setReusingItem] = useState<SmartContentArchiveItem | null>(null);
  const [reuseClassId, setReuseClassId] = useState<string>(classes[0]?.id ?? '');
  const [reuseDeadline, setReuseDeadline] = useState(() => addDaysToJalali(getTodayJalali(), 5));

  const canDelete =
    !isViewingArchivedYear &&
    (activeRole === 'principal' ||
      activeRole === 'deputy' ||
      activeRole === 'complex_admin' ||
      activeRole === 'super_admin');

  // Facet options derived from actual archive items
  const facets = useMemo(() => {
    const years = Array.from(
      new Set([
        ...academicYears.map((y) => y.id),
        ...smartContentArchive.map((i) => i.academicYearId),
      ])
    ).sort();
    const grades = Array.from(new Set(smartContentArchive.map((i) => i.gradeLevel))).sort(
      (a, b) => a - b
    );
    const subjects = Array.from(new Set(smartContentArchive.map((i) => i.subject))).sort((a, b) =>
      a.localeCompare(b, 'fa')
    );
    const teachers = Array.from(new Set(smartContentArchive.map((i) => i.teacherName))).sort(
      (a, b) => a.localeCompare(b, 'fa')
    );
    const tags = Array.from(new Set(smartContentArchive.flatMap((i) => i.tags))).sort((a, b) =>
      a.localeCompare(b, 'fa')
    );
    return { years, grades, subjects, teachers, tags };
  }, [smartContentArchive, academicYears]);

  const filteredItems = useMemo(
    () =>
      filterSmartArchiveItems(smartContentArchive, {
        query,
        academicYearId: filterYear,
        gradeLevel: filterGrade,
        subject: filterSubject,
        teacherName: filterTeacher,
        contentType: filterType,
        tag: filterTag,
      }),
    [
      smartContentArchive,
      query,
      filterYear,
      filterGrade,
      filterSubject,
      filterTeacher,
      filterType,
      filterTag,
    ]
  );

  const printHtml = useMemo(
    () =>
      buildArchiveCatalogPrintHtml({
        schoolName: activeSchool.name,
        jalaliDate: getTodayJalali(),
        items: filteredItems,
      }),
    [activeSchool.name, filteredItems]
  );

  const handleCreateArchiveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewingArchivedYear) return;
    const title = sanitizeText(newTitle, 160);
    const subject = sanitizeText(newSubject, 80);
    if (!title || !subject) {
      showToast('عنوان و نام درس الزامی است.', 'warning');
      return;
    }
    const nowIso = new Date().toISOString();
    const parsedTags = newTags
      .split(/[،,]/)
      .map((t) => sanitizeText(t, 40))
      .filter(Boolean);

    const res = upsertSmartArchiveItem({
      id: generateUUID(),
      schoolId: activeSchoolId,
      complexId: activeSchool.complexId ?? 'complex-1',
      academicYearId,
      gradeLevel: newGradeLevel,
      gradeLabel: `پایه ${toPersianDigits(newGradeLevel)}`,
      subject,
      teacherId: linkedTeacher?.id ?? session?.userId ?? 'staff',
      teacherName: linkedTeacher?.fullName ?? session?.displayName ?? 'کادر آموزشی',
      contentType: newType,
      title,
      description: sanitizeText(newDesc, 800) || title,
      tags: parsedTags.length > 0 ? parsedTags : [subject, CONTENT_TYPE_META[newType].labelFa],
      url: sanitizeUrl(newUrl) || undefined,
      attachmentName: newType === 'video' ? 'ویدیو آموزشی' : 'محتوای آرشیوی',
      reuseCount: 0,
      reusedInClassIds: [],
      createdAtJalali: getTodayJalali(),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      createdByUserId: session?.userId ?? 'staff',
    });

    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان ثبت در آرشیو نبود.', 'warning');
      return;
    }
    setAddModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewTags('');
    setNewUrl('');
    showToast('محتوا با موفقیت در آرشیو هوشمند ثبت شد.');
  };

  const handleConfirmReuse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reusingItem || !reuseClassId || isViewingArchivedYear) return;
    const res = reuseArchiveItemInClass({
      archiveId: reusingItem.id,
      targetClassId: reuseClassId,
      deadlineJalali: sanitizeText(reuseDeadline, 20),
    });
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان بازاستفاده نبود.', 'warning');
      return;
    }
    setReusingItem(null);
    showToast(`«${reusingItem.title}» با موفقیت در کلاس انتخاب‌شده منتشر و بازاستفاده شد.`);
  };

  const handleDeleteItem = (item: SmartContentArchiveItem) => {
    if (!canDelete) return;
    const res = deleteSmartArchiveItem(item.id);
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان حذف نبود.', 'warning');
      return;
    }
    showToast('مورد از آرشیو هوشمند حذف شد.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Archive className="w-6 h-6 brand-text shrink-0" />
            آرشیو هوشمند محتوا و ویدیوها
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            تمامی ویدیوهای آموزشی، جزوه‌ها و سوالات ثبت‌شده به‌صورت خودکار با برچسب سال تحصیلی، پایه،
            درس و معلم بایگانی می‌شوند و با یک کلیک در کلاس‌های جدید قابل بازاستفاده‌اند.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isViewingArchivedYear && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-4 text-xs sm:text-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              افزودن محتوا به آرشیو
            </button>
          )}
          <PrintIconButton
            landscape
            documentLabel="فهرست آرشیو هوشمند محتوا"
            html={printHtml}
            disabled={filteredItems.length === 0}
          />
        </div>
      </div>

      {isViewingArchivedYear && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>در حالت مشاهده سال آرشیوی هستید؛ برای افزودن یا بازاستفاده به سال فعال برگردید.</span>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">کل اقلام آرشیو</div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {toPersianDigits(smartContentArchive.length)}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-sky-600 dark:text-sky-400 font-semibold">ویدیوهای آموزشی</div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {toPersianDigits(smartContentArchive.filter((i) => i.contentType === 'video').length)}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">جزوه و محتوا</div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {toPersianDigits(smartContentArchive.filter((i) => i.contentType === 'handout').length)}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">سوال و نمونه آزمون</div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {toPersianDigits(smartContentArchive.filter((i) => i.contentType === 'question').length)}
          </div>
        </div>
      </div>

      {/* Multi-Faceted Search & Filter Panel */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          جستجو و فیلتر هوشمند آرشیو
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در عنوان، توضیحات، برچسب‌ها، نام درس یا معلم..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <select
            aria-label="فیلتر سال تحصیلی"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه سال‌ها</option>
            {facets.years.map((yr) => (
              <option key={yr} value={yr}>
                سال {toPersianDigits(yr)}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر پایه"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه پایه‌ها</option>
            {facets.grades.map((g) => (
              <option key={g} value={String(g)}>
                پایه {toPersianDigits(g)}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر درس"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه دروس</option>
            {facets.subjects.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر معلم"
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه معلمان</option>
            {facets.teachers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر نوع محتوا"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | SmartArchiveContentType)}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه انواع</option>
            <option value="video">ویدیوی آموزشی</option>
            <option value="handout">جزوه و محتوا</option>
            <option value="question">سوال و نمونه آزمون</option>
          </select>

          <select
            aria-label="فیلتر برچسب"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه برچسب‌ها</option>
            {facets.tags.map((tg) => (
              <option key={tg} value={tg}>
                #{tg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Archive Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          محتوایی با فیلترهای انتخابی در آرشیو یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const typeMeta = CONTENT_TYPE_META[item.contentType];
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${typeMeta.badgeClass}`}
                    >
                      {typeMeta.labelFa}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                      سال {toPersianDigits(item.academicYearId)} · {toPersianDigits(item.gradeLabel)}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h2>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      درس {item.subject} · معلم: {item.teacherName}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-6 line-clamp-3">
                    {item.description}
                  </p>

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 4).map((tg) => (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => setFilterTag(tg)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <Tag className="w-3 h-3" />
                          {tg}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    بازاستفاده: {toPersianDigits(item.reuseCount)} بار
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isViewingArchivedYear || classes.length === 0}
                      onClick={() => {
                        setReusingItem(item);
                        setReuseClassId(classes[0]?.id ?? '');
                        setReuseDeadline(addDaysToJalali(getTodayJalali(), 5));
                      }}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-3 text-xs font-bold disabled:opacity-50"
                    >
                      <CopyCheck className="w-3.5 h-3.5" />
                      استفاده مجدد در کلاس جدید
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        aria-label={`حذف ${item.title}`}
                        className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Archive Item Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                افزودن محتوا به آرشیو هوشمند
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateArchiveItem} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    نوع محتوا
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as SmartArchiveContentType)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="video">ویدیوی آموزشی</option>
                    <option value="handout">جزوه و محتوا</option>
                    <option value="question">سوال و نمونه آزمون</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    نام درس
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    پایه تحصیلی
                  </label>
                  <select
                    value={newGradeLevel}
                    onChange={(e) => setNewGradeLevel(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        پایه {toPersianDigits(g)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  عنوان محتوا
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثلاً: تدریس فصل کسرها و اعداد مخلوط"
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  توضیحات
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="خلاصه محتوا، سرفصل یا راهنمای استفاده..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    برچسب‌ها (با ویرگول جدا کنید)
                  </label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="فصل اول، جمع‌بندی، نوبت اول"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    لینک منبع (اختیاری)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl brand-btn text-xs sm:text-sm font-bold"
                >
                  ذخیره در آرشیو
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reuse in New Class Modal */}
      {reusingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                استفاده مجدد در کلاس جدید
              </h3>
              <button
                type="button"
                onClick={() => setReusingItem(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100">{reusingItem.title}</div>
              <div className="text-slate-500 dark:text-slate-400">
                درس {reusingItem.subject} · {CONTENT_TYPE_META[reusingItem.contentType].labelFa}
              </div>
            </div>

            <form onSubmit={handleConfirmReuse} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  انتخاب کلاس مقصد
                </label>
                <select
                  value={reuseClassId}
                  onChange={(e) => setReuseClassId(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {reusingItem.contentType === 'video' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    مهلت مشاهده دانش‌آموزان (شمسی)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={reuseDeadline}
                    onChange={(e) => setReuseDeadline(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReusingItem(null)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl brand-btn text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
                >
                  <CopyCheck className="w-4 h-4" />
                  انتشار در کلاس انتخابی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
