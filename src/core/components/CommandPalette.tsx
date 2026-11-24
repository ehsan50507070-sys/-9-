// Global Quick Search Command Palette (Ctrl + K) — Role-Scoped Instant Fuzzy Search across Modules, Students, Staff, Mock Exams & Quick Actions
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  FolderOpen,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import { useSectionLabel } from '../appearance/AppearanceContext';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import { PluginIcon } from '../ui/IconResolver';
import { useToast } from '../ui/ToastContext';
import {
  buildCommandPaletteItems,
  COMMAND_CATEGORY_LABELS,
  type CommandItemCategory,
  type CommandPaletteItem,
} from './commandPaletteHelpers';

const CATEGORY_ORDER: CommandItemCategory[] = [
  'students',
  'modules',
  'mock_exams',
  'staff',
  'quick_actions',
];

export const CommandPalette: React.FC = () => {
  const {
    activeRole,
    activeSchoolId,
    roleDef,
    setActiveSchoolId,
    pluginStatuses,
    roleGovernanceConfigs,
    searchCatalog,
    allMockExamsForSchool,
    setSearchFocusTarget,
  } = useSchoolData();
  const { selectedAcademicYearId, isViewingArchivedYear } = useAcademicYear();
  const { getSectionTitle } = useSectionLabel();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const yearMockExams = useMemo(
    () => allMockExamsForSchool.filter((ex) => ex.academicYearId === selectedAcademicYearId),
    [allMockExamsForSchool, selectedAcademicYearId]
  );

  const items = useMemo<CommandPaletteItem[]>(
    () =>
      buildCommandPaletteItems({
        query,
        activeRole,
        activeSchoolId,
        canSwitchSchool: roleDef.canSwitchSchool,
        pluginStatuses,
        roleGovernanceConfigs,
        getSectionTitle,
        schools: searchCatalog.schools,
        students: searchCatalog.students,
        classes: searchCatalog.classes,
        teachers: searchCatalog.teachers,
        mockExams: yearMockExams,
        isViewingArchivedYear,
      }),
    [
      query,
      activeRole,
      activeSchoolId,
      roleDef.canSwitchSchool,
      pluginStatuses,
      roleGovernanceConfigs,
      getSectionTitle,
      searchCatalog,
      yearMockExams,
      isViewingArchivedYear,
    ]
  );

  // Group items preserving deterministic category order for flat keyboard indexing
  const grouped = useMemo(() => {
    const groups: Array<{ category: CommandItemCategory; items: CommandPaletteItem[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const catItems = items.filter((i) => i.category === cat);
      if (catItems.length > 0) {
        groups.push({ category: cat, items: catItems });
      }
    }
    return groups;
  }, [items]);

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery('');
    }
  }, [open]);

  const executeStudentJump = useCallback(
    (
      item: CommandPaletteItem,
      target: 'profile' | 'mock_report' | 'attendance'
    ) => {
      if (item.schoolId && item.schoolId !== activeSchoolId && roleDef.canSwitchSchool) {
        setActiveSchoolId(item.schoolId);
      }
      if (item.studentId && item.classId && item.schoolId) {
        setSearchFocusTarget({
          schoolId: item.schoolId,
          classId: item.classId,
          studentId: item.studentId,
          studentName: item.title,
          timestamp: Date.now(),
        });
      }
      if (target === 'profile') {
        navigate('/electronic-profiles');
      } else if (target === 'mock_report') {
        navigate('/mock-exams');
      } else {
        navigate('/student-attendance');
      }
      setOpen(false);
    },
    [activeSchoolId, roleDef.canSwitchSchool, setActiveSchoolId, setSearchFocusTarget, navigate]
  );

  const executeItem = useCallback(
    (item: CommandPaletteItem) => {
      if (item.category === 'students') {
        executeStudentJump(item, 'profile');
        return;
      }

      if (item.actionType === 'switch_school' && item.schoolId) {
        setActiveSchoolId(item.schoolId);
        showToast(`مدرسه فعال به «${item.schoolName ?? ''}» تغییر یافت.`, 'success');
        setOpen(false);
        return;
      }

      if (item.actionType === 'create_mock_exam') {
        try {
          window.sessionStorage.setItem('mock_exam_intent', 'create');
        } catch {
          // ignore
        }
        navigate('/mock-exams');
        setOpen(false);
        return;
      }

      if (item.actionType === 'print_report_card') {
        if (item.route === '/mock-exams') {
          try {
            window.sessionStorage.setItem('mock_exam_intent', 'print_report');
          } catch {
            // ignore
          }
        }
        navigate(item.route ?? '/mock-exams');
        setOpen(false);
        return;
      }

      if (item.category === 'mock_exams' && item.examId) {
        try {
          window.sessionStorage.setItem('mock_exam_intent', `exam:${item.examId}`);
        } catch {
          // ignore
        }
        navigate('/mock-exams');
        setOpen(false);
        return;
      }

      if (item.schoolId && item.schoolId !== activeSchoolId && roleDef.canSwitchSchool) {
        setActiveSchoolId(item.schoolId);
      }

      if (item.route) {
        navigate(item.route);
      }
      setOpen(false);
    },
    [executeStudentJump, setActiveSchoolId, showToast, navigate, activeSchoolId, roleDef.canSwitchSchool]
  );

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        flatItems.length === 0 ? 0 : (prev - 1 + flatItems.length) % flatItems.length
      );
    } else if (e.key === 'Enter' && flatItems[activeIndex]) {
      e.preventDefault();
      executeItem(flatItems[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  let runningFlatIndex = -1;

  return (
    <>
      {/* Header Trigger Button */}
      <button
        type="button"
        data-testid="command-palette-trigger"
        onClick={() => setOpen(true)}
        aria-label="جستجوی سریع سامانه (Ctrl+K)"
        className="min-h-[38px] sm:min-h-[40px] flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 sm:px-3 text-xs text-slate-500 dark:text-slate-400 transition-colors shrink-0 sm:w-52 lg:w-64 justify-between"
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Search className="w-4 h-4 shrink-0 text-slate-400" />
          <span className="hidden sm:inline truncate">جستجوی سریع...</span>
        </span>
        <kbd
          dir="ltr"
          className="hidden sm:inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Ctrl+K
        </kbd>
      </button>

      {/* Centered Command Palette Modal Portal */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 backdrop-blur-[2px] pt-14 sm:pt-20 px-3"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="پالت جستجوی سریع سامانه"
              data-testid="command-palette-modal"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleModalKeyDown}
              className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[78vh]"
            >
              {/* Search Input Row */}
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <Search className="w-5 h-5 brand-text shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  data-testid="command-palette-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جستجوی ماژول‌ها، دانش‌آموزان، کد ملی، آزمون‌های آزمایشی یا اقدامات سریع..."
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="پاک کردن عبارت جستجو"
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="بستن جستجوی سریع"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-500"
                >
                  ESC
                </button>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
                {grouped.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    نتیجه‌ای مطابق با عبارت «{query}» در محدوده دسترسی شما یافت نشد.
                  </div>
                ) : (
                  grouped.map((group) => (
                    <div key={group.category} className="space-y-1">
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>{COMMAND_CATEGORY_LABELS[group.category]}</span>
                        <span className="tabular-nums">{toPersianDigits(group.items.length)}</span>
                      </div>

                      {group.items.map((item) => {
                        runningFlatIndex += 1;
                        const myIndex = runningFlatIndex;
                        const isHighlighted = myIndex === activeIndex;

                        return (
                          <div
                            key={item.id}
                            onMouseEnter={() => setActiveIndex(myIndex)}
                            onClick={() => executeItem(item)}
                            className={`rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors ${
                              isHighlighted
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-slate-900 dark:text-white'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                                {item.category === 'modules' && item.iconName ? (
                                  <PluginIcon name={item.iconName as never} className="w-4 h-4" />
                                ) : item.category === 'students' ? (
                                  <UserRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                ) : item.category === 'staff' ? (
                                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : item.category === 'mock_exams' ? (
                                  <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                ) : item.actionType === 'switch_school' ? (
                                  <Building2 className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <Sparkles className="w-4 h-4 brand-text" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold truncate">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {item.subtitle}
                                </div>
                              </div>
                            </div>

                            {/* Inline Student Quick Actions */}
                            {item.category === 'students' && (
                              <div
                                className="flex items-center gap-1 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => executeStudentJump(item, 'profile')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                >
                                  <FolderOpen className="w-3 h-3 text-indigo-600" />
                                  پرونده
                                </button>
                                <button
                                  type="button"
                                  onClick={() => executeStudentJump(item, 'mock_report')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                >
                                  <FileCheck2 className="w-3 h-3 text-emerald-600" />
                                  کارنامه
                                </button>
                                <button
                                  type="button"
                                  onClick={() => executeStudentJump(item, 'attendance')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                >
                                  <ClipboardCheck className="w-3 h-3 text-amber-600" />
                                  حضور
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Keyboard Hints Footer */}
              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>جستجو محدود به سطح دسترسی نقش فعلی شماست</span>
                <div className="flex items-center gap-3">
                  <span>↑↓ جابه‌جایی</span>
                  <span>Enter انتخاب</span>
                  <span>Esc بستن</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
