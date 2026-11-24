// Fast In-Person / Paper Answer Sheet Entry & Bulk CSV OMR Scanner Import
// Supports continuous keyboard typing (1-4, 0/Space with auto-advance), CSV batch grading,
// and A4/A5 Blank OMR Sheet + Answer Key printing via PrintIconButton.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Keyboard, Save, Upload } from 'lucide-react';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import { PrintIconButton } from '../../core/print/PrintIconButton';
import { useToast } from '../../core/ui/ToastContext';
import type {
  ClassRoom,
  MockAnswerOption,
  MockExam,
  MockExamAttempt,
  Student,
} from '../../types/domain';
import {
  calculateSubjectPercentage,
  parseBulkOmrCsv,
  type ParsedOmrCsvRow,
} from './statsEngine';

interface PaperAnswerEntryTabProps {
  exam: MockExam;
  students: Student[];
  classes: ClassRoom[];
  existingAttempts: MockExamAttempt[];
  currentUserId: string;
  readOnly: boolean;
  onSaveAttempt: (attempt: MockExamAttempt) => Promise<{ ok: boolean; errorFa?: string }>;
  onSaveBatch: (attempts: MockExamAttempt[]) => Promise<{ ok: boolean; errorFa?: string }>;
}

export const PaperAnswerEntryTab: React.FC<PaperAnswerEntryTabProps> = ({
  exam,
  students,
  classes,
  existingAttempts,
  currentUserId,
  readOnly,
  onSaveAttempt,
  onSaveBatch,
}) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'keyboard' | 'csv'>('keyboard');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [answers, setAnswers] = useState<Record<number, MockAnswerOption | null>>({});
  const [activeQIndex, setActiveQIndex] = useState(0);
  const [csvInput, setCsvInput] = useState('');
  const [saving, setSaving] = useState(false);

  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const classNameMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const sortedQuestions = useMemo(
    () => [...exam.questions].sort((a, b) => a.questionNumber - b.questionNumber),
    [exam.questions]
  );

  const filteredStudents = useMemo(() => {
    const active = students.filter((s) => s.active);
    if (selectedClassId === 'all') return active;
    return active.filter((s) => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  useEffect(() => {
    if (!selectedStudentId && filteredStudents.length > 0) {
      setSelectedStudentId(filteredStudents[0].id);
    } else if (
      selectedStudentId &&
      !filteredStudents.some((s) => s.id === selectedStudentId) &&
      filteredStudents.length > 0
    ) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  // Load student's existing answers when selecting a student
  useEffect(() => {
    if (!selectedStudentId) return;
    const existing = existingAttempts.find(
      (a) => a.examId === exam.id && a.studentId === selectedStudentId
    );
    setAnswers(existing ? { ...existing.answers } : {});
    setActiveQIndex(0);
  }, [selectedStudentId, exam.id, existingAttempts]);

  const selectedStudent = filteredStudents.find((s) => s.id === selectedStudentId);

  const setAnswerAndAdvance = (qIdx: number, val: MockAnswerOption | null) => {
    if (readOnly) return;
    const q = sortedQuestions[qIdx];
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.questionNumber]: val }));
    const nextIdx = Math.min(sortedQuestions.length - 1, qIdx + 1);
    setActiveQIndex(nextIdx);
    window.requestAnimationFrame(() => cellRefs.current[nextIdx]?.focus());
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, qIdx: number) => {
    if (readOnly) return;
    const key = toAsciiDigits(e.key);
    if (key === '1' || key === '2' || key === '3' || key === '4') {
      e.preventDefault();
      setAnswerAndAdvance(qIdx, Number(key) as MockAnswerOption);
    } else if (key === '0' || e.key === ' ' || e.key === 'Delete') {
      e.preventDefault();
      setAnswerAndAdvance(qIdx, null);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const q = sortedQuestions[qIdx];
      if (q) setAnswers((prev) => ({ ...prev, [q.questionNumber]: null }));
      const prevIdx = Math.max(0, qIdx - 1);
      setActiveQIndex(prevIdx);
      window.requestAnimationFrame(() => cellRefs.current[prevIdx]?.focus());
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextIdx = Math.min(sortedQuestions.length - 1, qIdx + 1);
      setActiveQIndex(nextIdx);
      cellRefs.current[nextIdx]?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const prevIdx = Math.max(0, qIdx - 1);
      setActiveQIndex(prevIdx);
      cellRefs.current[prevIdx]?.focus();
    }
  };

  // Live instant grading preview for the current keyboard sheet
  const livePreview = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    for (const q of sortedQuestions) {
      const v = answers[q.questionNumber] ?? null;
      if (v === null) blank++;
      else if (v === q.correctOption) correct++;
      else wrong++;
    }
    const pct = calculateSubjectPercentage(
      correct,
      wrong,
      sortedQuestions.length,
      exam.negativeMarking
    );
    return { correct, wrong, blank, pct };
  }, [sortedQuestions, answers, exam.negativeMarking]);

  const handleSaveKeyboardSheet = async () => {
    if (readOnly || !selectedStudent) return;
    setSaving(true);
    const nowIso = new Date().toISOString();
    const attempt: MockExamAttempt = {
      id: `attempt-${exam.id}-${selectedStudent.id}`,
      complexId: exam.complexId,
      schoolId: selectedStudent.schoolId,
      academicYearId: exam.academicYearId,
      examId: exam.id,
      studentId: selectedStudent.id,
      studentName: selectedStudent.fullName,
      classId: selectedStudent.classId,
      className: classNameMap.get(selectedStudent.classId) ?? 'کلاس',
      entryMethod: 'paper_keyboard',
      status: 'submitted',
      answers,
      flaggedQuestions: [],
      eliminatedOptions: {},
      tabSwitchCount: 0,
      activeBookletIndex: exam.booklets.length - 1,
      startedAtIso: nowIso,
      submittedAtJalali: getTodayJalali(),
      createdByUserId: currentUserId,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await onSaveAttempt(attempt);
    setSaving(false);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ذخیره پاسخبرگ', 'error');
      return;
    }
    showToast(
      `پاسخبرگ «${selectedStudent.fullName}» تصحیح و ذخیره شد (${toPersianDigits(livePreview.pct)}٪).`,
      'success'
    );
    // Advance automatically to next student in list for ultra-fast school-wide entry
    const currStudentIdx = filteredStudents.findIndex((s) => s.id === selectedStudent.id);
    if (currStudentIdx >= 0 && currStudentIdx < filteredStudents.length - 1) {
      setSelectedStudentId(filteredStudents[currStudentIdx + 1].id);
    }
  };

  // CSV Bulk OMR Parsing
  const parsedCsvRows = useMemo<ParsedOmrCsvRow[]>(() => {
    if (!csvInput.trim()) return [];
    return parseBulkOmrCsv(
      csvInput,
      students.filter((s) => s.active),
      sortedQuestions.map((q) => q.questionNumber)
    );
  }, [csvInput, students, sortedQuestions]);

  const validCsvRows = parsedCsvRows.filter((r) => r.matchedStudent !== null);

  const handleLoadSampleCsv = () => {
    const sampleStudents = filteredStudents.slice(0, 3);
    const header = ['کد ملی', ...sortedQuestions.map((q) => `س${q.questionNumber}`)].join(',');
    const lines = sampleStudents.map((st, idx) => {
      const ans = sortedQuestions.map((q, qIdx) =>
        (qIdx + idx) % 5 === 0 ? '0' : String(((q.correctOption + (idx % 2) - 1) % 4) + 1)
      );
      return [st.nationalId, ...ans].join(',');
    });
    setCsvInput([header, ...lines].join('\n'));
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvInput(reader.result);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleCommitCsvBatch = async () => {
    if (readOnly || validCsvRows.length === 0) return;
    setSaving(true);
    const nowIso = new Date().toISOString();
    const today = getTodayJalali();
    const batch: MockExamAttempt[] = validCsvRows.map((row) => {
      const st = row.matchedStudent!;
      return {
        id: `attempt-${exam.id}-${st.id}`,
        complexId: exam.complexId,
        schoolId: st.schoolId,
        academicYearId: exam.academicYearId,
        examId: exam.id,
        studentId: st.id,
        studentName: st.fullName,
        classId: st.classId,
        className: classNameMap.get(st.classId) ?? 'کلاس',
        entryMethod: 'paper_csv',
        status: 'submitted',
        answers: row.answers,
        flaggedQuestions: [],
        eliminatedOptions: {},
        tabSwitchCount: 0,
        activeBookletIndex: exam.booklets.length - 1,
        startedAtIso: nowIso,
        submittedAtJalali: today,
        createdByUserId: currentUserId,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
    });

    const res = await onSaveBatch(batch);
    setSaving(false);
    if (!res.ok) {
      showToast(res.errorFa ?? 'خطا در ثبت گروهی پاسخبرگ‌ها', 'error');
      return;
    }
    showToast(
      `${toPersianDigits(batch.length)} پاسخبرگ با موفقیت تصحیح و در کارنامه کل ثبت شد.`,
      'success'
    );
    setCsvInput('');
  };

  // Build printable Blank OMR Sheet + Answer Key HTML
  const blankOmrPrintHtml = useMemo(() => {
    const rowsHtml = sortedQuestions
      .map(
        (q) => `
      <tr>
        <td style="font-weight:700;text-align:center;width:48px;">${toPersianDigits(q.questionNumber)}</td>
        <td style="text-align:center;">① &nbsp; ② &nbsp; ③ &nbsp; ④</td>
        <td style="font-size:11px;color:#475569;">${q.topic}</td>
      </tr>`
      )
      .join('');

    const keyCells = sortedQuestions
      .map(
        (q) =>
          `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:6px;padding:3px 7px;margin:2px;font-size:11px;"><strong>${toPersianDigits(q.questionNumber)}:</strong> ${toPersianDigits(q.correctOption)}</span>`
      )
      .join('');

    return `
      <div style="direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif;">
        <h2 style="font-size:16px;margin:0 0 6px;">پاسخبرگ خام آزمون حضوری — ${exam.title}</h2>
        <div style="font-size:12px;margin-bottom:12px;display:flex;gap:18px;flex-wrap:wrap;border:1px solid #cbd5e1;padding:8px;border-radius:8px;">
          <span>نام و نام خانوادگی: ........................................</span>
          <span>کلاس: ........................</span>
          <span>کد ملی: ........................</span>
          <span>تاریخ: ${toPersianDigits(exam.examDateJalali)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="border:1px solid #cbd5e1;padding:5px;">شماره</th>
              <th style="border:1px solid #cbd5e1;padding:5px;">گزینه‌ها (دایره صحیح را پر کنید)</th>
              <th style="border:1px solid #cbd5e1;padding:5px;">مبحث سوال</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="margin-top:18px;page-break-before:always;">
          <h3 style="font-size:14px;margin:0 0 8px;">کلید رسمی تصحیح — ${exam.title}</h3>
          <div>${keyCells}</div>
        </div>
      </div>
    `;
  }, [exam, sortedQuestions]);

  return (
    <div className="space-y-4">
      {/* Mode Selector + Print Blank OMR Sheet & Key */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="شیوه ورود پاسخبرگ حضوری"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'keyboard'}
            onClick={() => setMode('keyboard')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              mode === 'keyboard'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            ورود سریع صفحه‌کلید (۱ تا ۴ / ۰)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'csv'}
            onClick={() => setMode('csv')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              mode === 'csv'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            ورود گروهی CSV / اسکنر پاسخبرگ
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            چاپ پاسخبرگ خام و کلید:
          </span>
          <PrintIconButton
            documentLabel={`پاسخبرگ خام و کلید ${exam.title}`}
            html={blankOmrPrintHtml}
            includeHeader={true}
            includeFooter={true}
          />
        </div>
      </div>

      {/* Mode 1: Fast Keyboard Entry Grid */}
      {mode === 'keyboard' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="omr-class-select"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                فیلتر کلاس
              </label>
              <select
                id="omr-class-select"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="all">همه کلاس‌های مدرسه</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="omr-student-select"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                انتخاب دانش‌آموز جهت ورود پاسخبرگ
              </label>
              <select
                id="omr-student-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-slate-100"
              >
                {filteredStudents.map((st) => {
                  const hasAttempt = existingAttempts.some(
                    (a) => a.examId === exam.id && a.studentId === st.id
                  );
                  return (
                    <option key={st.id} value={st.id}>
                      {st.fullName} — {classNameMap.get(st.classId) ?? ''} (کد ملی:{' '}
                      {toPersianDigits(st.nationalId)}){hasAttempt ? ' ✓ ثبت‌شده' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Live Keyboard Hint & Instant Score Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-2.5 text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              روی هر خانه کلیک کرده و پشت سر هم اعداد <strong>۱، ۲، ۳، ۴</strong> یا{' '}
              <strong>۰ / Space</strong> (نزده) را تایپ کنید — مکان‌نما خودکار به سوال بعدی می‌رود.
            </span>
            <div className="flex items-center gap-3 font-bold tabular-nums">
              <span className="text-emerald-700 dark:text-emerald-400">
                {toPersianDigits(livePreview.correct)} درست
              </span>
              <span className="text-rose-700 dark:text-rose-400">
                {toPersianDigits(livePreview.wrong)} غلط
              </span>
              <span className="text-slate-500">{toPersianDigits(livePreview.blank)} نزده</span>
              <span className="text-indigo-700 dark:text-indigo-300">
                درصد کل: {toPersianDigits(livePreview.pct)}٪
              </span>
            </div>
          </div>

          {/* Keyboard OMR Grid */}
          <div
            data-testid="paper-omr-keyboard-grid"
            className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2"
          >
            {sortedQuestions.map((q, idx) => {
              const val = answers[q.questionNumber] ?? null;
              const isFocused = idx === activeQIndex;
              const isCorrect = val !== null && val === q.correctOption;
              const isWrong = val !== null && val !== q.correctOption;

              return (
                <button
                  key={q.questionNumber}
                  ref={(el) => {
                    cellRefs.current[idx] = el;
                  }}
                  type="button"
                  disabled={readOnly}
                  onFocus={() => setActiveQIndex(idx)}
                  onKeyDown={(e) => handleCellKeyDown(e, idx)}
                  onClick={() => {
                    if (readOnly) return;
                    const nextVal: MockAnswerOption | null =
                      val === null ? 1 : val === 4 ? null : ((val + 1) as MockAnswerOption);
                    setAnswers((prev) => ({ ...prev, [q.questionNumber]: nextVal }));
                    setActiveQIndex(idx);
                  }}
                  aria-label={`سوال ${toPersianDigits(q.questionNumber)} پاسخ ${val ? toPersianDigits(val) : 'نزده'}`}
                  className={`min-h-[58px] rounded-xl border p-2 flex flex-col items-center justify-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isFocused
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                      : isCorrect
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : isWrong
                          ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                    س {toPersianDigits(q.questionNumber)}
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {val === null ? '—' : toPersianDigits(val)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setAnswers({})}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              پاک کردن همه خانه‌ها
            </button>

            <button
              type="button"
              disabled={readOnly || saving || !selectedStudent}
              onClick={() => void handleSaveKeyboardSheet()}
              className="min-h-[42px] px-5 rounded-xl brand-btn text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'در حال ثبت...' : 'ثبت پاسخبرگ و رفتن به دانش‌آموز بعدی'}
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Bulk CSV / OMR Scanner Import */}
      {mode === 'csv' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ورود گروهی فایل CSV یا خروجی دستگاه تصحیح‌گر (OMR Scanner)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                قالب هر سطر: کد ملی یا نام دانش‌آموز، پاسخ سوال ۱، پاسخ سوال ۲، ... (عدد ۰ یا خالی = نزده)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSampleCsv}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                درج نمونه آماده
              </button>
              <label className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>بارگذاری فایل CSV</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <textarea
            rows={5}
            dir="ltr"
            disabled={readOnly}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="0012345678, 1, 3, 2, 0, 4, ..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {parsedCsvRows.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">سطر</th>
                      <th className="py-2 px-3">شناسه ورودی</th>
                      <th className="py-2 px-3">تطبیق دانش‌آموز</th>
                      <th className="py-2 px-3">تعداد پاسخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {parsedCsvRows.map((row) => (
                      <tr key={row.lineNumber}>
                        <td className="py-2 px-3">{toPersianDigits(row.lineNumber)}</td>
                        <td className="py-2 px-3">{row.identifier}</td>
                        <td className="py-2 px-3">
                          {row.matchedStudent ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {row.matchedStudent.fullName}
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">{row.errorFa}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {toPersianDigits(row.answeredCount)} از {toPersianDigits(sortedQuestions.length)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  disabled={readOnly || saving || validCsvRows.length === 0}
                  onClick={() => void handleCommitCsvBatch()}
                  className="min-h-[42px] px-5 rounded-xl brand-btn text-xs font-bold disabled:opacity-50"
                >
                  تصحیح و ثبت {toPersianDigits(validCsvRows.length)} پاسخبرگ معتبر
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
