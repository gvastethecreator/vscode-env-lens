# Development

Use pnpm from the repository root. The lockfile and `pnpm-workspace.yaml` define the approved install and build policy.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install the locked dependencies. |
| `pnpm test` | Run the pure TypeScript unit tests. |
| `pnpm run test:grammar` | Tokenize representative dotenv lines in light and dark theme scopes. |
| `pnpm run check-types` | Check strict TypeScript types. |
| `pnpm run compile` | Build Node and browser development bundles. |
| `pnpm run test:performance` | Check the normal and 1 MiB parser budgets. |
| `pnpm run quality` | Run unit, grammar, type, build, and performance gates. |
| `pnpm run test:integration` | Run the desktop Extension Host suite in an isolated copied workspace. |
| `pnpm run test:web` | Run the browser Extension Host suite on a writable virtual filesystem. |
| `pnpm run vsix` | Build `env-lens.vsix`. |
| `pnpm run inspect:vsix` | Check package contents, manifest claims, size, and PNG metadata. |
| `pnpm run test:vsix` | Install the VSIX in a clean profile and run the Extension Host suite. |

## Extension Host

Press F5 to build both runtime bundles and open `test-workspace/`. The automated desktop runner copies that fixture to a temporary folder before tests, so mutation checks do not change tracked files.

CI runs quality checks on Linux, Windows, and macOS. It also runs VS Code 1.134, Stable, and Insiders desktop hosts, a browser/virtual host, and a clean-profile VSIX smoke test.

The repository does not contain real credentials. Keep every fixture synthetic and never print dotenv contents while debugging.

The runtime has no npm dependencies. See [dependencies.md](dependencies.md) for the locked build-tool inventory, license review, install-script allowlist, and update policy.
