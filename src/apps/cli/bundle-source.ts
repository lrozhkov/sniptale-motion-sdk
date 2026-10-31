import { diagnosticValue } from "../../sdk/diagnostic-value.js";
import { readBoundedFile } from "./files.js";
import { MAX_STUDIO_SOURCE_BYTES } from "../../shared/studio/protocol.js";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import {
  assertEffectV1AssetSignature,
  decodeEffectV1EmbeddedAsset,
  sha256EffectV1Bytes,
} from "../../sdk/effect-v1/index.js";
import { MAX_ASSET_BYTES } from "../../sdk/protocol.js";

const MAX_BUNDLE_ASSET_BYTES = MAX_ASSET_BYTES * 16;

export class EffectV1BundleError extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
    readonly suggestion: string,
  ) {
    super(message);
  }
}

export async function readMaterializedEffectV1Bundle(
  file: string,
  assetRoot?: string | null,
): Promise<string> {
  const source = (
    await readBoundedFile(await realpath(file), MAX_STUDIO_SOURCE_BYTES)
  ).toString("utf8");
  return materializeEffectV1Bundle(source, resolve(assetRoot ?? dirname(file)));
}

export async function materializeEffectV1Bundle(
  source: string,
  root: string,
): Promise<string> {
  let document: unknown;
  try {
    document = JSON.parse(source);
  } catch {
    // The SDK parser owns JSON syntax diagnostics.
    return source;
  }
  if (!isRecord(document) || !Array.isArray(document.assets)) return source;
  const assets: unknown[] = document.assets;
  let totalBytes = 0;
  for (const [index, asset] of assets.entries()) {
    if (!isRecord(asset)) continue;
    const bytes =
      typeof asset.dataUrl === "string" || typeof asset.svgText === "string"
        ? decodeEffectV1EmbeddedAsset(asset)
        : await readBundleAsset(
            root,
            asset.path,
            asset.id ?? index,
            `$.assets[${index}].path`,
          );
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_ASSET_BYTES) {
      throw new EffectV1BundleError(
        "ASSET_SIZE",
        `$.assets[${index}]`,
        `Asset "${diagnosticValue(asset.id ?? index)}" must be from 1 to ${MAX_ASSET_BYTES} bytes.`,
        "Reduce or recompress the asset, then update byteLength and sha256.",
      );
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_BUNDLE_ASSET_BYTES) {
      throw new EffectV1BundleError(
        "ASSET_BUNDLE_BUDGET",
        "$.assets",
        `Bundle assets exceed the ${MAX_BUNDLE_ASSET_BYTES} byte validation limit.`,
        "Remove unused assets or reduce their encoded size.",
      );
    }
    const mimeType = asset.mimeType;
    try {
      assertEffectV1AssetSignature(bytes, mimeType, asset.id ?? index);
    } catch (error) {
      throw new EffectV1BundleError(
        "ASSET_SIGNATURE",
        `$.assets[${index}].mimeType`,
        error instanceof Error ? error.message : String(error),
        "Correct mimeType or replace the file with bytes of the declared format.",
      );
    }
    const digest = await sha256EffectV1Bytes(bytes);
    if (
      asset.byteLength !== undefined &&
      asset.byteLength !== bytes.byteLength
    ) {
      throw new EffectV1BundleError(
        "ASSET_BYTE_LENGTH_MISMATCH",
        `$.assets[${index}].byteLength`,
        `Asset "${diagnosticValue(asset.id ?? index)}" byteLength does not match.`,
        `Set byteLength to ${bytes.byteLength}.`,
      );
    }
    if (asset.sha256 !== undefined && asset.sha256 !== digest) {
      throw new EffectV1BundleError(
        "ASSET_SHA256_MISMATCH",
        `$.assets[${index}].sha256`,
        `Asset "${diagnosticValue(asset.id ?? index)}" SHA-256 does not match.`,
        `Set sha256 to "${digest}" after confirming this is the intended asset.`,
      );
    }
    asset.byteLength = bytes.byteLength;
    asset.sha256 = digest;
    if (asset.kind === "svg" || mimeType === "image/svg+xml") {
      asset.svgText = new TextDecoder().decode(bytes);
    } else {
      asset.dataUrl = `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
    }
  }
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function readBundleAsset(
  root: string,
  path: unknown,
  assetId: unknown,
  diagnosticPath: string,
): Promise<Uint8Array> {
  if (typeof path !== "string" || !isSafeRelativeBundlePath(path)) {
    throw new EffectV1BundleError(
      "ASSET_PATH_UNSAFE",
      diagnosticPath,
      `Asset "${diagnosticValue(assetId)}" has no safe bundle path.`,
      "Use a relative path inside --asset-root without traversal segments.",
    );
  }
  const target = resolve(root, path);
  if (!isPathContained(root, target)) {
    throw new EffectV1BundleError(
      "ASSET_PATH_UNSAFE",
      diagnosticPath,
      `Asset "${diagnosticValue(assetId)}" escapes the asset root.`,
      "Move the asset inside --asset-root and use a relative path.",
    );
  }
  let realRoot: string;
  let realTarget: string;
  try {
    [realRoot, realTarget] = await Promise.all([
      realpath(root),
      realpath(target),
    ]);
  } catch {
    throw new EffectV1BundleError(
      "ASSET_FILE_MISSING",
      diagnosticPath,
      `Asset file "${path}" was not found under ${root}.`,
      "Pass the correct --asset-root or add the referenced file.",
    );
  }
  if (!isPathContained(realRoot, realTarget)) {
    throw new EffectV1BundleError(
      "ASSET_PATH_UNSAFE",
      diagnosticPath,
      `Asset "${diagnosticValue(assetId)}" resolves outside the asset root.`,
      "Replace the symlink with a file inside --asset-root.",
    );
  }
  let handle;
  try {
    handle = await open(
      realTarget,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch {
    throw new EffectV1BundleError(
      "ASSET_FILE_MISSING",
      diagnosticPath,
      `Asset file "${path}" was not found under ${root}.`,
      "Pass the correct --asset-root or add the referenced file.",
    );
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new EffectV1BundleError(
        "ASSET_FILE_TYPE",
        diagnosticPath,
        `Asset "${diagnosticValue(assetId)}" is not a regular file.`,
        "Replace the path with a regular file inside --asset-root.",
      );
    }
    if (stats.size <= 0 || stats.size > MAX_ASSET_BYTES) {
      throw new EffectV1BundleError(
        "ASSET_SIZE",
        diagnosticPath,
        `Asset "${diagnosticValue(assetId)}" must be from 1 to ${MAX_ASSET_BYTES} bytes.`,
        "Reduce or recompress the asset, then update byteLength and sha256.",
      );
    }
    const bytes = new Uint8Array(stats.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const finalStats = await handle.stat();
    if (
      offset !== bytes.byteLength ||
      finalStats.size !== stats.size ||
      finalStats.mtimeMs !== stats.mtimeMs ||
      finalStats.ctimeMs !== stats.ctimeMs
    ) {
      throw new EffectV1BundleError(
        "ASSET_FILE_CHANGED",
        diagnosticPath,
        `Asset "${diagnosticValue(assetId)}" changed while it was being read.`,
        "Retry after asset writes have completed.",
      );
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

export function isPathContained(
  root: string,
  target: string,
  pathApi = { isAbsolute, relative, sep },
): boolean {
  const pathFromRoot = pathApi.relative(root, target);
  return (
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${pathApi.sep}`) &&
    !pathApi.isAbsolute(pathFromRoot)
  );
}

function isSafeRelativeBundlePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..") &&
    !/^[a-z]+:/i.test(path)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
