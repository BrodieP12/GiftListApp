import * as Notifications from 'expo-notifications';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import { FriendService } from './FriendService';
import { MessageService } from './MessageService';
import { UserService } from './UserService';
import { CrashLogger } from './LoggingService';
import { NotificationService, resolveNavigationTarget } from './NotificationService';
import {
  InAppNotificationPayload,
  NotificationActionData,
  NotificationNavigationTarget,
  NotificationPreferences,
} from '../types/notifications';

const MAX_SEEN_KEYS = 200;

export interface NotificationListenerOptions {
  userId: string;
  getPreferences: () => NotificationPreferences | null | undefined;
  onInAppNotification: (payload: InAppNotificationPayload) => void;
  onNavigate: (target: NotificationNavigationTarget) => void;
}

interface ListSummary {
  id: string;
  title: string;
  ownerId: string;
  isPrivate: boolean;
  isArchived: boolean;
}

interface ListenerContext {
  userId: string;
  getPreferences: () => NotificationPreferences | null | undefined;
  onInAppNotification: (payload: InAppNotificationPayload) => void;
  onNavigate: (target: NotificationNavigationTarget) => void;
  markSeen: (key: string) => boolean;
  getDisplayName: (uid: string) => Promise<string>;
  getListSummary: (listId: string) => Promise<ListSummary | null>;
  isListMember: (listId: string) => Promise<boolean>;
  setListMembership: (listId: string, isMember: boolean) => void;
  updateListCache: (row: Record<string, any>) => void;
  isConversationParticipant: (conversationId: string) => Promise<boolean>;
  getItemSummary: (itemId: string) => Promise<{ name: string; listId: string } | null>;
}

/**
 * Tracks recently processed event keys with bounded capacity to prevent
 * duplicate notifications from reconnects or overlapping events.
 */
function createSeenTracker(limit = MAX_SEEN_KEYS): (key: string) => boolean {
  const seen = new Set<string>();
  return (key: string) => {
    if (seen.has(key)) return false;
    if (seen.size >= limit) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    seen.add(key);
    return true;
  };
}

function createListenerContext(options: NotificationListenerOptions): ListenerContext {
  const markSeen = createSeenTracker();
  const profileNameCache = new Map<string, string>();
  const listCache = new Map<string, ListSummary>();
  const joinedListCache = new Map<string, boolean>();
  const conversationCache = new Map<string, boolean>();

  const getDisplayName = async (uid: string): Promise<string> => {
    const cached = profileNameCache.get(uid);
    if (cached) return cached;

    try {
      const profiles = await UserService.getUserProfiles([uid]);
      const p = profiles[0];
      const fullName = p ? `${p.givenName} ${p.familyName}`.trim() : '';
      const resolved = p?.displayName || fullName || p?.email || 'Someone';
      profileNameCache.set(uid, resolved);
      return resolved;
    } catch {
      return 'Someone';
    }
  };

  const getListSummary = async (listId: string): Promise<ListSummary | null> => {
    const cached = listCache.get(listId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('lists')
      .select('id, title, owner_id, is_private, is_archived')
      .eq('id', listId)
      .maybeSingle();

    if (error || !data) return null;
    const summary: ListSummary = {
      id: data.id,
      title: data.title ?? 'Gift List',
      ownerId: data.owner_id,
      isPrivate: Boolean(data.is_private),
      isArchived: Boolean(data.is_archived),
    };
    listCache.set(listId, summary);
    return summary;
  };

  const isListMember = async (listId: string): Promise<boolean> => {
    // Only cache confirmed memberships so joining a list mid-session takes effect immediately.
    if (joinedListCache.get(listId) === true) {
      return true;
    }

    const { data, error } = await supabase
      .from('list_members')
      .select('id')
      .eq('list_id', listId)
      .eq('user_id', options.userId)
      .eq('role', 'member')
      .maybeSingle();

    const isMember = !error && Boolean(data);
    if (isMember) {
      joinedListCache.set(listId, true);
    }
    return isMember;
  };

  const setListMembership = (listId: string, isMember: boolean): void => {
    if (isMember) {
      joinedListCache.set(listId, true);
    } else {
      joinedListCache.delete(listId);
    }
  };

  const updateListCache = (row: Record<string, any>): void => {
    if (!row?.id) return;
    if (row.owner_id) {
      listCache.set(row.id, {
        id: row.id,
        title: row.title ?? 'Gift List',
        ownerId: row.owner_id,
        isPrivate: Boolean(row.is_private),
        isArchived: Boolean(row.is_archived),
      });
    } else {
      listCache.delete(row.id);
    }
  };

  const isConversationParticipant = async (conversationId: string): Promise<boolean> => {
    if (conversationCache.get(conversationId)) return true;

    const { data, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', options.userId)
      .maybeSingle();

    const participates = !error && Boolean(data);
    if (participates) {
      conversationCache.set(conversationId, true);
    }
    return participates;
  };

  const getItemSummary = async (
    itemId: string
  ): Promise<{ name: string; listId: string } | null> => {
    const { data, error } = await supabase
      .from('items')
      .select('name, list_id')
      .eq('id', itemId)
      .maybeSingle();

    if (error || !data) return null;
    return { name: data.name ?? 'Gift Item', listId: data.list_id };
  };

  return {
    ...options,
    markSeen,
    getDisplayName,
    getListSummary,
    isListMember,
    setListMembership,
    updateListCache,
    isConversationParticipant,
    getItemSummary,
  };
}

async function handleFriendChange(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  ctx: ListenerContext
): Promise<void> {
  const row = payload.new as Record<string, any>;
  if (!row?.id) return;

  if (payload.eventType === 'INSERT') {
    if (row.addressee_id !== ctx.userId || row.status !== 'pending') return;
    if (!ctx.markSeen(`friend_req:${row.id}`)) return;

    const senderName = await ctx.getDisplayName(row.requester_id);
    await NotificationService.dispatchNotification({
      eventType: 'friend_request_received',
      variables: { senderName },
      data: { eventType: 'friend_request_received', friendRowId: row.id },
      preferences: ctx.getPreferences(),
      onInAppNotify: ctx.onInAppNotification,
    });
    return;
  }

  if (payload.eventType === 'UPDATE') {
    const prevStatus = (payload.old as Record<string, any> | undefined)?.status;
    if (row.requester_id !== ctx.userId || row.status !== 'accepted') return;
    if (prevStatus === 'accepted') return;
    if (!ctx.markSeen(`friend_acc:${row.id}`)) return;

    const friendName = await ctx.getDisplayName(row.addressee_id);
    await NotificationService.dispatchNotification({
      eventType: 'friend_request_accepted',
      variables: { friendName },
      data: { eventType: 'friend_request_accepted', friendRowId: row.id },
      preferences: ctx.getPreferences(),
      onInAppNotify: ctx.onInAppNotification,
    });
  }
}

async function handleMessageInsert(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  ctx: ListenerContext
): Promise<void> {
  const row = payload.new as Record<string, any>;
  if (!row?.id || !row.conversation_id) return;
  if (row.sender_id === ctx.userId) return;

  const isParticipant = await ctx.isConversationParticipant(row.conversation_id);
  if (!isParticipant) return;
  if (!ctx.markSeen(`msg:${row.id}`)) return;

  const senderName = await ctx.getDisplayName(row.sender_id);
  await NotificationService.dispatchNotification({
    eventType: 'new_message',
    variables: {
      senderName,
      messagePreview: row.content ?? 'Sent you a message',
    },
    data: {
      eventType: 'new_message',
      conversationId: row.conversation_id,
    },
    preferences: ctx.getPreferences(),
    onInAppNotify: ctx.onInAppNotification,
  });
}

async function handleItemInsert(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  ctx: ListenerContext
): Promise<void> {
  const row = payload.new as Record<string, any>;
  if (!row?.id || !row.list_id) return;
  if (row.owner_id === ctx.userId) return;

  const list = await ctx.getListSummary(row.list_id);
  if (!list || list.ownerId === ctx.userId || list.isArchived || list.isPrivate) return;

  const isMember = await ctx.isListMember(row.list_id);
  if (!isMember) return;
  if (!ctx.markSeen(`item_add:${row.id}`)) return;

  const senderName = await ctx.getDisplayName(list.ownerId);
  await NotificationService.dispatchNotification({
    eventType: 'shared_list_item_added',
    variables: {
      senderName,
      listTitle: list.title,
      itemName: row.name ?? 'New item',
    },
    data: {
      eventType: 'shared_list_item_added',
      listId: list.id,
      ownerId: list.ownerId,
      itemId: row.id,
    },
    preferences: ctx.getPreferences(),
    onInAppNotify: ctx.onInAppNotification,
  });
}

async function handleListMemberInsert(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  ctx: ListenerContext
): Promise<void> {
  const row = payload.new as Record<string, any>;
  if (!row?.list_id || !row.user_id) return;
  if (row.user_id === ctx.userId) {
    if (row.role === 'member') {
      ctx.setListMembership(row.list_id, true);
    }
    return;
  }

  const list = await ctx.getListSummary(row.list_id);
  if (!list || list.ownerId !== ctx.userId) return;
  if (!ctx.markSeen(`member_join:${row.list_id}:${row.user_id}`)) return;

  const memberName = await ctx.getDisplayName(row.user_id);
  await NotificationService.dispatchNotification({
    eventType: 'list_member_joined',
    variables: {
      memberName,
      listTitle: list.title,
    },
    data: {
      eventType: 'list_member_joined',
      listId: list.id,
      ownerId: list.ownerId,
    },
    preferences: ctx.getPreferences(),
    onInAppNotify: ctx.onInAppNotification,
  });
}

function handleListMemberDelete(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  ctx: ListenerContext
): void {
  const oldRow = payload.old as Record<string, any> | undefined;
  if (!oldRow?.list_id) return;
  if (!oldRow.user_id || oldRow.user_id === ctx.userId) {
    ctx.setListMembership(oldRow.list_id, false);
  }
}

async function handleClaimChange(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  ctx: ListenerContext
): Promise<void> {
  const isInsert = payload.eventType === 'INSERT';
  const row = (isInsert ? payload.new : payload.old) as Record<string, any>;
  if (!row?.item_id) return;

  // Never spoil the list owner's surprise.
  if (row.list_owner_id === ctx.userId) return;
  if (isInsert && row.claimed_by === ctx.userId) return;

  const item = await ctx.getItemSummary(row.item_id);
  if (!item) return;

  const list = await ctx.getListSummary(item.listId);
  if (!list || list.ownerId === ctx.userId) return;

  const isMember = await ctx.isListMember(list.id);
  if (!isMember) return;

  const dedupeKey = isInsert
    ? `claim_in:${row.item_id}:${row.claimed_at ?? ''}`
    : `claim_del:${row.item_id}:${Math.floor(Date.now() / 2000)}`;
  if (!ctx.markSeen(dedupeKey)) return;

  const eventType = isInsert ? 'item_claimed' : 'item_unclaimed';
  await NotificationService.dispatchNotification({
    eventType,
    variables: {
      listTitle: list.title,
      itemName: item.name,
    },
    data: {
      eventType,
      listId: list.id,
      ownerId: list.ownerId,
      itemId: row.item_id,
    },
    preferences: ctx.getPreferences(),
    onInAppNotify: ctx.onInAppNotification,
  });
}

async function dismissSafe(notificationId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch {
    // Non-blocking if already dismissed by OS
  }
}

/**
 * Processes Android/iOS notification button presses and taps.
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  ctx: Pick<ListenerContext, 'userId' | 'onNavigate' | 'markSeen'>
): Promise<void> {
  const notificationId = response.notification.request.identifier;
  const actionId = response.actionIdentifier;
  if (!ctx.markSeen(`resp:${notificationId}:${actionId}`)) return;

  const data = response.notification.request.content.data as NotificationActionData | undefined;
  const isTest = Boolean(data?.isTest);

  try {
    switch (actionId) {
      case 'ACCEPT_FRIEND':
        if (!isTest && data?.friendRowId) {
          await FriendService.acceptRequest(data.friendRowId);
        }
        await dismissSafe(notificationId);
        return;

      case 'DECLINE_FRIEND':
        if (!isTest && data?.friendRowId) {
          await FriendService.declineRequest(data.friendRowId);
        }
        await dismissSafe(notificationId);
        return;

      case 'REPLY_MESSAGE': {
        const replyText = response.userText?.trim();
        if (!isTest && data?.conversationId && replyText) {
          await MessageService.sendMessage(data.conversationId, ctx.userId, replyText);
        }
        await dismissSafe(notificationId);
        return;
      }

      case 'DISMISS':
        await dismissSafe(notificationId);
        return;

      case 'VIEW_FRIENDS':
      case 'OPEN_CHAT':
      case 'VIEW_LIST':
      case Notifications.DEFAULT_ACTION_IDENTIFIER: {
        const target = resolveNavigationTarget(data);
        if (target) {
          ctx.onNavigate(target);
        }
        return;
      }

      default:
        return;
    }
  } catch (err) {
    CrashLogger.error(err, `notificationListener.handleNotificationResponse:${actionId}`);
  }
}

/**
 * Starts listening for Supabase Realtime domain events and interactive Android
 * notification action responses for the signed-in user.
 *
 * @returns Cleanup function that unsubscribes both the Realtime channel and response listener.
 */
export function startNotificationListener(options: NotificationListenerOptions): () => void {
  const ctx = createListenerContext(options);
  let isDisposed = false;

  const safeRun = (label: string, task: () => Promise<void>) => {
    if (isDisposed) return;
    task().catch((err) => CrashLogger.error(err, `notificationListener.${label}`));
  };

  const channel: RealtimeChannel = supabase
    .channel(`notifications:user:${options.userId}:${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends' }, (payload) =>
      safeRun('friends.insert', () => handleFriendChange(payload, ctx))
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friends' }, (payload) =>
      safeRun('friends.update', () => handleFriendChange(payload, ctx))
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
      safeRun('messages.insert', () => handleMessageInsert(payload, ctx))
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items' }, (payload) =>
      safeRun('items.insert', () => handleItemInsert(payload, ctx))
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lists' }, (payload) => {
      if (!isDisposed) {
        ctx.updateListCache(payload.new as Record<string, any>);
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'list_members' }, (payload) =>
      safeRun('list_members.insert', () => handleListMemberInsert(payload, ctx))
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'list_members' }, (payload) => {
      if (!isDisposed) {
        handleListMemberDelete(payload, ctx);
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'claims' }, (payload) =>
      safeRun('claims.insert', () => handleClaimChange(payload, ctx))
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'claims' }, (payload) =>
      safeRun('claims.delete', () => handleClaimChange(payload, ctx))
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        CrashLogger.error(
          err ?? new Error(`Realtime notification channel status: ${status}`),
          `notificationListener.channel:${status}`
        );
      }
    });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    safeRun('responseReceived', () => handleNotificationResponse(response, ctx));
  });

  // Handle cold-start notification launch/action if the app was opened from a notification.
  Notifications.getLastNotificationResponseAsync()
    .then((lastResponse) => {
      if (lastResponse && !isDisposed) {
        return handleNotificationResponse(lastResponse, ctx);
      }
      return undefined;
    })
    .catch((err) => CrashLogger.error(err, 'notificationListener.getLastNotificationResponseAsync'));

  return () => {
    isDisposed = true;
    supabase.removeChannel(channel);
    responseSubscription.remove();
  };
}
