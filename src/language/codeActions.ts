import * as vscode from "vscode";
import { isEnvKey } from "../core/model.ts";
import { COMMANDS } from "../commands.ts";
import { readSettings } from "../workspace/configuration.ts";
import { DIAGNOSTIC_CODES } from "./diagnostics.ts";

export class EnvCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = Object.freeze({
    providedCodeActionKinds: Object.freeze([vscode.CodeActionKind.QuickFix]),
  });

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const settings = readSettings(document.uri);
    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      if (String(diagnostic.code) !== DIAGNOSTIC_CODES.missingFromExample) {
        continue;
      }
      const key = document.getText(diagnostic.range);
      if (!isEnvKey(key)) {
        continue;
      }
      const action = new vscode.CodeAction(
        `Add "${key}" to ${settings.exampleFile}`,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      action.command = {
        command: COMMANDS.addMissingKeysToExample,
        title: `Add "${key}" to ${settings.exampleFile}`,
        arguments: [document.uri, [key]],
      };
      actions.push(action);
    }
    return actions;
  }
}
