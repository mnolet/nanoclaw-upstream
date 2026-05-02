#!/usr/bin/env bun
/**
 * `module` — print full instructions for a capability module.
 *
 *   module                # list available modules with their summary lines
 *   module <name>         # print /app/src/modules/<name>/instructions.md
 *
 * Modules an agent has access to are determined by the symlinks present in
 * /workspace/agent/.claude-fragments/. A symlink target ending in
 * /modules/<name>/summary.md exposes module <name>. Other fragments (legacy
 * always-on bodies) are listed but `module` won't have a body for them.
 *
 * Named `module` rather than `help` because `help` is a bash builtin that
 * would shadow any /usr/local/bin/help wrapper.
 */
import fs from 'fs';
import path from 'path';
import { initTool, ok, die, run } from './_shared/output.js';

initTool(import.meta.url);

const MODULES_ROOT = '/app/src/modules';
const FRAGMENTS_DIR = '/workspace/agent/.claude-fragments';

const HELP = `module: Print full instructions for a capability module.

Usage:
  module                Print the index of available modules.
  module <name>         Print /app/src/modules/<name>/instructions.md.

Modules are discovered from /workspace/agent/.claude-fragments/.
`;

function listAvailableModules(): string[] {
  if (!fs.existsSync(FRAGMENTS_DIR)) return [];
  const names = new Set<string>();
  for (const entry of fs.readdirSync(FRAGMENTS_DIR)) {
    if (!entry.startsWith('module-') || !entry.endsWith('.md')) continue;
    const link = path.join(FRAGMENTS_DIR, entry);
    let target: string;
    try {
      target = fs.readlinkSync(link);
    } catch {
      continue;
    }
    const m = target.match(/\/modules\/([^/]+)\/summary\.md$/);
    if (m) names.add(m[1]);
  }
  return Array.from(names).sort();
}

function moduleBodyPath(name: string): string {
  return path.join(MODULES_ROOT, name, 'instructions.md');
}

function moduleSummaryPath(name: string): string {
  return path.join(MODULES_ROOT, name, 'summary.md');
}

function firstLine(text: string): string {
  const trimmed = text.trim();
  const idx = trimmed.indexOf('\n');
  return idx === -1 ? trimmed : trimmed.slice(0, idx);
}

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    ok(HELP);
    return;
  }

  const available = listAvailableModules();

  if (argv.length === 0) {
    if (available.length === 0) {
      ok('No modules available.');
      return;
    }
    const lines = ['Available modules (run `module <name>` for full instructions):', ''];
    for (const name of available) {
      let headline = '';
      try {
        const body = fs.readFileSync(moduleSummaryPath(name), 'utf8');
        headline = firstLine(body).replace(/^#+\s*/, '');
      } catch {
        // Summary missing — still list the module name.
      }
      lines.push(headline ? `  ${name} — ${headline}` : `  ${name}`);
    }
    ok(lines.join('\n'));
    return;
  }

  if (argv.length > 1) {
    die('expected exactly one module name');
  }

  const name = argv[0];
  if (!available.includes(name)) {
    const list = available.length ? available.join(', ') : '(none)';
    die(`unknown module "${name}". Available: ${list}`);
  }

  const bodyPath = moduleBodyPath(name);
  if (!fs.existsSync(bodyPath)) {
    die(`module "${name}" is registered but has no body at ${bodyPath}`);
  }

  const body = fs.readFileSync(bodyPath, 'utf8');
  ok(body);
});
