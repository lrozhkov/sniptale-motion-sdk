import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function acceptInstalledProof({ invoke, project }) {
  for (const kind of ["standalone", "targetEffect", "transition"]) {
    const file = join(
      project,
      `effects/${kind.toLowerCase()}/effect.sniptale-effect.json`,
    );
    const original = await readFile(file);
    const result = await invoke(
      `prove-${kind}`,
      ["prove", file, "--browser-channel", "chromium"],
      project,
    );
    assert.equal(result.ok, true);
    assert.equal(result.proof.runtime, "passed");
    assert.equal(result.proof.browser.channel, "chromium");
    assert.match(result.proof.browser.version, /^\d+(?:\.\d+){1,3}$/);
    assert.equal(
      result.proof.materializedSha256,
      createHash("sha256").update(original).digest("hex"),
    );
    assert.equal(result.proof.deterministic, true);
    assert.equal(result.proof.recovery.restartStable, true);
    assert.equal(result.proof.recovery.generationChanged, true);
    assert.equal(result.proof.media.exportUnchanged, true);
    assert.equal(result.proof.media.sessionFilesLeaked, false);
    assert.equal(JSON.stringify(result).includes(project), false);
    assert.deepEqual(await readFile(file), original);
  }
  const fixtures = join(project, ".tmp/proof-negative");
  await mkdir(fixtures, { recursive: true });
  const original = JSON.parse(
    await readFile(
      join(project, "effects/standalone/effect.sniptale-effect.json"),
      "utf8",
    ),
  );
  const frozen = structuredClone(original);
  frozen.program.commands.find((command) => command.op === "shape").x = 140;
  const file = join(fixtures, "frozen.json");
  await writeFile(file, JSON.stringify(frozen));
  assert.equal(
    (await invoke("validate-frozen", ["validate", file], project)).ok,
    true,
  );
  const frozenResult = await invoke(
    "prove-frozen",
    ["prove", file, "--browser-channel", "chromium"],
    project,
    1,
  );
  assert.equal(frozenResult.proof.runtime, "failed");
  assert.equal(frozenResult.proof.assessment.animated, false);
  const invisible = structuredClone(original);
  invisible.program.commands = invisible.program.commands.map((command) =>
    command.op === "clear"
      ? { ...command, color: "#00000000" }
      : { ...command, alpha: 0 },
  );
  const hidden = join(fixtures, "invisible.json");
  await writeFile(hidden, JSON.stringify(invisible));
  assert.equal(
    (await invoke("validate-invisible", ["validate", hidden], project)).ok,
    true,
  );
  const hiddenResult = await invoke(
    "prove-invisible",
    ["prove", hidden, "--browser-channel", "chromium"],
    project,
    1,
  );
  assert.equal(hiddenResult.proof.assessment.midpointVisible, false);
  assert.equal(
    (await readdir(join(project, ".tmp"))).some((name) =>
      name.startsWith("motion-proof-"),
    ),
    false,
  );
}
