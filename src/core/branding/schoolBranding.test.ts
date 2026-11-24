// Automated Tests for Per-School Logo & Print Letterhead Branding Isolation, Persistence & Governance
import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  PanicModeState,
  SchoolBrandingConfig,
  SecurityAuditLogEntry,
} from '../../types/domain';
import { authorizeMutation } from '../auth/policy';
import { LocalIndexedDBAdapter } from '../data/LocalIndexedDBAdapter';
import {
  DEFAULT_PANIC_MODE_STATE,
  sealAuditEntrySync,
  verifyAuditLogChain,
} from '../security/DataIntegrityGuard';
import { generateUUID } from '../security/sanitize';

test('SchoolBranding: LocalIndexedDBAdapter enforces unique schoolId key, UUID id, complexId, and timestamps', async () => {
  const repo = new LocalIndexedDBAdapter();
  const nowIso = new Date().toISOString();

  // Seed legacy key format first to verify automatic deduplication upon UUID upgrade
  const legacyEntry: SchoolBrandingConfig = {
    id: 'school-1:branding',
    complexId: 'complex-1',
    schoolId: 'school-1',
    schoolDisplayName: 'نام قدیمی',
    printSubtitle: 'زیرعنوان قدیمی',
    sectionLabels: { dashboard: 'پیشخوان' },
    updatedByName: 'مدیر مدرسه',
    updatedAt: nowIso,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
  await repo.putItem('school_branding_configs', legacyEntry);

  const uuidId = generateUUID();
  const upgradedEntry: SchoolBrandingConfig = {
    id: uuidId,
    complexId: 'complex-1',
    schoolId: 'school-1',
    schoolDisplayName: 'دبستان هوشمند گلستان',
    printSubtitle: 'سربرگ رسمی دوره ابتدایی',
    logoDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    sectionLabels: { dashboard: 'پیشخوان' },
    updatedByName: 'مدیر دبستان',
    updatedByRole: 'principal',
    updatedAt: nowIso,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
  await repo.putItem('school_branding_configs', upgradedEntry);

  // Add a completely separate school-2 branding record
  const school2Entry: SchoolBrandingConfig = {
    id: generateUUID(),
    complexId: 'complex-1',
    schoolId: 'school-2',
    schoolDisplayName: 'متوسطه اول راه روشن',
    printSubtitle: 'سربرگ رسمی متوسطه اول',
    sectionLabels: {},
    updatedByName: 'مدیر متوسطه اول',
    updatedByRole: 'principal',
    updatedAt: nowIso,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
  await repo.putItem('school_branding_configs', school2Entry);

  const s1Records = await repo.getBySchool('school_branding_configs', 'school-1');
  const s2Records = await repo.getBySchool('school_branding_configs', 'school-2');

  // Strictly 1 deduplicated record per schoolId
  assert.equal(s1Records.length, 1);
  assert.equal(s1Records[0].id, uuidId);
  assert.equal(s1Records[0].complexId, 'complex-1');
  assert.equal(s1Records[0].schoolId, 'school-1');
  assert.equal(s1Records[0].schoolDisplayName, 'دبستان هوشمند گلستان');
  assert.ok(s1Records[0].createdAtIso);
  assert.ok(s1Records[0].updatedAtIso);

  // School-2 must remain completely untouched
  assert.equal(s2Records.length, 1);
  assert.equal(s2Records[0].schoolId, 'school-2');
  assert.equal(s2Records[0].schoolDisplayName, 'متوسطه اول راه روشن');
});

test('SchoolBranding: principal can edit strictly own schoolId and is blocked from editing other schools', () => {
  const principalSession = {
    userId: 'principal-s1',
    username: 'principal1',
    displayName: 'مدیر مدرسه یک',
    role: 'principal' as const,
    schoolId: 'school-1',
    complexId: 'complex-1',
    isComplexWide: false,
    isSuperAdmin: false,
    loggedInAt: new Date().toISOString(),
  };

  const ownAllowed = authorizeMutation(
    { session: principalSession, panicModeState: DEFAULT_PANIC_MODE_STATE },
    'school_branding_configs',
    'write',
    { schoolId: 'school-1' }
  );
  assert.equal(ownAllowed.allowed, true);

  const otherSchoolBlocked = authorizeMutation(
    { session: principalSession, panicModeState: DEFAULT_PANIC_MODE_STATE },
    'school_branding_configs',
    'write',
    { schoolId: 'school-2' }
  );
  assert.equal(otherSchoolBlocked.allowed, false);

  const otherComplexBlocked = authorizeMutation(
    { session: principalSession, panicModeState: DEFAULT_PANIC_MODE_STATE },
    'school_branding_configs',
    'write',
    { schoolId: 'school-dynamic-99' }
  );
  assert.equal(otherComplexBlocked.allowed, false);
});

test('SchoolBranding: super_admin can dynamically manage any newly added school/complex unless Panic Mode is active', async () => {
  const superAdminSession = {
    userId: 'super-admin-1',
    username: 'superadmin',
    displayName: 'راهبر ارشد سامانه',
    role: 'super_admin' as const,
    schoolId: 'school-1',
    complexId: 'complex-1',
    isComplexWide: true,
    isSuperAdmin: true,
    loggedInAt: new Date().toISOString(),
  };

  // Dynamic 4th school in a 2nd complex
  const dynamicAllowed = authorizeMutation(
    { session: superAdminSession, panicModeState: DEFAULT_PANIC_MODE_STATE },
    'school_branding_configs',
    'write',
    { schoolId: 'school-custom-4' }
  );
  assert.equal(dynamicAllowed.allowed, true);

  // Panic Mode locked on school-custom-4 only
  const panicLocked: PanicModeState = {
    enabled: true,
    scope: 'selected_schools',
    lockedSchoolIds: ['school-custom-4'],
    reasonFa: 'قفل امنیتی موقت',
    activatedByUserId: 'super-admin-1',
    activatedByName: 'راهبر ارشد',
    activatedAtJalali: '1405/08/15',
    activatedAtIso: new Date().toISOString(),
  };

  const blockedByPanic = authorizeMutation(
    { session: superAdminSession, panicModeState: panicLocked },
    'school_branding_configs',
    'write',
    { schoolId: 'school-custom-4' }
  );
  assert.equal(blockedByPanic.allowed, false);

  // Unlocked school-1 remains editable
  const unlockedAllowed = authorizeMutation(
    { session: superAdminSession, panicModeState: panicLocked },
    'school_branding_configs',
    'write',
    { schoolId: 'school-1' }
  );
  assert.equal(unlockedAllowed.allowed, true);

  // Repository-level Panic Mode block verification
  const repo = new LocalIndexedDBAdapter();
  await repo.savePanicModeState(panicLocked);
  await assert.rejects(
    () =>
      repo.putItem('school_branding_configs', {
        id: generateUUID(),
        complexId: 'complex-2',
        schoolId: 'school-custom-4',
        schoolDisplayName: 'تغییر در زمان قفل',
        sectionLabels: {},
        updatedByName: 'راهبر ارشد',
        updatedAt: new Date().toISOString(),
      }),
    /فقط‌خواندنی/
  );
});

test('SchoolBranding: school_branding_updated audit log seals cleanly in SHA-256 chain', async () => {
  const entry: SecurityAuditLogEntry = {
    id: generateUUID(),
    complexId: 'complex-1',
    schoolId: 'school-1',
    academicYearId: '1405-1406',
    createdByUserId: 'principal-s1',
    eventType: 'school_branding_updated',
    actorUsername: 'principal1',
    actorName: 'مدیر مدرسه یک',
    actorRole: 'principal',
    summaryFa: 'تغییر لوگو و سربرگ چاپی مدرسه',
    detailsFa: 'به‌روزرسانی لوگو و سربرگ چاپی «دبستان گلستان» — نام نمایشی: «دبستان هوشمند گلستان»',
    timestampJalali: '1405/08/15',
    timeHm: '10:30',
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
  };

  const sealed = sealAuditEntrySync(entry, []);
  const verification = await verifyAuditLogChain([sealed]);
  assert.equal(verification.valid, true);
  assert.equal(verification.verifiedEntries, 1);
  assert.equal(verification.corruptedEntries.length, 0);
});
