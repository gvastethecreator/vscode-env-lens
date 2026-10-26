import * as vscode from "vscode";
import { FamilyKeyIndex } from "./familyIndex.ts";

export class EnvCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly index: FamilyKeyIndex) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): Promise<vscode.CompletionItem[]> {
    const prefix = document.lineAt(position).text.slice(0, position.character);
    const reference = /\$\{([A-Za-z_][A-Za-z0-9_]*)?$/.exec(prefix);
    if (!reference) {
      return [];
    }
    const partial = reference[1] ?? "";
    const replaceRange = new vscode.Range(
      position.translate(0, -partial.length),
      position,
    );
    const definitions = await this.index.build(document, token);
    const seen = new Set<string>();
    const items: vscode.CompletionItem[] = [];
    for (const definition of definitions) {
      if (seen.has(definition.key)) {
        continue;
      }
      seen.add(definition.key);
      const item = new vscode.CompletionItem(definition.key, vscode.CompletionItemKind.Variable);
      item.detail = `Defined in ${definition.origin}`;
      item.documentation = "ENV Lens completes key names without exposing dotenv values.";
      item.insertText = definition.key;
      item.filterText = definition.key;
      item.sortText = definition.key;
      item.range = replaceRange;
      items.push(item);
    }
    return items;
  }
}
