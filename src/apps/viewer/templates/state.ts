import type { GraphEditorViewport } from "../graph-editor/state.js";
import type { EditorTemplateSource } from "./model.js";

export type ViewerTemplateState = {
  currentTemplate: EditorTemplateSource | null;
  templates: EditorTemplateSource[];
  compositionWorkspaceViews: Map<string, CompositionWorkspaceView>;
};

export function createViewerTemplateState(): ViewerTemplateState {
  return {
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
