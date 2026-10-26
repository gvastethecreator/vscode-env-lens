import * as vscode from "vscode";
import type { ParsedEnvDocument } from "../core/model.ts";
import { parseEnv } from "../core/parser.ts";

export class EnvFileLimitError extends Error {
  constructor(readonly byteLength: number, readonly maximum: number) {
    super("The dotenv file exceeds the configured analysis limit.");
    this.name = "EnvFileLimitError";
  }
}

export interface TextSnapshot {
  readonly uri: vscode.Uri;
  readonly text: string;
  readonly byteLength: number;
  readonly source: "open" | "workspace";
  readonly version?: number;
  readonly bytes?: Uint8Array;
}

interface CachedDocument {
  readonly version: number;
  readonly parsed: ParsedEnvDocument;
}

function openDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  const key = uri.toString();
  return vscode.workspace.textDocuments.find((document) => document.uri.toString() === key);
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export class DocumentCache implements vscode.Disposable {
  private readonly cache = new Map<string, CachedDocument>();

  parse(document: vscode.TextDocument): ParsedEnvDocument {
    const key = document.uri.toString();
    const cached = this.cache.get(key);
    if (cached?.version === document.version) {
      return cached.parsed;
    }
    const parsed = parseEnv(document.getText());
    this.cache.set(key, { version: document.version, parsed });
    return parsed;
  }

  delete(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
  }

  clear(): void {
    this.cache.clear();
  }

  dispose(): void {
    this.clear();
  }
}

export async function readTextSnapshot(
  uri: vscode.Uri,
  maximumBytes: number,
): Promise<TextSnapshot> {
  const opened = openDocument(uri);
  if (opened) {
    const text = opened.getText();
    const byteLength = utf8Length(text);
    if (byteLength > maximumBytes) {
      throw new EnvFileLimitError(byteLength, maximumBytes);
    }
    return Object.freeze({
      uri,
      text,
      byteLength,
      source: "open",
      version: opened.version,
    });
  }

  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.size > maximumBytes) {
    throw new EnvFileLimitError(stat.size, maximumBytes);
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  if (bytes.byteLength > maximumBytes) {
    throw new EnvFileLimitError(bytes.byteLength, maximumBytes);
  }
  return Object.freeze({
    uri,
    text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
    byteLength: bytes.byteLength,
    source: "workspace",
    bytes,
  });
}

export async function isSnapshotCurrent(snapshot: TextSnapshot): Promise<boolean> {
  const opened = openDocument(snapshot.uri);
  if (opened) {
    if (snapshot.source === "open") {
      return opened.version === snapshot.version;
    }
    return opened.getText() === snapshot.text;
  }
  if (snapshot.source === "open" || !snapshot.bytes) {
    return false;
  }
  try {
    const current = await vscode.workspace.fs.readFile(snapshot.uri);
    return bytesEqual(current, snapshot.bytes);
  } catch {
    return false;
  }
}

export function offsetToPosition(text: string, offset: number): vscode.Position {
  let line = 0;
  let character = 0;
  const target = Math.max(0, Math.min(offset, text.length));
  for (let index = 0; index < target; index += 1) {
    if (text[index] === "\r") {
      if (text[index + 1] === "\n" && index + 1 < target) {
        index += 1;
      }
      line += 1;
      character = 0;
    } else if (text[index] === "\n") {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }
  return new vscode.Position(line, character);
}
