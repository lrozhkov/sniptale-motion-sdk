import { requiredEntry } from "./helpers/required-entry.js";
import type { AudioAssetsContext } from "../src/apps/viewer/timeline/model/audio-clips.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canEncodeAudio: vi.fn<typeof import("mediabunny").canEncodeAudio>(),
  canEncodeVideo: vi.fn<typeof import("mediabunny").canEncodeVideo>(),
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

    installAudioFixtures();
    const options = await getSupportedMp4AudioOptions(
      new AudioBuffer({ numberOfChannels: 2, length: 1, sampleRate: 48000 }),
    );

    expect(options.map((option) => option.value)).toEqual(["aac"]);
  });
});

describe("video-export audio fitting", () => {
  it.each([
    { duration: 1, frames: 2, expected: [1, 2] },
    { duration: 3, frames: 6, expected: [1, 2, 3, 4, 0, 0] },
  ])(
    "fits decoded audio to $frames frames",
    ({ duration, frames, expected }) => {
      installAudioFixtures();
      const context = new AudioContext();
      const createBuffer = vi.spyOn(context, "createBuffer");
      const source = new AudioBuffer({
        numberOfChannels: 1,
        length: 4,
        sampleRate: 2,
      });
      source.getChannelData(0).set([1, 2, 3, 4]);
      const output = fitDecodedAudioBufferForExport(context, source, duration);
      expect(createBuffer).toHaveBeenCalledWith(1, frames, 2);
      expect(Array.from(output.getChannelData(0))).toEqual(expected);
    },
  );
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
    } satisfies AudioAssetsContext;

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
    const coercion = vi.fn<() => never>(() => {
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

function installAudioFixtures(): void {
  class FixtureAudioBuffer {
    readonly numberOfChannels: number;
    readonly length: number;
    readonly sampleRate: number;
    readonly channels: Float32Array[];
    constructor(options: AudioBufferOptions) {
      this.numberOfChannels = options.numberOfChannels ?? 1;
      this.length = options.length;
      this.sampleRate = options.sampleRate;
      this.channels = Array.from(
        { length: this.numberOfChannels },
        () => new Float32Array(this.length),
      );
    }
    getChannelData(channel: number): Float32Array {
      return requiredEntry(this.channels, channel);
    }
  }
  class FixtureAudioContext {
    createBuffer(
      numberOfChannels: number,
      length: number,
      sampleRate: number,
    ): AudioBuffer {
      return new AudioBuffer({ numberOfChannels, length, sampleRate });
    }
  }
  vi.stubGlobal("AudioBuffer", FixtureAudioBuffer);
  vi.stubGlobal("AudioContext", FixtureAudioContext);
}
