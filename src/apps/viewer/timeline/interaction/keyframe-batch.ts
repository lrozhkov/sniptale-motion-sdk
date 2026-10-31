import { bindViewerAction } from "../../app/bind-action.js";
import type { KeyframeEditActions } from "./keyframe-contract.js";
import type { ViewerAppContext } from "../../app/context.js";
import {
  createKeyframeAlignPlan,
  createKeyframeDistributePlan,
  createKeyframeMovePlan,
  createKeyframeQuantizePlan,
  createKeyframeScalePlan,
} from "../model/keyframe-transform.js";
import {
  createSelectionOperation,
  applyKeyframeTimePlan,
  reportKeyframeTimePlanFailure,
} from "./keyframe-time-operation.js";
import type { KeyframeMoveOptions } from "./keyframe-contract.js";

function moveSelectedKeyframesBySeconds(
  ctx: ViewerAppContext,
  requestedDelta: number,
  options: KeyframeMoveOptions = {},
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
      ...(options.coalesceKey === undefined
        ? {}
        : { coalesceKey: options.coalesceKey }),
      payload: { delta },
      type: options.type ?? "moveKeyframes",
    },
  );
}

function scaleSelectedKeyframeTimes(
  ctx: ViewerAppContext,
  factor: number,
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
  rawValue: string | number,
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

export function createKeyframeBatchActions(
  getContext: () => ViewerAppContext,
): Pick<
  KeyframeEditActions,
  | "moveSelectedKeyframesBySeconds"
  | "scaleSelectedKeyframeTimes"
  | "setKeyframeSelectionRangeProperty"
  | "alignSelectedKeyframes"
  | "distributeSelectedKeyframes"
  | "quantizeSelectedKeyframes"
> {
  return {
    moveSelectedKeyframesBySeconds: bindViewerAction(
      moveSelectedKeyframesBySeconds,
      getContext,
    ),
    scaleSelectedKeyframeTimes: bindViewerAction(
      scaleSelectedKeyframeTimes,
      getContext,
    ),
    setKeyframeSelectionRangeProperty: bindViewerAction(
      setKeyframeSelectionRangeProperty,
      getContext,
    ),
    alignSelectedKeyframes: bindViewerAction(
      alignSelectedKeyframes,
      getContext,
    ),
    distributeSelectedKeyframes: bindViewerAction(
      distributeSelectedKeyframes,
      getContext,
    ),
    quantizeSelectedKeyframes: bindViewerAction(
      quantizeSelectedKeyframes,
      getContext,
    ),
  };
}
