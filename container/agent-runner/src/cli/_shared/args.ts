/**
 * Shared arg parsing for the bin/ tool surface.
 *
 * Convention (matches the JSON Schema of the original MCP tools):
 *   - Scalars (string, integer, number): `--flag value`
 *   - Arrays / objects: `--flag '<JSON literal>'`, or `--flag @path` to read
 *     from a file, or `--flag @-` to read from stdin.
 *   - Long strings (e.g. schedule_task --script): same `@path` / `@-` form
 *     accepted via readFlagString().
 *
 * Flag names mirror MCP property names verbatim (camelCase preserved) so the
 * agent's mental model is unchanged from the MCP surface.
 */
import fs from 'fs';

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string>;
}

/**
 * Validate that every flag and positional in the parsed args is recognized.
 * Throws on unknown flags or stray positionals so typos and forgotten flag
 * names become loud failures with a help hint instead of silent no-ops.
 */
export function validateArgs(args: ParsedArgs, known: readonly string[]): void {
  const knownSet = new Set(known);
  const unknown = Object.keys(args.flags).filter((k) => !knownSet.has(k));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown flag${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => '--' + u).join(', ')}`,
    );
  }
  if (args.positional.length > 0) {
    throw new Error(
      `Unexpected positional argument${args.positional.length > 1 ? 's' : ''}: ${args.positional
        .map((p) => JSON.stringify(p))
        .join(' ')}`,
    );
  }
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`flag --${key} requires a value`);
      flags[key] = next;
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

/**
 * Read a flag value as a string, resolving @path / @- to file/stdin contents.
 * A bare `@` is treated as a literal `@` (no resolution). Returns undefined
 * if the flag wasn't passed.
 */
export function readFlagString(args: ParsedArgs, name: string): string | undefined {
  const raw = args.flags[name];
  if (raw === undefined) return undefined;
  return resolveAtSyntax(raw);
}

/**
 * Read a required string flag. Throws if absent or empty.
 *
 * Empty rejection matches the original MCP handlers' `if (!text) return err(...)`
 * pattern. Tools that need empty-string semantics (e.g. update-task --recurrence
 * "" to clear a field) use readFlagString plus an explicit `'name' in args.flags`
 * check instead.
 */
export function readRequiredString(args: ParsedArgs, name: string): string {
  const v = readFlagString(args, name);
  if (v === undefined || v === '') throw new Error(`--${name} is required`);
  return v;
}

/**
 * Read a flag value as an integer. Returns undefined if absent. Throws if
 * present but unparsable.
 */
export function readFlagInt(args: ParsedArgs, name: string): number | undefined {
  const raw = args.flags[name];
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be an integer (got: ${raw})`);
  return n;
}

/**
 * Read a flag value as a number (float). Returns undefined if absent.
 */
export function readFlagNumber(args: ParsedArgs, name: string): number | undefined {
  const raw = args.flags[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number (got: ${raw})`);
  return n;
}

/**
 * Read a flag value as parsed JSON (for arrays and objects).
 * Supports inline JSON, @path (file), and @- (stdin).
 * Returns undefined if absent.
 */
export function readFlagJson<T = unknown>(args: ParsedArgs, name: string): T | undefined {
  const raw = args.flags[name];
  if (raw === undefined) return undefined;
  const text = resolveAtSyntax(raw);
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`--${name} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Read a required JSON flag. Throws if absent or null.
 */
export function readRequiredJson<T = unknown>(args: ParsedArgs, name: string): T {
  const v = readFlagJson<T>(args, name);
  if (v === undefined || v === null) throw new Error(`--${name} is required`);
  return v;
}

/**
 * Read a flag whose value is either a scalar (single string), inline JSON
 * array, or @file/@- — used for "string array" inputs where the schema
 * accepts an array but humans often pass a single value.
 *
 * Always returns string[] | undefined.
 */
export function readFlagStringArray(args: ParsedArgs, name: string): string[] | undefined {
  const raw = args.flags[name];
  if (raw === undefined) return undefined;
  const text = resolveAtSyntax(raw);
  // If the text starts with `[` treat it as JSON; otherwise split on newlines
  // (one item per line — common for @file inputs like items.txt).
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown[];
      if (!Array.isArray(parsed)) throw new Error('expected array');
      return parsed.map((x) => String(x));
    } catch (e) {
      throw new Error(`--${name} is not a valid JSON array: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Newline-separated list (or single value)
  return trimmed
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function resolveAtSyntax(raw: string): string {
  if (raw === '@-') {
    return fs.readFileSync(0, 'utf8'); // fd 0 = stdin
  }
  if (raw.startsWith('@') && raw.length > 1) {
    const filePath = raw.slice(1);
    return fs.readFileSync(filePath, 'utf8');
  }
  return raw;
}
