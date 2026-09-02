import assert from "node:assert/strict";
import test from "node:test";
import { parseEnv } from "./parser.ts";

test("parses the supported assignment forms without evaluating values", () => {
  const source = [
    "# project settings",
    "PLAIN=value",
    "SPACED = value with spaces",
    "export EXPORTED=enabled",
    "EMPTY=",
    "SINGLE='literal ${PLAIN}'",
    'DOUBLE="prefix ${PLAIN}\\n"',
    "HASH=value#literal",
    "UNICODE=café 🚀",
  ].join("\n");

  const parsed = parseEnv(source);

  assert.deepEqual(parsed.entries.map(({ key }) => key), [
    "PLAIN",
    "SPACED",
    "EXPORTED",
    "EMPTY",
    "SINGLE",
    "DOUBLE",
    "HASH",
    "UNICODE",
  ]);
  assert.equal(parsed.entries[1]?.rawValue, "value with spaces");
  assert.equal(parsed.entries[3]?.rawValue, "");
  assert.equal(parsed.entries[4]?.quote, "single");
  assert.deepEqual(parsed.entries[4]?.references, []);
  assert.equal(parsed.entries[5]?.quote, "double");
  assert.deepEqual(parsed.entries[5]?.references.map(({ key }) => key), ["PLAIN"]);
  assert.equal(parsed.entries[6]?.rawValue, "value#literal");
  assert.equal(parsed.entries[7]?.rawValue, "café 🚀");
  assert.equal(parsed.comments.length, 1);
  assert.deepEqual(parsed.errors, []);
});

test("recognizes inline comments only after assignment whitespace", () => {
  const source = [
    "LITERAL=#value",
    "EMPTY= # comment",
    "VALUE=value # comment",
    "ESCAPED=value \\# literal",
  ].join("\n");

  const parsed = parseEnv(source);

  assert.equal(parsed.entries[0]?.rawValue, "#value");
  assert.equal(parsed.entries[1]?.rawValue, "");
  assert.equal(parsed.entries[2]?.rawValue, "value");
  assert.equal(parsed.entries[3]?.rawValue, "value \\# literal");
  assert.equal(parsed.comments.length, 2);
});

test("supports forward references and reports duplicate, missing, and self references", () => {
  const source = [
    "A=${B}",
    "B=ok",
    "A=again",
    "SELF=${SELF}",
    "MISSING=${UNKNOWN}",
    "ESCAPED=\\${UNKNOWN}",
  ].join("\r\n");

  const parsed = parseEnv(source);

  assert.equal(parsed.eol, "\r\n");
  assert.deepEqual(parsed.errors.map(({ code, key }) => ({ code, key })), [
    { code: "env-lens/duplicate-key", key: "A" },
    { code: "env-lens/self-reference", key: "SELF" },
    { code: "env-lens/unresolved-reference", key: "UNKNOWN" },
  ]);
});

test("recovers after invalid lines and reports precise deterministic ranges", () => {
  const source = [
    "1INVALID=value",
    "NO_EQUALS",
    'OPEN="secret',
    'TRAIL="safe"unexpected',
    "VALID=ok",
  ].join("\n");

  const parsed = parseEnv(source);

  assert.deepEqual(parsed.entries.map(({ key }) => key), ["TRAIL", "VALID"]);
  assert.deepEqual(parsed.errors.map(({ code }) => code), [
    "env-lens/invalid-key",
    "env-lens/malformed-assignment",
    "env-lens/unterminated-quote",
    "env-lens/malformed-assignment",
  ]);
  assert.equal(source.slice(
    parsed.errors[0]?.range.start,
    parsed.errors[0]?.range.end,
  ), "1INVALID");
  assert.equal(source.slice(
    parsed.errors[1]?.range.start,
    parsed.errors[1]?.range.end,
  ), "NO_EQUALS");
});

test("tracks BOM and mixed line endings while preserving absolute ranges", () => {
  const source = "\uFEFFFIRST=one\r\nSECOND=two\nTHIRD=three\rFOURTH=four";
  const parsed = parseEnv(source);

  assert.equal(parsed.hasBom, true);
  assert.equal(parsed.eol, "mixed");
  assert.equal(parsed.entries[0]?.keyRange.start, 1);
  assert.equal(source.slice(
    parsed.entries[3]?.keyRange.start,
    parsed.entries[3]?.keyRange.end,
  ), "FOURTH");
});

test("never copies raw values into parse problems", () => {
  const secret = "do-not-leak-this-value";
  const parsed = parseEnv(`GOOD=${secret}\nBROKEN=\"${secret}`);

  assert.equal(JSON.stringify(parsed.errors).includes(secret), false);
});
