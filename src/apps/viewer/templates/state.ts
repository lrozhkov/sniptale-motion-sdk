import type { EditorTemplateSource } from "./model.js";

export type ViewerTemplateState = {
  currentTemplate: EditorTemplateSource | null;
  templates: EditorTemplateSource[];
};

export function createViewerTemplateState(): ViewerTemplateState {
  return { currentTemplate: null, templates: [] };
}
