import { vi } from "vitest";

class FixtureVideo {
  currentTime = 0;
  hidden = true;
  paused = true;
  src = "";
  addEventListener(): void {}
  load(): void {}
  pause(): void {
    this.paused = true;
  }
  async play(): Promise<void> {
    this.paused = false;
  }
  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }
}

/** Native media allocation with observable playback and source lifecycle operations. */
export function createNativeVideoFixture() {
  vi.stubGlobal("HTMLVideoElement", FixtureVideo);
  const video = new HTMLVideoElement();
  return Object.assign(video, {
    addEventListener: vi.spyOn(video, "addEventListener"),
    load: vi.spyOn(video, "load"),
    pause: vi.spyOn(video, "pause"),
    play: vi.spyOn(video, "play"),
    removeAttribute: vi.spyOn(video, "removeAttribute"),
  });
}
