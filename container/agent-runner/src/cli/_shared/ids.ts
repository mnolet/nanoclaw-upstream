/**
 * Shared id generation for outbound system actions and chat messages.
 * Format matches what the legacy MCP handlers wrote.
 */
export function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
