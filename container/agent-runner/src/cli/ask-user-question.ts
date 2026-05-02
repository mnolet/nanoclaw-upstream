#!/usr/bin/env bun
/**
 * `ask-user-question` — ask the user a multiple-choice question and BLOCK
 * until they respond or the timeout expires. Output is the chosen value.
 *
 *   ask-user-question --title "Confirm" --question "Delete?" \
 *                     --options '["yes","no"]' [--timeout 300]
 *
 * Options can be plain strings (used as both label and value), or objects
 * { label, selectedLabel?, value? } as JSON.
 *
 * Replaces mcp__nanoclaw__ask_user_question.
 */
import { findQuestionResponse, markCompleted } from '../db/messages-in.js';
import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { initTool, ok, runAsync } from './_shared/output.js';
import { parseArgs, readFlagInt, readRequiredJson, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `ask-user-question: Ask the user a multiple-choice question (BLOCKING).

Usage:
  ask-user-question --title TITLE --question Q --options JSON [--timeout SEC]

Flags:
  --title TITLE     Short card title shown above the question (required).
  --question Q      The question text (required).
  --options JSON    JSON array of options (required). Each item is either:
                      "label-string"
                      {"label": "...", "selectedLabel": "...", "value": "..."}
                    Use --options @file.json or --options @- for big payloads.
  --timeout SEC     Wait timeout in seconds (default: 300).

Blocks until the user responds or the timeout expires. On response, prints
the chosen value to stdout. On timeout, exits non-zero.
`;

interface RawOption {
  label?: string;
  selectedLabel?: string;
  value?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await runAsync(async () => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['title', 'question', 'options', 'timeout']);
  const title = readRequiredString(args, 'title');
  const question = readRequiredString(args, 'question');
  const rawOptions = readRequiredJson<unknown[]>(args, 'options');
  const timeoutSec = readFlagInt(args, 'timeout') ?? 300;

  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    throw new Error('--options must be a non-empty JSON array');
  }

  const options = rawOptions.map((o) => {
    if (typeof o === 'string') return { label: o, selectedLabel: o, value: o };
    const obj = o as RawOption;
    if (!obj.label) throw new Error('option object must have "label"');
    return {
      label: obj.label,
      selectedLabel: obj.selectedLabel ?? obj.label,
      value: obj.value ?? obj.label,
    };
  });

  const questionId = generateId();
  const routing = getSessionRouting();

  writeMessageOut({
    id: questionId,
    kind: 'chat-sdk',
    platform_id: routing.platform_id,
    channel_type: routing.channel_type,
    thread_id: routing.thread_id,
    content: JSON.stringify({
      type: 'ask_question',
      questionId,
      title,
      question,
      options,
    }),
  });

  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const response = await findQuestionResponse(questionId);
    if (response) {
      const parsed = JSON.parse(response.content);
      markCompleted([response.id]);
      ok(parsed.selectedOption);
      return;
    }
    await sleep(1000);
  }

  throw new Error(`Question timed out after ${timeoutSec}s`);
});
