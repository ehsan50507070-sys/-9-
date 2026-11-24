// Step 3: Instant Top Quick Search Bar for Student & Parent Dashboards
// Searches live across subjects, homework, educational videos, exams, handouts, announcements & messages.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  FileText,
  Film,
  MessageSquare,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import {
  collectSubjectsForContext,
  runQuickPortalSearch,
  type QuickSearchResultItem,
} from './subjectHelpers';

const KIND_ICON_MAP: Record<QuickSearchResultItem['kind'], React.FC<{ className?: string }>> = {
  subject: BookOpen,
  homework: ClipboardCheck,
  video: Film,
  exam: Sparkles,
  resource: FileText,
  announcement: Bell,
  message: MessageSquare,
};

const KIND_BADGE_CLASS: Record<QuickSearchResultItem['kind'], string> = {
  subject:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  homework:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  video:
    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  exam: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  resource:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  announcement:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  message:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
};

export const PortalQuickSearchBar: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const {
    activeRole,
    linkedStudent,
    classes,
    teachers,
    schedules,
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
    parentStaffMessages,
    classChatMessages,
  } = useSchoolData();
  const { navigate } = useRouter();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const teachersById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.fullName])),
    [teachers]
  );

  const subjects = useMemo(
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

  const results = useMemo(
    () =>
      runQuickPortalSearch({
        query,
        role: activeRole,
        subjects,
        homeworkAssignments,
        homeworkSubmissions,
        linkedStudentId: linkedStudent?.id,
        flippedLessons,
        onlineExams,
        mediaResources,
        schoolAnnouncements,
        parentStaffMessages,
        classChatMessages,
        limit: 12,
      }),
    [
      query,
      activeRole,
      subjects,
      homeworkAssignments,
      homeworkSubmissions,
      linkedStudent?.id,
      flippedLessons,
      onlineExams,
      mediaResources,
      schoolAnnouncements,
      parentStaffMessages,
      classChatMessages,
    ]
  );

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleSelect = (item: QuickSearchResultItem) => {
    setOpen(false);
    setQuery('');
    navigate(item.route);
  };

  return (
    <div ref={containerRef} className="no-print relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={
            placeholder ??
            'جستجوی سریع در دروس، تکالیف، ویدیوهای آموزشی، آزمون‌ها، جزوه‌ها و اطلاعیه‌ها...'
          }
          aria-label="جستجوی سریع پنل آموزشی"
          className="w-full min-h-[46px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 pl-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
        />
        {query.trim().length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label="پاک کردن جستجو"
            className="absolute left-2 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && query.trim().length > 0 && (
        <div
          role="listbox"
          aria-label="نتایج جستجوی سریع"
          className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        >
          {results.length === 0 ? (
            <div className="p-5 text-center text-sm text-slate-500 dark:text-slate-400">
              موردی برای «{query.trim()}» در دروس و محتوای شما پیدا نشد.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>نتایج فوری جستجو</span>
                <span className="tabular-nums">{toPersianDigits(results.length)} مورد</span>
              </div>
              {results.map((item) => {
                const Icon = KIND_ICON_MAP[item.kind];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full min-h-[52px] px-4 py-2.5 flex items-center justify-between gap-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${KIND_BADGE_CLASS[item.kind]}`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {toPersianDigits(item.subtitle)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badgeFa && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                          {toPersianDigits(item.badgeFa)}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${KIND_BADGE_CLASS[item.kind]}`}
                      >
                        {item.kindLabelFa}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
