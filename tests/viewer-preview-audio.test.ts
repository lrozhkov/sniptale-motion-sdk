import { createViewerState } from "../src/apps/viewer/app/state.js";
import { readEditorTemplate } from "../src/apps/viewer/templates/source.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectTimelinePreviewAudioClips,
  stopPreviewAudio,
  syncPreviewAudio,
} from "../src/apps/viewer/playback/preview-audio";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer preview audio", () => {
  it("does not coerce malformed audio metadata", () => {
    const coercion = vi.fn<() => number>(() => 1);
    const ctx = {
      state: {
        assets: new Map<string, unknown>([
          ["sound", { id: "sound", kind: "audio" }],
        ]),
      },
    };
    const clips = collectTimelinePreviewAudioClips(
      ctx,
      {
        layers: [
          null,
          {
            id: "audio",
            type: "audio",
            assetId: "sound",
            volume: { valueOf: coercion },
          },
        ],
        clips: [
          null,
          {
            layerId: "audio",
            start: { valueOf: coercion },
            offset: { toString: coercion },
            duration: 1,
          },
        ],
      },
      1,
    );
    expect(clips).toMatchObject([
      { key: "audio:sound:0:0", offset: 0, start: 0, volume: 1 },
    ]);
    expect(coercion).not.toHaveBeenCalled();
  });

  it("retains the newer audio element when an obsolete play rejects", async () => {
    let rejectOld!: (error: Error) => void;
    const oldPlayback = new Promise<void>((_resolve, reject) => {
      rejectOld = reject;
    });
    const play = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(oldPlayback)
      .mockResolvedValue(undefined);
    class TestAudio {
      currentTime = 0;
      paused = true;
      preload = "";
      volume = 1;
      constructor(readonly source: string) {}
      play() {
        return play();
      }
      pause() {}
      removeAttribute(_name: string) {}
      load() {}
    }
    vi.stubGlobal("Audio", TestAudio);
    let serial = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:audio-${++serial}`,
    );
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const state = createViewerState();
    const template = readEditorTemplate(
      {
        id: "audio-source",
        duration: 1,
        layers: [{ id: "soundscape", type: "audio", assetId: "sound" }],
        clips: [{ layerId: "soundscape", duration: 1, start: 0 }],
        scenes: [],
      },
      readEditorTimeline({ phases: [], tracks: [] }, 1),
    );
    state.currentTemplate = template;
    state.assets.set("sound", {
      id: "sound",
      kind: "audio",
      blob: new Blob(["sound"], { type: "audio/ogg" }),
    });
    state.playing = true;
    const ctx = {
      state,
      getRenderTemplateSnapshot: () => template,
      getEffectiveDuration: () => 1,
    };
    syncPreviewAudio(ctx, 0);
    stopPreviewAudio(ctx);
    syncPreviewAudio(ctx, 0);
    const current = [...state.previewAudio.active.values()][0];
    expect(current?.url).toBe("blob:audio-2");
    rejectOld(new Error("Obsolete autoplay rejection"));
    await Promise.resolve();
    expect([...state.previewAudio.active.values()]).toEqual([current]);
    expect(revoke).not.toHaveBeenCalledWith("blob:audio-2");
    stopPreviewAudio(ctx);
  });

  it("collects active audio timeline clips with layer volume", () => {
    const asset = {
      blob: new Blob(["sound"], { type: "audio/ogg" }),
      id: "sound",
      kind: "audio",
      mimeType: "audio/ogg",
    };
    const ctx = {
      state: {
        assets: new Map([["sound", asset]]),
      },
    };

    expect(
      collectTimelinePreviewAudioClips(
        ctx,
        {
          clips: [
            {
              duration: 4,
              layerId: "soundscape",
              offset: 0.5,
              start: 1,
              volume: 0.5,
            },
          ],
          layers: [
            {
              assetId: "sound",
              id: "soundscape",
              type: "audio",
              volume: 0.8,
            },
          ],
        },
        6,
      ),
    ).toEqual([
      {
        asset,
        duration: 4,
        key: "soundscape:sound:1:0.5",
        offset: 0.5,
        start: 1,
        volume: 0.4,
      },
    ]);
  });
});
