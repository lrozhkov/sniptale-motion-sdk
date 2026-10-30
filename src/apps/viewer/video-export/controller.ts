import type { ViewerAppContext } from "../app/context.js";
import {
  getPresetSize,
  normalizeExportFps,
  normalizeExportSize,
} from "./options.js";
import { resolveTimelineMp4AudioBuffer } from "./timeline-audio.js";
import {
  getSelectedCodec,
  localizeMp4ExportDialog,
  syncMp4ExportControls as syncMp4ExportControlsView,
  translateStatus,
} from "./ui.js";

function getMp4ExportSize(state) {
  return normalizeExportSize({
    height: state.customHeight,
    sizePreset: state.sizePreset,
    width: state.customWidth,
  });
}

function syncMp4ExportControls(ctx: ViewerAppContext) {
  syncMp4ExportControlsView(ctx, getMp4ExportSize(ctx.state.mp4Export));
}

async function refreshMp4ExportCapabilities(ctx: ViewerAppContext) {
  const state = ctx.state.mp4Export;
  const token = ++state.videoStatusToken;
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = template
    ? ctx.getEffectiveTemplate(template)
    : null;
  const duration = template ? ctx.getEffectiveDuration(template) : 0;
  const size = normalizeExportSize({
    height: state.customHeight,
    sizePreset: state.sizePreset,
    width: state.customWidth,
  });
  const fps = normalizeExportFps(state.fps);
  state.videoOptions = [];
  state.audioOptions = [];
  state.audioBuffer = null;
  state.status = ctx.deps.t(
    "viewer.mp4Export.preparing",
    "Preparing MP4 export",
  );
  ctx.refs.mp4ExportStatus.textContent = state.status;
  syncMp4ExportControls(ctx);
  const capabilityRuntimePromise = import("./capabilities.js");
  let audioBuffer: AudioBuffer | null = null;
  let audioDecodeFailed = false;
  try {
    audioBuffer = effectiveTemplate
      ? await resolveTimelineMp4AudioBuffer(ctx, effectiveTemplate, duration)
      : null;
  } catch (error) {
    if (token !== state.videoStatusToken) {
      return;
    }
    ctx.logDiagnostic(
      `MP4 timeline audio decode failed: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    audioDecodeFailed = true;
    state.status = ctx.deps.t(
      "viewer.mp4Export.audioDecodeFailed",
      "Timeline audio could not be decoded.",
    );
  }
  let capabilityRuntime: typeof import("./capabilities.js");
  try {
    capabilityRuntime = await capabilityRuntimePromise;
  } catch (error) {
    if (token !== state.videoStatusToken) {
      return;
    }
    state.status = ctx.deps.t("viewer.mp4Export.failed", "MP4 export failed");
    ctx.refs.mp4ExportStatus.textContent = state.status;
    ctx.logDiagnostic(
      `MP4 codec runtime failed to load: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    syncMp4ExportControls(ctx);
    return;
  }
  const { getSupportedMp4AudioOptions, getSupportedMp4VideoOptions } =
    capabilityRuntime;
  const [videoOptions, audioOptions] = await Promise.all([
    getSupportedMp4VideoOptions({ fps, ...size }),
    getSupportedMp4AudioOptions(audioBuffer),
  ]);
  if (token !== state.videoStatusToken) {
    return;
  }
  state.audioBuffer = audioBuffer;
  state.videoOptions = videoOptions;
  state.audioOptions = audioOptions;
  if (videoOptions.length === 0) {
    state.status = ctx.deps.t(
      "viewer.mp4Export.noVideoCodec",
      "No supported video codec for this browser.",
    );
  } else if (state.audioBuffer && audioOptions.length === 0) {
    state.status = ctx.deps.t(
      "viewer.mp4Export.noAudioCodec",
      "No supported audio codec for this browser.",
    );
  } else if (audioDecodeFailed) {
    state.status = ctx.deps.t(
      "viewer.mp4Export.audioDecodeFailed",
      "Timeline audio could not be decoded.",
    );
  } else if (state.audioBuffer) {
    state.status = ctx.deps.t(
      "viewer.mp4Export.audioReady",
      "Timeline audio will be included.",
    );
  } else {
    state.status = ctx.deps.t(
      "viewer.mp4Export.noTimelineAudio",
      "No timeline audio found. Exporting video-only MP4.",
    );
  }
  ctx.refs.mp4ExportStatus.textContent = state.status;
  syncMp4ExportControls(ctx);
}

function openMp4ExportDialog(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate || !ctx.assertExportable("Export blocked")) {
    return;
  }
  const state = ctx.state.mp4Export;
  state.fps = normalizeExportFps(Number(ctx.refs.fpsInput.value) || 30);
  state.dialogOpen = true;
  state.cancelRequested = false;
  state.audioBuffer = null;
  state.audioOptions = [];
  state.videoOptions = [];
  state.status = ctx.deps.t(
    "viewer.mp4Export.preparing",
    "Preparing MP4 export",
  );
  localizeMp4ExportDialog(ctx);
  syncMp4ExportControls(ctx);
  ctx.refs.mp4ExportStatus.textContent = state.status;
  ctx.refs.mp4ExportDialog.showModal();
  void refreshMp4ExportCapabilities(ctx);
}

function closeMp4ExportDialog(ctx: ViewerAppContext) {
  if (ctx.state.mp4Export.inFlight) {
    ctx.state.mp4Export.cancelRequested = true;
    return;
  }
  ctx.state.mp4Export.dialogOpen = false;
  ctx.refs.mp4ExportDialog.close();
}

function updateMp4ExportSize(ctx: ViewerAppContext) {
  const state = ctx.state.mp4Export;
  state.sizePreset = ctx.refs.mp4ExportSizeSelect.value;
  const preset = getPresetSize(state.sizePreset);
  if (preset) {
    state.customWidth = preset.width;
    state.customHeight = preset.height;
  }
  syncMp4ExportControls(ctx);
  void refreshMp4ExportCapabilities(ctx);
}

function updateMp4ExportCustomSize(ctx: ViewerAppContext) {
  const state = ctx.state.mp4Export;
  state.customWidth = Number(ctx.refs.mp4ExportWidthInput.value) || 1280;
  state.customHeight = Number(ctx.refs.mp4ExportHeightInput.value) || 720;
  state.fps = normalizeExportFps(ctx.refs.mp4ExportFpsInput.value);
  syncMp4ExportControls(ctx);
  void refreshMp4ExportCapabilities(ctx);
}

async function startMp4Export(ctx: ViewerAppContext, event?: Event) {
  event?.preventDefault();
  const template = ctx.state.currentTemplate;
  const state = ctx.state.mp4Export;
  if (!template || state.inFlight) {
    return;
  }
  const size = normalizeExportSize({
    height: state.customHeight,
    sizePreset: state.sizePreset,
    width: state.customWidth,
  });
  const fps = normalizeExportFps(state.fps);
  const video = getSelectedCodec(
    ctx.refs.mp4ExportVideoCodecSelect,
    state.videoOptions,
  );
  const audio = state.audioBuffer
    ? getSelectedCodec(ctx.refs.mp4ExportAudioCodecSelect, state.audioOptions)
    : null;
  if (!video || (state.audioBuffer && !audio)) {
    return;
  }
  state.inFlight = true;
  state.cancelRequested = false;
  syncMp4ExportControls(ctx);
  try {
    const { encodeMp4FromRenderedFrames } = await import("./mux.js");
    ctx.pausePlayback?.({
      preservePreparation: false,
      renderCurrentFrame: false,
    });
    await ctx.waitForRenderIdle();
    const effectiveTemplate = ctx.getEffectiveTemplate(template);
    const controls = ctx.deps.deepClone(ctx.state.controls);
    const duration = ctx.getEffectiveDuration(template);
    const blob = await encodeMp4FromRenderedFrames({
      audioBitrate: audio?.bitrate,
      audioBuffer: state.audioBuffer,
      audioCodec: audio?.value,
      drawFrame: (context, bitmap, progress) =>
        ctx.drawExportFrame(context, effectiveTemplate, bitmap, progress),
      duration,
      fps,
      height: size.height,
      onProgress: (frame, total) => {
        state.status = translateStatus(
          ctx,
          "viewer.mp4Export.exporting",
          "Exporting frame {frame} of {total}",
          { frame, total },
        );
        ctx.refs.mp4ExportStatus.textContent = state.status;
      },
      renderFrame: (time, frameIndex) =>
        ctx.renderFrameBitmapForExport(template, effectiveTemplate, {
          fps,
          frameIndex,
          height: size.height,
          controls,
          time,
          width: size.width,
        }),
      shouldCancel: () => state.cancelRequested,
      videoBitrate: video.bitrate,
      videoCodec: video.value,
      width: size.width,
    });
    downloadMp4Blob(ctx, blob);
    state.status = ctx.deps.t("viewer.mp4Export.exported", "Exported MP4");
    ctx.refs.timelineSaveStatus.textContent = state.status;
  } catch (error) {
    const canceled =
      error instanceof DOMException && error.name === "AbortError";
    state.status = canceled
      ? ctx.deps.t("viewer.mp4Export.canceled", "MP4 export canceled.")
      : ctx.deps.t("viewer.mp4Export.failed", "MP4 export failed");
    if (!canceled) {
      ctx.logDiagnostic(
        `MP4 export failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  } finally {
    state.inFlight = false;
    state.cancelRequested = false;
    ctx.refs.mp4ExportStatus.textContent = state.status;
    syncMp4ExportControls(ctx);
  }
}

function downloadMp4Blob(ctx: ViewerAppContext, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${ctx.state.currentTemplate.id}.mp4`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function installVideoExportControllerOwner(ctx: ViewerAppContext): void {
  ctx.localizeMp4ExportDialog = localizeMp4ExportDialog.bind(undefined, ctx);
  ctx.openMp4ExportDialog = openMp4ExportDialog.bind(undefined, ctx);
  ctx.closeMp4ExportDialog = closeMp4ExportDialog.bind(undefined, ctx);
  ctx.updateMp4ExportSize = updateMp4ExportSize.bind(undefined, ctx);
  ctx.updateMp4ExportCustomSize = updateMp4ExportCustomSize.bind(
    undefined,
    ctx,
  );
  ctx.startMp4Export = startMp4Export.bind(undefined, ctx);
}
