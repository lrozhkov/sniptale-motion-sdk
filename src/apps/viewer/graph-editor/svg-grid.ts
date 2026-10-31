import type { ViewerAppContext } from "../app/context.js";
import type { GraphEditorModel } from "./model-types.js";
import { formatGraphValue } from "./curve-path.js";
import { GRAPH_EDITOR_VIEWBOX } from "./viewport.js";
import {
  createGraphAxisLabel,
  createGraphGridLine,
  createGraphSvg,
  getGraphPlotHeight,
  getGraphPlotWidth,
} from "./svg-primitives.js";

export function appendGraphGrid(
  ctx: ViewerAppContext,
  svg: SVGElement,
  model: GraphEditorModel,
): void {
  const plot = createGraphSvg("rect", "graph-editor-plot");
  plot.dataset.graphBackground = "true";
  plot.setAttribute("x", String(GRAPH_EDITOR_VIEWBOX.marginLeft));
  plot.setAttribute("y", String(GRAPH_EDITOR_VIEWBOX.marginTop));
  plot.setAttribute("width", String(getGraphPlotWidth()));
  plot.setAttribute("height", String(getGraphPlotHeight()));
  svg.append(plot);
  for (let index = 0; index <= 5; index += 1) {
    appendGridStep(ctx, svg, model, index / 5);
  }
}

function appendGridStep(
  ctx: ViewerAppContext,
  svg: SVGElement,
  model: GraphEditorModel,
  ratio: number,
): void {
  const x = GRAPH_EDITOR_VIEWBOX.marginLeft + ratio * getGraphPlotWidth();
  const time =
    model.viewport.timeStart +
    ratio * (model.viewport.timeEnd - model.viewport.timeStart);
  svg.append(
    createGraphGridLine(
      x,
      GRAPH_EDITOR_VIEWBOX.marginTop,
      x,
      GRAPH_EDITOR_VIEWBOX.height - GRAPH_EDITOR_VIEWBOX.marginBottom,
    ),
    createGraphAxisLabel(
      x,
      GRAPH_EDITOR_VIEWBOX.height - 10,
      ctx.formatSeconds(time, 2),
      "graph-axis-time",
    ),
  );

  const y = GRAPH_EDITOR_VIEWBOX.marginTop + ratio * getGraphPlotHeight();
  const value =
    model.viewport.valueMax -
    ratio * (model.viewport.valueMax - model.viewport.valueMin);
  svg.append(
    createGraphGridLine(
      GRAPH_EDITOR_VIEWBOX.marginLeft,
      y,
      GRAPH_EDITOR_VIEWBOX.width - GRAPH_EDITOR_VIEWBOX.marginRight,
      y,
    ),
    createGraphAxisLabel(
      GRAPH_EDITOR_VIEWBOX.marginLeft - 8,
      y + 4,
      formatGraphValue(value),
      "graph-axis-value",
    ),
  );
}
