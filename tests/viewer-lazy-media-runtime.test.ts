import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mediaRuntime = vi.hoisted(() => ({ loads: 0 }));

vi.mock("mediabunny", () => {
  mediaRuntime.loads += 1;
  return {
    canEncodeAudio: vi.fn<() => Promise<boolean>>(async () => false),
    canEncodeVideo: vi.fn<() => Promise<boolean>>(async () => false),
  };
});

import { installVideoExportControllerOwner } from "../src/apps/viewer/video-export/controller";

describe("viewer lazy media runtime", () => {
  it("installs export UI owners without loading codecs or media containers", async () => {
    const ctx = createViewerContextFixture();

    installVideoExportControllerOwner(ctx);

    expect(typeof ctx.openMp4ExportDialog).toBe("function");
    expect(mediaRuntime.loads).toBe(0);

    const capabilities =
      await import("../src/apps/viewer/video-export/capabilities");
    expect(mediaRuntime.loads).toBe(1);
    await expect(
      capabilities.getSupportedMp4VideoOptions({
        fps: 30,
        height: 720,
        width: 1280,
      }),
    ).resolves.toEqual([]);
  });
});
