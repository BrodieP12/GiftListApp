import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';

interface JoinListModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (shareCode: string) => void;
  loading?: boolean;
}

/**
 * Modal for joining a list shared by another user via its 7-character code.
 */
export const JoinListModal = ({
  visible,
  onClose,
  onJoin,
  loading = false,
}: JoinListModalProps) => {
  const [code, setCode] = useState('');
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const trimmed = code.trim();

  const handleJoin = () => {
    if (trimmed.length === 0) return;
    onJoin(trimmed.toUpperCase());
  };

  const handleClose = () => {
    setCode('');
    onClose();
  };

  return (
    <Modal visible={visible} onRequestClose={handleClose} animationType="fade" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={styles.content}>
            <View style={styles.titleContainer}>
              <FontAwesome5 name="link" size={22} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.title}>Join a Shared List</Text>
            </View>

            <Text style={styles.label}>Enter the share code a friend gave you</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. A1B2C3D"
              placeholderTextColor={colors.textDim}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              autoFocus
              editable={!loading}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.joinButton, (trimmed.length === 0 || loading) && styles.disabledButton]}
                onPress={handleJoin}
                disabled={trimmed.length === 0 || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <FontAwesome5 name="sign-in-alt" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.joinButtonText}>Join</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      backgroundColor: colors.card,
      padding: 24,
      borderRadius: 20,
      width: '85%',
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textDim,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      letterSpacing: 2,
      textAlign: 'center',
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 18,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 16,
    },
    joinButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    joinButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
