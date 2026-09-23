/**
 * AccessDeniedModal.tsx
 *
 * Simple blocking modal shown when a user tries to view a gift list they
 * don't have permission to access (e.g. a list they aren't the owner of and
 * haven't joined via a valid share code, or a list whose RLS policy in
 * Supabase rejects the read). Presents a single "Go Back" action with no
 * way to dismiss other than that, since there's nothing else useful to do
 * on a list the viewer can't see.
 */
import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';
import { Button } from '../common/Button';

/** Props for {@link AccessDeniedModal}. `visible` controls display;
 * `onGoBack` should navigate the user away from the inaccessible list. */
interface AccessDeniedModalProps {
  visible: boolean;
  onGoBack: () => void;
}

/**
 * Full-screen-overlay modal informing the user they lack permission to view
 * the current list, with a single "Go Back" button as the only exit.
 */
export const AccessDeniedModal = ({ visible, onGoBack }: AccessDeniedModalProps) => {
  const { colors } = useAppTheme();
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Access Denied</Text>
          <Text style={[styles.modalText, { color: colors.textDim }]}>
            You do not have permission to view this list.
          </Text>
          <Button 
            title="Go Back" 
            onPress={onGoBack}
            variant="primary"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  }
});
