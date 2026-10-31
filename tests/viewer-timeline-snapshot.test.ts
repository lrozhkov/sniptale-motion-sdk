import { describe, expect, it } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import { readEditorTemplate } from "../src/apps/viewer/templates/source.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";
import { readTimelineRenderSnapshot } from "../src/apps/viewer/timeline/snapshot.js";

function stateWithSnapshot() {
  const state = createViewerState();
  const source = { id: "source", duration: 1 };
  const timeline = readEditorTimeline({ phases: [], tracks: [] }, 1);
  const effectiveTemplate = readEditorTemplate(
    { ...source, layers: [], clips: [], scenes: [] },
    timeline,
  );
  state.currentTemplate = source;
  state.timelineRenderSnapshot = {
    sourceTemplate: source,
    templateId: source.id,
    duration: 1,
    editorOverride: state.editorOverrides.get(source.id),
    timelineOverride: state.timelineOverrides.get(source.id),
    effectiveTemplate,
    timeline,
    tree: { globalLayers: [], globalScene: null, scenes: [] },
  };
  return { state, source };
}

describe("timeline model snapshot authority", () => {
  it("reuses an unchanged model when only viewport state changes", () => {
    const { state, source } = stateWithSnapshot();
    state.timelineZoom = 2;
    state.timelineOffset = 0.25;
    expect(readTimelineRenderSnapshot(state, source)).toBe(
      state.timelineRenderSnapshot,
    );
  });
  it("rejects a replacement source with the same id", () => {
    const { state, source } = stateWithSnapshot();
    expect(readTimelineRenderSnapshot(state, { ...source })).toBeNull();
  });
  it("rejects a model after editor or timeline authority changes", () => {
    const { state, source } = stateWithSnapshot();
    state.editorOverrides.set(source.id, { layers: [] });
    expect(readTimelineRenderSnapshot(state, source)).toBeNull();
    state.editorOverrides.delete(source.id);
    state.timelineOverrides.set(source.id, { phases: [], tracks: [] });
    expect(readTimelineRenderSnapshot(state, source)).toBeNull();
  });
});
