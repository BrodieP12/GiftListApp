import { supabase } from '../api/supabase';
import { Conversation, Message, UserProfile } from '../types/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * MessageService
 * --------------
 * Direct messaging between friends: finding/creating a 1:1 conversation,
 * sending messages, and live-subscribing to the conversation inbox and to
 * an individual conversation's message thread.
 *
 * Data model: `conversations` (just an id + created_at), `conversation_participants`
 * (join table of `conversation_id`/`user_id` pairs), and `messages`
 * (`conversation_id`, `sender_id`, `content`).
 *
 * Why several operations go through SECURITY DEFINER RPCs instead of plain
 * table queries: a naive RLS SELECT policy on `conversation_participants`
 * that says "you can see a row if you're a participant in that
 * conversation" ends up querying `conversation_participants` from within
 * its own policy — i.e. the policy check recurses into the table it's
 * protecting, which Postgres rejects as infinite recursion. To avoid that,
 * this service relies on `SECURITY DEFINER` functions that run with
 * elevated privileges and can safely do that lookup internally, without
 * the client-facing RLS ever needing to self-reference:
 * - `is_conversation_participant()` — used inside RLS policies to check
 *   participation without recursing.
 * - `create_conversation` — finds an existing 1:1 conversation between the
 *   caller and another user, or creates one plus both participant rows, in
 *   a single trusted transaction.
 * - `get_conversation_other_participants` — given a set of conversation
 *   ids, returns the *other* participants' profiles for the calling user,
 *   bypassing the need for a broad "anyone can read any participant row"
 *   policy.
 * (These functions live in the live Supabase project; they aren't checked
 * into the migrations in supabase/migrations/, so consult the Supabase
 * dashboard/SQL editor for their exact current definitions.)
 *
 * Realtime channel names embed `Date.now()`
 * (e.g. `messages:conv:<conversationId>:<timestamp>`) to avoid Supabase
 * Realtime's "cannot add postgres_changes callbacks after subscribe()"
 * error on screen remount, same pattern used throughout ListService,
 * ClaimService and FriendService.
 */

/** Maps a raw `messages` table row (snake_case) to the camelCase `Message` model used by the UI. */
function mapRowToMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at ?? null,
  };
}

export const MessageService = {
  /**
   * Finds the existing 1:1 conversation between two users, or creates one if none exists.
   *
   * @param _userIdA - Unused. The RPC determines "who is user A" from `auth.uid()` (the
   *   authenticated caller) rather than a passed-in id, since a client can't be trusted to
   *   self-report its own uid for something used to create DB rows. Kept as a parameter for
   *   call-site symmetry/readability (`getOrCreateConversation(myId, theirId)`).
   * @param userIdB - The other participant to start/find a conversation with.
   *
   * Delegates entirely to the `create_conversation` SECURITY DEFINER RPC (see file header),
   * which looks for an existing conversation containing exactly these two participants and
   * reuses it, or atomically creates a new `conversations` row plus both
   * `conversation_participants` rows if none exists — avoiding duplicate conversations between
   * the same pair of users.
   *
   * @returns The conversation id (existing or newly created).
   * @throws {PostgrestError} If the RPC call fails.
   */
  async getOrCreateConversation(_userIdA: string, userIdB: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_conversation', {
      other_user_id: userIdB,
    });
    if (error) throw error;
    return data as string;
  },

  /**
   * Sends a message into an existing conversation.
   *
   * @param conversationId - The target conversation. RLS ("Participants can send messages")
   *   requires the caller to already be a participant of this conversation.
   * @param senderId - Written as `sender_id`; RLS requires this to equal `auth.uid()`, so a
   *   user can only send messages as themselves.
   * @param content - Message body; trimmed before storage.
   *
   * @throws {PostgrestError} If the insert is rejected by RLS (not a participant, or
   *   `senderId` doesn't match the caller) or on any other DB error.
   */
  async sendMessage(conversationId: string, senderId: string, content: string): Promise<void> {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
    });
    if (error) throw error;
  },

  /**
   * Subscribes to live updates for `userId`'s conversation inbox: the list of conversations
   * they're part of, each with the other participant(s)' profile and a preview of the last
   * message.
   *
   * @param userId - The user whose inbox to track.
   * @param onUpdate - Called with the full current `Conversation[]` (newest first) every time
   *   the data is (re)fetched, including once immediately with the initial load.
   * @param onError - Called if the participation or conversation-metadata queries fail (the
   *   "other participants" RPC and last-message lookups are best-effort and don't trigger this
   *   — see below).
   * @returns An unsubscribe function that removes the realtime channel; must be called on
   *   unmount to avoid leaked subscriptions.
   *
   * The fetch is assembled in several steps, each working around the recursive-RLS problem
   * described in the file header:
   * 1. Read the caller's own `conversation_participants` rows (`user_id = userId` — allowed
   *    directly since RLS trivially permits reading your own rows) to get the set of
   *    conversation ids they're in. Empty set short-circuits to `onUpdate([])`.
   * 2. Read basic `conversations` metadata for those ids.
   * 3. Call `get_conversation_other_participants` (SECURITY DEFINER RPC) to fetch the *other*
   *    participant(s)' profiles per conversation in one trusted call, instead of querying
   *    `conversation_participants` directly (which RLS can't safely allow for other users'
   *    rows without recursion).
   * 4. For each conversation, fetch its single most recent message (`order by created_at desc
   *    limit 1`) in parallel (`Promise.all`) to build the inbox preview snippet.
   * 5. Merge all of the above into `Conversation` objects and hand them to `onUpdate`.
   *
   * Refetches on any `messages` INSERT, or any `conversation_participants` INSERT for this
   * user (i.e. being added to a new conversation) — not on every possible participant change,
   * since that table's writes for other users aren't visible/relevant here. Channel name
   * embeds `Date.now()` for the remount-collision reason described in the file header.
   */
  listenToConversations(
    userId: string,
    onUpdate: (conversations: Conversation[]) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      // Fetch own participation rows (RLS: auth.uid() = user_id)
      const { data: participations, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (error) { onError(new Error(error.message)); return; }
      if (!participations || participations.length === 0) { onUpdate([]); return; }

      const convIds = participations.map((r: any) => r.conversation_id);

      // Fetch conversation metadata
      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id, created_at')
        .in('id', convIds)
        .order('created_at', { ascending: false });

      if (convErr) { onError(new Error(convErr.message)); return; }

      // Fetch other participants via the RPC (bypasses RLS)
      const { data: otherParticipants } = await supabase.rpc('get_conversation_other_participants', {
        p_user_id: userId,
        p_conv_ids: convIds,
      });

      // Group other participants by conversation_id
      const participantsByConv: Record<string, UserProfile[]> = {};
      for (const row of (otherParticipants ?? [])) {
        if (!participantsByConv[row.conversation_id]) participantsByConv[row.conversation_id] = [];
        participantsByConv[row.conversation_id].push({
          id: row.id,
          email: row.email ?? '',
          displayName: row.display_name ?? '',
          givenName: row.given_name ?? '',
          familyName: row.family_name ?? '',
          photoURL: row.photo_url ?? null,
        });
      }

      // Fetch last message per conversation
      const lastMessages: Record<string, Message> = {};
      await Promise.all(convIds.map(async (convId: string) => {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (msgs && msgs.length > 0) lastMessages[convId] = mapRowToMessage(msgs[0]);
      }));

      const conversations: Conversation[] = (convs ?? []).map((row: any) => ({
        id: row.id,
        createdAt: row.created_at ?? null,
        participants: participantsByConv[row.id] ?? [],
        lastMessage: lastMessages[row.id] ?? null,
      }));

      onUpdate(conversations);
    };

    fetchAndNotify();

    channel = supabase
      .channel(`conversations:user:${userId}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchAndNotify)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  /**
   * Subscribes to live updates for a single conversation's message thread.
   *
   * @param conversationId - The conversation to track. RLS ("Participants can view messages")
   *   restricts results to conversations the caller participates in.
   * @param onUpdate - Called with the full current `Message[]` (oldest first) every time the
   *   data is (re)fetched, including once immediately with the initial load.
   * @param onError - Called if the underlying query fails.
   * @returns An unsubscribe function that removes the realtime channel; must be called on
   *   unmount to avoid leaked subscriptions.
   *
   * Refetches on every new INSERT into `messages` for this conversation. Channel name embeds
   * `Date.now()` for the remount-collision reason described in the file header.
   */
  listenToMessages(
    conversationId: string,
    onUpdate: (messages: Message[]) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) { onError(new Error(error.message)); return; }
      onUpdate((data ?? []).map(mapRowToMessage));
    };

    fetchAndNotify();

    channel = supabase
      .channel(`messages:conv:${conversationId}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
};
