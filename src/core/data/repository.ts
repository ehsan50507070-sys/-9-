// School-Scoped Data Abstraction Layer (IDataRepository)
import type {
  BackupPayload,
  CollectionName,
  CollectionTypeMap,
  DailyRollingSnapshot,
  MigrationVaultMeta,
  PanicModeState,
  School,
  SecurityAuditLogEntry,
  SoftDeletedRecordEntry,
} from '../../types/domain';
import type { AuthGuardContext } from '../auth/policy';

export type StorageBackendMode = 'indexeddb' | 'localstorage' | 'memory';

export interface RepositoryChangeEvent {
  type:
    | 'put'
    | 'putMany'
    | 'delete'
    | 'restore_soft_delete'
    | 'school_saved'
    | 'restore'
    | 'reset'
    | 'panic_mode_changed'
    | 'vault_updated'
    | 'external_sync';
  collection?: CollectionName;
  schoolId?: string;
  timestamp: number;
  sourceTabId: string;
}

export type RepositoryChangeListener = (event: RepositoryChangeEvent) => void;

export interface IDataRepository {
  readonly backendMode: StorageBackendMode;
  readonly schemaVersion: number;
  init(): Promise<StorageBackendMode>;
  setAuthContext(auth: AuthGuardContext | null): void;

  // Live cross-panel & cross-tab reactivity
  subscribe(listener: RepositoryChangeListener): () => void;

  // Complex-level school queries
  getAllSchools(): Promise<School[]>;
  saveSchool(school: School): Promise<void>;

  // Strictly schoolId-scoped CRUD (returns active non-deleted records)
  getBySchool<K extends CollectionName>(
    collection: K,
    schoolId: string
  ): Promise<CollectionTypeMap[K][]>;

  putItem<K extends CollectionName>(
    collection: K,
    item: CollectionTypeMap[K]
  ): Promise<void>;

  putMany<K extends CollectionName>(
    collection: K,
    items: CollectionTypeMap[K][]
  ): Promise<void>;

  /**
   * Zero-Hard-Delete policy: marks record with deletedAtIso & deletedByUserId
   * instead of physically removing it from IndexedDB.
   */
  deleteItem<K extends CollectionName>(
    collection: K,
    schoolId: string,
    id: string
  ): Promise<void>;

  // Soft-Delete Recycle Bin queries & instant recovery
  getSoftDeletedItems(schoolId?: string): Promise<SoftDeletedRecordEntry[]>;
  restoreSoftDeletedItem<K extends CollectionName>(
    collection: K,
    schoolId: string,
    id: string
  ): Promise<boolean>;

  // Data Vault metadata, Migration Engine history, Panic Mode & 5 Daily Rolling Snapshots
  getVaultMeta(): MigrationVaultMeta;
  saveVaultMeta(meta: MigrationVaultMeta): Promise<void>;
  getPanicModeState(): PanicModeState;
  savePanicModeState(state: PanicModeState): Promise<void>;
  getDailyRollingSnapshots(): DailyRollingSnapshot[];
  saveDailyRollingSnapshot(snapshot: DailyRollingSnapshot): Promise<void>;
  savePreMigrationSnapshot(snapshotJson: string): Promise<void>;
  getPreMigrationSnapshot(): string | null;

  // Preserved record counts across ALL collections (including disabled/uninstalled plugins)
  getCollectionCountsBySchool(schoolId: string): Promise<Record<CollectionName, number>>;

  // Backup & Restore (always preserving disabled/uninstalled add-on records)
  exportSchoolBackup(schoolId: string): Promise<BackupPayload>;
  exportComplexBackup(): Promise<BackupPayload>;
  restoreBackup(payload: BackupPayload): Promise<void>;

  // Append-only tamper-evident security audit logging
  appendSecurityAuditLog(entry: SecurityAuditLogEntry): Promise<void>;

  // 1-click factory reset (for ErrorBoundary / recovery)
  resetToSeed(): Promise<void>;
}
