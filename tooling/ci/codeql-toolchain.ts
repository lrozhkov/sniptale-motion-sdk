import { readFileSync } from "node:fs";
import { resolve } from "node:path";
export function parseCodeqlToolchain(value: unknown, now = Date.now()) {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    typeof value.version !== "string" ||
    !/^\d+\.\d+\.\d+$/u.test(value.version) ||
    !("publishedAt" in value) ||
    typeof value.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(value.publishedAt)) ||
    now - Date.parse(value.publishedAt) < 7 * 86400000 ||
    !("sha256" in value) ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.sha256) ||
    !("url" in value) ||
    value.url !==
      `https://github.com/github/codeql-action/releases/download/codeql-bundle-v${value.version}/codeql-bundle-linux64.tar.gz`
  )
    throw new Error("Invalid pinned CodeQL identity or release age.");

  const querySuite =
    "codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls";
  if (!("querySuite" in value) || value.querySuite !== querySuite)
    throw new Error("Invalid CodeQL query suite.");
  return {
    version: value.version,
    sha256: value.sha256,
    url: `https://github.com/github/codeql-action/releases/download/codeql-bundle-v${value.version}/codeql-bundle-linux64.tar.gz`,
    querySuite,
  };
}
export function readCodeqlToolchain() {
  const value: unknown = JSON.parse(
    readFileSync("tooling/configs/codeql/toolchain.json", "utf8"),
  );
  return parseCodeqlToolchain(value);
}
export function codeqlRoot() {
  return resolve(".tmp/codeql-toolchain", readCodeqlToolchain().sha256);
}
