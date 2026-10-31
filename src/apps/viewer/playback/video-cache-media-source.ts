import type { ViewerAppContext } from "../app/context.js";

const MEDIA_SOURCE_MIME_TYPES = {
  avc: 'video/mp4; codecs="avc1.42E01E"',
  vp8: 'video/webm; codecs="vp8"',
  vp9: 'video/webm; codecs="vp9"',
} as const;

export async function attachPlaybackVideoCacheSource(
  ctx: ViewerAppContext,
  blobs: Blob[],
  codec: string,
): Promise<{ mediaSource: MediaSource | null; url: string }> {
  const firstBlob = blobs[0];
  if (!firstBlob) {
    throw new Error("Playback video cache has no segments.");
  }
  const video = ctx.refs.cachedPreviewVideo;
  if (blobs.length === 1) {
    const url = URL.createObjectURL(firstBlob);
    video.src = url;
    video.load();
    return { mediaSource: null, url };
  }
  const mimeType =
    codec === "avc" || codec === "vp8" || codec === "vp9"
      ? MEDIA_SOURCE_MIME_TYPES[codec]
      : null;
  if (
    !mimeType ||
    typeof MediaSource === "undefined" ||
    !MediaSource.isTypeSupported(mimeType)
  ) {
    throw new Error("Segmented playback is unsupported.");
  }
  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  video.src = url;
  video.load();
  try {
    await waitForEvent(mediaSource, "sourceopen");
    const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
    try {
      sourceBuffer.mode = "sequence";
    } catch {
      // Sequence is the preferred mode; timestamped mode remains a fallback.
    }
    for (const blob of blobs) {
      await appendSourceBuffer(sourceBuffer, await blob.arrayBuffer());
    }
    if (mediaSource.readyState === "open") {
      mediaSource.endOfStream();
    }
    return { mediaSource, url };
  } catch (error) {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    throw error;
  }
}

function appendSourceBuffer(
  sourceBuffer: SourceBuffer,
  buffer: ArrayBuffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = (event: Event) => {
      cleanup();
      reject(event);
    };
    const cleanup = () => {
      sourceBuffer.removeEventListener("updateend", onSuccess);
      sourceBuffer.removeEventListener("error", onError);
    };
    sourceBuffer.addEventListener("updateend", onSuccess, { once: true });
    sourceBuffer.addEventListener("error", onError, { once: true });
    try {
      sourceBuffer.appendBuffer(buffer);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function waitForEvent(target: EventTarget, type: string): Promise<Event> {
  return new Promise((resolve, reject) => {
    const onSuccess = (event: Event) => {
      cleanup();
      resolve(event);
    };
    const onError = (event: Event) => {
      cleanup();
      reject(event);
    };
    const cleanup = () => {
      target.removeEventListener(type, onSuccess);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(type, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}
