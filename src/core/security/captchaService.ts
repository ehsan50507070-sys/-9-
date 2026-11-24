// Layer-1 Security: Server-Ready Captcha Service Interface (ICaptchaService) + Custom Noisy SVG Implementation
// Phase 10 backend can replace LocalSvgCaptchaService with a server-backed HTTP implementation without changing UI.
import { toAsciiDigits } from '../../lib/digits';
import { generateUUID } from './sanitize';

export interface CaptchaChallenge {
  challengeId: string;
  svgDataUrl: string;
  expiresAtMs: number;
  ttlSeconds: number;
}

export interface CaptchaVerificationResult {
  valid: boolean;
  expired?: boolean;
  errorFa?: string;
}

export interface ICaptchaService {
  requestChallenge(): Promise<CaptchaChallenge>;
  verifyChallenge(challengeId: string, userAnswer: string): Promise<CaptchaVerificationResult>;
}

const CAPTCHA_TTL_MS = 2 * 60 * 1000; // 2 minutes
// Clear numeric/uppercase alphabet without visually ambiguous O/0/I/1/L
const CAPTCHA_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

interface StoredChallenge {
  answer: string;
  expiresAtMs: number;
  used: boolean;
}

function randomInt(maxExclusive: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function buildNoisySvgDataUrl(code: string): string {
  const width = 176;
  const height = 52;
  const palette = ['#1E3A5F', '#334E68', '#0F4C81', '#2B5B84', '#1F2937'];

  // Background interference curves
  const noiseLines: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const x1 = randomInt(30);
    const y1 = 8 + randomInt(height - 16);
    const cx = 50 + randomInt(80);
    const cy = 6 + randomInt(height - 12);
    const x2 = width - randomInt(30);
    const y2 = 8 + randomInt(height - 16);
    const stroke = palette[i % palette.length];
    noiseLines.push(
      `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-opacity="0.22" stroke-width="${1 + (i % 2) * 0.5}" stroke-dasharray="${i % 2 === 0 ? '4 3' : 'none'}" />`
    );
  }

  // Subtle noise dots
  const noiseDots: string[] = [];
  for (let i = 0; i < 28; i += 1) {
    const cx = 6 + randomInt(width - 12);
    const cy = 6 + randomInt(height - 12);
    const r = 0.8 + (i % 3) * 0.45;
    noiseDots.push(
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#334E68" fill-opacity="0.22" />`
    );
  }

  // Rotated & jittered characters
  const charElements = code.split('').map((ch, idx) => {
    const x = 24 + idx * 31 + (randomInt(7) - 3);
    const y = 34 + (randomInt(9) - 4);
    const angle = randomInt(34) - 17;
    const fontSize = 23 + (randomInt(5) - 2);
    const fill = palette[randomInt(palette.length)];
    return `<text x="${x}" y="${y}" transform="rotate(${angle} ${x} ${y})" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${fontSize}" font-weight="800" fill="${fill}" letter-spacing="1">${ch}</text>`;
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F1F5F9"/><stop offset="100%" stop-color="#E2E8F0"/></linearGradient></defs>`,
    `<rect width="100%" height="100%" rx="10" fill="url(#cbg)"/>`,
    ...noiseLines,
    ...noiseDots,
    ...charElements,
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

class LocalSvgCaptchaService implements ICaptchaService {
  private readonly store = new Map<string, StoredChallenge>();

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.used || item.expiresAtMs <= now) {
        this.store.delete(key);
      }
    }
  }

  async requestChallenge(): Promise<CaptchaChallenge> {
    this.pruneExpired();
    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code += CAPTCHA_ALPHABET[randomInt(CAPTCHA_ALPHABET.length)];
    }
    const challengeId = generateUUID();
    const expiresAtMs = Date.now() + CAPTCHA_TTL_MS;
    this.store.set(challengeId, {
      answer: code,
      expiresAtMs,
      used: false,
    });
    return {
      challengeId,
      svgDataUrl: buildNoisySvgDataUrl(code),
      expiresAtMs,
      ttlSeconds: Math.round(CAPTCHA_TTL_MS / 1000),
    };
  }

  async verifyChallenge(
    challengeId: string,
    userAnswer: string
  ): Promise<CaptchaVerificationResult> {
    this.pruneExpired();
    const record = this.store.get(challengeId);
    if (!record) {
      return {
        valid: false,
        expired: true,
        errorFa: 'کد امنیتی منقضی شده است. لطفاً کد جدید دریافت کنید.',
      };
    }
    if (Date.now() > record.expiresAtMs) {
      this.store.delete(challengeId);
      return {
        valid: false,
        expired: true,
        errorFa: 'اعتبار کد امنیتی (۲ دقیقه) به پایان رسیده است. لطفاً کد را بازنشانی کنید.',
      };
    }
    const cleanInput = toAsciiDigits(userAnswer).trim().toUpperCase();
    if (!cleanInput) {
      return {
        valid: false,
        errorFa: 'لطفاً کد امنیتی نمایش‌داده‌شده در تصویر را وارد کنید.',
      };
    }
    if (cleanInput !== record.answer) {
      return {
        valid: false,
        errorFa: 'کد امنیتی واردشده صحیح نیست. لطفاً دوباره تلاش کنید.',
      };
    }
    record.used = true;
    this.store.delete(challengeId);
    return { valid: true };
  }
}

export const captchaService: ICaptchaService = new LocalSvgCaptchaService();
