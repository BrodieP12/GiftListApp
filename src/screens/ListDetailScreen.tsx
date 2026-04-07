import React, { useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator 
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { StackScreenProps } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useListDetail } from '../hooks/useListDetail';
import { useAppTheme } from '../theme/ThemeContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { GiftItemRow } from '../components/lists/GiftItemRow';

type Props = StackScreenProps<AppStackParamList, 'ListDetail'>;

export const ListDetailScreen = ({ route, navigation }: Props) => {
  const { listId, ownerId } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const currentUserId = user?.uid ?? ''; 
  const isOwner = currentUserId === ownerId;

  // Extracted logic using our new custom hook!
  const { items, loading, fetchListData, handleToggleClaim } = useListDetail(
    ownerId, listId, isOwner, currentUserId
  );

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

  if (loading) {
    return (
        // Utilizing dynamic AppTheme Colors
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
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
            <Text style={[styles.emptyText, { color: colors.textDim }]}>No items in this list yet.</Text>
          </View>
        }
      />

      {isOwner && (
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AddItem', { listId: listId })}
        >
          <FontAwesome5 name="plus" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.fabText}>Add Item</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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

