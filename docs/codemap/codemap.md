# Code map · vscode-env-lens

generated: 2026-09-05T04:45:27Z
commit: fd804a44a4be
scope: .

counts: 10 nodes · 24 edges · 0 flows · 0 unknown

## Modules

- `esbuild` · `esbuild.cjs` · interface · Esbuild
  callers: repository (calls)
  callees: external-dependencies (imports)
  tests: (none)
  entry: esbuild.cjs:main

- `external-dependencies` · `esbuild.cjs` · external · External
  callers: esbuild (imports), scripts (imports), src (imports), src-commands (imports), src-language (imports), src-logging (imports), src-workspace (imports)
  callees: (none)
  tests: (none)
  entry: esbuild.cjs:esbuild

- `repository` · `package.json` · module · Repository
  callers: (none)
  callees: esbuild (calls), scripts (calls)
  tests: (none)
  entry: package.json:{

- `scripts` · `scripts` · service · Scripts
  callers: repository (calls)
  callees: external-dependencies (imports), src-core (imports)
  tests: (none)
  entry: scripts/build-web-tests.mjs:root

- `src` · `src` · module · Src
  callers: src-commands (imports), src-language (imports)
  callees: external-dependencies (imports), src-commands (imports), src-language (imports), src-logging (imports), src-workspace (imports)
  tests: (none)
  entry: src/commands.ts:COMMANDS

- `src-commands` · `src/commands` · module · Src
  callers: src (imports)
  callees: external-dependencies (imports), src (imports), src-core (imports), src-language (imports), src-logging (imports), src-workspace (imports)
  tests: (none)
  entry: src/commands/handlers.ts:plural

- `src-core` · `src/core` · service · Src
  callers: scripts (imports), src-commands (imports), src-language (imports), src-workspace (imports)
  callees: (none)
  tests: src/core/compare.test.ts, src/core/edits.test.ts, src/core/filenames.test.ts, src/core/messages.test.ts, src/core/parser.test.ts
  entry: src/core/compare.ts:uniqueEntries

- `src-language` · `src/language` · module · Src
  callers: src (imports), src-commands (imports)
  callees: external-dependencies (imports), src (imports), src-core (imports), src-logging (imports), src-workspace (imports)
  tests: (none)
  entry: src/language/codeActions.ts:EnvCodeActionProvider

- `src-logging` · `src/logging` · module · Src
  callers: src (imports), src-commands (imports), src-language (imports)
  callees: external-dependencies (imports)
  tests: (none)
  entry: src/logging/secretSafeLogger.ts:formatFields

- `src-workspace` · `src/workspace` · module · Src
  callers: src (imports), src-commands (imports), src-language (imports)
  callees: external-dependencies (imports), src-core (imports)
  tests: (none)
  entry: src/workspace/configuration.ts:boundedStringArray

## Edges

- esbuild -> external-dependencies · imports
- repository -> esbuild · calls
- repository -> scripts · calls
- scripts -> external-dependencies · imports
- scripts -> src-core · imports
- src -> external-dependencies · imports
- src -> src-commands · imports
- src -> src-language · imports
- src -> src-logging · imports
- src -> src-workspace · imports
- src-commands -> external-dependencies · imports
- src-commands -> src · imports
- src-commands -> src-core · imports
- src-commands -> src-language · imports
- src-commands -> src-logging · imports
- src-commands -> src-workspace · imports
- src-language -> external-dependencies · imports
- src-language -> src · imports
- src-language -> src-core · imports
- src-language -> src-logging · imports
- src-language -> src-workspace · imports
- src-logging -> external-dependencies · imports
- src-workspace -> external-dependencies · imports
- src-workspace -> src-core · imports

## Unknown

- none

## Flows

- none
