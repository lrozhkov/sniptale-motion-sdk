import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type { EditorTemplate } from "../src/apps/viewer/templates/model.js";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import {
  commitRenderModelEnvelope,
  createRenderModelEnvelope,
  resetRenderModelCache,
  resolveRenderTemplateSnapshot,
} from "../src/apps/viewer/rendering/model-cache";

describe("viewer render model cache", () => {
  it("reuses an effective template until an editor model reference changes", () => {
    const template = { id: "template-a", duration: 6.5 };
    const first = createEffectiveTemplate("first");
    const second = createEffectiveTemplate("second");
    const ctx = createViewerContextFixture();
    ctx.state.currentTemplate = template;
    const getEffectiveTemplate = vi
      .spyOn(ctx, "getEffectiveTemplate")
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    expect(resolveRenderTemplateSnapshot(ctx, template)).toBe(first);
    expect(resolveRenderTemplateSnapshot(ctx, template)).toBe(first);
    expect(getEffectiveTemplate).toHaveBeenCalledTimes(1);

    ctx.state.timelineOverrides.set(template.id, { tracks: [] });
    expect(resolveRenderTemplateSnapshot(ctx, template)).toBe(second);
    expect(getEffectiveTemplate).toHaveBeenCalledTimes(2);
  });

  it("sends the model once per active revision and resends after a reset", () => {
    const state = { sandboxRenderModelId: null };
    const template = createEffectiveTemplate("model");
    const first = createRenderModelEnvelope(state, template);

    expect(first).toMatchObject({
      renderModel: {
        clips: template.clips,
        duration: 6.5,
        layers: template.layers,
        scenes: template.scenes,
        timeline: template.timeline,
      },
    });

    expect(typeof first.renderModelId).toBe("string");
    commitRenderModelEnvelope(state, first);
    expect(createRenderModelEnvelope(state, template)).toEqual({
      renderModelId: first.renderModelId,
    });

    resetRenderModelCache(state);
    expect(createRenderModelEnvelope(state, template)).toHaveProperty(
      "renderModel",
    );
  });
});

function createEffectiveTemplate(label: string): EditorTemplate {
  return {
    clips: [{ duration: 6.5, layerId: "logo", start: 0 }],
    duration: 6.5,
    id: label,
    layers: [{ id: "logo", type: "rect", opacity: 1 }],
    scenes: [{ duration: 6.5, id: "main", start: 0 }],
    timeline: { duration: 6.5, phases: [], tracks: [] },
  };
}
