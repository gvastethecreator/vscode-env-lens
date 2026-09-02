<div align="center">
  <a href="https://github.com/gvastethecreator/vscode-env-lens"><img src="media/icon.png" alt="ENV Lens" width="128" /></a>

# ENV Lens

**Catch dotenv mistakes before they break your app**

<p align="center">
  <a href="https://github.com/gvastethecreator/vscode-env-lens"><img alt="GitHub" src="https://shieldcn.dev/badge/github.png?variant=outline&size=xs&theme=blue&logo=github" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://shieldcn.dev/github/license/gvastethecreator/vscode-env-lens.png?variant=outline&size=xs" /></a>
  <a href="https://github.com/gvastethecreator/vscode-env-lens/actions/workflows/ci.yml"><img alt="CI status" src="https://shieldcn.dev/github/ci/gvastethecreator/vscode-env-lens.png?workflow=ci.yml&branch=main&variant=outline&size=xs" /></a>
</p>
</div>

ENV Lens validates `.env*` files as you edit. It also compares related environment and example files without showing or copying secret values.

<img src="media/preview.png" alt="ENV Lens diagnostics in a running VS Code editor" width="100%" />

## Features

- Dotenv syntax highlighting for `.env` and `.env.*` files.
- Precise diagnostics for invalid keys, malformed assignments, unfinished quotes, duplicate keys, and unresolved `${KEY}` references.
- Key-name drift checks between an environment file and its nearest example file.
- Safe Code Actions that add missing key names with empty values.
- `${KEY}` completion, Go to Definition, and Document Symbols.
- Desktop, web, remote, virtual-workspace, multi-root, and Restricted Mode support.

ENV Lens does not scan the workspace at startup. Family discovery starts only when an open dotenv file needs it, stays inside its workspace folder, and stops after 64 candidates.

## Commands

| Command | Result |
| --- | --- |
| `ENV Lens: Validate Current File` | Refresh diagnostics and show a problem count. |
| `ENV Lens: Compare with Example` | Compare key names with the selected example or environment file. |
| `ENV Lens: Add Missing Keys to Example` | Add missing key names with empty values. It never copies values. |

If more than one related file is valid, ENV Lens asks you to choose. It does not guess before a write.

## Supported dotenv syntax

```dotenv
KEY=value
KEY = value with spaces
EMPTY=
QUOTED="value with ${KEY}"
SINGLE='literal ${KEY}'
export OPTIONAL_STYLE=value
# comment
VALUE=value # inline comment
```

The initial dialect is intentionally conservative:

- keys use `[A-Za-z_][A-Za-z0-9_]*`;
- inline comments start with `#` only after whitespace, so `KEY=#literal` stays a value;
- single quotes are literal; `${KEY}` references are read in unquoted and double-quoted values;
- escapes remain source text and are not decoded;
- forward references work, while direct self references are reported;
- multiline quoted values, command substitution, shell evaluation, and parameter operators such as `${KEY:-fallback}` are not interpreted;
- UTF-8, BOM, LF, CRLF, and mixed input are parsed without normalizing the source.

Reference diagnostics use the current file. Completion and definition lookup also use same-directory env-family files, with a same-file definition preferred when it is unique.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `envLens.exampleFile` | `.env.example` | Example basename used for each env family. |
| `envLens.validation.enabled` | `true` | Validate open dotenv files. |
| `envLens.validation.unresolvedReferences` | `true` | Report unresolved and direct self references. |
| `envLens.validation.exampleDrift` | `true` | Report key-name differences across the selected pair. |
| `envLens.files.include` | `**/.env`, `**/.env.*` | Limit family discovery to these globs. |
| `envLens.files.exclude` | dependency, Git, and build folders | Keep discovery out of generated or unrelated trees. |

Settings resolve per resource, so folders in a multi-root workspace remain isolated.

## Safety and privacy

ENV Lens has no telemetry and makes no network requests. It never loads values into `process.env`, runs shell code, or sends file contents outside VS Code.

Diagnostics, notifications, completions, definitions, and logs contain key names, paths, and counts only. Key names can still be sensitive metadata. The add-missing workflow uses one undoable `WorkspaceEdit`, preserves existing text and line endings, checks for stale content, and inserts only `KEY=` placeholders. Files larger than 2 MiB are skipped with a clear diagnostic.

## Compatibility

ENV Lens requires VS Code 1.134 or newer. Both Node and browser extension-host bundles are included. Filesystem access uses `Uri` and `workspace.fs`, including virtual and remote providers. Writes stay explicit and fail cleanly when a provider is read-only.

Another dotenv extension may also claim `.env` files. If highlighting overlaps, use **Change Language Mode** to select `dotenv`, or disable the overlapping grammar for the workspace.

## Development

```text
pnpm install
pnpm run quality
pnpm run test:integration
pnpm run test:web
pnpm run vsix
pnpm run inspect:vsix
```

See [docs/development.md](docs/development.md) for the full local and CI matrix.

---

<p align="center">
  <a href="https://github.com/gvastethecreator/vscode-env-lens/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/gvastethecreator/vscode-env-lens.png?variant=outline&size=xs" /></a>
  <a href="https://github.com/gvastethecreator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/follow%20me-/gvastethecreator.png?size=xs&amp;logo=github&amp;brand=github&amp;mode=dark"><img alt="Follow gvastethecreator" src="https://shieldcn.dev/badge/follow%20me-/gvastethecreator.png?size=xs&amp;logo=github&amp;brand=github&amp;mode=light"></picture></a>
  <a href="https://github.com/sponsors/gvastethecreator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/support%20this-project.png?size=xs&amp;logo=ri%3APiHeartFill&amp;logoColor=b85a90&amp;brand=github&amp;mode=dark"><img alt="Support this project" src="https://shieldcn.dev/badge/support%20this-project.png?size=xs&amp;logo=ri%3APiHeartFill&amp;logoColor=b85a90&amp;brand=github&amp;mode=light"></picture></a>
</p>
