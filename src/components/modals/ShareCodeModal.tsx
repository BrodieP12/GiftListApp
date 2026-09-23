/**
 * ShareCodeModal.tsx
 *
 * Confirmation modal shown right after a list is created (or whenever the
 * user wants to view a list's join code again). Displays the short share
 * code that friends use to find and join this list, and offers a one-tap
 * "Copy Code" action (via `expo-clipboard`) so the user can paste it into a
 * message to share. The code itself is generated/persisted elsewhere
 * (list creation flow / Supabase) — this component only displays and
 * copies it.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';

/** Props for {@link ShareCodeModal}. `shareCode` is the list's join code to
 * display and copy; `onClose` dismisses the modal (via "Done" or the
 * native back gesture). */
interface ShareCodeModalProps {
  visible: boolean;
  shareCode: string;
  onClose: () => void;
}

/**
 * Displays a list's share code in a large, easy-to-read format with a copy-
 * to-clipboard shortcut, so the list owner can hand it off to friends who
 * should be able to find/join the list.
 */
export const ShareCodeModal = ({
  visible,
  shareCode,
  onClose,
}: ShareCodeModalProps) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  // Copies the share code to the system clipboard and confirms via a
  // native Alert — no other feedback/analytics side effect here.
  const handleCopy = async () => {
    await Clipboard.setStringAsync(shareCode);
    Alert.alert('Copied!', 'Share code copied to clipboard.');
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      transparent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>List Created!</Text>
          <Text style={styles.subtitle}>
            Share this code with friends so they can view your list:
          </Text>

          {/* Share Code Display */}
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{shareCode}</Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
            <View style={styles.buttonContent}>
              <FontAwesome5 name="copy" size={18} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.copyButtonText}>Copy Code</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: colors.card,
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    width: '85%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  codeContainer: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.primary,
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});
