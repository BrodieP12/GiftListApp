import { useState, useEffect } from 'react';
import { Conversation, Message } from '../types/models';
import { MessageService } from '../services/MessageService';
import { CrashLogger } from '../services/LoggingService';

/**
 * Direct-messaging hooks for the Friends/Messages feature.
 *
 * This module exports two hooks:
 * - `useConversations(userId)` - the inbox list: one row per conversation
 *   the user participates in, each with its other participant(s) and
 *   last message preview.
 * - `useMessages(conversationId)` - the message thread for a single
 *   open conversation.
 *
 * Both wrap `MessageService`'s Supabase Realtime subscriptions
 * (`listenToConversations` / `listenToMessages`), which internally
 * re-fetch the full relevant dataset on any relevant `postgres_changes`
 * event rather than patching individual rows in place - so state updates
 * here are always "replace with latest snapshot", not incremental merges.
 * Each service subscription uses a channel name suffixed with
 * `Date.now()` (e.g. `conversations:user:<id>:<ts>`) so that remounting a
 * screen (which unsubscribes the old channel and subscribes a new one)
 * never collides with a channel name still being torn down, which
 * previously caused "cannot add postgres_changes callbacks after
 * subscribe()" errors.
 * Business rule: neither hook does anything (no fetch, no subscription)
 * until its id argument is defined - both `userId` and `conversationId`
 * are only available after auth/navigation has resolved, so this avoids
 * firing requests with an invalid id.
 */

export const useConversations = (userId: string | undefined) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribes to the current user's conversation list on mount and
  // whenever `userId` changes (e.g. login/logout). The returned cleanup
  // unsubscribes the previous Realtime channel before a new one is
  // created, preventing duplicate/stacked subscriptions across
  // re-renders or user switches.
  useEffect(() => {
    if (!userId) { setConversations([]); setLoading(false); return; }

    setLoading(true);
    const unsubscribe = MessageService.listenToConversations(
      userId,
      (data) => { setConversations(data); setLoading(false); },
      (err) => { setError(err); setLoading(false); }
    );
    return unsubscribe;
  }, [userId]);

  /**
   * Opens (or lazily creates) a 1:1 conversation with `otherUserId` via
   * the `create_conversation` RPC, which is expected to be idempotent -
   * calling it again for a pair of users that already have a
   * conversation just returns the existing conversation id rather than
   * creating a duplicate.
   *
   * @returns the conversation id to navigate to.
   */
  const openConversation = async (otherUserId: string): Promise<string> => {
    if (!userId) throw new Error('Not authenticated');
    return MessageService.getOrCreateConversation(userId, otherUserId);
  };

  return { conversations, loading, error, openConversation };
};

/**
 * Loads and live-updates the message thread for a single conversation,
 * and exposes a `sendMessage` action.
 *
 * @param conversationId - id of the open conversation; while undefined
 * (e.g. screen still resolving params) the hook stays idle with an empty
 * message list.
 * @returns `{ messages, loading, sendMessage }` - `messages` is ordered
 * oldest-first (see `MessageService.listenToMessages`, which orders by
 * `created_at` ascending) so callers can render it directly into a
 * bottom-anchored chat list.
 *
 * Lifecycle: (re)subscribes whenever `conversationId` changes (e.g. user
 * navigates from one conversation to another without unmounting the
 * screen), unsubscribing the previous conversation's channel first.
 */
export const useMessages = (conversationId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }

    setLoading(true);
    const unsubscribe = MessageService.listenToMessages(
      conversationId,
      (data) => { setMessages(data); setLoading(false); },
      (err) => { CrashLogger.error(err, 'useMessages'); setLoading(false); }
    );
    return unsubscribe;
  }, [conversationId]);

  // Sends a message from `senderId` into the current conversation. Guards
  // against firing with no active conversation or blank/whitespace-only
  // content (the trim mirrors what MessageService.sendMessage persists,
  // so an all-whitespace message never round-trips to the server only to
  // render as empty).
  const sendMessage = async (senderId: string, content: string) => {
    if (!conversationId || !content.trim()) return;
    try {
      await MessageService.sendMessage(conversationId, senderId, content);
    } catch (err) {
      CrashLogger.error(err, 'useMessages.sendMessage');
      throw err;
    }
  };

  return { messages, loading, sendMessage };
};
