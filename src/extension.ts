import * as vscode from "vscode";
import { EnvCommandHandlers } from "./commands/handlers.ts";
import { EnvCodeActionProvider } from "./language/codeActions.ts";
import { EnvCompletionProvider } from "./language/completion.ts";
import { EnvDefinitionProvider } from "./language/definition.ts";
import { DiagnosticsController } from "./language/diagnostics.ts";
import { FamilyKeyIndex } from "./language/familyIndex.ts";
import { DOTENV_SELECTOR } from "./language/selector.ts";
import { EnvDocumentSymbolProvider } from "./language/symbols.ts";
import { SecretSafeLogger } from "./logging/secretSafeLogger.ts";
import { DocumentCache } from "./workspace/documentCache.ts";
import { EnvFamilyResolver } from "./workspace/family.ts";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new SecretSafeLogger();
  const cache = new DocumentCache();
  const families = new EnvFamilyResolver();
  const diagnostics = new DiagnosticsController(cache, families, logger);
  const index = new FamilyKeyIndex(cache, families, logger);
  const commands = new EnvCommandHandlers(diagnostics, families, logger);

  context.subscriptions.push(
    logger,
    cache,
    families,
    diagnostics,
    vscode.languages.registerDocumentSymbolProvider(
      DOTENV_SELECTOR,
      new EnvDocumentSymbolProvider(cache),
    ),
    vscode.languages.registerCompletionItemProvider(
      DOTENV_SELECTOR,
      new EnvCompletionProvider(index),
      "{",
    ),
    vscode.languages.registerDefinitionProvider(
      DOTENV_SELECTOR,
      new EnvDefinitionProvider(cache, index),
    ),
    vscode.languages.registerCodeActionsProvider(
      DOTENV_SELECTOR,
      new EnvCodeActionProvider(),
      EnvCodeActionProvider.metadata,
    ),
  );
  commands.register(context);
}

export function deactivate(): void {}
