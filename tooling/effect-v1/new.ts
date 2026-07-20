#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EFFECT_V1_KINDS,
  EFFECT_V1_SCHEMA,
  validateEffectV1Document,
  type EffectV1Kind,
} from "../../src/sdk/effect-v1/index.js";

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.id) {
    fail("--id is required.");
  }
  if (!EFFECT_V1_KINDS.includes(args.kind as EffectV1Kind)) {
    fail(`--kind must be one of: ${EFFECT_V1_KINDS.join(", ")}.`);
  }

  const document = createStarterDocument(args.id, args.kind as EffectV1Kind);
  const validation = validateEffectV1Document(document);
  if (!validation.ok) {
    fail(
      `Internal starter document is invalid: ${validation.diagnostics[0]?.message}`,
    );
  }
  const target = resolve(
    args.output ??
      `${args.id.replace(/[^a-z0-9._-]+/gi, "-")}.sniptale-effect.json`,
  );
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: "utf8",
    flag: args.force ? "w" : "wx",
  });
  process.stdout.write(`Created ${target}\n`);
}

export function createStarterDocument(id: string, kind: EffectV1Kind): any {
  const label = titleFromId(id);
  const inputCommands = createInputCommands(kind);
  return {
    assets: [],
    clips: [
      { duration: 3, layerId: "background", sceneId: "main", start: 0 },
      { duration: 3, layerId: "title", sceneId: "main", start: 0 },
    ],
    controls: [
      {
        defaultValue: "#5f7cff",
        id: "accent",
        kind: "color",
        label: { en: "Accent", ru: "Акцент" },
      },
    ],
    description: {
      en: `Agent-ready ${kind} starter.`,
      ru: `Стартовый шаблон ${kind} для агента.`,
    },
    duration: 3,
    id,
    kind,
    label: { en: label, ru: label },
    layers: [
      {
        height: 720,
        id: "background",
        name: "Background",
        type: "rect",
        width: 1280,
      },
      {
        height: 120,
        id: "title",
        name: "Title",
        text: label,
        type: "text",
        width: 900,
        x: 640,
        y: 360,
      },
    ],
    program: {
      commands: [
        ...inputCommands,
        {
          fill: { op: "read", path: "controls.accent" },
          height: 180,
          layerId: "background",
          op: "shape",
          radius: 32,
          shape: "roundRect",
          width: 920,
          x: {
            args: [
              140,
              {
                args: [{ op: "read", path: "progress" }, 80],
                op: "mul",
              },
            ],
            op: "add",
          },
          y: 270,
        },
        {
          align: "center",
          baseline: "middle",
          fill: "#ffffff",
          fontFamily: "system-ui",
          fontSize: 54,
          fontWeight: 650,
          layerId: "title",
          op: "text",
          text: label,
          x: 0,
          y: 0,
        },
      ],
      kind: "graph",
      version: 1,
    },
    scenes: [{ duration: 3, id: "main", label: "Main", start: 0 }],
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: { phases: [], tracks: [] },
  };
}

function createInputCommands(kind: EffectV1Kind): any[] {
  if (kind === "targetEffect") {
    return [
      { op: "clear" },
      {
        fit: "cover",
        height: { op: "read", path: "height" },
        input: "source",
        layerId: "background",
        op: "image",
        width: { op: "read", path: "width" },
        x: 0,
        y: 0,
      },
    ];
  }
  if (kind === "transition") {
    return [
      { op: "clear" },
      {
        alpha: {
          args: [1, { op: "read", path: "progress" }],
          op: "sub",
        },
        fit: "cover",
        height: { op: "read", path: "height" },
        input: "from",
        layerId: "background",
        op: "image",
        width: { op: "read", path: "width" },
        x: 0,
        y: 0,
      },
      {
        alpha: { op: "read", path: "progress" },
        fit: "cover",
        height: { op: "read", path: "height" },
        input: "to",
        layerId: "background",
        op: "image",
        width: { op: "read", path: "width" },
        x: 0,
        y: 0,
      },
    ];
  }
  return [{ color: "#10131d", op: "clear" }];
}

function parseArgs(argv: string[]) {
  const parsed: {
    force: boolean;
    help: boolean;
    id: string | null;
    kind: string;
    output: string | null;
  } = {
    force: false,
    help: false,
    id: null,
    kind: "standalone",
    output: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--force") parsed.force = true;
    else if (argument === "--help" || argument === "-h") parsed.help = true;
    else if (["--id", "--kind", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        fail(`${argument} requires a value.`);
      if (argument === "--id") parsed.id = value;
      if (argument === "--kind") parsed.kind = value;
      if (argument === "--output") parsed.output = value;
      index += 1;
    } else {
      fail(`Unexpected argument: ${argument}`);
    }
  }
  return parsed;
}

function titleFromId(value: string): string {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function fail(message: string): never {
  process.stderr.write(`${message}\n\n${usage()}`);
  process.exit(2);
}

function usage(): string {
  return [
    "Usage: npm run effect:new -- --id <id> [options]",
    "",
    "Options:",
    "  --kind <kind>      standalone, targetEffect, or transition",
    "  --output <path>    Output JSON path (defaults to <id>.sniptale-effect.json)",
    "  --force            Replace an existing file",
    "  --help             Show this help",
    "",
  ].join("\n");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
