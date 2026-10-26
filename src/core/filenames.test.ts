import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyEnvFilename,
  isEnvBasename,
  isSafeExampleFilename,
} from "./filenames.ts";

test("classifies the supported env family names", () => {
  assert.deepEqual(classifyEnvFilename(".env"), { basename: ".env", role: "base" });
  assert.deepEqual(classifyEnvFilename(".env.example"), {
    basename: ".env.example",
    role: "example",
  });
  assert.deepEqual(classifyEnvFilename(".env.local"), {
    basename: ".env.local",
    role: "local",
  });
  assert.deepEqual(classifyEnvFilename(".env.production"), {
    basename: ".env.production",
    role: "environment",
    environment: "production",
  });
  assert.deepEqual(classifyEnvFilename(".env.production.local"), {
    basename: ".env.production.local",
    role: "environment-local",
    environment: "production",
  });
  assert.deepEqual(classifyEnvFilename("settings.env"), {
    basename: "settings.env",
    role: "unknown",
  });
});

test("validates env basenames without allowing paths", () => {
  assert.equal(isEnvBasename(".env.team"), true);
  assert.equal(isEnvBasename("env.team"), false);
  assert.equal(isSafeExampleFilename(".env.template"), true);
  assert.equal(isSafeExampleFilename(".env"), false);
  assert.equal(isSafeExampleFilename(".env."), false);
  assert.equal(isSafeExampleFilename("../.env.example"), false);
  assert.equal(isSafeExampleFilename("folder\\.env.example"), false);
  assert.equal(isSafeExampleFilename(".env/other"), false);
});

test("supports a configured example basename", () => {
  assert.deepEqual(classifyEnvFilename(".env.template", ".env.template"), {
    basename: ".env.template",
    role: "example",
  });
});
