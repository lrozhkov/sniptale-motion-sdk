import type { ViewerAppContext } from "../app/context.js";
import { mergePrimitiveBounds } from "./contract-bounds.js";
import { resolveViewerRenderTimeoutMs } from "./timeouts.js";

const CONTRACT_PLAYBACK_RECHECK_INTERVAL_MS = 250;

function mergeRendererContractReads(ctx: ViewerAppContext, templateId, reads) {
  if (!templateId || ctx.state.rendererContractCoverageLockedForTest) {
    return;
  }
  const normalized = ctx.deps.normalizeBindingReads(reads);
  if (ctx.state.rendererContractTemplateId !== templateId) {
    ctx.state.rendererContractReads = ctx.deps.createEmptyBindingReads();
    ctx.state.rendererContractTemplateId = templateId;
  }
  const merged = ctx.state.rendererContractReads;
  for (const key of Object.keys(merged)) {
    if (key === "primitiveBounds") {
      merged[key] = mergePrimitiveBounds(merged[key], normalized[key]);
      continue;
    }
    merged[key] = Array.from(
      new Set([...(merged[key] ?? []), ...(normalized[key] ?? [])]),
    ).sort();
  }
}

function createRendererContractSampleTimes(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    return [];
  }
  const duration = ctx.getEffectiveDuration(effectiveTemplate);
  const times = new Set([0, duration]);
  for (const scene of effectiveTemplate.scenes ?? []) {
    addRangeSamples(times, scene.start, scene.duration);
  }
  for (const clip of effectiveTemplate.clips ?? []) {
    addRangeSamples(times, clip.start, clip.duration);
  }
  for (const phase of effectiveTemplate.timeline?.phases ?? []) {
    addRangeSamples(times, phase.start, phase.duration);
  }
  for (const track of effectiveTemplate.timeline?.tracks ?? []) {
    for (const keyframe of track.keyframes ?? []) {
      const time = Number(keyframe.time);
      if (Number.isFinite(time)) {
        times.add(time);
      }
    }
  }
  return Array.from(times)
    .filter((time) => Number.isFinite(time))
    .map((time) => ctx.deps.clamp(time, 0, duration))
    .sort((a, b) => a - b);
}

async function refreshRendererContractCoverage(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  if (
    !template ||
    !ctx.state.sandboxReady ||
    ctx.state.rendererContractCoverageLockedForTest
  ) {
    return ctx.state.rendererContractReads;
  }
  if (ctx.state.rendererContractRefreshing) {
    const activeTemplateId = ctx.state.rendererContractRefreshTemplateId;
    await ctx.state.rendererContractRefreshPromise;
    if (
      activeTemplateId !== template.id &&
      ctx.state.currentTemplate?.id === template.id
    ) {
      return refreshRendererContractCoverage(ctx, template);
    }
    return ctx.state.rendererContractReads;
  }
  ctx.state.rendererContractRefreshing = true;
  ctx.state.rendererContractRefreshTemplateId = template.id;
  const refreshPromise = runRendererContractCoverageRefresh(ctx, template);
  ctx.state.rendererContractRefreshPromise = refreshPromise;
  try {
    return await refreshPromise;
  } finally {
    if (ctx.state.rendererContractRefreshPromise === refreshPromise) {
      ctx.state.rendererContractRefreshPromise = null;
      ctx.state.rendererContractRefreshTemplateId = null;
      ctx.state.rendererContractRefreshing = false;
    }
  }
}

async function runRendererContractCoverageRefresh(
  ctx: ViewerAppContext,
  template,
) {
  const runtimeGeneration = ctx.state.sandboxRuntimeGeneration;
  if (ctx.state.renderInFlight || ctx.state.renderQueued) {
    await ctx.waitForRenderIdle();
  }
  if (
    ctx.state.currentTemplate?.id !== template.id ||
    ctx.state.sandboxRuntimeGeneration !== runtimeGeneration
  ) {
    return ctx.state.rendererContractReads;
  }
  ctx.state.rendererContractTemplateId = template.id;
  ctx.state.rendererContractCoverageReady = false;
  ctx.state.rendererContractReads = ctx.deps.createEmptyBindingReads();
  ctx.renderValidationPanel(template);
  ctx.updateExportAvailability();
  ctx.mergeRendererContractReads(template.id, ctx.state.lastBindingReads);
  if (!ctx.state.loadedModules.has(template.moduleId)) {
    if (!(await ctx.ensureModuleLoaded(template.moduleId))) {
      return ctx.state.rendererContractReads;
    }
  }
  const effectiveTemplate = ctx.getRenderTemplateSnapshot(template);
  if (!effectiveTemplate) {
    return ctx.state.rendererContractReads;
  }
  const duration = effectiveTemplate.duration;
  const width = ctx.refs.canvas.width;
  const height = ctx.refs.canvas.height;
  const sampleSize = ctx.getContractRenderSize(width, height);
  const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  for (const time of ctx.createRendererContractSampleTimes(template)) {
    if (
      ctx.buildRendererBindingCoverage(effectiveTemplate).unboundCount === 0
    ) {
      break;
    }
    await yieldToEditor();
    if (
      !(await waitForContractSampleSlot(ctx, template.id, runtimeGeneration))
    ) {
      return ctx.state.rendererContractReads;
    }
    await renderContractSample(ctx, template, effectiveTemplate, {
      duration,
      fps,
      height: sampleSize.height,
      outputHeight: height,
      outputWidth: width,
      time,
      width: sampleSize.width,
    });
    if (
      ctx.state.currentTemplate?.id !== template.id ||
      ctx.state.sandboxRuntimeGeneration !== runtimeGeneration
    ) {
      return ctx.state.rendererContractReads;
    }
    if (
      ctx.buildRendererBindingCoverage(effectiveTemplate).unboundCount === 0
    ) {
      break;
    }
  }
  if (
    ctx.state.currentTemplate?.id !== template.id ||
    ctx.state.sandboxRuntimeGeneration !== runtimeGeneration
  ) {
    return ctx.state.rendererContractReads;
  }
  ctx.state.rendererContractCoverageReady = true;
  ctx.renderValidationPanel(template);
  ctx.renderRendererBindingsPanel(template);
  ctx.updateExportAvailability();
  return ctx.state.rendererContractReads;
}

async function renderContractSample(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  { duration, fps, height, outputHeight, outputWidth, time, width },
) {
  const progress = duration > 0 ? time / duration : 0;
  const renderInput = await ctx.createRenderInputFrames(
    effectiveTemplate,
    outputWidth,
    outputHeight,
    progress,
  );
  const renderAssets = await ctx.createRenderAssets(effectiveTemplate);
  const renderModel = ctx.createRenderModelEnvelope(effectiveTemplate);
  const result = await ctx.requestSandbox(
    {
      ...renderAssets.envelope,
      bindingReadMode: "contract",
      controls: ctx.state.controls,
      effectId: template.effectId,
      fps,
      frameIndex: Math.round(time * fps),
      height,
      inputFrames: renderInput.frames,
      kind: "renderFrame",
      outputHeight,
      outputWidth,
      renderQuality: "reduced",
      progress,
      requestId: ctx.deps.createRequestId("contract"),
      rendererType: ctx.getRendererType(template),
      ...renderModel,
      sequenceId: 0,
      target: { kind: template.target },
      time,
      width,
    },
    resolveViewerRenderTimeoutMs(false, false),
    [...renderInput.transfer, ...renderAssets.transfer],
  );
  if (result.ok && ctx.state.currentTemplate?.id === template.id) {
    ctx.commitRenderAssetTransfers(renderAssets);
    ctx.commitRenderModelEnvelope(renderModel);
    ctx.mergeRendererContractReads(
      template.id,
      ctx.normalizePreviewBindingReads(result.bindingReads),
    );
  }
  result.bitmap?.close?.();
}

export async function waitForContractSampleSlot(
  ctx: ViewerAppContext,
  templateId,
  runtimeGeneration,
) {
  while (
    ctx.state.currentTemplate?.id === templateId &&
    ctx.state.sandboxRuntimeGeneration === runtimeGeneration &&
    (ctx.state.playing || ctx.state.renderInFlight || ctx.state.renderQueued)
  ) {
    if (ctx.state.playing) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, CONTRACT_PLAYBACK_RECHECK_INTERVAL_MS),
      );
      continue;
    }
    await ctx.waitForRenderIdle();
  }
  return (
    ctx.state.currentTemplate?.id === templateId &&
    ctx.state.sandboxRuntimeGeneration === runtimeGeneration &&
    ctx.state.sandboxReady &&
    !ctx.state.sandboxRecoveryPending &&
    !ctx.state.playing &&
    !ctx.state.renderInFlight &&
    !ctx.state.renderQueued
  );
}

function yieldToEditor() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => resolve(undefined), { timeout: 100 });
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

function addRangeSamples(times: Set<number>, rawStart, rawDuration) {
  const start = Number(rawStart) || 0;
  const end = start + (Number(rawDuration) || 0);
  times.add(start);
  times.add(end);
  times.add(start + (end - start) * 0.5);
}

export function installRenderingContractCoverageOwner(
  ctx: ViewerAppContext,
): void {
  ctx.mergeRendererContractReads = mergeRendererContractReads.bind(
    undefined,
    ctx,
  );
  ctx.createRendererContractSampleTimes =
    createRendererContractSampleTimes.bind(undefined, ctx);
  ctx.refreshRendererContractCoverage = refreshRendererContractCoverage.bind(
    undefined,
    ctx,
  );
}
