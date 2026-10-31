import { bindViewerAction } from "../app/bind-action.js";
import type { GraphRuntimeActions } from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { graphTimeToX } from "./viewport.js";

function updateGraphEditorPlayhead(ctx: ViewerAppContext, time: number): void {
  const playhead = ctx.refs.curveEditor.querySelector(".graph-playhead");
  const viewport = ctx.state.graphEditorViewport;
  if (!(playhead instanceof SVGElement) || !viewport) {
    return;
  }
  const visible = time >= viewport.timeStart && time <= viewport.timeEnd;
  playhead.style.display = visible ? "" : "none";
  if (visible) {
    const x = graphTimeToX(time, viewport);
    playhead.setAttribute("x1", String(x));
    playhead.setAttribute("x2", String(x));
  }
}

export function createGraphPlayheadActions(
  getContext: () => ViewerAppContext,
): Pick<GraphRuntimeActions, "updateGraphEditorPlayhead"> {
  return {
    updateGraphEditorPlayhead: bindViewerAction(
      updateGraphEditorPlayhead,
      getContext,
    ),
  };
}
