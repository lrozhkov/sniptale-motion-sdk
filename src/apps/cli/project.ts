import { mkdir, open, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  EFFECT_V1_SCHEMA,
  type EffectV1Kind,
} from "../../sdk/effect-v1/index.js";
import { MotionCliError } from "./errors.js";
import { createStarterDocument } from "./starter.js";
import { PROJECT_FILE, readProjectContract } from "./project-contract.js";
import { MOTION_COMPATIBILITY } from "../../shared/compatibility.js";

export async function initProject(
  cwd: string,
  directory: string,
  version: string,
) {
  const root = resolve(cwd, directory);
  await mkdir(root, { recursive: true });
  // Claim the project before adding directories. A retry never replaces metadata.
  await writeExclusive(join(root, PROJECT_FILE), {
    schemaVersion: MOTION_COMPATIBILITY.projectSchema,
    effectSchema: EFFECT_V1_SCHEMA,
    toolkitCompatibility: MOTION_COMPATIBILITY.toolkitCompatibility,
    createdWith: version,
  });
  for (const name of ["effects", "exports", ".tmp"]) {
    await mkdir(join(root, name), { recursive: true });
  }
  return { project: root };
}

export async function readProject(cwd: string): Promise<string> {
  return (await readProjectContract(cwd)).root;
}

export async function newEffect(cwd: string, id: string, kind: EffectV1Kind) {
  // This identifier is also a directory name on Windows. Never accept paths.
  if (
    !/^[a-z][a-z0-9_-]{0,63}$/.test(id) ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(id)
  ) {
    throw new MotionCliError(
      "EFFECT_ID",
      "Use 1–64 lowercase ASCII letters, digits, hyphens or underscores; start with a letter and avoid Windows device names.",
    );
  }
  const root = await readProject(cwd);
  const effects = join(root, "effects");
  await mkdir(effects, { recursive: true });
  if ((await realpath(effects)) !== effects) {
    throw new MotionCliError(
      "PROJECT_PATH",
      "The effects directory must not be a symbolic link.",
    );
  }
  const target = join(effects, id);
  await mkdir(target); // Exclusive directory creation protects an existing effect.
  const file = join(target, "effect.sniptale-effect.json");
  await writeExclusive(file, createStarterDocument(id, kind));
  return { file, kind };
}

async function writeExclusive(file: string, value: unknown): Promise<void> {
  const handle = await open(file, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
