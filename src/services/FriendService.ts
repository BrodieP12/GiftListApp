import { supabase } from '../api/supabase';
import { Friend, FriendStatus, UserProfile } from '../types/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * FriendService
 * -------------
 * Manages the social graph: sending, accepting, declining and removing
 * friend connections, plus a realtime subscription that keeps the friends
 * list in sync.
 *
 * Data model / business rules (see `public.friends` in
 * supabase/migrations/001_initial_schema.sql, patched to use
 * `requester_id`/`addressee_id` in 002_patch_existing_schema.sql):
 * - Each row is a directed request: `requester_id` sent it, `addressee_id`
 *   received it. `status` is one of `'pending' | 'accepted' | 'declined'`.
 * - Only the addressee can accept/decline (RLS "Recipient can accept or
 *   decline" requires `auth.uid() = addressee_id`); either party can view
 *   or remove the row.
 * - `declineRequest` updates `status` to `'declined'` rather than deleting
 *   the row — the row still exists in the DB, it's just filtered out of
 *   the UI (see `listenToFriends`'s `.neq('status', 'declined')`).
 *   `removeFriend` is the only method that actually deletes a row.
 * - Realtime channel names embed `Date.now()`
 *   (`friends:user:<userId>:<timestamp>`) to avoid Supabase Realtime's
 *   "cannot add postgres_changes callbacks after subscribe()" error, which
 *   happens if a screen remounts and tries to open a new subscription on a
 *   channel name that's still in use by a not-yet-torn-down old one.
 */
// Maps a joined `friends` row (which carries both the requester's and addressee's profile via
// two FK joins) to a `Friend` object from the current user's point of view. Since a `friends`
// row doesn't inherently know which side is "me" vs "the friend", this figures out which of
// the two joined profiles belongs to the *other* person and surfaces only that one.
function mapRowToFriend(row: any, currentUserId: string): Friend {
  const iRequested = row.requester_id === currentUserId;
  const profile = iRequested ? row.addressee_profile : row.requester_profile;
  return {
    id: row.id,
    userId: row.requester_id,
    friendId: row.addressee_id,
    status: row.status as FriendStatus,
    createdAt: row.created_at ?? null,
    profile: profile ? {
      id: profile.id,
      email: profile.email ?? '',
      displayName: profile.display_name ?? '',
      givenName: profile.given_name ?? '',
      familyName: profile.family_name ?? '',
      photoURL: profile.photo_url ?? null,
    } : undefined,
  };
}

export const FriendService = {
  /**
   * Sends a friend request from `currentUserId` to `targetUserId`.
   *
   * @param currentUserId - The requester; written as `requester_id`. RLS ("Users can send
   *   friend requests") requires this to equal `auth.uid()`.
   * @param targetUserId - The addressee who must accept/decline. Row is created with
   *   `status: 'pending'`.
   *
   * @throws {Error} Wraps the Postgres error message — notably including a unique-constraint
   *   violation if a request between this pair already exists (pending, accepted, or a
   *   not-yet-removed declined row).
   */
  async sendRequest(currentUserId: string, targetUserId: string): Promise<void> {
    const { error } = await supabase.from('friends').insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: 'pending',
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Accepts a pending friend request, turning it into an active friendship.
   *
   * @param friendRowId - The `friends.id` of the pending request row.
   *
   * Only the addressee of the request is allowed to do this — RLS ("Recipient can accept or
   * decline") requires `auth.uid() = addressee_id`, so the requester cannot accept their own
   * outgoing request.
   *
   * @throws {Error} If the update is rejected by RLS (caller isn't the addressee) or the row
   *   doesn't exist.
   */
  async acceptRequest(friendRowId: string): Promise<void> {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', friendRowId);
    if (error) throw new Error(error.message);
  },

  /**
   * Declines a pending friend request.
   *
   * @param friendRowId - The `friends.id` of the pending request row.
   *
   * Sets `status` to `'declined'` rather than deleting the row. `listenToFriends` filters
   * declined rows out (`.neq('status', 'declined')`), so this just makes the request
   * disappear from both users' lists without physically removing it — `removeFriend` is the
   * hard-delete path. Same addressee-only RLS restriction as `acceptRequest`.
   *
   * @throws {Error} If the update is rejected by RLS (caller isn't the addressee) or the row
   *   doesn't exist.
   */
  async declineRequest(friendRowId: string): Promise<void> {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'declined' })
      .eq('id', friendRowId);
    if (error) throw new Error(error.message);
  },

  /**
   * Permanently deletes a friend relationship (or a pending/declined request row).
   *
   * @param friendRowId - The `friends.id` to delete.
   *
   * Either party to the relationship may call this — RLS ("Either party can remove") allows
   * `auth.uid()` to be either `requester_id` or `addressee_id`.
   *
   * @throws {Error} If the delete is rejected by RLS or on any other DB error.
   */
  async removeFriend(friendRowId: string): Promise<void> {
    const { error } = await supabase.from('friends').delete().eq('id', friendRowId);
    if (error) throw new Error(error.message);
  },

  /**
   * Subscribes to live changes in `currentUserId`'s friend graph (requests sent, received,
   * and accepted friendships — declined rows are excluded).
   *
   * @param userId - The user whose friend rows (as either requester or addressee) to track.
   * @param onUpdate - Called with the full current `Friend[]` list every time it's
   *   (re)fetched, including once immediately with the initial snapshot. Each `Friend` is
   *   normalized to describe the *other* party via `mapRowToFriend`.
   * @param onError - Called if the underlying query fails.
   * @returns An unsubscribe function that removes the realtime channel; must be called on
   *   unmount to avoid leaked subscriptions.
   *
   * The query joins both `requester_profile` and `addressee_profile` via Postgres FK-based
   * embedding (`profiles!friends_requester_id_fkey` / `profiles!friends_addressee_id_fkey`) in
   * one round trip, then `mapRowToFriend` picks out whichever profile isn't the current user's
   * own. The realtime channel name embeds `Date.now()` for the same remount-collision reason
   * described in the file header.
   */
  listenToFriends(
    userId: string,
    onUpdate: (friends: Friend[]) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id, requester_id, addressee_id, status, created_at,
          requester_profile:profiles!friends_requester_id_fkey(id, email, display_name, given_name, family_name, photo_url),
          addressee_profile:profiles!friends_addressee_id_fkey(id, email, display_name, given_name, family_name, photo_url)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .neq('status', 'declined');

      if (error) { onError(new Error(error.message)); return; }
      onUpdate((data ?? []).map((row: any) => mapRowToFriend(row, userId)));
    };

    fetchAndNotify();

    channel = supabase
      .channel(`friends:user:${userId}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
};
