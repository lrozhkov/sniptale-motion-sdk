import type { TimelineRenderSnapshot } from "./state.js";

type SnapshotState = {
  timelineRenderSnapshot: TimelineRenderSnapshot | null;
  editorOverrides: ReadonlyMap<string, unknown>;
  timelineOverrides: ReadonlyMap<string, unknown>;
};

export function readTimelineRenderSnapshot(
  state: SnapshotState,
  template: unknown,
): TimelineRenderSnapshot | null {
  if (
    template === null ||
    typeof template !== "object" ||
    Array.isArray(template) ||
    !("id" in template) ||
    typeof template.id !== "string"
  )
    return null;
  const cached = state.timelineRenderSnapshot;
  return cached?.templateId === template.id &&
    cached.sourceTemplate === template &&
    cached.editorOverride === state.editorOverrides.get(template.id) &&
    cached.timelineOverride === state.timelineOverrides.get(template.id)
    ? cached
    : null;
}
