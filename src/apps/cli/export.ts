import { constants } from "node:fs";
import { link, mkdir, mkdtemp, open, realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { parseEffectV1Source } from "../../sdk/effect-v1/index.js";
import { MAX_STUDIO_SOURCE_BYTES } from "../../shared/studio/protocol.js";
import { readMaterializedEffectV1Bundle } from "./bundle-source.js";
import { MotionCliError } from "./errors.js";

export async function exportMotionEffect(
  file: string,
  output: string,
  options: { assetRoot?: string; signal?: AbortSignal } = {},
) {
  options.signal?.throwIfAborted();
  const source = await readMaterializedEffectV1Bundle(file, options.assetRoot);
  const { document, ...validation } = parseEffectV1Source(source);
  const proof = {
    schema: validation.ok ? "passed" : "failed",
    runtime: "not-run",
  };
  if (!validation.ok || !document) return { ...validation, file, proof };
  const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8");
  if (bytes.length > MAX_STUDIO_SOURCE_BYTES)
    throw new MotionCliError(
      "FILE_LIMIT",
      "The portable document exceeds the supported file size.",
    );
  const destination = resolve(output);
  const parent = await realpath(dirname(destination));
  const temporary = join(parent, ".tmp");
  await mkdir(temporary, { recursive: true });
  if ((await realpath(temporary)) !== temporary)
    throw new MotionCliError(
      "EXPORT_PATH",
      "The export staging directory must not be a symbolic link.",
    );
  const staging = await mkdtemp(join(temporary, "motion-export-"));
  try {
    const staged = join(staging, "effect.sniptale-effect.json");
    const handle = await open(staged, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    options.signal?.throwIfAborted();
    // A hard link publishes complete bytes exclusively. Never use replacing rename.
    await link(staged, destination);
    if (process.platform !== "win32") {
      const directory = await open(
        parent,
        constants.O_RDONLY | constants.O_DIRECTORY,
      );
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return {
    ...validation,
    file,
    output: destination,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    proof,
  };
}
