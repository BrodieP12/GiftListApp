import { supabase } from '../api/supabase';
import { ItemClaim } from '../types/models';
import { claimFromRow } from '../api/mappers';
import { CrashLogger } from './LoggingService';

export const ClaimService = {
  /**
   * Fetch all claims for a list's items, keyed by itemId.
   * RLS guarantees the list owner receives nothing here (surprise logic),
   * so callers no longer need to guard on isOwner.
   */
  async getClaimsForList(
    ownerId: string,
    listId: string
  ): Promise<Record<string, ItemClaim>> {
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('list_owner_id', ownerId)
      .eq('list_id', listId);
    if (error) {
      CrashLogger.error(error, 'ClaimService.getClaimsForList');
      throw error;
    }

    const claims: Record<string, ItemClaim> = {};
    for (const row of data ?? []) {
      claims[row.item_id] = claimFromRow(row);
    }
    return claims;
  },

  listenToClaimsForList(
    ownerId: string,
    listId: string,
    onUpdate: (claims: Record<string, ItemClaim>) => void,
    onError: (err: Error) => void
  ) {
    const refetch = () =>
      this.getClaimsForList(ownerId, listId).then(onUpdate).catch(onError);

    refetch();

    const channel = supabase
      .channel(`claims:${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims', filter: `list_id=eq.${listId}` },
        refetch
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async claimItem(itemId: string, userId: string, listOwnerId: string, listId: string) {
    // item_id is the primary key => upsert keeps the 1:1 relationship.
    const { error } = await supabase.from('claims').upsert({
      item_id: itemId,
      claimed_by: userId,
      list_owner_id: listOwnerId,
      list_id: listId,
    });
    if (error) {
      CrashLogger.error(error, 'ClaimService.claimItem');
      throw error;
    }
  },

  async unclaimItem(itemId: string) {
    const { error } = await supabase.from('claims').delete().eq('item_id', itemId);
    if (error) {
      CrashLogger.error(error, 'ClaimService.unclaimItem');
      throw error;
    }
  },
};
