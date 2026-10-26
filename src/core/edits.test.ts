import assert from "node:assert/strict";
import test from "node:test";
import { planMissingKeyInsertion } from "./edits.ts";

test("adds only valid missing key names with empty values", () => {
  const source = "EXISTING=secret\n# keep this comment\n";
  const plan = planMissingKeyInsertion(source, [
    "NEW_KEY",
    "EXISTING",
    "NEW_KEY",
    "1INVALID",
    "OTHER",
  ]);

  assert.deepEqual(plan.keys, ["NEW_KEY", "OTHER"]);
  assert.equal(plan.offset, source.length);
  assert.equal(plan.text, "NEW_KEY=\nOTHER=\n");
  assert.equal(plan.text.includes("secret"), false);
});

test("preserves the first line ending and inserts a separator when needed", () => {
  assert.equal(
    planMissingKeyInsertion("FIRST=one\r\nSECOND=two", ["THIRD"]).text,
    "\r\nTHIRD=\r\n",
  );
  assert.equal(
    planMissingKeyInsertion("\uFEFF", ["FIRST"]).text,
    "FIRST=\n",
  );
  assert.equal(
    planMissingKeyInsertion("", ["FIRST"]).text,
    "FIRST=\n",
  );
});

test("returns a no-op plan when every requested key already exists", () => {
  const source = "FIRST=value\n";
  const plan = planMissingKeyInsertion(source, ["FIRST", "not valid"]);

  assert.deepEqual(plan.keys, []);
  assert.equal(plan.offset, source.length);
  assert.equal(plan.text, "");
});
