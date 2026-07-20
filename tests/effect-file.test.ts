import { describe, expect, it } from "vitest";

import {
  buildEffectFileAssets,
  buildEffectFilePayload,
  buildEffectFileSource,
  buildTemplateJson,
  isEffectV1ExportableTemplate,
} from "../src/apps/viewer/effect-file/builder";
import {
  normalizeEffectFilePayload,
  parseSniptaleEffectFilePayload,
  validateEffectFileAssetPayload,
  validateSniptaleEffectFile,
} from "../src/apps/viewer/effect-file/validation";
import { SNIPTALE_EFFECT_FILE_SCHEMA } from "../src/apps/viewer/app/constants";

describe("Effect v1 file builder", () => {
  it("builds deterministic, pure JSON without runtime source", () => {
    const template = createTemplate();
    const payload = buildEffectFilePayload({
      assets: createAssets(),
      module: { id: "ignored", source: "throw new Error('must not leak')" },
      template,
    });
    const source = buildEffectFileSource({ assets: createAssets(), template });

    expect(buildTemplateJson({ z: 1, a: 2 })).toBe(
      `${JSON.stringify({ z: 1, a: 2 }, null, 2)}\n`,
    );
    expect(payload).toMatchObject({
      id: "agent-card",
      kind: "standalone",
      schemaVersion: "sniptale.effect.v1",
      program: { kind: "graph", version: 1 },
    });
    expect(payload).not.toHaveProperty("artifactType");
    expect(payload).not.toHaveProperty("engineVersion");
    expect(payload).not.toHaveProperty("moduleId");
    expect(payload).not.toHaveProperty("renderer");
    expect(source).not.toContain("must not leak");
    expect(JSON.parse(source)).toEqual(payload);
  });

  it("preserves the public effect kind instead of duplicating target metadata", () => {
    const template = createTemplate("transition");
    const payload = buildEffectFilePayload({
      assets: createAssets(),
      template,
    });

    expect(payload.kind).toBe("transition");
    expect(payload).not.toHaveProperty("target");
    expect(payload).not.toHaveProperty("artifactType");
  });

  it("removes editor-only timeline duration from a strict Effect v1 export", () => {
    const template = createTemplate();
    template.timeline.duration = template.duration;
    const payload = buildEffectFilePayload({
      assets: createAssets(),
      template,
    });

    expect(payload.timeline).toEqual({ phases: [], tracks: [] });
    expect(validateSniptaleEffectFile(JSON.stringify(payload))).toMatchObject({
      errors: [],
      ok: true,
    });
  });

  it("serializes an explicit document-local asset closure", () => {
    expect(buildEffectFileAssets(createTemplate(), createAssets())).toEqual([
      {
        byteLength: 41,
        height: 64,
        id: "asset-logo",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "logo.svg",
        sha256:
          "1111111111111111111111111111111111111111111111111111111111111111",
        svgText: '<svg xmlns="http://www.w3.org/2000/svg"/>',
        width: 64,
      },
      {
        byteLength: 3,
        dataUrl: "data:image/png;base64,AAAA",
        height: 32,
        id: "asset-photo",
        kind: "image",
        mimeType: "image/png",
        path: "photo.png",
        sha256:
          "2222222222222222222222222222222222222222222222222222222222222222",
        width: 32,
      },
    ]);
  });

  it("exports only strict declarative Effect v1 documents", () => {
    expect(isEffectV1ExportableTemplate({ id: "not-v1" })).toBe(false);
    expect(() =>
      buildEffectFilePayload({ assets: new Map(), template: { id: "not-v1" } }),
    ).toThrow(/not an Effect v1/i);

    const template = createTemplate();
    template.effectV1.program = {
      fixtureId: "legacy-local-fixture",
      kind: "localFixture",
    };
    expect(isEffectV1ExportableTemplate(template)).toBe(false);
    expect(() =>
      buildEffectFilePayload({ assets: createAssets(), template }),
    ).toThrow(/declarative graph/i);
  });
});

describe("Effect v1 file validation", () => {
  it("parses, validates, and normalizes a v1 document", () => {
    const source = buildEffectFileSource({
      assets: createAssets(),
      template: createTemplate(),
    });
    const parsed = parseSniptaleEffectFilePayload(source);
    const validation = validateSniptaleEffectFile(source, {
      collectTemplateErrors: () => [],
    });
    const normalized = normalizeEffectFilePayload(validation.payload);

    expect(parsed.schemaVersion).toBe(SNIPTALE_EFFECT_FILE_SCHEMA);
    expect(validation).toMatchObject({ errors: [], ok: true });
    expect(normalized).toMatchObject({
      document: { kind: "standalone" },
      template: {
        effectId: "agent-card",
        kind: "composition",
        moduleId: "agent-card",
        target: "scene",
      },
    });
  });

  it("derives transition and target-effect adapters from kind", () => {
    const transition = normalizeEffectFilePayload(
      buildEffectFilePayload({
        assets: createAssets(),
        template: createTemplate("transition"),
      }),
    );
    const targetEffect = normalizeEffectFilePayload(
      buildEffectFilePayload({
        assets: createAssets(),
        template: createTemplate("targetEffect"),
      }),
    );

    expect(transition.template).toMatchObject({
      kind: "transitionEffect",
      target: "transitionBoundary",
    });
    expect(targetEffect.template).toMatchObject({
      kind: "layerEffect",
      target: "selectedTarget",
    });
  });

  it("rejects v3 wrappers and executable fields with actionable diagnostics", () => {
    const v3 = validateSniptaleEffectFile(
      'SniptaleEffect.define({"schemaVersion":"sniptale.effect.v3"});',
    );
    const executable = createTemplate().effectV1;
    executable.renderer = { kind: "compiled-js", source: "return 1" };
    const v1 = validateSniptaleEffectFile(JSON.stringify(executable));

    expect(v3.ok).toBe(false);
    expect(v3.errors.join("\n")).toContain("JSON_INVALID");
    expect(v1.ok).toBe(false);
    expect(v1.errors.join("\n")).toContain("EXECUTABLE_FIELD_FORBIDDEN");
  });

  it("keeps author asset safety validation available to the editor", () => {
    const errors: string[] = [];
    validateEffectFileAssetPayload(
      {
        id: "unsafe",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "../outside.svg",
        svgText: "<svg><script>alert(1)</script></svg>",
      },
      errors,
    );

    expect(errors.join("\n")).toContain("unsafe path");
    expect(errors.join("\n")).toContain("unsafe SVG");
  });
});

function createTemplate(kind = "standalone"): any {
  const document = {
    assets: [
      {
        height: 64,
        id: "asset-logo",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "logo.svg",
        width: 64,
      },
      {
        height: 32,
        id: "asset-photo",
        kind: "image",
        mimeType: "image/png",
        path: "photo.png",
        width: 32,
      },
    ],
    clips: [{ duration: 2, layerId: "card", sceneId: "main", start: 0 }],
    controls: [],
    description: { en: "Agent card", ru: "Карточка агента" },
    duration: 2,
    id: "agent-card",
    kind,
    label: { en: "Agent card", ru: "Карточка агента" },
    layers: [{ id: "card", name: "Card", type: "customDraw" }],
    presets: [],
    program: {
      commands: [
        { color: "#101820", op: "clear" },
        {
          assetId: "asset-logo",
          height: 64,
          op: "image",
          width: 64,
          x: 0,
          y: 0,
        },
        {
          assetId: "asset-photo",
          height: 32,
          op: "image",
          width: 32,
          x: 64,
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
  return {
    ...document,
    assets: ["asset-logo", "asset-photo"],
    effectId: "agent-card",
    effectV1: document,
    kind:
      kind === "transition"
        ? "transitionEffect"
        : kind === "targetEffect"
          ? "layerEffect"
          : "composition",
    moduleId: "agent-card",
    target:
      kind === "transition"
        ? "transitionBoundary"
        : kind === "targetEffect"
          ? "selectedTarget"
          : "scene",
  };
}

function createAssets(): Map<string, any> {
  return new Map([
    [
      "asset-logo",
      {
        byteLength: 41,
        height: 64,
        id: "asset-logo",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "logo.svg",
        sha256:
          "1111111111111111111111111111111111111111111111111111111111111111",
        svgText: '<svg xmlns="http://www.w3.org/2000/svg"/>',
        width: 64,
      },
    ],
    [
      "asset-photo",
      {
        byteLength: 3,
        dataUrl: "data:image/png;base64,AAAA",
        height: 32,
        id: "asset-photo",
        kind: "image",
        mimeType: "image/png",
        path: "photo.png",
        sha256:
          "2222222222222222222222222222222222222222222222222222222222222222",
        width: 32,
      },
    ],
  ]);
}
