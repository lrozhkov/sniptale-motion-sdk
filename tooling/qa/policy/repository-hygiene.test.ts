import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectRepositoryFiles,
  findTrackedLocalContent,
  findHardWrappedProse,
  findWideMarkdownTables,
  hasStaleProductTitle,
  inspectDebtPolicySource,
  inspectPublicationBoundary,
  inspectRetiredIdentityText,
  inspectTrackedIndexIdentity,
  inspectRootTopology,
  isSkillMarkdownPath,
  isTemporaryFilePath,
} from "./repository-hygiene.ts";

describe("repository hygiene policy", () => {
  it("rejects retired product and effect identities without an allowlist", () => {
    const retiredProduct = ["screen", "yx"].join("");
    const retiredShortRoot = ["S", "C", "X"].join("");
    const retiredCamelRoot = ["s", "c", "x", "Owner"].join("");
    const retiredMixedRoot = ["s", "C", "x", "Owner"].join("");
    const retiredContract = ["Effect", "V", "4"].join("");

    expect(
      inspectRetiredIdentityText(
        `src/${retiredProduct}/owner.ts`,
        `const product = ${JSON.stringify(retiredProduct)}; const ${retiredShortRoot}_MODE = ${JSON.stringify(retiredContract)}; const ${retiredCamelRoot} = true; const ${retiredMixedRoot} = true;`,
        "content",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("retired product identity"),
        expect.stringContaining("retired short product identity"),
        expect.stringContaining("retired effect contract identity"),
      ]),
    );
    expect(
      inspectRetiredIdentityText(
        "src/sniptale/effect-v1.ts",
        "Sniptale Motion SDK uses sniptale.effect.v1.",
        "content",
      ),
    ).toEqual([]);
  });

  it("inspects raw index blobs and rejects tracked special entries", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-index-identity-"));
    const retiredProduct = ["smart", "capture"].join("");
    try {
      execFileSync("git", ["init", "-q"], { cwd: root });
      writeFileSync(join(root, "owner.ts"), retiredProduct);
      execFileSync("git", ["add", "owner.ts"], { cwd: root });
      const linkObject = execFileSync("git", ["hash-object", "-w", "--stdin"], {
        cwd: root,
        input: "owner.ts",
        encoding: "utf8",
      }).trim();
      execFileSync(
        "git",
        [
          "update-index",
          "--add",
          "--cacheinfo",
          `120000,${linkObject},linked-owner`,
        ],
        { cwd: root },
      );
      rmSync(join(root, "owner.ts"));

      expect(inspectTrackedIndexIdentity(root)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "index content contains a retired product identity",
          ),
          expect.stringContaining(
            "tracked identity entries must be regular files",
          ),
        ]),
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("pins GitHub-only source publication and private security reporting", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-publication-policy-"));
    try {
      mkdirSync(join(root, "tooling/configs/qa"), { recursive: true });
      mkdirSync(join(root, "docs/oss"), { recursive: true });
      writeFileSync(
        join(root, "tooling/configs/qa/publication.json"),
        JSON.stringify({
          schemaVersion: 2,
          publication: "github-source",
          gitHubPublication: "lrozhkov/sniptale-motion-sdk",
          gitHubActions: "checks-only",
          registryPublication: "not-authorized",
          securityReporting: "github-private-vulnerability-reporting",
        }),
      );
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          homepage: "https://github.com/lrozhkov/sniptale-motion-sdk#readme",
          private: true,
          repository: "https://github.com/lrozhkov/sniptale-motion-sdk.git",
          scripts: { test: "vitest run" },
        }),
      );
      writeFileSync(
        join(root, "SECURITY.md"),
        "Report suspected vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/lrozhkov/sniptale-motion-sdk/security/advisories/new).\n",
      );
      writeFileSync(
        join(root, "docs/oss/release.md"),
        "GitHub source publication is authorized only for [lrozhkov/sniptale-motion-sdk](https://github.com/lrozhkov/sniptale-motion-sdk).\nGitHub Actions is authorized only for checks and local npm archive preparation.\n",
      );
      mkdirSync(join(root, ".github/workflows"), { recursive: true });
      writeFileSync(
        join(root, ".github/workflows/ci.yml"),
        readFileSync(".github/workflows/ci.yml", "utf8"),
      );

      expect(inspectPublicationBoundary(root)).toEqual([]);

      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          private: true,
          homepage: "https://github.example.test/project",
          repository: "https://github.example.test/project.git",
          bugs: "https://github.example.test/project/issues",
          scripts: { publish: "npm publish", push: "git push" },
        }),
      );
      writeFileSync(join(root, "SECURITY.md"), "# Security\n");
      writeFileSync(
        join(root, "docs/oss/release.md"),
        "GitHub source publication is authorized for another owner.\nGitHub Actions runs every quality check.\n",
      );
      expect(inspectPublicationBoundary(root)).toEqual(
        expect.arrayContaining([
          'package.json#repository: expected "https://github.com/lrozhkov/sniptale-motion-sdk.git"',
          'package.json#homepage: expected "https://github.com/lrozhkov/sniptale-motion-sdk#readme"',
          "package.json#bugs: registry or public-intake metadata is not authorized",
          "package.json#scripts.publish: registry publication lifecycle is not authorized",
          "package.json#scripts.publish: external publication command is not authorized",
          "package.json#scripts.push: external publication command is not authorized",
          "SECURITY.md: reporting status must match GitHub private vulnerability reporting",
          "docs/oss/release.md: publication boundary must match the authorized GitHub target",
          "docs/oss/release.md: GitHub Actions boundary must remain checks-only",
        ]),
      );

      writeFileSync(
        join(root, "SECURITY.md"),
        "Report suspected vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/lrozhkov/sniptale-motion-sdk/security/advisories/new).\nReport vulnerabilities to security@example.test.\n",
      );
      expect(inspectPublicationBoundary(root)).toContain(
        "SECURITY.md: reporting instructions must have one private GitHub owner",
      );

      rmSync(join(root, ".github/workflows"), { recursive: true });
      expect(inspectPublicationBoundary(root)).toContain(
        ".github/workflows: checks-only CI workflow is required",
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("recognizes agent configuration directories but rejects files at that seam", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-agent-topology-"));
    try {
      mkdirSync(join(root, ".codex"));
      expect(inspectRootTopology(root)).toEqual([]);
      rmSync(join(root, ".codex"), { recursive: true });
      writeFileSync(join(root, ".codex"), "not a directory");
      expect(inspectRootTopology(root)).toContain(
        ".codex: root entry must be directory, found file",
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("enforces the root contract and rejects empty documentation directories", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-root-topology-"));
    try {
      mkdirSync(join(root, ".tmp"));
      mkdirSync(join(root, "docs", "empty"), { recursive: true });
      writeFileSync(join(root, "src"), "wrong kind\n");
      writeFileSync(join(root, "unexpected.txt"), "unknown owner\n");

      expect(inspectRootTopology(root)).toEqual(
        expect.arrayContaining([
          "docs/empty: empty documentation directory is forbidden",
          "src: root entry must be directory, found file",
          "unexpected.txt: root entry has no repository topology owner",
        ]),
      );
      expect(inspectRootTopology(root)).not.toContain(
        ".tmp: empty documentation directory is forbidden",
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("routes temporary file shapes to .tmp", () => {
    for (const file of [
      "docs/review.patch",
      "src/owner.ts.bak",
      "tests/result.tmp",
      "tooling/config.orig",
      "src/icon.svg.Zone.Identifier",
      "README.md~",
    ]) {
      expect(isTemporaryFilePath(file)).toBe(true);
    }
    expect(isTemporaryFilePath("src/apps/viewer/editor/draft-model.ts")).toBe(
      false,
    );
  });

  it("rejects forced prose wrapping but accepts natural paragraphs", () => {
    expect(
      findHardWrappedProse(
        "README.md",
        "# Title\n\nOne physical line contains the complete paragraph.\n\n- One complete list item.\n",
      ),
    ).toEqual([]);
    expect(
      findHardWrappedProse(
        "README.md",
        "# Title\n\nThis paragraph was\nwrapped by a formatter.\n",
      ),
    ).toEqual([
      "README.md:4: authored prose must use natural paragraphs without forced line wrapping",
    ]);
    expect(
      findHardWrappedProse(
        "README.md",
        "- This list item was\n  wrapped by a formatter.\n",
      ),
    ).toEqual([
      "README.md:2: authored prose must use natural paragraphs without forced line wrapping",
    ]);
    expect(
      findHardWrappedProse(
        "README.md",
        "1. This list item was\n   wrapped by a formatter.\n",
      ),
    ).toEqual([
      "README.md:2: authored prose must use natural paragraphs without forced line wrapping",
    ]);
    expect(
      findHardWrappedProse(
        ".agents/skills/create-effect/SKILL.md",
        "---\nname: create-effect\ndescription: One complete metadata description.\n---\n\nOne physical line contains the complete paragraph.\n",
      ),
    ).toEqual([]);
    expect(
      findHardWrappedProse(
        "README.md",
        "---\nThis malformed frontmatter was\nwrapped without a closing delimiter.\n",
      ),
    ).toEqual([
      "README.md:3: authored prose must use natural paragraphs without forced line wrapping",
    ]);
  });

  it("assigns both legacy and packaged skill Markdown to the skill owner", () => {
    for (const file of [
      ".agents/skills/code-review.md",
      ".agents/skills/create-effect/SKILL.md",
      ".agents/skills/create-effect/references/graph-runtime.md",
      ".agents/skills/asd-ste100/README.md",
      ".agents/skills/asd-ste100/examples/before-after.md",
    ]) {
      expect(isSkillMarkdownPath(file)).toBe(true);
    }
    for (const file of [
      ".agents/skills/create-effect/references/nested/runtime.md",
      ".agents/skills/create-effect/assets/notes.md",
    ]) {
      expect(isSkillMarkdownPath(file)).toBe(false);
    }
  });

  it("ignores fenced code while checking prose", () => {
    expect(
      findHardWrappedProse(
        "README.md",
        "```text\nthese lines may\nwrap as code\n```\n",
      ),
    ).toEqual([]);
  });

  it("limits Markdown tables to four columns", () => {
    expect(
      findWideMarkdownTables(
        "docs/README.md",
        "| One | Two | Three | Four |\n| --- | --- | --- | --- |\n",
      ),
    ).toEqual([]);
    expect(
      findWideMarkdownTables(
        "docs/README.md",
        "| One | Two | Three | Four | Five |\n",
      ),
    ).toEqual([
      "docs/README.md:1: Markdown tables are limited to four columns (5 found)",
    ]);
  });

  it("inspects the raw Git index even when an indexed storage file is absent from the worktree", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-repository-hygiene-"));
    const indexedFile = join(root, ".tmp", "indexed-only.txt");
    try {
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      mkdirSync(join(root, ".tmp"));
      writeFileSync(join(root, ".gitignore"), "/.tmp/\n");
      writeFileSync(indexedFile, "temporary evidence\n");
      execFileSync("git", ["add", "--force", ".tmp/indexed-only.txt"], {
        cwd: root,
      });
      rmSync(indexedFile);

      const { candidateFiles, trackedFiles } = collectRepositoryFiles(root);

      expect(candidateFiles).not.toContain(".tmp/indexed-only.txt");
      expect(trackedFiles).toContain(".tmp/indexed-only.txt");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps generated fixture and local-storage content out of the raw index", () => {
    expect(
      findTrackedLocalContent([
        ".tmp/evidence.json",
        "dist/apps/viewer/index.html",
        "node_modules/pkg/index.js",
        "public/packs/demo/manifest.json",
        "tests/fixtures/local-renderer.js",
        "tooling/test/fixtures/local-pack.ts",
        "tests/unit.test.ts",
      ]),
    ).toEqual([
      ".tmp/evidence.json",
      "dist/apps/viewer/index.html",
      "node_modules/pkg/index.js",
      "public/packs/demo/manifest.json",
      "tests/fixtures/local-renderer.js",
    ]);
  });

  it("detects a stale product title even when the current title is also present", () => {
    expect(hasStaleProductTitle("Sniptale Motion SDK")).toBe(false);
    expect(
      hasStaleProductTitle("Sniptale Motion SDK\nLegacy title: Effect SDK"),
    ).toBe(true);
  });

  it("rejects debt-normalizing policy files and keys", () => {
    expect(
      inspectDebtPolicySource(
        "tooling/configs/qa/architecture.json",
        '{"exceptions":[]}',
      ),
    ).toEqual([
      "tooling/configs/qa/architecture.json: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/qa/generated-policy.json",
        '{"waivers":[]}',
      ),
    ).toEqual([
      "tooling/qa/generated-policy.json: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource("docs/current-debt-baseline.json", "{}"),
    ).toEqual([
      "docs/current-debt-baseline.json: debt-normalizing policy files are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "schemas/sniptale-effect-v1.schema.json",
        '{"baseline":{"type":"string"}}',
      ),
    ).toEqual([]);
    expect(
      inspectDebtPolicySource(
        "tooling/configs/qa/architecture.yaml",
        "exceptions:\n  - current-debt\n",
      ),
    ).toEqual([
      "tooling/configs/qa/architecture.yaml: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/qa/rules.ts",
        "export const rules = { suppressions: [] };",
      ),
    ).toEqual([
      "tooling/qa/rules.ts: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/architecture/rules.json",
        '{"waivers":[]}',
      ),
    ).toEqual([
      "tooling/architecture/rules.json: debt-normalizing policy keys are not allowed",
    ]);
    for (const source of [
      "known_failures: []",
      "known-failures: []",
      "ignored_violations: []",
      "exception: []",
      "waiver: []",
    ]) {
      expect(
        inspectDebtPolicySource("tooling/configs/qa/architecture.yaml", source),
      ).toEqual([
        "tooling/configs/qa/architecture.yaml: debt-normalizing policy keys are not allowed",
      ]);
    }
    expect(
      inspectDebtPolicySource(
        "tooling/qa/rules.ts",
        'export const rules = { ["exceptions"]: [] };',
      ),
    ).toEqual([
      "tooling/qa/rules.ts: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/architecture/checks.ts",
        "export const checks = { exceptions: [] };",
      ),
    ).toEqual([
      "tooling/architecture/checks.ts: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/qa/rules.ts",
        'policy["exceptions"] = [];',
      ),
    ).toEqual([
      "tooling/qa/rules.ts: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/qa/rules.ts",
        'Object.fromEntries([["exceptions", []]]);',
      ),
    ).toEqual([
      "tooling/qa/rules.ts: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/qa/rules.ts",
        'export const ordinary = { ["ordinary"]: true };',
      ),
    ).toEqual([]);
    for (const source of [
      "policy[`exceptions`] = [];",
      'policy["excep\\u0074ions"] = [];',
      'const key = "excep" + "tions"; policy[key] = [];',
      "interface Policy { exceptions?: string }",
      'new Map([["exceptions", []]]);',
      'const key = "exceptions"; new Map([[key, []]]);',
      'Object.defineProperty(policy, "exceptions", { value: [] });',
      'Reflect.set(policy, "exceptions", []);',
    ]) {
      expect(inspectDebtPolicySource("tooling/qa/rules.ts", source)).toEqual([
        "tooling/qa/rules.ts: debt-normalizing policy keys are not allowed",
      ]);
    }
    expect(
      inspectDebtPolicySource(
        "tooling/configs/qa/architecture.json",
        '{"excep\\u0074ions":[]}',
      ),
    ).toEqual([
      "tooling/configs/qa/architecture.json: debt-normalizing policy keys are not allowed",
    ]);
    expect(
      inspectDebtPolicySource(
        "tooling/qa/rules.ts",
        'export const message = "exceptions";',
      ),
    ).toEqual([]);
    expect(
      inspectDebtPolicySource(
        "src/sdk/exception-handler.ts",
        "export function handleException() {}",
      ),
    ).toEqual([]);
    expect(
      inspectDebtPolicySource(
        "tooling/effect-v1/new.ts",
        'const textCommand = { baseline: "middle" };',
      ),
    ).toEqual([]);
  });
});
