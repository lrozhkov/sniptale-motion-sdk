import { hasValidSandboxRenderFields } from "./render-message-validation.js";

export type SandboxRenderFrameMessage = {
  assets?: Record<string, unknown>;
  bindingLayerId?: string;
  bindingReadMode?: "contract" | "full" | "selection";
  clips?: Array<Record<string, unknown>>;
  controls?: Record<string, unknown>;
  directPresentation?: boolean;
  directResponse?: boolean;
  duration?: number;
  effectId: string;
  fps?: number;
  frameIndex?: number;
  height: number;
  inputFrames?: Record<string, unknown>;
  kind: "renderFrame";
  layers?: Array<Record<string, unknown>>;
  opaqueBackground?: boolean;
  outputHeight?: number;
  outputWidth?: number;
  previewCacheEnabled?: boolean;
  previewCacheRange?: { endFrame: number; startFrame: number };
  previewCacheWarm?: boolean;
  profileCanvasOperations?: boolean;
  profileRender?: boolean;
  progress?: number;
  renderAssetsId?: string;
  renderModel?: Record<string, unknown>;
  renderModelId?: string;
  renderQuality: "full" | "reduced";
  requestId: string;
  scenes?: Array<Record<string, unknown>>;
  sequenceId: number;
  target?: { kind: string };
  time?: number;
  timeline?: Record<string, unknown>;
  width: number;
};

export function parseSandboxRenderFrameMessage(
  message: Record<string, unknown>,
): SandboxRenderFrameMessage | null {
  if (!hasValidSandboxRenderFields(message)) return null;
  const previewCacheRange = message.previewCacheRange as
    | { endFrame: number; startFrame: number }
    | undefined;
  return {
    ...(message.assets === undefined ? {} : { assets: message.assets }),
    ...(message.bindingLayerId === undefined
      ? {}
      : { bindingLayerId: message.bindingLayerId }),
    ...(message.bindingReadMode === undefined
      ? {}
      : { bindingReadMode: message.bindingReadMode }),
    ...(message.clips === undefined ? {} : { clips: message.clips }),
    ...(message.controls === undefined ? {} : { controls: message.controls }),
    ...(message.directPresentation === undefined
      ? {}
      : { directPresentation: message.directPresentation }),
    ...(message.directResponse === undefined
      ? {}
      : { directResponse: message.directResponse }),
    ...(message.duration === undefined ? {} : { duration: message.duration }),
    effectId: message.effectId,
    ...(message.fps === undefined ? {} : { fps: message.fps }),
    ...(message.frameIndex === undefined
      ? {}
      : { frameIndex: message.frameIndex }),
    height: message.height,
    ...(message.inputFrames === undefined
      ? {}
      : { inputFrames: message.inputFrames }),
    kind: "renderFrame",
    ...(message.layers === undefined ? {} : { layers: message.layers }),
    ...(message.opaqueBackground === undefined
      ? {}
      : { opaqueBackground: message.opaqueBackground }),
    ...(message.outputHeight === undefined
      ? {}
      : { outputHeight: message.outputHeight }),
    ...(message.outputWidth === undefined
      ? {}
      : { outputWidth: message.outputWidth }),
    ...(message.previewCacheEnabled === undefined
      ? {}
      : { previewCacheEnabled: message.previewCacheEnabled }),
    ...(previewCacheRange === undefined
      ? {}
      : {
          previewCacheRange: {
            endFrame: previewCacheRange.endFrame,
            startFrame: previewCacheRange.startFrame,
          },
        }),
    ...(message.previewCacheWarm === undefined
      ? {}
      : { previewCacheWarm: message.previewCacheWarm }),
    ...(message.profileCanvasOperations === undefined
      ? {}
      : { profileCanvasOperations: message.profileCanvasOperations }),
    ...(message.profileRender === undefined
      ? {}
      : { profileRender: message.profileRender }),
    ...(message.progress === undefined ? {} : { progress: message.progress }),
    ...(message.renderAssetsId === undefined
      ? {}
      : { renderAssetsId: message.renderAssetsId }),
    ...(message.renderModel === undefined
      ? {}
      : { renderModel: message.renderModel }),
    ...(message.renderModelId === undefined
      ? {}
      : { renderModelId: message.renderModelId }),
    renderQuality: message.renderQuality === "reduced" ? "reduced" : "full",
    requestId: message.requestId,
    ...(message.scenes === undefined ? {} : { scenes: message.scenes }),
    sequenceId: (message.sequenceId ?? 0) as number,
    ...(message.target === undefined ? {} : { target: message.target }),
    ...(message.time === undefined ? {} : { time: message.time }),
    ...(message.timeline === undefined ? {} : { timeline: message.timeline }),
    width: message.width,
  } as SandboxRenderFrameMessage;
}
