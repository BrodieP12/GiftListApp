import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useAuth } from '../hooks/useAuth';
import { useLists } from '../hooks/useLists';
import { useAppTheme } from '../theme/ThemeContext';
import { GiftList } from '../types/models';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { Button } from '../components/common/Button';
import { CreateListModal } from '../components/modals/CreateList';
import { ShareCodeModal } from '../components/modals/ShareCodeModal';
import { FontAwesome5 } from '@expo/vector-icons';
import { GiftListRow } from '../components/lists/GiftListRow';
import { ConfirmationModal } from '../components/modals/Confirmation';
import { CrashLogger } from '../services/LoggingService';

/**
 * DashboardScreen
 * ---------------------------------------------------------------------------
 * The "My Lists" home screen and landing tab of the app. Shows two sections:
 * lists the current user owns ("My Lists") and lists they've joined via a
 * share code ("Shared With Me"). Lets the user create a new list, join an
 * existing one by code, or delete one of their own lists.
 *
 * Navigation:
 * - Route: `AppStackParamList['Dashboard']`, no params.
 * - Tapping a list row navigates to `ListDetail` with
 *   `{ listId: item.id, ownerId: item.ownerId }`.
 *
 * Data/business rules:
 * - Backed by `useLists(user?.uid)`, which merges two realtime Supabase
 *   subscriptions (`listenToOwnedLists`, `listenToSharedLists`); `loading`
 *   only clears once both have reported in at least once.
 * - Only the owner of a list sees a delete affordance on its row
 *   (`item.ownerId === user?.uid`); shared/joined lists cannot be deleted by
 *   non-owners from this screen.
 * - Joining a list is done purely by a 7-character share code (uppercased
 *   and capped at 7 chars in the join modal) via `ListService.joinListByCode`
 *   -> the `join_list_by_code` Supabase RPC, which performs the actual
 *   membership check/insert server-side.
 */
type DashboardNavProp = StackNavigationProp<AppStackParamList, 'Dashboard'>;

export const DashboardScreen = ({ navigation }: { navigation: DashboardNavProp }) => {
  const { user } = useAuth();
  const { ownedLists, sharedLists, loading, createList, deleteList, joinList } = useLists(user?.uid);
  const { colors } = useAppTheme();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [shareCodeModalVisible, setShareCodeModalVisible] = useState(false);
  const [pendingShareCode, setPendingShareCode] = useState('');

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  /**
   * Creates a new gift list owned by the current user via
   * `useLists().createList` -> `ListService.createList`.
   *
   * If the list is created as sharable, the server generates a random
   * 7-character share code, which we immediately show the user in a
   * dedicated modal (`ShareCodeModal`) since it's their only chance to see
   * it right after creation without navigating into ListEdit.
   */
  const handleCreateList = async (name: string, isSharable: boolean) => {
    setCreateLoading(true);
    try {
      const result = await createList(name, isSharable);
      setCreateModalVisible(false);
      if (result.shareCode) {
        setPendingShareCode(result.shareCode);
        setShareCodeModalVisible(true);
      }
    } catch (error) {
      CrashLogger.error(error, 'DashboardScreen.createList');
      Alert.alert('Error', (error as Error).message || 'Failed to create list');
    } finally {
      setCreateLoading(false);
    }
  };

  /**
   * Joins a shared list by its share code, entered by the user in the "Join
   * a List" modal. The code is trimmed and force-uppercased (share codes are
   * generated as uppercase alphanumeric — see `ListService.generateShareCode`)
   * before being sent to `ListService.joinListByCode`. An invalid/unknown
   * code surfaces the server's error message (or a generic fallback) rather
   * than failing silently.
   */
  const handleJoinList = async () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    try {
      await joinList(joinCode.trim().toUpperCase());
      setJoinModalVisible(false);
      setJoinCode('');
      Alert.alert('Joined!', 'You now have access to that list.');
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Invalid share code.');
    } finally {
      setJoinLoading(false);
    }
  };

  // Stages a list for deletion and opens the confirmation modal; the actual
  // delete only happens in handleConfirmDelete after the user confirms, to
  // avoid an accidental tap destroying a list (deletion is irreversible and
  // cascades to its items/claims server-side).
  const handleDeletePress = (id: string) => {
    setDeleteTargetId(id);
    setConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteList(deleteTargetId);
    } catch (error) {
      CrashLogger.error(error, 'DashboardScreen.deleteList');
      Alert.alert('Error', 'Failed to delete list');
    } finally {
      setConfirmVisible(false);
      setDeleteTargetId(null);
    }
  };

  const renderList = ({ item }: { item: GiftList }) => (
    <GiftListRow
      list={item}
      onPress={() => navigation.navigate('ListDetail', { listId: item.id, ownerId: item.ownerId })}
      onDelete={item.ownerId === user?.uid ? handleDeletePress : undefined}
    />
  );

  type SectionItem =
    | { type: 'header'; label: string }
    | { type: 'list'; data: GiftList }
    | { type: 'empty'; label: string };

  const sections: SectionItem[] = [];

  sections.push({ type: 'header', label: 'My Lists' });
  if (ownedLists.length === 0) {
    sections.push({ type: 'empty', label: 'No lists yet. Tap + to create one!' });
  } else {
    ownedLists.forEach(l => sections.push({ type: 'list', data: l }));
  }

  if (sharedLists.length > 0) {
    sections.push({ type: 'header', label: 'Shared With Me' });
    sharedLists.forEach(l => sections.push({ type: 'list', data: l }));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={[styles.sectionTitle, { color: colors.text }]}>{item.label}</Text>;
            }
            if (item.type === 'empty') {
              return <Text style={[styles.empty, { color: colors.textDim }]}>{item.label}</Text>;
            }
            return renderList({ item: item.data });
          }}
        />
      )}

      {/* FABs */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, right: 24 }]}
        onPress={() => setCreateModalVisible(true)}
      >
        <FontAwesome5 name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, right: 90 }]}
        onPress={() => setJoinModalVisible(true)}
      >
        <FontAwesome5 name="sign-in-alt" size={20} color={colors.primary} />
      </TouchableOpacity>

      <CreateListModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateList}
        loading={createLoading}
      />

      <ShareCodeModal
        visible={shareCodeModalVisible}
        shareCode={pendingShareCode}
        onClose={() => setShareCodeModalVisible(false)}
      />

      {/* Join by Share Code Modal */}
      <ConfirmationModal
        visible={joinModalVisible}
        title="Join a List"
        message=""
        onConfirm={handleJoinList}
        onCancel={() => { setJoinModalVisible(false); setJoinCode(''); }}
        confirmText={joinLoading ? 'Joining...' : 'Join'}
        customContent={
          <TextInput
            style={[styles.joinInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Enter 7-digit code (e.g. ABC1234)"
            placeholderTextColor={colors.textDim}
            value={joinCode}
            onChangeText={t => setJoinCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={7}
          />
        }
      />

      <ConfirmationModal
        visible={confirmVisible}
        title="Delete List"
        message="Are you sure you want to delete this list? This cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20, paddingBottom: 120 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  empty: { textAlign: 'center', marginVertical: 20 },
  fab: {
    position: 'absolute', bottom: 30, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  joinInput: {
    borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 18,
    fontWeight: '700', textAlign: 'center', letterSpacing: 4, marginTop: 4,
  },
});
