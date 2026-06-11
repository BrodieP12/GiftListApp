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
        // Both subscriptions return a no-op unsubscribe by default.
        (ListService.listenToOwnedLists as jest.Mock).mockReturnValue(() => {});
        (ListService.listenToSharedLists as jest.Mock).mockReturnValue(() => {});
    });

    it('subscribes to owned lists and updates on emit', async () => {
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

    it('subscribes to shared lists and exposes them separately', async () => {
        (ListService.listenToSharedLists as jest.Mock).mockImplementation(
            (_userId, onUpdate) => {
                onUpdate([{ id: 's1', title: 'A Friend\'s List' }]);
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

        expect(ListService.listenToSharedLists).toHaveBeenCalledWith(
            'user123',
            expect.any(Function),
            expect.any(Function)
        );
        expect(hookResult.sharedLists).toEqual([{ id: 's1', title: 'A Friend\'s List' }]);
        expect(hookResult.sharedLoading).toBe(false);
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

    it('joins a shared list by code', async () => {
        (ListService.joinListByCode as jest.Mock).mockResolvedValue('joined-list-id');

        let hookResult: any;
        const TestComponent = () => {
            hookResult = useLists('user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        let joinedId;
        await act(async () => {
            joinedId = await hookResult.joinList('ABC1234');
        });

        expect(ListService.joinListByCode).toHaveBeenCalledWith('ABC1234');
        expect(joinedId).toBe('joined-list-id');
    });

    it('leaves a shared list', async () => {
        (ListService.leaveList as jest.Mock).mockResolvedValue(undefined);

        let hookResult: any;
        const TestComponent = () => {
            hookResult = useLists('user123');
            return null;
        };

        await act(async () => {
            create(<TestComponent />);
        });

        await act(async () => {
            await hookResult.leaveList('list-99');
        });

        expect(ListService.leaveList).toHaveBeenCalledWith('list-99', 'user123');
    });
});
