# ENV Lens — Complete delivery plan

Status: execution specification  
Repository: `gvastethecreator/vscode-env-lens`  
Product phase: scaffold  
First public target: `0.1.0`  
Planned product milestones: `0.1`, `0.2`, `0.3`, `1.0`  
Last reviewed: 2026-09-01

This document complements `docs/PDR.md`. The PDR owns product intent; this file owns the executable specification, implementation phases, ticket dependencies, verification requirements, and release gates.

---

## 1. Current state

The repository already contains a consistent project shell:

- strict TypeScript and esbuild;
- command declarations;
- CI for dependency installation, placeholder tests, type checking, and compilation;
- PDR, development/publishing notes, security policy, agent guidance, icon, and preview;
- declared support for Virtual Workspaces and Restricted Mode.

The actual extension behavior is not implemented:

- every command resolves to the shared `This command is not implemented yet.` handler;
- the only test checks `1 + 1`;
- no language contribution, grammar, language configuration, parser, diagnostics, cache, family resolver, completion provider, definition provider, symbol provider, or Code Action provider exists;
- no browser entry exists despite the PDR's web goal;
- no Extension Host integration suite or packaged VSIX smoke test exists;
- `package.json` declares `"type": "module"` while esbuild emits a CommonJS `dist/extension.js`.

The repository is therefore a well-documented scaffold, not yet a working `.env` extension.

---

## 2. Product milestones

Trying to ship every PDR feature simultaneously would turn a small extension into a language-server-sized project. Delivery is divided into explicit milestones.

### `0.1.0` — trustworthy single-file dotenv support

- `.env*` language registration and TextMate syntax highlighting;
- documented dotenv dialect;
- pure lexer/parser;
- diagnostics for malformed assignments, invalid keys, duplicate keys, and unresolved same-file `${KEY}` references;
- `ENV Lens: Validate Current File`;
- debounced active/open-document diagnostics;
- safe Document Symbols if stable;
- desktop and web bundles;
- no workspace-wide discovery or file mutation.

### `0.2.0` — env family and example drift

- workspace-folder-scoped env family resolution;
- `.env.example` comparison;
- key-present/missing diagnostics;
- `Compare with Example` command;
- deterministic Code Actions for adding missing key names with empty placeholders;
- multi-root isolation;
- bounded file discovery and invalidation.

### `0.3.0` — navigation and completion

- `${KEY}` completion from the selected env family;
- Go to Definition for unambiguous references;
- safe origin metadata;
- configurable include/exclude globs;
- explicit selected-primary-file policy.

### `1.0.0` — hardened stable contract

- compatibility, performance, privacy, and mutation behavior proven;
- parser limitations documented;
- Marketplace/Open VSX publication quality;
- migration and configuration stability commitment;
- no unresolved P0/P1 correctness or secret-handling issues.

Sorting, cloud secret integrations, schema engines, masking gimmicks, and broad framework-specific validation remain outside this plan unless separately approved.

---

## 3. Dotenv dialect specification

ENV Lens must describe the syntax it accepts instead of claiming universal compatibility across all dotenv implementations.

### 3.1 Supported forms

```dotenv
KEY=value
KEY = value
EMPTY=
QUOTED="value with spaces"
SINGLE='literal value'
URL=${BASE_URL}/api
export OPTIONAL=value
# full-line comment
```

### 3.2 Key grammar

Default key pattern for `0.1`:

```text
[A-Za-z_][A-Za-z0-9_]*
```

Decisions:

- whitespace before/after the key or equals sign is allowed and preserved;
- `export` is recognized only as an optional leading keyword followed by whitespace;
- empty values are valid definitions;
- empty keys and keys beginning with a number are diagnostics;
- duplicate detection is exact and case-sensitive by default;
- Unicode key names are not accepted in the initial dialect;
- a key is considered defined even when its value is empty.

### 3.3 Value grammar

`0.1` supports:

- unquoted values;
- single-quoted values;
- double-quoted values;
- empty values;
- `${KEY}` references;
- comments on separate lines;
- a conservative inline-comment rule documented with examples.

Before implementation, settle these dialect questions in an ADR and fixtures:

- whether `#` begins an inline comment only after whitespace;
- escape handling inside single and double quotes;
- whether `\n` is decoded or treated as source text;
- whether multiline quoted values are supported;
- treatment of trailing whitespace;
- treatment of `exportKEY=value` versus `export KEY=value`;
- behavior for escaped dollar signs;
- treatment of unmatched quotes;
- BOM handling.

The parser must preserve source ranges and raw text. It must not evaluate shell commands, parameter expansion operators, command substitution, process environment, or framework-specific semantics.

### 3.4 References

Initial interpolation syntax:

```dotenv
${KEY}
```

Rules:

- same-file references are validated in `0.1`;
- self-reference is reported separately from missing reference;
- forward references are allowed;
- references inside single quotes are treated according to the chosen dialect and must be fixture-backed;
- nested shell expansion such as `${KEY:-fallback}` is not interpreted in `0.1`;
- reference diagnostics show key names only, never source values.

---

## 4. Diagnostic contract

### `0.1` diagnostic codes

| Code | Meaning | Severity default |
| --- | --- | --- |
| `env-lens/invalid-key` | Key does not match the supported grammar. | Error |
| `env-lens/malformed-assignment` | Candidate assignment cannot be parsed safely. | Error |
| `env-lens/unterminated-quote` | Quoted value is incomplete. | Error |
| `env-lens/duplicate-key` | Key appears more than once in the same file. | Warning |
| `env-lens/unresolved-reference` | `${KEY}` is not defined in the validated scope. | Warning |
| `env-lens/self-reference` | Value directly references its own key. | Warning |

### `0.2` diagnostic codes

| Code | Meaning | Severity default |
| --- | --- | --- |
| `env-lens/missing-from-example` | Active env key has no example entry. | Information/Warning, configurable |
| `env-lens/missing-from-environment` | Example key has no selected env entry. | Information, configurable |
| `env-lens/ambiguous-family` | The extension cannot choose a comparison family safely. | Information |

Requirements:

- deterministic ordering;
- one diagnostic per logical problem;
- no duplicate Problems entries after edits;
- key names may appear, values may not;
- ranges should identify the smallest useful token;
- closed-document diagnostics are cleared when no longer valid;
- no full-workspace scan at generic activation;
- configuration changes trigger bounded recomputation only.

---

## 5. Language contribution and syntax highlighting

`0.1` should include a declarative language contribution:

- language ID and aliases;
- `.env` and documented `.env.*` filename patterns;
- language configuration for comments and brackets only where meaningful;
- TextMate grammar for keys, equals signs, quotes, comments, references, and invalid/incomplete tokens where possible;
- grammar scopes tested in both dark and light themes.

Do not rely on semantic tokens for the MVP. Syntax highlighting should work before executable activation where possible.

Compatibility/coexistence requirement:

- test behavior when another dotenv language extension is installed;
- document that users may need to choose the language mode or disable overlapping grammar extensions;
- do not copy another extension's grammar, icon, branding, or Marketplace text.

---

## 6. Env family model

The `0.2` resolver must be deterministic and workspace-folder-scoped.

Proposed model:

```ts
interface EnvFileDescriptor {
  uri: vscode.Uri;
  workspaceFolder?: vscode.WorkspaceFolder;
  basename: string;
  role: "base" | "example" | "local" | "environment" | "environment-local" | "unknown";
  environment?: string;
}

interface EnvFamily {
  folder?: vscode.WorkspaceFolder;
  base?: EnvFileDescriptor;
  example?: EnvFileDescriptor;
  selected?: EnvFileDescriptor;
  variants: readonly EnvFileDescriptor[];
}
```

Default filename interpretation:

- `.env` → base;
- `.env.example` / configurable equivalent → example;
- `.env.local` → local;
- `.env.<environment>` → environment;
- `.env.<environment>.local` → environment-local.

Rules:

- resolution occurs per `WorkspaceFolder`;
- nearest/relevant folder wins for an active document;
- no values are merged to simulate framework runtime precedence in `0.2`;
- comparison uses explicitly selected files, not an invented effective environment;
- ambiguous candidates trigger a Quick Pick or safe diagnostic, never silent guessing;
- discovery uses `workspace.findFiles` with include/exclude bounds;
- URIs and `workspace.fs` are used instead of local filesystem assumptions;
- family caches are invalidated on create/change/delete/configuration events.

---

## 7. Safe mutation contract

Only `0.2` introduces writes.

`Add Missing Keys to Example` and related Code Actions must:

- be explicit user actions;
- add key names with empty placeholders only;
- never copy secret values;
- never overwrite an existing key/value;
- preserve comments, groups, unrelated whitespace, EOL, and BOM where possible;
- use `WorkspaceEdit` for open documents;
- detect stale/conflicting source state before replacing closed-file content;
- support undo for editor text edits;
- never create or edit a file outside the resolved workspace family without confirmation;
- refuse read-only/unsupported schemes cleanly;
- surface a preview or clear summary when multiple keys will be added.

Automatic mutation on save is prohibited.

---

## 8. Architecture

Recommended structure:

```text
src/
├─ extension.ts
├─ core/
│  ├─ model.ts
│  ├─ lexer.ts
│  ├─ parser.ts
│  ├─ diagnostics.ts
│  ├─ references.ts
│  ├─ compare.ts
│  └─ edits.ts
├─ language/
│  ├─ selector.ts
│  ├─ symbols.ts
│  ├─ completion.ts
│  ├─ definition.ts
│  └─ codeActions.ts
├─ workspace/
│  ├─ discovery.ts
│  ├─ family.ts
│  ├─ cache.ts
│  ├─ watchers.ts
│  └─ configuration.ts
├─ commands/
│  ├─ validateCurrentFile.ts
│  ├─ compareWithExample.ts
│  └─ addMissingKeys.ts
└─ platform/
   ├─ documents.ts
   ├─ diagnosticsCollection.ts
   └─ logging.ts
syntaxes/
├─ dotenv.tmLanguage.json
└─ dotenv.language-configuration.json
```

### 8.1 Pure core requirement

Lexer, parser, comparison, reference analysis, diagnostic derivation, and text-edit planning must not import `vscode`. They accept strings and offsets and return immutable models.

### 8.2 Parse result

```ts
interface ParsedEnvDocument {
  sourceLength: number;
  entries: readonly EnvEntry[];
  comments: readonly SourceRange[];
  errors: readonly ParseProblem[];
  eol: "\n" | "\r\n" | "mixed";
  hasBom: boolean;
}

interface EnvEntry {
  key: string;
  keyRange: SourceRange;
  valueRange: SourceRange;
  rawValue: string;
  quote: "none" | "single" | "double";
  references: readonly EnvReference[];
  lineRange: SourceRange;
}
```

Values may exist transiently in parser memory because the active document contains them, but APIs, diagnostics, logs, telemetry, caches persisted to disk, and user-facing cross-file hovers must never expose them.

### 8.3 Caching

- cache open-document parse results by URI + document version;
- debounce diagnostics after edits;
- keep workspace metadata separate from values;
- avoid storing secret values longer than required;
- invalidate a single document/family, not the whole workspace;
- cap file size and candidate count;
- use cancellation tokens for workspace discovery and provider work.

---

## 9. Manifest and runtime requirements

### Build

Correct the ESM/CommonJS mismatch. Recommended outputs:

- Node: `dist/node/extension.cjs`;
- Web: `dist/web/extension.js`;
- grammar/configuration files shipped declaratively;
- browser-safe shared core;
- no Node-only path/fs APIs in common modules.

### Activation

- syntax contribution remains declarative;
- executable features activate for the contributed language and commands;
- if the final minimum is below VS Code 1.74, add explicit activation events;
- do not use `onStartupFinished`;
- do not scan workspaces at activation.

### Capabilities

Capability claims must follow tested behavior:

| Environment | `0.1` target | `0.2+` target |
| --- | --- | --- |
| Desktop | Full | Full |
| Web | Full single-document | Full/near-full via `workspace.fs` |
| Virtual Workspace | Full single-document | Full where writable/readable provider supports required operations |
| Restricted Mode | Full read/diagnostics | Reads full; writes explicit and policy-reviewed |
| Remote/Codespaces | Full | Full with URI-based access |

Use `extensionKind` only after testing where providers and workspace discovery should run. Likely workspace preference for family discovery, but do not guess.

Derive and test the true `engines.vscode` minimum.

---

## 10. Security and privacy

ENV Lens handles files likely to contain secrets. These requirements are release blockers:

- no network access;
- zero telemetry in initial releases;
- never log raw lines or values;
- never include values in diagnostics, notifications, output channels, command arguments, URIs, cache keys, crash context, or tests committed with real credentials;
- use synthetic fixtures only;
- no environment loading into `process.env`;
- no command/shell evaluation;
- no cloud secret-manager integration;
- no secret value copied into `.env.example`;
- no cross-workspace read outside configured candidates;
- redact errors from unexpected parser/runtime failures;
- review all third-party parser dependencies and licenses;
- support Workspace Trust honestly;
- document that key names themselves can be sensitive metadata.

Add a dedicated `SecretSafeLogger` or equivalent boundary that accepts structured event names and non-sensitive counts only.

---

## 11. UX and accessibility

- Problems entries use clear diagnostic codes and precise ranges;
- no noisy notification after every edit;
- commands provide concise summaries;
- Code Actions describe exactly which file will change;
- Quick Picks display workspace-relative paths and workspace folder names in multi-root setups;
- no webview for settings or comparisons;
- settings use native VS Code configuration UI;
- all actions are keyboard accessible;
- syntax colors depend on theme scopes, not hardcoded editor colors;
- diagnostics remain understandable without color;
- high-contrast themes are manually checked;
- write operations are never disguised as validation.

---

## 12. Performance budgets

Default safeguards to confirm with benchmarks:

- no startup scan;
- active document parsing debounced 150–250 ms;
- parse a normal file under 10 ms and a 1 MiB fixture under 100 ms on a typical desktop;
- default maximum analyzed dotenv file size: 2 MiB;
- default maximum family candidates per workspace folder: 64;
- discovery globs always exclude `node_modules`, `.git`, build output, and configured exclusions;
- no more than one active discovery per workspace folder;
- cancellation stops obsolete runs;
- provider responses reuse versioned parse results;
- extension activation target under 75 ms excluding first requested parse.

Do not silently skip a file due to limits; show a bounded, value-free explanation.

---

## 13. Test matrix

### Parser/lexer unit fixtures

- unquoted, single, double, empty values;
- spaces around equals;
- `export KEY=value`;
- invalid keys;
- duplicate keys;
- full-line and inline comments;
- `#` inside quoted/unquoted values;
- escaped quotes/backslashes/dollars;
- `${KEY}` and unsupported expansion forms;
- self/forward/missing references;
- unterminated quotes;
- BOM;
- CRLF, LF, and mixed EOL;
- Unicode values and emoji;
- very long lines;
- malformed bytes represented through decoded documents;
- optional multiline behavior;
- comments/groups preserved by edit planning.

### Language integration

- filenames and patterns map to expected language ID;
- grammar scopes for key/value/comment/reference;
- no activation for unrelated files;
- diagnostics update after edits and close;
- no duplicate Problems entries;
- symbols navigate to key ranges;
- Code Actions appear only for matching diagnostics;
- same command behavior through Command Palette and action;
- coexistence/manual test with a popular dotenv extension.

### Workspace/family integration

- single folder;
- multi-root isolation;
- nested repositories/folders;
- `.env`, `.env.local`, `.env.example`, environment variants;
- ambiguous example candidates;
- create/change/delete/rename invalidation;
- non-file URI;
- virtual filesystem;
- remote workspace;
- read-only scheme;
- Restricted Mode;
- configuration changes;
- large candidate sets and cancellation.

### Mutation tests

- add key name with empty value;
- never copy source value;
- existing value untouched;
- comments and EOL preserved;
- BOM preserved;
- stale file conflict rejected;
- multi-key insertion deterministic;
- WorkspaceEdit undo;
- read-only failure leaves no partial change.

### Package tests

- Node/web builds;
- grammar/config files in VSIX;
- source/test/docs exclusions as intended;
- packaged activation;
- clean-profile install;
- minimum/current VS Code;
- `vscode.dev` sideload;
- Open VSX compatibility.

---

## 14. Ordered ticket backlog

Use these IDs in GitHub Issues, branches, commits, and PR descriptions.

### Foundation and dialect

#### ENV-001 — Align runtime module formats and artifact layout
Priority: P0  
Depends on: none

Create explicit Node and web outputs, remove the current ESM/CommonJS ambiguity, update manifest/build/tasks/ignore rules, and verify packaged activation.

#### ENV-002 — Establish unit, desktop, and web test harnesses
Priority: P0  
Depends on: ENV-001

Add parser fixtures, `@vscode/test-electron`, `@vscode/test-web`, test workspace, minimum/current VS Code jobs, and a VSIX smoke path.

#### ENV-003 — Approve dotenv dialect ADR
Priority: P0  
Depends on: none

Resolve inline comments, quotes, escapes, multiline values, interpolation, BOM, `export`, and malformed-line behavior. Include examples and non-goals.

Acceptance: every dialect rule has positive and negative fixtures.

#### ENV-004 — Contribute dotenv language and TextMate grammar
Priority: P0  
Depends on: ENV-003

Add language ID, aliases, filename patterns, grammar, language configuration, theme/manual scope tests, and package inclusion.

#### ENV-005 — Define source model and range utilities
Priority: P0  
Depends on: ENV-003

Create immutable, VS Code-independent models for entries, references, parse problems, source ranges, EOL, and BOM.

### `0.1` parser and diagnostics

#### ENV-006 — Implement lexer
Priority: P0  
Depends on: ENV-003, ENV-005

Tokenize lines, keys, equals, values, quotes, comments, export keyword, and references without evaluating content.

#### ENV-007 — Implement parser and recovery
Priority: P0  
Depends on: ENV-006

Build entries and deterministic errors; recover after malformed lines so later keys still analyze.

#### ENV-008 — Implement duplicate and reference analysis
Priority: P0  
Depends on: ENV-007

Detect exact duplicates, unresolved same-file references, self-reference, and stable diagnostic ordering.

#### ENV-009 — Implement secret-safe diagnostic mapping
Priority: P0  
Depends on: ENV-008

Map pure problems to VS Code diagnostics with codes/severities/ranges and guarantee no values in messages or logs.

#### ENV-010 — Implement versioned document cache and debounce
Priority: P0  
Depends on: ENV-007

Cache by URI/version, debounce edits, cancel obsolete work, enforce file-size limit, and clear on close.

#### ENV-011 — Wire diagnostics lifecycle
Priority: P0  
Depends on: ENV-009, ENV-010

Register collection/listeners/language selectors; update open candidate documents only; avoid startup scans.

#### ENV-012 — Implement Validate Current File command
Priority: P0  
Depends on: ENV-011

Trigger immediate validation, focus Problems or show a count summary without values, and handle unsupported documents.

#### ENV-013 — Implement safe Document Symbols
Priority: P1  
Depends on: ENV-007

Expose key symbols with ranges and no values. Drop from `0.1` if it compromises launch quality.

#### ENV-014 — Complete `0.1` integration, privacy, and performance verification
Priority: P0  
Depends on: ENV-004 through ENV-013

Run parser, grammar, diagnostics, web/desktop, high-contrast, large-file, logging, and package tests.

#### ENV-015 — Release `0.1.0`
Priority: P0  
Depends on: ENV-014, ENV-030, ENV-031

Publish truthful single-document feature set and limitations.

### `0.2` family comparison and safe edits

#### ENV-016 — Implement env filename classifier
Priority: P0  
Depends on: ENV-003, ENV-005

Classify base/example/local/environment variants with tests for ambiguous filenames.

#### ENV-017 — Implement bounded workspace-folder discovery
Priority: P0  
Depends on: ENV-016

Use URI APIs, include/exclude globs, cancellation, limits, and per-folder results. No values retained in the index.

#### ENV-018 — Implement deterministic env family resolver
Priority: P0  
Depends on: ENV-017

Resolve active file/folder/example relationships; surface ambiguity instead of guessing.

#### ENV-019 — Add multi-root-aware configuration
Priority: P0  
Depends on: ENV-018

Contribute example filename, include/exclude, diagnostic toggles, and folder-scoped resolution with validation.

#### ENV-020 — Implement family cache/watch invalidation
Priority: P0  
Depends on: ENV-017, ENV-019

Handle create/change/delete/rename/configuration changes incrementally and without repeated full scans.

#### ENV-021 — Implement pure example-drift comparison
Priority: P0  
Depends on: ENV-018

Compare key sets only and return missing/extra key metadata without values.

#### ENV-022 — Add example-drift diagnostics and command
Priority: P0  
Depends on: ENV-021

Implement `Compare with Example`, relevant diagnostics, ambiguity Quick Pick, and folder-relative labels.

#### ENV-023 — Implement safe edit planner for missing example keys
Priority: P0  
Depends on: ENV-007, ENV-021

Plan deterministic empty-placeholder insertions preserving comments, groups, EOL, BOM, and existing values.

#### ENV-024 — Implement Code Actions and Add Missing Keys command
Priority: P0  
Depends on: ENV-023

Apply explicit `WorkspaceEdit`, detect stale/read-only state, preview multi-key actions, and never copy secrets.

#### ENV-025 — Complete `0.2` mutation/security/remote matrix
Priority: P0  
Depends on: ENV-016 through ENV-024

Test multi-root, remote, virtual, Restricted Mode, read-only, stale conflicts, undo, no partial writes, and secret non-propagation.

#### ENV-026 — Release `0.2.0`
Priority: P0  
Depends on: ENV-025, ENV-030, ENV-031

### `0.3` completion and navigation

#### ENV-027 — Implement family-scoped reference completion
Priority: P1  
Depends on: ENV-018, ENV-020

Suggest key names only with origin metadata, deterministic precedence, and no values.

#### ENV-028 — Implement Go to Definition
Priority: P1  
Depends on: ENV-027

Navigate only when origin is unambiguous; return multiple locations when appropriate rather than guessing.

#### ENV-029 — Complete `0.3` web/remote/provider matrix and release
Priority: P1  
Depends on: ENV-027, ENV-028

Test cancellation, stale caches, multi-root, web, remote, virtual providers, and package behavior.

### Cross-cutting release work

#### ENV-030 — Replace scaffold README, preview, and Marketplace copy
Priority: P0  
Depends on: implemented milestone features

Document dialect, commands, diagnostics, privacy, limits, compatibility, conflicts/coexistence, troubleshooting, and real screenshots. Update CHANGELOG.

#### ENV-031 — Harden CI and VSIX inspection
Priority: P0  
Depends on: ENV-002

Run unit, desktop, web, grammar/package, production build, VSIX content inspection, clean-profile activation, and minimum/current version jobs.

#### ENV-032 — Derive capabilities, extension location, and minimum VS Code
Priority: P0  
Depends on: implemented features and compatibility tests

Set `engines.vscode`, `browser`, `capabilities`, and `extensionKind` from evidence.

#### ENV-033 — Dependency, license, and supply-chain review
Priority: P0  
Depends on: final dependency set

Document licenses, pin strategy, update policy, lockfile integrity, and why each runtime dependency is required.

#### ENV-034 — `1.0` stability and migration review
Priority: P1  
Depends on: `0.3` usage feedback

Freeze configuration/diagnostic-code contracts, document migration policy, resolve high-severity feedback, and perform final compatibility audit.

---

## 15. Launch gates

### `0.1.0`

- dialect ADR approved and fixture-backed;
- language grammar and parser agree on supported constructs;
- no placeholder code/tests remain;
- diagnostics are deterministic and value-free;
- no startup/workspace scan;
- Node and browser Extension Host tests pass;
- package activates from VSIX;
- README clearly limits scope to single-file validation.

### `0.2.0`

- env families are deterministic per workspace folder;
- ambiguous families never trigger silent edits;
- adding example keys never copies/overwrites values;
- EOL/BOM/comments are preserved in mutation fixtures;
- stale/read-only/remote/virtual failures leave no partial writes;
- multi-root and Restricted Mode behavior is documented and tested.

### `1.0.0`

- no known value-leak path;
- no unresolved P0 correctness/security bugs;
- all declared environments tested;
- measured performance remains within budgets;
- configuration and diagnostic identifiers are stable;
- public artifacts and documentation match actual behavior.

---

## 16. Deferred ideas requiring separate approval

- sorting while preserving semantic comment groups;
- policy/schema files for required keys;
- framework adapters;
- cloud secret stores;
- encrypted files;
- secret masking decorations;
- usage search outside dotenv files;
- shell-compatible expansion evaluation;
- automatic mutation on save.

---

## 17. Primary references

- https://code.visualstudio.com/api
- https://code.visualstudio.com/api/language-extensions/overview
- https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide
- https://code.visualstudio.com/api/language-extensions/programmatic-language-features
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/references/activation-events
- https://code.visualstudio.com/api/extension-guides/web-extensions
- https://code.visualstudio.com/api/extension-guides/virtual-workspaces
- https://code.visualstudio.com/api/extension-guides/workspace-trust
- https://code.visualstudio.com/api/advanced-topics/extension-host
- https://code.visualstudio.com/api/advanced-topics/remote-extensions
- https://code.visualstudio.com/api/working-with-extensions/testing-extension
- https://code.visualstudio.com/api/working-with-extensions/bundling-extension
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://github.com/microsoft/vscode-extension-samples
- https://github.com/microsoft/vscode-test-web
- https://github.com/mikestead/vscode-dotenv
