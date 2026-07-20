import type { ViewerAppContext } from "../app/context.js";
import { isRendererManagedCanvasCapabilities } from "../layers/editor-capabilities.js";
import {
  getCanvasSnapAnchorValues,
  resolveCanvasGuideSnapForAnchors,
} from "./guide-snap-axis.js";
import { resolveCanvasHudPosition } from "./selection-hud-position.js";

type CanvasInfoHudElements = {
  heading: HTMLDivElement;
  id: HTMLElement;
  metrics: HTMLDivElement;
  name: HTMLElement;
  note: HTMLElement;
  positionSize: HTMLElement;
  rotation: HTMLElement;
  snap: HTMLElement;
};

const hudElementCache = new WeakMap<HTMLElement, CanvasInfoHudElements>();

function hideCanvasInfoHud(ctx: ViewerAppContext) {
  if (ctx.refs.canvasInfoHud.hidden) {
    return;
  }
  ctx.refs.canvasInfoHud.hidden = true;
  delete ctx.refs.canvasInfoHud.dataset.inactive;
  delete ctx.refs.canvasInfoHud.dataset.mode;
  delete ctx.refs.canvasInfoHud.dataset.previewDeferred;
}

function updateCanvasInfoHud(
  ctx: ViewerAppContext,
  layer,
  box,
  canvasRect,
  stageRect,
  scaleX,
  scaleY,
  options: { active?: boolean; selectionCount?: number } = {},
) {
  ctx.refs.canvasInfoHud.hidden = false;
  const label = layer.name || layer.id;
  const capabilities = ctx.getLayerEditorCapabilities(layer);
  const previewDeferred =
    ctx.state.canvasTransformDragActive &&
    ctx.state.previewCacheEnabled !== false;
  if (previewDeferred) {
    ctx.refs.canvasInfoHud.dataset.previewDeferred = "true";
  } else {
    delete ctx.refs.canvasInfoHud.dataset.previewDeferred;
  }
  const rendererManaged = isRendererManagedCanvasCapabilities(capabilities);
  if (options.selectionCount) {
    delete ctx.refs.canvasInfoHud.dataset.mode;
    if (options.active === false) {
      ctx.refs.canvasInfoHud.dataset.inactive = "true";
    } else {
      delete ctx.refs.canvasInfoHud.dataset.inactive;
    }
    updateCanvasInfoHudContent(ctx, {
      id: layer.id,
      label,
      note:
        options.active === false
          ? ctx.deps.t(
              "viewer.canvas.hud.selectionUnavailable",
              "Selection contains hidden, inactive, or locked layers",
            )
          : "",
      positionSize: ctx.deps
        .t(
          "viewer.canvas.hud.selectionBounds",
          "left {x} · top {y} · {width} × {height}",
        )
        .replace("{x}", formatCanvasHudNumber(box.x))
        .replace("{y}", formatCanvasHudNumber(box.y))
        .replace("{width}", formatCanvasHudNumber(box.width))
        .replace("{height}", formatCanvasHudNumber(box.height)),
    });
    positionCanvasInfoHud(ctx, box, canvasRect, stageRect, scaleX, scaleY);
    return;
  }
  if (rendererManaged) {
    ctx.refs.canvasInfoHud.dataset.mode = "managed";
  } else {
    delete ctx.refs.canvasInfoHud.dataset.mode;
  }
  if (options.active === false) {
    ctx.refs.canvasInfoHud.dataset.inactive = "true";
    const note = ctx.deps.t(
      "viewer.canvas.hud.outsideInterval",
      "Selected · outside the current layer interval",
    );
    updateCanvasInfoHudContent(ctx, {
      id: layer.id,
      label,
      note,
    });
    positionCanvasInfoHud(ctx, box, canvasRect, stageRect, scaleX, scaleY, {
      rendererManaged,
    });
    return;
  }
  delete ctx.refs.canvasInfoHud.dataset.inactive;
  if (capabilities.transform.length === 0) {
    const note = ctx.deps.t(
      "viewer.canvas.hud.rendererManaged",
      "Selection only · geometry is managed by the renderer",
    );
    updateCanvasInfoHudContent(ctx, {
      id: layer.id,
      label,
      note,
    });
    positionCanvasInfoHud(ctx, box, canvasRect, stageRect, scaleX, scaleY, {
      rendererManaged,
    });
    return;
  }
  const x = formatCanvasHudNumber(ctx.getResolvedLayerProperty(layer, "x"));
  const y = formatCanvasHudNumber(ctx.getResolvedLayerProperty(layer, "y"));
  const width = formatCanvasHudNumber(box.width);
  const height = formatCanvasHudNumber(box.height);
  const rotation = formatCanvasHudNumber(box.rotation);
  if (ctx.state.previewSnap && !ctx.state.canvasTransformDragActive) {
    ctx.state.canvasSnapStatus = ctx.getCanvasSnapStatusForBox(box, layer);
  }
  const positionSize = ctx.deps
    .t("viewer.canvas.hud.positionSize", "x {x} · y {y} · {width} × {height}")
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{width}", String(width))
    .replace("{height}", String(height));
  const rotationLabel = ctx.deps
    .t("viewer.canvas.hud.rotation", "Rotation {rotation}°")
    .replace("{rotation}", String(rotation));
  const snapLabel = ctx.state.canvasSnapStatus
    ? ctx.deps
        .t("viewer.canvas.hud.snap", "Snap: {status}")
        .replace("{status}", ctx.state.canvasSnapStatus)
    : "";
  updateCanvasInfoHudContent(ctx, {
    id: layer.id,
    label,
    note: previewDeferred
      ? ctx.deps.t(
          "viewer.canvas.hud.cachedInteraction",
          "Cached mode · frame updates after a pause or release",
        )
      : "",
    positionSize,
    rotation: capabilities.transform.includes("rotation") ? rotationLabel : "",
    snap: snapLabel,
  });
  positionCanvasInfoHud(ctx, box, canvasRect, stageRect, scaleX, scaleY);
}

function updateCanvasInfoHudContent(
  ctx: ViewerAppContext,
  content: {
    id: string;
    label: string;
    note?: string;
    positionSize?: string;
    rotation?: string;
    snap?: string;
  },
): void {
  const elements = ensureCanvasInfoHudElements(ctx.refs.canvasInfoHud);
  setText(elements.name, content.label);
  setText(elements.id, content.id);
  setText(elements.positionSize, content.positionSize ?? "");
  setText(elements.rotation, content.rotation ?? "");
  setText(elements.note, content.note ?? "");
  setText(elements.snap, content.snap ?? "");
  elements.metrics.hidden = !content.positionSize && !content.rotation;
  elements.positionSize.hidden = !content.positionSize;
  elements.rotation.hidden = !content.rotation;
  elements.note.hidden = !content.note;
  elements.snap.hidden = !content.snap;
}

function ensureCanvasInfoHudElements(hud: HTMLElement): CanvasInfoHudElements {
  const cached = hudElementCache.get(hud);
  if (cached) {
    return cached;
  }
  const heading = document.createElement("div");
  heading.className = "canvas-info-hud-heading";
  const name = document.createElement("strong");
  name.className = "canvas-info-hud-name";
  const id = document.createElement("small");
  id.className = "canvas-info-hud-id";
  heading.append(name, id);

  const metrics = document.createElement("div");
  metrics.className = "canvas-info-hud-metrics";
  const positionSize = document.createElement("span");
  positionSize.className = "canvas-info-hud-position-size";
  const rotation = document.createElement("span");
  rotation.className = "canvas-info-hud-rotation";
  metrics.append(positionSize, rotation);

  const note = document.createElement("span");
  note.className = "canvas-info-hud-note";
  const snap = document.createElement("span");
  snap.className = "canvas-info-hud-snap snap";
  hud.replaceChildren(heading, metrics, note, snap);
  const elements = {
    heading,
    id,
    metrics,
    name,
    note,
    positionSize,
    rotation,
    snap,
  };
  hudElementCache.set(hud, elements);
  return elements;
}

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

export function formatCanvasHudNumber(value: unknown): string {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function positionCanvasInfoHud(
  ctx: ViewerAppContext,
  box,
  canvasRect,
  stageRect,
  scaleX,
  scaleY,
  options: { rendererManaged?: boolean } = {},
) {
  const left = canvasRect.left - stageRect.left + box.x * scaleX;
  const top = canvasRect.top - stageRect.top + box.y * scaleY;
  const hudWidth = ctx.refs.canvasInfoHud.offsetWidth || 280;
  const hudHeight = ctx.refs.canvasInfoHud.offsetHeight || 48;
  const position = resolveCanvasHudPosition({
    hud: { height: hudHeight, width: hudWidth },
    placement: options.rendererManaged ? "managed" : "selection",
    selection: {
      height: box.height * scaleY,
      left,
      top,
      width: box.width * scaleX,
    },
    stage: { height: stageRect.height, width: stageRect.width },
  });
  const nextLeft = `${position.left}px`;
  const nextTop = `${position.top}px`;
  if (ctx.refs.canvasInfoHud.style.left !== nextLeft) {
    ctx.refs.canvasInfoHud.style.left = nextLeft;
  }
  if (ctx.refs.canvasInfoHud.style.top !== nextTop) {
    ctx.refs.canvasInfoHud.style.top = nextTop;
  }
}

function getCanvasSnapStatusForBox(ctx: ViewerAppContext, box, layer = null) {
  const pivot = layer
    ? ctx.getLayerCanvasPivot(box, layer)
    : { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  const anchors = getCanvasSnapAnchorValues(box, pivot);
  const tolerance = 2;
  const xGuide = resolveCanvasGuideSnapForAnchors(
    0,
    anchors.x,
    ctx.getCanvasSnapGuides(ctx.refs.canvas.width, 0.08),
    { captureTolerance: tolerance, releaseTolerance: tolerance },
  );
  const yGuide = resolveCanvasGuideSnapForAnchors(
    0,
    anchors.y,
    ctx.getCanvasSnapGuides(ctx.refs.canvas.height, 0.1),
    { captureTolerance: tolerance, releaseTolerance: tolerance },
  );
  const snap = [];
  if (xGuide.guide) snap.push(`X ${xGuide.guide.label}`);
  if (yGuide.guide) snap.push(`Y ${yGuide.guide.label}`);
  return snap.join(" · ");
}

export function installCanvasSelectionHudOwner(ctx: ViewerAppContext): void {
  ctx.hideCanvasInfoHud = (...args: any[]) =>
    (hideCanvasInfoHud as any)(ctx, ...args);
  ctx.updateCanvasInfoHud = (...args: any[]) =>
    (updateCanvasInfoHud as any)(ctx, ...args);
  ctx.getCanvasSnapStatusForBox = (...args: any[]) =>
    (getCanvasSnapStatusForBox as any)(ctx, ...args);
}
