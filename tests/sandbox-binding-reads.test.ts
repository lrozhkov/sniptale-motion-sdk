import { describe, expect, it, vi } from "vitest";

import {
  createChildBindingReads,
  createBindingReads,
  recordBindingRead,
  serializeFrameBindingReads,
  serializeBindingReads,
  shouldRecordPrimitivePaintRead,
} from "../src/apps/sandbox/runtime/binding-reads";
import { createRenderContext } from "../src/apps/sandbox/runtime/render-context";
import { normalizeRenderResult } from "../src/apps/sandbox/runtime/render-result";

describe("sandbox binding reads", () => {
  it("keeps the parent scope for nested render-pass reads", () => {
    const child = createChildBindingReads(
      createBindingReads({
        dependencies: false,
        primitiveLayerId: "selected",
      }),
    );

    recordBindingRead(child, "controls", "accent");

    expect(child?.controls).toEqual(new Set());
    expect(shouldRecordPrimitivePaintRead(child, "selected")).toBe(true);
    expect(shouldRecordPrimitivePaintRead(child, "other")).toBe(false);
  });

  it("records and serializes sorted binding ids", () => {
    const reads = createBindingReads();
    recordBindingRead(reads, "layers", "z");
    recordBindingRead(reads, "layers", "a");
    recordBindingRead(reads, "tracks", 12);
    recordBindingRead(reads, "inputFrames", "next");
    recordBindingRead(reads, "tracks", "");
    recordBindingRead(reads, "controls", null);

    expect(serializeBindingReads({ __bindingReads: reads })).toEqual({
      clips: [],
      controls: [],
      inputFrames: ["next"],
      layerGateReads: [],
      layers: ["a", "z"],
      phases: [],
      primitiveBounds: [],
      primitivePaintReads: [],
      tracks: ["12"],
    });
  });

  it("serializes only selected primitive geometry for playback", () => {
    const reads = createBindingReads({
      dependencies: false,
      primitiveLayerId: "logo",
    });
    reads.tracks.add("logo.x");
    reads.primitiveBounds.set("logo", {
      height: 90,
      layerId: "logo",
      width: 160,
      x: 10,
      y: 20,
    });
    reads.primitiveBounds.set("other", {
      height: 10,
      layerId: "other",
      width: 10,
      x: 0,
      y: 0,
    });

    expect(
      serializeBindingReads(
        { __bindingReads: reads },
        { primitiveLayerId: "logo", selectionOnly: true },
      ),
    ).toEqual({
      clips: [],
      controls: [],
      inputFrames: [],
      layerGateReads: [],
      layers: [],
      primitiveBounds: [
        {
          height: 90,
          layerId: "logo",
          width: 160,
          x: 10,
          y: 20,
        },
      ],
      primitivePaintReads: [],
      phases: [],
      tracks: [],
    });
  });

  it("does not collect discarded dependency reads for selection playback", () => {
    const context = createRenderContext(
      {
        bindingLayerId: "logo",
        bindingReadMode: "selection",
        duration: 1,
        height: 720,
        time: 0,
        timeline: {
          phases: [],
          tracks: [
            {
              id: "logo.x",
              keyframes: [{ time: 0, value: 10 }],
            },
          ],
        },
        width: 1280,
      },
      { kind: "composition" },
      {},
    );

    expect(context.track("logo.x", 0)).toBe(10);
    expect(serializeBindingReads(context).tracks).toEqual([]);
  });

  it("records direct control reads and phases consumed by resolved tracks", () => {
    const context = createRenderContext(
      {
        controls: { accent: "#ff6b00" },
        duration: 2,
        height: 720,
        time: 0.5,
        timeline: {
          phases: [
            { duration: 1, id: "intro", start: 0 },
            { duration: 1, id: "unused", start: 1 },
          ],
          tracks: [
            {
              id: "title.opacity",
              keyframes: [
                { phaseId: "intro", time: 0, value: 0 },
                { phaseId: "unused", time: 1, value: 1 },
              ],
              phaseId: "intro",
            },
          ],
        },
        width: 1280,
      },
      { kind: "composition" },
      {},
    );

    expect(context.controls.accent).toBe("#ff6b00");
    expect(context.track("title.opacity", 0)).toBe(0.5);
    expect(serializeBindingReads(context)).toMatchObject({
      controls: ["accent"],
      phases: ["intro", "unused"],
      tracks: ["title.opacity"],
    });
  });

  it("skips binding allocation when playback has no selected layer", () => {
    const context = createRenderContext(
      {
        bindingReadMode: "selection",
        duration: 1,
        height: 720,
        time: 0,
        width: 1280,
      },
      { kind: "composition" },
      {},
    );

    expect(context.__bindingReads).toBeNull();
    expect(
      serializeFrameBindingReads(context, { selectionOnly: true }),
    ).toBeUndefined();
    expect(serializeBindingReads(context)).toEqual({
      clips: [],
      controls: [],
      inputFrames: [],
      layerGateReads: [],
      layers: [],
      phases: [],
      primitiveBounds: [],
      primitivePaintReads: [],
      tracks: [],
    });
  });

  it("serializes an empty context", () => {
    expect(serializeBindingReads(null)).toEqual({
      clips: [],
      controls: [],
      inputFrames: [],
      layerGateReads: [],
      layers: [],
      phases: [],
      primitiveBounds: [],
      primitivePaintReads: [],
      tracks: [],
    });
  });

  it("keeps executable compatibility helpers out of render contexts", () => {
    const context = createRenderContext(
      { duration: 1, height: 720, time: 0, width: 1280 },
      { kind: "composition" },
      {},
    );

    expect(context).not.toHaveProperty("timelineContext");
    expect(context).not.toHaveProperty("sequence");
    expect(context).not.toHaveProperty("useCurrentFrame");
    expect(context).not.toHaveProperty("useVideoConfig");
  });

  it("records actual previous and next transition frame reads", () => {
    const context = createRenderContext(
      {
        duration: 1,
        height: 720,
        inputFrames: { next: "next-frame", previous: "previous-frame" },
        time: 0,
        width: 1280,
      },
      { kind: "transitionEffect" },
      {},
    );

    expect(context.inputFrames.previous).toBe("previous-frame");
    expect(context.inputFrames.next).toBe("next-frame");
    expect(serializeBindingReads(context).inputFrames).toEqual([
      "next",
      "previous",
    ]);
  });
});

describe("sandbox render result normalization", () => {
  it("transfers an OffscreenCanvas result without copying its pixels", async () => {
    const bitmap = { kind: "transferred-bitmap" };
    class TestOffscreenCanvas {
      transferToImageBitmap() {
        return bitmap;
      }
    }
    const previousOffscreenCanvas = globalThis.OffscreenCanvas;
    const previousImageBitmap = globalThis.ImageBitmap;
    Object.assign(globalThis, {
      ImageBitmap: class TestImageBitmap {},
      OffscreenCanvas: TestOffscreenCanvas,
    });
    try {
      await expect(
        normalizeRenderResult(
          new TestOffscreenCanvas(),
          { height: 720, width: 1280 },
          async () => {
            throw new Error("not used");
          },
        ),
      ).resolves.toBe(bitmap);
    } finally {
      Object.assign(globalThis, {
        ImageBitmap: previousImageBitmap,
        OffscreenCanvas: previousOffscreenCanvas,
      });
    }
  });

  it("scales a direct logical bitmap to the requested raster size", async () => {
    const drawImage = vi.fn();
    const clearRect = vi.fn();
    const resizedBitmap = { height: 1080, width: 1920 };
    const sourceBitmap = {
      close: vi.fn(),
      height: 720,
      width: 1280,
    };
    const createCanvas = vi.fn(() => ({
      getContext: () => ({ clearRect, drawImage }),
      transferToImageBitmap: () => resizedBitmap,
    }));
    class TestImageBitmap {}
    Object.setPrototypeOf(sourceBitmap, TestImageBitmap.prototype);
    vi.stubGlobal("ImageBitmap", TestImageBitmap);
    try {
      await expect(
        normalizeRenderResult(
          sourceBitmap,
          { height: 720, width: 1280 },
          async () => {
            throw new Error("not used");
          },
          { createCanvas, height: 1080, width: 1920 },
        ),
      ).resolves.toBe(resizedBitmap);
      expect(createCanvas).toHaveBeenCalledWith(1920, 1080);
      expect(clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
      expect(drawImage).toHaveBeenCalledWith(sourceBitmap, 0, 0, 1920, 1080);
      expect(sourceBitmap.close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flattens export bitmaps before they cross the sandbox boundary", async () => {
    const calls: string[] = [];
    const opaqueBitmap = { height: 720, width: 1280 };
    const sourceBitmap = {
      close: vi.fn(),
      height: 720,
      width: 1280,
    };
    const context = {
      clearRect: vi.fn(() => calls.push("clear")),
      drawImage: vi.fn(() => calls.push("bitmap")),
      fillStyle: "transparent",
      fillRect: vi.fn(() => calls.push("matte")),
      globalAlpha: 0.25,
      globalCompositeOperation: "lighter",
      setTransform: vi.fn(() => calls.push("transform")),
    };
    const createCanvas = vi.fn(() => ({
      getContext: () => context,
      transferToImageBitmap: () => opaqueBitmap,
    }));
    class TestImageBitmap {}
    Object.setPrototypeOf(sourceBitmap, TestImageBitmap.prototype);
    vi.stubGlobal("ImageBitmap", TestImageBitmap);
    try {
      await expect(
        normalizeRenderResult(
          sourceBitmap,
          { height: 720, width: 1280 },
          async () => {
            throw new Error("not used");
          },
          {
            createCanvas,
            height: 720,
            opaqueBackground: true,
            width: 1280,
          },
        ),
      ).resolves.toBe(opaqueBitmap);
      expect(calls).toEqual(["transform", "matte", "bitmap"]);
      expect(context.fillStyle).toBe("#000000");
      expect(context.globalAlpha).toBe(1);
      expect(context.globalCompositeOperation).toBe("source-over");
      expect(sourceBitmap.close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flattens an export canvas before creating its first bitmap", async () => {
    const opaqueBitmap = { height: 720, width: 1280 };
    const transferToImageBitmap = vi.fn(() => ({ kind: "wrong-bitmap" }));
    class TestOffscreenCanvas {
      height = 720;
      width = 1280;
      transferToImageBitmap = transferToImageBitmap;
    }
    const sourceCanvas = new TestOffscreenCanvas();
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const createCanvas = vi.fn(() => ({
      getContext: () => ({ drawImage, fillRect, setTransform: vi.fn() }),
      transferToImageBitmap: () => opaqueBitmap,
    }));
    const previousOffscreenCanvas = globalThis.OffscreenCanvas;
    Object.assign(globalThis, { OffscreenCanvas: TestOffscreenCanvas });
    try {
      await expect(
        normalizeRenderResult(
          sourceCanvas,
          { height: 720, width: 1280 },
          async () => {
            throw new Error("not used");
          },
          {
            createCanvas,
            height: 720,
            opaqueBackground: true,
            width: 1280,
          },
        ),
      ).resolves.toBe(opaqueBitmap);
      expect(transferToImageBitmap).not.toHaveBeenCalled();
      expect(fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
      expect(drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 0, 1280, 720);
    } finally {
      Object.assign(globalThis, { OffscreenCanvas: previousOffscreenCanvas });
    }
  });

  it("rejects unsupported renderFrame results", async () => {
    await expect(
      normalizeRenderResult(
        { unsupported: true },
        { height: 720, width: 1280 },
        async () => {
          throw new Error("not used");
        },
      ),
    ).rejects.toThrow(
      "Effect renderFrame must return a bitmap, canvas, or SVG string.",
    );
  });
});
