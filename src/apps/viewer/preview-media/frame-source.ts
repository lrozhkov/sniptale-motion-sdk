export type PreviewMediaEntry = {
  disposed: boolean;
  element: HTMLImageElement | HTMLVideoElement;
  fileName: string;
  kind: "image" | "video";
  objectUrl: string;
  seekQueue: Promise<void>;
};

export async function loadPreviewMedia(file: File): Promise<PreviewMediaEntry> {
  const objectUrl = URL.createObjectURL(file);
  const mediaUrl = new URL(objectUrl);
  if (mediaUrl.protocol !== "blob:") {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Preview media requires a local blob URL.");
  }
  try {
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.src = mediaUrl.href;
      await image.decode();
      return createEntry(image, file, "image", objectUrl);
    }
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    video.src = mediaUrl.href;
    await waitForMediaEvent(video, "loadeddata");
    return createEntry(video, file, "video", objectUrl);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function createPreviewMediaFrameFromEntry(
  entry: PreviewMediaEntry,
  width: number,
  height: number,
  progress: number,
): Promise<ImageBitmap | null> {
  if (entry.kind === "video") {
    entry.seekQueue = entry.seekQueue
      .catch(() => undefined)
      .then(() =>
        entry.disposed
          ? undefined
          : seekPreviewVideo(entry.element as HTMLVideoElement, progress),
      );
    await entry.seekQueue;
  }
  if (entry.disposed) return null;
  const source = entry.element;
  const sourceWidth =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;
  const sourceHeight =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;
  if (!sourceWidth || !sourceHeight) return null;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) return null;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    source,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return createImageBitmap(canvas);
}

export function disposePreviewMediaEntry(
  entry: PreviewMediaEntry | undefined,
): void {
  if (!entry || entry.disposed) return;
  entry.disposed = true;
  if (entry.element instanceof HTMLVideoElement) {
    entry.element.pause();
    entry.element.removeAttribute("src");
    entry.element.load();
  }
  URL.revokeObjectURL(entry.objectUrl);
}

function createEntry(
  element: HTMLImageElement | HTMLVideoElement,
  file: File,
  kind: PreviewMediaEntry["kind"],
  objectUrl: string,
): PreviewMediaEntry {
  return {
    disposed: false,
    element,
    fileName: file.name,
    kind,
    objectUrl,
    seekQueue: Promise.resolve(),
  };
}

async function seekPreviewVideo(
  video: HTMLVideoElement,
  progress: number,
): Promise<void> {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const target = Math.min(
    Math.max(0, video.duration - 0.001),
    Math.max(0, progress) * video.duration,
  );
  if (Math.abs(video.currentTime - target) < 1 / 120) return;
  video.currentTime = target;
  await waitForMediaEvent(video, "seeked");
}

function waitForMediaEvent(
  media: HTMLMediaElement,
  eventName: "loadeddata" | "seeked",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(false), 5000);
    const finish = (ok: boolean) => {
      window.clearTimeout(timeout);
      media.removeEventListener(eventName, onReady);
      media.removeEventListener("error", onError);
      if (ok) resolve();
      else reject(new Error("Preview media loading timed out."));
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    media.addEventListener(eventName, onReady, { once: true });
    media.addEventListener("error", onError, { once: true });
  });
}
