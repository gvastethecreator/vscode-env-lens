import * as vscode from "vscode";

export type SafeLogFields = Readonly<Record<string, number | boolean>>;
export type SafeLogEvent =
  | "command.add-missing.failed"
  | "command.compare.failed"
  | "document.limit"
  | "document.validation.failed"
  | "family.document.limit"
  | "family.index.skipped"
  | "family.validation.failed";

function formatFields(fields: SafeLogFields): string {
  return Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

export class SecretSafeLogger implements vscode.Disposable {
  private readonly output = vscode.window.createOutputChannel("ENV Lens", { log: true });

  info(event: SafeLogEvent, fields: SafeLogFields = Object.freeze({})): void {
    const details = formatFields(fields);
    this.output.info(details ? `${event} ${details}` : event);
  }

  error(event: SafeLogEvent, fields: SafeLogFields = Object.freeze({})): void {
    const details = formatFields(fields);
    this.output.error(details ? `${event} ${details}` : event);
  }

  dispose(): void {
    this.output.dispose();
  }
}
