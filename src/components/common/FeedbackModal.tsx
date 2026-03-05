import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import { Button } from './Button'; // Reusing your Button component
import { FeedbackService } from '../../services/FeedbackService';
import { useAuth } from '../../hooks/useAuth';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FeedbackModal = ({ visible, onClose }: FeedbackModalProps) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await FeedbackService.submitFeedback(user.uid, user.email || 'Anonymous', text);
      Alert.alert('Thank You', 'We appreciate your feedback!');
      setText(''); // Clear form
      onClose();   // Close modal
    } catch (error) {
      Alert.alert('Error', 'Could not send feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.centeredView}
        >
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Send Feedback</Text>
            <Text style={styles.modalSubtitle}>Found a bug? Have an idea?</Text>

            <TextInput
              style={styles.input}
              placeholder="Type your thoughts here..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={text}
              onChangeText={setText}
            />

            <View style={styles.buttonRow}>
              <Button 
                title="Cancel" 
                variant="secondary" 
                onPress={onClose} 
                style={styles.button}
              />
              <View style={{ width: 10 }} />
              <Button 
                title="Send" 
                onPress={handleSubmit} 
                loading={loading}
                style={styles.button}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', // Dimmed background
  },
  modalView: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  input: {
    width: '100%',
    height: 100,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    textAlignVertical: 'top', // Ensures text starts at top-left
    backgroundColor: '#F9F9F9'
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
  }
});