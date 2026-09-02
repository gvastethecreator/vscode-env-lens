import * as vscode from "vscode";
import { MAX_ENV_FILE_BYTES } from "../workspace/configuration.ts";
import { DocumentCache } from "../workspace/documentCache.ts";

export class EnvDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private readonly cache: DocumentCache) {}

  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    if (new TextEncoder().encode(document.getText()).byteLength > MAX_ENV_FILE_BYTES) {
      return [];
    }
    return this.cache.parse(document).entries.map((entry) => new vscode.DocumentSymbol(
      entry.key,
      "Environment key",
      vscode.SymbolKind.Variable,
      new vscode.Range(
        document.positionAt(entry.lineRange.start),
        document.positionAt(entry.lineRange.end),
      ),
      new vscode.Range(
        document.positionAt(entry.keyRange.start),
        document.positionAt(entry.keyRange.end),
      ),
    ));
  }
}
