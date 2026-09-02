# PDR — ENV Lens

Repo: `X:\vscode-extensions\vscode-env-lens`
Remote: private (`gvastethecreator/vscode-env-lens`)

## Status
Release candidate complete · Priority P0

## Product summary

ENV Lens is a modern `.env` companion for VS Code. It keeps the low-friction syntax-highlighting experience users expect while adding lightweight diagnostics and synchronization workflows that reduce configuration mistakes across `.env`, `.env.example` and environment-specific variants.

## Opportunity

The established `vscode-dotenv` category demonstrated strong historical demand but much of the original experience is essentially syntax highlighting. The product opportunity is not to make a prettier grammar; it is to turn environment-file maintenance into a small, dependable workflow without becoming a secret manager.

Reference implementation/category research:
- https://github.com/mikestead/vscode-dotenv
- VS Code language extension concepts: https://code.visualstudio.com/api/language-extensions/overview

## Target users

- web/backend developers using `.env*` files;
- monorepo maintainers;
- teams keeping `.env.example` in version control;
- developers frequently switching local/staging/test environments.

## Jobs to be done

1. Read `.env` files clearly.
2. Detect simple configuration mistakes before runtime.
3. See when example files and active env files drift.
4. Navigate repeated/referenced keys quickly.
5. Add missing keys to an example file safely.

## MVP

### Syntax support

Recognize common dotenv constructs:

```dotenv
KEY=value
KEY="quoted value"
KEY='quoted value'
EMPTY=
# comment
URL=${BASE_URL}/api
export OPTIONAL_STYLE=value
```

Support filename patterns such as:

- `.env`
- `.env.local`
- `.env.example`
- `.env.development`
- `.env.production`
- `.env.test`
- `.env.*.local`

Do not claim parser compatibility with every dotenv implementation; document grammar decisions.

### Diagnostics

MVP diagnostics:

- duplicate key in same file;
- malformed assignment;
- invalid/empty key name;
- unresolved `${KEY}` reference within configured scope;
- key present in primary env but missing from `.env.example`;
- optional inverse drift diagnostic: key in example but missing from selected env.

Never expose values in diagnostic messages.

### Commands

- `ENV Lens: Validate Current File`
- `ENV Lens: Compare with Example`
- `ENV Lens: Add Missing Keys to Example`

### Code Actions

Where diagnostics support a deterministic fix:

- add missing key name to example file with empty placeholder;
- remove/rename duplicate only when user selects an explicit action;
- create missing example file only through explicit command.

### Completion/navigation

- completion for `${KEY}` references sourced from related dotenv files;
- `Go to Definition` for variable references where unambiguous;
- Document Symbols for keys if implementation is cheap and stable.

## Configuration

Settings:

```json
{
  "envLens.exampleFile": ".env.example",
  "envLens.validation.enabled": true,
  "envLens.validation.unresolvedReferences": true,
  "envLens.validation.exampleDrift": true,
  "envLens.files.include": ["**/.env", "**/.env.*"],
  "envLens.files.exclude": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**"
  ]
}
```

Keep settings minimal. Multi-root workspaces must resolve configuration per WorkspaceFolder where possible.

## Explicit non-goals

- displaying or syncing secrets with cloud providers;
- decrypting secret stores;
- executing shell expansion;
- evaluating commands such as `$(...)`;
- loading `.env` values into VS Code's own process environment;
- replacing framework-specific environment validation libraries;
- automatic mutation of `.env` files on save.

## Architecture

Implemented modules:

```text
src/
├─ extension.ts
├─ core/
│  ├─ parser.ts
│  ├─ model.ts
│  ├─ compare.ts
│  ├─ edits.ts
│  ├─ filenames.ts
│  └─ messages.ts
├─ language/
│  ├─ diagnostics.ts
│  ├─ completion.ts
│  ├─ definition.ts
│  ├─ symbols.ts
│  ├─ codeActions.ts
│  └─ familyIndex.ts
├─ commands/handlers.ts
├─ logging/secretSafeLogger.ts
└─ workspace/
   ├─ family.ts
   ├─ documentCache.ts
   ├─ configuration.ts
   └─ uri.ts
```

Parser should be pure and independent from VS Code APIs.

## VS Code APIs

Stable API surface:

- `languages.createDiagnosticCollection`
- `languages.registerCompletionItemProvider`
- `languages.registerDefinitionProvider`
- `languages.registerDocumentSymbolProvider`
- `languages.registerCodeActionsProvider`
- `workspace.findFiles`
- `workspace.fs`
- `WorkspaceEdit`
- commands and configuration APIs.

Avoid LSP in v1; it adds operational complexity without enough product value.

## Security/privacy

This extension touches secrets. Therefore:

- never send file contents anywhere;
- never log values;
- avoid hover UI that reveals secret values from other files;
- diagnostic messages should contain key names only;
- no telemetry containing key names;
- workspace edits must preserve values and line endings unless command explicitly targets them.

## Compatibility

| Environment | Goal |
| --- | --- |
| Desktop | Full |
| Web/vscode.dev | Full or near-full if parser/bundle is browser-safe |
| Virtual Workspace | Full using `workspace.fs` |
| Restricted Mode | Full read/diagnostic support; writes may remain explicit user actions |
| Remote/Codespaces | Full |

Use URI-based filesystem handling so remote and virtual schemes do not become second-class.

## Performance

- only parse candidate dotenv documents;
- debounce text-change diagnostics;
- avoid global workspace rescans after every edit;
- maintain per-document parse cache keyed by version;
- bound workspace discovery to configured globs;
- do not parse `node_modules` or generated directories by default.

## Test plan

Unit fixture categories:

- quoting and escapes;
- comments;
- CRLF/LF;
- duplicate keys;
- interpolation;
- malformed lines;
- empty values;
- unicode values;
- BOM;
- `export KEY=value`;
- multiple env variants;
- example drift;

Integration:

- diagnostics update after edit;
- Code Action updates correct URI;
- multi-root workspace isolation;
- non-file URI compatibility;
- Restricted Mode behavior;
- web host and writable virtual filesystem.

## Acceptance criteria for v1

- no secret value leaves the extension process;
- no workspace scan at activation;
- diagnostics are deterministic and produce no duplicate Problems entries;
- example synchronization never overwrites an existing value;
- CRLF/LF preserved during targeted edits;
- works with multi-root workspaces;
- package installs cleanly in current stable VS Code;
- documentation explains parser limitations.

## Post-MVP

- configurable env-family grouping for monorepos;
- key usage/reference search across dotenv files;
- richer hover showing only safe metadata (file origin, not value);
- schema/policy file for required keys;
- optional masking decorations for current-line secret values, only if UX testing proves useful.

## Naming/Marketplace keywords

Working name: **ENV Lens**.

Potential keywords: dotenv, env, environment variables, .env, config, validation, secrets, environment.

Before publication, verify naming collisions in Marketplace and Open VSX.

## Definition of done

Implementation, tests, security review, Marketplace assets, README, CHANGELOG, LICENSE, privacy section, CI, VSIX smoke test and Open VSX compatibility review are all complete.
