/**
 * MCP tools barrel — imports each tool module for its side-effect
 * `registerTools([...])` call, then starts the MCP server.
 *
 * Adding a new tool module: create the file, call `registerTools([...])`
 * at module scope, and append the import here. No central list.
 *
 * Most built-in tools have been migrated to `cli/<verb>.ts` bash commands
 * (PATH-installed via the Dockerfile). Only `scheduling` still goes through
 * MCP — its handlers will move to the same bin layout in a follow-up PR
 * once the scheduling client is extracted.
 */
import './scheduling.js';
import { startMcpServer } from './server.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

startMcpServer().catch((err) => {
  log(`MCP server error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
