import { createHash } from "node:crypto";
import { join } from "node:path";
import { readBoundedFile, resolveContainedFile } from "./files.js";
import type { CliContext } from "./context.js";
import { MotionCliError } from "./errors.js";
import type { Locale } from "../../shared/i18n/config.js";
import { cliMessages } from "../../shared/i18n/cli.js";

export type SkillKit = {
  schemaVersion: "sniptale.motion-skill-kit.v1";
  toolkitVersion: string;
  runtimeDigest: string;
  skillDigest: string;
  installerVersion: string;
  installerNode: string;
  runtimeFiles: Array<{ path: string; sha256: string }>;
  skillFiles: Array<{ path: string; sha256: string }>;
};
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function files(
  value: unknown,
  skill: boolean,
): SkillKit["runtimeFiles"] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10_000)
    return null;
  const entries: unknown[] = value;
  const parsed: SkillKit["runtimeFiles"] = [];
  let previous = "";
  for (const entry of entries) {
    if (
      !record(entry) ||
      typeof entry.path !== "string" ||
      entry.path.length > 512 ||
      !/^[A-Za-z0-9._/-]+$/.test(entry.path) ||
      entry.path
        .split("/")
        .some((segment) => !segment || segment === "." || segment === "..") ||
      entry.path <= previous ||
      !digest(entry.sha256)
    )
      return null;
    const path = entry.path;
    if (
      skill
        ? !path.startsWith("skills/create-effect/") ||
          path.endsWith("/toolkit.json")
        : ![
            "bin/",
            "apps/",
            "sdk/",
            "schemas/",
            "node_modules/playwright-core/",
            "node_modules/semver/",
          ].some((prefix) => path.startsWith(prefix))
    )
      return null;
    parsed.push({ path: entry.path, sha256: entry.sha256 });
    previous = entry.path;
  }
  return parsed;
}
export function parseSkillKit(value: unknown): SkillKit | null {
  if (
    !record(value) ||
    value.schemaVersion !== "sniptale.motion-skill-kit.v1" ||
    typeof value.toolkitVersion !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.toolkitVersion) ||
    !digest(value.runtimeDigest) ||
    !digest(value.skillDigest) ||
    typeof value.installerVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(value.installerVersion) ||
    typeof value.installerNode !== "string" ||
    !/^>=\d+\.\d+\.\d+$/.test(value.installerNode)
  )
    return null;
  const runtimeFiles = files(value.runtimeFiles, false);
  const skillFiles = files(value.skillFiles, true);
  if (!runtimeFiles || !skillFiles) return null;
  for (const required of [
    "bin/sniptale-motion.mjs",
    "apps/viewer/index.html",
    "apps/sandbox/sandbox.html",
    "schemas/sniptale-effect-v1.schema.json",
    "node_modules/playwright-core/package.json",
  ])
    if (!runtimeFiles.some((entry) => entry.path === required)) return null;
  if (
    !skillFiles.some((entry) => entry.path === "skills/create-effect/SKILL.md")
  )
    return null;
  const hash = (rows: SkillKit["runtimeFiles"]) =>
    createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  if (
    hash(runtimeFiles) !== value.runtimeDigest ||
    hash(skillFiles) !== value.skillDigest
  )
    return null;
  return {
    schemaVersion: "sniptale.motion-skill-kit.v1",
    toolkitVersion: value.toolkitVersion,
    runtimeDigest: value.runtimeDigest,
    skillDigest: value.skillDigest,
    installerVersion: value.installerVersion,
    installerNode: value.installerNode,
    runtimeFiles,
    skillFiles,
  };
}
export async function inspectSkillKit(context: CliContext, locale: Locale) {
  try {
    const raw: unknown = JSON.parse(
      (
        await readBoundedFile(
          await resolveContainedFile(context.packageRoot, "skill-kit.json"),
          4_000_000,
        )
      ).toString("utf8"),
    );
    const kit = parseSkillKit(raw);
    if (!kit || kit.toolkitVersion !== context.version)
      throw new Error("SKILL_KIT");
    const descriptor: unknown = JSON.parse(
      (
        await readBoundedFile(
          await resolveContainedFile(
            context.packageRoot,
            "skills/create-effect/references/toolkit.json",
          ),
          4096,
        )
      ).toString("utf8"),
    );
    if (
      !record(descriptor) ||
      descriptor.schemaVersion !== kit.schemaVersion ||
      descriptor.toolkitVersion !== kit.toolkitVersion ||
      descriptor.runtimeDigest !== kit.runtimeDigest ||
      descriptor.skillDigest !== kit.skillDigest
    )
      throw new Error("SKILL_KIT");
    let total = 0;
    for (const entry of [...kit.runtimeFiles, ...kit.skillFiles]) {
      context.signal?.throwIfAborted();
      const bytes = await readBoundedFile(
        await resolveContainedFile(context.packageRoot, entry.path),
        64_000_000,
      );
      total += bytes.length;
      if (
        total > 256_000_000 ||
        createHash("sha256").update(bytes).digest("hex") !== entry.sha256
      )
        throw new Error("SKILL_KIT");
    }
    const path = join(context.packageRoot, "skills/create-effect");
    return {
      ok: true,
      toolkitVersion: kit.toolkitVersion,
      runtimeDigest: kit.runtimeDigest,
      skillDigest: kit.skillDigest,
      skill: {
        name: "create-effect",
        path,
        instructions: join(path, "SKILL.md"),
      },
      schema: join(
        context.packageRoot,
        "schemas/sniptale-effect-v1.schema.json",
      ),
      guide: join(context.packageRoot, "README.md"),
      cli: {
        node: process.execPath,
        entry: await resolveContainedFile(
          context.packageRoot,
          "bin/sniptale-motion.mjs",
        ),
      },
      installer: {
        optional: true,
        version: kit.installerVersion,
        node: kit.installerNode,
        command: "npx",
        env: { DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" },
        args: [
          "--yes",
          `skills@${kit.installerVersion}`,
          "add",
          path,
          "--skill",
          "create-effect",
        ],
      },
    };
  } catch {
    context.signal?.throwIfAborted();
    throw new MotionCliError("SKILL_KIT", cliMessages(locale).skillKitFailed);
  }
}
