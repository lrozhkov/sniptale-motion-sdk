import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewerAppContext } from "../src/apps/viewer/app/context";
import { createViewerState } from "../src/apps/viewer/app/state";
import { createVideoExportActions } from "../src/apps/viewer/video-export/controller";
import type { encodeMp4FromRenderedFrames } from "../src/apps/viewer/video-export/mux";

const mocks = vi.hoisted(() => ({
  audio: vi.fn<() => Promise<AudioBuffer | null>>(),
  video: vi.fn(),
  audioOptions: vi.fn(),
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
  localizeMp4ExportDialog: vi.fn(),
  syncMp4ExportControls: vi.fn(),
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
  const state = createViewerState();
  state.currentTemplate = { id: "first", duration: 2 };
  state.controls = { amount: 1 };
  state.mp4Export.videoOptions = [{ value: "avc", labelKey: "avc" }];
  const refs = {
    fpsInput: { value: "30" },
    mp4ExportStatus: { textContent: "" },
    timelineSaveStatus: { textContent: "" },
    mp4ExportDialog: { showModal: vi.fn(), close: vi.fn() },
    mp4ExportVideoCodecSelect: { value: "avc" },
    mp4ExportAudioCodecSelect: { value: "aac" },
  };
  const getEffectiveTemplate = vi.fn(() => state.currentTemplate);
  const waitForRenderIdle = vi.fn(async () => {});
  const ctx = {
    state,
    refs,
    getEffectiveTemplate,
    waitForRenderIdle,
    deps: {
      t: (_key: string, fallback: string) => fallback,
      deepClone: structuredClone,
    },
    getEffectiveDuration: () => 2,
    assertExportable: () => true,
    logDiagnostic: vi.fn(),
    pausePlayback: vi.fn(),
    drawExportFrame: vi.fn(),
    renderFrameBitmapForExport: vi.fn(),
  } as unknown as ViewerAppContext;
  return { ctx, state, refs, getEffectiveTemplate, waitForRenderIdle };
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
    const { ctx, state, waitForRenderIdle, getEffectiveTemplate } = context();
    const original = state.currentTemplate;
    const audio = { numberOfChannels: 1, sampleRate: 48000 } as AudioBuffer;
    state.mp4Export.audioBuffer = audio;
    state.mp4Export.audioOptions = [{ value: "aac", labelKey: "aac" }];
    const idle = Promise.withResolvers<void>();
    waitForRenderIdle.mockReturnValue(idle.promise);
    const link = { href: "", download: "", click: vi.fn() };
    const revoke = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => link) });
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
    const encoded = mocks.encode.mock.calls[0]?.[0];
    expect(encoded?.audioBuffer).toBe(audio);
    expect(link.download).toBe("first.mp4");
    expect(revoke).toHaveBeenCalledWith("blob:export");
    await encoded?.renderFrame(0.5, 15);
    expect(ctx.renderFrameBitmapForExport).toHaveBeenCalledWith(
      original,
      original,
      expect.objectContaining({
        controls: { amount: 1 },
        time: 0.5,
        frameIndex: 15,
      }),
    );
  });
});
