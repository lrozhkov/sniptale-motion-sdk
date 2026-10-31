import type { ViewerAppContext } from "../app/context.js";
import type { GraphEditorModel } from "./model-types.js";
import { GRAPH_EDITOR_VIEWBOX, graphTimeToX } from "./viewport.js";
import { createGraphSvg } from "./svg-primitives.js";

export function appendGraphSelectionRange(
  ctx: ViewerAppContext,
  svg: SVGElement,
  model: GraphEditorModel,
): void {
  if (!model.selectionBounds || model.selection.length < 2) {
    return;
  }
  const startX = graphTimeToX(model.selectionBounds.start, model.viewport);
  const endX = graphTimeToX(model.selectionBounds.end, model.viewport);
  const band = createGraphSvg("rect", "graph-selection-range");
  band.setAttribute("x", String(startX));
  band.setAttribute("y", String(GRAPH_EDITOR_VIEWBOX.marginTop));
  band.setAttribute("width", String(Math.max(1, endX - startX)));
  band.setAttribute("height", "10");
  svg.append(band);
  appendRangeHandle(ctx, svg, model, "start", startX);
  appendRangeHandle(ctx, svg, model, "end", endX);
}

export function appendGraphPlayhead(
  ctx: ViewerAppContext,
  svg: SVGElement,
  model: GraphEditorModel,
): void {
  const time = Number(ctx.refs.timeSlider.value) || 0;
  if (time < model.viewport.timeStart || time > model.viewport.timeEnd) {
    return;
  }
  const line = createGraphSvg("line", "graph-playhead");
  const x = graphTimeToX(time, model.viewport);
  line.setAttribute("x1", String(x));
  line.setAttribute("x2", String(x));
  line.setAttribute("y1", String(GRAPH_EDITOR_VIEWBOX.marginTop));
  line.setAttribute(
    "y2",
    String(GRAPH_EDITOR_VIEWBOX.height - GRAPH_EDITOR_VIEWBOX.marginBottom),
  );
  svg.append(line);
}

function appendRangeHandle(
  ctx: ViewerAppContext,
  svg: SVGElement,
  model: GraphEditorModel,
  edge: "end" | "start",
  x: number,
): void {
  const handle = createGraphSvg("rect", "graph-selection-range-handle");
  handle.dataset.rangeEdge = edge;
  handle.setAttribute("x", String(x - 5));
  handle.setAttribute("y", String(GRAPH_EDITOR_VIEWBOX.marginTop - 2));
  handle.setAttribute("width", "10");
  handle.setAttribute("height", "14");
  handle.setAttribute("aria-hidden", "true");
  handle.addEventListener("pointerdown", (event) =>
    ctx.beginGraphSelectionScale(event, model, edge),
  );
  svg.append(handle);
}
