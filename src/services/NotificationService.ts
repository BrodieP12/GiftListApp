import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ANDROID_CHANNEL_IDS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENT_META,
  mergeNotificationPreferences,
} from '../constants/notifications';
import {
  InAppNotificationPayload,
  NotificationActionData,
  NotificationCategoryId,
  NotificationEventConfig,
  NotificationEventType,
  NotificationKind,
  NotificationNavigationTarget,
  NotificationPreferences,
} from '../types/notifications';
import { CrashLogger } from './LoggingService';

const MAX_VAR_LENGTH = 140;

let isHandlerConfigured = false;
let initializedPromise: Promise<boolean> | null = null;

/**
 * Configures how foreground OS notifications behave based on the `kind` stored in `data`.
 */
export function ensureNotificationHandlerConfigured(): void {
  if (isHandlerConfigured) return;
  isHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const kind = notification.request.content.data?.notificationKind as NotificationKind | undefined;
      if (kind === 'in_app') {
        return {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
      if (kind === 'silent') {
        return {
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
        };
      }
      if (kind === 'urgent') {
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        };
      }
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      };
    },
  });
}

/**
 * Safely interpolates `{{placeholder}}` tokens in a user-defined template.
 */
export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const raw = variables[key];
    if (!raw) return '';
    const trimmed = raw.trim();
    if (trimmed.length <= MAX_VAR_LENGTH) return trimmed;
    return `${trimmed.slice(0, MAX_VAR_LENGTH - 1)}…`;
  }).trim();
}

/**
 * Maps notification payload metadata into a typed React Navigation destination.
 */
export function resolveNavigationTarget(
  data?: NotificationActionData
): NotificationNavigationTarget | undefined {
  if (!data) return undefined;

  switch (data.eventType) {
    case 'friend_request_received':
    case 'friend_request_accepted':
      return { tab: 'FriendsTab' };
    case 'new_message':
      if (data.conversationId) {
        return {
          tab: 'MessagesTab',
          screen: 'Conversation',
          params: { conversationId: data.conversationId },
        };
      }
      return undefined;
    case 'shared_list_item_added':
    case 'list_member_joined':
    case 'item_claimed':
    case 'item_unclaimed':
      if (data.listId && data.ownerId) {
        return {
          tab: 'ListsTab',
          screen: 'ListDetail',
          params: { listId: data.listId, ownerId: data.ownerId },
        };
      }
      return undefined;
    default:
      return undefined;
  }
}

function getCategoryIdForEvent(eventType: NotificationEventType): NotificationCategoryId {
  const meta = NOTIFICATION_EVENT_META.find((item) => item.type === eventType);
  return meta?.categoryId ?? NOTIFICATION_CATEGORIES.LIST_ACTIVITY;
}

async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_IDS.urgent, {
    name: 'Urgent Alerts',
    description: 'Heads-up notifications with sound and vibration for messages and requests.',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 220, 120, 220],
    enableVibrate: true,
    enableLights: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_IDS.standard, {
    name: 'Standard Updates',
    description: 'Standard notifications with sound for list activity and updates.',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_IDS.silent, {
    name: 'Silent Updates',
    description: 'Quiet notifications placed in the tray without sound or vibration.',
    importance: Notifications.AndroidImportance.LOW,
    enableVibrate: false,
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.FRIEND_REQUEST, [
    {
      identifier: 'ACCEPT_FRIEND',
      buttonTitle: 'Accept',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'DECLINE_FRIEND',
      buttonTitle: 'Decline',
      options: { opensAppToForeground: false, isDestructive: true },
    },
    {
      identifier: 'VIEW_FRIENDS',
      buttonTitle: 'View',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.DIRECT_MESSAGE, [
    {
      identifier: 'REPLY_MESSAGE',
      buttonTitle: 'Reply',
      textInput: {
        submitButtonTitle: 'Send',
        placeholder: 'Write a reply...',
      },
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'OPEN_CHAT',
      buttonTitle: 'Open Chat',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.LIST_ACTIVITY, [
    {
      identifier: 'VIEW_LIST',
      buttonTitle: 'View List',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'DISMISS',
      buttonTitle: 'Dismiss',
      options: { opensAppToForeground: false },
    },
  ]);
}

function buildContentInput(
  title: string,
  body: string,
  eventConfig: NotificationEventConfig,
  data: NotificationActionData
): Notifications.NotificationContentInput {
  const categoryIdentifier = eventConfig.includeActions
    ? getCategoryIdForEvent(data.eventType)
    : undefined;

  const isSilent = eventConfig.kind === 'silent';
  const isUrgent = eventConfig.kind === 'urgent';

  return {
    title,
    body,
    data: { ...data, notificationKind: eventConfig.kind },
    categoryIdentifier,
    sound: isSilent ? false : 'default',
    vibrate: isUrgent ? [0, 220, 120, 220] : undefined,
    priority: isUrgent
      ? Notifications.AndroidNotificationPriority.MAX
      : isSilent
        ? Notifications.AndroidNotificationPriority.LOW
        : Notifications.AndroidNotificationPriority.DEFAULT,
    autoDismiss: true,
  };
}

export interface DispatchNotificationParams {
  eventType: NotificationEventType;
  variables: Record<string, string | undefined>;
  data: NotificationActionData;
  preferences?: NotificationPreferences | null;
  onInAppNotify?: (payload: InAppNotificationPayload) => void;
}

export const NotificationService = {
  /**
   * Requests notification permission and registers Android channels + interactive categories.
   */
  async initializeNotifications(requestPermission = true): Promise<boolean> {
    ensureNotificationHandlerConfigured();

    if (!initializedPromise) {
      initializedPromise = (async () => {
        try {
          await setupAndroidChannels();
          await registerNotificationCategories();
          return true;
        } catch (err) {
          CrashLogger.error(err, 'NotificationService.initializeNotifications');
          return false;
        }
      })();
    }

    await initializedPromise;

    if (!requestPermission) {
      const existing = await Notifications.getPermissionsAsync();
      return existing.granted;
    }

    return this.requestPermissions();
  },

  async getPermissionStatus(): Promise<Notifications.PermissionStatus> {
    const perms = await Notifications.getPermissionsAsync();
    return perms.status;
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.granted) return true;
      if (!existing.canAskAgain) return false;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (err) {
      CrashLogger.error(err, 'NotificationService.requestPermissions');
      return false;
    }
  },

  /**
   * Evaluates user preferences and dispatches either an in-app banner or an OS notification.
   */
  async dispatchNotification({
    eventType,
    variables,
    data,
    preferences,
    onInAppNotify,
  }: DispatchNotificationParams): Promise<string | null> {
    const resolvedPrefs = mergeNotificationPreferences(preferences);
    if (!resolvedPrefs.globalEnabled) return null;

    const eventConfig = resolvedPrefs.events[eventType];
    if (!eventConfig || !eventConfig.enabled) return null;

    const title = renderNotificationTemplate(eventConfig.titleTemplate, variables) || 'GiftListApp';
    const body = renderNotificationTemplate(eventConfig.bodyTemplate, variables);
    const navigationTarget = resolveNavigationTarget(data);

    if (eventConfig.kind === 'in_app') {
      onInAppNotify?.({
        id: `${eventType}:${Date.now()}`,
        eventType,
        title,
        body,
        navigationTarget,
        data,
      });
      return 'in_app';
    }

    await this.initializeNotifications(false);

    const channelId = ANDROID_CHANNEL_IDS[eventConfig.kind];
    const content = buildContentInput(title, body, eventConfig, data);
    const trigger: Notifications.NotificationTriggerInput =
      Platform.OS === 'android' ? { channelId } : null;

    return Notifications.scheduleNotificationAsync({ content, trigger });
  },

  /**
   * Sends an immediate test notification using the user's current template, kind, and action settings.
   */
  async sendTestNotification(
    eventType: NotificationEventType,
    eventConfig: NotificationEventConfig,
    onInAppNotify?: (payload: InAppNotificationPayload) => void
  ): Promise<string | null> {
    const meta = NOTIFICATION_EVENT_META.find((item) => item.type === eventType);
    const sampleVars: Record<string, string> = {};
    meta?.variables.forEach((v) => {
      sampleVars[v.key] = v.sample;
    });

    const title = renderNotificationTemplate(eventConfig.titleTemplate, sampleVars) || 'GiftListApp Test';
    const body = renderNotificationTemplate(eventConfig.bodyTemplate, sampleVars) || 'Test notification';
    const data: NotificationActionData = { eventType, isTest: true };

    if (eventConfig.kind === 'in_app') {
      onInAppNotify?.({
        id: `test:${eventType}:${Date.now()}`,
        eventType,
        title,
        body,
        data,
      });
      return 'in_app';
    }

    const granted = await this.initializeNotifications(true);
    if (!granted) {
      throw new Error('Notification permission has not been granted on this device.');
    }

    const channelId = ANDROID_CHANNEL_IDS[eventConfig.kind];
    const content = buildContentInput(title, body, eventConfig, data);
    const trigger: Notifications.NotificationTriggerInput =
      Platform.OS === 'android' ? { channelId } : null;

    return Notifications.scheduleNotificationAsync({ content, trigger });
  },
};
