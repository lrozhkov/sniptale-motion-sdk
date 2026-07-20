import { GRAPH_EDITOR_VIEWBOX, graphTimeToX, graphValueToY } from "./model.js";
import {
  createGraphTrackPath,
  formatGraphValue,
  getGraphTrackColor,
} from "./curve-path.js";
import { appendGraphGrid } from "./svg-grid.js";
import {
  appendGraphPlayhead,
  appendGraphSelectionRange,
} from "./svg-selection.js";
import { appendGraphPlotClip, createGraphSvg } from "./svg-primitives.js";

export function createGraphEditorLegend(model): HTMLElement {
  const legend = document.createElement("div");
  legend.className = "graph-editor-legend";
  for (const track of model.tracks) {
    const item = document.createElement("span");
    item.style.setProperty("--graph-track-color", getGraphTrackColor(track));
    item.textContent = track.label;
    legend.append(item);
  }
  return legend;
}

export function createGraphEditorSvg(ctx, model): SVGElement {
  const svg = createGraphSvg("svg", "graph-editor-svg");
  svg.setAttribute(
    "viewBox",
    `0 0 ${GRAPH_EDITOR_VIEWBOX.width} ${GRAPH_EDITOR_VIEWBOX.height}`,
  );
  svg.setAttribute("role", "group");
  svg.setAttribute(
    "aria-label",
    ctx.deps.t(
      "viewer.graphEditor.canvasLabel",
      "Editable value curves over time",
    ),
  );
  svg.setAttribute("tabindex", "0");
  appendGraphPlotClip(svg);
  appendGraphGrid(ctx, svg, model);
  appendGraphSelectionRange(ctx, svg, model);
  appendGraphCurves(ctx, svg, model);
  appendGraphPlayhead(ctx, svg, model);
  svg.addEventListener("wheel", (event) =>
    ctx.handleGraphEditorWheel(event, model),
  );
  svg.addEventListener("pointerdown", (event) =>
    ctx.beginGraphEditorPan(event, model),
  );
  svg.addEventListener("dblclick", (event) => {
    if (
      event.target === svg ||
      (event.target as HTMLElement).dataset.graphBackground
    ) {
      ctx.fitGraphEditor("selection");
    }
  });
  return svg;
}

function appendGraphCurves(ctx, svg, model): void {
  const group = createGraphSvg("g", "graph-curves");
  group.setAttribute("clip-path", "url(#graph-editor-plot-clip)");
  for (const track of model.tracks) {
    const color = getGraphTrackColor(track);
    const path = createGraphSvg("path", "graph-track-curve");
    path.style.setProperty("--graph-track-color", color);
    path.setAttribute("d", createGraphTrackPath(track, model.viewport));
    group.append(path);
    for (const point of track.points) {
      const circle = createGraphSvg(
        "circle",
        `graph-keyframe-point${point.selected ? " selected" : ""}`,
      );
      circle.style.setProperty("--graph-track-color", color);
      circle.dataset.trackId = track.id;
      circle.dataset.keyframeId = point.id;
      circle.setAttribute(
        "cx",
        String(graphTimeToX(point.time, model.viewport)),
      );
      circle.setAttribute(
        "cy",
        String(graphValueToY(point.value, model.viewport)),
      );
      circle.setAttribute("r", point.selected ? "6" : "4.5");
      circle.setAttribute("role", "button");
      circle.setAttribute("tabindex", point.selected ? "0" : "-1");
      circle.setAttribute("aria-pressed", String(point.selected));
      circle.setAttribute(
        "aria-label",
        `${track.label} · ${ctx.formatSeconds(point.time, 2)} · ${formatGraphValue(point.value)}`,
      );
      circle.addEventListener("pointerdown", (event) =>
        ctx.beginGraphKeyframeDrag(event, model, track.id, point.id),
      );
      circle.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!ctx.shouldSuppressDragClick(event)) {
          ctx.selectKeyframe(track.id, point.id, event);
        }
      });
      circle.addEventListener("keydown", (event) => {
        if (event.code === "Enter") {
          event.preventDefault();
          ctx.selectKeyframe(track.id, point.id, event);
        }
      });
      group.append(circle);
    }
  }
  appendPrimaryBezierHandles(ctx, group, model);
  svg.append(group);
}

function appendPrimaryBezierHandles(ctx, svg, model): void {
  if (!model.primary || model.primary.keyframe.easing !== "bezier") {
    return;
  }
  const track = model.tracks.find(
    (entry) => entry.id === model.primary.trackId,
  );
  const index = track?.points.findIndex(
    (point) => point.id === model.primary.keyframeId,
  );
  const point = index >= 0 ? track.points[index] : null;
  const next = index >= 0 ? track.points[index + 1] : null;
  if (!track || track.spatialMotionPath || !point || !next) {
    return;
  }
  const handles = point.handles;
  for (const control of [
    {
      handle: "first",
      time: point.time + handles.x1 * (next.time - point.time),
      value: point.value + handles.y1 * (next.value - point.value),
    },
    {
      handle: "second",
      time: point.time + handles.x2 * (next.time - point.time),
      value: point.value + handles.y2 * (next.value - point.value),
    },
  ]) {
    const anchor =
      control.handle === "first"
        ? { time: point.time, value: point.value }
        : { time: next.time, value: next.value };
    const line = createGraphSvg("line", "graph-bezier-guide");
    line.setAttribute("x1", String(graphTimeToX(anchor.time, model.viewport)));
    line.setAttribute(
      "y1",
      String(graphValueToY(anchor.value, model.viewport)),
    );
    line.setAttribute("x2", String(graphTimeToX(control.time, model.viewport)));
    line.setAttribute(
      "y2",
      String(graphValueToY(control.value, model.viewport)),
    );
    const handle = createGraphSvg("circle", "graph-bezier-handle");
    handle.dataset.handle = control.handle;
    handle.dataset.trackId = track.id;
    handle.dataset.keyframeId = point.id;
    handle.setAttribute(
      "cx",
      String(graphTimeToX(control.time, model.viewport)),
    );
    handle.setAttribute(
      "cy",
      String(graphValueToY(control.value, model.viewport)),
    );
    handle.setAttribute("r", "5");
    handle.setAttribute("aria-hidden", "true");
    handle.addEventListener("pointerdown", (event) =>
      ctx.beginGraphBezierHandleDrag(
        event,
        model,
        track.id,
        point.id,
        control.handle,
      ),
    );
    svg.append(line, handle);
  }
}
