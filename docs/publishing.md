# Publishing ENV Lens

Extension id: `gvastethecreator.env-lens`.

Publishing is a separate, controlled action. Do not publish until the release artifact passes every gate and the product owner explicitly approves the registry operation.

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

The manual Release workflow defaults to `artifact-only`. Marketplace and Open VSX jobs require the protected `release` environment and their registry token. The same verified VSIX is used for either registry.

Before approval, confirm that the icon is transparent and clear at 32 px, the preview comes from the final running extension, README commands and settings match the manifest, and no dotenv file or source map is present in the archive.
