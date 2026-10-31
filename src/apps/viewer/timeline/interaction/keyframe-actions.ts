import type { ViewerAppContext } from "../../app/context.js";
import type { KeyframeEditActions } from "./keyframe-contract.js";
import { createKeyframeEditActions } from "./keyframes.js";
import { createKeyframeBatchActions } from "./keyframe-batch.js";
import { createKeyframeClipboardActions } from "./keyframe-clipboard.js";
import { createKeyframePropertyActions } from "./keyframe-properties.js";
import { createKeyframeNudgeActions } from "./keyframe-nudge.js";

export function createKeyframeActions(
  getContext: () => ViewerAppContext,
): KeyframeEditActions {
  return {
    ...createKeyframeEditActions(getContext),
    ...createKeyframeBatchActions(getContext),
    ...createKeyframeClipboardActions(getContext),
    ...createKeyframePropertyActions(getContext),
    ...createKeyframeNudgeActions(getContext),
  };
}
