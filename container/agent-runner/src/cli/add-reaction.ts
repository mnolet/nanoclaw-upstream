#!/usr/bin/env bun
/**
 * `add-reaction` — add an emoji reaction to a message.
 *
 *   add-reaction --messageId 42 --emoji thumbs_up
 *
 * Replaces mcp__nanoclaw__add_reaction.
 */
import { getMessageIdBySeq, getRoutingBySeq, writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagInt, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `add-reaction: Add an emoji reaction to a message.

Usage:
  add-reaction --messageId N --emoji NAME

Flags:
  --messageId N   Message ID (the numeric id shown in messages, required).
  --emoji NAME    Emoji shortcode (e.g. thumbs_up, heart, white_check_mark).
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['messageId', 'emoji']);
  const seq = readFlagInt(args, 'messageId');
  if (!seq) throw new Error('--messageId is required');
  const emoji = readRequiredString(args, 'emoji');

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
    content: JSON.stringify({ operation: 'reaction', messageId: platformId, emoji }),
  });

  ok(`Reaction queued for #${seq}`);
});
