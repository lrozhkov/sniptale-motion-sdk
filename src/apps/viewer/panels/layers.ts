import { bindViewerAction } from "../app/bind-action.js";
import { createViewerIcon, setIconButton } from "../app/icons.js";
import type { LayerPanelActions } from "./contract.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { LayerHierarchyIndex } from "../layers/hierarchy.js";
import type { ViewerAppContext } from "../app/context.js";
import { getLayerLeafIds, isLayerGroup } from "../layers/hierarchy.js";

function renderLayersPanel(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
) {
  ctx.refs.layersPanel.innerHTML = "";
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    ctx.refs.layersPanel.textContent = ctx.deps.t(
      "common.empty.layers",
      "No layers",
    );
    return;
  }
  const hint = document.createElement("div");
  hint.className = "layers-hint";
  hint.textContent = ctx.deps.t(
    "viewer.layers.orderHint",
    "Top rows render above lower rows. Drag rows or use Ctrl/Cmd+ArrowUp/Down.",
  );
  ctx.refs.layersPanel.append(hint);
  const hierarchy = ctx.getLayerHierarchy(effectiveTemplate);
  const renderRows = (parentId: string | null, depth: number) => {
    for (const layer of [
      ...(hierarchy.childrenByParentId.get(parentId) ?? []),
    ].reverse()) {
      ctx.refs.layersPanel.append(
        createLayerPanelRow(ctx, hierarchy, layer, depth),
      );
      if (
        isLayerGroup(layer) &&
        !ctx.state.collapsedLayerPanelGroupIds.has(layer.id)
      ) {
        renderRows(layer.id, depth + 1);
      }
    }
  };
  renderRows(null, 0);
}

function createLayerPanelRow(
  ctx: ViewerAppContext,
  hierarchy: LayerHierarchyIndex<EffectLayer>,
  layer: EffectLayer,
  depth: number,
): HTMLElement {
  const leafIds = isLayerGroup(layer)
    ? getLayerLeafIds(hierarchy, [layer.id])
    : [layer.id];
  const leaves = leafIds
    .map((id) => hierarchy.byId.get(id))
    .filter((entry): entry is EffectLayer => entry !== undefined);
  const visible =
    leaves.length > 0 && leaves.every((entry) => entry.visible !== false);
  const locked =
    leaves.length > 0 && leaves.every((entry) => entry.locked === true);
  const selected = ctx.isSelectedLayer(layer.id);
  const row = document.createElement("div");
  row.className = `layer-row${selected ? " selected" : ""}${locked ? " locked" : ""}${visible ? "" : " hidden-layer"}${isLayerGroup(layer) ? " layer-group-row" : ""}`;
  row.dataset.layerId = layer.id;
  row.dataset.layerDepth = String(depth);
  row.style.setProperty("--layer-depth", String(depth));

  const visibility = document.createElement("button");
  visibility.type = "button";
  visibility.className = "layer-icon-button";
  setIconButton(
    visibility,
    visible ? "eye" : "eyeOff",
    visible
      ? ctx.deps.t("viewer.layers.hide", "Hide layer")
      : ctx.deps.t("viewer.layers.show", "Show layer"),
  );
  visibility.addEventListener("click", (event) => {
    event.stopPropagation();
    ctx.toggleLayerVisibility(layer.id);
  });

  const lock = document.createElement("button");
  lock.type = "button";
  lock.className = "layer-icon-button";
  setIconButton(
    lock,
    locked ? "lock" : "unlock",
    locked
      ? ctx.deps.t("viewer.layers.unlock", "Unlock layer")
      : ctx.deps.t("viewer.layers.lock", "Lock layer"),
  );
  lock.addEventListener("click", (event) => {
    event.stopPropagation();
    ctx.toggleLayerLock(layer.id);
  });

  const label = document.createElement("button");
  label.type = "button";
  label.className = "layer-name-button";
  const nameLine = document.createElement("span");
  nameLine.className = "layer-name-line";
  if (isLayerGroup(layer)) {
    const toggle = document.createElement("span");
    toggle.className = "layer-group-chevron";
    toggle.append(createViewerIcon("chevronRight"));
    toggle.classList.toggle(
      "expanded",
      !ctx.state.collapsedLayerPanelGroupIds.has(layer.id),
    );
    nameLine.append(toggle);
  }
  const name = document.createElement("strong");
  name.textContent = layer.name || layer.id;
  nameLine.append(name);
  const meta = document.createElement("span");
  meta.textContent = ctx.deps.t(
    `viewer.timeline.layerTypes.${layer.type || "layer"}`,
    layer.type || "layer",
  );
  label.append(nameLine, meta);
  label.addEventListener("click", (event) => {
    event.stopPropagation();
    if (
      isLayerGroup(layer) &&
      (event.detail === 2 ||
        (event.target instanceof Element &&
          event.target.closest(".layer-group-chevron"))) &&
      toggleLayerPanelGroup(ctx, layer.id)
    ) {
      return;
    }
    ctx.selectLayer(layer.id, event);
  });
  label.addEventListener("pointerdown", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest(".layer-group-chevron")
    ) {
      return;
    }
    ctx.beginLayerPanelDrag(event, layer.id);
  });
  row.addEventListener("click", (event) => ctx.selectLayer(layer.id, event));
  row.append(visibility, lock, label);
  return row;
}

function toggleLayerPanelGroup(
  ctx: ViewerAppContext,
  groupId: string,
): boolean {
  if (ctx.state.collapsedLayerPanelGroupIds.has(groupId)) {
    ctx.state.collapsedLayerPanelGroupIds.delete(groupId);
  } else {
    ctx.state.collapsedLayerPanelGroupIds.add(groupId);
  }
  ctx.renderLayersPanel(ctx.state.currentTemplate);
  return true;
}

export function createLayerPanelActions(
  getContext: () => ViewerAppContext,
): LayerPanelActions {
  return {
    renderLayersPanel: bindViewerAction(renderLayersPanel, getContext),
    toggleLayerPanelGroup: bindViewerAction(toggleLayerPanelGroup, getContext),
  };
}
