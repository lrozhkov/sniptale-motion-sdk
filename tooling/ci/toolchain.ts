import { readFileSync } from "node:fs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new Error("CI toolchain entry must be an object.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new Error("CI toolchain field must be a nonempty string.");
  return value;
}
function entries(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("CI toolchain list must not be empty.");
  return value;
}
function released(value: unknown, now: number): string {
  const date = text(value);
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp) || now - timestamp < 7 * 86400000)
    throw new Error(
      "CI tools and Actions must be released at least seven days ago.",
    );
  return date;
}
function url(value: unknown): string {
  const source = text(value);
  const parsed = new URL(source);
  if (
    parsed.origin !== "https://github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("CI toolchain URLs must use official GitHub releases.");
  return source;
}
export function parseToolchain(value: unknown, now = Date.now()) {
  const root = record(value);
  if (root.platform !== "linux-x64")
    throw new Error("CI toolchain platform must be linux-x64.");
  const runtime = record(root.node);
  const node = {
    version: text(runtime.version),
    publishedAt: released(runtime.publishedAt, now),
  };
  if (!/^\d+\.\d+\.\d+$/u.test(node.version))
    throw new Error("CI Node version must be exact.");
  const tools = entries(root.tools).map((entry) => {
    const tool = record(entry);
    const name = text(tool.name);
    if (!/^[a-z][a-z0-9-]*$/u.test(name))
      throw new Error("Invalid CI executable name.");
    const sha256 = text(tool.sha256);
    if (!/^[a-f0-9]{64}$/u.test(sha256))
      throw new Error("CI tool requires an exact SHA-256.");
    const member = tool.member === null ? null : text(tool.member);
    if (member !== null && member !== name)
      throw new Error("CI archive must contain its plain executable name.");
    return {
      name,
      version: text(tool.version),
      publishedAt: released(tool.publishedAt, now),
      release: url(tool.release),
      url: url(tool.url),
      sha256,
      member,
    };
  });
  const actions = entries(root.actions).map((entry) => {
    const action = record(entry);
    const name = text(action.name);
    const commit = text(action.commit);
    if (
      (!/^actions\/[a-z-]+$/u.test(name) &&
        name !== "github/codeql-action/upload-sarif") ||
      !/^[a-f0-9]{40}$/u.test(commit)
    )
      throw new Error(
        "CI Actions require an official owner and full commit SHA.",
      );
    return {
      name,
      commit,
      version: text(action.version),
      publishedAt: released(action.publishedAt, now),
      release: url(action.release),
    };
  });
  if (
    new Set(tools.map((tool) => tool.name)).size !== tools.length ||
    new Set(actions.map((action) => action.name)).size !== actions.length
  )
    throw new Error("Duplicate CI toolchain entry.");
  return { node, tools, actions };
}
export function readToolchain() {
  const input: unknown = JSON.parse(
    readFileSync(
      new URL("../configs/ci/toolchain.lock.json", import.meta.url),
      "utf8",
    ),
  );
  return parseToolchain(input);
}
