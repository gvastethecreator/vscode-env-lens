# ENV Lens — additional quality and competitive review

Review date: 2026-09-06. Baseline: `157948d069653f222126eaef6e6e0fc7fa0f13e5` on `main`.

## Scope and status

This document records a source-pinned review and proposed acceptance contracts. It does not declare the proposed behavior implemented. Live execution checklists belong in the accompanying GitHub PR, not under `docs/`. The shipped PDR is unchanged; any later behavior change must update both product and portfolio PDRs.

Authenticated reads covered the current ref, AGENTS, `src/commands/handlers.ts`, `src/workspace/configuration.ts` and release publication steps, alongside the earlier manifest/language-provider review. A refreshed repository does not imply every implementation file changed. The handler still writes missing keys only to the example file; the current configuration module also exposes the broad reset behavior described below. No build, Extension Host, web, VSIX or performance run was performed. Local repository download failed on DNS resolution and pnpm was unavailable.

Pinned evidence: [handlers](https://github.com/gvastethecreator/vscode-env-lens/blob/157948d069653f222126eaef6e6e0fc7fa0f13e5/src/commands/handlers.ts), [configuration](https://github.com/gvastethecreator/vscode-env-lens/blob/157948d069653f222126eaef6e6e0fc7fa0f13e5/src/workspace/configuration.ts), [release](https://github.com/gvastethecreator/vscode-env-lens/blob/157948d069653f222126eaef6e6e0fc7fa0f13e5/.github/workflows/release.yml).

## Existing capabilities to preserve

The current comparison already identifies missing keys in both directions. `addMissingKeysToExample` uses family resolution, `planMissingKeyInsertion`, source/target snapshots, writable-filesystem checks and non-overwriting file creation. Preserve these safeguards, comments, existing values and URI-based workspace boundaries. Do not copy secret values, evaluate dotenv contents, modify `process.env` or add a second parser/indexer just to support the inverse operation.

## Complete the local environment from its template

[dotenv Sync & Validator](https://marketplace.visualstudio.com/items?itemName=ActiveClientMods.dotenv-sync-validator), rechecked on the review date, documents filling missing local keys from a template, individually or together. This is a concrete workflow gap, not a reason to introduce account-based secret management.

Propose a dedicated `Add Missing Keys to Environment` command and corresponding safe code actions. When the active document is an environment file, use its resolved example as source and that exact environment URI as destination. When invoked from an example, explicitly resolve/select a sibling environment in the same family. Show relative destination information when basenames are ambiguous. Creation of a new environment file requires an explicit action and a workspace-contained destination; never guess a production target.

Reuse the existing comparison and insertion plan with clearly named source/target roles. Allow all missing keys or an explicitly selected subset. Insert only `KEY=` placeholders, never template values. Existing keys and values remain untouched. Revalidate both snapshots immediately before applying the edit; preserve open unsaved buffers. Cancellation, read-only filesystems, newly appeared targets and changed documents must abort without writes. A second invocation must be idempotent. Refresh only affected family/diagnostic state after success.

Primary touchpoints: command IDs/manifest registration, `src/commands/handlers.ts`, existing comparison/edit planning, code actions and current unit/host tests. No new runtime dependency, webview, scanner or storage service is needed.

## Reset must have an explicit configuration scope

The current `setDefaultSettings` asks about all workspaces, then writes default values at both Global and Workspace levels when a workspace is open. It does not restore inheritance or address resource-folder overrides. This expands the earlier reset finding beyond Quote Switcher and Paste Image Next; it is a UX/data-scope issue, not an assertion of a security exploit.

Proposed contract: choose one available scope, clearly identify it, and remove only that scope's overrides when the action means reset-to-inheritance. Use a resource-scoped configuration instance for a chosen folder. Do not silently clear language-specific overrides or another root. If the intended operation instead pins explicit defaults, name that operation differently. Collect confirmation before any write, serialize edits, and report a partial write failure accurately rather than claiming an atomic reset. Avoid a portfolio-wide settings framework.

## Selected-key navigation from source code

A later, bounded addition can locate a selected environment-key identifier using the existing nearest-family resolution/index. Start with an explicit command, not automatic analysis of every source language. Present file identity and key location, not values; choose when multiple valid definitions remain. Invalid selections and ambiguous family boundaries should not trigger broad workspace searches. Completion across every framework, usage tracking and a language server are outside this proposal.

## Additional release findings

The inspected GitHub Release job downloads the artifact without checkout or explicit `GH_REPO`/`--repo`, then invokes `gh release`. It also omits an exact verified-SHA tag target. The release-existence probe is not a tag-ref check and does not distinguish absence from API failure. SHA256 sidecars are produced, but the shown publication consumers do not explicitly verify them.

The intended release contract is explicit repository identity, immutable source SHA from preparation, checksum verification before each publisher and a fail-closed tag/ref policy. Existing tags must never be moved. Permission/network failures must not be treated as permission to create. Test the contract without registry publication and retain protected environments and artifact-only defaults. References: [CLI repository context](https://cli.github.com/manual/gh_help_environment), [tag target semantics](https://cli.github.com/manual/gh_release_create).

## Regression matrix and quality evidence

| Scenario | Required outcome |
| --- | --- |
| New template key with a nonempty example value | Only its name plus `=` is inserted locally. |
| Existing local secret and comments | Byte content outside the insertion is unchanged. |
| Two roots with matching dotenv basenames | Only the explicitly resolved family can be edited. |
| Unsaved edits, CRLF/LF, duplicate keys, missing final newline | Correct insertion and one logical undo; no full-file rewrite. |
| Source/target changes during confirmation | Operation aborts and asks the user to retry. |
| Missing destination, destination appears concurrently | Explicit creation only; no overwrite. |
| Reset Global, Workspace or WorkspaceFolder | Only the chosen scope changes; cancel changes none. |
| Large active or counterpart document | Both paths obey the documented analysis budget. |
| Secret-bearing fixture and error paths | No values enter logs, UI previews, URLs or persistent metadata. |
| Wrong VSIX checksum or tag SHA, denied GitHub API | Publication aborts before any registry action. |

Use the existing unit, grammar, integration, web and installed-VSIX suites rather than inventing a parallel test stack. Record the tested commit, editor version, fixture and package hash. Measure cold activation, first validation, incremental family invalidation and retained resources separately; dependency declarations or module-load microbenchmarks alone do not establish host performance. No measured performance claim is made here.

## Exclusions

No vault, cloud sync, shell execution, process-wide environment mutation, secret-copy commands, permanent usage index, telemetry or custom UI framework. Keep the extension local, bounded, native-feeling and conservative around writes.
