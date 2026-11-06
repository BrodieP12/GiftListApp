import React from 'react';
import { create, act } from 'react-test-renderer';
import { useListDetail } from '../useListDetail';
import { ListService } from '../../services/ListService';
import { ClaimService } from '../../services/ClaimService';

jest.mock('../../services/ListService');
jest.mock('../../services/ClaimService');

describe('useListDetail Hook', () => {
  let itemsCallback: ((items: any[]) => void) | null = null;
  let claimsCallback: ((claims: Record<string, any>) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    itemsCallback = null;
    claimsCallback = null;

    (ListService.listenToItems as jest.Mock).mockImplementation(
      (_listId: string, onUpdate: (items: any[]) => void) => {
        itemsCallback = onUpdate;
        return () => {};
      }
    );

    (ClaimService.listenToClaimsForList as jest.Mock).mockImplementation(
      (_listId: string, onUpdate: (claims: Record<string, any>) => void) => {
        claimsCallback = onUpdate;
        return () => {};
      }
    );

    (ClaimService.unclaimItem as jest.Mock).mockResolvedValue(undefined);
    (ClaimService.claimItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('merges items and claims for a non-owner', async () => {
    let hookResult: any;
    const TestComponent = () => {
      hookResult = useListDetail('owner123', 'list456', false, 'user123');
      return null;
    };

    await act(async () => { create(<TestComponent />); });

    await act(async () => {
      itemsCallback?.([{ id: 'item1', name: 'Toy' }]);
      claimsCallback?.({ item1: { claimedBy: 'user123' } });
    });

    expect(hookResult.items).toEqual([
      { id: 'item1', name: 'Toy', claimStatus: { claimedBy: 'user123' } },
    ]);
    expect(hookResult.loading).toBe(false);
  });

  it('does not subscribe to claims for the owner', async () => {
    const TestComponent = () => {
      useListDetail('owner123', 'list456', true, 'owner123');
      return null;
    };

    await act(async () => { create(<TestComponent />); });

    expect(ClaimService.listenToClaimsForList).not.toHaveBeenCalled();
  });

  it('unclaims an item the current user claimed', async () => {
    let hookResult: any;
    const TestComponent = () => {
      hookResult = useListDetail('owner123', 'list456', false, 'user123');
      return null;
    };

    await act(async () => { create(<TestComponent />); });

    await act(async () => {
      await hookResult.handleToggleClaim('item1', 'user123');
    });

    expect(ClaimService.unclaimItem).toHaveBeenCalledWith('item1');
    expect(ClaimService.claimItem).not.toHaveBeenCalled();
  });

  it('claims a free item', async () => {
    let hookResult: any;
    const TestComponent = () => {
      hookResult = useListDetail('owner123', 'list456', false, 'user123');
      return null;
    };

    await act(async () => { create(<TestComponent />); });

    await act(async () => {
      await hookResult.handleToggleClaim('item1', null);
    });

    expect(ClaimService.claimItem).toHaveBeenCalledWith('item1', 'user123', 'owner123');
    expect(ClaimService.unclaimItem).not.toHaveBeenCalled();
  });
});
