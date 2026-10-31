import type { ViewerAppContext } from "../app/context.js";
import { installCanvasEditablePathPointDragOwner } from "./editable-path-point-drag.js";
import { installCanvasMotionPathHandleDragOwner } from "./motion-path-handle-drag.js";
import { installCanvasPathPointHitTestingOwner } from "./path-point-hit-testing.js";

export function installCanvasMotionPathOwners(ctx: ViewerAppContext): void {
  installCanvasPathPointHitTestingOwner(ctx);
  installCanvasEditablePathPointDragOwner(ctx);
  installCanvasMotionPathHandleDragOwner(ctx);
}
