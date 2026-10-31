import { bindViewerAction } from "../app/bind-action.js";
import type { ViewerAppContext } from "../app/context.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { ViewerAsset } from "../assets/state.js";
import type { InspectorOverviewActions } from "./overview-contract.js";

type SvgPaintState = {
  fill: string | null;
  stroke: string | null;
  groupIds: string[];
};
export type InspectorSvgPart = {
  groupIds: string[];
  id: string;
  kind: string;
  paint: "stroke" | "fill" | "shape";
  swatch: string;
};
const MAX_VISIBLE_PARTS = 48;

function appendSvgPartPicker(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  target: HTMLElement | null = null,
): void {
  const asset =
    typeof layer.assetId === "string"
      ? ctx.state.assets.get(layer.assetId)
      : undefined;
  const parts = parseSvgPartsForInspector(asset);
  if (parts.length === 0) return;
  const selectedIds = new Set(parseSvgPartIdList(layer.svgPartIds));
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.svgPartBrowser",
    "SVG Part Browser",
  );
  const picker = document.createElement("div");
  picker.className = "svg-part-picker";
  picker.dataset.layerId = layer.id;
  for (const part of parts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `svg-part-chip${selectedIds.has(part.id) ? " selected" : ""}`;
    button.dataset.layerId = layer.id;
    button.dataset.partId = part.id;
    button.title = [
      part.id,
      part.groupIds.length ? `group: ${part.groupIds.join(" / ")}` : "",
      part.paint,
    ]
      .filter(Boolean)
      .join("\n");
    const swatch = document.createElement("span");
    swatch.className = "svg-part-swatch";
    swatch.style.backgroundColor = resolveSvgSwatch(part.swatch);
    const name = document.createElement("strong");
    name.textContent = part.id;
    const kind = document.createElement("small");
    kind.textContent = part.kind;
    button.append(swatch, name, kind);
    button.addEventListener("click", () => {
      const current = new Set(
        parseSvgPartIdList(
          ctx
            .getEffectiveTemplate(ctx.state.currentTemplate)
            ?.layers.find((item) => item.id === layer.id)?.svgPartIds ??
            layer.svgPartIds,
        ),
      );
      if (current.has(part.id)) current.delete(part.id);
      else current.add(part.id);
      const value = [...current].join(", ");
      ctx.beginEditorCommand({
        payload: { layerId: layer.id, property: "svgPartIds", value },
        type: "updateLayerProperty",
      });
      ctx.updateLayerDefinitionProperty(layer.id, "svgPartIds", value);
    });
    picker.append(button);
  }
  if (target) target.append(heading, picker);
  else ctx.appendInspectorNode(heading, picker);
}

export function parseSvgPartsForInspector(
  asset: Pick<ViewerAsset, "mimeType" | "svgText"> | undefined,
): InspectorSvgPart[] {
  if (
    typeof asset?.svgText !== "string" ||
    !asset.svgText ||
    asset.mimeType !== "image/svg+xml" ||
    typeof DOMParser === "undefined"
  )
    return [];
  try {
    const doc = new DOMParser().parseFromString(asset.svgText, "image/svg+xml");
    const root = doc.documentElement;
    if (
      doc.querySelector("parsererror") ||
      root.namespaceURI !== "http://www.w3.org/2000/svg" ||
      root.localName !== "svg"
    )
      return [];
    const parts: InspectorSvgPart[] = [];
    walkSvgInspectorNodes(root, parts, {
      groupIds: [],
      fill: normalizeSvgPaint(root.getAttribute("fill") ?? "#000"),
      stroke: normalizeSvgPaint(root.getAttribute("stroke")),
    });
    return parts;
  } catch {
    return [];
  }
}

function walkSvgInspectorNodes(
  node: Element,
  parts: InspectorSvgPart[],
  inherited: SvgPaintState,
): void {
  for (const child of Array.from(node.children)) {
    if (parts.length >= MAX_VISIBLE_PARTS) return;
    const tag = child.tagName.toLowerCase();
    if (tag === "defs" || tag === "clippath") continue;
    const groupIds =
      tag === "g" && child.id
        ? [...inherited.groupIds, child.id]
        : inherited.groupIds;
    const state: SvgPaintState = {
      fill: normalizeSvgPaint(child.getAttribute("fill") ?? inherited.fill),
      groupIds,
      stroke: normalizeSvgPaint(
        child.getAttribute("stroke") ?? inherited.stroke,
      ),
    };
    if (
      [
        "path",
        "rect",
        "circle",
        "ellipse",
        "line",
        "polyline",
        "polygon",
      ].includes(tag) &&
      (state.fill || state.stroke || tag === "line" || tag === "polyline")
    ) {
      const prefix = groupIds.at(-1);
      const id =
        child.id || `${prefix ? `${prefix}.` : ""}${tag}-${parts.length}`;
      parts.push({
        groupIds,
        id,
        kind: tag,
        paint: state.stroke ? "stroke" : state.fill ? "fill" : "shape",
        swatch: state.stroke || state.fill || "#9aa5ae",
      });
    }
    walkSvgInspectorNodes(child, parts, state);
  }
}

function normalizeSvgPaint(value: string | null): string | null {
  if (!value || value === "none") return null;
  return value.startsWith("url(") ? "#f4fbff" : value;
}

export function parseSvgPartIdList(value: unknown): string[] {
  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function resolveSvgSwatch(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{3,8}$/i.test(text) || /^rgba?\([\d\s,%.]+\)$/i.test(text)
    ? text
    : "#9aa5ae";
}

export function createInspectorSvgPartActions(
  getContext: () => ViewerAppContext,
): Pick<InspectorOverviewActions, "appendSvgPartPicker"> {
  return {
    appendSvgPartPicker: bindViewerAction(appendSvgPartPicker, getContext),
  };
}
