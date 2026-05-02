#!/usr/bin/env bun
/**
 * `edit-message` — edit a previously sent message.
 *
 *   edit-message --messageId 42 --text "new content"
 *
 * Replaces mcp__nanoclaw__edit_message. Targets the same destination the
 * original message was sent to.
 */
import { getMessageIdBySeq, getRoutingBySeq, writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagInt, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `edit-message: Edit a previously sent message.

Usage:
  edit-message --messageId N --text TEXT

Flags:
  --messageId N   Message ID (the numeric id shown in messages, required).
  --text TEXT     New message content (required).
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['messageId', 'text']);
  const seq = readFlagInt(args, 'messageId');
  if (!seq) throw new Error('--messageId is required');
  const text = readRequiredString(args, 'text');

  const platformId = getMessageIdBySeq(seq);
  if (!platformId) throw new Error(`Message #${seq} not found`);

  const routing = getRoutingBySeq(seq);
  if (!routing || !routing.channel_type || !routing.platform_id) {
    throw new Error(`Cannot determine destination for message #${seq}`);
  }

  const id = generateId();
  writeMessageOut({
    id,
    kind: 'chat',
    platform_id: routing.platform_id,
    channel_type: routing.channel_type,
    thread_id: routing.thread_id,
    content: JSON.stringify({ operation: 'edit', messageId: platformId, text }),
  });

  ok(`Message edit queued for #${seq}`);
});
