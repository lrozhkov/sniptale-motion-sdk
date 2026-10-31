import type { ViewerRenderingState } from "./state.js";
import type { EditorTemplate } from "../templates/model.js";
import type { ViewerAppContext } from "../app/context.js";

type RenderModelSource = {
  clips?: unknown;
  duration?: unknown;
  layers?: unknown;
  scenes?: unknown;
  timeline?: unknown;
};
type RenderModelState = Pick<ViewerRenderingState, "sandboxRenderModelId">;

const renderModelIds = new WeakMap<object, string>();
let renderModelSequence = 0;

export function resolveRenderTemplateSnapshot(
  ctx: ViewerAppContext,
  template: { id: string } | null = ctx.state.currentTemplate,
): EditorTemplate | null {
  if (!template) {
    return null;
  }
  const editorOverride = ctx.state.editorOverrides.get(template.id);
  const timelineOverride = ctx.state.timelineOverrides.get(template.id);
  const cached = ctx.state.renderTemplateSnapshot;
  if (
    cached?.template === template &&
    cached.editorOverride === editorOverride &&
    cached.timelineOverride === timelineOverride
  ) {
    return cached.value;
  }
  const value = ctx.getEffectiveTemplate(template);
  ctx.state.renderTemplateSnapshot = {
    editorOverride,
    template,
    timelineOverride,
    value,
  };
  return value;
}

export function createRenderModelEnvelope(
  state: RenderModelState,
  effectiveTemplate: RenderModelSource | null | undefined,
): Record<string, unknown> {
  if (!effectiveTemplate || typeof effectiveTemplate !== "object") {
    throw new Error("Expected an effective template for rendering.");
  }
  let renderModelId = renderModelIds.get(effectiveTemplate);
  if (!renderModelId) {
    renderModelSequence += 1;
    renderModelId = `render-model-${renderModelSequence}`;
    renderModelIds.set(effectiveTemplate, renderModelId);
  }
  if (state.sandboxRenderModelId === renderModelId) {
    return { renderModelId };
  }
  return {
    renderModel: {
      clips: effectiveTemplate.clips ?? [],
      duration: Number(effectiveTemplate.duration) || 1,
      layers: effectiveTemplate.layers ?? [],
      scenes: effectiveTemplate.scenes ?? [],
      timeline: effectiveTemplate.timeline ?? { phases: [], tracks: [] },
    },
    renderModelId,
  };
}

export function commitRenderModelEnvelope(
  state: RenderModelState,
  envelope: Record<string, unknown>,
): void {
  if (typeof envelope.renderModelId === "string") {
    state.sandboxRenderModelId = envelope.renderModelId;
  }
}

export function resetRenderModelCache(state: RenderModelState): void {
  state.sandboxRenderModelId = null;
}

export function installRenderingModelCacheOwner(ctx: ViewerAppContext): void {
  ctx.getRenderTemplateSnapshot = resolveRenderTemplateSnapshot.bind(
    undefined,
    ctx,
  );
  ctx.createRenderModelEnvelope = (effectiveTemplate: RenderModelSource) =>
    createRenderModelEnvelope(ctx.state, effectiveTemplate);
  ctx.commitRenderModelEnvelope = (envelope: Record<string, unknown>) =>
    commitRenderModelEnvelope(ctx.state, envelope);
  ctx.resetRenderModelCache = () => resetRenderModelCache(ctx.state);
}
