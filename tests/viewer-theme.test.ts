import { afterEach, describe, expect, it, vi } from "vitest";

import { installAppThemeOwner } from "../src/apps/viewer/app/theme";

describe("viewer app theme", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a snapshot visible until the theme refresh render settles", async () => {
    const frames: FrameRequestCallback[] = [];
    const snapshotContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
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
      state: {
        currentTemplate: { id: "template" },
        playing: false,
        theme: "dark",
      },
    } as any;
    installAppThemeOwner(ctx);

    ctx.applyTheme("light");

    expect(snapshotContext.drawImage).toHaveBeenCalledWith(canvas, 0, 0);
    expect(snapshot).toMatchObject({
      height: 720,
      hidden: false,
      width: 1280,
    });
    expect(frames).toHaveLength(1);

    frames[0](0);
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.renderCurrentFrame).toHaveBeenCalledWith({ forceFull: true });
    expect(snapshot.hidden).toBe(false);
    expect(frames).toHaveLength(2);

    frames[1](16);
    await Promise.resolve();
    await Promise.resolve();

    expect(snapshot.hidden).toBe(true);
  });
});
