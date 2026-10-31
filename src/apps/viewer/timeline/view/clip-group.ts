import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type { EditorTimeline } from "../../editor/model-types.js";

import type { EffectClip } from "../../../../sdk/types.js";
import type {
  TimelineScene,
  TimelineTrackRow,
} from "../model/row-tree-model.js";
import type { OwnershipLinks } from "../model/ownership-model.js";
import type {
  TimelineViewSource,
  TimelineClipRow,
  TimelineClipInterval,
} from "./model.js";
import type { ViewerAppContext } from "../../app/context.js";

function createLayerIntervalBlock(
  ctx: ViewerAppContext,
  _template: TimelineViewSource,
  scene: TimelineScene,
  clipRow: TimelineClipRow,
  ownershipLinks: OwnershipLinks,
  duration: number,
  inheritedDisabled: boolean = false,
): HTMLButtonElement {
  const { clip, layer } = clipRow;
  const interval = getSceneClampedClipInterval(clip, scene);
  const intervalLabel = layer?.name ?? clip.layerId;
  const block = ctx.createTimelineBlock({
    className: "clip-block",
    id: clip.layerId,
    invalid:
      interval.invalid ||
      ctx.isRangeInvalid(clip.start, clip.duration, duration),
    label: intervalLabel,
    left: ctx.timelinePercent(interval.effectiveStart, duration),
    locked: Boolean(clip.locked || layer?.locked),
    width: ctx.timelineDurationPercent(
      interval.effectiveEnd - interval.effectiveStart,
      duration,
    ),
  });
  block.dataset.layerId = clip.layerId;
  block.dataset.rawStart = String(interval.rawStart);
  block.dataset.rawEnd = String(interval.rawEnd);
  block.dataset.effectiveStart = String(interval.effectiveStart);
  block.dataset.effectiveEnd = String(interval.effectiveEnd);
  block.title = interval.invalid
    ? `${intervalLabel}\n${ctx.deps
        .t(
          "viewer.timeline.clipIntervalComparison",
          "Raw {raw} · Effective {effective}",
        )
        .replace(
          "{raw}",
          ctx.formatSecondsRange(interval.rawStart, interval.rawEnd),
        )
        .replace(
          "{effective}",
          ctx.formatSecondsRange(
            interval.effectiveStart,
            interval.effectiveEnd,
          ),
        )}`
    : `${intervalLabel}\n${ctx.formatSecondsRange(
        interval.effectiveStart,
        interval.effectiveEnd,
      )}`;
  ctx.markOwnershipLink(block, ownershipLinks.clipLayerIds.has(clip.layerId));
  ctx.markRendererBinding(block, "clip", clip.layerId);
  block.classList.toggle("selected", ctx.isSelectedClip(clip.layerId));
  block.classList.toggle(
    "disabled",
    clip.enabled === false || Boolean(inheritedDisabled),
  );
  block.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ctx.shouldSuppressDragClick(event)) {
      return;
    }
    block.focus({ preventScroll: true });
    ctx.selectClipBlock(clip.layerId, event);
  });
  if (!clip.locked && !layer?.locked) {
    block.addEventListener("pointerdown", (event) =>
      ctx.beginClipDrag(event, clip.layerId, "move"),
    );
    const startEdge = document.createElement("span");
    startEdge.className = "timeline-edge start";
    startEdge.addEventListener("pointerdown", (event) =>
      ctx.beginClipDrag(event, clip.layerId, "start"),
    );
    const clipEndEdge = document.createElement("span");
    clipEndEdge.className = "timeline-edge end";
    clipEndEdge.addEventListener("pointerdown", (event) =>
      ctx.beginClipDrag(event, clip.layerId, "end"),
    );
    block.append(startEdge, clipEndEdge);
  }
  return block;
}

function getSceneClampedClipInterval(
  clip: EffectClip,
  scene: TimelineScene,
): TimelineClipInterval {
  const rawStart = Number(clip.start) || 0;
  const rawEnd = rawStart + (Number(clip.duration) || 0);
  const sceneStart = Number(scene.start) || 0;
  const sceneEnd = sceneStart + (Number(scene.duration) || 0);
  const clampedStart = Math.max(rawStart, sceneStart);
  const clampedEnd = Math.min(rawEnd, sceneEnd);
  const effectiveStart = Math.min(sceneEnd, Math.max(sceneStart, clampedStart));
  const effectiveEnd = Math.max(
    effectiveStart + 0.001,
    Math.min(sceneEnd, Math.max(effectiveStart, clampedEnd)),
  );
  return {
    effectiveEnd,
    effectiveStart,
    invalid: rawStart < sceneStart - 0.0001 || rawEnd > sceneEnd + 0.0001,
    rawEnd,
    rawStart,
  };
}

function renderSceneTracksGroup(
  ctx: ViewerAppContext,
  template: TimelineViewSource,
  effectiveTemplate: EditorTemplate,
  timeline: EditorTimeline,
  sceneGroup: HTMLElement,
  scene: TimelineScene,
  tracks: TimelineTrackRow[],
  ownershipLinks: OwnershipLinks,
  duration: number,
): void {
  const expanded = ctx.isTimelineRowExpanded("sceneTracks", scene.id);
  const rowIndex = ctx.claimTimelineVirtualRow();
  if (rowIndex !== null) {
    const lane = ctx.createTimelineLane(
      ctx.deps.t("viewer.timeline.sceneTracks", "Scene tracks"),
      ctx.deps.t("viewer.timeline.propertyGroup", "Properties"),
    );
    lane.row.classList.add(
      "scene-child-lane",
      "scene-tracks-lane",
      "timeline-group-row",
    );
    ctx.decorateTimelineRowDepth(lane.row, 1, rowIndex);
    lane.row.dataset.parentSceneId = scene.id;
    lane.row.classList.toggle("expanded", expanded);
    lane.row.classList.toggle("inherited-disabled", scene.enabled === false);
    ctx.decorateTimelineGroupLabel(lane, {
      count: tracks.length,
      expanded,
      id: scene.id,
      label: ctx.deps.t("viewer.timeline.sceneTracks", "Scene tracks"),
      type: "sceneTracks",
    });
    sceneGroup.append(lane.row);
  }
  if (expanded) {
    ctx.renderPropertyTrackRows(
      template,
      effectiveTemplate,
      timeline,
      sceneGroup,
      scene,
      tracks,
      ownershipLinks,
      duration,
      scene.enabled === false,
    );
  }
}

export function createTimelineClipGroupActions(
  getContext: () => ViewerAppContext,
) {
  return {
    getSceneClampedClipInterval: getSceneClampedClipInterval,
    createLayerIntervalBlock: bindViewerAction(
      createLayerIntervalBlock,
      getContext,
    ),
    renderSceneTracksGroup: bindViewerAction(
      renderSceneTracksGroup,
      getContext,
    ),
  };
}
