import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplate } from "./model.js";
import { readEditorTemplate, readTemplateSource } from "./source.js";

function createPresetFromTemplate(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  id: string,
) {
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
    scenes: ctx.deps.deepClone(template.scenes),
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

export function getEffectiveTemplate(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): EditorTemplate | null {
  if (!template) return null;
  const source = readTemplateSource(template);
  const override = ctx.getEditorOverride(source);
  const timeline = ctx.getEffectiveTimeline(source);
  const sceneSource = override.scenes ?? source.scenes;
  const scenes =
    Array.isArray(sceneSource) && sceneSource.length === 0
      ? ctx.createFallbackScenes(source)
      : (sceneSource ?? ctx.createFallbackScenes(source));
  return readEditorTemplate(
    {
      ...ctx.deps.deepClone(source),
      ...ctx.deps.deepClone(override),
      duration: Number(override.duration ?? source.duration),
      clips: ctx.deps.deepClone(
        override.clips ?? source.clips ?? ctx.createFallbackClips(source),
      ),
      layers: ctx.deps.deepClone(
        override.layers ?? source.layers ?? ctx.createFallbackLayers(source),
      ),
      scenes: ctx.deps.deepClone(scenes),
    },
    timeline,
  );
}

export function installTemplatesControllerOwner(ctx: ViewerAppContext): void {
  ctx.createPresetFromTemplate = createPresetFromTemplate.bind(undefined, ctx);
  ctx.drawBaseForTemplate = drawBaseForTemplate.bind(undefined, ctx);
  ctx.getEffectiveTemplate = getEffectiveTemplate.bind(undefined, ctx);
}
