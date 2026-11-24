// Add-on 10: Class Rewards & Auto A4 Certificate Generator (#/rewards)
import React, { useMemo, useState } from 'react';
import {
  Award,
  Copy,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useAppearance } from '../../core/appearance/AppearanceContext';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { triggerPrint } from '../../core/print/printService';
import { EmptyStateSvg } from '../../core/ui/EmptyStateSvg';
import { useToast } from '../../core/ui/ToastContext';
import { copyTextToClipboard } from '../../lib/messenger';
import { toPersianDigits } from '../../lib/digits';
import type { StudentReward } from '../../types/domain';
import {
  CertificatePrintView,
  type CertificatePaperSize,
  type CertificateRecipientType,
} from './CertificatePrintView';

interface PresetBadge {
  id: string;
  title: string;
  category: string;
  color: StudentReward['badgeColor'];
  defaultReason: string;
}

const PRESET_BADGES: PresetBadge[] = [
  {
    id: 'top-week',
    title: 'شاگرد ممتاز هفته',
    category: 'پیشرفت تحصیلی',
    color: 'amber',
    defaultReason: 'حضور منظم، مشارکت فعال در کلاس و انجام کامل تمرین‌های هفتگی با کیفیت عالی.',
  },
  {
    id: 'remarkable-progress',
    title: 'پیشرفت چشمگیر',
    category: 'رشد آموزشی',
    color: 'emerald',
    defaultReason: 'جهش محسوس در درک مفاهیم درسی و ارتقای مستمر عملکرد کلاسی نسبت به ماه گذشته.',
  },
  {
    id: 'discipline-star',
    title: 'نظم و ادب برتر',
    category: 'اخلاق و انضباط',
    color: 'indigo',
    defaultReason: 'رعایت الگوی مثال‌زدنی ادب، احترام به همکلاسی‌ها و نظم مستمر در محیط آموزشی.',
  },
  {
    id: 'teamwork-hero',
    title: 'همکاری گروهی',
    category: 'مهارت اجتماعی',
    color: 'sky',
    defaultReason: 'همراهی سازنده با همکلاسی‌ها در فعالیت‌های گروهی و کمک مسئولانه در پروژه‌های کلاسی.',
  },
  {
    id: 'homework-champ',
    title: 'قهرمان تکالیف',
    category: 'مسئولیت‌پذیری',
    color: 'violet',
    defaultReason: 'تحویل به‌موقع، منظم و دقیق تمامی تکالیف آنلاین و کاربرگ‌های آموزشی.',
  },
  {
    id: 'creative-thinker',
    title: 'پژوهشگر خلاق',
    category: 'خلاقیت و پژوهش',
    color: 'rose',
    defaultReason: 'ارائه ایده‌های نوآورانه و کنجکاوی هدفمند در حل مسائل و فعالیت‌های کلاسی.',
  },
];

const BADGE_SURFACE_MAP: Record<
  StudentReward['badgeColor'],
  { bg: string; text: string; border: string }
> = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/70',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/70',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/70',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/70',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800/70',
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/70',
  },
};

export const RewardsPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    activeRole,
    roleDef,
    session,
    classes,
    students,
    studentRewards,
    defaultWorkdayJalali,
    addStudentReward,
    deleteStudentReward,
    linkedStudent,
    globalSystemConfig,
  } = useSchoolData();
  const { schoolLogoUrl } = useAppearance();
  const { showToast } = useToast();

  const isParent = activeRole === 'parent';
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [certificateReward, setCertificateReward] = useState<StudentReward | null>(null);
  const [paperSize, setPaperSize] = useState<CertificatePaperSize>('a4');
  const [recipientType, setRecipientType] = useState<CertificateRecipientType>('student');

  // Award Modal state
  const [showAwardModal, setShowAwardModal] = useState<boolean>(false);
  const [formClassId, setFormClassId] = useState<string>(classes[0]?.id ?? '');
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_BADGES[0].id);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('تلاش و کوشش');
  const [customColor, setCustomColor] = useState<StudentReward['badgeColor']>('amber');
  const [formReason, setFormReason] = useState<string>(PRESET_BADGES[0].defaultReason);
  const [formDate, setFormDate] = useState<string>(defaultWorkdayJalali);
  const [formError, setFormError] = useState<string | null>(null);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const categories = useMemo(() => {
    const set = new Set<string>(PRESET_BADGES.map((b) => b.category));
    for (const r of studentRewards) {
      set.add(r.category);
    }
    return Array.from(set);
  }, [studentRewards]);

  const filteredRewards = useMemo(() => {
    return studentRewards
      .filter((r) => (selectedClassId === 'all' ? true : r.classId === selectedClassId))
      .filter((r) => (selectedCategory === 'all' ? true : r.category === selectedCategory))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [studentRewards, selectedClassId, selectedCategory]);

  // Leaderboard grouped by student (only for staff/teachers)
  const leaderboard = useMemo(() => {
    const map = new Map<
      string,
      { studentId: string; studentName: string; className: string; count: number; latestBadge: string }
    >();
    for (const reward of filteredRewards) {
      const student = studentById.get(reward.studentId);
      const cls = classById.get(reward.classId);
      if (!student) continue;
      const existing = map.get(student.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(student.id, {
          studentId: student.id,
          studentName: student.fullName,
          className: cls?.name ?? '—',
          count: 1,
          latestBadge: reward.badgeTitle,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredRewards, studentById, classById]);

  const modalClassStudents = useMemo(
    () => students.filter((s) => s.active && (formClassId ? s.classId === formClassId : true)),
    [students, formClassId]
  );

  const openAwardModal = (prefillStudentId?: string) => {
    const targetStudent = prefillStudentId ? studentById.get(prefillStudentId) : undefined;
    const initialClassId =
      targetStudent?.classId ??
      (selectedClassId !== 'all' ? selectedClassId : classes[0]?.id ?? '');
    const candidates = students.filter((s) => s.active && s.classId === initialClassId);
    setFormClassId(initialClassId);
    setFormStudentId(targetStudent?.id ?? candidates[0]?.id ?? '');
    setSelectedPresetId(PRESET_BADGES[0].id);
    setCustomTitle('');
    setCustomCategory('تلاش و کوشش');
    setCustomColor('amber');
    setFormReason(PRESET_BADGES[0].defaultReason);
    setFormDate(defaultWorkdayJalali);
    setFormError(null);
    setShowAwardModal(true);
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId !== 'custom') {
      const preset = PRESET_BADGES.find((b) => b.id === presetId);
      if (preset) {
        setFormReason(preset.defaultReason);
        setCustomColor(preset.color);
      }
    }
  };

  const handleAwardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formStudentId) {
      setFormError('لطفاً دانش‌آموز مورد نظر را انتخاب کنید.');
      return;
    }
    const student = studentById.get(formStudentId);
    if (!student) {
      setFormError('دانش‌آموز انتخاب‌شده معتبر نیست.');
      return;
    }

    const isCustom = selectedPresetId === 'custom';
    const preset = PRESET_BADGES.find((b) => b.id === selectedPresetId);
    const badgeTitle = isCustom ? customTitle.trim() : (preset?.title ?? '');
    const category = isCustom ? customCategory.trim() || 'تلاش و کوشش' : (preset?.category ?? 'عمومی');
    const badgeColor = isCustom ? customColor : (preset?.color ?? 'amber');

    if (badgeTitle.length < 3) {
      setFormError('عنوان نشان تشویقی باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (formReason.trim().length < 5) {
      setFormError('لطفاً علت اهدای نشان و متن تقدیر را به صورت کوتاه وارد کنید.');
      return;
    }

    const now = new Date();
    const serialSuffix = String(now.getTime()).slice(-4);
    const yearShort = activeSchool.academicYear.split('-')[0] ?? '1404';
    const newReward: StudentReward = {
      id: `${activeSchoolId}:reward:${Date.now()}`,
      schoolId: activeSchoolId,
      studentId: student.id,
      classId: student.classId,
      badgeId: isCustom ? `custom-${serialSuffix}` : selectedPresetId,
      badgeTitle,
      badgeColor,
      category,
      reason: formReason.trim(),
      jalaliDate: formDate.trim() || defaultWorkdayJalali,
      awardedByName: session?.displayName ?? activeSchool.principalName,
      awardedByRole: activeRole,
      certificateSerial: `CERT-${yearShort}-${serialSuffix}`,
      createdAt: now.toISOString(),
    };

    const res = addStudentReward(newReward);
    if (!res.ok) {
      setFormError(res.errorFa ?? 'خطا در ثبت نشان تشویقی.');
      return;
    }

    setShowAwardModal(false);
    setCertificateReward(newReward);
    showToast(`نشان «${badgeTitle}» برای ${student.fullName} ثبت شد و لوح تقدیر A4 آماده چاپ است.`);
  };

  const handleDeleteReward = (reward: StudentReward) => {
    const res = deleteStudentReward(reward.id);
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان حذف این نشان وجود ندارد.', 'error');
      return;
    }
    showToast('نشان تشویقی با موفقیت حذف شد.', 'info');
  };

  const handleCopyCongratulations = async (reward: StudentReward) => {
    const studentName = studentById.get(reward.studentId)?.fullName ?? 'دانش‌آموز گرامی';
    const clsName = classById.get(reward.classId)?.name ?? '';
    const text = [
      `🏆 تبریک و تقدیر آموزشی — ${activeSchool.name}`,
      `دانش‌آموز گرامی: ${studentName} (${clsName})`,
      `نشان افتخار: ${reward.badgeTitle}`,
      `محور تقدیر: ${reward.category}`,
      `علت تقدیر: ${reward.reason}`,
      `تاریخ صدور: ${toPersianDigits(reward.jalaliDate)}`,
      `شماره لوح تقدیر: ${toPersianDigits(reward.certificateSerial)}`,
      `با آرزوی موفقیت‌های روزافزون — ${reward.awardedByName}`,
    ].join('\n');

    const ok = await copyTextToClipboard(text);
    if (ok) {
      showToast('پیام تبریک تک‌ستونه برای ارسال در ایتا، بله یا شاد کپی شد.');
    } else {
      showToast('امکان کپی خودکار در این مرورگر فراهم نشد.', 'error');
    }
  };

  const distinctStudentsCount = useMemo(
    () => new Set(filteredRewards.map((r) => r.studentId)).size,
    [filteredRewards]
  );

  return (
    <div className="space-y-6">
      {/* Main Screen Content (hidden on print whenever A4 Certificate modal is active) */}
      <div className={certificateReward ? 'space-y-6 no-print' : 'space-y-6'}>
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isParent ? 'نشان‌های تشویقی و لوح تقدیر فرزند شما' : 'تشویق کلاسی و صدور لوح تقدیر A4'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isParent && linkedStudent
                ? `تابلوی افتخارات و لوح‌های تقدیر رسمی ${linkedStudent.fullName} در ${activeSchool.name} — آماده چاپ A4`
                : `اهدای نشان‌های انگیزشی، رتبه‌بندی تشویقی و تولید یک‌کلیکی لوح تقدیر چاپی A4 در ${activeSchool.name}`}
            </p>
          </div>

          {roleDef.canAwardRewards && (
            <button
              type="button"
              onClick={() => openAwardModal()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              اهدای نشان و صدور لوح
            </button>
          )}
        </header>

        {/* Summary KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isParent ? 'کل نشان‌های کسب‌شده' : 'کل نشان‌های اهداشده'}
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {toPersianDigits(filteredRewards.length)} نشان
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isParent ? 'لوح‌های تقدیر آماده چاپ' : 'دانش‌آموزان تقدیرشده'}
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {isParent
                  ? `${toPersianDigits(filteredRewards.length)} لوح A4`
                  : `${toPersianDigits(distinctStudentsCount)} نفر`}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">قالب‌های نشان آماده</div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {toPersianDigits(PRESET_BADGES.length)} نشان استاندارد
              </div>
            </div>
          </div>
        </section>

        {/* Filter Bar (Class + Category for staff; Category only for parent) */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-3">
          {!isParent && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>فیلتر کلاس:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm px-3"
              >
                <option value="all">همه کلاس‌ها</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>محور تشویقی:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm px-3"
            >
              <option value="all">همه محورها</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Staff/Teacher Leaderboard */}
        {!isParent && leaderboard.length > 0 && (
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                برترین دانش‌آموزان در دریافت نشان‌های تشویقی
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                نمایش {toPersianDigits(leaderboard.length)} نفر برتر
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {leaderboard.map((row, idx) => (
                <div
                  key={row.studentId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold tabular-nums shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                          : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {toPersianDigits(idx + 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {row.studentName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {row.className} · {toPersianDigits(row.count)} نشان
                      </div>
                    </div>
                  </div>
                  {roleDef.canAwardRewards && (
                    <button
                      type="button"
                      onClick={() => openAwardModal(row.studentId)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      نشان جدید
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rewards History Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isParent ? 'فهرست لوح‌های تقدیر و نشان‌های ثبت‌شده' : 'سابقه نشان‌های تشویقی و لوح‌های تقدیر'}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(filteredRewards.length)} مورد
            </span>
          </div>

          {filteredRewards.length === 0 ? (
            <EmptyStateSvg
              variant="records"
              titleFa="هنوز نشانی برای این فیلتر ثبت نشده است"
              descriptionFa={
                roleDef.canAwardRewards
                  ? 'با دکمه «اهدای نشان و صدور لوح» اولین نشان انگیزشی را ثبت و لوح تقدیر رسمی صادر کنید.'
                  : 'به‌محض ثبت نشان تشویقی توسط معلم یا مدیریت مدرسه، لوح تقدیر رسمی در این بخش نمایش داده می‌شود.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRewards.map((reward) => {
                const student = studentById.get(reward.studentId);
                const cls = classById.get(reward.classId);
                const surface = BADGE_SURFACE_MAP[reward.badgeColor] ?? BADGE_SURFACE_MAP.amber;

                return (
                  <article
                    key={reward.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${surface.bg} ${surface.text} ${surface.border}`}
                          >
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {reward.badgeTitle}
                            </h3>
                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                              {student?.fullName ?? 'دانش‌آموز'} · {cls?.name ?? 'کلاس'}
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {toPersianDigits(reward.jalaliDate)}
                        </span>
                      </div>

                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {reward.reason}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                        <span>محور: {reward.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>اهداکننده: {reward.awardedByName}</span>
                        <span aria-hidden="true">·</span>
                        <span>سریال: {toPersianDigits(reward.certificateSerial)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCertificateReward(reward)}
                        className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 transition-colors whitespace-nowrap"
                      >
                        <Printer className="w-4 h-4" />
                        صدور لوح تقدیر A4
                      </button>

                      {!isParent && (
                        <button
                          type="button"
                          onClick={() => void handleCopyCongratulations(reward)}
                          className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold px-3 transition-colors whitespace-nowrap"
                        >
                          <Copy className="w-4 h-4" />
                          کپی ایتا/شاد
                        </button>
                      )}

                      {roleDef.canAwardRewards && (
                        <button
                          type="button"
                          aria-label={`حذف نشان ${reward.badgeTitle}`}
                          onClick={() => handleDeleteReward(reward)}
                          className="min-h-[42px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 px-3 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Award Badge Modal (Staff / Teachers only) */}
      {showAwardModal && roleDef.canAwardRewards && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="award-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 no-print"
        >
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="award-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                اهدای نشان تشویقی و صدور لوح تقدیر
              </h2>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setShowAwardModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAwardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>انتخاب کلاس</span>
                  <select
                    value={formClassId}
                    onChange={(e) => {
                      const nextClass = e.target.value;
                      setFormClassId(nextClass);
                      const first = students.find((s) => s.active && s.classId === nextClass);
                      setFormStudentId(first?.id ?? '');
                    }}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>انتخاب دانش‌آموز</span>
                  <select
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3"
                  >
                    {modalClassStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  انتخاب نشان آماده یا تعریف نشان سفارشی
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_BADGES.map((badge) => (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => handlePresetChange(badge.id)}
                      className={`min-h-[40px] rounded-xl border px-3 py-2 text-right text-xs font-semibold transition-colors ${
                        selectedPresetId === badge.id
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {badge.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handlePresetChange('custom')}
                    className={`col-span-2 min-h-[40px] rounded-xl border px-3 py-2 text-center text-xs font-semibold transition-colors ${
                      selectedPresetId === 'custom'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    + تعریف عنوان نشان سفارشی
                  </button>
                </div>
              </div>

              {selectedPresetId === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
                  <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>عنوان نشان سفارشی</span>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="مثلاً: برگزیده مسابقات علمی"
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm px-3"
                    />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>محور تقدیر</span>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="مثلاً: علمی و پژوهشی"
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm px-3"
                    />
                  </label>
                </div>
              )}

              <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>متن علت تقدیر (درج مستقیم در لوح تقدیر A4)</span>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm p-3"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>تاریخ شمسی صدور لوح</span>
                <input
                  type="text"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  placeholder="1404/08/15"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 tabular-nums"
                />
              </label>

              {formError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium px-3 py-2.5">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAwardModal(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                >
                  ثبت نشان و مشاهده لوح A4
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Formal A4 Portrait Certificate Preview & Print Modal */}
      {certificateReward && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="certificate-modal-title"
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 p-3 sm:p-6 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:block"
        >
          <div className="w-full max-w-3xl my-auto rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-2xl space-y-4 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
            <div className="space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="certificate-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-slate-100"
                  >
                    پیش‌نمایش رسمی لوح تقدیر
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    دارای سربرگ اختصاصی {activeSchool.name} و کادر دوخطی استاندارد چاپ
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PrintIconButton
                    documentLabel="لوح تقدیر رسمی"
                    onPrint={(size) => {
                      const nextPaper: CertificatePaperSize =
                        paperSize === 'a5_2up' && size === 'a4' ? 'a5_2up' : size;
                      setPaperSize(nextPaper);
                      setTimeout(() => {
                        triggerPrint({
                          size,
                          orientation: 'portrait',
                          documentLabel: 'لوح تقدیر رسمی',
                        });
                      }, 60);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setCertificateReward(null)}
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium px-3"
                  >
                    <X className="w-4 h-4" />
                    بستن
                  </button>
                </div>
              </div>

              {/* Certificate Sheet Layout Mode + Recipient Variant (Student vs. Parent Appreciation) */}
              <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                    مخاطب لوح:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="انتخاب نوع تقدیرنامه">
                    {[
                      { id: 'student' as const, label: 'تقدیرنامه دانش‌آموز' },
                      { id: 'parent' as const, label: 'تقدیرنامه ولی محترم' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={recipientType === opt.id}
                        onClick={() => setRecipientType(opt.id)}
                        className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          recipientType === opt.id
                            ? 'brand-btn'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                    چیدمان برگه:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="انتخاب چیدمان لوح تقدیر">
                    {[
                      { id: 'a4' as const, label: 'تک‌برگ استاندارد' },
                      { id: 'a5_2up' as const, label: '۲ لوح در یک صفحه (اقتصادی)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={opt.id === 'a5_2up' ? paperSize === 'a5_2up' : paperSize !== 'a5_2up'}
                        onClick={() => setPaperSize(opt.id)}
                        className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          (opt.id === 'a5_2up' ? paperSize === 'a5_2up' : paperSize !== 'a5_2up')
                            ? 'brand-btn'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <CertificatePrintView
              reward={certificateReward}
              studentName={
                studentById.get(certificateReward.studentId)?.fullName ??
                linkedStudent?.fullName ??
                'دانش‌آموز گرامی'
              }
              parentName={
                studentById.get(certificateReward.studentId)?.fatherName ??
                linkedStudent?.fatherName
              }
              className={classById.get(certificateReward.classId)?.name ?? 'کلاس آموزشی'}
              school={activeSchool}
              logoUrl={schoolLogoUrl || globalSystemConfig?.systemLogoDataUrl}
              paperSize={paperSize}
              recipientType={recipientType}
            />
          </div>
        </div>
      )}
    </div>
  );
};
