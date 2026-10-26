import type { EnvEntry, ParsedEnvDocument, SourceRange } from "./model.ts";

export interface EnvKeyDifference {
  readonly key: string;
  readonly range: SourceRange;
}

export interface EnvComparison {
  readonly missingFromExample: readonly EnvKeyDifference[];
  readonly missingFromEnvironment: readonly EnvKeyDifference[];
}

function uniqueEntries(entries: readonly EnvEntry[]): readonly EnvEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) {
      return false;
    }
    seen.add(entry.key);
    return true;
  });
}

export function compareEnvDocuments(
  environment: ParsedEnvDocument,
  example: ParsedEnvDocument,
): EnvComparison {
  const environmentEntries = uniqueEntries(environment.entries);
  const exampleEntries = uniqueEntries(example.entries);
  const environmentKeys = new Set(environmentEntries.map((entry) => entry.key));
  const exampleKeys = new Set(exampleEntries.map((entry) => entry.key));
  return Object.freeze({
    missingFromExample: Object.freeze(
      environmentEntries
        .filter((entry) => !exampleKeys.has(entry.key))
        .map((entry) => Object.freeze({ key: entry.key, range: entry.keyRange })),
    ),
    missingFromEnvironment: Object.freeze(
      exampleEntries
        .filter((entry) => !environmentKeys.has(entry.key))
        .map((entry) => Object.freeze({ key: entry.key, range: entry.keyRange })),
    ),
  });
}
