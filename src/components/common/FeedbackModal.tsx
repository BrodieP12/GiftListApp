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
  Alert,
  Switch,
  TouchableOpacity
} from 'react-native';
import { Button } from './Button';
import { FeedbackService } from '../../services/FeedbackService';
import { useAuth } from '../../hooks/useAuth';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

type FeedbackType = 'general' | 'bug' | 'feature';

export const FeedbackModal = ({ visible, onClose }: FeedbackModalProps) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');

  const handleSubmit = async () => {
    if (!user) return;
    if (!text.trim()) {
      Alert.alert('Empty Feedback', 'Please enter some text before sending.');
      return;
    }
    
    setLoading(true);
    try {
      await FeedbackService.submitFeedback(
        user.uid, 
        user.email || 'Anonymous', 
        text, 
        type,
        isAnonymous
      );

      Alert.alert('Thank You', 'We appreciate your feedback!');
      setText('');
      setType('general');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Could not send feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const senderEmail = isAnonymous ? 'anonymous@example.com' : (user?.email || 'N/A');

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
            
            <View style={styles.typeSelector}>
              {(['general', 'bug', 'feature'] as FeedbackType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && styles.typeChipSelected]}
                  onPress={() => setType(t)}
                  disabled={loading}
                >
                  <Text style={[styles.typeText, type === t && styles.typeTextSelected]}>
                    {t === 'general' ? 'General' : t === 'bug' ? 'Bug' : 'Feature'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Type your thoughts here..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={text}
              onChangeText={setText}
              editable={!loading}
            />

            <View style={styles.optionsContainer}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Send Anonymously?</Text>
                <Switch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
                    trackColor={{ false: '#E0E0E0', true: '#81b0ff' }}
                    thumbColor={isAnonymous ? '#007AFF' : '#f4f3f4'}
                    disabled={loading}
                />
              </View>
              
              <View style={styles.emailPreview}>
                <Text style={styles.emailLabel}>Sending as:</Text>
                <Text style={styles.emailValue}>{senderEmail}</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button 
                title="Cancel" 
                variant="secondary" 
                onPress={onClose} 
                style={styles.button}
                disabled={loading}
              />
              <View style={{ width: 12 }} />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipSelected: {
    backgroundColor: '#007AFF15',
    borderColor: '#007AFF',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  typeTextSelected: {
    color: '#007AFF',
  },
  input: {
    width: '100%',
    minHeight: 120,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 20,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#333',
  },
  optionsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  emailPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
  },
  emailLabel: {
    fontSize: 12,
    color: '#777',
    marginRight: 6,
  },
  emailValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
  },
  button: {
    flex: 1,
  }
});