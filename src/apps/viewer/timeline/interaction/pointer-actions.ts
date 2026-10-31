import type { ViewerAppContext } from "../../app/context.js";
import type { TimelinePointerActions } from "./pointer-contract.js";
import { rectsIntersect, rectContainsRectCenter } from "./drag.js";
import { createClipDragActions } from "./clip-drag.js";
import { createPhaseDragActions } from "./phase-drag.js";
import { createSceneDragActions } from "./scene-drag.js";
import { createTrackDragActions } from "./track-drag.js";
import { createKeyframeDragActions } from "./keyframe-drag.js";
import { createKeyframeSegmentDragActions } from "./keyframe-segment-drag.js";

export function createTimelinePointerActions(
  getContext: () => ViewerAppContext,
): TimelinePointerActions {
  return {
    rectsIntersect,
    rectContainsRectCenter,
    ...createClipDragActions(getContext),
    ...createPhaseDragActions(getContext),
    ...createSceneDragActions(getContext),
    ...createTrackDragActions(getContext),
    ...createKeyframeDragActions(getContext),
    ...createKeyframeSegmentDragActions(getContext),
  };
}
