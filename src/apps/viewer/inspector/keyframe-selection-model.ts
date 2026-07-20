import type { ViewerAppContext } from "../app/context.js";
import {
  getKeyframeSelectionBounds,
  resolveKeyframeSelection,
} from "../timeline/model/keyframe-selection.js";

export function createKeyframeSelectionInspectorModel(
  ctx: ViewerAppContext,
  template,
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
  const numeric = entries.every(
    (entry) => typeof entry.keyframe.value === "number",
  );
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
    handles: Object.fromEntries(
      ["x1", "y1", "x2", "y2"].map((property) => [
        property,
        getCommonValue(
          entries.map(
            (entry) =>
              ctx.deps.normalizeHandles(entry.keyframe.handles)[property],
          ),
        ),
      ]),
    ),
    numericCount: entries.filter(
      (entry) => typeof entry.keyframe.value === "number",
    ).length,
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
    value: numeric
      ? getCommonValue(entries.map((entry) => entry.keyframe.value))
      : null,
  };
}

function getCommonValue(values) {
  const first = values[0];
  return values.every((value) => valuesEqual(value, first))
    ? { mixed: false, value: first }
    : { mixed: true, value: null };
}

function valuesEqual(left, right): boolean {
  return typeof left === "number" && typeof right === "number"
    ? Math.abs(left - right) < 0.0001
    : left === right;
}

function uniqueValues(values): string[] {
  return [
    ...new Set<string>(
      values.filter((value): value is string => typeof value === "string"),
    ),
  ];
}
