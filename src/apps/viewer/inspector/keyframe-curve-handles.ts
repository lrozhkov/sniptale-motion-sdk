import { bindViewerAction } from "../app/bind-action.js";
import type { InspectorHandleProperty } from "./keyframe-contract.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { InspectorKeyframeActions } from "./keyframe-contract.js";
import type { ViewerAppContext } from "../app/context.js";

function createCurveHandleNumberField(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  label: string,
  property: InspectorHandleProperty,
  value: number,
) {
  return ctx.createCurveNumberField(
    label,
    ctx.roundInspectorNumber(value),
    (nextValue) =>
      void ctx.updateSelectedKeyframe(
        { handles: { [property]: ctx.deps.clamp(nextValue, 0, 1) } },
        track.id,
        keyframe.id,
      ),
    {
      keyframeId: keyframe.id,
      keyframeProperty: `handle-${property}`,
      max: 1,
      min: 0,
      trackId: track.id,
    },
  );
}

export function createInspectorKeyframeCurveHandleActions(
  getContext: () => ViewerAppContext,
): Pick<InspectorKeyframeActions, "createCurveHandleNumberField"> {
  return {
    createCurveHandleNumberField: bindViewerAction(
      createCurveHandleNumberField,
      getContext,
    ),
  };
}
