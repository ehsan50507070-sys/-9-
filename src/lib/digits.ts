// Persian / ASCII digit conversion & numeric formatting utilities

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;
const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function toAsciiDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  let result = String(input);
  for (let i = 0; i < 10; i++) {
    result = result.split(PERSIAN_DIGITS[i]).join(String(i));
    result = result.split(ARABIC_INDIC_DIGITS[i]).join(String(i));
  }
  return result;
}

export function formatPersianPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return `${toPersianDigits(clamped)}٪`;
}

export function formatPersianHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${toPersianDigits(hours)} ساعت`;
  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rem)} دقیقه`;
}

export function formatPersianNumber(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const sign = rounded < 0 ? '−' : '';
  const absStr = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${sign}${toPersianDigits(absStr)}`;
}

export function formatToman(amount: number): string {
  return `${formatPersianNumber(amount)} تومان`;
}

export function formatTomanCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${toPersianDigits((abs / 1_000_000_000).toFixed(1).replace('.', '٫'))} م.ت`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${toPersianDigits((abs / 1_000_000).toFixed(1).replace('.', '٫'))} م`;
  }
  if (abs >= 1_000) {
    return `${sign}${toPersianDigits(Math.round(abs / 1_000))} ه`;
  }
  return `${sign}${toPersianDigits(Math.round(abs))}`;
}

