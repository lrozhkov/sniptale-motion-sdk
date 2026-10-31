import { collectTimelineAudioClips as collectTimelinePreviewAudioClips } from "../timeline/model/audio-clips.js";
export { collectTimelineAudioClips as collectTimelinePreviewAudioClips } from "../timeline/model/audio-clips.js";
import type { ViewerAppContext } from "../app/context.js";

import type { ActivePreviewAudio } from "./audio-state.js";
export type { TimelinePreviewAudioClip } from "./audio-state.js";

function getAudioUrl(asset: Record<string, unknown>): {
  url: string | null;
  revokeUrl: string | null;
} {
  if (asset.blob instanceof Blob) {
    const url = URL.createObjectURL(asset.blob);
    return { revokeUrl: url, url };
  }
  return {
    revokeUrl: null,
    url: typeof asset.dataUrl === "string" ? asset.dataUrl : null,
  };
}

function stopActiveAudio(item: ActivePreviewAudio): void {
  item.audio.pause();
  item.audio.removeAttribute("src");
  item.audio.load();
  if (item.url) {
    URL.revokeObjectURL(item.url);
  }
}

function seekAudio(audio: HTMLAudioElement, time: number): void {
  try {
    audio.currentTime = time;
  } catch {
    // Some browsers reject seeks before metadata is available; the next sync tick
    // will retry once the media element has buffered enough information.
  }
}

export function stopPreviewAudio(ctx: Pick<ViewerAppContext, "state">): void {
  const previewAudio = ctx.state.previewAudio;
  for (const item of previewAudio.active.values()) {
    stopActiveAudio(item);
  }
  previewAudio.active.clear();
  previewAudio.clipDuration = null;
  previewAudio.clips = null;
  previewAudio.clipTemplate = null;
}

export function syncPreviewAudio(
  ctx: Pick<
    ViewerAppContext,
    "state" | "getRenderTemplateSnapshot" | "getEffectiveDuration"
  >,
  time: number,
): void {
  if (!ctx.state.playing || !ctx.state.currentTemplate) {
    stopPreviewAudio(ctx);
    return;
  }
  const template = ctx.getRenderTemplateSnapshot(ctx.state.currentTemplate);
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const activeKeys = new Set<string>();
  const previewAudio = ctx.state.previewAudio;
  if (
    previewAudio.clipTemplate !== template ||
    previewAudio.clipDuration !== duration ||
    !previewAudio.clips
  ) {
    previewAudio.clipTemplate = template;
    previewAudio.clipDuration = duration;
    previewAudio.clips = collectTimelinePreviewAudioClips(
      ctx,
      template,
      duration,
    );
  }

  for (const clip of previewAudio.clips) {
    if (time < clip.start || time >= clip.start + clip.duration) {
      continue;
    }
    activeKeys.add(clip.key);
    const targetTime = clip.offset + time - clip.start;
    let active = previewAudio.active.get(clip.key);
    if (!active) {
      const { revokeUrl, url } = getAudioUrl(clip.asset);
      if (!url) {
        continue;
      }
      const audio = new Audio(url);
      audio.preload = "auto";
      active = { audio, url: revokeUrl };
      previewAudio.active.set(clip.key, active);
      seekAudio(audio, targetTime);
    } else if (Math.abs(active.audio.currentTime - targetTime) > 0.2) {
      seekAudio(active.audio, targetTime);
    }
    active.audio.volume = clip.volume;
    if (active.audio.paused) {
      const item = active;
      void item.audio.play().catch(() => {
        stopActiveAudio(item);
        if (previewAudio.active.get(clip.key) === item)
          previewAudio.active.delete(clip.key);
      });
    }
  }

  for (const [key, active] of previewAudio.active) {
    if (!activeKeys.has(key)) {
      stopActiveAudio(active);
      previewAudio.active.delete(key);
    }
  }
}

export function installPlaybackPreviewAudioOwner(ctx: ViewerAppContext): void {
  ctx.stopPreviewAudio = stopPreviewAudio.bind(undefined, ctx);
  ctx.syncPreviewAudio = syncPreviewAudio.bind(undefined, ctx);
}
