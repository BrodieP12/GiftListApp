import React from 'react';
import { create, act } from 'react-test-renderer';
import { useLists } from '../useLists';
import { ListService } from '../../services/ListService';

// Mock dependencies
jest.mock('../../services/ListService');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((cb) => cb()),
}));

describe('useLists Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch lists successfully for a valid user', async () => {
        (ListService.getOwnedLists as jest.Mock).mockResolvedValue([{ id: '1', title: 'Test List' }]);
        
        let hookResult: any;
        const TestComponent = () => {
            hookResult = useLists('user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        expect(ListService.getOwnedLists).toHaveBeenCalledWith('user123');
        expect(hookResult.lists).toEqual([{ id: '1', title: 'Test List' }]);
        expect(hookResult.loading).toBe(false);
    });

    it('should handle errors gracefully when fetch fails', async () => {
        (ListService.getOwnedLists as jest.Mock).mockRejectedValue(new Error('Network error'));
        
        let hookResult: any;
        const TestComponent = () => {
            hookResult = useLists('user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        expect(hookResult.error).toBeInstanceOf(Error);
        expect(hookResult.error.message).toBe('Network error');
        expect(hookResult.loading).toBe(false);
    });

    it('should create a new list and return the result', async () => {
        (ListService.createList as jest.Mock).mockResolvedValue({ listId: 'new-123', shareCode: 'ABCD' });
        
        let hookResult: any;
        const TestComponent = () => {
            hookResult = useLists('user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        let result;
        await act(async () => {
            result = await hookResult.createList('My New List', true);
        });

        expect(ListService.createList).toHaveBeenCalledWith('user123', 'My New List', true);
        expect(result).toEqual({ listId: 'new-123', shareCode: 'ABCD' });
    });
});
