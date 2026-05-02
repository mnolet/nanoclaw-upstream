#!/usr/bin/env bun
/**
 * `stay-silent` — explicit no-op for "I have nothing to say this turn".
 *
 * Returning empty text from the model is technically fine (the dispatcher
 * doesn't fire any recovery on empty output), but models are reluctant to
 * produce truly empty responses and tend to invent filler. Giving them a
 * concrete command to invoke for "I'm choosing silence" is a relief valve
 * and produces a clean audit signal in /workspace/bin-tools.log.
 *
 * No flags, no side effects beyond the standard tool-log line.
 */
import { initTool, ok, run } from './_shared/output.js';

initTool(import.meta.url);

const HELP = `stay-silent: Acknowledge that you have nothing to send this turn.

Usage:
  stay-silent

Use this when you've decided no message is warranted (e.g. you saw the
inbound but it doesn't need a reply). Returning an empty response is also
fine — this command just makes the choice explicit in the audit log.
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  if (argv.length > 0) {
    process.stderr.write(`stay-silent: takes no arguments (got ${argv.length})\n`);
    process.exit(1);
  }
  ok('Silent.');
});
