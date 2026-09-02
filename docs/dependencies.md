# Dependencies and supply chain

Reviewed: 2026-09-02

ENV Lens has no runtime npm dependencies. The Node and browser bundles contain the extension code only and leave the built-in `vscode` module external. The extension does not need a parser package, network client, telemetry SDK, native module, shell helper, or secret store at runtime.

## Direct development dependencies

| Package | Locked version | License | Purpose |
| --- | --- | --- | --- |
| `@types/node` | 26.4.0 | MIT | Build-script types. |
| `@types/vscode` | 1.134.0 | MIT | Minimum supported VS Code API contract. |
| `@types/yauzl` | 3.4.0 | MIT | VSIX inspection types. |
| `@vscode/test-electron` | 3.1.0 | MIT | Desktop and installed-VSIX Extension Host tests. |
| `@vscode/test-web` | 0.0.81 | MIT | Browser and virtual-workspace Extension Host tests. |
| `@vscode/vsce` | 3.9.2 | MIT | VSIX packaging. |
| `esbuild` | 0.28.2 | MIT | Node and browser bundling. |
| `typescript` | 7.0.2 | Apache-2.0 | Static type checking. |
| `vscode-oniguruma` | 2.0.1 | MIT | Real TextMate grammar tokenization tests. |
| `vscode-textmate` | 9.3.2 | MIT | Real TextMate grammar tokenization tests. |
| `yauzl` | 3.4.0 | MIT | Read-only VSIX content inspection. |

The complete locked development tree is predominantly MIT and also contains permissive or dual-licensed packages under Apache-2.0, BSD, ISC, 0BSD, BlueOak, Artistic-2.0, CC0, Python-2.0, WTFPL, and compatible multi-license expressions. `@vscode/vsce-sign` and its platform binary declare Microsoft VSCE-SIGN terms in `LICENSE.txt`; they are transitive build-only tooling used with VS Code packaging and are not included in the extension.

## Controls

- `packageManager` fixes pnpm 12.1.0 and CI installs with `--frozen-lockfile`.
- `pnpm-lock.yaml` records exact resolved versions and registry integrity hashes.
- Install scripts are allowed only for `esbuild` and the Chromium browser fixture. Scripts for `@vscode/vsce-sign` and `keytar` stay disabled.
- `pnpm audit` and `pnpm audit --prod` reported no known vulnerabilities during this review.
- The VSIX is built with `--no-dependencies`; archive inspection rejects source, tests, build scripts, dotenv files, source maps, and `node_modules`.
- Dependency updates require a lockfile diff, a repeated license/audit review, and the complete quality, desktop, web, and VSIX gates.

This is an engineering inventory, not a substitute for legal advice.
