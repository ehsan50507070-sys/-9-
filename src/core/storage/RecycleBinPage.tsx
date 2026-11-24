// Step 3-B: Standalone Secure Recycle Bin («سطل بازیابی امن») — Zero-Hard-Delete Instant Recovery
import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Filter,
  Lock,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useSchoolData } from '../data/DataContext';
import { PrintIconButton } from '../print/PrintIconButton';
import { toPersianDigits } from '../../lib/digits';
import { isSchoolUnderPanicLock } from '../security/DataIntegrityGuard';
import type { CollectionName } from '../../types/domain';

export const RecycleBinPage: React.FC = () => {
  const {
    session,
    allSchools,
    activeSchoolId,
    softDeletedItems,
    refreshSoftDeletedItems,
    restoreSoftDeletedRecord,
    panicModeState,
  } = useSchoolData();

  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void refreshSoftDeletedItems();
  }, [refreshSoftDeletedItems]);

  const isSuperAdmin = session?.role === 'super_admin';
  const isPrincipal = session?.role === 'principal';

  const schoolNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of allSchools) {
      map[s.id] = s.name;
    }
    map['__global__'] = 'سطح کل مجموعه';
    return map;
  }, [allSchools]);

  // Role-scoped list: Super Admin sees all 3 schools, Principal sees ONLY own school
  const scopedItems = useMemo(() => {
    if (isSuperAdmin) return softDeletedItems;
    if (isPrincipal) return softDeletedItems.filter((item) => item.schoolId === activeSchoolId);
    return [];
  }, [isSuperAdmin, isPrincipal, softDeletedItems, activeSchoolId]);

  const availableCollections = useMemo(() => {
    const map = new Map<CollectionName, string>();
    for (const item of scopedItems) {
      map.set(item.collection, item.collectionLabelFa);
    }
    return Array.from(map.entries());
  }, [scopedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedItems.filter((item) => {
      if (isSuperAdmin && schoolFilter !== 'all' && item.schoolId !== schoolFilter) return false;
      if (collectionFilter !== 'all' && item.collection !== collectionFilter) return false;
      if (q) {
        const hay = `${item.titleFa} ${item.subtitleFa ?? ''} ${item.collectionLabelFa} ${item.deletedByName} ${schoolNameById[item.schoolId] ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedItems, isSuperAdmin, schoolFilter, collectionFilter, searchQuery, schoolNameById]);

  if (!isSuperAdmin && !isPrincipal) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-6 text-center space-y-2">
        <Lock className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-rose-900 dark:text-rose-200">
          عدم دسترسی به سطل بازیابی امن
        </h2>
        <p className="text-xs text-rose-700 dark:text-rose-300">
          مشاهده و بازیابی رکوردهای حذف‌شده صرفاً در اختیار راهبر ارشد سامانه و مدیر مدرسه است.
        </p>
      </div>
    );
  }

  const handleRestore = async (collection: CollectionName, schoolId: string, id: string, titleFa: string) => {
    setFeedback(null);
    setRestoringId(`${collection}:${id}`);
    const res = await restoreSoftDeletedRecord(collection, schoolId, id);
    setRestoringId(null);
    if (res.ok) {
      setFeedback({
        type: 'ok',
        text: `رکورد «${titleFa}» با موفقیت و به‌صورت آنی بازیابی شد و به بخش مربوطه بازگشت.`,
      });
    } else {
      setFeedback({
        type: 'err',
        text: res.errorFa ?? 'بازیابی رکورد ناموفق بود.',
      });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              سطل بازیابی امن (سیاست صفر-حذف فیزیکی)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              هیچ رکوردی در سامانه به‌صورت فیزیکی پاک نمی‌شود؛ تمامی موارد حذف‌شده با ثبت نام
              حذف‌کننده و تاریخ شمسی در این گاوصندوق نگهداری و با یک کلیک بازیابی می‌شوند.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintIconButton
            documentLabel="گزارش سطل بازیابی امن"
            landscape
            targetSelector="#recycle-bin-printable"
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">کل رکوردهای قابل بازیابی</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {toPersianDigits(scopedItems.length)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">موارد مطابق فیلتر فعلی</div>
          <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1 tabular-nums">
            {toPersianDigits(filteredItems.length)}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              حفاظت Soft-Delete فعال
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
              {isSuperAdmin
                ? 'پوشش کامل هر ۳ مدرسه مجتمع'
                : `محدوده مدرسه: ${schoolNameById[activeSchoolId] ?? ''}`}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center gap-3 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان رکورد، نوع داده یا نام حذف‌کننده..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              aria-label="فیلتر مدرسه"
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              <option value="all">همه مدارس ({toPersianDigits(allSchools.length)} واحد)</option>
              {allSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <select
          aria-label="فیلتر نوع رکورد"
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
        >
          <option value="all">همه انواع رکوردها</option>
          {availableCollections.map(([col, label]) => (
            <option key={col} value={col}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / Printable Region */}
      <div
        id="recycle-bin-printable"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              سطل بازیابی امن خالی است
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              در حال حاضر هیچ رکورد حذف‌شده‌ای مطابق فیلتر انتخابی وجود ندارد. هرگاه موردی از
              بخش‌های مختلف سامانه حذف شود، بلافاصله در این فهرست قابل بازیابی خواهد بود.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-bold">نوع رکورد</th>
                  <th className="px-4 py-3 font-bold">عنوان و مشخصات</th>
                  {isSuperAdmin && <th className="px-4 py-3 font-bold">مدرسه</th>}
                  <th className="px-4 py-3 font-bold">حذف‌کننده</th>
                  <th className="px-4 py-3 font-bold">تاریخ و ساعت حذف</th>
                  <th className="px-4 py-3 font-bold">نسخه</th>
                  <th className="px-4 py-3 font-bold text-left no-print">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const locked = isSchoolUnderPanicLock(panicModeState, item.schoolId);
                  const rowKey = `${item.collection}:${item.id}`;
                  return (
                    <tr
                      key={rowKey}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {item.collectionLabelFa}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {item.titleFa}
                        </div>
                        {item.subtitleFa && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.subtitleFa}
                          </div>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {schoolNameById[item.schoolId] ?? item.schoolId}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {item.deletedByName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
                        {toPersianDigits(item.deletedAtJalali)} — {toPersianDigits(item.deletedAtTimeHm)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400">
                        v{toPersianDigits(item.recordVersion)}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap no-print">
                        <button
                          type="button"
                          disabled={locked || restoringId === rowKey}
                          onClick={() =>
                            void handleRestore(item.collection, item.schoolId, item.id, item.titleFa)
                          }
                          title={locked ? 'در وضعیت قفل اضطراری بازیابی غیرفعال است' : 'بازیابی فوری رکورد'}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {restoringId === rowKey ? 'در حال بازیابی...' : 'بازیابی فوری'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecycleBinPage;
