import {
  responseField,
  responseString,
  responseEnvironment,
} from "../../test/fixtures/response.ts";
import type { AcceptanceInvoke } from "./acceptance-contract.ts";
import { inputRecord } from "./package-input.ts";
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
}: {
  invoke: AcceptanceInvoke;
  project: string;
  installer: string;
  evidence: string;
}) {
  const kit = await invoke("skills", ["skills"], project);
  const descriptor = inputRecord(
    JSON.parse(
      await readFile(
        join(responseString(kit, "skill", "path"), "references/toolkit.json"),
        "utf8",
      ),
    ),
    "Skill descriptor",
  );
  assert.equal(
    descriptor.toolkitVersion,
    responseString(kit, "toolkitVersion"),
  );
  assert.equal(descriptor.runtimeDigest, responseString(kit, "runtimeDigest"));
  assert.equal(descriptor.skillDigest, responseString(kit, "skillDigest"));
  assert.equal(responseField(kit, "installer", "optional"), true);
  const workspace = join(project, ".tmp/skill-install");
  await mkdir(workspace, { recursive: true });
  const result = await promisify(execFile)(
    process.execPath,
    [
      installer,
      "add",
      responseString(kit, "skill", "path"),
      "--skill",
      "create-effect",
      "--agent",
      "codex",
      "--copy",
      "--yes",
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        ...responseEnvironment(responseField(kit, "installer", "env")),
      },
      timeout: 30_000,
    },
  );
  await writeFile(join(evidence, "skill-installer.stdout"), result.stdout);
  await writeFile(join(evidence, "skill-installer.stderr"), result.stderr);
  const copied = join(workspace, ".agents/skills/create-effect");
  const names = await collect(copied);
  assert.deepEqual(names, await collect(responseString(kit, "skill", "path")));
  for (const name of names) {
    const source = await readFile(
      join(responseString(kit, "skill", "path"), name),
    );
    const copy = await readFile(join(copied, name));
    assert.deepEqual(copy, source);
    if (!name.endsWith(".md")) continue;
    for (const match of copy.toString("utf8").matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1]?.split("#")[0];
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
    responseString(kit, "cli", "node"),
    [responseString(kit, "cli", "entry"), "--version", "--json"],
    { cwd: workspace },
  );
  assert.equal(
    inputRecord(JSON.parse(version.stdout), "CLI version").version,
    responseString(kit, "toolkitVersion"),
  );
  const schema = await readFile(responseString(kit, "schema"));
  try {
    await writeFile(responseString(kit, "schema"), "{}");
    const changed = await invoke(
      "skills-tampered-runtime",
      ["skills"],
      project,
      1,
    );
    assert.equal(responseField(changed, "diagnostics", 0, "code"), "SKILL_KIT");
  } finally {
    await writeFile(responseString(kit, "schema"), schema);
  }
  await writeFile(
    join(evidence, "skill-install.json"),
    `${JSON.stringify({ status: "passed", installerVersion: responseString(kit, "installer", "version"), testedAgent: "codex", toolkitVersion: responseString(kit, "toolkitVersion"), runtimeDigest: responseString(kit, "runtimeDigest"), skillDigest: responseString(kit, "skillDigest"), copiedFiles: names }, null, 2)}\n`,
  );
}
async function collect(root: string, prefix = ""): Promise<string[]> {
  const result: string[] = [];
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
