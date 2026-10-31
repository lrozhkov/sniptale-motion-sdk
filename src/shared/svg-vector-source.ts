export type SerializedSvgVectorSource = {
  height: number;
  parts: Array<Record<string, unknown>>;
  width: number;
};

type SvgInheritedState = {
  fill: string | null;
  stroke: string | null;
  groupId: string | null;
  groupIds: string[];
  opacity: number;
  strokeLineCap: string;
  strokeLineJoin: string;
  strokeWidth: number;
};

export function serializeSvgTextVectorAsset(asset: {
  height?: number;
  id?: string;
  svgText?: string;
  width?: number;
}): SerializedSvgVectorSource {
  if (typeof asset.svgText !== "string" || asset.svgText.length === 0) {
    throw new Error(
      `SVG asset ${String(asset.id ?? "unknown")} has no source text.`,
    );
  }
  const doc = new DOMParser().parseFromString(asset.svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error(
      `Failed to parse SVG asset ${String(asset.id ?? "unknown")}.`,
    );
  }
  const svg = doc.documentElement;
  const viewBox = parseViewBox(svg.getAttribute("viewBox"), asset);
  const parts: Array<Record<string, unknown>> = [];
  walkSvgNodes(svg, parts, createSvgInheritedState(svg, null, []));
  return { height: viewBox.height, parts, width: viewBox.width };
}

function walkSvgNodes(
  node: Element,
  parts: Array<Record<string, unknown>>,
  inherited: SvgInheritedState | null,
): void {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "defs" || tag === "clippath") continue;
    const childState = createSvgInheritedState(
      child,
      inherited,
      inherited?.groupIds ?? [],
    );
    if (tag === "path") {
      const pathData = child.getAttribute("d");
      if (pathData && (childState.fill || childState.stroke)) {
        parts.push({
          cx: 61.5,
          cy: 18,
          fill: childState.fill,
          groupId: childState.groupId,
          groupIds: childState.groupIds,
          id:
            child.getAttribute("id") ||
            createGeneratedSvgPartId(childState, tag, parts),
          opacity: childState.opacity,
          pathData,
          stroke: childState.stroke,
          strokeLineCap: childState.strokeLineCap,
          strokeLineJoin: childState.strokeLineJoin,
          strokeWidth: childState.strokeWidth,
          type: "path",
        });
      }
    } else if (tag === "rect") {
      pushRectPart(child, childState, parts);
    }
    walkSvgNodes(child, parts, childState);
  }
}

function pushRectPart(
  child: Element,
  childState: SvgInheritedState,
  parts: Array<Record<string, unknown>>,
): void {
  if (!childState.fill && !childState.stroke) return;
  const x = Number(child.getAttribute("x") ?? 0);
  const y = Number(child.getAttribute("y") ?? 0);
  const width = Number(child.getAttribute("width") ?? 0);
  const height = Number(child.getAttribute("height") ?? 0);
  parts.push({
    cx: x + width * 0.5,
    cy: y + height * 0.5,
    fill: childState.fill,
    groupId: childState.groupId,
    groupIds: childState.groupIds,
    height,
    id:
      child.getAttribute("id") ||
      createGeneratedSvgPartId(childState, "rect", parts),
    opacity: childState.opacity,
    rx: Number(child.getAttribute("rx") ?? 0),
    stroke: childState.stroke,
    strokeLineCap: childState.strokeLineCap,
    strokeLineJoin: childState.strokeLineJoin,
    strokeWidth: childState.strokeWidth,
    type: "rect",
    width,
    x,
    y,
  });
}

function createSvgInheritedState(
  node: Element,
  inherited: SvgInheritedState | null,
  parentGroupIds: string[],
): SvgInheritedState {
  const nodeId = node.getAttribute?.("id") || null;
  const tag = node.tagName?.toLowerCase?.() ?? "";
  const groupIds =
    tag === "g" && nodeId
      ? [...(parentGroupIds ?? []), nodeId]
      : [...(parentGroupIds ?? [])];
  const fill = normalizePaint(
    readSvgAttr(node, "fill", inherited?.fill ?? null),
  );
  const stroke = normalizePaint(
    readSvgAttr(node, "stroke", inherited?.stroke ?? null),
  );
  const opacity = clamp(
    Number(readSvgAttr(node, "opacity", 1)) *
      Number(readSvgAttr(node, "fill-opacity", 1)) *
      Number(readSvgAttr(node, "stroke-opacity", 1)) *
      Number(inherited?.opacity ?? 1),
    0,
    1,
  );
  return {
    fill,
    groupId: groupIds.at(-1) ?? null,
    groupIds,
    opacity,
    stroke,
    strokeLineCap: readSvgAttr(
      node,
      "stroke-linecap",
      inherited?.strokeLineCap ?? "butt",
    ),
    strokeLineJoin: readSvgAttr(
      node,
      "stroke-linejoin",
      inherited?.strokeLineJoin ?? "miter",
    ),
    strokeWidth: Math.max(
      0,
      Number(readSvgAttr(node, "stroke-width", inherited?.strokeWidth ?? 1)) ||
        1,
    ),
  };
}

function readSvgAttr<T extends string | number | null>(
  node: Element,
  name: string,
  fallback: T,
): string | T {
  const value = node.getAttribute?.(name);
  return value == null || value === "" ? fallback : value;
}

function createGeneratedSvgPartId(
  state: SvgInheritedState,
  tag: string,
  parts: Array<Record<string, unknown>>,
): string {
  const prefix = state.groupId ? `${state.groupId}.` : "";
  return `${prefix}${tag}-${parts.length}`;
}

function parseViewBox(
  value: unknown,
  asset: { height?: number; width?: number },
) {
  const parts = String(value ?? "")
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);
  const width = parts[2];
  const height = parts[3];
  return parts.length === 4 &&
    width !== undefined &&
    height !== undefined &&
    width > 0 &&
    height > 0
    ? { height, width }
    : { height: asset.height ?? 1, width: asset.width ?? 1 };
}

function normalizePaint(value: string | null): string | null {
  if (!value || value === "none") return null;
  return String(value).startsWith("url(") ? "#f4fbff" : value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
