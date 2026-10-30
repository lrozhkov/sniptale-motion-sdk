#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { formatSource } from "../qa/formatting/options.mjs";

import { EFFECT_V1_JSON_SCHEMA } from "../../src/sdk/effect-v1/index.js";

const outputFlag = process.argv.indexOf("--output");
const output =
  outputFlag >= 0 && process.argv[outputFlag + 1]
    ? resolve(process.argv[outputFlag + 1])
    : null;
const source = await formatSource(
  "sniptale-effect-v1.schema.json",
  JSON.stringify(EFFECT_V1_JSON_SCHEMA),
);

if (process.argv.includes("--check")) {
  if (!output) {
    process.stderr.write("--check requires --output <path>.\n");
    process.exitCode = 2;
  } else {
    const current = await readFile(output, "utf8").catch(() => "");
    if (current !== source) {
      process.stderr.write(
        `${output} is stale. Run npm run effect:schema to regenerate it.\n`,
      );
      process.exitCode = 1;
    } else {
      process.stdout.write(`${output} is current.\n`);
    }
  }
} else if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
  process.stdout.write(`${output}\n`);
} else {
  process.stdout.write(source);
}
