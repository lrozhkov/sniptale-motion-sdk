import type { ViewerAppContext } from "../app/context.js";

function appendSvgPartPicker(ctx: ViewerAppContext, layer, target = null) {
  const asset = ctx.state.assets.get(layer.assetId);
  const parts = ctx.parseSvgPartsForInspector(asset);
  if (parts.length === 0) {
    return;
  }
  const selectedIds = new Set(ctx.parseCsvList(layer.svgPartIds));
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
    button.innerHTML = `<span class="svg-part-swatch" style="background:${ctx.escapeCssColor(part.swatch)}"></span><strong>${ctx.escapeHtml(part.id)}</strong><small>${ctx.escapeHtml(part.kind)}</small>`;
    button.addEventListener("click", () => {
      const current = new Set(
        ctx.parseCsvList(
          ctx
            .getEffectiveTemplate(ctx.state.currentTemplate)
            ?.layers.find((item) => item.id === layer.id)?.svgPartIds ??
            layer.svgPartIds,
        ),
      );
      if (current.has(part.id)) {
        current.delete(part.id);
      } else {
        current.add(part.id);
      }
      const value = Array.from(current).join(", ");
      ctx.beginEditorCommand({
        payload: { layerId: layer.id, property: "svgPartIds", value },
        type: "updateLayerProperty",
      });
      ctx.updateLayerDefinitionProperty(layer.id, "svgPartIds", value);
    });
    picker.append(button);
  }
  if (target) {
    target.append(heading, picker);
  } else {
    ctx.appendInspectorNode(heading, picker);
  }
}

function parseSvgPartsForInspector(ctx: ViewerAppContext, asset) {
  if (
    !asset?.svgText ||
    asset.mimeType !== "image/svg+xml" ||
    typeof DOMParser === "undefined"
  ) {
    return [];
  }
  try {
    const doc = new DOMParser().parseFromString(asset.svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) {
      return [];
    }
    const parts = [];
    ctx.walkSvgInspectorNodes(doc.documentElement, parts, {
      groupIds: [],
      fill: null,
      stroke: null,
    });
    return parts.slice(0, 48);
  } catch {
    return [];
  }
}

function walkSvgInspectorNodes(ctx: ViewerAppContext, node, parts, inherited) {
  for (const child of Array.from(node.children ?? []) as any[]) {
    const tag = child.tagName.toLowerCase();
    if (tag === "defs" || tag === "clippath") {
      continue;
    }
    const groupIds =
      tag === "g" && child.id
        ? [...inherited.groupIds, child.id]
        : inherited.groupIds;
    const state = {
      fill: ctx.normalizeSvgPaint(child.getAttribute("fill") ?? inherited.fill),
      groupIds,
      stroke: ctx.normalizeSvgPaint(
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
      ].includes(tag)
    ) {
      const id =
        child.id || ctx.createGeneratedSvgInspectorPartId(state, tag, parts);
      const paint = state.stroke ? "stroke" : state.fill ? "fill" : "shape";
      if (state.fill || state.stroke || tag === "line" || tag === "polyline") {
        parts.push({
          groupIds: state.groupIds,
          id,
          kind: tag,
          paint,
          swatch: state.stroke || state.fill || "#9aa5ae",
        });
      }
    }
    ctx.walkSvgInspectorNodes(child, parts, state);
  }
}

function createGeneratedSvgInspectorPartId(
  ctx: ViewerAppContext,
  state,
  tag,
  parts,
) {
  const prefix = state.groupIds.length
    ? `${state.groupIds[state.groupIds.length - 1]}.`
    : "";
  return `${prefix}${tag}-${parts.length}`;
}

function normalizeSvgPaint(ctx: ViewerAppContext, value) {
  if (!value || value === "none") {
    return null;
  }
  return String(value).startsWith("url(") ? "#f4fbff" : String(value);
}

function parseCsvList(ctx: ViewerAppContext, value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(ctx: ViewerAppContext, value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function escapeCssColor(ctx: ViewerAppContext, value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(text) || /^rgba?\([\d\s,%.]+\)$/i.test(text)) {
    return text;
  }
  return "#9aa5ae";
}

export function installInspectorSvgPartFieldsOwner(
  ctx: ViewerAppContext,
): void {
  ctx.appendSvgPartPicker = (...args: any[]) =>
    (appendSvgPartPicker as any)(ctx, ...args);
  ctx.parseSvgPartsForInspector = (...args: any[]) =>
    (parseSvgPartsForInspector as any)(ctx, ...args);
  ctx.walkSvgInspectorNodes = (...args: any[]) =>
    (walkSvgInspectorNodes as any)(ctx, ...args);
  ctx.createGeneratedSvgInspectorPartId = (...args: any[]) =>
    (createGeneratedSvgInspectorPartId as any)(ctx, ...args);
  ctx.normalizeSvgPaint = (...args: any[]) =>
    (normalizeSvgPaint as any)(ctx, ...args);
  ctx.parseCsvList = (...args: any[]) => (parseCsvList as any)(ctx, ...args);
  ctx.escapeHtml = (...args: any[]) => (escapeHtml as any)(ctx, ...args);
  ctx.escapeCssColor = (...args: any[]) =>
    (escapeCssColor as any)(ctx, ...args);
}
