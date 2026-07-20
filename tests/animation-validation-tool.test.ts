import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { materializeEffectImportFiles } from "../src/apps/viewer/effect-file/import-materialization.js";
import { remapImportedAssetIdentity } from "../src/apps/viewer/effect-file/import-asset-identity.js";
import { validateEffectV1Document } from "../src/sdk/effect-v1/index.js";

const execFileAsync = promisify(execFile);

describe("Effect v1 authoring tools", () => {
  it("checks generated schema freshness without rewriting it", async () => {
    const before = await readFile(
      "schemas/sniptale-effect-v1.schema.json",
      "utf8",
    );

    const result = await execFileAsync("npm", [
      "run",
      "-s",
      "effect:schema:check",
    ]);

    expect(result.stdout).toContain("is current");
    expect(
      await readFile("schemas/sniptale-effect-v1.schema.json", "utf8"),
    ).toBe(before);
  });

  it.each([
    {
      fill: "#fff",
      height: 10,
      op: "fillRect",
      width: 10,
      x: 0,
      y: 0,
    },
    {
      assetId: "pixel",
      height: 10,
      op: "image",
      width: 10,
      x: 0,
      y: 0,
    },
    {
      op: "path",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      stroke: "#fff",
    },
    {
      op: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      stroke: "#fff",
    },
    {
      from: 0,
      op: "sampledPath",
      samples: 24,
      stroke: "#fff",
      to: 1,
      x: { op: "mul", args: [{ op: "read", path: "vars.sample" }, 10] },
      y: { op: "mul", args: [{ op: "read", path: "vars.sample" }, 5] },
    },
    {
      height: 10,
      op: "shape",
      shape: "rect",
      width: 10,
      x: 0,
      y: 0,
    },
    {
      assetId: "vector",
      height: 10,
      op: "svgParts",
      part: {
        alpha: { op: "read", path: "item.index" },
        kind: "custom",
        x: { op: "read", path: "item.cx" },
      },
      width: 10,
      x: 0,
      y: 0,
    },
    { op: "text", text: "Styled", x: 0, y: 0 },
  ])("keeps the styled command contract aligned for $op", (command) => {
    const document = createDocument();
    document.assets = [
      {
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        height: 1,
        id: "pixel",
        kind: "image",
        mimeType: "image/png",
        width: 1,
      },
      {
        id: "vector",
        kind: "svg",
        mimeType: "image/svg+xml",
        svgText:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>',
      },
    ];
    document.program.commands = [
      {
        ...command,
        alpha: 0.8,
        blend: "screen",
        filter: { blur: 2 },
        shadow: { blur: 4, color: "rgba(0,0,0,.4)", x: 1, y: 2 },
      },
    ];

    const result = validateEffectV1Document(document);

    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_FIELD" }),
      ]),
    );
  });

  it.each([
    [
      "unknown shape",
      { op: "shape", shape: "trianlge", width: 20, height: 20, x: 0, y: 0 },
      "COMMAND_ENUM",
    ],
    [
      "string geometry",
      { op: "shape", shape: "rect", width: "wide", height: 20, x: 0, y: 0 },
      "COMMAND_NUMBER",
    ],
    [
      "invalid text alignment",
      { op: "text", text: "A", x: 0, y: 0, align: "diagonal" },
      "COMMAND_ENUM",
    ],
    [
      "missing render pass",
      { op: "compositePass", passId: "never-created" },
      "RENDER_PASS_UNKNOWN",
    ],
    [
      "malformed gradient",
      {
        op: "fillRect",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: { kind: "linearGradient", stops: [{ offset: 5 }] },
      },
      "GRADIENT_FIELD_REQUIRED",
    ],
    [
      "empty loop",
      { op: "forEach", items: [], commands: [] },
      "COMMAND_ITEMS_EMPTY",
    ],
    [
      "unbounded sampled path",
      {
        from: 0,
        op: "sampledPath",
        samples: 1024,
        stroke: "#fff",
        to: 1,
        x: 0,
        y: 0,
      },
      "SAMPLED_PATH_BOUND",
    ],
  ])("rejects %s before runtime", (_label, command, code) => {
    const document = createDocument();
    document.program.commands = [command];
    const result = validateEffectV1Document(document);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("rejects a control that creates inert editor UI", () => {
    const document = createDocument();
    document.controls = [
      {
        defaultValue: 0.5,
        id: "strength",
        kind: "number",
        label: { en: "Strength", ru: "Сила" },
        max: 1,
        min: 0,
        step: 0.01,
      },
    ];

    const result = validateEffectV1Document(document);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CONTROL_UNUSED",
          path: "$.controls[0]",
        }),
      ]),
    );
  });

  it("rejects a phase that never gates a track or keyframe", () => {
    const document = createDocument();
    document.timeline.phases = [
      { duration: 1, id: "unused", sceneId: "main", start: 0 },
    ];

    const result = validateEffectV1Document(document);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PHASE_UNUSED",
          path: "$.timeline.phases[0]",
        }),
      ]),
    );
  });

  it.each([
    ["targetEffect", ["source"]],
    ["transition", ["from", "to"]],
  ])("requires every %s runtime input to be consumed", (kind, inputs) => {
    const document = createDocument();
    document.kind = kind;
    document.program.commands = [{ color: "#101820", op: "clear" }];

    const result = validateEffectV1Document(document);

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics
        .filter((item) => item.code === "RUNTIME_INPUT_REQUIRED")
        .map((item) => item.message),
    ).toEqual(
      inputs.map(
        (input) =>
          `Effect kind requires runtime input "${input}", but the graph never reads it.`,
      ),
    );
  });

  it("returns machine-readable CLI diagnostics", async () => {
    const directory = await mkdtemp(join(tmpdir(), "effect-v1-tool-"));
    const validPath = join(directory, "valid.sniptale-effect.json");
    const invalidPath = join(directory, "invalid.sniptale-effect.json");
    await writeFile(validPath, JSON.stringify(createDocument()));
    await writeFile(
      invalidPath,
      JSON.stringify({ ...createDocument(), renderer: { source: "return 1" } }),
    );

    const valid = await execFileAsync("npm", [
      "run",
      "-s",
      "effect:validate",
      "--",
      validPath,
      "--json",
    ]);
    expect(JSON.parse(valid.stdout)).toMatchObject({ ok: true });
    await expect(
      execFileAsync("npm", [
        "run",
        "-s",
        "effect:validate",
        "--",
        invalidPath,
        "--json",
      ]),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("EXECUTABLE_FIELD_FORBIDDEN"),
    });
  });

  it("materializes selected bundle files with integrity metadata", async () => {
    const document = createDocument();
    document.assets = [
      {
        height: 1,
        id: "pixel",
        kind: "image",
        mimeType: "image/png",
        path: "assets/pixel.png",
        width: 1,
      },
    ];
    const effectFile = new File(
      [JSON.stringify(document)],
      "materialized.sniptale-effect.json",
      { type: "application/json" },
    );
    const imageFile = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "pixel.png",
      { type: "image/png" },
    );

    const result = await materializeEffectImportFiles([effectFile, imageFile]);
    const materialized = JSON.parse(result.source);

    expect(materialized.assets[0]).toMatchObject({
      byteLength: 8,
      dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects missing selected bundle files", async () => {
    const document = createDocument();
    document.assets = [
      {
        id: "missing",
        kind: "image",
        mimeType: "image/png",
        path: "missing.png",
      },
    ];
    const effectFile = new File(
      [JSON.stringify(document)],
      "missing.sniptale-effect.json",
      { type: "application/json" },
    );

    await expect(materializeEffectImportFiles([effectFile])).rejects.toThrow(
      /Missing file for asset/,
    );
  });

  it("remaps colliding asset ids through layers and nested graph commands", () => {
    const document = createDocument();
    document.assets = [
      {
        id: "logo",
        kind: "image",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AQ==",
      },
    ];
    document.layers = [
      {
        assetId: "logo",
        height: 10,
        id: "image",
        type: "imageAsset",
        width: 10,
      },
    ];
    document.clips = [{ duration: 2, layerId: "image", start: 0 }];
    document.program.commands = [
      {
        commands: [
          { assetId: "logo", height: 10, op: "image", width: 10, x: 0, y: 0 },
        ],
        op: "group",
      },
    ];

    const remapped = remapImportedAssetIdentity(
      document,
      ["logo"],
      "effect-a",
    ) as any;
    expect(remapped.assets[0].id).toBe("effect-a-logo");
    expect(remapped.layers[0].assetId).toBe("effect-a-logo");
    expect(remapped.program.commands[0].commands[0].assetId).toBe(
      "effect-a-logo",
    );
  });
});

function createDocument(): any {
  return {
    assets: [],
    clips: [],
    controls: [],
    duration: 2,
    id: "agent-proof",
    kind: "standalone",
    label: { en: "Agent proof", ru: "Проверка агента" },
    layers: [],
    program: {
      commands: [{ color: "#101820", op: "clear" }],
      kind: "graph",
      version: 1,
    },
    scenes: [{ duration: 2, id: "main", start: 0 }],
    schemaVersion: "sniptale.effect.v1",
    timeline: { phases: [], tracks: [] },
  };
}
