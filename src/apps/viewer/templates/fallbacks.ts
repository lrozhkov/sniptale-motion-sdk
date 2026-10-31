import { bindViewerAction } from "../app/bind-action.js";
import type { TemplateFallbackActions } from "./contract.js";
import { readEditorTimeline } from "../editor/timeline-source.js";
import type {
  EffectLayer,
  EffectScene,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";

import type { ViewerAppContext } from "../app/context.js";

export function createFallbackLayers(
  ctx: ViewerAppContext,
  template: unknown,
): EffectLayer[] {
  const ids = new Set<string>();
  const timeline =
    isRecord(template) && isRecord(template.timeline)
      ? template.timeline
      : null;
  const tracks: unknown[] = Array.isArray(timeline?.tracks)
    ? timeline.tracks
    : [];
  for (const track of tracks) {
    if (isRecord(track) && typeof track.target === "string" && track.target) {
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

export function createFallbackClips(ctx: ViewerAppContext, template: unknown) {
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
  template: unknown,
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
  template: unknown,
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
  template: unknown,
  sceneId: string | null | undefined,
) {
  if (!sceneId) {
    return null;
  }
  return (
    normalizeScenes(
      ctx,
      isRecord(template) ? (template.scenes ?? []) : [],
      isRecord(template) && typeof template.duration === "number"
        ? template.duration
        : ctx.getEffectiveDuration(),
    ).find((scene) => scene.id === sceneId) ?? null
  );
}

export function findTemplatePhase(
  ctx: ViewerAppContext,
  template: unknown,
  phaseId: string | null | undefined,
): TimelinePhase | null {
  if (!phaseId) {
    return null;
  }
  if (!isRecord(template) || template.timeline == null) return null;
  const timeline = readEditorTimeline(
    template.timeline,
    ctx.getEffectiveDuration(template),
  );
  return timeline.phases.find((phase) => phase.id === phaseId) ?? null;
}

export function getRendererType(
  _ctx: ViewerAppContext,
  template: unknown,
): "dom" | "composition" | "effect" {
  return isRecord(template) && template.domMotion
    ? "dom"
    : isRecord(template) && template.kind === "composition"
      ? "composition"
      : "effect";
}

export function createTemplateFallbackActions(
  getContext: () => ViewerAppContext,
): TemplateFallbackActions {
  return {
    createFallbackLayers: bindViewerAction(createFallbackLayers, getContext),
    createFallbackClips: bindViewerAction(createFallbackClips, getContext),
    createFallbackTimeline: bindViewerAction(
      createFallbackTimeline,
      getContext,
    ),
    createFallbackScenes: bindViewerAction(createFallbackScenes, getContext),
    normalizeScenes: bindViewerAction(normalizeScenes, getContext),
    findTemplateScene: bindViewerAction(findTemplateScene, getContext),
    findTemplatePhase: bindViewerAction(findTemplatePhase, getContext),
    getRendererType: bindViewerAction(getRendererType, getContext),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
