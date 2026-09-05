import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../api/firebase';
import { Feedback } from '../types/models';

export const FeedbackService = {
  /**
   * Submits user feedback to Firestore
   */
  async submitFeedback(userId: string, userEmail: string, text: string, type: string = 'general', isAnonymous: boolean = false) {
    if (!text.trim()) throw new Error("Feedback cannot be empty");

    await db.collection('feedback').add({
      userId: isAnonymous ? 'anonymous' : userId,
      userEmail: isAnonymous ? 'anonymous@example.com' : userEmail,
      text,
      type,
      isAnonymous,
      createdAt: firestore.FieldValue.serverTimestamp(),
      platform: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web' 
    });
  }
};