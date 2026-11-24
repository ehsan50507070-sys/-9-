// Dashboard Widget for Add-on 3: Smart Substitute Finder
import React, { useMemo } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { computeSubstitutionNeeds } from '../../core/plugins/pluginHelpers';
import { useRouter } from '../../core/router/RouterContext';
import { toPersianDigits } from '../../lib/digits';
import { getPersianWeekdayFromJalali } from '../../lib/jalali';

export const SubstitutionWidget: React.FC = () => {
  const {
    activeSchoolId,
    defaultWorkdayJalali,
    teachers,
    schedules,
    staffAttendance,
    substitutions,
  } = useSchoolData();
  const { navigate } = useRouter();

  const needs = useMemo(
    () =>
      computeSubstitutionNeeds({
        schoolId: activeSchoolId,
        jalaliDate: defaultWorkdayJalali,
        weekday: getPersianWeekdayFromJalali(defaultWorkdayJalali),
        teachers,
        schedules,
        staffAttendance,
        substitutions,
      }),
    [activeSchoolId, defaultWorkdayJalali, teachers, schedules, staffAttendance, substitutions]
  );

  const pending = needs.filter((n) => !n.existingAssignment).length;
  const covered = needs.filter((n) => Boolean(n.existingAssignment)).length;

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              جایگزینی هوشمند کادر
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {toPersianDigits(needs.length)} مورد امروز
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2 tabular-nums">
          <span
            className={`text-3xl font-extrabold ${
              pending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {toPersianDigits(pending)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            زنگ در انتظار تخصیص جایگزین
          </span>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {toPersianDigits(covered)} مورد تا این لحظه با همکاران آزاد مدرسه پوشش داده شده است.
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate('/substitution')}
        className="mt-4 min-h-[42px] w-full inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span>مدیریت و تخصیص جایگزین</span>
        <ArrowLeft className="w-4 h-4" />
      </button>
    </section>
  );
};
