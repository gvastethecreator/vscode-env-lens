import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { parseEnv } from "../src/core/parser.ts";

function fixtureAtLeast(byteTarget) {
  const lines = [];
  let bytes = 0;
  for (let index = 0; bytes < byteTarget; index += 1) {
    const line = `KEY_${String(index).padStart(6, "0")}=synthetic-value-${index}\n`;
    lines.push(line);
    bytes += Buffer.byteLength(line);
  }
  return lines.join("");
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function benchmark(source, runs) {
  parseEnv(source);
  const durations = [];
  let entries = 0;
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    entries = parseEnv(source).entries.length;
    durations.push(performance.now() - started);
  }
  return { milliseconds: median(durations), entries };
}

const normalSource = fixtureAtLeast(8 * 1024);
const largeSource = fixtureAtLeast(1024 * 1024);
const normal = benchmark(normalSource, 7);
const large = benchmark(largeSource, 5);

assert.ok(normal.entries > 0);
assert.ok(large.entries > normal.entries);
assert.ok(normal.milliseconds < 10, `Normal fixture took ${normal.milliseconds.toFixed(1)} ms.`);
assert.ok(large.milliseconds < 100, `1 MiB fixture took ${large.milliseconds.toFixed(1)} ms.`);

console.log(JSON.stringify({
  normalBytes: Buffer.byteLength(normalSource),
  normalMilliseconds: Number(normal.milliseconds.toFixed(1)),
  largeBytes: Buffer.byteLength(largeSource),
  largeMilliseconds: Number(large.milliseconds.toFixed(1)),
  largeEntries: large.entries,
}));
