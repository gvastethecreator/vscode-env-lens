import type * as vscode from "vscode";
import { isEnvBasename } from "../core/filenames.ts";
import { uriBasename } from "../workspace/uri.ts";

export const DOTENV_LANGUAGE_ID = "dotenv";
export const DOTENV_SELECTOR: vscode.DocumentSelector = Object.freeze([
  Object.freeze({ language: DOTENV_LANGUAGE_ID }),
]);

export function isDotenvDocument(document: vscode.TextDocument): boolean {
  return document.languageId === DOTENV_LANGUAGE_ID || isEnvBasename(uriBasename(document.uri));
}
