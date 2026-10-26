# Changelog

## [Unreleased]

- Fixed: invalid-key diagnostics no longer quote the text before `=`, which could contain value fragments such as private-key lines.
- Fixed: the Add to example quick fix no longer appears inside the example file with a wrong key.
- Fixed: a cancelled validation no longer empties family discovery for other open dotenv files, and saving a dotenv file no longer rescans the workspace folder.
- Add Missing Keys to Environment uses the chosen example and environment snapshots. From an example, it asks for the target environment or an explicitly named new dotenv file beside it. From an environment, the active file is the target. The user chooses the missing key names. Each inserted entry is KEY= with no value copied. Existing entries and comments stay intact. Creation remains inside the workspace and refuses collisions. Source and target are checked again after prompts, including dirty editor buffers.

## 0.1.0 — Unreleased

- Added a Set Defaults command that writes factory settings to user and workspace scope.
- Added a documented dotenv language, grammar, and language configuration.
- Added value-safe diagnostics with debounced open-document updates.
- Added workspace-folder-scoped env-family comparison and multi-root isolation.
- Added safe example-file creation and empty key insertion through undoable workspace edits.
- Added `${KEY}` completion, Go to Definition, Document Symbols, and targeted Code Actions.
- Added Node and browser bundles for desktop, web, remote, virtual, and Restricted Mode use.
- Added unit, grammar, performance, desktop, web, virtual-filesystem, and packaged-VSIX gates.
- Replaced the scaffold documentation and media contract for the first public release.
