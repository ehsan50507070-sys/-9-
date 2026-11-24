// Step 3-C: Native Iranian Data Normalization & Validation Engine (Zero External Dependencies)
import { toAsciiDigits } from '../../lib/digits';
import { parseJalaliString } from '../../lib/jalali';

/**
 * Normalizes Persian/Arabic characters (ي->ی, ك->ک, ة->ه), trims extra whitespace & directional marks.
 */
export function normalizePersianText(input: string): string {
  return input
    .replace(/\u200f|\u200e|\ufeff/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/أ|إ/g, 'ا')
    .replace(/\u200c+/g, '\u200c')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compact key for fuzzy dictionary comparison (removes spaces, ZWNJ, punctuation).
 */
export function toNormalizedHeaderKey(header: string): string {
  return normalizePersianText(toAsciiDigits(header))
    .toLowerCase()
    .replace(/[\s\u200c_\-./\\():،,؛;«»"']/g, '');
}

export interface NationalIdValidationResult {
  valid: boolean;
  normalized: string;
  paddedLeadingZeros: boolean;
  warningFa?: string;
  errorFa?: string;
}

/**
 * Validates Iranian National ID (کد ملی) with:
 * - Persian/Arabic digit conversion to ASCII
 * - Auto zero-padding for 8 or 9 digit values (with warning)
 * - Rejection of all-identical digits (e.g. 1111111111)
 * - Exact Mod-11 check digit verification
 */
export function normalizeIranianNationalId(raw: string): NationalIdValidationResult {
  const cleaned = toAsciiDigits(raw).replace(/[\s\-_]/g, '').trim();
  if (!cleaned) {
    return {
      valid: false,
      normalized: '',
      paddedLeadingZeros: false,
      errorFa: 'کد ملی خالی است.',
    };
  }

  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      paddedLeadingZeros: false,
      errorFa: 'کد ملی باید صرفاً شامل ارقام عددی باشد.',
    };
  }

  let candidate = cleaned;
  let paddedLeadingZeros = false;
  if (candidate.length === 8 || candidate.length === 9) {
    candidate = candidate.padStart(10, '0');
    paddedLeadingZeros = true;
  }

  if (candidate.length !== 10) {
    return {
      valid: false,
      normalized: candidate,
      paddedLeadingZeros: false,
      errorFa: `تعداد ارقام کد ملی (${cleaned.length} رقم) نامعتبر است و باید ۱۰ رقم باشد.`,
    };
  }

  // Reject identical digits (e.g., 0000000000, 1111111111, ...)
  if (/^(\d)\1{9}$/.test(candidate)) {
    return {
      valid: false,
      normalized: candidate,
      paddedLeadingZeros,
      errorFa: 'کد ملی با ارقام یکسان (مانند ۱۱۱۱۱۱۱۱۱۱) نامعتبر است.',
    };
  }

  const check = Number(candidate[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(candidate[i]) * (10 - i);
  }
  const remainder = sum % 11;
  const expectedCheck = remainder < 2 ? remainder : 11 - remainder;

  if (check !== expectedCheck) {
    return {
      valid: false,
      normalized: candidate,
      paddedLeadingZeros,
      errorFa: 'رقم کنترل کد ملی ایران نامعتبر است (خطای املایی یا کد جعلی).',
    };
  }

  return {
    valid: true,
    normalized: candidate,
    paddedLeadingZeros,
    warningFa: paddedLeadingZeros
      ? 'کد ملی ۸ یا ۹ رقمی بود و صفر ابتدایی به‌صورت خودکار افزوده شد.'
      : undefined,
  };
}

export interface MobileValidationResult {
  valid: boolean;
  normalized: string;
  autoNormalized: boolean;
  warningFa?: string;
  errorFa?: string;
}

/**
 * Normalizes Iranian mobile numbers (+98912..., 0098912..., 98912..., 912..., Persian digits)
 * to standard 11-digit ASCII format `09xxxxxxxxx`.
 */
export function normalizeIranianMobile(raw: string): MobileValidationResult {
  const ascii = toAsciiDigits(raw).trim();
  if (!ascii) {
    return {
      valid: false,
      normalized: '',
      autoNormalized: false,
      errorFa: 'شماره موبایل خالی است.',
    };
  }

  let stripped = ascii.replace(/[\s\-()]/g, '');
  let autoNormalized = ascii !== stripped || ascii !== raw.trim();

  if (stripped.startsWith('+98')) {
    stripped = `0${stripped.slice(3)}`;
    autoNormalized = true;
  } else if (stripped.startsWith('0098')) {
    stripped = `0${stripped.slice(4)}`;
    autoNormalized = true;
  } else if (stripped.startsWith('98') && stripped.length === 12) {
    stripped = `0${stripped.slice(2)}`;
    autoNormalized = true;
  } else if (stripped.startsWith('9') && stripped.length === 10) {
    stripped = `0${stripped}`;
    autoNormalized = true;
  }

  if (!/^09\d{9}$/.test(stripped)) {
    return {
      valid: false,
      normalized: stripped,
      autoNormalized,
      errorFa: 'قالب شماره موبایل ایران معتبر نیست (باید ۱۱ رقم و با ۰۹ شروع شود).',
    };
  }

  return {
    valid: true,
    normalized: stripped,
    autoNormalized,
    warningFa: autoNormalized
      ? 'قالب شماره موبایل به‌صورت خودکار به فرمت استاندارد ۱۱ رقمی نرمال‌سازی شد.'
      : undefined,
  };
}

export interface JalaliValidationResult {
  valid: boolean;
  normalized: string;
  errorFa?: string;
}

/**
 * Validates and normalizes Jalali date string (supports 13xx/x/x, 14xx-xx-xx, Persian digits).
 */
export function normalizeJalaliDateInput(raw: string): JalaliValidationResult {
  const ascii = toAsciiDigits(raw).trim();
  if (!ascii) {
    return { valid: false, normalized: '', errorFa: 'تاریخ شمسی خالی است.' };
  }
  const unified = ascii.replace(/[-.\s]/g, '/').replace(/\/+/g, '/');
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(unified);
  if (!match) {
    return {
      valid: false,
      normalized: unified,
      errorFa: 'ساختار تاریخ شمسی معتبر نیست (نمونه صحیح: ۱۳۹۵/۰۴/۱۲).',
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1300 || year > 1450) {
    return {
      valid: false,
      normalized: unified,
      errorFa: 'سال تاریخ شمسی خارج از بازه معتبر (۱۳۰۰ تا ۱۴۵۰) است.',
    };
  }

  const formatted = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  if (!parseJalaliString(formatted)) {
    return {
      valid: false,
      normalized: formatted,
      errorFa: 'ماه یا روز تاریخ شمسی نامعتبر است.',
    };
  }

  return { valid: true, normalized: formatted };
}

export interface GradeScoreValidationResult {
  valid: boolean;
  numericValue: number | null;
  normalized: string;
  errorFa?: string;
}

/**
 * Validates numeric Persian/ASCII score within Iranian 0..20 scale.
 */
export function normalizeGradeScore(raw: string): GradeScoreValidationResult {
  const ascii = toAsciiDigits(raw)
    .replace(/٫|,/g, '.')
    .replace(/\s+/g, '')
    .trim();

  if (!ascii) {
    return {
      valid: false,
      numericValue: null,
      normalized: '',
      errorFa: 'مقدار نمره خالی است.',
    };
  }

  if (!/^-?\d+(\.\d+)?$/.test(ascii)) {
    return {
      valid: false,
      numericValue: null,
      normalized: ascii,
      errorFa: 'نمره باید مقدار عددی معتبر بین ۰ تا ۲۰ باشد.',
    };
  }

  const num = Number(ascii);
  if (!Number.isFinite(num) || num < 0 || num > 20) {
    return {
      valid: false,
      numericValue: null,
      normalized: ascii,
      errorFa: 'نمره خارج از بازه مجاز ۰ تا ۲۰ است.',
    };
  }

  const rounded = Math.round(num * 100) / 100;
  return {
    valid: true,
    numericValue: rounded,
    normalized: String(rounded),
  };
}

const COMPOUND_FIRST_NAME_PREFIXES = new Set([
  'سید',
  'سیده',
  'امیر',
  'محمد',
  'فاطمه',
  'زهرا',
  'علی',
  'عبد',
  'ابوالفضل',
]);

const COMPOUND_LAST_NAME_SUFFIXES = new Set([
  'زاده',
  'پور',
  'نژاد',
  'فر',
  'نیا',
  'راد',
  'مهر',
  'بخش',
  'لو',
  'تبار',
  'منش',
  'آذر',
  'آباد',
]);

/**
 * Splits a Persian combined full name into firstName and lastName intelligently.
 */
export function splitPersianFullName(rawFullName: string): {
  firstName: string;
  lastName: string;
} {
  const clean = normalizePersianText(rawFullName);
  if (!clean) return { firstName: '', lastName: '' };

  const tokens = clean.split(' ').filter(Boolean);
  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: '' };
  }
  if (tokens.length === 2) {
    return { firstName: tokens[0], lastName: tokens[1] };
  }

  // Handle compound surname suffixes like «رضایی پور» or «حسینی نژاد»
  if (COMPOUND_LAST_NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    return {
      firstName: tokens.slice(0, -2).join(' ') || tokens[0],
      lastName: tokens.slice(-2).join(' '),
    };
  }

  // Handle compound first names like «سید محمد رضایی» or «امیر علی کریمی»
  if (COMPOUND_FIRST_NAME_PREFIXES.has(tokens[0])) {
    return {
      firstName: tokens.slice(0, 2).join(' '),
      lastName: tokens.slice(2).join(' '),
    };
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(' '),
  };
}
