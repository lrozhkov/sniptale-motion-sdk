import { parseKeyframeSelectionRef } from "../model/selection-validation.js";
import { keyframeRefKey } from "../model/keyframe-reference.js";
import type { ViewerAppContext } from "../../app/context.js";
import {
  collectMarqueeBlockIds,
  collectMarqueeKeyframes,
  resolveMarqueeSelectionKind,
} from "./marquee-hit-testing.js";

function beginTimelineMarqueeSelection(
  ctx: ViewerAppContext,
  event,
  options: any = {},
) {
  if (
    event.button !== 0 ||
    (!options.allowBlockStart &&
      event.target.closest(".keyframe-point, .timeline-block"))
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const tracksRect = ctx.refs.timelineTracks.getBoundingClientRect();
  const start = {
    clientX: event.clientX,
    clientY: event.clientY,
    x: event.clientX - tracksRect.left + ctx.refs.timelineTracks.scrollLeft,
    y: event.clientY - tracksRect.top + ctx.refs.timelineTracks.scrollTop,
  };
  const marquee = document.createElement("div");
  marquee.className = "timeline-marquee";
  ctx.refs.timelineTracks.append(marquee);
  const previousSelection = {
    clips: [...ctx.state.selectedClips],
    item: ctx.deps.deepClone(ctx.state.selectedItem),
    keyframes: ctx.deps.deepClone(ctx.state.selectedKeyframes),
    layers: [...ctx.state.selectedLayers],
    phases: [...ctx.state.selectedPhases],
    scenes: [...ctx.state.selectedScenes],
  };
  const additive = Boolean(event.shiftKey || event.metaKey || event.ctrlKey);
  const selectionKind = resolveMarqueeSelectionKind(event);
  ctx.state.selectedKeyframes = [];
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedItem = { type: "effect" };
  const update = (moveEvent) => {
    const current = {
      clientX: moveEvent.clientX,
      clientY: moveEvent.clientY,
      x:
        moveEvent.clientX -
        tracksRect.left +
        ctx.refs.timelineTracks.scrollLeft,
      y: moveEvent.clientY - tracksRect.top + ctx.refs.timelineTracks.scrollTop,
    };
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    marquee.style.left = `${left}px`;
    marquee.style.top = `${top}px`;
    marquee.style.width = `${width}px`;
    marquee.style.height = `${height}px`;
    ctx.state.dragMoved = ctx.state.dragMoved || width + height > 3;
    const clientRect = {
      bottom: Math.max(start.clientY, current.clientY),
      left: Math.min(start.clientX, current.clientX),
      right: Math.max(start.clientX, current.clientX),
      top: Math.min(start.clientY, current.clientY),
    };
    ctx.updateMarqueeTimelineSelection(clientRect, {
      additive,
      previousSelection,
      selectionKind,
    });
  };
  const stop = (endEvent) => {
    if (endEvent?.type === "pointercancel") {
      marquee.remove();
      ctx.state.selectedClips = previousSelection.clips;
      ctx.state.selectedItem = previousSelection.item;
      ctx.state.selectedKeyframes = previousSelection.keyframes;
      ctx.state.selectedLayers = previousSelection.layers;
      ctx.state.selectedPhases = previousSelection.phases;
      ctx.state.selectedScenes = previousSelection.scenes;
      ctx.renderTimelineEditor(ctx.state.currentTemplate);
      return;
    }
    if (
      Number.isFinite(endEvent?.clientX) &&
      Number.isFinite(endEvent?.clientY)
    ) {
      update(endEvent);
    }
    marquee.remove();
    if (ctx.state.selectedKeyframes.length > 0) {
      ctx.setSelectedKeyframes(ctx.state.selectedKeyframes, { render: false });
    } else {
      ctx.state.selectedItem = ctx.state.selectedClips[0]
        ? { layerId: ctx.state.selectedClips[0], type: "clip" }
        : ctx.state.selectedPhases[0]
          ? { phaseId: ctx.state.selectedPhases[0], type: "phase" }
          : ctx.state.selectedScenes[0]
            ? { sceneId: ctx.state.selectedScenes[0], type: "scene" }
            : { type: "effect" };
    }
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, update, stop);
  update(event);
}

function updateMarqueeTimelineSelection(
  ctx: ViewerAppContext,
  selectionRect,
  options: any = {},
) {
  const additive = Boolean(options.additive);
  const selectionKind = options.selectionKind ?? "auto";
  const previous = options.previousSelection ?? {
    clips: [],
    keyframes: [],
    phases: [],
    scenes: [],
  };
  const keyframeRefs = [];
  const clipIds = [];
  const phaseIds = [];
  const sceneIds = [];
  if (selectionKind === "auto" || selectionKind === "keyframes") {
    collectMarqueeKeyframes(ctx, selectionRect, keyframeRefs);
  }
  if (selectionKind === "auto" || selectionKind === "clips") {
    collectMarqueeBlockIds(
      ctx,
      selectionRect,
      ".clip-block",
      "layerId",
      clipIds,
    );
  }
  if (selectionKind === "auto" || selectionKind === "phases") {
    collectMarqueeBlockIds(
      ctx,
      selectionRect,
      ".phase-block",
      "phaseId",
      phaseIds,
    );
  }
  if (selectionKind === "auto" || selectionKind === "scenes") {
    collectMarqueeBlockIds(
      ctx,
      selectionRect,
      ".scene-block",
      "sceneId",
      sceneIds,
    );
  }
  const validKeyframes = keyframeRefs.filter(
    (ref) => ref.keyframeId && ref.trackId,
  );
  if (
    validKeyframes.length > 0 ||
    (additive && previous.keyframes.length > 0)
  ) {
    ctx.state.selectedKeyframes = mergeKeyframeRefs(
      additive ? previous.keyframes : [],
      validKeyframes,
    );
    ctx.state.selectedClips = [];
    ctx.state.selectedPhases = [];
    ctx.state.selectedScenes = [];
  } else {
    ctx.state.selectedKeyframes = [];
    const blockSelection = resolveMarqueeBlockSelection(
      { clips: clipIds, phases: phaseIds, scenes: sceneIds },
      previous,
      additive,
    );
    ctx.state.selectedClips = blockSelection.clips;
    ctx.state.selectedPhases = blockSelection.phases;
    ctx.state.selectedScenes = blockSelection.scenes;
  }
  ctx.state.selectedLayers = [];
  syncMarqueeSelectionClasses(ctx);
}

function resolveMarqueeBlockSelection(hits, previous, additive) {
  const selectedType =
    ["clips", "phases", "scenes"].find((type) => hits[type].length > 0) ??
    (additive
      ? ["clips", "phases", "scenes"].find((type) => previous[type]?.length > 0)
      : null);
  return {
    clips:
      selectedType === "clips"
        ? mergeIds(additive ? previous.clips : [], hits.clips)
        : [],
    phases:
      selectedType === "phases"
        ? mergeIds(additive ? previous.phases : [], hits.phases)
        : [],
    scenes:
      selectedType === "scenes"
        ? mergeIds(additive ? previous.scenes : [], hits.scenes)
        : [],
  };
}

function syncMarqueeSelectionClasses(ctx): void {
  const keyframes = new Set(
    ctx.state.selectedKeyframes.map((ref) => keyframeRefKey(ref)),
  );
  ctx.refs.timelineTracks
    .querySelectorAll(".keyframe-point")
    .forEach((point) => {
      const ref = parseKeyframeSelectionRef(point.dataset);
      point.classList.toggle(
        "selected",
        ref !== null && keyframes.has(keyframeRefKey(ref)),
      );
    });
  for (const { property, selected, selector } of [
    {
      property: "layerId",
      selected: new Set(ctx.state.selectedClips),
      selector: ".clip-block",
    },
    {
      property: "phaseId",
      selected: new Set(ctx.state.selectedPhases),
      selector: ".phase-block",
    },
    {
      property: "sceneId",
      selected: new Set(ctx.state.selectedScenes),
      selector: ".scene-block",
    },
  ]) {
    ctx.refs.timelineTracks
      .querySelectorAll(selector)
      .forEach((block) =>
        block.classList.toggle(
          "selected",
          selected.has(block.dataset[property]),
        ),
      );
  }
}

function mergeKeyframeRefs(left, right) {
  const refs = new Map();
  for (const ref of [...left, ...right]) {
    if (ref?.trackId && ref?.keyframeId) {
      refs.set(keyframeRefKey(ref), ref);
    }
  }
  return [...refs.values()];
}

function mergeIds(left, right): string[] {
  return [...new Set([...left, ...right].filter(Boolean))];
}

function addKeyframeAtPlayheadForSelection(ctx: ViewerAppContext) {
  const item = ctx.state.selectedItem;
  if (item?.type === "track" && item.trackId) {
    ctx.addKeyframeAtPlayhead(item.trackId);
    return;
  }
  if (item?.type === "keyframe" && item.trackId) {
    ctx.addKeyframeAtPlayhead(item.trackId);
  }
}

export function installInteractionMarqueeOwner(ctx: ViewerAppContext): void {
  ctx.beginTimelineMarqueeSelection = beginTimelineMarqueeSelection.bind(
    undefined,
    ctx,
  );
  ctx.updateMarqueeTimelineSelection = updateMarqueeTimelineSelection.bind(
    undefined,
    ctx,
  );
  ctx.addKeyframeAtPlayheadForSelection =
    addKeyframeAtPlayheadForSelection.bind(undefined, ctx);
}
