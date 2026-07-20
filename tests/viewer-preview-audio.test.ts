import { describe, expect, it } from "vitest";

import { collectTimelinePreviewAudioClips } from "../src/apps/viewer/playback/preview-audio";

describe("viewer preview audio", () => {
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
    } as any;

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
