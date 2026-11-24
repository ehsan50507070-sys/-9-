// Pure Native Jalali (Solar Hijri) Calendar Engine — zero external dependencies
import type { PersianWeekdayIndex } from '../types/domain';
import { toAsciiDigits, toPersianDigits } from './digits';

export interface JalaliDateParts {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDateParts {
  gy: number;
  gm: number;
  gd: number;
}

export const PERSIAN_MONTH_NAMES: readonly string[] = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const PERSIAN_WEEKDAY_NAMES: readonly string[] = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

export const PERSIAN_WEEKDAY_SHORT: readonly string[] = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج',
] as const;

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/**
 * Converts Gregorian date to Jalali (Solar Hijri) using standard Kazimierz Borkowski / JDN algorithm.
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateParts {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/**
 * Converts Jalali (Solar Hijri) date to Gregorian.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDateParts {
  let jyAdj = jy + 1595;
  let days =
    -355668 +
    365 * jyAdj +
    div(jyAdj, 33) * 8 +
    div((jyAdj % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const sal_a = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  while (gm <= 12 && gd > sal_a[gm]) {
    gd -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd };
}

export function isJalaliLeapYear(jy: number): boolean {
  const g1 = jalaliToGregorian(jy, 12, 29);
  const nextDay = new Date(Date.UTC(g1.gy, g1.gm - 1, g1.gd + 1));
  const jNext = gregorianToJalali(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate()
  );
  return jNext.jm === 12 && jNext.jd === 30;
}

export function getJalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function formatJalaliISO(parts: JalaliDateParts): string {
  const y = String(parts.jy).padStart(4, '0');
  const m = String(parts.jm).padStart(2, '0');
  const d = String(parts.jd).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function parseJalaliString(dateStr: string): JalaliDateParts | null {
  const normalized = toAsciiDigits(dateStr).trim();
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(normalized);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12) return null;
  const maxDay = getJalaliMonthLength(jy, jm);
  if (jd < 1 || jd > maxDay) return null;
  return { jy, jm, jd };
}

export function dateToJalaliString(date: Date): string {
  const parts = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return formatJalaliISO(parts);
}

export function jalaliStringToDate(jalaliStr: string): Date {
  const parts = parseJalaliString(jalaliStr);
  if (!parts) return new Date();
  const g = jalaliToGregorian(parts.jy, parts.jm, parts.jd);
  return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0, 0);
}

/**
 * Returns 0=شنبه .. 6=جمعه for a given JS Date.
 */
export function getPersianWeekdayIndex(date: Date): PersianWeekdayIndex {
  // JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const jsDay = date.getDay();
  return ((jsDay + 1) % 7) as PersianWeekdayIndex;
}

export function getPersianWeekdayFromJalali(jalaliStr: string): PersianWeekdayIndex {
  return getPersianWeekdayIndex(jalaliStringToDate(jalaliStr));
}

export function getPersianWeekdayName(index: PersianWeekdayIndex): string {
  return PERSIAN_WEEKDAY_NAMES[index];
}

export function addDaysToJalali(jalaliStr: string, offsetDays: number): string {
  const date = jalaliStringToDate(jalaliStr);
  date.setDate(date.getDate() + offsetDays);
  return dateToJalaliString(date);
}

export function formatJalaliDisplay(jalaliStr: string, includeWeekday = true): string {
  const parts = parseJalaliString(jalaliStr);
  if (!parts) return toPersianDigits(jalaliStr);
  const monthName = PERSIAN_MONTH_NAMES[parts.jm - 1] ?? '';
  const dateText = `${toPersianDigits(parts.jd)} ${monthName} ${toPersianDigits(parts.jy)}`;
  if (!includeWeekday) return dateText;
  const wd = getPersianWeekdayName(getPersianWeekdayFromJalali(jalaliStr));
  return `${wd}، ${dateText}`;
}

export function getTodayJalali(): string {
  return dateToJalaliString(new Date());
}

/**
 * Calculates academic week number starting from 1 Mehr (07/01) of the academic year.
 */
export function getAcademicWeekNumber(jalaliStr: string): number {
  const parts = parseJalaliString(jalaliStr);
  if (!parts) return 1;
  const startYear = parts.jm >= 7 ? parts.jy : parts.jy - 1;
  const startDate = jalaliStringToDate(`${startYear}/07/01`);
  const targetDate = jalaliStringToDate(jalaliStr);
  const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Returns the Saturday (start of Persian week) for a given Jalali date.
 */
export function getWeekStartJalali(jalaliStr: string): string {
  const weekday = getPersianWeekdayFromJalali(jalaliStr);
  return addDaysToJalali(jalaliStr, -weekday);
}

export interface WorkdayDateEntry {
  jalaliDate: string;
  weekday: PersianWeekdayIndex;
  weekdayName: string;
  isHoliday: boolean;
  weekIndex: number; // 0-based week offset
  academicWeek: number;
}

/**
 * Generates ordered workday dates for 1..N weeks starting from the week of anchorJalaliDate.
 */
export function getWorkdayDatesForWeeks(
  anchorJalaliDate: string,
  activeWorkdays: PersianWeekdayIndex[],
  weekCount: number,
  holidays: string[] = []
): WorkdayDateEntry[] {
  const sortedWorkdays = [...activeWorkdays].sort((a, b) => a - b);
  const weekStart = getWeekStartJalali(anchorJalaliDate);
  const holidaySet = new Set(holidays.map((h) => toAsciiDigits(h)));
  const entries: WorkdayDateEntry[] = [];

  for (let w = 0; w < weekCount; w++) {
    for (const wd of sortedWorkdays) {
      const jalaliDate = addDaysToJalali(weekStart, w * 7 + wd);
      entries.push({
        jalaliDate,
        weekday: wd,
        weekdayName: getPersianWeekdayName(wd),
        isHoliday: holidaySet.has(jalaliDate),
        weekIndex: w,
        academicWeek: getAcademicWeekNumber(jalaliDate),
      });
    }
  }

  return entries;
}

/**
 * Returns the most recent active workday on or before targetJalaliDate.
 */
export function getNearestActiveWorkday(
  targetJalaliDate: string,
  activeWorkdays: PersianWeekdayIndex[]
): string {
  if (activeWorkdays.length === 0) return targetJalaliDate;
  const set = new Set(activeWorkdays);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = addDaysToJalali(targetJalaliDate, -offset);
    if (set.has(getPersianWeekdayFromJalali(candidate))) {
      return candidate;
    }
  }
  return targetJalaliDate;
}
