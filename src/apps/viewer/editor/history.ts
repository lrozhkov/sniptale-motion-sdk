import { deepClone } from "./model.js";

export type EditorSnapshot = {
  assetEntries: [string, any][];
  assetScopeIds: string[];
  controls: any;
  editorCommands: any[];
  editorOverride: any;
  label: string;
  selectedClips: any[];
  selectedItem: any;
  selectedKeyframe?: any;
  selectedKeyframes: any[];
  selectedLayers: any[];
  selectedPhases: any[];
  selectedPresetId: string | null;
  selectedScenes: any[];
  templateId: string | null;
  time: number;
  timelineOverride: any;
};

export function createEditorCommand(
  command: any,
  templateId: string,
  time: number,
): any {
  return {
    payload: deepClone(command?.payload ?? {}),
    templateId,
    time: Number(time) || 0,
    type: String(command?.type || "edit"),
  };
}

export function recordEditorCommand(
  state: any,
  command: any,
  limit = 120,
): void {
  state.editorCommands.push({
    ...deepClone(command),
    index: state.editorCommands.length + 1,
  });
  state.editorCommands = state.editorCommands.slice(-limit);
}

export function commitEditorHistory(
  state: any,
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
  state: any,
  label: string,
  templateId: string | null,
  time: number,
  options: {
    assetEntries?: [string, any][];
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
    selectedPresetId: state.selectedPresetId,
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
  state: any,
  snapshot: EditorSnapshot,
  options: { fallbackControls?: any } = {},
): void {
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
