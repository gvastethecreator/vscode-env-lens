import type { EnvParseProblem } from "./model.ts";

export function problemMessage(problem: EnvParseProblem): string {
  switch (problem.code) {
    case "env-lens/invalid-key":
      return problem.key
        ? `Key "${problem.key}" does not match the supported key grammar.`
        : "The key name is empty.";
    case "env-lens/malformed-assignment":
      return problem.key
        ? `The assignment for key "${problem.key}" has unsupported trailing text.`
        : "Expected a KEY=value assignment.";
    case "env-lens/unterminated-quote":
      return problem.key
        ? `The quoted value for key "${problem.key}" is not terminated.`
        : "The quoted value is not terminated.";
    case "env-lens/duplicate-key":
      return `Key "${problem.key ?? ""}" is defined more than once.`;
    case "env-lens/unresolved-reference":
      return `Reference "${problem.key ?? ""}" has no definition in this file.`;
    case "env-lens/self-reference":
      return `Key "${problem.key ?? ""}" directly references itself.`;
  }
}
