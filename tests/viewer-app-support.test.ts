import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import { isSafeLocalAssetPath } from "../src/apps/viewer/app/constants.js";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("../src/apps/viewer/app/dom-refs.js", () => ({
  requireHtml: (selector: string) => document.querySelector(selector),
  requireSvg: (selector: string) => document.querySelector(selector),
  queryHtml: (selector: string) =>
    Array.from(document.querySelectorAll(selector)),
}));

import {
  createEmptyBindingReads,
  formatBindingReadsTitle,
  normalizeBindingReads,
} from "../src/apps/viewer/app/binding-reads";
import { formatDiagnosticsText } from "../src/apps/viewer/app/diagnostics";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { createViewerRefs } from "../src/apps/viewer/app/refs";
import { createViewerState } from "../src/apps/viewer/app/state";
import { isRendererContractCoveragePending } from "../src/apps/viewer/editor/validation";
import { getInitialTemplateId } from "../src/apps/viewer/templates/selection";
import {
  resolveSandboxHost,
  resolveSandboxPort,
} from "../src/apps/viewer/transport/controller";
import {
  completePending,
  completeRender,
  postToSandboxWithTimeout,
  refreshPendingSandboxRequestTimeout,
} from "../src/apps/viewer/transport/sandbox-client";

describe("viewer app support owners", () => {
  it("validates optional local paths without coercing foreign values", () => {
    const calls: string[] = [];
    const path = {
      toString() {
        calls.push("path");
        return "asset.png";
      },
    };
    expect(isSafeLocalAssetPath(path)).toBe(false);
    expect(isSafeLocalAssetPath(42)).toBe(false);
    expect(isSafeLocalAssetPath("images/asset.png")).toBe(true);
    expect(isSafeLocalAssetPath("../asset.png")).toBe(false);
    expect(isSafeLocalAssetPath("https://example.com/asset.png")).toBe(false);
    expect(isSafeLocalAssetPath(null)).toBe(true);
    expect(calls).toEqual([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes binding reads and formats diagnostics titles", () => {
    expect(createEmptyBindingReads()).toEqual({
      clips: [],
      controls: [],
      inputFrames: [],
      layerGateReads: [],
      layers: [],
      phases: [],
      primitiveBounds: [],
      primitivePaintReads: [],
      tracks: [],
    });
    expect(
      normalizeBindingReads({
        clips: ["clip-a", "clip-a", ""],
        controls: [2],
        tracks: ["track-b", "track-a"],
      }),
    ).toEqual({
      clips: ["clip-a"],
      controls: ["2"],
      inputFrames: [],
      layerGateReads: [],
      layers: [],
      phases: [],
      primitiveBounds: [],
      primitivePaintReads: [],
      tracks: ["track-a", "track-b"],
    });
    expect(formatBindingReadsTitle(null)).toBe("Renderer bindings: none");
    expect(formatBindingReadsTitle({ tracks: ["x"], layers: ["layer"] })).toBe(
      "Renderer bindings\ntracks: x\nlayers: layer",
    );
  });

  it("formats the complete diagnostic log in chronological DOM order", () => {
    expect(
      formatDiagnosticsText([
        { textContent: "08:00:00 · Ready" },
        { textContent: "  " },
        { textContent: "08:00:01 · Rendered" },
      ]),
    ).toBe("08:00:00 · Ready\n08:00:01 · Rendered");
  });

  it("leaves Ctrl+C to the browser for selected text", () => {
    const { ctx, event, preventDefault, copySelectedKeyframes } =
      createCopyFixture(false);
    ctx.handleGlobalKeydown(event);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(copySelectedKeyframes).not.toHaveBeenCalled();
  });

  it("claims Ctrl+C only when selected keyframes were copied", () => {
    const { ctx, event, preventDefault } = createCopyFixture(true);
    ctx.handleGlobalKeydown(event);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("creates default viewer state with isolated collections", () => {
    const first = createViewerState();
    const second = createViewerState();

    first.assets.set("asset", { id: "asset" });
    first.pending.set("request", {
      expire: vi.fn<() => void>(),
      reject: vi.fn<(reason: unknown) => void>(),
      resolve: vi.fn<(value: unknown) => void>(),
      timeoutMs: 100,
      timer: 0,
    });

    expect(first.loopPlayback).toBe(true);
    expect(first.mp4Export).toMatchObject({
      fps: 30,
      inFlight: false,
      sizePreset: "1280x720",
    });
    expect(first.playbackRange).toBeNull();
    expect(first.playbackRun).toEqual({
      generation: 0,
      mode: "live",
      phase: "idle",
      templateId: null,
    });
    expect(first.selectedItem).toEqual({ type: "effect" });
    expect(first.activeSidebarGroup).toBe("inspect");
    expect(first.theme).toBe("dark");
    expect(first.lastBindingReads).toEqual(createEmptyBindingReads());
    expect(second.assets.size).toBe(0);
    expect(second.pending.size).toBe(0);
  });

  it("starts with an explicit default or a standalone v1 effect", () => {
    expect(
      getInitialTemplateId([
        { effectV1: { kind: "transition" }, id: "transition" },
        { effectV1: { kind: "standalone" }, id: "standalone" },
      ]),
    ).toBe("standalone");
    expect(
      getInitialTemplateId([
        { effectV1: { kind: "standalone" }, id: "standalone" },
        {
          default: true,
          id: "explicit",
          effectV1: { kind: "targetEffect" },
        },
      ]),
    ).toBe("explicit");
    expect(
      getInitialTemplateId([
        { effectV1: { kind: "transition" }, id: "transition" },
        { effectV1: { kind: "targetEffect" }, id: "target" },
      ]),
    ).toBe("transition");
  });

  it("distinguishes preview preparation from ordinary playback", () => {
    const ctx = createViewerContextFixture();
    const playButton = ctx.refs.playButton;
    const setIconButton = vi
      .spyOn(ctx, "setIconButton")
      .mockImplementation(() => {});
    ctx.deps.t = (key, fallback) => fallback ?? key;
    ctx.state.playing = true;
    ctx.state.previewCacheWarmActive = true;
    ctx.state.previewVideoCache.recording = true;

    ctx.syncPlaybackButtons();
    expect(setIconButton).toHaveBeenCalledWith(
      playButton,
      "pause",
      "Pause preview preparation",
    );

    setIconButton.mockClear();
    ctx.state.playing = false;
    ctx.syncPlaybackButtons();
    expect(setIconButton).toHaveBeenCalledWith(
      playButton,
      "play",
      "Continue preview preparation",
    );
  });

  it("does not validate an unfinished renderer contract as missing bindings", () => {
    const ctx = createViewerContextFixture();
    const state = ctx.state;
    state.currentTemplate = { id: "template", duration: 1 };
    state.rendererContractTemplateId = "template";
    state.rendererContractCoverageReady = false;

    expect(isRendererContractCoveragePending(ctx)).toBe(true);
    state.rendererContractCoverageReady = true;
    expect(isRendererContractCoveragePending(ctx)).toBe(false);
    state.rendererContractTemplateId = "previous-template";
    expect(isRendererContractCoveragePending(ctx)).toBe(true);
    state.rendererContractTemplateId = "template";
    state.rendererContractCoverageReady = false;
    state.rendererContractCoverageLockedForTest = true;
    expect(isRendererContractCoveragePending(ctx)).toBe(false);
  });

  it("omits renderer coverage from validation until the audit is ready", () => {
    const ctx = createViewerContextFixture();
    const collectEditorValidationIssuesModel = vi
      .spyOn(ctx.deps, "collectEditorValidationIssuesModel")
      .mockReturnValue([]);
    const state = ctx.state;
    state.currentTemplate = { id: "template", duration: 1 };
    state.rendererContractTemplateId = "template";
    state.rendererContractReads.layers = ["box"];

    ctx.collectEditorValidationIssues(state.currentTemplate);
    expect(
      requiredEntry(
        collectEditorValidationIssuesModel.mock.calls,
        collectEditorValidationIssuesModel.mock.calls.length - 1,
      )[1]?.rendererCoverage,
    ).toBeNull();

    state.rendererContractCoverageReady = true;
    ctx.collectEditorValidationIssues(state.currentTemplate);
    expect(
      requiredEntry(
        collectEditorValidationIssuesModel.mock.calls,
        collectEditorValidationIssuesModel.mock.calls.length - 1,
      )[1]?.rendererCoverage,
    ).toBe(state.rendererContractReads);
  });

  it("isolates the local sandbox on a cross-site host", () => {
    expect(resolveSandboxHost("127.0.0.1")).toBe("localhost");
    expect(resolveSandboxHost("localhost")).toBe("127.0.0.1");
    expect(resolveSandboxHost("editor.example.com")).toBe("editor.example.com");
  });

  it("accepts only valid sandbox transport ports", () => {
    expect(resolveSandboxPort("4278", "4178")).toBe("4278");
    expect(resolveSandboxPort("0", "4178")).toBe("4178");
    expect(resolveSandboxPort("65536", "4178")).toBe("4178");
    expect(resolveSandboxPort("12/path", "4178")).toBe("4178");
    expect(resolveSandboxPort(null, "invalid")).toBe("4178");
  });

  it("queries stable DOM refs through selector ownership", () => {
    const querySelector = vi.fn<(selector: string) => { selector: string }>(
      (selector) => ({ selector }),
    );
    const querySelectorAll = vi.fn<
      (selector: string) => { selector: string; index: number }[]
    >((selector) =>
      Array.from(
        { length: selector === "[data-sidebar-tab]" ? 3 : 2 },
        (_, index) => ({ selector, index }),
      ),
    );
    vi.stubGlobal("document", { querySelector, querySelectorAll });

    const refs = createViewerRefs();

    expect(refs.canvas).toEqual({ selector: "#previewCanvas" });
    expect(refs.appShell).toEqual({ selector: ".app-shell" });
    expect(refs.sidebarTabs).toHaveLength(3);
    expect(querySelectorAll).toHaveBeenCalledWith("[data-sidebar-tab]");
  });

  it("resolves, expires, and marks stale sandbox requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      clearTimeout: globalThis.clearTimeout,
      location: { href: "http://127.0.0.1:4177/" },
      setTimeout: globalThis.setTimeout,
    });
    const state = createViewerState();
    const postMessage =
      vi.fn<
        (
          message: unknown,
          targetOrigin?: string | WindowPostMessageOptions,
          transfer?: Transferable[],
        ) => void
      >();
    const frame = {
      contentWindow: { postMessage },
      src: "http://localhost:4178/sandbox.html",
    } satisfies Parameters<typeof postToSandboxWithTimeout>[1];

    const pending = postToSandboxWithTimeout(
      state,
      frame,
      { kind: "renderFrame", requestId: "r1" },
      100,
    );
    completePending(state, { ok: true, requestId: "r1" });
    await expect(pending).resolves.toEqual({ ok: true, requestId: "r1" });
    expect(postMessage).toHaveBeenCalledWith(
      { kind: "renderFrame", requestId: "r1" },
      "http://localhost:4178",
      [],
    );

    const directPost =
      vi.fn<
        NonNullable<typeof state.directRenderResponsePort>["postMessage"]
      >();
    state.directRenderEffectIds.add("worker-effect");
    state.directRenderResponsePort = {
      postMessage: directPost,
      close: vi.fn<() => void>(),
      presentationSurfaceAttached: true,
    };
    const direct = postToSandboxWithTimeout(
      state,
      frame,
      {
        effectId: "worker-effect",
        kind: "renderFrame",
        requestId: "direct:1",
      },
      100,
    );
    expect(directPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "direct:1" }),
      [],
    );
    completeRender(state, { ok: true, requestId: "direct:1" });
    await expect(direct).resolves.toMatchObject({ ok: true });

    const cached = postToSandboxWithTimeout(
      state,
      frame,
      {
        effectId: "worker-effect",
        kind: "renderFrame",
        previewCacheEnabled: true,
        requestId: "cache:direct-bypass",
      },
      100,
    );
    expect(directPost).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: "cache:direct-bypass" }),
      "http://localhost:4178",
      [],
    );
    completeRender(state, { ok: true, requestId: "cache:direct-bypass" });
    await expect(cached).resolves.toMatchObject({ ok: true });

    const contract = postToSandboxWithTimeout(
      state,
      frame,
      {
        bindingReadMode: "contract",
        effectId: "worker-effect",
        kind: "renderFrame",
        requestId: "contract:1",
      },
      100,
    );
    expect(directPost).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: "contract:1" }),
      "http://localhost:4178",
      [],
    );
    completeRender(state, { ok: true, requestId: "contract:1" });
    await expect(contract).resolves.toMatchObject({ ok: true });

    const render = postToSandboxWithTimeout(
      state,
      frame,
      { kind: "renderFrame", requestId: "r2" },
      100,
    );
    completeRender(state, { ok: true, requestId: "r2" });
    await expect(render).resolves.toEqual({ ok: true, requestId: "r2" });

    const cacheStore = postToSandboxWithTimeout(
      state,
      frame,
      { kind: "renderFrame", requestId: "cache:1" },
      100,
    );
    await vi.advanceTimersByTimeAsync(90);
    expect(refreshPendingSandboxRequestTimeout(state, "cache:1")).toBe(true);
    await vi.advanceTimersByTimeAsync(90);
    expect(state.pending.has("cache:1")).toBe(true);
    completeRender(state, { ok: true, requestId: "cache:1" });
    await expect(cacheStore).resolves.toMatchObject({ ok: true });

    completeRender(state, { ok: true, requestId: "missing" });
    expect(state.staleResponses).toBe(1);

    const timedOut = postToSandboxWithTimeout(
      state,
      frame,
      { kind: "renderFrame", requestId: "r3" },
      100,
    );
    await Promise.all([
      expect(timedOut).rejects.toThrow(
        "renderFrame (r3) timed out after 100ms.",
      ),
      vi.advanceTimersByTimeAsync(100),
    ]);
    expect(state.pending.has("r3")).toBe(false);
  });
});

it("rejects arbitrary viewer actions at the compiler boundary", () => {
  expectTypeOf<
    string extends keyof ViewerAppContext ? true : false
  >().toEqualTypeOf<false>();
  expectTypeOf<
    "unregisteredViewerAction" extends keyof ViewerAppContext ? true : false
  >().toEqualTypeOf<false>();
});

function createCopyFixture(isCollapsed: boolean) {
  const ctx = createViewerContextFixture();
  vi.stubGlobal("window", {
    getSelection: () => ({
      isCollapsed,
      toString: () => (isCollapsed ? "" : "selected log text"),
    }),
  });
  class FixtureKeyboardEvent {
    code = "KeyC";
    ctrlKey = true;
    metaKey = false;
    target = null;
    preventDefault(): void {}
  }
  vi.stubGlobal("KeyboardEvent", FixtureKeyboardEvent);
  const event = new KeyboardEvent("keydown");
  const preventDefault = vi.spyOn(event, "preventDefault");
  const copySelectedKeyframes = vi
    .spyOn(ctx, "copySelectedKeyframes")
    .mockReturnValue(true);
  vi.spyOn(ctx, "isEditingFormControl").mockReturnValue(false);
  return { ctx, event, preventDefault, copySelectedKeyframes };
}
