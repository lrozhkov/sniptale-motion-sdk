import type { ViewerAppContext } from "../app/context.js";
import { installGraphEditorControllerOwner } from "./controller.js";
import { installGraphEditorHandleDragOwner } from "./handle-drag.js";
import { installGraphEditorKeyframeDragOwner } from "./keyframe-drag.js";
import { installGraphEditorPanZoomOwner } from "./pan-zoom.js";
import { installGraphEditorPlayheadOwner } from "./playhead.js";
import { installGraphEditorRangeScaleOwner } from "./range-scale.js";
import { installGraphEditorViewOwner } from "./view.js";

export function installGraphEditorOwners(ctx: ViewerAppContext): void {
  installGraphEditorControllerOwner(ctx);
  installGraphEditorPanZoomOwner(ctx);
  installGraphEditorKeyframeDragOwner(ctx);
  installGraphEditorHandleDragOwner(ctx);
  installGraphEditorRangeScaleOwner(ctx);
  installGraphEditorPlayheadOwner(ctx);
  installGraphEditorViewOwner(ctx);
}
