import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type { EditorTimeline } from "../../editor/model-types.js";

import type {
  TimelineScene,
  TimelineLayerGroupRow,
} from "../model/row-tree-model.js";
import type { OwnershipLinks } from "../model/ownership-model.js";
import type { TimelineViewSource } from "./model.js";
import type { ViewerAppContext } from "../../app/context.js";

function renderStructuralLayerGroup(
  ctx: ViewerAppContext,
  template: TimelineViewSource,
  effectiveTemplate: EditorTemplate,
  timeline: EditorTimeline,
  sceneGroup: HTMLElement,
  scene: TimelineScene,
  groupRow: TimelineLayerGroupRow,
  ownershipLinks: OwnershipLinks,
  duration: number,
): void {
  const group = groupRow.layer;
  const expanded = ctx.isTimelineRowExpanded("group", groupRow.expansionId);
  const rowIndex = ctx.claimTimelineVirtualRow();
  if (rowIndex !== null) {
    const leaves = groupRow.allLeafIds
      .map((layerId) =>
        effectiveTemplate.layers.find((layer) => layer.id === layerId),
      )
      .filter((layer) => layer !== undefined);
    const allVisible =
      leaves.length > 0 && leaves.every((layer) => layer.visible !== false);
    const allLocked =
      leaves.length > 0 && leaves.every((layer) => layer.locked === true);
    const lane = ctx.createTimelineLane(
      group.name || group.id,
      ctx.deps.t("viewer.timeline.layerTypes.group", "Group"),
    );
    lane.row.classList.add(
      "layer-lane",
      "structural-group-lane",
      "timeline-group-row",
      scene.isGlobalTimelineScope ? "global-layer-lane" : "scene-child-lane",
    );
    ctx.decorateTimelineRowDepth(lane.row, groupRow.depth, rowIndex);
    lane.row.dataset.layerId = group.id;
    lane.row.dataset.layerGroupId = group.id;
    if (scene.isGlobalTimelineScope) {
      lane.row.dataset.timelineScope = "global";
    } else {
      lane.row.dataset.parentSceneId = scene.id;
    }
    lane.row.classList.toggle("expanded", expanded);
    lane.row.classList.toggle("selected-layer", ctx.isSelectedLayer(group.id));
    lane.row.classList.toggle("disabled", !allVisible);
    lane.row.classList.toggle("locked", allLocked);
    ctx.decorateTimelineGroupLabel(lane, {
      count: groupRow.leafIds.length,
      countText: ctx.deps
        .t("viewer.timeline.groupItemCount", "{count} items")
        .replace("{count}", String(groupRow.leafIds.length)),
      expanded,
      id: groupRow.expansionId,
      label: group.name || group.id,
      metadata: ctx.deps.t("viewer.timeline.layerTypes.group", "Group"),
      type: "group",
    });
    ctx.appendTimelineLayerDragGrip(lane.label, group.id);
    lane.label.addEventListener("click", (event) => {
      event.stopPropagation();
      ctx.selectLayer(group.id, event);
    });
    ctx.appendTimelineEnabledToggle(lane.label, {
      enabled: allVisible,
      id: group.id,
      title: ctx.deps.t(
        "viewer.timeline.toggleGroupVisibility",
        "Toggle group visibility",
      ),
      type: "layer",
    });
    appendGroupLockToggle(ctx, lane.label, group.id, allLocked);
    appendGroupRange(
      ctx,
      lane.body,
      effectiveTemplate,
      scene,
      groupRow,
      duration,
    );
    sceneGroup.append(lane.row);
  }
  if (expanded) {
    ctx.renderTimelineLayerTree(
      template,
      effectiveTemplate,
      timeline,
      sceneGroup,
      scene,
      groupRow.children,
      ownershipLinks,
      duration,
    );
  }
}

function appendGroupRange(
  ctx: ViewerAppContext,
  body: HTMLElement,
  template: EditorTemplate,
  scene: TimelineScene,
  groupRow: TimelineLayerGroupRow,
  duration: number,
): void {
  const intervals = (template.clips ?? [])
    .filter(
      (clip) =>
        groupRow.leafIds.includes(clip.layerId) &&
        ctx.clipBelongsToScene(clip, scene),
    )
    .map((clip) => ctx.getSceneClampedClipInterval(clip, scene));
  if (intervals.length === 0) {
    return;
  }
  const start = Math.min(
    ...intervals.map((interval) => interval.effectiveStart),
  );
  const end = Math.max(...intervals.map((interval) => interval.effectiveEnd));
  const block = document.createElement("span");
  block.className = "timeline-block group-range-block";
  block.style.left = `${ctx.timelinePercent(start, duration)}%`;
  block.style.width = `${ctx.timelineDurationPercent(end - start, duration)}%`;
  block.title = ctx.deps
    .t("viewer.timeline.groupRange", "Child range · {range}")
    .replace("{range}", ctx.formatSecondsRange(start, end));
  block.setAttribute("aria-hidden", "true");
  body.append(block);
}

function appendGroupLockToggle(
  ctx: ViewerAppContext,
  label: HTMLElement,
  groupId: string,
  locked: boolean,
): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "timeline-lock-toggle icon-button";
  ctx.setIconButton(
    button,
    locked ? "lock" : "unlock",
    locked
      ? ctx.deps.t("viewer.timeline.unlockGroup", "Unlock group")
      : ctx.deps.t("viewer.timeline.lockGroup", "Lock group"),
  );
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    ctx.toggleLayerLock(groupId);
  });
  label.classList.add("has-lock-toggle");
  label.prepend(button);
}

export function createTimelineStructuralLayerGroupActions(
  getContext: () => ViewerAppContext,
) {
  return {
    renderStructuralLayerGroup: bindViewerAction(
      renderStructuralLayerGroup,
      getContext,
    ),
  };
}
