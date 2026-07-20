import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clamp,
  createRequestId,
  easeInOutCubic,
  easeOutCubic,
  readControlValue,
} from "../src/sdk/protocol";
import { drawSampleScene } from "../src/sdk/sample-scene";
import { loadDemoPack } from "../src/sdk/validator";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SDK protocol helpers", () => {
  it("creates request ids and resolves numeric/control helpers", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456789);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createRequestId("render")).toMatch(/^render:/);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 5);
    expect(readControlValue({ speed: "" }, "speed", 1)).toBe(1);
    expect(readControlValue({ speed: 2 }, "speed", 1)).toBe(2);
  });
});

describe("SDK sample scene", () => {
  it("draws sample backgrounds and skips grid for blank phase", () => {
    const context = createCanvasContextSpy();

    drawSampleScene(context, {
      height: 180,
      phase: "blank",
      progress: 0.25,
      width: 320,
    });

    expect(context.createLinearGradient).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(context.stroke).not.toHaveBeenCalled();

    drawSampleScene(context, {
      height: 180,
      phase: "next",
      progress: 0.75,
      width: 320,
    });

    expect(context.stroke).toHaveBeenCalled();
  });
});

describe("SDK demo pack validator", () => {
  it("loads a valid graph-only demo pack with declared assets", async () => {
    vi.stubGlobal("fetch", createDemoFetch());

    const result = await loadDemoPack("/demo/");

    expect(result.errors).toEqual([]);
    expect(result.pack).toMatchObject({ packId: "demo-pack" });
    expect(result.assets.get("asset-logo")).toMatchObject({
      id: "asset-logo",
      kind: "svg",
      svgText: "<svg></svg>",
    });
    expect(result.assets.get("asset-sound")).toMatchObject({
      id: "asset-sound",
      kind: "audio",
      mimeType: "audio/ogg",
    });
    expect(result.modules.get("module-1")).toMatchObject({
      document: { program: { kind: "graph" } },
      id: "module-1",
    });
    expect(result.templates).toHaveLength(1);
  });

  it("rejects executable module paths and runtime capability escape hatches", async () => {
    vi.stubGlobal(
      "fetch",
      createDemoFetch({
        "/demo/manifest.json": {
          ...createDemoManifest(),
          modules: [
            {
              id: "module-1",
              path: "effects/module.js",
              runtimeCapabilities: ["r3f"],
            },
          ],
        },
      }),
    );

    const invalid = await loadDemoPack("/demo/");
    expect(invalid.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "manifest.modules.0.path",
        "manifest.modules.0.document",
        "manifest.modules.0.runtimeCapabilities",
      ]),
    );
  });

  it("reports deterministic diagnostics for unsafe manifests and modules", async () => {
    vi.stubGlobal(
      "fetch",
      createDemoFetch({
        "/demo/manifest.json": {
          assets: [
            { id: "", kind: "binary", mimeType: "text/plain", path: "../x" },
          ],
          engineVersion: "wrong",
          modules: [{ id: "", path: "http://example.test/effect.js" }],
          packId: "",
          templates: ["../template.json"],
          version: "",
        },
      }),
    );

    const result = await loadDemoPack("/demo/");
    const diagnostics = result.errors.map((error) => error.path);

    expect(result.pack).toBeNull();
    expect(diagnostics).toContain("manifest.packId");
    expect(diagnostics).toContain("manifest.engineVersion");
    expect(diagnostics).toContain("manifest.templates.0");
    expect(diagnostics).toContain("manifest.modules.0.path");
    expect(diagnostics).toContain("manifest.assets.0.kind");
  });
});

function createDemoFetch(overrides: Record<string, unknown> = {}) {
  const files = {
    "/demo/assets/logo.svg": new Blob(["<svg></svg>"], {
      type: "image/svg+xml",
    }),
    "/demo/assets/sound.ogg": new Blob(["sound"], {
      type: "audio/ogg",
    }),
    "/demo/effects/module.sniptale-effect.json": createDemoEffectDocument(),
    "/demo/manifest.json": createDemoManifest(),
    ...overrides,
  };

  return vi.fn(async (url: string) => {
    if (!(url in files)) {
      return createResponse(null, false, 404);
    }
    return createResponse(files[url]);
  });
}

function createDemoManifest() {
  return {
    assets: [
      {
        height: 64,
        id: "asset-logo",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "assets/logo.svg",
        size: 11,
        width: 128,
      },
      {
        duration: 1,
        id: "asset-sound",
        kind: "audio",
        mimeType: "audio/ogg",
        path: "assets/sound.ogg",
        size: 5,
      },
    ],
    engineVersion: "2.0-prototype",
    modules: [
      { id: "module-1", document: "effects/module.sniptale-effect.json" },
    ],
    packId: "demo-pack",
    templates: [],
    version: "1",
  };
}

function createDemoEffectDocument() {
  return {
    assets: [
      {
        height: 64,
        id: "asset-logo",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "assets/logo.svg",
        width: 128,
      },
      {
        duration: 1,
        id: "asset-sound",
        kind: "audio",
        mimeType: "audio/ogg",
        path: "assets/sound.ogg",
      },
    ],
    clips: [
      { duration: 2, layerId: "logo", start: 0 },
      { duration: 2, layerId: "sound", start: 0 },
    ],
    controls: [],
    duration: 2,
    id: "module-1",
    kind: "standalone",
    label: { en: "Demo", ru: "Демо" },
    layers: [
      {
        assetId: "asset-logo",
        height: 64,
        id: "logo",
        type: "svgAsset",
        width: 128,
      },
      { assetId: "asset-sound", id: "sound", type: "audio" },
    ],
    program: {
      commands: [
        { color: "#101820", op: "clear" },
        {
          assetId: "asset-logo",
          height: 64,
          op: "image",
          width: 128,
          x: 0,
          y: 0,
        },
      ],
      kind: "graph",
      version: 1,
    },
    scenes: [{ duration: 2, id: "main", start: 0 }],
    schemaVersion: "sniptale.effect.v1",
    timeline: { phases: [], tracks: [] },
  };
}

function createResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    async blob() {
      return body instanceof Blob
        ? body
        : new Blob([String(body)], { type: "text/plain" });
    },
    async json() {
      return body;
    },
    async text() {
      return String(body);
    },
  };
}

function createCanvasContextSpy(): any {
  const gradient = { addColorStop: vi.fn() };
  return {
    arcTo: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fill: vi.fn(),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  };
}
