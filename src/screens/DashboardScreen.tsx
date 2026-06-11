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
import { JoinListModal } from '../components/modals/JoinListModal';
import { ShareCodeModal } from '../components/modals/ShareCodeModal';
import { FontAwesome5 } from '@expo/vector-icons';
import { GiftListRow } from '../components/lists/GiftListRow';
import { ConfirmationModal } from '../components/modals/Confirmation';
import {CrashLogger} from "../services/LoggingService";

type DashboardNavProp = StackNavigationProp<AppStackParamList, 'Dashboard'>;

// Row model for the combined (sectioned) list rendered in a single FlatList.
type Row =
    | { kind: 'section'; key: string; title: string }
    | { kind: 'owned'; key: string; list: GiftList }
    | { kind: 'shared'; key: string; list: GiftList }
    | { kind: 'empty'; key: string; text: string }
    | { kind: 'loading'; key: string };

export const DashboardScreen = ({ navigation }: { navigation: DashboardNavProp }) => {
    const { user, logout } = useAuth();

    // Owned + shared list management.
    const {
        lists, sharedLists, loading, sharedLoading,
        createList, deleteList, joinList, leaveList,
    } = useLists(user?.uid);
    const { colors } = useAppTheme();

    // Create modal state
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [shareCodeModalVisible, setShareCodeModalVisible] = useState(false);
    const [pendingShareCode, setPendingShareCode] = useState('');

    // Join modal state
    const [joinModalVisible, setJoinModalVisible] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);

    // Confirm (delete owned / leave shared) state
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmMode, setConfirmMode] = useState<'delete' | 'leave'>('delete');
    const [targetId, setTargetId] = useState<string | null>(null);

    const handleCreateList = async (name: string, isSharable: boolean) => {
        setCreateLoading(true);
        try {
            const result = await createList(name, isSharable);
            setCreateModalVisible(false);

            // Notify user of their share code immediately
            if (result.shareCode) {
                setPendingShareCode(result.shareCode);
                setShareCodeModalVisible(true);
            }
        } catch (error) {
            const err = error as Error;
            CrashLogger.error(err);
            Alert.alert('Error', err.message || 'Failed to create list');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleJoinList = async (shareCode: string) => {
        setJoinLoading(true);
        try {
            await joinList(shareCode);
            setJoinModalVisible(false);
            Alert.alert('Joined!', 'The list now appears under "Shared with me".');
        } catch (error) {
            const err = error as Error;
            CrashLogger.error(err);
            Alert.alert('Could not join', err.message || 'Please check the code and try again.');
        } finally {
            setJoinLoading(false);
        }
    };

    const handleDeletePress = (id: string) => {
        setConfirmMode('delete');
        setTargetId(id);
        setConfirmVisible(true);
    };

    const handleLeavePress = (id: string) => {
        setConfirmMode('leave');
        setTargetId(id);
        setConfirmVisible(true);
    };

    const handleConfirm = async () => {
        if (!targetId) return;
        try {
            if (confirmMode === 'delete') {
                await deleteList(targetId);
            } else {
                await leaveList(targetId);
            }
        } catch (error) {
            CrashLogger.error(error);
            Alert.alert('Error', confirmMode === 'delete' ? 'Failed to delete list' : 'Failed to leave list');
        } finally {
            setConfirmVisible(false);
            setTargetId(null);
        }
    };

    // Build the combined, sectioned data for the FlatList.
    const data: Row[] = [];
    data.push({ kind: 'section', key: 'sec-owned', title: 'My Lists' });
    if (lists.length === 0) {
        data.push({ kind: 'empty', key: 'empty-owned', text: 'No lists yet. Tap + to create one!' });
    } else {
        lists.forEach((l) => data.push({ kind: 'owned', key: `o-${l.id}`, list: l }));
    }
    data.push({ kind: 'section', key: 'sec-shared', title: 'Shared with me' });
    if (sharedLoading) {
        data.push({ kind: 'loading', key: 'loading-shared' });
    } else if (sharedLists.length === 0) {
        data.push({ kind: 'empty', key: 'empty-shared', text: 'No shared lists yet. Tap the link button to join one!' });
    } else {
        sharedLists.forEach((l) => data.push({ kind: 'shared', key: `s-${l.id}`, list: l }));
    }

    const renderItem = ({ item }: { item: Row }) => {
        switch (item.kind) {
            case 'section':
                return <Text style={[styles.sectionTitle, { color: colors.text }]}>{item.title}</Text>;
            case 'empty':
                return <Text style={[styles.empty, { color: colors.textDim }]}>{item.text}</Text>;
            case 'loading':
                return <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />;
            case 'owned':
                return (
                    <GiftListRow
                        list={item.list}
                        onPress={() => navigation.navigate('ListDetail', { listId: item.list.id, ownerId: item.list.ownerId })}
                        onDelete={handleDeletePress}
                    />
                );
            case 'shared':
                return (
                    <GiftListRow
                        list={item.list}
                        actionIcon="sign-out-alt"
                        onPress={() => navigation.navigate('ListDetail', { listId: item.list.id, ownerId: item.list.ownerId })}
                        onDelete={handleLeavePress}
                    />
                );
        }
    };

    const renderListHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <Text style={[styles.welcome, { color: colors.text }]}>
                    Hello, {user?.givenName || user?.email}
                </Text>
                <Button title="Logout" variant="danger" onPress={logout} />
            </View>
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
                        data={data}
                        keyExtractor={(item) => item.key}
                        renderItem={renderItem}
                        ListHeaderComponent={renderListHeader}
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        alwaysBounceVertical={true}
                    />

                    {/* Join a shared list (secondary FAB) */}
                    <TouchableOpacity
                        style={[styles.fabSecondary, { backgroundColor: colors.card, borderColor: colors.primary }]}
                        onPress={() => setJoinModalVisible(true)}
                    >
                        <FontAwesome5 name="link" size={20} color={colors.primary} />
                    </TouchableOpacity>

                    {/* Create a list (primary FAB) */}
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

            <JoinListModal
                visible={joinModalVisible}
                onClose={() => setJoinModalVisible(false)}
                onJoin={handleJoinList}
                loading={joinLoading}
            />

            <ShareCodeModal
                visible={shareCodeModalVisible}
                shareCode={pendingShareCode}
                onClose={() => setShareCodeModalVisible(false)}
            />

            <ConfirmationModal
                visible={confirmVisible}
                title={confirmMode === 'delete' ? 'Delete List' : 'Leave List'}
                message={
                    confirmMode === 'delete'
                        ? 'Are you sure you want to delete this list? This action cannot be undone.'
                        : 'Are you sure you want to leave this shared list? You can rejoin with the share code.'
                }
                onConfirm={handleConfirm}
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
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    welcome: { fontSize: 16, fontWeight: 'bold' },
    sectionTitle: { fontSize: 22, fontWeight: '800', marginTop: 10, marginBottom: 12 },
    empty: { textAlign: 'center', marginTop: 10, marginBottom: 10 },
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
    fabSecondary: {
        position: 'absolute',
        bottom: 98,
        right: 28,
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
});
