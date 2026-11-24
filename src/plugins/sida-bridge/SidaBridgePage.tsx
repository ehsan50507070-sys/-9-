// Phase 5.5 Enterprise Plugin: SIDA Smart Bridge («پل اتصال هوشمند به سامانه سیدا») — 6-Tab Professional Suite
import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ClipboardCheck,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  UserPlus,
  Zap,
} from 'lucide-react';
import { useSectionLabel } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';
import { SidaAppealsTab } from './SidaAppealsTab';
import { SidaBulkImportTab } from './SidaBulkImportTab';
import { SidaExportsTransferTab } from './SidaExportsTransferTab';
import { SidaIndividualTab } from './SidaIndividualTab';
import { SidaReadinessTab } from './SidaReadinessTab';
import { SidaSpeedEntryTab } from './SidaSpeedEntryTab';

type SidaTabId = 'individual' | 'bulk_import' | 'readiness' | 'speed_entry' | 'exports' | 'appeals';

export const SidaBridgePage: React.FC = () => {
  const {
    activeRole,
    roleDef,
    gradebookEntries,
    onlineExams,
    gradeAppeals,
  } = useSchoolData();
  const { getSectionTitle } = useSectionLabel();
  const { navigate } = useRouter();

  const canManageRoster = roleDef.canImportSidaStudents; // complex_admin, principal, deputy
  const canOpenSmartImportWizard = activeRole === 'super_admin' || activeRole === 'principal';

  const [activeTab, setActiveTab] = useState<SidaTabId>(() =>
    canManageRoster ? 'individual' : 'speed_entry'
  );
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [speedJumpTarget, setSpeedJumpTarget] = useState<{
    classId?: string;
    subject?: string;
  }>({});

  const showSuccessToast = (msg: string) => {
    setToast(msg);
    setErrorMsg(null);
    window.setTimeout(() => setToast(null), 3500);
  };

  const showErrorToast = (msg: string) => {
    setErrorMsg(msg);
    setToast(null);
  };

  const availableSubjects = useMemo(() => {
    const set = new Set<string>([
      'ریاضی',
      'فارسی و نگارش',
      'علوم تجربی',
      'قرآن و هدیه‌ها',
      'مطالعات اجتماعی',
    ]);
    for (const g of gradebookEntries) if (g.subject) set.add(g.subject);
    for (const ex of onlineExams) if (ex.subject) set.add(ex.subject);
    return Array.from(set);
  }, [gradebookEntries, onlineExams]);

  const pageTitle = getSectionTitle('sida-bridge', 'پل اتصال هوشمند به سامانه سیدا');

  const tabs: Array<{
    id: SidaTabId;
    labelFa: string;
    icon: React.ReactNode;
    badge?: number;
    visible: boolean;
  }> = [
    {
      id: 'individual',
      labelFa: 'ثبت و ویرایش فردی (سیدا)',
      icon: <UserPlus className="w-4 h-4 shrink-0" />,
      visible: canManageRoster,
    },
    {
      id: 'bulk_import',
      labelFa: 'ورود گروهی هوشمند (اکسل/CSV)',
      icon: <Upload className="w-4 h-4 shrink-0" />,
      visible: canManageRoster,
    },
    {
      id: 'readiness',
      labelFa: 'عیب‌یاب و پایش آمادگی سیدا',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
      visible: true,
    },
    {
      id: 'speed_entry',
      labelFa: 'دستیار ورود سریع نمرات در سیدا',
      icon: <Zap className="w-4 h-4 shrink-0" />,
      visible: true,
    },
    {
      id: 'exports',
      labelFa: 'خروجی استاندارد و انتقال کلاس',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
      visible: true,
    },
    {
      id: 'appeals',
      labelFa: 'اعتراضات نمره و صورتجلسه اصلاح',
      icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
      badge: gradeAppeals.length,
      visible: true,
    },
  ];

  return (
    <div className="space-y-4" data-testid="sida-bridge-page">
      {/* Header & 6-Tab Navigation */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-9 h-9 rounded-xl brand-bg flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {pageTitle}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  مجموعه ابزارهای یکپارچه ثبت فردی و گروهی اکسل، پایش آمادگی، ورود سریع نمرات در سیدا و صورتجلسه اعتراضات
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {canOpenSmartImportWizard && (
              <button
                type="button"
                onClick={() => navigate('/smart-import-wizard')}
                data-testid="open-smart-import-from-sida"
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-3.5 text-xs font-bold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>ویزارد نگاشت هوشمند جدول‌های سیدا</span>
              </button>
            )}
            {activeRole === 'teacher' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                دسترسی معلم: پایش آمادگی، دستیار ورود سریع، خروجی و بررسی اعتراضات کلاس‌های محول‌شده
              </span>
            )}
          </div>
        </div>

        {/* 6-Tab Strip */}
        <div
          className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800"
          role="tablist"
          aria-label="بخش‌های سامانه سیدا"
        >
          {tabs
            .filter((t) => t.visible)
            .map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-testid={`sida-tab-${tab.id}`}
                  aria-selected={isSelected}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setErrorMsg(null);
                  }}
                  className={`min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'brand-btn shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.labelFa}</span>
                  {typeof tab.badge === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[11px] tabular-nums ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {toPersianDigits(tab.badge)}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Inline Toast & Error Banners */}
      {toast && (
        <div
          role="status"
          className="no-print rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200"
        >
          {toast}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="no-print rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-800 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Active Tab Content */}
      {activeTab === 'individual' && canManageRoster && (
        <SidaIndividualTab
          onSuccessToast={showSuccessToast}
          onErrorToast={showErrorToast}
        />
      )}

      {activeTab === 'bulk_import' && canManageRoster && (
        <SidaBulkImportTab
          onSuccessToast={showSuccessToast}
          onErrorToast={showErrorToast}
        />
      )}

      {activeTab === 'readiness' && (
        <SidaReadinessTab
          onSuccessToast={showSuccessToast}
          onErrorToast={showErrorToast}
          onJumpToSpeedEntry={(clsId, subj) => {
            setSpeedJumpTarget({ classId: clsId, subject: subj });
            setActiveTab('speed_entry');
          }}
        />
      )}

      {activeTab === 'speed_entry' && (
        <SidaSpeedEntryTab
          initialClassId={speedJumpTarget.classId}
          initialSubject={speedJumpTarget.subject}
          availableSubjects={availableSubjects}
          onSuccessToast={showSuccessToast}
          onErrorToast={showErrorToast}
        />
      )}

      {activeTab === 'exports' && (
        <SidaExportsTransferTab
          availableSubjects={availableSubjects}
          onSuccessToast={showSuccessToast}
          onErrorToast={showErrorToast}
        />
      )}

      {activeTab === 'appeals' && (
        <SidaAppealsTab
          onSuccessToast={showSuccessToast}
          onErrorToast={showErrorToast}
        />
      )}
    </div>
  );
};
