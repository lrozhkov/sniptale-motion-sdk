import type { ViewerAppContext } from "../app/context.js";
import type { GraphRuntimeActions } from "./contract.js";
import { createGraphControllerActions } from "./controller.js";
import { createGraphViewActions } from "./view.js";
import { createGraphPlayheadActions } from "./playhead.js";
import { createGraphPanZoomActions } from "./pan-zoom.js";
import { createGraphKeyframeDragActions } from "./keyframe-drag.js";
import { createGraphHandleDragActions } from "./handle-drag.js";
import { createGraphRangeScaleActions } from "./range-scale.js";

export function createGraphEditorRuntimeActions(
  getContext: () => ViewerAppContext,
): GraphRuntimeActions {
  return {
    ...createGraphControllerActions(getContext),
    ...createGraphViewActions(getContext),
    ...createGraphPlayheadActions(getContext),
    ...createGraphPanZoomActions(getContext),
    ...createGraphKeyframeDragActions(getContext),
    ...createGraphHandleDragActions(getContext),
    ...createGraphRangeScaleActions(getContext),
  };
}
