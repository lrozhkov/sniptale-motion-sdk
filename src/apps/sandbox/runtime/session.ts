import { closeAssetBitmaps } from "./render-assets.js";
import { createRenderContext, renderSvgToCanvas } from "./render-context.js";
import { serializeFrameBindingReads } from "./binding-reads.js";
import { normalizeRenderResult } from "./render-result.js";
import { createRenderAssetCache } from "./render-asset-cache.js";
import { createFrameCanvasPool } from "./frame-canvas-pool.js";
import { createLogicalCanvasFactory } from "./logical-canvas.js";
import { createRenderModelCache } from "./render-model-cache.js";
import { createPreviewFrameCache } from "./preview-frame-cache.js";
import { applyPreviewFrameCacheSample } from "./preview-frame-cache-key.js";
import {
  createPreviewCacheMetrics,
  resolvePreviewCacheSessionFrame,
  storePreviewCacheSessionFrame,
} from "./preview-frame-cache-session.js";
import {
  beginSandboxRenderProgress,
  type SandboxRenderProgressPhase,
} from "./render-progress.js";
import {
  createSandboxRenderProfile,
  recordSandboxRenderProfilePhase,
} from "./render-profile.js";
import { createCanvasOperationProfiler } from "./canvas-operation-profile.js";
import { createDirectRenderSurfaceLease } from "./direct-render-surface.js";
import { handleEffectDocumentMessage } from "./effect-v1/message-session.js";
import { recordRenderAssetProfile } from "./render-asset-profile.js";

export function createSandboxSession({
  postToParent,
  previewPresenter = null,
  registry,
  runtime,
}) {
  const assetCache = createRenderAssetCache();
  const canvasPool = createFrameCanvasPool((width, height) =>
    runtime.createCanvas(width, height),
  );
  const renderModelCache = createRenderModelCache();
  const previewFrameCache = createPreviewFrameCache();
  let renderQueue = Promise.resolve();
  return {
    async handleMessage(message, responseSink = postToParent) {
      if (
        await handleEffectDocumentMessage({
          canvasPool,
          message,
          registry,
          renderQueue,
          responseSink,
          runtime,
        })
      )
        return;
      if (message.kind === "renderFrame") {
        const queuedAt = performance.now();
        const renderProgress = beginSandboxRenderProgress({
          previewCacheEnabled: message.previewCacheEnabled === true,
          post: responseSink,
          requestId: message.requestId,
          sequenceId: message.sequenceId,
        });
        const pendingRender = renderQueue
          .then(() => {
            renderProgress.setPhase("rendering");
            return renderFrame(
              responseSink,
              registry,
              runtime,
              assetCache,
              canvasPool,
              renderModelCache,
              previewFrameCache,
              previewPresenter,
              message,
              renderProgress.setPhase,
              queuedAt,
            );
          })
          .finally(renderProgress.stop);
        renderQueue = pendingRender.catch(() => undefined);
        await pendingRender;
        return;
      }
      if (message.kind === "dispose") {
        await renderQueue;
        assetCache.close();
        canvasPool.close();
        renderModelCache.clear();
        previewFrameCache.close();
        registry.disposeAll();
      }
    },
  };
}

async function renderFrame(
  postToParent,
  registry,
  runtime,
  assetCache,
  canvasPool,
  renderModelCache,
  previewFrameCache,
  previewPresenter,
  message,
  setProgressPhase: (phase: SandboxRenderProgressPhase) => void,
  queuedAt: number,
) {
  const startedAt = performance.now();
  const profile = createSandboxRenderProfile(
    message.profileRender === true ? startedAt - queuedAt : null,
  );
  let context = null;
  let resolvedMessage = message;
  let canvasLease = null;
  let canvasProfiler = null;
  let directRenderSurfaceLease = null;
  try {
    let phaseStartedAt = performance.now();
    resolvedMessage = renderModelCache.resolve(message);
    recordSandboxRenderProfilePhase(profile, "modelResolveMs", phaseStartedAt);
    const renderer = registry.getRenderer(resolvedMessage.effectId);
    if (!renderer) {
      throw new Error(`Unknown renderer ${resolvedMessage.effectId}.`);
    }
    phaseStartedAt = performance.now();
    const assets = assetCache.resolve(
      resolvedMessage.assets,
      resolvedMessage.renderAssetsId,
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
    directRenderSurfaceLease = createDirectRenderSurfaceLease({
      cacheRequest,
      directPresentation,
      fallback: canvasLease.createCanvas,
      height: resolvedMessage.height,
      presenter: previewPresenter,
      width: resolvedMessage.width,
    });
    const createFrameCanvas = directRenderSurfaceLease.createCanvas;
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
    const createLogicalCanvas = createLogicalCanvasFactory({
      createCanvas: canvasProfiler?.createCanvas ?? createFrameCanvas,
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
              canvasLease.createCanvas,
            ),
          {
            createCanvas: canvasLease.createCanvas,
            height: resolvedMessage.height,
            opaqueBackground: resolvedMessage.opaqueBackground === true,
            width: resolvedMessage.width,
          },
        );
    recordSandboxRenderProfilePhase(profile, "normalizeMs", phaseStartedAt);
    const previewWidth = renderedDirectly ? result.width : bitmap.width;
    const previewHeight = renderedDirectly ? result.height : bitmap.height;
    phaseStartedAt = performance.now();
    const bindingReads = serializeFrameBindingReads(
      context,
      resolvedMessage.bindingReadMode === "selection"
        ? {
            primitiveLayerId: resolvedMessage.bindingLayerId,
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
      presented = previewPresenter.commitRenderSurface(result) === true;
      if (presented) {
        presentedAtMs = performance.now();
        presentedAtEpochMs = performance.timeOrigin + presentedAtMs;
      }
    } else if (directPresentation) {
      try {
        presented = previewPresenter.present(bitmap) === true;
        if (presented) {
          presentedAtMs = performance.now();
          presentedAtEpochMs = performance.timeOrigin + presentedAtMs;
        }
      } catch {
        presented = false;
      }
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
      presented ? [] : [bitmap],
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
