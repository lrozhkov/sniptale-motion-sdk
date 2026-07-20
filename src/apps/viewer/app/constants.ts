export const TIMELINE_LABEL_WIDTH = 208;
export const DEFAULT_SIDEBAR_WIDTH = 340;
export const TIMING_BOUNDARY_TOLERANCE = 1 / 30 + 0.002;
export const COMPOSITION_DESIGN_WIDTH = 1280;
export const COMPOSITION_DESIGN_HEIGHT = 720;

export const SNIPTALE_EFFECT_FILE_SCHEMA = "sniptale.effect.v1";

export const FORBIDDEN_EFFECT_FILE_PATTERNS = [
  /\bimport\s*(?:\(|[\w*{])/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bchrome\./,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
];

export const SUPPORTED_AUTHOR_ASSET_TYPES = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function isSafeLocalAssetPath(path: unknown) {
  if (path == null || path === "") {
    return true;
  }
  const value = String(path).trim();
  return (
    !/^[a-z]+:/i.test(value) &&
    !value.startsWith("/") &&
    !value.includes("..") &&
    !value.includes("\\")
  );
}
