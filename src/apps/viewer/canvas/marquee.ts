import type { ViewerAppContext } from "../app/context.js";
import { getLayerLeafIds } from "../layers/hierarchy.js";
import { resolveCanvasSelectionBounds } from "./selection-bounds.js";

const MARQUEE_THRESHOLD_CSS_PIXELS = 3;

function beginCanvasMarqueeSelection(ctx: ViewerAppContext, event) {
  if (event.button !== 0) {
    return false;
  }
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY };
  const initial = [...ctx.state.selectedLayers];
  const marquee = ensureCanvasMarquee(ctx);
  marquee.hidden = true;
  const onMove = (moveEvent) => {
    const rect = normalizePageRect(start, {
      x: moveEvent.clientX,
      y: moveEvent.clientY,
    });
    if (
      !ctx.state.dragMoved &&
      rect.width + rect.height < MARQUEE_THRESHOLD_CSS_PIXELS
    ) {
      return;
    }
    ctx.state.dragMoved = true;
    updateCanvasMarqueeRect(ctx, marquee, rect);
    marquee.hidden = false;
    const hitIds = findCanvasMarqueeLayerIds(ctx, rect);
    const selected = resolveMarqueeSelection(initial, hitIds, event);
    ctx.selectCanvasLayers(selected, selected.at(-1) ?? null);
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    marquee.hidden = true;
    if (!ctx.state.dragMoved && !hasSelectionModifier(event)) {
      ctx.selectCanvasLayers([]);
    }
  });
  return true;
}

function findCanvasMarqueeLayerIds(ctx: ViewerAppContext, pageRect): string[] {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return [];
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const time = Number(ctx.refs.timeSlider.value) || 0;
  const resolution = { time, timeline: template.timeline };
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const canvasMarquee = {
    maxX:
      ((pageRect.x + pageRect.width - canvasRect.left) /
        Math.max(1, canvasRect.width)) *
      ctx.refs.canvas.width,
    maxY:
      ((pageRect.y + pageRect.height - canvasRect.top) /
        Math.max(1, canvasRect.height)) *
      ctx.refs.canvas.height,
    minX:
      ((pageRect.x - canvasRect.left) / Math.max(1, canvasRect.width)) *
      ctx.refs.canvas.width,
    minY:
      ((pageRect.y - canvasRect.top) / Math.max(1, canvasRect.height)) *
      ctx.refs.canvas.height,
  };
  return ctx.getCanvasSelectionLevelLayerIds(template).filter((layerId) => {
    const leafIds = getLayerLeafIds(hierarchy, [layerId]).filter((leafId) => {
      const layer = hierarchy.byId.get(leafId);
      return Boolean(
        layer &&
        layer.visible !== false &&
        ctx.isLayerCanvasSelectable(layer) &&
        ctx.isLayerActiveAtTime(template, leafId, time) &&
        !isStandaloneFullCanvasLayer(ctx, layerId, layer),
      );
    });
    const bounds = resolveCanvasSelectionBounds(
      ctx,
      template,
      leafIds,
      resolution,
    );
    if (!bounds) {
      return false;
    }
    const center = {
      x: bounds.box.x + bounds.box.width * 0.5,
      y: bounds.box.y + bounds.box.height * 0.5,
    };
    return (
      center.x >= canvasMarquee.minX &&
      center.x <= canvasMarquee.maxX &&
      center.y >= canvasMarquee.minY &&
      center.y <= canvasMarquee.maxY
    );
  });
}

function resolveMarqueeSelection(initial, hits, event): string[] {
  if (!hasSelectionModifier(event)) {
    return hits;
  }
  const result = [...initial];
  for (const layerId of hits) {
    const index = result.indexOf(layerId);
    if (event.metaKey || event.ctrlKey) {
      if (index >= 0) {
        result.splice(index, 1);
      } else {
        result.push(layerId);
      }
    } else if (index < 0) {
      result.push(layerId);
    }
  }
  return result;
}

function isStandaloneFullCanvasLayer(ctx, rootId, layer): boolean {
  if (rootId !== layer.id) {
    return false;
  }
  if (ctx.getLayerEditorCapabilities(layer).canvas === "fullFrame") {
    return true;
  }
  const box = ctx.getLayerCanvasHitBox(layer.id, layer);
  return Boolean(
    box &&
    box.width >= ctx.refs.canvas.width * 0.9 &&
    box.height >= ctx.refs.canvas.height * 0.9,
  );
}

function ensureCanvasMarquee(ctx): HTMLDivElement {
  const existing = ctx.refs.stageFrame.querySelector(".canvas-marquee");
  if (existing instanceof HTMLDivElement) {
    return existing;
  }
  const marquee = document.createElement("div");
  marquee.className = "canvas-marquee";
  marquee.hidden = true;
  ctx.refs.stageFrame.append(marquee);
  return marquee;
}

function updateCanvasMarqueeRect(ctx, marquee, rect): void {
  const stageRect = ctx.refs.stageFrame.getBoundingClientRect();
  marquee.style.left = `${rect.x - stageRect.left}px`;
  marquee.style.top = `${rect.y - stageRect.top}px`;
  marquee.style.width = `${rect.width}px`;
  marquee.style.height = `${rect.height}px`;
}

function normalizePageRect(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x,
    y,
  };
}

function hasSelectionModifier(event): boolean {
  return Boolean(event.shiftKey || event.metaKey || event.ctrlKey);
}

export function installCanvasMarqueeOwner(ctx: ViewerAppContext): void {
  ctx.beginCanvasMarqueeSelection = beginCanvasMarqueeSelection.bind(
    undefined,
    ctx,
  );
}
