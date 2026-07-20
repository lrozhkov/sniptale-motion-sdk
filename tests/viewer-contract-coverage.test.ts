import { describe, expect, it, vi } from "vitest";

import { mergePrimitiveBounds } from "../src/apps/viewer/rendering/contract-bounds";
import { waitForContractSampleSlot } from "../src/apps/viewer/rendering/contract-coverage";

describe("viewer renderer contract coverage scheduling", () => {
  it("backs off while playback owns the renderer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
    });
    const ctx = createContext({ playing: true });
    try {
      const slot = waitForContractSampleSlot(ctx, "effect", 2);
      await vi.advanceTimersByTimeAsync(249);
      expect(ctx.waitForRenderIdle).not.toHaveBeenCalled();
      ctx.state.playing = false;
      await vi.advanceTimersByTimeAsync(1);
      await expect(slot).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("waits on render completion without polling", async () => {
    const ctx = createContext({ renderInFlight: true });
    ctx.waitForRenderIdle.mockImplementation(async () => {
      ctx.state.renderInFlight = false;
    });

    await expect(waitForContractSampleSlot(ctx, "effect", 2)).resolves.toBe(
      true,
    );
    expect(ctx.waitForRenderIdle).toHaveBeenCalledOnce();
  });
});

describe("viewer renderer contract bounds", () => {
  it("unions samples per layer and returns stable layer order", () => {
    expect(
      mergePrimitiveBounds(
        [{ height: 20, layerId: "title", width: 40, x: 10, y: 15 }],
        [
          { height: 10, layerId: "logo", width: 10, x: 5, y: 5 },
          { height: 30, layerId: "title", width: 20, x: 0, y: 10 },
          { height: 1, width: 1, x: 0, y: 0 },
        ],
      ),
    ).toEqual([
      { height: 10, layerId: "logo", width: 10, x: 5, y: 5 },
      { height: 30, layerId: "title", width: 50, x: 0, y: 10 },
    ]);
  });
});

function createContext(state: Record<string, unknown>) {
  return {
    state: {
      currentTemplate: { id: "effect" },
      playing: false,
      renderInFlight: false,
      renderQueued: false,
      sandboxReady: true,
      sandboxRecoveryPending: false,
      sandboxRuntimeGeneration: 2,
      ...state,
    },
    waitForRenderIdle: vi.fn(),
  } as any;
}
