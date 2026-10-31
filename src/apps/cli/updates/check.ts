import semver from "semver";
import { assessUpdate } from "./assessment.js";
import type { CliContext } from "../context.js";
import type { Locale } from "../../../shared/i18n/config.js";
import { cliMessages } from "../../../shared/i18n/cli.js";
import { MotionCliError } from "../errors.js";

export const UPDATE_REGISTRY_URL =
  "https://registry.npmjs.org/%40sniptale%2Fmotion";
const MAX_METADATA_BYTES = 16_000_000;
export async function checkMotionUpdate(
  context: CliContext,
  target: string | undefined,
  locale: Locale,
) {
  const messages = cliMessages(locale);
  if (target !== undefined && semver.valid(target) !== target)
    throw new MotionCliError("ARGUMENTS", messages.updateVersion);
  try {
    const signal = AbortSignal.any([
      ...(context.signal ? [context.signal] : []),
      AbortSignal.timeout(10_000),
    ]);
    signal.throwIfAborted();
    const response = await fetch(UPDATE_REGISTRY_URL, {
      signal,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) {
      await response.body?.cancel();
      return { ok: true, status: "not-published", current: context.version };
    }
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel();
      throw new Error("UPDATE_REGISTRY");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      if (!(chunk instanceof Uint8Array)) throw new Error("UPDATE_REGISTRY");
      size += chunk.byteLength;
      if (size > MAX_METADATA_BYTES) throw new Error("UPDATE_REGISTRY");
      chunks.push(chunk);
    }
    const metadata: unknown = JSON.parse(
      Buffer.concat(chunks).toString("utf8"),
    );
    return assessUpdate(
      metadata,
      context.version,
      target,
      Date.now(),
      process.version,
    );
  } catch {
    context.signal?.throwIfAborted();
    throw new MotionCliError("UPDATE_REGISTRY", messages.updateRegistryFailed);
  }
}
