import { readFileSync } from "node:fs";
import { format } from "oxfmt";

export function loadFormattingOptions() {
  const raw: unknown = JSON.parse(
    readFileSync(new URL("../../../.oxfmtrc.json", import.meta.url), "utf8"),
  );
  if (!isRecord(raw))
    throw new Error("Formatter configuration must be an object");
  const options = raw;
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
  const {
    printWidth,
    tabWidth,
    useTabs,
    semi,
    singleQuote,
    trailingComma,
    endOfLine,
    proseWrap,
    sortImports,
    sortPackageJson,
    embeddedLanguageFormatting,
  } = options;
  if (
    typeof printWidth !== "number" ||
    !Number.isInteger(printWidth) ||
    printWidth < 40 ||
    printWidth > 200 ||
    typeof tabWidth !== "number" ||
    !Number.isInteger(tabWidth) ||
    tabWidth < 1 ||
    tabWidth > 8 ||
    typeof useTabs !== "boolean" ||
    typeof semi !== "boolean" ||
    typeof singleQuote !== "boolean" ||
    (trailingComma !== "all" &&
      trailingComma !== "es5" &&
      trailingComma !== "none") ||
    endOfLine !== "lf" ||
    proseWrap !== "never" ||
    sortImports !== false ||
    sortPackageJson !== false ||
    embeddedLanguageFormatting !== "off"
  )
    throw new Error(
      "Formatter configuration must preserve prose, import order, package fields, embedded source and LF output",
    );
  return {
    printWidth,
    tabWidth,
    useTabs,
    semi,
    singleQuote,
    trailingComma,
    endOfLine,
    proseWrap,
    sortImports,
    sortPackageJson,
    embeddedLanguageFormatting,
  } satisfies import("oxfmt").FormatConfig;
}

export async function formatSource(
  filename: string,
  source: string,
): Promise<string> {
  const result = await format(filename, source, loadFormattingOptions());
  if (result.errors.length)
    throw new Error(
      `Cannot format ${filename}: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  return result.code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
