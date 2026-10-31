import type { EditorTemplate } from "../templates/model.js";

export type RenderOptions = {
  allowColdStart?: boolean;
  directPresentation?: boolean;
  forceFull?: boolean;
  interactive?: boolean;
  profile?: boolean;
};

export type RenderTemplateSnapshot = {
  editorOverride: unknown;
  template: object;
  timelineOverride: unknown;
  value: EditorTemplate | null;
};

export type ViewerRenderingState = {
  renderIdleWaiters: (() => void)[];
  renderTemplateSnapshot: RenderTemplateSnapshot | null;
  queuedRenderOptions: RenderOptions | null;
  rendererContractRefreshPromise: Promise<unknown> | null;
  rendererContractRefreshTemplateId: string | null;
  rendererContractTemplateId: string | null;
  sandboxRenderModelId: string | null;
  sandboxRenderAssetsId: string | null;
};

export function createViewerRenderingState(): ViewerRenderingState {
  return {
    renderIdleWaiters: [],
    renderTemplateSnapshot: null,
    queuedRenderOptions: null,
    rendererContractRefreshPromise: null,
    rendererContractRefreshTemplateId: null,
    rendererContractTemplateId: null,
    sandboxRenderModelId: null,
    sandboxRenderAssetsId: null,
  };
}
