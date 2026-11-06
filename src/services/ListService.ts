import { supabase } from '../api/supabase';
import { GiftList, GiftItem } from '../types/models';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * ListService
 * -----------
 * Owns gift lists and the gift items inside them: creating/editing/deleting
 * lists, sharing them via a short join code, tracking membership, and
 * managing the items that belong to each list.
 *
 * Data model / business rules (see `public.lists`, `public.list_members`
 * and `public.items` in supabase/migrations/001_initial_schema.sql):
 * - A list is either private (`is_private: true`, no `share_code`) or
 *   sharable (`is_private: false`, has a random 7-character `share_code`
 *   used for `joinListByCode`).
 * - `list_members` tracks who can see a list: the owner is added
 *   automatically by a DB trigger (`add_owner_as_member`) whenever a row is
 *   inserted into `lists`, and again defensively by `createList` below
 *   (both are idempotent via `ON CONFLICT (list_id, user_id) DO NOTHING` /
 *   `.upsert()`, so calling both is safe).
 * - Joining a shared list is done through the `join_list_by_code` RPC,
 *   which is `SECURITY DEFINER`. This lets it look up a list by
 *   `share_code` and insert a `list_members` row on the caller's behalf
 *   without needing a broad RLS SELECT policy on `lists` for
 *   not-yet-members, and without letting the client insert membership rows
 *   directly (there's no general "anyone can add themselves as a member"
 *   policy — only the RPC, running with elevated privileges, can do it).
 * - Realtime channel names for every `listen*` method embed `Date.now()`
 *   (e.g. `lists:owner:<userId>:<timestamp>`) to avoid Supabase Realtime's
 *   "cannot add postgres_changes callbacks after subscribe()" error, which
 *   fires if a screen remounts and re-subscribes on the same channel name
 *   before the previous subscription has been torn down.
 */

export interface CreateListResult {
  listId: string;
  shareCode: string | null;
}

/** Generates a random 7-character alphanumeric (A-Z, 0-9) share code for a sharable list. */
function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Maps a raw `lists` table row (snake_case) to the camelCase `GiftList` model used by the UI. */
function mapRowToList(row: any): GiftList {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    isPrivate: row.is_private,
    shareCode: row.share_code ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/** Maps a raw `items` table row (snake_case) to the camelCase `GiftItem` model used by the UI. */
function mapRowToItem(row: any): GiftItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    description: row.description ?? undefined,
    price: row.price ?? null,
    imageUri: row.image_uri ?? null,
    url: row.url ?? null,
    substitutions: row.substitutions ?? false,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export const ListService = {
  // --- LISTS ---

  /**
   * Creates a new gift list.
   *
   * @param ownerId - Auth uid of the creator; written as `owner_id`. RLS ("Owner can do
   *   everything with their list") ties all future permissions on this list to this value.
   * @param title - List display name; trimmed before storage.
   * @param isSharable - When true, the list is public-by-code: `is_private` is set to false
   *   and a random `share_code` is generated (see `generateShareCode`) so others can join via
   *   `joinListByCode`. When false (default), the list is private and `share_code` is `null`.
   *
   * After the list row is inserted, a DB trigger (`add_owner_as_member`) already adds the
   * owner to `list_members` automatically — the explicit `.upsert()` call here is a defensive
   * no-op/safety net (idempotent via the `(list_id, user_id)` unique constraint) in case that
   * trigger behavior ever changes or is bypassed.
   *
   * @returns The new list's id and its share code (`null` if the list is private).
   * @throws {PostgrestError} If the list insert fails (e.g. RLS violation, DB error).
   */
  async createList(ownerId: string, title: string, isSharable = false): Promise<CreateListResult> {
    const shareCode = isSharable ? generateShareCode() : null;

    const { data, error } = await supabase
      .from('lists')
      .insert({
        owner_id: ownerId,
        title: title.trim(),
        is_private: !isSharable,
        share_code: shareCode,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Owner is automatically a member via RLS/trigger, but insert explicitly to be safe
    await supabase.from('list_members').upsert({
      list_id: data.id,
      user_id: ownerId,
      role: 'owner',
    });

    return { listId: data.id, shareCode };
  },

  /**
   * Fetches a single list by id.
   *
   * @param listId - The list to fetch.
   * @returns The `GiftList`, or `null` if it doesn't exist or RLS hides it from the caller
   *   (not the owner and not a member).
   * @throws {PostgrestError} On any DB error other than "not found".
   */
  async getList(listId: string): Promise<GiftList | null> {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('id', listId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRowToList(data);
  },

  /**
   * Partially updates a list's title and/or sharing state.
   *
   * @param listId - The list to update. RLS restricts this to the list's owner.
   * @param updates - Only the fields present are changed:
   *   - `title` - trimmed and written as-is.
   *   - `isPrivate` - toggles sharability. Setting it to `true` clears `share_code` to `null`
   *     (revoking the existing code so old links stop working). Setting it to `false` keeps
   *     `updates.shareCode` if one was explicitly passed, otherwise generates a brand new one
   *     via `generateShareCode()` — so flipping a list from private to sharable always ends up
   *     with a usable code even if the caller didn't supply one.
   *
   * Always stamps `updated_at` with the current time, even if no other field changed.
   *
   * @throws {PostgrestError} If the update is rejected by RLS (not the owner) or on any other
   *   DB error.
   */
  async updateList(listId: string, updates: Partial<Pick<GiftList, 'title' | 'isPrivate' | 'shareCode'>>): Promise<void> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.isPrivate !== undefined) {
      payload.is_private = updates.isPrivate;
      payload.share_code = updates.isPrivate ? null : (updates.shareCode ?? generateShareCode());
    }

    const { error } = await supabase.from('lists').update(payload).eq('id', listId);
    if (error) throw error;
  },

  /**
   * Deletes a list outright.
   *
   * @param listId - The list to delete. RLS restricts this to the list's owner.
   *
   * `ON DELETE CASCADE` on `items.list_id` and `list_members.list_id` means this also removes
   * every item in the list and every membership row — there's no soft-delete/undo.
   *
   * @throws {PostgrestError} If the delete is rejected by RLS (not the owner) or on any other
   *   DB error.
   */
  async deleteList(listId: string): Promise<void> {
    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) throw error;
  },

  /**
   * Subscribes to live updates for every list `userId` owns (the "My Lists" view).
   *
   * @param userId - The owner whose lists to track.
   * @param onUpdate - Called with the full current list of owned `GiftList`s, newest first,
   *   every time the data is (re)fetched — including once immediately with the initial load.
   * @param onError - Called if the underlying query fails.
   * @returns An unsubscribe function that removes the realtime channel; must be called on
   *   unmount to avoid leaked subscriptions.
   *
   * Refetches on any INSERT/UPDATE/DELETE to `lists` rows filtered to `owner_id = userId`.
   * Channel name embeds `Date.now()` for the remount-collision reason described in the file
   * header.
   */
  listenToOwnedLists(
    userId: string,
    onUpdate: (lists: GiftList[]) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) { onError(new Error(error.message)); return; }
      onUpdate((data ?? []).map(mapRowToList));
    };

    fetchAndNotify();

    channel = supabase
      .channel(`lists:owner:${userId}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `owner_id=eq.${userId}` }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  /**
   * Subscribes to live updates for every list `userId` has joined as a member (not owned) —
   * the "Shared with me" view.
   *
   * @param userId - The member whose joined lists to track.
   * @param onUpdate - Called with the full current list of joined `GiftList`s every time the
   *   data is (re)fetched, including once immediately with the initial load.
   * @param onError - Called if the underlying query fails.
   * @returns An unsubscribe function that removes the realtime channel; must be called on
   *   unmount to avoid leaked subscriptions.
   *
   * Queries `list_members` (filtered to `user_id = userId` and `role = 'member'`, i.e.
   * excluding the row that represents the user's own ownership) with an embedded `lists(*)`
   * join, so list details come back in the same round trip. Refetches on any change to that
   * user's `list_members` rows. Channel name embeds `Date.now()` for the remount-collision
   * reason described in the file header.
   */
  listenToSharedLists(
    userId: string,
    onUpdate: (lists: GiftList[]) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      const { data, error } = await supabase
        .from('list_members')
        .select('list_id, lists(*)')
        .eq('user_id', userId)
        .eq('role', 'member');

      if (error) { onError(new Error(error.message)); return; }
      const lists = (data ?? [])
        .map((row: any) => row.lists)
        .filter(Boolean)
        .map(mapRowToList);
      onUpdate(lists);
    };

    fetchAndNotify();

    channel = supabase
      .channel(`list_members:user:${userId}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members', filter: `user_id=eq.${userId}` }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  /**
   * Joins a sharable list using its share code.
   *
   * @param shareCode - The code to redeem; matching is case/whitespace-insensitive since the
   *   `join_list_by_code` RPC normalizes with `upper(trim(p_share_code))` server-side.
   *
   * Delegates to the `join_list_by_code` SECURITY DEFINER RPC (see file header for why this
   * needs elevated privileges) which looks up a non-private list with that code, raises if
   * none is found, and inserts a `list_members` row for `auth.uid()`
   * (`ON CONFLICT (list_id, user_id) DO NOTHING`, so re-joining with the same code is a safe
   * no-op rather than an error).
   *
   * @returns The joined list's id.
   * @throws {Error} `'Invalid share code.'` if the RPC returns no list id, or the RPC's own
   *   `'Invalid or expired share code'` exception (e.g. code doesn't exist or the list was
   *   made private since the code was shared).
   */
  async joinListByCode(shareCode: string): Promise<{ listId: string }> {
    const { data, error } = await supabase.rpc('join_list_by_code', { p_share_code: shareCode });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Invalid share code.');
    return { listId: data };
  },

  // --- ITEMS ---

  /**
   * Adds a gift item to a list.
   *
   * @param listId - The list to add the item to.
   * @param ownerId - Written as `owner_id` on the item row. RLS's "List owner can manage
   *   items" policy actually authorizes based on `lists.owner_id` (via a join on `list_id`),
   *   not this column directly, but it's stored for reference/denormalization.
   * @param item - Partial `GiftItem` fields to seed the row with; anything omitted falls back
   *   to `null`/`false` defaults (`description`, `price`, `imageUri`, `url` -> `null`,
   *   `substitutions` -> `false`).
   *
   * @throws {PostgrestError} If the insert is rejected by RLS (caller isn't the list owner) or
   *   on any other DB error.
   */
  async addItem(listId: string, ownerId: string, item: Partial<GiftItem>): Promise<void> {
    const { error } = await supabase.from('items').insert({
      list_id: listId,
      owner_id: ownerId,
      name: item.name,
      description: item.description ?? null,
      price: item.price ?? null,
      image_uri: item.imageUri ?? null,
      url: item.url ?? null,
      substitutions: item.substitutions ?? false,
    });
    if (error) throw error;
  },

  /**
   * Partially updates a gift item. Only the fields present in `updates` are written; omitted
   * fields are left untouched (unlike `addItem`, there's no defaulting here).
   *
   * @param itemId - The item to update. RLS restricts this to the owner of the item's parent
   *   list.
   * @param updates - Any subset of `GiftItem`'s editable fields (`name`, `description`,
   *   `price`, `imageUri`, `url`, `substitutions`).
   *
   * Always stamps `updated_at` with the current time, even if no other field changed.
   *
   * @throws {PostgrestError} If the update is rejected by RLS (not the list owner) or on any
   *   other DB error.
   */
  async updateItem(itemId: string, updates: Partial<GiftItem>): Promise<void> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.imageUri !== undefined) payload.image_uri = updates.imageUri;
    if (updates.url !== undefined) payload.url = updates.url;
    if (updates.substitutions !== undefined) payload.substitutions = updates.substitutions;

    const { error } = await supabase.from('items').update(payload).eq('id', itemId);
    if (error) throw error;
  },

  /**
   * Deletes a gift item.
   *
   * @param listId - Included as an extra `.eq('list_id', listId)` filter, so the delete only
   *   matches if the item actually belongs to the expected list — a defensive guard against
   *   accidentally deleting an item by id alone if the caller passes a stale/wrong id.
   * @param itemId - The item to delete.
   *
   * `ON DELETE CASCADE` on `claims.item_id` means deleting an item also removes any existing
   * claim on it. RLS restricts this to the owner of the item's parent list.
   *
   * @throws {PostgrestError} If the delete is rejected by RLS or on any other DB error.
   */
  async deleteItem(listId: string, itemId: string): Promise<void> {
    const { error } = await supabase.from('items').delete().eq('id', itemId).eq('list_id', listId);
    if (error) throw error;
  },

  /**
   * Fetches all items in a list, oldest first.
   *
   * @param listId - The list whose items to fetch.
   * @returns The list's `GiftItem`s ordered by `created_at` ascending. RLS restricts results
   *   to callers who are the list's owner or a member.
   * @throws {PostgrestError} On any DB error.
   */
  async getItems(listId: string): Promise<GiftItem[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapRowToItem);
  },

  /**
   * Subscribes to live updates for all items in a list.
   *
   * @param listId - The list whose items to track.
   * @param onUpdate - Called with the full current `GiftItem[]` (oldest first) every time the
   *   data is (re)fetched, including once immediately with the initial load.
   * @param onError - Called if the underlying query fails.
   * @returns An unsubscribe function that removes the realtime channel; must be called on
   *   unmount to avoid leaked subscriptions.
   *
   * Refetches on any INSERT/UPDATE/DELETE to `items` rows filtered to `list_id = listId`.
   * Channel name embeds `Date.now()` for the remount-collision reason described in the file
   * header.
   */
  listenToItems(
    listId: string,
    onUpdate: (items: GiftItem[]) => void,
    onError: (err: Error) => void
  ): () => void {
    let channel: RealtimeChannel;

    const fetchAndNotify = async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: true });

      if (error) { onError(new Error(error.message)); return; }
      onUpdate((data ?? []).map(mapRowToItem));
    };

    fetchAndNotify();

    channel = supabase
      .channel(`items:list:${listId}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, fetchAndNotify)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
};
