import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-web";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
await runTests({
  browserType: "chromium",
  browserOptions: process.env.CI ? ["--no-sandbox", "--disable-gpu"] : undefined,
  quality: "stable",
  headless: true,
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(root, "dist", "web", "test", "suite", "index.cjs"),
  folderPath: path.join(root, "test-workspace", "alpha"),
  testRunnerDataDir: path.join(root, ".vscode-test-web"),
});
