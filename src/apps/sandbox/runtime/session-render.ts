import type { RuntimeCanvas } from "./canvas-model.js";
import { closeAssetBitmaps } from "./render-assets.js";
import { createRenderContext, renderSvgToCanvas } from "./render-context.js";
import { serializeFrameBindingReads } from "./binding-reads.js";
import { normalizeRenderResult } from "./render-result.js";
import type { createRenderAssetCache } from "./render-asset-cache.js";
import type { FrameCanvasPool, FrameCanvasLease } from "./frame-canvas-pool.js";
import { createLogicalCanvasFactory } from "./logical-canvas.js";
import type { createRenderModelCache } from "./render-model-cache.js";
import type { createPreviewFrameCache } from "./preview-frame-cache.js";
import { applyPreviewFrameCacheSample } from "./preview-frame-cache-key.js";
import {
  createPreviewCacheMetrics,
  resolvePreviewCacheSessionFrame,
  storePreviewCacheSessionFrame,
} from "./preview-frame-cache-session.js";
import type { SandboxRenderProgressPhase } from "./render-progress.js";
import {
  createSandboxRenderProfile,
  recordSandboxRenderProfilePhase,
} from "./render-profile.js";
import { createCanvasOperationProfiler } from "./canvas-operation-profile.js";
import { createDirectRenderSurfaceLease } from "./direct-render-surface.js";
import { recordRenderAssetProfile } from "./render-asset-profile.js";
import type { SandboxSessionOptions } from "./session-model.js";
import type { SandboxRenderFrameMessage } from "./render-message-boundary.js";

export async function renderSandboxFrame(
  postToParent: SandboxSessionOptions["postToParent"],
  registry: SandboxSessionOptions["registry"],
  runtime: SandboxSessionOptions["runtime"],
  assetCache: ReturnType<typeof createRenderAssetCache>,
  canvasPool: FrameCanvasPool,
  renderModelCache: ReturnType<typeof createRenderModelCache>,
  previewFrameCache: ReturnType<typeof createPreviewFrameCache>,
  previewPresenter: SandboxSessionOptions["previewPresenter"],
  message: SandboxRenderFrameMessage,
  setProgressPhase: (phase: SandboxRenderProgressPhase) => void,
  queuedAt: number,
) {
  const startedAt = performance.now();
  const profile = createSandboxRenderProfile(
    message.profileRender === true ? startedAt - queuedAt : null,
  );
  let context: ReturnType<typeof createRenderContext> | null = null;
  const resolvedMessage = message;
  let canvasLease: FrameCanvasLease | null = null;
  let canvasProfiler: ReturnType<
    typeof createCanvasOperationProfiler<RuntimeCanvas>
  > | null = null;
  let directRenderSurfaceLease: ReturnType<
    typeof createDirectRenderSurfaceLease
  > | null = null;
  try {
    let phaseStartedAt = performance.now();
    renderModelCache.resolve(resolvedMessage);
    recordSandboxRenderProfilePhase(profile, "modelResolveMs", phaseStartedAt);
    const renderer = registry.getRenderer(resolvedMessage.effectId);
    if (!renderer) {
      throw new Error(`Unknown renderer ${resolvedMessage.effectId}.`);
    }
    phaseStartedAt = performance.now();
    const assets = assetCache.resolve(
      resolvedMessage.assets,
      resolvedMessage.renderAssetsId,
      resolvedMessage.retainedAssetIds,
    );
    recordRenderAssetProfile(profile, assets);
    resolvedMessage.assets = assets;
    recordSandboxRenderProfilePhase(profile, "assetResolveMs", phaseStartedAt);
    phaseStartedAt = performance.now();
    const cacheSessionFrame = await resolvePreviewCacheSessionFrame({
      message: resolvedMessage,
      postToParent,
      previewFrameCache,
      previewPresenter,
      startedAt,
    });
    recordSandboxRenderProfilePhase(profile, "cacheLookupMs", phaseStartedAt);
    const { cacheRequest, directPresentation } = cacheSessionFrame;
    if (cacheSessionFrame.handled) {
      return;
    }
    if (cacheRequest) {
      applyPreviewFrameCacheSample(resolvedMessage, cacheRequest);
    }
    phaseStartedAt = performance.now();
    canvasLease = canvasPool.beginFrame(String(resolvedMessage.effectId));
    const pooledCreateCanvas = canvasLease.createCanvas;
    const surfaceLease = createDirectRenderSurfaceLease({
      cacheRequest,
      directPresentation,
      fallback: pooledCreateCanvas,
      height: resolvedMessage.height,
      presenter: previewPresenter,
      width: resolvedMessage.width,
    });
    directRenderSurfaceLease = surfaceLease;
    const createFrameCanvas = (width: number, height: number) =>
      surfaceLease.createCanvas(width, height);
    canvasProfiler =
      profile && message.profileCanvasOperations === true
        ? createCanvasOperationProfiler(createFrameCanvas, profile)
        : null;
    runtime.__bindingReadMode = resolvedMessage.bindingReadMode ?? null;
    runtime.__renderQuality = resolvedMessage.renderQuality;
    runtime.__renderViewport = {
      height: resolvedMessage.height,
      width: resolvedMessage.width,
    };
    const profiler = canvasProfiler;
    const createLogicalCanvas = createLogicalCanvasFactory({
      createCanvas: profiler
        ? (width, height) => profiler.createCanvas(width, height)
        : createFrameCanvas,
      outputHeight: resolvedMessage.outputHeight ?? resolvedMessage.height,
      outputWidth: resolvedMessage.outputWidth ?? resolvedMessage.width,
      renderHeight: resolvedMessage.height,
      renderWidth: resolvedMessage.width,
    });
    recordSandboxRenderProfilePhase(profile, "canvasSetupMs", phaseStartedAt);
    phaseStartedAt = performance.now();
    context = createRenderContext(
      resolvedMessage,
      renderer,
      runtime,
      createLogicalCanvas,
    );
    recordSandboxRenderProfilePhase(profile, "renderContextMs", phaseStartedAt);
    runtime.__bindingReads = context.__bindingReads;
    phaseStartedAt = performance.now();
    const result = await renderer.renderFrame(context);
    recordSandboxRenderProfilePhase(profile, "rendererMs", phaseStartedAt);
    phaseStartedAt = performance.now();
    const renderedDirectly = directRenderSurfaceLease.owns(result);
    const bitmap = renderedDirectly
      ? null
      : await normalizeRenderResult(
          result,
          context,
          (markup, width, height) =>
            renderSvgToCanvas(
              markup,
              width,
              height,
              runtime,
              pooledCreateCanvas,
            ),
          {
            createCanvas: pooledCreateCanvas,
            height: resolvedMessage.height,
            opaqueBackground: resolvedMessage.opaqueBackground === true,
            width: resolvedMessage.width,
          },
        );
    recordSandboxRenderProfilePhase(profile, "normalizeMs", phaseStartedAt);
    const previewWidth = bitmap
      ? bitmap.width
      : readDirectResultDimension(result, "width");
    const previewHeight = bitmap
      ? bitmap.height
      : readDirectResultDimension(result, "height");
    phaseStartedAt = performance.now();
    const bindingReads = serializeFrameBindingReads(
      context,
      resolvedMessage.bindingReadMode === "selection"
        ? {
            ...(resolvedMessage.bindingLayerId === undefined
              ? {}
              : { primitiveLayerId: resolvedMessage.bindingLayerId }),
            selectionOnly: true,
          }
        : {},
    );
    recordSandboxRenderProfilePhase(profile, "bindingReadsMs", phaseStartedAt);
    const renderedAtMs = performance.now();
    let presented = false;
    let presentedAtMs: number | null = null;
    let presentedAtEpochMs: number | null = null;
    setProgressPhase("preview-cache-store");
    phaseStartedAt = performance.now();
    const previewCacheStoreMs = bitmap
      ? await storePreviewCacheSessionFrame({
          bitmap,
          bindingReads,
          cacheRequest,
          directPresentation,
          previewFrameCache,
          previewPresenter,
        })
      : 0;
    recordSandboxRenderProfilePhase(profile, "cacheStoreMs", phaseStartedAt);
    setProgressPhase("rendering");
    phaseStartedAt = performance.now();
    if (renderedDirectly) {
      presented = previewPresenter?.commitRenderSurface(result) === true;
      if (presented) {
        presentedAtMs = performance.now();
        presentedAtEpochMs = performance.timeOrigin + presentedAtMs;
      }
    } else if (directPresentation) {
      try {
        presented =
          bitmap !== null && previewPresenter?.present(bitmap) === true;
        if (presented) {
          presentedAtMs = performance.now();
          presentedAtEpochMs = performance.timeOrigin + presentedAtMs;
        }
      } catch {
        presented = false;
      }
    }
    if (!presented && !bitmap) {
      throw new Error("Direct preview surface could not be presented.");
    }
    recordSandboxRenderProfilePhase(profile, "presentationMs", phaseStartedAt);
    if (profile) {
      profile.totalMs = performance.now() - queuedAt;
    }
    const cacheStats = cacheRequest
      ? previewFrameCache.getStats(cacheRequest)
      : null;
    postToParent(
      {
        ...(bindingReads ? { bindingReads } : {}),
        durationMs: renderedAtMs - startedAt,
        kind: "renderFrameResult",
        ok: true,
        ...(cacheStats
          ? {
              ...createPreviewCacheMetrics(cacheStats),
              previewCacheHit: false,
              previewCacheStoreMs,
            }
          : {}),
        ...(profile ? { renderProfile: profile } : {}),
        requestId: resolvedMessage.requestId,
        sequenceId: resolvedMessage.sequenceId,
        ...(presented
          ? {
              presented: true,
              presentedAtEpochMs,
              presentedAtMs,
              previewHeight,
              previewWidth,
            }
          : { bitmap }),
      },
      bitmap && !presented ? [bitmap] : [],
    );
  } catch (error) {
    postToParent({
      durationMs: performance.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      kind: "renderFrameResult",
      ok: false,
      requestId: resolvedMessage.requestId,
      sequenceId: resolvedMessage.sequenceId,
    });
  } finally {
    canvasProfiler?.restore();
    canvasLease?.release();
    if (runtime) {
      runtime.__bindingReads = null;
      runtime.__bindingReadMode = null;
      runtime.__renderQuality = "full";
      runtime.__renderViewport = null;
    }
    closeAssetBitmaps(resolvedMessage.inputFrames);
  }
}

function readDirectResultDimension(
  value: unknown,
  key: "width" | "height",
): number {
  if (value === null || typeof value !== "object" || !(key in value))
    throw new Error("Missing direct render dimensions.");
  const dimension: unknown = Reflect.get(value, key);
  if (
    typeof dimension !== "number" ||
    !Number.isFinite(dimension) ||
    dimension <= 0
  )
    throw new Error("Invalid direct render dimensions.");
  return dimension;
}
