import * as Notifications from 'expo-notifications';
import {
  handleNotificationResponse,
  startNotificationListener,
} from './notificationListener';
import { NotificationService } from './NotificationService';
import { FriendService } from './FriendService';
import { MessageService } from './MessageService';
import { UserService } from './UserService';
import { createDefaultNotificationPreferences } from '../constants/notifications';

type PostgresHandler = (payload: any) => void;
const postgresHandlers: Record<string, PostgresHandler> = {};
const mockRemoveChannel = jest.fn();

jest.mock('../api/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => {
      const ch: any = {
        on: jest.fn((_type: string, filter: { event: string; table: string }, cb: PostgresHandler) => {
          postgresHandlers[`${filter.table}:${filter.event}`] = cb;
          return ch;
        }),
        subscribe: jest.fn(() => ch),
      };
      return ch;
    }),
    removeChannel: (...args: any[]) => mockRemoveChannel(...args),
  },
}));

jest.mock('./FriendService', () => ({
  FriendService: {
    acceptRequest: jest.fn().mockResolvedValue(undefined),
    declineRequest: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('./MessageService', () => ({
  MessageService: {
    sendMessage: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('./UserService', () => ({
  UserService: {
    getUserProfiles: jest.fn().mockResolvedValue([
      {
        id: 'other-user',
        email: 'other@example.com',
        displayName: 'Alex Rivera',
        givenName: 'Alex',
        familyName: 'Rivera',
        photoURL: null,
      },
    ]),
  },
}));

jest.mock('./LoggingService', () => ({
  CrashLogger: { error: jest.fn() },
}));

import { supabase } from '../api/supabase';

const mockFrom = supabase.from as jest.Mock;

function mockQueryResult(data: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
  };
  return builder;
}

describe('notificationListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(postgresHandlers).forEach((k) => delete postgresHandlers[k]);
  });

  it('dispatches a notification on incoming friend requests and cleans up subscriptions', async () => {
    const dispatchSpy = jest.spyOn(NotificationService, 'dispatchNotification').mockResolvedValue('id-1');
    const removeListenerMock = jest.fn();
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: removeListenerMock,
    });

    const prefs = createDefaultNotificationPreferences();
    const stop = startNotificationListener({
      userId: 'me-1',
      getPreferences: () => prefs,
      onInAppNotification: jest.fn(),
      onNavigate: jest.fn(),
    });

    await postgresHandlers['friends:INSERT']({
      eventType: 'INSERT',
      new: {
        id: 'friend-row-1',
        requester_id: 'other-user',
        addressee_id: 'me-1',
        status: 'pending',
      },
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(UserService.getUserProfiles).toHaveBeenCalledWith(['other-user']);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'friend_request_received',
        variables: { senderName: 'Alex Rivera' },
        data: { eventType: 'friend_request_received', friendRowId: 'friend-row-1' },
      })
    );

    stop();
    expect(mockRemoveChannel).toHaveBeenCalled();
    expect(removeListenerMock).toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  it('ignores messages sent by the current user and dispatches for other participants', async () => {
    const dispatchSpy = jest.spyOn(NotificationService, 'dispatchNotification').mockResolvedValue('id-2');
    mockFrom.mockReturnValue(mockQueryResult({ conversation_id: 'conv-1' }));

    const stop = startNotificationListener({
      userId: 'me-1',
      getPreferences: () => createDefaultNotificationPreferences(),
      onInAppNotification: jest.fn(),
      onNavigate: jest.fn(),
    });

    // Self-sent message should be ignored
    await postgresHandlers['messages:INSERT']({
      eventType: 'INSERT',
      new: { id: 'm1', conversation_id: 'conv-1', sender_id: 'me-1', content: 'My message' },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(dispatchSpy).not.toHaveBeenCalled();

    // Message from another participant should notify
    await postgresHandlers['messages:INSERT']({
      eventType: 'INSERT',
      new: { id: 'm2', conversation_id: 'conv-1', sender_id: 'other-user', content: 'Hello!' },
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'new_message',
        variables: { senderName: 'Alex Rivera', messagePreview: 'Hello!' },
        data: { eventType: 'new_message', conversationId: 'conv-1' },
      })
    );

    stop();
    dispatchSpy.mockRestore();
  });

  it('never notifies list owners when an item on their own list is claimed (no spoilers)', async () => {
    const dispatchSpy = jest.spyOn(NotificationService, 'dispatchNotification').mockResolvedValue('id-3');

    const stop = startNotificationListener({
      userId: 'owner-1',
      getPreferences: () => {
        const prefs = createDefaultNotificationPreferences();
        prefs.events.item_claimed.enabled = true;
        return prefs;
      },
      onInAppNotification: jest.fn(),
      onNavigate: jest.fn(),
    });

    await postgresHandlers['claims:INSERT']({
      eventType: 'INSERT',
      new: {
        item_id: 'item-1',
        claimed_by: 'other-user',
        list_owner_id: 'owner-1',
        claimed_at: '2026-11-24T00:00:00Z',
      },
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(dispatchSpy).not.toHaveBeenCalled();
    stop();
    dispatchSpy.mockRestore();
  });

  describe('shared_list_item_added (items:INSERT)', () => {
    it('notifies joined shared-list members when an item is added', async () => {
      const dispatchSpy = jest.spyOn(NotificationService, 'dispatchNotification').mockResolvedValue('id-item-1');

      mockFrom.mockImplementation((table: string) => {
        if (table === 'lists') {
          return mockQueryResult({
            id: 'list-1',
            title: 'Holiday Wishlist',
            owner_id: 'other-user',
            is_private: false,
            is_archived: false,
          });
        }
        if (table === 'list_members') {
          return mockQueryResult({ id: 'lm-1' });
        }
        return mockQueryResult(null);
      });

      const stop = startNotificationListener({
        userId: 'me-1',
        getPreferences: () => createDefaultNotificationPreferences(),
        onInAppNotification: jest.fn(),
        onNavigate: jest.fn(),
      });

      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: {
          id: 'item-100',
          list_id: 'list-1',
          owner_id: 'other-user',
          name: 'Espresso Grinder',
        },
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'shared_list_item_added',
          variables: {
            senderName: 'Alex Rivera',
            listTitle: 'Holiday Wishlist',
            itemName: 'Espresso Grinder',
          },
          data: {
            eventType: 'shared_list_item_added',
            listId: 'list-1',
            ownerId: 'other-user',
            itemId: 'item-100',
          },
        })
      );

      stop();
      dispatchSpy.mockRestore();
    });

    it('ignores items added by the list owner, for non-members, or on private/archived lists', async () => {
      const dispatchSpy = jest.spyOn(NotificationService, 'dispatchNotification').mockResolvedValue('id-item-2');

      let currentList: any = {
        id: 'list-2',
        title: 'Private List',
        owner_id: 'other-user',
        is_private: true,
        is_archived: false,
      };
      let currentMember: any = null;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'lists') return mockQueryResult(currentList);
        if (table === 'list_members') return mockQueryResult(currentMember);
        return mockQueryResult(null);
      });

      const stop = startNotificationListener({
        userId: 'me-1',
        getPreferences: () => createDefaultNotificationPreferences(),
        onInAppNotification: jest.fn(),
        onNavigate: jest.fn(),
      });

      // 1. Own item (owner_id === userId)
      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: { id: 'item-own', list_id: 'list-own', owner_id: 'me-1', name: 'My Gift' },
      });

      // 2. Private list
      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: { id: 'item-priv', list_id: 'list-2', owner_id: 'other-user', name: 'Secret' },
      });

      // 3. Archived list
      currentList = {
        id: 'list-3',
        title: 'Old List',
        owner_id: 'other-user',
        is_private: false,
        is_archived: true,
      };
      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: { id: 'item-arch', list_id: 'list-3', owner_id: 'other-user', name: 'Old Item' },
      });

      // 4. Non-member on active shared list
      currentList = {
        id: 'list-4',
        title: 'Shared List',
        owner_id: 'other-user',
        is_private: false,
        is_archived: false,
      };
      currentMember = null;
      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: { id: 'item-nonmem', list_id: 'list-4', owner_id: 'other-user', name: 'Not Joined' },
      });

      await new Promise((r) => setTimeout(r, 0));
      expect(dispatchSpy).not.toHaveBeenCalled();

      stop();
      dispatchSpy.mockRestore();
    });

    it('notifies after joining a shared list mid-session even if previously not a member', async () => {
      const dispatchSpy = jest.spyOn(NotificationService, 'dispatchNotification').mockResolvedValue('id-item-3');
      let isMember = false;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'lists') {
          return mockQueryResult({
            id: 'list-5',
            title: 'Birthday Ideas',
            owner_id: 'other-user',
            is_private: false,
            is_archived: false,
          });
        }
        if (table === 'list_members') {
          return mockQueryResult(isMember ? { id: 'lm-5' } : null);
        }
        return mockQueryResult(null);
      });

      const stop = startNotificationListener({
        userId: 'me-1',
        getPreferences: () => createDefaultNotificationPreferences(),
        onInAppNotification: jest.fn(),
        onNavigate: jest.fn(),
      });

      // Item added before user joined -> ignored, and non-membership is not permanently cached
      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: { id: 'item-before', list_id: 'list-5', owner_id: 'other-user', name: 'Before Join' },
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(dispatchSpy).not.toHaveBeenCalled();

      // User joins the shared list mid-session
      isMember = true;
      await postgresHandlers['list_members:INSERT']({
        eventType: 'INSERT',
        new: { id: 'lm-5', list_id: 'list-5', user_id: 'me-1', role: 'member' },
      });

      // List gets renamed
      await postgresHandlers['lists:UPDATE']({
        eventType: 'UPDATE',
        new: {
          id: 'list-5',
          title: 'Birthday 2026',
          owner_id: 'other-user',
          is_private: false,
          is_archived: false,
        },
      });

      // New item added after joining -> notifies with updated list title
      await postgresHandlers['items:INSERT']({
        eventType: 'INSERT',
        new: { id: 'item-after', list_id: 'list-5', owner_id: 'other-user', name: 'Camera Lens' },
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'shared_list_item_added',
          variables: {
            senderName: 'Alex Rivera',
            listTitle: 'Birthday 2026',
            itemName: 'Camera Lens',
          },
          data: {
            eventType: 'shared_list_item_added',
            listId: 'list-5',
            ownerId: 'other-user',
            itemId: 'item-after',
          },
        })
      );

      stop();
      dispatchSpy.mockRestore();
    });
  });

  describe('handleNotificationResponse (Android Action Buttons)', () => {
    it('accepts a friend request directly from ACCEPT_FRIEND action', async () => {
      const seen = new Set<string>();
      await handleNotificationResponse(
        {
          actionIdentifier: 'ACCEPT_FRIEND',
          notification: {
            date: Date.now(),
            request: {
              identifier: 'notif-1',
              content: {
                title: 'New Friend Request',
                subtitle: null,
                body: 'Alex sent you a friend request.',
                sound: 'default',
                categoryIdentifier: 'friend_request',
                data: { eventType: 'friend_request_received', friendRowId: 'fr-123' },
              } as any,
              trigger: null as any,
            },
          },
        },
        {
          userId: 'me-1',
          onNavigate: jest.fn(),
          markSeen: (k) => (seen.has(k) ? false : (seen.add(k), true)),
        }
      );

      expect(FriendService.acceptRequest).toHaveBeenCalledWith('fr-123');
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('declines a friend request directly from DECLINE_FRIEND action', async () => {
      const seen = new Set<string>();
      await handleNotificationResponse(
        {
          actionIdentifier: 'DECLINE_FRIEND',
          notification: {
            date: Date.now(),
            request: {
              identifier: 'notif-2',
              content: {
                data: { eventType: 'friend_request_received', friendRowId: 'fr-456' },
              } as any,
              trigger: null as any,
            },
          },
        },
        {
          userId: 'me-1',
          onNavigate: jest.fn(),
          markSeen: (k) => (seen.has(k) ? false : (seen.add(k), true)),
        }
      );

      expect(FriendService.declineRequest).toHaveBeenCalledWith('fr-456');
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-2');
    });

    it('sends an inline reply via MessageService on REPLY_MESSAGE action', async () => {
      const seen = new Set<string>();
      await handleNotificationResponse(
        {
          actionIdentifier: 'REPLY_MESSAGE',
          userText: 'Sounds great!',
          notification: {
            date: Date.now(),
            request: {
              identifier: 'notif-3',
              content: {
                data: { eventType: 'new_message', conversationId: 'conv-789' },
              } as any,
              trigger: null as any,
            },
          },
        },
        {
          userId: 'me-1',
          onNavigate: jest.fn(),
          markSeen: (k) => (seen.has(k) ? false : (seen.add(k), true)),
        }
      );

      expect(MessageService.sendMessage).toHaveBeenCalledWith('conv-789', 'me-1', 'Sounds great!');
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-3');
    });

    it('navigates to Conversation when OPEN_CHAT button is pressed', async () => {
      const seen = new Set<string>();
      const onNavigate = jest.fn();

      await handleNotificationResponse(
        {
          actionIdentifier: 'OPEN_CHAT',
          notification: {
            date: Date.now(),
            request: {
              identifier: 'notif-4',
              content: {
                data: { eventType: 'new_message', conversationId: 'conv-789' },
              } as any,
              trigger: null as any,
            },
          },
        },
        {
          userId: 'me-1',
          onNavigate,
          markSeen: (k) => (seen.has(k) ? false : (seen.add(k), true)),
        }
      );

      expect(onNavigate).toHaveBeenCalledWith({
        tab: 'MessagesTab',
        screen: 'Conversation',
        params: { conversationId: 'conv-789' },
      });
    });
  });
});
