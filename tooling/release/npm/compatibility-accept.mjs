import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import semver from "semver";

// Local fixture versions test npm replacement mechanics, not a public release.
export async function acceptInstalledCompatibility({
  invoke,
  installed,
  workspace,
  npmCli,
  common,
  archive,
  evidence,
}) {
  const project = join(workspace, "compatibility-project");
  await invoke("compatibility-init", ["init", project]);
  const version = await invoke("compatibility-version", ["--version"], project);
  const manifest = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  assert.deepEqual(version.compatibility, manifest.sniptaleMotion);
  const header = join(project, "sniptale-motion.json");
  const bytes = await readFile(header);
  const parsed = JSON.parse(bytes.toString("utf8"));
  assert.equal(
    parsed.toolkitCompatibility,
    version.compatibility.toolkitCompatibility,
  );
  try {
    const legacy = { ...parsed };
    delete legacy.toolkitCompatibility;
    const legacyBytes = Buffer.from(JSON.stringify(legacy));
    await writeFile(header, legacyBytes);
    const doctor = await invoke("legacy-project-doctor", [
      "doctor",
      "--project",
      project,
    ]);
    assert.equal(doctor.project.legacy, true);
    await invoke("legacy-project-new", ["new", "legacy-accepted"], project);
    assert.deepEqual(await readFile(header), legacyBytes);
    await writeFile(
      header,
      JSON.stringify({ ...parsed, toolkitCompatibility: "future" }),
    );
    for (const [label, args] of [
      ["new", ["new", "future-rejected"]],
      ["studio", ["studio"]],
      ["doctor", ["doctor", "--project", project]],
      ["update", ["check-update", "--project", project]],
    ]) {
      const result = await invoke(`foreign-project-${label}`, args, project, 1);
      assert.equal(result.diagnostics[0].code, "PROJECT_VERSION");
    }
  } finally {
    await writeFile(header, bytes);
  }

  const fixture = join(workspace, "update-fixture");
  const prefix = join(workspace, "update-install");
  const packs = join(workspace, "update-packs");
  await cp(installed, fixture, { recursive: true });
  await mkdir(packs);
  const nextVersion = semver.inc(version.version, "patch");
  assert.ok(nextVersion);
  for (const [file, key] of [
    ["package.json", "version"],
    ["skill-kit.json", "toolkitVersion"],
    ["skills/create-effect/references/toolkit.json", "toolkitVersion"],
  ]) {
    const path = join(fixture, file);
    const value = JSON.parse(await readFile(path, "utf8"));
    value[key] = nextVersion;
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  }
  const execute = promisify(execFile);
  const npm = async (args, cwd = workspace) => {
    const result = await execute(
      process.execPath,
      [npmCli, ...args, ...common],
      { cwd, timeout: 60_000 },
    );
    return result.stdout;
  };
  const packResult = JSON.parse(
    await npm(["pack", fixture, "--pack-destination", packs, "--json"]),
  );
  const packed = Array.isArray(packResult)
    ? packResult
    : Object.values(packResult);
  assert.equal(packed.length, 1);
  assert.equal(packed[0].name, manifest.name);
  assert.equal(packed[0].version, nextVersion);
  const nextArchive = join(packs, packed[0].filename);
  const cli = join(
    prefix,
    process.platform === "win32" ? "node_modules" : "lib/node_modules",
    "@sniptale/motion/bin/sniptale-motion.mjs",
  );
  const inspect = async (expected) => {
    const result = await execute(process.execPath, [cli, "skills", "--json"], {
      cwd: project,
      timeout: 30_000,
    });
    assert.equal(JSON.parse(result.stdout).toolkitVersion, expected);
    assert.deepEqual(await readFile(header), bytes);
    assert.deepEqual(
      await readFile(join(project, "user-source.txt")),
      userBytes,
    );
  };
  const userBytes = Buffer.from(
    "Пользовательский файл сохраняется при замене toolkit.\n",
  );
  await writeFile(join(project, "user-source.txt"), userBytes, { flag: "wx" });
  const effectPath = join(
    project,
    "effects/legacy-accepted/effect.sniptale-effect.json",
  );
  const effectBytes = await readFile(effectPath);
  for (const [input, expected] of [
    [archive, version.version],
    [nextArchive, nextVersion],
    [archive, version.version],
  ]) {
    await npm(["install", "--global", "--prefix", prefix, input]);
    await inspect(expected);
    assert.deepEqual(await readFile(effectPath), effectBytes);
  }
  await writeFile(
    join(evidence, "npm-update-rollback.json"),
    `${JSON.stringify(
      {
        status: "passed",
        fixtureOnly: true,
        publicRegistryInstall: "not-run",
        versions: [version.version, nextVersion, version.version],
        projectPreserved: true,
      },
      null,
      2,
    )}\n`,
  );
}
