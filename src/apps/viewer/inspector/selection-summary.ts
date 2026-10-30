import type { ViewerAppContext } from "../app/context.js";
import {
  getTemplateArtifactTypeLabel,
  resolveTemplateArtifactType,
} from "../templates/artifact-type.js";
import {
  getTemplateBundleKindLabel,
  resolveTemplateBundleKind,
} from "../templates/bundle-kind.js";
import {
  getKeyframeDisplayLabel,
  getKeyframeEasingLabel,
} from "./keyframe-labels.js";

function renderSelectionCrumb(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  ctx.refs.selectionCrumb.innerHTML = "";
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    ctx.refs.selectionCrumb.textContent = ctx.deps.t(
      "viewer.selection.none",
      "No selection",
    );
    return;
  }
  const model = ctx.getSelectionCrumbModel(effectiveTemplate);
  ctx.refs.selectionCrumb.dataset.selectionType = model.type.toLowerCase();
  ctx.refs.selectionCrumb.title = `${model.title}\n${model.meta}`;
  const type = document.createElement("strong");
  type.textContent = model.type;
  const title = document.createElement("span");
  title.className = "selection-crumb-title";
  title.textContent = model.title;
  const meta = document.createElement("span");
  meta.className = "selection-crumb-meta";
  meta.textContent = model.meta;
  const hint = document.createElement("span");
  hint.className = "selection-crumb-hint";
  hint.textContent = model.hint;
  ctx.refs.selectionCrumb.append(type, title, meta, hint);
}

function getSelectionCrumbModel(ctx: ViewerAppContext, template) {
  const item = ctx.state.selectedItem ?? { type: "effect" };
  if (item.type === "scene") {
    const scene = ctx
      .normalizeScenes(template.scenes ?? [], template.duration)
      .find((entry) => entry.id === item.sceneId);
    return {
      hint: ctx.state.moveLinkedKeys
        ? ctx.deps.t("viewer.selection.hints.dragWithLinks", "Drag with links")
        : ctx.deps.t("viewer.selection.hints.dragBlockOnly", "Drag block only"),
      meta: scene
        ? `${ctx.formatSeconds(scene.start)}-${ctx.formatSeconds(scene.start + scene.duration)}`
        : item.sceneId,
      title: scene?.label ?? item.sceneId,
      type: ctx.deps.t("viewer.selection.types.scene", "Scene"),
    };
  }
  if (item.type === "layer") {
    if (ctx.isLayerSelectionInspector?.(template)) {
      const count = ctx.getSelectedLayerLeafIds(template).length;
      const rootIds = ctx.getSelectedLayerRootIds(template);
      const group =
        rootIds.length === 1
          ? template.layers.find(
              (layer) => layer.id === rootIds[0] && layer.type === "group",
            )
          : null;
      return {
        hint: ctx.deps.t(
          "viewer.selection.hints.editLayerProperties",
          "Edit layer properties",
        ),
        meta: ctx.deps
          .t("viewer.inspector.selection.count", "{count} layers")
          .replace("{count}", String(count)),
        title:
          group?.name ??
          ctx.deps.t("viewer.inspector.selection.title", "Layer selection"),
        type: group
          ? ctx.deps.t("viewer.timeline.layerTypes.group", "Group")
          : ctx.deps.t("viewer.selection.types.layer", "Layer"),
      };
    }
    const layer = (template.layers ?? []).find(
      (entry) => entry.id === item.layerId,
    );
    return {
      hint: ctx.deps.t(
        "viewer.selection.hints.editLayerProperties",
        "Edit layer properties",
      ),
      meta: layer
        ? ctx.deps.t(
            `viewer.timeline.layerTypes.${layer.type || "layer"}`,
            layer.type || "layer",
          )
        : item.layerId,
      title: layer?.name ?? item.layerId,
      type: ctx.deps.t("viewer.selection.types.layer", "Layer"),
    };
  }
  if (item.type === "clip") {
    const clip = (template.clips ?? []).find(
      (entry) => entry.layerId === item.layerId,
    );
    const layer = (template.layers ?? []).find(
      (entry) => entry.id === item.layerId,
    );
    return {
      hint: ctx.state.moveLinkedKeys
        ? ctx.deps.t("viewer.selection.hints.dragWithKeys", "Drag with keys")
        : ctx.deps.t("viewer.selection.hints.dragClipOnly", "Drag clip only"),
      meta: clip
        ? `${ctx.formatSeconds(clip.start)}-${ctx.formatSeconds(clip.start + clip.duration)}`
        : item.layerId,
      title: layer?.name ?? item.layerId,
      type: ctx.deps.t("viewer.selection.types.clip", "Layer interval"),
    };
  }
  if (item.type === "phase") {
    const phase = (template.timeline?.phases ?? []).find(
      (entry) => entry.id === item.phaseId,
    );
    return {
      hint: ctx.state.moveLinkedKeys
        ? ctx.deps.t("viewer.selection.hints.dragWithKeys", "Drag with keys")
        : ctx.deps.t("viewer.selection.hints.dragPhaseOnly", "Drag phase only"),
      meta: phase
        ? `${ctx.formatSeconds(phase.start)}-${ctx.formatSeconds(phase.start + phase.duration)}`
        : item.phaseId,
      title: phase?.label ?? item.phaseId,
      type: ctx.deps.t("viewer.selection.types.phase", "Phase"),
    };
  }
  if (item.type === "track") {
    const track = (template.timeline?.tracks ?? []).find(
      (entry) => entry.id === item.trackId,
    );
    return {
      hint: ctx.deps.t("viewer.selection.hints.dragTrackKeys", "Drag row keys"),
      meta: formatSelectionMessage(
        ctx,
        "viewer.selection.meta.keyframes",
        "{count} keyframes",
        { count: track?.keyframes?.length ?? 0 },
      ),
      title: track?.label ?? item.trackId,
      type: ctx.deps.t("viewer.selection.types.track", "Track"),
    };
  }
  if (item.type === "keyframe") {
    const selectedKeyframes = ctx.getSelectedKeyframeRefs();
    if (selectedKeyframes.length > 1) {
      return {
        hint: ctx.deps.t(
          "viewer.selection.hints.editKeyframes",
          "Edit selected keyframes",
        ),
        meta: ctx.deps
          .t("viewer.inspector.keyframeSelection.trackCount", "{count} tracks")
          .replace(
            "{count}",
            String(new Set(selectedKeyframes.map((ref) => ref.trackId)).size),
          ),
        title: ctx.deps
          .t("viewer.inspector.keyframeSelection.count", "{count} keyframes")
          .replace("{count}", String(selectedKeyframes.length)),
        type: ctx.deps.t(
          "viewer.inspector.keyframeSelection.title",
          "Keyframe selection",
        ),
      };
    }
    const track = (template.timeline?.tracks ?? []).find(
      (entry) => entry.id === item.trackId,
    );
    const keyframe = track?.keyframes?.find(
      (entry) => entry.id === item.keyframeId,
    );
    return {
      hint: ctx.deps.t(
        "viewer.selection.hints.dragKeyOrCurve",
        "Drag key or edit curve",
      ),
      meta: keyframe
        ? getKeyframeEasingLabel(ctx, keyframe.easing)
        : item.keyframeId,
      title: getKeyframeDisplayLabel(ctx, track, keyframe),
      type: ctx.deps.t("viewer.selection.types.keyframe", "Keyframe"),
    };
  }
  if (item.type === "asset") {
    const asset = ctx.state.assets.get(item.assetId);
    return {
      hint: ctx.deps.t(
        "viewer.selection.hints.dragOntoCanvas",
        "Drag onto canvas",
      ),
      meta:
        asset?.mimeType ??
        asset?.kind ??
        ctx.deps.t("viewer.selection.meta.asset", "asset"),
      title: item.assetId,
      type: ctx.deps.t("viewer.selection.types.asset", "Asset"),
    };
  }
  return {
    hint: ctx.deps.t(
      "viewer.selection.hints.clickTimeline",
      "Click timeline to seek",
    ),
    meta: formatSelectionMessage(
      ctx,
      "viewer.selection.meta.composition",
      "{layers} layers · {tracks} tracks",
      {
        layers: template.layers?.length ?? 0,
        tracks: template.timeline?.tracks?.length ?? 0,
      },
    ),
    title: ctx.deps.translateText(template.label, template.id),
    type: formatTemplateType(ctx, template),
  };
}

function formatTemplateType(ctx: ViewerAppContext, template): string {
  return getTemplateBundleKindLabel(ctx.deps.t, template);
}

function formatSelectionMessage(ctx, key, fallback, values) {
  let message = ctx.deps.t(key, fallback);
  for (const [name, value] of Object.entries(values)) {
    message = message.replace(`{${name}}`, String(value));
  }
  return message;
}

function appendAssetUsageInspector(ctx: ViewerAppContext, layers) {
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t("viewer.inspector.usage", "Usage");
  ctx.appendInspectorNode(heading);
  const list = document.createElement("div");
  list.className = "asset-usage-list";
  if (layers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "asset-usage-empty";
    empty.textContent = ctx.deps.t(
      "viewer.assets.unusedCanRemove",
      "Unused asset can be removed.",
    );
    list.append(empty);
  }
  for (const layer of layers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "asset-usage-layer";
    button.dataset.layerId = layer.id;
    const name = document.createElement("strong");
    name.textContent = layer.name || layer.id;
    const meta = document.createElement("span");
    meta.textContent = `${ctx.deps.t(
      `viewer.timeline.layerTypes.${layer.type || "layer"}`,
      layer.type || "layer",
    )} · ${layer.id}`;
    button.append(name, meta);
    button.addEventListener("click", () => ctx.focusLayer(layer.id));
    list.append(button);
  }
  ctx.appendInspectorNode(list);
}

export function installInspectorSelectionSummaryOwner(
  ctx: ViewerAppContext,
): void {
  ctx.renderSelectionCrumb = renderSelectionCrumb.bind(undefined, ctx);
  ctx.getSelectionCrumbModel = getSelectionCrumbModel.bind(undefined, ctx);
  ctx.appendAssetUsageInspector = appendAssetUsageInspector.bind(
    undefined,
    ctx,
  );
}
