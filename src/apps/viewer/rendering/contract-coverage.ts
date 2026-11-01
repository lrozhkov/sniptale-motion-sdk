import { bindViewerAction } from "../app/bind-action.js";
import type { RendererContractCoverageActions } from "./coverage-contract.js";
import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../templates/model.js";
import type { RendererBindingReads } from "../app/binding-reads.js";
import { BINDING_READ_LIST_FIELDS } from "../app/binding-reads.js";
import type { ViewerAppContext } from "../app/context.js";
import { mergePrimitiveBounds } from "./contract-bounds.js";
import { resolveViewerRenderTimeoutMs } from "./timeouts.js";
import { shouldReportSandboxRequestFailure } from "../transport/sandbox-client.js";

const CONTRACT_PLAYBACK_RECHECK_INTERVAL_MS = 250;

function mergeRendererContractReads(
  ctx: ViewerAppContext,
  templateId: string,
  reads: unknown,
): void {
  if (!templateId || ctx.state.rendererContractCoverageLockedForTest) {
    return;
  }
  const normalized = ctx.deps.normalizeBindingReads(reads);
  if (ctx.state.rendererContractTemplateId !== templateId) {
    ctx.state.rendererContractReads = ctx.deps.createEmptyBindingReads();
    ctx.state.rendererContractTemplateId = templateId;
  }
  const merged = ctx.state.rendererContractReads;
  merged.primitiveBounds = mergePrimitiveBounds(
    merged.primitiveBounds,
    normalized.primitiveBounds,
  );
  for (const key of BINDING_READ_LIST_FIELDS) {
    merged[key] = Array.from(
      new Set([...merged[key], ...normalized[key]]),
    ).sort();
  }
}

function createRendererContractSampleTimes(
  ctx: ViewerAppContext,
  template: EditorTemplateSource | null = ctx.state.currentTemplate,
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
  template: EditorTemplateSource | null = ctx.state.currentTemplate,
): Promise<RendererBindingReads> {
  if (
    !template ||
    !ctx.state.sandboxReady ||
    ctx.state.rendererContractCoverageLockedForTest
  ) {
    return ctx.state.rendererContractReads;
  }
  if (ctx.state.rendererContractRefreshing) {
    const activeTemplate = ctx.state.rendererContractRefreshTemplate;
    try {
      await ctx.state.rendererContractRefreshPromise;
    } catch (error) {
      // A new runtime can restore coverage after cancellation of its predecessor.
      if (shouldReportSandboxRequestFailure(error)) throw error;
    }
    if (
      ctx.state.currentTemplate === template &&
      (activeTemplate !== template ||
        ctx.state.rendererContractTemplateId !== template.id ||
        !ctx.state.rendererContractCoverageReady)
    ) {
      return refreshRendererContractCoverage(ctx, template);
    }
    return ctx.state.rendererContractReads;
  }
  ctx.state.rendererContractRefreshing = true;
  ctx.state.rendererContractRefreshTemplate = template;
  const refreshPromise = runRendererContractCoverageRefresh(ctx, template);
  ctx.state.rendererContractRefreshPromise = refreshPromise;
  try {
    return await refreshPromise;
  } finally {
    if (ctx.state.rendererContractRefreshPromise === refreshPromise) {
      ctx.state.rendererContractRefreshPromise = null;
      ctx.state.rendererContractRefreshTemplate = null;
      ctx.state.rendererContractRefreshing = false;
    }
  }
}

async function runRendererContractCoverageRefresh(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
): Promise<RendererBindingReads> {
  const runtimeGeneration = ctx.state.sandboxRuntimeGeneration;
  while (
    (await sampleRendererContractCoverage(ctx, template, runtimeGeneration)) ===
    "superseded"
  ) {
    // Keep one refresh owner while a newer model replaces an in-flight sample.
  }
  return ctx.state.rendererContractReads;
}

function coverageSampleDisposition(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  effectiveTemplate: EditorTemplate,
  runtimeGeneration: number,
): "superseded" | "aborted" | null {
  if (
    ctx.state.currentTemplate !== template ||
    ctx.state.sandboxRuntimeGeneration !== runtimeGeneration
  )
    return "aborted";
  return ctx.getRenderTemplateSnapshot(template) === effectiveTemplate
    ? null
    : "superseded";
}

async function sampleRendererContractCoverage(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  runtimeGeneration: number,
): Promise<"ready" | "superseded" | "aborted"> {
  if (ctx.state.renderInFlight || ctx.state.renderQueued) {
    await ctx.waitForRenderIdle();
  }
  if (
    ctx.state.currentTemplate !== template ||
    ctx.state.sandboxRuntimeGeneration !== runtimeGeneration
  ) {
    return "aborted";
  }
  ctx.state.rendererContractTemplateId = template.id;
  ctx.state.rendererContractCoverageReady = false;
  ctx.state.rendererContractReads = ctx.deps.createEmptyBindingReads();
  ctx.renderValidationPanel(template);
  ctx.updateExportAvailability();
  ctx.mergeRendererContractReads(template.id, ctx.state.lastBindingReads);
  if (!ctx.state.loadedModules.has(template.moduleId ?? "")) {
    if (!(await ctx.ensureModuleLoaded(template.moduleId ?? ""))) {
      return "aborted";
    }
  }
  const effectiveTemplate = ctx.getRenderTemplateSnapshot(template);
  if (!effectiveTemplate) {
    return "aborted";
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
      return "aborted";
    }
    await renderContractSample(
      ctx,
      template,
      effectiveTemplate,
      runtimeGeneration,
      {
        duration,
        fps,
        height: sampleSize.height,
        outputHeight: height,
        outputWidth: width,
        time,
        width: sampleSize.width,
      },
    );
    const disposition = coverageSampleDisposition(
      ctx,
      template,
      effectiveTemplate,
      runtimeGeneration,
    );
    if (disposition) return disposition;
    if (
      ctx.buildRendererBindingCoverage(effectiveTemplate).unboundCount === 0
    ) {
      break;
    }
  }
  const disposition = coverageSampleDisposition(
    ctx,
    template,
    effectiveTemplate,
    runtimeGeneration,
  );
  if (disposition) return disposition;
  ctx.state.rendererContractCoverageReady = true;
  ctx.renderValidationPanel(template);
  ctx.renderRendererBindingsPanel(template);
  ctx.updateExportAvailability();
  return "ready";
}

async function renderContractSample(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  effectiveTemplate: EditorTemplate,
  runtimeGeneration: number,
  {
    duration,
    fps,
    height,
    outputHeight,
    outputWidth,
    time,
    width,
  }: {
    duration: number;
    fps: number;
    height: number;
    outputHeight: number;
    outputWidth: number;
    time: number;
    width: number;
  },
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
  try {
    if (
      result.ok &&
      ctx.getRenderTemplateSnapshot(template) === effectiveTemplate &&
      ctx.state.currentTemplate === template &&
      ctx.state.sandboxRuntimeGeneration === runtimeGeneration
    ) {
      ctx.commitRenderAssetTransfers(renderAssets);
      ctx.commitRenderModelEnvelope(renderModel);
      ctx.mergeRendererContractReads(
        template.id,
        ctx.normalizePreviewBindingReads(result.bindingReads),
      );
    }
  } finally {
    result.bitmap?.close?.();
  }
}

export async function waitForContractSampleSlot(
  ctx: ViewerAppContext,
  templateId: string,
  runtimeGeneration: number,
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

function addRangeSamples(
  times: Set<number>,
  rawStart: number,
  rawDuration: number,
) {
  const start = Number(rawStart) || 0;
  const end = start + (Number(rawDuration) || 0);
  times.add(start);
  times.add(end);
  times.add(start + (end - start) * 0.5);
}

export function createRendererContractCoverageActions(
  getContext: () => ViewerAppContext,
): RendererContractCoverageActions {
  return {
    mergeRendererContractReads: bindViewerAction(
      mergeRendererContractReads,
      getContext,
    ),
    createRendererContractSampleTimes: bindViewerAction(
      createRendererContractSampleTimes,
      getContext,
    ),
    refreshRendererContractCoverage: bindViewerAction(
      refreshRendererContractCoverage,
      getContext,
    ),
  };
}
