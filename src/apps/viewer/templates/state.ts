import type { EffectV1Document } from "../../../sdk/effect-v1/types.js";
import type { GraphEditorViewport } from "../graph-editor/state.js";
import type { EditorTemplateSource } from "./model.js";

export type EditorModule = {
  document: EffectV1Document;
  id: string;
  path: string;
};
export type ViewerPackMetadata = Record<string, unknown> & {
  packId: string;
  version?: string;
  engineVersion?: string;
};

export type ViewerTemplateState = {
  modules: Map<string, EditorModule>;
  pack: ViewerPackMetadata | null;
  currentTemplate: EditorTemplateSource | null;
  templates: EditorTemplateSource[];
  compositionWorkspaceViews: Map<string, CompositionWorkspaceView>;
};

export function createViewerTemplateState(): ViewerTemplateState {
  return {
    modules: new Map(),
    pack: null,
    currentTemplate: null,
    templates: [],
    compositionWorkspaceViews: new Map(),
  };
}

export type CompositionWorkspaceView = {
  canvasIsolationGroupId: string | null;
  expandedSceneIds: string[];
  expandedTimelineRowIds: string[];
  graphEditorEnabled: boolean;
  graphEditorViewport: GraphEditorViewport | null;
  previewScrollLeft: number;
  previewScrollTop: number;
  previewZoom: string;
  timelineOffset: number;
  timelineScrollTop: number;
  timelineZoom: number;
};
