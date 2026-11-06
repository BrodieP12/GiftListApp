import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import { Conversation } from '../types/models';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';

/**
 * ConversationsScreen
 * ---------------------------------------------------------------------------
 * The inbox / thread list for direct messages: shows every conversation the
 * current user participates in, each row previewing the other participant's
 * name and the most recent message.
 *
 * Navigation:
 * - Route: no params required (`AppStackParamList['Conversations']` is
 *   `undefined`). This is the landing screen of the Messages tab.
 * - Tapping a row navigates to `Conversation` with
 *   `{ conversationId: item.id }`.
 * - New conversations are not started from this screen — a user starts one
 *   by tapping the message icon on a friend in `FriendsScreen`, which calls
 *   `useConversations().openConversation` (get-or-create) and then navigates
 *   here/into the thread directly.
 *
 * Data:
 * - Backed by `useConversations(user?.uid)`, which subscribes to
 *   `MessageService.listenToConversations` for realtime updates (new
 *   messages, new participants) via Supabase.
 * - Only shows the *first* other participant's name (`item.participants[0]`)
 *   — conversations are effectively 1:1 in this UI even though the data
 *   model (`Conversation.participants: UserProfile[]`) could support more.
 */
type NavProp = StackNavigationProp<AppStackParamList>;

export const ConversationsScreen = ({ navigation }: { navigation: NavProp }) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { conversations, loading } = useConversations(user?.uid);

  // Renders one inbox row. Falls back to email, then "Unknown", if the other
  // participant has no display name set on their profile.
  const renderItem = ({ item }: { item: Conversation }) => {
    const other = item.participants[0];
    const name = other?.displayName || other?.email || 'Unknown';
    const lastMsg = item.lastMessage?.content ?? 'No messages yet';
    const initials = name.charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={[styles.rowSub, { color: colors.textDim }]} numberOfLines={1}>{lastMsg}</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={14} color={colors.textDim} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome5 name="comment-slash" size={40} color={colors.textDim} />
              <Text style={[styles.emptyText, { color: colors.textDim }]}>No conversations yet.</Text>
              <Text style={[styles.emptyHint, { color: colors.textDim }]}>Go to Friends and tap the message icon.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 80 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, marginTop: 2 },
  empty: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptyHint: { fontSize: 14, textAlign: 'center' },
});
