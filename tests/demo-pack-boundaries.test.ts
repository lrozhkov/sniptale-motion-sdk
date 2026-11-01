import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDemoPack } from "../src/sdk/validator.js";
import { readTemplates } from "../src/sdk/demo-pack-validator/templates.js";
import { readModules } from "../src/sdk/demo-pack-validator/modules.js";
import { readAssets } from "../src/sdk/demo-pack-validator/assets.js";
import type { DemoPackIssue } from "../src/sdk/demo-pack-validator/common.js";

afterEach(() => vi.unstubAllGlobals());

function serveJson(value: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(value), {
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

describe("demo pack receiving boundaries", () => {
  it.each([null, false, 0, "", []])(
    "rejects a non-object manifest %#",
    async (manifest) => {
      serveJson(manifest);
      const result = await loadDemoPack("/pack/");
      expect(result.pack).toBeNull();
      expect(result.errors).toContainEqual({
        path: "manifest",
        message: "Expected manifest object.",
      });
      expect(result.assets.size).toBe(0);
      expect(result.modules.size).toBe(0);
    },
  );

  it.each([null, false, 0, "", []])(
    "rejects a non-object template %#",
    async (template) => {
      serveJson(template);
      const errors: DemoPackIssue[] = [];
      expect(
        await readTemplates("/pack/", { templates: ["template.json"] }, errors),
      ).toEqual([]);
      expect(errors).toContainEqual({
        path: "template.json",
        message: "Expected template object.",
      });
    },
  );

  it.each([null, false, 0, "", []])(
    "rejects a non-object Effect v1 module %#",
    async (document) => {
      serveJson(document);
      const errors: DemoPackIssue[] = [];
      const modules = await readModules(
        "/pack/",
        { modules: [{ id: "m", document: "effect.json" }] },
        errors,
      );
      expect(modules.size).toBe(0);
      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it("reports malformed nested collections instead of throwing", async () => {
    serveJson({
      id: "t",
      category: "c",
      kind: "overlay",
      moduleId: "m",
      effectId: "e",
      duration: 1,
      controls: [],
      layers: {},
      scenes: {},
      clips: [{ sceneId: { toString: 0 } }],
      timeline: { phases: {}, tracks: [], motionPaths: [] },
      assets: [{ toString: 0 }],
    });
    const errors: DemoPackIssue[] = [];
    await expect(
      readTemplates("/pack/", { templates: ["t.json"] }, errors),
    ).resolves.toHaveLength(1);
    expect(errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "t.json.layers",
        "t.json.clips.0.sceneId",
        "t.json.timeline.phases",
      ]),
    );
  });

  it.each(["", "\uFEFF"])(
    "materializes exportable SVG integrity from content with prefix %j",
    async (prefix) => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
      const body = prefix + svg;
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(body, {
              headers: { "content-type": "image/svg+xml" },
            }),
        ),
      );
      const errors: DemoPackIssue[] = [];
      const assets = await readAssets(
        "/pack/",
        {
          assets: [
            {
              id: "mark",
              path: "mark.svg",
              kind: "svg",
              mimeType: "image/svg+xml",
              size: Buffer.byteLength(body),
            },
          ],
        },
        errors,
      );
      expect(errors).toEqual([]);
      const asset = assets.get("mark");
      expect(asset?.svgText).toBe(svg);
      expect(asset).toMatchObject({
        byteLength: Buffer.byteLength(svg),
        sha256: createHash("sha256").update(svg).digest("hex"),
      });
    },
  );

  it("does not fetch assets with invalid receiving metadata", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const errors: DemoPackIssue[] = [];
    const assets = await readAssets(
      "/pack/",
      {
        assets: [
          null,
          { id: "bad", path: "a.png", kind: {}, mimeType: "image/png" },
          { id: "bad", path: "../a.png", kind: "image", mimeType: "image/png" },
        ],
      },
      errors,
    );
    expect(assets.size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
