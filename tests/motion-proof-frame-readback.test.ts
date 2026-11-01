import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readProofFrame } from "../src/apps/cli/proof/frames.js";
import { FRAME_OBSERVATION_ATTRIBUTE } from "../src/shared/proof/frame-observation.js";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  class PreviewCanvas {
    width = 2;
    height = 1;
    getContext = vi.fn<(kind: string, options?: unknown) => never>(() => {
      throw new Error("Readback must not access the live preview context.");
    });
  }
  const source = new PreviewCanvas();
  const pixels = new Uint8ClampedArray([80, 10, 20, 255, 0, 0, 0, 0]);
  const context = {
    drawImage: vi.fn<(source: unknown, x: number, y: number) => void>(),
    getImageData: vi.fn<
      (
        x: number,
        y: number,
        width: number,
        height: number,
      ) => Pick<ImageData, "data">
    >(() => ({ data: pixels })),
  };
  const getContext = vi
    .fn<(kind: string, options: unknown) => typeof context | null>()
    .mockReturnValue(context);
  const sizes: Array<{ width: number; height: number }> = [];
  class SnapshotCanvas {
    constructor(width: number, height: number) {
      sizes.push({ width, height });
    }
    getContext = getContext;
  }
  const observation = JSON.stringify({ sequence: 3, time: 1.5 });
  vi.stubGlobal("HTMLCanvasElement", PreviewCanvas);
  vi.stubGlobal("OffscreenCanvas", SnapshotCanvas);
  vi.stubGlobal("document", {
    querySelector: (selector: string) =>
      selector === "#previewCanvas"
        ? source
        : {
            getAttribute: (name: string) =>
              name === FRAME_OBSERVATION_ATTRIBUTE ? observation : null,
          },
  });
  return { source, pixels, context, getContext, sizes, observation };
}

describe("browser proof frame readback", () => {
  it("captures unchanged pixels without reading the live preview context", async () => {
    const { source, pixels, context, getContext, sizes, observation } =
      fixture();
    const result = await readProofFrame(FRAME_OBSERVATION_ATTRIBUTE);
    expect(source.getContext).not.toHaveBeenCalled();
    expect(sizes).toEqual([{ width: 2, height: 1 }]);
    expect(getContext).toHaveBeenCalledWith("2d", { willReadFrequently: true });
    expect(context.drawImage).toHaveBeenCalledWith(source, 0, 0);
    expect(context.getImageData).toHaveBeenCalledWith(0, 0, 2, 1);
    expect(result).toEqual({
      hash: createHash("sha256").update(pixels).digest("hex"),
      occupied: 1,
      lit: 1,
      observation,
    });
  });

  it("rejects a missing preview before allocating a snapshot", async () => {
    const { sizes } = fixture();
    vi.stubGlobal("document", { querySelector: () => null });
    await expect(readProofFrame(FRAME_OBSERVATION_ATTRIBUTE)).rejects.toThrow(
      "PROOF_CANVAS",
    );
    expect(sizes).toEqual([]);
  });

  it("rejects unavailable snapshot context without touching the preview", async () => {
    const { getContext, source } = fixture();
    getContext.mockReturnValue(null);
    await expect(readProofFrame(FRAME_OBSERVATION_ATTRIBUTE)).rejects.toThrow(
      "PROOF_CANVAS_CONTEXT",
    );
    expect(source.getContext).not.toHaveBeenCalled();
  });
});
