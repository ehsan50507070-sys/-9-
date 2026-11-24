import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSeedDataset } from '../core/data/seedData';
import { toPersianDigits } from './digits';
import {
  fuzzyMatchScore,
  fuzzyNumericMatchScore,
  normalizePersianForSearch,
  runSmartFuzzySearch,
} from './fuzzySearch';

test('normalizePersianForSearch unifies Arabic/Persian letters, digits, ZWNJ, and diacritics', () => {
  assert.equal(normalizePersianForSearch('علـي كَريمي'), 'علی کریمی');
  assert.equal(normalizePersianForSearch('آراد‌رضایی'), 'اراد رضایی');
  assert.equal(normalizePersianForSearch('۰۴۹۱۲۳۴۵۶۷'), '0491234567');
  assert.equal(normalizePersianForSearch('پایهٔ ششم - کلاس الف'), 'پایه ششم کلاس الف');
});

test('fuzzyMatchScore handles exact, prefix, subsequence, and Persian typo tolerance', () => {
  assert.equal(fuzzyMatchScore('زهرا محمدی', 'زهرا محمدی'), 100);
  assert.ok(fuzzyMatchScore('زهزا', 'زهرا کریمی') >= 65, '1-char typo in Persian name should match');
  assert.ok(fuzzyMatchScore('امیرغلی', 'امیرعلی رضایی') >= 65, '1-char typo in compound name should match');
  assert.ok(fuzzyMatchScore('اراد رض', 'آراد رضایی') >= 55, 'Subsequence / multi-token prefix should match');
  assert.ok(fuzzyMatchScore('پابه ششم', 'پایه ششم - کلاس الف') >= 65, 'Typo in class grade should match');
  assert.equal(fuzzyMatchScore('کیانوش', 'زهرا محمدی'), 0, 'Unrelated name should return 0');
});

test('fuzzyNumericMatchScore handles Persian/ASCII digits, partial match, and 1-digit National ID typo', () => {
  assert.equal(fuzzyNumericMatchScore('۰۴۹۱۲۳۴۵۶۷', '0491234567'), 100);
  assert.ok(fuzzyNumericMatchScore('04912', '0491234567') >= 90, 'Prefix match should score high');
  assert.ok(fuzzyNumericMatchScore('۱۲۳۴۵', '0491234567') >= 80, 'Persian substring match should score high');
  assert.ok(fuzzyNumericMatchScore('0491234597', '0491234567') >= 75, '1-digit typo in 10-digit National ID should match');
  assert.equal(fuzzyNumericMatchScore('9998887776', '0491234567'), 0, 'Unrelated National ID should return 0');
});

test('runSmartFuzzySearch searches across all 3 schools for students, National IDs, and classes', () => {
  const seed = generateSeedDataset();

  // 1. Cross-school class search («پایه ششم») returns hits from all 3 schools
  const gradeSixResults = runSmartFuzzySearch({
    query: 'پایه ششم',
    schools: seed.schools,
    students: seed.students,
    classes: seed.classes,
    teachers: seed.teachers,
    categoryFilter: 'class',
    schoolScope: 'all',
    limit: 20,
  });
  const matchedSchools = new Set(gradeSixResults.map((r) => r.schoolId));
  assert.ok(matchedSchools.has('school-1'), 'Should find Grade 6 class in School 1');
  assert.ok(matchedSchools.has('school-2'), 'Should find Grade 6 class in School 2');
  assert.ok(matchedSchools.has('school-3'), 'Should find Grade 6 class in School 3');

  // 2. Typo-tolerant search finds a School 2 student even when searching globally
  const school2Student = seed.students.find((s) => s.schoolId === 'school-2');
  assert.ok(school2Student, 'Seed should contain School 2 students');
  const firstWord = school2Student.fullName.split(' ')[0];
  // Introduce a deliberate 1-character typo on the last char of the first name
  const typoQuery = `${firstWord.slice(0, -1)}ظ`;
  const typoResults = runSmartFuzzySearch({
    query: typoQuery,
    schools: seed.schools,
    students: seed.students,
    classes: seed.classes,
    teachers: seed.teachers,
    categoryFilter: 'student',
    schoolScope: 'all',
    limit: 15,
  });
  assert.ok(
    typoResults.some((r) => r.studentId === school2Student.id),
    `Typo query "${typoQuery}" should match "${school2Student.fullName}"`
  );

  // 3. Persian-digit National ID search finds exact student from School 3
  const school3Student = seed.students.find((s) => s.schoolId === 'school-3');
  assert.ok(school3Student, 'Seed should contain School 3 students');
  const natIdResults = runSmartFuzzySearch({
    query: toPersianDigits(school3Student.nationalId),
    schools: seed.schools,
    students: seed.students,
    classes: seed.classes,
    teachers: seed.teachers,
    categoryFilter: 'national_id',
    schoolScope: 'all',
  });
  assert.ok(natIdResults.length >= 1, 'National ID search should return at least one result');
  assert.equal(natIdResults[0].studentId, school3Student.id);
  assert.equal(natIdResults[0].schoolId, 'school-3');
  assert.equal(natIdResults[0].matchedField, 'کد ملی');

  // 4. Single-school scope strictly isolates results to the chosen school
  const scopedResults = runSmartFuzzySearch({
    query: 'پایه',
    schools: seed.schools,
    students: seed.students,
    classes: seed.classes,
    teachers: seed.teachers,
    categoryFilter: 'class',
    schoolScope: 'school-1',
    limit: 20,
  });
  assert.ok(scopedResults.length > 0);
  assert.ok(
    scopedResults.every((r) => r.schoolId === 'school-1'),
    'Scoped search must never leak other schools'
  );
});
