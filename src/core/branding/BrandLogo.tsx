// Official Branding Module: سامانه هوشمند مدارس گلستان راه روشن
// Provides default geometric SVG logo, SystemBrandLogo slot, and dynamic Favicon + <title> updater.
import React from 'react';
import { sanitizeUrl } from '../security/sanitize';

export const OFFICIAL_SYSTEM_NAME_FA = 'سامانه هوشمند مدارس گلستان راه روشن';
export const OFFICIAL_SYSTEM_SHORT_NAME_FA = 'گلستان راه روشن';
export const OFFICIAL_COMPLEX_NAME_FA = 'مجموعه مدارس گلستان راه روشن';

export const OFFICIAL_SCHOOL_NAMES = {
  school1: 'دبستان گلستان راه روشن',
  school2: 'متوسطه اول گلستان راه روشن',
  school3: 'متوسطه دوم گلستان راه روشن',
} as const;

/**
 * Clean minimal geometric default logo SVG (slate-navy & muted gold) as a data URI for favicon & print fallback.
 */
export const DEFAULT_BRAND_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="grrNavy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A5F"/>
      <stop offset="100%" stop-color="#2B5B84"/>
    </linearGradient>
    <linearGradient id="grrGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#B8922E"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#grrNavy)"/>
  <rect x="6" y="6" width="52" height="52" rx="12" fill="none" stroke="url(#grrGold)" stroke-opacity="0.55" stroke-width="1.4"/>
  <path d="M32 13 L47 21.5 L32 30 L17 21.5 Z" fill="url(#grrGold)"/>
  <path d="M21 26.5 V37.5 C21 41.5 26 44.5 32 44.5 C38 44.5 43 41.5 43 37.5 V26.5 L32 32.8 Z" fill="#F8FAFC" fill-opacity="0.94"/>
  <path d="M32 32.8 V49.5" stroke="url(#grrGold)" stroke-width="2.1" stroke-linecap="round"/>
  <circle cx="32" cy="51.5" r="2.2" fill="url(#grrGold)"/>
</svg>`;

export const DEFAULT_BRAND_LOGO_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEFAULT_BRAND_SVG_RAW)}`;

export interface SystemBrandLogoProps {
  logoDataUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<NonNullable<SystemBrandLogoProps['size']>, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
  xl: 'w-16 h-16 rounded-2xl',
};

export const SystemBrandLogo: React.FC<SystemBrandLogoProps> = ({
  logoDataUrl,
  size = 'sm',
  className = '',
  alt = OFFICIAL_SYSTEM_NAME_FA,
}) => {
  const safeCustomUrl = sanitizeUrl(logoDataUrl);
  const sizeClass = SIZE_CLASSES[size];

  if (safeCustomUrl) {
    return (
      <div
        className={`${sizeClass} shrink-0 overflow-hidden border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-xs flex items-center justify-center ${className}`}
      >
        <img
          src={safeCustomUrl}
          alt={alt}
          className="w-full h-full object-contain p-0.5"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden shadow-xs flex items-center justify-center ${className}`}
      aria-label={alt}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        className="w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="grrBrandNavy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="100%" stopColor="#2B5B84" />
          </linearGradient>
          <linearGradient id="grrBrandGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B8922E" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#grrBrandNavy)" />
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="12"
          fill="none"
          stroke="url(#grrBrandGold)"
          strokeOpacity="0.55"
          strokeWidth="1.4"
        />
        <path d="M32 13 L47 21.5 L32 30 L17 21.5 Z" fill="url(#grrBrandGold)" />
        <path
          d="M21 26.5 V37.5 C21 41.5 26 44.5 32 44.5 C38 44.5 43 41.5 43 37.5 V26.5 L32 32.8 Z"
          fill="#F8FAFC"
          fillOpacity="0.94"
        />
        <path
          d="M32 32.8 V49.5"
          stroke="url(#grrBrandGold)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <circle cx="32" cy="51.5" r="2.2" fill="url(#grrBrandGold)" />
      </svg>
    </div>
  );
};

/**
 * Dynamically updates browser <link rel="icon"> and document.title with the system's active logo & title.
 */
export function syncBrowserFaviconAndTitle(
  logoDataUrl?: string | null,
  pageTitle?: string
): void {
  if (typeof document === 'undefined') return;

  const targetTitle = pageTitle?.trim() || OFFICIAL_SYSTEM_NAME_FA;
  if (document.title !== targetTitle) {
    document.title = targetTitle;
  }

  const safeCustom = sanitizeUrl(logoDataUrl);
  const href = safeCustom || DEFAULT_BRAND_LOGO_DATA_URL;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.type = safeCustom ? 'image/png' : 'image/svg+xml';
    link.href = href;
  }
}
