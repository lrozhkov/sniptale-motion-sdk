declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function createMp4ExportAudioContext(): AudioContext {
  const Constructor = window.AudioContext ?? window.webkitAudioContext;
  if (!Constructor) {
    throw new Error("AudioContext unavailable.");
  }
  return new Constructor();
}

export function fitDecodedAudioBufferForExport(
  context: BaseAudioContext,
  source: AudioBuffer,
  duration: number,
): AudioBuffer {
  const channels = Math.max(1, Math.min(2, source.numberOfChannels || 1));
  const sampleRate = source.sampleRate;
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const output = context.createBuffer(channels, frameCount, sampleRate);
  const copyFrames = Math.min(source.length, frameCount);
  for (let channel = 0; channel < channels; channel += 1) {
    const sourceChannel = Math.min(channel, source.numberOfChannels - 1);
    output
      .getChannelData(channel)
      .set(source.getChannelData(sourceChannel).subarray(0, copyFrames), 0);
  }
  return output;
}

export async function decodeMp4ExportAudioBlob(
  blob: Blob,
  duration: number,
): Promise<AudioBuffer> {
  const context = createMp4ExportAudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return fitDecodedAudioBufferForExport(context, decoded, duration);
  } finally {
    await context.close?.();
  }
}
