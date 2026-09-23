import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useFriends } from '../hooks/useFriends';
import { useConversations } from '../hooks/useConversations';
import { UserService } from '../services/UserService';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import { Friend, UserProfile } from '../types/models';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';

/**
 * FriendsScreen
 * ---------------------------------------------------------------------------
 * Manages the user's social graph: search for other users by email, send
 * friend requests, accept/decline incoming requests, remove existing
 * friends, and jump into a direct-message conversation with a friend.
 *
 * Navigation:
 * - Route: `AppStackParamList['Friends']`, no params.
 * - "Message" action navigates into the nested Messages tab navigator via
 *   `navigation.navigate('MessagesTab', { screen: 'Conversation', params: { conversationId } })`
 *   — this screen lives in the Friends tab's own stack, so reaching the
 *   Conversation screen (which belongs to the Messages tab's stack) requires
 *   navigating through the tab navigator rather than a direct stack push.
 *   The `as any` cast is needed because `AppStackParamList` (this stack's
 *   param list) doesn't itself know about `TabParamList`/`MessagesStack`'s
 *   nested screens.
 *
 * Data/business rules:
 * - Friend list + pending requests come from `useFriends(user?.uid)`
 *   (-> `FriendService.listenToFriends`), split into `accepted` and
 *   `pending` by `status`.
 * - A pending request row shows Accept/Decline actions only to the
 *   recipient (`!isRequester`); the requester just sees "Request sent".
 * - Search results exclude the current user and are cross-checked against
 *   both accepted and pending relationships so an "Add" button isn't shown
 *   for someone already friended or already invited.
 */
type NavProp = StackNavigationProp<AppStackParamList>;

export const FriendsScreen = ({ navigation }: { navigation: NavProp }) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { accepted, pending, loading, sendRequest, acceptRequest, declineRequest, removeFriend } = useFriends(user?.uid);
  const { openConversation } = useConversations(user?.uid);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  /**
   * Searches for users by (partial) email via
   * `UserService.searchUsersByEmail` (case-insensitive `ilike` match,
   * limited to 10 results server-side), then filters the current user out
   * of the results client-side so you can never "friend request" yourself.
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await UserService.searchUsersByEmail(searchQuery.trim());
      setSearchResults(results.filter(r => r.id !== user?.uid));
    } catch (err) {
      Alert.alert('Error', 'Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  };

  /**
   * Sends a friend request to `targetId` via `useFriends().sendRequest`
   * (-> `FriendService.sendRequest`, inserts a `friends` row with
   * `status: 'pending'`). Clears the search results/query on success so the
   * dropdown closes and the search box resets, encouraging the user to
   * check the Requests tab rather than re-searching.
   */
  const handleSendRequest = async (targetId: string) => {
    try {
      await sendRequest(targetId);
      Alert.alert('Request Sent', 'Friend request sent!');
      setSearchResults([]);
      setSearchQuery('');
    } catch {
      Alert.alert('Error', 'Could not send friend request.');
    }
  };

  /**
   * Opens (or lazily creates) a direct-message conversation with a friend
   * via `useConversations().openConversation` (-> `MessageService.
   * getOrCreateConversation`, a Supabase RPC that finds an existing 1:1
   * conversation between the two users or creates one), then navigates into
   * it through the MessagesTab nested navigator — see the screen-level doc
   * comment above for why the nested `navigate` call is needed here.
   */
  const handleMessage = async (friendUserId: string) => {
    try {
      const convId = await openConversation(friendUserId);
      navigation.navigate('MessagesTab', { screen: 'Conversation', params: { conversationId: convId } } as any);
    } catch {
      Alert.alert('Error', 'Could not open conversation.');
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const name = item.profile?.displayName || item.profile?.email || 'Unknown';
    const isRequester = item.userId === user?.uid;

    if (item.status === 'pending') {
      return (
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName}>{name}</Text>
            <Text style={[styles.rowSub, { color: colors.textDim }]}>
              {isRequester ? 'Request sent' : 'Wants to be friends'}
            </Text>
          </View>
          {!isRequester && (
            <View style={styles.rowActions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => acceptRequest(item.id)}>
                <FontAwesome5 name="check" size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.border }]} onPress={() => declineRequest(item.id)}>
                <FontAwesome5 name="times" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={[styles.rowSub, { color: colors.textDim }]}>{item.profile?.email}</Text>
        </View>
        <View style={styles.rowActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleMessage(item.userId === user?.uid ? item.friendId : item.userId)}>
            <FontAwesome5 name="comment" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff4444' }]} onPress={() => Alert.alert('Remove Friend', `Remove ${name}?`, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeFriend(item.id) }])}>
            <FontAwesome5 name="user-times" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: UserProfile }) => {
    const name = item.displayName || item.email;
    const alreadyFriend = [...accepted, ...pending].some(f => f.userId === item.id || f.friendId === item.id);
    return (
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={[styles.rowSub, { color: colors.textDim }]}>{item.email}</Text>
        </View>
        {!alreadyFriend && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleSendRequest(item.id)}>
            <FontAwesome5 name="user-plus" size={14} color="#fff" />
          </TouchableOpacity>
        )}
        {alreadyFriend && <Text style={[styles.rowSub, { color: colors.textDim }]}>Added</Text>}
      </View>
    );
  };

  const listData = tab === 'friends' ? accepted : pending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FontAwesome5 name="search" size={16} color={colors.textDim} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by email..."
          placeholderTextColor={colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="search"
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {searchResults.length > 0 && (
        <View style={[styles.searchDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList data={searchResults} keyExtractor={r => r.id} renderItem={renderSearchResult} />
          <TouchableOpacity onPress={() => setSearchResults([])} style={styles.closeSearch}>
            <Text style={{ color: colors.textDim }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['friends', 'requests'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textDim }]}>
              {t === 'friends' ? `Friends (${accepted.length})` : `Requests (${pending.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          renderItem={renderFriend}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textDim }]}>
              {tab === 'friends' ? 'No friends yet. Search by email to add someone!' : 'No pending requests.'}
            </Text>
          }
        />
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', margin: 16, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  searchDropdown: {
    marginHorizontal: 16, borderRadius: 12, borderWidth: 1,
    maxHeight: 240, marginBottom: 8,
  },
  closeSearch: { padding: 12, alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 80 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
});
