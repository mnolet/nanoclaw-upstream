/**
 * Destination resolution for outbound message tools (send-message, send-file).
 *
 * Lifted from the original mcp-tools/core.ts so the agent's bin/ tools and
 * any future deterministic caller share one code path.
 *
 * If `to` is omitted, the session's default reply routing (channel + thread)
 * is used. If `to` is specified, it's looked up in the destinations map; a
 * cross-channel send starts a new conversation (thread_id = null).
 */
import { findByName, getAllDestinations } from '../../destinations.js';
import { getSessionRouting } from '../../db/session-routing.js';

export interface ResolvedRouting {
  channel_type: string;
  platform_id: string;
  thread_id: string | null;
  resolvedName: string;
}

export function resolveRouting(to: string | undefined): ResolvedRouting {
  if (!to) {
    const session = getSessionRouting();
    if (session.channel_type && session.platform_id) {
      return {
        channel_type: session.channel_type,
        platform_id: session.platform_id,
        thread_id: session.thread_id,
        resolvedName: '(current conversation)',
      };
    }
    const all = getAllDestinations();
    if (all.length === 0) throw new Error('No destinations configured.');
    if (all.length > 1) {
      throw new Error(
        `You have multiple destinations — specify --to. Options: ${all.map((d) => d.name).join(', ')}`,
      );
    }
    to = all[0].name;
  }
  const dest = findByName(to);
  if (!dest) {
    const known = getAllDestinations()
      .map((d) => d.name)
      .join(', ');
    throw new Error(`Unknown destination "${to}". Known: ${known || '(none)'}`);
  }
  if (dest.type === 'channel') {
    const session = getSessionRouting();
    const threadId =
      session.channel_type === dest.channelType && session.platform_id === dest.platformId
        ? session.thread_id
        : null;
    return {
      channel_type: dest.channelType!,
      platform_id: dest.platformId!,
      thread_id: threadId,
      resolvedName: to,
    };
  }
  return {
    channel_type: 'agent',
    platform_id: dest.agentGroupId!,
    thread_id: null,
    resolvedName: to,
  };
}
