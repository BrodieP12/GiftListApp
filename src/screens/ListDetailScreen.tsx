import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Linking, 
  FlatList, 
  SafeAreaView,
  ActivityIndicator, 
  Alert
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { GiftItemUI, ItemClaim } from "../types/models";
import { useAuth } from '../hooks/useAuth';
import { ClaimService } from '../services/ClaimService';
import { ListService } from '../services/ListService';
import { FloatingAction } from 'react-native-floating-action'

// Define Props for the Screen based on your AppStackParamList
type Props = StackScreenProps<AppStackParamList, 'ListDetail'>;



interface GiftItemRowProps extends GiftItemUI {
  currentUserId: string;
  isOwner: boolean;
  onToggleClaim: (itemId: string, currentClaimer: string | null) => void;
}

/**
 * Individual Row Component for a Gift Item
 */
export const GiftItemRow = ({ 
  id, name, description, price = 0, imageUri, url, substitutions, claimStatus, currentUserId, isOwner, onToggleClaim 
}: GiftItemRowProps) => {
  const isClaimed = Boolean(claimStatus?.claimedBy);
  const isClaimedByMe = claimStatus?.claimedBy === currentUserId;
  const displayPrice = price > 0 ? `$${price.toFixed(2)}` : 'Price Undetermined';

  const handleLinkPress = () => {
    if (url) {
      Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    }
  };

  return (
    <View style={[styles.card, isClaimed && !isClaimedByMe && styles.cardDimmed]}>
      {/* Image Section */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          <Text style={styles.price}>{displayPrice}</Text>
        </View>

        {description ? (
          <Text style={styles.description} numberOfLines={3}>{description}</Text>
        ) : null}

        <View style={styles.badgeRow}>
          {substitutions && (
            <View style={styles.subBadge}>
              <Text style={styles.subBadgeText}>🔄 Substitutions OK</Text>
            </View>
          )}
          {url && (
            <TouchableOpacity onPress={handleLinkPress}>
              <Text style={styles.linkText}>🔗 View Link</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Claim Action */}
      {!isOwner && (
        <TouchableOpacity 
          style={[
            styles.claimBtn, 
            isClaimedByMe ? styles.claimBtnMine : isClaimed ? styles.claimBtnTaken : null
          ]}
          onPress={() => onToggleClaim(id, claimStatus?.claimedBy || null)}
          disabled={isClaimed && !isClaimedByMe}
        >
          <Text style={[
            styles.claimBtnText,
            isClaimed && !isClaimedByMe && styles.claimBtnTextTaken
          ]}>
            {isClaimedByMe ? 'Unclaim' : isClaimed ? 'Claimed' : 'Claim'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Main List Detail Screen Component
 */
// 1. ADDED `navigation` TO DESTRUCTURED PROPS
export const ListDetailScreen = ({ route, navigation }: Props) => {
  const { listId, ownerId } = route.params;
  const { user } = useAuth();

  const [items, setItems] = useState<GiftItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  

  // Mock current user - replace with your actual auth context later
  const currentUserId = user?.uid ?? ''; 
  const isOwner = currentUserId === ownerId;

  useEffect(() => {
    const fetchData = async () => {
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

    fetchData();
    
  }, [listId, ownerId, isOwner]);

  const handleToggleClaim = (itemId: string, currentClaimer: string | null) => {
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
            {...item} 
            currentUserId={currentUserId}
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