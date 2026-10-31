import { bindViewerAction } from "../app/bind-action.js";
import type {
  CanvasGeometryActions,
  CanvasPoint,
  CanvasRect,
} from "./geometry-contract.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { CanvasPropertyResolution } from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { getLayerAuthorCanvasBox } from "./layer-author-geometry.js";
import { usesIntrinsicCanvasGeometry } from "./layer-hit-geometry.js";
import { fitOrientedBoxToPrimitiveBounds } from "./primitive-geometry.js";

export function getLayerCanvasBox(
  ctx: ViewerAppContext,
  layerId: string,
  layer: EffectLayer,
  resolution: CanvasPropertyResolution = {},
) {
  const capabilities = ctx.getLayerEditorCapabilities(layer);
  if (capabilities.canvas === "none") {
    return null;
  }
  if (capabilities.canvas === "fullFrame") {
    return {
      height: ctx.refs.canvas.height,
      rotation: 0,
      width: ctx.refs.canvas.width,
      x: 0,
      y: 0,
    };
  }
  const transformPreview = ctx.state.canvasTransformPreview;
  if (
    transformPreview?.boxes?.[layerId] &&
    transformPreview.templateId === ctx.state.currentTemplate?.id
  ) {
    return { ...transformPreview.boxes[layerId] };
  }
  if (
    transformPreview?.layerId !== undefined &&
    transformPreview.layerId === layerId &&
    transformPreview.templateId === ctx.state.currentTemplate?.id
  ) {
    return { ...transformPreview.box };
  }
  const primitiveBox = ctx.getLayerPrimitiveCanvasBox(layerId, layer);
  const hasAuthorGeometry = ctx.layerHasAuthorGeometryHints(layerId, layer);
  if (primitiveBox && !hasAuthorGeometry) {
    return primitiveBox;
  }
  const rotation = ctx.getResolvedLayerProperty(layer, "rotation", resolution);
  const authorBox = getLayerAuthorCanvasBox(ctx, layerId, layer, resolution);
  if (!authorBox) {
    return null;
  }
  if (usesIntrinsicCanvasGeometry(capabilities)) {
    return authorBox;
  }
  const anchor = ctx.getResolvedLayerAnchor(layer, resolution);
  return primitiveBox
    ? fitOrientedBoxToPrimitiveBounds({
        anchor,
        primitiveBox,
        referenceBox: authorBox,
        rotation,
      })
    : authorBox;
}

export function getResolvedLayerAnchor(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  resolution: CanvasPropertyResolution = {},
) {
  return {
    x: ctx.deps.clamp(
      ctx.getResolvedLayerProperty(layer, "anchorX", resolution),
      -0.5,
      0.5,
    ),
    y: ctx.deps.clamp(
      ctx.getResolvedLayerProperty(layer, "anchorY", resolution),
      -0.5,
      0.5,
    ),
  };
}

export function getLayerCanvasPivot(
  ctx: ViewerAppContext,
  box: CanvasRect,
  layer: EffectLayer,
) {
  return getCanvasBoxPivot(box, ctx.getResolvedLayerAnchor(layer));
}

export function getLayerBaseCanvasBox(
  ctx: ViewerAppContext,
  layerId: string,
  layer: EffectLayer,
  resolution: CanvasPropertyResolution = {},
) {
  const capabilities = ctx.getLayerEditorCapabilities(layer);
  if (capabilities.canvas === "none") {
    return null;
  }
  if (capabilities.canvas === "fullFrame") {
    return {
      height: ctx.refs.canvas.height,
      width: ctx.refs.canvas.width,
      x: 0,
      y: 0,
    };
  }
  const x = ctx.getResolvedLayerProperty(layer, "x", resolution);
  const y = ctx.getResolvedLayerProperty(layer, "y", resolution);
  return ctx.getLayerStaticCanvasBox(layerId, x, y, layer);
}

export function getLayerPrimitiveCanvasBox(
  ctx: ViewerAppContext,
  layerId: string,
  _layer: EffectLayer | null = null,
) {
  const bounds = ctx.state.lastBindingReads?.primitiveBounds?.find(
    (item) => item.layerId === layerId,
  );
  if (!bounds) {
    return null;
  }
  const x = ctx.deps.clamp(
    bounds.x,
    -ctx.refs.canvas.width,
    ctx.refs.canvas.width * 2,
  );
  const y = ctx.deps.clamp(
    bounds.y,
    -ctx.refs.canvas.height,
    ctx.refs.canvas.height * 2,
  );
  const width = ctx.deps.clamp(bounds.width, 1, ctx.refs.canvas.width * 2);
  const height = ctx.deps.clamp(bounds.height, 1, ctx.refs.canvas.height * 2);
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }
  return { height, rotation: 0, width, x, y };
}

export function layerHasAuthorGeometryHints(
  ctx: ViewerAppContext,
  layerId: string,
  layer: EffectLayer | null = null,
) {
  const sourceLayer =
    ctx.state.currentTemplate?.layers?.find((item) => item.id === layerId) ??
    layer;
  if (!sourceLayer || typeof sourceLayer !== "object") {
    return false;
  }
  return ["baseX", "baseY", "left", "top", "width", "height"].some((property) =>
    Object.prototype.hasOwnProperty.call(sourceLayer, property),
  );
}

export function getLayerStaticCanvasBox(
  ctx: ViewerAppContext,
  layerId: string,
  x: number,
  y: number,
  layer: EffectLayer | null = null,
) {
  if (layerId === "logo") {
    const width = ctx.refs.canvas.width * 0.42;
    const height = width * (36 / 123);
    return {
      height,
      width,
      x: ctx.refs.canvas.width * 0.5 - width * 0.5 + x,
      y: ctx.refs.canvas.height * 0.36 - height * 0.5 + y,
    };
  }
  if (layerId === "tagline") {
    return {
      height: 48,
      width: ctx.refs.canvas.width * 0.58,
      x: ctx.refs.canvas.width * 0.21 + x,
      y: ctx.refs.canvas.height * 0.58 - 24 + y,
    };
  }
  if (layerId === "glass") {
    return {
      height: ctx.refs.canvas.height * 0.28,
      width: ctx.refs.canvas.width * 0.42,
      x: ctx.refs.canvas.width * 0.29 + x,
      y: ctx.refs.canvas.height * 0.22 + y,
    };
  }
  if (layerId === "process") {
    return {
      height: ctx.refs.canvas.height * 0.52,
      width: ctx.refs.canvas.width * 0.78,
      x: ctx.refs.canvas.width * 0.11 + x,
      y: ctx.refs.canvas.height * 0.18 + y,
    };
  }
  const width = ctx.deps.clamp(
    finiteGeometryValue(layer?.width, 0) || ctx.refs.canvas.width * 0.2,
    8,
    ctx.refs.canvas.width * 2,
  );
  const height = ctx.deps.clamp(
    finiteGeometryValue(layer?.height, 0) || ctx.refs.canvas.height * 0.2,
    8,
    ctx.refs.canvas.height * 2,
  );
  const center = getLayerBaseCenter(ctx, layer, width, height);
  return {
    height,
    width,
    x: center.x - width * 0.5 + x,
    y: center.y - height * 0.5 + y,
  };
}

function getLayerBaseCenter(
  ctx: ViewerAppContext,
  layer: EffectLayer | null,
  width: number,
  height: number,
) {
  if (isFiniteGeometryValue(layer?.left) || isFiniteGeometryValue(layer?.top)) {
    return {
      x:
        ctx.deps.clamp(
          finiteGeometryValue(layer?.left, 0) || 0,
          -ctx.refs.canvas.width,
          ctx.refs.canvas.width * 2,
        ) +
        width * 0.5,
      y:
        ctx.deps.clamp(
          finiteGeometryValue(layer?.top, 0) || 0,
          -ctx.refs.canvas.height,
          ctx.refs.canvas.height * 2,
        ) +
        height * 0.5,
    };
  }
  return {
    x: resolveCanvasCoordinate(
      ctx,
      layer?.baseX,
      ctx.refs.canvas.width,
      ctx.refs.canvas.width * 0.5,
    ),
    y: resolveCanvasCoordinate(
      ctx,
      layer?.baseY,
      ctx.refs.canvas.height,
      ctx.refs.canvas.height * 0.5,
    ),
  };
}

function resolveCanvasCoordinate(
  ctx: ViewerAppContext,
  value: unknown,
  size: number,
  fallback: number,
) {
  if (!isFiniteGeometryValue(value)) {
    return fallback;
  }
  const resolved = Math.abs(value) <= 1 ? value * size : value;
  return ctx.deps.clamp(resolved, -size, size * 2);
}

function getCanvasBoxPivot(box: CanvasRect, anchor: CanvasPoint) {
  return {
    x: box.x + box.width * (0.5 + anchor.x),
    y: box.y + box.height * (0.5 + anchor.y),
  };
}

export function createCanvasGeometryActions(
  getContext: () => ViewerAppContext,
): Omit<CanvasGeometryActions, "getLayerCanvasHitBox"> {
  return {
    getLayerCanvasBox: bindViewerAction(getLayerCanvasBox, getContext),
    getResolvedLayerAnchor: bindViewerAction(
      getResolvedLayerAnchor,
      getContext,
    ),
    getLayerCanvasPivot: bindViewerAction(getLayerCanvasPivot, getContext),
    getLayerBaseCanvasBox: bindViewerAction(getLayerBaseCanvasBox, getContext),
    getLayerAuthorCanvasBox: bindViewerAction(
      getLayerAuthorCanvasBox,
      getContext,
    ),
    getLayerPrimitiveCanvasBox: bindViewerAction(
      getLayerPrimitiveCanvasBox,
      getContext,
    ),
    layerHasAuthorGeometryHints: bindViewerAction(
      layerHasAuthorGeometryHints,
      getContext,
    ),
    getLayerStaticCanvasBox: bindViewerAction(
      getLayerStaticCanvasBox,
      getContext,
    ),
  };
}

function isFiniteGeometryValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function finiteGeometryValue(value: unknown, fallback: number): number {
  return isFiniteGeometryValue(value) ? value : fallback;
}
