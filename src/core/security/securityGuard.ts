// Layer-1 Security: Brute-Force Lockout Manager, Strict SecurityGuard & 30-Minute Idle Logout Hook
// Zero external dependencies.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toPersianDigits } from '../../lib/digits';
import type { AuthSession, CollectionName, UserRole } from '../../types/domain';
import { canRoleAccessRoute } from '../auth/rbac';
import { GLOBAL_TENANT_ID } from '../super-admin/superAdminHelpers';
import { normalizeUsernameInput } from './sanitize';

// ============================================================================
// 1. BRUTE-FORCE LOCKOUT TRACKER (5 failed attempts -> 15-minute lock)
// ============================================================================

const LOCKOUT_STORAGE_KEY = 'grr_login_lockout_v1';
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutRecord {
  attempts: number;
  lockedUntilMs: number | null;
  lastAttemptMs: number;
}

type LockoutMap = Record<string, LockoutRecord>;

function readLockoutMap(): LockoutMap {
  try {
    const raw = window.localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as LockoutMap) : {};
  } catch {
    return {};
  }
}

function writeLockoutMap(map: LockoutMap): void {
  try {
    window.localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingMs: number;
  remainingFormattedFa: string;
  failedAttempts: number;
  attemptsRemaining: number;
}

export function formatCountdownMmSsFa(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return toPersianDigits(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
}

export function getLoginLockoutStatus(username: string, nowMs = Date.now()): LockoutStatus {
  const key = normalizeUsernameInput(username).toLowerCase();
  if (!key) {
    return {
      isLocked: false,
      remainingMs: 0,
      remainingFormattedFa: '۰۰:۰۰',
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_LOGIN_ATTEMPTS,
    };
  }
  const map = readLockoutMap();
  const rec = map[key];
  if (!rec) {
    return {
      isLocked: false,
      remainingMs: 0,
      remainingFormattedFa: '۰۰:۰۰',
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_LOGIN_ATTEMPTS,
    };
  }
  if (rec.lockedUntilMs && rec.lockedUntilMs > nowMs) {
    const remainingMs = rec.lockedUntilMs - nowMs;
    return {
      isLocked: true,
      remainingMs,
      remainingFormattedFa: formatCountdownMmSsFa(remainingMs),
      failedAttempts: rec.attempts,
      attemptsRemaining: 0,
    };
  }
  // Lock expired -> reset
  if (rec.lockedUntilMs && rec.lockedUntilMs <= nowMs) {
    delete map[key];
    writeLockoutMap(map);
    return {
      isLocked: false,
      remainingMs: 0,
      remainingFormattedFa: '۰۰:۰۰',
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_LOGIN_ATTEMPTS,
    };
  }
  return {
    isLocked: false,
    remainingMs: 0,
    remainingFormattedFa: '۰۰:۰۰',
    failedAttempts: rec.attempts,
    attemptsRemaining: Math.max(0, MAX_FAILED_LOGIN_ATTEMPTS - rec.attempts),
  };
}

export function recordFailedLoginAttempt(
  username: string,
  nowMs = Date.now()
): { lockedNow: boolean; status: LockoutStatus } {
  const key = normalizeUsernameInput(username).toLowerCase();
  if (!key) {
    return { lockedNow: false, status: getLoginLockoutStatus('', nowMs) };
  }
  const map = readLockoutMap();
  const prev = map[key];
  const nextAttempts =
    prev && (!prev.lockedUntilMs || prev.lockedUntilMs <= nowMs) ? prev.attempts + 1 : 1;
  const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
  map[key] = {
    attempts: nextAttempts,
    lockedUntilMs: shouldLock ? nowMs + LOCKOUT_DURATION_MS : null,
    lastAttemptMs: nowMs,
  };
  writeLockoutMap(map);
  return {
    lockedNow: shouldLock,
    status: getLoginLockoutStatus(key, nowMs),
  };
}

export function clearFailedLoginAttempts(username: string): void {
  const key = normalizeUsernameInput(username).toLowerCase();
  if (!key) return;
  const map = readLockoutMap();
  if (map[key]) {
    delete map[key];
    writeLockoutMap(map);
  }
}

// ============================================================================
// 2. STRICT SECURITY GUARD (Route & Tenant Scope Enforcement)
// ============================================================================

const PUBLIC_GLOBAL_READ_COLLECTIONS = new Set<CollectionName>([
  'global_system_configs',
  'role_governance_configs',
  'educational_complexes',
  'academic_years',
  'schools',
]);

export interface TenantGuardDecision {
  allowed: boolean;
  reasonFa?: string;
}

/**
 * Enforces strict tenant isolation (schoolId / complexId) on repository reads.
 * Prevents users from accessing records of another school or complex by manipulating URLs or state.
 */
export function assertTenantReadAccess(
  session: AuthSession | null,
  collection: CollectionName,
  targetSchoolId: string
): TenantGuardDecision {
  if (!session) {
    // Before login, only public system configuration & login bootstrap collections may be read
    if (PUBLIC_GLOBAL_READ_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reasonFa: 'دسترسی غیرمجاز: نشست کاربری معتبر نیست.',
    };
  }

  if (session.role === 'super_admin' || session.role === 'complex_admin') {
    return { allowed: true };
  }

  if (targetSchoolId === GLOBAL_TENANT_ID || PUBLIC_GLOBAL_READ_COLLECTIONS.has(collection)) {
    return { allowed: true };
  }

  if (session.schoolId && session.schoolId !== targetSchoolId) {
    return {
      allowed: false,
      reasonFa: 'محدودیت امنیتی مدرسه: مشاهده اطلاعات واحد آموزشی دیگر مجاز نیست.',
    };
  }

  return { allowed: true };
}

/**
 * Checks whether a user role is permitted to access a route path.
 */
export function checkRouteSecurityGuard(
  activeRole: UserRole,
  allowedRoles: UserRole[]
): TenantGuardDecision {
  if (!canRoleAccessRoute(activeRole, allowedRoles)) {
    return {
      allowed: false,
      reasonFa: 'دسترسی به این صفحه برای نقش کاربری شما مجاز نیست.',
    };
  }
  return { allowed: true };
}

// ============================================================================
// 3. AUTOMATIC IDLE LOGOUT HOOK (30 minutes idle, 60-second warning countdown)
// ============================================================================

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const IDLE_WARNING_WINDOW_MS = 60 * 1000; // 60 seconds before logout

export interface UseIdleLogoutResult {
  showWarning: boolean;
  secondsRemaining: number;
  stayActive: () => void;
}

export function useIdleLogout(
  enabled: boolean,
  onTimeout: () => void
): UseIdleLogoutResult {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());
  const warningActiveRef = useRef<boolean>(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningActiveRef.current = false;
    setShowWarning(false);
    setSecondsRemaining(60);
  }, []);

  useEffect(() => {
    if (!enabled) {
      warningActiveRef.current = false;
      setShowWarning(false);
      setSecondsRemaining(60);
      return;
    }

    lastActivityRef.current = Date.now();

    const handleUserActivity = () => {
      // Once the 60s warning modal is visible, require explicit "ادامه فعالیت" click
      if (!warningActiveRef.current) {
        lastActivityRef.current = Date.now();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
      'mousemove',
    ];
    for (const ev of events) {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = IDLE_TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        warningActiveRef.current = false;
        setShowWarning(false);
        onTimeoutRef.current();
        return;
      }

      if (remaining <= IDLE_WARNING_WINDOW_MS) {
        warningActiveRef.current = true;
        setShowWarning(true);
        setSecondsRemaining(Math.max(1, Math.ceil(remaining / 1000)));
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      for (const ev of events) {
        window.removeEventListener(ev, handleUserActivity);
      }
    };
  }, [enabled]);

  return { showWarning, secondsRemaining, stayActive };
}
