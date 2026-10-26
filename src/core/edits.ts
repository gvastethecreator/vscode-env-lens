import { isEnvKey } from "./model.ts";
import { parseEnv } from "./parser.ts";

export interface EnvInsertionPlan {
  readonly keys: readonly string[];
  readonly offset: number;
  readonly text: string;
}

function preferredEol(source: string): "\n" | "\r\n" {
  const match = /\r\n|\n/.exec(source);
  return match?.[0] === "\r\n" ? "\r\n" : "\n";
}

export function planMissingKeyInsertion(
  source: string,
  requestedKeys: readonly string[],
): EnvInsertionPlan {
  const existing = new Set(parseEnv(source).entries.map((entry) => entry.key));
  const keys: string[] = [];
  const selected = new Set<string>();
  for (const key of requestedKeys) {
    if (!isEnvKey(key) || existing.has(key) || selected.has(key)) {
      continue;
    }
    selected.add(key);
    keys.push(key);
  }
  const eol = preferredEol(source);
  const contentStart = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const hasContent = source.length > contentStart;
  const needsLeadingEol = hasContent && !source.endsWith("\n") && !source.endsWith("\r");
  const text = keys.length === 0
    ? ""
    : (needsLeadingEol ? eol : "") + keys.map((key) => `${key}=`).join(eol) + eol;
  return Object.freeze({
    keys: Object.freeze(keys),
    offset: source.length,
    text,
  });
}
