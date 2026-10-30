// RFC 5646 section 2.1: the registered grandfathered grammar alternatives.
const grandfathered = new Set([
  "en-gb-oed",
  "i-ami",
  "i-bnn",
  "i-default",
  "i-enochian",
  "i-hak",
  "i-klingon",
  "i-lux",
  "i-mingo",
  "i-navajo",
  "i-pwn",
  "i-tao",
  "i-tay",
  "i-tsu",
  "sgn-be-fr",
  "sgn-be-nl",
  "sgn-ch-de",
  "art-lojban",
  "cel-gaulish",
  "no-bok",
  "no-nyn",
  "zh-guoyu",
  "zh-hakka",
  "zh-min",
  "zh-min-nan",
  "zh-xiang",
]);
const languageTag =
  /^(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4}|[a-z]{5,8})(?:-[a-z]{4})?(?:-(?:[a-z]{2}|[0-9]{3}))?(?:-(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3}))*(?:-[0-9a-wy-z](?:-[a-z0-9]{2,8})+)*(?:-x(?:-[a-z0-9]{1,8})+)?$/i;

/** Well-formed BCP47, without depending on the host's installed locale registry. */
export function isEffectV1LocaleTag(value: string): boolean {
  if (value.length > 64) return false;
  const tag = value.toLowerCase();
  if (grandfathered.has(tag) || /^x(?:-[a-z0-9]{1,8})+$/.test(tag)) return true;
  if (!languageTag.test(tag)) return false;
  const variants = new Set<string>(),
    extensions = new Set<string>();
  let inExtension = false;
  for (const part of tag.split("-").slice(1)) {
    if (part === "x") break;
    if (part.length === 1) {
      if (extensions.has(part)) return false;
      extensions.add(part);
      inExtension = true;
    } else if (
      !inExtension &&
      (part.length >= 5 || /^[0-9][a-z0-9]{3}$/.test(part))
    ) {
      if (variants.has(part)) return false;
      variants.add(part);
    }
  }
  return true;
}
