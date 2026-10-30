import type { EffectScene, TimelinePhase } from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";

type FallbackTemplate = {
  duration?: number;
  timeline?: {
    tracks?: readonly { target?: unknown }[];
    phases?: readonly TimelinePhase[];
  };
  scenes?: unknown;
  kind?: string;
  domMotion?: unknown;
};

import type { ViewerAppContext } from "../app/context.js";

export function createFallbackLayers(
  ctx: ViewerAppContext,
  template: FallbackTemplate,
) {
  const ids = new Set<string>();
  for (const track of template.timeline?.tracks ?? []) {
    if (typeof track.target === "string" && track.target) {
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

export function createFallbackClips(
  ctx: ViewerAppContext,
  template: FallbackTemplate,
) {
  const duration = Number(ctx.getEffectiveDuration(template));
  return createFallbackLayers(ctx, template).map((layer) => ({
    duration,
    layerId: layer.id,
    locked: false,
    offset: 0,
    start: 0,
  }));
}

export function createFallbackTimeline(
  ctx: ViewerAppContext,
  template: FallbackTemplate,
): EditorTimeline {
  const duration = Number(ctx.getEffectiveDuration(template));
  return {
    duration,
    phases: [{ id: "main", label: "Main", start: 0, duration, locked: true }],
    tracks: [],
  };
}

export function createFallbackScenes(
  ctx: ViewerAppContext,
  template: FallbackTemplate,
): EffectScene[] {
  const duration = Number(ctx.getEffectiveDuration(template));
  return [{ duration, id: "main", label: "Main", start: 0, locked: false }];
}

export function normalizeScenes(
  ctx: ViewerAppContext,
  scenes: unknown,
  duration = Number(ctx.getEffectiveDuration()),
) {
  return ctx.deps.normalizeEditorScenes(scenes, duration);
}

export function findTemplateScene(
  ctx: ViewerAppContext,
  template: FallbackTemplate | null | undefined,
  sceneId: string | null | undefined,
) {
  if (!sceneId) {
    return null;
  }
  return (
    normalizeScenes(
      ctx,
      template?.scenes ?? [],
      template?.duration ?? ctx.getEffectiveDuration(),
    ).find((scene) => scene.id === sceneId) ?? null
  );
}

export function findTemplatePhase(
  ctx: ViewerAppContext,
  template: FallbackTemplate | null | undefined,
  phaseId: string | null | undefined,
) {
  if (!phaseId) {
    return null;
  }
  return (
    (template?.timeline?.phases ?? []).find((phase) => phase.id === phaseId) ??
    null
  );
}

export function getRendererType(
  ctx: ViewerAppContext,
  template: FallbackTemplate | null | undefined,
): "dom" | "composition" | "effect" {
  return template?.domMotion
    ? "dom"
    : template?.kind === "composition"
      ? "composition"
      : "effect";
}

export function installTemplatesFallbacksOwner(ctx: ViewerAppContext): void {
  ctx.createFallbackLayers = createFallbackLayers.bind(null, ctx);
  ctx.createFallbackClips = createFallbackClips.bind(null, ctx);
  ctx.createFallbackTimeline = createFallbackTimeline.bind(null, ctx);
  ctx.createFallbackScenes = createFallbackScenes.bind(null, ctx);
  ctx.normalizeScenes = normalizeScenes.bind(null, ctx);
  ctx.findTemplateScene = findTemplateScene.bind(null, ctx);
  ctx.findTemplatePhase = findTemplatePhase.bind(null, ctx);
  ctx.getRendererType = getRendererType.bind(null, ctx);
}
