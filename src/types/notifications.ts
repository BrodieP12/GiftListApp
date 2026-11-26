/**
 * Notification domain models and preference types.
 */

export type NotificationEventType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'new_message'
  | 'shared_list_item_added'
  | 'list_member_joined'
  | 'item_claimed'
  | 'item_unclaimed';

export type NotificationKind = 'urgent' | 'standard' | 'silent' | 'in_app';

export type NotificationCategoryId =
  | 'friend_request'
  | 'direct_message'
  | 'list_activity';

export type NotificationActionId =
  | 'ACCEPT_FRIEND'
  | 'DECLINE_FRIEND'
  | 'VIEW_FRIENDS'
  | 'REPLY_MESSAGE'
  | 'OPEN_CHAT'
  | 'VIEW_LIST'
  | 'DISMISS';

export interface NotificationEventConfig {
  enabled: boolean;
  kind: NotificationKind;
  titleTemplate: string;
  bodyTemplate: string;
  includeActions: boolean;
}

export interface NotificationPreferences {
  globalEnabled: boolean;
  events: Record<NotificationEventType, NotificationEventConfig>;
}

export type NotificationNavigationTarget =
  | { tab: 'FriendsTab' }
  | { tab: 'MessagesTab'; screen: 'Conversation'; params: { conversationId: string } }
  | { tab: 'ListsTab'; screen: 'ListDetail'; params: { listId: string; ownerId: string } };

export interface NotificationActionData {
  eventType: NotificationEventType;
  friendRowId?: string;
  conversationId?: string;
  listId?: string;
  ownerId?: string;
  itemId?: string;
  [key: string]: unknown;
}

export interface InAppNotificationPayload {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  navigationTarget?: NotificationNavigationTarget;
  data?: NotificationActionData;
}

export interface NotificationEventMeta {
  type: NotificationEventType;
  label: string;
  description: string;
  icon: string;
  categoryId: NotificationCategoryId;
  variables: { key: string; label: string; sample: string }[];
  supportsActions: boolean;
  actionSummary: string;
}
