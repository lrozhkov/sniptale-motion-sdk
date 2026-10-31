import { afterEach, describe, expect, it, vi } from "vitest";

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
import { installAppKeyboardOwner } from "../src/apps/viewer/app/keyboard";
import { createViewerRefs } from "../src/apps/viewer/app/refs";
import { createViewerState } from "../src/apps/viewer/app/state";
import { installAppShellOwner } from "../src/apps/viewer/app/shell";
import {
  installEditorValidationOwner,
  isRendererContractCoveragePending,
} from "../src/apps/viewer/editor/validation";
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
  afterEach(() => {
    vi.useRealTimers();
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
    vi.stubGlobal("Element", class {});
    vi.stubGlobal("window", {
      getSelection: () => ({
        isCollapsed: false,
        toString: () => "selected log text",
      }),
    });
    const preventDefault = vi.fn();
    const copySelectedKeyframes = vi.fn(() => true);
    const ctx = {
      copySelectedKeyframes,
      isEditingFormControl: () => false,
    } as any;
    installAppKeyboardOwner(ctx);

    ctx.handleGlobalKeydown({
      code: "KeyC",
      ctrlKey: true,
      metaKey: false,
      preventDefault,
      target: null,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(copySelectedKeyframes).not.toHaveBeenCalled();
  });

  it("claims Ctrl+C only when selected keyframes were copied", () => {
    vi.stubGlobal("Element", class {});
    vi.stubGlobal("window", {
      getSelection: () => ({ isCollapsed: true, toString: () => "" }),
    });
    const preventDefault = vi.fn();
    const ctx = {
      copySelectedKeyframes: vi.fn(() => true),
      isEditingFormControl: () => false,
    } as any;
    installAppKeyboardOwner(ctx);

    ctx.handleGlobalKeydown({
      code: "KeyC",
      ctrlKey: true,
      metaKey: false,
      preventDefault,
      target: null,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("creates default viewer state with isolated collections", () => {
    const first = createViewerState();
    const second = createViewerState();

    first.assets.set("asset", {});
    first.pending.set("request", {
      expire: vi.fn(),
      reject: vi.fn(),
      resolve: vi.fn(),
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
    const playButton = {};
    const fullscreenPlayButton = {};
    const setIconButton = vi.fn();
    const ctx = {
      deps: { t: (_key: string, fallback: string) => fallback },
      refs: { fullscreenPlayButton, playButton },
      setIconButton,
      state: {
        playing: true,
        previewCacheWarmActive: true,
        previewVideoCache: { recording: true },
      },
    } as any;
    installAppShellOwner(ctx);

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
    const state = createViewerState();
    state.currentTemplate = { id: "template", duration: 1 };
    state.rendererContractTemplateId = "template";
    state.rendererContractCoverageReady = false;
    const ctx = { state } as any;

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
    const collectEditorValidationIssuesModel = vi.fn(
      (_template: unknown, _options: { rendererCoverage: unknown }) => [],
    );
    const state = createViewerState();
    state.currentTemplate = { id: "template", duration: 1 };
    state.rendererContractTemplateId = "template";
    state.rendererContractReads = {
      ...state.rendererContractReads,
      layers: ["box"],
    };
    const ctx = {
      deps: {
        collectEditorValidationErrorsModel: vi.fn(() => []),
        collectEditorValidationIssuesModel,
        isSafeLocalAssetPath: vi.fn(),
        isSafeSvgAssetText: vi.fn(),
      },
      state,
    } as any;
    installEditorValidationOwner(ctx);

    ctx.collectEditorValidationIssues(state.currentTemplate);
    expect(
      collectEditorValidationIssuesModel.mock.lastCall?.[1].rendererCoverage,
    ).toBeNull();

    state.rendererContractCoverageReady = true;
    ctx.collectEditorValidationIssues(state.currentTemplate);
    expect(
      collectEditorValidationIssuesModel.mock.lastCall?.[1].rendererCoverage,
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
    const querySelector = vi.fn((selector: string) => ({ selector }));
    const querySelectorAll = vi.fn((selector: string) =>
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
    const state = {
      directRenderEffectIds: new Set<string>(),
      directRenderResponsePort: null,
      pending: new Map<string, any>(),
      staleResponses: 0,
    };
    const postMessage = vi.fn();
    const frame = {
      contentWindow: { postMessage },
      src: "http://localhost:4178/sandbox.html",
    } as any;

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

    const directPost = vi.fn();
    state.directRenderEffectIds.add("worker-effect");
    state.directRenderResponsePort = { postMessage: directPost } as any;
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
    const timeoutExpectation = expect(timedOut).rejects.toThrow(
      "renderFrame (r3) timed out after 100ms.",
    );
    await vi.advanceTimersByTimeAsync(100);
    await timeoutExpectation;
    expect(state.pending.has("r3")).toBe(false);
  });
});
