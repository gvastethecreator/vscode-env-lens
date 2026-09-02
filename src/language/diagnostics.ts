import * as vscode from "vscode";
import { compareEnvDocuments } from "../core/compare.ts";
import { problemMessage } from "../core/messages.ts";
import type {
  EnvParseProblem,
  ParsedEnvDocument,
  SourceRange,
} from "../core/model.ts";
import { parseEnv } from "../core/parser.ts";
import { SecretSafeLogger } from "../logging/secretSafeLogger.ts";
import {
  DIAGNOSTIC_DEBOUNCE_MS,
  MAX_ENV_FILE_BYTES,
  readSettings,
} from "../workspace/configuration.ts";
import {
  DocumentCache,
  EnvFileLimitError,
  readTextSnapshot,
} from "../workspace/documentCache.ts";
import { EnvFamilyResolver } from "../workspace/family.ts";
import { isDotenvDocument } from "./selector.ts";

export const DIAGNOSTIC_CODES = Object.freeze({
  ambiguousFamily: "env-lens/ambiguous-family",
  fileTooLarge: "env-lens/file-too-large",
  invalidConfiguration: "env-lens/invalid-configuration",
  missingFromEnvironment: "env-lens/missing-from-environment",
  missingFromExample: "env-lens/missing-from-example",
  validationFailed: "env-lens/validation-failed",
});

function sourceRange(document: vscode.TextDocument, range: SourceRange): vscode.Range {
  return new vscode.Range(document.positionAt(range.start), document.positionAt(range.end));
}

function severity(problem: EnvParseProblem): vscode.DiagnosticSeverity {
  switch (problem.code) {
    case "env-lens/invalid-key":
    case "env-lens/malformed-assignment":
    case "env-lens/unterminated-quote":
      return vscode.DiagnosticSeverity.Error;
    case "env-lens/duplicate-key":
    case "env-lens/unresolved-reference":
    case "env-lens/self-reference":
      return vscode.DiagnosticSeverity.Warning;
  }
}

function createDiagnostic(
  range: vscode.Range,
  message: string,
  diagnosticSeverity: vscode.DiagnosticSeverity,
  code: string,
): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(range, message, diagnosticSeverity);
  diagnostic.code = code;
  diagnostic.source = "ENV Lens";
  return diagnostic;
}

function startRange(document: vscode.TextDocument): vscode.Range {
  const start = new vscode.Position(0, 0);
  if (document.lineCount === 0 || document.lineAt(0).text.length === 0) {
    return new vscode.Range(start, start);
  }
  return new vscode.Range(start, new vscode.Position(0, 1));
}

function deduplicateAndSort(diagnostics: readonly vscode.Diagnostic[]): readonly vscode.Diagnostic[] {
  const seen = new Set<string>();
  return Object.freeze([...diagnostics]
    .sort((left, right) => (
      left.range.start.compareTo(right.range.start)
      || left.range.end.compareTo(right.range.end)
      || String(left.code).localeCompare(String(right.code))
      || left.message.localeCompare(right.message)
    ))
    .filter((diagnostic) => {
      const key = [
        diagnostic.range.start.line,
        diagnostic.range.start.character,
        diagnostic.range.end.line,
        diagnostic.range.end.character,
        String(diagnostic.code),
        diagnostic.message,
      ].join(":");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }));
}

export class DiagnosticsController implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("env-lens");
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly runs = new Map<string, vscode.CancellationTokenSource>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly cache: DocumentCache,
    private readonly families: EnvFamilyResolver,
    private readonly logger: SecretSafeLogger,
  ) {
    this.disposables.push(
      this.collection,
      vscode.workspace.onDidOpenTextDocument((document) => this.schedule(document)),
      vscode.workspace.onDidChangeTextDocument(({ document }) => this.schedule(document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.close(document)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration("envLens")) {
          return;
        }
        this.families.invalidate();
        this.scheduleOpenDocuments();
      }),
      this.families.onDidInvalidate((uri) => this.scheduleAffectedDocuments(uri)),
    );
    this.scheduleOpenDocuments();
  }

  private scheduleOpenDocuments(): void {
    for (const document of vscode.workspace.textDocuments) {
      this.schedule(document);
    }
  }

  private scheduleAffectedDocuments(uri: vscode.Uri | undefined): void {
    if (!uri) {
      this.scheduleOpenDocuments();
      return;
    }
    const affectedFolder = vscode.workspace.getWorkspaceFolder(uri)?.uri.toString();
    for (const document of vscode.workspace.textDocuments) {
      if (vscode.workspace.getWorkspaceFolder(document.uri)?.uri.toString() === affectedFolder) {
        this.schedule(document);
      }
    }
  }

  schedule(document: vscode.TextDocument): void {
    if (!isDotenvDocument(document)) {
      return;
    }
    const key = document.uri.toString();
    const current = this.timers.get(key);
    if (current) {
      clearTimeout(current);
    }
    this.runs.get(key)?.cancel();
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      void this.refreshNow(document);
    }, DIAGNOSTIC_DEBOUNCE_MS));
  }

  private close(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.runs.get(key)?.cancel();
    this.runs.get(key)?.dispose();
    this.runs.delete(key);
    this.cache.delete(document.uri);
    this.collection.delete(document.uri);
  }

  private localDiagnostics(
    document: vscode.TextDocument,
    parsed: ParsedEnvDocument,
    unresolvedReferences: boolean,
  ): vscode.Diagnostic[] {
    return parsed.errors
      .filter((problem) => unresolvedReferences || (
        problem.code !== "env-lens/unresolved-reference"
        && problem.code !== "env-lens/self-reference"
      ))
      .map((problem) => createDiagnostic(
        sourceRange(document, problem.range),
        problemMessage(problem),
        severity(problem),
        problem.code,
      ));
  }

  private async driftDiagnostics(
    document: vscode.TextDocument,
    parsed: ParsedEnvDocument,
    token: vscode.CancellationToken,
  ): Promise<readonly vscode.Diagnostic[]> {
    const settings = readSettings(document.uri);
    const resolution = await this.families.comparison(document.uri, settings, token);
    if (token.isCancellationRequested) {
      return Object.freeze([]);
    }
    if (!resolution.preferred) {
      if (resolution.candidates.length > 1) {
        return Object.freeze([createDiagnostic(
          startRange(document),
          "More than one related dotenv file matches. Use Compare with Example to choose one.",
          vscode.DiagnosticSeverity.Information,
          DIAGNOSTIC_CODES.ambiguousFamily,
        )]);
      }
      return Object.freeze([]);
    }

    const snapshot = await readTextSnapshot(resolution.preferred.uri, MAX_ENV_FILE_BYTES);
    const counterpart = parseEnv(snapshot.text);
    const activeIsExample = resolution.active.role === "example";
    const comparison = activeIsExample
      ? compareEnvDocuments(counterpart, parsed)
      : compareEnvDocuments(parsed, counterpart);
    const diagnostics: vscode.Diagnostic[] = [];
    for (const difference of comparison.missingFromExample) {
      diagnostics.push(createDiagnostic(
        activeIsExample ? startRange(document) : sourceRange(document, difference.range),
        `Key "${difference.key}" is missing from ${settings.exampleFile}.`,
        vscode.DiagnosticSeverity.Warning,
        DIAGNOSTIC_CODES.missingFromExample,
      ));
    }
    for (const difference of comparison.missingFromEnvironment) {
      diagnostics.push(createDiagnostic(
        activeIsExample ? sourceRange(document, difference.range) : startRange(document),
        `Key "${difference.key}" is missing from the selected environment file.`,
        vscode.DiagnosticSeverity.Information,
        DIAGNOSTIC_CODES.missingFromEnvironment,
      ));
    }
    return Object.freeze(diagnostics);
  }

  async refreshNow(document: vscode.TextDocument): Promise<readonly vscode.Diagnostic[]> {
    const key = document.uri.toString();
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    const previous = this.runs.get(key);
    previous?.cancel();
    previous?.dispose();
    const run = new vscode.CancellationTokenSource();
    this.runs.set(key, run);
    const expectedVersion = document.version;

    try {
      const settings = readSettings(document.uri);
      if (!settings.validationEnabled || !isDotenvDocument(document)) {
        this.collection.delete(document.uri);
        return Object.freeze([]);
      }

      const diagnostics: vscode.Diagnostic[] = [];
      if (!settings.exampleFileIsValid) {
        diagnostics.push(createDiagnostic(
          startRange(document),
          "envLens.exampleFile must be a dotenv basename without path separators.",
          vscode.DiagnosticSeverity.Error,
          DIAGNOSTIC_CODES.invalidConfiguration,
        ));
      }
      const byteLength = new TextEncoder().encode(document.getText()).byteLength;
      if (byteLength > MAX_ENV_FILE_BYTES) {
        diagnostics.push(createDiagnostic(
          startRange(document),
          "This file is larger than the 2 MiB analysis limit.",
          vscode.DiagnosticSeverity.Information,
          DIAGNOSTIC_CODES.fileTooLarge,
        ));
        this.logger.info("document.limit", { byteLength });
      } else {
        const parsed = this.cache.parse(document);
        diagnostics.push(...this.localDiagnostics(
          document,
          parsed,
          settings.unresolvedReferences,
        ));
        if (settings.exampleDrift && settings.exampleFileIsValid) {
          try {
            diagnostics.push(...await this.driftDiagnostics(document, parsed, run.token));
          } catch (error) {
            if (error instanceof EnvFileLimitError) {
              diagnostics.push(createDiagnostic(
                startRange(document),
                "The related dotenv file is larger than the 2 MiB analysis limit.",
                vscode.DiagnosticSeverity.Information,
                DIAGNOSTIC_CODES.fileTooLarge,
              ));
              this.logger.info("family.document.limit", { byteLength: error.byteLength });
            } else {
              diagnostics.push(createDiagnostic(
                startRange(document),
                "ENV Lens could not validate the related dotenv file.",
                vscode.DiagnosticSeverity.Information,
                DIAGNOSTIC_CODES.validationFailed,
              ));
              this.logger.error("family.validation.failed");
            }
          }
        }
      }

      if (
        run.token.isCancellationRequested
        || document.version !== expectedVersion
        || this.runs.get(key) !== run
      ) {
        return Object.freeze([]);
      }
      const result = deduplicateAndSort(diagnostics);
      this.collection.set(document.uri, result);
      return result;
    } catch {
      if (!run.token.isCancellationRequested && this.runs.get(key) === run) {
        const diagnostic = createDiagnostic(
          startRange(document),
          "ENV Lens could not validate this file.",
          vscode.DiagnosticSeverity.Information,
          DIAGNOSTIC_CODES.validationFailed,
        );
        this.collection.set(document.uri, [diagnostic]);
        this.logger.error("document.validation.failed");
        return Object.freeze([diagnostic]);
      }
      return Object.freeze([]);
    } finally {
      if (this.runs.get(key) === run) {
        this.runs.delete(key);
      }
      run.dispose();
    }
  }

  get(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.collection.get(uri) ?? Object.freeze([]);
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    for (const run of this.runs.values()) {
      run.cancel();
      run.dispose();
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.timers.clear();
    this.runs.clear();
  }
}
