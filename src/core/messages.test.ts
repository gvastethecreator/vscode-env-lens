import assert from "node:assert/strict";
import test from "node:test";
import { problemMessage } from "./messages.ts";
import type { EnvProblemCode } from "./model.ts";
import { parseEnv } from "./parser.ts";

const codes: readonly EnvProblemCode[] = [
  "env-lens/invalid-key",
  "env-lens/malformed-assignment",
  "env-lens/unterminated-quote",
  "env-lens/duplicate-key",
  "env-lens/unresolved-reference",
  "env-lens/self-reference",
];

test("maps every problem code to concise English copy", () => {
  for (const code of codes) {
    const message = problemMessage({ code, key: "PUBLIC_KEY", range: { start: 0, end: 1 } });
    assert.equal(message.length > 0, true);
    assert.equal(message.includes("PUBLIC_KEY"), true);
  }
});

test("diagnostic messages contain key names but never values", () => {
  const secret = "do-not-show-this-secret";
  const parsed = parseEnv(`VALID=${secret}\nBROKEN=\"${secret}`);
  const messages = parsed.errors.map(problemMessage).join("\n");

  assert.equal(messages.includes("BROKEN"), true);
  assert.equal(messages.includes(secret), false);
});
