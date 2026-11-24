// Pure HTML5 Canvas Digital Signature Pad (zero external signature libraries)
// Smooth mouse, stylus, and touch drawing with crisp high-DPI scaling and compact PNG data URL output.
import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool } from 'lucide-react';

interface DigitalSignaturePadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  disabled?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState<boolean>(Boolean(value));

  // Initialize crisp canvas backing buffer once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 520;
    const height = 160;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#0f172a';
  }, []);

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = 520 / rect.width;
    const scaleY = 160 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const pt = getCoords(e);
    drawingRef.current = true;
    lastPointRef.current = pt;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
    setHasStroke(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPointRef.current) return;

    const pt = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        // Export compact PNG data URL
        const dataUrl = canvas.toDataURL('image/png');
        onChange(dataUrl);
      } catch {
        // ignore tainted canvas errors
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, 520, 160);
    }
    setHasStroke(false);
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <PenTool className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>کادر امضای دیجیتال ولی (با موس یا لمس صفحه امضا کنید)</span>
        </div>
        <button
          type="button"
          disabled={disabled || !hasStroke}
          onClick={handleClear}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>پاک کردن امضا</span>
        </button>
      </div>

      <div className="relative rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-label="صفحه رسم امضای دیجیتال ولی"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="w-full h-[150px] sm:h-[170px] block cursor-crosshair touch-none"
        />
        {!hasStroke && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs sm:text-sm text-slate-400 font-medium">
            اینجا امضا بکشید...
          </div>
        )}
      </div>
    </div>
  );
};
