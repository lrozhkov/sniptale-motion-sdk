import { requiredEntry } from "./helpers/required-entry.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSandboxSession } from "../src/apps/sandbox/runtime/session.js";
import { createSandboxRegistry } from "../src/apps/sandbox/runtime/registry.js";
import { createSandboxRuntimeFacade } from "../src/apps/sandbox/runtime/runtime-facade.js";
import { createDirectPreviewPresenter } from "../src/apps/sandbox/runtime/direct-presentation.js";
import type { SandboxRenderContext } from "../src/apps/sandbox/runtime/render-context.js";
import type { SandboxRenderFrameMessage } from "../src/apps/sandbox/runtime/render-message-boundary.js";

class TestCanvas {
  context = { setTransform(): void {}, commit(): void {} };
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
  const cases: {
    committed: boolean;
    result: Record<string, unknown>;
    transfer: Transferable[] | undefined;
  }[] = [
    {
      committed: true,
      result: { presented: true, previewWidth: 320, previewHeight: 180 },
      transfer: [],
    },
    {
      committed: false,
      result: { error: "Direct preview surface could not be presented." },
      transfer: undefined,
    },
  ];
  it.each(cases)(
    "finishes a direct render when commit succeeds=$committed",
    async ({ committed, result, transfer }) => {
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
      const inputBitmap = createNativeBitmapFixture({
        width: 320,
        height: 180,
      });
      const close = vi.spyOn(inputBitmap, "close");
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
      expect(requiredEntry(post.mock.calls, 0)[0]).toMatchObject({
        kind: "renderFrameResult",
        requestId: "render-1",
        ok: committed,
      });
      expect(requiredEntry(post.mock.calls, 0)[0]).toMatchObject(result);
      expect(requiredEntry(post.mock.calls, 0)[1]).toEqual(transfer);
      expect(close).toHaveBeenCalledTimes(1);
      expect(runtime.__bindingReads).toBeNull();
      expect(runtime.__renderViewport).toBeNull();
      expect(clearInterval).toHaveBeenCalledTimes(1);
      await session.handleMessage({ kind: "dispose" });
    },
  );
});
