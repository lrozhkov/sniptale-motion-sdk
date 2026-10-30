import { afterEach, describe, expect, it, vi } from "vitest";
import { createSandboxSession } from "../src/apps/sandbox/runtime/session.js";
import { createSandboxRegistry } from "../src/apps/sandbox/runtime/registry.js";
import { createSandboxRuntimeFacade } from "../src/apps/sandbox/runtime/runtime-facade.js";
import { createDirectPreviewPresenter } from "../src/apps/sandbox/runtime/direct-presentation.js";
import type { SandboxRenderContext } from "../src/apps/sandbox/runtime/render-context.js";
import type { SandboxRenderFrameMessage } from "../src/apps/sandbox/runtime/render-message-boundary.js";

class TestCanvas {
  context = { setTransform: vi.fn(), commit: vi.fn() };
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return this.context;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sandbox session direct rendering", () => {
  it.each([true, false])(
    "finishes a direct render when commit succeeds=%s",
    async (committed) => {
      vi.stubGlobal("OffscreenCanvas", TestCanvas);
      const registry = createSandboxRegistry();
      const runtime = createSandboxRuntimeFacade(registry);
      registry.registerEffect({
        id: "test",
        renderFrame(context: SandboxRenderContext) {
          return context.createCanvas();
        },
      });
      const presenter = createDirectPreviewPresenter();
      presenter.connect(new TestCanvas(320, 180));
      vi.spyOn(presenter, "commitRenderSurface").mockReturnValue(committed);
      const clearInterval = vi.spyOn(globalThis, "clearInterval");
      const post =
        vi.fn<(message: unknown, transfer?: Transferable[]) => void>();
      const inputBitmap = { width: 320, height: 180, close: vi.fn() };
      const session = createSandboxSession({
        postToParent: post,
        registry,
        runtime,
        previewPresenter: presenter,
      });
      const message: SandboxRenderFrameMessage = {
        kind: "renderFrame",
        requestId: "render-1",
        sequenceId: 1,
        effectId: "test",
        width: 320,
        height: 180,
        renderQuality: "full",
        directPresentation: true,
        inputFrames: { source: inputBitmap },
      };
      await session.handleMessage(message);
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][0]).toMatchObject({
        kind: "renderFrameResult",
        requestId: "render-1",
        ok: committed,
      });
      if (committed) {
        expect(post.mock.calls[0][0]).toMatchObject({
          presented: true,
          previewWidth: 320,
          previewHeight: 180,
        });
        expect(post.mock.calls[0][1]).toEqual([]);
      } else {
        expect(post.mock.calls[0][0]).toMatchObject({
          error: "Direct preview surface could not be presented.",
        });
        expect(post.mock.calls[0][1]).toBeUndefined();
      }
      expect(inputBitmap.close).toHaveBeenCalledTimes(1);
      expect(runtime.__bindingReads).toBeNull();
      expect(runtime.__renderViewport).toBeNull();
      expect(clearInterval).toHaveBeenCalledTimes(1);
      await session.handleMessage({ kind: "dispose" });
    },
  );
});
