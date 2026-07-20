import type { ViewerAppContext } from "../app/context.js";
import { getTemplateBundleKindLabel } from "../templates/bundle-kind.js";
import { getKeyframeDisplayLabel } from "./keyframe-labels.js";

function getInspectorContext(ctx: ViewerAppContext, item, template) {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    return { kind: "", title: "" };
  }
  if (item.type === "clip" || item.type === "layer") {
    if (
      item.type === "layer" &&
      ctx.isLayerSelectionInspector?.(effectiveTemplate)
    ) {
      const rootIds = ctx.getSelectedLayerRootIds(effectiveTemplate);
      const group =
        rootIds.length === 1
          ? effectiveTemplate.layers.find(
              (layer) => layer.id === rootIds[0] && layer.type === "group",
            )
          : null;
      if (group) {
        return {
          kind: ctx.deps.t("viewer.timeline.layerTypes.group", "Group"),
          title: group.name || group.id,
        };
      }
      const count = ctx.getSelectedLayerLeafIds(effectiveTemplate).length;
      return {
        kind: ctx.deps.t("viewer.inspector.selection.title", "Layer selection"),
        title: ctx.deps
          .t("viewer.inspector.selection.count", "{count} layers")
          .replace("{count}", String(count)),
      };
    }
    const layer = effectiveTemplate.layers.find(
      (entry) => entry.id === item.layerId,
    );
    return {
      kind:
        item.type === "layer"
          ? ctx.deps.t("viewer.inspector.context.layer", "Layer")
          : ctx.deps.t("viewer.inspector.context.clip", "Layer interval"),
      title: layer?.name ?? item.layerId,
    };
  }
  if (item.type === "scene") {
    const scene = ctx
      .normalizeScenes(
        effectiveTemplate.scenes ?? [],
        effectiveTemplate.duration,
      )
      .find((entry) => entry.id === item.sceneId);
    return {
      kind: ctx.deps.t("viewer.inspector.context.scene", "Scene"),
      title: scene?.label ?? item.sceneId,
    };
  }
  if (item.type === "phase") {
    const phase = effectiveTemplate.timeline.phases.find(
      (entry) => entry.id === item.phaseId,
    );
    return {
      kind: ctx.deps.t("viewer.inspector.context.phase", "Phase"),
      title: phase?.label ?? item.phaseId,
    };
  }
  if (item.type === "track" || item.type === "keyframe") {
    if (item.type === "keyframe" && ctx.getSelectedKeyframeRefs().length > 1) {
      const count = ctx.getSelectedKeyframeRefs().length;
      return {
        kind: ctx.deps.t(
          "viewer.inspector.keyframeSelection.title",
          "Keyframe selection",
        ),
        title: ctx.deps
          .t("viewer.inspector.keyframeSelection.count", "{count} keyframes")
          .replace("{count}", String(count)),
      };
    }
    const track = effectiveTemplate.timeline.tracks.find(
      (entry) => entry.id === item.trackId,
    );
    const keyframe = track?.keyframes?.find(
      (entry) => entry.id === item.keyframeId,
    );
    return {
      kind: ctx.deps.t(
        item.type === "keyframe"
          ? "viewer.inspector.context.keyframe"
          : "viewer.inspector.context.track",
        item.type === "keyframe" ? "Keyframe" : "Property track",
      ),
      title:
        item.type === "keyframe" && keyframe
          ? getKeyframeDisplayLabel(ctx, track, keyframe)
          : (track?.label ?? item.trackId),
    };
  }
  if (item.type === "asset") {
    return {
      kind: ctx.deps.t("viewer.inspector.context.asset", "Asset"),
      title: item.assetId,
    };
  }
  return {
    kind: getTemplateBundleKindLabel(ctx.deps.t, effectiveTemplate),
    title: ctx.deps.translateText(template.label, template.id),
  };
}

function renderInspectorContext(ctx: ViewerAppContext, item, template) {
  const context = getInspectorContext(ctx, item, template);
  if (ctx.refs.inspectorContext) {
    ctx.refs.inspectorContext.hidden = !context.title;
  }
  if (ctx.refs.inspectorSelectionKind) {
    ctx.refs.inspectorSelectionKind.textContent = context.kind;
  }
  if (ctx.refs.inspectorSelectionTitle) {
    ctx.refs.inspectorSelectionTitle.textContent = context.title;
    ctx.refs.inspectorSelectionTitle.title = context.title;
  }
}

export function installInspectorContextHeaderOwner(
  ctx: ViewerAppContext,
): void {
  ctx.renderInspectorContext = (...args: any[]) =>
    (renderInspectorContext as any)(ctx, ...args);
}
