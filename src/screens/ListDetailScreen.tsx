// screens/ListDetailScreen.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { GiftItemUI } from "../types/models";
import { useAuth } from '../hooks/useAuth';
import { useGiftList } from '../hooks/useGiftList';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { GiftItemRow } from '../components/lists/GiftItemRow';

type Props = StackScreenProps<AppStackParamList, 'ListDetail'>;

export const ListDetailScreen = ({ route, navigation }: Props) => {
  const { listId, ownerId } = route.params;
  const { user } = useAuth();
  
  // 1. Destructure `refresh` (matches your hook's exported property)
  const { items, loading, isOwner, toggleClaim, refresh } = useGiftList(listId, ownerId);

  // 2. Trigger the refresh function whenever the screen regains focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]) 
  );

  const handleToggleClaim = (item: GiftItemUI) => {
    // Directly call the hook's toggleClaim function
    toggleClaim(item);
  };

  // 3. Prevent full-screen loading spinner if we already have items during a background refresh
  if (loading && !items?.length) {
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
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8e8e93',
    fontSize: 16,
  },
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