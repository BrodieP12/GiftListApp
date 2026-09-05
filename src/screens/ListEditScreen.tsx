import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ListService } from '../services/ListService';
import { UserService } from '../services/UserService';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import {GiftItemUI, GiftList, User} from '../types/models';
import { RouteProp } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import {CrashLogger} from "../services/LoggingService"; // IMPORT THEME Context

type ListEditScreenRouteProp = RouteProp<AppStackParamList, 'ListEdit'>;

export const ListEditScreen = () => {
  const route = useRoute<ListEditScreenRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { listId } = route.params;

  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [list, setList] = useState<GiftList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [participants, setParticipants] = useState<User[]>([]);

  const [items, setItems] = useState<GiftItemUI[]>([]);


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const listData = await ListService.getList(listId);
      if (!listData) {
        Alert.alert('Error', 'List not found');
        navigation.goBack();
        return;
      }

      setList(listData);
      setTitle(listData.title);
      setIsPrivate(listData.isPrivate);

      if (listData.allowedUsers && listData.allowedUsers.length > 0) {
        const users = await UserService.getUserDocuments(listData.allowedUsers);
        setParticipants(users);
      }
    } catch (error) {
      CrashLogger.error(error);
      Alert.alert('Error', 'Failed to load list details.');
    } finally {
      setLoading(false);
    }
  }, [listId, navigation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'List title cannot be empty');
      return;
    }

    try {
      setSaving(true);
      await ListService.updateList(listId, {
        title: title.trim(),
        isPrivate: isPrivate,
      });
      Alert.alert('Success', 'List updated successfully');
      navigation.goBack();
    } catch (error) {
      CrashLogger.error(error);
      Alert.alert('Error', 'Failed to update list. Please try again.');
    } finally {
      setSaving(false);
    }
  };


  const isOwner = user?.uid === list?.ownerId;

  useEffect(() => {
    // Only verify ownership once list is loaded
    if (!loading && list && !isOwner) {
      Alert.alert('Permission Denied', 'You do not have permission to edit this list.');
      navigation.goBack();
    }
  }, [loading, list, isOwner, navigation]);

  const copyToClipboard = async () => {
    if (list?.shareCode) {
      await Clipboard.setStringAsync(list.shareCode);
      Alert.alert('Copied', 'Share code copied to clipboard');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <View style={styles.section}>
        <Text style={styles.label}>List Title</Text>
        <View style={styles.inputContainer}>
          <FontAwesome5 name="edit" size={16} color={colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter list title"
            placeholderTextColor={colors.textDim}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Privacy Settings</Text>
            <Text style={styles.subLabel}>
              {isPrivate ? 'This list is private' : 'This list is shareable'}
            </Text>
          </View>
          <Switch
            value={!isPrivate}
            onValueChange={(val) => setIsPrivate(!val)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={'#fff'}
          />
        </View>
      </View>

      {!isPrivate && list?.shareCode && (
        <View style={styles.section}>
          <Text style={styles.label}>Share Code</Text>
          <View style={styles.shareCodeContainer}>
            <Text style={styles.shareCodeText}>{list.shareCode}</Text>
            <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
              <FontAwesome5 name="copy" size={18} color={colors.primary} />
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Share this code with friends so they can view your list.</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Shared With ({participants.length})</Text>
        {participants.length > 0 ? (
          participants.map((p) => (
            <View key={p.uid} style={styles.participantItem}>
              <View style={styles.avatarMini}>
                <Text style={styles.avatarText}>
                  {(p.displayName || p.email || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.participantName}>{p.displayName || 'No Name'}</Text>
                <Text style={styles.participantEmail}>{p.email}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No one has joined this list yet. :(</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          icon="check"
        />
        <TouchableOpacity 
          style={styles.cancelLink}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.text,
  },
  subLabel: {
    fontSize: 14,
    color: colors.textDim,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: colors.text,
  },
  shareCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginTop: 8,
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  shareCodeText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: colors.text,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  copyText: {
    marginLeft: 6,
    fontWeight: '600',
    color: colors.primary,
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    color: colors.textDim,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: colors.border,
  },
  avatarText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: colors.text,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  participantEmail: {
    fontSize: 13,
    color: colors.textDim,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    color: colors.textDim,
  },
  footer: {
    marginTop: 10,
  },
  cancelLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelLinkText: {
    fontSize: 16,
    color: colors.textDim,
  },
});
