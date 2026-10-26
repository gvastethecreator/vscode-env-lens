import {
  type EnvEntry,
  type EnvEol,
  type EnvParseProblem,
  type EnvQuote,
  type EnvReference,
  isEnvKey,
  type ParsedEnvDocument,
  type SourceRange,
} from "./model.ts";

interface SourceLine {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function freezeRange(start: number, end: number): SourceRange {
  return Object.freeze({ start, end });
}

function sourceLines(source: string, startOffset: number): readonly SourceLine[] {
  const lines: SourceLine[] = [];
  const newline = /\r\n|\n|\r/g;
  newline.lastIndex = startOffset;
  let start = startOffset;
  let match: RegExpExecArray | null;
  while ((match = newline.exec(source)) !== null) {
    lines.push(Object.freeze({ start, end: match.index, text: source.slice(start, match.index) }));
    start = match.index + match[0].length;
  }
  if (start < source.length || source.length === startOffset) {
    lines.push(Object.freeze({ start, end: source.length, text: source.slice(start) }));
  }
  return Object.freeze(lines);
}

function detectEol(source: string): EnvEol {
  const endings = new Set<string>();
  for (const match of source.matchAll(/\r\n|\n|\r/g)) {
    endings.add(match[0]);
  }
  if (endings.size === 0 || (endings.size === 1 && endings.has("\n"))) {
    return "\n";
  }
  if (endings.size === 1 && endings.has("\r\n")) {
    return "\r\n";
  }
  return "mixed";
}

function skipWhitespace(text: string, start: number): number {
  let offset = start;
  while (offset < text.length && (text[offset] === " " || text[offset] === "\t")) {
    offset += 1;
  }
  return offset;
}

function trimWhitespaceEnd(text: string, start: number, end: number): number {
  let offset = end;
  while (offset > start && (text[offset - 1] === " " || text[offset - 1] === "\t")) {
    offset -= 1;
  }
  return offset;
}

function scanReferences(text: string, start: number, end: number, sourceStart: number): readonly EnvReference[] {
  const references: EnvReference[] = [];
  for (let offset = start; offset < end; offset += 1) {
    if (text[offset] === "\\") {
      offset += 1;
      continue;
    }
    if (text[offset] !== "$" || text[offset + 1] !== "{") {
      continue;
    }
    const match = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(text.slice(offset, end));
    if (!match) {
      continue;
    }
    const key = match[1];
    references.push(Object.freeze({
      key,
      range: freezeRange(sourceStart + offset + 2, sourceStart + offset + 2 + key.length),
    }));
    offset += match[0].length - 1;
  }
  return Object.freeze(references);
}

function inlineCommentOffset(
  text: string,
  start: number,
  allowAtStart: boolean,
): number | undefined {
  for (let offset = start; offset < text.length; offset += 1) {
    if (text[offset] === "\\") {
      offset += 1;
      continue;
    }
    if (
      text[offset] === "#"
      && (
        (offset === start && allowAtStart)
        || (offset > start && (text[offset - 1] === " " || text[offset - 1] === "\t"))
      )
    ) {
      return offset;
    }
  }
}

function closingQuoteOffset(text: string, start: number, quote: "'" | '"'): number | undefined {
  for (let offset = start + 1; offset < text.length; offset += 1) {
    if (quote === '"' && text[offset] === "\\") {
      offset += 1;
      continue;
    }
    if (text[offset] === quote) {
      return offset;
    }
  }
}

function parseLine(
  source: string,
  line: SourceLine,
  entries: EnvEntry[],
  comments: SourceRange[],
  errors: EnvParseProblem[],
): void {
  const text = line.text;
  let cursor = skipWhitespace(text, 0);
  if (cursor === text.length) {
    return;
  }
  if (text[cursor] === "#") {
    comments.push(freezeRange(line.start + cursor, line.end));
    return;
  }

  const problemStart = line.start + cursor;
  if (text.startsWith("export", cursor) && /[ \t]/.test(text[cursor + 6] ?? "")) {
    cursor = skipWhitespace(text, cursor + 6);
  }

  const equals = text.indexOf("=", cursor);
  if (equals < 0) {
    errors.push(Object.freeze({
      code: "env-lens/malformed-assignment",
      range: freezeRange(problemStart, line.end),
    }));
    return;
  }

  const keyStart = skipWhitespace(text, cursor);
  const keyEnd = trimWhitespaceEnd(text, keyStart, equals);
  const key = text.slice(keyStart, keyEnd);
  const keyRange = freezeRange(line.start + keyStart, line.start + keyEnd);
  if (!isEnvKey(key)) {
    errors.push(Object.freeze({
      code: "env-lens/invalid-key",
      range: keyRange,
      key: key || undefined,
    }));
    return;
  }

  const valueStart = skipWhitespace(text, equals + 1);
  let valueEnd = text.length;
  let quote: EnvQuote = "none";
  let references: readonly EnvReference[] = Object.freeze([]);
  let commentStart: number | undefined;

  if (text[valueStart] === "'" || text[valueStart] === '"') {
    const marker = text[valueStart] as "'" | '"';
    quote = marker === "'" ? "single" : "double";
    const close = closingQuoteOffset(text, valueStart, marker);
    if (close === undefined) {
      errors.push(Object.freeze({
        code: "env-lens/unterminated-quote",
        key,
        range: freezeRange(line.start + valueStart, line.end),
      }));
      return;
    }
    valueEnd = close;
    const tail = skipWhitespace(text, close + 1);
    if (tail < text.length) {
      if (text[tail] === "#" && tail > close + 1) {
        commentStart = tail;
      } else {
        errors.push(Object.freeze({
          code: "env-lens/malformed-assignment",
          key,
          range: freezeRange(line.start + close + 1, line.end),
        }));
      }
    }
    if (quote === "double") {
      references = scanReferences(text, valueStart + 1, valueEnd, line.start);
    }
    const entry = Object.freeze({
      key,
      keyRange,
      valueRange: freezeRange(line.start + valueStart + 1, line.start + valueEnd),
      rawValue: source.slice(line.start + valueStart + 1, line.start + valueEnd),
      quote,
      references,
      lineRange: freezeRange(line.start, line.end),
    });
    entries.push(entry);
  } else {
    commentStart = inlineCommentOffset(text, valueStart, valueStart > equals + 1);
    valueEnd = trimWhitespaceEnd(text, valueStart, commentStart ?? text.length);
    references = scanReferences(text, valueStart, valueEnd, line.start);
    entries.push(Object.freeze({
      key,
      keyRange,
      valueRange: freezeRange(line.start + valueStart, line.start + valueEnd),
      rawValue: source.slice(line.start + valueStart, line.start + valueEnd),
      quote,
      references,
      lineRange: freezeRange(line.start, line.end),
    }));
  }

  if (commentStart !== undefined) {
    comments.push(freezeRange(line.start + commentStart, line.end));
  }
}

function analyzeEntries(entries: readonly EnvEntry[], errors: EnvParseProblem[]): void {
  const definitions = new Set<string>();
  for (const entry of entries) {
    if (definitions.has(entry.key)) {
      errors.push(Object.freeze({
        code: "env-lens/duplicate-key",
        key: entry.key,
        range: entry.keyRange,
      }));
    }
    definitions.add(entry.key);
  }
  for (const entry of entries) {
    for (const reference of entry.references) {
      if (reference.key === entry.key) {
        errors.push(Object.freeze({
          code: "env-lens/self-reference",
          key: reference.key,
          range: reference.range,
        }));
      } else if (!definitions.has(reference.key)) {
        errors.push(Object.freeze({
          code: "env-lens/unresolved-reference",
          key: reference.key,
          range: reference.range,
        }));
      }
    }
  }
}

export function parseEnv(source: string): ParsedEnvDocument {
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const entries: EnvEntry[] = [];
  const comments: SourceRange[] = [];
  const errors: EnvParseProblem[] = [];
  for (const line of sourceLines(source, hasBom ? 1 : 0)) {
    parseLine(source, line, entries, comments, errors);
  }
  analyzeEntries(entries, errors);
  errors.sort((left, right) => left.range.start - right.range.start || left.code.localeCompare(right.code));
  return Object.freeze({
    sourceLength: source.length,
    entries: Object.freeze(entries),
    comments: Object.freeze(comments),
    errors: Object.freeze(errors),
    eol: detectEol(source),
    hasBom,
  });
}
