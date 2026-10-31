import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";
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

export type ViewerRenderTimings = {
  modelMs: number;
  inputFramesMs: number;
  assetsMs: number;
  modelEnvelopeMs: number;
  messageMs: number;
  requestMs: number;
  videoCacheMs: number;
  presentationMs: number;
  postProcessMs: number;
};
export type ViewerRenderProfile = {
  height: number;
  width: number;
  templateId: string;
  time: number;
  totalMs: number;
  sandbox: SandboxRenderProfile | null;
  viewer: ViewerRenderTimings;
};

export type ViewerRenderingState = {
  lastRenderProfile: ViewerRenderProfile | null;
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
    lastRenderProfile: null,
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
