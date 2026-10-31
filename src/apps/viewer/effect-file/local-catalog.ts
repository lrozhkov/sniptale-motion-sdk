import {
  MAX_STUDIO_EFFECTS,
  MAX_STUDIO_SOURCE_BYTES,
  STUDIO_CATALOG_ROUTE,
  STUDIO_SESSION_HEADER,
  STUDIO_SESSION_PARAMETER,
  type LocalEffectCatalog,
  type LocalEffectSource,
} from "../../../shared/studio/protocol.js";
export type {
  LocalEffectCatalog,
  LocalEffectSource,
} from "../../../shared/studio/protocol.js";
export const LOCAL_EFFECTS_ROUTE = STUDIO_CATALOG_ROUTE;

export function getStudioSession(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const value = new URLSearchParams(window.location.search).get(
    STUDIO_SESSION_PARAMETER,
  );
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function loadLocalEffectCatalog(
  fetcher: typeof fetch = fetch,
): Promise<LocalEffectCatalog> {
  const session = getStudioSession();
  let response: Response;
  try {
    response = await fetcher(LOCAL_EFFECTS_ROUTE, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(session ? { [STUDIO_SESSION_HEADER]: session } : {}),
      },
    });
  } catch (error) {
    return {
      effects: [],
      errors: [`Local effect discovery failed: ${formatError(error)}`],
    };
  }
  if (response.status === 404) return emptyLocalEffectCatalog();
  if (!response.ok) {
    return {
      effects: [],
      errors: [`Local effect discovery failed with HTTP ${response.status}.`],
    };
  }
  try {
    return parseLocalEffectCatalog(await response.json());
  } catch (error) {
    return {
      effects: [],
      errors: [
        `Local effect discovery returned invalid JSON: ${formatError(error)}`,
      ],
    };
  }
}

export function emptyLocalEffectCatalog(): LocalEffectCatalog {
  return { effects: [], errors: [] };
}

export function parseLocalEffectCatalog(value: unknown): LocalEffectCatalog {
  if (!isRecord(value)) {
    return {
      effects: [],
      errors: ["Local effect discovery response must be an object."],
    };
  }
  const errors = Array.isArray(value.errors)
    ? value.errors
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.slice(0, 4000))
    : ["Local effect discovery response has no error list."];
  if (!Array.isArray(value.effects)) {
    return {
      effects: [],
      errors: [
        ...errors,
        "Local effect discovery response has no effect list.",
      ],
    };
  }
  if (value.effects.length > MAX_STUDIO_EFFECTS) {
    errors.push(
      `Local effect discovery returned more than ${MAX_STUDIO_EFFECTS} effects.`,
    );
  }
  const effects: LocalEffectSource[] = [];
  for (const [index, item] of value.effects
    .slice(0, MAX_STUDIO_EFFECTS)
    .entries()) {
    if (
      !isRecord(item) ||
      typeof item.default !== "boolean" ||
      typeof item.source !== "string" ||
      typeof item.sourceName !== "string" ||
      !isSafeSourceName(item.sourceName) ||
      item.source.length === 0 ||
      item.source.length > MAX_STUDIO_SOURCE_BYTES
    ) {
      errors.push(`Local effect discovery entry ${index} is invalid.`);
      continue;
    }
    effects.push({
      default: item.default,
      source: item.source,
      sourceName: item.sourceName,
    });
  }
  return { effects, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSafeSourceName(value: string): boolean {
  return (
    value.endsWith(".sniptale-effect.json") &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
