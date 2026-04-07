import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
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

type DashboardNavProp = StackNavigationProp<AppStackParamList, 'Dashboard'>;

export const DashboardScreen = ({ navigation }: { navigation: DashboardNavProp }) => {
    const { user, logout } = useAuth();
    
    // Extracted List Management logic
    const { lists, loading, createList, deleteList, fetchLists } = useLists(user?.uid);
    // Theming logic
    const { colors } = useAppTheme();

    // Modal state
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [shareCodeModalVisible, setShareCodeModalVisible] = useState(false);
    const [pendingShareCode, setPendingShareCode] = useState('');

    // Delete state
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleCreateList = async (name: string, isSharable: boolean) => {
        setCreateLoading(true);
        try {
            const result = await createList(name, isSharable);
            setCreateModalVisible(false);
            fetchLists();

            // Notify user of their share code immediately
            if (result.shareCode) {
                setPendingShareCode(result.shareCode);
                setShareCodeModalVisible(true);
            }
        } catch (error) {
            const err = error as Error;
            Alert.alert('Error', err.message || 'Failed to create list');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDeletePress = (id: string) => {
        setDeleteTargetId(id);
        setConfirmVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await deleteList(deleteTargetId);
            fetchLists();
        } catch (error) {
            Alert.alert('Error', 'Failed to delete list');
        } finally {
            setConfirmVisible(false);
            setDeleteTargetId(null);
        }
    };

    const renderItem = ({ item }: { item: GiftList }) => (
        <GiftListRow
            list={item}
            onPress={() => navigation.navigate('ListDetail', {
                listId: item.id,
                ownerId: item.ownerId
            })}
            onDelete={handleDeletePress}
        />
    );

    const renderListHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <Text style={[styles.welcome, { color: colors.text }]}>
                    Hello, {user?.givenName || user?.email}
                </Text>
                <Button title="Logout" variant="danger" onPress={logout} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Lists</Text>
        </View>
    );

    const flatListRef = useRef<FlatList>(null);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <>
                    <FlatList
                        ref={flatListRef}
                        data={lists}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        ListHeaderComponent={renderListHeader}
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        alwaysBounceVertical={true}
                        ListEmptyComponent={
                            <Text style={[styles.empty, { color: colors.textDim }]}>
                                No lists yet. Tap + to create one!
                            </Text>
                        }
                    />

                    {/* Enhanced FAB with theme colors */}
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: colors.primary }]}
                        onPress={() => setCreateModalVisible(true)}
                    >
                        <FontAwesome5 name="plus" size={24} color="#fff" />
                    </TouchableOpacity>
                </>
            )}

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

            <ConfirmationModal
                visible={confirmVisible}
                title="Delete List"
                message="Are you sure you want to delete this list? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { flex: 1 },
    listContent: { padding: 20, paddingBottom: 100 },
    headerContainer: { marginBottom: 15 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    welcome: { fontSize: 16, fontWeight: 'bold' },
    sectionTitle: { fontSize: 22, fontWeight: '800' },
    empty: { textAlign: 'center', marginTop: 40 },
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
});