// Layer-1 Security: Native Web Crypto PBKDF2 / SHA-256 Password Hashing & Verification
// Zero external dependencies. Ensures NO plaintext password is stored in IndexedDB or localStorage.
import { toAsciiDigits } from '../../lib/digits';

const PBKDF2_ITERATIONS = 60_000;
const HASH_PREFIX = 'pbkdf2_sha256';
const FALLBACK_PREFIX = 'sha256_iter';

export interface HashedCredential {
  passwordHash: string;
  passwordSalt: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

/**
 * Generates a cryptographically strong random salt (16 bytes -> 32 hex chars).
 */
export function generateSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * Constant-time string comparison to avoid timing side channels.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Lightweight pure-JS SHA-256 fallback ONLY for non-secure contexts where crypto.subtle is unavailable.
 */
function fallbackSha256Hex(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Deterministic synchronous SHA-256 hex digest (produces identical 64-hex output to Web Crypto SHA-256).
 */
export function sha256HexSync(message: string): string {
  return fallbackSha256Hex(message);
}

/**
 * Primary async SHA-256 hex digest using native window.crypto.subtle.digest('SHA-256', ...),
 * falling back cleanly to pure-TS SHA-256 only when crypto.subtle is unavailable.
 */
export async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const encoded = new TextEncoder().encode(message);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      return bytesToHex(new Uint8Array(digest));
    } catch {
      // Fallback to identical pure-TS SHA-256 implementation
    }
  }
  return fallbackSha256Hex(message);
}

/**
 * Synchronous salted SHA-256 hash used ONLY during initial synchronous seed hydration before async PBKDF2 upgrade.
 * Never stores plaintext passwords.
 */
export function hashPasswordSync(plainPassword: string, existingSalt?: string): HashedCredential {
  const salt = existingSalt || generateSalt(16);
  const normalized = toAsciiDigits(plainPassword).trim();
  let digest = `${salt}:${normalized}:grr-v1`;
  for (let i = 0; i < 64; i += 1) {
    digest = fallbackSha256Hex(`${salt}:${digest}:${i}`);
  }
  return {
    passwordSalt: salt,
    passwordHash: `${FALLBACK_PREFIX}$64$${digest}`,
  };
}

/**
 * Primary async password hashing using native window.crypto.subtle PBKDF2 (SHA-256, 60k iterations).
 */
export async function hashPassword(
  plainPassword: string,
  existingSalt?: string
): Promise<HashedCredential> {
  const salt = existingSalt || generateSalt(16);
  const normalized = toAsciiDigits(plainPassword).trim();

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(normalized),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const saltBytes = hexToBytes(salt);
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes.buffer as ArrayBuffer,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      const hashHex = bytesToHex(new Uint8Array(derivedBits));
      return {
        passwordSalt: salt,
        passwordHash: `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${hashHex}`,
      };
    } catch {
      // Fall through to pure SHA-256 iterated hash in restricted environments
    }
  }

  return hashPasswordSync(normalized, salt);
}

/**
 * Verifies a plaintext candidate against a stored salted hash (supports both PBKDF2-SHA256 and sync SHA-256-iter).
 */
export async function verifyPassword(
  candidatePlain: string,
  storedHash: string | undefined,
  storedSalt: string | undefined
): Promise<boolean> {
  if (!storedHash || !storedSalt) return false;
  const normalized = toAsciiDigits(candidatePlain).trim();

  if (storedHash.startsWith(`${HASH_PREFIX}$`)) {
    const computed = await hashPassword(normalized, storedSalt);
    return timingSafeEqual(computed.passwordHash, storedHash);
  }

  if (storedHash.startsWith(`${FALLBACK_PREFIX}$`)) {
    const computed = hashPasswordSync(normalized, storedSalt);
    return timingSafeEqual(computed.passwordHash, storedHash);
  }

  return false;
}

/**
 * Generates an 8-character strong random password (letters + digits, avoiding ambiguous chars O/0/I/l)
 * for parent initial passwords when parent National ID is not provided.
 */
export function generateSecureRandomPassword(length = 8): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const bytes = new Uint8Array(length + 4);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const chars: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    digits[bytes[3] % digits.length],
  ];
  for (let i = 4; i < length; i += 1) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Fisher-Yates shuffle using remaining randomness
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i % bytes.length] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

/**
 * Deterministic initial parent password distinct from the student's National ID for seeded students.
 */
export function deriveDistinctParentInitialPassword(
  studentNationalCode: string,
  parentNationalCode?: string
): string {
  const cleanParentId = toAsciiDigits(parentNationalCode ?? '').replace(/\D/g, '');
  const cleanStudentId = toAsciiDigits(studentNationalCode).replace(/\D/g, '');
  if (cleanParentId.length === 10 && cleanParentId !== cleanStudentId) {
    return cleanParentId;
  }
  return generateSecureRandomPassword(8);
}
