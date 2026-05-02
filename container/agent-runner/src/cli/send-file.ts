#!/usr/bin/env bun
/**
 * `send-file` — send a file to a named destination.
 *
 *   send-file --path /workspace/agent/foo.png [--to NAME] [--text MSG] [--filename DISPLAY]
 *
 * Replaces the legacy mcp__nanoclaw__send_file tool. Same downstream behavior:
 * copies the file into /workspace/outbox/<id>/ and writes a chat row to
 * outbound.db.
 */
import fs from 'fs';
import path from 'path';

import { writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagString, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';
import { resolveRouting } from './_shared/routing.js';

initTool(import.meta.url);

const HELP = `send-file: Send a file to a named destination.

Usage:
  send-file --path PATH [--to NAME] [--text MSG] [--filename DISPLAY]

Flags:
  --path PATH       File path, absolute or relative to /workspace/agent/ (required).
  --to NAME         Destination name. If omitted, sends to the current conversation.
  --text MSG        Optional accompanying message.
  --filename NAME   Display name in chat (default: basename of path).
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['path', 'to', 'text', 'filename']);
  const filePath = readRequiredString(args, 'path');
  const to = readFlagString(args, 'to');
  const text = readFlagString(args, 'text') ?? '';
  const overrideFilename = readFlagString(args, 'filename');

  const routing = resolveRouting(to);
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve('/workspace/agent', filePath);
  if (!fs.existsSync(resolvedPath)) throw new Error(`File not found: ${filePath}`);

  const id = generateId();
  const filename = overrideFilename || path.basename(resolvedPath);

  const outboxDir = path.join('/workspace/outbox', id);
  fs.mkdirSync(outboxDir, { recursive: true });
  fs.copyFileSync(resolvedPath, path.join(outboxDir, filename));

  writeMessageOut({
    id,
    kind: 'chat',
    platform_id: routing.platform_id,
    channel_type: routing.channel_type,
    thread_id: routing.thread_id,
    content: JSON.stringify({ text, files: [filename] }),
  });

  ok(`File sent to ${routing.resolvedName} (id: ${id}, filename: ${filename})`);
});
