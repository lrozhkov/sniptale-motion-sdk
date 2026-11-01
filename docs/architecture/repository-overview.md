# Repository Architecture

The repository has five runtime and contract seams.

- `src/apps/cli/` owns installed Node commands, project creation, and bundle file access.
- `src/apps/viewer/` owns editor state, browser UI, imports, exports, playback, and the host side of sandbox transport.
- `src/apps/sandbox/` owns isolated document execution, frame rendering, the render worker, and the sandbox side of transport.
- `src/sdk/` owns public TypeScript contracts, the protocol, Effect v1 schema and validation, graph contracts, and reusable motion primitives.
- `src/shared/` owns cross-application code with an explicit shared contract, including i18n and timeline utilities.

Product development, build, effect, release, QA, and test-support commands live under their owner directories in `tooling/`. `tooling/effect-v1/corpus/` owns the deterministic cross-repository bundle corpus and writes only to ignored `.tmp/sniptale-effect-corpus`. The repository has no top-level `scripts/` seam. Tests own executable behavior and acceptance evidence. Documentation does not restate those cases.

## Repository root

The root contains repository policy, metadata, legal files, package manifests, and the shared TypeScript configuration. Owner directories are `.agents/`, `.codex/`, `docs/`, `schemas/`, `src/`, `tests/`, and `tooling/`. `.codex/` owns local agent configuration, including the sandbox-provided directory. It is not an artifact storage root. Application HTML belongs to `src/apps/viewer/` and `src/apps/sandbox/`. Build, test, and application configuration belongs to `tooling/configs/`.

`.tmp/` owns ignored local inputs and disposable outputs, including templates, packs, media, review evidence, reports, coverage, browser output, and tool caches. `dist/` is the ignored build and release-candidate boundary. `node_modules/` is the ignored dependency installation boundary. No other root storage or output directory is permitted. Empty directories under `docs/` are forbidden.

## Runtime topology

The viewer loads the sandbox in an iframe and communicates through parsed `postMessage` payloads. The local topology uses separate viewer and sandbox origins. Render work may move to a worker and a transferred `MessagePort`, but the iframe session remains the owner of connection setup, readiness, timeout, and recovery.

Effect v1 is a strict JSON document with `schemaVersion: "sniptale.effect.v1"` and `program.kind: "graph"`. The receiving sandbox validates a document before registration. Runtime execution interprets the bounded graph. It does not compile authored JavaScript.

The viewer owns mutable editing state. The sandbox owns loaded render models and frame execution. Request ids correlate asynchronous operations, sequence ids identify requested frames, and render results without a pending request are counted as stale.

Security assumptions and transport trade-offs are owned by [the security model](../security/security-model.md).

## Build boundary

`npm run build` creates TypeScript declarations under `dist/sdk` and static viewer and sandbox applications under `dist/apps`. `npm run build:local` is a QA build that may read `.tmp/local/public/` and is not a release candidate. Deterministic output checks are owned by [code quality](../tooling/code-quality.md).

License closure and local release-readiness checks are owned by [the release document](../oss/release.md). Locale ownership is defined in [the i18n architecture](i18n-architecture.md).
