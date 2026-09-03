<div align="center">
  <a href="https://github.com/gvastethecreator/vscode-env-lens"><img src="media/icon.png" alt="ENV Lens" width="128" /></a>

# ENV Lens

**Catch dotenv mistakes before they break your app.**

<p align="center">
  <a href="https://github.com/gvastethecreator/vscode-env-lens"><img alt="GitHub" src="https://shieldcn.dev/badge/github.png?variant=outline&size=xs&theme=blue&logo=github" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://shieldcn.dev/github/license/gvastethecreator/vscode-env-lens.png?variant=outline&size=xs" /></a>
  <a href="https://github.com/gvastethecreator/vscode-env-lens/actions/workflows/ci.yml"><img alt="CI status" src="https://shieldcn.dev/github/ci/gvastethecreator/vscode-env-lens.png?workflow=ci.yml&branch=main&variant=outline&size=xs" /></a>
</p>
</div>

Validate `.env*` files and compare related environment files without exposing secret values.

<img src="media/preview.png" alt="ENV Lens diagnostics for an example dotenv file in VS Code" width="100%" />

## Highlights

- Diagnostics for invalid keys, malformed assignments, duplicate keys, quotes, and unresolved references.
- Drift checks between environment and example files.
- Safe actions that add missing key names with empty values.
- Completion, Go to Definition, and Document Symbols for `${KEY}` references.
- Desktop, web, remote, virtual-workspace, multi-root, and Restricted Mode support.

## Use

Open a dotenv file to see diagnostics. Run **ENV Lens: Compare with Example** to compare key names or **ENV Lens: Add Missing Keys to Example** to add empty placeholders.

ENV Lens never copies values, loads them into `process.env`, runs shell code, or sends file contents over the network. Requires VS Code 1.134 or newer.

More details: [product contract](docs/PDR.md) · [development](docs/development.md) · [dependencies](docs/dependencies.md)

---

<p align="center">
  <a href="https://github.com/gvastethecreator/vscode-env-lens/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/gvastethecreator/vscode-env-lens.png?variant=outline&size=xs" /></a>
  <a href="https://github.com/gvastethecreator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/follow%20me-/gvastethecreator.png?size=xs&amp;logo=github&amp;brand=github&amp;mode=dark"><img alt="Follow gvastethecreator" src="https://shieldcn.dev/badge/follow%20me-/gvastethecreator.png?size=xs&amp;logo=github&amp;brand=github&amp;mode=light"></picture></a>
  <a href="https://github.com/sponsors/gvastethecreator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/support%20this-project.png?size=xs&amp;logo=ri%3APiHeartFill&amp;logoColor=b85a90&amp;brand=github&amp;mode=dark"><img alt="Support this project" src="https://shieldcn.dev/badge/support%20this-project.png?size=xs&amp;logo=ri%3APiHeartFill&amp;logoColor=b85a90&amp;brand=github&amp;mode=light"></picture></a>
</p>
