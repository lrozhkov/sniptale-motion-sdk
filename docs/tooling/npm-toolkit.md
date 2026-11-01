# Sniptale Motion Toolkit

The local toolkit creates, validates, previews, proves, and exports declarative Effect v1 documents. It includes Studio, project revisions, a portable authoring skill, and an explicit update check. Publication requires a separate decision. `npm run ci:release` checks a local archive. See [code quality](https://github.com/lrozhkov/sniptale-motion-sdk/blob/main/docs/tooling/code-quality.md) for platform limits.

## Install and create

Use Node.js `>=22.12.0` and npm. Install the supplied archive:

```bash
npm install --global /absolute/path/sniptale-motion-0.1.0.tgz
sniptale-motion --help --locale en
sniptale-motion doctor
sniptale-motion init my-motion
cd my-motion
sniptale-motion new my-effect
sniptale-motion validate effects/my-effect/effect.sniptale-effect.json
```

Installed use requires no repository or development tools. Package installation does not download a browser or run package lifecycle scripts. The archive includes playwright-core.

Use `new my-effect --kind targetEffect` for an effect over one source. Use `--kind transition` for a transition. Assets resolve relative to the JSON directory. `validate <file> --asset-root <directory>` selects another root. Paths outside that root are invalid.

`init` and `new` do not replace existing projects or effects. A failed write can leave a partial directory. Inspect it before retrying with a new destination or ID. User sources are not removed automatically. Projects contain `effects/`, `exports/`, and `.tmp/`.

## Command results

`--json` writes one JSON result to stdout without progress. Exit codes are zero for success, one for an operation or validation failure, and two for invalid arguments. Studio interruption returns 130 for SIGINT or 143 for SIGTERM. Russian is the default help locale. `--locale en` selects English.

`sniptale-motion docs` opens these instructions. `--version` reports the installed version. Diagnostics provide a code, structural location, and guidance without copying document or asset values. Unknown field names become `<field>`. Repository `effect:validate` and `effect:prove` use the same product CLI.

## Browser setup and proof

`doctor` probes installed Chrome, Edge, and then managed Chromium. It reports the selected channel and actual browser version. `doctor --browser-channel chrome|msedge|chromium` selects one channel. Creation, static validation, and export work without a browser. Static validation does not prove rendering.

Install separate Chromium only through this explicit network operation:

```bash
sniptale-motion browser install
```

The command uses the Playwright installer and does not replace Chrome or Edge. Linux may need administrator-installed [system libraries](https://playwright.dev/docs/browsers#install-system-dependencies). Ctrl+C stops installation and its child processes. A failed installation can be retried.

Run browser proof:

```bash
sniptale-motion prove effects/my-effect/effect.sniptale-effect.json
```

`--asset-root` selects an asset root. `--browser-channel chrome|msedge|chromium` selects one channel without fallback. Proof opens an isolated headless session and imports through the normal viewer UI. It checks completed timeline frames, repeatability, visibility, controls, runtime binding reads, and rapid-seek/sandbox-restart recovery.

Target effects and transitions also use distinct transient media. Proof checks that exported data excludes those media. Page requests outside the two local origins are blocked. Source files remain unchanged. Proof removes its temporary project under `.tmp/` when it finishes.

Results record the toolkit version, actual browser version and channel, materialized-input SHA-256, and individual checks. Invisible, frozen, or unresponsive output fails. A control without a valid alternate reports `NO_ALTERNATE`. Proof does not replace artistic review or promise identical output across browser versions.

## Studio and revisions

Run `sniptale-motion studio` inside a project, or supply its directory. Studio opens the installed browser and keeps two loopback servers running. Ctrl+C stops both. `--no-open` prints the URL without opening a browser. `studio --no-open --json` writes one session result and waits for interruption. Session URLs remain valid only while Studio runs.

Installation, diagnosis, and Studio do not download a browser. Each session selects two free loopback ports. The project directory is not exposed as a static web root. Studio reads `effects/<id>/effect.sniptale-effect.json` and assets inside that effect directory. The document ID must match the effect directory name.

Invalid effects produce diagnostics instead of catalog entries. Catalog access requires the token from the current session URL. Studio checks file changes every second.

Use the “Save project revision” menu to preserve editable changes. It exclusively creates `effects/<id>/revisions/<uuid>/` with self-contained Effect v1 JSON and embedded assets. It does not replace the source. “Project revisions” selects a revision or the original document. Loading a changed selection requires confirmation in the update bar.

Selection is stored in `effects/<id>/current-revision.json`. Selecting a saved revision retains the original file. Selecting “Original document” returns the source to the catalog. An external source write does not replace an active revision. Incomplete or damaged revisions are not adopted.

A failed save can leave an incomplete revision directory for inspection. If a save response is lost, inspect the revision list before retrying.

Valid source or asset changes load automatically when the editor is idle and has no local edits. Invalid, partial, or removed files preserve the last working state. New effects appear without changing the current selection. With local edits, an accepted update first saves those edits as a separate revision. Source/revision selection changes also require confirmation. Playback, export, and drag operations delay updates until they finish.

## Portable export

```bash
sniptale-motion export effects/my-effect/effect.sniptale-effect.json --output exports/my-effect.sniptale-effect.json
```

A revision document can replace the source argument. Export validates the document and assets, embeds assets, and exclusively creates a new file. Its parent directory must exist. Existing destinations and source files remain unchanged.

After interruption, inspect the destination before retrying. A complete file may exist even when the command result was lost. The JSON result includes byte length and SHA-256. Export reports runtime proof as `not-run`. Run `prove` separately for browser behavior.

## Agent instructions

Run `sniptale-motion skills --json` for checked skill, schema, guide, and physical CLI paths. The command checks runtime and instruction bytes against build fingerprints. It rejects damaged or mixed kits. `skill.path` identifies the skill. Its `references/toolkit.json` requires the exact toolkit version and both digests.

Read the skill and call the supplied CLI directly when installation integration is unnecessary. No repository access is needed.

Optional agent integration uses the existing installer:

```bash
npx --yes skills@<installer.version> add "<skill.path>" --skill create-effect
```

Use values and `installer.env` from the JSON result. That environment disables installer telemetry and remote auditing. Select the intended agent interactively or use `--agent` and `--yes`. Do not select every agent or global scope unless intended. The tested installer needs Node.js `>=22.20`. Toolkit runtime still supports `>=22.12.0`.

The installer is not a runtime dependency and does not run automatically. It does not use experimental npm sync. Obtain the matching skill again after an update. A separately copied skill does not update itself.

## Updates and compatibility

Run `sniptale-motion check-update --json`, or specify an exact version such as `check-update 0.2.0 --json`. Only this explicit command contacts the public registry. It does not run in the background or replace installed files. Default selection uses stable, nondeprecated releases at least seven days old and no higher than npm latest.

A younger security fix needs a separate checked procedure. Before publication, the result can be `not-published`. Network or metadata failures do not count as successful checks.

The check compares format contracts and Node compatibility. It requires exact bundled runtime dependencies and SHA-512 metadata. It does not download or audit the package. A compatible result supplies exact npm global-install and npx arguments with lifecycle scripts disabled.

Close Studio before replacing the runtime. Run the selected npm command and obtain its matching skill again. Keep the previous checked archive for an explicit npm reinstall. Package installation does not rewrite project sources.

`doctor --project . --json` checks the project before a browser probe. `check-update --project .` checks it before network access. Current project v1 / Effect v1 and legacy project v1 without `toolkitCompatibility` are supported. Reading legacy metadata does not add that field or change `createdWith`.

CLI version and compatibility generation are separate fields. Format contracts determine project support. Skills require exact build identity. Unsupported schemas or generations fail before effect creation or Studio startup. A format migration requires a separate explicit operation with backup and recovery. No implicit migration occurs.
