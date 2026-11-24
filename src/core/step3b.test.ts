// Step 3-B Automated Verification Suite: Data Vault, Chunked Migration Engine,
// Soft Delete Recycle Bin, Panic Mode, Anti-Wipe Circuit Breaker, SHA-256 Audit Chain & Sealed Bundles
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PanicModeState, SecurityAuditLogEntry } from '../types/domain';
import { authorizeMutation } from './auth/policy';
import { LocalIndexedDBAdapter } from './data/LocalIndexedDBAdapter';
import { generateSeedDataset } from './data/seedData';
import { sha256Hex, sha256HexSync } from './security/cryptoService';
import {
  applyGranularBundleToDataset,
  createSealedMigrationBundle,
  DEFAULT_PANIC_MODE_STATE,
  DestructiveActionCircuitBreaker,
  runReferentialIntegrityCheck,
  sealAuditEntrySync,
  verifyAndPreviewMigrationBundle,
  verifyAuditLogChain,
} from './security/DataIntegrityGuard';
import {
  CURRENT_SCHEMA_VERSION,
  normalizeRecordDefaults,
  runChunkedMigration,
} from './storage/MigrationEngine';

test('Step 3-B: native sha256Hex matches sha256HexSync and standard NIST test vector', async () => {
  const expectedAbc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const asyncDigest = await sha256Hex('abc');
  const syncDigest = sha256HexSync('abc');
  assert.equal(asyncDigest, expectedAbc);
  assert.equal(syncDigest, expectedAbc);

  const faText = 'سامانه هوشمند مدارس گلستان راه روشن ۱۴۰۵';
  assert.equal(await sha256Hex(faText), sha256HexSync(faText));
});

test('Step 3-B: MigrationEngine runs in 50-record chunks, normalizes defaults, and auto-rollbacks on error', async () => {
  const seed = generateSeedDataset();
  // Remove soft-delete/version defaults from a student to simulate a legacy record
  const rawStudent = seed.students[0] as unknown as Record<string, unknown>;
  delete rawStudent.recordVersion;
  delete rawStudent.deletedAtIso;
  delete rawStudent.deletedByUserId;

  const progressEvents: number[] = [];
  let savedSnapshot = '';

  const okRes = await runChunkedMigration({
    dataset: seed,
    fromVersion: 1,
    toVersion: CURRENT_SCHEMA_VERSION,
    chunkSize: 50,
    executedByName: 'تست خودکار',
    savePreSnapshot: (json) => {
      savedSnapshot = json;
    },
    onProgress: (p) => {
      progressEvents.push(p.percent);
    },
  });

  assert.equal(okRes.ok, true);
  assert.equal(okRes.rolledBack, false);
  assert.ok(savedSnapshot.length > 100);
  assert.ok(progressEvents.length >= 2);
  assert.equal(progressEvents[progressEvents.length - 1], 100);

  const normalizedStudent = okRes.dataset.students[0];
  assert.equal(normalizedStudent.recordVersion, 1);
  assert.equal(normalizedStudent.deletedAtIso, null);
  assert.equal(normalizedStudent.deletedByUserId, null);

  // Fault injection: simulate error mid-migration -> must Auto-Rollback to exact pre_migration_snapshot
  const originalFirstName = okRes.dataset.students[0].fullName;
  const failRes = await runChunkedMigration({
    dataset: okRes.dataset,
    fromVersion: 1,
    toVersion: 2,
    chunkSize: 50,
    executedByName: 'تست خودکار',
    simulateErrorAtChunk: 2,
  });

  assert.equal(failRes.ok, false);
  assert.equal(failRes.rolledBack, true);
  assert.equal(failRes.schemaVersion, 1);
  assert.equal(failRes.historyEntry.status, 'rolled_back');
  assert.equal(failRes.dataset.students[0].fullName, originalFirstName);

  // Verify normalizeRecordDefaults directly
  const norm = normalizeRecordDefaults({ id: 'x-1', name: 'آزمایش' });
  assert.equal(norm.changed, true);
  assert.equal((norm.record as Record<string, unknown>).recordVersion, 1);
  assert.equal((norm.record as Record<string, unknown>).deletedAtIso, null);
});

test('Step 3-B: Zero-Hard-Delete (Soft Delete) hides record from getBySchool and restores intact from Recycle Bin', async () => {
  const repo = new LocalIndexedDBAdapter();
  const initialStudents = await repo.getBySchool('students', 'school-1');
  assert.ok(initialStudents.length > 0);
  const target = initialStudents[0];

  repo.setAuthContext({
    session: {
      userId: 'super-admin-1',
      username: 'superadmin',
      displayName: 'راهبر ارشد سامانه',
      role: 'super_admin',
      schoolId: 'school-1',
      complexId: 'complex-1',
      isComplexWide: true,
      isSuperAdmin: true,
      loggedInAt: new Date().toISOString(),
    },
  });

  // Soft delete
  await repo.deleteItem('students', 'school-1', target.id);

  // Must vanish from active getBySchool
  const afterDelete = await repo.getBySchool('students', 'school-1');
  assert.equal(
    afterDelete.some((s) => s.id === target.id),
    false
  );

  // Must appear in Recycle Bin with metadata
  const deletedList = await repo.getSoftDeletedItems('school-1');
  const foundDeleted = deletedList.find((d) => d.id === target.id && d.collection === 'students');
  assert.ok(foundDeleted);
  assert.equal(foundDeleted.deletedByUserId, 'super-admin-1');
  assert.ok(foundDeleted.recordVersion >= 2);

  // Instant Restore
  const restored = await repo.restoreSoftDeletedItem('students', 'school-1', target.id);
  assert.equal(restored, true);

  const afterRestore = await repo.getBySchool('students', 'school-1');
  const restoredStudent = afterRestore.find((s) => s.id === target.id);
  assert.ok(restoredStudent);
  assert.equal(restoredStudent.fullName, target.fullName);
  assert.equal(restoredStudent.deletedAtIso, null);
});

test('Step 3-B: Panic Mode (Read-Only Freeze) blocks writes/deletes on locked schools only', async () => {
  const repo = new LocalIndexedDBAdapter();
  const s1Students = await repo.getBySchool('students', 'school-1');
  const s2Students = await repo.getBySchool('students', 'school-2');
  assert.ok(s1Students.length > 0 && s2Students.length > 0);

  const lockedSchool1Only: PanicModeState = {
    enabled: true,
    scope: 'selected_schools',
    lockedSchoolIds: ['school-1'],
    reasonFa: 'ممیزی امنیتی اضطراری',
    activatedByUserId: 'super-admin-1',
    activatedByName: 'راهبر ارشد',
    activatedAtJalali: '1405/08/10',
    activatedAtIso: new Date().toISOString(),
  };

  await repo.savePanicModeState(lockedSchool1Only);

  // Write on school-1 MUST be blocked
  await assert.rejects(
    () => repo.putItem('students', { ...s1Students[0], fullName: 'تغییر غیرمجاز' }),
    /فقط‌خواندنی/
  );
  await assert.rejects(() => repo.deleteItem('students', 'school-1', s1Students[0].id), /فقط‌خواندنی/);

  // Write on unlocked school-2 MUST succeed
  await repo.putItem('students', { ...s2Students[0] });

  // Policy layer check even for super_admin
  const policyRes = authorizeMutation(
    {
      session: {
        userId: 'super-admin-1',
        username: 'superadmin',
        displayName: 'راهبر ارشد',
        role: 'super_admin',
        schoolId: 'school-1',
        complexId: 'complex-1',
        isComplexWide: true,
        isSuperAdmin: true,
        loggedInAt: new Date().toISOString(),
      },
      panicModeState: lockedSchool1Only,
    },
    'students',
    'write',
    { schoolId: 'school-1' }
  );
  assert.equal(policyRes.allowed, false);

  // Unlock resets cleanly
  await repo.savePanicModeState({ ...DEFAULT_PANIC_MODE_STATE });
  await repo.putItem('students', { ...s1Students[0] });
});

test('Step 3-B: Anti-Wipe Circuit Breaker trips on 6th destructive operation within 60 seconds', () => {
  const breaker = new DestructiveActionCircuitBreaker(5, 60_000);
  const t0 = 1_700_000_000_000;

  for (let i = 1; i <= 5; i++) {
    const evalRes = breaker.recordAndEvaluate('principal-1', t0 + i * 1000);
    assert.equal(evalRes.allowed, true);
    assert.equal(evalRes.recentCount, i);
  }

  // 6th delete in < 60s MUST be blocked immediately
  const tripped = breaker.recordAndEvaluate('principal-1', t0 + 10_000);
  assert.equal(tripped.allowed, false);
  assert.equal(tripped.recentCount, 6);

  // Another user is unaffected
  const otherUser = breaker.recordAndEvaluate('principal-2', t0 + 10_000);
  assert.equal(otherUser.allowed, true);

  // After 60 seconds sliding window expires, operations are allowed again
  const afterWindow = breaker.recordAndEvaluate('principal-1', t0 + 75_000);
  assert.equal(afterWindow.allowed, true);
});

test('Step 3-B: Tamper-Evident SHA-256 Audit Log Chain verifies intact chain and detects tampering or deletion', async () => {
  const makeEntry = (idx: number): SecurityAuditLogEntry => ({
    id: `audit-${idx}`,
    complexId: 'complex-1',
    schoolId: 'school-1',
    academicYearId: '1404-1405',
    createdByUserId: 'super-admin-1',
    eventType: 'login_success',
    actorUsername: 'superadmin',
    actorName: 'راهبر ارشد',
    actorRole: 'super_admin',
    summaryFa: `ورود موفق شماره ${idx}`,
    detailsFa: `جزئیات ورود ${idx}`,
    timestampJalali: '1405/08/10',
    timeHm: `09:0${idx}`,
    createdAtIso: `2026-11-01T09:0${idx}:00.000Z`,
    updatedAtIso: `2026-11-01T09:0${idx}:00.000Z`,
  });

  // Build newest-first chain of 3 entries
  let chain: SecurityAuditLogEntry[] = [];
  for (let i = 1; i <= 3; i++) {
    const sealed = sealAuditEntrySync(makeEntry(i), chain);
    chain = [sealed, ...chain];
  }

  // 1. Intact chain passes 100%
  const intact = await verifyAuditLogChain(chain);
  assert.equal(intact.valid, true);
  assert.equal(intact.verifiedEntries, 3);
  assert.equal(intact.corruptedEntries.length, 0);

  // 2. Tampering a single character in middle record MUST fail
  const tampered = chain.map((item) =>
    item.id === 'audit-2' ? { ...item, summaryFa: 'ورود دستکاری‌شده' } : item
  );
  const tamperedRes = await verifyAuditLogChain(tampered);
  assert.equal(tamperedRes.valid, false);
  assert.ok(tamperedRes.corruptedEntries.some((c) => c.id === 'audit-2'));

  // 3. Deleting middle record MUST break prevHash chain and fail
  const deletedMiddle = chain.filter((item) => item.id !== 'audit-2');
  const deletedRes = await verifyAuditLogChain(deletedMiddle);
  assert.equal(deletedRes.valid, false);
  assert.ok(deletedRes.corruptedEntries.some((c) => c.id === 'audit-3'));
});

test('Step 3-B: Referential Integrity Checker passes clean dataset and flags orphan references as red', () => {
  const dataset = generateSeedDataset();
  const cleanReport = runReferentialIntegrityCheck(dataset);
  assert.equal(cleanReport.status, 'green');
  assert.equal(cleanReport.orphanCount, 0);

  // Inject an orphan student pointing to non-existent class
  const broken = structuredClone(dataset);
  broken.students.push({
    ...broken.students[0],
    id: 'orphan-student-999',
    classId: 'deleted-class-xyz',
  });

  const brokenReport = runReferentialIntegrityCheck(broken);
  assert.equal(brokenReport.status, 'red');
  assert.ok(brokenReport.orphanCount >= 1);
  assert.ok(brokenReport.issues.some((i) => i.recordId === 'orphan-student-999'));

  // Per-school integrity check isolates school-1 orphan without flagging school-2
  const school1Broken = runReferentialIntegrityCheck(broken, broken.students[0].schoolId);
  assert.equal(school1Broken.status, 'red');
  assert.ok(school1Broken.issues.some((i) => i.recordId === 'orphan-student-999'));
  const otherSchoolId = broken.schools.find((s) => s.id !== broken.students[0].schoolId)?.id;
  assert.ok(otherSchoolId);
  const otherSchoolReport = runReferentialIntegrityCheck(broken, otherSchoolId);
  assert.equal(otherSchoolReport.status, 'green');
  assert.equal(otherSchoolReport.orphanCount, 0);
});

test('Step 3-B: Sealed Phase-10 Migration Bundle blocks tampered files and restores 1 school without touching other 2 schools', async () => {
  const original = generateSeedDataset();

  // Create sealed single-school bundle for school-1
  const bundle = await createSealedMigrationBundle({
    dataset: original,
    scope: 'single_school',
    schoolId: 'school-1',
    schoolName: original.schools.find((s) => s.id === 'school-1')?.name,
    exportedByName: 'راهبر ارشد',
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });

  assert.equal(bundle.bundleFormat, 'golestan_phase10_migration_bundle');
  assert.equal(bundle.sha256Signature.length, 64);

  // Verify untampered JSON
  const rawJson = JSON.stringify(bundle);
  const verified = await verifyAndPreviewMigrationBundle(rawJson);
  assert.equal(verified.valid, true);
  assert.equal(verified.tampered, false);
  assert.ok(verified.previewSummary);
  assert.equal(verified.previewSummary.totalRecords, bundle.totalRecords);

  // Tamper 1 student name inside JSON -> SHA-256 verification MUST reject!
  const tamperedBundle = structuredClone(bundle);
  const s1List = tamperedBundle.data.students as Array<{ fullName: string }>;
  s1List[0].fullName = 'نام دستکاری‌شده';
  const tamperedResult = await verifyAndPreviewMigrationBundle(JSON.stringify(tamperedBundle));
  assert.equal(tamperedResult.valid, false);
  assert.equal(tamperedResult.tampered, true);

  // Granular single-school restore test:
  // Modify school-1 AND school-2 in current dataset, then restore ONLY school-1 from bundle.
  // school-1 MUST revert to bundle state, while school-2 modification MUST stay 100% untouched!
  const modifiedCurrent = structuredClone(original);
  const s1First = modifiedCurrent.students.find((s) => s.schoolId === 'school-1');
  const s2First = modifiedCurrent.students.find((s) => s.schoolId === 'school-2');
  assert.ok(s1First && s2First);

  const originalS1Name = s1First.fullName;
  s1First.fullName = 'تغییر موقت مدرسه ۱';
  s2First.fullName = 'تغییر محافظت‌شده مدرسه ۲';

  const restoredDataset = applyGranularBundleToDataset(modifiedCurrent, bundle);
  const restoredS1 = restoredDataset.students.find((s) => s.id === s1First.id);
  const preservedS2 = restoredDataset.students.find((s) => s.id === s2First.id);

  assert.equal(restoredS1?.fullName, originalS1Name);
  assert.equal(preservedS2?.fullName, 'تغییر محافظت‌شده مدرسه ۲');
});

test('Step 3-B: data-vault (/data-health-migration) governance permission is strictly exclusive to super_admin', async () => {
  const { evaluateModulePermission } = await import('./super-admin/superAdminHelpers');
  const dummyManifests = [
    {
      id: 'data-vault',
      nameFa: 'مرکز سلامت داده و مهاجرت',
      shortNameFa: 'مرکز سلامت داده و مهاجرت',
      descriptionFa: '',
      version: '3.2.0',
      phase: 9 as const,
      category: 'core' as const,
      categoryLabelFa: 'امنیت و ممیزی',
      iconName: 'Database' as const,
      isCore: true,
      defaultEnabled: true,
      route: '/data-health-migration',
      allowedRoles: ['super_admin' as const],
      dataStores: ['schools' as const],
      implemented: true,
    },
  ];

  assert.equal(
    evaluateModulePermission({
      role: 'super_admin',
      moduleId: 'data-vault',
      action: 'view',
      configs: [],
      manifests: dummyManifests,
    }),
    true
  );

  for (const role of ['complex_admin', 'principal', 'deputy', 'teacher', 'parent', 'student'] as const) {
    assert.equal(
      evaluateModulePermission({
        role,
        moduleId: 'data-vault',
        action: 'view',
        configs: [],
        manifests: dummyManifests,
      }),
      false
    );
  }
});
