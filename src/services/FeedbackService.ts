import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { db } from '../api/firebase';
import { Feedback } from '../types/models';

export const FeedbackService = {
  /**
   * Submits user feedback to Firestore
   */
  async submitFeedback(userId: string, userEmail: string, text: string) {
    if (!text.trim()) throw new Error("Feedback cannot be empty");

    const appVersion = Application.nativeApplicationVersion || '1.0.0';

    await addDoc(collection(db, 'feedback'), {
      userId,
      userEmail,
      text,
      type: 'general', // You could expand this with a dropdown later
      createdAt: serverTimestamp(),
      platform: Platform.OS,
      osVersion: Platform.Version,
      appVersion
    });
  }
};