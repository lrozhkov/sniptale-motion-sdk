import { deepClone } from "./model.js";

export type EditorSnapshot = {
  assetEntries: [string, unknown][];
  assetScopeIds: string[];
  controls: unknown;
  editorCommands: unknown[];
  editorOverride: unknown;
  label: string;
  selectedClips: unknown[];
  selectedItem: unknown;
  selectedKeyframe?: unknown;
  selectedKeyframes: unknown[];
  selectedLayers: unknown[];
  selectedPhases: unknown[];
  selectedPresetId: string | null;
  selectedScenes: unknown[];
  templateId: string | null;
  time: number;
  timelineOverride: unknown;
};

export type EditorCommand = {
  payload: unknown;
  templateId: string;
  time: number;
  type: string;
};

export type EditorHistoryState = {
  controls: unknown;
  editorCommands: unknown[];
  editorOverrides: Map<string, unknown>;
  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
  selectedClips?: unknown[];
  selectedItem?: unknown;
  selectedKeyframes?: unknown[];
  selectedLayers?: unknown[];
  selectedPhases?: unknown[];
  selectedPresetId?: string | null;
  selectedScenes?: unknown[];
  timelineOverrides: Map<string, unknown>;
};

export function createEditorCommand(
  command: unknown,
  templateId: string,
  time: number,
): EditorCommand {
  const value = isRecord(command) ? command : {};
  return {
    payload: deepClone(value.payload ?? {}),
    templateId,
    time: Number(time) || 0,
    type: typeof value.type === "string" && value.type ? value.type : "edit",
  };
}

export function recordEditorCommand(
  state: Pick<EditorHistoryState, "editorCommands">,
  command: Record<string, unknown>,
  limit = 120,
): void {
  state.editorCommands.push({
    ...deepClone(command),
    index: state.editorCommands.length + 1,
  });
  state.editorCommands = state.editorCommands.slice(-limit);
}

export function commitEditorHistory(
  state: Pick<EditorHistoryState, "historyPast" | "historyFuture">,
  snapshot: EditorSnapshot,
  limit = 80,
): boolean {
  const previous = state.historyPast[state.historyPast.length - 1];
  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
    return false;
  }
  state.historyPast.push(snapshot);
  state.historyPast = state.historyPast.slice(-limit);
  state.historyFuture = [];
  return true;
}

export function captureEditorSnapshot(
  state: Omit<EditorHistoryState, "historyPast" | "historyFuture">,
  label: string,
  templateId: string | null,
  time: number,
  options: {
    assetEntries?: [string, unknown][];
    assetScopeIds?: string[];
  } = {},
): EditorSnapshot {
  return {
    assetEntries: Array.isArray(options.assetEntries)
      ? options.assetEntries.map(([assetId, asset]) => [assetId, asset])
      : [],
    assetScopeIds: Array.isArray(options.assetScopeIds)
      ? [...options.assetScopeIds]
      : [],
    editorOverride: templateId
      ? deepClone(state.editorOverrides.get(templateId) ?? null)
      : null,
    editorCommands: deepClone(state.editorCommands),
    controls: deepClone(state.controls),
    label,
    selectedItem: deepClone(state.selectedItem ?? { type: "effect" }),
    selectedClips: deepClone(state.selectedClips ?? []),
    selectedLayers: deepClone(state.selectedLayers ?? []),
    selectedPresetId: state.selectedPresetId ?? null,
    selectedPhases: deepClone(state.selectedPhases ?? []),
    selectedScenes: deepClone(state.selectedScenes ?? []),
    selectedKeyframes: deepClone(state.selectedKeyframes ?? []),
    templateId,
    time: Number(time) || 0,
    timelineOverride: templateId
      ? deepClone(state.timelineOverrides.get(templateId) ?? null)
      : null,
  };
}

export function restoreEditorSnapshotState(
  state: Omit<EditorHistoryState, "historyPast" | "historyFuture">,
  snapshot: EditorSnapshot,
  options: { fallbackControls?: unknown } = {},
): void {
  if (snapshot.templateId !== null) {
    if (snapshot.editorOverride) {
      state.editorOverrides.set(
        snapshot.templateId,
        deepClone(snapshot.editorOverride),
      );
    } else {
      state.editorOverrides.delete(snapshot.templateId);
    }
    if (snapshot.timelineOverride) {
      state.timelineOverrides.set(
        snapshot.templateId,
        deepClone(snapshot.timelineOverride),
      );
    } else {
      state.timelineOverrides.delete(snapshot.templateId);
    }
  }
  state.selectedItem = deepClone(snapshot.selectedItem ?? { type: "effect" });
  state.selectedClips = deepClone(snapshot.selectedClips ?? []);
  state.selectedLayers = deepClone(snapshot.selectedLayers ?? []);
  state.selectedPresetId = snapshot.selectedPresetId ?? null;
  state.selectedPhases = deepClone(snapshot.selectedPhases ?? []);
  state.selectedScenes = deepClone(snapshot.selectedScenes ?? []);
  state.selectedKeyframes = deepClone(
    snapshot.selectedKeyframes ??
      (snapshot.selectedKeyframe ? [snapshot.selectedKeyframe] : []),
  );
  state.editorCommands = deepClone(snapshot.editorCommands ?? []);
  state.controls = deepClone(
    snapshot.controls ?? options.fallbackControls ?? {},
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
