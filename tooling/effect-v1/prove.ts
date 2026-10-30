import { resolve } from "node:path";

import { createSmokeRuntime } from "../test/smoke/runtime.mjs";
import { readMaterializedEffectV1Bundle } from "../../src/apps/cli/bundle-source.js";
import { createEffectV1AssetMaterializationProof } from "./proof-assets.js";
import {
  createEffectV1ControlProofCases,
  didEffectV1ControlChange,
} from "./proof-controls.js";
import { createEffectV1RuntimeContractProof } from "./proof-contract.js";
import {
  assessEffectV1FrameProof,
  createEffectV1ProofTimes,
} from "./proof-frames.js";

const { assetRoot, file } = parseArguments(process.argv.slice(2));
if (!file) {
  process.stderr.write(
    "Usage: npm run effect:prove -- <effect.sniptale-effect.json> [--asset-root <dir>]\n",
  );
  process.exit(2);
}

const source = await readMaterializedEffectV1Bundle(
  resolve(file),
  assetRoot ? resolve(assetRoot) : null,
);
const document = JSON.parse(source);
const runtime = await createSmokeRuntime();

try {
  const { page, sandboxPort, viewerPort } = runtime;
  await page.goto(
    `http://127.0.0.1:${viewerPort}/index.html?sandboxPort=${sandboxPort}`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(() => {
    const state = window.effectsViewer?.getState();
    return Boolean(
      state &&
      document.querySelector("#packStatus")?.classList.contains("ready") &&
      document
        .querySelector("#diagnostics")
        ?.textContent?.includes("Sandbox runtime ready.") &&
      (state.templates.length === 0 || state.currentTemplate),
    );
  });
  const importBaseline = await page.evaluate(() => {
    const state = window.effectsViewer.getState();
    return {
      assetBitmapTransfers: state.assetBitmapTransfers,
      assetEnvelopeTransfers: state.assetEnvelopeTransfers,
    };
  });
  const imported = await page.evaluate(
    (payload) => window.effectsViewer.importEffectFileForTest(payload),
    source,
  );
  if (!imported.ok || !imported.templateId) {
    throw new Error(`Import failed: ${imported.errors.join("; ")}`);
  }
  const mediaIsolation = await proveTemporaryMediaIsolation(
    page,
    document.kind,
  );
  const before = await page.evaluate(() => {
    const state = window.effectsViewer.getState();
    return {
      recovery: state.sandboxRecoveryAttempts,
      stale: state.staleResponses,
    };
  });
  const duration = Number(document.duration);
  const frames = await renderFrames(
    page,
    imported.templateId,
    createEffectV1ProofTimes(duration),
  );
  const frameAssessment = assessEffectV1FrameProof(frames);
  const controlTimes = [duration * 0.2, duration * 0.5, duration * 0.8];
  const controlBaseline = await renderFrames(
    page,
    imported.templateId,
    controlTimes,
  );
  const controlMatrix = [];
  for (const controlCase of createEffectV1ControlProofCases(
    document.controls,
  )) {
    await page.evaluate(
      ({ id, value }) => window.effectsViewer.setControl(id, value),
      controlCase,
    );
    const variantFrames = await renderFrames(
      page,
      imported.templateId,
      controlTimes,
    );
    await page.evaluate(
      ({ defaultValue, id }) =>
        window.effectsViewer.setControl(id, defaultValue),
      controlCase,
    );
    controlMatrix.push({
      changed: didEffectV1ControlChange(controlBaseline, variantFrames),
      frames: variantFrames,
      id: controlCase.id,
      value: controlCase.value,
    });
  }
  const runtimeContract = await page.evaluate(async () => {
    const coverage =
      await window.effectsViewer.refreshRendererContractCoverageForTest();
    const issues = window.effectsViewer.getContractValidationIssuesForTest();
    return { coverage, issues };
  });
  const contract = createEffectV1RuntimeContractProof(
    document,
    runtimeContract.coverage,
    runtimeContract.issues,
  );
  const after = await page.evaluate(() => {
    const state = window.effectsViewer.getState();
    return {
      diagnostics: document.querySelector("#diagnostics")?.textContent ?? "",
      assetBitmapTransfers: state.assetBitmapTransfers,
      assetEnvelopeTransfers: state.assetEnvelopeTransfers,
      effectIds: state.effectIds,
      previewMediaVisible: !document.querySelector("#previewMediaMenu").hidden,
      recovery: state.sandboxRecoveryAttempts,
      renderCount: state.renderCount,
      scale: state.appliedPreviewScale,
      stale: state.staleResponses,
    };
  });
  const expectedPreviewMedia = ["targetEffect", "transition"].includes(
    document.kind,
  );
  const assetMaterialization = createEffectV1AssetMaterializationProof(
    document,
    importBaseline,
    after,
    after.diagnostics,
  );
  const proof = {
    assetMaterialization,
    effectId: document.id,
    contract,
    controlMatrix,
    frameAssessment,
    frames,
    kind: document.kind,
    mediaIsolation,
    previewMediaVisible: after.previewMediaVisible,
    diagnostics: after.diagnostics,
    effectIds: after.effectIds,
    recoveryDelta: after.recovery - before.recovery,
    renderCount: after.renderCount,
    scale: after.scale,
    staleDelta: after.stale - before.stale,
  };
  if (
    !frameAssessment.ok ||
    !assetMaterialization.ok ||
    after.previewMediaVisible !== expectedPreviewMedia ||
    !mediaIsolation.ok ||
    !contract.ok ||
    controlMatrix.some((control) => !control.changed) ||
    proof.recoveryDelta !== 0 ||
    proof.renderCount < frames.length ||
    proof.scale !== 1 ||
    proof.staleDelta !== 0
  ) {
    throw new Error(`Runtime proof failed: ${JSON.stringify(proof)}`);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, proof }, null, 2)}\n`);
} finally {
  await runtime.close();
}

async function renderFrames(page, templateId, times) {
  const frames = [];
  for (const time of times) {
    frames.push(
      await page.evaluate(
        async ({ templateId, time }) => {
          await window.effectsViewer.renderTemplateFrame(templateId, time);
          const canvas = document.querySelector("#previewCanvas");
          const pixels = canvas
            .getContext("2d", { willReadFrequently: true })
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let occupied = 0;
          let lit = 0;
          for (let index = 0; index < pixels.length; index += 4 * 97) {
            if (pixels[index + 3] > 0) occupied += 1;
            if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 24) {
              lit += 1;
            }
          }
          const digest = await crypto.subtle.digest("SHA-256", pixels);
          return {
            hash: Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join(""),
            lit,
            occupied,
            time,
          };
        },
        { templateId, time },
      ),
    );
  }
  return frames;
}

function parseArguments(args) {
  let assetRoot = null;
  let file = null;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--asset-root") {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) return {};
      assetRoot = next;
      index += 1;
      continue;
    }
    if (value.startsWith("--") || file) return {};
    file = value;
  }
  return { assetRoot, file };
}

async function proveTemporaryMediaIsolation(page, kind) {
  const slots =
    kind === "targetEffect"
      ? [["source", "#previewMediaSourceInput"]]
      : kind === "transition"
        ? [
            ["from", "#previewMediaFromInput"],
            ["to", "#previewMediaToInput"],
          ]
        : [];
  const before = await page.evaluate(() => {
    const state = window.effectsViewer.getState();
    return {
      draftRevision: state.editorDraft.revision,
      historyPast: state.historyPast,
    };
  });
  const fileNames = [];
  for (const [slot, selector] of slots) {
    const name = `session-only-${slot}.png`;
    fileNames.push(name);
    await page.locator(selector).setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHgQCAeV8S7sAAAAASUVORK5CYII=",
        "base64",
      ),
      mimeType: "image/png",
      name,
    });
    await page.waitForFunction(
      ({ name, slot }) =>
        document.querySelector(`[data-preview-media-status="${slot}"]`)
          ?.textContent === name,
      { name, slot },
    );
  }
  const after = await page.evaluate((names) => {
    const state = window.effectsViewer.getState();
    const templateJson = window.effectsViewer.getTemplateJsonForTest();
    return {
      draftRevision: state.editorDraft.revision,
      historyPast: state.historyPast,
      leakedFileName: names.some((name) => templateJson.includes(name)),
    };
  }, fileNames);
  return {
    loadedSlots: slots.map(([slot]) => slot),
    ok:
      after.draftRevision === before.draftRevision &&
      after.historyPast === before.historyPast &&
      !after.leakedFileName,
  };
}
