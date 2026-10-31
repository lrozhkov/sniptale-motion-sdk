import { createTimelineContentMetricActions } from "./interaction/content-metrics.js";
import type { ViewerAppContext } from "../app/context.js";
import { createKeyframeId } from "./model/keyframe-id.js";
import type { TimelineRowTreeActions } from "./model/row-tree-contract.js";
import type { TimelineVirtualizationActions } from "./virtualization/contract.js";
import type { TimelineViewportActions } from "./interaction/viewport-contract.js";
import type { TimelineTimingActions } from "./model/timing-contract.js";
import { createTimelineRowTreeActions } from "./model/row-tree.js";
import { createTimelineVirtualizationActions } from "./virtualization/controller.js";
import { createTimelineViewportActions } from "./interaction/viewport.js";
import { createTimelineOverlayActions } from "./interaction/overlays.js";
import { createTimelineEnabledActions } from "./model/enabled.js";
import { createTimelineTimingActions } from "./model/timing-properties.js";

export function createTimelineActions(
  getContext: () => ViewerAppContext,
): TimelineRowTreeActions &
  TimelineVirtualizationActions &
  TimelineViewportActions &
  TimelineTimingActions {
  return {
    ...createTimelineContentMetricActions(getContext),
    ...createTimelineRowTreeActions(getContext),
    ...createTimelineVirtualizationActions(getContext),
    ...createTimelineViewportActions(getContext),
    ...createTimelineOverlayActions(getContext),
    ...createTimelineEnabledActions(getContext),
    ...createTimelineTimingActions(getContext),
    createKeyframeId,
  };
}
