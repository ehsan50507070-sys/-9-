// Layer-1 Security: XSS Sanitization, Non-Persian Username Validation, Strong Password Policy & UUID helper
// Zero external dependencies — pure TypeScript (strict: true).
import { toAsciiDigits } from '../../lib/digits';

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

const DANGEROUS_TAG_REGEX =
  /<\s*(script|iframe|object|embed|style|link|meta|base|svg|math|form|input|button|textarea)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const ANY_HTML_TAG_REGEX = /<\/?[a-zA-Z][^>]*>/g;
const EVENT_HANDLER_REGEX = /\bon[a-z]+\s*=/gi;
const JS_PROTO_REGEX = /\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;
// Persian/Arabic letters block (excluding digits which we normalize via toAsciiDigits)
const PERSIAN_ARABIC_LETTER_REGEX = /[\u0600-\u065F\u066A-\u06EF\u06FA-\u06FF\u200C\u200D]/;
const ALLOWED_USERNAME_REGEX = /^[A-Za-z0-9._@-]{3,40}$/;

/**
 * Strips dangerous HTML/script tags, inline event handlers, and control chars from user text.
 * Intended for storing and rendering safe plain-text user input (chat, notes, homework, forms, names).
 */
export function sanitizeText(input: string | null | undefined, maxLength = 4000): string {
  if (typeof input !== 'string') return '';
  let clean = input.replace(/\0/g, '');
  clean = clean.replace(DANGEROUS_TAG_REGEX, '');
  clean = clean.replace(ANY_HTML_TAG_REGEX, '');
  clean = clean.replace(EVENT_HANDLER_REGEX, '');
  clean = clean.replace(JS_PROTO_REGEX, '');
  clean = clean.replace(/[<>]/g, '');
  clean = clean.trim();
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean;
}

/**
 * Escapes HTML metacharacters for safe interpolation inside print HTML templates.
 */
export function escapeHtml(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[&<>"'`]/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

/**
 * Validates and sanitizes URLs. Allows only http:, https:, or safe data:image/* (never SVG scripts) and relative paths.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Allow safe image data URLs (png/jpeg/webp/gif) uploaded by admin
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Allow safe relative URLs starting with /
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }

  return '';
}

/**
 * Normalizes Persian/Arabic digits in a username to ASCII digits and detects Persian letters.
 */
export function normalizeUsernameInput(raw: string): string {
  return toAsciiDigits(raw).trim();
}

export function containsPersianLetters(raw: string): boolean {
  return PERSIAN_ARABIC_LETTER_REGEX.test(raw);
}

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string;
  errorFa?: string;
}

/**
 * Enforces non-Persian usernames (English letters, digits, dot, underscore, dash, @).
 * Automatically converts Persian numerals to ASCII digits while strictly rejecting Persian letters.
 */
export function validateNonPersianUsername(raw: string): UsernameValidationResult {
  const converted = normalizeUsernameInput(raw);
  if (!converted) {
    return {
      valid: false,
      normalized: '',
      errorFa: 'نام کاربری نمی‌تواند خالی باشد.',
    };
  }
  if (containsPersianLetters(converted)) {
    return {
      valid: false,
      normalized: converted,
      errorFa: 'نام کاربری نباید شامل حروف فارسی باشد. لطفاً از اعداد انگلیسی (شماره موبایل یا کد ملی) یا حروف لاتین استفاده کنید.',
    };
  }
  if (!ALLOWED_USERNAME_REGEX.test(converted)) {
    return {
      valid: false,
      normalized: converted,
      errorFa: 'نام کاربری باید بین ۳ تا ۴۰ کاراکتر و فقط شامل حروف انگلیسی، اعداد یا کاراکترهای . _ - @ باشد.',
    };
  }
  return { valid: true, normalized: converted };
}

export interface PasswordStrengthResult {
  valid: boolean;
  errorFa?: string;
  score: 1 | 2 | 3;
}

/**
 * Enforces strong password policy: >= 8 chars, containing both letters and digits.
 */
export function validateStrongPassword(raw: string): PasswordStrengthResult {
  const pwd = toAsciiDigits(raw);
  if (pwd.length < 8) {
    return {
      valid: false,
      score: 1,
      errorFa: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
    };
  }
  const hasLetter = /[A-Za-z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  if (!hasLetter || !hasDigit) {
    return {
      valid: false,
      score: 1,
      errorFa: 'رمز عبور باید ترکیبی از حروف انگلیسی و اعداد باشد.',
    };
  }
  const hasUpperAndLower = /[A-Z]/.test(pwd) && /[a-z]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const score: 1 | 2 | 3 = pwd.length >= 10 && (hasUpperAndLower || hasSymbol) ? 3 : 2;
  return { valid: true, score };
}

/**
 * Generates an RFC 4122 v4 UUID using native Web Crypto API with safe fallback.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
