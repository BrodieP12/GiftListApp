import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
    Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ListService } from '../services/ListService';
import { useAuth } from '../hooks/useAuth';
import { GiftList } from '../types/models';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { Button } from '../components/common/Button';
import { useAppTheme } from '../theme/ThemeContext';

type DashboardNavProp = StackNavigationProp<AppStackParamList, 'Dashboard'>;

export const DashboardScreen = ({ navigation }: { navigation: DashboardNavProp }) => {
    const { user, logout } = useAuth();
    const { isDarkMode, colors, toggleTheme } = useAppTheme();
    const [lists, setLists] = useState<GiftList[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLists = useCallback(async () => {
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
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            fetchLists();
        }, [fetchLists])
    );

    const handleCreateList = async () => {
        if (!user) return;
        const newTitle = `My List - ${new Date().toLocaleDateString()}`;
        
        try{
            await ListService.createList(user.uid, newTitle);
            await fetchLists();
        } catch(error){
            console.error("Error fetching lists.", error);
            Alert.alert("There was an error fetching your lists. Are you connected to the internet?");
        }
        
    };

    const renderItem = ({ item }: { item: GiftList }) => (
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
            <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Owner: Me</Text>
            </View>
            <Button
                title="View →"
                variant="secondary"
                onPress={() => navigation.navigate('ListDetail', {
                    listId: item.id,
                    ownerId: item.ownerId
                })}
            />
        </View>
    );

    const renderListHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <Text style={[styles.welcome, { color: colors.text }]}>Hello, {user?.email}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
                        <Text style={styles.themeToggleText}>{isDarkMode ? '🌞' : '🌙'}</Text>
                    </TouchableOpacity>
                    <Button title="Logout" variant="danger" onPress={logout} />
                </View>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Lists</Text>
        </View>
    );

    return (
        // ✅ This outer View is the full screen, and uses flex: 1
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <>
                    {/* ✅ FlatList takes all available space and scrolls within it */}
                    <FlatList
                        data={lists}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        ListHeaderComponent={renderListHeader}
                        style={styles.list}
                        // ✅ Extra bottom padding so last item isn't hidden behind the FAB
                        contentContainerStyle={styles.listContent}
                        alwaysBounceVertical={true}
                        ListEmptyComponent={
                            <Text style={[styles.empty, { color: colors.textSecondary }]}>No lists yet. Tap + to create one!</Text>
                        }
                    />

                    {/* ✅ FAB is a sibling to FlatList, not inside it — position: 'absolute' pins it to the corner */}
                    <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={handleCreateList}>
                        <Text style={styles.fabText}>+</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    list: { flex: 1 },
    // ✅ paddingBottom: 100 gives clearance so the last card isn't under the FAB
    listContent: { 
        padding: 20, 
        paddingBottom: 100,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center'
    },

    headerContainer: { marginBottom: 15 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },

    welcome: { fontSize: 16, fontWeight: 'bold' },
    sectionTitle: { fontSize: 22, fontWeight: '800' },
    
    themeToggle: {
        width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 20,
    },
    themeToggleText: { fontSize: 20 },

    card: {
        padding: 20, borderRadius: 12, marginBottom: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        elevation: 2, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
    cardTitle: { fontSize: 18, fontWeight: '600' },
    cardSub: { marginTop: 4 },
    empty: { textAlign: 'center', marginTop: 40 },

    // ✅ FAB styles — position absolute takes it out of flow and pins to corner
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 24,
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    fabText: {
        color: '#fff',
        fontSize: 32,
        lineHeight: 34,
        fontWeight: '300',
    },
});