import * as vscode from "vscode";
import { isSafeExampleFilename } from "../core/filenames.ts";

export const MAX_ENV_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_FAMILY_CANDIDATES = 64;
export const DIAGNOSTIC_DEBOUNCE_MS = 200;

const DEFAULT_EXAMPLE_FILE = ".env.example";
const DEFAULT_INCLUDES = Object.freeze(["**/.env", "**/.env.*"]);
const DEFAULT_EXCLUDES = Object.freeze([
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
]);

export interface EnvLensSettings {
  readonly exampleFile: string;
  readonly exampleFileIsValid: boolean;
  readonly validationEnabled: boolean;
  readonly unresolvedReferences: boolean;
  readonly exampleDrift: boolean;
  readonly includes: readonly string[];
  readonly excludes: readonly string[];
  readonly signature: string;
}

function boundedStringArray(
  value: readonly string[] | undefined,
  defaults: readonly string[],
): readonly string[] {
  const selected = (value ?? defaults)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 16);
  return Object.freeze(selected.length > 0 ? selected : [...defaults]);
}

export function readSettings(uri: vscode.Uri): EnvLensSettings {
  const configuration = vscode.workspace.getConfiguration("envLens", uri);
  const configuredExample = configuration.get<string>("exampleFile", DEFAULT_EXAMPLE_FILE).trim();
  const exampleFileIsValid = isSafeExampleFilename(configuredExample);
  const exampleFile = exampleFileIsValid ? configuredExample : DEFAULT_EXAMPLE_FILE;
  const includes = boundedStringArray(
    configuration.get<readonly string[]>("files.include"),
    DEFAULT_INCLUDES,
  );
  const excludes = boundedStringArray(
    configuration.get<readonly string[]>("files.exclude"),
    DEFAULT_EXCLUDES,
  );
  const result = {
    exampleFile,
    exampleFileIsValid,
    validationEnabled: configuration.get<boolean>("validation.enabled", true),
    unresolvedReferences: configuration.get<boolean>(
      "validation.unresolvedReferences",
      true,
    ),
    exampleDrift: configuration.get<boolean>("validation.exampleDrift", true),
    includes,
    excludes,
    signature: "",
  };
  return Object.freeze({
    ...result,
    signature: JSON.stringify({
      exampleFile: result.exampleFile,
      includes: result.includes,
      excludes: result.excludes,
    }),
  });
}
