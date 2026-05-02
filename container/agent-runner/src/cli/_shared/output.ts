/**
 * Output helpers for bin/ tools. All tools follow the same convention:
 *   - Success: print human-readable text to stdout, exit 0.
 *   - Failure: print message to stderr prefixed with the tool name, plus a
 *     "Run `<tool> --help` for usage." hint, exit 1.
 *   - --json (per tool): print JSON to stdout instead of text.
 *
 * Every successful or failed call is appended to /workspace/bin-tools.log —
 * one line per invocation, recording the raw argv and the outcome. Mirrors
 * the old /workspace/mcp-tools.log audit surface.
 */
import fs from 'fs';
import path from 'path';

const LOG_PATH = '/workspace/bin-tools.log';

let toolName: string | null = null;
let argvSnapshot: readonly string[] = [];

/**
 * Initialize the tool name and capture argv for logging. Pass
 * `import.meta.url` from the CLI script — the basename (minus .ts) becomes
 * the prefix and the log key.
 */
export function initTool(metaUrl: string): void {
  const file = metaUrl.replace(/^file:\/\//, '');
  toolName = path.basename(file, '.ts');
  argvSnapshot = process.argv.slice(2);
}

/**
 * Shell-style quoting: bare-word for plain tokens, JSON-quoted for anything
 * containing whitespace, quotes, or backslashes (or empty). The log line is
 * reversible — paste it after the tool name to re-invoke.
 */
function needsQuoting(s: string): boolean {
  if (s === '') return true;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // whitespace, " ' \\, or non-printable
    if (c <= 32 || c === 34 || c === 39 || c === 92 || c === 127) return true;
  }
  return false;
}

function formatArgv(argv: readonly string[]): string {
  return argv.map((a) => (needsQuoting(a) ? JSON.stringify(a) : a)).join(' ');
}

// Caps to keep log lines grep-friendly. Big payloads (e.g. a 50KB --card JSON
// blob) are truncated with an ellipsis; the full input is still in the
// session transcript if you need it verbatim.
const MAX_ARGV_LEN = 1024;
const MAX_SUMMARY_LEN = 500;

function logLine(level: 'ok' | 'err', summary: string): void {
  if (!toolName) return;
  let argvStr = formatArgv(argvSnapshot);
  if (argvStr.length > MAX_ARGV_LEN) {
    argvStr = argvStr.slice(0, MAX_ARGV_LEN) + '...';
  }
  // Single-line: collapse newlines/tabs in the summary so each call is one
  // grep-able line.
  const flatSummary = summary.replace(/[\r\n\t]+/g, ' ').slice(0, MAX_SUMMARY_LEN);
  const line = `${new Date().toISOString()} ${toolName}${argvStr ? ' ' + argvStr : ''} -> ${level}: ${flatSummary}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    // Best-effort: never let a logging failure fail the actual call.
  }
}

export function die(msg: string, exitCode = 1): never {
  const prefix = toolName ? `${toolName}: ` : '';
  process.stderr.write(`${prefix}${msg}\n`);
  if (toolName) {
    process.stderr.write(`Run \`${toolName} --help\` for usage.\n`);
  }
  logLine('err', msg);
  process.exit(exitCode);
}

export function ok(text: string): void {
  process.stdout.write(text);
  if (!text.endsWith('\n')) process.stdout.write('\n');
  logLine('ok', text);
}

export function okJson(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj));
  process.stdout.write('\n');
  logLine('ok', `(json) ${JSON.stringify(obj).slice(0, 200)}`);
}

/**
 * Log an outcome to bin-tools.log without writing to stdout. For tools
 * whose stdout format is consumed by deterministic callers (e.g. `task`
 * by skills/fires) and must stay exact — write to stdout yourself, then
 * call this for the audit line.
 */
export function logOnly(level: 'ok' | 'err', summary: string): void {
  logLine(level, summary);
}

/**
 * Wrap a synchronous main function with consistent error handling.
 */
export function run(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Wrap an async main function with consistent error handling.
 */
export async function runAsync(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
}
