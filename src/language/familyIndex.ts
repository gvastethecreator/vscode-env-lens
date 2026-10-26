import * as vscode from "vscode";
import { parseEnv } from "../core/parser.ts";
import { SecretSafeLogger } from "../logging/secretSafeLogger.ts";
import {
  MAX_ENV_FILE_BYTES,
  readSettings,
} from "../workspace/configuration.ts";
import {
  DocumentCache,
  EnvFileLimitError,
  offsetToPosition,
  readTextSnapshot,
} from "../workspace/documentCache.ts";
import {
  EnvFamilyResolver,
  type EnvFileDescriptor,
} from "../workspace/family.ts";
import { relativeUriLabel, sameUri } from "../workspace/uri.ts";

export interface FamilyKeyDefinition {
  readonly key: string;
  readonly uri: vscode.Uri;
  readonly range: vscode.Range;
  readonly origin: string;
}

export class FamilyKeyIndex {
  constructor(
    private readonly cache: DocumentCache,
    private readonly families: EnvFamilyResolver,
    private readonly logger: SecretSafeLogger,
  ) {}

  async build(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Promise<readonly FamilyKeyDefinition[]> {
    const settings = readSettings(document.uri);
    const definitions: FamilyKeyDefinition[] = [];
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const parsed = this.cache.parse(document);
    for (const entry of parsed.entries) {
      definitions.push(Object.freeze({
        key: entry.key,
        uri: document.uri,
        range: new vscode.Range(
          document.positionAt(entry.keyRange.start),
          document.positionAt(entry.keyRange.end),
        ),
        origin: relativeUriLabel(document.uri, workspaceFolder),
      }));
    }

    let family: readonly EnvFileDescriptor[];
    try {
      family = await this.families.familyFiles(document.uri, settings, token);
    } catch {
      this.logger.info("family.index.skipped", { fileLimit: false });
      return Object.freeze(definitions);
    }
    for (const file of family) {
      if (token.isCancellationRequested) {
        break;
      }
      try {
        if (sameUri(file.uri, document.uri)) {
          continue;
        }
        const snapshot = await readTextSnapshot(file.uri, MAX_ENV_FILE_BYTES);
        const parsed = parseEnv(snapshot.text);
        for (const entry of parsed.entries) {
          definitions.push(Object.freeze({
            key: entry.key,
            uri: file.uri,
            range: new vscode.Range(
              offsetToPosition(snapshot.text, entry.keyRange.start),
              offsetToPosition(snapshot.text, entry.keyRange.end),
            ),
            origin: relativeUriLabel(file.uri, file.workspaceFolder),
          }));
        }
      } catch (error) {
        this.logger.info("family.index.skipped", {
          fileLimit: error instanceof EnvFileLimitError,
        });
      }
    }
    return Object.freeze(definitions);
  }
}
