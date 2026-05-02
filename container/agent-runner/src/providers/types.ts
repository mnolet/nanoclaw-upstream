export interface AgentProvider {
  /**
   * True if the provider's underlying SDK handles slash commands natively and
   * wants them passed through as raw text. When false, the poll-loop formats
   * slash commands like any other chat message.
   */
  readonly supportsNativeSlashCommands: boolean;

  /** Start a new query. Returns a handle for streaming input and output. */
  query(input: QueryInput): AgentQuery;

  /**
   * True if the given error indicates the stored continuation is invalid
   * (missing transcript, unknown session, etc.) and should be cleared.
   */
  isSessionInvalid(err: unknown): boolean;
}

/**
 * Options passed to provider constructors. Fields are common to most
 * providers; individual providers may ignore any they don't need.
 */
export interface ProviderOptions {
  assistantName?: string;
  mcpServers?: Record<string, McpServerConfig>;
  env?: Record<string, string | undefined>;
  additionalDirectories?: string[];
}

export interface QueryInput {
  /** Initial prompt (already formatted by agent-runner). */
  prompt: string;

  /**
   * Opaque continuation token from a previous query. The provider decides
   * what this means (session ID, thread ID, nothing at all).
   */
  continuation?: string;

  /** Working directory inside the container. */
  cwd: string;

  /**
   * System context to inject. Providers translate this into whatever their
   * SDK expects (preset append, full system prompt, per-turn injection…).
   */
  systemContext?: {
    instructions?: string;
  };
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AgentQuery {
  /** Push a follow-up message into the active query. */
  push(message: string): void;

  /** Signal that no more input will be sent. */
  end(): void;

  /** Output event stream. */
  events: AsyncIterable<ProviderEvent>;

  /** Force-stop the query. */
  abort(): void;
}

/** Per-turn usage on the `result` event. Token fields mirror the SDK's `usage` shape. */
export interface ResultUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  /** USD cost; undefined when SDK doesn't report it (Bedrock/Vertex/subscription auth). */
  totalCostUsd?: number;
  numTurns: number;
  /** Wall-clock duration, includes tool waits (ms). */
  durationMs: number;
  /** API-only duration, excludes tool waits (ms). */
  durationApiMs: number;
}

export type ProviderEvent =
  | { type: 'init'; continuation: string }
  | { type: 'result'; text: string | null; usage?: ResultUsage }
  | { type: 'error'; message: string; retryable: boolean; classification?: string }
  | { type: 'progress'; message: string }
  /**
   * Liveness signal. Providers MUST yield this on every underlying SDK
   * event (tool call, thinking, partial message, anything) so the
   * poll-loop's idle timer stays honest during long tool runs.
   */
  | { type: 'activity' };
