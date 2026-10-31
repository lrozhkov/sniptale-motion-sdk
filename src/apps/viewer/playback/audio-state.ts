import type { EditorTemplate } from "../templates/model.js";

export type TimelinePreviewAudioClip = {
  asset: Record<string, unknown>;
  duration: number;
  key: string;
  offset: number;
  start: number;
  volume: number;
};
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
