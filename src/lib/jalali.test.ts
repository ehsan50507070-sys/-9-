import test from 'node:test';
import assert from 'node:assert/strict';
import { toAsciiDigits, toPersianDigits } from './digits';
import {
  addDaysToJalali,
  getAcademicWeekNumber,
  getPersianWeekdayFromJalali,
  getWorkdayDatesForWeeks,
  gregorianToJalali,
  isJalaliLeapYear,
  jalaliToGregorian,
  parseJalaliString,
} from './jalali';
import { formatSingleColumnMessengerReport } from './messenger';
import { buildUtf8BomCsv, parseCsvText } from './csv';

test('toPersianDigits and toAsciiDigits roundtrip cleanly', () => {
  assert.equal(toPersianDigits('1405/08/29'), '۱۴۰۵/۰۸/۲۹');
  assert.equal(toAsciiDigits('۱۴۰۵/۰۸/۲۹'), '1405/08/29');
  assert.equal(toAsciiDigits('٠٩١٢٣٤٥٦٧٨٩'), '09123456789');
});

test('gregorianToJalali and jalaliToGregorian match verified calendar dates', () => {
  // 2026-03-21 is 1405/01/01 (Nowruz 1405)
  assert.deepEqual(gregorianToJalali(2026, 3, 21), { jy: 1405, jm: 1, jd: 1 });
  assert.deepEqual(jalaliToGregorian(1405, 1, 1), { gy: 2026, gm: 3, gd: 21 });

  // 2026-11-20 is 1405/08/29 (Friday -> Persian weekday 6)
  assert.deepEqual(gregorianToJalali(2026, 11, 20), { jy: 1405, jm: 8, jd: 29 });
  assert.equal(getPersianWeekdayFromJalali('1405/08/29'), 6);
});

test('Jalali leap year detection works for 1403 (leap) and 1405 (non-leap)', () => {
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(isJalaliLeapYear(1405), false);
  assert.notEqual(parseJalaliString('1403/12/30'), null);
  assert.equal(parseJalaliString('1405/12/30'), null);
});

test('getWorkdayDatesForWeeks generates exact workdays for 4-day default school week', () => {
  const days = getWorkdayDatesForWeeks('1405/08/29', [3, 4, 5, 6], 4);
  assert.equal(days.length, 16);
  assert.deepEqual(
    days.slice(0, 4).map((d) => d.weekday),
    [3, 4, 5, 6]
  );
  assert.equal(addDaysToJalali('1405/08/29', 1), '1405/08/30');
  assert.ok(getAcademicWeekNumber('1405/08/29') >= 9);
});

test('formatSingleColumnMessengerReport outputs Persian digits with no tabs or multi-column tables', () => {
  const msg = formatSingleColumnMessengerReport({
    schoolName: 'مدرسه شماره ۱',
    reportTitle: 'گزارش حضور',
    jalaliDateDisplay: '1405/08/29',
    sections: [{ heading: 'غایبین', lines: ['1. آراد احمدی'] }],
  });
  assert.ok(msg.includes('۱۴۰۵/۰۸/۲۹'));
  assert.ok(msg.includes('۱. آراد احمدی'));
  assert.equal(msg.includes('\t'), false);
});

test('buildUtf8BomCsv starts with UTF-8 BOM and parses back identically', () => {
  const csv = buildUtf8BomCsv(['نام', 'کلاس'], [['آراد احمدی', 'پایه دوم، الف']]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  const parsed = parseCsvText(csv);
  assert.deepEqual(parsed.headers, ['نام', 'کلاس']);
  assert.deepEqual(parsed.rows, [['آراد احمدی', 'پایه دوم، الف']]);
});
