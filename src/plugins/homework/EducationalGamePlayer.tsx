// Pure React + TypeScript Offline Educational Mini-Game Player (Matching, Memory Cards, Speed Quiz + External Link)
import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Gamepad2,
  RotateCcw,
  Star,
  Trophy,
  Upload,
} from 'lucide-react';
import { saveMediaBlob } from '../../core/data/mediaBlobStore';
import { MediaAttachmentPreview } from '../../core/ui/MediaAttachmentPreview';
import { useToast } from '../../core/ui/ToastContext';
import { validateRichMediaFile, validateSafeHttpUrl } from '../../core/validation/validators';
import { toPersianDigits } from '../../lib/digits';
import type {
  HomeworkAssignment,
  HomeworkGameResult,
  MediaAttachmentRef,
} from '../../types/domain';
import { calculateGameScore } from './homeworkHelpers';

interface EducationalGamePlayerProps {
  assignment: HomeworkAssignment;
  schoolId: string;
  onComplete: (payload: {
    result: HomeworkGameResult;
    answerSummary: string;
    attachments?: MediaAttachmentRef[];
  }) => void;
  existingResult?: HomeworkGameResult;
}

function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = s % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export const EducationalGamePlayer: React.FC<EducationalGamePlayerProps> = ({
  assignment,
  schoolId,
  onComplete,
  existingResult,
}) => {
  const { showToast } = useToast();
  const config = assignment.gameConfig;
  const [elapsedSec, setElapsedSec] = useState(0);
  const [finishedResult, setFinishedResult] = useState<HomeworkGameResult | null>(
    existingResult ?? null
  );

  // External link game state
  const [externalScreenshot, setExternalScreenshot] = useState<MediaAttachmentRef | null>(null);
  const [externalNote, setExternalNote] = useState('');

  // Template 1: Matching («جورچین مفاهیم»)
  const pairs = useMemo(() => config?.pairs ?? [], [config?.pairs]);
  const shuffledRight = useMemo(
    () => deterministicShuffle(pairs, assignment.id.length * 17 + pairs.length),
    [pairs, assignment.id]
  );
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [flashWrongId, setFlashWrongId] = useState<string | null>(null);

  // Template 2: Memory Cards («کارت حافظه آموزشی»)
  const memoryDeck = useMemo(() => {
    const cards: Array<{ cardId: string; pairId: string; text: string; side: 'term' | 'match' }> = [];
    for (const p of pairs) {
      cards.push({ cardId: `${p.id}:term`, pairId: p.id, text: p.term, side: 'term' });
      cards.push({ cardId: `${p.id}:match`, pairId: p.id, text: p.match, side: 'match' });
    }
    return deterministicShuffle(cards, assignment.id.length * 31 + pairs.length * 7);
  }, [pairs, assignment.id]);
  const [flippedCardIds, setFlippedCardIds] = useState<string[]>([]);
  const [solvedPairIds, setSolvedPairIds] = useState<string[]>([]);
  const [memoryMoves, setMemoryMoves] = useState(0);

  // Template 3: Speed Quiz («مسابقه سرعتی چهارگزینه‌ای»)
  const quizItems = useMemo(() => config?.quizItems ?? [], [config?.quizItems]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Live timer while playing built-in game
  useEffect(() => {
    if (finishedResult || config?.source !== 'builtin') return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishedResult, config?.source]);

  if (!config) {
    return (
      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 text-xs text-amber-800 dark:text-amber-300">
        تنظیمات بازی آموزشی برای این تکلیف کامل نشده است.
      </div>
    );
  }

  const resetGame = () => {
    setElapsedSec(0);
    setFinishedResult(null);
    setSelectedLeftId(null);
    setMatchedIds([]);
    setWrongAttempts(0);
    setFlippedCardIds([]);
    setSolvedPairIds([]);
    setMemoryMoves(0);
    setQuizIndex(0);
    setQuizCorrect(0);
    setQuizFeedback(null);
  };

  const finalizeBuiltinGame = (correctCount: number, totalCount: number) => {
    const scored = calculateGameScore({
      correctCount,
      totalCount,
      durationSec: Math.max(1, elapsedSec),
    });
    const result: HomeworkGameResult = {
      score: scored.score,
      maxScore: scored.maxScore,
      stars: scored.stars,
      durationSec: Math.max(1, elapsedSec),
      completedAtIso: new Date().toISOString(),
      source: 'builtin',
    };
    setFinishedResult(result);
    const templateLabel =
      config.template === 'matching'
        ? 'جورچین مفاهیم'
        : config.template === 'memory'
          ? 'کارت حافظه آموزشی'
          : 'مسابقه سرعتی چهارگزینه‌ای';
    onComplete({
      result,
      answerSummary: `بازی آموزشی «${templateLabel}» با امتیاز ${toPersianDigits(result.score)} از ۱۰۰ (${toPersianDigits(result.stars)} ستاره) در زمان ${toPersianDigits(result.durationSec)} ثانیه تکمیل شد.`,
    });
  };

  // Matching handler
  const handleSelectRight = (rightPairId: string) => {
    if (!selectedLeftId || matchedIds.includes(rightPairId)) return;
    if (selectedLeftId === rightPairId) {
      const nextMatched = [...matchedIds, rightPairId];
      setMatchedIds(nextMatched);
      setSelectedLeftId(null);
      if (nextMatched.length === pairs.length) {
        const effectiveCorrect = Math.max(1, pairs.length - Math.floor(wrongAttempts / 2));
        finalizeBuiltinGame(effectiveCorrect, pairs.length);
      }
    } else {
      setWrongAttempts((w) => w + 1);
      setFlashWrongId(rightPairId);
      window.setTimeout(() => setFlashWrongId(null), 450);
    }
  };

  // Memory card handler
  const handleFlipCard = (cardId: string, pairId: string) => {
    if (solvedPairIds.includes(pairId) || flippedCardIds.includes(cardId) || flippedCardIds.length >= 2) {
      return;
    }
    const nextFlipped = [...flippedCardIds, cardId];
    setFlippedCardIds(nextFlipped);

    if (nextFlipped.length === 2) {
      setMemoryMoves((m) => m + 1);
      const firstCard = memoryDeck.find((c) => c.cardId === nextFlipped[0]);
      const secondCard = memoryDeck.find((c) => c.cardId === nextFlipped[1]);
      if (firstCard && secondCard && firstCard.pairId === secondCard.pairId) {
        const nextSolved = [...solvedPairIds, firstCard.pairId];
        setSolvedPairIds(nextSolved);
        setFlippedCardIds([]);
        if (nextSolved.length === pairs.length) {
          const extraMoves = Math.max(0, memoryMoves + 1 - pairs.length);
          const effectiveCorrect = Math.max(1, pairs.length - Math.floor(extraMoves / 3));
          finalizeBuiltinGame(effectiveCorrect, pairs.length);
        }
      } else {
        window.setTimeout(() => setFlippedCardIds([]), 700);
      }
    }
  };

  // Speed Quiz handler
  const handleQuizOption = (optionIndex: number) => {
    if (quizFeedback !== null) return;
    const current = quizItems[quizIndex];
    if (!current) return;
    const isCorrect = optionIndex === current.correctIndex;
    const nextCorrect = isCorrect ? quizCorrect + 1 : quizCorrect;
    setQuizCorrect(nextCorrect);
    setQuizFeedback(isCorrect ? 'correct' : 'wrong');

    window.setTimeout(() => {
      setQuizFeedback(null);
      if (quizIndex + 1 >= quizItems.length) {
        finalizeBuiltinGame(nextCorrect, quizItems.length);
      } else {
        setQuizIndex((idx) => idx + 1);
      }
    }, 550);
  };

  // External Game Screenshot Upload
  const handleExternalScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateRichMediaFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      allowPdf: false,
    });
    if (!check.valid || check.data !== 'image') {
      showToast(check.errors[0] ?? 'لطفاً یک تصویر (PNG/JPG/WebP حداکثر ۵ مگابایت) انتخاب کنید.', 'error');
      e.target.value = '';
      return;
    }
    const mediaId = `${schoolId}:blob:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await saveMediaBlob({
      mediaId,
      schoolId,
      fileName: file.name,
      mimeType: file.type || 'image/png',
      sizeBytes: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    });
    setExternalScreenshot({
      mediaId,
      schoolId,
      fileName: file.name,
      mimeType: file.type || 'image/png',
      kind: 'image',
      sizeBytes: file.size,
    });
  };

  // Finished celebration card
  if (finishedResult) {
    return (
      <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-5 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
            <Trophy className="w-7 h-7" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200">
            آفرین! بازی آموزشی با موفقیت تکمیل شد
          </h3>
          <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            امتیاز: {toPersianDigits(finishedResult.score)} از {toPersianDigits(finishedResult.maxScore)}
          </div>
          <div className="flex items-center justify-center gap-1 pt-1" aria-label={`${finishedResult.stars} ستاره از ۳`}>
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-6 h-6 ${
                  s <= finishedResult.stars
                    ? 'fill-amber-400 text-amber-500'
                    : 'text-slate-300 dark:text-slate-700'
                }`}
              />
            ))}
          </div>
          {finishedResult.source === 'builtin' && (
            <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums pt-1">
              زمان تکمیل: {toPersianDigits(finishedResult.durationSec)} ثانیه · نتیجه به‌صورت خودکار در تحویل تکلیف ذخیره شد.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={resetGame}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          تکرار بازی برای امتیاز بهتر
        </button>
      </div>
    );
  }

  // Mode B: External Web Game Link («لینک بازی آموزشی»)
  if (config.source === 'external') {
    const safeUrl = config.externalUrl
      ? validateSafeHttpUrl(config.externalUrl)
      : { valid: false, data: undefined, errors: [] };
    return (
      <div className="rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {config.externalTitle || assignment.title}
            </h3>
            <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
              {config.externalInstructions || 'روی دکمه زیر کلیک کنید، بازی را انجام دهید و پس از اتمام دکمه «بازی را انجام دادم» را بزنید.'}
            </p>
          </div>
        </div>

        {safeUrl.valid && safeUrl.data && (
          <a
            href={safeUrl.data}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            شروع بازی آموزشی
          </a>
        )}

        <div className="space-y-3 pt-2 border-t border-indigo-200/70 dark:border-indigo-900/60">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            توضیح یا امتیاز کسب‌شده (اختیاری)
            <input
              type="text"
              value={externalNote}
              onChange={(e) => setExternalNote(e.target.value)}
              placeholder="مثال: هر ۳ مرحله را با امتیاز کامل انجام دادم"
              className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Upload className="w-4 h-4" />
              <span>بارگذاری اسکرین‌شات امتیاز بازی (اختیاری — حداکثر ۵ مگابایت)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => void handleExternalScreenshot(e)}
                className="sr-only"
              />
            </label>
            {externalScreenshot && (
              <MediaAttachmentPreview
                attachment={externalScreenshot}
                compact
                onRemove={() => setExternalScreenshot(null)}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const result: HomeworkGameResult = {
                score: 100,
                maxScore: 100,
                stars: 3,
                durationSec: 1,
                completedAtIso: new Date().toISOString(),
                source: 'external',
              };
              setFinishedResult(result);
              onComplete({
                result,
                answerSummary:
                  externalNote.trim() ||
                  `بازی آموزشی بیرونی «${config.externalTitle || assignment.title}» انجام شد.`,
                attachments: externalScreenshot ? [externalScreenshot] : undefined,
              });
            }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            بازی را انجام دادم (ثبت تحویل تکلیف)
          </button>
        </div>
      </div>
    );
  }

  // Mode A: Built-In Offline Mini-Games
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
          <Gamepad2 className="w-4 h-4" />
          <span>
            {config.template === 'matching'
              ? 'جورچین مفاهیم'
              : config.template === 'memory'
                ? 'کارت حافظه آموزشی'
                : 'مسابقه سرعتی چهارگزینه‌ای'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {toPersianDigits(elapsedSec)} ثانیه
          </span>
          {config.template === 'matching' && (
            <span>
              جفت‌شده: {toPersianDigits(matchedIds.length)} از {toPersianDigits(pairs.length)}
            </span>
          )}
          {config.template === 'memory' && (
            <span>
              یافته‌شده: {toPersianDigits(solvedPairIds.length)} از {toPersianDigits(pairs.length)}
            </span>
          )}
          {config.template === 'speed_quiz' && (
            <span>
              سوال {toPersianDigits(quizIndex + 1)} از {toPersianDigits(quizItems.length)}
            </span>
          )}
        </div>
      </div>

      {/* Template 1: Matching */}
      {config.template === 'matching' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            ابتدا یک مورد از ستون سمت راست انتخاب کنید و سپس جفت متناظر آن را از ستون سمت چپ بزنید.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              {pairs.map((p) => {
                const isMatched = matchedIds.includes(p.id);
                const isSelected = selectedLeftId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isMatched}
                    onClick={() => setSelectedLeftId(p.id)}
                    className={`w-full min-h-[44px] rounded-xl border px-3.5 py-2 text-right text-sm font-bold transition-colors ${
                      isMatched
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : isSelected
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 ring-2 ring-indigo-500/30'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-indigo-400'
                    }`}
                  >
                    {p.term}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {shuffledRight.map((p) => {
                const isMatched = matchedIds.includes(p.id);
                const isWrong = flashWrongId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isMatched || !selectedLeftId}
                    onClick={() => handleSelectRight(p.id)}
                    className={`w-full min-h-[44px] rounded-xl border px-3.5 py-2 text-right text-sm font-semibold transition-colors ${
                      isMatched
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                          : selectedLeftId
                            ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-indigo-500'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {p.match}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Template 2: Memory Cards */}
      {config.template === 'memory' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            روی دو کارت کلیک کنید تا جفت‌های متناظر آموزشی را پیدا کنید.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {memoryDeck.map((card) => {
              const isSolved = solvedPairIds.includes(card.pairId);
              const isFaceUp = isSolved || flippedCardIds.includes(card.cardId);
              return (
                <button
                  key={card.cardId}
                  type="button"
                  disabled={isFaceUp}
                  onClick={() => handleFlipCard(card.cardId, card.pairId)}
                  className={`min-h-[76px] rounded-xl border p-3 text-center text-xs sm:text-sm font-bold transition-colors flex items-center justify-center ${
                    isSolved
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                      : isFaceUp
                        ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-800 dark:text-indigo-200'
                        : 'border-slate-300 dark:border-slate-700 bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isFaceUp ? card.text : '؟'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Template 3: Speed Quiz */}
      {config.template === 'speed_quiz' && quizItems[quizIndex] && (
        <div className="space-y-4">
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${Math.round(((quizIndex + 1) / quizItems.length) * 100)}%` }}
            />
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-7">
            {quizItems[quizIndex].question}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {quizItems[quizIndex].options.map((opt, idx) => {
              const isCorrectChoice = idx === quizItems[quizIndex].correctIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={quizFeedback !== null}
                  onClick={() => handleQuizOption(idx)}
                  className={`min-h-[46px] rounded-xl border px-4 py-2.5 text-right text-sm font-semibold transition-colors ${
                    quizFeedback && isCorrectChoice
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                  }`}
                >
                  <span className="inline-block ml-2 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {toPersianDigits(idx + 1)})
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
