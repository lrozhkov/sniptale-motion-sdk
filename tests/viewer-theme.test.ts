import { afterEach, describe, expect, it, vi } from "vitest";
import { createThemeActions } from "../src/apps/viewer/app/theme";

afterEach(() => vi.unstubAllGlobals());

describe("viewer app theme", () => {
  it("ignores a render rejection after the selected template changes", async () => {
    const { ctx, frames, snapshot } = fixture();
    const rendered = Promise.withResolvers<void>();
    ctx.renderCurrentFrame.mockReturnValueOnce(rendered.promise);
    ctx.applyTheme("light");
    frames[0]?.(0);
    ctx.state.currentTemplate = { id: "replacement" };
    rendered.reject(new Error("stale theme render"));
    await flushMicrotasks();
    frames.at(-1)?.(16);
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
    frames[0]?.(0);
    await flushMicrotasks();
    expect(ctx.renderCurrentFrame).toHaveBeenCalledWith({ forceFull: true });
    expect(snapshot.hidden).toBe(false);
    expect(frames).toHaveLength(2);
    frames[1]?.(16);
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
    frames.at(-1)?.(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });

  it("does not render a replacement template from a queued theme callback", async () => {
    const { ctx, frames, snapshot } = fixture();
    ctx.applyTheme("light");
    ctx.state.currentTemplate = { id: "replacement" };
    frames[0]?.(0);
    await flushMicrotasks();
    expect(ctx.renderCurrentFrame).not.toHaveBeenCalled();
    frames.at(-1)?.(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });

  it("reports a failed render and releases the snapshot after paint", async () => {
    const { ctx, frames, snapshot } = fixture();
    ctx.renderCurrentFrame.mockRejectedValueOnce(
      new Error("theme render failed"),
    );
    ctx.applyTheme("light");
    frames[0]?.(0);
    await flushMicrotasks();
    frames.at(-1)?.(16);
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
    frames.at(-1)?.(16);
    await flushMicrotasks();
    expect(snapshot.hidden).toBe(true);
  });
});

async function flushMicrotasks(): Promise<void> {
  for (let count = 0; count < 6; count += 1) await Promise.resolve();
}

function fixture() {
  const frames: FrameRequestCallback[] = [];
  const snapshotContext = { clearRect: vi.fn(), drawImage: vi.fn() };
  const canvas = { height: 720, width: 1280 };
  const snapshot = {
    getContext: vi.fn(() => snapshotContext),
    height: 0,
    hidden: true,
    width: 0,
  };
  vi.stubGlobal("document", { documentElement: { dataset: {} } });
  vi.stubGlobal("window", {
    localStorage: { setItem: vi.fn() },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    },
  });
  const ctx = {
    deps: { t: (_key: string, fallback: string) => fallback },
    refs: {
      canvas,
      themePreviewSnapshotCanvas: snapshot,
      themeToggleButton: { setAttribute: vi.fn() },
    },
    renderCurrentFrame: vi.fn(async () => undefined),
    setIconButton: vi.fn(),
    setRenderStatus: vi.fn(),
    logDiagnostic: vi.fn(),
    state: {
      currentTemplate: { id: "template" },
      playing: false,
      theme: "dark",
    },
  } as any;
  Object.assign(
    ctx,
    createThemeActions(() => ctx),
  );
  return { ctx, frames, canvas, snapshot, snapshotContext };
}
