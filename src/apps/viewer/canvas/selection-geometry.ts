import type { ViewerAppContext } from "../app/context.js";
import { isRendererManagedCanvasCapabilities } from "../layers/editor-capabilities.js";
import {
  observeCanvasSelectionViewport,
  readCanvasSelectionViewport,
  scheduleCanvasSelectionPlaybackUpdate,
} from "./selection-viewport.js";
import { updateCanvasMultiSelectionBox } from "./selection-geometry-multi.js";

const PLAYBACK_SELECTION_INTERVAL_MS = 1000 / 12;

function updateCanvasSelectionBox(ctx: ViewerAppContext, options: any = {}) {
  if (options.playbackFrame === true) {
    const now = performance.now();
    if (
      ctx.state.lastCanvasSelectionPlaybackTs &&
      now - ctx.state.lastCanvasSelectionPlaybackTs <
        PLAYBACK_SELECTION_INTERVAL_MS
    ) {
      return;
    }
    ctx.state.lastCanvasSelectionPlaybackTs = now;
  } else if (!ctx.state.playing) {
    ctx.state.lastCanvasSelectionPlaybackTs = 0;
  }
  const template = ctx.getRenderTemplateSnapshot(ctx.state.currentTemplate);
  const target = template ? ctx.getCanvasSelectionTarget(template) : null;
  if (!template || !target) {
    hideCanvasSelection(ctx);
    return;
  }
  if (target.kind === "selection") {
    if (!updateCanvasMultiSelectionBox(ctx, template, target, options)) {
      hideCanvasSelection(ctx);
    }
    return;
  }
  const layerId = target.primaryLayerId;
  const layer = template.layers.find((item) => item.id === layerId);
  if (
    !layer ||
    layer.visible === false ||
    !ctx.isLayerCanvasSelectable(layer)
  ) {
    hideCanvasSelection(ctx);
    return;
  }
  const time = Number(ctx.refs.timeSlider.value) || 0;
  const active = ctx.isLayerActiveAtTime(template, layer.id, time);
  if (
    options.playbackFrame === true &&
    !active &&
    ctx.refs.canvasSelectionBox.dataset.layerId === layer.id &&
    ctx.refs.canvasSelectionBox.dataset.inactive === "true"
  ) {
    return;
  }
  const resolution = { time, timeline: template.timeline };
  const box = ctx.getLayerCanvasBox(layer.id, layer, resolution);
  if (!box) {
    hideCanvasSelection(ctx);
    return;
  }
  const capabilities = ctx.getLayerEditorCapabilities(layer);
  const rendererManaged = isRendererManagedCanvasCapabilities(capabilities);
  const { canvasRect, stageRect } = readCanvasSelectionViewport(
    ctx,
    options.playbackFrame === true,
  );
  const scaleX = canvasRect.width / ctx.refs.canvas.width;
  const scaleY = canvasRect.height / ctx.refs.canvas.height;
  const playbackPresentation =
    ctx.state.playing && !ctx.state.canvasTransformDragActive;
  ctx.refs.canvasSelectionBox.hidden = false;
  ctx.refs.canvasSelectionBox.dataset.layerId = layer.id;
  delete ctx.refs.canvasSelectionBox.dataset.layerIds;
  delete ctx.refs.canvasSelectionBox.dataset.selectionKind;
  ctx.refs.canvasSelectionBox.classList.remove("multi-selection");
  if (active) {
    delete ctx.refs.canvasSelectionBox.dataset.inactive;
  } else {
    ctx.refs.canvasSelectionBox.dataset.inactive = "true";
  }
  setStyleValue(
    ctx.refs.canvasSelectionBox.style,
    "left",
    `${canvasRect.left - stageRect.left + box.x * scaleX}px`,
  );
  setStyleValue(
    ctx.refs.canvasSelectionBox.style,
    "top",
    `${canvasRect.top - stageRect.top + box.y * scaleY}px`,
  );
  setStyleValue(
    ctx.refs.canvasSelectionBox.style,
    "width",
    `${box.width * scaleX}px`,
  );
  setStyleValue(
    ctx.refs.canvasSelectionBox.style,
    "height",
    `${box.height * scaleY}px`,
  );
  setStyleValue(
    ctx.refs.canvasSelectionBox.style,
    "transform",
    `rotate(${box.rotation}deg)`,
  );
  const anchor = ctx.getResolvedLayerAnchor(layer, resolution);
  setStyleValue(
    ctx.refs.canvasSelectionBox.style,
    "transformOrigin",
    `${(0.5 + anchor.x) * 100}% ${(0.5 + anchor.y) * 100}%`,
  );
  ctx.refs.canvasSelectionBox.classList.toggle("locked", Boolean(layer.locked));
  ctx.refs.canvasSelectionBox.classList.toggle(
    "playback-presentation",
    playbackPresentation,
  );
  const primaryLayerSelection =
    ctx.state.selectedItem?.type === "layer" &&
    ctx.state.selectedItem.layerId === layer.id;
  const motionPathSelection =
    primaryLayerSelection ||
    ctx.isCanvasMotionPathSelectionForLayer(template, layer.id);
  const movable =
    active &&
    primaryLayerSelection &&
    capabilities.transform.includes("x") &&
    capabilities.transform.includes("y");
  ctx.refs.canvasSelectionBox.classList.toggle("read-only", !movable);
  ctx.refs.canvasSelectionBox.classList.toggle(
    "renderer-managed",
    rendererManaged,
  );
  ctx.refs.canvasSelectionBox.classList.toggle(
    "related-selection",
    target.related || !primaryLayerSelection,
  );
  if (playbackPresentation) {
    ctx.hideCanvasInfoHud();
  } else {
    ctx.ensureCanvasTransformHandles(capabilities, box.rotation, {
      height: box.height * scaleY,
      width: box.width * scaleX,
    });
    (
      ctx.refs.canvasSelectionBox.querySelectorAll(
        ".canvas-transform-handle",
      ) as NodeListOf<HTMLButtonElement>
    ).forEach((handle) => {
      handle.disabled =
        !active || Boolean(layer.locked) || !primaryLayerSelection;
    });
    ctx.updateCanvasAnchorHandle(anchor);
    ctx.updateCanvasInfoHud(layer, box, canvasRect, stageRect, scaleX, scaleY, {
      active,
    });
  }
  if (
    active &&
    motionPathSelection &&
    !playbackPresentation &&
    options.motionPath !== false &&
    !ctx.state.canvasTransformDragActive
  ) {
    if (!ctx.renderSelectedMotionPathOverlay(template, target)) {
      ctx.hideMotionPathOverlay();
    }
  } else {
    ctx.hideMotionPathOverlay();
  }
}

function hideCanvasSelection(ctx: ViewerAppContext) {
  if (
    ctx.refs.canvasSelectionBox.hidden &&
    !ctx.refs.canvasSelectionBox.dataset.layerId &&
    ctx.refs.canvasInfoHud.hidden &&
    ctx.refs.motionPathOverlay.hidden
  ) {
    return;
  }
  ctx.refs.canvasSelectionBox.hidden = true;
  delete ctx.refs.canvasSelectionBox.dataset.layerId;
  delete ctx.refs.canvasSelectionBox.dataset.layerIds;
  delete ctx.refs.canvasSelectionBox.dataset.selectionKind;
  delete ctx.refs.canvasSelectionBox.dataset.inactive;
  ctx.refs.canvasSelectionBox.classList.remove(
    "locked",
    "playback-presentation",
    "read-only",
    "related-selection",
    "renderer-managed",
    "multi-selection",
  );
  ctx.hideCanvasInfoHud();
  ctx.hideMotionPathOverlay();
}

function setStyleValue(
  style: CSSStyleDeclaration,
  property: keyof CSSStyleDeclaration,
  value: string,
) {
  if (style[property] !== value) {
    (style[property] as string) = value;
  }
}

export function installCanvasSelectionGeometryOwner(
  ctx: ViewerAppContext,
): void {
  ctx.updateCanvasSelectionBox = (...args: any[]) =>
    (updateCanvasSelectionBox as any)(ctx, ...args);
  ctx.observeCanvasSelectionViewport = (...args: any[]) =>
    (observeCanvasSelectionViewport as any)(ctx, ...args);
  ctx.scheduleCanvasSelectionPlaybackUpdate = (...args: any[]) =>
    (scheduleCanvasSelectionPlaybackUpdate as any)(ctx, ...args);
}
