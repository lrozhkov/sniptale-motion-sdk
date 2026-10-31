import type { ViewerAppContext } from "../../app/context.js";
import type { EditorTemplateSource } from "../../templates/model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import {
  createKeyframeTimeSnapshot,
  type KeyframeTimePlan,
  type KeyframeTimeSnapshot,
} from "../model/keyframe-transform.js";
import { expandMotionPathKeyframeSelection } from "../model/motion-path-mutations.js";

type KeyframeSelectionOperation = {
  snapshot: KeyframeTimeSnapshot;
  template: EditorTemplateSource;
  timeline: EditorTimeline;
};

export function createSelectionOperation(
  ctx: ViewerAppContext,
): KeyframeSelectionOperation | null {
  const template = ctx.state.currentTemplate;
  if (!template) {
    return null;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const refs = expandMotionPathKeyframeSelection(
    timeline,
    ctx.getSelectedKeyframeRefs(),
  );
  const snapshot = createKeyframeTimeSnapshot(
    timeline,
    refs,
    ctx.getEffectiveDuration(template),
    1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30),
  );
  return snapshot ? { snapshot, template, timeline } : null;
}

export function applyKeyframeTimePlan(
  ctx: ViewerAppContext,
  operation: KeyframeSelectionOperation,
  plan: KeyframeTimePlan,
  command: {
    coalesceKey?: string;
    payload: Record<string, unknown>;
    type: string;
  },
): boolean {
  if (plan.ok === false) {
    return plan.reason === "no-change"
      ? false
      : reportKeyframeTimePlanFailure(ctx, plan.reason);
  }
  ctx.beginEditorCommand(
    {
      payload: {
        keyframes: operation.snapshot.refs,
        ...command.payload,
      },
      type: command.type,
    },
    command.coalesceKey ? { coalesceKey: command.coalesceKey } : {},
  );
  for (const entry of plan.updates) {
    const track = operation.timeline.tracks.find(
      (item) => item.id === entry.trackId,
    );
    const keyframe = track?.keyframes.find(
      (item) => item.id === entry.keyframeId,
    );
    if (keyframe) {
      keyframe.time = entry.time;
    }
  }
  for (const track of operation.timeline.tracks) {
    track.keyframes.sort((left, right) => left.time - right.time);
  }
  ctx.state.timelineOverrides.set(
    operation.template.id,
    ctx.deps.normalizeTimeline(
      operation.timeline,
      ctx.getEffectiveDuration(operation.template),
    ),
  );
  ctx.setSelectedKeyframes(operation.snapshot.refs, { render: false });
  const primary = plan.updates.at(-1);
  if (primary) {
    const primaryTime = primary.time;
    ctx.refs.timeSlider.value = String(primaryTime);
    ctx.refs.timeOutput.textContent = ctx.formatSeconds(primaryTime);
  }
  ctx.renderTimelineEditor(operation.template);
  void ctx.renderCurrentFrame();
  return true;
}

export function reportKeyframeTimePlanFailure(
  ctx: ViewerAppContext,
  reason: Extract<KeyframeTimePlan, { ok: false }>["reason"],
): false {
  const [key, fallback] =
    reason === "collision"
      ? [
          "viewer.timeline.keyframeTimeCollision",
          "The operation would overlap keyframes on the same track.",
        ]
      : reason === "out-of-range"
        ? [
            "viewer.timeline.keyframeTimeOutOfRange",
            "The operation would move keyframes outside the composition.",
          ]
        : reason === "invalid-scale"
          ? [
              "viewer.timeline.keyframeScaleInvalid",
              "Keyframe scale must be greater than zero.",
            ]
          : [
              "viewer.timeline.keyframeSelectionInsufficient",
              "Select more keyframes for this operation.",
            ];
  ctx.logDiagnostic(ctx.deps.t(key, fallback), "error");
  return false;
}
