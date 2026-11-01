import { createRecordStore, requestResult } from "../storage/indexed-db.js";
import {
  getEditorDraftCleanupKeys,
  type EditorDraftRecord,
} from "./draft-model.js";

const DATABASE_NAME = "sniptale-viewer";
const DATABASE_VERSION = 1;
const STORE_NAME = "editor-drafts";

export type EditorDraftStorage = {
  cleanup(now?: number): Promise<void>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<unknown>;
  put(record: EditorDraftRecord): Promise<void>;
};

export function createEditorDraftStorage(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): EditorDraftStorage {
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
      const stored = await requestResult(
        db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
      );
      const staleKeys = getEditorDraftCleanupKeys(stored, now);
      await deleteKeys(staleKeys);
    },
  };
}

export const editorDraftStorage = createEditorDraftStorage();
