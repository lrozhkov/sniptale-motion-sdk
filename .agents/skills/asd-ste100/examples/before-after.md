# Before and After Examples

Negative examples below are intentional test text. They are not recommended instructions. Each pair illustrates one structural or semantic decision. These examples do not reproduce the official dictionary.

## Separate instructions

Before:

```text
Check the model; then open the preview and inspect the final frame.
```

After:

```text
Check the model. Open the preview. Inspect the final frame.
```

The rewrite removes the semicolon and gives each instruction a separate sentence.

## Preserve uncertainty

Before:

```text
An error may have occurred while processing your request due to a possible mismatch in the expected data format, which could be caused by an outdated client version.
```

After:

```text
Your request may have failed. The cause may be a data format that does not match what the server expects. An outdated client can cause this mismatch. Check your client version.
```

Both versions retain uncertainty. The rewrite does not assert that the request failed or that client age caused the mismatch.

## State conditional behavior

Before:

```text
This tool will attempt to synchronize state across the various backends that have been configured, and if a conflict is detected it may resolve it automatically depending on the strategy that has been set, or otherwise it will surface the conflict for manual review.
```

After:

```text
The tool tries to synchronize state across the configured backends. If it finds a conflict, it reads the configured strategy. If the strategy allows automatic resolution, the tool may resolve the conflict without a user. If the tool does not resolve the conflict, it reports the conflict for manual review.
```

The rewrite exposes the condition and actor. It does not promise successful synchronization or automatic resolution for every conflict.

## Prefer direct verbs

Before:

```text
Perform an inspection of the filter.
```

After:

```text
Inspect the filter.
```

The direct verb states the action without a nominalized phrase.

## Distinguish technical actions

A schema parser can perform document validation while a user gives confirmation for an update. Those actions have different authority and results. Do not rename one merely to satisfy a synonym heuristic. Record a proven false positive through the exact repository tool-noise process.
