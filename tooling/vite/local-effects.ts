import { readdir, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { resolve } from "node:path";

import type { Plugin } from "vite";

import { validateEffectV1Document } from "../../src/sdk/effect-v1/index.js";
import {
  EffectV1BundleError,
  readMaterializedEffectV1Bundle,
} from "../effect-v1/bundle-source.js";

export const LOCAL_EFFECTS_ROUTE = "/__sniptale/local-effects";
const EFFECT_FILE_SUFFIX = ".sniptale-effect.json";
const EFFECT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
const DEFAULT_EFFECTS_ROOT = resolve(REPOSITORY_ROOT, ".tmp/effects");

export type LocalEffectSource = {
  default: boolean;
  source: string;
  sourceName: string;
};

export type LocalEffectSourceCatalog = {
  effects: LocalEffectSource[];
  errors: string[];
};

type DiscoveredEffect = LocalEffectSource & { modifiedAtMs: number };

export function createLocalEffectsPlugin(
  effectsRoot = DEFAULT_EFFECTS_ROOT,
): Plugin {
  return {
    name: "sniptale-local-effects",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1")
          .pathname;
        if (pathname !== LOCAL_EFFECTS_ROUTE) {
          next();
          return;
        }
        void respondWithLocalEffects(response, effectsRoot);
      });
    },
  };
}

export async function readLocalEffectSources(
  effectsRoot = DEFAULT_EFFECTS_ROOT,
): Promise<LocalEffectSourceCatalog> {
  let entries;
  try {
    entries = await readdir(effectsRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) return { effects: [], errors: [] };
    return {
      effects: [],
      errors: [formatDiscoveryError(".tmp/effects", error)],
    };
  }

  const discovered: DiscoveredEffect[] = [];
  const errors: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !EFFECT_ID_PATTERN.test(entry.name)) continue;
    const sourceName = `${entry.name}${EFFECT_FILE_SUFFIX}`;
    const effectRoot = resolve(effectsRoot, entry.name);
    const effectPath = resolve(effectRoot, sourceName);
    try {
      const [source, metadata] = await Promise.all([
        readMaterializedEffectV1Bundle(effectPath, effectRoot),
        stat(effectPath),
      ]);
      if (!metadata.isFile()) continue;
      const validation = validateEffectV1Document(JSON.parse(source));
      if (!validation.ok) {
        errors.push(
          `${sourceName}: ${validation.diagnostics
            .map(
              (diagnostic) =>
                `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
            )
            .join("; ")}`,
        );
        continue;
      }
      discovered.push({
        default: false,
        modifiedAtMs: metadata.mtimeMs,
        source,
        sourceName,
      });
    } catch (error) {
      if (!isMissingFileError(error)) {
        errors.push(formatDiscoveryError(sourceName, error));
      }
    }
  }

  discovered.sort(
    (left, right) =>
      right.modifiedAtMs - left.modifiedAtMs ||
      left.sourceName.localeCompare(right.sourceName),
  );
  return {
    effects: discovered.map(
      ({ modifiedAtMs: _modifiedAtMs, ...effect }, index) => ({
        ...effect,
        default: index === 0,
      }),
    ),
    errors,
  };
}

async function respondWithLocalEffects(
  response: ServerResponse,
  effectsRoot: string,
) {
  try {
    const catalog = await readLocalEffectSources(effectsRoot);
    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(`${JSON.stringify(catalog)}\n`);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      `${JSON.stringify({ effects: [], errors: [formatDiscoveryError(".tmp/effects", error)] })}\n`,
    );
  }
}

function formatDiscoveryError(sourceName: string, error: unknown): string {
  if (error instanceof EffectV1BundleError) {
    return `${sourceName}: ${error.code} ${error.path}: ${error.message}`;
  }
  return `${sourceName}: ${error instanceof Error ? error.message : String(error)}`;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT",
  );
}
