import { bindViewerAction } from "../app/bind-action.js";
import { readInspectorNumber } from "./field-model.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { InspectorKeyframeActions } from "./keyframe-contract.js";
import type { ViewerAppContext } from "../app/context.js";

function createKeyframeSegmentTools(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown>,
  totalDuration: number,
) {
  const keyframes = [...(track.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const index = keyframes.findIndex((item) => item.id === keyframe.id);
  const previous = index > 0 ? keyframes[index - 1] : null;
  const next =
    index >= 0 && index < keyframes.length - 1 ? keyframes[index + 1] : null;
  const segment = document.createElement("div");
  segment.className = "keyframe-segment-tools";
  const summary = document.createElement("div");
  summary.className = "keyframe-segment-summary";
  const label = document.createElement("strong");
  label.textContent = ctx.deps.t("viewer.inspector.segment", "Segment");
  const value = document.createElement("span");
  value.dataset.keyframeSegment = "summary";
  value.textContent = next
    ? ctx.deps
        .t("viewer.inspector.segmentRange", "Curve affects {start} → {end}")
        .replace("{start}", ctx.formatSeconds(keyframe.time))
        .replace("{end}", ctx.formatSeconds(next.time))
    : ctx.deps.t("viewer.inspector.noOutgoingSegment", "No outgoing segment");
  summary.append(label, value);
  const actions = document.createElement("div");
  actions.className = "keyframe-segment-actions";
  actions.append(
    createKeyframeNavigationButton(
      ctx,
      "prev",
      ctx.deps.t("viewer.inspector.previousKey", "Previous key"),
      track.id,
      previous,
    ),
    createKeyframeNavigationButton(
      ctx,
      "next",
      ctx.deps.t("viewer.inspector.nextKey", "Next key"),
      track.id,
      next,
    ),
  );
  segment.append(summary, actions);
  if (next) {
    const fields = document.createElement("div");
    fields.className = "keyframe-segment-fields";
    fields.append(
      createKeyframeSegmentField(
        ctx,
        ctx.deps.t("viewer.fields.start", "Start"),
        track.id,
        keyframe.id,
        next.id,
        "start",
        keyframe.time,
        totalDuration,
      ),
      createKeyframeSegmentField(
        ctx,
        ctx.deps.t("viewer.inspector.end", "End"),
        track.id,
        keyframe.id,
        next.id,
        "end",
        next.time,
        totalDuration,
      ),
      createKeyframeSegmentField(
        ctx,
        ctx.deps.t("viewer.fields.duration", "Duration"),
        track.id,
        keyframe.id,
        next.id,
        "duration",
        next.time - keyframe.time,
        totalDuration,
      ),
    );
    segment.append(fields);
  }
  return segment;
}

function createKeyframeSegmentField(
  ctx: ViewerAppContext,
  label: string,
  trackId: string,
  fromKeyframeId: string,
  toKeyframeId: string,
  property: "start" | "end" | "duration",
  value: number,
  totalDuration: number,
) {
  const field = document.createElement("label");
  field.className = "keyframe-segment-field";
  field.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = String(totalDuration);
  input.step = "0.01";
  input.value = String(ctx.roundInspectorNumber(value));
  input.dataset.trackId = trackId;
  input.dataset.fromKeyframeId = fromKeyframeId;
  input.dataset.toKeyframeId = toKeyframeId;
  input.dataset.keyframeSegmentProperty = property;
  input.addEventListener("change", () => {
    const next = readInspectorNumber(input.valueAsNumber, {
      min: 0,
      max: totalDuration,
    });
    if (next === null) {
      input.value = String(ctx.roundInspectorNumber(value));
      return;
    }
    updateKeyframeSegmentTiming(
      ctx,
      trackId,
      fromKeyframeId,
      toKeyframeId,
      property,
      next,
    );
  });
  field.append(input);
  return field;
}

function updateKeyframeSegmentTiming(
  ctx: ViewerAppContext,
  trackId: string,
  fromKeyframeId: string,
  toKeyframeId: string,
  property: "start" | "end" | "duration",
  rawValue: number,
) {
  if (!Number.isFinite(rawValue)) return;
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  const keyframes = [...(track?.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const fromIndex = keyframes.findIndex(
    (keyframe) => keyframe.id === fromKeyframeId,
  );
  const toIndex = keyframes.findIndex(
    (keyframe) => keyframe.id === toKeyframeId,
  );
  if (!template || !track || fromIndex < 0 || toIndex !== fromIndex + 1) {
    return;
  }
  const minGap = 1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  const previous = fromIndex > 0 ? keyframes[fromIndex - 1] : null;
  const next = toIndex < keyframes.length - 1 ? keyframes[toIndex + 1] : null;
  const previousLimit = previous ? previous.time + minGap : 0;
  const nextLimit = next
    ? next.time - minGap
    : ctx.getEffectiveDuration(template);
  const from = track.keyframes.find(
    (keyframe) => keyframe.id === fromKeyframeId,
  );
  const to = track.keyframes.find((keyframe) => keyframe.id === toKeyframeId);
  if (!from || !to) {
    return;
  }
  const value = rawValue;
  ctx.beginEditorCommand({
    payload: { fromKeyframeId, property, toKeyframeId, trackId, value },
    type: "updateKeyframeSegment",
  });
  if (property === "start") {
    from.time = ctx.snapTime(
      ctx.deps.clamp(value, previousLimit, to.time - minGap),
    );
  } else if (property === "end") {
    to.time = ctx.snapTime(
      ctx.deps.clamp(value, from.time + minGap, nextLimit),
    );
  } else {
    const duration = ctx.snapDuration(value);
    to.time = ctx.snapTime(
      ctx.deps.clamp(from.time + duration, from.time + minGap, nextLimit),
    );
  }
  track.keyframes = [...track.keyframes].sort((a, b) => a.time - b.time);
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.renderTimelineEditor(template);
  ctx.renderInspector();
  void ctx.renderCurrentFrame();
}

function createKeyframeNavigationButton(
  ctx: ViewerAppContext,
  direction: "prev" | "next",
  label: string,
  trackId: string,
  keyframe: TimelineKeyframe<unknown> | null | undefined,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "keyframe-nav-button";
  button.dataset.keyframeNav = direction;
  button.textContent = label;
  button.disabled = !keyframe;
  if (keyframe) {
    button.title = `${keyframe.id} · ${ctx.formatSeconds(keyframe.time)}`;
    button.addEventListener("click", () => {
      ctx.selectKeyframe(trackId, keyframe.id);
      ctx.seekToTime(keyframe.time);
    });
  }
  return button;
}

export function createInspectorKeyframeSegmentActions(
  getContext: () => ViewerAppContext,
): Pick<
  InspectorKeyframeActions,
  | "createKeyframeSegmentTools"
  | "createKeyframeSegmentField"
  | "updateKeyframeSegmentTiming"
  | "createKeyframeNavigationButton"
> {
  return {
    createKeyframeSegmentTools: bindViewerAction(
      createKeyframeSegmentTools,
      getContext,
    ),
    createKeyframeSegmentField: bindViewerAction(
      createKeyframeSegmentField,
      getContext,
    ),
    updateKeyframeSegmentTiming: bindViewerAction(
      updateKeyframeSegmentTiming,
      getContext,
    ),
    createKeyframeNavigationButton: bindViewerAction(
      createKeyframeNavigationButton,
      getContext,
    ),
  };
}
