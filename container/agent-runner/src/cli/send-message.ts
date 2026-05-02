#!/usr/bin/env bun
/**
 * `send-message` — send a chat message to a named destination.
 *
 * Replaces the legacy `mcp__nanoclaw__send_message` tool. Same downstream
 * behavior: writes a chat row to outbound.db; the host delivery loop picks
 * it up.
 *
 *   send-message --text "hi" [--to family]
 *
 * If --to is omitted, the message goes to the session's current conversation.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagString, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';
import { resolveRouting } from './_shared/routing.js';

initTool(import.meta.url);

const HELP = `send-message: Send a chat message to a named destination.

Usage:
  send-message --text TEXT [--to NAME] [--continue]

Flags:
  --text TEXT  Message content (required). Special forms:
                 --text "literal body"
                 --text @path/to/file        read body from a file
                 --text @-                   read body from stdin
               The @-forms let you deliver content WITHOUT loading it
               into your own context. Pipe directly:
                 cat /workspace/agent/draft.md | send-message --to alice --text @-
                 grep error log.txt          | send-message --to oncall --text @-
  --to NAME    Destination name (e.g. "family", "worker-1"). If omitted,
               sends to the session's current conversation.
  --continue   Keep the turn open after sending. Without this flag,
               send-message terminates the turn after delivery (one
               inference round, send-and-stop). Pass --continue when
               you need to send a mid-turn update and keep working.
               Read by the host's PostToolUse hook, not by this script.
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  // `--continue` is a bare boolean read by the host's PostToolUse hook
  // off the raw Bash command — not by this script. Strip it here so the
  // strict key/value parser doesn't treat the next token as its value.
  const filteredArgv = argv.filter((a) => a !== '--continue');

  const args = parseArgs(filteredArgv);
  validateArgs(args, ['text', 'to']);
  const text = readRequiredString(args, 'text');
  const to = readFlagString(args, 'to');

  const routing = resolveRouting(to);

  const id = generateId();
  const seq = writeMessageOut({
    id,
    kind: 'chat',
    platform_id: routing.platform_id,
    channel_type: routing.channel_type,
    thread_id: routing.thread_id,
    content: JSON.stringify({ text }),
  });

  ok(`Message sent to ${routing.resolvedName} (id: ${seq})`);
});
