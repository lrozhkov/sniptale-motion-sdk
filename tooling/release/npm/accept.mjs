import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "../../..");
const output = join(repo, ".tmp/npm-package");
const inventory = JSON.parse(
  await readFile(join(output, "inventory.json"), "utf8"),
);
const archive = resolve(repo, inventory.archive);
const digest = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
assert.equal(
  digest,
  inventory.sha256,
  "Candidate archive changed after inventory creation.",
);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this command through npm run test:npm.");
const temporary = await mkdtemp(join(tmpdir(), "sniptale-motion-"));
const workspace = join(temporary, ".tmp");
const evidence = join(output, "acceptance");
const steps = [];
await mkdir(workspace);
await rm(evidence, { recursive: true, force: true });
await mkdir(evidence);
try {
  const suppliedArchive = join(workspace, "motion.tgz");
  await cp(archive, suppliedArchive);
  const cache = join(workspace, "npm-cache");
  const prefix = join(workspace, "global");
  const common = [
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--cache",
    cache,
  ];
  await run("global-install", process.execPath, [
    npmCli,
    "install",
    "--global",
    "--prefix",
    prefix,
    ...common,
    suppliedArchive,
  ]);
  const installed =
    process.platform === "win32"
      ? join(prefix, "node_modules/@sniptale/motion")
      : join(prefix, "lib/node_modules/@sniptale/motion");
  const cli = join(installed, "bin/sniptale-motion.mjs");
  const installedManifest = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  assert.equal(installedManifest.name, "@sniptale/motion");
  assert.equal(installedManifest.version, inventory.version);
  assert.equal(Object.keys(installedManifest.dependencies ?? {}).length, 0);
  assert.equal(
    installedManifest.scripts,
    undefined,
    "Installed package must not require lifecycle scripts.",
  );
  if (process.platform !== "win32") {
    assert.equal(
      (
        await run("global-shim", join(prefix, "bin/sniptale-motion"), [
          "--version",
          "--json",
        ])
      ).version,
      inventory.version,
    );
  }
  assert.equal(
    (
      await run("npx", process.execPath, [
        npmCli,
        "exec",
        "--yes",
        ...common,
        "--package",
        suppliedArchive,
        "--",
        "sniptale-motion",
        "--version",
        "--json",
      ])
    ).version,
    inventory.version,
  );
  const invoke = (label, args, cwd = workspace, expected = 0) =>
    run(label, process.execPath, [cli, ...args, "--json"], cwd, expected);
  assert.match(
    (await invoke("help", ["--help", "--locale", "en"])).help,
    /Commands:/,
  );
  assert.equal((await invoke("doctor", ["doctor"])).version, inventory.version);
  assert.equal((await invoke("docs", ["docs"])).ok, true);
  const project = join(workspace, "проект с пробелами");
  await invoke("init", ["init", project]);
  for (const kind of ["standalone", "targetEffect", "transition"]) {
    await invoke(
      `new-${kind}`,
      ["new", kind.toLowerCase(), "--kind", kind],
      project,
    );
    const result = await invoke(
      `validate-${kind}`,
      ["validate", `effects/${kind.toLowerCase()}/effect.sniptale-effect.json`],
      project,
    );
    assert.equal(result.ok, true);
    assert.equal(result.proof.runtime, "not-run");
  }
  const assetDirectory = join(project, "effects/standalone");
  const effectFile = join(assetDirectory, "effect.sniptale-effect.json");
  const document = JSON.parse(await readFile(effectFile, "utf8"));
  await writeFile(
    join(assetDirectory, "mark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
  );
  document.assets = [
    { id: "mark", kind: "svg", mimeType: "image/svg+xml", path: "mark.svg" },
  ];
  document.program.commands.push({
    op: "image",
    assetId: "mark",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  await writeFile(effectFile, JSON.stringify(document));
  assert.equal(
    (await invoke("relative-asset", ["validate", effectFile], project)).ok,
    true,
  );
  document.assets[0].path = "../outside.svg";
  await writeFile(effectFile, JSON.stringify(document));
  assert.equal(
    (await invoke("asset-traversal", ["validate", effectFile], project, 1))
      .diagnostics[0].code,
    "ASSET_PATH_UNSAFE",
  );
  assert.equal((await invoke("repeat-init", ["init"], project, 1)).ok, false);
  assert.equal(
    (await invoke("repeat-new", ["new", "standalone"], project, 1)).ok,
    false,
  );
  assert.equal(
    (await invoke("bad-option", ["doctor", "--unknown"], project, 2)).ok,
    false,
  );
  await writeFile(join(project, "broken.json"), "{");
  assert.equal(
    (await invoke("invalid-json", ["validate", "broken.json"], project, 1)).ok,
    false,
  );
  inventory.checks.standaloneInstall = "passed";
  await writeFile(
    join(output, "inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  await writeFile(
    join(evidence, "summary.json"),
    `${JSON.stringify({ status: "passed", sha256: digest, platform: process.platform, node: process.version, sourceRepositoryRequired: false, steps, nativeWindows: process.platform === "win32" ? "incomplete-shim-check" : "not-run" }, null, 2)}\n`,
  );
  console.log(
    `Standalone npm acceptance passed: ${steps.length} steps; archive ${digest}.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function run(label, command, args, cwd = workspace, expected = 0) {
  const log = join(evidence, `${label}.stdout`);
  const errorLog = join(evidence, `${label}.stderr`);
  const stdout = await open(log, "wx");
  const stderr = await open(errorLog, "wx");
  let result;
  try {
    result = spawnSync(command, args, {
      cwd,
      stdio: ["ignore", stdout.fd, stderr.fd],
      timeout: 60_000,
    });
  } finally {
    await stdout.close();
    await stderr.close();
  }
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    expected,
    `${label}: unexpected exit code; see ${errorLog}`,
  );
  steps.push({ label, exitCode: result.status });
  const text = await readFile(log, "utf8");
  return label === "global-install" ? undefined : JSON.parse(text);
}
