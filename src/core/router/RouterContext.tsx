// Native Lightweight Multi-Page Router using Browser History API (pushState / replaceState / popstate)
// Zero external dependencies (no react-router-dom). Supports clean URLs, route aliases, Back/Forward, and PWA back button.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface RouterContextValue {
  path: string;
  canonicalPath: string;
  search: string;
  searchParams: URLSearchParams;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  goBack: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

// Route aliases mapping clean public URLs to canonical plugin/core routes
const ROUTE_ALIASES: Record<string, string> = {
  '/': '/dashboard',
  '/home': '/dashboard',
  '/exams': '/exams-management',
  '/attendance': '/student-attendance',
  '/chat': '/class-chat',
  '/addons': '/plugins',
  '/my-subjects': '/subjects',
  '/archive': '/smart-archive',
  '/data-vault': '/data-health-migration',
  '/vault': '/data-health-migration',
  '/data-health': '/data-health-migration',
  '/trash': '/recycle-bin',
  '/audit-logs': '/security-logs',
  '/smart-import': '/smart-import-wizard',
  '/import-wizard': '/smart-import-wizard',
  '/exit-pass': '/leave-exit',
  '/leave': '/leave-exit',
  '/counselor': '/counseling',
  '/virtual-class': '/virtual-classes',
};

export function normalizeRoutePath(raw: string): string {
  const cleaned = raw.split('?')[0].split('#')[0].trim();
  if (!cleaned || cleaned === '/') return '/dashboard';
  const withSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  const trimmed = withSlash.length > 1 && withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
  return ROUTE_ALIASES[trimmed] ?? trimmed;
}

export function extractQueryString(raw: string): string {
  const withoutHash = raw.split('#')[0];
  const qIndex = withoutHash.indexOf('?');
  return qIndex >= 0 ? withoutHash.slice(qIndex) : '';
}

function readInitialLocation(): { path: string; search: string } {
  if (typeof window === 'undefined') return { path: '/dashboard', search: '' };
  // Support migrating any legacy hash URLs seamlessly into clean History paths
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const rawHash = window.location.hash.slice(1);
    const fromHash = normalizeRoutePath(rawHash);
    const search = extractQueryString(rawHash);
    try {
      window.history.replaceState({ path: fromHash, search }, '', `${fromHash}${search}`);
    } catch {
      // Ignore if sandboxed iframe restricts replaceState
    }
    return { path: fromHash, search };
  }
  return {
    path: normalizeRoutePath(window.location.pathname || '/dashboard'),
    search: window.location.search || '',
  };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locationState, setLocationState] = useState<{ path: string; search: string }>(
    readInitialLocation
  );

  useEffect(() => {
    const onPopState = () => {
      setLocationState({
        path: normalizeRoutePath(window.location.pathname || '/dashboard'),
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const normalized = normalizeRoutePath(to);
    const search = extractQueryString(to);
    const fullUrl = `${normalized}${search}`;

    setLocationState((prev) => {
      if (
        prev.path === normalized &&
        prev.search === search &&
        typeof window !== 'undefined' &&
        window.location.pathname === normalized &&
        window.location.search === search
      ) {
        return prev;
      }
      try {
        if (options?.replace) {
          window.history.replaceState({ path: normalized, search }, '', fullUrl);
        } else {
          window.history.pushState({ path: normalized, search }, '', fullUrl);
        }
      } catch {
        // Safe fallback inside restricted iframes where history.pushState may throw SecurityError
      }
      return { path: normalized, search };
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const searchParams = useMemo(
    () => new URLSearchParams(locationState.search),
    [locationState.search]
  );

  const value = useMemo<RouterContextValue>(
    () => ({
      path: locationState.path,
      canonicalPath: locationState.path,
      search: locationState.search,
      searchParams,
      navigate,
      goBack,
    }),
    [locationState.path, locationState.search, searchParams, navigate, goBack]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return ctx;
}
