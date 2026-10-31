import { responseField, responseString } from "../../test/fixtures/response.ts";
import type { AcceptanceInvoke } from "./acceptance-contract.ts";
import { inputRecord, parsePackResult } from "./package-input.ts";
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
}: {
  invoke: AcceptanceInvoke;
  installed: string;
  workspace: string;
  npmCli: string;
  common: readonly string[];
  archive: string;
  evidence: string;
}) {
  const project = join(workspace, "compatibility-project");
  await invoke("compatibility-init", ["init", project]);
  const version = await invoke("compatibility-version", ["--version"], project);
  const manifest = inputRecord(
    JSON.parse(await readFile(join(installed, "package.json"), "utf8")),
    "Installed manifest",
  );
  assert.deepEqual(
    responseField(version, "compatibility"),
    manifest.sniptaleMotion,
  );
  const header = join(project, "sniptale-motion.json");
  const bytes = await readFile(header);
  const parsed = inputRecord(
    JSON.parse(bytes.toString("utf8")),
    "Project header",
  );
  assert.equal(
    parsed.toolkitCompatibility,
    responseField(version, "compatibility", "toolkitCompatibility"),
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
    assert.equal(responseField(doctor, "project", "legacy"), true);
    await invoke("legacy-project-new", ["new", "legacy-accepted"], project);
    assert.deepEqual(await readFile(header), legacyBytes);
    await writeFile(
      header,
      JSON.stringify({ ...parsed, toolkitCompatibility: "future" }),
    );
    const foreignCommands: [string, string[]][] = [
      ["new", ["new", "future-rejected"]],
      ["studio", ["studio"]],
      ["doctor", ["doctor", "--project", project]],
      ["update", ["check-update", "--project", project]],
    ];
    for (const [label, args] of foreignCommands) {
      const result = await invoke(`foreign-project-${label}`, args, project, 1);
      assert.equal(
        responseField(result, "diagnostics", 0, "code"),
        "PROJECT_VERSION",
      );
    }
  } finally {
    await writeFile(header, bytes);
  }

  const fixture = join(workspace, "update-fixture");
  const prefix = join(workspace, "update-install");
  const packs = join(workspace, "update-packs");
  await cp(installed, fixture, { recursive: true });
  await mkdir(packs);
  const nextVersion = semver.inc(responseString(version, "version"), "patch");
  assert.ok(nextVersion);
  const versionFiles: [string, string][] = [
    ["package.json", "version"],
    ["skill-kit.json", "toolkitVersion"],
    ["skills/create-effect/references/toolkit.json", "toolkitVersion"],
  ];
  for (const [file, key] of versionFiles) {
    const path = join(fixture, file);
    const value = inputRecord(
      JSON.parse(await readFile(path, "utf8")),
      "Version fixture",
    );
    value[key] = nextVersion;
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  }
  const execute = promisify(execFile);
  const npm = async (args: readonly string[], cwd = workspace) => {
    const result = await execute(
      process.execPath,
      [npmCli, ...args, ...common],
      { cwd, timeout: 60_000 },
    );
    return result.stdout;
  };
  const packed = parsePackResult(
    JSON.parse(
      await npm(["pack", fixture, "--pack-destination", packs, "--json"]),
    ),
    { name: responseString(manifest, "name"), version: nextVersion },
  );
  const nextArchive = join(packs, packed.filename);
  const cli = join(
    prefix,
    process.platform === "win32" ? "node_modules" : "lib/node_modules",
    "@sniptale/motion/bin/sniptale-motion.mjs",
  );
  const inspect = async (expected: string) => {
    const result = await execute(process.execPath, [cli, "skills", "--json"], {
      cwd: project,
      timeout: 30_000,
    });
    assert.equal(
      inputRecord(JSON.parse(result.stdout), "Installed skills").toolkitVersion,
      expected,
    );
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
  const installations: [string, string][] = [
    [archive, responseString(version, "version")],
    [nextArchive, nextVersion],
    [archive, responseString(version, "version")],
  ];
  for (const [input, expected] of installations) {
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
        versions: [
          responseString(version, "version"),
          nextVersion,
          responseString(version, "version"),
        ],
        projectPreserved: true,
      },
      null,
      2,
    )}\n`,
  );
}
