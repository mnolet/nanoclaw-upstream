/**
 * Named agent modes for the Claude provider. Each mode bundles a
 * system-prompt builder + tool allowlist + disallow list; the provider
 * is mode-agnostic. See `CODING_MODE` and `PERSONAL_MODE` below for
 * the rationale on each.
 */

import type { Options, SettingSource } from '@anthropic-ai/claude-agent-sdk';

type SystemPrompt = NonNullable<Options['systemPrompt']>;

export interface AgentMode {
  name: 'coding' | 'personal';
  /** Build the SDK `systemPrompt` value from the runtime addendum. */
  buildSystemPrompt(addendum: string): SystemPrompt;
  allowedTools: string[];
  disallowedTools: string[];
  settingSources: SettingSource[];
}

// ── Shared: SDK builtins that don't fit nanoclaw's async model ──
// (CronCreate / AskUserQuestion / EnterPlanMode etc. were already in
// the original SDK_DISALLOWED_TOOLS — they apply to both modes.)
const COMMON_DISALLOWED = [
  'CronCreate',
  'CronDelete',
  'CronList',
  'ScheduleWakeup',
  'AskUserQuestion',
  'EnterPlanMode',
  'ExitPlanMode',
  'EnterWorktree',
  'ExitWorktree',
];

// ── coding mode: preserves the original Claude Code behavior ──
const CODING_MODE: AgentMode = {
  name: 'coding',
  buildSystemPrompt: (addendum) => ({
    type: 'preset',
    preset: 'claude_code',
    append: addendum || undefined,
  }),
  allowedTools: [
    'Bash',
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
    'Task',
    'TaskOutput',
    'TaskStop',
    'TeamCreate',
    'TeamDelete',
    'SendMessage',
    'TodoWrite',
    'ToolSearch',
    'Skill',
    'NotebookEdit',
    'mcp__nanoclaw__*',
  ],
  disallowedTools: [...COMMON_DISALLOWED],
  settingSources: ['project', 'user'],
};

// ── personal mode: messaging / personal-assistant default ──
//
// Why a preamble at all (vs. just an empty system prompt):
//
// The SDK's `claude_code` preset opens with "You are Claude Code,
// Anthropic's official CLI for Claude. You are an interactive agent
// that helps users with software engineering tasks." That role framing
// biases every downstream decision — file_path:line_number references,
// reflexive tool use to "verify" before responding, code-review tone,
// "premature abstractions" guidance — none of which fits a chat agent
// replying on Telegram.
//
// CLAUDE.md is loaded by settingSources, but it lands as project memory
// — lower steering weight than the systemPrompt parameter. So we
// override identity at the system-prompt position and let CLAUDE.md
// handle the rest (workspace layout, memory conventions, formatting).
//
// Three sentences, ~35 tokens. The third (`not a coding agent`) is the
// load-bearing counter-anchor against the preset's framing.
const PERSONAL_PREAMBLE =
  'You are a NanoClaw agent — a personal assistant that receives messages on chat platforms and replies to them. You are not a coding agent.';

const PERSONAL_MODE: AgentMode = {
  name: 'personal',
  buildSystemPrompt: (addendum) => [PERSONAL_PREAMBLE, addendum].filter(Boolean).join('\n\n'),
  allowedTools: [
    'Bash',
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
    'NotebookEdit',
    'Skill',
    'mcp__nanoclaw__*',
  ],
  // Defense-in-depth: block the SDK builtins whose names collide with
  // nanoclaw's MCP tools. The allowlist above is the primary control;
  // this list is what the PreToolUse hook in claude.ts checks if
  // anything slips through.
  disallowedTools: [
    ...COMMON_DISALLOWED,
    'Task',
    'TaskOutput',
    'TaskStop',
    'TeamCreate',
    'TeamDelete',
    'SendMessage',
    'TodoWrite',
    'ToolSearch',
  ],
  settingSources: ['project', 'user'],
};

const MODES: Record<string, AgentMode> = {
  coding: CODING_MODE,
  personal: PERSONAL_MODE,
};

export function resolveAgentMode(name: string | undefined): AgentMode {
  const key = (name ?? 'coding').toLowerCase();
  const mode = MODES[key];
  if (!mode) {
    console.error(`[agent-modes] unknown mode "${name}", falling back to "coding"`);
    return CODING_MODE;
  }
  return mode;
}
