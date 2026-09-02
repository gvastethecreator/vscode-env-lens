export type EnvEol = "\n" | "\r\n" | "mixed";
export type EnvQuote = "none" | "single" | "double";

export type EnvProblemCode =
  | "env-lens/invalid-key"
  | "env-lens/malformed-assignment"
  | "env-lens/unterminated-quote"
  | "env-lens/duplicate-key"
  | "env-lens/unresolved-reference"
  | "env-lens/self-reference";

export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

export interface EnvReference {
  readonly key: string;
  readonly range: SourceRange;
}

export interface EnvEntry {
  readonly key: string;
  readonly keyRange: SourceRange;
  readonly valueRange: SourceRange;
  readonly rawValue: string;
  readonly quote: EnvQuote;
  readonly references: readonly EnvReference[];
  readonly lineRange: SourceRange;
}

export interface EnvParseProblem {
  readonly code: EnvProblemCode;
  readonly range: SourceRange;
  readonly key?: string;
}

export interface ParsedEnvDocument {
  readonly sourceLength: number;
  readonly entries: readonly EnvEntry[];
  readonly comments: readonly SourceRange[];
  readonly errors: readonly EnvParseProblem[];
  readonly eol: EnvEol;
  readonly hasBom: boolean;
}

export const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isEnvKey(value: string): boolean {
  return ENV_KEY_PATTERN.test(value);
}
