import React, {useEffect, useRef, useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { StackScreenProps } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useListDetail } from '../hooks/useListDetail';
import { useAppTheme } from '../theme/ThemeContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { GiftItemRow } from '../components/lists/GiftItemRow';
import { ItemDetailModal } from '../components/lists/ItemDetailModal';
import { CrashLogger } from '../services/LoggingService';
import { GiftItemUI, ItemClaim } from '../types/models';
import { ConfirmationModal } from '../components/modals/Confirmation';
import { ListService } from '../services/ListService';

/**
 * ListDetailScreen
 * ---------------------------------------------------------------------------
 * Shows the items on a single gift list, viewed either by the list's owner
 * (who manages items but must never see who has claimed what — see below)
 * or by a friend/guest who can claim items they intend to buy.
 *
 * Navigation:
 * - Route: `AppStackParamList['ListDetail']` — expects
 *   `{ listId: string; ownerId: string }` in `route.params`, both supplied
 *   by the caller (DashboardScreen row tap) since they're already known
 *   there and avoid an extra fetch just to determine ownership.
 * - Owner-only header "edit" button navigates to `ListEdit` with
 *   `{ listId }`.
 * - Owner-only FAB navigates to `AddItem` with `{ listId }`.
 *
 * Business rule — the core "surprise" guarantee of this app:
 * - `isOwner` is derived by comparing the signed-in user's id to the route's
 *   `ownerId`. `useListDetail` uses `isOwner` to decide whether to even
 *   subscribe to claim data at all: when the viewer *is* the owner, it skips
 *   the claims subscription entirely (see useListDetail.ts), so
 *   `item.claimStatus` is always null for the owner and the UI has no way to
 *   accidentally reveal who claimed what on their own list.
 * - Non-owners see claim status and can toggle their own claim
 *   (claim/unclaim) via `handleToggleClaim`, but only for themselves —
 *   `ClaimService`/RLS is the actual enforcement point preventing a user
 *   from unclaiming someone else's claim.
 */
type Props = StackScreenProps<AppStackParamList, 'ListDetail'>;

export const ListDetailScreen = ({ route, navigation }: Props) => {
  const { listId, ownerId } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GiftItemUI | null>(null);

  const currentUserId = user?.uid ?? '';
  const isOwner = currentUserId === ownerId;

  // Item list + claim-toggle logic extracted into useListDetail; notably it
  // only subscribes to claim data when !isOwner (see hook + comment above),
  // which is what actually keeps claims hidden from the list owner.
  const { items, loading, handleToggleClaim } = useListDetail(
    ownerId, listId, isOwner, currentUserId
  );

  // Stages an item for deletion and opens the confirmation modal; deletion
  // itself happens in handleConfirmDelete only after the owner confirms.
  const handleDeletePress = (id: string) => {
    setDeleteTargetId(id);
    setConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await ListService.deleteItem(listId, deleteTargetId);
    } catch (error) {
      CrashLogger.error(error);
      Alert.alert('Error', 'Failed to delete item');
    } finally {
      setConfirmVisible(false);
      setDeleteTargetId(null);
    }
  };
  // Removed obsolete dashboard components

  // Injects an "Edit" icon into the stack header, but only for the list
  // owner — non-owners (viewing via a share code) have no edit rights on
  // someone else's list, so the button simply isn't rendered for them.
  useEffect(() => {
    // Set Header button for Edit if owner
    if (isOwner) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity 
            onPress={() => navigation.navigate('ListEdit', { listId })}
            style={{ marginRight: 15 }}
          >
            <FontAwesome5 name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
        )
      });
    }
  }, [listId, ownerId, isOwner, navigation, colors.primary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          renderItem={({ item }) => (
            <GiftItemRow
                {...item}
                item={item}
                claim={(item.claimStatus || { claimedBy: '' }) as ItemClaim}
                onPress={() => setSelectedItem(item)}
                onDelete={handleDeletePress}
                currentUserId={currentUserId}
                isOwner={isOwner}
                onToggleClaim={handleToggleClaim}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textDim }]}>No items in this list yet.</Text>
            </View>
          }
        />
      )}

      {isOwner && (
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AddItem', { listId: listId })}
        >
          <FontAwesome5 name="plus" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.fabText}>Add Item</Text>
        </TouchableOpacity>
      )}

      <ConfirmationModal
        visible={confirmVisible}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />

      <ItemDetailModal
        item={selectedItem}
        isOwner={isOwner}
        currentUserId={currentUserId}
        onClose={() => setSelectedItem(null)}
        onToggleClaim={handleToggleClaim}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { fontSize: 16 },
  fab: {
    position: 'absolute', bottom: 30, right: 30, width: 120, height: 50, 
    borderRadius: 25, justifyContent: 'center', alignItems: 'center', 
    flexDirection: 'row', elevation: 5, shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

