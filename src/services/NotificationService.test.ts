import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  NotificationService,
  renderNotificationTemplate,
  resolveNavigationTarget,
} from './NotificationService';
import {
  ANDROID_CHANNEL_IDS,
  NOTIFICATION_CATEGORIES,
  createDefaultNotificationPreferences,
} from '../constants/notifications';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  describe('renderNotificationTemplate', () => {
    it('interpolates template placeholders and strips missing tokens', () => {
      const result = renderNotificationTemplate(
        '{{senderName}} added "{{itemName}}" to {{missing}}',
        { senderName: 'Alex', itemName: 'Coffee Grinder' }
      );
      expect(result).toBe('Alex added "Coffee Grinder" to');
    });

    it('truncates excessively long placeholder values', () => {
      const longMsg = 'a'.repeat(200);
      const result = renderNotificationTemplate('{{messagePreview}}', {
        messagePreview: longMsg,
      });
      expect(result.length).toBeLessThanOrEqual(140);
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('resolveNavigationTarget', () => {
    it('routes friend events to FriendsTab', () => {
      expect(
        resolveNavigationTarget({ eventType: 'friend_request_received', friendRowId: 'f1' })
      ).toEqual({ tab: 'FriendsTab' });
    });

    it('routes direct messages to Conversation screen', () => {
      expect(
        resolveNavigationTarget({ eventType: 'new_message', conversationId: 'conv-1' })
      ).toEqual({
        tab: 'MessagesTab',
        screen: 'Conversation',
        params: { conversationId: 'conv-1' },
      });
    });

    it('routes list events to ListDetail screen', () => {
      expect(
        resolveNavigationTarget({
          eventType: 'shared_list_item_added',
          listId: 'list-1',
          ownerId: 'owner-1',
        })
      ).toEqual({
        tab: 'ListsTab',
        screen: 'ListDetail',
        params: { listId: 'list-1', ownerId: 'owner-1' },
      });
    });
  });

  describe('initializeNotifications', () => {
    it('registers Android channels and interactive action categories', async () => {
      const granted = await NotificationService.initializeNotifications(true);
      expect(granted).toBe(true);

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        ANDROID_CHANNEL_IDS.urgent,
        expect.objectContaining({ importance: Notifications.AndroidImportance.MAX })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        ANDROID_CHANNEL_IDS.standard,
        expect.objectContaining({ importance: Notifications.AndroidImportance.DEFAULT })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        ANDROID_CHANNEL_IDS.silent,
        expect.objectContaining({ importance: Notifications.AndroidImportance.LOW })
      );

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIFICATION_CATEGORIES.FRIEND_REQUEST,
        expect.arrayContaining([
          expect.objectContaining({ identifier: 'ACCEPT_FRIEND' }),
          expect.objectContaining({ identifier: 'DECLINE_FRIEND' }),
        ])
      );
      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIFICATION_CATEGORIES.DIRECT_MESSAGE,
        expect.arrayContaining([
          expect.objectContaining({
            identifier: 'REPLY_MESSAGE',
            textInput: expect.objectContaining({ submitButtonTitle: 'Send' }),
          }),
        ])
      );
    });
  });

  describe('dispatchNotification', () => {
    it('skips dispatch when globalEnabled or event is disabled', async () => {
      const prefs = createDefaultNotificationPreferences();
      prefs.globalEnabled = false;

      const res1 = await NotificationService.dispatchNotification({
        eventType: 'new_message',
        variables: { senderName: 'Sam', messagePreview: 'Hello' },
        data: { eventType: 'new_message', conversationId: 'c1' },
        preferences: prefs,
      });
      expect(res1).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      prefs.globalEnabled = true;
      prefs.events.new_message.enabled = false;

      const res2 = await NotificationService.dispatchNotification({
        eventType: 'new_message',
        variables: { senderName: 'Sam', messagePreview: 'Hello' },
        data: { eventType: 'new_message', conversationId: 'c1' },
        preferences: prefs,
      });
      expect(res2).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules Android notification with custom wording, channel, and category', async () => {
      const prefs = createDefaultNotificationPreferences();
      prefs.events.friend_request_received = {
        enabled: true,
        kind: 'urgent',
        titleTemplate: 'Invite from {{senderName}}',
        bodyTemplate: '{{senderName}} wants to connect!',
        includeActions: true,
      };

      await NotificationService.dispatchNotification({
        eventType: 'friend_request_received',
        variables: { senderName: 'Jordan' },
        data: { eventType: 'friend_request_received', friendRowId: 'fr-99' },
        preferences: prefs,
      });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: 'Invite from Jordan',
          body: 'Jordan wants to connect!',
          categoryIdentifier: NOTIFICATION_CATEGORIES.FRIEND_REQUEST,
          data: expect.objectContaining({
            eventType: 'friend_request_received',
            friendRowId: 'fr-99',
            notificationKind: 'urgent',
          }),
        }),
        trigger: { channelId: ANDROID_CHANNEL_IDS.urgent },
      });
    });

    it('routes in_app kind to the in-app banner callback without scheduling an OS notification', async () => {
      const prefs = createDefaultNotificationPreferences();
      prefs.events.new_message.kind = 'in_app';
      const onInAppNotify = jest.fn();

      const res = await NotificationService.dispatchNotification({
        eventType: 'new_message',
        variables: { senderName: 'Taylor', messagePreview: 'Hey there!' },
        data: { eventType: 'new_message', conversationId: 'conv-42' },
        preferences: prefs,
        onInAppNotify,
      });

      expect(res).toBe('in_app');
      expect(onInAppNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'new_message',
          title: 'Message from Taylor',
          body: 'Hey there!',
          navigationTarget: {
            tab: 'MessagesTab',
            screen: 'Conversation',
            params: { conversationId: 'conv-42' },
          },
        })
      );
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
