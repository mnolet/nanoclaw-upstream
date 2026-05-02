import { describe, it, expect } from 'bun:test';

import { extractUsage } from './claude.js';

describe('extractUsage', () => {
  it('maps SDK usage fields to ResultUsage', () => {
    const u = extractUsage({
      type: 'result',
      subtype: 'success',
      duration_ms: 2800,
      duration_api_ms: 4000,
      num_turns: 1,
      total_cost_usd: 0.1698,
      usage: {
        input_tokens: 6,
        output_tokens: 40,
        cache_creation_input_tokens: 26933,
        cache_read_input_tokens: 0,
      },
    });
    expect(u).toEqual({
      inputTokens: 6,
      outputTokens: 40,
      cacheCreationInputTokens: 26933,
      cacheReadInputTokens: 0,
      totalCostUsd: 0.1698,
      numTurns: 1,
      durationMs: 2800,
      durationApiMs: 4000,
    });
  });

  it('returns undefined when usage is absent', () => {
    expect(extractUsage({ type: 'result' })).toBeUndefined();
    expect(extractUsage({})).toBeUndefined();
    expect(extractUsage(null)).toBeUndefined();
  });

  it('omits totalCostUsd when SDK does not report cost', () => {
    // Subscription / Bedrock / Vertex auth often emits 0 or no cost.
    const u = extractUsage({
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      num_turns: 1,
      duration_ms: 100,
      duration_api_ms: 100,
    });
    expect(u?.totalCostUsd).toBeUndefined();
  });

  it('coerces missing numeric fields to 0', () => {
    // SDK shape may evolve; we degrade rather than crash.
    const u = extractUsage({ usage: {} });
    expect(u).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalCostUsd: undefined,
      numTurns: 0,
      durationMs: 0,
      durationApiMs: 0,
    });
  });
});
