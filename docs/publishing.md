# Publishing ENV Lens

Extension id: `gvastethecreator.env-lens`.

Publishing is a separate, controlled action. Do not publish until the release artifact passes every gate and the product owner explicitly approves the registry operation.

The **Release** workflow starts from **Actions → Release → Run workflow**. Default input `artifact-only` does not publish.

## Build and verify the artifact

```text
pnpm install --frozen-lockfile
pnpm run quality
pnpm run test:integration
pnpm run test:web
pnpm run vsix
pnpm run inspect:vsix
pnpm run test:vsix
```

The fixed artifact name is `env-lens.vsix`. Record its SHA-256 hash after the final build. Do not rebuild between approval and upload.

Before approval, confirm that the icon is transparent and clear at 32 px, the preview comes from the final running extension, README commands and settings match the manifest, and no dotenv file or source map is present in the archive.

## GitHub Actions

1. Run **Release** with `artifact-only` from `main`.
2. After approval, run one of `github-release`, `vscode-marketplace`, or `open-vsx`.
3. Run one registry at a time.

The Marketplace and Open VSX jobs use environments `vscode-marketplace` and `open-vsx` on branch `main`. Do not store `VSCE_PAT` or `OVSX_PAT` until the owner asks to publish. The same verified VSIX is used for either registry.

## Manual fallback

```powershell
pnpm run vsix
pnpm run inspect:vsix
```

Marketplace: upload the exact verified VSIX at [Marketplace management](https://marketplace.visualstudio.com/manage).

Open VSX:

```powershell
pnpm exec ovsx publish .\env-lens.vsix -p $env:OVSX_PAT
```

Never place a PAT in a command, an issue, a log, or a document.

## Rollback

Prefer a forward patch. Do not rewrite a public tag or replace bytes under an existing version.
