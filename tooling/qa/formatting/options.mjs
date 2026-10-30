import { readFileSync } from "node:fs";
import { format } from "oxfmt";

export function loadFormattingOptions() {
  /** @type {unknown} */
  const raw = JSON.parse(
    readFileSync(new URL("../../../.oxfmtrc.json", import.meta.url), "utf8"),
  );
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Formatter configuration must be an object");
  const options = Object.fromEntries(Object.entries(raw));
  const fields = [
    "printWidth",
    "tabWidth",
    "useTabs",
    "semi",
    "singleQuote",
    "trailingComma",
    "endOfLine",
    "proseWrap",
    "sortImports",
    "sortPackageJson",
    "embeddedLanguageFormatting",
  ];
  if (
    Object.keys(options).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(options, key))
  ) {
    throw new Error(
      "Formatter configuration contains unsupported or missing options",
    );
  }
  if (
    !Number.isInteger(options.printWidth) ||
    options.printWidth < 40 ||
    options.printWidth > 200 ||
    !Number.isInteger(options.tabWidth) ||
    options.tabWidth < 1 ||
    options.tabWidth > 8 ||
    ["useTabs", "semi", "singleQuote"].some(
      (key) => typeof options[key] !== "boolean",
    ) ||
    !["all", "es5", "none"].includes(options.trailingComma) ||
    options.endOfLine !== "lf" ||
    options.proseWrap !== "never" ||
    options.sortImports !== false ||
    options.sortPackageJson !== false ||
    options.embeddedLanguageFormatting !== "off"
  ) {
    throw new Error(
      "Formatter configuration must preserve prose, import order, package fields, embedded source and LF output",
    );
  }
  return options;
}

/** @param {string} filename @param {string} source @returns {Promise<string>} */
export async function formatSource(filename, source) {
  const result = await format(filename, source, loadFormattingOptions());
  if (result.errors.length)
    throw new Error(
      `Cannot format ${filename}: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  return result.code;
}
