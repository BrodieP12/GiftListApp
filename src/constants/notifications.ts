import {
  NotificationCategoryId,
  NotificationEventConfig,
  NotificationEventMeta,
  NotificationEventType,
  NotificationKind,
  NotificationPreferences,
} from '../types/notifications';

export const ANDROID_CHANNEL_IDS: Record<Exclude<NotificationKind, 'in_app'>, string> = {
  urgent: 'giftlist_urgent',
  standard: 'giftlist_standard',
  silent: 'giftlist_silent',
};

export const NOTIFICATION_KIND_OPTIONS: {
  value: NotificationKind;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'urgent',
    label: 'Heads-Up',
    description: 'Pop-over banner, sound, and vibration',
    icon: 'bell',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Notification tray with sound',
    icon: 'volume-up',
  },
  {
    value: 'silent',
    label: 'Silent',
    description: 'Quietly placed in notification tray',
    icon: 'volume-mute',
  },
  {
    value: 'in_app',
    label: 'In-App Only',
    description: 'Banner shown inside the app while open',
    icon: 'mobile-alt',
  },
];

export const NOTIFICATION_CATEGORIES: Record<string, NotificationCategoryId> = {
  FRIEND_REQUEST: 'friend_request',
  DIRECT_MESSAGE: 'direct_message',
  LIST_ACTIVITY: 'list_activity',
};

export const DEFAULT_EVENT_CONFIGS: Record<NotificationEventType, NotificationEventConfig> = {
  friend_request_received: {
    enabled: true,
    kind: 'urgent',
    titleTemplate: 'New Friend Request',
    bodyTemplate: '{{senderName}} sent you a friend request.',
    includeActions: true,
  },
  friend_request_accepted: {
    enabled: true,
    kind: 'standard',
    titleTemplate: 'Friend Request Accepted',
    bodyTemplate: '{{friendName}} accepted your friend request!',
    includeActions: true,
  },
  new_message: {
    enabled: true,
    kind: 'urgent',
    titleTemplate: 'Message from {{senderName}}',
    bodyTemplate: '{{messagePreview}}',
    includeActions: true,
  },
  shared_list_item_added: {
    enabled: true,
    kind: 'standard',
    titleTemplate: 'New Gift on {{listTitle}}',
    bodyTemplate: '{{senderName}} added "{{itemName}}" to {{listTitle}}.',
    includeActions: true,
  },
  list_member_joined: {
    enabled: true,
    kind: 'standard',
    titleTemplate: 'New List Member',
    bodyTemplate: '{{memberName}} joined your list "{{listTitle}}".',
    includeActions: true,
  },
  item_claimed: {
    enabled: false,
    kind: 'silent',
    titleTemplate: 'Item Claimed on {{listTitle}}',
    bodyTemplate: 'Someone claimed "{{itemName}}" on {{listTitle}}.',
    includeActions: true,
  },
  item_unclaimed: {
    enabled: false,
    kind: 'silent',
    titleTemplate: 'Item Available on {{listTitle}}',
    bodyTemplate: '"{{itemName}}" on {{listTitle}} is available again.',
    includeActions: true,
  },
};

export function createDefaultNotificationPreferences(): NotificationPreferences {
  const events = {} as Record<NotificationEventType, NotificationEventConfig>;
  (Object.keys(DEFAULT_EVENT_CONFIGS) as NotificationEventType[]).forEach((key) => {
    events[key] = { ...DEFAULT_EVENT_CONFIGS[key] };
  });
  return {
    globalEnabled: true,
    events,
  };
}

/**
 * Merges a partial or persisted preferences payload with defaults so newly
 * introduced event types always have valid configuration values.
 */
export function mergeNotificationPreferences(
  raw: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  const defaults = createDefaultNotificationPreferences();
  if (!raw || typeof raw !== 'object') return defaults;

  const events = { ...defaults.events };
  if (raw.events && typeof raw.events === 'object') {
    (Object.keys(DEFAULT_EVENT_CONFIGS) as NotificationEventType[]).forEach((eventType) => {
      const override = raw.events?.[eventType];
      if (override && typeof override === 'object') {
        events[eventType] = {
          enabled: typeof override.enabled === 'boolean' ? override.enabled : defaults.events[eventType].enabled,
          kind: override.kind ?? defaults.events[eventType].kind,
          titleTemplate:
            typeof override.titleTemplate === 'string' && override.titleTemplate.trim().length > 0
              ? override.titleTemplate
              : defaults.events[eventType].titleTemplate,
          bodyTemplate:
            typeof override.bodyTemplate === 'string' && override.bodyTemplate.trim().length > 0
              ? override.bodyTemplate
              : defaults.events[eventType].bodyTemplate,
          includeActions:
            typeof override.includeActions === 'boolean'
              ? override.includeActions
              : defaults.events[eventType].includeActions,
        };
      }
    });
  }

  return {
    globalEnabled: typeof raw.globalEnabled === 'boolean' ? raw.globalEnabled : defaults.globalEnabled,
    events,
  };
}

export const NOTIFICATION_EVENT_META: NotificationEventMeta[] = [
  {
    type: 'friend_request_received',
    label: 'Friend Requests',
    description: 'When someone sends you a new friend request.',
    icon: 'user-plus',
    categoryId: 'friend_request',
    supportsActions: true,
    actionSummary: 'Android buttons: Accept, Decline, View',
    variables: [{ key: 'senderName', label: 'Sender Name', sample: 'Alex' }],
  },
  {
    type: 'friend_request_accepted',
    label: 'Friend Accepted',
    description: 'When someone accepts your friend request.',
    icon: 'user-check',
    categoryId: 'list_activity',
    supportsActions: true,
    actionSummary: 'Android buttons: View, Dismiss',
    variables: [{ key: 'friendName', label: 'Friend Name', sample: 'Jordan' }],
  },
  {
    type: 'new_message',
    label: 'Direct Messages',
    description: 'When you receive a new direct message.',
    icon: 'comment-dots',
    categoryId: 'direct_message',
    supportsActions: true,
    actionSummary: 'Android buttons: Inline Reply, Open Chat',
    variables: [
      { key: 'senderName', label: 'Sender Name', sample: 'Taylor' },
      { key: 'messagePreview', label: 'Message', sample: 'Did you check out that wishlist item?' },
    ],
  },
  {
    type: 'shared_list_item_added',
    label: 'New Shared List Item',
    description: 'When a friend adds a gift to a shared list you joined.',
    icon: 'gift',
    categoryId: 'list_activity',
    supportsActions: true,
    actionSummary: 'Android buttons: View List, Dismiss',
    variables: [
      { key: 'senderName', label: 'Owner Name', sample: 'Sam' },
      { key: 'listTitle', label: 'List Title', sample: 'Birthday Ideas' },
      { key: 'itemName', label: 'Item Name', sample: 'Espresso Grinder' },
    ],
  },
  {
    type: 'list_member_joined',
    label: 'Member Joined Your List',
    description: 'When someone joins one of your shared lists using a share code.',
    icon: 'users',
    categoryId: 'list_activity',
    supportsActions: true,
    actionSummary: 'Android buttons: View List, Dismiss',
    variables: [
      { key: 'memberName', label: 'Member Name', sample: 'Casey' },
      { key: 'listTitle', label: 'List Title', sample: 'Holiday List' },
    ],
  },
  {
    type: 'item_claimed',
    label: 'Co-Member Claimed Item',
    description: 'When another member claims an item on a shared list (never shown to list owners).',
    icon: 'check-circle',
    categoryId: 'list_activity',
    supportsActions: true,
    actionSummary: 'Android buttons: View List, Dismiss',
    variables: [
      { key: 'listTitle', label: 'List Title', sample: 'Holiday List' },
      { key: 'itemName', label: 'Item Name', sample: 'Noise-Canceling Headphones' },
    ],
  },
  {
    type: 'item_unclaimed',
    label: 'Co-Member Unclaimed Item',
    description: 'When a claimed item on a shared list becomes available again (never shown to list owners).',
    icon: 'undo',
    categoryId: 'list_activity',
    supportsActions: true,
    actionSummary: 'Android buttons: View List, Dismiss',
    variables: [
      { key: 'listTitle', label: 'List Title', sample: 'Holiday List' },
      { key: 'itemName', label: 'Item Name', sample: 'Noise-Canceling Headphones' },
    ],
  },
];
