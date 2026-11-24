// Phase 5 Plugin: In-Person Exams Management («مدیریت هوشمند امتحانات حضوری»)
// Tab 1: Conflict-Free Exam Timetable (3-way real-time conflict detector: class, hall, proctor)
// Tab 2: Exam Halls & Anti-Cheating Checkerboard Seating Algorithm + click-to-swap manual editor
// Tab 3: Batch Admission Cards (A4 4-up, A5 2-up, A5 1-up) & Official Exam Forms
// Parent/Student view: Strictly own upcoming schedule, hall, bold seat number & A4/A5 admission card print
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Grid2x2Check,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useSchoolData } from '../../core/data/DataContext';
import { PrintShell } from '../../core/export/PrintShell';
import { PrintButtons } from '../../core/print/PrintButtons';
import { triggerPrint } from '../../core/print/printService';
import { toPersianDigits } from '../../lib/digits';
import { addDaysToJalali, getTodayJalali } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type { ExamSeatingChart, InPersonExamHall, InPersonExamSession } from '../../types/domain';
import {
  ExamAdmissionCardsPrint,
  type AdmissionCardLayoutMode,
  type ExamPrintSubView,
} from './ExamAdmissionCardsPrint';
import {
  detectExamScheduleConflicts,
  evaluateSeatingAdjacency,
  formatExamScheduleMessenger,
  generateCheckerboardSeating,
  swapSeatsInGrid,
} from './examsManagementHelpers';

type ExamsTab = 'schedule' | 'seating' | 'cards';

const CLASS_CHIP_PALETTE = [
  'bg-indigo-100 dark:bg-indigo-950/70 border-indigo-400 text-indigo-900 dark:text-indigo-200',
  'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-400 text-emerald-900 dark:text-emerald-200',
  'bg-violet-100 dark:bg-violet-950/70 border-violet-400 text-violet-900 dark:text-violet-200',
  'bg-sky-100 dark:bg-sky-950/70 border-sky-400 text-sky-900 dark:text-sky-200',
  'bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200',
];

export const ExamsManagementPage: React.FC = () => {
  const {
    activeSchool,
    activeRole,
    roleDef,
    session,
    linkedStudent,
    linkedTeacher,
    classes,
    students,
    teachers,
    inPersonExamHalls,
    inPersonExamSessions,
    examSeatingCharts,
    studentProfiles,
    upsertInPersonExamHall,
    deleteInPersonExamHall,
    upsertInPersonExamSession,
    deleteInPersonExamSession,
    upsertExamSeatingChart,
  } = useSchoolData();

  const canManage = roleDef.canManageInPersonExams;
  const isFamilyRole = activeRole === 'parent' || activeRole === 'student';

  const [activeTab, setActiveTab] = useState<ExamsTab>('schedule');
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedSchedule, setCopiedSchedule] = useState(false);

  // Tab 1: New Exam Session Form
  const [termTitle, setTermTitle] = useState(`امتحانات نوبت اول ${activeSchool.academicYear}`);
  const [subject, setSubject] = useState('علوم تجربی');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() =>
    classes.slice(0, 2).map((c) => c.id)
  );
  const [examDate, setExamDate] = useState(() => addDaysToJalali(getTodayJalali(), 4));
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:45');
  const [hallId, setHallId] = useState<string>(() => inPersonExamHalls[0]?.id ?? '');
  const [proctorTeacherId, setProctorTeacherId] = useState<string>(() => teachers[0]?.id ?? '');

  // Tab 2: Hall Creator & Checkerboard Seating Editor
  const [showHallForm, setShowHallForm] = useState(false);
  const [newHallName, setNewHallName] = useState('');
  const [newHallCode, setNewHallCode] = useState('H-103');
  const [newHallRows, setNewHallRows] = useState(4);
  const [newHallCols, setNewHallCols] = useState(5);
  const [newHallStartSeat, setNewHallStartSeat] = useState(301);

  const [activeHallId, setActiveHallId] = useState<string>(() => inPersonExamHalls[0]?.id ?? '');
  const [seatingClassIds, setSeatingClassIds] = useState<string[]>(() =>
    classes.slice(0, 2).map((c) => c.id)
  );
  const [swapOriginSeat, setSwapOriginSeat] = useState<number | null>(null);

  // Tab 3: Cards & Forms Filters
  const [cardClassFilter, setCardClassFilter] = useState<string>('all');
  const [cardHallFilter, setCardHallFilter] = useState<string>('all');
  const [cardSessionFilter, setCardSessionFilter] = useState<string>(
    () => inPersonExamSessions[0]?.id ?? ''
  );
  const [layoutMode, setLayoutMode] = useState<AdmissionCardLayoutMode>('a4-4up');
  const [printSubView, setPrintSubView] = useState<ExamPrintSubView>('cards');

  const showToast = (msg: string) => {
    setToast(msg);
    setErrorMsg(null);
    window.setTimeout(() => setToast(null), 3000);
  };

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const hallMap = useMemo(() => new Map(inPersonExamHalls.map((h) => [h.id, h])), [inPersonExamHalls]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const classColorMap = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c, idx) => {
      m.set(c.id, CLASS_CHIP_PALETTE[idx % CLASS_CHIP_PALETTE.length]);
    });
    return m;
  }, [classes]);

  const resolvedHallId = useMemo(() => {
    if (inPersonExamHalls.some((h) => h.id === activeHallId)) return activeHallId;
    return inPersonExamHalls[0]?.id ?? '';
  }, [inPersonExamHalls, activeHallId]);

  const resolvedFormHallId = useMemo(() => {
    if (inPersonExamHalls.some((h) => h.id === hallId)) return hallId;
    return inPersonExamHalls[0]?.id ?? '';
  }, [inPersonExamHalls, hallId]);

  const resolvedProctorId = useMemo(() => {
    if (teachers.some((t) => t.id === proctorTeacherId)) return proctorTeacherId;
    return teachers[0]?.id ?? '';
  }, [teachers, proctorTeacherId]);

  // Live 3-way conflict check on the form candidate
  const liveConflicts = useMemo(() => {
    if (!canManage) return [];
    return detectExamScheduleConflicts({
      candidate: {
        jalaliDate: examDate,
        startTime,
        endTime,
        classIds: selectedClassIds,
        hallId: resolvedFormHallId,
        proctorTeacherId: resolvedProctorId,
      },
      existingSessions: inPersonExamSessions,
      classes,
      halls: inPersonExamHalls,
      teachers,
    });
  }, [
    canManage,
    examDate,
    startTime,
    endTime,
    selectedClassIds,
    resolvedFormHallId,
    resolvedProctorId,
    inPersonExamSessions,
    classes,
    inPersonExamHalls,
    teachers,
  ]);

  const activeSeatingChart = useMemo(() => {
    return (
      examSeatingCharts.find((c) => c.hallId === resolvedHallId) ??
      examSeatingCharts[0] ??
      null
    );
  }, [examSeatingCharts, resolvedHallId]);

  const activeAdjacencyInfo = useMemo(() => {
    if (!activeSeatingChart) {
      return { warningSeatNumbers: new Set<number>(), adjacentPairCount: 0 };
    }
    return evaluateSeatingAdjacency(
      activeSeatingChart.assignments,
      activeSeatingChart.rows,
      activeSeatingChart.cols
    );
  }, [activeSeatingChart]);

  const handleToggleFormClass = (cid: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const handleToggleSeatingClass = (cid: string) => {
    setSeatingClassIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const handleCreateExamSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setErrorMsg(null);

    if (!subject.trim()) {
      setErrorMsg('نام درس الزامی است.');
      return;
    }
    if (selectedClassIds.length === 0) {
      setErrorMsg('حداقل یک کلاس را برای آزمون انتخاب کنید.');
      return;
    }
    if (!resolvedFormHallId) {
      setErrorMsg('ابتدا یک حوزه امتحانی انتخاب یا ایجاد کنید.');
      return;
    }
    if (liveConflicts.length > 0) {
      setErrorMsg('به دلیل وجود تداخل زمانی، ثبت این آزمون مسدود شد. لطفاً ساعت، حوزه یا مراقب را اصلاح کنید.');
      return;
    }

    const newSession: InPersonExamSession = {
      id: `${activeSchool.id}:ipexam:${Date.now()}`,
      schoolId: activeSchool.id,
      termTitle: termTitle.trim() || `امتحانات ${activeSchool.academicYear}`,
      subject: subject.trim(),
      classIds: selectedClassIds,
      hallId: resolvedFormHallId,
      proctorTeacherId: resolvedProctorId,
      jalaliDate: examDate.trim(),
      startTime,
      endTime,
      createdByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };
    const res = upsertInPersonExamSession(newSession);
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ثبت جلسه آزمون ناموفق بود.');
      return;
    }
    showToast(`آزمون حضوری «${newSession.subject}» بدون تداخل در برنامه ثبت شد.`);
  };

  const handleCreateHall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !newHallName.trim()) return;
    const hall: InPersonExamHall = {
      id: `${activeSchool.id}:hall:${Date.now()}`,
      schoolId: activeSchool.id,
      name: newHallName.trim(),
      roomCode: newHallCode.trim() || 'H-100',
      rows: Math.max(2, Math.min(10, Number(newHallRows) || 4)),
      cols: Math.max(2, Math.min(8, Number(newHallCols) || 4)),
      startSeatNumber: Math.max(1, Number(newHallStartSeat) || 101),
      updatedAt: new Date().toISOString(),
    };
    const res = upsertInPersonExamHall(hall);
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ایجاد حوزه ناموفق بود.');
      return;
    }
    setActiveHallId(hall.id);
    setNewHallName('');
    setShowHallForm(false);
    showToast(`حوزه امتحانی «${hall.name}» با ظرفیت ${toPersianDigits(hall.rows * hall.cols)} صندلی ثبت شد.`);
  };

  const handleGenerateCheckerboard = () => {
    if (!canManage) return;
    const targetHall = hallMap.get(resolvedHallId);
    if (!targetHall) {
      setErrorMsg('ابتدا یک حوزه امتحانی انتخاب کنید.');
      return;
    }
    if (seatingClassIds.length === 0) {
      setErrorMsg('حداقل یک کلاس (ترجیحاً ۲ کلاس یا بیشتر) برای چیدمان شطرنجی انتخاب کنید.');
      return;
    }

    const poolStudents = students.filter(
      (st) => st.active && seatingClassIds.includes(st.classId)
    );
    const result = generateCheckerboardSeating({
      rows: targetHall.rows,
      cols: targetHall.cols,
      startSeatNumber: targetHall.startSeatNumber,
      students: poolStudents,
    });

    const chart: ExamSeatingChart = {
      id: activeSeatingChart?.hallId === targetHall.id
        ? activeSeatingChart.id
        : `${activeSchool.id}:seating:${targetHall.id}`,
      schoolId: activeSchool.id,
      title: `چیدمان شطرنجی ${targetHall.name}`,
      hallId: targetHall.id,
      classIds: seatingClassIds,
      rows: targetHall.rows,
      cols: targetHall.cols,
      startSeatNumber: targetHall.startSeatNumber,
      assignments: result.assignments,
      adjacencyWarningCount: result.adjacencyWarningCount,
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };

    const res = upsertExamSeatingChart(chart);
    if (!res.ok) {
      setErrorMsg(res.errorFa ?? 'ذخیره چیدمان شطرنجی ناموفق بود.');
      return;
    }
    setSwapOriginSeat(null);
    showToast(
      result.adjacencyWarningCount === 0
        ? `چیدمان هوشمند شطرنجی با ۰ مجاورت هم‌کلاسی ذخیره شد (${toPersianDigits(poolStudents.length)} دانش‌آموز).`
        : `چیدمان شطرنجی ذخیره شد؛ ${toPersianDigits(result.adjacencyWarningCount)} مجاورت ناگزیر هم‌کلاسی با رنگ هشدار مشخص شده است.`
    );
  };

  const handleSeatClick = (seatNumber: number) => {
    if (!canManage || !activeSeatingChart) return;
    if (swapOriginSeat === null) {
      setSwapOriginSeat(seatNumber);
      return;
    }
    if (swapOriginSeat === seatNumber) {
      setSwapOriginSeat(null);
      return;
    }

    const swapped = swapSeatsInGrid({
      assignments: activeSeatingChart.assignments,
      rows: activeSeatingChart.rows,
      cols: activeSeatingChart.cols,
      seatNumberA: swapOriginSeat,
      seatNumberB: seatNumber,
    });

    const updatedChart: ExamSeatingChart = {
      ...activeSeatingChart,
      assignments: swapped.assignments,
      adjacencyWarningCount: swapped.adjacencyWarningCount,
      updatedByName: session?.displayName ?? activeSchool.principalName,
      updatedAt: new Date().toISOString(),
    };

    const res = upsertExamSeatingChart(updatedChart);
    setSwapOriginSeat(null);
    if (res.ok) {
      showToast(
        `صندلی ${toPersianDigits(swapOriginSeat)} و ${toPersianDigits(seatNumber)} با موفقیت جابه‌جا شدند.`
      );
    }
  };

  const handleCopySchedule = async () => {
    const text = formatExamScheduleMessenger({
      schoolName: activeSchool.name,
      termTitle: inPersonExamSessions[0]?.termTitle ?? termTitle,
      sessions: inPersonExamSessions,
      classes,
      halls: inPersonExamHalls,
      teachers,
    });
    await copyTextToClipboard(text);
    setCopiedSchedule(true);
    showToast('برنامه امتحانات حضوری به‌صورت تک‌ستونه برای ایتا، بله و شاد کپی شد.');
    window.setTimeout(() => setCopiedSchedule(false), 1800);
  };

  const filteredCardStudents = useMemo(() => {
    let list = students.filter((st) => st.active);
    if (cardClassFilter !== 'all') {
      list = list.filter((st) => st.classId === cardClassFilter);
    }
    if (cardHallFilter !== 'all') {
      const chart = examSeatingCharts.find((c) => c.hallId === cardHallFilter);
      if (chart) {
        const seatedIds = new Set(chart.assignments.map((a) => a.studentId).filter(Boolean));
        list = list.filter((st) => seatedIds.has(st.id));
      }
    }
    return list;
  }, [students, cardClassFilter, cardHallFilter, examSeatingCharts]);

  // ==================== PARENT & STUDENT DEDICATED CLEAN READ-ONLY VIEW ====================
  if (isFamilyRole) {
    const mySeatEntry = (() => {
      if (!linkedStudent) return null;
      for (const chart of examSeatingCharts) {
        const seat = chart.assignments.find((a) => a.studentId === linkedStudent.id);
        if (seat) {
          return {
            seatNumber: seat.seatNumber,
            hallName: hallMap.get(chart.hallId)?.name ?? 'حوزه امتحانی',
          };
        }
      }
      return null;
    })();

    return (
      <div className="space-y-4">
        <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Grid2x2Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  برنامه امتحانات حضوری و کارت ورود به جلسه
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {linkedStudent
                  ? `دانش‌آموز: ${linkedStudent.fullName} · ${classMap.get(linkedStudent.classId)?.name ?? ''}`
                  : 'اطلاعات آزمون‌های حضوری پیش‌رو'}
              </p>
            </div>
            <PrintButtons
              documentLabel="کارت ورود به جلسه"
              onPrint={(size) => {
                triggerPrint({ size, orientation: 'portrait' });
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3.5">
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">شماره صندلی اختصاصی</div>
              <div className="text-2xl font-black text-indigo-900 dark:text-white tabular-nums mt-1">
                {mySeatEntry ? toPersianDigits(mySeatEntry.seatNumber) : 'در انتظار چیدمان'}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">حوزه / سالن امتحانی</div>
              <div className="text-base font-extrabold text-emerald-900 dark:text-white mt-1">
                {mySeatEntry?.hallName ?? 'به‌زودی اعلام می‌شود'}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">تعداد امتحانات برنامه‌ریزی‌شده</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-1">
                {toPersianDigits(inPersonExamSessions.length)} آزمون
              </div>
            </div>
          </div>
        </div>

        {/* Printable Admission Card for Own Student */}
        {linkedStudent && (
          <ExamAdmissionCardsPrint
            school={activeSchool}
            students={[linkedStudent]}
            classes={classes}
            halls={inPersonExamHalls}
            teachers={teachers}
            sessions={inPersonExamSessions}
            seatingCharts={examSeatingCharts}
            studentProfiles={studentProfiles}
            layoutMode="a5-1up"
            onLayoutModeChange={() => {}}
            printSubView="cards"
            onPrintSubViewChange={() => {}}
            selectedHallId="all"
            selectedSessionId={inPersonExamSessions[0]?.id ?? ''}
            compactSingleStudentMode
          />
        )}
      </div>
    );
  }

  // ==================== STAFF & TEACHER MANAGEMENT VIEW ====================
  return (
    <div className="space-y-4">
      {/* Header & Tabs */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Grid2x2Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                مدیریت هوشمند امتحانات حضوری
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                چیدمان شطرنجی ضدتقلب · چاپ گروهی A4/A5
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              برنامه‌ریزی بدون تداخل کلاس/حوزه/مراقب، نقشه شطرنجی تعاملی صندلی‌ها، کارت ورود به جلسه و صورتجلسه رسمی
            </p>
          </div>
          {activeRole === 'teacher' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              نمای فقط‌خواندنی معلم: برنامه امتحانات، مراقبت‌های من و چیدمان حوزه‌ها
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'schedule'}
            onClick={() => setActiveTab('schedule')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>برنامه امتحانات حضوری بدون تداخل</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'seating'}
            onClick={() => setActiveTab('seating')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${
              activeTab === 'seating'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>حوزه‌ها و چیدمان شطرنجی صندلی‌ها</span>
          </button>
          {canManage && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cards'}
              onClick={() => setActiveTab('cards')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${
                activeTab === 'cards'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>چاپ گروهی کارت ورود به جلسه و فرم‌های امتحان</span>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="no-print rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200">
          {toast}
        </div>
      )}
      {errorMsg && (
        <div className="no-print rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* ==================== TAB 1: CONFLICT-FREE EXAM SCHEDULE ==================== */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {canManage && (
            <form
              onSubmit={handleCreateExamSession}
              className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  افزودن جلسه امتحان حضوری (با تشخیص خودکار تداخل)
                </h2>
                {liveConflicts.length === 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    بدون تداخل زمانی
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {toPersianDigits(liveConflicts.length)} تداخل شناسایی شد
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    عنوان آزمون / نوبت
                  </label>
                  <input
                    type="text"
                    value={termTitle}
                    onChange={(e) => setTermTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نام درس
                  </label>
                  <input
                    type="text"
                    required
                    aria-label="نام درس امتحان"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    تاریخ شمسی
                  </label>
                  <input
                    type="text"
                    required
                    aria-label="تاریخ امتحان"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    placeholder="1405/09/15"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      شروع
                    </label>
                    <input
                      type="time"
                      aria-label="ساعت شروع"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      پایان
                    </label>
                    <input
                      type="time"
                      aria-label="ساعت پایان"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    حوزه امتحانی
                  </label>
                  <select
                    aria-label="انتخاب حوزه امتحانی"
                    value={resolvedFormHallId}
                    onChange={(e) => setHallId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  >
                    {inPersonExamHalls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} (ظرفیت {toPersianDigits(h.rows * h.cols)} صندلی)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    مراقب حوزه (از لیست معلمان)
                  </label>
                  <select
                    aria-label="انتخاب مراقب"
                    value={resolvedProctorId}
                    onChange={(e) => setProctorTeacherId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.specialty})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    پایه و کلاس(های) شرکت‌کننده
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map((c) => {
                      const active = selectedClassIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleToggleFormClass(c.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Real-Time Conflict Warning Box */}
              {liveConflicts.length > 0 && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 p-3.5 space-y-1.5 text-xs text-rose-800 dark:text-rose-200"
                >
                  <div className="font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>هشدار تشخیص خودکار تداخل برنامه امتحانات:</span>
                  </div>
                  <ul className="list-disc pr-5 space-y-1">
                    {liveConflicts.map((c, idx) => (
                      <li key={idx} className="font-semibold">
                        {c.messageFa}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={liveConflicts.length > 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت در برنامه امتحانات</span>
                </button>
              </div>
            </form>
          )}

          {/* Action Toolbar + Printable Schedule Table */}
          <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              جدول برنامه امتحانات حضوری ({toPersianDigits(inPersonExamSessions.length)} جلسه)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySchedule}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
              >
                {copiedSchedule ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>کپی تک‌ستونی برنامه برای ایتا، بله و شاد</span>
              </button>
              <PrintButtons documentLabel="برنامه امتحانات حضوری" />
            </div>
          </div>

          <PrintShell
            school={activeSchool}
            documentTitle={inPersonExamSessions[0]?.termTitle ?? 'برنامه رسمی امتحانات حضوری'}
            subtitle={`تاریخ چاپ: ${toPersianDigits(getTodayJalali())}`}
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden print:border-0 print:rounded-none">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">ردیف</th>
                      <th className="px-3 py-2.5 font-bold">تاریخ شمسی</th>
                      <th className="px-3 py-2.5 font-bold">ساعت</th>
                      <th className="px-3 py-2.5 font-bold">نام درس</th>
                      <th className="px-3 py-2.5 font-bold">کلاس‌ها</th>
                      <th className="px-3 py-2.5 font-bold">حوزه امتحانی</th>
                      <th className="px-3 py-2.5 font-bold">مراقب حوزه</th>
                      {canManage && <th className="no-print px-3 py-2.5 font-bold">عملیات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inPersonExamSessions.map((ex, idx) => {
                      const isMyProctorDuty =
                        activeRole === 'teacher' && linkedTeacher && ex.proctorTeacherId === linkedTeacher.id;
                      return (
                        <tr
                          key={ex.id}
                          className={
                            isMyProctorDuty
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="px-3 py-2.5 font-bold tabular-nums">{toPersianDigits(idx + 1)}</td>
                          <td className="px-3 py-2.5 font-bold tabular-nums">
                            {toPersianDigits(ex.jalaliDate)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                            {toPersianDigits(ex.startTime)} تا {toPersianDigits(ex.endTime)}
                          </td>
                          <td className="px-3 py-2.5 font-extrabold text-slate-900 dark:text-white">
                            {ex.subject}
                          </td>
                          <td className="px-3 py-2.5">
                            {ex.classIds.map((cid) => classMap.get(cid)?.name ?? cid).join('، ')}
                          </td>
                          <td className="px-3 py-2.5 font-bold">
                            {hallMap.get(ex.hallId)?.name ?? '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-bold">
                              {teacherMap.get(ex.proctorTeacherId)?.fullName ?? '—'}
                            </span>
                            {isMyProctorDuty && (
                              <span className="mr-1.5 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                مراقبت شما
                              </span>
                            )}
                          </td>
                          {canManage && (
                            <td className="no-print px-3 py-2.5">
                              <button
                                type="button"
                                aria-label={`حذف آزمون ${ex.subject}`}
                                onClick={() => deleteInPersonExamSession(ex.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </PrintShell>
        </div>
      )}

      {/* ==================== TAB 2: EXAM HALLS & CHECKERBOARD SEATING ==================== */}
      {activeTab === 'seating' && (
        <div className="space-y-4">
          <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {inPersonExamHalls.map((h) => (
                  <div key={h.id} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveHallId(h.id);
                        setSwapOriginSeat(null);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        resolvedHallId === h.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {h.name} ({toPersianDigits(h.rows)}×{toPersianDigits(h.cols)} ={' '}
                      {toPersianDigits(h.rows * h.cols)} صندلی)
                    </button>
                    {canManage && inPersonExamHalls.length > 1 && (
                      <button
                        type="button"
                        aria-label={`حذف حوزه ${h.name}`}
                        onClick={() => deleteInPersonExamHall(h.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowHallForm((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تعریف حوزه جدید</span>
                  </button>
                )}
              </div>

              <PrintButtons documentLabel="نقشه چیدمان صندلی‌های حوزه" landscape />
            </div>

            {canManage && showHallForm && (
              <form
                onSubmit={handleCreateHall}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800"
              >
                <input
                  type="text"
                  required
                  placeholder="نام سالن / حوزه"
                  value={newHallName}
                  onChange={(e) => setNewHallName(e.target.value)}
                  className="sm:col-span-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                />
                <input
                  type="number"
                  min={2}
                  max={10}
                  aria-label="تعداد ردیف"
                  value={newHallRows}
                  onChange={(e) => setNewHallRows(Number(e.target.value))}
                  placeholder="ردیف"
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                />
                <input
                  type="number"
                  min={2}
                  max={8}
                  aria-label="تعداد ستون"
                  value={newHallCols}
                  onChange={(e) => setNewHallCols(Number(e.target.value))}
                  placeholder="ستون"
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    aria-label="شماره شروع صندلی"
                    value={newHallStartSeat}
                    onChange={(e) => setNewHallStartSeat(Number(e.target.value))}
                    placeholder="شروع صندلی"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-bold"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white whitespace-nowrap"
                  >
                    ذخیره
                  </button>
                </div>
              </form>
            )}

            {/* Checkerboard Generator Controls */}
            {canManage && (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    انتخاب ۲ یا چند کلاس برای چیدمان شطرنجی ضدتقلب در حوزه انتخابی:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map((c) => {
                      const active = seatingClassIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleToggleSeatingClass(c.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateCheckerboard}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>چیدمان خودکار شطرنجی</span>
                </button>
              </div>
            )}
          </div>

          {/* Interactive 2D Seating Grid Map (Printable) */}
          <PrintShell
            school={activeSchool}
            documentTitle={`نقشه چیدمان شطرنجی صندلی‌ها — ${hallMap.get(activeSeatingChart?.hallId ?? resolvedHallId)?.name ?? 'حوزه امتحانی'}`}
            subtitle={`تعداد صندلی‌های پر: ${toPersianDigits(
              activeSeatingChart?.assignments.filter((a) => a.studentId).length ?? 0
            )} · مجاورت هم‌کلاسی: ${toPersianDigits(activeAdjacencyInfo.adjacentPairCount)}`}
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 print:border-0 print:rounded-none">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {activeAdjacencyInfo.adjacentPairCount === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4" />
                      وضعیت شطرنجی عالی: ۰ مجاورت هم‌کلاسی (چپ، راست، جلو، عقب)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      <AlertTriangle className="w-4 h-4" />
                      هشدار مجاورت: {toPersianDigits(activeAdjacencyInfo.adjacentPairCount)} جفت هم‌کلاسی مجاور (مشخص‌شده با کادر قرمز)
                    </span>
                  )}
                  {canManage && (
                    <span className="no-print inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      {swapOriginSeat !== null
                        ? `صندلی ${toPersianDigits(swapOriginSeat)} انتخاب شد؛ روی صندلی مقصد کلیک کنید تا جابه‌جا شوند.`
                        : 'برای جابه‌جایی دستی، روی صندلی اول و سپس صندلی دوم کلیک کنید.'}
                    </span>
                  )}
                </div>
              </div>

              {!activeSeatingChart ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  برای این حوزه هنوز چیدمان صندلی تولید نشده است. روی «چیدمان خودکار شطرنجی» کلیک کنید.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="text-center text-xs font-extrabold py-2 mb-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                    تخته و میز مراقب حوزه (جلوی سالن)
                  </div>
                  <div
                    className="grid gap-2.5 min-w-[540px]"
                    style={{
                      gridTemplateColumns: `repeat(${activeSeatingChart.cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {activeSeatingChart.assignments.map((seat) => {
                      const st = seat.studentId ? studentMap.get(seat.studentId) : null;
                      const cls = seat.classId ? classMap.get(seat.classId) : null;
                      const hasWarning = activeAdjacencyInfo.warningSeatNumbers.has(seat.seatNumber);
                      const isSelectedOrigin = swapOriginSeat === seat.seatNumber;
                      const colorClass = seat.classId
                        ? classColorMap.get(seat.classId) ?? CLASS_CHIP_PALETTE[0]
                        : 'bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-700 text-slate-400';

                      return (
                        <button
                          key={seat.seatNumber}
                          type="button"
                          disabled={!canManage}
                          onClick={() => handleSeatClick(seat.seatNumber)}
                          aria-label={`صندلی ${toPersianDigits(seat.seatNumber)} ${st ? st.fullName : 'خالی'}`}
                          className={`rounded-xl border-2 p-2.5 text-right transition-all min-h-[82px] flex flex-col justify-between ${colorClass} ${
                            hasWarning ? 'ring-2 ring-rose-500 border-rose-500' : ''
                          } ${isSelectedOrigin ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''} ${
                            canManage ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black tabular-nums">
                              صندلی {toPersianDigits(seat.seatNumber)}
                            </span>
                            {hasWarning && (
                              <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300">
                                ⚠ مجاور
                              </span>
                            )}
                          </div>
                          {st ? (
                            <div className="mt-1 space-y-0.5">
                              <div className="text-xs font-extrabold truncate">{st.fullName}</div>
                              <div className="text-[10px] opacity-85 truncate">{cls?.name ?? ''}</div>
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-center opacity-70 my-auto">
                              صندلی خالی
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </PrintShell>
        </div>
      )}

      {/* ==================== TAB 3: BATCH ADMISSION CARDS & OFFICIAL FORMS ==================== */}
      {activeTab === 'cards' && canManage && (
        <div className="space-y-4">
          <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                فیلتر کلاس
              </label>
              <select
                aria-label="فیلتر کلاس کارت ورود به جلسه"
                value={cardClassFilter}
                onChange={(e) => setCardClassFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
              >
                <option value="all">همه کلاس‌ها</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                فیلتر حوزه امتحانی
              </label>
              <select
                aria-label="فیلتر حوزه کارت ورود به جلسه"
                value={cardHallFilter}
                onChange={(e) => setCardHallFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
              >
                <option value="all">همه حوزه‌ها</option>
                {inPersonExamHalls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                جلسه آزمون (برای صورتجلسه و لیست حوزه)
              </label>
              <select
                aria-label="انتخاب جلسه آزمون برای صورتجلسه"
                value={cardSessionFilter}
                onChange={(e) => setCardSessionFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
              >
                {inPersonExamSessions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.subject} — {toPersianDigits(ex.jalaliDate)} ({toPersianDigits(ex.startTime)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ExamAdmissionCardsPrint
            school={activeSchool}
            students={filteredCardStudents}
            classes={classes}
            halls={inPersonExamHalls}
            teachers={teachers}
            sessions={inPersonExamSessions}
            seatingCharts={examSeatingCharts}
            studentProfiles={studentProfiles}
            layoutMode={layoutMode}
            onLayoutModeChange={setLayoutMode}
            printSubView={printSubView}
            onPrintSubViewChange={setPrintSubView}
            selectedHallId={cardHallFilter}
            selectedSessionId={cardSessionFilter}
          />
        </div>
      )}
    </div>
  );
};
