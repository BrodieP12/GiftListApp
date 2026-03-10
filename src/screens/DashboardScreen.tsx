// src/screens/DashboardScreen.tsx
import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, ActivityIndicator 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ListService } from '../services/ListService';
import { useAuth } from '../hooks/useAuth';
import { GiftList } from '../types/models';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { Button } from '../components/common/Button';

type DashboardNavProp = StackNavigationProp<AppStackParamList, 'Dashboard'>;

export const DashboardScreen = ({ navigation }: { navigation: DashboardNavProp }) => {
  const { user, logout } = useAuth();
  const [lists, setLists] = useState<GiftList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLists = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const myLists = await ListService.getOwnedLists(user.uid);
      setLists(myLists);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLists();
    }, [user])
  );

  const renderItem = ({ item }: { item: GiftList }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSub}>Owner: Me</Text>
      </View>
      <Button 
        title="View →" 
        variant="secondary"
        onPress={() => {
          navigation.navigate('ListDetail', { 
            listId: item.id,
            ownerId: item.ownerId 
          });
        }} 
      />
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.welcome}>Hello, {user?.email}</Text>
        <Button
          title="Logout"
          variant="danger"
          onPress={logout}
        />
      </View>
      <Text style={styles.sectionTitle}>My Lists</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderListHeader}
          // Explicitly constrain the FlatList to the parent view
          style={styles.list} 
          contentContainerStyle={styles.listContent} 
          // Force iOS/Android to allow vertical dragging even if items are few
          alwaysBounceVertical={true} 
          ListEmptyComponent={
            <Text style={styles.empty}>No lists yet. Create one!</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  list: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 100 }, 
  
  headerContainer: { marginBottom: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  
  welcome: { fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#333' },
  
  card: { 
    backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSub: { color: 'gray', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
});