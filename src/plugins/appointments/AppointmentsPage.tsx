// Phase 4 Plugin: Parent-Teacher Appointments & Student 360° Summary Sheet («نوبت‌دهی جلسات اولیا و برگه ۳۶۰ درجه»)
import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarHeart,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type { AppointmentMeetingType, AppointmentSlot, Student } from '../../types/domain';
import {
  APPOINTMENT_STATUS_LABELS,
  generateSplitTimeSlots,
  MEETING_TYPE_LABELS,
} from './appointmentsHelpers';
import { Student360Sheet } from './Student360Sheet';

export const AppointmentsPage: React.FC = () => {
  const {
    activeSchool,
    activeRole,
    session,
    linkedStudent,
    linkedTeacher,
    classes,
    students,
    appointmentSlots,
    defaultWorkdayJalali,
    createAppointmentSlots,
    deleteAppointmentSlot,
    bookAppointmentSlot,
    cancelAppointmentBooking,
    completeAppointmentSlot,
  } = useSchoolData();

  const isParent = activeRole === 'parent';
  const isStaff = !isParent && activeRole !== 'student';

  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);
  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );
  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const [activeTab, setActiveTab] = useState<'slots' | 'sheet360'>('slots');
  const [selected360Target, setSelected360Target] = useState<{
    student: Student;
    slot?: AppointmentSlot;
  } | null>(null);
  const [standaloneStudentId, setStandaloneStudentId] = useState<string>(
    () => linkedStudent?.id ?? activeStudents[0]?.id ?? ''
  );

  // Staff Slot Generator Form State
  const [slotDate, setSlotDate] = useState<string>(() => defaultWorkdayJalali || getTodayJalali());
  const [startTime, setStartTime] = useState<string>('10:00');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [durationMinutes, setDurationMinutes] = useState<15 | 20 | 30>(20);
  const [meetingType, setMeetingType] = useState<AppointmentMeetingType>('in_person');
  const [targetClassSelection, setTargetClassSelection] = useState<string>('ALL');

  // Booking & Completion Inline State
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookingTopic, setBookingTopic] = useState<string>('');
  const [completingSlotId, setCompletingSlotId] = useState<string | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const previewSplitSlots = useMemo(
    () => generateSplitTimeSlots(startTime, endTime, durationMinutes),
    [startTime, endTime, durationMinutes]
  );

  const handleGenerateSlots = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isStaff) return;
    setNotice(null);

    const splits = generateSplitTimeSlots(startTime, endTime, durationMinutes);
    if (splits.length === 0) {
      setNotice({
        type: 'err',
        text: 'بازه زمانی معتبر نیست؛ ساعت پایان باید بزرگ‌تر از ساعت شروع باشد.',
      });
      return;
    }

    const targetClassIds =
      targetClassSelection === 'ALL'
        ? activeRole === 'teacher'
          ? classes.map((c) => c.id)
          : []
        : [targetClassSelection];

    const nowIso = new Date().toISOString();
    const newSlots: AppointmentSlot[] = splits.map((sp, idx) => ({
      id: `${activeSchool.id}:apt:${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      schoolId: activeSchool.id,
      staffUserId: session.userId,
      staffName: session.displayName,
      staffRole: activeRole as 'complex_admin' | 'principal' | 'deputy' | 'teacher',
      linkedTeacherId: linkedTeacher?.id,
      targetClassIds,
      jalaliDate: slotDate.trim() || getTodayJalali(),
      startTime: sp.startTime,
      endTime: sp.endTime,
      durationMinutes: sp.durationMinutes,
      meetingType,
      status: 'open',
      updatedAt: nowIso,
    }));

    const res = createAppointmentSlots(newSlots);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.errorFa ?? 'خطا در ایجاد نوبت‌ها.' });
      return;
    }
    setNotice({
      type: 'ok',
      text: `${toPersianDigits(newSlots.length)} بازه زمانی نوبت‌دهی با موفقیت ایجاد و برای اولیا منتشر شد.`,
    });
  };

  const handleConfirmBook = (slotId: string) => {
    setNotice(null);
    const res = bookAppointmentSlot(slotId, bookingTopic);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.errorFa ?? 'رزرو نوبت ناموفق بود.' });
      return;
    }
    setBookingSlotId(null);
    setBookingTopic('');
    setNotice({
      type: 'ok',
      text: 'نوبت جلسه با موفقیت رزرو شد. می‌توانید برگه خلاصه ۳۶۰ درجه فرزند خود را نیز مشاهده یا چاپ کنید.',
    });
  };

  const handleCancelBooking = (slotId: string) => {
    setNotice(null);
    const res = cancelAppointmentBooking(slotId);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.errorFa ?? 'لغو رزرو ناموفق بود.' });
      return;
    }
    setNotice({ type: 'ok', text: 'رزرو نوبت لغو شد و زمان مجدداً آزاد گردید.' });
  };

  const handleCompleteSlot = (slotId: string) => {
    setNotice(null);
    const res = completeAppointmentSlot(slotId, outcomeNotes);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.errorFa ?? 'ثبت پایان جلسه ناموفق بود.' });
      return;
    }
    setCompletingSlotId(null);
    setOutcomeNotes('');
    setNotice({ type: 'ok', text: 'جلسه با عنوان «برگزار شد» ثبت و خلاصه توافقات ذخیره گردید.' });
  };

  const bookedSlots = useMemo(
    () => appointmentSlots.filter((s) => s.status === 'booked' || s.status === 'completed'),
    [appointmentSlots]
  );
  const openSlots = useMemo(
    () => appointmentSlots.filter((s) => s.status === 'open'),
    [appointmentSlots]
  );

  const meetingIcon = (type: AppointmentMeetingType) => {
    if (type === 'online') return <Video className="w-3.5 h-3.5 text-sky-600" />;
    if (type === 'phone') return <Phone className="w-3.5 h-3.5 text-emerald-600" />;
    return <Users className="w-3.5 h-3.5 text-indigo-600" />;
  };

  const standaloneStudent = useMemo(
    () => activeStudents.find((s) => s.id === standaloneStudentId) ?? activeStudents[0] ?? null,
    [activeStudents, standaloneStudentId]
  );

  // If user clicked "مشاهده / چاپ برگه خلاصه ۳۶۰ درجه دانش‌آموز" from an appointment card
  if (selected360Target) {
    const slot = selected360Target.slot;
    return (
      <Student360Sheet
        student={selected360Target.student}
        appointmentInfo={
          slot
            ? {
                jalaliDate: slot.jalaliDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                staffName: slot.staffName,
                bookingTopic: slot.bookingTopic,
                meetingOutcomeNotes: slot.meetingOutcomeNotes,
              }
            : undefined
        }
        onClose={() => setSelected360Target(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarHeart className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              نوبت‌دهی جلسات اولیا و برگه ۳۶۰ درجه
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isParent
              ? 'رزرو یک‌کلیکی ملاقات با معلم و مدیر مدرسه بدون تداخل زمانی + مشاهده برگه ۳۶۰ درجه فرزند'
              : 'تعریف زمان‌های آزاد با تقسیم خودکار، مدیریت جلسات و صدور یک‌کلیکی برگه خلاصه وضعیت ۳۶۰ درجه'}
          </p>
        </div>

        <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              activeTab === 'slots'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
            }`}
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            <span>نوبت‌دهی و رزرو جلسات</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sheet360')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              activeTab === 'sheet360'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>برگه ۳۶۰ درجه دانش‌آموز</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`no-print rounded-xl px-4 py-3 text-xs sm:text-sm font-bold border ${
            notice.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* TAB 2: Standalone Student 360° Sheet */}
      {activeTab === 'sheet360' && (
        <div className="space-y-4">
          {isStaff && activeStudents.length > 0 && (
            <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                انتخاب دانش‌آموز برای صدور و چاپ برگه خلاصه ۳۶۰ درجه:
              </div>
              <select
                aria-label="انتخاب دانش‌آموز برای برگه ۳۶۰ درجه"
                value={standaloneStudent?.id ?? ''}
                onChange={(e) => setStandaloneStudentId(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-h-[40px]"
              >
                {activeStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} ({classById.get(st.classId)?.name ?? ''})
                  </option>
                ))}
              </select>
            </div>
          )}

          {standaloneStudent ? (
            <Student360Sheet student={standaloneStudent} />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
              دانش‌آموزی برای نمایش یافت نشد.
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Appointments Scheduler & Booking */}
      {activeTab === 'slots' && (
        <div className="space-y-5">
          {/* Staff Slot Generator */}
          {isStaff && (
            <form
              onSubmit={handleGenerateSlots}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <span>تعریف زمان‌های آزاد ملاقات با اولیا (تقسیم خودکار بازه)</span>
                </h2>
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg tabular-nums">
                  تولید خودکار {toPersianDigits(previewSplitSlots.length)} نوبت{' '}
                  {toPersianDigits(durationMinutes)} دقیقه‌ای
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    تاریخ شمسی
                  </label>
                  <input
                    type="text"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    placeholder="1405/09/03"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    ساعت شروع
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    ساعت پایان
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    مدت هر نوبت
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value) as 15 | 20 | 30)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value={15}>{toPersianDigits(15)} دقیقه</option>
                    <option value={20}>{toPersianDigits(20)} دقیقه</option>
                    <option value={30}>{toPersianDigits(30)} دقیقه</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نوع جلسه
                  </label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as AppointmentMeetingType)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="in_person">حضوری در مدرسه</option>
                    <option value="phone">تلفنی</option>
                    <option value="online">آنلاین</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    کلاس هدف
                  </label>
                  <select
                    value={targetClassSelection}
                    onChange={(e) => setTargetClassSelection(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="ALL">
                      {activeRole === 'teacher' ? 'همه کلاس‌های من' : 'کل مدرسه'}
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={previewSplitSlots.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white whitespace-nowrap min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>ایجاد و انتشار {toPersianDigits(previewSplitSlots.length)} نوبت</span>
                </button>
              </div>
            </form>
          )}

          {/* Booked & Completed Appointments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isParent ? 'جلسات رزروشده من' : 'جلسات رزروشده و برگزارشده'} (
                {toPersianDigits(bookedSlots.length)})
              </h2>
            </div>

            {bookedSlots.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                هنوز جلسه‌ای رزرو نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bookedSlots.map((slot) => {
                  const st = slot.bookedStudentId ? studentById.get(slot.bookedStudentId) : undefined;
                  const cls = slot.bookedClassId ? classById.get(slot.bookedClassId) : undefined;
                  return (
                    <article
                      key={slot.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            {st?.fullName ?? 'دانش‌آموز'}{' '}
                            {cls && (
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                ({cls.name})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            با: <strong>{slot.staffName}</strong> · ولی:{' '}
                            {slot.bookedParentName ?? st?.parentName ?? '—'}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            slot.status === 'completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {slot.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {APPOINTMENT_STATUS_LABELS[slot.status]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 tabular-nums font-bold">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          {toPersianDigits(slot.jalaliDate)} · {toPersianDigits(slot.startTime)} تا{' '}
                          {toPersianDigits(slot.endTime)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {meetingIcon(slot.meetingType)}
                          {MEETING_TYPE_LABELS[slot.meetingType]}
                        </span>
                      </div>

                      {slot.bookingTopic && (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                          <strong>موضوع جلسه:</strong> {slot.bookingTopic}
                        </div>
                      )}

                      {isStaff && slot.meetingOutcomeNotes && (
                        <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200">
                          <strong>خلاصه و توافقات جلسه (محرمانه کادر):</strong>{' '}
                          {slot.meetingOutcomeNotes}
                        </div>
                      )}

                      {/* Signature 360° Button + Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {st && (
                          <button
                            type="button"
                            onClick={() => setSelected360Target({ student: st, slot })}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[40px]"
                          >
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span>مشاهده / چاپ برگه خلاصه ۳۶۰ درجه دانش‌آموز</span>
                          </button>
                        )}

                        {isStaff && slot.status === 'booked' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingSlotId(slot.id);
                              setOutcomeNotes(slot.meetingOutcomeNotes ?? '');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap min-h-[40px]"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>ثبت «برگزار شد»</span>
                          </button>
                        )}

                        {slot.status === 'booked' && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(slot.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap min-h-[40px]"
                          >
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span>لغو رزرو</span>
                          </button>
                        )}
                      </div>

                      {/* Staff Outcome Notes Drawer */}
                      {isStaff && completingSlotId === slot.id && (
                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-2.5">
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                            خلاصه و توافقات جلسه (محرمانه در پرونده جلسه ذخیره می‌شود):
                          </label>
                          <textarea
                            rows={2}
                            value={outcomeNotes}
                            onChange={(e) => setOutcomeNotes(e.target.value)}
                            placeholder="مثال: توافق شد برنامه تمرین روزانه ۱۵ دقیقه‌ای ریاضی در منزل پیگیری و دو هفته بعد بازبینی شود."
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setCompletingSlotId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompleteSlot(slot.id)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                            >
                              ذخیره و پایان جلسه
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Open Available Slots */}
          <section className="space-y-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              زمان‌های آزاد قابل رزرو ({toPersianDigits(openSlots.length)})
            </h2>

            {openSlots.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                در حال حاضر نوبت آزاد جدیدی تعریف نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {openSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {slot.staffName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                          {meetingIcon(slot.meetingType)}
                          <span>{MEETING_TYPE_LABELS[slot.meetingType]}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        آزاد
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between tabular-nums">
                      <span>{toPersianDigits(slot.jalaliDate)}</span>
                      <span>
                        {toPersianDigits(slot.startTime)} تا {toPersianDigits(slot.endTime)} (
                        {toPersianDigits(slot.durationMinutes)} دقیقه)
                      </span>
                    </div>

                    {isParent ? (
                      bookingSlotId === slot.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={bookingTopic}
                            onChange={(e) => setBookingTopic(e.target.value)}
                            placeholder="موضوع کوتاه جلسه (اختیاری)"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmBook(slot.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap min-h-[38px]"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>تایید رزرو</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setBookingSlotId(null)}
                              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            >
                              انصراف
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBookingSlotId(slot.id);
                            setBookingTopic('');
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap min-h-[42px]"
                        >
                          <CalendarCheck className="w-4 h-4 shrink-0" />
                          <span>رزرو این نوبت برای {linkedStudent?.fullName}</span>
                        </button>
                      )
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => deleteAppointmentSlot(slot.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف نوبت آزاد</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
