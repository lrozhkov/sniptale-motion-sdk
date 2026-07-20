import {
  PLAYBACK_VIDEO_CACHE_MAX_AGE_MS,
  PLAYBACK_VIDEO_CACHE_MAX_BYTES,
  PLAYBACK_VIDEO_CACHE_MAX_RECORDS,
  type PlaybackVideoCacheRecord,
} from "./video-cache-model.js";

const DATABASE_NAME = "sniptale-preview-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "video-previews";

export type PlaybackVideoCacheStorage = {
  cleanup(now?: number): Promise<void>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<unknown | null>;
  put(record: PlaybackVideoCacheRecord): Promise<void>;
};

export function createPlaybackVideoCacheStorage(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): PlaybackVideoCacheStorage {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = () => {
    if (!factory) {
      return Promise.reject(new Error("IndexedDB is unavailable"));
    }
    databasePromise ??= openDatabase(factory);
    return databasePromise;
  };
  return {
    async cleanup(now = Date.now()) {
      const db = await database();
      const metadata = await readRecordMetadata(
        db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME),
      );
      const sorted = metadata
        .filter(
          (record) =>
            now - record.accessedAt <= PLAYBACK_VIDEO_CACHE_MAX_AGE_MS,
        )
        .sort((left, right) => right.accessedAt - left.accessedAt);
      const keepKeys = new Set<string>();
      let keptBytes = 0;
      for (const record of sorted) {
        if (
          keepKeys.size >= PLAYBACK_VIDEO_CACHE_MAX_RECORDS ||
          keptBytes + record.bytes > PLAYBACK_VIDEO_CACHE_MAX_BYTES
        ) {
          continue;
        }
        keepKeys.add(record.key);
        keptBytes += record.bytes;
      }
      const staleKeys = metadata
        .map((record) => record.key)
        .filter((key) => !keepKeys.has(key));
      if (staleKeys.length === 0) {
        return;
      }
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      staleKeys.forEach((key) => store.delete(key));
      await transactionDone(transaction);
    },
    async delete(key) {
      const db = await database();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      await transactionDone(transaction);
    },
    async get(key) {
      const db = await database();
      return (
        (await requestResult(
          db
            .transaction(STORE_NAME, "readonly")
            .objectStore(STORE_NAME)
            .get(key),
        )) ?? null
      );
    },
    async put(record) {
      const db = await database();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      await transactionDone(transaction);
    },
  };
}

export const playbackVideoCacheStorage = createPlaybackVideoCacheStorage();

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked"));
  });
}

function readRecordMetadata(
  store: IDBObjectStore,
): Promise<Array<{ accessedAt: number; bytes: number; key: string }>> {
  return new Promise((resolve, reject) => {
    const records: Array<{ accessedAt: number; bytes: number; key: string }> =
      [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(records);
        return;
      }
      const value = cursor.value;
      const key =
        typeof cursor.primaryKey === "string"
          ? cursor.primaryKey
          : typeof value?.key === "string"
            ? value.key
            : null;
      if (key) {
        records.push({
          accessedAt: Number.isFinite(value?.accessedAt)
            ? Number(value.accessedAt)
            : 0,
          bytes:
            Array.isArray(value?.segments) &&
            value.segments.every((segment) => segment?.blob instanceof Blob)
              ? value.segments.reduce(
                  (total, segment) => total + segment.blob.size,
                  0,
                )
              : Number.POSITIVE_INFINITY,
          key,
        });
      }
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB cursor failed"));
  });
}

function requestResult<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}
