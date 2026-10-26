import * as vscode from "vscode";

function comparablePath(uri: vscode.Uri): string {
  return uri.scheme === "file" ? uri.path.toLowerCase() : uri.path;
}

export function uriBasename(uri: vscode.Uri): string {
  const path = uri.path.endsWith("/") ? uri.path.slice(0, -1) : uri.path;
  const separator = path.lastIndexOf("/");
  return path.slice(separator + 1);
}

export function uriDirectory(uri: vscode.Uri): vscode.Uri {
  const path = uri.path.endsWith("/") ? uri.path.slice(0, -1) : uri.path;
  const separator = path.lastIndexOf("/");
  return uri.with({ path: separator <= 0 ? "/" : path.slice(0, separator) });
}

export function sameUri(left: vscode.Uri, right: vscode.Uri): boolean {
  return left.scheme === right.scheme
    && left.authority === right.authority
    && comparablePath(left) === comparablePath(right)
    && left.query === right.query;
}

export function sameDirectory(left: vscode.Uri, right: vscode.Uri): boolean {
  return sameUri(uriDirectory(left), uriDirectory(right));
}

export function isUriInsideFolder(
  uri: vscode.Uri,
  folder: vscode.WorkspaceFolder,
): boolean {
  if (uri.scheme !== folder.uri.scheme || uri.authority !== folder.uri.authority) {
    return false;
  }
  const folderPath = comparablePath(folder.uri).replace(/\/$/, "");
  const resourcePath = comparablePath(uri);
  return resourcePath === folderPath || resourcePath.startsWith(`${folderPath}/`);
}

export function relativeUriLabel(
  uri: vscode.Uri,
  folder?: vscode.WorkspaceFolder,
): string {
  if (folder && isUriInsideFolder(uri, folder)) {
    const folderPath = folder.uri.path.replace(/\/$/, "");
    const resourcePath = uri.path;
    const relative = resourcePath.slice(folderPath.length).replace(/^\//, "");
    return relative || uriBasename(uri);
  }
  return uriBasename(uri);
}
