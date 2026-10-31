import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../templates/model.js";
import type {
  ViewerSelection,
  KeyframeSelectionRef,
} from "../timeline/model/selection-model.js";
import type { EditorSnapshot, EditorCommand } from "./history.js";
import type { EditorTimeline } from "./model-types.js";
import type { EditorTimelineSource } from "./timeline-source.js";

export type HistoryCommitOptions = {
  coalesceKey?: string;
  coalesceWindowMs?: number;
};

export type CanonicalEditorState = {
  assets: Record<string, unknown>[];
  commands: unknown[];
  controls: Record<string, unknown>;
  history: { future: number; past: number };
  selectedItem: ViewerSelection;
  selectedClips: string[];
  selectedLayers: string[];
  selectedPresetId: string | null;
  selectedPhases: string[];
  selectedScenes: string[];
  selectedKeyframes: KeyframeSelectionRef[];
  template: EditorTemplate | null;
  time: number;
};

export interface EditorStoreActions {
  getEditorOverride(template?: unknown): Record<string, unknown>;
  setEditorOverride(patch: unknown): void;
  getEffectiveDuration(template?: unknown): number;
  getEffectiveTimeline(template?: EditorTimelineSource | null): EditorTimeline;
  applyEditorCommand<Result>(
    command: unknown,
    mutate: () => Result,
  ): Result | null;
  beginEditorCommand(command: unknown, options?: HistoryCommitOptions): void;
  recordEditorCommand(command: EditorCommand): void;
  getCanonicalEditorState(template?: unknown): CanonicalEditorState;
  setCurrentDuration(duration: number): void;
  renderTimelineEditor(template: EditorTimelineSource | null): void;
  timelineDurationPercent(timeSpan: number, duration: number): number;
  snapDuration(duration: number): number;
}

export interface EditorHistoryActions {
  commitHistory(label?: string, options?: HistoryCommitOptions): boolean;
  captureEditorSnapshot(label?: string): EditorSnapshot;
  getEditorAssetScopeIds(): string[];
  restoreEditorSnapshotData(snapshot: EditorSnapshot): boolean;
  undoEditorEdit(): Promise<boolean>;
  redoEditorEdit(): Promise<boolean>;
}

export interface EditorDraftActions {
  prepareEditorDraftForTemplate(
    template: EditorTemplateSource,
  ): Promise<boolean>;
  markEditorChanged(reason?: string, options?: { immediate?: boolean }): void;
  saveEditorDraftNow(options?: { manual?: boolean }): Promise<boolean>;
  flushEditorDraft(): Promise<boolean>;
  resetEditorToSource(options?: {
    discardHistory?: boolean;
    deleteDraft?: boolean;
  }): Promise<boolean>;
  deleteActiveEditorDraft(): Promise<boolean>;
  hasEditorContentChanges(): boolean;
  getEditorContentFingerprint(): string;
  getEditorSourceFingerprint(template: EditorTemplateSource): string;
  syncEditorWorkflowUi(): void;
  getPreferredDraftTemplateId(
    templates: readonly { id: string }[],
  ): string | null;
  handleEditorPageHide(this: void): void;
  handleEditorBeforeUnload(this: void, event: BeforeUnloadEvent): void;
  openResetDraftDialog(): void;
  closeResetDraftDialog(): void;
  confirmResetEditorDraft(): Promise<void>;
}
