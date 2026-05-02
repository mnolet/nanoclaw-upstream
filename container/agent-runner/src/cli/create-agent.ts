#!/usr/bin/env bun
/**
 * `create-agent` — create a long-lived companion sub-agent. Admin-only;
 * fire-and-forget.
 *
 *   create-agent --name "research-buddy" [--instructions @claude.md]
 *
 * The name becomes your destination for the new agent.
 *
 * Replaces mcp__nanoclaw__create_agent.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagString, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `create-agent: Create a long-lived companion sub-agent (admin-only).

Usage:
  create-agent --name NAME [--instructions TEXT]

Flags:
  --name NAME            Human-readable name. Becomes your destination for
                         this agent (required).
  --instructions TEXT    CLAUDE.md content for the new agent (personality,
                         role, instructions). Use @file.md or @- for long
                         multi-line content.

Fire-and-forget; admin approval required. You'll be notified when ready.
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['name', 'instructions']);
  const name = readRequiredString(args, 'name');
  const instructions = readFlagString(args, 'instructions') ?? null;

  const requestId = generateId();
  writeMessageOut({
    id: requestId,
    kind: 'system',
    content: JSON.stringify({
      action: 'create_agent',
      requestId,
      name,
      instructions,
    }),
  });

  ok(`Creating agent "${name}". You will be notified when it is ready.`);
});
