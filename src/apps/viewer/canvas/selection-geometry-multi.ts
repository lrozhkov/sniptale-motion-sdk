import type { EffectLayer } from "../../../sdk/types.js";
import type { LayerEditorCapabilities } from "../layers/editor-capabilities.js";
import type { EditorTemplate } from "../templates/model.js";
import type { CanvasSelectionTarget } from "./path-contract.js";
import type { CanvasSelectionDisplayOptions } from "./display-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { resolveCanvasSelectionBounds } from "./selection-bounds.js";
import { readCanvasSelectionViewport } from "./selection-viewport.js";

export function updateCanvasMultiSelectionBox(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  target: CanvasSelectionTarget,
  options: CanvasSelectionDisplayOptions,
): boolean {
  const time = Number(ctx.refs.timeSlider.value) || 0;
  const resolution = { time, timeline: template.timeline };
  const bounds = resolveCanvasSelectionBounds(
    ctx,
    template,
    target.layerIds.filter((layerId) => {
      const layer = template.layers.find((item) => item.id === layerId);
      return layer?.visible !== false;
    }),
    resolution,
  );
  if (!bounds) {
    return false;
  }
  const layers = target.layerIds
    .map((layerId) => template.layers.find((item) => item.id === layerId))
    .filter((layer): layer is EffectLayer => layer !== undefined);
  const active =
    layers.length > 0 &&
    layers.every(
      (layer) =>
        layer.visible !== false &&
        ctx.isLayerActiveAtTime(template, layer.id, time),
    );
  const locked = layers.some((layer) => layer.locked);
  const commonTransform = (
    ["x", "y", "scaleX", "scaleY", "rotation"] as const
  ).filter((property) =>
    layers.every((layer) => ctx.canTransformLayerProperty(layer, property)),
  );
  const movable =
    active &&
    !locked &&
    commonTransform.includes("x") &&
    commonTransform.includes("y");
  const capabilities: LayerEditorCapabilities = {
    canvas: "bounds",
    keyframeProperties: [],
    operations: [],
    properties: [],
    transform: commonTransform,
  };
  const { canvasRect, stageRect } = readCanvasSelectionViewport(
    ctx,
    options.playbackFrame === true,
  );
  const scaleX = canvasRect.width / ctx.refs.canvas.width;
  const scaleY = canvasRect.height / ctx.refs.canvas.height;
  const box = bounds.box;
  const selection = ctx.refs.canvasSelectionBox;
  selection.hidden = false;
  selection.dataset.layerId = target.primaryLayerId ?? "";
  selection.dataset.layerIds = JSON.stringify(target.layerIds);
  selection.dataset.selectionKind = "multi";
  if (active) {
    delete selection.dataset.inactive;
  } else {
    selection.dataset.inactive = "true";
  }
  setStyleValue(
    selection.style,
    "left",
    `${canvasRect.left - stageRect.left + box.x * scaleX}px`,
  );
  setStyleValue(
    selection.style,
    "top",
    `${canvasRect.top - stageRect.top + box.y * scaleY}px`,
  );
  setStyleValue(selection.style, "width", `${box.width * scaleX}px`);
  setStyleValue(selection.style, "height", `${box.height * scaleY}px`);
  setStyleValue(selection.style, "transform", "rotate(0deg)");
  setStyleValue(selection.style, "transformOrigin", "50% 50%");
  selection.classList.toggle("locked", locked);
  selection.classList.toggle("read-only", !movable);
  selection.classList.add("multi-selection");
  selection.classList.remove(
    "renderer-managed",
    "related-selection",
    "playback-presentation",
  );
  ctx.ensureCanvasTransformHandles(capabilities, 0, {
    height: box.height * scaleY,
    multiSelection: true,
    width: box.width * scaleX,
  });
  selection.querySelectorAll(".canvas-transform-handle").forEach((handle) => {
    if (!(handle instanceof HTMLButtonElement)) return;
    handle.disabled = !movable;
  });
  ctx.updateCanvasInfoHud(
    {
      id: target.primaryLayerId ?? "selection",
      type: "group",
      name: ctx.deps
        .t("viewer.canvas.hud.layerSelection", "{count} layers selected")
        .replace("{count}", String(target.layerIds.length)),
    },
    box,
    canvasRect,
    stageRect,
    scaleX,
    scaleY,
    {
      active: active && !locked,
      selectionCount: target.layerIds.length,
    },
  );
  if (
    active &&
    !ctx.state.playing &&
    options.motionPath !== false &&
    !ctx.state.canvasTransformDragActive &&
    ctx.renderSelectedMotionPathOverlay(template, target)
  ) {
    return true;
  }
  ctx.hideMotionPathOverlay();
  return true;
}

function setStyleValue(
  style: CSSStyleDeclaration,
  property:
    | "left"
    | "top"
    | "width"
    | "height"
    | "transform"
    | "transformOrigin",
  value: string,
) {
  if (style[property] !== value) {
    style[property] = value;
  }
}
