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

    it('should fetch list items successfully', async () => {
        (ListService.getItems as jest.Mock).mockResolvedValue([{ id: 'item1', name: 'Toy' }]);
        (ClaimService.getClaimsForList as jest.Mock).mockResolvedValue({ 'item1': { claimedBy: 'user123' } });

        let hookResult: any;
        const TestComponent = () => {
            hookResult = useListDetail('owner123', 'list456', false, 'user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });
        
        await act(async () => {
            await hookResult.fetchListData();
        });

        expect(ListService.getItems).toHaveBeenCalledWith('list456');
        expect(ClaimService.getClaimsForList).toHaveBeenCalledWith('owner123', 'list456');
        expect(hookResult.items).toEqual([{ id: 'item1', name: 'Toy', claimStatus: { claimedBy: 'user123' } }]);
        expect(hookResult.loading).toBe(false);
    });

    it('should correctly handle toggling claim', async () => {
        let hookResult: any;
        const TestComponent = () => {
            hookResult = useListDetail('owner123', 'list456', false, 'user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        await act(async () => {
            await hookResult.handleToggleClaim('item1', 'user123');
        });

        expect(ClaimService.unclaimItem).toHaveBeenCalledWith('item1');
    });
});
