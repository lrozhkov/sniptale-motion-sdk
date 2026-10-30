import type { ViewerAppContext } from "../../app/context.js";

function renderLayerGroup(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  timeline,
  sceneGroup,
  scene,
  layerRow,
  ownershipLinks,
  duration,
) {
  const { clip, layer, layerId } = layerRow;
  const globalScope = scene.isGlobalTimelineScope === true;
  const expanded = ctx.isTimelineRowExpanded("layer", layerRow.expansionId);
  const label = layer?.name ?? layerId;
  const childCount = layerRow.phases.length + layerRow.directTracks.length;
  const rowIndex = ctx.claimTimelineVirtualRow();
  if (rowIndex !== null) {
    const lane = ctx.createTimelineLane(
      label,
      ctx.deps.t("viewer.timeline.layer", "Layer"),
    );
    lane.row.classList.add("layer-lane", "timeline-group-row");
    lane.row.classList.add(
      globalScope ? "global-layer-lane" : "scene-child-lane",
    );
    ctx.decorateTimelineRowDepth(lane.row, layerRow.depth, rowIndex);
    if (globalScope) {
      lane.row.dataset.timelineScope = "global";
    } else {
      lane.row.dataset.parentSceneId = scene.id;
    }
    lane.row.dataset.layerId = layerId;
    lane.row.classList.toggle("expanded", expanded);
    lane.row.classList.toggle("selected-layer", ctx.isSelectedLayer(layerId));
    lane.row.classList.toggle("disabled", layer?.visible === false);
    lane.row.classList.toggle(
      "inherited-disabled",
      !globalScope && scene.enabled === false,
    );
    ctx.decorateTimelineGroupLabel(lane, {
      count: childCount,
      expanded,
      id: layerRow.expansionId,
      label,
      metadata: layer?.type ?? "",
      scope: globalScope ? "global" : null,
      type: "layer",
    });
    ctx.appendTimelineLayerDragGrip(lane.label, layerId);
    lane.label.addEventListener("click", (event) => {
      event.stopPropagation();
      ctx.selectLayer(layerId, event);
    });
    if (layer) {
      ctx.appendTimelineEnabledToggle(lane.label, {
        enabled: layer.visible !== false,
        id: layer.id,
        title: ctx.deps.t("viewer.timeline.toggleLayer", "Toggle layer"),
        type: "layer",
      });
    }
    ctx.markRendererBinding(lane.row, "layer", layerId);
    if (clip && shouldRenderLayerInterval(ctx, clip, duration)) {
      const interval = ctx.getSceneClampedClipInterval(clip, scene);
      const block = ctx.createLayerIntervalBlock(
        template,
        scene,
        { clip, layer },
        ownershipLinks,
        duration,
        scene.enabled === false || layer?.visible === false,
      );
      lane.row.classList.toggle("invalid", interval.invalid);
      lane.body.append(block);
    }
    sceneGroup.append(lane.row);
  }
  if (!expanded) {
    return;
  }
  const inheritedDisabled =
    (!globalScope && scene.enabled === false) || layer?.visible === false;
  for (const phaseRow of layerRow.phases) {
    ctx.renderPhaseGroup(
      template,
      effectiveTemplate,
      timeline,
      sceneGroup,
      scene,
      phaseRow,
      ownershipLinks,
      duration,
      inheritedDisabled,
    );
  }
  ctx.renderPropertyTrackRows(
    template,
    effectiveTemplate,
    timeline,
    sceneGroup,
    scene,
    layerRow.directTracks,
    ownershipLinks,
    duration,
    inheritedDisabled,
  );
}

function shouldRenderLayerInterval(ctx: ViewerAppContext, clip, duration) {
  if (clip?.sceneId) {
    return true;
  }
  const start = Number(clip?.start) || 0;
  const end = start + (Number(clip?.duration) || 0);
  return (
    Math.abs(start) > ctx.deps.TIMING_BOUNDARY_TOLERANCE ||
    Math.abs(end - duration) > ctx.deps.TIMING_BOUNDARY_TOLERANCE ||
    clip.enabled === false ||
    Boolean(clip?.locked)
  );
}

export function installTimelineLayerGroupViewOwner(
  ctx: ViewerAppContext,
): void {
  ctx.renderLayerGroup = renderLayerGroup.bind(undefined, ctx);
}
