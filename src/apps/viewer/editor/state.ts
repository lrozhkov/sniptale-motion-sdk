import type { EditorSnapshot } from "./history.js";

export type EditorDraftState = {
  activeKey: string | null;
  lastLoadedUpdatedAt: number;
  lastPersistedFingerprint: string | null;
  lastSavedAt: number;
  persistedRevision: number;
  revision: number;
  savePromise: Promise<boolean> | null;
  saveTimer: number | null;
  sessionId: string;
  status:
    | "clean"
    | "pending"
    | "saving"
    | "restored"
    | "conflict"
    | "error"
    | "saved";
};

export type ViewerEditorState = {
  controls: Record<string, unknown>;
  editorCommands: unknown[];
  editorBaseFingerprints: Map<string, string>;
  editorBaseSnapshots: Map<string, EditorSnapshot>;
  editorDraft: EditorDraftState;
  editorHistoryBusy: boolean;
  editorOverrides: Map<string, unknown>;
  historyFuture: EditorSnapshot[];
  historyCoalescing: {
    historyLength: number;
    key: string;
    lastAt: number;
    templateId: string;
  } | null;
  historyPast: EditorSnapshot[];
  selectedPresetId: string | null;
  timelineOverrides: Map<string, unknown>;
};

export function createViewerEditorState(): ViewerEditorState {
  return {
    controls: {},
    editorCommands: [],
    editorBaseFingerprints: new Map(),
    editorBaseSnapshots: new Map(),
    editorDraft: {
      activeKey: null,
      lastLoadedUpdatedAt: 0,
      lastPersistedFingerprint: null,
      lastSavedAt: 0,
      persistedRevision: 0,
      revision: 0,
      savePromise: null,
      saveTimer: null,
      sessionId: globalThis.crypto.randomUUID(),
      status: "clean",
    },
    editorHistoryBusy: false,
    editorOverrides: new Map(),
    historyFuture: [],
    historyCoalescing: null,
    historyPast: [],
    selectedPresetId: null,
    timelineOverrides: new Map(),
  };
}
