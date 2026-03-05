import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ListService } from '../services/ListService';
import { useAuth } from '../hooks/useAuth';
import { GiftList } from '../types/models';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { Button } from '../components/common/Button';

// Type the navigation prop
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
      // In future: const sharedLists = await ListService.getSharedLists(user.uid);
      setLists(myLists);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Reload lists when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchLists();
    }, [user])
  );

  const handleCreateList = async () => {
    if (!user) return;
    const newTitle = `My List - ${new Date().toLocaleDateString()}`;
    await ListService.createList(user.uid, newTitle);
    fetchLists(); // Refresh
  };

  const renderItem = ({ item }: { item: GiftList }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => {
        // DEBUG LOG: Ensure we actually have an ID here
        console.log("Navigating to list:", item.id); 
        
        navigation.navigate('ListDetail', { 
          listId: item.id,   // <--- MUST be 'listId', not 'id'
          ownerId: item.ownerId 
        });
      }}
    >
      <View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSub}>Owner: Me</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hello, {user?.email}</Text>
        <Button
          title="Logout"
          variant="danger"
          onPress={logout}
          style={ styles.logout }
        />
      </View>

      <Text style={styles.sectionTitle}>My Lists</Text>
      
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>No lists yet. Create one!</Text>
          }
        />
      )}

      {/* FAB (Floating Action Button) to Create List */}
      <Button
        title="+"
        variant="primary"
        onPress={handleCreateList}
        style={styles.fab}
        textStyle={styles.fabText}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  welcome: { fontSize: 16, fontWeight: 'bold' },
  logout: { backgroundColor: 'red' },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginBottom: 15, color: '#333' },
  card: { 
    backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSub: { color: 'gray', marginTop: 4 },
  arrow: { fontSize: 20, color: '#ccc' },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
  fab: {
    position: 'absolute', bottom: 30, right: 30,
    backgroundColor: '#007AFF', width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', elevation: 5
  },
  fabText: { color: 'white', fontSize: 32, marginTop: -4 }
});