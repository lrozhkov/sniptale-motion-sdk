import type { AudioCodec, VideoCodec } from "mediabunny";
import type { Mp4CodecOption } from "./capabilities.js";

export type Mp4ExportState = {
  audioBuffer: AudioBuffer | null;
  audioOptions: Mp4CodecOption<AudioCodec>[];
  cancelRequested: boolean;
  customHeight: number;
  customWidth: number;
  dialogOpen: boolean;
  fps: number;
  inFlight: boolean;
  sizePreset: string;
  status: string;
  videoOptions: Mp4CodecOption<VideoCodec>[];
  videoStatusToken: number;
};

export function createVideoExportState(): { mp4Export: Mp4ExportState } {
  return {
    mp4Export: {
      audioBuffer: null,
      audioOptions: [],
      cancelRequested: false,
      customHeight: 720,
      customWidth: 1280,
      dialogOpen: false,
      fps: 30,
      inFlight: false,
      sizePreset: "1280x720",
      status: "",
      videoOptions: [],
      videoStatusToken: 0,
    },
  };
}
