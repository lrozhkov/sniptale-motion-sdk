import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  type Locale,
  normalizeLocale,
} from "./config.js";
import { messages } from "./messages.js";

export type LocaleText = {
  en?: string;
  ru?: string;
  [locale: string]: string | undefined;
};

let activeLocale: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: unknown): Locale {
  activeLocale = normalizeLocale(locale);
  if (typeof document !== "undefined") {
    document.documentElement.lang = activeLocale;
  }
  return activeLocale;
}

export function translateText(
  text: LocaleText | string | null | undefined,
  fallback = "",
): string {
  if (typeof text === "string") return text;
  if (!text) return fallback;
  return (
    text[activeLocale] ??
    text[DEFAULT_LOCALE] ??
    text[FALLBACK_LOCALE] ??
    fallback
  );
}

export function t(key: string, fallback = key): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (!node || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[part];
  }, messages);
  return translateText(value as LocaleText | undefined, fallback);
}
