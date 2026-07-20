import { describe, expect, it, vi } from "vitest";

const mediaRuntime = vi.hoisted(() => ({ loads: 0 }));

vi.mock("mediabunny", () => {
  mediaRuntime.loads += 1;
  return {
    canEncodeAudio: vi.fn(async () => false),
    canEncodeVideo: vi.fn(async () => false),
  };
});

import { installVideoExportControllerOwner } from "../src/apps/viewer/video-export/controller";

describe("viewer lazy media runtime", () => {
  it("installs export UI owners without loading codecs or media containers", async () => {
    const ctx = {} as any;

    installVideoExportControllerOwner(ctx);

    expect(ctx.openMp4ExportDialog).toBeTypeOf("function");
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
