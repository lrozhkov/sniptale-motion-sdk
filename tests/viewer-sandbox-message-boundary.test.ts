import { completeRender } from "../src/apps/viewer/transport/sandbox-client.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseViewerSandboxMessage,
  discardSandboxMessageBitmap,
} from "../src/apps/viewer/transport/message-boundary";
import { SANDBOX_RENDER_PROFILE_FIELDS } from "../src/sdk/render-profile";

const renderProfile = Object.fromEntries(
  SANDBOX_RENDER_PROFILE_FIELDS.map((field) => [field, 1]),
);

describe("viewer sandbox message boundary", () => {
  it("normalizes known runtime and module results", () => {
    expect(parseViewerSandboxMessage({ kind: "runtimeReady" })).toEqual({
      kind: "runtimeReady",
    });
    expect(
      parseViewerSandboxMessage({
        kind: "validateEffectDocumentResult",
        ok: true,
        requestId: "validate:1",
      }),
    ).toEqual({
      kind: "validateEffectDocumentResult",
      ok: true,
      requestId: "validate:1",
    });
    expect(
      parseViewerSandboxMessage({
        error: "invalid graph",
        kind: "validateEffectDocumentResult",
        ok: false,
        requestId: "validate:2",
      }),
    ).toEqual({
      error: "invalid graph",
      kind: "validateEffectDocumentResult",
      ok: false,
      requestId: "validate:2",
    });
    expect(
      parseViewerSandboxMessage({
        kind: "validateEffectDocumentResult",
        ok: "yes",
        requestId: "validate:invalid",
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        kind: "renderFrameProgress",
        phase: "preview-cache-store",
        requestId: "frame:1",
        sequenceId: 1,
      }),
    ).toEqual({
      kind: "renderFrameProgress",
      phase: "preview-cache-store",
      requestId: "frame:1",
      sequenceId: 1,
    });
    expect(
      parseViewerSandboxMessage({
        kind: "renderFrameProgress",
        phase: "rendering",
        requestId: "frame:2",
        sequenceId: 2,
      }),
    ).toMatchObject({ phase: "rendering", requestId: "frame:2" });
    expect(
      parseViewerSandboxMessage({
        errorCode: "BACKGROUND_RENDERER_STOPPED",
        executionMode: "worker",
        kind: "loadEffectDocumentResult",
        moduleId: "demo",
        ok: true,
        requestId: "load:1",
      }),
    ).toEqual({
      compositionIds: [],
      effectIds: [],
      errorCode: "BACKGROUND_RENDERER_STOPPED",
      executionMode: "worker",
      kind: "loadEffectDocumentResult",
      moduleId: "demo",
      ok: true,
      requestId: "load:1",
    });
    expect(
      parseViewerSandboxMessage({
        executionMode: "foreground",
        kind: "loadEffectDocumentResult",
        moduleId: "demo",
        ok: true,
        requestId: "load:invalid-mode",
      }),
    ).toBeNull();
  });

  it("rejects malformed module and render results", () => {
    expect(parseViewerSandboxMessage(null)).toBeNull();
    expect(parseViewerSandboxMessage({ kind: "unknown" })).toBeNull();
    expect(
      parseViewerSandboxMessage({
        kind: "renderFrameProgress",
        phase: "unknown",
        requestId: "frame:invalid-progress",
        sequenceId: 0,
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        effectIds: ["safe", 3],
        kind: "loadEffectDocumentResult",
        moduleId: "demo",
        ok: true,
        requestId: "load:1",
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        errorCode: 42,
        kind: "loadEffectDocumentResult",
        moduleId: "demo",
        ok: false,
        requestId: "load:2",
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        durationMs: 20,
        kind: "renderFrameResult",
        ok: true,
        requestId: "frame:1",
        sequenceId: 1,
      }),
    ).toBeNull();
  });

  it("preserves a valid render result payload", () => {
    class Bitmap {
      close() {}
    }
    vi.stubGlobal("ImageBitmap", Bitmap);
    const bitmap = new Bitmap();
    const result = parseViewerSandboxMessage({
      bindingReads: { tracks: ["title.x"] },
      bitmap,
      durationMs: 20,
      kind: "renderFrameResult",
      ok: true,
      previewCacheBytes: 4096,
      previewCacheComplete: true,
      previewCacheEntries: 4,
      previewCacheEvictions: 0,
      previewCacheFrames: 4,
      previewCacheHit: true,
      previewCacheRawBytes: 16384,
      previewCacheStorage: "png",
      previewCacheStoreMs: 4,
      previewCacheTotalFrames: 4,
      renderProfile,
      requestId: "frame:1",
      sequenceId: 1,
    });
    expect(result).toMatchObject({
      bitmap,
      durationMs: 20,
      kind: "renderFrameResult",
      ok: true,
      previewCacheHit: true,
      renderProfile,
      requestId: "frame:1",
      sequenceId: 1,
    });
    expect(
      parseViewerSandboxMessage({
        bitmap: {},
        durationMs: 2,
        kind: "renderFrameResult",
        ok: true,
        previewCacheBytes: -1,
        requestId: "frame:invalid-cache",
        sequenceId: 8,
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        bitmap: {},
        durationMs: 2,
        kind: "renderFrameResult",
        ok: true,
        renderProfile: { ...renderProfile, normalizeMs: Number.NaN },
        requestId: "frame:invalid-profile",
        sequenceId: 10,
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        bitmap: {},
        durationMs: 2,
        kind: "renderFrameResult",
        ok: true,
        previewCacheStorage: "webp",
        requestId: "frame:invalid-cache-storage",
        sequenceId: 9,
      }),
    ).toBeNull();
  });

  it("accepts current and previous direct-presentation clock payloads", () => {
    expect(
      parseViewerSandboxMessage({
        durationMs: 7,
        kind: "renderFrameResult",
        ok: true,
        presented: true,
        presentedAtEpochMs: 1_700_000_000_042,
        presentedAtMs: 42,
        previewHeight: 90,
        previewWidth: 160,
        requestId: "frame:direct",
        sequenceId: 2,
      }),
    ).toMatchObject({
      kind: "renderFrameResult",
      presented: true,
      presentedAtEpochMs: 1_700_000_000_042,
      presentedAtMs: 42,
      previewHeight: 90,
      previewWidth: 160,
    });
    expect(
      parseViewerSandboxMessage({
        durationMs: 7,
        kind: "renderFrameResult",
        ok: true,
        presented: true,
        presentedAtMs: 42,
        previewHeight: 90,
        previewWidth: 160,
        requestId: "frame:missing-clock",
        sequenceId: 3,
      }),
    ).toMatchObject({
      kind: "renderFrameResult",
      presented: true,
      presentedAtMs: 42,
      previewHeight: 90,
      previewWidth: 160,
    });
    expect(
      parseViewerSandboxMessage({
        durationMs: 7,
        kind: "renderFrameResult",
        ok: true,
        presented: true,
        presentedAtEpochMs: "invalid",
        presentedAtMs: 42,
        previewHeight: 90,
        previewWidth: 160,
        requestId: "frame:invalid-clock",
        sequenceId: 4,
      }),
    ).toBeNull();
    expect(
      parseViewerSandboxMessage({
        durationMs: 7,
        kind: "renderFrameResult",
        ok: true,
        presented: true,
        presentedAtEpochMs: 1_700_000_000_042,
        presentedAtMs: 42,
        previewHeight: 0,
        previewWidth: 160,
        requestId: "frame:invalid-size",
        sequenceId: 5,
      }),
    ).toBeNull();
  });
});

afterEach(() => vi.unstubAllGlobals());

it("releases only native bitmaps when a browser message is rejected", () => {
  class Bitmap {
    close = vi.fn<ImageBitmap["close"]>();
  }
  vi.stubGlobal("ImageBitmap", Bitmap);
  const bitmap = new Bitmap();
  discardSandboxMessageBitmap({ bitmap });
  expect(bitmap.close).toHaveBeenCalledOnce();
  const fake = { close: vi.fn<ImageBitmap["close"]>() };
  discardSandboxMessageBitmap({ bitmap: fake });
  expect(fake.close).not.toHaveBeenCalled();
});

it("releases a late native render bitmap when its request is no longer pending", () => {
  class Bitmap {
    close = vi.fn<ImageBitmap["close"]>();
  }
  vi.stubGlobal("ImageBitmap", Bitmap);
  const bitmap = new Bitmap();
  const state = { pending: new Map(), staleResponses: 0 };
  completeRender(state, { requestId: "expired", bitmap });
  expect(state.staleResponses).toBe(1);
  expect(bitmap.close).toHaveBeenCalledOnce();
});
