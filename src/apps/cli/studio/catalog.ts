import { readdir, realpath } from "node:fs/promises";
import { basename, join } from "node:path";
import { materializeEffectV1Bundle } from "../bundle-source.js";
import { readBoundedFile, resolveContainedFile } from "../files.js";
import {
  MAX_STUDIO_EFFECTS,
  MAX_STUDIO_SOURCE_BYTES,
  type LocalEffectCatalog,
} from "../../../shared/studio/protocol.js";
import { parseEffectV1Source } from "../../../sdk/effect-v1/index.js";

export async function readStudioCatalog(
  project: string,
): Promise<LocalEffectCatalog> {
  const catalog: LocalEffectCatalog = { effects: [], errors: [] };
  const effects = join(project, "effects");
  if ((await realpath(effects)) !== effects)
    throw new Error("The effects directory must not be a symbolic link.");
  const entries = (await readdir(effects, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isDirectory() && /^[a-z][a-z0-9_-]{0,63}$/.test(entry.name),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  if (entries.length > MAX_STUDIO_EFFECTS)
    catalog.errors.push(
      `Studio supports at most ${MAX_STUDIO_EFFECTS} effects per project.`,
    );
  let totalBytes = 0;
  for (const entry of entries.slice(0, MAX_STUDIO_EFFECTS)) {
    try {
      const directory = await resolveContainedFile(effects, entry.name);
      const file = await resolveContainedFile(
        directory,
        "effect.sniptale-effect.json",
      );
      const bytes = await readBoundedFile(file, MAX_STUDIO_SOURCE_BYTES);
      const source = await materializeEffectV1Bundle(
        bytes.toString("utf8"),
        directory,
      );
      const result = parseEffectV1Source(source);
      if (!result.ok)
        throw new Error(
          result.diagnostics
            .map((issue) => issue.message)
            .join("; ")
            .slice(0, 4000),
        );
      if (result.document?.id !== entry.name)
        throw new Error("Effect id must match its project directory.");
      totalBytes += Buffer.byteLength(source);
      if (totalBytes > MAX_STUDIO_SOURCE_BYTES) {
        catalog.errors.push("Studio effect catalog exceeds the size limit.");
        break;
      }
      catalog.effects.push({
        default: catalog.effects.length === 0,
        source,
        sourceName: `${basename(directory)}.sniptale-effect.json`,
      });
    } catch (error) {
      catalog.errors.push(
        `${entry.name}: ${error instanceof Error ? error.message : String(error)}`.slice(
          0,
          4000,
        ),
      );
    }
  }
  return catalog;
}
