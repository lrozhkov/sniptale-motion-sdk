import { bindViewerAction } from "../../app/bind-action.js";
import type { KeyframeEditActions } from "./keyframe-contract.js";
import { keyframeRefKey } from "../model/keyframe-reference.js";
import type { ViewerAppContext } from "../../app/context.js";

function nudgeSelectedKeyframesByFrames(
  ctx: ViewerAppContext,
  direction: number,
  frames: number,
) {
  const selectedRefs = ctx.getSelectedKeyframeRefs();
  if (selectedRefs.length === 0) {
    return;
  }
  const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  const delta =
    (Math.sign(direction || 0) * Math.max(1, Number(frames) || 1)) / fps;
  return ctx.moveSelectedKeyframesBySeconds(delta, {
    coalesceKey: `nudge-keyframes:${JSON.stringify(selectedRefs.map(keyframeRefKey).sort())}`,
    type: "nudgeKeyframes",
  });
}

export function createKeyframeNudgeActions(
  getContext: () => ViewerAppContext,
): Pick<KeyframeEditActions, "nudgeSelectedKeyframesByFrames"> {
  return {
    nudgeSelectedKeyframesByFrames: bindViewerAction(
      nudgeSelectedKeyframesByFrames,
      getContext,
    ),
  };
}
