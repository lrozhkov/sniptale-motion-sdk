import type { EditorTemplateSource } from "../templates/model.js";
import type { EditorPreset } from "../templates/model.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";

export interface PresetPanelActions {
  renderPresetsPanel(template?: EditorTimelineSource | null): void;
  saveCurrentAsPreset(): EditorPreset | null;
  duplicateSelectedPreset(): EditorPreset | null;
  duplicatePreset(presetId: string): EditorPreset | null;
  deletePreset(presetId: string): boolean;
  applyPreset(presetId: string): Promise<boolean>;
  setPresets(presets: unknown): void;
}

export interface LayerPanelActions {
  renderLayersPanel(template?: EditorTimelineSource | null): void;
  toggleLayerPanelGroup(groupId: string): boolean;
}

export interface ControlPanelActions {
  renderControls(template: EditorTemplateSource | null): void;
}
