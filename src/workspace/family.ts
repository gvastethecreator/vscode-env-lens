import * as vscode from "vscode";
import {
  classifyEnvFilename,
  type EnvFileRole,
} from "../core/filenames.ts";
import {
  MAX_FAMILY_CANDIDATES,
  type EnvLensSettings,
} from "./configuration.ts";
import {
  sameDirectory,
  sameUri,
  uriBasename,
  uriDirectory,
} from "./uri.ts";

export interface EnvFileDescriptor {
  readonly uri: vscode.Uri;
  readonly workspaceFolder?: vscode.WorkspaceFolder;
  readonly basename: string;
  readonly role: EnvFileRole;
  readonly environment?: string;
}

export interface ComparisonResolution {
  readonly active: EnvFileDescriptor;
  readonly candidates: readonly EnvFileDescriptor[];
  readonly preferred?: EnvFileDescriptor;
  readonly targetRole: "environment" | "example";
}

interface DiscoveryCache {
  readonly signature: string;
  readonly generation: number;
  readonly files: readonly EnvFileDescriptor[];
}

function descriptor(
  uri: vscode.Uri,
  folder: vscode.WorkspaceFolder | undefined,
  exampleFile: string,
): EnvFileDescriptor {
  const basename = uriBasename(uri);
  const classified = classifyEnvFilename(basename, exampleFile);
  return Object.freeze({
    uri,
    workspaceFolder: folder,
    basename,
    role: classified.role,
    environment: classified.environment,
  });
}

function combinedGlob(patterns: readonly string[]): string | undefined {
  if (patterns.length === 0) {
    return undefined;
  }
  return patterns.length === 1 ? patterns[0] : `{${patterns.join(",")}}`;
}

function directoryPath(uri: vscode.Uri): string {
  const path = uriDirectory(uri).path.replace(/\/$/, "");
  return uri.scheme === "file" ? path.toLowerCase() : path;
}

function ancestorDistance(active: vscode.Uri, candidate: vscode.Uri): number | undefined {
  if (active.scheme !== candidate.scheme || active.authority !== candidate.authority) {
    return undefined;
  }
  const activePath = directoryPath(active);
  const candidatePath = directoryPath(candidate);
  if (activePath === candidatePath) {
    return 0;
  }
  if (!activePath.startsWith(`${candidatePath}/`)) {
    return undefined;
  }
  return activePath.slice(candidatePath.length + 1).split("/").length;
}

function stableFiles(files: readonly EnvFileDescriptor[]): readonly EnvFileDescriptor[] {
  return Object.freeze([...files].sort((left, right) => (
    left.uri.toString().localeCompare(right.uri.toString())
  )));
}

async function existingDescriptor(
  uri: vscode.Uri,
  folder: vscode.WorkspaceFolder,
  exampleFile: string,
): Promise<EnvFileDescriptor | undefined> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if ((stat.type & vscode.FileType.File) === 0) {
      return undefined;
    }
    return descriptor(uri, folder, exampleFile);
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
      return undefined;
    }
    throw error;
  }
}

function withFile(
  files: readonly EnvFileDescriptor[],
  file: EnvFileDescriptor | undefined,
): readonly EnvFileDescriptor[] {
  if (!file || files.some((candidate) => sameUri(candidate.uri, file.uri))) {
    return files;
  }
  return Object.freeze([...files, file]);
}

export class EnvFamilyResolver implements vscode.Disposable {
  private readonly cache = new Map<string, DiscoveryCache>();
  private readonly pending = new Map<string, Promise<readonly EnvFileDescriptor[]>>();
  private readonly generations = new Map<string, number>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly invalidationEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();

  readonly onDidInvalidate = this.invalidationEmitter.event;

  constructor() {
    const watcher = vscode.workspace.createFileSystemWatcher("**/.env*");
    this.disposables.push(
      watcher,
      watcher.onDidCreate((uri) => this.invalidateUri(uri)),
      watcher.onDidChange((uri) => this.invalidateUri(uri)),
      watcher.onDidDelete((uri) => this.invalidateUri(uri)),
    );
  }

  private invalidateUri(uri: vscode.Uri): void {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    this.invalidate(folder);
    this.invalidationEmitter.fire(uri);
  }

  invalidate(folder?: vscode.WorkspaceFolder): void {
    if (!folder) {
      this.cache.clear();
      this.pending.clear();
      for (const key of this.generations.keys()) {
        this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
      }
      this.invalidationEmitter.fire(undefined);
      return;
    }
    const key = folder.uri.toString();
    this.cache.delete(key);
    for (const pendingKey of this.pending.keys()) {
      if (pendingKey.startsWith(`${key}\u0000`)) {
        this.pending.delete(pendingKey);
      }
    }
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
  }

  private async discoverUncached(
    folder: vscode.WorkspaceFolder,
    settings: EnvLensSettings,
    generation: number,
    token?: vscode.CancellationToken,
  ): Promise<readonly EnvFileDescriptor[]> {
    const found = new Map<string, EnvFileDescriptor>();
    const exclude = combinedGlob(settings.excludes);
    for (const include of settings.includes) {
      if (token?.isCancellationRequested || found.size >= MAX_FAMILY_CANDIDATES) {
        break;
      }
      const uris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, include),
        exclude,
        MAX_FAMILY_CANDIDATES - found.size,
        token,
      );
      for (const uri of uris) {
        const file = descriptor(uri, folder, settings.exampleFile);
        if (file.role !== "unknown") {
          found.set(uri.toString(), file);
        }
      }
    }
    const files = stableFiles([...found.values()]);
    const key = folder.uri.toString();
    if ((this.generations.get(key) ?? 0) === generation && !token?.isCancellationRequested) {
      this.cache.set(key, { signature: settings.signature, generation, files });
    }
    return files;
  }

  async discover(
    folder: vscode.WorkspaceFolder,
    settings: EnvLensSettings,
    token?: vscode.CancellationToken,
  ): Promise<readonly EnvFileDescriptor[]> {
    const key = folder.uri.toString();
    const requestKey = `${key}\u0000${settings.signature}`;
    const generation = this.generations.get(key) ?? 0;
    const cached = this.cache.get(key);
    if (
      cached?.signature === settings.signature
      && cached.generation === generation
      && !token?.isCancellationRequested
    ) {
      return cached.files;
    }
    const active = this.pending.get(requestKey);
    if (active) {
      return active;
    }
    const request = this.discoverUncached(folder, settings, generation, token)
      .finally(() => {
        if (this.pending.get(requestKey) === request) {
          this.pending.delete(requestKey);
        }
      });
    this.pending.set(requestKey, request);
    return request;
  }

  async comparison(
    activeUri: vscode.Uri,
    settings: EnvLensSettings,
    token?: vscode.CancellationToken,
  ): Promise<ComparisonResolution> {
    const folder = vscode.workspace.getWorkspaceFolder(activeUri);
    const active = descriptor(activeUri, folder, settings.exampleFile);
    if (!folder) {
      return Object.freeze({ active, candidates: Object.freeze([]), targetRole: "example" });
    }
    const files = await this.discover(folder, settings, token);
    if (active.role === "example") {
      const exactBase = await existingDescriptor(
        vscode.Uri.joinPath(uriDirectory(activeUri), ".env"),
        folder,
        settings.exampleFile,
      );
      const candidates = stableFiles(withFile(files, exactBase).filter((file) => (
        file.role !== "example"
        && file.role !== "unknown"
        && sameDirectory(file.uri, activeUri)
      )));
      const base = candidates.filter((file) => file.role === "base");
      const preferred = base.length === 1
        ? base[0]
        : candidates.length === 1
          ? candidates[0]
          : undefined;
      return Object.freeze({
        active,
        candidates,
        preferred,
        targetRole: "environment",
      });
    }

    const exactExample = await existingDescriptor(
      vscode.Uri.joinPath(uriDirectory(activeUri), settings.exampleFile),
      folder,
      settings.exampleFile,
    );
    const candidates = stableFiles(withFile(files, exactExample).filter((file) => (
      file.role === "example"
    )));
    const ranked = candidates
      .map((file) => ({ file, distance: ancestorDistance(activeUri, file.uri) }))
      .filter((item): item is { file: EnvFileDescriptor; distance: number } => (
        item.distance !== undefined
      ))
      .sort((left, right) => left.distance - right.distance);
    const preferred = ranked[0]?.file ?? (candidates.length === 1 ? candidates[0] : undefined);
    return Object.freeze({
      active,
      candidates,
      preferred,
      targetRole: "example",
    });
  }

  async familyFiles(
    activeUri: vscode.Uri,
    settings: EnvLensSettings,
    token?: vscode.CancellationToken,
  ): Promise<readonly EnvFileDescriptor[]> {
    const folder = vscode.workspace.getWorkspaceFolder(activeUri);
    const active = descriptor(activeUri, folder, settings.exampleFile);
    if (!folder) {
      return Object.freeze([active]);
    }
    const discovered = await this.discover(folder, settings, token);
    const files = discovered.filter((file) => sameDirectory(file.uri, activeUri));
    if (!files.some((file) => sameUri(file.uri, activeUri))) {
      files.unshift(active);
    }
    return Object.freeze([
      active,
      ...stableFiles(files.filter((file) => !sameUri(file.uri, activeUri))),
    ]);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.invalidationEmitter.dispose();
    this.cache.clear();
    this.pending.clear();
  }
}
