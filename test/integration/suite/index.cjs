const assert = require("node:assert/strict");
const vscode = require("vscode");

function diagnosticCode(diagnostic) {
  return typeof diagnostic.code === "object" ? diagnostic.code.value : String(diagnostic.code);
}

async function waitFor(label, predicate, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(label + " timed out.");
}

async function openEnv(folderName, basename) {
  const folder = vscode.workspace.workspaceFolders.find(({ name }) => name === folderName);
  assert.ok(folder, "Missing workspace folder: " + folderName);
  const uri = vscode.Uri.joinPath(folder.uri, basename);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false });
  return document;
}

async function diagnosticsFor(document, expectedCode) {
  return waitFor("ENV Lens diagnostics", () => {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    return diagnostics.some((diagnostic) => diagnosticCode(diagnostic) === expectedCode)
      ? diagnostics
      : undefined;
  });
}

async function verifyLanguageFeatures() {
  const content = "BASE_URL=\nREF=${BASE_URL}\n";
  const document = await vscode.workspace.openTextDocument({ language: "dotenv", content });
  await vscode.window.showTextDocument(document, { preview: false });

  const symbols = await vscode.commands.executeCommand(
    "vscode.executeDocumentSymbolProvider",
    document.uri,
  );
  assert.deepEqual(symbols.map(({ name }) => name), ["BASE_URL", "REF"]);

  const completionPosition = document.positionAt(content.indexOf("${BASE") + "${BASE".length);
  const completions = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    document.uri,
    completionPosition,
    "{",
  );
  assert.ok(completions.items.some((item) => item.label === "BASE_URL"));
  assert.equal(
    JSON.stringify(completions.items).includes("synthetic-local-value"),
    false,
    "Completions must not expose values.",
  );

  const definitionPosition = document.positionAt(content.lastIndexOf("BASE_URL") + 2);
  const definitions = await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    document.uri,
    definitionPosition,
  );
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].uri.toString(), document.uri.toString());
  assert.equal(document.getText(definitions[0].range), "BASE_URL");
}

async function verifySafeCodeAction(environment, diagnostics) {
  const drift = diagnostics.find((diagnostic) => (
    diagnosticCode(diagnostic) === "env-lens/missing-from-example"
    && environment.getText(diagnostic.range) === "ONLY_ALPHA"
  ));
  assert.ok(drift, "Missing example drift diagnostic for ONLY_ALPHA.");
  const actions = await vscode.commands.executeCommand(
    "vscode.executeCodeActionProvider",
    environment.uri,
    drift.range,
    vscode.CodeActionKind.QuickFix.value,
  );
  const action = actions.find(({ command }) => (
    command?.command === "envLens.addMissingKeysToExample"
  ));
  assert.ok(action?.command, "Missing safe example Code Action.");
  await vscode.commands.executeCommand(
    action.command.command,
    ...action.command.arguments,
  );

  const example = await openEnv("alpha", ".env.example");
  await waitFor("example edit", () => example.getText().includes("ONLY_ALPHA="));
  assert.equal(example.getText().includes("synthetic-local-value"), false);
  assert.equal(example.getText().endsWith("ONLY_ALPHA=\n"), true);
}

async function verifyBomAndCrlfMutation() {
  const folder = vscode.workspace.workspaceFolders.find(({ name }) => name === "alpha");
  assert.ok(folder);
  const directory = vscode.Uri.joinPath(folder.uri, "bom-family");
  const environmentUri = vscode.Uri.joinPath(directory, ".env");
  const exampleUri = vscode.Uri.joinPath(directory, ".env.example");
  await vscode.workspace.fs.createDirectory(directory);
  await vscode.workspace.fs.writeFile(
    environmentUri,
    new TextEncoder().encode("EXISTING=present\r\nNEW_BOM=synthetic-secret\r\n"),
  );
  await vscode.workspace.fs.writeFile(
    exampleUri,
    new TextEncoder().encode("\uFEFFEXISTING=\r\n"),
  );
  const environment = await vscode.workspace.openTextDocument(environmentUri);
  await vscode.commands.executeCommand(
    "envLens.addMissingKeysToExample",
    environment.uri,
    ["NEW_BOM"],
  );
  const example = await vscode.workspace.openTextDocument(exampleUri);
  const result = example.getText();
  assert.equal(result, "EXISTING=\r\nNEW_BOM=\r\n");
  assert.equal(result.includes("synthetic-secret"), false);
  await example.save();
  const bytes = await vscode.workspace.fs.readFile(exampleUri);
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(
    new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
    "\uFEFFEXISTING=\r\nNEW_BOM=\r\n",
  );
}

async function run() {
  const extension = vscode.extensions.getExtension("gvastethecreator.env-lens");
  assert.ok(extension, "ENV Lens was not discovered.");
  await extension.activate();
  assert.equal(extension.isActive, true);
  assert.equal(vscode.workspace.workspaceFolders?.length, 2);

  const commands = await vscode.commands.getCommands(true);
  for (const id of [
    "envLens.validateCurrentFile",
    "envLens.compareWithExample",
    "envLens.addMissingKeysToExample",
  ]) {
    assert.ok(commands.includes(id), "Missing command: " + id);
  }

  const environment = await openEnv("alpha", ".env");
  assert.equal(environment.languageId, "dotenv");
  const diagnostics = await diagnosticsFor(environment, "env-lens/missing-from-example");
  const codes = diagnostics.map(diagnosticCode);
  assert.ok(codes.includes("env-lens/duplicate-key"));
  assert.ok(codes.includes("env-lens/malformed-assignment"));
  assert.ok(codes.includes("env-lens/missing-from-environment"));
  assert.equal(new Set(diagnostics.map((diagnostic) => (
    `${diagnosticCode(diagnostic)}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`
  ))).size, diagnostics.length, "Diagnostics must not contain duplicates.");
  assert.equal(JSON.stringify(diagnostics).includes("synthetic-local-value"), false);

  const beta = await openEnv("beta", ".env");
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(
    JSON.stringify(vscode.languages.getDiagnostics(beta.uri)).includes("ONLY_ALPHA"),
    false,
    "Multi-root diagnostics crossed workspace folders.",
  );

  await verifyLanguageFeatures();
  await verifyBomAndCrlfMutation();
  await vscode.window.showTextDocument(environment, { preview: false });
  await verifySafeCodeAction(environment, diagnostics);

  await vscode.commands.executeCommand("envLens.compareWithExample", environment.uri);
  await vscode.commands.executeCommand("envLens.validateCurrentFile", environment.uri);
}

module.exports = { run };
