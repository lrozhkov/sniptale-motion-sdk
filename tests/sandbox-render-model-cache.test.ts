import { describe, expect, it } from "vitest";

import { createRenderModelCache } from "../src/apps/sandbox/runtime/render-model-cache";

describe("sandbox render model cache", () => {
  it("normalizes a transferred model once and reuses it across frames", () => {
    const cache = createRenderModelCache();
    const firstMessage = {
      renderModel: createRenderModel(),
      renderModelId: "model-a",
      time: 0,
    };
    const secondMessage = { renderModelId: "model-a", time: 1 };
    const first = cache.resolve(firstMessage);
    const second = cache.resolve(secondMessage);

    expect(first).toBe(firstMessage);
    expect(second).toBe(secondMessage);
    expect(first.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "logo",
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
        }),
      ]),
    );
    expect(second.layers).toBe(first.layers);
    expect(second.timeline).toBe(first.timeline);
    expect(second.time).toBe(1);
  });

  it("rejects missing, malformed, and stale model revisions", () => {
    const cache = createRenderModelCache();

    expect(() => cache.resolve({ renderModelId: "missing" })).toThrow(
      "Missing cached render model missing.",
    );
    expect(() =>
      cache.resolve({
        renderModel: { ...createRenderModel(), layers: [null] },
        renderModelId: "invalid",
      }),
    ).toThrow("Expected layers to be an array of objects.");

    cache.resolve({ renderModel: createRenderModel(), renderModelId: "a" });
    expect(() => cache.resolve({ renderModelId: "b" })).toThrow(
      "Missing cached render model b.",
    );
  });
});

function createRenderModel() {
  return {
    clips: [{ duration: 6.5, layerId: "logo", start: 0 }],
    duration: 6.5,
    layers: [{ id: "logo", opacity: 1 }],
    scenes: [{ duration: 6.5, id: "main", start: 0 }],
    timeline: {
      phases: [],
      tracks: [
        {
          id: "logo.opacity",
          keyframes: [
            { id: "a", time: 0, value: 0 },
            { id: "b", time: 1, value: 1 },
          ],
        },
      ],
    },
  };
}
