import * as vscode from "vscode";
import { DocumentCache } from "../workspace/documentCache.ts";
import { sameUri } from "../workspace/uri.ts";
import { FamilyKeyIndex } from "./familyIndex.ts";

export class EnvDefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private readonly cache: DocumentCache,
    private readonly index: FamilyKeyIndex,
  ) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Location | undefined> {
    const offset = document.offsetAt(position);
    const parsed = this.cache.parse(document);
    const reference = parsed.entries
      .flatMap((entry) => entry.references)
      .find(({ range }) => offset >= range.start && offset <= range.end);
    if (!reference) {
      return undefined;
    }
    const matches = (await this.index.build(document, token))
      .filter((definition) => definition.key === reference.key);
    const localMatches = matches.filter((definition) => sameUri(definition.uri, document.uri));
    const selected = localMatches.length === 1
      ? localMatches[0]
      : localMatches.length === 0 && matches.length === 1
        ? matches[0]
        : undefined;
    if (!selected) {
      return undefined;
    }
    return new vscode.Location(selected.uri, selected.range);
  }
}
