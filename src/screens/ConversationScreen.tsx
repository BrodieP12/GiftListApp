import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { StackScreenProps } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useConversations';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import { Message } from '../types/models';

/**
 * ConversationScreen
 * ---------------------------------------------------------------------------
 * The one-on-one chat view for a single conversation thread between the
 * current user and a friend. Displays message history (oldest to newest)
 * and lets the user compose and send new messages in real time.
 *
 * Navigation:
 * - Route: `AppStackParamList['Conversation']` — expects
 *   `{ conversationId: string }` in `route.params`. Reached from
 *   `ConversationsScreen` (tapping an existing thread) or from
 *   `FriendsScreen`'s message button via
 *   `navigation.navigate('MessagesTab', { screen: 'Conversation', params: { conversationId } })`
 *   through the nested MessagesTab navigator.
 * - Produces: no return params.
 *
 * Data/business rules:
 * - Messages and loading state come from `useMessages(conversationId)`
 *   (src/hooks/useConversations.ts), which subscribes to
 *   `MessageService.listenToMessages` for realtime updates via Supabase.
 * - Sending is blocked while a send is already in flight (`sending`) or the
 *   draft is empty/whitespace-only.
 * - There is no participant/authorization check in this screen itself —
 *   access to a conversation's messages is enforced server-side by Supabase
 *   RLS on the `messages`/`conversation_participants` tables.
 */
type Props = StackScreenProps<AppStackParamList, 'Conversation'>;

export const ConversationScreen = ({ route }: Props) => {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { messages, loading, sendMessage } = useMessages(conversationId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Auto-scroll to the newest message whenever the message count changes
  // (initial load or a new message arriving via the realtime subscription),
  // so the user is always looking at the latest part of the conversation.
  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  /**
   * Sends the current draft as a new message via `useMessages().sendMessage`
   * (-> `MessageService.sendMessage`, an insert into the `messages` table).
   *
   * The draft is cleared optimistically before the network call resolves so
   * the input feels responsive; if the send fails the text is not restored
   * (errors are only logged/rethrown by the hook, not surfaced here as an
   * alert — a known gap rather than an intentional UX choice).
   */
  const handleSend = async () => {
    if (!draft.trim() || !user?.uid) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      await sendMessage(user.uid, text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, { color: isMe ? '#fff' : colors.text }]}>
          {item.content}
        </Text>
        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textDim }]}>
          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textDim }]}>No messages yet. Say hello!</Text>
          }
        />
      )}

      <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          placeholder="Message..."
          placeholderTextColor={colors.textDim}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: draft.trim() ? colors.primary : colors.border }]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <FontAwesome5 name="paper-plane" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '78%', padding: 10, borderRadius: 16, marginBottom: 8,
  },
  bubbleMe: {
    alignSelf: 'flex-end', backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start', backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, fontSize: 15, maxHeight: 100, marginRight: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
});
