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

    it('subscribes to owned lists and updates on emit', async () => {
        // The hook subscribes via listenToOwnedLists; drive its onUpdate callback.
        (ListService.listenToOwnedLists as jest.Mock).mockImplementation(
            (_userId, onUpdate) => {
                onUpdate([{ id: '1', title: 'Test List' }]);
                return () => {};
            }
        );

        let hookResult: any;
        const TestComponent = () => {
            hookResult = useLists('user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        expect(ListService.listenToOwnedLists).toHaveBeenCalledWith(
            'user123',
            expect.any(Function),
            expect.any(Function)
        );
        expect(hookResult.lists).toEqual([{ id: '1', title: 'Test List' }]);
        expect(hookResult.loading).toBe(false);
    });

    it('handles errors gracefully when the subscription errors', async () => {
        (ListService.listenToOwnedLists as jest.Mock).mockImplementation(
            (_userId, _onUpdate, onError) => {
                onError(new Error('Network error'));
                return () => {};
            }
        );

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

    it('creates a new list and returns the result', async () => {
        (ListService.listenToOwnedLists as jest.Mock).mockReturnValue(() => {});
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
