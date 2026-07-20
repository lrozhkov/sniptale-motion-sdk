export function setCachedVideoTime(
  video: HTMLVideoElement,
  time: number,
): void {
  try {
    video.currentTime = time;
  } catch {
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = time;
      },
      { once: true },
    );
  }
}
