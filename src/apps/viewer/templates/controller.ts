import type { ViewerAppContext } from "../app/context.js";

function createPresetFromTemplate(ctx: ViewerAppContext, template, id) {
  const presetNumber = String(id).match(/^preset(?:-(\d+))?$/)?.[1];
  const suffix = presetNumber ? ` ${presetNumber}` : "";
  return {
    clips: ctx.deps.deepClone(template.clips ?? []),
    controls: ctx.deps.deepClone(ctx.state.controls ?? {}),
    duration: Number(template.duration) || ctx.getEffectiveDuration(),
    id,
    label:
      String(id) === "preset" || presetNumber
        ? { en: `Preset${suffix}`, ru: `Пресет${suffix}` }
        : { en: ctx.toTitleLabel(id), ru: ctx.toTitleLabel(id) },
    layers: ctx.deps.deepClone(template.layers ?? []),
    scenes: ctx.normalizeScenes(
      template.scenes ?? [],
      Number(template.duration) || ctx.getEffectiveDuration(),
    ),
    timeline: ctx.deps.deepClone(
      template.timeline ?? { phases: [], tracks: [] },
    ),
  };
}

function drawBaseForTemplate(
  ctx: ViewerAppContext,
  context,
  template,
  progress,
) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  if (
    template.effectV1 ||
    template.kind === "transitionEffect" ||
    template.kind === "composition"
  ) {
    context.clearRect(0, 0, width, height);
    return;
  }
  ctx.deps.drawSampleScene(context, {
    height,
    phase: template.kind === "sceneEffect" ? "blank" : "base",
    progress,
    width,
  });
}

function getEffectiveTemplate(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  if (!template) {
    return null;
  }
  const override = ctx.state.editorOverrides.get(template.id) ?? {};
  return {
    ...ctx.deps.deepClone(template),
    ...ctx.deps.deepClone(override),
    duration: Number(override.duration ?? template.duration),
    clips: ctx.deps.deepClone(
      override.clips ?? template.clips ?? ctx.createFallbackClips(template),
    ),
    layers: ctx.deps.deepClone(
      override.layers ?? template.layers ?? ctx.createFallbackLayers(template),
    ),
    scenes: ctx.normalizeScenes(
      override.scenes ?? template.scenes ?? ctx.createFallbackScenes(template),
      Number(override.duration ?? template.duration),
    ),
    timeline: ctx.getEffectiveTimeline(template),
  };
}

export function installTemplatesControllerOwner(ctx: ViewerAppContext): void {
  ctx.createPresetFromTemplate = createPresetFromTemplate.bind(undefined, ctx);
  ctx.drawBaseForTemplate = drawBaseForTemplate.bind(undefined, ctx);
  ctx.getEffectiveTemplate = getEffectiveTemplate.bind(undefined, ctx);
}
