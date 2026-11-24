import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVED_ACADEMIC_YEAR_ID,
  DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
  createAcademicYearRecord,
  generateSeedAcademicYears,
  normalizeAcademicYear,
  resolveDefaultAcademicYear,
  setActiveAcademicYearInList,
  toggleAcademicYearArchiveInList,
} from './academicYearHelpers';

test('seeded academic years contain archived 1403-1404 and active default 1404-1405 with Jalali end 06/31', () => {
  const years = generateSeedAcademicYears();
  assert.equal(years.length, 2);
  const archived = years.find((y) => y.id === ARCHIVED_ACADEMIC_YEAR_ID);
  const active = years.find((y) => y.id === DEFAULT_ACTIVE_ACADEMIC_YEAR_ID);
  assert.ok(archived);
  assert.ok(active);
  assert.equal(archived.code, '1403-1404');
  assert.equal(archived.startDateJalali, '1403/07/01');
  assert.equal(archived.endDateJalali, '1404/06/31');
  assert.equal(archived.status, 'archived');
  assert.equal(archived.isArchived, true);
  assert.equal(archived.isActive, false);
  assert.equal(archived.isDefault, false);

  assert.equal(active.code, '1404-1405');
  assert.equal(active.startDateJalali, '1404/07/01');
  assert.equal(active.endDateJalali, '1405/06/31');
  assert.equal(active.status, 'active');
  assert.equal(active.isActive, true);
  assert.equal(active.isDefault, true);
  assert.equal(active.isArchived, false);
  assert.equal(resolveDefaultAcademicYear(years)?.id, DEFAULT_ACTIVE_ACADEMIC_YEAR_ID);
});

test('creating 1405-1406 validates format, rejects duplicates, and supports activating on create', () => {
  const seed = generateSeedAcademicYears();

  const badFormat = createAcademicYearRecord(seed, {
    code: '1405',
    createdByUserId: 'admin-1',
  });
  assert.equal(badFormat.ok, false);

  const nonConsecutive = createAcademicYearRecord(seed, {
    code: '۱۴۰۵-۱۴۰۸',
    createdByUserId: 'admin-1',
  });
  assert.equal(nonConsecutive.ok, false);

  const dup = createAcademicYearRecord(seed, {
    code: '۱۴۰۴-۱۴۰۵',
    createdByUserId: 'admin-1',
  });
  assert.equal(dup.ok, false);

  const created = createAcademicYearRecord(seed, {
    code: '۱۴۰۵-۱۴۰۶',
    setAsActive: true,
    createdByUserId: 'admin-1',
  });
  assert.equal(created.ok, true);
  assert.equal(created.createdYear?.code, '1405-1406');
  assert.equal(created.createdYear?.status, 'active');
  assert.equal(created.createdYear?.isDefault, true);
  assert.equal(created.updatedList?.length, 3);
  assert.equal(created.updatedList?.filter((y) => y.isActive).length, 1);
  assert.equal(resolveDefaultAcademicYear(created.updatedList!)?.code, '1405-1406');
});

test('activating and archiving preserve historical years without deleting records', () => {
  const seed = generateSeedAcademicYears();
  const blockArchiveActive = toggleAcademicYearArchiveInList(
    seed,
    DEFAULT_ACTIVE_ACADEMIC_YEAR_ID,
    true
  );
  assert.equal(blockArchiveActive.ok, false);

  const unarchived = toggleAcademicYearArchiveInList(seed, ARCHIVED_ACADEMIC_YEAR_ID, false);
  assert.equal(unarchived.ok, true);
  assert.equal(
    unarchived.updatedList?.find((y) => y.id === ARCHIVED_ACADEMIC_YEAR_ID)?.status,
    'upcoming'
  );

  const switched = setActiveAcademicYearInList(unarchived.updatedList!, ARCHIVED_ACADEMIC_YEAR_ID);
  assert.equal(switched.find((y) => y.id === ARCHIVED_ACADEMIC_YEAR_ID)?.status, 'active');
  assert.equal(switched.find((y) => y.id === DEFAULT_ACTIVE_ACADEMIC_YEAR_ID)?.isActive, false);
});

test('normalizeAcademicYear cleanly upgrades legacy Phase 9A records', () => {
  const upgraded = normalizeAcademicYear({
    id: 'ay-1404-1405',
    label: '1404-1405',
    startJalali: '1404/07/01',
    endJalali: '1405/03/31',
    isActive: true,
    isArchived: false,
  });
  assert.equal(upgraded.code, '1404-1405');
  assert.equal(upgraded.status, 'active');
  assert.equal(upgraded.isDefault, true);
  assert.equal(upgraded.startDateJalali, '1404/07/01');
  assert.equal(upgraded.endDateJalali, '1405/03/31');
});
