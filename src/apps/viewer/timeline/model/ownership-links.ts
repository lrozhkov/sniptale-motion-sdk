import {
  collectKeyframeParentLinks,
  collectSceneOwnershipLinks,
  collectClipOwnershipLinks,
  collectPhaseOwnershipLinks,
  collectTrackOwnershipLinks,
} from "./ownership-collectors.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../../sdk/types.js";
import type { OwnershipLinks } from "./ownership-model.js";
import type { ViewerAppContext } from "../../app/context.js";

function getKeyframeOwnershipSceneId(
  _ctx: ViewerAppContext,
  timeline: EditorTimeline | null | undefined,
  track: MotionPathTrack | null | undefined,
  keyframe: TimelineKeyframe<unknown> | null | undefined,
): string | null {
  if (typeof keyframe?.sceneId === "string") {
    return keyframe.sceneId;
  }
  if (typeof track?.sceneId === "string") {
    return track.sceneId;
  }
  const phaseId =
    typeof keyframe?.phaseId === "string" ? keyframe.phaseId : track?.phaseId;
  const phase = (timeline?.phases ?? []).find((item) => item.id === phaseId);
  return typeof phase?.sceneId === "string" ? phase.sceneId : null;
}

function markOwnershipLink(
  _ctx: ViewerAppContext,
  element: HTMLElement,
  linked: boolean,
): void {
  element.classList.toggle("ownership-linked", Boolean(linked));
  if (linked) {
    element.dataset.ownershipLinked = "true";
  } else {
    delete element.dataset.ownershipLinked;
  }
}

function createEmptyOwnershipLinks(_ctx: ViewerAppContext): OwnershipLinks {
  return {
    clipLayerIds: new Set(),
    keyframes: new Set(),
    phaseIds: new Set(),
    sceneIds: new Set(),
    trackIds: new Set(),
  };
}

function buildSelectedOwnershipLinks(
  ctx: ViewerAppContext,
  template: EditorTemplate | null | undefined,
): OwnershipLinks {
  const links = ctx.createEmptyOwnershipLinks();
  const item = ctx.state.selectedItem ?? { type: "effect" };
  if (!template || item.type === "effect") {
    return links;
  }
  if (
    !ctx.state.moveLinkedKeys &&
    (item.type === "scene" || item.type === "clip" || item.type === "phase")
  ) {
    if (item.type === "scene") {
      links.sceneIds.add(item.sceneId);
    } else if (item.type === "clip") {
      links.clipLayerIds.add(item.layerId);
    } else if (item.type === "phase") {
      links.phaseIds.add(item.phaseId);
    }
    return links;
  }
  if (item.type === "scene") {
    ctx.collectSceneOwnershipLinks(template, [item.sceneId], links);
  } else if (item.type === "clip") {
    ctx.collectClipOwnershipLinks(template, [item.layerId], links);
  } else if (item.type === "layer") {
    for (const track of template.timeline?.tracks ?? []) {
      if (ctx.getTrackLayerId(track) === item.layerId) {
        links.trackIds.add(track.id);
      }
    }
  } else if (item.type === "phase") {
    ctx.collectPhaseOwnershipLinks(template, [item.phaseId], links);
  } else if (item.type === "track") {
    ctx.collectTrackOwnershipLinks(template, item.trackId, links);
  } else if (item.type === "keyframe") {
    ctx.collectKeyframeParentLinks(
      template,
      item.trackId,
      item.keyframeId,
      links,
    );
  }
  return links;
}

function assignKeyframeOwnershipAtTime(
  ctx: ViewerAppContext,
  keyframe: TimelineKeyframe<unknown>,
  track: MotionPathTrack,
  time: number,
): void {
  keyframe.phaseId = ctx.findPhaseIdAtTime(
    ctx.state.currentTemplate,
    time,
    ctx.getTrackLayerId(track),
  );
  keyframe.sceneId = ctx.findSceneIdAtTime(ctx.state.currentTemplate, time);
  if (track.phaseId && keyframe.phaseId === track.phaseId) {
    keyframe.phaseId = null;
  }
  if (track.sceneId && keyframe.sceneId === track.sceneId) {
    keyframe.sceneId = null;
  }
}

export function createOwnershipLinkActions(getContext: () => ViewerAppContext) {
  return {
    collectKeyframeParentLinks: bindViewerAction(
      collectKeyframeParentLinks,
      getContext,
    ),
    getKeyframeOwnershipSceneId: bindViewerAction(
      getKeyframeOwnershipSceneId,
      getContext,
    ),
    markOwnershipLink: bindViewerAction(markOwnershipLink, getContext),
    createEmptyOwnershipLinks: bindViewerAction(
      createEmptyOwnershipLinks,
      getContext,
    ),
    buildSelectedOwnershipLinks: bindViewerAction(
      buildSelectedOwnershipLinks,
      getContext,
    ),
    collectSceneOwnershipLinks: bindViewerAction(
      collectSceneOwnershipLinks,
      getContext,
    ),
    collectClipOwnershipLinks: bindViewerAction(
      collectClipOwnershipLinks,
      getContext,
    ),
    collectPhaseOwnershipLinks: bindViewerAction(
      collectPhaseOwnershipLinks,
      getContext,
    ),
    collectTrackOwnershipLinks: bindViewerAction(
      collectTrackOwnershipLinks,
      getContext,
    ),
    assignKeyframeOwnershipAtTime: bindViewerAction(
      assignKeyframeOwnershipAtTime,
      getContext,
    ),
  };
}
