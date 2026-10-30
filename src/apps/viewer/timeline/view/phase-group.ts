import type { ViewerAppContext } from "../../app/context.js";
import { getPhaseRowTimingBounds } from "../model/phase-bounds.js";

function renderPhaseGroup(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  timeline,
  sceneGroup,
  scene,
  phaseRow,
  ownershipLinks,
  duration,
  inheritedDisabled = false,
) {
  const { phase } = phaseRow;
  const rowType =
    phaseRow.parent?.type === "scenePhase" ? "scenePhase" : "phase";
  const expanded = ctx.isTimelineRowExpanded(rowType, phaseRow.expansionId);
  const rowIndex = ctx.claimTimelineVirtualRow();
  if (rowIndex !== null) {
    const phaseLane = ctx.createTimelineLane(
      phase.label || phase.id,
      ctx.deps.t("viewer.timeline.phase", "Phase"),
    );
    phaseLane.row.classList.add(
      "scene-child-lane",
      "phase-lane",
      "timeline-group-row",
    );
    ctx.decorateTimelineRowDepth(
      phaseLane.row,
      phaseRow.depth ?? (phaseRow.parent?.type === "layerPhase" ? 2 : 1),
      rowIndex,
    );
    phaseLane.row.dataset.parentSceneId = scene.id;
    phaseLane.row.dataset.phaseId = phase.id;
    if (phaseRow.parent?.type === "layerPhase") {
      phaseLane.row.dataset.parentLayerId = phaseRow.parent.id;
      phaseLane.row.dataset.layerId = phaseRow.parent.id;
    } else if (phaseRow.parent?.type === "scenePhase") {
      phaseLane.row.dataset.scenePhaseId = phase.id;
    }
    phaseLane.row.classList.toggle("expanded", expanded);
    phaseLane.row.classList.toggle("disabled", phase.enabled === false);
    phaseLane.row.classList.toggle(
      "inherited-disabled",
      Boolean(inheritedDisabled) || scene.enabled === false,
    );
    ctx.decorateTimelineGroupLabel(phaseLane, {
      count: phaseRow.tracks.length,
      expanded,
      id: phaseRow.expansionId,
      label: phase.label || phase.id,
      type: rowType,
    });
    phaseLane.label.addEventListener("click", (event) => {
      event.stopPropagation();
      ctx.selectPhaseBlock(phase.id, event);
    });
    ctx.appendTimelineEnabledToggle(phaseLane.label, {
      enabled: ctx.isTimelineItemEnabled(phase),
      id: phase.id,
      title: ctx.deps.t("viewer.timeline.togglePhase", "Toggle phase"),
      type: "phase",
    });
    ctx.markRendererBinding(phaseLane.row, "phase", phase.id);
    const bounds = getPhaseRowTimingBounds(phaseRow);
    const block = ctx.createTimelineBlock({
      className: "phase-block",
      id: phase.id,
      invalid:
        ctx.isRangeInvalid(bounds.start, bounds.duration, duration) ||
        (!bounds.auto &&
          ctx.isPhaseSceneBoundaryInvalid(effectiveTemplate, phase)),
      label: phase.label || phase.id,
      left: ctx.timelinePercent(bounds.start, duration),
      locked: phase.locked,
      width: ctx.timelineDurationPercent(bounds.duration, duration),
    });
    block.dataset.phaseId = phase.id;
    block.dataset.timingSource = bounds.auto ? "keyframes" : "phase";
    ctx.markOwnershipLink(block, ownershipLinks.phaseIds.has(phase.id));
    ctx.markRendererBinding(block, "phase", phase.id);
    block.classList.toggle("selected", ctx.isSelectedPhase(phase.id));
    block.classList.toggle("disabled", phase.enabled === false);
    block.classList.toggle("auto-derived", bounds.auto);
    block.addEventListener("click", (event) => {
      event.stopPropagation();
      if (ctx.shouldSuppressDragClick(event)) {
        return;
      }
      (event.currentTarget as HTMLElement).focus({ preventScroll: true });
      ctx.selectPhaseBlock(phase.id, event);
    });
    if (!phase.locked) {
      block.addEventListener("pointerdown", (event) =>
        ctx.beginPhaseDrag(event, phase.id, "move"),
      );
    }
    if (!phase.locked && !bounds.auto) {
      const startEdge = document.createElement("span");
      startEdge.className = "timeline-edge start";
      startEdge.addEventListener("pointerdown", (event) =>
        ctx.beginPhaseDrag(event, phase.id, "start"),
      );
      const endEdge = document.createElement("span");
      endEdge.className = "timeline-edge end";
      endEdge.addEventListener("pointerdown", (event) =>
        ctx.beginPhaseDrag(event, phase.id, "end"),
      );
      block.append(startEdge, endEdge);
    }
    phaseLane.body.append(block);
    sceneGroup.append(phaseLane.row);
  }
  if (expanded) {
    ctx.renderPropertyTrackRows(
      template,
      effectiveTemplate,
      timeline,
      sceneGroup,
      scene,
      phaseRow.tracks,
      ownershipLinks,
      duration,
      Boolean(inheritedDisabled) ||
        scene.enabled === false ||
        phase.enabled === false,
    );
  }
}

export function installTimelinePhaseGroupViewOwner(
  ctx: ViewerAppContext,
): void {
  ctx.renderPhaseGroup = renderPhaseGroup.bind(undefined, ctx);
}
