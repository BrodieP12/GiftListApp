import { supabase } from '../api/supabase';
import { ItemClaim } from '../types/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * ClaimService
 * ------------
 * Manages "claiming" gift items — the mechanism that lets a friend mark an
 * item as "I'm buying this" so nobody else duplicates the purchase, while
 * keeping the identity of the claimer hidden from the list's owner (so the
 * owner doesn't get spoiled on their own surprise).
 *
 * Business rules enforced (partly here, partly by Postgres RLS in
 * `public.claims`, see supabase/migrations/001_initial_schema.sql):
 * - Exactly one claim may exist per item. `claims.item_id` is the table's
 *   PRIMARY KEY, so there is a 1:1 relationship between an item and its
 *   claim row.
 * - The claims table has RLS policies for INSERT, DELETE and SELECT, but
 *   deliberately NO UPDATE policy. Because `claimItem` writes via
 *   `.upsert()` (INSERT ... ON CONFLICT DO UPDATE), a second user trying to
 *   claim an item that's already claimed hits the ON CONFLICT branch, which
 *   requires UPDATE privileges that don't exist — so Postgres rejects it.
 *   That's what actually makes "only one claimer wins" hold up server-side;
 *   the client does not do any read-then-write race check itself.
 * - The list owner can never see who claimed an item: the "Non-owners can
 *   view claims" SELECT policy filters out any row where
 *   `auth.uid() = list_owner_id`. `listenToClaimsForList` below is written
 *   assuming it's called by a non-owner viewer — if the list owner calls
 *   it, RLS will silently return zero claim rows for their own list.
 * - Realtime channel names include a `Date.now()` suffix
 *   (`claims:list:<listId>:<timestamp>`). Supabase Realtime errors with
 *   "cannot add postgres_changes callbacks after subscribe()" if the same
 *   channel name is reused while a prior subscription for it still exists
 *   (e.g. a screen remount before cleanup fully unsubscribes) — the
 *   timestamp suffix guarantees a fresh, unique channel per subscription
 *   call so remounts never collide with a stale channel.
 */

/** Maps a raw `claims` table row (snake_case) to the camelCase `ItemClaim` model used by the UI. */
function mapRowToClaim(row: any): ItemClaim {
  return {
    itemId: row.item_id,
    claimedBy: row.claimed_by,
    listOwnerId: row.list_owner_id,
    claimedAt: row.claimed_at ?? null,
  };
}

export const ClaimService = {
  /**
   * Claims an item on behalf of `userId` ("I'm buying this").
   *
   * @param itemId - The item being claimed. Also the primary key of the `claims` row, so
   *   there can only ever be one claim per item.
   * @param userId - The claimer's auth uid. Written as `claimed_by`; RLS requires this to
   *   equal `auth.uid()` and forbids it from equaling `listOwnerId` (the owner of a list
   *   cannot claim their own items).
   * @param listOwnerId - Denormalized onto the claim row purely so the "owner can never see
   *   who claimed" RLS SELECT policy can filter `auth.uid() != list_owner_id` without having
   *   to join back through `items` -> `lists` on every read.
   * @param listId - Denormalized list reference stored alongside the claim (not used for
   *   authorization here, but keeps the row self-describing).
   *
   * Uses `.upsert()` rather than `.insert()`. If the item has no existing claim this behaves
   * like a plain insert. If it already has a claim, the upsert's ON CONFLICT DO UPDATE path
   * has no matching RLS UPDATE policy, so Postgres rejects the write — meaning attempting to
   * claim an already-claimed item throws rather than silently stealing the claim.
   *
   * @throws {PostgrestError} If the insert/upsert is rejected by RLS (claiming your own list's
   *   item, or re-claiming an item someone else already claimed) or on any other DB error.
   */
  async claimItem(itemId: string, userId: string, listOwnerId: string, listId: string): Promise<void> {
    const { error } = await supabase.from('claims').upsert({
      item_id: itemId,
      claimed_by: userId,
      list_owner_id: listOwnerId,
      list_id: listId,
    });
    if (error) throw error;
  },

  /**
   * Releases a claim on an item, making it claimable again.
   *
   * @param itemId - The item whose claim row should be deleted.
   *
   * RLS ("Claimer can delete own claim") restricts this to the user who created the claim
   * (`auth.uid() = claimed_by`) — nobody else, including the list owner, can unclaim on
   * someone else's behalf.
   *
   * @throws {PostgrestError} If the delete is rejected by RLS (caller isn't the claimer) or on
   *   any other DB error. Deleting a non-existent claim is a no-op, not an error.
   */
  async unclaimItem(itemId: string): Promise<void> {
    const { error } = await supabase.from('claims').delete().eq('item_id', itemId);
    if (error) throw error;
  },

  /**
   * Subscribes to live claim state for every item in a list, intended for use by non-owner
   * viewers (friends browsing the list) — the list owner will receive an empty/incomplete map
   * for their own list because RLS hides claim rows from them by design (see file header).
   *
   * @param listId - The list whose items' claims should be tracked.
   * @param onUpdate - Called with a fresh `Record<itemId, ItemClaim>` every time claim data is
   *   (re)fetched, including once immediately with the initial snapshot. A map (rather than an
   *   array) is used so the UI can do an O(1) `claims[item.id]` lookup to render claimed state.
   * @param onError - Called if either the items lookup or the claims lookup fails.
   * @returns An unsubscribe function that removes the realtime channel. Callers must invoke
   *   this on unmount to avoid leaking subscriptions.
   *
   * Because claims live on `claims.item_id` but the caller only knows the `listId`, this does
   * a two-step fetch: first resolve all item ids belonging to the list, then fetch claims
   * `.in('item_id', itemIds)`. If the list currently has no items, it short-circuits to an
   * empty map without querying `claims` at all.
   *
   * The realtime channel name embeds `Date.now()` (see file header) so that remounting a
   * screen that calls this again doesn't collide with a not-yet-cleaned-up prior subscription
   * of the same name.
   */
  listenToClaimsForList(
    listId: string,
    onUpdate: (claims: Record<string, ItemClaim>) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      // Get item IDs for this list first
      const { data: items, error: itemsErr } = await supabase
        .from('items')
        .select('id')
        .eq('list_id', listId);

      if (itemsErr) { onError(new Error(itemsErr.message)); return; }
      const itemIds = (items ?? []).map((r: any) => r.id);
      if (!itemIds.length) { onUpdate({}); return; }

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .in('item_id', itemIds);

      if (error) { onError(new Error(error.message)); return; }

      const claims: Record<string, ItemClaim> = {};
      (data ?? []).forEach((row: any) => {
        claims[row.item_id] = mapRowToClaim(row);
      });
      onUpdate(claims);
    };

    fetchAndNotify();

    channel = supabase
      .channel(`claims:list:${listId}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
};
