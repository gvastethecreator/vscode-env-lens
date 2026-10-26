import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import oniguruma from "vscode-oniguruma";
import textmate from "vscode-textmate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const grammarPath = path.join(root, "syntaxes", "dotenv.tmLanguage.json");
const grammarSource = await readFile(grammarPath, "utf8");
const grammarDefinition = textmate.parseRawGrammar(grammarSource, grammarPath);
const wasmPath = fileURLToPath(import.meta.resolve("vscode-oniguruma/release/onig.wasm"));
const wasm = await readFile(wasmPath);
await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

const registry = new textmate.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
    createOnigString: (source) => new oniguruma.OnigString(source),
  }),
  loadGrammar: async (scopeName) => scopeName === "source.dotenv" ? grammarDefinition : null,
});
const grammar = await registry.loadGrammar("source.dotenv");
assert.ok(grammar, "The dotenv grammar did not load.");

const themes = [
  {
    name: "light",
    settings: [
      { settings: { foreground: "202124", background: "ffffff" } },
      { scope: "comment", settings: { foreground: "5f6368" } },
    ],
  },
  {
    name: "dark",
    settings: [
      { settings: { foreground: "d8dee9", background: "101318" } },
      { scope: "comment", settings: { foreground: "7f8c98" } },
    ],
  },
];

for (const theme of themes) {
  registry.setTheme({ name: theme.name, settings: theme.settings });
  assertScopes('# comment', ["comment.line.number-sign.dotenv"]);
  assertScopes('export API_URL="${BASE_URL}/v1"', [
    "storage.modifier.export.dotenv",
    "variable.other.env.dotenv",
    "keyword.operator.assignment.dotenv",
    "string.quoted.double.dotenv",
    "variable.other.readwrite.env.dotenv",
  ]);
  assertScopes("LITERAL='${BASE_URL}'", [
    "variable.other.env.dotenv",
    "string.quoted.single.dotenv",
  ], ["variable.other.readwrite.env.dotenv"]);
  assertScopes("1INVALID=value", ["invalid.illegal.key.dotenv"]);
}

console.log("Grammar checks passed in light and dark theme scopes.");

function assertScopes(line, expected, forbidden = []) {
  const scopes = grammar.tokenizeLine(line).tokens.flatMap((token) => token.scopes);
  for (const scope of expected) {
    assert.ok(scopes.includes(scope), `${JSON.stringify(line)} is missing scope ${scope}.`);
  }
  for (const scope of forbidden) {
    assert.ok(!scopes.includes(scope), `${JSON.stringify(line)} must not use scope ${scope}.`);
  }
}
