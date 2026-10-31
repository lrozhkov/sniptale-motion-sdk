import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export async function acceptInstalledSkills({
  invoke,
  project,
  installer,
  evidence,
}) {
  const kit = await invoke("skills", ["skills"], project);
  const descriptor = JSON.parse(
    await readFile(join(kit.skill.path, "references/toolkit.json"), "utf8"),
  );
  assert.equal(descriptor.toolkitVersion, kit.toolkitVersion);
  assert.equal(descriptor.runtimeDigest, kit.runtimeDigest);
  assert.equal(descriptor.skillDigest, kit.skillDigest);
  assert.equal(kit.installer.optional, true);
  const workspace = join(project, ".tmp/skill-install");
  await mkdir(workspace, { recursive: true });
  const result = await promisify(execFile)(
    process.execPath,
    [
      installer,
      "add",
      kit.skill.path,
      "--skill",
      "create-effect",
      "--agent",
      "codex",
      "--copy",
      "--yes",
    ],
    {
      cwd: workspace,
      env: { ...process.env, ...kit.installer.env },
      timeout: 30_000,
    },
  );
  await writeFile(join(evidence, "skill-installer.stdout"), result.stdout);
  await writeFile(join(evidence, "skill-installer.stderr"), result.stderr);
  const copied = join(workspace, ".agents/skills/create-effect");
  const names = await collect(copied);
  assert.deepEqual(names, await collect(kit.skill.path));
  for (const name of names) {
    const source = await readFile(join(kit.skill.path, name));
    const copy = await readFile(join(copied, name));
    assert.deepEqual(copy, source);
    if (!name.endsWith(".md")) continue;
    for (const match of copy.toString("utf8").matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      const path = resolve(dirname(join(copied, name)), target);
      const within = relative(copied, path);
      assert.ok(
        within !== ".." &&
          !within.startsWith("../") &&
          !within.startsWith("..\\") &&
          !isAbsolute(within),
      );
      await readFile(path);
    }
  }
  const version = await promisify(execFile)(
    kit.cli.node,
    [kit.cli.entry, "--version", "--json"],
    { cwd: workspace },
  );
  assert.equal(JSON.parse(version.stdout).version, kit.toolkitVersion);
  const schema = await readFile(kit.schema);
  try {
    await writeFile(kit.schema, "{}");
    const changed = await invoke(
      "skills-tampered-runtime",
      ["skills"],
      project,
      1,
    );
    assert.equal(changed.diagnostics[0].code, "SKILL_KIT");
  } finally {
    await writeFile(kit.schema, schema);
  }
  await writeFile(
    join(evidence, "skill-install.json"),
    `${JSON.stringify({ status: "passed", installerVersion: kit.installer.version, testedAgent: "codex", toolkitVersion: kit.toolkitVersion, runtimeDigest: kit.runtimeDigest, skillDigest: kit.skillDigest, copiedFiles: names }, null, 2)}\n`,
  );
}
async function collect(root, prefix = "") {
  const result = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await collect(root, path)));
    else {
      assert.ok(entry.isFile());
      result.push(path);
    }
  }
  return result.sort();
}
