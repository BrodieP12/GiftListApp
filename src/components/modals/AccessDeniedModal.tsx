import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';
import { Button } from '../common/Button';

interface AccessDeniedModalProps {
  visible: boolean;
  onGoBack: () => void;
}

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
