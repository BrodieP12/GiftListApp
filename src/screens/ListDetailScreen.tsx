import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { GiftItemUI, ItemClaim } from "../types/models";
import { useAuth } from '../hooks/useAuth';
import { useGiftList } from '../hooks/useGiftList';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftItemRow } from '../components/lists/GiftItemRow';
import { ClaimService } from '../services/ClaimService';
import { ListService } from '../services/ListService';


export async function fetchListData(ownerId: string, listId: string, isOwner: boolean, setLoading: any, setItems: any) {
      setLoading(true);
      try {
        const rawItems = await ListService.getItems(listId);

        let claims: Record<string, ItemClaim> = {};
        if (!isOwner) {
          claims = await ClaimService.getClaimsForList(ownerId, listId);
        }

        const merged: GiftItemUI[] = rawItems.map(item => ({
          ...item,
          claimStatus: claims[item.id] ?? null,
        }));

        setItems(merged);
      } catch (error) {
        console.error('Failed to load list data:', error);
        Alert.alert('Error', 'Could not load the list. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
};

// Define Props for the Screen based on your AppStackParamList
type Props = StackScreenProps<AppStackParamList, 'ListDetail'>;

/**
 * Main List Detail Screen Component
 */
// 1. ADDED `navigation` TO DESTRUCTURED PROPS
export const ListDetailScreen = ({ route, navigation }: Props) => {
  const { listId, ownerId } = route.params;
  const { user } = useAuth();
  const { items, loading, isOwner, toggleClaim } = useGiftList(listId, ownerId);

  const handleToggleClaim = (item: GiftItemUI) => {
    const itemId = item.id;
    const currentClaimer = item.claimStatus?.claimedBy ?? null;
    // TODO: Implement Firebase update logic
    console.log(`Toggling claim for item ${itemId}. Current claimer: ${currentClaimer}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        // 2. ADDED PADDING TO BOTTOM OF LIST SO FAB DOESN'T COVER LAST ITEM
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        renderItem={({ item }) => (
          <GiftItemRow
            item={item}
            currentUserId={user?.uid ?? ''}
            isOwner={isOwner}
            onToggleClaim={handleToggleClaim}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items in this list yet.</Text>
          </View>
        }
      />

      {/* 3. ADDED THE FLOATING ACTION BUTTON (FAB) BACK HERE */}
      {isOwner && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddItem', { listId: listId })}
        >
          <Text style={styles.fabText}>+ Add Item</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  cardDimmed: {
    opacity: 0.6,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: '#888',
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  subBadge: {
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subBadgeText: {
    fontSize: 11,
    color: '#1e8e3e',
    fontWeight: '600',
  },
  linkText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  claimBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    marginLeft: 10,
  },
  claimBtnMine: {
    backgroundColor: '#ff3b30',
  },
  claimBtnTaken: {
    backgroundColor: '#e0e0e0',
  },
  claimBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  claimBtnTextTaken: {
    color: '#888',
  },
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8e8e93',
    fontSize: 16,
  },

  // 4. ADDED STYLES FOR THE FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#007AFF',
    width: 120,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  }
});