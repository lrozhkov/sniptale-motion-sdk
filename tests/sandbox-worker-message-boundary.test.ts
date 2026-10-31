import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSandboxWorkerResponse } from "../src/apps/sandbox/runtime/worker-message-boundary";
import { SANDBOX_RENDER_PROFILE_FIELDS } from "../src/sdk/render-profile";

const renderProfile = Object.fromEntries(
  SANDBOX_RENDER_PROFILE_FIELDS.map((field) => [field, 1]),
);

describe("sandbox worker response boundary", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("accepts worker readiness and valid load results", () => {
    expect(parseSandboxWorkerResponse({ kind: "workerReady" })).toEqual({
      kind: "workerReady",
    });
    expect(
      parseSandboxWorkerResponse({
        kind: "directRenderStarted",
        previewCacheEnabled: true,
        requestId: "frame:1",
        sequenceId: 1,
      }),
    ).toEqual({
      kind: "directRenderStarted",
      previewCacheEnabled: true,
      requestId: "frame:1",
      sequenceId: 1,
    });
    expect(
      parseSandboxWorkerResponse({
        kind: "renderFrameProgress",
        phase: "queued",
        requestId: "frame:2",
        sequenceId: 2,
      }),
    ).toMatchObject({ phase: "queued", requestId: "frame:2" });
    expect(
      parseSandboxWorkerResponse({
        kind: "directRenderSettled",
        requestId: "frame:1",
      }),
    ).toEqual({ kind: "directRenderSettled", requestId: "frame:1" });
    expect(
      parseSandboxWorkerResponse({
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
      parseSandboxWorkerResponse({
        compositionIds: ["composition-a"],
        effectIds: [],
        kind: "loadEffectDocumentResult",
        moduleId: "module-a",
        ok: true,
        requestId: "load:1",
      }),
    ).toMatchObject({
      compositionIds: ["composition-a"],
      kind: "loadEffectDocumentResult",
      ok: true,
    });
  });

  it("rejects ordinary objects as transferable frame results", () => {
    expect(
      parseSandboxWorkerResponse({
        kind: "renderFrameResult",
        ok: true,
        bitmap: {},
        durationMs: 1,
        requestId: "frame:impostor",
        sequenceId: 1,
      }),
    ).toBeNull();
  });

  it("accepts transferable frame results and rejects malformed payloads", () => {
    expect(
      parseSandboxWorkerResponse({
        kind: "renderFrameProgress",
        phase: "unknown",
        requestId: "frame:invalid-progress",
        sequenceId: 0,
      }),
    ).toBeNull();
    expect(
      parseSandboxWorkerResponse({
        bitmap: createNativeBitmapFixture(),
        durationMs: 12.5,
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
      }),
    ).toMatchObject({ kind: "renderFrameResult", ok: true });
    expect(
      parseSandboxWorkerResponse({
        bitmap: createNativeBitmapFixture(),
        durationMs: 2,
        kind: "renderFrameResult",
        ok: true,
        renderProfile: { ...renderProfile, rendererMs: -1 },
        requestId: "frame:invalid-profile",
        sequenceId: 8,
      }),
    ).toBeNull();
    expect(
      parseSandboxWorkerResponse({
        bitmap: createNativeBitmapFixture(),
        durationMs: 2,
        kind: "renderFrameResult",
        ok: true,
        previewCacheEntries: Number.NaN,
        requestId: "frame:invalid-cache",
        sequenceId: 9,
      }),
    ).toBeNull();
    expect(
      parseSandboxWorkerResponse({
        bitmap: createNativeBitmapFixture(),
        durationMs: 2,
        kind: "renderFrameResult",
        ok: true,
        previewCacheStorage: "webp",
        requestId: "frame:invalid-cache-storage",
        sequenceId: 10,
      }),
    ).toBeNull();
    expect(
      parseSandboxWorkerResponse({
        durationMs: 8,
        kind: "renderFrameResult",
        ok: true,
        presented: true,
        presentedAtEpochMs: 1_700_000_000_042,
        presentedAtMs: 42,
        previewHeight: 90,
        previewWidth: 160,
        requestId: "frame:presented",
        sequenceId: 2,
      }),
    ).toMatchObject({
      kind: "renderFrameResult",
      presented: true,
      presentedAtEpochMs: 1_700_000_000_042,
      presentedAtMs: 42,
      previewWidth: 160,
    });
    expect(
      parseSandboxWorkerResponse({
        durationMs: 8,
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
      parseSandboxWorkerResponse({
        durationMs: 8,
        kind: "renderFrameResult",
        ok: true,
        presented: true,
        presentedAtEpochMs: -1,
        presentedAtMs: 42,
        previewHeight: 90,
        previewWidth: 160,
        requestId: "frame:invalid-clock",
        sequenceId: 4,
      }),
    ).toBeNull();
    expect(
      parseSandboxWorkerResponse({
        durationMs: Number.NaN,
        kind: "renderFrameResult",
        ok: true,
        requestId: "frame:2",
        sequenceId: 2,
      }),
    ).toBeNull();
    expect(
      parseSandboxWorkerResponse({
        effectIds: "effect-a",
        kind: "loadEffectDocumentResult",
        moduleId: "module-a",
        ok: true,
        requestId: "load:2",
      }),
    ).toBeNull();
  });
});
