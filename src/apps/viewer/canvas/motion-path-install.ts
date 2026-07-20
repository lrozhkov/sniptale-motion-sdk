import type { ViewerAppContext } from "../app/context.js";
import { installCanvasEditablePathPointDragOwner } from "./editable-path-point-drag.js";
import { installCanvasMotionPathBatchUpdatesOwner } from "./motion-path-batch-updates.js";
import { installCanvasMotionPathHandleDragOwner } from "./motion-path-handle-drag.js";
import { installCanvasMotionPathKindUpdatesOwner } from "./motion-path-kind-updates.js";
import { installCanvasMotionPathSelectionOwner } from "./motion-path-selection.js";
import { installCanvasMotionPathUpdatesOwner } from "./motion-path-updates.js";
import { installCanvasPathPointHitTestingOwner } from "./path-point-hit-testing.js";

export function installCanvasMotionPathOwners(ctx: ViewerAppContext): void {
  installCanvasMotionPathSelectionOwner(ctx);
  installCanvasMotionPathBatchUpdatesOwner(ctx);
  installCanvasMotionPathUpdatesOwner(ctx);
  installCanvasMotionPathKindUpdatesOwner(ctx);
  installCanvasPathPointHitTestingOwner(ctx);
  installCanvasEditablePathPointDragOwner(ctx);
  installCanvasMotionPathHandleDragOwner(ctx);
}
