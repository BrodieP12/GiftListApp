/**
 * CreateList.tsx
 *
 * Modal form for creating a new gift list: collects a list name and a
 * "shareable" toggle, then hands the values off to the parent via
 * `onCreate` — this component has no direct backend/Supabase dependency,
 * it's purely presentational/form state. The parent screen is responsible
 * for actually persisting the list (and, if shareable, generating the
 * share code shown afterward by `ShareCodeModal`).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';

/**
 * Props for {@link CreateListModal}.
 *
 * - `onCreate(name, isSharable)` fires only after client-side validation
 *   (non-empty, trimmed name) passes; the modal does not call it directly
 *   from input — see `handleCreate` below.
 * - `loading` disables all inputs/buttons and shows a spinner on the Create
 *   button while the parent's creation request is in flight.
 */
interface CreateListModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, isSharable: boolean) => void;
  loading?: boolean;
}

/**
 * Modal form for capturing a new list's name and shareable flag. Validates
 * the name is non-blank before invoking `onCreate`, and resets its own
 * local input state after a successful submit or on close.
 */
export const CreateListModal = ({
  visible,
  onClose,
  onCreate,
  loading = false,
}: CreateListModalProps) => {
  const [name, setName] = useState('');
  const [isSharable, setIsSharable] = useState(false);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  // Guards against creating a list with a blank/whitespace-only name; the
  // Create button is also visually disabled in that state (see
  // `disabledButton` usage below), this is the corresponding logic guard.
  const handleCreate = () => {
    if (name.trim().length === 0) return;
    onCreate(name.trim(), isSharable);
    // Reset form after submit
    setName('');
    setIsSharable(false);
  };

  const handleClose = () => {
    setName('');
    setIsSharable(false);
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
          <View style={styles.titleContainer}>
            <FontAwesome5 name="list-alt" size={24} color={colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.title}>Create a New List</Text>
          </View>

          {/* List Name Input */}
          <Text style={styles.label}>List Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Birthday Wishlist"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
            autoFocus
            editable={!loading}
          />

          {/* Shareable Toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Make this list shareable</Text>
            <Switch
              value={isSharable}
              onValueChange={setIsSharable}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={'#fff'}
              disabled={loading}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.createButton,
                (name.trim().length === 0 || loading) && styles.disabledButton,
              ]}
              onPress={handleCreate}
              disabled={name.trim().length === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <FontAwesome5 name="plus" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.createButtonText}>Create</Text>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 18,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  switchLabel: {
    fontSize: 16,
    color: colors.text,
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
  createButton: {
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
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});