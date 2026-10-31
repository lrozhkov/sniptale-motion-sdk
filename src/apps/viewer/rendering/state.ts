import type { SerializedSvgVectorSource } from "../../../shared/svg-vector-source.js";
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
  sandboxAssetVersions: Map<
    string,
    { cacheKey: string; sessionKeys: Set<string> }
  >;
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
    sandboxAssetVersions: new Map(),
  };
}

export type TransferredAsset = {
  cacheKey: string;
  id: string;
  bitmap?: ImageBitmap;
  height?: number;
  width?: number;
  kind?: string | null | undefined;
  mimeType?: string | undefined;
  path?: string | null | undefined;
  svgText?: string | null | undefined;
  svgVector?: SerializedSvgVectorSource | undefined;
};
export type RenderAssetTransfer = {
  runtimeGeneration?: number;
  assetVersions?: Array<{ id: string; cacheKey: string; sessionKey: string }>;
  cacheKeys: string[];
  envelope: {
    assets?: Record<string, TransferredAsset>;
    retainedAssetIds?: string[];
    renderAssetsId: string;
  };
  transfer: ImageBitmap[];
};
