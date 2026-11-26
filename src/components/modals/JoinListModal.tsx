/**
 * JoinListModal.tsx
 *
 * Dedicated modal for joining a shared gift list via its 7-character share code.
 * Features an inviting header, clean letter-spaced code entry with auto-capitalization,
 * clipboard paste convenience, live validation, and smooth keyboard avoidance.
 */
import React, { useState, useEffect } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';

interface JoinListModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void> | void;
  loading?: boolean;
}

export const JoinListModal = ({
  visible,
  onClose,
  onJoin,
  loading = false,
}: JoinListModalProps) => {
  const [code, setCode] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    if (visible) {
      setCode('');
      setIsFocused(false);
    }
  }, [visible]);

  const sanitizedCode = code.trim().toUpperCase();
  const isValidLength = sanitizedCode.length === 7;

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        // Strip spaces, dashes, symbols and take up to 7 characters
        const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
        setCode(cleaned);
      }
    } catch {
      // Ignore clipboard read errors silently
    }
  };

  const handleSubmit = () => {
    if (!isValidLength || loading) return;
    onJoin(sanitizedCode);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setCode('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      animationType="fade"
      transparent={true}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={styles.content}>
            {/* Top Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={loading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <FontAwesome5 name="times" size={18} color={colors.textDim} />
            </TouchableOpacity>

            {/* Header Icon & Title */}
            <View style={styles.iconCircle}>
              <FontAwesome5 name="gift" size={28} color={colors.primary} />
            </View>

            <Text style={styles.title}>Join a Shared List</Text>
            <Text style={styles.subtitle}>
              Enter the 7-character invite code to view and claim items from your friend's list.
            </Text>

            {/* Code Input Card */}
            <View
              style={[
                styles.inputWrapper,
                isFocused && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="ABC1234"
                placeholderTextColor={colors.textDim + '88'}
                value={code}
                onChangeText={(t) =>
                  setCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7))
                }
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus={true}
                maxLength={7}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!loading}
              />
            </View>

            {/* Helper row: Character indicator & Paste from clipboard */}
            <View style={styles.helperRow}>
              <Text
                style={[
                  styles.counterText,
                  isValidLength && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {code.length}/7 characters
              </Text>

              <TouchableOpacity
                style={styles.pasteButton}
                onPress={handlePaste}
                disabled={loading}
              >
                <FontAwesome5
                  name="paste"
                  size={13}
                  color={colors.primary}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.pasteText}>Paste</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[
                styles.joinButton,
                (!isValidLength || loading) && styles.joinButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isValidLength || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.joinButtonContent}>
                  <Text style={styles.joinButtonText}>Join List</Text>
                  <FontAwesome5
                    name="arrow-right"
                    size={15}
                    color="#fff"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      backgroundColor: colors.card,
      paddingHorizontal: 26,
      paddingTop: 32,
      paddingBottom: 24,
      borderRadius: 24,
      width: '88%',
      maxWidth: 400,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 10,
      position: 'relative',
    },
    closeButton: {
      position: 'absolute',
      top: 18,
      right: 18,
      padding: 6,
      zIndex: 10,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textDim,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
      paddingHorizontal: 8,
    },
    inputWrapper: {
      width: '100%',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputWrapperFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    input: {
      width: '100%',
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 6,
      color: colors.text,
      textAlign: 'center',
      padding: 0,
      margin: 0,
    },
    helperRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    counterText: {
      fontSize: 12,
      color: colors.textDim,
      fontWeight: '500',
    },
    pasteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.primary + '14',
    },
    pasteText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    joinButton: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    joinButtonDisabled: {
      opacity: 0.45,
      shadowOpacity: 0,
      elevation: 0,
    },
    joinButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    cancelButton: {
      width: '100%',
      paddingVertical: 10,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textDim,
      fontSize: 15,
      fontWeight: '600',
    },
  });
