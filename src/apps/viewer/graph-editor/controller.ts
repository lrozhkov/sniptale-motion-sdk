import { bindViewerAction } from "../app/bind-action.js";
import type { GraphRuntimeActions } from "./contract.js";
import { clampGraphTimeViewport } from "./interaction-shared.js";
import type { ViewerAppContext } from "../app/context.js";
import { createGraphEditorModel } from "./model.js";
import { createFittedGraphViewport } from "./viewport.js";
import type { GraphEditorViewport } from "./state.js";

function toggleGraphEditor(
  ctx: ViewerAppContext,
  enabled = !ctx.state.graphEditorEnabled,
): void {
  ctx.state.graphEditorEnabled = Boolean(enabled);
  ctx.refs.graphEditorButton.setAttribute(
    "aria-pressed",
    String(ctx.state.graphEditorEnabled),
  );
  ctx.renderCurveEditor(ctx.getEffectiveTimeline(ctx.state.currentTemplate));
}

function fitGraphEditor(
  ctx: ViewerAppContext,
  mode: "all" | "selection" = "selection",
): boolean {
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  const model = createGraphEditorModel(ctx, timeline);
  if (!model) {
    return false;
  }
  ctx.state.graphEditorViewport = createFittedGraphViewport(
    model.template.id,
    model.tracks,
    model.selection.map(({ keyframeId, trackId }) => ({
      keyframeId,
      trackId,
    })),
    ctx.getEffectiveDuration(model.template),
    mode,
  );
  ctx.renderCurveEditor(timeline);
  return true;
}

function zoomGraphEditor(
  ctx: ViewerAppContext,
  factor: number,
  options: {
    timeAnchor?: number;
    valueAnchor?: number;
    zoomTime?: boolean;
    zoomValue?: boolean;
  } = {},
): boolean {
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  const model = createGraphEditorModel(ctx, timeline);
  if (!model) {
    return false;
  }
  const zoomFactor = Math.min(4, Math.max(0.2, Number(factor) || 1));
  const viewport = { ...model.viewport };
  const timeAnchor =
    options.timeAnchor ?? (viewport.timeStart + viewport.timeEnd) / 2;
  const valueAnchor =
    options.valueAnchor ?? (viewport.valueMin + viewport.valueMax) / 2;
  if (options.zoomValue !== false) {
    const valueSpan = Math.max(
      0.0001,
      (viewport.valueMax - viewport.valueMin) * zoomFactor,
    );
    const valueRatio =
      (valueAnchor - viewport.valueMin) /
      Math.max(0.0001, viewport.valueMax - viewport.valueMin);
    viewport.valueMin = valueAnchor - valueSpan * valueRatio;
    viewport.valueMax = viewport.valueMin + valueSpan;
  }
  if (options.zoomTime !== false) {
    const duration = ctx.getEffectiveDuration(model.template);
    const timeSpan = Math.min(
      duration,
      Math.max(1 / 120, (viewport.timeEnd - viewport.timeStart) * zoomFactor),
    );
    const timeRatio =
      (timeAnchor - viewport.timeStart) /
      Math.max(0.0001, viewport.timeEnd - viewport.timeStart);
    viewport.timeStart = timeAnchor - timeSpan * timeRatio;
    viewport.timeEnd = viewport.timeStart + timeSpan;
    clampGraphTimeViewport(viewport, duration);
  }
  ctx.state.graphEditorViewport = viewport;
  ctx.renderCurveEditor(timeline);
  return true;
}

function setGraphEditorViewport(
  ctx: ViewerAppContext,
  viewport: GraphEditorViewport,
  options: { render?: boolean } = {},
): void {
  ctx.state.graphEditorViewport = viewport;
  if (options.render !== false) {
    ctx.renderCurveEditor(ctx.getEffectiveTimeline(ctx.state.currentTemplate));
  }
}

function setGraphEditorLinkedHandles(
  ctx: ViewerAppContext,
  linked: boolean,
): void {
  ctx.state.graphEditorLinkedHandles = Boolean(linked);
  ctx.renderCurveEditor(ctx.getEffectiveTimeline(ctx.state.currentTemplate));
}

export function createGraphControllerActions(
  getContext: () => ViewerAppContext,
): Pick<
  GraphRuntimeActions,
  | "toggleGraphEditor"
  | "fitGraphEditor"
  | "zoomGraphEditor"
  | "setGraphEditorViewport"
  | "setGraphEditorLinkedHandles"
> {
  return {
    toggleGraphEditor: bindViewerAction(toggleGraphEditor, getContext),
    fitGraphEditor: bindViewerAction(fitGraphEditor, getContext),
    zoomGraphEditor: bindViewerAction(zoomGraphEditor, getContext),
    setGraphEditorViewport: bindViewerAction(
      setGraphEditorViewport,
      getContext,
    ),
    setGraphEditorLinkedHandles: bindViewerAction(
      setGraphEditorLinkedHandles,
      getContext,
    ),
  };
}
