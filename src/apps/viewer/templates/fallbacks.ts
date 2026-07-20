import type { ViewerAppContext } from "../app/context.js";

function createFallbackLayers(ctx: ViewerAppContext, template) {
  const ids = new Set();
  for (const track of template.timeline?.tracks ?? []) {
    if (track.target) {
      ids.add(track.target);
    }
  }
  if (ids.size === 0) {
    ids.add("scene");
  }
  return Array.from(ids).map((id) => ({
    id,
    locked: false,
    name: ctx.toTitleLabel(id),
    parentId: null,
    type: id === "tagline" ? "text" : id === "logo" ? "svgAsset" : "customDraw",
    visible: true,
    blur: 0,
    opacity: 1,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
  }));
}

function createFallbackClips(ctx: ViewerAppContext, template) {
  const duration = ctx.getEffectiveDuration(template);
  return ctx.createFallbackLayers(template).map((layer) => ({
    duration,
    layerId: layer.id,
    locked: false,
    offset: 0,
    start: 0,
  }));
}

function createFallbackTimeline(ctx: ViewerAppContext, template) {
  const duration = ctx.getEffectiveDuration(template);
  return {
    duration,
    phases: [{ id: "main", label: "Main", start: 0, duration, locked: true }],
    tracks: [],
  };
}

function createFallbackScenes(ctx: ViewerAppContext, template) {
  const duration = ctx.getEffectiveDuration(template);
  return [{ duration, id: "main", label: "Main", start: 0, locked: false }];
}

function normalizeScenes(
  ctx: ViewerAppContext,
  scenes,
  duration = ctx.getEffectiveDuration(),
) {
  return ctx.deps.normalizeEditorScenes(scenes, duration);
}

function findTemplateScene(ctx: ViewerAppContext, template, sceneId) {
  if (!sceneId) {
    return null;
  }
  return (
    ctx
      .normalizeScenes(
        template?.scenes ?? [],
        template?.duration ?? ctx.getEffectiveDuration(),
      )
      .find((scene) => scene.id === sceneId) ?? null
  );
}

function findTemplatePhase(ctx: ViewerAppContext, template, phaseId) {
  if (!phaseId) {
    return null;
  }
  return (
    (template?.timeline?.phases ?? []).find((phase) => phase.id === phaseId) ??
    null
  );
}

function getRendererType(ctx: ViewerAppContext, template) {
  return template?.kind === "composition" ? "composition" : "effect";
}

export function installTemplatesFallbacksOwner(ctx: ViewerAppContext): void {
  ctx.createFallbackLayers = (...args: any[]) =>
    (createFallbackLayers as any)(ctx, ...args);
  ctx.createFallbackClips = (...args: any[]) =>
    (createFallbackClips as any)(ctx, ...args);
  ctx.createFallbackTimeline = (...args: any[]) =>
    (createFallbackTimeline as any)(ctx, ...args);
  ctx.createFallbackScenes = (...args: any[]) =>
    (createFallbackScenes as any)(ctx, ...args);
  ctx.normalizeScenes = (...args: any[]) =>
    (normalizeScenes as any)(ctx, ...args);
  ctx.findTemplateScene = (...args: any[]) =>
    (findTemplateScene as any)(ctx, ...args);
  ctx.findTemplatePhase = (...args: any[]) =>
    (findTemplatePhase as any)(ctx, ...args);
  ctx.getRendererType = (...args: any[]) =>
    (getRendererType as any)(ctx, ...args);
}
