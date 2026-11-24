// Step 3-B: Versioned, Chunked, Non-Disruptive Migration Engine with Auto-Rollback & Default Normalization
import type {
  CollectionName,
  MigrationHistoryEntry,
  ReferentialIntegrityReport,
  SoftDeleteVersionFields,
} from '../../types/domain';
import type { SeedDataset } from '../data/seedData';
import {
  getCollectionLabelFa,
  runReferentialIntegrityCheck,
} from '../security/DataIntegrityGuard';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';

export const CURRENT_SCHEMA_VERSION = 1;
export const DEFAULT_MIGRATION_CHUNK_SIZE = 50;

export interface MigrationProgressState {
  processed: number;
  total: number;
  percent: number;
  currentCollection: CollectionName;
  currentCollectionLabelFa: string;
  chunkIndex: number;
}

export interface ChunkedMigrationResult {
  ok: boolean;
  rolledBack: boolean;
  schemaVersion: number;
  dataset: SeedDataset;
  historyEntry: MigrationHistoryEntry;
  integrityBefore: ReferentialIntegrityReport;
  integrityAfter: ReferentialIntegrityReport;
  errorFa?: string;
}

/**
 * Default Normalization (Additive-Only):
 * Safely injects recordVersion, deletedAtIso, deletedByUserId & deletedByName defaults
 * onto legacy records without ever deleting or altering existing data fields.
 */
export function normalizeRecordDefaults<T>(record: T): { record: T; changed: boolean } {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { record, changed: false };
  }

  const rec = record as Record<string, unknown> & SoftDeleteVersionFields;
  let changed = false;
  const next: Record<string, unknown> = { ...rec };

  if (typeof rec.recordVersion !== 'number' || !Number.isFinite(rec.recordVersion) || rec.recordVersion < 1) {
    next.recordVersion = 1;
    changed = true;
  }

  if (rec.deletedAtIso === undefined) {
    next.deletedAtIso = null;
    changed = true;
  }

  if (rec.deletedByUserId === undefined) {
    next.deletedByUserId = null;
    changed = true;
  }

  if (rec.deletedByName === undefined) {
    next.deletedByName = null;
    changed = true;
  }

  return { record: (changed ? next : record) as T, changed };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Runs a non-disruptive, additive-only chunked migration:
 * 1. Captures a protected `pre_migration_snapshot` BEFORE touching any record.
 * 2. Runs Referential Integrity check before migration.
 * 3. Processes records in chunks of 50, yielding to the browser event loop between chunks.
 * 4. If ANY error occurs mid-migration, automatically restores the exact pre-migration snapshot.
 */
export async function runChunkedMigration(params: {
  dataset: SeedDataset;
  fromVersion: number;
  toVersion?: number;
  chunkSize?: number;
  executedByName: string;
  savePreSnapshot?: (snapshotJson: string) => Promise<void> | void;
  onProgress?: (progress: MigrationProgressState) => void;
  /** Optional fault-injection hook for automated tests and self-test verification */
  simulateErrorAtChunk?: number;
}): Promise<ChunkedMigrationResult> {
  const startedAt = Date.now();
  const fromVersion = params.fromVersion;
  const toVersion = params.toVersion ?? CURRENT_SCHEMA_VERSION;
  const chunkSize = Math.max(1, params.chunkSize ?? DEFAULT_MIGRATION_CHUNK_SIZE);

  // Step 1: Capture immutable pre-migration snapshot BEFORE any mutation
  const preSnapshotJson = JSON.stringify(params.dataset);
  if (params.savePreSnapshot) {
    await params.savePreSnapshot(preSnapshotJson);
  }

  const integrityBefore = runReferentialIntegrityCheck(params.dataset);
  const workingDataset = structuredClone(params.dataset);
  const collections = Object.keys(workingDataset) as CollectionName[];
  const totalRecords = collections.reduce(
    (sum, col) => sum + (Array.isArray(workingDataset[col]) ? workingDataset[col].length : 0),
    0
  );

  let processedRecords = 0;
  let normalizedRecords = 0;
  let chunkIndex = 0;

  try {
    for (const col of collections) {
      const list = workingDataset[col];
      if (!Array.isArray(list) || list.length === 0) continue;

      const labelFa = getCollectionLabelFa(col);
      const updatedList = new Array(list.length);

      for (let i = 0; i < list.length; i += chunkSize) {
        chunkIndex += 1;

        if (
          typeof params.simulateErrorAtChunk === 'number' &&
          params.simulateErrorAtChunk > 0 &&
          chunkIndex === params.simulateErrorAtChunk
        ) {
          throw new Error(
            `خطای شبیه‌سازی‌شده در دسته شماره ${toPersianDigits(chunkIndex)} (${labelFa}) جهت آزمون بازگشت خودکار.`
          );
        }

        const end = Math.min(i + chunkSize, list.length);
        for (let idx = i; idx < end; idx++) {
          const { record, changed } = normalizeRecordDefaults(list[idx]);
          updatedList[idx] = record;
          processedRecords += 1;
          if (changed) normalizedRecords += 1;
        }

        const percent =
          totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 100;
        params.onProgress?.({
          processed: processedRecords,
          total: totalRecords,
          percent,
          currentCollection: col,
          currentCollectionLabelFa: labelFa,
          chunkIndex,
        });

        // Yield to event loop after each chunk so UI stays 100% responsive (Zero-Freeze)
        await yieldToEventLoop();
      }

      (workingDataset[col] as unknown[]) = updatedList;
    }

    if (totalRecords === 0) {
      params.onProgress?.({
        processed: 0,
        total: 0,
        percent: 100,
        currentCollection: 'schools',
        currentCollectionLabelFa: getCollectionLabelFa('schools'),
        chunkIndex: 1,
      });
    }

    const integrityAfter = runReferentialIntegrityCheck(workingDataset);
    const durationMs = Math.max(1, Date.now() - startedAt);
    const historyEntry: MigrationHistoryEntry = {
      id: `mig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fromVersion,
      toVersion,
      status: 'succeeded',
      processedRecords,
      normalizedRecords,
      chunkSize,
      durationMs,
      executedAtJalali: getTodayJalali(),
      executedAtIso: new Date().toISOString(),
      executedByName: params.executedByName,
      summaryFa: `مهاجرت و استانداردسازی ${toPersianDigits(processedRecords)} رکورد (${toPersianDigits(normalizedRecords)} رکورد به‌روزرسانی‌شده) در دسته‌های ${toPersianDigits(chunkSize)}تایی با موفقیت انجام شد.`,
    };

    return {
      ok: true,
      rolledBack: false,
      schemaVersion: toVersion,
      dataset: workingDataset,
      historyEntry,
      integrityBefore,
      integrityAfter,
    };
  } catch (err) {
    // Auto-Rollback to exact pre_migration_snapshot
    const restoredDataset = JSON.parse(preSnapshotJson) as SeedDataset;
    const integrityAfter = runReferentialIntegrityCheck(restoredDataset);
    const durationMs = Math.max(1, Date.now() - startedAt);
    const errorMessage =
      err instanceof Error ? err.message : 'خطای پیش‌بینی‌نشده حین مهاجرت پایگاه داده';

    const historyEntry: MigrationHistoryEntry = {
      id: `mig-rb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fromVersion,
      toVersion,
      status: 'rolled_back',
      processedRecords,
      normalizedRecords,
      chunkSize,
      durationMs,
      executedAtJalali: getTodayJalali(),
      executedAtIso: new Date().toISOString(),
      executedByName: params.executedByName,
      summaryFa: `عملیات مهاجرت متوقف شد و داده‌ها به صورت خودکار به آخرین وضعیت سالم قبل از مهاجرت بازگردانده شدند.`,
      errorDetailFa: errorMessage,
    };

    return {
      ok: false,
      rolledBack: true,
      schemaVersion: fromVersion,
      dataset: restoredDataset,
      historyEntry,
      integrityBefore,
      integrityAfter,
      errorFa: `مهاجرت متوقف و بازگشت خودکار (Auto-Rollback) با موفقیت انجام شد. جزئیات خطا: ${errorMessage}`,
    };
  }
}
