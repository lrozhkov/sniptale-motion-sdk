import { bindViewerAction } from "../app/bind-action.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { InspectorKeyframeActions } from "./keyframe-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { getTrackNumericPropertyRange } from "../layers/property-range.js";

function appendKeyframeEditInspector(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  totalDuration: number,
) {
  const valueRange = getTrackNumericPropertyRange(
    ctx,
    ctx.getEffectiveTemplate(ctx.state.currentTemplate),
    track,
  ) ?? { max: 4000, min: -4000 };
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.keyframeEdit",
    "Keyframe Edit",
  );
  ctx.appendInspectorNode(heading);
  ctx.appendInspectorKeyframeNumberField(track, keyframe, {
    label: ctx.deps.t("viewer.fields.time", "Time"),
    max: totalDuration,
    min: 0,
    property: "time",
    step: 0.01,
  });
  if (typeof keyframe.value === "number") {
    ctx.appendInspectorKeyframeNumberField(track, keyframe, {
      label: ctx.deps.t("viewer.fields.value", "Value"),
      max: valueRange.max,
      min: valueRange.min,
      property: "value",
      step: 0.01,
    });
  }
  ctx.appendInspectorKeyframeEasingField(track, keyframe);
}

export function createInspectorKeyframeEditActions(
  getContext: () => ViewerAppContext,
): Pick<InspectorKeyframeActions, "appendKeyframeEditInspector"> {
  return {
    appendKeyframeEditInspector: bindViewerAction(
      appendKeyframeEditInspector,
      getContext,
    ),
  };
}
