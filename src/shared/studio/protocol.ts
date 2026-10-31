export const STUDIO_CATALOG_ROUTE = "/__sniptale/local-effects";
export const STUDIO_SESSION_PARAMETER = "studioSession";
export const STUDIO_SESSION_HEADER = "x-sniptale-session";
export const STUDIO_SANDBOX_PARAMETER = "sandboxOrigin";
export const MAX_STUDIO_EFFECTS = 64;
export const MAX_STUDIO_SOURCE_BYTES = 40_000_000;

export type LocalEffectSource = {
  default: boolean;
  source: string;
  sourceName: string;
};
export type LocalEffectCatalog = {
  effects: LocalEffectSource[];
  errors: string[];
};
