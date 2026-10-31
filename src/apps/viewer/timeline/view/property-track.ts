import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type { EditorTimeline } from "../../editor/model-types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../../sdk/types.js";
import type { TimelineScene } from "../model/row-tree-model.js";
import type { OwnershipLinks } from "../model/ownership-model.js";
import type { TimelineViewSource, TimelineRenderParent } from "./model.js";
import type { TimelineTrackParent } from "../model/row-tree-model.js";

import type { ViewerAppContext } from "../../app/context.js";

function renderTimelinePropertyTrackLane(
  ctx: ViewerAppContext,
  template: TimelineViewSource,
  effectiveTemplate: EditorTemplate,
  timeline: EditorTimeline,
  scene: TimelineScene,
  track: MotionPathTrack,
  visibleKeyframes: TimelineKeyframe<unknown>[],
  ownershipLinks: OwnershipLinks,
  duration: number,
  parent: TimelineRenderParent,
): void {
  const rowIndex = ctx.claimTimelineVirtualRow();
  if (rowIndex === null) {
    return;
  }
  const displayLabel = ctx.getTimelineTrackDisplayLabel(track);
  const lane = ctx.createTimelineLane(
    displayLabel,
    ctx.deps.t("viewer.timeline.propertyTrack", "Property track"),
  );
  lane.row.classList.add("scene-child-lane", "property-track-lane");
  ctx.decorateTimelineRowDepth(
    lane.row,
    parent.depth ?? (parent.type === "layerPhase" ? 3 : 2),
    rowIndex,
  );
  lane.row.dataset.parentSceneId = scene.id;
  lane.row.dataset.trackId = track.id;
  lane.row.classList.toggle(
    "inherited-disabled",
    Boolean(parent.inheritedDisabled),
  );
  if (parent.type === "phase") {
    lane.row.dataset.parentPhaseId = parent.id;
  } else if (parent.type === "layerPhase") {
    lane.row.dataset.parentPhaseId = parent.phaseId ?? parent.id;
    lane.row.dataset.parentLayerId = parent.layerId;
    lane.row.dataset.layerId = parent.layerId;
  } else if (parent.type === "clip") {
    lane.row.dataset.parentLayerId = parent.id;
  } else if (parent.type === "layer") {
    lane.row.dataset.parentLayerId = parent.id;
    lane.row.dataset.layerId = parent.id;
  } else if (parent.type === "scenePhase") {
    lane.row.dataset.parentPhaseId = parent.phaseId ?? parent.id;
    lane.row.dataset.scenePhaseId = parent.phaseId ?? parent.id;
  }
  lane.row.classList.toggle("disabled", track.enabled === false);
  lane.row.classList.toggle(
    "selected-track",
    ctx.state.selectedItem?.type === "track" &&
      ctx.state.selectedItem.trackId === track.id,
  );
  lane.row.classList.toggle(
    "ownership-linked",
    ownershipLinks.trackIds.has(track.id),
  );
  ctx.appendTimelineEnabledToggle(lane.label, {
    enabled: ctx.isTimelineItemEnabled(track),
    id: track.id,
    title: ctx.deps.t("viewer.timeline.toggleTrack", "Toggle track"),
    type: "track",
  });
  ctx.markRendererBinding(lane.row, "track", track.id);
  lane.body.classList.add("track-lane-body");
  lane.body.title = ctx.deps.t(
    "viewer.timeline.emptyPropertyLaneTitle",
    "Click to seek. Drag empty property row to shift visible keyframes in this scene.",
  );
  lane.body.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ctx.shouldSuppressDragClick(event)) {
      return;
    }
    ctx.selectTrackLane(track.id);
  });
  lane.body.addEventListener("pointerdown", (event) => {
    if (event.shiftKey || event.altKey) {
      ctx.beginTimelineMarqueeSelection(event);
      return;
    }
    ctx.beginTrackDrag(
      event,
      track.id,
      null,
      scene.id,
      visibleKeyframes.map((keyframe) => keyframe.id),
    );
  });
  lane.label.addEventListener("pointerdown", (event) =>
    ctx.beginTrackDrag(
      event,
      track.id,
      lane.body,
      scene.id,
      visibleKeyframes.map((keyframe) => keyframe.id),
    ),
  );
  lane.label.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ctx.shouldSuppressDragClick(event)) {
      return;
    }
    ctx.selectTrackLane(track.id);
  });
  if (!parent.inheritedDisabled) {
    const selectedSegment = ctx.createSelectedKeyframeSegmentRange(
      track,
      visibleKeyframes,
      duration,
    );
    if (selectedSegment) {
      lane.body.append(selectedSegment);
    }
    for (const keyframe of visibleKeyframes) {
      lane.body.append(
        ctx.createTimelineKeyframePoint(
          template,
          effectiveTemplate,
          timeline,
          track,
          keyframe,
          ownershipLinks,
          duration,
        ),
      );
    }
  }
  parent.group.append(lane.row);
}

function createTimelineKeyframePoint(
  ctx: ViewerAppContext,
  _template: TimelineViewSource,
  effectiveTemplate: EditorTemplate,
  _timeline: EditorTimeline,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  ownershipLinks: OwnershipLinks,
  duration: number,
): HTMLButtonElement {
  const point = document.createElement("button");
  point.type = "button";
  point.className = `keyframe-point${ctx.isSelectedKeyframe(track.id, keyframe.id) ? " selected" : ""}`;
  point.dataset.trackId = track.id;
  point.dataset.keyframeId = keyframe.id;
  point.classList.toggle("disabled", keyframe.enabled === false);
  point.classList.toggle(
    "ownership-linked",
    ownershipLinks.keyframes.has(ctx.keyframeLinkKey(track.id, keyframe.id)),
  );
  point.classList.toggle(
    "edge-start",
    Math.abs(Number(keyframe.time)) < 0.0001,
  );
  point.classList.toggle(
    "edge-end",
    Math.abs(Number(keyframe.time) - Number(duration)) < 0.0001,
  );
  ctx.markRendererBinding(point, "track", track.id);
  point.style.left = `${ctx.timelinePercent(keyframe.time, duration)}%`;
  if (ctx.isKeyframeTimingInvalid(effectiveTemplate, track, keyframe)) {
    point.classList.add("invalid");
  }
  point.title = `${ctx.getTimelineTrackDisplayLabel(track)}: ${ctx.formatSeconds(keyframe.time, 2)}`;
  point.addEventListener("pointerdown", (event) =>
    ctx.beginKeyframeDrag(event, track.id, keyframe.id),
  );
  point.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    ctx.toggleTimelineKeyframeEnabled(track.id, keyframe.id);
  });
  point.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ctx.shouldSuppressDragClick(event)) {
      return;
    }
    point.focus({ preventScroll: true });
    ctx.selectKeyframe(track.id, keyframe.id, event);
  });
  return point;
}

export function getTrackKeyframesForParent(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  scene: TimelineScene,
  timeline: EditorTimeline,
  parent: TimelineTrackParent,
): TimelineKeyframe<unknown>[] {
  return (track.keyframes ?? []).filter((keyframe) => {
    if (!ctx.keyframeBelongsToScene(track, keyframe, scene, timeline)) {
      return false;
    }
    const keyPhaseId = keyframe.phaseId ?? null;
    if (parent.type === "phase") {
      return (
        keyPhaseId === parent.id || (!keyPhaseId && track.phaseId === parent.id)
      );
    }
    if (parent.type === "layerPhase") {
      const phaseId = parent.phaseId ?? parent.id;
      return (
        ctx.getTrackLayerId(track) === parent.layerId &&
        ctx.isPhaseCompatibleWithLayer(timeline, phaseId, parent.layerId) &&
        (keyPhaseId === phaseId || (!keyPhaseId && track.phaseId === phaseId))
      );
    }
    if (parent.type === "scenePhase") {
      const phaseId = parent.phaseId ?? parent.id;
      return (
        !ctx.getTrackLayerId(track) &&
        (keyPhaseId === phaseId || (!keyPhaseId && track.phaseId === phaseId))
      );
    }
    if (parent.type === "clip" || parent.type === "layer") {
      return (
        ctx.getTrackLayerId(track) === parent.id &&
        track.phaseId == null &&
        (!keyPhaseId ||
          !ctx.isPhaseCompatibleWithLayer(timeline, keyPhaseId, parent.id))
      );
    }
    return !keyPhaseId && track.phaseId == null && !ctx.getTrackLayerId(track);
  });
}

export function createTimelinePropertyTrackActions(
  getContext: () => ViewerAppContext,
) {
  return {
    renderTimelinePropertyTrackLane: bindViewerAction(
      renderTimelinePropertyTrackLane,
      getContext,
    ),
    createTimelineKeyframePoint: bindViewerAction(
      createTimelineKeyframePoint,
      getContext,
    ),
  };
}
