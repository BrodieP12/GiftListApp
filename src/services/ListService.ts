import { supabase } from '../api/supabase';
import { GiftList, GiftItem } from '../types/models';
import { listFromRow, itemFromRow } from '../api/mappers';
import { CrashLogger } from './LoggingService';

export interface CreateListResult {
  listId: string;
  shareCode: string | null;
}

export const ListService = {
  // --- LISTS ---

  /**
   * Creates a new list via the `create-list` Edge Function, which generates a
   * unique share code server-side (Postgres unique constraint + retry).
   */
  async createList(
    ownerId: string,
    title: string,
    isSharable: boolean = false
  ): Promise<CreateListResult> {
    const { data, error } = await supabase.functions.invoke<CreateListResult>(
      'create-list',
      { body: { title: title.trim(), isSharable } }
    );
    if (error || !data) {
      CrashLogger.error(error, 'ListService.createList');
      throw error ?? new Error('Failed to create list.');
    }
    return { listId: data.listId, shareCode: data.shareCode ?? null };
  },

  async getOwnedLists(userId: string): Promise<GiftList[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('owner_id', userId);
    if (error) {
      CrashLogger.error(error, 'ListService.getOwnedLists');
      throw error;
    }
    return (data ?? []).map(listFromRow);
  },

  /**
   * Subscribes to the current user's owned lists. Returns an unsubscribe fn,
   * matching the old onSnapshot contract. Realtime delivers row deltas, so we
   * re-fetch the full set on any change to mirror the previous snapshot behavior.
   */
  listenToOwnedLists(
    userId: string,
    onUpdate: (lists: GiftList[]) => void,
    onError: (err: Error) => void
  ) {
    const refetch = () =>
      this.getOwnedLists(userId).then(onUpdate).catch(onError);

    refetch(); // prime with current state

    const channel = supabase
      .channel(`lists:owner:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lists', filter: `owner_id=eq.${userId}` },
        refetch
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  listenToOwnedListItems(
    userId: string,
    listId: string,
    onUpdate: (items: GiftItem[]) => void,
    onError: (err: Error) => void
  ) {
    // owner_id filter preserved from the original query.
    const refetch = async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .eq('owner_id', userId);
      if (error) return onError(error);
      onUpdate((data ?? []).map(itemFromRow));
    };

    refetch();

    const channel = supabase
      .channel(`items:owner:${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
        refetch
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getItems(listId: string): Promise<GiftItem[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId);
    if (error) {
      CrashLogger.error(error, 'ListService.getItems');
      throw error;
    }
    return (data ?? []).map(itemFromRow);
  },

  /**
   * Lists shared with the user (member but not owner), via the list_members join.
   */
  async getSharedLists(userId: string): Promise<GiftList[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('*, list_members!inner(user_id)')
      .eq('list_members.user_id', userId);
    if (error) {
      CrashLogger.error(error, 'ListService.getSharedLists');
      throw error;
    }
    return (data ?? []).map(listFromRow);
  },

  /**
   * Subscribes to the lists shared with the user (lists they've joined).
   * Re-fetches whenever the user's membership rows change. Returns an
   * unsubscribe function, matching listenToOwnedLists.
   */
  listenToSharedLists(
    userId: string,
    onUpdate: (lists: GiftList[]) => void,
    onError: (err: Error) => void
  ) {
    const refetch = () => this.getSharedLists(userId).then(onUpdate).catch(onError);

    refetch(); // prime with current state

    const channel = supabase
      .channel(`shared:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_members', filter: `user_id=eq.${userId}` },
        refetch
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /** Joins a shared list by its share code. Returns the joined list id. */
  async joinListByCode(shareCode: string): Promise<string> {
    const code = shareCode.trim().toUpperCase();
    if (!code) throw new Error('Please enter a share code.');

    const { data, error } = await supabase.rpc('join_list_by_code', { p_code: code });
    if (error) {
      CrashLogger.error(error, 'ListService.joinListByCode');
      // Surface a friendly message for the most common case (bad code).
      if (error.message?.includes('invalid_code')) {
        throw new Error('That share code does not match any list.');
      }
      throw new Error('Could not join that list. Please check the code and try again.');
    }
    return data as string;
  },

  /** Removes the current user from a shared list (leave). Owners use deleteList. */
  async leaveList(listId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId);
    if (error) {
      CrashLogger.error(error, 'ListService.leaveList');
      throw error;
    }
  },

  async deleteList(listId: string) {
    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) {
      CrashLogger.error(error, 'ListService.deleteList');
      throw error;
    }
  },

  async getList(listId: string): Promise<GiftList | null> {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('id', listId)
      .maybeSingle();
    if (error) {
      CrashLogger.error(error, 'ListService.getList');
      throw error;
    }
    return data ? listFromRow(data) : null;
  },

  async deleteItem(listId: string, itemId: string): Promise<void> {
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (error) {
      CrashLogger.error(error, 'ListService.deleteItem');
      throw error;
    }
  },

  async updateList(listId: string, list: Partial<GiftList>) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user?.id !== list.ownerId) {
      return;
    }

    // RLS also enforces ownership; this is the matching client-side guard.
    const { error } = await supabase
      .from('lists')
      .update({
        title: list.title,
        is_private: list.isPrivate,
        share_code: list.shareCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listId);
    if (error) {
      CrashLogger.error(error, 'ListService.updateList');
      throw error;
    }
  },

  async addItem(listId: string, item: Partial<GiftItem>) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;

    const { error } = await supabase.from('items').insert({
      list_id: listId,
      owner_id: user.id,
      name: item.name ?? '',
      description: item.description || '',
      price: item.price ?? null,
      image_uri: item.imageUri || null,
      url: item.url || null,
      substitutions: item.substitutions || false,
    });
    if (error) {
      CrashLogger.error(error, 'ListService.addItem');
      throw error;
    }
  },

  listenToItems(
    listId: string,
    onUpdate: (items: GiftItem[]) => void,
    onError: (err: Error) => void
  ) {
    const refetch = () => this.getItems(listId).then(onUpdate).catch(onError);

    refetch();

    const channel = supabase
      .channel(`items:${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
        refetch
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
