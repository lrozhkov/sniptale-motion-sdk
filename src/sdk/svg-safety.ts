import { MAX_ASSET_BYTES } from "./protocol.js";

const SVG_DOCUMENT_PATTERN = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i;
const FORBIDDEN_SVG_PATTERNS = [
  /<\s*(?:[a-z_][\w.-]*:)?(?:script|foreignObject|style|base|animate[a-z]*|set|discard)\b/i,
  /<\s*!\s*(?:doctype|entity)\b/i,
  /<\?xml-stylesheet\b/i,
  /\s(?:[a-z_][\w.-]*:)?on[a-z]+\s*=/i,
  /\s(?:[a-z_][\w.-]*:)?base\s*=/i,
  /(?:^|\s)(?:[a-z_][\w.-]*:)?(?:href|src|srcset)\s*=\s*(?:"\s*(?!#)|'\s*(?!#)|(?!(?:#))[^\s"'=<>`]+)/i,
  /\s(?:[a-z_][\w.-]*:)?style\s*=/i,
  /(?:@import\b|\burl\s*\(|\bimage-set\s*\()/i,
  /\\/,
];

export function isSafeSvgText(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_ASSET_BYTES) return false;
  const inspected = decodeXmlCharacterReferences(value);
  return (
    inspected !== null &&
    SVG_DOCUMENT_PATTERN.test(inspected) &&
    FORBIDDEN_SVG_PATTERNS.every((pattern) => !pattern.test(inspected))
  );
}

function decodeXmlCharacterReferences(value: string): string | null {
  let valid = true;
  const decoded = value.replace(
    /&#(?:x([a-f0-9]+)|(\d+));/gi,
    (
      reference,
      hexadecimal: string | undefined,
      decimal: string | undefined,
    ) => {
      const codePoint = Number.parseInt(
        hexadecimal ?? decimal ?? "",
        hexadecimal ? 16 : 10,
      );
      if (
        !Number.isInteger(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        valid = false;
        return reference;
      }
      return String.fromCodePoint(codePoint);
    },
  );
  return valid ? decoded : null;
}
