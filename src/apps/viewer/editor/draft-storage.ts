import {
  EDITOR_DRAFT_MAX_AGE_MS,
  EDITOR_DRAFT_MAX_RECORDS,
  type EditorDraftRecord,
} from "./draft-model.js";

const DATABASE_NAME = "sniptale-viewer";
const DATABASE_VERSION = 1;
const STORE_NAME = "editor-drafts";

export type EditorDraftStorage = {
  cleanup(now?: number): Promise<void>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<unknown | null>;
  put(record: EditorDraftRecord): Promise<void>;
};

export function createEditorDraftStorage(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): EditorDraftStorage {
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
      const records = await requestResult<EditorDraftRecord[]>(
        db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
      );
      const keep = records
        .filter(
          (record) =>
            Number.isFinite(record?.updatedAt) &&
            now - record.updatedAt <= EDITOR_DRAFT_MAX_AGE_MS,
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, EDITOR_DRAFT_MAX_RECORDS);
      const keepKeys = new Set(keep.map((record) => record.key));
      const staleKeys = records
        .map((record) => record?.key)
        .filter((key): key is string => Boolean(key) && !keepKeys.has(key));
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

export const editorDraftStorage = createEditorDraftStorage();

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
