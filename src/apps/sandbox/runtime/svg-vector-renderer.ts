import { roundRect } from "./math.js";
import { parseSvgAsset } from "./svg-vector-parser.js";

export function drawSvgVectorAsset(
  context: any,
  asset: any,
  args: any,
  drawImageAsset: any,
) {
  if (
    (!asset?.svgText && !asset?.svgVector) ||
    typeof Path2D === "undefined" ||
    (!asset.svgVector && typeof DOMParser === "undefined")
  ) {
    drawImageAsset(context, asset, args);
    return;
  }
  const parsed = parseSvgAsset(asset);
  const {
    alpha = 1,
    composite = "source-over",
    filter = "none",
    height = asset.height ?? parsed.height,
    partFilter,
    partGroups,
    partIds,
    partTransform,
    shadowBlur = 0,
    shadowColor = "transparent",
    width = asset.width ?? parsed.width,
    x = 0,
    y = 0,
  } = args ?? {};
  context.save();
  context.globalAlpha *= alpha;
  context.globalCompositeOperation = composite;
  context.filter = filter;
  context.shadowBlur = shadowBlur;
  context.shadowColor = shadowColor;
  context.translate(x, y);
  context.scale(width / parsed.width, height / parsed.height);
  parsed.parts.forEach((part: any, index: number) => {
    if (!matchesSvgPart(part, { partFilter, partGroups, partIds })) {
      return;
    }
    drawSvgPart(context, part, index, parsed, partTransform);
  });
  context.restore();
}

function drawSvgPart(
  context: any,
  part: any,
  index: number,
  parsed: any,
  partTransform: any,
) {
  const transform =
    typeof partTransform === "function"
      ? (partTransform(part, index, parsed) ?? {})
      : {};
  const partAlpha = (transform.alpha ?? 1) * (part.opacity ?? 1);
  if (partAlpha <= 0) {
    return;
  }
  context.save();
  context.globalAlpha *= partAlpha;
  if (transform.composite)
    context.globalCompositeOperation = transform.composite;
  if (transform.filter) context.filter = transform.filter;
  context.translate(transform.x ?? 0, transform.y ?? 0);
  const originX = transform.originX ?? part.cx ?? parsed.width * 0.5;
  const originY = transform.originY ?? part.cy ?? parsed.height * 0.5;
  if (transform.rotate || transform.scale) {
    context.translate(originX, originY);
    context.rotate(transform.rotate ?? 0);
    const scale = transform.scale ?? 1;
    context.scale(scale, scale);
    context.translate(-originX, -originY);
  }
  context.lineCap = part.strokeLineCap ?? "butt";
  context.lineJoin = part.strokeLineJoin ?? "miter";
  context.lineWidth = part.strokeWidth ?? 1;
  if (part.fill) {
    context.fillStyle = part.fill;
  }
  if (part.stroke) {
    context.strokeStyle = part.stroke;
  }
  if (part.type === "path") {
    drawPathPart(context, part);
  } else {
    drawRectPart(context, part);
  }
  context.restore();
}

function drawPathPart(context: any, part: any) {
  if (part.fill) {
    context.fill(part.path);
  }
  if (part.stroke) {
    context.stroke(part.path);
  }
}

function drawRectPart(context: any, part: any) {
  roundRect(context, part.x, part.y, part.width, part.height, part.rx);
  if (part.fill) {
    context.fill();
  }
  if (part.stroke) {
    context.stroke();
  }
}

function matchesSvgPart(part: any, filters: any) {
  if (typeof filters.partFilter === "function" && !filters.partFilter(part)) {
    return false;
  }
  if (
    Array.isArray(filters.partIds) &&
    filters.partIds.length > 0 &&
    !filters.partIds.includes(part.id)
  ) {
    return false;
  }
  if (
    Array.isArray(filters.partGroups) &&
    filters.partGroups.length > 0 &&
    !filters.partGroups.some((groupId: string) =>
      part.groupIds?.includes(groupId),
    )
  ) {
    return false;
  }
  return true;
}
