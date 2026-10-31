import type { PreviewMediaEntry } from "./frame-source.js";
import type { PreviewMediaSlot } from "./model.js";

export type PreviewMediaState = {
  previewMediaErrors: Map<PreviewMediaSlot, string>;
  previewMediaInputs: Map<PreviewMediaSlot, PreviewMediaEntry>;
  previewMediaLoadGeneration: Map<PreviewMediaSlot, number>;
  previewMediaLoading: Set<PreviewMediaSlot>;
};

export function createPreviewMediaState(): PreviewMediaState {
  return {
    previewMediaErrors: new Map(),
    previewMediaInputs: new Map(),
    previewMediaLoadGeneration: new Map(),
    previewMediaLoading: new Set(),
  };
}
