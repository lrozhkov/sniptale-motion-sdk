import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canEncodeAudio: vi.fn(),
  canEncodeVideo: vi.fn(),
}));

vi.mock("mediabunny", () => ({
  canEncodeAudio: mocks.canEncodeAudio,
  canEncodeVideo: mocks.canEncodeVideo,
}));

import { fitDecodedAudioBufferForExport } from "../src/apps/viewer/video-export/audio";
import {
  getSupportedMp4AudioOptions,
  getSupportedMp4VideoOptions,
} from "../src/apps/viewer/video-export/capabilities";
import {
  createFrameTiming,
  estimateVideoBitrate,
  normalizeExportFps,
  normalizeExportSize,
  shouldEncodeExportKeyFrame,
} from "../src/apps/viewer/video-export/options";
import { collectTimelineMp4AudioClips } from "../src/apps/viewer/video-export/timeline-audio";

describe("video-export options", () => {
  it("normalizes export size, even dimensions, fps, and frame timing", () => {
    expect(normalizeExportFps(120)).toBe(60);
    expect(
      normalizeExportSize({
        height: 721,
        sizePreset: "custom",
        width: 1281,
      }),
    ).toEqual({ height: 720, width: 1280 });
    expect(
      normalizeExportSize({
        height: 4320,
        sizePreset: "custom",
        width: 7680,
      }),
    ).toEqual({ height: 2160, width: 3840 });
    expect(createFrameTiming(1.1, 10)).toMatchObject({
      frameDuration: 0.1,
      fps: 10,
      totalFrames: 11,
    });
    expect(
      estimateVideoBitrate({
        codec: "avc",
        fps: 30,
        height: 720,
        width: 1280,
      }),
    ).toBe(4_000_000);
    expect(
      estimateVideoBitrate({
        codec: "avc",
        fps: 30,
        height: 1080,
        width: 1920,
      }),
    ).toBe(8_709_120);
    expect(
      estimateVideoBitrate({
        codec: "vp9",
        fps: 30,
        height: 720,
        width: 1280,
      }),
    ).toBe(2_211_840);
    expect(
      Array.from({ length: 90 }, (_, frameIndex) =>
        shouldEncodeExportKeyFrame({ codec: "avc", fps: 30, frameIndex }),
      ).every(Boolean),
    ).toBe(true);
    expect(
      [0, 1, 59, 60, 61].map((frameIndex) =>
        shouldEncodeExportKeyFrame({ codec: "vp9", fps: 30, frameIndex }),
      ),
    ).toEqual([true, false, false, true, false]);
  });
});

describe("video-export capabilities", () => {
  beforeEach(() => {
    mocks.canEncodeVideo.mockReset();
    mocks.canEncodeAudio.mockReset();
  });

  it("returns supported-only video codecs", async () => {
    mocks.canEncodeVideo.mockImplementation(async (codec) => codec === "avc");

    const options = await getSupportedMp4VideoOptions({
      fps: 30,
      height: 720,
      width: 1280,
    });

    expect(options.map((option) => option.value)).toEqual(["avc"]);
    expect(mocks.canEncodeVideo).toHaveBeenCalledWith(
      "avc",
      expect.objectContaining({
        bitrate: 4_000_000,
      }),
    );
  });

  it("returns supported-only audio codecs", async () => {
    mocks.canEncodeAudio.mockImplementation(async (codec) => codec === "aac");

    const options = await getSupportedMp4AudioOptions({
      numberOfChannels: 2,
      sampleRate: 48000,
    } as AudioBuffer);

    expect(options.map((option) => option.value)).toEqual(["aac"]);
  });
});

describe("video-export audio fitting", () => {
  it("trims and pads decoded audio to export duration", () => {
    const channels = [new Float32Array([1, 2, 3, 4])];
    const outputChannels = [new Float32Array(2), new Float32Array(2)];
    const context = {
      createBuffer: vi.fn((_channels, _frames, _sampleRate) => ({
        getChannelData: (channel) => outputChannels[channel],
        length: _frames,
        numberOfChannels: _channels,
        sampleRate: _sampleRate,
      })),
    } as any;
    const source = {
      getChannelData: (channel) => channels[channel],
      length: 4,
      numberOfChannels: 1,
      sampleRate: 2,
    } as AudioBuffer;

    fitDecodedAudioBufferForExport(context, source, 1);

    expect(context.createBuffer).toHaveBeenCalledWith(1, 2, 2);
    expect(Array.from(outputChannels[0])).toEqual([1, 2]);
  });
});

describe("video-export timeline audio", () => {
  it("collects supported audio clips from timeline layers", () => {
    const asset = {
      blob: new Blob(["audio"], { type: "audio/wav" }),
      id: "voice",
      kind: "audio",
      mimeType: "audio/wav",
    };
    const ctx = {
      state: {
        assets: new Map([["voice", asset]]),
      },
    } as any;

    const clips = collectTimelineMp4AudioClips(
      ctx,
      {
        clips: [
          {
            duration: 5,
            layerId: "voice-layer",
            offset: 1,
            start: 2,
          },
        ],
        layers: [
          {
            assetId: "voice",
            id: "voice-layer",
            type: "audio",
            volume: 0.5,
          },
        ],
      },
      6,
    );

    expect(clips).toEqual([
      {
        asset,
        duration: 4,
        offset: 1,
        start: 2,
        volume: 0.5,
      },
    ]);
  });
});

describe("video-export option boundaries", () => {
  it("uses finite defaults and does not coerce objects", () => {
    const coercion = vi.fn(() => {
      throw new Error("must not coerce");
    });
    expect(
      normalizeExportSize({
        width: { valueOf: coercion },
        height: Infinity,
        sizePreset: "custom",
      }),
    ).toEqual({ width: 1280, height: 720 });
    expect(normalizeExportFps({ valueOf: coercion })).toBe(1);
    expect(createFrameTiming(Infinity, 30)).toMatchObject({
      totalFrames: 1,
      fps: 30,
    });
    expect(coercion).not.toHaveBeenCalled();
  });
});
