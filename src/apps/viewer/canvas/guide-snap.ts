import { bindViewerAction } from "../app/bind-action.js";
import type {
  CanvasGuideActions,
  CanvasGuideSnapSession,
  CanvasGuideRecentRelease,
} from "./guide-contract.js";
import type { CanvasPoint, CanvasRect } from "./geometry-contract.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  type CanvasGuideSnapLock,
  getCanvasSnapAnchorValues,
  resolveCanvasGuideSnapForAnchors,
} from "./guide-snap-axis.js";
import { getAxisAlignedCanvasBox } from "./selection-bounds.js";

export {
  getCanvasSnapAnchorValues,
  resolveCanvasGuideSnap,
} from "./guide-snap-axis.js";

const SNAP_CAPTURE_CSS_PIXELS = 6;
const SNAP_CAPTURE_CORE_CSS_PIXELS = 1.5;
const SNAP_RELEASE_CSS_PIXELS = 6;
const SNAP_RELEASE_BLEND_CSS_PIXELS = 18;
const SNAP_REACQUIRE_COOLDOWN_SAMPLES = 8;

function createCanvasGuideSnapSession(
  ctx: ViewerAppContext,
  layerId: string,
  layer: EffectLayer,
  position: CanvasPoint,
): CanvasGuideSnapSession | null {
  const box = ctx.getLayerCanvasBox(layerId, layer);
  if (!box) return null;
  const pivot = ctx.getLayerCanvasPivot(box, layer);
  const anchors = getCanvasSnapAnchorValues(box, pivot);
  return {
    xAnchorOffsets: anchors.x.map((value) => value - position.x),
    xGuides: getCanvasGestureSnapGuides(ctx, "x", [layerId]),
    xLock: null,
    xRecentRelease: null,
    yAnchorOffsets: anchors.y.map((value) => value - position.y),
    yGuides: getCanvasGestureSnapGuides(ctx, "y", [layerId]),
    yLock: null,
    yRecentRelease: null,
  };
}

function createCanvasGuideSnapSessionForBox(
  ctx: ViewerAppContext,
  box: CanvasRect,
  position = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
  excludedLayerIds: string[] = [],
): CanvasGuideSnapSession {
  const pivot = { x: position.x, y: position.y };
  const anchors = getCanvasSnapAnchorValues(box, pivot);
  return {
    xAnchorOffsets: anchors.x.map((value) => value - position.x),
    xGuides: getCanvasGestureSnapGuides(ctx, "x", excludedLayerIds),
    xLock: null,
    xRecentRelease: null,
    yAnchorOffsets: anchors.y.map((value) => value - position.y),
    yGuides: getCanvasGestureSnapGuides(ctx, "y", excludedLayerIds),
    yLock: null,
    yRecentRelease: null,
  };
}

function applyCanvasGuideSnap(
  ctx: ViewerAppContext,
  session: CanvasGuideSnapSession | null,
  x: number,
  y: number,
) {
  if (!session) return { snap: [], x, y };
  if (!ctx.state.previewSnap) {
    session.xLock = null;
    session.yLock = null;
    session.xRecentRelease = null;
    session.yRecentRelease = null;
    return { snap: [], x, y };
  }

  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const canvasUnitsPerCssPixel = Math.max(
    ctx.refs.canvas.width / Math.max(1, canvasRect.width),
    ctx.refs.canvas.height / Math.max(1, canvasRect.height),
  );
  const captureTolerance = canvasUnitsPerCssPixel * SNAP_CAPTURE_CSS_PIXELS;
  const releaseTolerance = canvasUnitsPerCssPixel * SNAP_RELEASE_CSS_PIXELS;
  const releaseBlendTolerance =
    canvasUnitsPerCssPixel * SNAP_RELEASE_BLEND_CSS_PIXELS;
  const captureCoreTolerance =
    canvasUnitsPerCssPixel * SNAP_CAPTURE_CORE_CSS_PIXELS;
  const previousXLock = session.xLock;
  const previousYLock = session.yLock;
  const snappedX = resolveCanvasGuideSnapForAnchors(
    x,
    session.xAnchorOffsets,
    withoutRecentlyReleasedGuide(session.xGuides, session.xRecentRelease),
    {
      captureCoreTolerance,
      captureTolerance,
      lock: session.xLock,
      releaseBlendTolerance,
      releaseTolerance,
    },
  );
  const snappedY = resolveCanvasGuideSnapForAnchors(
    y,
    session.yAnchorOffsets,
    withoutRecentlyReleasedGuide(session.yGuides, session.yRecentRelease),
    {
      captureCoreTolerance,
      captureTolerance,
      lock: session.yLock,
      releaseBlendTolerance,
      releaseTolerance,
    },
  );
  session.xLock = snappedX.lock;
  session.yLock = snappedY.lock;
  session.xRecentRelease = updateRecentGuideRelease(
    previousXLock,
    snappedX.lock,
    session.xRecentRelease,
  );
  session.yRecentRelease = updateRecentGuideRelease(
    previousYLock,
    snappedY.lock,
    session.yRecentRelease,
  );
  const snap = [];
  if (snappedX.locked && snappedX.guide) {
    snap.push(`X ${snappedX.guide.label}`);
  }
  if (snappedY.locked && snappedY.guide) {
    snap.push(`Y ${snappedY.guide.label}`);
  }
  return {
    snap,
    x: x + snappedX.delta,
    y: y + snappedY.delta,
  };
}

function withoutRecentlyReleasedGuide(
  guides: Array<{ label: string; value: number }>,
  recent: CanvasGuideRecentRelease | null,
) {
  return recent
    ? guides.filter(
        (guide) =>
          guide.label !== recent.guide.label ||
          Math.abs(guide.value - recent.guide.value) > 0.0001,
      )
    : guides;
}

function updateRecentGuideRelease(
  previousLock: CanvasGuideSnapLock | null,
  nextLock: CanvasGuideSnapLock | null,
  recent: CanvasGuideRecentRelease | null,
): CanvasGuideRecentRelease | null {
  if (previousLock && !nextLock) {
    return {
      guide: previousLock.guide,
      remaining: SNAP_REACQUIRE_COOLDOWN_SAMPLES,
    };
  }
  if (nextLock) {
    return null;
  }
  return recent && recent.remaining > 1
    ? { ...recent, remaining: recent.remaining - 1 }
    : null;
}

function getCanvasSnapGuides(
  ctx: ViewerAppContext,
  size: number,
  safeInsetRatio: number,
) {
  const safeInset = size * safeInsetRatio;
  return [
    {
      label: ctx.deps.t("viewer.canvas.guides.safeStart", "Safe start"),
      value: safeInset,
    },
    { label: "33%", value: size / 3 },
    {
      label: ctx.deps.t("viewer.canvas.guides.center", "Center"),
      value: size / 2,
    },
    { label: "66%", value: (size * 2) / 3 },
    {
      label: ctx.deps.t("viewer.canvas.guides.safeEnd", "Safe end"),
      value: size - safeInset,
    },
  ];
}

function getCanvasGestureSnapGuides(
  ctx: ViewerAppContext,
  axis: "x" | "y",
  excludedLayerIds: string[],
) {
  const size = axis === "x" ? ctx.refs.canvas.width : ctx.refs.canvas.height;
  const guides = getCanvasSnapGuides(ctx, size, axis === "x" ? 0.08 : 0.1);
  const excluded = new Set(excludedLayerIds);
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const time = Number(ctx.refs.timeSlider.value) || 0;
  if (!template) {
    return guides;
  }
  const resolution = { time, timeline: template.timeline };
  for (const layer of template.layers ?? []) {
    if (
      excluded.has(layer.id) ||
      layer.visible === false ||
      !ctx.isLayerCanvasSelectable(layer) ||
      !ctx.isLayerActiveAtTime(template, layer.id, time)
    ) {
      continue;
    }
    const box = ctx.getLayerCanvasBox(layer.id, layer, resolution);
    if (!box) {
      continue;
    }
    const bounds = getAxisAlignedCanvasBox(
      box,
      ctx.getLayerCanvasPivot(box, layer),
    );
    const start = axis === "x" ? bounds.x : bounds.y;
    const length = axis === "x" ? bounds.width : bounds.height;
    for (const value of [start, start + length * 0.5, start + length]) {
      guides.push({
        label:
          typeof layer.name === "string" && layer.name ? layer.name : layer.id,
        value,
      });
    }
  }
  return guides;
}

export function createCanvasGuideActions(
  getContext: () => ViewerAppContext,
): CanvasGuideActions {
  return {
    createCanvasGuideSnapSession: bindViewerAction(
      createCanvasGuideSnapSession,
      getContext,
    ),
    createCanvasGuideSnapSessionForBox: bindViewerAction(
      createCanvasGuideSnapSessionForBox,
      getContext,
    ),
    applyCanvasGuideSnap: bindViewerAction(applyCanvasGuideSnap, getContext),
    getCanvasSnapGuides: bindViewerAction(getCanvasSnapGuides, getContext),
  };
}
