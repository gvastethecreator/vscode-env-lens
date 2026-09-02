# ADR 0001: Conservative dotenv dialect

Status: Accepted
Date: 2026-09-02

## Context

Dotenv parsers disagree on comments, escapes, interpolation, multiline values, and shell-like operators. ENV Lens needs deterministic editor feedback without pretending to execute a framework's runtime parser.

## Decision

- Keys match `[A-Za-z_][A-Za-z0-9_]*` and stay case-sensitive.
- Whitespace around keys and `=` is accepted and preserved.
- `export` is a keyword only when followed by whitespace. `exportKEY=value` defines `exportKEY`.
- Empty, unquoted, single-quoted, and double-quoted values are accepted.
- `#` starts an inline comment only after whitespace. `KEY=#literal` remains a value.
- Single quotes are literal. `${KEY}` references are recognized in unquoted and double-quoted values.
- A backslash prevents the next source character from starting an unquoted reference or comment. Double-quoted escapes remain source text and are not decoded.
- Forward references are valid. Missing and direct self references have separate diagnostic codes.
- Unterminated quotes and unsupported trailing text are errors. Parsing resumes on the next line.
- UTF-8 BOM, LF, CRLF, and mixed line endings are detected without normalizing source text.
- Multiline quoted values, command substitution, process environment reads, nested expansion, and operators such as `${KEY:-fallback}` are not evaluated.

## Consequences

The grammar and parser share a small, testable contract. Diagnostics stay stable and value-safe. Users who need framework-specific expansion still use that framework's validator; ENV Lens remains an editor companion, not a runtime dotenv implementation.
