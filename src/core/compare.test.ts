import assert from "node:assert/strict";
import test from "node:test";
import { compareEnvDocuments } from "./compare.ts";
import { parseEnv } from "./parser.ts";

test("compares unique keys in stable source order", () => {
  const environment = parseEnv("DATABASE_URL=secret\nPORT=3000\nPORT=4000\nONLY_ENV=yes\n");
  const example = parseEnv("PORT=\nHOST=\nHOST=duplicate\n");

  const comparison = compareEnvDocuments(environment, example);

  assert.deepEqual(comparison.missingFromExample.map(({ key }) => key), [
    "DATABASE_URL",
    "ONLY_ENV",
  ]);
  assert.deepEqual(comparison.missingFromEnvironment.map(({ key }) => key), ["HOST"]);
  assert.equal(JSON.stringify(comparison).includes("secret"), false);
});
