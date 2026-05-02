import { describe, it, expect } from 'bun:test';
import { isTerminalBashCommand, tokenizeBashCommand } from './claude.js';

describe('tokenizeBashCommand', () => {
  it('splits on whitespace', () => {
    expect(tokenizeBashCommand('echo a b c')).toEqual(['echo', 'a', 'b', 'c']);
  });

  it('preserves double-quoted strings as one token', () => {
    expect(tokenizeBashCommand('send-message --text "hello world"')).toEqual([
      'send-message',
      '--text',
      'hello world',
    ]);
  });

  it('preserves single-quoted strings as one token', () => {
    expect(tokenizeBashCommand("send-message --text 'foo --continue bar'")).toEqual([
      'send-message',
      '--text',
      'foo --continue bar',
    ]);
  });

  it('handles backslash escapes inside double quotes', () => {
    expect(tokenizeBashCommand('echo "say \\"hi\\""')).toEqual(['echo', 'say "hi"']);
  });

  it('keeps shell operators as standalone tokens', () => {
    expect(tokenizeBashCommand('a && b')).toEqual(['a', '&&', 'b']);
    expect(tokenizeBashCommand('a | b')).toEqual(['a', '|', 'b']);
  });

  it('returns [] for empty/whitespace input', () => {
    expect(tokenizeBashCommand('')).toEqual([]);
    expect(tokenizeBashCommand('   ')).toEqual([]);
  });
});

describe('isTerminalBashCommand', () => {
  const cmd = (command: string) => isTerminalBashCommand({ command });

  it('treats stay-silent as terminal', () => {
    expect(cmd('stay-silent')).toBe(true);
  });

  it('treats bare send-message as terminal', () => {
    expect(cmd('send-message --to alice --text "hi"')).toBe(true);
    expect(cmd('send-message --text "hi"')).toBe(true);
  });

  it('treats send-message --continue as non-terminal', () => {
    expect(cmd('send-message --to alice --text "ack" --continue')).toBe(false);
    expect(cmd('send-message --continue --to alice --text "ack"')).toBe(false);
  });

  it('does NOT treat --continue inside a quoted body as the flag', () => {
    expect(cmd('send-message --to alice --text "I will --continue working"')).toBe(true);
    expect(cmd("send-message --to alice --text 'note: --continue is a flag'")).toBe(true);
  });

  it('treats sequenced compounds as non-terminal', () => {
    expect(cmd('send-message --to a --text "x" && echo done')).toBe(false);
    expect(cmd('echo prep; send-message --to a --text "x"')).toBe(false);
    expect(cmd('send-message --to a --text "x" || echo retry')).toBe(false);
  });

  it('treats pipelines ending in send-message as terminal', () => {
    // Pipe content directly: agent never reads the body into its context.
    expect(cmd('cat /workspace/agent/draft.md | send-message --to alice --text @-')).toBe(true);
    expect(cmd('grep error log.txt | send-message --to oncall --text @-')).toBe(true);
    expect(cmd('curl -s api.example.com | send-message --to me --text @- --continue')).toBe(false);
  });

  it('treats pipelines NOT ending in send-message as non-terminal', () => {
    expect(cmd('send-message --to a --text "x" | tee /tmp/log')).toBe(false);
  });

  it('ignores stdout redirect targets when finding the final stage', () => {
    expect(cmd('send-message --to a --text "x" > /tmp/out')).toBe(true);
  });

  it('non-terminal for unrelated commands', () => {
    expect(cmd('echo hi')).toBe(false);
    expect(cmd('ls')).toBe(false);
    expect(cmd('schedule-task --in 5m --script foo')).toBe(false);
  });

  it('handles empty / non-string input', () => {
    expect(cmd('')).toBe(false);
    expect(cmd('   ')).toBe(false);
    expect(isTerminalBashCommand({})).toBe(false);
    expect(isTerminalBashCommand(null)).toBe(false);
    expect(isTerminalBashCommand({ command: 42 })).toBe(false);
  });
});
