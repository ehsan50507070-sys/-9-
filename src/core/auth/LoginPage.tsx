// Unified Official Login Page — سامانه هوشمند مدارس گلستان راه روشن
// Closed System (zero public signup, zero demo lists, zero exposed passwords) + SVG Captcha + Brute-Force Lockout
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LogIn,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { OFFICIAL_SYSTEM_NAME_FA, SystemBrandLogo } from '../branding/BrandLogo';
import { useSchoolData } from '../data/DataContext';
import { captchaService, type CaptchaChallenge } from '../security/captchaService';
import { containsPersianLetters, normalizeUsernameInput } from '../security/sanitize';
import { getLoginLockoutStatus, type LockoutStatus } from '../security/securityGuard';
import { useLabelContext } from '../super-admin/LabelContext';
import { getLoginBgPreset } from '../super-admin/superAdminHelpers';
import { LOGIN_ROLE_GROUPS, type LoginRoleGroup } from './authService';

const ROLE_ICONS: Record<LoginRoleGroup, React.FC<{ className?: string }>> = {
  management: ShieldCheck,
  teacher: UserCheck,
  student: GraduationCap,
  parent: Users,
};

export const LoginPage: React.FC = () => {
  const { login, globalSystemConfig } = useSchoolData();
  const { getLabel } = useLabelContext();

  const [roleGroup, setRoleGroup] = useState<LoginRoleGroup>('management');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge | null>(null);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaSecondsLeft, setCaptchaSecondsLeft] = useState(120);
  const [usernameHintError, setUsernameHintError] = useState<string | null>(null);
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [lockout, setLockout] = useState<LockoutStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const siteName = getLabel('site.name', OFFICIAL_SYSTEM_NAME_FA);
  const siteSubtitle = getLabel(
    'site.subtitle',
    'پلتفرم یکپارچه مدیریت آموزشی و پرورشی مجموعه مدارس گلستان راه روشن'
  );
  const siteFooter = getLabel(
    'site.footer',
    `${OFFICIAL_SYSTEM_NAME_FA} — دسترسی اختصاصی کادر، معلمان، دانش‌آموزان و اولیا`
  );

  const loginBg = globalSystemConfig.loginBackground;
  const activePreset = getLoginBgPreset(loginBg.presetId);
  const effectiveLogo =
    globalSystemConfig.systemLogoDataUrl || loginBg.loginLogoDataUrl || undefined;

  const refreshCaptcha = useCallback(async () => {
    const next = await captchaService.requestChallenge();
    setCaptchaChallenge(next);
    setCaptchaInput('');
    setCaptchaSecondsLeft(next.ttlSeconds);
  }, []);

  useEffect(() => {
    void refreshCaptcha();
  }, [refreshCaptcha]);

  // Live 1-second timer for captcha TTL & active brute-force lockout countdown
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (captchaChallenge) {
        const left = Math.max(0, Math.ceil((captchaChallenge.expiresAtMs - Date.now()) / 1000));
        setCaptchaSecondsLeft(left);
      }
      if (username.trim()) {
        const st = getLoginLockoutStatus(username);
        setLockout(st.isLocked ? st : null);
      } else {
        setLockout(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [captchaChallenge, username]);

  const handleUsernameChange = (raw: string) => {
    if (containsPersianLetters(raw)) {
      setUsernameHintError('ورود حروف فارسی در نام کاربری مجاز نیست. از اعداد انگلیسی یا حروف لاتین استفاده کنید.');
      return;
    }
    setUsernameHintError(null);
    const normalized = normalizeUsernameInput(raw);
    setUsername(normalized);
    if (normalized) {
      const st = getLoginLockoutStatus(normalized);
      setLockout(st.isLocked ? st : null);
    } else {
      setLockout(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFa(null);

    if (lockout?.isLocked) {
      setErrorFa(
        `ورود برای این نام کاربری تا پایان شمارش معکوس (${lockout.remainingFormattedFa}) مسدود است.`
      );
      return;
    }

    if (!captchaChallenge) {
      await refreshCaptcha();
      setErrorFa('لطفاً کد امنیتی جدید را وارد نمایید.');
      return;
    }

    setSubmitting(true);
    try {
      const captchaRes = await captchaService.verifyChallenge(
        captchaChallenge.challengeId,
        captchaInput
      );
      if (!captchaRes.valid) {
        setErrorFa(captchaRes.errorFa ?? 'کد امنیتی نامعتبر است.');
        await refreshCaptcha();
        return;
      }

      const res = await login({
        roleGroup,
        username,
        password,
      });

      if (!res.ok) {
        setErrorFa(res.errorFa ?? 'نام کاربری یا رمز عبور نادرست است.');
        if (res.lockoutStatus?.isLocked) {
          setLockout(res.lockoutStatus);
        }
        await refreshCaptcha();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isCustomImage = loginBg.mode === 'custom_image' && Boolean(loginBg.customImageDataUrl);
  const bgLayerStyle: React.CSSProperties = isCustomImage
    ? {
        backgroundImage: `url("${loginBg.customImageDataUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: loginBg.blurPx > 0 ? `blur(${loginBg.blurPx}px)` : undefined,
        transform: loginBg.blurPx > 0 ? 'scale(1.04)' : undefined,
      }
    : {
        backgroundImage: activePreset.cssBackground,
      };

  const overlayColor =
    loginBg.overlayTone === 'dark'
      ? `rgba(15, 23, 42, ${Math.min(0.8, Math.max(0, loginBg.overlayOpacity / 100))})`
      : `rgba(248, 250, 252, ${Math.min(0.8, Math.max(0, loginBg.overlayOpacity / 100))})`;

  const isDarkSurface = loginBg.overlayTone === 'dark' && (isCustomImage || activePreset.defaultOverlayTone === 'dark');

  return (
    <div
      dir="rtl"
      className="relative min-h-screen w-full overflow-x-hidden flex flex-col items-center justify-center px-4 py-8 sm:py-12"
    >
      {/* Background Layer */}
      <div className="fixed inset-0 -z-20" style={bgLayerStyle} />
      <div className="fixed inset-0 -z-10" style={{ backgroundColor: overlayColor }} />

      <div className="w-full max-w-md space-y-5">
        {/* Official Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="flex justify-center">
            <SystemBrandLogo logoDataUrl={effectiveLogo} size="xl" />
          </div>
          <h1
            className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
              isDarkSurface ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}
          >
            {siteName}
          </h1>
          <p
            className={`text-xs sm:text-sm leading-6 ${
              isDarkSurface ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {siteSubtitle}
          </p>
        </div>

        {/* Official Login Card */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-5 sm:p-7 shadow-xl backdrop-blur-sm space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              انتخاب نقش کاربری
            </label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نقش کاربری">
              {LOGIN_ROLE_GROUPS.map((grp) => {
                const Icon = ROLE_ICONS[grp.id];
                const active = roleGroup === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setRoleGroup(grp.id);
                      setErrorFa(null);
                    }}
                    className={`min-h-[48px] flex items-center gap-2 rounded-xl border px-3 py-2 text-right transition-all duration-150 ${
                      active
                        ? 'border-[#2B5B84] bg-[#2B5B84]/10 text-[#1E3A5F] dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-[#2B5B84] dark:text-sky-300' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-xs font-bold leading-tight">{grp.labelFa}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Non-Persian Username Input */}
            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                نام کاربری (شماره موبایل، کد ملی یا شناسه کاربری)
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="login-username"
                  type="text"
                  dir="ltr"
                  inputMode="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="0912xxxxxxx"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#2B5B84] focus:outline-none focus:ring-2 focus:ring-[#2B5B84]/20"
                />
              </div>
              {usernameHintError && (
                <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {usernameHintError}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                رمز عبور
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-10 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#2B5B84] focus:outline-none focus:ring-2 focus:ring-[#2B5B84]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="نمایش یا مخفی‌سازی رمز عبور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Custom Noisy SVG Captcha (Server-Ready ICaptchaService) */}
            <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-captcha"
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-[#2B5B84] dark:text-sky-400" />
                  <span>کد امنیتی تصویری</span>
                </label>
                <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {captchaSecondsLeft > 0
                    ? `اعتبار: ${toPersianDigits(captchaSecondsLeft)} ثانیه`
                    : 'منقضی شد — بازنشانی کنید'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center min-h-[52px]">
                  {captchaChallenge ? (
                    <img
                      src={captchaChallenge.svgDataUrl}
                      alt="کد امنیتی تصویری"
                      className="h-[52px] w-auto select-none"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-xs text-slate-400">در حال بارگذاری...</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCaptcha()}
                  title="دریافت کد امنیتی جدید"
                  aria-label="دریافت کد امنیتی جدید"
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <input
                id="login-captcha"
                type="text"
                dir="ltr"
                required
                maxLength={6}
                autoComplete="off"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(normalizeUsernameInput(e.target.value).toUpperCase())}
                placeholder="کد ۵ کاراکتری تصویر را وارد کنید"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-center text-sm font-mono tracking-widest uppercase text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans focus:border-[#2B5B84] focus:outline-none focus:ring-2 focus:ring-[#2B5B84]/20"
              />
            </div>

            {/* Active Lockout Countdown Banner */}
            {lockout?.isLocked && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-3 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
              >
                <span>حساب به دلیل تلاش‌های ناموفق قفل شد</span>
                <span className="rounded-lg bg-amber-200/70 dark:bg-amber-900/60 px-2.5 py-1 font-mono tabular-nums">
                  {lockout.remainingFormattedFa}
                </span>
              </div>
            )}

            {/* Error Alert */}
            {errorFa && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorFa}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || Boolean(lockout?.isLocked)}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl brand-btn px-4 py-3 text-sm font-bold shadow-sm transition-all duration-150 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{submitting ? 'در حال احراز هویت...' : 'ورود به سامانه'}</span>
            </button>
          </form>

          {/* Closed System Notice (Zero Public Registration) */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 text-center text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            ثبت‌نام عمومی در این سامانه غیرفعال است. صدور و بازیابی حساب کاربری صرفاً توسط مدیریت
            مدرسه انجام می‌شود.
          </div>
        </div>

        <p
          className={`text-center text-[11px] leading-5 ${
            isDarkSurface ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {siteFooter}
        </p>
      </div>
    </div>
  );
};
