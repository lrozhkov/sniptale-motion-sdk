import type { EditorTemplate } from "../templates/model.js";

import type { TimelineAudioClip } from "../timeline/model/audio-clips.js";
export type TimelinePreviewAudioClip = TimelineAudioClip;
export type ActivePreviewAudio = {
  audio: HTMLAudioElement;
  url: string | null;
};
export type PreviewAudioState = {
  active: Map<string, ActivePreviewAudio>;
  clipDuration: number | null;
  clips: TimelinePreviewAudioClip[] | null;
  clipTemplate: EditorTemplate | null;
};
export function createPreviewAudioState(): { previewAudio: PreviewAudioState } {
  return {
    previewAudio: {
      active: new Map(),
      clipDuration: null,
      clips: null,
      clipTemplate: null,
    },
  };
}
