import { requiredEntry } from "./helpers/required-entry.js";
import type { RetainedPreviewFrame } from "../src/apps/sandbox/runtime/preview-frame-codec.js";
import { describe, expect, it, vi } from "vitest";

import {
  applyPreviewFrameCacheSample,
  resolvePreviewFrameCacheRequest,
} from "../src/apps/sandbox/runtime/preview-frame-cache-key";
import { createPreviewFrameCache } from "../src/apps/sandbox/runtime/preview-frame-cache";

function createMessage(overrides: Record<string, unknown> = {}) {
  return {
    controls: { density: 4, theme: "blue" },
    directPresentation: true,
    duration: 1,
    effectId: "heavy-effect",
    fps: 30,
    frameIndex: 12,
    height: 10,
    outputHeight: 20,
    outputWidth: 20,
    previewCacheEnabled: true,
    previewCacheWarm: true,
    renderAssetsId: "assets-1",
    renderModelId: "model-1",
    renderQuality: "reduced",
    target: { kind: "screen" },
    width: 10,
    ...overrides,
  };
}

function createBitmap(width = 10, height = 10) {
  return { close: vi.fn(), height, width };
}

function createCache(maxBytes = 800) {
  const clones: ReturnType<typeof createBitmap>[] = [];
  const retentionOptions: unknown[] = [];
  const retainFrame = vi.fn(
    async (bitmap: { height: number; width: number }, options: unknown) => {
      retentionOptions.push(options);
      const retained = createBitmap(bitmap.width, bitmap.height);
      clones.push(retained);
      return {
        bytes: bitmap.width * bitmap.height * 4,
        height: bitmap.height,
        rawBytes: bitmap.width * bitmap.height * 4,
        release: retained.close,
        restore: async () => {
          const restored = createBitmap(bitmap.width, bitmap.height);
          clones.push(restored);
          return restored;
        },
        storage: "bitmap" as const,
        width: bitmap.width,
      };
    },
  );
  return {
    cache: createPreviewFrameCache(maxBytes, retainFrame),
    clones,
    retentionOptions,
  };
}

describe("sandbox preview frame cache", () => {
  it("does not retain live-mode frames", () => {
    expect(
      resolvePreviewFrameCacheRequest(
        createMessage({ previewCacheEnabled: false }),
      ),
    ).toBeNull();
    expect(
      resolvePreviewFrameCacheRequest(
        createMessage({ previewCacheEnabled: undefined }),
      ),
    ).toBeNull();
    expect(
      resolvePreviewFrameCacheRequest(
        createMessage({ previewCacheWarm: false }),
      ),
    ).toBeNull();
  });

  it("reuses a completed frame and reports bounded memory", async () => {
    const { cache, clones, retentionOptions } = createCache();
    const request = cache.prepare(createMessage())!;
    const bitmap = createBitmap();

    expect(await cache.get(request)).toBeNull();
    expect(await cache.store(request, bitmap, undefined)).toBe(true);
    expect(await cache.get(request)).toEqual({
      bindingReads: undefined,
      bitmap: clones[1],
    });
    expect(clones[0]).not.toBe(bitmap);
    expect(retentionOptions).toEqual([{ preferReusableBitmap: false }]);
    expect(cache.getStats()).toMatchObject({
      bytes: 400,
      entries: 1,
      hits: 1,
      misses: 1,
      rawBytes: 400,
      storage: "bitmap",
    });
  });

  it("prefers reusable bitmaps when the complete sequence fits the byte budget", async () => {
    const { cache, retentionOptions } = createCache(13_000);
    const request = cache.prepare(
      createMessage({ duration: 1, fps: 30, frameIndex: 0 }),
    )!;

    await cache.store(request, createBitmap(), undefined);

    expect(retentionOptions).toEqual([{ preferReusableBitmap: true }]);
  });

  it("stores compressed frames when the presentation surface consumes bitmaps", async () => {
    const { cache, retentionOptions } = createCache(13_000);
    const request = cache.prepare(
      createMessage({ duration: 1, fps: 30, frameIndex: 0 }),
    )!;

    await cache.store(request, createBitmap(), undefined, {
      allowReusableBitmap: false,
    });

    expect(retentionOptions).toEqual([{ preferReusableBitmap: false }]);
  });

  it("borrows a reusable cached bitmap without restoring another copy", async () => {
    const bitmap = createBitmap();
    const restore = vi.fn(async () => createBitmap());
    const retainFrame = vi.fn(async () => ({
      borrow: () => bitmap,
      bytes: 400,
      height: 10,
      rawBytes: 400,
      release: vi.fn(),
      restore,
      storage: "bitmap" as const,
      width: 10,
    }));
    const cache = createPreviewFrameCache(13_000, retainFrame);
    const request = cache.prepare(createMessage({ frameIndex: 0 }))!;
    await cache.store(request, bitmap, undefined);

    expect(await cache.get(request)).toEqual({
      bindingReads: undefined,
      bitmap,
      reusable: true,
    });
    expect(restore).not.toHaveBeenCalled();

    const copied = await cache.get(request, { allowBorrow: false });
    expect(copied).not.toHaveProperty("reusable");
    expect(restore).toHaveBeenCalledOnce();
  });

  it("invalidates every frame when render inputs change", async () => {
    const { cache, clones } = createCache();
    const first = cache.prepare(createMessage())!;
    await cache.store(first, createBitmap(), undefined);

    const changed = cache.prepare(
      createMessage({ controls: { density: 8, theme: "blue" } }),
    )!;

    expect(requiredEntry(clones, 0).close).toHaveBeenCalledOnce();
    expect(await cache.get(changed)).toBeNull();
    expect(cache.getStats()).toMatchObject({ bytes: 0, entries: 0 });
  });

  it("keeps alternate preview scales until content changes", async () => {
    const { cache, clones } = createCache();
    const fullScale = cache.prepare(createMessage())!;
    await cache.store(fullScale, createBitmap(), undefined);
    const halfScale = cache.prepare(createMessage({ height: 5, width: 5 }))!;
    await cache.store(halfScale, createBitmap(5, 5), undefined);

    expect(await cache.get(cache.prepare(createMessage())!)).not.toBeNull();
    expect(cache.getStats()).toMatchObject({ bytes: 500, entries: 2 });
    expect(requiredEntry(clones, 0).close).not.toHaveBeenCalled();
  });

  it("never substitutes an adjacent visual frame during replay", async () => {
    const { cache } = createCache();
    const first = cache.prepare(createMessage({ frameIndex: 0 }))!;
    await cache.store(first, createBitmap(), undefined);

    expect(
      await cache.get(cache.prepare(createMessage({ frameIndex: 1 }))!),
    ).toBeNull();
    cache.prepare(createMessage({ frameIndex: 12 }));
    expect(
      await cache.get(cache.prepare(createMessage({ frameIndex: 1 }))!),
    ).toBeNull();
  });

  it("assigns one canonical sample time to each key and preserves the terminal frame", () => {
    const arbitraryMessage = createMessage({
      frameIndex: 12,
      progress: 0.417,
      time: 0.417,
    });
    const arbitraryTime = resolvePreviewFrameCacheRequest(arbitraryMessage)!;
    const beforeEnd = resolvePreviewFrameCacheRequest(
      createMessage({ frameIndex: 29, time: 29 / 30 }),
    )!;
    const atEnd = resolvePreviewFrameCacheRequest(
      createMessage({ frameIndex: 30, time: 1 }),
    )!;

    expect(arbitraryTime).toMatchObject({
      frameIndex: 12,
      sampleTime: 0.4,
      totalFrames: 31,
    });
    expect(atEnd).toMatchObject({
      frameIndex: 30,
      sampleTime: 1,
      totalFrames: 31,
    });
    expect(atEnd.key).not.toBe(beforeEnd.key);

    applyPreviewFrameCacheSample(arbitraryMessage, arbitraryTime);
    expect(arbitraryMessage).toMatchObject({
      frameIndex: 12,
      progress: 0.4,
      time: 0.4,
    });
  });

  it("primes upcoming exact frames before sequential replay reaches them", async () => {
    const primes = new Map<number, ReturnType<typeof vi.fn>>();
    const retainFrame = vi.fn(async (bitmap: any) => {
      const prime = vi.fn();
      primes.set(bitmap.frame, prime);
      return {
        bytes: 20,
        height: bitmap.height,
        prime,
        rawBytes: bitmap.width * bitmap.height * 4,
        release: vi.fn(),
        restore: async () => createBitmap(bitmap.width, bitmap.height),
        storage: "png" as const,
        width: bitmap.width,
      };
    });
    const cache = createPreviewFrameCache(200, retainFrame);
    for (const frameIndex of [0, 1, 2, 3, 4]) {
      const request = cache.prepare(
        createMessage({ duration: 1, frameIndex }),
      )!;
      const bitmap = Object.assign(createBitmap(), { frame: frameIndex });
      await cache.store(request, bitmap, undefined);
    }

    await cache.get(cache.prepare(createMessage({ frameIndex: 0 }))!);

    expect(primes.get(0)).not.toHaveBeenCalled();
    for (const frameIndex of [1, 2, 3, 4]) {
      expect(primes.get(frameIndex)).toHaveBeenCalledOnce();
    }
  });

  it("tracks complete compressed coverage by retained bytes", async () => {
    const retainFrame = vi.fn(
      async (bitmap: { height: number; width: number }) => ({
        bytes: 20,
        height: bitmap.height,
        rawBytes: bitmap.width * bitmap.height * 4,
        release: vi.fn(),
        restore: async () => createBitmap(bitmap.width, bitmap.height),
        storage: "png" as const,
        width: bitmap.width,
      }),
    );
    const cache = createPreviewFrameCache(80, retainFrame);
    let request = cache.prepare(
      createMessage({ duration: 0.1, frameIndex: 0 }),
    )!;
    await cache.store(request, createBitmap(), undefined);
    for (const frameIndex of [1, 2, 3]) {
      request = cache.prepare(createMessage({ duration: 0.1, frameIndex }))!;
      await cache.store(request, createBitmap(), undefined);
    }

    expect(cache.getStats(request)).toMatchObject({
      bytes: 80,
      complete: true,
      entries: 4,
      frames: 4,
      rawBytes: 1600,
      storage: "png",
      totalFrames: 4,
    });
  });

  it("marks a selected playback interval complete without requiring the full clip", async () => {
    const { cache } = createCache(2_000);
    const interval = { endFrame: 64, startFrame: 60 };
    const outsideRange = cache.prepare(
      createMessage({ duration: 10, frameIndex: 0 }),
    )!;
    await cache.store(outsideRange, createBitmap(), undefined);

    let request = cache.prepare(
      createMessage({
        duration: 10,
        frameIndex: interval.startFrame,
        previewCacheRange: interval,
      }),
    )!;
    for (
      let frameIndex = interval.startFrame;
      frameIndex < interval.endFrame;
      frameIndex += 1
    ) {
      request = cache.prepare(
        createMessage({
          duration: 10,
          frameIndex,
          previewCacheRange: interval,
        }),
      )!;
      await cache.store(request, createBitmap(), undefined);
    }

    expect(request).toMatchObject({
      rangeEndFrame: 64,
      rangeStartFrame: 60,
      totalFrames: 4,
    });
    expect(cache.getStats(request)).toMatchObject({
      complete: true,
      frames: 4,
      totalFrames: 4,
    });
  });

  it("rejects malformed playback cache ranges", () => {
    expect(
      resolvePreviewFrameCacheRequest(
        createMessage({
          previewCacheRange: { endFrame: 12, startFrame: 12 },
        }),
      ),
    ).toBeNull();
    expect(
      resolvePreviewFrameCacheRequest(
        createMessage({ previewCacheRange: "12-20" }),
      ),
    ).toBeNull();
  });

  it("evicts the least recently used frame inside its byte budget", async () => {
    const { cache, clones } = createCache();
    const firstRequest = cache.prepare(createMessage({ frameIndex: 1 }))!;
    await cache.store(firstRequest, createBitmap(), undefined);
    const secondRequest = cache.prepare(createMessage({ frameIndex: 2 }))!;
    await cache.store(secondRequest, createBitmap(), undefined);
    await cache.get(firstRequest);
    const thirdRequest = cache.prepare(createMessage({ frameIndex: 3 }))!;
    await cache.store(thirdRequest, createBitmap(), undefined);

    expect(await cache.get(secondRequest)).toBeNull();
    expect(requiredEntry(clones, 0).close).not.toHaveBeenCalled();
    expect(requiredEntry(clones, 1).close).toHaveBeenCalledOnce();
    expect(cache.getStats()).toMatchObject({ bytes: 800, entries: 2 });
  });

  it("requires matching selection reads without duplicating the visual", async () => {
    const { cache, clones } = createCache();
    const visualRequest = cache.prepare(createMessage())!;
    await cache.store(visualRequest, createBitmap(), undefined);
    const selectionRequest = cache.prepare(
      createMessage({ bindingLayerId: "logo" }),
    )!;

    expect(await cache.get(selectionRequest)).toBeNull();
    expect(
      await cache.store(selectionRequest, createBitmap(), {
        primitiveBounds: [],
      }),
    ).toBe(false);
    expect(await cache.get(selectionRequest)).toEqual({
      bindingReads: { primitiveBounds: [] },
      bitmap: clones[1],
    });
    expect(cache.getStats().entries).toBe(1);
  });

  it("reuses the nearest sampled selection geometry for a cached frame", async () => {
    const { cache } = createCache(1_200);
    const selectedFrame = cache.prepare(
      createMessage({ bindingLayerId: "logo", frameIndex: 10 }),
    )!;
    await cache.store(selectedFrame, createBitmap(), {
      primitiveBounds: [{ layerId: "logo", x: 20 }],
    });
    const adjacentVisual = cache.prepare(createMessage({ frameIndex: 12 }))!;
    await cache.store(adjacentVisual, createBitmap(), undefined);
    const adjacentSelection = cache.prepare(
      createMessage({ bindingLayerId: "logo", frameIndex: 12 }),
    )!;

    expect(await cache.get(adjacentSelection)).toMatchObject({
      bindingReads: {
        primitiveBounds: [{ layerId: "logo", x: 20 }],
      },
    });
    expect(cache.getStats()).toMatchObject({ hits: 1, misses: 0 });

    const distantVisual = cache.prepare(createMessage({ frameIndex: 30 }))!;
    await cache.store(distantVisual, createBitmap(), undefined);
    const distantSelection = cache.prepare(
      createMessage({ bindingLayerId: "logo", frameIndex: 30 }),
    )!;
    expect(await cache.get(distantSelection)).toBeNull();
  });

  it("does not cache transient or unsafe frame inputs", () => {
    expect(
      resolvePreviewFrameCacheRequest(
        createMessage({ inputFrames: { previous: {} } }),
      ),
    ).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      resolvePreviewFrameCacheRequest(createMessage({ controls: cyclic })),
    ).toBeNull();
  });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Deferred promise is not ready.");
  };
  let reject: (reason: unknown) => void = () => {
    throw new Error("Deferred promise is not ready.");
  };
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function retainedFrame(
  restore = async () => createBitmap(),
): RetainedPreviewFrame {
  return {
    bytes: 400,
    height: 10,
    width: 10,
    rawBytes: 400,
    release: vi.fn(),
    restore,
    storage: "bitmap",
  };
}

it.each(["clear", "close"] as const)(
  "discards encoding that finishes after cache %s",
  async (action) => {
    const encoded = deferred<RetainedPreviewFrame>();
    const cache = createPreviewFrameCache(800, () => encoded.promise);
    const request = cache.prepare(createMessage());
    if (!request) throw new Error("Expected cache request.");
    const stored = cache.store(request, createBitmap(), undefined);
    cache[action]();
    const frame = retainedFrame();
    encoded.resolve(frame);
    expect(await stored).toBe(false);
    expect(frame.release).toHaveBeenCalledOnce();
    expect(cache.getStats()).toMatchObject({ entries: 0, bytes: 0 });
  },
);

it("discards decoded bitmaps after their cache entry is invalidated", async () => {
  const decoded = deferred<ReturnType<typeof createBitmap>>();
  const frame = retainedFrame(() => decoded.promise);
  const cache = createPreviewFrameCache(800, async () => frame);
  const request = cache.prepare(createMessage());
  if (!request) throw new Error("Expected cache request.");
  await cache.store(request, createBitmap(), undefined);
  const restored = cache.get(request, { allowBorrow: false });
  cache.clear();
  const bitmap = createBitmap();
  decoded.resolve(bitmap);
  expect(await restored).toBeNull();
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(cache.getStats()).toMatchObject({ entries: 0, bytes: 0 });
});

it("releases a concurrent duplicate instead of replacing and double-counting it", async () => {
  const first = deferred<RetainedPreviewFrame>();
  const second = deferred<RetainedPreviewFrame>();
  const pending = [first, second];
  const cache = createPreviewFrameCache(800, () => {
    const operation = pending.shift();
    if (!operation) throw new Error("Unexpected encoder request.");
    return operation.promise;
  });
  const request = cache.prepare(createMessage());
  if (!request) throw new Error("Expected cache request.");
  const one = cache.store(request, createBitmap(), undefined);
  const two = cache.store(request, createBitmap(), undefined);
  const firstFrame = retainedFrame();
  const secondFrame = retainedFrame();
  first.resolve(firstFrame);
  expect(await one).toBe(true);
  second.resolve(secondFrame);
  expect(await two).toBe(false);
  expect(secondFrame.release).toHaveBeenCalledOnce();
  expect(firstFrame.release).not.toHaveBeenCalled();
  expect(cache.getStats()).toMatchObject({
    entries: 1,
    bytes: 400,
    rawBytes: 400,
  });
});

it.each([
  "duration",
  "fps",
  "frameIndex",
  "width",
  "height",
  "effectId",
  "renderQuality",
])("rejects unknown cache %s without coercion", (key) => {
  const convert = vi.fn(() => 1);
  expect(
    resolvePreviewFrameCacheRequest(
      createMessage({ [key]: { valueOf: convert, toString: convert } }),
    ),
  ).toBeNull();
  expect(convert).not.toHaveBeenCalled();
});

it("keeps a replacement entry when an invalidated decoder fails", async () => {
  const decoded = deferred<ReturnType<typeof createBitmap>>();
  const first = retainedFrame(() => decoded.promise);
  const second = retainedFrame();
  let retained = 0;
  const cache = createPreviewFrameCache(800, async () =>
    retained++ === 0 ? first : second,
  );
  const oldRequest = cache.prepare(createMessage());
  if (!oldRequest) throw new Error("Expected cache request.");
  await cache.store(oldRequest, createBitmap(), undefined);
  const result = cache.get(oldRequest, { allowBorrow: false });
  cache.clear();
  const current = cache.prepare(createMessage());
  if (!current) throw new Error("Expected cache request.");
  await cache.store(current, createBitmap(), undefined);
  decoded.reject(new Error("decoder failed"));
  expect(await result).toBeNull();
  expect(cache.getStats()).toMatchObject({
    entries: 1,
    bytes: 400,
    rawBytes: 400,
  });
  expect(first.release).toHaveBeenCalledOnce();
  expect(second.release).not.toHaveBeenCalled();
});
