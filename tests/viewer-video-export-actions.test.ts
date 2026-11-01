import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { requiredEntry } from "./helpers/required-entry.js";
import type {
  getSupportedMp4VideoOptions,
  getSupportedMp4AudioOptions,
} from "../src/apps/viewer/video-export/capabilities.js";
import type {
  localizeMp4ExportDialog,
  syncMp4ExportControls,
} from "../src/apps/viewer/video-export/ui.js";
import { createVideoExportActions } from "../src/apps/viewer/video-export/controller";
import type { encodeMp4FromRenderedFrames } from "../src/apps/viewer/video-export/mux";

const mocks = vi.hoisted(() => ({
  audio: vi.fn<() => Promise<AudioBuffer | null>>(),
  video: vi.fn<typeof getSupportedMp4VideoOptions>(),
  audioOptions: vi.fn<typeof getSupportedMp4AudioOptions>(),
  encode: vi.fn<typeof encodeMp4FromRenderedFrames>(),
}));
vi.mock("../src/apps/viewer/video-export/timeline-audio", () => ({
  resolveTimelineMp4AudioBuffer: mocks.audio,
}));
vi.mock("../src/apps/viewer/video-export/capabilities", () => ({
  getSupportedMp4VideoOptions: mocks.video,
  getSupportedMp4AudioOptions: mocks.audioOptions,
}));
vi.mock("../src/apps/viewer/video-export/mux", () => ({
  encodeMp4FromRenderedFrames: mocks.encode,
}));
vi.mock("../src/apps/viewer/video-export/ui", () => ({
  localizeMp4ExportDialog: vi.fn<typeof localizeMp4ExportDialog>(),
  syncMp4ExportControls: vi.fn<typeof syncMp4ExportControls>(),
  getSelectedCodec: <T extends { value: string }>(
    select: { value: string },
    options: T[],
  ) =>
    options.find((option) => option.value === select.value) ??
    options[0] ??
    null,
  translateStatus: (_ctx: unknown, _key: string, fallback: string) => fallback,
}));

function context() {
  const ctx = createViewerContextFixture();
  const state = ctx.state;
  state.currentTemplate = {
    id: "first",
    duration: 2,
    layers: [],
    clips: [],
    scenes: [],
    timeline: { duration: 2, phases: [], tracks: [] },
  };
  state.controls = { amount: 1 };
  state.mp4Export.videoOptions = [{ value: "avc", labelKey: "avc" }];
  ctx.refs.fpsInput.value = "30";
  ctx.refs.mp4ExportVideoCodecSelect.value = "avc";
  ctx.refs.mp4ExportAudioCodecSelect.value = "aac";
  const dialog = Object.assign(ctx.refs.mp4ExportDialog, {
    showModal: vi.fn<HTMLDialogElement["showModal"]>(),
    close: vi.fn<HTMLDialogElement["close"]>(),
  });
  const refs = Object.assign(ctx.refs, { mp4ExportDialog: dialog });
  const effectiveTemplate = ctx.getEffectiveTemplate(state.currentTemplate);
  if (!effectiveTemplate) throw new Error("Missing export template fixture.");
  const getEffectiveTemplate = vi
    .spyOn(ctx, "getEffectiveTemplate")
    .mockReturnValue(effectiveTemplate);
  const waitForRenderIdle = vi
    .spyOn(ctx, "waitForRenderIdle")
    .mockResolvedValue();
  ctx.deps.t = (key, fallback) => fallback ?? key;
  vi.spyOn(ctx, "assertExportable").mockReturnValue(true);
  vi.spyOn(ctx, "logDiagnostic").mockImplementation(() => {});
  vi.spyOn(ctx, "pausePlayback").mockReturnValue(true);
  vi.spyOn(ctx, "drawExportFrame").mockImplementation(() => {});
  const renderFrameBitmapForExport = vi
    .spyOn(ctx, "renderFrameBitmapForExport")
    .mockResolvedValue(createNativeBitmapFixture());
  return {
    ctx,
    state,
    refs,
    getEffectiveTemplate,
    waitForRenderIdle,
    effectiveTemplate,
    renderFrameBitmapForExport,
  };
}

describe("loaded MP4 action authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.audio.mockResolvedValue(null);
    mocks.video.mockResolvedValue([{ value: "avc", labelKey: "avc" }]);
    mocks.audioOptions.mockResolvedValue([]);
    mocks.encode.mockResolvedValue(new Blob(["mp4"]));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not apply capabilities after the dialog has closed", async () => {
    const { ctx, state, refs } = context();
    const pending = Promise.withResolvers<AudioBuffer | null>();
    mocks.audio.mockReturnValue(pending.promise);
    const actions = createVideoExportActions(ctx);
    const opening = actions.openMp4ExportDialog();
    expect(refs.mp4ExportDialog.showModal).toHaveBeenCalledOnce();
    actions.closeMp4ExportDialog();
    pending.resolve(null);
    await opening;
    expect(state.mp4Export.dialogOpen).toBe(false);
    expect(state.mp4Export.videoOptions).toEqual([]);
    expect(mocks.video).not.toHaveBeenCalled();
  });

  it("does not apply capabilities for a replaced template with the same ID", async () => {
    const { ctx, state } = context();
    const pending = Promise.withResolvers<AudioBuffer | null>();
    mocks.audio.mockReturnValue(pending.promise);
    const opening = createVideoExportActions(ctx).openMp4ExportDialog();
    state.currentTemplate = { id: "first", duration: 3 };
    pending.resolve(null);
    await opening;
    expect(state.mp4Export.videoOptions).toEqual([]);
    expect(mocks.video).not.toHaveBeenCalled();
  });

  it("exports the original template, controls, audio and filename across asynchronous waits", async () => {
    const {
      ctx,
      state,
      waitForRenderIdle,
      getEffectiveTemplate,
      effectiveTemplate,
      renderFrameBitmapForExport,
    } = context();
    const original = state.currentTemplate;
    class FixtureAudioBuffer {
      numberOfChannels = 1;
      sampleRate = 48000;
    }
    vi.stubGlobal("AudioBuffer", FixtureAudioBuffer);
    const audio = new AudioBuffer({
      length: 1,
      numberOfChannels: 1,
      sampleRate: 48000,
    });
    state.mp4Export.audioBuffer = audio;
    state.mp4Export.audioOptions = [{ value: "aac", labelKey: "aac" }];
    const idle = Promise.withResolvers<void>();
    waitForRenderIdle.mockReturnValue(idle.promise);
    const link = {
      href: "",
      download: "",
      click: vi.fn<HTMLAnchorElement["click"]>(),
    };
    const revoke = vi.fn<typeof URL.revokeObjectURL>();
    vi.stubGlobal("document", {
      createElement: vi.fn<() => typeof link>(() => link),
    });
    vi.stubGlobal("window", {
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);
    const exporting = createVideoExportActions(ctx).startMp4Export();
    await vi.waitFor(() => expect(waitForRenderIdle).toHaveBeenCalledOnce());
    state.currentTemplate = { id: "second", duration: 7 };
    state.controls = { amount: 99 };
    state.mp4Export.audioBuffer = null;
    idle.resolve();
    await exporting;
    expect(getEffectiveTemplate).toHaveBeenCalledExactlyOnceWith(original);
    const encoded = requiredEntry(mocks.encode.mock.calls, 0)[0];
    expect(encoded.audioBuffer).toBe(audio);
    expect(link.download).toBe("first.mp4");
    expect(revoke).toHaveBeenCalledWith("blob:export");
    await encoded.renderFrame(0.5, 15);
    expect(renderFrameBitmapForExport).toHaveBeenCalledWith(
      original,
      effectiveTemplate,
      expect.objectContaining({
        controls: { amount: 1 },
        time: 0.5,
        frameIndex: 15,
      }),
    );
  });
});
