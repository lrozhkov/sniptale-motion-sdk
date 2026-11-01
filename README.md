# Sniptale Motion SDK

Create, validate, preview, and export reusable motion effects. The main output is a declarative `sniptale.effect.v1` document and its assets. A compatible Sniptale editor can import the exported `*.sniptale-effect.json` file. MP4 export produces a separate review render.

The SDK is an alpha. Contracts and editing behavior can change without migration. Keep source media and exported effects backed up. Check compatibility with the target editor build.

## Run from source

Use Node.js `>=22.12.0` and npm. The checked toolchain uses Node.js `24.21.0` and npm `12.2.0`. Repository QA also requires Python 3 for the bundled writing checker. Browser-backed checks require controlled Chromium.

```bash
npm ci --ignore-scripts
npm run effect:schema:check
npm run dev
```

Open `http://127.0.0.1:4177/`. The sandbox uses a separate origin at `http://127.0.0.1:4178/`. `npm run build` writes applications under `dist/apps` and SDK declarations under `dist/sdk`.

The [local npm toolkit](docs/tooling/npm-toolkit.md) provides project commands and portable agent instructions. The package is not published. `npm run ci:release` builds and checks a local candidate without publication.

## Create an effect

Use the repository [create-effect skill](.agents/skills/create-effect/SKILL.md) with your coding agent. State the effect kind, duration, composition, motion, controls, and acceptance criteria.

| Kind | Host inputs | Use |
| --- | --- | --- |
| `standalone` | none | Titles, overlays, procedural compositions |
| `targetEffect` | `source` | An effect over one media item |
| `transition` | `from`, `to` | A transition between two media items |

Create local work under ignored `.tmp/effects/<effect-id>/`. Do not register local effects in product source or commit their media. Preview inputs are temporary host state. They do not become effect history or exported data.

```bash
npm run effect:new -- --id example --kind standalone --output .tmp/effects/example/example.sniptale-effect.json
npm run effect:validate -- .tmp/effects/example/example.sniptale-effect.json --asset-root .tmp/effects/example --json
npm run effect:prove -- .tmp/effects/example/example.sniptale-effect.json --asset-root .tmp/effects/example
```

Validation requires zero errors and zero warnings. Browser proof requires `ok: true`. Review the composition and timing yourself after these checks. Import the JSON and referenced files into the viewer. Export the portable effect after review.

Effect v1 supports bounded graph rendering, layers, timeline tracks, controls, local assets, and media inputs. It rejects authored executable code, external asset URLs, nondeterministic state, and unbounded execution. Read the [authoring contract](docs/authoring/create-effect/references/effect-v1-contract.md) and [graph runtime](docs/authoring/create-effect/references/graph-runtime.md) for supported operations.

Live HTML scenes use a separate [DOM motion contract](docs/architecture/dom-motion.md). They are not Effect v1 documents.

## Check changes

```bash
npm run qa:checkpoint
npm run ci:proof
npm run ci:release
```

Checkpoint checks the complete candidate. `ci:proof` runs repository checks, coverage, builds, browser smoke, workflow lint, duplication, dependency audits, and CodeQL. `ci:release` also builds the npm archive and checks installation. Both commands run locally without GitHub Actions. Neither command commits or publishes.

Use `npm run qa:closeout -- -m "message"` for local closeout. [AGENTS.md](AGENTS.md) defines commit and push authorization. Read [code quality](docs/tooling/code-quality.md) for prerequisites, proof reuse, and platform limits.

## Project contracts

The [documentation index](docs/README.md) links architecture, security, authoring, quality, and release contracts. Code, schemas, tests, and deterministic checks own implementation behavior. [AGENTS.md](AGENTS.md) defines repository work and review rules.

The project uses the MIT license. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [provenance](docs/oss/provenance.md). External code contributions and pull requests are closed under [CONTRIBUTING.md](CONTRIBUTING.md). [SECURITY.md](SECURITY.md) defines security reporting and support.
