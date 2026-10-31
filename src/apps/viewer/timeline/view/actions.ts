import type { ViewerAppContext } from "../../app/context.js";
import type { TimelineSurfaceActions } from "./surface-contract.js";
import type { TimelineRowViewActions } from "./row-contract.js";
import { createTimelineEditorActions } from "./editor.js";
import { createTimelineTracksActions } from "./tracks.js";
import { createTimelineSurfaceActions } from "./surface.js";
import { createTimelineClipGroupActions } from "./clip-group.js";
import { createTimelinePhaseGroupActions } from "./phase-group.js";
import { createTimelineGroupLabelActions } from "./group-label.js";
import { createTimelinePropertyTrackActions } from "./property-track.js";
import { createTimelineSceneGroupActions } from "./scene-group.js";
import { createTimelineLayerTreeActions } from "./layer-tree.js";
import { createTimelineLayerGroupActions } from "./layer-group.js";
import { createTimelineStructuralLayerGroupActions } from "./structural-layer-group.js";
import { createTimelineGlobalGroupActions } from "./global-group.js";
import { createTimelineLabelActions } from "../model/labels.js";

export function createTimelineViewActions(
  getContext: () => ViewerAppContext,
): TimelineSurfaceActions & TimelineRowViewActions {
  return {
    ...createTimelineEditorActions(getContext),
    ...createTimelineTracksActions(getContext),
    ...createTimelineSurfaceActions(getContext),
    ...createTimelineClipGroupActions(getContext),
    ...createTimelinePhaseGroupActions(getContext),
    ...createTimelineGroupLabelActions(getContext),
    ...createTimelinePropertyTrackActions(getContext),
    ...createTimelineSceneGroupActions(getContext),
    ...createTimelineLayerTreeActions(getContext),
    ...createTimelineLayerGroupActions(getContext),
    ...createTimelineStructuralLayerGroupActions(getContext),
    ...createTimelineGlobalGroupActions(getContext),
    ...createTimelineLabelActions(getContext),
  };
}
