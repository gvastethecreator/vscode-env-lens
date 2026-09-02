# Security

ENV Lens treats dotenv files as secret-bearing input.

- No telemetry or network requests.
- No shell, command, or process-environment evaluation.
- No raw lines or values in diagnostics, notifications, completion details, logs, command arguments, or persisted caches.
- Cross-file UI exposes key names and file origins only. Key names can still be sensitive metadata.
- Family discovery stays inside the active workspace folder and uses bounded include and exclude globs.
- Writes are explicit, use one `WorkspaceEdit`, add empty placeholders only, and stop on stale or read-only targets.

Report vulnerabilities through a [private GitHub security advisory](https://github.com/gvastethecreator/vscode-env-lens/security/advisories/new). Do not open a public issue with exploit details or real dotenv content.
