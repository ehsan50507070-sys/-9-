// Dedicated IndexedDB Blob Store for rich media attachments (images, audio, video, PDF)
// Uses strict 3-second Promise.race timeout with silent in-memory Map fallback so localStorage NEVER overflows.

const BLOB_DB_NAME = 'smart_school_media_blobs_v1';
const BLOB_DB_VERSION = 1;
const BLOB_STORE_NAME = 'mediaBlobs';
const BLOB_TIMEOUT_MS = 3000;

export interface StoredMediaBlobRecord {
  mediaId: string;
  schoolId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  createdAt: string;
}

const memoryBlobFallback = new Map<string, StoredMediaBlobRecord>();
let cachedBlobDbPromise: Promise<IDBDatabase | null> | null = null;

function withBlobTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`MediaBlob IDB timeout (${BLOB_TIMEOUT_MS}ms): ${label}`));
    }, BLOB_TIMEOUT_MS);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function openBlobDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return null;
  }
  if (!cachedBlobDbPromise) {
    cachedBlobDbPromise = withBlobTimeout(
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = window.indexedDB.open(BLOB_DB_NAME, BLOB_DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
            const store = db.createObjectStore(BLOB_STORE_NAME, { keyPath: 'mediaId' });
            store.createIndex('schoolId', 'schoolId', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Failed to open mediaBlobs DB'));
        req.onblocked = () => reject(new Error('mediaBlobs DB open blocked'));
      }),
      'open_media_blobs'
    ).catch(() => null);
  }
  return cachedBlobDbPromise;
}

export async function saveMediaBlob(record: StoredMediaBlobRecord): Promise<void> {
  // Always keep in memory cache for instant zero-latency playback even if IDB is blocked
  memoryBlobFallback.set(record.mediaId, record);

  const db = await openBlobDb();
  if (!db) return;

  try {
    await withBlobTimeout(
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
        tx.objectStore(BLOB_STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to write media blob'));
        tx.onabort = () => reject(new Error('Media blob write aborted'));
      }),
      'put_media_blob'
    );
  } catch {
    // Silent fallback — already safely retained in memoryBlobFallback
  }
}

export async function getMediaBlob(
  mediaId: string,
  schoolId?: string
): Promise<StoredMediaBlobRecord | null> {
  const fromMem = memoryBlobFallback.get(mediaId);
  if (fromMem) {
    if (schoolId && fromMem.schoolId !== schoolId) return null;
    return fromMem;
  }

  const db = await openBlobDb();
  if (!db) return null;

  try {
    const rec = await withBlobTimeout(
      new Promise<StoredMediaBlobRecord | undefined>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE_NAME, 'readonly');
        const req = tx.objectStore(BLOB_STORE_NAME).get(mediaId);
        req.onsuccess = () => resolve(req.result as StoredMediaBlobRecord | undefined);
        req.onerror = () => reject(req.error ?? new Error('Failed to read media blob'));
      }),
      'get_media_blob'
    );
    if (!rec) return null;
    if (schoolId && rec.schoolId !== schoolId) return null;
    memoryBlobFallback.set(rec.mediaId, rec);
    return rec;
  } catch {
    return null;
  }
}

export async function deleteMediaBlob(mediaId: string): Promise<void> {
  memoryBlobFallback.delete(mediaId);
  const db = await openBlobDb();
  if (!db) return;

  try {
    await withBlobTimeout(
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
        tx.objectStore(BLOB_STORE_NAME).delete(mediaId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to delete media blob'));
      }),
      'delete_media_blob'
    );
  } catch {
    // ignore
  }
}
