export type EnvFileRole =
  | "base"
  | "example"
  | "local"
  | "environment"
  | "environment-local"
  | "unknown";

export interface EnvFilename {
  readonly basename: string;
  readonly role: EnvFileRole;
  readonly environment?: string;
}

export function isEnvBasename(basename: string): boolean {
  return basename === ".env" || basename.startsWith(".env.");
}

export function classifyEnvFilename(
  basename: string,
  exampleFile = ".env.example",
): EnvFilename {
  if (basename === exampleFile) {
    return Object.freeze({ basename, role: "example" });
  }
  if (basename === ".env") {
    return Object.freeze({ basename, role: "base" });
  }
  if (basename === ".env.local") {
    return Object.freeze({ basename, role: "local" });
  }
  const local = /^\.env\.([A-Za-z0-9_-]+)\.local$/.exec(basename);
  if (local) {
    return Object.freeze({ basename, role: "environment-local", environment: local[1] });
  }
  const environment = /^\.env\.([A-Za-z0-9_-]+)$/.exec(basename);
  if (environment) {
    return Object.freeze({ basename, role: "environment", environment: environment[1] });
  }
  return Object.freeze({ basename, role: "unknown" });
}

export function isSafeExampleFilename(value: string): boolean {
  return /^\.env(?:\.[A-Za-z0-9_-]+)+$/.test(value);
}
