import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { build } from "esbuild";

const repo = resolve(import.meta.dirname, "../../..");
const output = join(repo, ".tmp/npm-package");
const stage = join(output, "package");
const rootManifest = JSON.parse(
  await readFile(join(repo, "package.json"), "utf8"),
);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this command through npm run build:npm.");

// Release build already enforces the browser, declaration and legal boundaries.
for (const script of [
  "tooling/release/dependency-legal/generate-production-legal.mjs",
  "tooling/build/run.mjs",
]) {
  execFileSync(process.execPath, [script], { cwd: repo, stdio: "inherit" });
}
await rm(output, { recursive: true, force: true });
await mkdir(join(stage, "bin"), { recursive: true });
const bundled = await build({
  entryPoints: [join(repo, "src/apps/cli/main.ts")],
  outfile: join(stage, "bin/sniptale-motion.mjs"),
  platform: "node",
  target: "node22.12",
  format: "esm",
  bundle: true,
  metafile: true,
  legalComments: "eof",
});
for (const input of Object.keys(bundled.metafile.inputs)) {
  if (
    !relative(repo, resolve(input)).replaceAll("\\", "/").startsWith("src/")
  ) {
    throw new Error(`CLI contains a non-product input: ${input}`);
  }
}
for (const entry of Object.values(bundled.metafile.outputs)) {
  for (const dependency of entry.imports) {
    if (!dependency.external || !dependency.path.startsWith("node:")) {
      throw new Error(
        `CLI runtime dependency is not bundled: ${dependency.path}`,
      );
    }
  }
}
await chmod(join(stage, "bin/sniptale-motion.mjs"), 0o755);
for (const item of [
  "apps",
  "sdk",
  "LICENSE",
  "LICENSES",
  "NOTICE",
  "THIRD_PARTY_DEPENDENCIES.json",
  "THIRD_PARTY_NOTICES.md",
]) {
  await cp(join(repo, "dist", item), join(stage, item), { recursive: true });
}
await cp(join(repo, "schemas"), join(stage, "schemas"), { recursive: true });
await cp(join(repo, "docs/tooling/npm-toolkit.md"), join(stage, "README.md"));
const manifest = {
  name: "@sniptale/motion",
  version: rootManifest.version,
  // Removed only during the separately authorized publication preparation.
  private: true,
  description: rootManifest.description,
  license: rootManifest.license,
  author: rootManifest.author,
  repository: rootManifest.repository,
  homepage: rootManifest.homepage,
  type: "module",
  engines: rootManifest.engines,
  bin: { "sniptale-motion": "bin/sniptale-motion.mjs" },
  files: [
    "bin",
    "apps",
    "sdk",
    "schemas",
    "LICENSES",
    "NOTICE",
    "THIRD_PARTY_DEPENDENCIES.json",
    "THIRD_PARTY_NOTICES.md",
  ],
};
await writeFile(
  join(stage, "package.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const packLog = join(output, "pack-result.json");
const handle = await open(packLog, "wx");
try {
  execFileSync(
    process.execPath,
    [
      npmCli,
      "pack",
      "--ignore-scripts",
      "--json",
      "--cache",
      join(repo, ".tmp/npm-cache"),
      "--pack-destination",
      output,
    ],
    { cwd: stage, stdio: ["inherit", handle.fd, "inherit"] },
  );
} finally {
  await handle.close();
}
const packResult = JSON.parse(await readFile(packLog, "utf8"));
// npm 12 keys JSON by package name; older npm versions return an array.
const packed = Array.isArray(packResult)
  ? packResult
  : Object.values(packResult);
if (
  !Array.isArray(packed) ||
  packed.length !== 1 ||
  typeof packed[0].filename !== "string" ||
  !Array.isArray(packed[0].files)
) {
  throw new Error("npm pack returned an invalid archive inventory.");
}
if (
  packed[0].filename !== `sniptale-motion-${manifest.version}.tgz` ||
  packed[0].name !== manifest.name ||
  packed[0].version !== manifest.version
) {
  throw new Error("npm pack returned a different package identity.");
}
const stagedFiles = await collectFiles(stage);
const actual = packed[0].files.map((file) => file.path).sort();
if (JSON.stringify(actual) !== JSON.stringify(stagedFiles))
  throw new Error("npm archive differs from the staged file inventory.");
const archive = join(output, packed[0].filename);
const sha256 = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
const evidence = {
  archive: relative(repo, archive),
  sha256,
  version: manifest.version,
  files: actual,
  checks: {
    standaloneInstall: "not-run",
    nativeWindows: "not-run",
    fullStrict: "not-run",
  },
};
await writeFile(
  join(output, "inventory.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify({ archive, sha256, files: actual.length }));

async function collectFiles(root, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await collectFiles(root, path)));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected package entry: ${path}`);
  }
  return files.sort();
}
