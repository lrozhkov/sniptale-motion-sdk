import type { ViewerAppContext } from "../../app/context.js";

function renderSceneTimelineGroup(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  timeline,
  sceneRow,
  ownershipLinks,
  duration,
) {
  const { scene } = sceneRow;
  const expanded = ctx.isSceneExpanded(scene.id);
  const rowIndex = ctx.claimTimelineVirtualRow();
  const sceneGroup = document.createElement("div");
  sceneGroup.className = "timeline-scene-group";
  sceneGroup.dataset.sceneId = scene.id;
  sceneGroup.classList.toggle(
    "expanded",
    expanded && !ctx.state.timelineVirtualWindow?.virtualized,
  );

  if (rowIndex !== null) {
    const sceneLane = createSceneLane(
      ctx,
      template,
      effectiveTemplate,
      timeline,
      scene,
      ownershipLinks,
      duration,
      expanded,
      rowIndex,
    );
    sceneGroup.append(sceneLane.row);
  }
  if (!expanded) {
    if (sceneGroup.childElementCount > 0) {
      ctx.refs.timelineTracks.append(sceneGroup);
    }
    return;
  }
  ctx.renderTimelineLayerTree(
    template,
    effectiveTemplate,
    timeline,
    sceneGroup,
    scene,
    sceneRow.layers,
    ownershipLinks,
    duration,
  );
  for (const phaseRow of sceneRow.scenePhases) {
    ctx.renderPhaseGroup(
      template,
      effectiveTemplate,
      timeline,
      sceneGroup,
      scene,
      phaseRow,
      ownershipLinks,
      duration,
      scene.enabled === false,
    );
  }
  if (sceneRow.sceneTracks.length > 0) {
    ctx.renderSceneTracksGroup(
      template,
      effectiveTemplate,
      timeline,
      sceneGroup,
      scene,
      sceneRow.sceneTracks,
      ownershipLinks,
      duration,
    );
  }
  if (sceneGroup.childElementCount > 0) {
    ctx.refs.timelineTracks.append(sceneGroup);
  }
}

function createSceneLane(
  ctx,
  template,
  effectiveTemplate,
  timeline,
  scene,
  ownershipLinks,
  duration,
  expanded,
  rowIndex,
) {
  const sceneLane = ctx.createTimelineLane(
    scene.label || scene.id,
    ctx.deps.t("viewer.timeline.scene", "Scene"),
  );
  sceneLane.row.classList.add("timeline-scene-row");
  ctx.decorateTimelineRowDepth(sceneLane.row, 0, rowIndex);
  sceneLane.row.dataset.sceneId = scene.id;
  sceneLane.row.classList.toggle("expanded", expanded);
  sceneLane.row.classList.toggle("disabled", scene.enabled === false);
  ctx.decorateSceneLaneLabel(
    sceneLane,
    scene,
    expanded,
    ctx.getSceneTimelineSummary(effectiveTemplate, timeline, scene),
  );
  sceneLane.label.addEventListener("click", (event) => {
    event.stopPropagation();
    ctx.selectSceneBlock(scene.id, event);
  });
  ctx.appendTimelineEnabledToggle(sceneLane.label, {
    enabled: ctx.isTimelineItemEnabled(scene),
    id: scene.id,
    title: ctx.deps.t("viewer.timeline.toggleScene", "Toggle scene"),
    type: "scene",
  });
  const block = createSceneBlock(
    ctx,
    template,
    scene,
    ownershipLinks,
    duration,
  );
  sceneLane.body.append(block);
  return sceneLane;
}

function createSceneBlock(ctx, template, scene, ownershipLinks, duration) {
  const block = ctx.createTimelineBlock({
    className: "scene-block",
    id: scene.id,
    invalid: ctx.isRangeInvalid(scene.start, scene.duration, duration),
    label: `${scene.label || scene.id} · ${ctx.formatSecondsRange(
      scene.start,
      scene.start + scene.duration,
      2,
    )}`,
    left: ctx.timelinePercent(scene.start, duration),
    locked: scene.locked,
    width: ctx.timelineDurationPercent(scene.duration, duration),
  });
  block.dataset.sceneId = scene.id;
  ctx.markOwnershipLink(block, ownershipLinks.sceneIds.has(scene.id));
  block.classList.toggle("selected", ctx.isSelectedScene(scene.id));
  block.classList.toggle("disabled", scene.enabled === false);
  block.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ctx.shouldSuppressDragClick(event)) {
      return;
    }
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    ctx.selectSceneBlock(scene.id, event);
  });
  if (!scene.locked) {
    block.addEventListener("pointerdown", (event) =>
      ctx.beginSceneDrag(event, scene.id, "move"),
    );
    appendSceneEdge(ctx, block, scene.id, "start");
    appendSceneEdge(ctx, block, scene.id, "end");
  }
  return block;
}

function appendSceneEdge(ctx, block, sceneId, edge) {
  const node = document.createElement("span");
  node.className = `timeline-edge ${edge}`;
  node.addEventListener("pointerdown", (event) =>
    ctx.beginSceneDrag(event, sceneId, edge),
  );
  block.append(node);
}

export function installViewSceneGroupOwner(ctx: ViewerAppContext): void {
  ctx.renderSceneTimelineGroup = (...args: any[]) =>
    (renderSceneTimelineGroup as any)(ctx, ...args);
}
