import * as vscode from "vscode";
import { COMMANDS } from "../commands.ts";
import { compareEnvDocuments } from "../core/compare.ts";
import { planMissingKeyInsertion } from "../core/edits.ts";
import { isEnvBasename } from "../core/filenames.ts";
import { isEnvKey } from "../core/model.ts";
import { parseEnv } from "../core/parser.ts";
import { DiagnosticsController } from "../language/diagnostics.ts";
import { isDotenvDocument } from "../language/selector.ts";
import { SecretSafeLogger } from "../logging/secretSafeLogger.ts";
import {
  MAX_ENV_FILE_BYTES,
  readSettings,
} from "../workspace/configuration.ts";
import {
  EnvFileLimitError,
  isSnapshotCurrent,
  offsetToPosition,
  readTextSnapshot,
  type TextSnapshot,
} from "../workspace/documentCache.ts";
import {
  EnvFamilyResolver,
  type ComparisonResolution,
  type EnvFileDescriptor,
} from "../workspace/family.ts";
import {
  isUriInsideFolder,
  relativeUriLabel,
  uriBasename,
  uriDirectory,
} from "../workspace/uri.ts";

interface EnvFilePick extends vscode.QuickPickItem {
  readonly file: EnvFileDescriptor;
}

function plural(count: number, singular: string, multiple = `${singular}s`): string {
  return count === 1 ? singular : multiple;
}

function findOpenDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  const key = uri.toString();
  return vscode.workspace.textDocuments.find((document) => document.uri.toString() === key);
}

async function resourceExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
      return false;
    }
    throw error;
  }
}

export class EnvCommandHandlers {
  constructor(
    private readonly diagnostics: DiagnosticsController,
    private readonly families: EnvFamilyResolver,
    private readonly logger: SecretSafeLogger,
  ) {}

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        COMMANDS.validateCurrentFile,
        (uri?: unknown) => this.validateCurrentFile(uri),
      ),
      vscode.commands.registerCommand(
        COMMANDS.compareWithExample,
        (uri?: unknown) => this.compareWithExample(uri),
      ),
      vscode.commands.registerCommand(
        COMMANDS.addMissingKeysToExample,
        (uri?: unknown, keys?: unknown) => this.addMissingKeysToExample(uri, keys),
      ),
    );
  }

  private async resolveDocument(argument?: unknown): Promise<vscode.TextDocument | undefined> {
    if (argument instanceof vscode.Uri) {
      return vscode.workspace.openTextDocument(argument);
    }
    return vscode.window.activeTextEditor?.document;
  }

  private async requireDocument(argument?: unknown): Promise<vscode.TextDocument | undefined> {
    const document = await this.resolveDocument(argument);
    if (!document) {
      void vscode.window.showErrorMessage("Open a dotenv file first.");
      return undefined;
    }
    if (!isDotenvDocument(document) && !isEnvBasename(uriBasename(document.uri))) {
      void vscode.window.showErrorMessage("The active editor is not a dotenv file.");
      return undefined;
    }
    const settings = readSettings(document.uri);
    if (!settings.exampleFileIsValid) {
      void vscode.window.showErrorMessage(
        "envLens.exampleFile must be a dotenv basename without path separators.",
      );
      return undefined;
    }
    return document;
  }

  private async selectCounterpart(
    resolution: ComparisonResolution,
  ): Promise<EnvFileDescriptor | undefined> {
    if (resolution.preferred) {
      return resolution.preferred;
    }
    if (resolution.candidates.length === 0) {
      return undefined;
    }
    const picks: EnvFilePick[] = resolution.candidates.map((file) => ({
      label: file.basename,
      description: file.workspaceFolder?.name,
      detail: relativeUriLabel(file.uri, file.workspaceFolder),
      file,
    }));
    return (await vscode.window.showQuickPick(picks, {
      placeHolder: resolution.targetRole === "example"
        ? "Select the example file to compare"
        : "Select the environment file to compare",
      matchOnDescription: true,
      matchOnDetail: true,
    }))?.file;
  }

  async validateCurrentFile(argument?: unknown): Promise<void> {
    const document = await this.requireDocument(argument);
    if (!document) {
      return;
    }
    if (!readSettings(document.uri).validationEnabled) {
      void vscode.window.showInformationMessage("ENV Lens validation is disabled for this file.");
      return;
    }
    const diagnostics = await this.diagnostics.refreshNow(document);
    const count = diagnostics.length;
    void vscode.window.showInformationMessage(
      count === 0
        ? `${uriBasename(document.uri)} has no ENV Lens problems.`
        : `${uriBasename(document.uri)} has ${count} ${plural(count, "problem")}.`,
    );
  }

  async compareWithExample(argument?: unknown): Promise<void> {
    const document = await this.requireDocument(argument);
    if (!document) {
      return;
    }
    try {
      const settings = readSettings(document.uri);
      const resolution = await this.families.comparison(document.uri, settings);
      const counterpart = await this.selectCounterpart(resolution);
      if (!counterpart) {
        if (resolution.candidates.length > 0) {
          return;
        }
        void vscode.window.showInformationMessage(
          resolution.targetRole === "example"
            ? `No ${settings.exampleFile} file was found for this dotenv file.`
            : "No environment file was found beside this example file.",
        );
        return;
      }
      const counterpartSnapshot = await readTextSnapshot(counterpart.uri, MAX_ENV_FILE_BYTES);
      const active = parseEnv(document.getText());
      const other = parseEnv(counterpartSnapshot.text);
      const comparison = resolution.active.role === "example"
        ? compareEnvDocuments(other, active)
        : compareEnvDocuments(active, other);
      const missingExample = comparison.missingFromExample.length;
      const missingEnvironment = comparison.missingFromEnvironment.length;
      void vscode.window.showInformationMessage(
        `${missingExample} ${plural(missingExample, "key")} missing from ${settings.exampleFile}; `
        + `${missingEnvironment} ${plural(missingEnvironment, "key")} missing from the environment file.`,
      );
    } catch (error) {
      if (error instanceof EnvFileLimitError) {
        void vscode.window.showErrorMessage("A related dotenv file exceeds the 2 MiB analysis limit.");
      } else {
        this.logger.error("command.compare.failed");
        void vscode.window.showErrorMessage("ENV Lens could not compare these files.");
      }
    }
  }

  private requestedKeys(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return Object.freeze(value.filter((key): key is string => (
      typeof key === "string" && isEnvKey(key)
    )));
  }

  private async confirmWrite(
    target: vscode.Uri,
    keyCount: number,
    create: boolean,
  ): Promise<boolean> {
    if (!create && keyCount === 1) {
      return true;
    }
    const action = create ? "Create and Add" : "Add Keys";
    const choice = await vscode.window.showWarningMessage(
      create
        ? `Create ${uriBasename(target)} and add ${keyCount} empty ${plural(keyCount, "key")}?`
        : `Add ${keyCount} empty ${plural(keyCount, "key")} to ${uriBasename(target)}?`,
      { modal: true },
      action,
    );
    return choice === action;
  }

  private async applyInsertion(
    target: vscode.Uri,
    snapshot: TextSnapshot | undefined,
    sourceSnapshot: TextSnapshot,
    keys: readonly string[],
    create: boolean,
  ): Promise<boolean> {
    const source = snapshot?.text ?? "";
    const plan = planMissingKeyInsertion(source, keys);
    if (plan.keys.length === 0) {
      return false;
    }
    if (!(await this.confirmWrite(target, plan.keys.length, create))) {
      return false;
    }
    if (!(await isSnapshotCurrent(sourceSnapshot))) {
      void vscode.window.showErrorMessage(
        `${uriBasename(sourceSnapshot.uri)} changed before the edit. Run the command again.`,
      );
      return false;
    }
    if (vscode.workspace.fs.isWritableFileSystem(target.scheme) === false) {
      void vscode.window.showErrorMessage("The selected filesystem is read-only.");
      return false;
    }
    if (snapshot && !(await isSnapshotCurrent(snapshot))) {
      void vscode.window.showErrorMessage(
        `${uriBasename(target)} changed before the edit. Run the command again.`,
      );
      return false;
    }
    if (create && await resourceExists(target)) {
      void vscode.window.showErrorMessage(
        `${uriBasename(target)} appeared before the edit. Run the command again.`,
      );
      return false;
    }
    const edit = new vscode.WorkspaceEdit();
    if (create) {
      edit.createFile(target, { ignoreIfExists: false, overwrite: false });
    }
    edit.insert(target, offsetToPosition(source, plan.offset), plan.text);
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      void vscode.window.showErrorMessage("VS Code could not apply the dotenv edit.");
      return false;
    }
    void vscode.window.showInformationMessage(
      `Added ${plan.keys.length} empty ${plural(plan.keys.length, "key")} to ${uriBasename(target)}.`,
    );
    return true;
  }

  async addMissingKeysToExample(argument?: unknown, requested?: unknown): Promise<void> {
    const document = await this.requireDocument(argument);
    if (!document) {
      return;
    }
    try {
      const settings = readSettings(document.uri);
      const resolution = await this.families.comparison(document.uri, settings);
      const requestedKeys = this.requestedKeys(requested);
      let sourceSnapshot: TextSnapshot;
      let targetSnapshot: TextSnapshot | undefined;
      let target: vscode.Uri;
      let create = false;

      if (resolution.active.role === "example") {
        const environment = await this.selectCounterpart(resolution);
        if (!environment) {
          if (resolution.candidates.length > 0) {
            return;
          }
          void vscode.window.showInformationMessage(
            "No environment file was found beside this example file.",
          );
          return;
        }
        sourceSnapshot = await readTextSnapshot(environment.uri, MAX_ENV_FILE_BYTES);
        target = document.uri;
        targetSnapshot = await readTextSnapshot(target, MAX_ENV_FILE_BYTES);
      } else {
        sourceSnapshot = await readTextSnapshot(document.uri, MAX_ENV_FILE_BYTES);
        const example = await this.selectCounterpart(resolution);
        if (example) {
          target = example.uri;
          targetSnapshot = await readTextSnapshot(target, MAX_ENV_FILE_BYTES);
        } else {
          if (resolution.candidates.length > 0) {
            return;
          }
          const folder = vscode.workspace.getWorkspaceFolder(document.uri);
          if (!folder) {
            void vscode.window.showErrorMessage(
              "ENV Lens will not create an example file outside a workspace folder.",
            );
            return;
          }
          target = vscode.Uri.joinPath(uriDirectory(document.uri), settings.exampleFile);
          if (!isUriInsideFolder(target, folder)) {
            void vscode.window.showErrorMessage(
              "ENV Lens will not create an example file outside the active workspace folder.",
            );
            return;
          }
          create = true;
        }
      }

      const sourceParsed = parseEnv(sourceSnapshot.text);
      const targetParsed = parseEnv(targetSnapshot?.text ?? "");
      const missing = compareEnvDocuments(sourceParsed, targetParsed).missingFromExample;
      const requestedSet = requestedKeys ? new Set(requestedKeys) : undefined;
      const keys = missing
        .map(({ key }) => key)
        .filter((key) => !requestedSet || requestedSet.has(key));
      if (keys.length === 0) {
        void vscode.window.showInformationMessage(
          `${uriBasename(target)} already contains the selected key names.`,
        );
        return;
      }
      if (!(await this.applyInsertion(target, targetSnapshot, sourceSnapshot, keys, create))) {
        return;
      }

      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      this.families.invalidate(folder);
      this.diagnostics.schedule(document);
      const targetDocument = findOpenDocument(target);
      if (targetDocument && targetDocument !== document) {
        this.diagnostics.schedule(targetDocument);
      }
    } catch (error) {
      if (error instanceof EnvFileLimitError) {
        void vscode.window.showErrorMessage("A related dotenv file exceeds the 2 MiB analysis limit.");
      } else {
        this.logger.error("command.add-missing.failed");
        void vscode.window.showErrorMessage("ENV Lens could not update the example file.");
      }
    }
  }
}
