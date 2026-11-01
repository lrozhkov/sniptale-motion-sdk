import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeButtonFixture } from "./helpers/native-button-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer app theme", () => {
  it("ignores a render rejection after the selected template changes", async () => {
    const { ctx, frames, snapshot } = fixture();
    const rendered = Promise.withResolvers<void>();
    ctx.renderCurrentFrame.mockReturnValueOnce(rendered.promise);
    ctx.applyTheme("light");
    requiredEntry(frames, 0)(0);
    ctx.state.currentTemplate = { id: "replacement", duration: 3 };
    rendered.reject(new Error("stale theme render"));
    await flushMicrotasks();
    requiredEntry(frames, frames.length - 1)(16);
    await flushMicrotasks();
    expect(ctx.setRenderStatus).not.toHaveBeenCalled();
    expect(ctx.logDiagnostic).not.toHaveBeenCalled();
    expect(snapshot.hidden).toBe(true);
  });

  it("keeps a snapshot visible until the theme refresh render settles", async () => {
    const { ctx, frames, snapshot, snapshotContext, canvas } = fixture();
    ctx.applyTheme("light");
    expect(snapshotContext.drawImage).toHaveBeenCalledWith(canvas, 0, 0);
    expect(snapshot).toMatchObject({ height: 720, hidden: false, width: 1280 });
    expect(frames).toHaveLength(1);
    requiredEntry(frames, 0)(0);
    await flushMicrotasks();
    expect(ctx.renderCurrentFrame).toHaveBeenCalledWith({ forceFull: true });
    expect(snapshot.hidden).toBe(false);
    expect(frames).toHaveLength(2);
    requiredEntry(frames, 1)(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });

  it("renders only the latest theme generation when the same theme is selected again", async () => {
    const { ctx, frames, snapshot } = fixture();
    ctx.applyTheme("light");
    ctx.applyTheme("dark");
    ctx.applyTheme("light");
    for (const frame of frames.slice()) frame(0);
    await flushMicrotasks();
    expect(ctx.renderCurrentFrame).toHaveBeenCalledOnce();
    requiredEntry(frames, frames.length - 1)(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });

  it("does not render a replacement template from a queued theme callback", async () => {
    const { ctx, frames, snapshot } = fixture();
    ctx.applyTheme("light");
    ctx.state.currentTemplate = { id: "replacement", duration: 3 };
    requiredEntry(frames, 0)(0);
    await flushMicrotasks();
    expect(ctx.renderCurrentFrame).not.toHaveBeenCalled();
    requiredEntry(frames, frames.length - 1)(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });

  it("reports a failed render and releases the snapshot after paint", async () => {
    const { ctx, frames, snapshot } = fixture();
    ctx.renderCurrentFrame.mockRejectedValueOnce(
      new Error("theme render failed"),
    );
    ctx.applyTheme("light");
    requiredEntry(frames, 0)(0);
    await flushMicrotasks();
    requiredEntry(frames, frames.length - 1)(16);
    await flushMicrotasks();
    expect(ctx.setRenderStatus).toHaveBeenCalledWith("failed");
    expect(ctx.logDiagnostic).toHaveBeenCalledWith(
      "theme render failed",
      "error",
    );
    expect(snapshot.hidden).toBe(true);
  });

  it("releases the previous snapshot when the latest theme does not capture another one", async () => {
    const { ctx, frames, snapshot } = fixture();
    ctx.applyTheme("light");
    ctx.state.playing = true;
    ctx.applyTheme("dark");
    for (const frame of frames.slice()) frame(0);
    await flushMicrotasks();
    requiredEntry(frames, frames.length - 1)(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });
});

async function flushMicrotasks(): Promise<void> {
  for (let count = 0; count < 6; count += 1) await Promise.resolve();
}

function fixture() {
  const ctx = createViewerContextFixture();
  const frames: FrameRequestCallback[] = [];
  const snapshotContext = Object.assign(new CanvasRenderingContext2D(), {
    clearRect: vi.fn<CanvasRenderingContext2D["clearRect"]>(),
    drawImage: vi.fn<CanvasRenderingContext2D["drawImage"]>(),
  });
  const canvas = ctx.refs.canvas;
  canvas.height = 720;
  canvas.width = 1280;
  const snapshot = ctx.refs.themePreviewSnapshotCanvas;
  if (!snapshot) throw new Error("Missing theme snapshot canvas.");
  vi.spyOn(snapshot, "getContext").mockReturnValue(snapshotContext);
  snapshot.height = 0;
  snapshot.width = 0;
  snapshot.hidden = true;
  Object.assign(document, { documentElement: { dataset: {} } });
  vi.stubGlobal("window", {
    localStorage: { setItem: vi.fn<Storage["setItem"]>() },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    },
  });
  ctx.refs.themeToggleButton = createNativeButtonFixture();
  ctx.deps.t = (key, fallback) => fallback ?? key;
  ctx.state.currentTemplate = { id: "template", duration: 3 };
  ctx.state.playing = false;
  ctx.state.theme = "dark";
  const renderCurrentFrame = vi
    .spyOn(ctx, "renderCurrentFrame")
    .mockResolvedValue();
  vi.spyOn(ctx, "setIconButton").mockImplementation(() => {});
  const setRenderStatus = vi
    .spyOn(ctx, "setRenderStatus")
    .mockImplementation(() => {});
  const logDiagnostic = vi
    .spyOn(ctx, "logDiagnostic")
    .mockImplementation(() => {});
  return {
    ctx: Object.assign(ctx, {
      renderCurrentFrame,
      setRenderStatus,
      logDiagnostic,
    }),
    frames,
    canvas,
    snapshot,
    snapshotContext,
  };
}
