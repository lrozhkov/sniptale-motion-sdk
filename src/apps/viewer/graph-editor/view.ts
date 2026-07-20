import type { ViewerAppContext } from "../app/context.js";
import { createGraphEditorModel } from "./model.js";
import { createGraphEditorLegend, createGraphEditorSvg } from "./view-svg.js";
import { createGraphEditorToolbar } from "./toolbar.js";

function renderCurveEditor(ctx: ViewerAppContext, timeline) {
  const root = ctx.refs.curveEditor;
  root.innerHTML = "";
  const model = createGraphEditorModel(ctx, timeline);
  ctx.refs.graphEditorButton.disabled = !model;
  ctx.refs.graphEditorButton.setAttribute(
    "aria-pressed",
    String(Boolean(model && ctx.state.graphEditorEnabled)),
  );
  const active = Boolean(model && ctx.state.graphEditorEnabled);
  ctx.refs.timelineEditor.classList.toggle("graph-editor-active", active);
  if (!active) {
    root.hidden = true;
    return;
  }
  ctx.state.graphEditorViewport = model.viewport;
  root.hidden = false;
  const workspace = document.createElement("div");
  workspace.className = "graph-editor-workspace";
  workspace.append(
    createGraphEditorLegend(model),
    createGraphEditorSvg(ctx, model),
  );
  root.append(createGraphEditorToolbar(ctx, model), workspace);
}

export function installGraphEditorViewOwner(ctx: ViewerAppContext): void {
  ctx.renderCurveEditor = (...args: any[]) =>
    (renderCurveEditor as any)(ctx, ...args);
}
