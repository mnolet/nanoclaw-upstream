#!/usr/bin/env bun
/**
 * `send-card` — send a structured card (interactive or display-only) to the
 * current conversation.
 *
 *   send-card --card '{"title":"Done","description":"green"}' [--fallbackText "..."]
 *
 * Use --card @file.json or --card @- for large payloads.
 *
 * Replaces mcp__nanoclaw__send_card.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagString, readRequiredJson, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `send-card: Send a structured card to the current conversation.

Usage:
  send-card --card JSON [--fallbackText TEXT]

Flags:
  --card JSON           Card structure (required). JSON object with title,
                        description, and optional children/actions.
                        Use --card @file.json or --card @- for big payloads.
  --fallbackText TEXT   Text shown on platforms without card support.
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['card', 'fallbackText']);
  const card = readRequiredJson<Record<string, unknown>>(args, 'card');
  const fallbackText = readFlagString(args, 'fallbackText') ?? '';

  const id = generateId();
  const routing = getSessionRouting();

  writeMessageOut({
    id,
    kind: 'chat-sdk',
    platform_id: routing.platform_id,
    channel_type: routing.channel_type,
    thread_id: routing.thread_id,
    content: JSON.stringify({ type: 'card', card, fallbackText }),
  });

  ok(`Card sent (id: ${id})`);
});
