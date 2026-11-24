// Formal A4 Printable Question Sheet Preview Modal with Optional Answer Key
import React, { useState } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';
import { PrintButtons } from '../../core/print/PrintButtons';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import { toPersianDigits } from '../../lib/digits';
import { formatJalaliDisplay } from '../../lib/jalali';
import type { QuestionBankItem, School } from '../../types/domain';
import {
  DIFFICULTY_LABELS,
  OPTION_LETTERS_FA,
  QUESTION_TYPE_LABELS,
} from './questionBankHelpers';

interface QuestionPrintModalProps {
  school: School;
  questions: QuestionBankItem[];
  jalaliDate: string;
  examTitle?: string;
  onClose: () => void;
}

export const QuestionPrintModal: React.FC<QuestionPrintModalProps> = ({
  school,
  questions,
  jalaliDate,
  examTitle = 'آزمون کلاسی و برگه تمرین استاندارد',
  onClose,
}) => {
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [customTitle, setCustomTitle] = useState(examTitle);
  const [examDurationMinutes, setExamDurationMinutes] = useState('۳۰');

  const uniqueSubjects = Array.from(new Set(questions.map((q) => q.subject))).join('، ');
  const uniqueGrades = Array.from(new Set(questions.map((q) => q.gradeLabel))).join('، ');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 print:static print:inset-auto print:bg-white print:p-0 print:overflow-visible"
      dir="rtl"
    >
      <div className="max-w-4xl mx-auto space-y-4 print:max-w-none print:space-y-0">
        {/* Controls Toolbar (Hidden during Print) */}
        <div className="no-print rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              پیش‌نمایش و چاپ برگه سوال ({toPersianDigits(questions.length)} سوال)
            </h3>

            <button
              type="button"
              onClick={() => setIncludeAnswerKey((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                includeAnswerKey
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {includeAnswerKey ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>چاپ همراه با پاسخنامه</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PrintButtons compact documentLabel={customTitle || 'برگه سوال'} />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
              <span>بستن</span>
            </button>
          </div>

          {/* Inline customizable title & duration */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="sm:col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                عنوان سربرگ آزمون
              </span>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                مدت پاسخ‌گویی (دقیقه)
              </span>
              <input
                type="text"
                value={examDurationMinutes}
                onChange={(e) => setExamDurationMinutes(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <article className="print-sheet bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-lg p-6 sm:p-8 print:rounded-none print:border-0 print:shadow-none print:p-0">
          {/* Formal School Letterhead */}
          <header className="border-2 border-slate-800 rounded-xl p-4 mb-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3 mb-3">
              <div>
                <p className="text-xs font-medium text-slate-600">به‌نام خدا</p>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  {school.letterheadTitle || school.name}
                </h1>
                <p className="text-xs font-semibold text-slate-700 mt-1">{customTitle}</p>
              </div>
              <div className="text-left text-xs space-y-1 text-slate-700 tabular-nums shrink-0">
                <p>سال تحصیلی: {toPersianDigits(school.academicYear)}</p>
                <p>تاریخ: {formatJalaliDisplay(jalaliDate, false)}</p>
                <p>مدت آزمون: {toPersianDigits(examDurationMinutes)} دقیقه</p>
              </div>
            </div>

            {/* Student Information Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-800">
              <div className="border border-slate-300 rounded-lg px-2.5 py-2">
                <span className="font-semibold text-slate-600">نام و نام خانوادگی:</span>
                <div className="h-4 mt-1 border-b border-dotted border-slate-400" />
              </div>
              <div className="border border-slate-300 rounded-lg px-2.5 py-2">
                <span className="font-semibold text-slate-600">پایه / کلاس:</span>
                <p className="mt-1 text-[11px] font-medium text-slate-700">
                  {uniqueGrades || '...................'}
                </p>
              </div>
              <div className="border border-slate-300 rounded-lg px-2.5 py-2">
                <span className="font-semibold text-slate-600">نام درس:</span>
                <p className="mt-1 text-[11px] font-medium text-slate-700">
                  {uniqueSubjects || '...................'}
                </p>
              </div>
              <div className="border border-slate-300 rounded-lg px-2.5 py-2">
                <span className="font-semibold text-slate-600">نمره / بازخورد:</span>
                <div className="h-4 mt-1 border-b border-dotted border-slate-400" />
              </div>
            </div>
          </header>

          {/* Numbered Questions */}
          <ol className="space-y-5">
            {questions.map((q, idx) => (
              <li
                key={q.id}
                className="border-b border-slate-200 pb-4 last:border-b-0 break-inside-avoid"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold shrink-0 tabular-nums mt-0.5">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-900 leading-7 whitespace-pre-wrap">
                        {q.questionText}
                      </p>

                      {q.type === 'multiple_choice' && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1 text-xs text-slate-800">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-400 text-[11px] font-bold shrink-0">
                                {OPTION_LETTERS_FA[optIdx]}
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.type === 'true_false' && (
                        <div className="flex items-center gap-6 pt-1 text-xs font-medium text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full border border-slate-500 inline-block" />
                            صحیح
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full border border-slate-500 inline-block" />
                            غلط
                          </span>
                        </div>
                      )}

                      {q.type === 'descriptive' && (
                        <div className="space-y-3 pt-2 w-full min-w-[260px] sm:min-w-[460px]">
                          <div className="border-b border-dotted border-slate-400 h-4" />
                          <div className="border-b border-dotted border-slate-400 h-4" />
                          <div className="border-b border-dotted border-slate-400 h-4" />
                        </div>
                      )}

                      {q.type === 'fill_blank' && (
                        <div className="pt-2 text-xs text-slate-600">
                          پاسخ: ........................................................................
                        </div>
                      )}

                      {q.mediaAttachment && (
                        <div className="pt-2 max-w-md">
                          <MediaAttachmentPreview attachment={q.mediaAttachment} compact />
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500 shrink-0 whitespace-nowrap">
                    {QUESTION_TYPE_LABELS[q.type]} · {DIFFICULTY_LABELS[q.difficulty]}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          {/* Optional Answer Key Section */}
          {includeAnswerKey && (
            <section className="mt-7 pt-5 border-t-2 border-dashed border-slate-400 break-inside-avoid">
              <h2 className="text-sm font-extrabold text-slate-900 mb-3">
                پاسخنامه کلیدی و راهنمای تصحیح معلم
              </h2>
              <div className="space-y-2.5 text-xs text-slate-800">
                {questions.map((q, idx) => (
                  <div
                    key={`ans-${q.id}`}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 leading-6"
                  >
                    <span className="font-bold text-slate-900 tabular-nums">
                      سوال {toPersianDigits(idx + 1)}:{' '}
                    </span>
                    {q.type === 'multiple_choice' &&
                      q.options &&
                      q.correctOptionIndex !== undefined && (
                        <span className="font-semibold text-emerald-800">
                          گزینه {OPTION_LETTERS_FA[q.correctOptionIndex]} ({q.options[q.correctOptionIndex]}){' '}
                        </span>
                      )}
                    {q.type === 'true_false' && q.trueFalseAnswer !== undefined && (
                      <span className="font-semibold text-emerald-800">
                        {q.trueFalseAnswer ? 'صحیح' : 'غلط'}{' '}
                      </span>
                    )}
                    {q.modelAnswer && (
                      <span className="text-slate-700">— {q.modelAnswer}</span>
                    )}
                    {!q.modelAnswer &&
                      q.type !== 'multiple_choice' &&
                      q.type !== 'true_false' && (
                        <span className="text-slate-500">پاسخ کلیدی ثبت نشده است.</span>
                      )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer Signature */}
          <footer className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>موفق و پیروز باشید — {school.name}</span>
            <span>تعداد کل سوالات: {toPersianDigits(questions.length)} سوال</span>
          </footer>
        </article>
      </div>
    </div>
  );
};
