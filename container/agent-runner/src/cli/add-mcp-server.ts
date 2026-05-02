#!/usr/bin/env bun
/**
 * `add-mcp-server` — wire an existing third-party MCP server into your
 * per-agent runtime config. Requires admin approval; fire-and-forget.
 *
 *   add-mcp-server --name github --command npx \
 *                  --args '["@modelcontextprotocol/server-github"]' \
 *                  [--env '{"GITHUB_TOKEN":"..."}']
 *
 * Replaces mcp__nanoclaw__add_mcp_server.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagJson, readFlagStringArray, readRequiredString, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `add-mcp-server: Wire an existing third-party MCP server into your container.

Usage:
  add-mcp-server --name NAME --command CMD [--args JSON] [--env JSON]

Flags:
  --name NAME      MCP server name, unique identifier (required).
  --command CMD    Command to run the server (required, e.g. "npx").
  --args JSON      Command arguments as JSON array.
  --env JSON       Environment variables as JSON object.

Requires admin approval. Container is restarted automatically on approval.
`;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['name', 'command', 'args', 'env']);
  const name = readRequiredString(args, 'name');
  const command = readRequiredString(args, 'command');
  const cmdArgs = readFlagStringArray(args, 'args') ?? [];
  const env = readFlagJson<Record<string, string>>(args, 'env') ?? {};

  const requestId = generateId();
  writeMessageOut({
    id: requestId,
    kind: 'system',
    content: JSON.stringify({
      action: 'add_mcp_server',
      name,
      command,
      args: cmdArgs,
      env,
    }),
  });

  ok('MCP server request submitted. You will be notified when admin approves or rejects.');
});
