import { parseEffectV1Fixture } from "../../test/fixtures/effect-v1-documents.ts";
import { responseField, responseString } from "../../test/fixtures/response.ts";
import type { AcceptanceInvoke } from "./acceptance-contract.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function acceptInstalledProof({
  invoke,
  project,
}: {
  invoke: AcceptanceInvoke;
  project: string;
}) {
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
    assert.equal(responseField(result, "ok"), true);
    assert.equal(responseField(result, "proof", "runtime"), "passed");
    assert.equal(
      responseField(result, "proof", "browser", "channel"),
      "chromium",
    );
    assert.match(
      responseString(result, "proof", "browser", "version"),
      /^\d+(?:\.\d+){1,3}$/,
    );
    assert.equal(
      responseField(result, "proof", "materializedSha256"),
      createHash("sha256").update(original).digest("hex"),
    );
    assert.equal(responseField(result, "proof", "deterministic"), true);
    assert.equal(
      responseField(result, "proof", "recovery", "restartStable"),
      true,
    );
    assert.equal(
      responseField(result, "proof", "recovery", "generationChanged"),
      true,
    );
    assert.equal(
      responseField(result, "proof", "media", "exportUnchanged"),
      true,
    );
    assert.equal(
      responseField(result, "proof", "media", "sessionFilesLeaked"),
      false,
    );
    assert.equal(JSON.stringify(result).includes(project), false);
    assert.deepEqual(await readFile(file), original);
  }
  const fixtures = join(project, ".tmp/proof-negative");
  await mkdir(fixtures, { recursive: true });
  const original = parseEffectV1Fixture(
    await readFile(
      join(project, "effects/standalone/effect.sniptale-effect.json"),
      "utf8",
    ),
  );
  const frozen = structuredClone(original);
  const shape = frozen.program.commands.find(
    (command) => command.op === "shape",
  );
  assert.ok(shape, "Standalone fixture must contain a shape command.");
  shape.x = 140;
  const file = join(fixtures, "frozen.json");
  await writeFile(file, JSON.stringify(frozen));
  assert.equal(
    responseField(
      await invoke("validate-frozen", ["validate", file], project),
      "ok",
    ),
    true,
  );
  const frozenResult = await invoke(
    "prove-frozen",
    ["prove", file, "--browser-channel", "chromium"],
    project,
    1,
  );
  assert.equal(responseField(frozenResult, "proof", "runtime"), "failed");
  assert.equal(
    responseField(frozenResult, "proof", "assessment", "animated"),
    false,
  );
  const invisible = structuredClone(original);
  invisible.program.commands = invisible.program.commands.map((command) =>
    command.op === "clear"
      ? { ...command, color: "#00000000" }
      : { ...command, alpha: 0 },
  );
  const hidden = join(fixtures, "invisible.json");
  await writeFile(hidden, JSON.stringify(invisible));
  assert.equal(
    responseField(
      await invoke("validate-invisible", ["validate", hidden], project),
      "ok",
    ),
    true,
  );
  const hiddenResult = await invoke(
    "prove-invisible",
    ["prove", hidden, "--browser-channel", "chromium"],
    project,
    1,
  );
  assert.equal(
    responseField(hiddenResult, "proof", "assessment", "midpointVisible"),
    false,
  );
  assert.equal(
    (await readdir(join(project, ".tmp"))).some((name) =>
      name.startsWith("motion-proof-"),
    ),
    false,
  );
}
