import type { ViewerAppContext } from "../../app/context.js";
import {
  createKeyframeAlignPlan,
  createKeyframeDistributePlan,
  createKeyframeMovePlan,
  createKeyframeQuantizePlan,
  createKeyframeScalePlan,
  createKeyframeTimeSnapshot,
  keyframeRefKey,
  type KeyframeTimePlan,
  type KeyframeTimeSnapshot,
} from "../model/keyframe-transform.js";
import { expandMotionPathKeyframeSelection } from "../model/motion-path-mutations.js";

function moveSelectedKeyframesBySeconds(
  ctx: ViewerAppContext,
  requestedDelta,
  options: any = {},
): boolean {
  const operation = createSelectionOperation(ctx);
  if (!operation) {
    return false;
  }
  const primary = operation.snapshot.entries.at(-1);
  const delta = primary
    ? ctx.snapTime(primary.time + Number(requestedDelta || 0)) - primary.time
    : Number(requestedDelta) || 0;
  return applyKeyframeTimePlan(
    ctx,
    operation,
    createKeyframeMovePlan(operation.snapshot, delta),
    {
      coalesceKey: options.coalesceKey,
      payload: { delta },
      type: options.type ?? "moveKeyframes",
    },
  );
}

function scaleSelectedKeyframeTimes(
  ctx: ViewerAppContext,
  factor,
  pivot: "center" | "end" | "start" = "start",
): boolean {
  const operation = createSelectionOperation(ctx);
  return operation
    ? applyKeyframeTimePlan(
        ctx,
        operation,
        createKeyframeScalePlan(
          operation.snapshot,
          factor,
          pivot,
          ctx.snapTime,
        ),
        {
          payload: { factor, pivot },
          type: "scaleKeyframes",
        },
      )
    : false;
}

function setKeyframeSelectionRangeProperty(
  ctx: ViewerAppContext,
  property: "duration" | "end" | "start",
  rawValue,
): boolean {
  const operation = createSelectionOperation(ctx);
  if (!operation) {
    return false;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return false;
  }
  const { bounds } = operation.snapshot;
  if (property === "start") {
    return applyKeyframeTimePlan(
      ctx,
      operation,
      createKeyframeMovePlan(
        operation.snapshot,
        ctx.snapTime(value) - bounds.start,
      ),
      {
        payload: { property, value },
        type: "setKeyframeSelectionRange",
      },
    );
  }
  if (bounds.duration <= 0) {
    return reportKeyframeTimePlanFailure(ctx, "insufficient-selection");
  }
  const requestedDuration =
    property === "duration" ? value : value - bounds.start;
  return applyKeyframeTimePlan(
    ctx,
    operation,
    createKeyframeScalePlan(
      operation.snapshot,
      requestedDuration / bounds.duration,
      "start",
      ctx.snapTime,
    ),
    {
      payload: { property, value },
      type: "setKeyframeSelectionRange",
    },
  );
}

function alignSelectedKeyframes(
  ctx: ViewerAppContext,
  target: "end" | "playhead" | "start",
): boolean {
  const operation = createSelectionOperation(ctx);
  if (!operation) {
    return false;
  }
  const targetTime =
    target === "playhead"
      ? ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0)
      : target === "end"
        ? operation.snapshot.bounds.end
        : operation.snapshot.bounds.start;
  return applyKeyframeTimePlan(
    ctx,
    operation,
    createKeyframeAlignPlan(operation.snapshot, targetTime),
    {
      payload: { target, targetTime },
      type: "alignKeyframes",
    },
  );
}

function distributeSelectedKeyframes(ctx: ViewerAppContext): boolean {
  const operation = createSelectionOperation(ctx);
  return operation
    ? applyKeyframeTimePlan(
        ctx,
        operation,
        createKeyframeDistributePlan(operation.snapshot, ctx.snapTime),
        {
          payload: {},
          type: "distributeKeyframes",
        },
      )
    : false;
}

function quantizeSelectedKeyframes(ctx: ViewerAppContext): boolean {
  const operation = createSelectionOperation(ctx);
  return operation
    ? applyKeyframeTimePlan(
        ctx,
        operation,
        createKeyframeQuantizePlan(operation.snapshot, (time) =>
          ctx.deps.snapTimelineTime(time, {
            duration: operation.snapshot.duration,
            fps: Number(ctx.refs.fpsInput.value) || 30,
            snapMode: "frame",
          }),
        ),
        {
          payload: { fps: Number(ctx.refs.fpsInput.value) || 30 },
          type: "quantizeKeyframes",
        },
      )
    : false;
}

function createSelectionOperation(ctx) {
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

function applyKeyframeTimePlan(
  ctx,
  operation: {
    snapshot: KeyframeTimeSnapshot;
    template: any;
    timeline: any;
  },
  plan: KeyframeTimePlan,
  command: { coalesceKey?: string; payload: any; type: string },
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
  for (const entry of operation.snapshot.entries) {
    const track = operation.timeline.tracks.find(
      (item) => item.id === entry.trackId,
    );
    const keyframe = track?.keyframes.find(
      (item) => item.id === entry.keyframeId,
    );
    if (keyframe) {
      keyframe.time = plan.updates[keyframeRefKey(entry)];
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
  const primary = operation.snapshot.entries.at(-1);
  if (primary) {
    const primaryTime = plan.updates[keyframeRefKey(primary)];
    ctx.refs.timeSlider.value = String(primaryTime);
    ctx.refs.timeOutput.textContent = ctx.formatSeconds(primaryTime);
  }
  ctx.renderTimelineEditor(operation.template);
  void ctx.renderCurrentFrame();
  return true;
}

function reportKeyframeTimePlanFailure(ctx, reason): false {
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

export function installInteractionKeyframeBatchOwner(
  ctx: ViewerAppContext,
): void {
  ctx.moveSelectedKeyframesBySeconds = (...args: any[]) =>
    (moveSelectedKeyframesBySeconds as any)(ctx, ...args);
  ctx.scaleSelectedKeyframeTimes = (...args: any[]) =>
    (scaleSelectedKeyframeTimes as any)(ctx, ...args);
  ctx.setKeyframeSelectionRangeProperty = (...args: any[]) =>
    (setKeyframeSelectionRangeProperty as any)(ctx, ...args);
  ctx.alignSelectedKeyframes = (...args: any[]) =>
    (alignSelectedKeyframes as any)(ctx, ...args);
  ctx.distributeSelectedKeyframes = (...args: any[]) =>
    (distributeSelectedKeyframes as any)(ctx, ...args);
  ctx.quantizeSelectedKeyframes = (...args: any[]) =>
    (quantizeSelectedKeyframes as any)(ctx, ...args);
}
