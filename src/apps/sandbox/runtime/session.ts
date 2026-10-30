import type { SandboxRuntimeMessage } from "./message-boundary.js";
import type { SandboxSessionOptions } from "./session-model.js";
import { renderSandboxFrame } from "./session-render.js";
import { createRenderAssetCache } from "./render-asset-cache.js";
import { createFrameCanvasPool } from "./frame-canvas-pool.js";
import { createRenderModelCache } from "./render-model-cache.js";
import { createPreviewFrameCache } from "./preview-frame-cache.js";
import { beginSandboxRenderProgress } from "./render-progress.js";
import { handleEffectDocumentMessage } from "./effect-v1/message-session.js";
export function createSandboxSession({
  postToParent,
  previewPresenter = null,
  registry,
  runtime,
}: SandboxSessionOptions) {
  const assetCache = createRenderAssetCache();
  const canvasPool = createFrameCanvasPool((width, height) =>
    runtime.createCanvas(width, height),
  );
  const renderModelCache = createRenderModelCache();
  const previewFrameCache = createPreviewFrameCache();
  let renderQueue = Promise.resolve();
  return {
    async handleMessage(
      message: SandboxRuntimeMessage,
      responseSink = postToParent,
    ) {
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
            return renderSandboxFrame(
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
