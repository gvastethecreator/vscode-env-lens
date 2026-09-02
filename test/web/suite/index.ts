import * as vscode from "vscode";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function code(diagnostic: vscode.Diagnostic): string {
  return typeof diagnostic.code === "object"
    ? String(diagnostic.code.value)
    : String(diagnostic.code);
}

async function waitForDiagnostics(
  uri: vscode.Uri,
  expected: string,
  timeout = 15000,
): Promise<readonly vscode.Diagnostic[]> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.some((diagnostic) => code(diagnostic) === expected)) {
      return diagnostics;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Web diagnostics timed out.");
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("gvastethecreator.env-lens");
  assert(extension, "ENV Lens was not discovered in the web host.");
  await extension.activate();
  assert(extension.isActive, "ENV Lens did not activate in the web host.");

  const folder = vscode.workspace.workspaceFolders?.[0];
  assert(folder, "The virtual test workspace did not open.");
  assert(folder.uri.scheme === "vscode-test-web", "The web test is not using a virtual filesystem.");
  const environmentUri = vscode.Uri.joinPath(folder.uri, ".env");
  const environment = await vscode.workspace.openTextDocument(environmentUri);
  await vscode.window.showTextDocument(environment, { preview: false });
  assert(environment.languageId === "dotenv", "The dotenv language was not assigned.");

  const diagnostics = await waitForDiagnostics(
    environment.uri,
    "env-lens/missing-from-example",
  );
  assert(diagnostics.some((diagnostic) => code(diagnostic) === "env-lens/duplicate-key"), "Duplicate diagnostic missing in web host.");
  assert(!JSON.stringify(diagnostics).includes("synthetic-local-value"), "A value leaked into web diagnostics.");

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    environment.uri,
  );
  assert(symbols.some(({ name }) => name === "BASE_URL"), "Document Symbols failed in web host.");

  const drift = diagnostics.find((diagnostic) => (
    code(diagnostic) === "env-lens/missing-from-example"
    && environment.getText(diagnostic.range) === "ONLY_ALPHA"
  ));
  assert(drift, "The web host did not report example drift.");
  const actions = await vscode.commands.executeCommand<(vscode.CodeAction | vscode.Command)[]>(
    "vscode.executeCodeActionProvider",
    environment.uri,
    drift.range,
    vscode.CodeActionKind.QuickFix.value,
  );
  const action = actions.find((candidate): candidate is vscode.CodeAction => (
    "command" in candidate
    && candidate.command?.command === "envLens.addMissingKeysToExample"
  ));
  assert(action?.command, "The web host did not return the safe example action.");
  await vscode.commands.executeCommand(
    action.command.command,
    ...(action.command.arguments ?? []),
  );

  const example = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, ".env.example"));
  assert(example.getText().includes("ONLY_ALPHA="), "The virtual example file was not updated.");
  assert(!example.getText().includes("synthetic-local-value"), "A value leaked into the virtual example file.");
}
