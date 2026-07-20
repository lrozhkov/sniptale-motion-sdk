# Security Model

The security boundary treats effect documents, imported files, asset contents, browser messages, and generated render data as untrusted inputs. The viewer is a privileged local editor. The sandbox is a constrained renderer, not a security boundary for arbitrary authored JavaScript because authored JavaScript is not accepted.

## Enforced controls

- Effect JSON to SDK model: strict Effect v1 validation rejects unknown schema shapes, unsafe references, executable formats, and invalid graph bounds. Proof: `src/sdk/effect-v1/` and `npm run effect:validate`.
- Viewer to sandbox: message-boundary owners parse known message kinds and required fields before dispatch, and validate effect documents before registration. Proof: focused transport tests.
- Sandbox runtime source: QA policy rejects direct use of `fetch`, XHR, WebSocket, EventSource, WebTransport, beacon, WebRTC connection, worker `importScripts`, browser storage, extension namespaces, `eval`, and `new Function`. Proof: `tooling/qa/policy/guardrails.mjs` through `npm run qa:checkpoint`. This source scanner covers the enumerated APIs; exposed browser capabilities still require security review.

Asset paths must be relative, must not contain a parent segment or scheme, and must resolve inside the selected local asset root. SVG validation rejects executable or externally loaded content. Imported path-backed assets are materialized before editor state adopts them; transient preview media remains session-only.

Viewer, sandbox, static, and smoke servers bind to `127.0.0.1` by default so ignored local packs and assets are not exposed to the local network. A non-loopback bind is a deployment decision and requires review of asset exposure, origin checks, transport fallbacks, and security headers.

The iframe currently declares `sandbox="allow-scripts allow-same-origin"`. The local viewer and sandbox run on separate origins, so `allow-same-origin` preserves the sandbox's own origin without giving it the viewer origin. A deployment must preserve origin separation; serving both applications from one origin with these flags weakens the isolation assumption.

## Transport trade-offs

The viewer sends to the origin derived from the iframe URL. The sandbox derives the expected parent origin from an HTTP(S) referrer and checks both `event.source` and `event.origin`. When the referrer is absent or not HTTP(S), the sandbox accepts the parent window by source only and replies with `targetOrigin="*"`.

The viewer's inbound window listener currently checks `event.source` but does not check `event.origin`; the payload parser and pending request registry limit accepted behavior. The direct render channel is transferred through the iframe and then relies on possession of the `MessagePort`.

The referrer fallback and source-only viewer check avoid rejecting a parent solely because a usable referrer is absent, but they are not sufficient for an arbitrary embedding environment. Public deployment requires an explicit parent/viewer origin contract or a documented host-level control that provides equivalent isolation.

## Residual risks

- Static HTML does not define a Content Security Policy. The deployment owner must supply CSP and related security headers and verify that viewer, worker, and sandbox requirements remain bounded.
- The viewer uses local storage for drafts and preferences. It is not a secret store; a hostile script running in the viewer origin could read editor state and selected content.
- Resource exhaustion remains possible within accepted graph, asset, canvas, and video limits. Validation and runtime budgets reduce this risk but do not prove availability for every device.
- SVG, media decoding, Canvas, WebCodecs, workers, and browser file APIs inherit browser implementation risk.
- A compromised viewer can command the sandbox and observe its results. The model isolates authored data from code execution; it does not isolate the sandbox from its owning viewer.

Security-boundary changes follow the required loop in [AGENTS.md](../../AGENTS.md). Manual review remains required for deployment origin topology, CSP, exposed browser APIs, resource budgets, and changes to iframe permissions.
