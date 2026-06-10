import React from 'react';
import { create, act } from 'react-test-renderer';
import { useListDetail } from '../useListDetail';
import { ListService } from '../../services/ListService';
import { ClaimService } from '../../services/ClaimService';

jest.mock('../../services/ListService');
jest.mock('../../services/ClaimService');

describe('useListDetail Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('subscribes to items and claims and merges claim status', async () => {
        // Drive the realtime listener callbacks the hook subscribes to.
        (ListService.listenToItems as jest.Mock).mockImplementation((_listId, onUpdate) => {
            onUpdate([{ id: 'item1', name: 'Toy' }]);
            return () => {};
        });
        (ClaimService.listenToClaimsForList as jest.Mock).mockImplementation(
            (_ownerId, _listId, onUpdate) => {
                onUpdate({ item1: { claimedBy: 'user123' } });
                return () => {};
            }
        );

        let hookResult: any;
        const TestComponent = () => {
            // isOwner=false so the claims listener is active.
            hookResult = useListDetail('owner123', 'list456', false, 'user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        expect(ListService.listenToItems).toHaveBeenCalledWith(
            'list456',
            expect.any(Function),
            expect.any(Function)
        );
        expect(ClaimService.listenToClaimsForList).toHaveBeenCalledWith(
            'owner123',
            'list456',
            expect.any(Function),
            expect.any(Function)
        );
        expect(hookResult.items).toEqual([
            { id: 'item1', name: 'Toy', claimStatus: { claimedBy: 'user123' } },
        ]);
        expect(hookResult.loading).toBe(false);
    });

    it('unclaims an item the current user already claimed', async () => {
        (ListService.listenToItems as jest.Mock).mockReturnValue(() => {});
        (ClaimService.listenToClaimsForList as jest.Mock).mockReturnValue(() => {});

        let hookResult: any;
        const TestComponent = () => {
            hookResult = useListDetail('owner123', 'list456', false, 'user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        await act(async () => {
            // currentClaimer === currentUserId => unclaim.
            await hookResult.handleToggleClaim('item1', 'user123');
        });

        expect(ClaimService.unclaimItem).toHaveBeenCalledWith('item1');
    });
});
