// Dedicated Smart Fuzzy Search Bar («جستجوی هوشمند») for instant lookup across Student Names, National IDs, and Classes across all 3 schools
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  DoorOpen,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import {
  runSmartFuzzySearch,
  type SmartSearchCategory,
  type SmartSearchResult,
} from '../../lib/fuzzySearch';
import type { AccentTheme } from '../../types/domain';
import { useSchoolData } from '../data/DataContext';
import { useRouter } from '../router/RouterContext';
import { useToast } from './ToastContext';

const SCHOOL_ACCENT_STYLES: Record<
  AccentTheme,
  { iconBg: string; dot: string; labelText: string }
> = {
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
    labelText: 'text-indigo-700 dark:text-indigo-300',
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    labelText: 'text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    iconBg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300',
    dot: 'bg-violet-600 dark:bg-violet-400',
    labelText: 'text-violet-700 dark:text-violet-300',
  },
};

const CATEGORY_TABS: ReadonlyArray<{ id: SmartSearchCategory; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'student', label: 'دانش‌آموزان' },
  { id: 'national_id', label: 'کد ملی' },
  { id: 'class', label: 'کلاس‌ها' },
];

export const SmartSearchBar: React.FC = () => {
  const {
    activeSchoolId,
    activeSchool,
    setActiveSchoolId,
    roleDef,
    searchCatalog,
    setSearchFocusTarget,
  } = useSchoolData();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SmartSearchCategory>('all');
  const [schoolScope, setSchoolScope] = useState<'all' | 'active'>('all');
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const desktopContainerRef = useRef<HTMLDivElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveScope: 'all' | string =
    searchCatalog.canSearchAllSchools && schoolScope === 'all' ? 'all' : activeSchoolId;

  // Compute all matches across current scope for live category counts
  const allScopeResults = useMemo(() => {
    if (!query.trim()) return [];
    return runSmartFuzzySearch({
      query,
      schools: searchCatalog.schools,
      students: searchCatalog.students,
      classes: searchCatalog.classes,
      teachers: searchCatalog.teachers,
      categoryFilter: 'all',
      schoolScope: effectiveScope,
      limit: 60,
    });
  }, [query, searchCatalog, effectiveScope]);

  const filteredResults = useMemo<SmartSearchResult[]>(() => {
    if (!query.trim()) return [];
    if (category === 'all') return allScopeResults.slice(0, 14);
    return runSmartFuzzySearch({
      query,
      schools: searchCatalog.schools,
      students: searchCatalog.students,
      classes: searchCatalog.classes,
      teachers: searchCatalog.teachers,
      categoryFilter: category,
      schoolScope: effectiveScope,
      limit: 14,
    });
  }, [query, category, allScopeResults, searchCatalog, effectiveScope]);

  const categoryCounts = useMemo(() => {
    if (!query.trim()) {
      return { all: 0, student: 0, national_id: 0, class: 0 };
    }
    let studentCount = 0;
    let natCount = 0;
    let classCount = 0;
    for (const r of allScopeResults) {
      if (r.entityType === 'student') {
        studentCount++;
        if (r.matchedField === 'کد ملی') natCount++;
      } else {
        classCount++;
      }
    }
    return {
      all: allScopeResults.length,
      student: studentCount,
      national_id: natCount,
      class: classCount,
    };
  }, [query, allScopeResults]);

  // Quick example suggestions derived dynamically from real catalog data
  const quickSuggestions = useMemo(() => {
    const sampleStudentSchool2 = searchCatalog.students.find((s) => s.schoolId === 'school-2');
    const sampleStudentSchool3 = searchCatalog.students.find((s) => s.schoolId === 'school-3');
    const sampleFallback = searchCatalog.students[0];
    const natSample = sampleStudentSchool3?.nationalId ?? sampleFallback?.nationalId ?? '';
    const items: Array<{ label: string; value: string; hint: string }> = [
      {
        label: sampleStudentSchool2 ? sampleStudentSchool2.fullName.split(' ')[0] : 'آراد',
        value: sampleStudentSchool2 ? sampleStudentSchool2.fullName.split(' ')[0] : 'آراد',
        hint: 'نام دانش‌آموز',
      },
      {
        label: 'پایه ششم',
        value: 'پایه ششم',
        hint: 'کلاس‌ها',
      },
    ];
    if (natSample) {
      items.push({
        label: toPersianDigits(natSample.slice(0, 5)),
        value: toPersianDigits(natSample.slice(0, 5)),
        hint: 'کد ملی',
      });
    }
    return items;
  }, [searchCatalog.students]);

  // Keep highlight index inside valid bounds when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, category, effectiveScope]);

  // Close desktop popover when clicking outside
  useEffect(() => {
    if (!desktopOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        desktopContainerRef.current &&
        !desktopContainerRef.current.contains(event.target as Node)
      ) {
        setDesktopOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [desktopOpen]);

  // Global Ctrl+K / Cmd+K shortcut to focus Smart Search immediately
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (window.innerWidth >= 1024) {
          setDesktopOpen(true);
          window.requestAnimationFrame(() => desktopInputRef.current?.focus());
        } else {
          setMobileModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Auto-focus mobile search input when modal opens
  useEffect(() => {
    if (mobileModalOpen) {
      window.requestAnimationFrame(() => mobileInputRef.current?.focus());
    }
  }, [mobileModalOpen]);

  const closeAll = useCallback(() => {
    setDesktopOpen(false);
    setMobileModalOpen(false);
    setCategory('all');
  }, []);

  const handleSelectResult = useCallback(
    (item: SmartSearchResult) => {
      if (item.schoolId !== activeSchoolId && roleDef.canSwitchSchool) {
        setActiveSchoolId(item.schoolId);
        showToast(`به «${item.schoolName}» منتقل شدید.`, 'info');
      }

      setSearchFocusTarget({
        schoolId: item.schoolId,
        classId: item.classId,
        studentId: item.studentId,
        studentName: item.entityType === 'student' ? item.title : undefined,
        timestamp: Date.now(),
      });

      navigate('/student-attendance');
      setQuery('');
      setCategory('all');
      closeAll();
    },
    [
      activeSchoolId,
      roleDef.canSwitchSchool,
      setActiveSchoolId,
      showToast,
      setSearchFocusTarget,
      navigate,
      closeAll,
    ]
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAll();
      return;
    }
    if (filteredResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = filteredResults[highlightedIndex] ?? filteredResults[0];
      if (target) {
        handleSelectResult(target);
      }
    }
  };

  const renderPanelContent = (isMobile: boolean) => (
    <div
      data-testid="smart-search-panel"
      className="flex flex-col overflow-hidden"
    >
      {/* Filters & Multi-School Scope Bar */}
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="فیلتر دسته‌بندی جستجو"
          className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            const count = categoryCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCategory(tab.id)}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {query.trim().length > 0 && count > 0 && (
                  <span className="text-[11px] tabular-nums opacity-80">
                    {toPersianDigits(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {searchCatalog.canSearchAllSchools ? (
          <div
            role="group"
            aria-label="دامنه مدارس جستجو"
            className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSchoolScope('all')}
              className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                schoolScope === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              همه {toPersianDigits(searchCatalog.schools.length)} مدرسه
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSchoolScope('active')}
              className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                schoolScope === 'active'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              مدرسه فعال
            </button>
          </div>
        ) : (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            دامنه: {activeSchool.name}
          </span>
        )}
      </div>

      {/* Results List or Quick-Start Hints */}
      {query.trim().length === 0 ? (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              جستجوی هوشمند با تحمل خطای تایپی میان نام دانش‌آموزان، کد ملی ۱۰ رقمی و کلاس‌های{' '}
              {searchCatalog.canSearchAllSchools ? 'هر سه مدرسه' : activeSchool.name}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">نمونه‌های سریع:</span>
            {quickSuggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery(s.value)}
                className="min-h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                {s.label}
                <span className="mr-1.5 text-[10px] text-slate-400">({s.hint})</span>
              </button>
            ))}
          </div>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            نتیجه‌ای برای «{query.trim()}» در این دسته یافت نشد
          </p>
          {category !== 'all' && allScopeResults.length > 0 ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCategory('all')}
              className="min-h-[38px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              نمایش {toPersianDigits(allScopeResults.length)} نتیجه در «همه»
            </button>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              بخشی از نام دانش‌آموز، چند رقم از کد ملی یا نام پایه و کلاس را وارد کنید.
            </p>
          )}
        </div>
      ) : (
        <ul
          role="listbox"
          aria-label="نتایج جستجوی هوشمند"
          className={`divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto ${
            isMobile ? 'max-h-[calc(100vh-195px)]' : 'max-h-[380px]'
          }`}
        >
          {filteredResults.map((item, idx) => {
            const accent = SCHOOL_ACCENT_STYLES[item.schoolAccent];
            const isHighlighted = idx === highlightedIndex;
            const willSwitchSchool = item.schoolId !== activeSchoolId && roleDef.canSwitchSchool;

            return (
              <li key={item.id} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  data-search-result-id={item.id}
                  data-search-school-id={item.schoolId}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectResult(item)}
                  className={`w-full px-3.5 py-2.5 text-right transition-colors flex items-center justify-between gap-3 ${
                    isHighlighted
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent.iconBg}`}
                    >
                      {item.entityType === 'student' ? (
                        item.matchedField === 'کد ملی' ? (
                          <CreditCard className="w-4 h-4" />
                        ) : (
                          <UserRound className="w-4 h-4" />
                        )
                      ) : (
                        <DoorOpen className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                          {item.matchedField}
                        </span>
                      </div>

                      {item.entityType === 'student' ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>
                            کد ملی:{' '}
                            <span dir="ltr" className="font-semibold text-slate-700 dark:text-slate-300">
                              {toPersianDigits(item.nationalId)}
                            </span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{item.className}</span>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>اتاق {toPersianDigits(item.roomCode)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{toPersianDigits(item.studentCount ?? 0)} دانش‌آموز</span>
                          {item.homeroomTeacherName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{item.homeroomTeacherName}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* School Origin Indicator */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${accent.labelText}`}>
                      <span className={`w-2 h-2 rounded-full ${accent.dot}`} aria-hidden="true" />
                      <span>{item.schoolShortLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                      {willSwitchSchool ? (
                        <>
                          <Building2 className="w-3 h-3" />
                          <span>ورود به مدرسه</span>
                        </>
                      ) : (
                        <>
                          <span>مشاهده کلاس</span>
                          <ArrowLeft className="w-3 h-3" />
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Subtle Keyboard Footer */}
      {!isMobile && (
        <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>
            {query.trim()
              ? `${toPersianDigits(filteredResults.length)} نتیجه مرتبط نمایش داده شد`
              : `${toPersianDigits(searchCatalog.students.length)} دانش‌آموز و ${toPersianDigits(searchCatalog.classes.length)} کلاس آماده جستجو`}
          </span>
          <span className="hidden xl:inline">↑↓ حرکت · Enter انتخاب · Esc بستن</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Integrated Smart Search Bar (>= lg) */}
      <div
        ref={desktopContainerRef}
        className="hidden lg:block relative flex-1 max-w-xl"
      >
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={desktopInputRef}
          type="text"
          role="combobox"
          aria-expanded={desktopOpen}
          aria-autocomplete="list"
          aria-label="جستجوی هوشمند دانش‌آموز، کد ملی و کلاس در هر سه مدرسه"
          value={query}
          onFocus={() => setDesktopOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!desktopOpen) setDesktopOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={
            searchCatalog.canSearchAllSchools
              ? `جستجوی هوشمند نام دانش‌آموز، کد ملی یا کلاس در ${toPersianDigits(searchCatalog.schools.length)} مدرسه...`
              : 'جستجوی هوشمند نام دانش‌آموز، کد ملی یا کلاس...'
          }
          className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pr-10 pl-16 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                desktopInputRef.current?.focus();
              }}
              aria-label="پاک کردن متن جستجو"
              className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd
              dir="ltr"
              className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
            >
              Ctrl K
            </kbd>
          )}
        </div>

        {desktopOpen && (
          <div className="absolute top-full mt-2 right-0 left-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50">
            {renderPanelContent(false)}
          </div>
        )}
      </div>

      {/* Mobile & Tablet Compact Search Trigger Button (< lg) */}
      <button
        type="button"
        onClick={() => setMobileModalOpen(true)}
        aria-label="باز کردن جستجوی هوشمند"
        className="lg:hidden min-h-[40px] min-w-[40px] px-2 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">
          جستجوی هوشمند
        </span>
      </button>

      {/* Mobile & Tablet Smart Search Overlay Modal (portaled to document.body to escape header backdrop-filter containing block) */}
      {mobileModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="جستجوی هوشمند مدارس"
            className="no-print lg:hidden fixed inset-0 z-50 flex flex-col bg-slate-950/60 backdrop-blur-xs p-2.5 sm:p-4"
            onClick={closeAll}
          >
            <div
              className="w-full max-w-xl mx-auto mt-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={mobileInputRef}
                    type="text"
                    aria-label="عبارت جستجوی هوشمند"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="نام دانش‌آموز، کد ملی یا کلاس..."
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-9 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        mobileInputRef.current?.focus();
                      }}
                      aria-label="پاک کردن متن جستجو"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute left-1 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeAll}
                  aria-label="بستن جستجوی هوشمند"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderPanelContent(true)}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
