export type PlaybackRunMode = "cache" | "live";
export type PlaybackRunPhase =
  | "idle"
  | "starting"
  | "live"
  | "preparing-frame-cache"
  | "preparing-video-cache"
  | "cached-frame-playback"
  | "cached-video-playback"
  | "paused-preparation"
  | "recovering";

import type { TimelinePlaybackRange } from "../timeline/viewport.js";

export type PlaybackRunState = {
  generation: number;
  mode: PlaybackRunMode;
  phase: PlaybackRunPhase;
  templateId: string | null;
};

export type ViewerPlaybackState = {
  playbackRange: TimelinePlaybackRange | null;
  playbackRangeDraft: TimelinePlaybackRange | null;
  playbackRun: PlaybackRunState;
  playbackBindingLayerId: string | null;
  lastDirectPresentationAtMs: number | null;
  lastDirectPresentationLocalAtMs: number | null;
  directPresentationIntervalsMs: number[];
  directLiveProfileSamples: Map<string, number>;
};

export function createViewerPlaybackState(): ViewerPlaybackState {
  return {
    playbackRange: null,
    playbackRangeDraft: null,
    playbackRun: {
      generation: 0,
      mode: "live",
      phase: "idle",
      templateId: null,
    },
    playbackBindingLayerId: null,
    lastDirectPresentationAtMs: null,
    lastDirectPresentationLocalAtMs: null,
    directPresentationIntervalsMs: [],
    directLiveProfileSamples: new Map(),
  };
}
