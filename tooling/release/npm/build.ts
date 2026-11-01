import { readCommandOutput } from "./command-output.ts";
import {
  parseBuildManifest,
  checkBundledDependency,
  parseSkillInstaller,
  parseCompiledVersion,
  parsePackResult,
} from "./package-input.ts";

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
const rootManifest = parseBuildManifest(
  JSON.parse(await readFile(join(repo, "package.json"), "utf8")),
);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this command through npm run build:npm.");

// Release build already enforces the browser, declaration and legal boundaries.
for (const script of [
  "tooling/release/dependency-legal/generate-production-legal.ts",
  "tooling/build/run.ts",
]) {
  execFileSync(process.execPath, ["--import", "tsx", script], {
    cwd: repo,
    stdio: "inherit",
  });
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
  external: ["playwright-core", "semver"],
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
    if (
      !dependency.external ||
      (!dependency.path.startsWith("node:") &&
        !["playwright-core", "semver"].includes(dependency.path))
    ) {
      throw new Error(
        `CLI runtime dependency is not bundled: ${dependency.path}`,
      );
    }
  }
}
await chmod(join(stage, "bin/sniptale-motion.mjs"), 0o755);
checkBundledDependency(
  JSON.parse(
    await readFile(join(repo, "node_modules/semver/package.json"), "utf8"),
  ),
  "semver",
  rootManifest.dependencies.semver,
);
await cp(
  join(repo, "node_modules/semver"),
  join(stage, "node_modules/semver"),
  { recursive: true },
);
await writeFile(
  join(stage, "package.json"),
  JSON.stringify({ type: "module", version: rootManifest.version }),
);
const compiledInfo = parseCompiledVersion(
  JSON.parse(
    execFileSync(
      process.execPath,
      [join(stage, "bin/sniptale-motion.mjs"), "--version", "--json"],
      { encoding: "utf8" },
    ),
  ),
  rootManifest.version,
);
checkBundledDependency(
  JSON.parse(
    await readFile(
      join(repo, "node_modules/playwright-core/package.json"),
      "utf8",
    ),
  ),
  "playwright-core",
  rootManifest.dependencies["playwright-core"],
);
await cp(
  join(repo, "node_modules/playwright-core"),
  join(stage, "node_modules/playwright-core"),
  { recursive: true },
);
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
await cp(
  join(repo, "docs/authoring/create-effect"),
  join(stage, "skills/create-effect"),
  { recursive: true },
);
const installer = parseSkillInstaller(
  JSON.parse(
    await readFile(join(repo, "node_modules/skills/package.json"), "utf8"),
  ),
  rootManifest.devDependencies.skills,
);
const inputs = await collectFiles(stage);
const runtimeFiles: Array<{ path: string; sha256: string }> = [];
const skillFiles: Array<{ path: string; sha256: string }> = [];
for (const path of inputs) {
  const entry = {
    path,
    sha256: createHash("sha256")
      .update(await readFile(join(stage, path)))
      .digest("hex"),
  };
  if (path.startsWith("skills/create-effect/")) skillFiles.push(entry);
  else if (
    [
      "bin/",
      "apps/",
      "sdk/",
      "schemas/",
      "node_modules/playwright-core/",
      "node_modules/semver/",
    ].some((prefix) => path.startsWith(prefix))
  )
    runtimeFiles.push(entry);
}
const fingerprint = (rows: readonly { path: string; sha256: string }[]) =>
  createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const descriptor = {
  schemaVersion: "sniptale.motion-skill-kit.v1",
  toolkitVersion: rootManifest.version,
  runtimeDigest: fingerprint(runtimeFiles),
  skillDigest: fingerprint(skillFiles),
};
await writeFile(
  join(stage, "skill-kit.json"),
  `${JSON.stringify({ ...descriptor, installerVersion: installer.version, installerNode: installer.engines.node, runtimeFiles, skillFiles }, null, 2)}\n`,
);
await writeFile(
  join(stage, "skills/create-effect/references/toolkit.json"),
  `${JSON.stringify(descriptor, null, 2)}\n`,
);
const manifest = {
  name: "@sniptale/motion",
  version: rootManifest.version,
  publishConfig: { access: "public" },
  description: rootManifest.description,
  license: rootManifest.license,
  author: rootManifest.author,
  repository: rootManifest.repository,
  homepage: rootManifest.homepage,
  type: "module",
  engines: rootManifest.engines,
  dependencies: {
    "playwright-core": rootManifest.dependencies["playwright-core"],
    semver: rootManifest.dependencies.semver,
  },
  bundledDependencies: ["playwright-core", "semver"],
  sniptaleMotion: compiledInfo.compatibility,
  bin: { "sniptale-motion": "bin/sniptale-motion.mjs" },
  files: [
    "bin",
    "apps",
    "sdk",
    "schemas",
    "skills",
    "skill-kit.json",
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
const handle = await open(packLog, "wx+");
let packResult: unknown;
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
  packResult = JSON.parse(await readCommandOutput(handle));
} finally {
  await handle.close();
}
const packed = parsePackResult(packResult, manifest);
const stagedFiles = await collectFiles(stage);
const actual = packed.files.map((file) => file.path).sort();
if (JSON.stringify(actual) !== JSON.stringify(stagedFiles))
  throw new Error("npm archive differs from the staged file inventory.");
const archive = join(output, packed.filename);
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

async function collectFiles(root: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
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
