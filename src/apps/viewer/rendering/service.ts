import type { ViewerAppContext } from "../app/context.js";
import { resolveViewerRenderFailureMessage } from "./errors.js";
import { resolveViewerRenderTimeoutMs } from "./timeouts.js";
import { shouldReportSandboxRequestFailure } from "../transport/sandbox-client.js";
import { recordPreviewFrameCacheResult } from "./preview-frame-cache.js";
import { shouldCapturePlaybackBindingReads } from "./binding-read-cadence.js";
import { invalidateStalePlaybackVideoCache } from "./video-cache-guard.js";
import { resolvePreviewCacheRenderTime } from "../playback/cache-warm.js";
import { resolvePreviewCacheFrameRange } from "../playback/cache-range.js";
import {
  resolvePreviewFrameCachePolicy,
  shouldCapturePlaybackVideoCacheFrame,
  shouldRecordPreviewFrameCacheResult,
} from "./preview-cache-policy.js";
import { mergeQueuedRenderOptions } from "./render-queue.js";
import { beginViewerRenderProfile } from "./render-profile-state.js";
import { beginDirectLiveRenderProfile } from "./direct-live-policy.js";
export async function renderCurrentFrame(
  ctx: ViewerAppContext,
  options: any = {},
) {
  if (ctx.state.currentTemplate?.domMotion) {
    await ctx.renderDomMotionFrame();
    return;
  }
  ctx.disposeDomMotionSurface?.();
  invalidateStalePlaybackVideoCache(ctx);
  if (ctx.state.renderInFlight) {
    ctx.state.droppedFrames += 1;
    ctx.state.renderQueued = true;
    ctx.state.queuedRenderOptions = mergeQueuedRenderOptions(
      ctx.state.queuedRenderOptions,
      options,
    );
    return ctx.waitForRenderIdle();
  }
  const template = ctx.state.currentTemplate;
  if (!template || !ctx.state.sandboxReady) {
    return;
  }
  ctx.state.renderInFlight = true;
  ctx.state.renderQueued = false;
  ctx.setRenderStatus("rendering");
  try {
    if (!ctx.state.loadedModules.has(template.moduleId)) {
      if (!(await ctx.ensureModuleLoaded(template.moduleId))) {
        return;
      }
    }
    const previewStartedAt = performance.now();
    const renderProfile = beginViewerRenderProfile(options.profile === true);
    const directLiveProfile = beginDirectLiveRenderProfile(
      ctx,
      template,
      options.profile === true,
    );
    const effectiveTemplate = ctx.getRenderTemplateSnapshot(template);
    const duration = effectiveTemplate.duration;
    const { height: outputHeight, width: outputWidth } =
      ctx.getCompositionDesignSize();
    const { height: rasterHeight, width: rasterWidth } =
      ctx.getPreviewRasterSize();
    renderProfile?.mark("modelMs");
    if (rasterWidth * rasterHeight > ctx.deps.MAX_RENDER_PIXELS) {
      ctx.logDiagnostic("Render size exceeds prototype safety limit.", "error");
      return;
    }
    const renderPlan = ctx.getPreviewRenderPlan(
      rasterWidth,
      rasterHeight,
      options,
    );
    const width = renderPlan.width;
    const height = renderPlan.height;
    const playbackTime = ctx.deps.clamp(
      Number(ctx.refs.timeSlider.value),
      0,
      duration,
    );
    const time = ctx.deps.clamp(
      resolvePreviewCacheRenderTime(ctx.state, playbackTime),
      0,
      duration,
    );
    if (ctx.refs.timeSlider.value !== String(playbackTime)) {
      ctx.refs.timeSlider.value = String(playbackTime);
    }
    if (ctx.refs.fullscreenTimeSlider && ctx.isPreviewFullscreenActive()) {
      if (ctx.refs.fullscreenTimeSlider.max !== String(duration)) {
        ctx.refs.fullscreenTimeSlider.max = String(duration);
      }
      if (ctx.refs.fullscreenTimeSlider.value !== String(playbackTime)) {
        ctx.refs.fullscreenTimeSlider.value = String(playbackTime);
      }
    }
    const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
    const progress = duration > 0 ? time / duration : 0;
    const sequenceId = ++ctx.state.frameSequence;
    if (!ctx.state.playing) {
      const formattedTime = ctx.formatSeconds(time);
      ctx.refs.timeOutput.textContent = formattedTime;
      if (ctx.refs.fullscreenTimeOutput && ctx.isPreviewFullscreenActive()) {
        ctx.refs.fullscreenTimeOutput.textContent = formattedTime;
      }
    }
    const renderInput = await ctx.createRenderInputFrames(
      effectiveTemplate,
      outputWidth,
      outputHeight,
      progress,
    );
    renderProfile?.mark("inputFramesMs");
    const renderAssets = await ctx.createRenderAssets(effectiveTemplate);
    renderProfile?.mark("assetsMs");
    const renderModel = ctx.createRenderModelEnvelope(effectiveTemplate);
    renderProfile?.mark("modelEnvelopeMs");
    const directPresentation =
      options.directPresentation === true ||
      ctx.shouldUseDirectPreviewSurface(template, renderPlan);
    const previewFrameCachePolicy =
      options.profile === true
        ? { requested: false, warming: false }
        : resolvePreviewFrameCachePolicy(
            ctx.state,
            ctx.state.previewVideoCache?.fallbackKey
              ? false
              : ctx.shouldPreferPlaybackVideoCache?.(template) === true,
          );
    const previewFrameCacheActive = previewFrameCachePolicy.warming;
    const previewCacheRange = previewFrameCacheActive
      ? resolvePreviewCacheFrameRange({
          duration,
          fps,
          range: ctx.state.playbackRange,
        })
      : null;
    const playbackBindingLayerId = ctx.state.playing
      ? ctx.getCanvasSelectionLayerId(effectiveTemplate)
      : null;
    const capturePlaybackBindings =
      ctx.state.playing &&
      shouldCapturePlaybackBindingReads(
        ctx.state,
        playbackBindingLayerId,
        previewStartedAt,
      );
    const capturePlaybackVideoFrame = shouldCapturePlaybackVideoCacheFrame(
      ctx.state,
    );
    const message = {
      ...renderAssets.envelope,
      ...(ctx.state.playing
        ? {
            ...(capturePlaybackBindings
              ? { bindingLayerId: playbackBindingLayerId }
              : {}),
            bindingReadMode: "selection",
          }
        : {}),
      controls: ctx.state.controls,
      ...(directPresentation ? { directPresentation: true } : {}),
      previewCacheEnabled: previewFrameCachePolicy.requested,
      ...(previewFrameCacheActive ? { previewCacheWarm: true } : {}),
      ...(previewCacheRange
        ? {
            previewCacheRange: {
              endFrame: previewCacheRange.endFrame,
              startFrame: previewCacheRange.startFrame,
            },
          }
        : {}),
      effectId: template.effectId,
      fps,
      frameIndex: Math.round(time * fps),
      height,
      inputFrames: renderInput.frames,
      kind: "renderFrame",
      outputHeight,
      outputWidth,
      progress,
      ...directLiveProfile.message,
      requestId: ctx.deps.createRequestId("frame"),
      renderQuality: renderPlan.renderQuality,
      rendererType: ctx.getRendererType(template),
      ...renderModel,
      sequenceId,
      target: { kind: template.target },
      time,
      width,
    };
    renderProfile?.mark("messageMs");
    try {
      const result = await ctx.requestSandbox(
        message,
        resolveViewerRenderTimeoutMs(
          options.forceFull === true,
          !options.allowColdStart &&
            (options.interactive === true ||
              ctx.state.playing ||
              ctx.state.canvasTransformDragActive),
          previewFrameCachePolicy.requested ||
            ctx.state.previewVideoCache?.recording === true,
          width * height,
        ),
        [...renderInput.transfer, ...renderAssets.transfer],
      );
      renderProfile?.mark("requestMs");
      if (!result.ok) {
        ctx.setRenderStatus("failed");
        ctx.logDiagnostic(
          `${template.id}: ${resolveViewerRenderFailureMessage(ctx.deps.t, result)}`,
          "error",
        );
        return;
      }
      ctx.commitRenderAssetTransfers(renderAssets);
      ctx.commitRenderModelEnvelope(renderModel);
      ctx.markSandboxRenderHealthy(template.id);
      if (result.sequenceId !== ctx.state.frameSequence) {
        ctx.state.staleResponses += 1;
        result.bitmap?.close?.();
        return;
      }
      directLiveProfile.commit(result.renderProfile);
      const videoCacheStep = capturePlaybackVideoFrame
        ? await ctx.capturePlaybackVideoCacheFrame?.({
            fps,
            result,
            time,
          })
        : null;
      renderProfile?.mark("videoCacheMs");
      if (videoCacheStep?.captured) {
        result.bitmap?.close?.();
      } else {
        ctx.drawCompletedFrame(template, result.bitmap, progress, result);
      }
      renderProfile?.mark("presentationMs");
      const previewLatencyMs = performance.now() - previewStartedAt;
      if (!ctx.state.playing || capturePlaybackBindings) {
        ctx.state.lastBindingReads = ctx.normalizePreviewBindingReads(
          result.bindingReads,
        );
      }
      if (
        options.forceFull === true &&
        ctx.state.canvasTransformPreview?.awaitingFullRender
      ) {
        ctx.state.canvasTransformPreview = null;
      }
      if (!ctx.state.playing) {
        ctx.mergeRendererContractReads(template.id, ctx.state.lastBindingReads);
      }
      ctx.updateRenderStats(
        result.durationMs,
        renderPlan.scale,
        previewLatencyMs,
        result.previewCacheHit !== true,
      );
      if (shouldRecordPreviewFrameCacheResult(ctx.state, videoCacheStep)) {
        const previousCacheFrames = ctx.state.previewFrameCacheFrames;
        recordPreviewFrameCacheResult(ctx.state, result);
        ctx.advancePlaybackCacheWarmResult?.(result, {
          currentTime: time,
          duration,
          frameLatencyMs: previewLatencyMs,
          fps,
          previousCacheFrames,
        });
      }
      ctx.syncPreviewQualityBadge(renderPlan.scale);
      if (options.forceFull === true) {
        ctx.state.interactivePreviewScale = 1;
      }
      ctx.setRenderStatus("applied");
      if (
        ctx.state.activeSidebarGroup === "health" &&
        ctx.state.activeHealthTab === "renderer"
      ) {
        ctx.renderRendererBindingsPanel(template);
      }
      if (ctx.state.playing && capturePlaybackBindings) {
        ctx.scheduleCanvasSelectionPlaybackUpdate();
      } else {
        if (!ctx.state.playing) {
          ctx.updateCanvasSelectionBox();
        }
      }
      renderProfile?.mark("postProcessMs");
      renderProfile?.finish(ctx, {
        height,
        sandbox: result.renderProfile,
        templateId: template.id,
        time,
        width,
      });
    } catch (error) {
      ctx.setRenderStatus("failed");
      if (shouldReportSandboxRequestFailure(error)) {
        ctx.logDiagnostic(
          `${template.id}: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    }
  } finally {
    ctx.state.renderInFlight = false;
    if (ctx.state.renderQueued) {
      const queuedOptions = ctx.state.queuedRenderOptions ?? {};
      ctx.state.renderQueued = false;
      ctx.state.queuedRenderOptions = null;
      await ctx.renderCurrentFrame(queuedOptions);
    } else {
      ctx.schedulePlaybackRenderContinuation?.();
    }
    ctx.resolveRenderIdleWaiters();
  }
}
