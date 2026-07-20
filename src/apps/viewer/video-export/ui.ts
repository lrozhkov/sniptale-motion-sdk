import type { ViewerAppContext } from "../app/context.js";

export function translateStatus(
  ctx: ViewerAppContext,
  key,
  fallback,
  params = {},
) {
  return Object.entries(params).reduce(
    (message, [name, value]) =>
      message.replace(`{${name}}`, String(value ?? "")),
    ctx.deps.t(key, fallback),
  );
}

export function localizeMp4ExportDialog(ctx: ViewerAppContext) {
  ctx.refs.mp4ExportTitle.textContent = ctx.deps.t(
    "viewer.mp4Export.title",
    "Export MP4",
  );
  ctx.refs.mp4ExportSizeLabel.textContent = ctx.deps.t(
    "viewer.mp4Export.size",
    "Size",
  );
  ctx.refs.mp4ExportFpsLabel.textContent = ctx.deps.t(
    "viewer.mp4Export.fps",
    "FPS",
  );
  ctx.refs.mp4ExportWidthLabel.textContent = ctx.deps.t(
    "viewer.mp4Export.width",
    "Width",
  );
  ctx.refs.mp4ExportHeightLabel.textContent = ctx.deps.t(
    "viewer.mp4Export.height",
    "Height",
  );
  ctx.refs.mp4ExportVideoCodecLabel.textContent = ctx.deps.t(
    "viewer.mp4Export.videoCodec",
    "Video codec",
  );
  ctx.refs.mp4ExportAudioCodecLabel.textContent = ctx.deps.t(
    "viewer.mp4Export.audioCodec",
    "Audio codec",
  );
  ctx.refs.mp4ExportCancelButton.textContent = ctx.deps.t(
    "viewer.mp4Export.cancel",
    "Cancel",
  );
  ctx.refs.mp4ExportStartButton.textContent = ctx.deps.t(
    "viewer.mp4Export.start",
    "Export",
  );
  const custom = ctx.refs.mp4ExportSizeSelect.querySelector(
    'option[value="custom"]',
  );
  if (custom) {
    custom.textContent = ctx.deps.t("viewer.mp4Export.customSize", "Custom");
  }
}

export function getSelectedCodec(select, options) {
  return (
    options.find((option) => option.value === select.value) ??
    options[0] ??
    null
  );
}

function populateCodecSelect(ctx, select, options) {
  const previous = select.value;
  select.replaceChildren();
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = ctx.deps.t(option.labelKey, option.value);
    select.append(item);
  }
  const selected = options.some((option) => option.value === previous)
    ? previous
    : options[0]?.value;
  if (selected) {
    select.value = selected;
  }
}

export function syncMp4ExportControls(ctx: ViewerAppContext, size) {
  const state = ctx.state.mp4Export;
  const custom = state.sizePreset === "custom";
  ctx.refs.mp4ExportSizeSelect.value = state.sizePreset;
  ctx.refs.mp4ExportWidthInput.value = String(size.width);
  ctx.refs.mp4ExportHeightInput.value = String(size.height);
  ctx.refs.mp4ExportWidthInput.disabled = !custom || state.inFlight;
  ctx.refs.mp4ExportHeightInput.disabled = !custom || state.inFlight;
  ctx.refs.mp4ExportFpsInput.value = String(state.fps);
  populateCodecSelect(
    ctx,
    ctx.refs.mp4ExportVideoCodecSelect,
    state.videoOptions,
  );
  populateCodecSelect(
    ctx,
    ctx.refs.mp4ExportAudioCodecSelect,
    state.audioOptions,
  );
  const hasRequiredCodecs =
    state.videoOptions.length > 0 &&
    (!state.audioBuffer || state.audioOptions.length > 0);
  const ready = !state.inFlight && hasRequiredCodecs;
  ctx.refs.mp4ExportStartButton.disabled = !ready;
  ctx.refs.mp4ExportCancelButton.disabled = false;
  ctx.refs.mp4ExportSizeSelect.disabled = state.inFlight;
  ctx.refs.mp4ExportFpsInput.disabled = state.inFlight;
  ctx.refs.mp4ExportVideoCodecSelect.disabled =
    state.inFlight || state.videoOptions.length <= 1;
  ctx.refs.mp4ExportAudioCodecSelect.disabled =
    state.inFlight || !state.audioBuffer || state.audioOptions.length <= 1;
  ctx.refs.mp4ExportAudioCodecSelect.closest("label").hidden =
    !state.audioBuffer;
}
