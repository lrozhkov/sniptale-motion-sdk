import type { ViewerAppContext } from "../../app/context.js";
import {
  clampTrackNumericValue,
  getTrackNumericPropertyRange,
} from "../../layers/property-range.js";
import { resolveKeyframeSelection } from "../model/keyframe-selection.js";
import { expandMotionPathKeyframeSelection } from "../model/motion-path-mutations.js";

function updateSelectedKeyframesBatch(ctx: ViewerAppContext, patch): boolean {
  const template = ctx.state.currentTemplate;
  if (!template || !patch || typeof patch !== "object") {
    return false;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const selectedRefs =
    typeof patch.easing === "string" || patch.handles
      ? expandMotionPathKeyframeSelection(
          timeline,
          ctx.getSelectedKeyframeRefs(),
        )
      : ctx.getSelectedKeyframeRefs();
  const entries = resolveKeyframeSelection(timeline, selectedRefs);
  if (entries.length === 0) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, "value") &&
    entries.some((entry) => typeof entry.keyframe.value !== "number")
  ) {
    return reportKeyframePropertyFailure(ctx);
  }
  ctx.beginEditorCommand({
    payload: {
      keyframes: entries.map(({ keyframeId, trackId }) => ({
        keyframeId,
        trackId,
      })),
      patch,
    },
    type: "updateKeyframes",
  });
  const effectiveTemplate = ctx.getEffectiveTemplate?.(template) ?? template;
  for (const entry of entries) {
    if (Object.prototype.hasOwnProperty.call(patch, "value")) {
      entry.keyframe.value = clampTrackNumericValue(
        Number(patch.value),
        getTrackNumericPropertyRange(ctx, effectiveTemplate, entry.track),
      );
    }
    if (typeof patch.easing === "string") {
      entry.keyframe.easing = patch.easing;
      if (patch.easing === "bezier") {
        const handles = ctx.deps.normalizeHandles(entry.keyframe.handles);
        if (
          handles.x1 === 0 &&
          handles.y1 === 0 &&
          handles.x2 === 0 &&
          handles.y2 === 0
        ) {
          entry.keyframe.handles = {
            x1: 0.25,
            x2: 0.25,
            y1: 0.1,
            y2: 1,
          };
        }
      }
    }
    if (patch.handles && typeof patch.handles === "object") {
      entry.keyframe.handles = {
        ...ctx.deps.normalizeHandles(entry.keyframe.handles),
        ...patch.handles,
      };
      entry.keyframe.easing = "bezier";
    }
  }
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.setSelectedKeyframes(
    entries.map(({ keyframeId, trackId }) => ({ keyframeId, trackId })),
    { render: false },
  );
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
  return true;
}

function reportKeyframePropertyFailure(ctx): false {
  ctx.logDiagnostic(
    ctx.deps.t(
      "viewer.inspector.keyframeSelection.valueUnavailable",
      "Value editing requires every selected keyframe to contain a numeric value.",
    ),
    "error",
  );
  return false;
}

export function installInteractionKeyframePropertiesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.updateSelectedKeyframesBatch = updateSelectedKeyframesBatch.bind(
    undefined,
    ctx,
  );
}
