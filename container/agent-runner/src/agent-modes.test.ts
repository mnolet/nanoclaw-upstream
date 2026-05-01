import { describe, expect, it } from 'bun:test';

import { resolveAgentMode } from './agent-modes.js';

describe('resolveAgentMode', () => {
  it('defaults unknown / undefined / empty to coding', () => {
    expect(resolveAgentMode(undefined).name).toBe('coding');
    expect(resolveAgentMode('').name).toBe('coding');
    expect(resolveAgentMode('bogus').name).toBe('coding');
  });

  it('coding mode preserves the legacy preset shape', () => {
    const m = resolveAgentMode('coding');
    const sp = m.buildSystemPrompt('addendum');
    expect(sp).toMatchObject({ type: 'preset', preset: 'claude_code', append: 'addendum' });

    // Empty addendum collapses to undefined append (mirrors the
    // pre-refactor behavior where systemPrompt was omitted entirely).
    const empty = m.buildSystemPrompt('');
    expect(empty).toMatchObject({ type: 'preset', preset: 'claude_code' });
    expect((empty as { append?: string }).append).toBeUndefined();

    expect(m.allowedTools).toContain('SendMessage'); // legacy parity
    expect(m.allowedTools).toContain('TodoWrite');
    expect(m.allowedTools).toContain('mcp__nanoclaw__*');
  });

  it('personal mode emits a plain string and excludes colliding builtins', () => {
    const m = resolveAgentMode('personal');
    const sp = m.buildSystemPrompt('# You are Foo\n\n## Sending messages...');
    expect(typeof sp).toBe('string');
    expect(sp as string).toContain('NanoClaw agent');
    expect(sp as string).toContain('# You are Foo');

    for (const t of [
      'SendMessage',
      'Task',
      'TaskOutput',
      'TaskStop',
      'TeamCreate',
      'TeamDelete',
      'TodoWrite',
      'ToolSearch',
    ]) {
      expect(m.allowedTools).not.toContain(t);
      expect(m.disallowedTools).toContain(t);
    }
    expect(m.allowedTools).toContain('mcp__nanoclaw__*');
    expect(m.allowedTools).toContain('Skill');
    expect(m.allowedTools).toContain('Bash');
  });

  it('personal mode places the preamble before the addendum', () => {
    const m = resolveAgentMode('personal');
    const sp = m.buildSystemPrompt('ADDENDUM_MARKER') as string;
    const preambleIdx = sp.indexOf('NanoClaw agent');
    const addendumIdx = sp.indexOf('ADDENDUM_MARKER');
    expect(preambleIdx).toBeGreaterThanOrEqual(0);
    expect(addendumIdx).toBeGreaterThan(preambleIdx);
    // Empty addendum still produces a usable prompt — not just trailing whitespace.
    expect(m.buildSystemPrompt('') as string).toContain('NanoClaw agent');
  });

  it('mode lookup is case-insensitive', () => {
    expect(resolveAgentMode('Personal').name).toBe('personal');
    expect(resolveAgentMode('CODING').name).toBe('coding');
  });

  it('both modes preserve settingSources so CLAUDE.md still loads', () => {
    expect(resolveAgentMode('coding').settingSources).toEqual(['project', 'user']);
    expect(resolveAgentMode('personal').settingSources).toEqual(['project', 'user']);
  });

  it('both modes share the existing common disallow list', () => {
    for (const t of [
      'CronCreate',
      'CronDelete',
      'CronList',
      'ScheduleWakeup',
      'AskUserQuestion',
      'EnterPlanMode',
      'ExitPlanMode',
      'EnterWorktree',
      'ExitWorktree',
    ]) {
      expect(resolveAgentMode('coding').disallowedTools).toContain(t);
      expect(resolveAgentMode('personal').disallowedTools).toContain(t);
    }
  });
});
