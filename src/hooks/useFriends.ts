import { useState, useEffect } from 'react';
import { Friend } from '../types/models';
import { FriendService } from '../services/FriendService';
import { CrashLogger } from '../services/LoggingService';

/**
 * Friends/social-graph hook.
 *
 * Responsibilities:
 * - Loads and live-subscribes to every `friends` row that involves the
 *   current user, in either direction (`requester_id` or `addressee_id`
 *   equal to `userId`) - see `FriendService.listenToFriends`. Rows with
 *   `status = 'declined'` are excluded at the query level (server-side
 *   `.neq('status', 'declined')`), so a declined request simply
 *   disappears from both users' lists rather than being shown crossed out.
 * - Derives `accepted` and `pending` as filtered views of `friends` on
 *   every render, rather than storing them as separate state - so they
 *   are always in sync with `friends` and never need their own update
 *   logic. A `pending` row where the current user is the `addressee`
 *   is an incoming request to respond to; where they're the `requester`
 *   it's an outgoing request awaiting the other side. This hook does not
 *   distinguish the two directions itself - callers combine `pending`
 *   with `friends[i].userId` to determine direction.
 * - Wraps `FriendService`'s request/accept/decline/remove mutations,
 *   logging failures via `CrashLogger` and rethrowing so calling screens
 *   can show an error to the user.
 * - Like the other realtime-backed hooks in this codebase, the
 *   underlying subscription uses a `Date.now()`-suffixed channel name
 *   (`friends:user:<id>:<ts>`) so remounting doesn't collide with a
 *   channel still being torn down from the previous mount.
 */
export const useFriends = (userId: string | undefined) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribes to the current user's friend rows on mount / whenever
  // `userId` changes; the cleanup unsubscribes the previous channel so a
  // user switch (or remount) never leaves two live subscriptions active.
  useEffect(() => {
    if (!userId) { setFriends([]); setLoading(false); return; }

    setLoading(true);
    const unsubscribe = FriendService.listenToFriends(
      userId,
      (data) => { setFriends(data); setLoading(false); },
      (err) => { setError(err); setLoading(false); }
    );
    return unsubscribe;
  }, [userId]);

  const sendRequest = async (targetUserId: string) => {
    if (!userId) return;
    try {
      await FriendService.sendRequest(userId, targetUserId);
    } catch (err) {
      CrashLogger.error(err, 'useFriends.sendRequest');
      throw err;
    }
  };

  const acceptRequest = async (friendRowId: string) => {
    try {
      await FriendService.acceptRequest(friendRowId);
    } catch (err) {
      CrashLogger.error(err, 'useFriends.acceptRequest');
      throw err;
    }
  };

  const declineRequest = async (friendRowId: string) => {
    try {
      await FriendService.declineRequest(friendRowId);
    } catch (err) {
      CrashLogger.error(err, 'useFriends.declineRequest');
      throw err;
    }
  };

  const removeFriend = async (friendRowId: string) => {
    try {
      await FriendService.removeFriend(friendRowId);
    } catch (err) {
      CrashLogger.error(err, 'useFriends.removeFriend');
      throw err;
    }
  };

  // Derived views (recomputed each render, not stored as state - see the
  // file-level comment above for why).
  const accepted = friends.filter(f => f.status === 'accepted');
  const pending = friends.filter(f => f.status === 'pending');

  return { friends, accepted, pending, loading, error, sendRequest, acceptRequest, declineRequest, removeFriend };
};
