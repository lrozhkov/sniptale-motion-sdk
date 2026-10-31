import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  getKeyframeSelectionBounds,
  resolveKeyframeSelection,
} from "../timeline/model/keyframe-selection.js";

export function createKeyframeSelectionInspectorModel(
  ctx: ViewerAppContext,
  template: EditorTimelineSource,
) {
  const timeline = ctx.getEffectiveTimeline(template);
  const entries = resolveKeyframeSelection(
    timeline,
    ctx.getSelectedKeyframeRefs(),
  );
  const bounds = getKeyframeSelectionBounds(entries);
  if (!bounds || entries.length < 2) {
    return null;
  }
  const numericValues = entries
    .map((entry) => entry.keyframe.value)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  const numeric = numericValues.length === entries.length;
  const outgoing = entries.every((entry) => {
    const ordered = [...entry.track.keyframes].sort(
      (left, right) => left.time - right.time,
    );
    return (
      ordered.findIndex((keyframe) => keyframe.id === entry.keyframeId) <
      ordered.length - 1
    );
  });
  return {
    bounds,
    canDistribute: entries.length >= 3 && bounds.duration > 0,
    canEditEasing: outgoing,
    canEditValue: numeric,
    easing: getCommonValue(
      entries.map((entry) => entry.keyframe.easing ?? "linear"),
    ),
    entries,
    numericCount: numericValues.length,
    ownership: {
      phases: uniqueValues(
        entries.map(
          (entry) => entry.keyframe.phaseId ?? entry.track.phaseId ?? null,
        ),
      ),
      scenes: uniqueValues(
        entries.map(
          (entry) => entry.keyframe.sceneId ?? entry.track.sceneId ?? null,
        ),
      ),
    },
    refs: entries.map(({ keyframeId, trackId }) => ({
      keyframeId,
      trackId,
    })),
    trackCount: new Set(entries.map((entry) => entry.trackId)).size,
    value: numeric ? getCommonValue(numericValues) : null,
  };
}

function getCommonValue<T>(values: readonly T[]): {
  mixed: boolean;
  value: T | null;
} {
  const first = values[0];
  if (first === undefined) return { mixed: true, value: null };
  return values.every((value) => valuesEqual(value, first))
    ? { mixed: false, value: first }
    : { mixed: true, value: null };
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return typeof left === "number" && typeof right === "number"
    ? Math.abs(left - right) < 0.0001
    : left === right;
}

function uniqueValues(values: readonly (string | null)[]): string[] {
  return [
    ...new Set<string>(
      values.filter((value): value is string => typeof value === "string"),
    ),
  ];
}

export type KeyframeSelectionInspectorModel = NonNullable<
  ReturnType<typeof createKeyframeSelectionInspectorModel>
>;
