import { bindViewerAction } from "../app/bind-action.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { InspectorKeyframeActions } from "./keyframe-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  clampTrackNumericValue,
  getTrackNumericPropertyRange,
} from "../layers/property-range.js";
import { getKeyframeDisplayLabel } from "./keyframe-labels.js";

function appendKeyframeCurveInspector(
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
  const panel = document.createElement("div");
  panel.className = "keyframe-curve-editor";
  const heading = document.createElement("div");
  heading.className = "inspector-heading";
  heading.textContent = ctx.deps.t(
    "viewer.inspector.keyframeCurve",
    "Keyframe Curve",
  );
  const meta = document.createElement("p");
  meta.className = "keyframe-curve-meta";
  meta.textContent = getKeyframeDisplayLabel(ctx, track, keyframe);
  const handles = ctx.deps.normalizeHandles(keyframe.handles);
  const keyframes = [...(track.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const keyframeIndex = keyframes.findIndex((item) => item.id === keyframe.id);
  const hasOutgoingSegment =
    keyframeIndex >= 0 && keyframeIndex < keyframes.length - 1;
  const settings = document.createElement("div");
  settings.className = "keyframe-curve-settings";
  const handleFields = document.createElement("div");
  handleFields.className = "curve-handle-fields";
  if (!hasOutgoingSegment) {
    settings.append(
      ctx.createCurveNumberField(
        ctx.deps.t("viewer.fields.time", "Time"),
        ctx.roundInspectorNumber(keyframe.time),
        (value) =>
          void ctx.updateSelectedKeyframe(
            { time: ctx.deps.clamp(value, 0, totalDuration) },
            track.id,
            keyframe.id,
          ),
        {
          keyframeId: keyframe.id,
          keyframeProperty: "time",
          max: totalDuration,
          min: 0,
          trackId: track.id,
        },
      ),
    );
  }
  if (typeof keyframe.value === "number") {
    settings.append(
      ctx.createCurveNumberField(
        ctx.deps.t("viewer.fields.value", "Value"),
        ctx.roundInspectorNumber(keyframe.value),
        (value) =>
          void ctx.updateSelectedKeyframe(
            {
              value: clampTrackNumericValue(value, valueRange),
            },
            track.id,
            keyframe.id,
          ),
        {
          keyframeId: keyframe.id,
          keyframeProperty: "value",
          max: valueRange.max,
          min: valueRange.min,
          trackId: track.id,
        },
      ),
    );
  }
  settings.append(ctx.createEasingField(keyframe, track.id, keyframe.id));
  if (keyframe.easing === "bezier") {
    handleFields.append(
      ctx.createCurveHandleNumberField(track, keyframe, "X1", "x1", handles.x1),
      ctx.createCurveHandleNumberField(track, keyframe, "Y1", "y1", handles.y1),
      ctx.createCurveHandleNumberField(track, keyframe, "X2", "x2", handles.x2),
      ctx.createCurveHandleNumberField(track, keyframe, "Y2", "y2", handles.y2),
    );
  }
  const segmentTools = ctx.createKeyframeSegmentTools(
    track,
    keyframe,
    totalDuration,
  );
  panel.append(
    heading,
    meta,
    segmentTools,
    settings,
    ctx.createCurveSvg(track.id, keyframe.id, keyframe),
  );
  if (keyframe.easing === "bezier") {
    panel.append(handleFields);
  }
  ctx.appendInspectorNode(panel);
}

export function createInspectorKeyframeCurveActions(
  getContext: () => ViewerAppContext,
): Pick<InspectorKeyframeActions, "appendKeyframeCurveInspector"> {
  return {
    appendKeyframeCurveInspector: bindViewerAction(
      appendKeyframeCurveInspector,
      getContext,
    ),
  };
}
