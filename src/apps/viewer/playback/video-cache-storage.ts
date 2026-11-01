import { createRecordStore } from "../storage/indexed-db.js";
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
  get(key: string): Promise<unknown>;
  put(record: PlaybackVideoCacheRecord): Promise<void>;
};

export function createPlaybackVideoCacheStorage(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): PlaybackVideoCacheStorage {
  const { database, deleteKeys, ...records } = createRecordStore(
    factory,
    DATABASE_NAME,
    DATABASE_VERSION,
    STORE_NAME,
  );
  return {
    ...records,
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
      await deleteKeys(staleKeys);
    },
  };
}

export const playbackVideoCacheStorage = createPlaybackVideoCacheStorage();

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
      const value: unknown = cursor.value;
      const metadata = readPlaybackVideoCacheMetadata(value, cursor.primaryKey);
      if (metadata) records.push(metadata);
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB cursor failed"));
  });
}

/** Read only cleanup metadata; restoration validates the complete record. */
export function readPlaybackVideoCacheMetadata(
  value: unknown,
  primaryKey: unknown,
) {
  const entry = isRecord(value) ? value : null;
  const key =
    typeof primaryKey === "string"
      ? primaryKey
      : typeof entry?.key === "string"
        ? entry.key
        : null;
  if (!key) return null;
  const segments: unknown[] | null = Array.isArray(entry?.segments)
    ? entry.segments
    : null;
  let bytes = 0;
  if (!segments) bytes = Number.POSITIVE_INFINITY;
  else
    for (const segment of segments) {
      if (!isRecord(segment) || !(segment.blob instanceof Blob)) {
        bytes = Number.POSITIVE_INFINITY;
        break;
      }
      bytes += segment.blob.size;
    }
  return {
    key,
    bytes,
    accessedAt:
      typeof entry?.accessedAt === "number" && Number.isFinite(entry.accessedAt)
        ? entry.accessedAt
        : 0,
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
