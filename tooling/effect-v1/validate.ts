#!/usr/bin/env node
import { resolve } from "node:path";

import { parseEffectV1Source } from "../../src/sdk/effect-v1/index.js";
import {
  EffectV1BundleError,
  readMaterializedEffectV1Bundle,
} from "../../src/apps/cli/bundle-source.js";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(usage());
  process.exit(0);
}
if (!args.file) {
  process.stderr.write(usage());
  process.exit(2);
}

try {
  const file = resolve(args.file);
  const result = parseEffectV1Source(
    await readMaterializedEffectV1Bundle(file, args.assetRoot),
  );
  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ ...result, document: result.ok ? undefined : undefined }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(formatHuman(file, result));
  }
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof EffectV1BundleError ? error.code : "INPUT_READ";
  const path = error instanceof EffectV1BundleError ? error.path : "$";
  const suggestion =
    error instanceof EffectV1BundleError ? error.suggestion : undefined;
  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          diagnostics: [
            {
              code,
              message,
              path,
              severity: "error",
              ...(suggestion ? { suggestion } : {}),
            },
          ],
          ok: false,
          proof: { runtime: "not-run", schema: "failed" },
          summary: { errors: 1, warnings: 0 },
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(
      `INVALID ${args.file}\nERROR ${code} ${path}: ${message}${suggestion ? `\n  Fix: ${suggestion}` : ""}\n`,
    );
  }
  process.exit(1);
}

function formatHuman(file: string, result: any): string {
  const lines = [
    `${result.ok ? "VALID" : "INVALID"} ${file}`,
    `Schema: ${result.ok ? "passed" : "failed"}; runtime proof: not run`,
    `Errors: ${result.summary.errors}; warnings: ${result.summary.warnings}`,
  ];
  for (const diagnostic of result.diagnostics) {
    lines.push(
      `${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
    );
    if (diagnostic.suggestion) lines.push(`  Fix: ${diagnostic.suggestion}`);
  }
  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv: string[]) {
  const parsed = {
    assetRoot: null as string | null,
    file: null as string | null,
    help: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") parsed.json = true;
    else if (argument === "--help" || argument === "-h") parsed.help = true;
    else if (argument === "--asset-root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        process.stderr.write("--asset-root requires a path.\n");
        process.exit(2);
      }
      parsed.assetRoot = resolve(value);
      index += 1;
    } else if (!parsed.file) parsed.file = argument;
    else {
      process.stderr.write(`Unexpected argument: ${argument}\n`);
      process.exit(2);
    }
  }
  return parsed;
}

function usage(): string {
  return [
    "Usage: npm run effect:validate -- <effect.sniptale-effect.json> [--asset-root <dir>] [--json]",
    "",
    "Static validation verifies schema, graph safety, asset bytes, MIME and hashes.",
    "Runtime/browser proof is added by the acceptance workflow.",
    "",
  ].join("\n");
}
