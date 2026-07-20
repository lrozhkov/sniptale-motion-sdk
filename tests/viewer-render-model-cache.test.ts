import { describe, expect, it, vi } from "vitest";

import {
  commitRenderModelEnvelope,
  createRenderModelEnvelope,
  resetRenderModelCache,
  resolveRenderTemplateSnapshot,
} from "../src/apps/viewer/rendering/model-cache";

describe("viewer render model cache", () => {
  it("reuses an effective template until an editor model reference changes", () => {
    const template = { id: "template-a" };
    const first = createEffectiveTemplate("first");
    const second = createEffectiveTemplate("second");
    const getEffectiveTemplate = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const ctx = {
      getEffectiveTemplate,
      state: {
        currentTemplate: template,
        editorOverrides: new Map(),
        renderTemplateSnapshot: null,
        timelineOverrides: new Map(),
      },
    } as any;

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
      renderModelId: expect.any(String),
    });

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

function createEffectiveTemplate(label: string) {
  return {
    clips: [{ duration: 6.5, layerId: "logo", start: 0 }],
    duration: 6.5,
    id: label,
    layers: [{ id: "logo", opacity: 1 }],
    scenes: [{ duration: 6.5, id: "main", start: 0 }],
    timeline: { phases: [], tracks: [] },
  };
}
