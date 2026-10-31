#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EFFECT_V1_KINDS,
  validateEffectV1Document,
  type EffectV1Kind,
} from "../../src/sdk/effect-v1/index.js";

import { createStarterDocument } from "../../src/apps/cli/starter.js";

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.id) {
    fail("--id is required.");
  }
  if (!isEffectKind(args.kind)) {
    fail(`--kind must be one of: ${EFFECT_V1_KINDS.join(", ")}.`);
  }

  const document = createStarterDocument(args.id, args.kind);
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
    if (argument === undefined) fail("Argument is missing.");
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

function isEffectKind(value: string): value is EffectV1Kind {
  return EFFECT_V1_KINDS.some((kind) => kind === value);
}
