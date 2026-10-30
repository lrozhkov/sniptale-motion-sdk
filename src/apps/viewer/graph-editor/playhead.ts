import type { ViewerAppContext } from "../app/context.js";
import { graphTimeToX } from "./model.js";

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

export function installGraphEditorPlayheadOwner(ctx: ViewerAppContext): void {
  ctx.updateGraphEditorPlayhead = updateGraphEditorPlayhead.bind(
    undefined,
    ctx,
  );
}
