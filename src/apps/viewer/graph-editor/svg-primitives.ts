import { GRAPH_EDITOR_VIEWBOX } from "./viewport.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function appendGraphPlotClip(svg: SVGElement): void {
  const defs = createGraphSvg("defs");
  const clip = createGraphSvg("clipPath");
  clip.setAttribute("id", "graph-editor-plot-clip");
  const rect = createGraphSvg("rect");
  rect.setAttribute("x", String(GRAPH_EDITOR_VIEWBOX.marginLeft));
  rect.setAttribute("y", String(GRAPH_EDITOR_VIEWBOX.marginTop));
  rect.setAttribute("width", String(getGraphPlotWidth()));
  rect.setAttribute("height", String(getGraphPlotHeight()));
  clip.append(rect);
  defs.append(clip);
  svg.append(defs);
}

export function createGraphAxisLabel(
  x: number,
  y: number,
  text: string,
  className: string,
): SVGElement {
  const label = createGraphSvg("text", className);
  label.setAttribute("x", String(x));
  label.setAttribute("y", String(y));
  label.textContent = text;
  return label;
}

export function createGraphGridLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SVGElement {
  const line = createGraphSvg("line", "graph-grid-line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  return line;
}

export function createGraphSvg<Tag extends keyof SVGElementTagNameMap>(
  tag: Tag,
  className = "",
): SVGElementTagNameMap[Tag] {
  const element = document.createElementNS(SVG_NS, tag);
  if (className) {
    element.setAttribute("class", className);
  }
  return element;
}

export function getGraphPlotHeight(): number {
  return (
    GRAPH_EDITOR_VIEWBOX.height -
    GRAPH_EDITOR_VIEWBOX.marginTop -
    GRAPH_EDITOR_VIEWBOX.marginBottom
  );
}

export function getGraphPlotWidth(): number {
  return (
    GRAPH_EDITOR_VIEWBOX.width -
    GRAPH_EDITOR_VIEWBOX.marginLeft -
    GRAPH_EDITOR_VIEWBOX.marginRight
  );
}
